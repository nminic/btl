package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;

/**
 * A TEAM THAT GOES BY EVERY ROAD THAT CAN TAKE IT, AND A SEND OF ITS LOGO THAT HAS THE QUEUE ROW, DO NOT MAKE A CYCLE
 * (PENDING, review of PR 844, 28.11.2026).
 *
 * <p><b>What stood before.</b> {@code ATeamGoesWithItsLastMember} took the queue row of the team's waiting logo before
 * its {@code delete from team}, which settled the roads that reach the delete with nothing of {@code team} written
 * yet. Four roads write the team's row first and only then reach it: the member who holds the seat leaving
 * ({@code DELETE /api/teams/{id}/membership}), the administration taking him out
 * ({@code DELETE /api/teams/{id}/members/{number}}, both {@code TeamWriteApi.takeOut}), the deletion of that member
 * ({@code DELETE /api/competitors/{number}}, whose delete empties {@code team.admin_id} through {@code team_admin_fk})
 * and the cancellation of a season ({@code ASeasonBegins.cancelled}, which names a new seat). The reviewer measured
 * {@code deadlock detected} on the first two with a send that already held the queue row; the other two are the
 * same order.
 *
 * <p><b>The order is taken away from the scheduler</b>, as {@link ATeamLogoSentWhileItIsBeingDecidedTest} takes it:
 * this thread holds the queue row, which is where a send is when it wants the team next; the road is submitted and the
 * lock manager is asked until it shows the road stopped; then this thread takes the team's row, which is the
 * send's next statement. A road that already holds the team's row is waiting for the row this thread holds while
 * this thread waits for the team, and the database ends one of them. A road that took the queue row first holds
 * nothing, so this thread takes the team, lets go, and the road goes through.
 *
 * <p><b>The roads are the real ones</b>, requests through the portal's own door with a session and the CSRF token,
 * not the class's methods: the finding was that the class is right where it stands and the roads reach it too late,
 * which a case that calls the class cannot see. The clock is fixed inside the transfer window, and the membership
 * begins in a season still to come, so {@code takeOut} takes the branch that removes the row and the team is left
 * with nobody. Every row is a real commit and {@link #nothingOfItIsLeftBehind} takes it back out.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, ATeamGoingByEveryRoadWhileItsLogoIsSentTest.TheClockInsideTheWindow.class})
class ATeamGoingByEveryRoadWhileItsLogoIsSentTest {

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-team-roads-");
		}
		catch (IOException noFolder) {
			throw new UncheckedIOException(noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	/** 11:00 in Belgrade on 26 November 2027, inside the transfer window (PDL, 21 November). */
	private static final Instant INSIDE_THE_WINDOW = Instant.parse("2027-11-26T09:00:00Z");

	/** A season no case computes, still to come: a membership that begins in it is removed, not ended. */
	private static final int A_SEASON_STILL_TO_COME = 2029;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockInsideTheWindow {

		@Bean
		@Primary
		Clock aClockInsideTheWindow() {
			return Clock.fixed(INSIDE_THE_WINDOW, ZoneOffset.UTC);
		}
	}

	/** Distinct from every other fixture's members and teams, on purpose: these rows are committed. */
	private static final AtomicInteger ISSUED = new AtomicInteger();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private Clock clock;

	@Autowired
	private ASeasonBegins begins;

	/** The row's own lock, held from this thread so every road queues behind it. */
	@Autowired
	private TransactionTemplate holdingTheRow;

	private final List<Team> teams = new ArrayList<>();

	private final List<Long> members = new ArrayList<>();

	private final List<String> addresses = new ArrayList<>();

	private boolean weWroteTheFreeze;

	/** One team the case made: its editor (who holds the seat and is its only member) and his session. */
	private record Team(long id, long editor, String number, String address, SecretToken session) {
	}

	@AfterEach
	void nothingOfItIsLeftBehind() throws IOException {
		/* Real commits, so a real delete, children before parents; every statement tolerates a row the road under
		   test already took. */
		for (Team made : teams) {
			db.sql("delete from verification where team_id = ?").param(made.id()).update();
			db.sql("update team set logo_id = null, admin_id = null where id = ?").param(made.id()).update();
			db.sql("delete from team_membership where team_id = ?").param(made.id()).update();
			db.sql("delete from team where id = ?").param(made.id()).update();
		}

		for (Long member : members) {
			db.sql("delete from message where to_id = ?").param(member).update();
			db.sql("delete from verification where competitor_id = ?").param(member).update();
			db.sql("delete from membership where competitor_id = ?").param(member).update();
		}

		for (String address : addresses) {
			db.sql("delete from account where email = ?").param(address).update();
		}

		for (Long member : members) {
			db.sql("delete from competitor where id = ?").param(member).update();
		}

		if (weWroteTheFreeze) {
			db.sql("delete from season_frozen where season = 2027").update();
		}

		try (var there = Files.list(PHOTOS)) {
			for (Path file : there.toList()) {
				Files.deleteIfExists(file);
			}
		}
	}

	/* ------------------------------------------------------------------------------------------ */

	/**
	 * THE MEMBER WHO HOLDS THE SEAT AND IS ALONE IN THE TEAM LEAVES IT while a send of the team's logo has the queue
	 * row. The road writes {@code team.admin_id} and then deletes the team.
	 */
	@Test
	void theEditorLeavingAndASendOverTheLogoDoNotMakeACycle() throws Exception {
		Team team = aTeamWithALogoThatWaits(true);

		theRoadAndTheSendsNextLockDoNotMakeACycle(team, () -> http.perform(delete("/api/teams/" + team.id()
						+ "/membership").with(csrf()).cookie(new Cookie(SessionCookie.NAME, team.session().secret())))
				.andReturn().getResponse().getStatus(), 204);
	}

	/** THE ADMINISTRATION TAKES HIM OUT: the same {@code takeOut}, another door. */
	@Test
	void theAdministrationTakingTheEditorOutAndASendOverTheLogoDoNotMakeACycle() throws Exception {
		Team team = aTeamWithALogoThatWaits(true);
		SecretToken superadmin = aSuperadmin();

		theRoadAndTheSendsNextLockDoNotMakeACycle(team, () -> http.perform(delete("/api/teams/" + team.id()
						+ "/members/" + team.number()).with(csrf()).cookie(new Cookie(SessionCookie.NAME,
						superadmin.secret())))
				.andReturn().getResponse().getStatus(), 204);
	}

	/**
	 * THE MEMBER WHO HOLDS THE SEAT IS DELETED, and the logo that waits was sent by somebody else (the editor as sender
	 * would take his own queue row with him through the cascade and measure nothing). The delete of the member
	 * empties the seat of the team first and the team goes after it.
	 */
	@Test
	void theDeletionOfTheMemberWhoHoldsTheSeatAndASendOverTheLogoDoNotMakeACycle() throws Exception {
		Team team = aTeamWithALogoThatWaits(false);
		SecretToken superadmin = aSuperadmin();

		theRoadAndTheSendsNextLockDoNotMakeACycle(team, () -> http.perform(delete("/api/competitors/"
						+ team.number()).param("account", "delete").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, superadmin.secret())))
				.andReturn().getResponse().getStatus(), 204);

		assertThat(db.sql("select count(*) from competitor where id = ?").param(team.editor()).query(Long.class)
				.single()).as("the member was not deleted").isZero();
	}

	/** A SEASON CANCELLED AFTER THE TURN names a new seat and deletes the team nobody holds the season of. */
	@Test
	void theCancellationOfASeasonAndASendOverTheLogoDoNotMakeACycle() throws Exception {
		Team team = aTeamWithALogoThatWaits(true);

		weWroteTheFreeze = db.sql("insert into season_frozen (season, frozen_at) values (2027, ?)"
						+ " on conflict do nothing")
				.param(Timestamp.from(Instant.parse("2027-01-01T15:00:00Z"))).update() == 1;

		ZonedDateTime now = ZonedDateTime.now(clock);

		theRoadAndTheSendsNextLockDoNotMakeACycle(team, () -> {
			holdingTheRow.executeWithoutResult(cancelling -> begins.cancelled(team.editor(), 2028, now,
					begins.before(team.editor(), 2028, now)));

			return 0;
		}, 0);
	}

	/**
	 * THE JOB OF 1 JANUARY IS A ROAD THAT WRITES THE SEAT AND THEN DELETES THE TEAM (review of PR 846, 28.11.2026:
	 * measured as {@code deadlock detected}, the victim possibly the transaction that freezes the season). The
	 * editor does not hold 2028, so {@code begin(2028)} takes him out ({@code team.admin_id}) and then the team
	 * nobody holds the season in goes; the queue row is taken before the first of the two.
	 *
	 * <p>The job runs inside a transaction that is rolled back after the check, so the case commits nothing of the
	 * job's and the rest of the database, which the job reads whole, is left as it was; what the job did to the team
	 * is asked inside it.
	 */
	@Test
	void theTurnOfTheSeasonAndASendOverTheLogoDoNotMakeACycle() throws Exception {
		Team team = aTeamWithALogoThatWaits(true);

		theRoadAndTheSendsNextLockDoNotMakeACycle(team, () -> {
			holdingTheRow.executeWithoutResult(turning -> {
				begins.begin(2028);

				assertThat(db.sql("select count(*) from team where id = ?").param(team.id()).query(Long.class)
						.single()).as("the turn did not delete the team nobody holds the season in").isZero();

				turning.setRollbackOnly();
			});

			return 0;
		}, 0, false);
	}

	/**
	 * AND A TEAM THAT STAYS IS NOT WAITED FOR BY THE TURN: its editor does not hold 2028 and goes, a second member
	 * holds it, so the delete cannot follow and the queue row of the logo that waits is not taken.
	 */
	@Test
	void theTurnOfTheSeasonDoesNotWaitForASendOverTheLogoOfATeamThatStays() throws Exception {
		Team team = aTeamWithALogoThatWaits(true);
		Team mate = aMember();

		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, ?)")
				.params(mate.editor(), team.id(), A_SEASON_STILL_TO_COME).update();
		HeldOn.season(db, mate.editor(), 2028, "feeExempt");

		long theRow = theRowThatWaits(team);
		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<Integer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update").param(theRow).query(Integer.class)
						.single();

				submitted.add(pool.submit(() -> {
					holdingTheRow.executeWithoutResult(turning -> {
						begins.begin(2028);

						assertThat(db.sql("select count(*) from team where id = ?").param(team.id())
								.query(Long.class).single()).as("a team with a member who holds 2028 went").isOne();

						turning.setRollbackOnly();
					});

					return 0;
				}));

				Instant deadline = Instant.now().plusSeconds(10);

				while (!submitted.getFirst().isDone() && Instant.now().isBefore(deadline)) {
					sleep();
				}

				assertThat(submitted.getFirst())
						.as("the turn of the season waited for the queue row of a logo of a team that stays")
						.isDone();

				return null;
			});

			assertThat(submitted.getFirst().get(30, TimeUnit.SECONDS)).isZero();
		}
		finally {
			pool.shutdownNow();
		}
	}

	/**
	 * A MEMBER WHOSE ROW ONLY ENDS DOES NOT WAIT FOR A SEND OF THE LOGO EITHER (review of PR 846, 28.11.2026): the
	 * sole member of a team whose membership has begun leaves it, his row is ended and stays, and the team stays
	 * with it, so the delete cannot follow and there is no cycle to avoid. The queue row of a logo that waits was
	 * taken all the same, and the leaving waited for one send.
	 */
	@Test
	void aSoleMemberWhoseRowOnlyEndsDoesNotWaitForASendOfTheLogo() throws Exception {
		Team team = aTeamWithALogoThatWaits(true);

		db.sql("update team_membership set season_from = 2027 where team_id = ?").param(team.id()).update();

		long theRow = theRowThatWaits(team);
		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<Integer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update").param(theRow).query(Integer.class)
						.single();

				submitted.add(pool.submit(() -> http.perform(delete("/api/teams/" + team.id() + "/membership")
								.with(csrf()).cookie(new Cookie(SessionCookie.NAME, team.session().secret())))
						.andReturn().getResponse().getStatus()));

				Instant deadline = Instant.now().plusSeconds(10);

				while (!submitted.getFirst().isDone() && Instant.now().isBefore(deadline)) {
					sleep();
				}

				assertThat(submitted.getFirst())
						.as("the member whose row only ends waited for the queue row of a send")
						.isDone();

				return null;
			});

			assertThat(submitted.getFirst().get(30, TimeUnit.SECONDS)).isEqualTo(204);
			assertThat(db.sql("select count(*) from team where id = ?").param(team.id()).query(Long.class).single())
					.as("a team whose last member's row only ended was deleted").isOne();
			assertThat(db.sql("select season_to is not null from team_membership where team_id = ?")
					.param(team.id()).query(Boolean.class).single()).as("his row was removed and not ended")
					.isTrue();
		}
		finally {
			pool.shutdownNow();
		}
	}

	/**
	 * A CANCELLATION OF A MEMBER WHO STOOD IN NO TEAM HOLDS NOTHING: there is no queue row to take, and asking for
	 * the rows of no teams must not be written as {@code in ()}, which is not a statement.
	 */
	@Test
	void theCancellationOfAMemberInNoTeamHoldsNothingAndGoesThrough() {
		long member = aMember().editor();

		weWroteTheFreeze = db.sql("insert into season_frozen (season, frozen_at) values (2027, ?)"
						+ " on conflict do nothing")
				.param(Timestamp.from(Instant.parse("2027-01-01T15:00:00Z"))).update() == 1;

		ZonedDateTime now = ZonedDateTime.now(clock);

		holdingTheRow.executeWithoutResult(cancelling -> {
			ASeasonBegins.Before before = begins.before(member, 2028, now);

			assertThat(before.teams()).as("the member stands in a team, so the case holds nothing").isEmpty();

			begins.cancelled(member, 2028, now, before);
		});
	}

	/**
	 * A MEMBER WHO LEAVES A TEAM THAT STAYS DOES NOT WAIT FOR A SEND OF ITS LOGO. The lock a road takes carries the
	 * condition the delete carries, nobody else in the team: with a team-mate the road must come back while the queue
	 * row is held.
	 */
	@Test
	void theEditorLeavingATeamThatStaysDoesNotWaitForASendOfItsLogo() throws Exception {
		Team team = aTeamWithALogoThatWaits(true);
		Team mate = aMember();

		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, ?)")
				.params(mate.editor(), team.id(), A_SEASON_STILL_TO_COME).update();

		long theRow = theRowThatWaits(team);
		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<Integer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update").param(theRow).query(Integer.class)
						.single();

				submitted.add(pool.submit(() -> http.perform(delete("/api/teams/" + team.id() + "/membership")
								.with(csrf()).cookie(new Cookie(SessionCookie.NAME, team.session().secret())))
						.andReturn().getResponse().getStatus()));

				Instant deadline = Instant.now().plusSeconds(10);

				while (!submitted.getFirst().isDone() && Instant.now().isBefore(deadline)) {
					sleep();
				}

				assertThat(submitted.getFirst())
						.as("the member leaving a team that stays waited for the queue row of a send")
						.isDone();

				return null;
			});

			assertThat(submitted.getFirst().get(30, TimeUnit.SECONDS)).isEqualTo(204);
			assertThat(db.sql("select count(*) from team where id = ?").param(team.id()).query(Long.class).single())
					.as("a team with somebody still in it was deleted").isOne();
		}
		finally {
			pool.shutdownNow();
		}
	}

	/**
	 * THE CANCELLATION OF THE SENDER OF A LOGO THAT WAITS, IN A TEAM THAT STAYS, AND THE REFUSAL OF THAT LOGO DO NOT
	 * MAKE A CYCLE (PENDING, review of PR 846, 28.11.2026). The route of a cancellation takes the member's row
	 * first; a refusal takes the queue row and then writes a message to the sender, which asks for his row. A
	 * cancellation that held the queue row of a team that stays would wait for the refusal while the refusal waits
	 * for it: measured as {@code deadlock detected}. This thread plays the refusal up to its second statement (it
	 * holds the queue row), the road is the route's own order (the freeze, the member's row, the cancellation), and
	 * the message is what the refusal does next. The team has a second member whose row covers the season, so it
	 * stays and the road holds nothing of the queue.
	 */
	@Test
	void theCancellationOfTheSenderInATeamThatStaysAndTheRefusalOfHisLogoDoNotMakeACycle() throws Exception {
		theCancellationAndTheRefusalWhereTheMateRowIs(null);
	}

	/**
	 * THE SAME WHERE THE OTHER MEMBER'S ROW ENDED IN THE SEASON CANCELLED (2028) AND NOT BEFORE IT: it covers that
	 * season, so the team stays, and a condition that counted the season after it would hold the queue row here.
	 */
	@Test
	void theCancellationInATeamWhoseOtherRowEndsInTheSeasonAndTheRefusalOfHisLogoDoNotMakeACycle() throws Exception {
		theCancellationAndTheRefusalWhereTheMateRowIs(2028);
	}

	private void theCancellationAndTheRefusalWhereTheMateRowIs(Integer endsIn) throws Exception {
		Team team = aTeamWithALogoThatWaits(true);
		Team mate = aMember();

		if (endsIn == null) {
			db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, ?)")
					.params(mate.editor(), team.id(), A_SEASON_STILL_TO_COME).update();
		}
		else {
			db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
					+ " values (?, ?, 2027, ?, ?)")
					.params(mate.editor(), team.id(), endsIn,
							com.btl.portal.domain.team.Membership.LEFT_ON_HIS_OWN).update();
		}

		weWroteTheFreeze = db.sql("insert into season_frozen (season, frozen_at) values (2027, ?)"
						+ " on conflict do nothing")
				.param(Timestamp.from(Instant.parse("2027-01-01T15:00:00Z"))).update() == 1;

		ZonedDateTime now = ZonedDateTime.now(clock);
		long theRow = theRowThatWaits(team);
		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<Integer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update").param(theRow).query(Integer.class)
						.single();

				submitted.add(pool.submit(() -> {
					holdingTheRow.executeWithoutResult(cancelling -> {
						ASeasonBegins.holdTheFreezeStill(db);
						db.sql("select id from competitor where id = ? for update").param(team.editor())
								.query(Long.class).list();
						begins.cancelled(team.editor(), 2028, now, begins.before(team.editor(), 2028, now));
					});

					return 0;
				}));

				Instant deadline = Instant.now().plusSeconds(4);

				while (!submitted.getFirst().isDone() && Instant.now().isBefore(deadline)) {
					sleep();
				}

				assertThat(submitted.getFirst())
						.as("the cancellation of a member of a team that stays waited for the queue row of a logo")
						.isDone();

				/* WHAT THE REFUSAL DOES NEXT: a message to the sender, which asks for his row. */
				db.sql("insert into message (to_id, from_id, from_name, subject, body) values (?, null, 'BTL',"
						+ " 'Stavka je odbijena', 'probe')").param(team.editor()).update();

				return null;
			});

			assertThat(submitted.getFirst().get(30, TimeUnit.SECONDS)).isZero();
			assertThat(db.sql("select count(*) from team where id = ?").param(team.id()).query(Long.class).single())
					.as("a team with somebody who holds the season was deleted").isOne();
		}
		finally {
			pool.shutdownNow();
		}
	}

	/**
	 * THE OTHER SIDE OF THE CONDITION: a team whose only other member left in 2027 (his row ends before the season
	 * cancelled, so it does not cover it) is deleted by the cancellation, and the road holds the queue row first.
	 * Without this case a condition that counted the wrong season would stay green.
	 */
	@Test
	void theCancellationInATeamWhoseOnlyOtherRowEndedBeforeTheSeasonAndASendDoNotMakeACycle() throws Exception {
		Team team = aTeamWithALogoThatWaits(true);
		Team mate = aMember();

		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
				+ " values (?, ?, 2027, 2027, ?)")
				.params(mate.editor(), team.id(), com.btl.portal.domain.team.Membership.LEFT_ON_HIS_OWN).update();

		weWroteTheFreeze = db.sql("insert into season_frozen (season, frozen_at) values (2027, ?)"
						+ " on conflict do nothing")
				.param(Timestamp.from(Instant.parse("2027-01-01T15:00:00Z"))).update() == 1;

		ZonedDateTime now = ZonedDateTime.now(clock);

		theRoadAndTheSendsNextLockDoNotMakeACycle(team, () -> {
			holdingTheRow.executeWithoutResult(cancelling -> begins.cancelled(team.editor(), 2028, now,
					begins.before(team.editor(), 2028, now)));

			return 0;
		}, 0);
	}

	private void theRoadAndTheSendsNextLockDoNotMakeACycle(Team team, Callable<Integer> road, int answer)
			throws Exception {

		theRoadAndTheSendsNextLockDoNotMakeACycle(team, road, answer, true);
	}

	/**
	 * @param committed whether the road commits, so that the team is gone afterwards; a road that is rolled back
	 *                  after it asked its own question inside (the turn of the season, which reads the whole
	 *                  database) leaves the team where it was
	 */
	private void theRoadAndTheSendsNextLockDoNotMakeACycle(Team team, Callable<Integer> road, int answer,
			boolean committed) throws Exception {

		long theRow = theRowThatWaits(team);
		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<Integer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update").param(theRow).query(Integer.class)
						.single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is held and nothing has been submitted yet")
						.isZero();

				submitted.add(pool.submit(road));
				untilAllAreStopped(1, submitted);

				/* WHAT THE SEND DOES NEXT: it takes the team's row. */
				assertThat(db.sql("select id from team where id = ? for update").param(team.id())
						.query(Long.class).single())
						.as("the send could not take the team: the road holds it while it waits for the queue row"
								+ " the send holds, which is a cycle")
						.isEqualTo(team.id());

				assertThat(submitted.getFirst())
						.as("the road was let through while the queue row was held, so the case is not holding"
								+ " the thing it says it holds")
						.isNotDone();

				return null;
			});

			assertThat(submitted.getFirst().get(30, TimeUnit.SECONDS)).as("what the road answered").isEqualTo(answer);
			assertThat(db.sql("select count(*) from team where id = ?").param(team.id()).query(Long.class).single())
					.as("the team was not deleted").isEqualTo(committed ? 0L : 1L);
			assertThat(db.sql("select count(*) from verification where team_id = ?").param(team.id())
					.query(Long.class).single()).as("the queue row of its logo went with the team")
					.isEqualTo(committed ? 0L : 1L);
		}
		finally {
			pool.shutdownNow();
		}
	}

	private void untilAllAreStopped(int wanted, List<? extends Future<?>> submitted) {
		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < wanted) {
			if (Instant.now().isAfter(deadline)) {
				throw new IllegalStateException(wanted + " requests should have been queued behind the held row"
						+ " within ten seconds, and the lock manager never showed that many behind this"
						+ " connection. Futures done: " + submitted.stream().map(Future::isDone).toList());
			}

			sleep();
		}
	}

	private static void sleep() {
		try {
			Thread.sleep(20);
		}
		catch (InterruptedException interrupted) {
			throw new IllegalStateException(interrupted);
		}
	}

	private long theRowThatWaits(Team team) {
		List<Long> rows = db.sql("select id from verification where team_id = ? and queue = 'teams'"
						+ " and state = 'waiting' and photo_id is not null order by id")
				.param(team.id()).query(Long.class).list();

		assertThat(rows).as("the team does not have exactly one logo waiting").hasSize(1);

		return rows.getFirst();
	}

	/* ------------------------------------------------------------------------------------------ */

	/** A member whose fee stands, with an account and a session, in no team. */
	private Team aMember() {
		int n = ISSUED.incrementAndGet();
		String address = "putevi-tima-" + n + "@primer.rs";
		String number = String.format("0009%02d", n);

		long member = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, 'Urednik', 'Uredjivac', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, ?, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-01-01 10:00:00+00') returning id")
				.params(number, String.format("%016x", 0xb237000000000000L + n))
				.query(Long.class).single();

		members.add(member);
		HeldOn.activeAt(db, member, ZonedDateTime.now(clock));

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Urednik', 'Uredjivac', ?, (select id from role where code = 'competitor'), ?)")
				.params(address, member).update();
		addresses.add(address);

		return new Team(0, member, number, address, aSessionFor(address));
	}

	/** An account of the superadmin, who passes every right at the door. */
	private SecretToken aSuperadmin() {
		String address = "putevi-tima-vrhovni-" + ISSUED.incrementAndGet() + "@primer.rs";

		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Vrhovni', 'Bezimeni', ?, (select id from role where code = 'superadmin'))")
				.param(address).update();
		addresses.add(address);

		return aSessionFor(address);
	}

	private SecretToken aSessionFor(String address) {
		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(address, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session;
	}

	/**
	 * A team whose only member is its editor, who holds the seat, with a logo waiting on the teams tab.
	 *
	 * @param sentByTheEditor whether the logo that waits was sent by the editor, or by a member who is not in the
	 *                        team and is not the one the case deletes
	 */
	private Team aTeamWithALogoThatWaits(boolean sentByTheEditor) {
		Team editor = aMember();
		int n = ISSUED.incrementAndGet();
		long team = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, first_season,"
						+ " admin_id) values (?, ?, '', '', (select id from place where rank = 1), null, null, 2027, ?)"
						+ " returning id")
				.params("putevi-tima-" + n, "Putevi tima " + n, editor.editor())
				.query(Long.class).single();

		/* From a season still to come, so that leaving REMOVES the row (a membership that has begun is only ended,
		   and an ended row keeps the team standing). The cancellation case reads the open row all the same. */
		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, ?)")
				.params(editor.editor(), team, A_SEASON_STILL_TO_COME).update();

		long sender = sentByTheEditor ? editor.editor() : aMember().editor();
		long photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/png', 4096, ?, 0.3, 0.7, 0.45) returning id")
				.param(String.format("%064x", 0x7ec0 + ISSUED.incrementAndGet())).query(Long.class).single();

		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, team_id)"
						+ " values ('teams', ?, 'Tim', '', ?, ?)")
				.params(sender, photo, team).update();

		Team made = new Team(team, editor.editor(), editor.number(), editor.address(), editor.session());

		teams.add(made);

		return made;
	}
}

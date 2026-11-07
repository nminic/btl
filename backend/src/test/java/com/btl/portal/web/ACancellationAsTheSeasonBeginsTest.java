package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;

/**
 * A CANCELLATION THAT MEETS THE JOB OF 1 JANUARY TAKES THE MEMBER OUT OF HIS TEAM AND HIS PAIR WHICHEVER OF THE
 * TWO COMES FIRST, because the owner's rule has no exception for the seconds the job takes: „Storno sezone
 * posle 1. januara u 16h izbacuje člana iz tima i para odmah ... Jedno pravilo: bez članarine za sezonu
 * nema tima ni para te sezone." (PDL 05.11.2026).
 *
 * <p><b>The finding this closes</b> (PENDING, review of PR 689): the route reads {@code season_frozen} to
 * know whether the season before has frozen, and the job writes that row in a transaction that has not
 * committed yet, so the route saw nothing and moved nobody; the job then read the memberships through the
 * snapshot it had taken before the route committed, so it still found the one just cancelled and dropped
 * nobody. Each was right about what it could see, and the member stood in his team for the whole season.
 *
 * <p><b>Both orders are forced, not hoped for.</b> NOT {@code @Transactional}, in the shape of
 * {@link MemberMembershipTwiceAtOneInstantTest}: the rows are real commits and {@link #nothingIsLeftBehind}
 * takes them out. The job runs for real ({@link ASeasonFreezes}, which hands the freeze to the real
 * {@link ASeasonBegins}), the route runs for real over {@code MockMvc}, and the interleaving is taken from
 * the lock manager through {@link BlockedBehindThisHold}.
 * <ul>
 * <li>{@link #aCancellationWhileTheJobIsRunningWaitsForItAndThenTakesHimOut}: the job stops after its
 * snapshot and its row, the request is sent, and the job goes on only when the lock manager says the request
 * is stopped behind the job. Without the lock the request is never stopped, so the job goes on when the
 * request is already answered, and the member stays in his team.</li>
 * <li>{@link #theJobThatMeetsACancellationInFlightReadsTheMembershipsAfterIt}: the request is stopped
 * inside the database after the lock it takes first, the job is started, and both are released from there.
 * The job must be stopped by the cancellation BEFORE it takes its snapshot, which is why it asks for the
 * lock as its first statement (that statement takes no snapshot, PostgreSQL manual, „Explicit Locking").</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ACancellationAsTheSeasonBeginsTest {

	/** Five seconds after the job of 1.1.2028 runs; 2028 is the season being paid for then. */
	private static final Instant FIVE_PAST_FOUR = LocalDateTime.of(2028, 1, 1, 16, 0, 5)
			.atZone(SeasonClock.ZONE).toInstant();

	private static final String MODERATOR = "storno-u-letu@primer.rs";

	private static final String HIS_NUMBER = "000981";

	private static final String HERS_NUMBER = "000982";

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockFiveSecondsIntoTheSeason() {
			return Clock.fixed(FIVE_PAST_FOUR, ZoneOffset.UTC);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private DataSource pool;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private TheTablesOfASeason tables;

	@Autowired
	private ASeasonBegins begins;

	private String cookie;

	private long moderator;

	private long him;

	private long her;

	@BeforeEach
	void aMemberWhoHoldsTwoSeasonsInATeamAndAPairWithAWomanWhoDoesToo() {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Mira', 'Uletu', ?, (select id from role where code = 'moderator'))")
				.param(MODERATOR).update();

		moderator = db.sql("select id from account where email = ?").param(MODERATOR)
				.query(Long.class).single();

		db.sql("insert into account_admin_right (account_id, right_code) values (?, 'entity:members')")
				.param(moderator).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values (?, ?, ?, ?, ?)")
				.params(moderator, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();

		him = competitor(HIS_NUMBER, "Aca", "M", "0011223344000981");
		her = competitor(HERS_NUMBER, "Bora", "F", "0011223344000982");

		for (long each : new long[] {him, her}) {
			HeldOn.season(db, each, 2027, "feeExempt");
			HeldOn.season(db, each, 2028, "feeExempt");
		}

		long team = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values ('storno-u-letu-tim', 'Storno u letu', '', '',"
						+ " (select id from place where rank = 1), null, null, null, 2027, ?) returning id")
				.param(him).query(Long.class).single();

		for (long each : new long[] {him, her}) {
			db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
					+ " values (?, ?, 2027, null, null)").params(each, team).update();
		}

		db.sql("insert into racing_pair (season, man_id, woman_id) values (2028, ?, ?)")
				.params(him, her).update();
	}

	/** Real commits, children before parents; the job wrote the snapshot of 2027 into tables nobody else uses. */
	@AfterEach
	void nothingIsLeftBehind() {
		inOneTransaction.executeWithoutResult(any -> {
			for (String table : List.of("season_award", "season_board", "season_pair", "season_league_standing",
					"season_league_column", "season_team", "season_competitor", "season_points_at_freeze",
					"season_frozen")) {
				db.sql("delete from " + table + " where season = 2027").update();
			}

			db.sql("delete from racing_pair where season = 2028").update();
			db.sql("delete from team where slug = 'storno-u-letu-tim'").update();
			db.sql("delete from membership_change where competitor_id in (?, ?)").params(him, her).update();
			db.sql("delete from message where to_id in (?, ?)").params(him, her).update();
			db.sql("delete from membership where competitor_id in (?, ?)").params(him, her).update();
			db.sql("delete from competitor where id in (?, ?)").params(him, her).update();
			db.sql("delete from account_session where account_id = ?").param(moderator).update();
			db.sql("delete from account_admin_right where account_id = ?").param(moderator).update();
			db.sql("delete from account where id = ?").param(moderator).update();
		});
	}

	@Test
	void aCancellationWhileTheJobIsRunningWaitsForItAndThenTakesHimOut() throws Exception {
		/* HE JOINED HIS TEAM IN THE WINDOW FOR 2028 AND HOLDS NOTHING ELSE, so the snapshot of 2027 writes no
		   row that names him and the job takes no lock on his row: the only thing that can put the request and
		   the job in order is the one the portal takes on purpose. A member of 2027 is serialized by the
		   foreign keys of the snapshot, which is the other case below. */
		db.sql("delete from membership where competitor_id = ? and season = 2027").param(him).update();
		db.sql("update team_membership set season_from = 2028 where competitor_id = ?").param(him).update();

		CountDownLatch jobHoldsItsRow = new CountDownLatch(1);
		AtomicInteger stoppedBeforeTheRequest = new AtomicInteger(-1);
		AtomicInteger stoppedWhenTheJobWentOn = new AtomicInteger(-1);
		List<Future<MockHttpServletResponse>> request = new java.util.concurrent.CopyOnWriteArrayList<>();
		ExecutorService requests = Executors.newSingleThreadExecutor();

		/* THE JOB STOPS WHERE THE OWNER'S SECONDS ARE: its snapshot is taken and its row of season_frozen is
		   written, and the beginning of the season has not read a membership yet. It goes on when the lock
		   manager says the request is stopped behind it, or when the request is answered (which is the
		   fault: nothing stopped it). */
		WhatFollowsTheFreeze stoppedInFlight = season -> {
			stoppedBeforeTheRequest.set(BlockedBehindThisHold.count(db));
			jobHoldsItsRow.countDown();

			Instant deadline = Instant.now().plusSeconds(15);

			while (BlockedBehindThisHold.count(db) < 1 && Instant.now().isBefore(deadline)
					&& request.stream().noneMatch(Future::isDone)) {
				sleep();
			}

			stoppedWhenTheJobWentOn.set(BlockedBehindThisHold.count(db));
			begins.followTheFreezeOf(season);
		};

		try {
			CompletableFuture<Void> job = CompletableFuture.runAsync(() -> theJobWith(stoppedInFlight));

			assertThat(jobHoldsItsRow.await(60, TimeUnit.SECONDS)).as("the job reached its beginning").isTrue();

			request.add(requests.submit(this::hisSeasonCancelled));

			job.get(60, TimeUnit.SECONDS);

			assertThat(request.get(0).get(30, TimeUnit.SECONDS).getStatus())
					.as("the cancellation was answered with a fault").isEqualTo(200);
		} finally {
			requests.shutdownNow();
		}

		assertThat(stoppedBeforeTheRequest.get()).as("nothing stood behind the job before the request").isZero();
		assertThat(stoppedWhenTheJobWentOn.get())
				.as("the request was stopped behind the job inside the database, not answered past it")
				.isOne();

		assertHeIsOutOfTheTeamAndThePairAndSheIsNot();
	}

	@Test
	void theJobThatMeetsACancellationInFlightReadsTheMembershipsAfterIt() throws Exception {
		ExecutorService both = Executors.newFixedThreadPool(2);

		try (AHeldTransaction holdingHisRow = new AHeldTransaction(pool)) {
			holdingHisRow.db().sql("select 1 from competitor where id = ? for update")
					.param(him).query(Integer.class).single();

			assertThat(holdingHisRow.behind()).as("his row is held and nothing was sent yet").isZero();

			/* THE REQUEST TAKES THE LOCK OF THE FREEZE AND STOPS ON HIS ROW; THE JOB, started after it, must
			   stop on that lock, behind the request, before it has taken any snapshot. */
			Future<MockHttpServletResponse> request = both.submit(this::hisSeasonCancelled);

			holdingHisRow.untilBehind(1, List.of(request));

			Future<?> job = both.submit(() -> theJobWith(season -> begins.followTheFreezeOf(season)));

			holdingHisRow.untilBehind(2, List.of(request, job));

			assertThat(request.isDone() || job.isDone()).as("both are stopped inside the database").isFalse();

			holdingHisRow.commit();

			assertThat(request.get(30, TimeUnit.SECONDS).getStatus())
					.as("the cancellation was answered with a fault").isEqualTo(200);
			job.get(60, TimeUnit.SECONDS);
		} finally {
			both.shutdownNow();
		}

		assertHeIsOutOfTheTeamAndThePairAndSheIsNot();
	}

	private void assertHeIsOutOfTheTeamAndThePairAndSheIsNot() {
		assertThat(db.sql("select count(*) from season_frozen where season = 2027").query(Long.class).single())
				.as("the job froze 2027").isOne();
		assertThat(db.sql("select count(*) from membership where competitor_id = ? and season = 2028")
				.param(him).query(Long.class).single()).as("his 2028 is cancelled").isZero();
		assertThat(db.sql("select count(*) from team_membership where competitor_id = ? and season_to is null")
				.param(him).query(Long.class).single())
				.as("without 2028 he is not in a team of 2028 (PDL 05.11.2026)").isZero();
		assertThat(db.sql("select count(*) from racing_pair where season = 2028").query(Long.class).single())
				.as("and his pair of 2028 is broken").isZero();
		assertThat(db.sql("select count(*) from team_membership where competitor_id = ? and season_to is null")
				.param(her).query(Long.class).single())
				.as("she renewed, and stays in the team").isOne();
	}

	private void theJobWith(WhatFollowsTheFreeze follower) {
		new ASeasonFreezes(db, Clock.fixed(FIVE_PAST_FOUR.minusSeconds(5), ZoneOffset.UTC), inOneTransaction, best,
				tables, new ObjectProvider<>() {
					@Override
					public Stream<WhatFollowsTheFreeze> orderedStream() {
						return Stream.of(follower);
					}
				}).freeze();
	}

	private MockHttpServletResponse hisSeasonCancelled() throws Exception {
		return http.perform(delete("/api/members/" + HIS_NUMBER + "/membership").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"basis\": \"feeExempt\"}"))
				.andReturn().getResponse();
	}

	private long competitor(String number, String first, String gender, String referral) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, 'Uletic', ?, date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, first, gender, referral)
				.query(Long.class).single();
	}

	private static void sleep() {
		try {
			Thread.sleep(20);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException(e);
		}
	}
}

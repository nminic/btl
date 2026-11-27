package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * THE EDITOR'S SEND OF A TEAM'S LOGO AND THE MODERATOR'S DECISION ABOUT IT TAKE THEIR TWO ROWS IN ONE ORDER, and the
 * sends of one team's editor take turns (PENDING, PR 836, 27.11.2026).
 *
 * <p><b>Measured on PostgreSQL 18 with the same statements in two sessions:</b> {@code TeamLogoApi.send} took the
 * team's row and then the queue row of the logo that waits, and a decision ({@code VerificationWriteApi}: the claim
 * of the queue row, then {@code update team set logo_id}) takes them the other way round. Run at once they are a
 * cycle: {@code deadlock detected}, one of them answered 500. No data was torn, and the precedent
 * {@link MePhotoApi} exists to say that nothing may be left to the detector: its sends take a turn, then the queue
 * row, then the member's row, which is the decision's own order. {@link APictureSentTwiceAtOnceTest} holds that
 * and this holds the team's.
 *
 * <p><b>The order is taken away from the scheduler</b>, as the precedent takes it: a row is held from this thread,
 * the request is sent and the lock manager is asked until it shows the request stopped, and only then does the
 * case do what the other side does. A case that sent both and hoped they met would pass on every machine where they
 * did not.
 *
 * <p><b>Not {@code @Transactional}</b>, for the precedent's reason: a test-managed transaction is bound to the
 * calling thread, so the requests each get a connection of their own and really overlap. Every row is a real
 * commit and {@link #nothingOfItIsLeftBehind} takes it back out whether the case passed or not.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ATeamLogoSentWhileItIsBeingDecidedTest {

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-team-logos-twice-");
		}
		catch (IOException noFolder) {
			throw new UncheckedIOException(noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	/** Distinct from every other fixture's members and teams, on purpose: these rows are committed. */
	private static final AtomicInteger ISSUED = new AtomicInteger();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	/** The row's own lock, held from this thread so every request queues behind it. */
	@Autowired
	private TransactionTemplate holdingTheRow;

	private final List<Team> teams = new ArrayList<>();

	/** One team the case made: its editor, his session and the team's key. */
	private record Team(long id, long editor, String address, SecretToken session) {
	}

	/** What a send came back with: the status and body, or the exception that came out in the place of one (-1). */
	private record Answer(int status, String body, String threw) {
	}

	@AfterEach
	void nothingOfItIsLeftBehind() throws IOException {
		/* Real commits, so a real delete, children before parents. Taking the queue rows out lets the database take
		   the photo rows with them (V54). */
		for (Team made : teams) {
			db.sql("delete from verification where team_id = ?").param(made.id()).update();
			db.sql("update team set logo_id = null, admin_id = null where id = ?").param(made.id()).update();
			db.sql("delete from team_membership where team_id = ?").param(made.id()).update();
			db.sql("delete from team where id = ?").param(made.id()).update();
			db.sql("delete from verification where competitor_id = ?").param(made.editor()).update();
			db.sql("delete from account where email = ?").param(made.address()).update();
			db.sql("delete from competitor where id = ?").param(made.editor()).update();
		}

		try (var there = Files.list(PHOTOS)) {
			for (Path file : there.toList()) {
				Files.deleteIfExists(file);
			}
		}
	}

	/* ------------------------------------------------------------------------------------------ */

	/**
	 * A SEND OVER THE LOGO THAT WAITS AND THE DECISION ABOUT THAT LOGO DO NOT MAKE A CYCLE.
	 *
	 * <p>This thread plays the moderator: it claims the queue row of the logo that waits ({@code for update}, the
	 * first thing a decision does) and holds it. The editor sends a new logo and stops behind that row. Then the
	 * moderator does what the decision does next, takes the team ({@code update team set logo_id}, here the lock
	 * that statement takes). If the send had already taken the team it would be holding what the moderator wants
	 * while it waits for what the moderator holds, and the database would end one of them with a deadlock: the
	 * statement below throws, or the send comes back as a fault. Neither happens when the send has taken only its
	 * turn so far, and the moderator then finishes, lets go, and the send repoints the row it found.
	 */
	@Test
	void aSendOverTheLogoThatWaitsAndTheDecisionAboutItDoNotMakeACycle() throws Exception {
		Team team = aTeamWithALogoThatWaits();
		byte[] sent = aJpeg("novi logo preko onog koji ceka");
		long theRow = theRowThatWaits(team);
		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<Answer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update").param(theRow).query(Integer.class)
						.single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is held and nothing has been submitted yet, so a count that is not nought is"
								+ " counting something other than the request")
						.isZero();

				submitted.add(pool.submit(() -> send(team, sent)));
				untilAllAreStopped(1, submitted);

				/* WHAT THE DECISION DOES NEXT: it takes the team to set its logo. */
				assertThat(db.sql("select id from team where id = ? for update").param(team.id())
						.query(Long.class).single())
						.as("the moderator could not take the team: the send holds it while it waits for the row"
								+ " the moderator holds, which is a cycle")
						.isEqualTo(team.id());

				assertThat(submitted.getFirst())
						.as("the send was let through while the queue row was held, so the case is not holding"
								+ " the thing it says it holds")
						.isNotDone();

				return null;
			});

			Answer answer = submitted.getFirst().get(30, TimeUnit.SECONDS);

			assertThat(answer.status())
					.as("the send was ended by the database or refused: %s", answer)
					.isEqualTo(200);
			assertThat(theRowsThatWait(team))
					.as("the row that waited was replaced rather than repointed")
					.containsExactly(theRow);
			assertThat(theDigestOfThePictureThatWaits(team)).isEqualTo(WhatAPictureIs.digestOf(sent));
		}
		finally {
			pool.shutdownNow();
		}
	}

	/**
	 * TWO FIRST SENDS OF ONE TEAM AT ONCE LEAVE ONE LOGO WAITING, and both are answered 200 naming that one row.
	 *
	 * <p>The row held is the team's own, which every send of the team asks for with {@code for update}: the requests
	 * stop, the case waits until the lock manager shows both stopped, and only then lets go. Which request gets its
	 * turn first is not a thing the case claims; it says what is true whichever did. Without the turn both read
	 * „nothing waits" before either has written and the second insert meets
	 * {@code verification_one_logo_waits_per_team} (V112) and is a fault; without the lock on the team nothing
	 * stops behind the row this thread holds, and the wait below runs out.
	 */
	@Test
	void twoFirstSendsAtOnceLeaveOneLogoWaitingAndBothAreAnswered() throws Exception {
		Team team = aTeam();
		byte[] one = aJpeg("prvo slanje, istovremeno");
		byte[] other = aJpeg("drugo slanje, istovremeno");
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<Answer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from team where id = ? for update").param(team.id()).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is held and nothing has been submitted yet")
						.isZero();

				submitted.add(pool.submit(() -> send(team, one)));
				submitted.add(pool.submit(() -> send(team, other)));
				untilAllAreStopped(2, submitted);

				assertThat(submitted)
						.as("a request was answered before it reached the database, so they did not meet where the"
								+ " case is written to make them meet")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			List<Answer> answers = new ArrayList<>();

			for (Future<Answer> each : submitted) {
				answers.add(each.get(30, TimeUnit.SECONDS));
			}

			assertThat(answers).as("a send was not taken: %s", answers).allMatch(answer -> answer.status() == 200);

			List<Long> rows = theRowsThatWait(team);

			assertThat(rows).as("one logo waits for the team").hasSize(1);
			assertThat(answers).as("every answer names the one row that waits")
					.allMatch(answer -> mapper.readTree(answer.body()).path("waiting").asLong() == rows.getFirst());
			assertThat(List.of(WhatAPictureIs.digestOf(one), WhatAPictureIs.digestOf(other)))
					.contains(theDigestOfThePictureThatWaits(team));
		}
		finally {
			pool.shutdownNow();
		}
	}

	/* ------------------------------------------------------------------------------------------ */

	private void untilAllAreStopped(int wanted, List<? extends Future<?>> submitted) {
		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < wanted) {
			if (Instant.now().isAfter(deadline)) {
				throw new IllegalStateException(wanted + " requests should have been queued behind the held row"
						+ " within ten seconds, and the lock manager never showed that many behind this"
						+ " connection. Futures done: " + submitted.stream().map(Future::isDone).toList());
			}

			try {
				Thread.sleep(20);
			}
			catch (InterruptedException interrupted) {
				throw new IllegalStateException(interrupted);
			}
		}
	}

	private Answer send(Team team, byte[] bytes) {
		try {
			MockMultipartHttpServletRequestBuilder asking = multipart("/api/teams/" + team.id() + "/own-logo");

			asking.file(new MockMultipartFile("picture", "logo.jpg", "image/jpeg", bytes));
			asking.param("cropX", "0.25");
			asking.param("cropY", "0.75");
			asking.param("cropSize", "0.5");

			MockHttpServletResponse answer = http.perform(asking.with(csrf())
							.cookie(new Cookie(SessionCookie.NAME, team.session().secret())))
					.andReturn().getResponse();

			return new Answer(answer.getStatus(), answer.getContentAsString(StandardCharsets.UTF_8), null);
		}
		catch (Exception failed) {
			Throwable root = failed;

			while (root.getCause() != null) {
				root = root.getCause();
			}

			return new Answer(-1, "", failed.getClass().getSimpleName() + " / " + root.getClass().getSimpleName()
					+ ": " + root.getMessage());
		}
	}

	private List<Long> theRowsThatWait(Team team) {
		return db.sql("select id from verification where team_id = ? and queue = 'teams' and state = 'waiting'"
						+ " and photo_id is not null order by id")
				.param(team.id()).query(Long.class).list();
	}

	private long theRowThatWaits(Team team) {
		List<Long> rows = theRowsThatWait(team);

		assertThat(rows).as("the team does not have exactly one logo waiting").hasSize(1);

		return rows.getFirst();
	}

	private String theDigestOfThePictureThatWaits(Team team) {
		return db.sql("select p.digest from verification v join photo p on p.id = v.photo_id where v.team_id = ?"
						+ " and v.state = 'waiting'")
				.param(team.id()).query(String.class).single();
	}

	/* ------------------------------------------------------------------------------------------ */

	/** A team with an editor who holds its seat and whose fee stands, a session for him and no logo waiting. */
	private Team aTeam() {
		int n = ISSUED.incrementAndGet();
		String address = "logo-dvaput-" + n + "@primer.rs";
		int season = SeasonClock.seasonsAMemberIsActiveIn(ZonedDateTime.now()).first();

		long editor = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, 'Urednik', 'Uredjivac', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, ?, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-01-01 10:00:00+00') returning id")
				.params(String.format("0008%02d", n), String.format("%016x", 0xb236000000000000L + n))
				.query(Long.class).single();

		HeldOn.activeAt(db, editor, ZonedDateTime.now());

		long team = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, first_season,"
						+ " admin_id) values (?, ?, '', '', (select id from place where rank = 1), null, null, ?, ?)"
						+ " returning id")
				.params("logo-dvaput-" + n, "Logo dvaput " + n, season, editor)
				.query(Long.class).single();

		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, ?)")
				.params(editor, team, season).update();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Urednik', 'Uredjivac', ?, (select id from role where code = 'competitor'), ?)")
				.params(address, editor).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(address, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		Team made = new Team(team, editor, address, session);

		teams.add(made);

		return made;
	}

	/** The same team with a logo of its editor's waiting on the teams tab. */
	private Team aTeamWithALogoThatWaits() {
		Team team = aTeam();
		long photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/png', 4096, ?, 0.3, 0.7, 0.45) returning id")
				.param(String.format("%064x", 0x7eb0 + ISSUED.incrementAndGet())).query(Long.class).single();

		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, team_id)"
						+ " values ('teams', ?, 'Tim', '', ?, ?)")
				.params(team.editor(), photo, team.id()).update();

		return team;
	}

	/** A JPEG as far as the portal reads one: its three first bytes, then whatever the case says. */
	private static byte[] aJpeg(String tail) {
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[3 + rest.length];

		whole[0] = (byte) 0xFF;
		whole[1] = (byte) 0xD8;
		whole[2] = (byte) 0xFF;
		System.arraycopy(rest, 0, whole, 3, rest.length);

		return whole;
	}
}

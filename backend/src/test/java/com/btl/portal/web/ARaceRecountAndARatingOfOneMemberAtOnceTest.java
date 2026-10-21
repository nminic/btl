package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A RACE CHANGE THAT HOLDS ITS EVENT, AND A RATING OF THAT EVENT BY A MEMBER THE CHANGE'S RECOUNT WRITES TO,
 * MUST NOT WAIT FOR EACH OTHER THE OPPOSITE WAY ROUND (PENDING: review of PR 597, round 1).
 *
 * <p><b>The two orders.</b> {@code RaceWriteApi.change} holds the event row from its first statement to its
 * commit, and its recount then writes a {@code message} to every member whose run moved, which takes
 * {@code FOR KEY SHARE} on that member's {@code competitor} row ({@code message_to_fk}).
 * {@code CommentWriteApi.write} goes the other way: it takes the member's {@code competitor} row
 * {@code FOR UPDATE} first and then inserts the card, whose foreign key to {@code btl_event} takes
 * {@code FOR KEY SHARE} on the event row. If the event is held {@code FOR UPDATE} the card stops there, the
 * recount stops on the member's row, and the database breaks the deadlock with a 500 for one of them.
 * Reachable by anybody: only a member with a result on an event may rate it, so every rater of an event
 * is a member whose run a recount of its races may move.
 *
 * <p><b>What the lock on the event is.</b> {@code FOR NO KEY UPDATE}: it orders every writer that holds
 * the event the same way (two of those wait for each other, as do an event's delete and a change of its
 * address), and it lets through the {@code FOR KEY SHARE} a row that points at the event takes. This case
 * is the second half of that sentence; {@code TwoWritesOfOneEventAtOnceTest} is the first.
 *
 * <p><b>The rating is a transaction of the case's own</b>, taking what {@code CommentWriteApi.write} takes in
 * the order it takes it (the member's row {@code FOR UPDATE}, then the card's insert), so the order is the
 * case's and not the scheduler's. The change is stopped at its recount by the run's row, held by the case;
 * the rating then takes the member and begins its insert; the run is let go, and the change goes on to
 * write the message the member's row is wanted for. Whichever of the two the database sacrifices, the
 * answer is a failure here and the case says what the database said.
 *
 * <p><b>NOT {@code @Transactional}</b>: the writers are different connections and their rows are real
 * commits, taken back out by {@link #andNothingOfItIsLeftBehind}. The clock is fixed in October 2027, where
 * 2027 runs and nothing is frozen, which is what a recount needs.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ARaceRecountAndARatingOfOneMemberAtOnceTest {

	/** Distinct from every other fixture's, on purpose: these rows are committed. */
	private static final String THE_NUMBER = "000977";

	private static final String THE_MODERATOR = "recount-i-ocena-moderator@primer.rs";

	private static final String THE_ADDRESS = "recount-i-ocena-2027";

	private static final LocalDate THE_MARATHONS_DAY = LocalDate.parse("2027-05-09");

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisCaseUses {

		@Bean
		@Primary
		Clock aClockInOctober2027() {
			return Clock.fixed(Instant.parse("2027-10-15T10:00:00Z"), ZoneOffset.UTC);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private DataSource pool;

	/** What the database said that went wrong, by message: an exception out of {@code perform} is a 500. */
	private final List<String> thrown = new CopyOnWriteArrayList<>();

	private long runner;

	private long event;

	private long marathon;

	private long run;

	private String cookie;

	@BeforeEach
	void aMarathonWithOneCountedRun() {
		thrown.clear();

		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
						+ " description, link) values (?, 'Maraton recount i ocena', ?,"
						+ " (select id from place where rank = 1), null, null, 'race', false, '', '')")
				.params(THE_ADDRESS, THE_MARATHONS_DAY).update();

		event = db.sql("select id from btl_event where slug = ?").param(THE_ADDRESS)
				.query(Long.class).single();

		marathon = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, 'Maraton', false, ?, 'length', 0,"
						+ " cast('42.2' as numeric), 300, 280) returning id")
				.params(event, THE_MARATHONS_DAY).query(Long.class).single();

		runner = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, referral_code, bio,"
						+ " profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at) values (?, 'Ocenjivac', 'Trkac', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, '0011aabbccddee77', '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.param(THE_NUMBER).query(Long.class).single();

		run = db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) select ?, id, date, cast('42.2' as numeric), 300, 280,"
						+ " 12600, ? from race where id = ? returning id")
				.params(runner, BtlScoreCalculator.calculate(42.2, 300, 280, 12600), marathon)
				.query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Mod', 'Eratorka', ?,"
						+ " (select id from role where code = 'moderator'))")
				.param(THE_MODERATOR).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'entity:events')")
				.param(THE_MODERATOR).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_MODERATOR, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();
	}

	/** Real commits, so a real delete, children before parents. */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from comment_submission where competitor_id = ?").param(runner).update();
		db.sql("delete from message where to_id = ?").param(runner).update();
		db.sql("delete from result where competitor_id = ?").param(runner).update();
		db.sql("delete from race where event_id = ?").param(event).update();
		db.sql("delete from btl_event where id = ?").param(event).update();
		db.sql("delete from competitor where id = ?").param(runner).update();
		db.sql("delete from account_session where account_id = (select id from account where email = ?)")
				.param(THE_MODERATOR).update();
		db.sql("delete from account_admin_right where account_id = (select id from account where email = ?)")
				.param(THE_MODERATOR).update();
		db.sql("delete from account where email = ?").param(THE_MODERATOR).update();
	}

	/**
	 * A CHANGE OF THE MARATHON THAT MOVES THE MEMBER'S RUN, AND THE MEMBER'S RATING OF THE EVENT, AT ONE INSTANT.
	 * The run's row is held, so the change (42.2 to 42.195) stands at its recount with the event already
	 * its own. The member's transaction takes his row and begins the card, which wants the event. The run
	 * is let go; the recount writes him a message, which wants his row. Both must go through: the card is
	 * written, the change answers 200, and the database breaks no deadlock.
	 */
	@Test
	void aRecountAndARatingOfTheSameMemberAtOneInstantBothGoThrough() throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(2);
		List<Future<?>> submitted = new ArrayList<>();
		String cardOutcome = "not finished";
		int answer;

		try (AHeldTransaction theRun = new AHeldTransaction(pool);
				AHeldTransaction theRating = new AHeldTransaction(pool)) {
			theRun.db().sql("select 1 from result where id = ? for update").param(run)
					.query(Integer.class).single();

			Future<Integer> change = requests.submit(() -> change(marathon, "42.195"));
			submitted.add(change);
			theRun.untilBehind(1, submitted);

			/* What `CommentWriteApi.write` takes, in the order it takes it: his row, then the card. */
			theRating.db().sql("select id from competitor where id = ? for update").param(runner)
					.query(Long.class).single();
			int ratingPid = theRating.db().sql("select pg_backend_pid()").query(Integer.class).single();

			Future<Long> card = requests.submit(() -> theRating.db().sql("insert into comment_submission"
							+ " (event_id, competitor_id, rating_organisation, rating_value, rating_ambience, body)"
							+ " values (?, ?, 3, 3, 3, 'x') returning id")
					.params(event, runner).query(Long.class).single());
			submitted.add(card);

			/* The card either stands behind the change's hold on the event (which is the deadlock to come)
			   or is written at once (which is not); both are waited for, neither is assumed. */
			Instant deadline = Instant.now().plusSeconds(5);

			while (!card.isDone() && blockersOf(ratingPid) == 0 && Instant.now().isBefore(deadline)) {
				Thread.sleep(20);
			}

			theRun.commit();

			/* The rating commits as soon as the change is stopped on HIS row, which is the one thing the
			   change can be waiting for once the card is written; a change that is not stopped on it ends
			   by itself, either answering or being the deadlock's victim. */
			deadline = Instant.now().plusSeconds(20);
			boolean ratingOpen = true;

			while (!change.isDone() && Instant.now().isBefore(deadline)) {
				if (ratingOpen && card.isDone() && blockedBy(ratingPid) > 0) {
					commitTheRating(theRating, "commit of the rating: ");
					ratingOpen = false;
				}

				Thread.sleep(20);
			}

			answer = change.get(30, TimeUnit.SECONDS);

			try {
				card.get(30, TimeUnit.SECONDS);
				cardOutcome = "written";
			} catch (ExecutionException failure) {
				cardOutcome = "failed: " + failure.getCause();
			}

			if (ratingOpen) {
				commitTheRating(theRating, "late commit of the rating: ");
			}
		} finally {
			requests.shutdownNow();
		}

		List<String> saidByTheDatabase = new ArrayList<>(thrown);
		saidByTheDatabase.add(cardOutcome);

		assertThat(saidByTheDatabase)
				.as("the database broke no deadlock between the recount and the rating")
				.noneMatch(said -> said.contains("deadlock detected"));
		assertThat(List.of(answer, cardOutcome))
				.as("the change and the rating both go through; what the database said: " + thrown)
				.containsExactly(200, "written");
	}

	private void commitTheRating(AHeldTransaction theRating, String label) {
		try {
			theRating.commit();
		} catch (Exception failure) {
			thrown.add(label + failure);
		}
	}

	/** How many backends hold the one with this pid up, one level of it. */
	private int blockersOf(int pid) {
		return db.sql("select cardinality(pg_blocking_pids(?))").param(pid).query(Integer.class).single();
	}

	/** How many backends this one is holding up. */
	private int blockedBy(int pid) {
		return db.sql("select count(*) from pg_stat_activity where ? = any(pg_blocking_pids(pid))")
				.param(pid).query(Integer.class).single();
	}

	private int change(long race, String km) {
		try {
			Form typed = new Form(null, "Maraton", true, THE_MARATHONS_DAY, "length", null,
					new BigDecimal(km), 300, 280);

			return http.perform(put("/api/races/" + race).with(csrf())
							.contentType(MediaType.APPLICATION_JSON)
							.content(new ObjectMapper().writeValueAsString(typed))
							.cookie(new Cookie(SessionCookie.NAME, cookie)))
					.andReturn().getResponse().getStatus();
		} catch (Exception failure) {
			thrown.add(failure.toString());

			return 500;
		}
	}

	/** What the event screen sends for one race, every field of it (ADL A54). */
	private record Form(Long eventId, String name, Boolean renamed, LocalDate date, String kind,
			Integer limitSeconds, BigDecimal distanceKm, Integer ascentM, Integer descentM) {
	}
}

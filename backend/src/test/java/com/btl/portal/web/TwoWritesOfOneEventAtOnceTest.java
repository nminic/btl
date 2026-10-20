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
import org.springframework.mock.web.MockHttpServletResponse;
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
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * TWO WRITES OF ONE EVENT'S RACES AT ONE INSTANT, EACH MEASURED WITH THE OTHER ALREADY IN THE DATABASE
 * (PENDING: review of PR 504, S1, and review of PR 577).
 *
 * <p><b>The rule they all keep.</b> A race is written under its event's row, held {@code FOR UPDATE} from the
 * first question to the commit, the way the approval of a member's run holds it
 * ({@code TheDayOfAnEvent#theEventHeldForThisWrite}). The event's day is the day of its first race
 * (owner, 10.08.2026), and the write that sets it works it out from the races it READ, so a writer that
 * read before another one committed sets a day the other's race contradicts. The schema refuses that
 * outcome at COMMIT (V29's deferred trigger), which reached an administrator as a 500 after the form was
 * filled in. A second change of one race with a form from before the first read the race as it WAS, and
 * its recount compared the form with that: a form that put the old measure back was „nothing moved", and
 * the runs stayed at the measure the first change left them on.
 *
 * <p><b>The other writer is simulated by a transaction of the case's own, and that is deliberate.</b> The
 * approval of a run on a race the calendar does not hold is a long road (a member, a submission, a queue
 * row, a moderator) and what matters here is only what it does to the event: it takes the event row, puts
 * a race on an earlier day, and moves the event's day to it. {@link AHeldTransaction} does exactly that
 * in three statements, and commits when the case says, so the order is the case's and not the
 * scheduler's.
 *
 * <p><b>Failures are answers, not exceptions.</b> A transaction that the schema refuses at commit throws
 * out of {@code MockMvc.perform}; a real server answers 500 for it. {@link #answered} turns the exception
 * into that 500 and keeps its message, so a broken rule fails on the status the case asserts and says what
 * the database said.
 *
 * <p><b>NOT {@code @Transactional}</b>: the writers are different connections and their rows are real
 * commits, taken back out by {@link #andNothingOfItIsLeftBehind}. The clock is fixed in October 2027,
 * where 2027 runs and nothing is frozen, which is what a recount needs.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TwoWritesOfOneEventAtOnceTest {

	/** Distinct from every other fixture's, on purpose: these rows are committed. */
	private static final String THE_NUMBER = "000988";

	private static final String THE_MODERATOR = "dve-trke-odjednom-moderator@primer.rs";

	private static final String THE_ADDRESS = "dve-trke-odjednom-2027";

	private static final LocalDate THE_MARATHONS_DAY = LocalDate.parse("2027-05-09");

	/** A week before it, in the same year, so the event's address does not move with its day. */
	private static final LocalDate THE_EARLIER_DAY = LocalDate.parse("2027-05-02");

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

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

	/** What the requests threw, by message: an exception out of {@code perform} is a 500. */
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
						+ " description, link) values (?, 'Maraton dve trke', ?,"
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
						+ " health_statement_at) values (?, 'Dvaput', 'Trkac', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, '0011aabbccddee88', '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.param(THE_NUMBER).query(Long.class).single();

		run = db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) select ?, id, date, cast('42.2' as numeric), 300, 280,"
						+ " 12600, ? from race where id = ? returning id")
				.params(runner, counted("42.2"), marathon).query(Long.class).single();

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
	 * A SECOND CHANGE OF ONE RACE WITH A FORM FROM BEFORE THE FIRST IS RECOUNTED AGAINST WHAT THE FIRST LEFT.
	 * The marathon is 42.2 km and has one counted run. One administrator saves 42.195; another, whose screen
	 * still shows 42.2, saves it back. The second form is the race as it WAS, so a write that compared it with
	 * the race as it was when it began would find nothing moved and leave the run at 42.195 on a race of
	 * 42.2. Forced: the event row is held, the first change is sent and waited for, then the second.
	 */
	@Test
	void aSecondChangeSentFromTheOldScreenRecountsTheRunTheFirstOneMoved() throws Exception {
		List<Integer> both = twoChangesBehindTheEvent(
				() -> change(marathon, ofALength("Maraton", THE_MARATHONS_DAY, "42.195")),
				() -> change(marathon, ofALength("Maraton", THE_MARATHONS_DAY, "42.2")));

		assertThat(both)
				.as("each change is taken; what the database said otherwise: " + thrown)
				.containsExactly(200, 200);
		assertThat(db.sql("select distance_km from race where id = ?").param(marathon)
				.query(BigDecimal.class).single())
				.as("the race stands at what the second form said")
				.isEqualByComparingTo("42.2");
		assertThat(db.sql("select distance_km from result where id = ?").param(run)
				.query(BigDecimal.class).single())
				.as("the run stands at the race's measure, and not at what the first change left")
				.isEqualByComparingTo("42.2");
		assertThat(db.sql("select points from result where id = ?").param(run)
				.query(BigDecimal.class).single())
				.as("and is counted at it")
				.isEqualByComparingTo(counted("42.2"));
	}

	/**
	 * A RACE ADDED WHILE ANOTHER WRITER IS PUTTING AN EARLIER ONE ON THE SAME EVENT LEAVES THE EVENT ON THE
	 * EARLIER DAY (PENDING, review of PR 577). The other writer holds the event row, puts a race a week
	 * before the marathon and moves the event's day to it; the addition, which had read the event before,
	 * works out its day from the races it saw (the marathon alone) and used to write that day over the
	 * earlier one, which the schema refuses at commit as a 500.
	 */
	@Test
	void aRaceAddedWhileAnEarlierOneIsBeingPutOnTheEventLeavesTheEventOnTheEarlierDay() throws Exception {
		List<Integer> answers = oneRequestBehindAnApprovalOfAnEarlierRace(
				() -> added("Polumaraton", THE_MARATHONS_DAY, "21.1"));

		assertThat(answers)
				.as("the race is added; what the database said otherwise: " + thrown)
				.containsExactly(201);
		assertThat(db.sql("select count(*) from race where event_id = ?").param(event)
				.query(Long.class).single())
				.as("the marathon, the earlier race and the one added")
				.isEqualTo(3);
		assertThat(theEventsDay()).isEqualTo(THE_EARLIER_DAY);
	}

	/**
	 * AND THE SAME FOR TAKING A RACE OUT: the marathon is deleted while the earlier race is being put on its
	 * event. Its write works out the day from the races that remain, which it read before the earlier one
	 * existed (none), and so keeps the day it read for the event. The earlier race is the first race now.
	 */
	@Test
	void aRaceDeletedWhileAnEarlierOneIsBeingPutOnTheEventLeavesTheEventOnTheEarlierDay() throws Exception {
		List<Integer> answers = oneRequestBehindAnApprovalOfAnEarlierRace(() -> deleted(marathon));

		assertThat(answers)
				.as("the race is deleted; what the database said otherwise: " + thrown)
				.containsExactly(204);
		assertThat(db.sql("select count(*) from race where event_id = ?").param(event)
				.query(Long.class).single())
				.as("only the earlier race is left")
				.isOne();
		assertThat(theEventsDay()).isEqualTo(THE_EARLIER_DAY);
	}

	/**
	 * A CHANGE OF A RACE THAT IS DELETED WHILE IT WAITS IS A 404, NOT A 500. The change takes the event first
	 * and reads the race after, so a race gone in the meantime is a race that is not there, the answer of an
	 * address that maps nothing.
	 */
	@Test
	void aChangeOfARaceDeletedWhileItWaitsForTheEventIsAnAddressThatMapsNothing() throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(1);
		List<Future<Integer>> submitted = new ArrayList<>();

		try (AHeldTransaction theEvent = new AHeldTransaction(pool)) {
			holdTheEvent(theEvent);

			submitted.add(requests.submit(() -> change(marathon,
					ofALength("Maraton", THE_MARATHONS_DAY, "42.195"))));
			theEvent.untilBehind(1, submitted);

			theEvent.db().sql("delete from race where id = ?").param(marathon).update();
			theEvent.commit();

			assertThat(submitted.get(0).get(30, TimeUnit.SECONDS))
					.as("the race was gone when the change got the event; what the database said: " + thrown)
					.isEqualTo(404);
		} finally {
			requests.shutdownNow();
		}
	}

	/** The event row held {@code FOR UPDATE}, which is how an approval holds it. */
	private void holdTheEvent(AHeldTransaction by) {
		by.db().sql("select 1 from btl_event where id = ? for update").param(event)
				.query(Integer.class).single();
	}

	/**
	 * THE OTHER WRITER, THEN ONE REQUEST: the event is held, an earlier race is put on it and the event moved
	 * to its day (all uncommitted), the request is sent and waited for until it stops behind the hold, and
	 * the writer commits.
	 */
	private List<Integer> oneRequestBehindAnApprovalOfAnEarlierRace(Callable<Integer> request)
			throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(1);
		List<Future<Integer>> submitted = new ArrayList<>();

		try (AHeldTransaction theApproval = new AHeldTransaction(pool)) {
			holdTheEvent(theApproval);

			theApproval.db().sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
							+ " distance_km, ascent_m, descent_m) values (?, 'Ranija trka', false, ?,"
							+ " 'length', 0, 10, 0, 0)")
					.params(event, THE_EARLIER_DAY).update();
			theApproval.db().sql("update btl_event set date = ? where id = ?")
					.params(THE_EARLIER_DAY, event).update();

			assertThat(theApproval.behind())
					.as("the event is held and nothing has been submitted yet")
					.isZero();

			submitted.add(requests.submit(request));
			theApproval.untilBehind(1, submitted);

			assertThat(submitted)
					.as("a request was answered before it reached the held event")
					.noneMatch(Future::isDone);

			theApproval.commit();

			return List.of(submitted.get(0).get(30, TimeUnit.SECONDS));
		} finally {
			requests.shutdownNow();
		}
	}

	/**
	 * THE EVENT HELD, THE FIRST REQUEST SENT AND WAITED FOR, THEN THE SECOND, THEN LET GO: the order both reach
	 * the database in is the order they are sent in, and the count behind the hold (recursive) proves the
	 * second stopped too, behind the first or behind the same lock.
	 */
	private List<Integer> twoChangesBehindTheEvent(Callable<Integer> first,
			Callable<Integer> second) throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(2);
		List<Future<Integer>> submitted = new ArrayList<>();

		try (AHeldTransaction theEvent = new AHeldTransaction(pool)) {
			holdTheEvent(theEvent);

			submitted.add(requests.submit(first));
			theEvent.untilBehind(1, submitted);
			submitted.add(requests.submit(second));
			theEvent.untilBehind(2, submitted);

			assertThat(submitted)
					.as("a request was answered before it reached the held event")
					.noneMatch(Future::isDone);

			theEvent.commit();

			return List.of(submitted.get(0).get(30, TimeUnit.SECONDS),
					submitted.get(1).get(30, TimeUnit.SECONDS));
		} finally {
			requests.shutdownNow();
		}
	}

	private LocalDate theEventsDay() {
		return db.sql("select date from btl_event where id = ?").param(event)
				.query((row, one) -> row.getDate(1).toLocalDate()).single();
	}

	private static BigDecimal counted(String km) {
		return BtlScoreCalculator.calculate(new BigDecimal(km).doubleValue(), 300, 280, 12600);
	}

	/** The status a real server would answer: an exception out of {@code perform} is the 500 it becomes. */
	private int answered(Callable<MockHttpServletResponse> request) {
		try {
			return request.call().getStatus();
		} catch (Exception failure) {
			thrown.add(failure.toString());

			return 500;
		}
	}

	private int change(long race, Form typed) {
		return answered(() -> http.perform(put("/api/races/" + race).with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(typed))
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse());
	}

	private int added(String name, LocalDate day, String km) {
		Form typed = new Form(event, name, true, day, "length", null, new BigDecimal(km), 150, 140);

		return answered(() -> http.perform(post("/api/races").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(typed))
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse());
	}

	private int deleted(long race) {
		return answered(() -> http.perform(delete("/api/races/" + race).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse());
	}

	/** What the event screen sends for one race, every field of it (ADL A54). */
	private record Form(Long eventId, String name, Boolean renamed, LocalDate date, String kind,
			Integer limitSeconds, BigDecimal distanceKm, Integer ascentM, Integer descentM) {
	}

	private static Form ofALength(String name, LocalDate day, String km) {
		return new Form(null, name, true, day, "length", null, new BigDecimal(km), 300, 280);
	}
}

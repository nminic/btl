package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
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
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A NEW EVENT THAT ANOTHER SAVE MAKES AT THE SAME ADDRESS IN THE SAME INSTANT IS AN EVENT OF THE
 * CALENDAR, AND A RACE GOES ON IT UNDER THE SAME CHECKS (PENDING: review of PR 585, medium).
 *
 * <p>{@link ResultsByTheLeagueApi} asks for the event at the new event's address before it judges a row,
 * and makes the event only if there is none. Between the two questions another save (a second
 * moderator, or the approval of a member's run) can make an event at that address, which the unique
 * index meets with {@code on conflict do nothing}. That save used to read the key and go on, so none of
 * what a race on an event that is there is asked was asked of it: an event that is a training took a
 * race (201 where the same request on the same event a moment later is 400), and a race on a day
 * before the event's was refused only at the commit by V29's deferred trigger, as a 500.
 *
 * <p><b>THE OTHER SAVE IS A TRANSACTION OF THE CASE'S OWN, and the order is the case's.</b> It holds the
 * member's {@code competitor} row, which the save locks before it judges a row, so the save has asked its
 * first question (no event there) and stands at that lock; the case then makes the event and commits,
 * and the save goes on to an insert that gives way. A barrier would pass whether or not the two met.
 *
 * <p><b>THE AXES.</b> The event that is met: not a race (a training), a race of the request's year that
 * begins LATER than the request's day, a race of the request's year that begins EARLIER, and a race of
 * ANOTHER year under this year's address. Beside each of them stands an event of a SIMILAR address made
 * before it (the same address with a month, the shape of an imported one), of the opposite kind, so an
 * answer worked out from the wrong event is told apart from the right one. Not {@code @Transactional},
 * because the writers are different connections; {@link #andNothingOfItIsLeftBehind} takes the rows out.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ANewEventAnotherSaveMadeTest {

	/** Distinct from every other fixture's, on purpose: these rows are committed. */
	private static final String THE_NUMBER = "000986";

	private static final String THE_MODERATOR = "sudar-adrese-moderator@primer.rs";

	/** The name the request gives its new event, and the address that name has in 2027. */
	private static final String THE_NAME = "Sudar nad adresom";

	private static final String THE_ADDRESS = "sudar-nad-adresom-2027";

	/** An address that begins with the first one and is another event's: an imported one carries a month. */
	private static final String A_SIMILAR_ADDRESS = "sudar-nad-adresom-2027-05";

	private static final LocalDate THE_REQUESTS_DAY = LocalDate.parse("2027-05-08");

	private static final LocalDate A_LATER_DAY = LocalDate.parse("2027-05-20");

	private static final LocalDate AN_EARLIER_DAY = LocalDate.parse("2027-05-02");

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

	/** What the requests threw, by message: an exception out of {@code perform} is the 500 it becomes. */
	private final List<String> thrown = new CopyOnWriteArrayList<>();

	private long runner;

	private String cookie;

	@BeforeEach
	void aMemberAModeratorAndAnEventWithASimilarAddress() {
		thrown.clear();

		runner = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, referral_code, bio,"
						+ " profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at) values (?, 'Sudar', 'Adrese', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, '0011aabbccddee86', '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.param(THE_NUMBER).query(Long.class).single();

		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2027, 'feeExempt', 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.param(runner).update();

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Mod', 'Eratorka', ?,"
						+ " (select id from role where code = 'moderator'))")
				.param(THE_MODERATOR).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:results')")
				.param(THE_MODERATOR).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_MODERATOR, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();

		/* MADE FIRST, so it has the lower key: a question that took the first event whose address
		   begins with this one would find it, and it is of the kind the event met is not. */
		anEvent(db, A_SIMILAR_ADDRESS, "Sudar nad adresom, maj", LocalDate.parse("2027-05-30"), "race");
	}

	/** Real commits, so a real delete, children before parents. */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from message where to_id = ?").param(runner).update();
		db.sql("delete from result where competitor_id = ?").param(runner).update();
		db.sql("delete from race where event_id in (select id from btl_event where slug like 'sudar-nad-adresom-%')")
				.update();
		db.sql("delete from btl_event where slug like 'sudar-nad-adresom-%'").update();
		db.sql("delete from membership where competitor_id = ?").param(runner).update();
		db.sql("delete from competitor where id = ?").param(runner).update();
		db.sql("delete from account_session where account_id = (select id from account where email = ?)")
				.param(THE_MODERATOR).update();
		db.sql("delete from account_admin_right where account_id = (select id from account where email = ?)")
				.param(THE_MODERATOR).update();
		db.sql("delete from account where email = ?").param(THE_MODERATOR).update();
	}

	/**
	 * THE EVENT MET IS A TRAINING, ON THE REQUEST'S OWN DAY: the request is the one an event of the
	 * calendar that is a training answers 400 (a form not filled in), and nothing of it is written. Without
	 * the check it is 201, a race on a training.
	 */
	@Test
	void anEventMadeMeanwhileThatIsATrainingOnTheRequestsDayTakesNoRace() throws Exception {
		aTrainingMadeMeanwhileTakesNoRace(THE_REQUESTS_DAY);
	}

	/** AND ON ANOTHER DAY, so a check made only where the two days are the same is told apart. */
	@Test
	void anEventMadeMeanwhileThatIsATrainingOnALaterDayTakesNoRace() throws Exception {
		aTrainingMadeMeanwhileTakesNoRace(A_LATER_DAY);
	}

	private void aTrainingMadeMeanwhileTakesNoRace(LocalDate itsDay) throws Exception {
		MockHttpServletResponse answer = whileAnotherSaveMakes(
				by -> anEvent(by, THE_ADDRESS, THE_NAME, itsDay, "training"));

		assertThat(answer.getStatus()).as("what the database said otherwise: " + thrown).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(racesOn(THE_ADDRESS)).as("the race was written on an event that holds none").isZero();
		assertThat(racesOn(A_SIMILAR_ADDRESS)).isZero();
		assertThat(theDayOf(THE_ADDRESS)).isEqualTo(itsDay);
		assertThat(resultsOfTheMember()).isZero();
		assertThat(messagesOfTheMember()).isZero();
	}

	/**
	 * THE EVENT MET BEGINS LATER THAN THE REQUEST'S DAY, with no race yet: the race goes on it and the
	 * event begins on the race's day, as it does on an event of the calendar (PDL P9, 19.10.2026). Without
	 * the move the schema refuses the event's day at the commit (V29), a 500. The event of the similar
	 * address, of the kind the one met is not, is left as it was.
	 */
	@Test
	void anEventMadeMeanwhileThatBeginsLaterIsMovedBackToTheRacesDay() throws Exception {
		MockHttpServletResponse answer = whileAnotherSaveMakes(
				by -> anEvent(by, THE_ADDRESS, THE_NAME, A_LATER_DAY, "race"));

		assertThat(answer.getStatus()).as("what the database said otherwise: " + thrown).isEqualTo(201);
		assertThat(new ObjectMapper().readTree(answer.getContentAsString()).path("event").asString())
				.isEqualTo(THE_ADDRESS);
		assertThat(theDayOf(THE_ADDRESS)).as("the event begins on the race's day").isEqualTo(THE_REQUESTS_DAY);
		assertThat(racesOn(THE_ADDRESS)).isEqualTo(1);
		assertThat(resultsOfTheMember()).isEqualTo(1);
		assertThat(racesOn(A_SIMILAR_ADDRESS)).as("the similar event took the race").isZero();
		assertThat(theDayOf(A_SIMILAR_ADDRESS)).isEqualTo(LocalDate.parse("2027-05-30"));
	}

	/**
	 * THE EVENT MET BEGAN EARLIER ON A RACE OF ITS OWN: the race is added beside it and the event keeps
	 * its day, since an event never begins after its first race.
	 */
	@Test
	void anEventMadeMeanwhileThatBeganEarlierKeepsItsDay() throws Exception {
		MockHttpServletResponse answer = whileAnotherSaveMakes(by -> {
			long event = anEvent(by, THE_ADDRESS, THE_NAME, AN_EARLIER_DAY, "race");

			by.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
							+ " ascent_m, descent_m) values (?, 'Ranija trka', false, ?, 'length', 0, 10, 0, 0)")
					.params(event, AN_EARLIER_DAY).update();
		});

		assertThat(answer.getStatus()).as("what the database said otherwise: " + thrown).isEqualTo(201);
		assertThat(theDayOf(THE_ADDRESS)).isEqualTo(AN_EARLIER_DAY);
		assertThat(racesOn(THE_ADDRESS)).as("its own race and the one added").isEqualTo(2);
		assertThat(resultsOfTheMember()).isEqualTo(1);
		assertThat(racesOn(A_SIMILAR_ADDRESS)).isZero();
	}

	/**
	 * THE EVENT MET IS OF ANOTHER YEAR than the request's day, under this year's address (an address an
	 * administrator kept when the event moved): refused as on an event of the calendar, with the owner's
	 * sentence for a day outside the event's year (PDL, 22.10.2026, „Ekran 7b: dan trke mora biti u godini
	 * izabranog događaja”), which until then was a form not filled in.
	 */
	@Test
	void anEventMadeMeanwhileOfAnotherYearTakesNoRace() throws Exception {
		MockHttpServletResponse answer = whileAnotherSaveMakes(
				by -> anEvent(by, THE_ADDRESS, THE_NAME, LocalDate.parse("2028-03-01"), "race"));

		assertThat(answer.getStatus()).as("what the database said otherwise: " + thrown).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(ResultsByTheLeagueApi.THE_DAY_IS_NOT_IN_THE_EVENTS_YEAR);
		assertThat(racesOn(THE_ADDRESS)).isZero();
		assertThat(racesOn(A_SIMILAR_ADDRESS)).isZero();
		assertThat(theDayOf(THE_ADDRESS)).isEqualTo(LocalDate.parse("2028-03-01"));
		assertThat(resultsOfTheMember()).isZero();
	}

	/**
	 * THE EVENT THE ADDRESS ANSWERS TO IS HELD FOR THE SAVE, AND WHAT IT READS IS WHAT ANOTHER WRITER LEFT.
	 * The event is in the calendar from the start, on a day LATER than the request's. Another writer holds
	 * it {@code for no key update}, puts a race a week before the request's day on it and moves its day
	 * there (all uncommitted), as the approval of a member's run does ({@code TheDayOfAnEvent}). The
	 * save stops at the event, and once the writer commits it works its day out from the races that are
	 * there, the earlier one among them, and leaves the event where it is. An event read plainly would not
	 * stop, would set the request's day over the earlier one, and the schema would refuse that at the
	 * commit (V29) as a 500. A save that meets an event at its insert is begun again from the top and asks this
	 * same question there, so it is held the same way ({@code TwoLeagueSavesOnANewEventTest} holds that one).
	 */
	@Test
	void anEventOfTheCalendarIsHeldAgainstAnEarlierRaceBeingPutOnIt() throws Exception {
		long event = anEvent(db, THE_ADDRESS, THE_NAME, A_LATER_DAY, "race");
		ExecutorService requests = Executors.newFixedThreadPool(1);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try (AHeldTransaction theApproval = new AHeldTransaction(pool)) {
			theApproval.db().sql("select 1 from btl_event where id = ? for no key update").param(event)
					.query(Integer.class).single();
			theApproval.db().sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
							+ " distance_km, ascent_m, descent_m) values (?, 'Ranija trka', false, ?,"
							+ " 'length', 0, 10, 0, 0)")
					.params(event, AN_EARLIER_DAY).update();
			theApproval.db().sql("update btl_event set date = ? where id = ?")
					.params(AN_EARLIER_DAY, event).update();

			assertThat(theApproval.behind()).as("the event is held and nothing has been sent yet").isZero();

			submitted.add(requests.submit(this::theLeagueEntersOnANewEvent));
			theApproval.untilBehind(1, submitted);

			assertThat(submitted).as("the save was answered before it reached the held event")
					.noneMatch(Future::isDone);

			theApproval.commit();

			MockHttpServletResponse answer = submitted.get(0).get(30, TimeUnit.SECONDS);

			assertThat(answer.getStatus()).as("what the database said otherwise: " + thrown).isEqualTo(201);
		} finally {
			requests.shutdownNow();
		}

		assertThat(theDayOf(THE_ADDRESS)).isEqualTo(AN_EARLIER_DAY);
		assertThat(racesOn(THE_ADDRESS)).as("the writer's race and the save's").isEqualTo(2);
		assertThat(resultsOfTheMember()).isEqualTo(1);
	}

	/**
	 * THE SAVE IS SENT, WAITED FOR UNTIL IT STANDS AT THE MEMBER'S ROW, AND ONLY THEN IS THE EVENT MADE:
	 * the save has asked for the event at the address and been told there is none, and the other save's
	 * transaction commits what it made while the save is stopped.
	 *
	 * @param making what the other save writes, through its own transaction
	 */
	private MockHttpServletResponse whileAnotherSaveMakes(Consumer<JdbcClient> making) throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(1);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try (AHeldTransaction theOtherSave = new AHeldTransaction(pool)) {
			theOtherSave.db().sql("select 1 from competitor where id = ? for update").param(runner)
					.query(Integer.class).single();

			assertThat(theOtherSave.behind())
					.as("the member's row is held and nothing has been sent yet")
					.isZero();

			submitted.add(requests.submit(this::theLeagueEntersOnANewEvent));
			theOtherSave.untilBehind(1, submitted);

			assertThat(submitted).as("the save was answered before it reached the member's row")
					.noneMatch(Future::isDone);

			making.accept(theOtherSave.db());
			theOtherSave.commit();

			return submitted.get(0).get(30, TimeUnit.SECONDS);
		} finally {
			requests.shutdownNow();
		}
	}

	/** The save, as a real server would answer it: an exception out of {@code perform} is the 500 it becomes. */
	private MockHttpServletResponse theLeagueEntersOnANewEvent() {
		String body = "{\"event\":{\"name\":\"" + THE_NAME + "\",\"date\":\"" + THE_REQUESTS_DAY
				+ "\",\"city\":\"Ohrid\",\"country\":\"MK\"},\"race\":{\"name\":\"Desetka\","
				+ "\"kind\":\"length\",\"distanceKm\":10.00,\"ascentM\":50,\"descentM\":40,\"limitSeconds\":null},"
				+ "\"rows\":[{\"memberNumber\":\"" + THE_NUMBER + "\",\"seconds\":3600}]}";

		try {
			return http.perform(post("/api/results/on-a-race-of-an-event").with(csrf())
							.contentType(MediaType.APPLICATION_JSON).content(body)
							.cookie(new Cookie(SessionCookie.NAME, cookie)))
					.andReturn().getResponse();
		} catch (Exception failure) {
			thrown.add(failure.toString());

			MockHttpServletResponse serverFault = new MockHttpServletResponse();

			serverFault.setStatus(500);

			return serverFault;
		}
	}

	private static long anEvent(JdbcClient by, String address, String name, LocalDate day, String kind) {
		return by.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values (?, ?, ?, (select id from place where rank = 1), ?, false, '', '')"
						+ " returning id")
				.params(address, name, day, kind).query(Long.class).single();
	}

	private LocalDate theDayOf(String address) {
		return db.sql("select date from btl_event where slug = ?").param(address)
				.query((row, one) -> row.getDate(1).toLocalDate()).single();
	}

	private int racesOn(String address) {
		return db.sql("select count(*) from race where event_id = (select id from btl_event where slug = ?)")
				.param(address).query(Integer.class).single();
	}

	private int resultsOfTheMember() {
		return db.sql("select count(*) from result where competitor_id = ?").param(runner)
				.query(Integer.class).single();
	}

	private int messagesOfTheMember() {
		return db.sql("select count(*) from message where to_id = ?").param(runner)
				.query(Integer.class).single();
	}

	private static String reasonIn(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("reason").asString();
	}
}

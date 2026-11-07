package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
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
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE ADMINISTRATION'S TWO ROADS THAT PUT A RACE UNDER AN EVENT: {@code POST /api/races} and {@code PUT
 * /api/races/{id}} (PDL P9, owner, 06.11.2026, „U prozoru 1. januara od 00:00 do 10:00 server odbija trku iz
 * stare godine na događaju koji još predstoji”, widened on 07.11.2026: „odbija se uvek, na svim putevima
 * (administracija, liga, odobravanje), ne samo u prozoru 1.1. Izričito pomeranje celog događaja („Izmeni
 * događaj”) ostaje dozvoljeno”).
 *
 * <p>The clock is the thing under test and {@code RaceWriteApiTest}, whose fixture stands on the real clock,
 * cannot ask it. Each road is asked what the decision refuses, at the last second of the old window, at the
 * second it closed and in the middle of June, and the neighbours it leaves alone: the event that is over, the
 * race of the new year, the year before the one that ended (written down as outside the sentence), and the
 * whole event moved by {@code PUT /api/events/{id}}. The question itself is held in
 * {@code TheDayOfAnEventTest}; what these cases hold is that each road asks it, of the right values, before it
 * writes anything.
 *
 * <p><b>The event is dated 2 January</b>, the nearest day that is ahead on the morning of the 1st. The edit
 * cases give it a second race on the 3rd, so the race moved is neither the earliest nor the only one.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class,
		AnEventStillAheadIsNotPulledBackByTheAdministrationTest.TheClockTheseCasesUse.class})
@Transactional
class AnEventStillAheadIsNotPulledBackByTheAdministrationTest {

	private static final String REFUSED = "anEventStillAheadWouldMoveIntoTheYearJustEnded";

	/** 09:59:59 in Belgrade on 1 January 2028: the last second of the window. */
	private static final Instant THE_LAST_SECOND = Instant.parse("2028-01-01T08:59:59Z");

	/** 10:00:00 in Belgrade: the window is over. */
	private static final Instant THE_TENTH_HOUR = Instant.parse("2028-01-01T09:00:00Z");

	/** The middle of June 2028: nothing of the old window is left to say anything. */
	private static final Instant IN_JUNE = Instant.parse("2028-06-15T10:00:00Z");

	private static final String MODERATOR = "kalendar-nova-godina@primer.rs";

	private static final String SUPERADMIN = "superadmin-nova-godina@primer.rs";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private String moderator;

	private String superadmin;

	/** The event dated 2 January 2028 with a race that day. */
	private long ahead;

	private long theFirstRace;

	private long theSecondRace;

	@BeforeEach
	void anEventDatedTomorrowOnNewYearsMorning() {
		clock.moveTo(THE_LAST_SECOND);

		ahead = event("noc-2028", "Noc", "2028-01-02");
		theFirstRace = race(ahead, "Jutarnja", "2028-01-02");
		theSecondRace = race(ahead, "Podnevna", "2028-01-03");

		moderator = account(MODERATOR, "moderator");
		superadmin = account(SUPERADMIN, "superadmin");

		db.sql("insert into account_admin_right (account_id, right_code)"
				+ " values ((select id from account where email = ?), 'entity:events')")
				.param(MODERATOR).update();
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(THE_LAST_SECOND);
		}
	}

	/** A clock the case moves, reporting UTC as its zone as the league's other test clocks do. */
	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		private AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}

	private long event(String slug, String name, String day) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, date '" + day + "', " + A_TOWN
						+ ", null, null, 'race', false, '', '') returning id")
				.params(slug, name).query(Long.class).single();
	}

	private long race(long event, String name, String day) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, date '" + day + "', 'length', 0, 10.00, 0, 0) returning id")
				.params(event, name).query(Long.class).single();
	}

	private String account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
						+ " 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		SecretToken token = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, token.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return token.secret();
	}

	private static String form(Long event, String name, String day) {
		return "{" + (event == null ? "" : "\"eventId\":" + event + ",") + "\"name\":\"" + name
				+ "\",\"renamed\":true,\"date\":\"" + day + "\",\"kind\":\"length\","
				+ "\"distanceKm\":10.00,\"ascentM\":0,\"descentM\":0}";
	}

	private MockHttpServletResponse add(String session, long under, String day) throws Exception {
		return http.perform(post("/api/races").with(csrf()).contentType(MediaType.APPLICATION_JSON)
						.content(form(under, "Silvestarska", day))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse change(long race, String day) throws Exception {
		return http.perform(put("/api/races/" + race).with(csrf()).contentType(MediaType.APPLICATION_JSON)
						.content(form(null, "Izmenjena", day))
						.cookie(new Cookie(SessionCookie.NAME, moderator)))
				.andReturn().getResponse();
	}

	private LocalDate eventDay(long event) {
		return db.sql("select date from btl_event where id = ?").param(event).query(LocalDate.class).single();
	}

	private String eventAddress(long event) {
		return db.sql("select slug from btl_event where id = ?").param(event).query(String.class).single();
	}

	private int races(long event) {
		return db.sql("select count(*) from race where event_id = ?").param(event).query(Integer.class).single();
	}

	private MockHttpServletResponse movedToNewYearsEve(long event, String name) throws Exception {
		long town = db.sql("select geonames_id from place where rank = 1").query(Long.class).single();

		return http.perform(put("/api/events/" + event).with(csrf()).contentType(MediaType.APPLICATION_JSON)
						.content("{\"name\":\"" + name + "\",\"date\":\"2027-12-31\",\"placeId\":" + town
								+ ",\"kind\":\"race\",\"featured\":false,\"description\":\"\",\"link\":\"\"}")
						.cookie(new Cookie(SessionCookie.NAME, moderator)))
				.andReturn().getResponse();
	}

	private LocalDate dayOfRace(long race) {
		return db.sql("select date from race where id = ?").param(race).query(LocalDate.class).single();
	}

	/**
	 * THE ROAD THAT ADDS: a race of New Year's Eve under an event dated tomorrow is refused with the sentence of
	 * its own, by the moderator who holds the right over the calendar and by the superadmin, and the event
	 * keeps its day and its address and gets no race.
	 */
	@Test
	void aRaceOfNewYearsEveIsRefusedUnderAnEventThatIsAheadForBothWhoMayWriteTheCalendar() throws Exception {
		for (String who : new String[] {moderator, superadmin}) {
			MockHttpServletResponse refused = add(who, ahead, "2027-12-31");

			assertThat(refused.getStatus()).isEqualTo(409);
			assertThat(refused.getContentAsString()).contains(REFUSED);
		}

		assertThat(RaceWriteApi.AN_EVENT_STILL_AHEAD_WOULD_MOVE_INTO_THE_YEAR_JUST_ENDED).isEqualTo(REFUSED);
		assertThat(races(ahead)).isEqualTo(2);
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2028, 1, 2));
		assertThat(eventAddress(ahead)).isEqualTo("noc-2028");
	}

	/**
	 * THE SECOND THE OLD WINDOW CLOSED AND THE MIDDLE OF JUNE ASK THE SAME QUESTION (07.11.2026): the same race
	 * under an event that is ahead is refused at ten o'clock and in June, and the event keeps its day, its address
	 * and its races. In June the event is dated September, since "ahead" there means any day from the 15th on.
	 */
	@Test
	void atTenOClockAndInJuneTheSameRaceIsStillRefused() throws Exception {
		clock.moveTo(THE_TENTH_HOUR);

		MockHttpServletResponse refused = add(moderator, ahead, "2027-12-31");

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(refused.getContentAsString()).contains(REFUSED);
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2028, 1, 2));
		assertThat(eventAddress(ahead)).isEqualTo("noc-2028");
		assertThat(races(ahead)).isEqualTo(2);

		clock.moveTo(IN_JUNE);
		long september = event("jesen-2028", "Jesen", "2028-09-01");
		race(september, "Jesenja", "2028-09-01");

		MockHttpServletResponse inJune = add(moderator, september, "2027-12-31");

		assertThat(inJune.getStatus()).isEqualTo(409);
		assertThat(inJune.getContentAsString()).contains(REFUSED);
		assertThat(eventDay(september)).isEqualTo(LocalDate.of(2028, 9, 1));
		assertThat(eventAddress(september)).isEqualTo("jesen-2028");
		assertThat(races(september)).isEqualTo(1);
	}

	/**
	 * AN EVENT DATED TODAY IS AHEAD TOO (owner, 07.11.2026, „Događaj zakazan za danas takođe „još predstoji””): on
	 * the morning of 1 January and in June alike, nothing is written and the event keeps its day.
	 */
	@Test
	void anEventDatedTodayIsRefusedTheRaceOfNewYearsEve() throws Exception {
		long today = event("danas-2028", "Danas", "2028-01-01");
		race(today, "Podnevna", "2028-01-01");

		MockHttpServletResponse refused = add(moderator, today, "2027-12-31");

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(refused.getContentAsString()).contains(REFUSED);
		assertThat(eventDay(today)).isEqualTo(LocalDate.of(2028, 1, 1));
		assertThat(races(today)).isEqualTo(1);

		clock.moveTo(IN_JUNE);
		long theFifteenth = event("danas-jun-2028", "Danas jun", "2028-06-15");
		race(theFifteenth, "Podnevna", "2028-06-15");

		MockHttpServletResponse inJune = add(moderator, theFifteenth, "2027-12-31");

		assertThat(inJune.getStatus()).isEqualTo(409);
		assertThat(inJune.getContentAsString()).contains(REFUSED);
		assertThat(eventDay(theFifteenth)).isEqualTo(LocalDate.of(2028, 6, 15));
		assertThat(races(theFifteenth)).isEqualTo(1);
	}

	/**
	 * AN EVENT THAT IS OVER TAKES THE RACE OF THE YEAR JUST ENDED, which is what the decision of 20.10.2026 left
	 * standing: dated yesterday in June, it begins on the earlier race and answers at the address of the year
	 * before.
	 */
	@Test
	void anEventDatedYesterdayTakesTheRaceOfTheYearJustEnded() throws Exception {
		clock.moveTo(IN_JUNE);
		long yesterdays = event("juce-2028", "Juce", "2028-06-14");
		race(yesterdays, "Podnevna", "2028-06-14");

		MockHttpServletResponse written = add(moderator, yesterdays, "2027-12-31");

		assertThat(written.getStatus()).isEqualTo(201);
		assertThat(eventDay(yesterdays)).isEqualTo(LocalDate.of(2027, 12, 31));
		assertThat(eventAddress(yesterdays)).isEqualTo("juce-2027");
	}

	/** A race of the new year is not a race of the old one, whatever the event is. */
	@Test
	void aRaceOfTheNewYearIsWrittenUnderAnEventThatIsAhead() throws Exception {
		MockHttpServletResponse written = add(moderator, ahead, "2028-01-01");

		assertThat(written.getStatus()).isEqualTo(201);
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2028, 1, 1));
		assertThat(eventAddress(ahead)).as("inside its year the address is kept").isEqualTo("noc-2028");
	}

	/**
	 * THE YEAR BEFORE THE ONE THAT JUST ENDED IS OUTSIDE THE SENTENCE, written down as the boundary it is:
	 * the owner's words are „trku iz stare godine”, and the year that has just ended is the one that is old
	 * on that morning. A race of 2026 under the same event is written, as it is at any other time of the
	 * year, and the event goes back two years. This is a reading of mine and one line in
	 * {@code TheDayOfAnEvent.pullsAnEventStillAheadIntoTheYearJustEnded}.
	 */
	@Test
	void aRaceOfTheYearBeforeTheOneThatEndedIsOutsideTheSentence() throws Exception {
		MockHttpServletResponse written = add(moderator, ahead, "2026-12-31");

		assertThat(written.getStatus()).isEqualTo(201);
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2026, 12, 31));
	}

	/**
	 * THE ROAD THAT MOVES A DAY: the second race, neither the earliest nor the only one, is moved onto New
	 * Year's Eve and the event would begin there; refused, and the race stays on the 3rd.
	 */
	@Test
	void aRaceMovedOntoNewYearsEveIsRefusedUnderAnEventThatIsAhead() throws Exception {
		MockHttpServletResponse refused = change(theSecondRace, "2027-12-31");

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(refused.getContentAsString()).contains(REFUSED);
		assertThat(dayOfRace(theSecondRace)).isEqualTo(LocalDate.of(2028, 1, 3));
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2028, 1, 2));
		assertThat(eventAddress(ahead)).isEqualTo("noc-2028");
	}

	/**
	 * THE SAME MOVE AT TEN O'CLOCK, IN JUNE AND ON AN EVENT DATED TODAY IS REFUSED ALL THE SAME (07.11.2026), and the
	 * race stays where it was. The event dated yesterday, in June, is over: the move is written and it goes back
	 * with the race.
	 */
	@Test
	void theSameMoveIsRefusedAtAnyTimeOfTheYearForAnEventThatIsAheadAndWrittenForOneThatIsOver()
			throws Exception {
		clock.moveTo(THE_TENTH_HOUR);

		MockHttpServletResponse atTen = change(theSecondRace, "2027-12-31");

		assertThat(atTen.getStatus()).isEqualTo(409);
		assertThat(atTen.getContentAsString()).contains(REFUSED);
		assertThat(dayOfRace(theSecondRace)).isEqualTo(LocalDate.of(2028, 1, 3));
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2028, 1, 2));

		clock.moveTo(IN_JUNE);
		long today = event("danas-jun-2028", "Danas jun", "2028-06-15");
		race(today, "Prva", "2028-06-15");
		long itsSecond = race(today, "Druga", "2028-06-16");

		MockHttpServletResponse onAnEventDatedToday = change(itsSecond, "2027-12-31");

		assertThat(onAnEventDatedToday.getStatus()).isEqualTo(409);
		assertThat(onAnEventDatedToday.getContentAsString()).contains(REFUSED);
		assertThat(dayOfRace(itsSecond)).isEqualTo(LocalDate.of(2028, 6, 16));
		assertThat(eventDay(today)).isEqualTo(LocalDate.of(2028, 6, 15));

		long over = event("juce-2028", "Juce", "2028-06-14");
		race(over, "Prva", "2028-06-14");
		long itsOther = race(over, "Druga", "2028-06-15");

		assertThat(change(itsOther, "2027-12-31").getStatus()).isEqualTo(200);
		assertThat(dayOfRace(itsOther)).isEqualTo(LocalDate.of(2027, 12, 31));
		assertThat(eventDay(over)).isEqualTo(LocalDate.of(2027, 12, 31));
	}

	/**
	 * THE WHOLE EVENT MOVED BY "IZMENI DOGAĐAJ" IS NOT THIS QUESTION AND STAYS ALLOWED (owner, 07.11.2026): the
	 * event that is ahead is moved onto New Year's Eve with its races, at any time of the year, because that is the
	 * owner's own explicit act and not a race that pulls the event.
	 */
	@Test
	void movingTheWholeEventBackIsStillAllowedAtAnyTimeOfTheYear() throws Exception {
		assertThat(movedToNewYearsEve(ahead, "Noc").getStatus()).as("the old window").isEqualTo(200);
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2027, 12, 31));

		clock.moveTo(IN_JUNE);
		long september = event("jesen-2028", "Jesen", "2028-09-01");
		race(september, "Jesenja", "2028-09-01");

		assertThat(movedToNewYearsEve(september, "Jesen").getStatus()).as("June").isEqualTo(200);
		assertThat(eventDay(september)).isEqualTo(LocalDate.of(2027, 12, 31));
	}

	/**
	 * A MOVE INSIDE THE NEW YEAR IS NOT PULLED BACK: the second race goes to the 4th (the event does not
	 * move) and the first to the 1st (the event begins on it).
	 */
	@Test
	void aMoveInsideTheNewYearIsWritten() throws Exception {
		assertThat(change(theSecondRace, "2028-01-04").getStatus()).isEqualTo(200);
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2028, 1, 2));

		assertThat(change(theFirstRace, "2028-01-01").getStatus()).isEqualTo(200);
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2028, 1, 1));
	}
}

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
 * THE ADMINISTRATION'S TWO ROADS THAT PUT A RACE UNDER AN EVENT, ON THE MORNING OF 1 JANUARY: {@code POST
 * /api/races} and {@code PUT /api/races/{id}} (PDL P9, owner, 06.11.2026, „U prozoru 1. januara od 00:00 do
 * 10:00 server odbija trku iz stare godine na događaju koji još predstoji”).
 *
 * <p>The decision is about the window, so the clock is the thing under test and {@code RaceWriteApiTest}, whose
 * fixture stands on the real clock, cannot ask it. Each road is asked what the decision refuses and the
 * neighbours it leaves alone: the event that is not ahead, the race of the new year, the second the window
 * closes, and the year before the one that ended (written down as outside the sentence). The question itself
 * is held in {@code TheDayOfAnEventTest}; what these cases hold is that each road asks it, of the right
 * values, before it writes anything.
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
	 * THE SECOND THE WINDOW CLOSES: at ten o'clock the road is what it was before the decision, and the
	 * administration moves the calendar backwards as it always could (owner, 31.07.2026), the event
	 * beginning on the race and answering at the address of the year it is now in.
	 */
	@Test
	void atTenOClockTheSameRaceIsWrittenAndTheEventMovesBack() throws Exception {
		clock.moveTo(THE_TENTH_HOUR);

		MockHttpServletResponse written = add(moderator, ahead, "2027-12-31");

		assertThat(written.getStatus()).isEqualTo(201);
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2027, 12, 31));
		assertThat(eventAddress(ahead)).isEqualTo("noc-2027");
	}

	/** An event dated today is not ahead: the decision of 20.10.2026 stands for it. */
	@Test
	void anEventDatedTodayTakesTheRaceOfNewYearsEve() throws Exception {
		long today = event("danas-2028", "Danas", "2028-01-01");
		race(today, "Podnevna", "2028-01-01");

		MockHttpServletResponse written = add(moderator, today, "2027-12-31");

		assertThat(written.getStatus()).isEqualTo(201);
		assertThat(eventDay(today)).isEqualTo(LocalDate.of(2027, 12, 31));
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

	/** The same edit at ten o'clock is written, and the event goes back with the race. */
	@Test
	void atTenOClockTheSameMoveIsWritten() throws Exception {
		clock.moveTo(THE_TENTH_HOUR);

		MockHttpServletResponse written = change(theSecondRace, "2027-12-31");

		assertThat(written.getStatus()).isEqualTo(200);
		assertThat(dayOfRace(theSecondRace)).isEqualTo(LocalDate.of(2027, 12, 31));
		assertThat(eventDay(ahead)).isEqualTo(LocalDate.of(2027, 12, 31));
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

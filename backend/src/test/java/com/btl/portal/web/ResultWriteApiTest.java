package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.result.ProofThatTheRunHappened.Outcome;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.user.GreenMailUser;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A MEMBER SENDING IN HIS RUN, CORRECTING IT AND TAKING IT BACK, against a real database
 * and a real mail server.
 *
 * <p>GreenMail is an SMTP server rather than a mock, so what these cases read back is what
 * actually travelled - which matters more here than anywhere else on this server, because
 * PDL P22 makes the message the ONLY record of what a result used to say: „Posto
 * se istorija izmena ne cuva ni dnevnik administrativnih akcija, obavestenje mora da sadrzi
 * staru vrednost, jer ona nigde drugde ne prezivljava." A mock asked „were you called"
 * would answer about this file; this answers about the record.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND, on every axis an assertion
 * reads a value along.</b> The rule the repository holds itself to since 06.09.2026 („Imenuj
 * drugi izvor iste vrednosti"), applied one axis at a time:
 *
 * <ul>
 * <li><b>Three members, and the one who writes is third.</b> {@link #ME} is written after
 * {@link #FIRST_WRITTEN} and {@link #SOMEONE_ELSE}, so „the member asking" and „the first
 * member in the record" are different keys.
 * <li><b>Every member carries his OWN name and his OWN address.</b> A helper that gave all
 * three „Probni Probic" would make „his address" and „an address" one value, and a message
 * sent to the wrong member would read exactly like one sent to the right one.
 * <li><b>{@link #ME} has TWO results, and the one the cases act on is not the first of
 * them.</b> So „his result" and „his first result" are different rows, and
 * {@code applications[0]}-shaped mistakes are visible.
 * <li><b>{@link #SOMEONE_ELSE} has a result on the SAME race with the same distance, climb
 * and fall.</b> Only the time and the points differ, so a statement that lost its
 * {@code competitor_id} reads a row that looks almost right.
 * <li><b>{@link #FIRST_WRITTEN} has a result too, on the one race kind the other two
 * miss.</b> {@link #myResult} is on a race of a length and {@link #myOtherResult} is on a
 * free one; without a result on {@link #timeRace} the axis „which figure the race fixes"
 * had only one live state on the correction route, which is exactly what let
 * {@link ResultWriteApi#change} take all four figures from the member and no case notice
 * it (finding of 25.09.2026, PR 365).
 * <li><b>The race was run on a day that is not today.</b> {@link #ORDINARY_MOMENT} is
 * 15.06.2027 and every race in the fixture is earlier, so „the day of the race" and „the day
 * somebody typed it in" can never be the same string (ADL A12, 2c).
 * <li><b>The inbox already holds three messages</b> - one addressed to {@link #ME}, one to
 * {@link #SOMEONE_ELSE} and one to the whole league ({@code to_id} empty, which V13 says
 * means everybody) - so „the line this request wrote" is never „the only row in
 * {@code message}", and a message addressed to nobody cannot pass for one addressed to him.
 * <li><b>The queue already holds a row on another tab and a results row of somebody
 * else's</b>, so „the results tab" and „the whole queue" are two counts.
 * </ul>
 *
 * <p><b>Its own mail port, 3332.</b> {@link MailServerForACase} carries the reason at
 * length. The numbers already spoken for when this was written: 3025 ({@code PostmanTest}'s
 * old one, still named in the repository), 3325 to 3330 across six classes, and 3331 on a
 * branch not yet merged. A port taken twice is the worst failure this suite has, because it
 * reads EXACTLY like a caught mutation - exit code 1, a real {@code Tests run:} line, a big
 * number, and not one case actually run. The sign of it is {@code Errors:} equal to
 * {@code Tests run:}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3332",
		"spring.mail.properties.mail.smtp.auth=false"})
@Transactional
class ResultWriteApiTest {

	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3332));

	/** 15.06.2027, and every race in the fixture is months before it. */
	private static final Instant ORDINARY_MOMENT = Instant.parse("2027-06-15T10:00:00Z");

	private static final String FIRST_WRITTEN = "000100";

	private static final String SOMEONE_ELSE = "000200";

	/** The member every case writes with, written third and never first. */
	private static final String ME = "000300";

	private static final String MY_ADDRESS = "vera@primer.rs";

	private static final String SOMEBODY_ELSES_ADDRESS = "bojan@primer.rs";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	/**
	 * FOUR DECIMALS, WHICH IS THE WHOLE OF V31'S FIRST HALF.
	 *
	 * <p>A race measured at 42,2035 km is what {@code race.distance_km} has been able to hold
	 * since V25. Copied into a {@code numeric(6,2)} column it would be stored as 42,20 and the
	 * member's own submission would say a different length from the race he picked - silently,
	 * with no constraint broken. {@link #theLengthOfTheRaceIsKeptToTheDecimalItWasMeasuredIn}
	 * is what holds the widening, and it fails on the old type.
	 */
	private static final BigDecimal MEASURED_EXACTLY = new BigDecimal("42.2035");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	/** Read off the configuration rather than written here, so the address these cases say
	 *  the league is NOT copied at is the one the portal copies it at elsewhere, and not a
	 *  second spelling that a returning copy could miss (the same arrangement
	 *  {@code PostmanTest} makes for the address messages leave from). */
	@Value("${btl.mail.league}")
	private String theLeague;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	private long lengthRace;

	private long timeRace;

	private long freeRace;

	private long futureRace;

	/** The race {@link #myResult} and {@link #somebodyElsesResult} are on: {@link #lengthRace}'s
	 *  twin, so the runs the cases send to {@link #lengthRace} meet no result of mine. */
	private long lengthRaceIRan;

	/** And {@link #myOtherResult}'s, {@link #freeRace}'s twin for the same reason. */
	private long freeRaceIRan;

	/** The result the cases act on: {@link #ME}'s SECOND, on {@link #lengthRaceIRan}. */
	private long myResult;

	/** His first, on another race, so „his result" is never „his only result". */
	private long myOtherResult;

	/** Somebody else's, on the same race and with the same three figures. */
	private long somebodyElsesResult;

	/** {@link #FIRST_WRITTEN}'s, on {@link #timeRace} - the one race kind neither
	 *  {@link #myResult} nor {@link #myOtherResult} stands on, and the one a correction
	 *  used to get wrong in the other direction from a race of a length (finding of
	 *  25.09.2026, PR 365). */
	private long timedResult;

	/** A clock the case moves, the shape {@code CommentWriteApiTest} and
	 *  {@code TeamWriteApiTest} both carry: a boundary in time needs both of its edges asked
	 *  from one fixture, and reporting UTC as its zone is what makes a route reading the
	 *  machine's own zone instead of {@code SeasonClock.ZONE} answer wrongly. */
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

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisCaseUses {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(ORDINARY_MOMENT);
		}
	}

	@BeforeEach
	void threeMembersFourRacesAndFourResults() {
		clock.moveTo(ORDINARY_MOMENT);

		competitor(FIRST_WRITTEN, "Ana", "Prva");
		competitor(SOMEONE_ELSE, "Bojan", "Drugi");
		competitor(ME, "Vera", "Treca");

		account("ana@primer.rs", FIRST_WRITTEN);
		account(SOMEBODY_ELSES_ADDRESS, SOMEONE_ELSE);
		account(MY_ADDRESS, ME);
		moderatorWithNoCompetitor(MODERATOR_WHO_DOES_NOT_RACE);

		/* Four races of three kinds, so „what the race fixes" has a case per kind, and one in
		   the future for the day PDL refuses. Each on its own day, none of them today. */
		lengthRace = race("Dugi maraton", "2027-05-05", "length", 0, MEASURED_EXACTLY, 350, 410);
		timeRace = race("Sest sati", "2027-04-04", "time", 21600, BigDecimal.ZERO, 0, 0);
		freeRace = race("Slobodna trka", "2027-03-03", "free", 0, BigDecimal.ZERO, 0, 0);
		futureRace = race("Buduca trka", "2027-09-09", "length", 0, new BigDecimal("10.00"), 5, 5);

		/* THE RACES MY TWO RESULTS ARE ON ARE NOT THE ONES I SEND RUNS FOR. A run of mine on a race
		   I have a result on is refused at once (PDL P6, 18.10.2026), so the races the cases send to
		   are kept free of my results, and these two carry the same name, day and figures so every
		   letter and every figure a correction reads is what it was. */
		lengthRaceIRan = race("Dugi maraton", "2027-05-05", "length", 0, MEASURED_EXACTLY, 350, 410);
		freeRaceIRan = race("Slobodna trka", "2027-03-03", "free", 0, BigDecimal.ZERO, 0, 0);

		/* Somebody else's first, so the lowest id in `result` is not mine. */
		somebodyElsesResult = ran(SOMEONE_ELSE, lengthRaceIRan, "2027-05-05", "42.20", 350, 410,
				11000, "130.00");
		myOtherResult = ran(ME, freeRaceIRan, "2027-03-03", "12.00", 10, 20, 3000, "45.60");
		myResult = ran(ME, lengthRaceIRan, "2027-05-05", "42.20", 350, 410, 12000, "123.45");
		timedResult = ran(FIRST_WRITTEN, timeRace, "2027-04-04", "63.75", 120, 130, 21600,
				"210.00");

		/* THREE MESSAGES ALREADY IN THE INBOX, and the third is addressed to nobody: V13 says
		   an empty `to_id` means the whole league, so without it „he was told" and „everybody
		   was told" would satisfy one assertion. */
		alreadyInTheInbox(ME, "Stara poruka za mene");
		alreadyInTheInbox(SOMEONE_ELSE, "Stara poruka za njega");
		alreadyInTheInbox(null, "Objava celoj ligi");

		/* A ROW ON ANOTHER TAB AND A RESULTS ROW OF SOMEBODY ELSE'S, so „the results tab" and
		   „the whole queue" are two counts and a statement that lost its queue can be seen. */
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('teams', (select id from competitor where member_number = ?),"
						+ " 'Tim koji ceka', '')")
				.param(FIRST_WRITTEN).update();

		waitingResultOf(SOMEONE_ELSE);
	}

	/*
	 * SENDING ONE IN
	 */

	/**
	 * A RUN ON A RACE THE CALENDAR HOLDS GOES INTO THE QUEUE, AND THE RACE ANSWERS FOR WHAT
	 * IT FIXES.
	 *
	 * <p>PDL, owner, 03.08.2026: „Duzina, uspon i spust se ne unose, nego se uzimaju sa
	 * izabrane trke." The request below sends three figures of its own that are nothing like
	 * the race's, and none of them reaches the row: a route that read them instead would
	 * answer with 1,00 km and this case names them for exactly that reason.
	 */
	@Test
	void aRunOnARaceTheCalendarHoldsTakesItsFiguresOffTheRace() throws Exception {
		MockHttpServletResponse answered = reportedAs(ME, form(Map.of(
				"raceId", lengthRace,
				"distanceKm", "1.00",
				"ascentM", 1,
				"descentM", 1,
				"seconds", 12345,
				"link", "https://rezultati.rs/moja-trka",
				"comment", "  Bilo je vruce.  ")));

		assertThat(answered.getStatus()).isEqualTo(201);

		Map<String, Object> written = theSubmission(idIn(answered));

		assertThat(written)
				.as("the race did not answer for the three figures it measures")
				.containsEntry("race_id", lengthRace)
				.containsEntry("distance_km", MEASURED_EXACTLY)
				.containsEntry("ascent_m", 350)
				.containsEntry("descent_m", 410)
				/* And the one the race does NOT fix is the member's, so this is not simply
				   „everything came off the race". */
				.containsEntry("seconds", 12345)
				.containsEntry("race_date", LocalDate.of(2027, 5, 5))
				/* V66: the race has its event, so the run names none of its own. */
				.containsEntry("event_id", null)
				.containsEntry("event_name", null)
				.containsEntry("link", "https://rezultati.rs/moja-trka")
				.containsEntry("comment", "Bilo je vruce.")
				/* A fresh report corrects nothing (V31). */
				.containsEntry("amends_result_id", null)
				/* A race out of the calendar describes nothing, which is
				   `result_submission_race_is_from_the_calendar_or_described`. */
				.containsEntry("race_name", null);
	}

	/**
	 * THE LENGTH SURVIVES TO THE DECIMAL IT WAS MEASURED IN, WHICH IS V31'S FIRST HALF.
	 *
	 * <p>V25 widened {@code race.distance_km} to {@code numeric(8,4)} and wrote down that the
	 * increment which first WRITES a result has to widen the submission's column with it. On
	 * the old {@code numeric(6,2)} PostgreSQL does not refuse 42,2035 - it ROUNDS it to 42,20
	 * - so this case is the only thing between a member's submission and a length nobody
	 * entered.
	 */
	@Test
	void theLengthOfTheRaceIsKeptToTheDecimalItWasMeasuredIn() throws Exception {
		long submission = idIn(reportedAs(ME, ordinaryReport()));

		assertThat((BigDecimal) theSubmission(submission).get("distance_km"))
				.as("the length was rounded on its way into the row")
				.isEqualByComparingTo(MEASURED_EXACTLY)
				.satisfies(one -> assertThat(one.scale()).isEqualTo(4));
	}

	/** A TIMED RACE ANSWERS FOR THE TIME AND FOR NOTHING ELSE (owner, 29.08.2026: „Na
	 *  vremenskoj trci clan unosi duzinu, uspon i spust. Vreme ne unosi, jer je zadato
	 *  trkom"). */
	@Test
	void aTimedRaceAnswersForTheTimeAndTheMemberForTheRest() throws Exception {
		MockHttpServletResponse answered = reportedAs(ME, form(Map.of(
				"raceId", timeRace,
				"distanceKm", "63.75",
				"ascentM", 120,
				"descentM", 130,
				"seconds", 9,
				"link", "https://rezultati.rs/sest-sati",
				"comment", "")));

		assertThat(theSubmission(idIn(answered)))
				.containsEntry("seconds", 21600)
				.containsEntry("distance_km", new BigDecimal("63.7500"))
				.containsEntry("ascent_m", 120)
				.containsEntry("descent_m", 130);
	}

	/** A FREE RACE FIXES NEITHER, so all four are the member's. */
	@Test
	void aFreeRaceLeavesAllFourToTheMember() throws Exception {
		MockHttpServletResponse answered = reportedAs(ME, form(Map.of(
				"raceId", freeRace,
				"distanceKm", "8.50",
				"ascentM", 60,
				"descentM", 70,
				"seconds", 2700,
				"link", "https://rezultati.rs/slobodna",
				"comment", "")));

		assertThat(theSubmission(idIn(answered)))
				.containsEntry("seconds", 2700)
				.containsEntry("distance_km", new BigDecimal("8.5000"))
				.containsEntry("ascent_m", 60)
				.containsEntry("descent_m", 70);
	}

	/*
	 * THE EVENT A DESCRIBED RUN NAMES (V66; PDL P9, owner, 19.10.2026: „Prvo ima naziv događaja
	 * koji je autocomplete iz baze, ali mogu da unesem novu vrednost", and „Prijava pamti događaj
	 * koji je član izabrao").
	 */

	/** The event of the calendar the race of a length is on, which a member can choose. */
	private long anEventOfTheCalendar() {
		return db.sql("select event_id from race where id = ?").param(lengthRace)
				.query(Long.class).single();
	}

	/**
	 * THE EVENT HE CHOSE IS KEPT BY ITS KEY, and no name beside it: the event has its own, and a
	 * copy would go on saying the old one after a rename.
	 */
	@Test
	void aDescribedRunKeepsTheEventHeChoseByItsKey() throws Exception {
		MockHttpServletResponse answered = reportedAs(ME, form(onAChosenEvent()));

		assertThat(answered.getStatus()).isEqualTo(201);
		assertThat(theSubmission(idIn(answered)))
				.containsEntry("event_id", anEventOfTheCalendar())
				.containsEntry("event_name", null)
				.containsEntry("race_name", "Opisana trka")
				/* V67: the town of a run on a chosen event is the event's and lives only there. */
				.containsEntry("place_id", null)
				.containsEntry("city", null)
				.containsEntry("country_id", null);
	}

	/** The described run, on the event of the calendar chosen by its key and with no town of its own. */
	private Map<String, Object> onAChosenEvent() {
		Map<String, Object> fields = aDescribedRun();

		fields.remove("eventName");
		fields.remove("placeId");
		fields.put("eventId", anEventOfTheCalendar());

		return fields;
	}

	/**
	 * A TOWN BESIDE AN EVENT HE CHOSE IS REFUSED, EACH OF ITS THREE FIELDS, and not dropped: the event
	 * brings its own (V67, `result_submission_a_chosen_event_brings_its_town`), so a town beside it is a
	 * second answer, and dropped it would tell him his town was kept. One row per field, because a
	 * guard reading only the first would let the other two through to the table as a server fault.
	 */
	@ParameterizedTest(name = "{0}")
	@CsvSource(delimiter = '|', value = {
			"placeId | codebook",
			"city    | Zaselak",
			"country | RS"})
	void aTownBesideAChosenEventIsRefused(String field, String value) throws Exception {
		Map<String, Object> fields = onAChosenEvent();

		fields.put(field, "codebook".equals(value) ? aTownFromTheCodebook() : value);

		assertThat(reasonIn(reportedAs(ME, form(fields))))
				.as("a town in %s beside a chosen event was taken", field)
				.isEqualTo(ResultWriteApi.THE_RACE_IS_NAMED_TWICE);
		assertThat(howManySubmissions()).isZero();
	}

	/** THE NAME HE TYPED IS KEPT AS HE TYPED IT, stripped, where the calendar has no such event. */
	@Test
	void aDescribedRunKeepsTheEventHeTyped() throws Exception {
		Map<String, Object> fields = aDescribedRun();

		fields.put("eventName", "  Kros kroz sumu  ");

		MockHttpServletResponse answered = reportedAs(ME, form(fields));

		assertThat(answered.getStatus()).isEqualTo(201);
		assertThat(theSubmission(idIn(answered)))
				.containsEntry("event_id", null)
				.containsEntry("event_name", "Kros kroz sumu");
	}

	/**
	 * CHOSEN AND TYPED AT ONCE IS TWO EVENTS, which V66 holds the row to never be
	 * ({@code result_submission_event_is_chosen_or_typed}): refused before the row, so it reaches the
	 * member as an answer and not as a server fault.
	 */
	@Test
	void anEventChosenAndTypedAtOnceIsRefused() throws Exception {
		Map<String, Object> fields = aDescribedRun();

		fields.put("eventId", anEventOfTheCalendar());
		fields.put("eventName", "Kros kroz sumu");

		assertThat(reasonIn(reportedAs(ME, form(fields))))
				.isEqualTo(ResultWriteApi.THE_RACE_IS_NAMED_TWICE);
		assertThat(howManySubmissions()).isZero();
	}

	/**
	 * A DESCRIBED RUN THAT NAMES NO EVENT IS A FORM NOT FILLED IN, AND A KEY NO EVENT ANSWERS TO IS A
	 * RACE THAT IS NOT KNOWN.
	 *
	 * <p>The first is the owner's form, which asks for the event first (PDL P9, 19.10.2026), required on
	 * this road by the coordinator's derivation from it: neither key nor name, and a name of nothing but
	 * spaces, are one state. The second was kept as „no event" until V67, beside the town such a run
	 * carried; a run on a chosen event carries none now, so kept that way it would name nothing at all.
	 * The spaces beside a gone key are still not a second event, so that row is the key's refusal and not
	 * the twice-named one.
	 */
	@ParameterizedTest(name = "{0}")
	@CsvSource(delimiter = '|', value = {
			"no event at all               | <out> |           | theFormIsNotComplete",
			"a name of spaces              | '   ' |           | theFormIsNotComplete",
			"a key no event answers to     | <out> | 999999999 | theRaceIsNotKnown",
			"spaces beside a key gone      | '   ' | 999999999 | theRaceIsNotKnown"})
	void anEventThatIsNotThereIsRefused(String what, String name, Long key, String reason)
			throws Exception {
		Map<String, Object> fields = aDescribedRun();

		fields.remove("eventName");

		if (!"<out>".equals(name)) {
			fields.put("eventName", name);
		}

		if (key != null) {
			fields.put("eventId", key);
			fields.remove("placeId");
		}

		assertThat(reasonIn(reportedAs(ME, form(fields)))).as(what).isEqualTo(reason);
		assertThat(howManySubmissions()).as(what).isZero();
	}

	/**
	 * A RACE THE CALENDAR DOES NOT HOLD IS DESCRIBED, AND EVERY COLUMN AN APPROVAL WILL NEED
	 * IS COLLECTED.
	 *
	 * <p>PDL: „Clan sme da unese trku koje nema u kalendaru. Tada administrator kreira
	 * dogadjaj i trku uz rezultat, i sve troje nastaje istovremeno."
	 */
	@Test
	void aRaceTheCalendarDoesNotHoldIsDescribedInFull() throws Exception {
		MockHttpServletResponse answered = reportedAs(ME, form(withAnEvent(Map.of(
				"raceName", "  Trka kroz sumu  ",
				"day", "2027-02-02",
				"raceKind", "free",
				"placeId", aTownFromTheCodebook(),
				"distanceKm", "21.0975",
				"ascentM", 300,
				"descentM", 280,
				"seconds", 7200,
				"link", "https://rezultati.rs/kroz-sumu",
				"comment", "Blatnjavo"))));

		assertThat(answered.getStatus()).isEqualTo(201);

		assertThat(theSubmission(idIn(answered)))
				.containsEntry("race_id", null)
				.containsEntry("race_name", "Trka kroz sumu")
				.containsEntry("race_kind", "free")
				.containsEntry("race_date", LocalDate.of(2027, 2, 2))
				.containsEntry("city", null)
				/* On an event he typed, which keeps its own town (V67 takes the town away only
				   from a run on an event he CHOSE). */
				.containsEntry("event_id", null)
				.containsEntry("event_name", AN_EVENT_HE_TYPED)
				/* 21,0975 is the true half marathon, and PDL P5 says in as many words that it
				   must NOT come out as one. Kept to four decimals it is stored as typed; at two
				   it would be 21,10, which the portal calls a half. */
				.containsEntry("distance_km", new BigDecimal("21.0975"));
	}

	/**
	 * A TOWN TYPED BY HAND NAMES ITS COUNTRY, AND THE COUNTRY IS A CODE THAT IS RESOLVED.
	 *
	 * <p>{@code result_submission_typed_town_names_its_country} asked before the row rather
	 * than after it, and {@link CountryApi} serves {@code code} and never {@code id}, so what
	 * arrives is „RS" and what is written is the row it names.
	 */
	@Test
	void aTownTypedByHandComesWithItsCountryAndTheCodeIsResolved() throws Exception {
		Map<String, Object> described = new HashMap<>(Map.of(
				"raceName", "Trka na Zlatiboru",
				"day", "2027-02-02",
				"raceKind", "free",
				"city", "Zaselak",
				"country", aCountryCode(),
				"distanceKm", "15.00",
				"ascentM", 0,
				"descentM", 0,
				"seconds", 3600,
				"link", "https://rezultati.rs/zlatibor"));

		described.put("eventName", AN_EVENT_HE_TYPED);

		assertThat(theSubmission(idIn(reportedAs(ME, form(described)))))
				.containsEntry("city", "Zaselak")
				.containsEntry("place_id", null)
				.containsEntry("country_id", theKeyOfTheCountry());

		described.remove("country");

		assertThat(reasonIn(reportedAs(ME, form(described))))
				.as("a town typed with no country was taken")
				.isEqualTo(EventWriteApi.A_TYPED_TOWN_NAMES_ITS_COUNTRY);

		described.put("country", "NEMA");

		assertThat(reasonIn(reportedAs(ME, form(described))))
				.as("a country the codebook does not hold was taken")
				.isEqualTo(EventWriteApi.THE_COUNTRY_IS_NOT_KNOWN);
	}

	/**
	 * A TOWN TYPED BY HAND IS HELD TO THE BOX IT IS TYPED INTO: ONE THAT FILLS IT IS TAKEN, ONE
	 * CHARACTER MORE IS REFUSED BY NAME, AND NOTHING OF IT IS WRITTEN.
	 *
	 * <p>The owner, 10.10.2026: „Stavi samo validaciju "Predugačak naziv grada"." Both sides of
	 * the boundary, so a limit moved one way or the other is a different answer; and counted the
	 * way the box counts, in code units, so a town of letters outside the first plane (two units
	 * each) is held to the same eighty units and not to eighty letters. Spaces at its end do not
	 * count, because they are not stored.
	 */
	@Test
	void aTownTypedByHandIsHeldToTheBoxItIsTypedInto() throws Exception {
		Map<String, Object> described = aDescribedRun();

		described.remove("placeId");
		described.put("country", aCountryCode());

		for (String fills : List.of("a".repeat(80), "a".repeat(80) + "   ", "𝔸".repeat(40))) {
			described.put("city", fills);

			assertThat(reportedAs(ME, form(described)).getStatus())
					.as("a town that fills its box was refused (%d units)", fills.length())
					.isEqualTo(201);
		}

		long before = howManySubmissions();

		for (String over : List.of("a".repeat(81), "𝔸".repeat(40) + "a")) {
			described.put("city", over);

			assertThat(reasonIn(reportedAs(ME, form(described))))
					.as("a town longer than its box was taken (%d units)", over.length())
					.isEqualTo(ResultWriteApi.THE_TOWN_IS_TOO_LONG);
		}

		assertThat(howManySubmissions()).as("a refused town was written down anyway").isEqualTo(before);
	}

	/**
	 * A TOWN TYPED BY HAND THAT HOLDS A CHARACTER NOBODY SEES IS REFUSED BY NAME: one that turns
	 * the direction of writing, and the rest of Unicode's control and format characters.
	 *
	 * <p>The owner's answer of 10.10.2026 asks a limit of „znakova" on the server as well as of
	 * length. One case per character the security review and the portal's own address rule found
	 * doing harm (`data/outsideLink.ts`), each inside an ordinary town, and an ordinary town with a
	 * hyphen, an apostrophe and letters of three scripts that is taken, so a rule that refused more
	 * than the two categories is a different answer too.
	 */
	@ParameterizedTest
	@CsvSource({ "202E", "200B", "200E", "2066", "00AD", "0009", "000A", "0085" })
	void aTownTypedByHandThatHoldsACharacterNobodySeesIsRefused(String code) throws Exception {
		Map<String, Object> described = aDescribedRun();

		described.remove("placeId");
		described.put("country", aCountryCode());
		described.put("city", "Bela" + Character.toString(Integer.parseInt(code, 16)) + "Palanka");

		long before = howManySubmissions();

		assertThat(reasonIn(reportedAs(ME, form(described))))
				.as("a town holding U+%s was taken", code)
				.isEqualTo(ResultWriteApi.THE_TOWN_HOLDS_AN_INVISIBLE_CHARACTER);
		assertThat(howManySubmissions()).isEqualTo(before);

		described.put("city", "Sremska Mitrovica-Laćarak d'Ivoire Шабац");

		assertThat(reportedAs(ME, form(described)).getStatus())
				.as("an ordinary town was refused for its letters")
				.isEqualTo(201);
	}

	/**
	 * THE LIMIT IS THE ONE THE MEMBER'S OWN BOX CARRIES, read off the form and not written twice:
	 * the arrangement {@code MeWriteApiTest} has with the biography's box. The day the box moves,
	 * the build stops until the server moves with it.
	 */
	@Test
	void theLimitOfATownTypedByHandIsTheOneItsBoxCarries() throws Exception {
		JsonNode theBox = null;

		for (JsonNode field : mapper.readTree(Files.readString(Path.of("..", "frontend", "src", "forms",
				"definitions", "unos-rezultata.form.json"))).path("fields")) {
			if ("city".equals(field.path("name").asString())) {
				theBox = field;
			}
		}

		assertThat(theBox).as("unos-rezultata.form.json has no field called city at all").isNotNull();
		assertThat(theBox.path("maxLength").asInt())
				.as("the box the member types a town into and the number this server refuses him by"
						+ " are two different numbers")
				.isEqualTo(ResultWriteApi.A_TYPED_TOWN_HOLDS_AT_MOST);
	}

	/**
	 * A TOWN OUT OF THE CODEBOOK IS NAMED BY ITS MARK AND WRITTEN DOWN BY ITS KEY.
	 *
	 * <p>This route's own half of what {@code EveryRouteFindsATownByItsMarkTest} asks of every
	 * route that takes a town. Both halves are here on purpose: the mark and the key of the
	 * town this fixture picks are asserted to DIFFER, so a route that wrote the arriving
	 * number down unchanged fails on the value and not merely on a foreign key.
	 */
	@Test
	void aTownOutOfTheCodebookArrivesAsAMarkAndIsWrittenDownAsAKey() throws Exception {
		long mark = aTownFromTheCodebook();

		assertThat(mark)
				.as("this fixture picked a town whose mark and key are one number, so it cannot"
						+ " tell a route that resolves from one that does not")
				.isNotEqualTo(theKeyOf(mark));

		Map<String, Object> described = aDescribedRun();

		assertThat(theSubmission(idIn(reportedAs(ME, form(described)))))
				.containsEntry("place_id", theKeyOf(mark))
				.containsEntry("city", null)
				.containsEntry("country_id", null);
	}

	/** AND A MARK THE CODEBOOK DOES NOT HOLD IS AN ANSWER RATHER THAN A FOREIGN KEY FAULT. */
	@Test
	void aTownTheCodebookDoesNotHoldIsAnAnswerAndNotAServerFault() throws Exception {
		Map<String, Object> described = aDescribedRun();

		described.put("placeId", 1L + db.sql("select max(geonames_id) from place")
				.query(Long.class).single());

		assertThat(reasonIn(reportedAs(ME, form(described))))
				.isEqualTo(EventWriteApi.THE_TOWN_IS_NOT_KNOWN);
	}

	/** AND A COUNTRY BESIDE A CODEBOOK TOWN IS REFUSED RATHER THAN DROPPED, which is
	 *  {@link EventWriteApi}'s own reasoning: the codebook already answers for it, so taking
	 *  the field and ignoring it would tell the member his choice was kept. */
	@Test
	void aCountryBesideACodebookTownIsRefusedRatherThanDropped() throws Exception {
		Map<String, Object> described = aDescribedRun();

		described.put("country", aCountryCode());

		assertThat(reasonIn(reportedAs(ME, form(described))))
				.isEqualTo(EventWriteApi.THE_COUNTRY_BELONGS_TO_A_TYPED_TOWN);
	}

	/** THE QUEUE ROW IS WHAT CARRIES IT TO A MODERATOR, and it stands in the results tab and
	 *  points at the submission ({@code verification_only_the_results_queue_carries_a_submission}). */
	@Test
	void theRunWaitsInTheResultsTabAndTheRowPointsAtIt() throws Exception {
		long submission = idIn(reportedAs(ME, ordinaryReport()));

		assertThat(db.sql("select v.queue, v.state, v.subject, v.body, c.member_number"
						+ " from verification v join competitor c on c.id = v.competitor_id"
						+ " where v.result_submission_id = ?")
				.param(submission)
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getString(3),
						row.getString(4), row.getString(5)))
				.single())
				.as("the queue row did not describe the run that was sent in")
				.containsExactly("results", "waiting", "Dugi maraton", "Bilo je vruce.", ME);
	}

	/*
	 * WHAT IS REFUSED
	 */

	/** PDL, owner, 11.08.2026: „Ne sme, ne moze biti rezultata u buducnosti." */
	/**
	 * A RUN OF A SEASON THAT IS NOT OPEN IS REFUSED ON BOTH ROADS, AND THE YEAR JUST ENDED STAYS OPEN UNTIL
	 * TEN ON NEW YEAR'S MORNING IN THE LEAGUE'S HOUR.
	 *
	 * <p>PDL P9, owner, 19.10.2026: „Član prijavljuje samo rezultate aktuelne sezone", „Tih 10 sati sluzi
	 * samo da onaj ko je recimo poceo trku minut pre ponoci ima vremena da unese rezultat pre
	 * zamrzavanja sezone", and „NIŠTA! NE POSTOJI LIGA PRE 2027 GODINE". <b>The pair is written in
	 * UTC</b>, so the instant that is ten in Belgrade is nine on the clock, and a route that read the hour
	 * in the server's zone moves the edge by an hour. A run of New Year's Eve is sent on both roads at
	 * 09:59:59 in Belgrade and refused on both at ten.
	 */
	@Test
	void aRunOfASeasonThatIsNotOpenIsRefusedOnBothRoads() throws Exception {
		long newYearsEve = race("Silvestarska", "2027-12-31", "length", 0, new BigDecimal("5.00"), 0, 0);
		Map<String, Object> described = aDescribedRun();

		described.put("day", "2027-12-31");

		clock.moveTo(Instant.parse("2028-01-01T08:59:59Z"));

		assertThat(reportedAs(ME, form(Map.of("raceId", newYearsEve, "seconds", 1500,
				"link", "https://rezultati.rs/silvestarska"))).getStatus())
				.as("a run of New Year's Eve was refused at 09:59:59 in Belgrade, from the calendar")
				.isEqualTo(201);
		assertThat(reportedAs(ME, form(described)).getStatus())
				.as("and described").isEqualTo(201);

		clock.moveTo(Instant.parse("2028-01-01T09:00:00Z"));

		assertThat(reasonIn(reportedAs(ME, form(Map.of("raceId", newYearsEve, "seconds", 1500,
				"link", "https://rezultati.rs/silvestarska-kasno")))))
				.as("a run of the year just ended went in at ten in Belgrade, from the calendar")
				.isEqualTo(ResultWriteApi.THE_RACE_IS_OUTSIDE_THE_SEASON);
		assertThat(reasonIn(reportedAs(ME, form(described))))
				.as("and described").isEqualTo(ResultWriteApi.THE_RACE_IS_OUTSIDE_THE_SEASON);
		assertThat(howManySubmissions()).isEqualTo(2L);
	}

	/**
	 * AND NOTHING BEFORE THE LEAGUE: in the autumn of 2026 a run of 2026 is refused on both roads,
	 * although it is a run of the year he is in.
	 */
	@Test
	void aRunBeforeTheLeagueIsRefusedOnBothRoads() throws Exception {
		long ofTwentySix = race("Jesenja 2026", "2026-10-01", "length", 0, new BigDecimal("5.00"), 0, 0);
		Map<String, Object> described = aDescribedRun();

		described.put("day", "2026-10-01");
		clock.moveTo(Instant.parse("2026-10-19T10:00:00Z"));

		assertThat(reasonIn(reportedAs(ME, form(Map.of("raceId", ofTwentySix, "seconds", 1500,
				"link", "https://rezultati.rs/jesenja")))))
				.isEqualTo(ResultWriteApi.THE_RACE_IS_OUTSIDE_THE_SEASON);
		assertThat(reasonIn(reportedAs(ME, form(described))))
				.isEqualTo(ResultWriteApi.THE_RACE_IS_OUTSIDE_THE_SEASON);
		assertThat(howManySubmissions()).isZero();
	}

	/**
	 * AND A RACE OF NEXT YEAR keeps the sentence that it has not been run: the truer of the two, and the
	 * one it is asked first ({@code ResultWriteApi.THE_RACE_IS_OUTSIDE_THE_SEASON} says why).
	 */
	@Test
	void aRaceOfNextYearIsARaceNotRunYet() throws Exception {
		long nextYear = race("Sledece godine", "2028-03-03", "length", 0, new BigDecimal("5.00"), 0, 0);

		assertThat(reasonIn(reportedAs(ME, form(Map.of("raceId", nextYear, "seconds", 1500,
				"link", "https://rezultati.rs/sledece")))))
				.isEqualTo(ResultWriteApi.THE_RACE_HAS_NOT_BEEN_RUN);
	}

	@Test
	void aRaceStillToBeRunIsRefusedOnBothRoads() throws Exception {
		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceId", futureRace,
				"seconds", 3600,
				"link", "https://rezultati.rs/buduca")))))
				.isEqualTo(ResultWriteApi.THE_RACE_HAS_NOT_BEEN_RUN);

		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceName", "Sutrasnja",
				"eventName", AN_EVENT_HE_TYPED,
				"day", "2027-06-16",
				"raceKind", "free",
				"placeId", aTownFromTheCodebook(),
				"distanceKm", "10.00",
				"ascentM", 0,
				"descentM", 0,
				"seconds", 3600,
				"link", "https://rezultati.rs/sutra")))))
				.isEqualTo(ResultWriteApi.THE_RACE_HAS_NOT_BEEN_RUN);

		assertThat(howManySubmissions()).isZero();
	}

	/**
	 * THE DAY OF THE RACE ITSELF COUNTS AS RUN, and this is the other edge of the same
	 * boundary.
	 *
	 * <p>Asked by moving the clock rather than by adding a race, so the two edges come out of
	 * one fixture: a route written with {@code isBefore} instead of {@code isAfter} refuses a
	 * race run this very morning, and nothing above would have seen it.
	 */
	@Test
	void aRaceRunThisVeryMorningIsStillARaceThatHasBeenRun() throws Exception {
		clock.moveTo(Instant.parse("2027-09-09T06:00:00Z"));

		assertThat(reportedAs(ME, form(Map.of(
				"raceId", futureRace,
				"seconds", 3600,
				"link", "https://rezultati.rs/danas"))).getStatus())
				.as("a race run this morning was called a race in the future")
				.isEqualTo(201);
	}

	/**
	 * A RUN ON A RACE HE ALREADY HAS A RESULT ON IS REFUSED AT ONCE, AND NOTHING IS WRITTEN.
	 *
	 * <p>PDL P6, 18.10.2026, the owner choosing among the outcomes offered: „Članova prijava za trku
	 * na kojoj već ima rezultat se odbija odmah". {@link #lengthRaceIRan} holds {@link #myResult}, and
	 * {@link #somebodyElsesResult} too, so the refusal is about MY result and the other member's on the
	 * same race is beside it. Nothing reaches the queue or the inbox.
	 */
	@Test
	void aRunOnARaceHeAlreadyHasAResultOnIsRefusedAtOnceAndNothingIsWritten() throws Exception {
		long queued = db.sql("select count(*) from verification").query(Long.class).single();
		long told = db.sql("select count(*) from message").query(Long.class).single();

		MockHttpServletResponse refused = reportedAs(ME, form(Map.of(
				"raceId", lengthRaceIRan,
				"seconds", 11000,
				"link", "https://rezultati.rs/opet")));

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(reasonIn(refused)).isEqualTo(ResultWriteApi.HE_HAS_A_RESULT_ON_THIS_RACE);
		assertThat(howManySubmissions()).isZero();
		assertThat(db.sql("select count(*) from verification").query(Long.class).single())
				.isEqualTo(queued);
		assertThat(db.sql("select count(*) from message").query(Long.class).single())
				.isEqualTo(told);
	}

	/**
	 * AND THE THREE THINGS THAT ARE NOT HIS RESULT ON THAT RACE REFUSE NOTHING: another member's
	 * result on it, his result on another race of the same event and the same morning, and a run of
	 * his on it that was refused or still waits.
	 *
	 * <p>The first is {@link #timeRace}, where {@link #FIRST_WRITTEN} has a result and I have none.
	 * The second is PDL P6, 09.09.2026, „ali sme imati više rezultata na istom događaju": a second race
	 * of the event {@link #lengthRaceIRan} stands in, on its day. The third is the other half of the
	 * decision of 18.10.2026, „Prijava koja je bila odbijena pa ponovo poslata ostaje dozvoljena": the
	 * question is asked of {@code result} and never of {@code result_submission}, so a run he sent and
	 * had refused, and the run he sent again that is now waiting, leave the race open to him.
	 */
	@Test
	void aRunIsRefusedOnlyByHisOwnResultOnThatVeryRace() throws Exception {
		assertThat(reportedAs(ME, form(Map.of(
				"raceId", timeRace,
				"distanceKm", "60.00",
				"ascentM", 100,
				"descentM", 100,
				"link", "https://rezultati.rs/tudja-trka"))).getStatus())
				.as("another member's result on the race refused my run")
				.isEqualTo(201);

		long theHalf = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) select event_id, 'Polumaraton', false, date,"
						+ " 'length', 0, 21.0975, 100, 100 from race where id = ? returning id")
				.param(lengthRaceIRan).query(Long.class).single();

		assertThat(reportedAs(ME, form(Map.of(
				"raceId", theHalf,
				"seconds", 6000,
				"link", "https://rezultati.rs/polumaraton"))).getStatus())
				.as("my result on another race of the same event and the same day refused my run")
				.isEqualTo(201);

		long refusedOnce = idIn(reportedAs(ME, form(Map.of(
				"raceId", lengthRace,
				"seconds", 13000,
				"link", "https://rezultati.rs/prvi-put"))));

		db.sql("update verification set state = 'rejected', decided_at = now(),"
						+ " decided_by_name = 'Moderator Probni', reason = 'Pogresan link'"
						+ " where result_submission_id = ?")
				.param(refusedOnce).update();

		assertThat(reportedAs(ME, form(Map.of(
				"raceId", lengthRace,
				"seconds", 12900,
				"link", "https://rezultati.rs/drugi-put"))).getStatus())
				.as("a run of mine that was refused refused the run sent again")
				.isEqualTo(201);
		assertThat(reportedAs(ME, form(Map.of(
				"raceId", lengthRace,
				"seconds", 12800,
				"link", "https://rezultati.rs/treci-put"))).getStatus())
				.as("a run of mine that waits refused the next one")
				.isEqualTo(201);
	}

	/** NOTHING SHOWS THE RUN HAPPENED, which is {@link ProofThatTheRunHappened}'s own
	 *  sentence and the one refusal the forms already make. */
	@Test
	void aRunWithNoProofAtAllIsRefused() throws Exception {
		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceId", lengthRace,
				"seconds", 3600,
				"comment", "Sat mi je stao")))))
				.isEqualTo(ResultWriteApi.WHY_NOT.get(Outcome.NOTHING_SHOWS_IT_HAPPENED));

		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceId", lengthRace,
				"seconds", 3600,
				"link", "nije adresa")))))
				.isEqualTo(ResultWriteApi.WHY_NOT.get(Outcome.A_LINK_THAT_IS_NOT_A_LINK));

		assertThat(howManySubmissions()).isZero();
	}

	/**
	 * EVERY REASON A RUN CAN BE REFUSED FOR HAS A WORD FOR IT, and the list is asked of the
	 * ENUM rather than written here.
	 *
	 * <p>This is the floor under {@code ResultWriteApi.WHY_NOT}, which is a written list: a
	 * fourth outcome added to {@link ProofThatTheRunHappened} would otherwise answer
	 * {@code null} to a member, and nothing would say so until somebody read the response.
	 */
	@Test
	void everyReasonARunCanBeRefusedForHasAWordForIt() {
		assertThat(ResultWriteApi.WHY_NOT.keySet())
				.as("an outcome of the proof rule has no word to answer a member with")
				.containsExactlyInAnyOrderElementsOf(
						EnumSet.complementOf(EnumSet.of(Outcome.GOOD)));

		assertThat(ResultWriteApi.WHY_NOT.values()).doesNotHaveDuplicates();
	}

	/**
	 * EVERY FIELD THAT DESCRIBES A RACE IS ONE TOO MANY BESIDE A RACE OUT OF THE CALENDAR.
	 *
	 * <p>A request that both picks a race and describes one is two answers to one question,
	 * and V10's biconditional means there is no row that could be written from it.
	 *
	 * <p><b>One row per field rather than one case naming the name alone.</b> The
	 * biconditional is about all five together, and a guard reading only the first of them
	 * would let through a request that names a race AND a town - which is a row the table
	 * refuses as a server fault.
	 */
	@ParameterizedTest(name = "{0}")
	@CsvSource(delimiter = '|', value = {
			"raceName | Ipak druga trka",
			"raceKind | free",
			"placeId  | 1",
			"city     | Zaselak",
			"country  | RS",
			/* V66: the event is the race's, so naming one beside it is the same request. */
			"eventId  | 1",
			"eventName| Neki dogadjaj"})
	void everyFieldThatDescribesARaceIsRefusedBesideOneFromTheCalendar(String field, String value)
			throws Exception {
		Map<String, Object> fields = new HashMap<>();

		fields.put("raceId", lengthRace);
		fields.put("seconds", 3600);
		fields.put("link", "https://rezultati.rs/dva-puta");
		fields.put(field, value);

		assertThat(reasonIn(reportedAs(ME, form(fields))))
				.as("a run naming a race and describing one by %s was taken", field)
				.isEqualTo(ResultWriteApi.THE_RACE_IS_NAMED_TWICE);

		assertThat(howManySubmissions()).isZero();
	}

	/**
	 * EVERY WAY A DESCRIBED RUN CAN FAIL TO HOLD TOGETHER, ONE ROW PER CONDITION.
	 *
	 * <p>Each row takes the one request that works and breaks exactly one thing about it, so
	 * what is measured is that CONDITION and not the shape of the request: a guard that
	 * stopped reading the climb would go on passing every other row.
	 *
	 * <p><b>Every one of them is a {@code check} the table would fire on</b>, and firing there
	 * reaches the member as a 500 rather than as an answer, which is why they are asked before
	 * the row and not left to the database: {@code result_submission_race_name_not_blank},
	 * {@code ..._described_race_says_its_kind}, {@code ..._race_kind_known},
	 * {@code ..._distance_positive}, {@code ..._ascent_not_negative},
	 * {@code ..._descent_not_negative} and {@code ..._seconds_positive}.
	 *
	 * <p>{@code <out>} means the field is not in the request at all, which is not the same
	 * thing as sending it empty and is what a form really does with a box nobody filled in.
	 */
	@ParameterizedTest(name = "{0} = {1}")
	@CsvSource(delimiter = '|', value = {
			"raceName   | <out>    ",
			"raceName   | '   '    ",
			"day        | <out>    ",
			"raceKind   | <out>    ",
			"raceKind   | brdska   ",
			"distanceKm | <out>    ",
			"distanceKm | 0        ",
			"distanceKm | 99999.00 ",
			"distanceKm | 1.00001  ",
			"ascentM    | <out>    ",
			"ascentM    | -1       ",
			"descentM   | <out>    ",
			"descentM   | -1       ",
			"seconds    | <out>    ",
			"seconds    | 0        "})
	void everyWayADescribedRunCanFailToHoldTogether(String field, String value) throws Exception {
		Map<String, Object> fields = aDescribedRun();

		if ("<out>".equals(value)) {
			fields.remove(field);
		} else {
			fields.put(field, value);
		}

		assertThat(reasonIn(reportedAs(ME, form(fields))))
				.as("a described run with %s = %s was taken", field, value)
				.isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);

		assertThat(howManySubmissions()).isZero();
	}

	/** A TOWN IS THE CODEBOOK OR IT IS TYPED, NEVER BOTH AND NEVER NEITHER, which is
	 *  {@code result_submission_town_is_from_the_codebook_or_typed} and
	 *  {@code ..._described_race_names_its_town} in one sentence. */
	@ParameterizedTest(name = "{0}")
	@CsvSource(delimiter = '|', value = {"both", "neither"})
	void aTownIsSaidExactlyOnce(String how) throws Exception {
		Map<String, Object> fields = aDescribedRun();

		if ("both".equals(how)) {
			fields.put("city", "Zaselak");
			fields.put("country", aCountryCode());
		} else {
			fields.remove("placeId");
		}

		assertThat(reasonIn(reportedAs(ME, form(fields))))
				.as("a run naming its town %s was taken", how)
				.isEqualTo(EventWriteApi.THE_TOWN_IS_NOT_SAID_ONCE);
	}

	/**
	 * AND THE SAME FOUR FIGURES ARE JUDGED ON A RACE THAT FIXES NONE OF THEM.
	 *
	 * <p>A free race is the one kind where all four come from the member, so it is the only
	 * road on which each of the four can be wrong: on a race of a length three of them are the
	 * race's own and cannot be.
	 */
	@ParameterizedTest(name = "{0} = {1}")
	@CsvSource(delimiter = '|', value = {
			"distanceKm | <out>    ",
			"distanceKm | 0        ",
			"distanceKm | 99999.00 ",
			"distanceKm | 1.00001  ",
			"ascentM    | <out>    ",
			"ascentM    | -1       ",
			"descentM   | <out>    ",
			"descentM   | -1       ",
			"seconds    | <out>    "})
	void everyWayARunOnAFreeRaceCanFailToHoldTogether(String field, String value) throws Exception {
		Map<String, Object> fields = new HashMap<>();

		fields.put("raceId", freeRace);
		fields.put("distanceKm", "8.50");
		fields.put("ascentM", 60);
		fields.put("descentM", 70);
		fields.put("seconds", 2700);
		fields.put("link", "https://rezultati.rs/slobodna");

		if ("<out>".equals(value)) {
			fields.remove(field);
		} else {
			fields.put(field, value);
		}

		assertThat(reasonIn(reportedAs(ME, form(fields))))
				.as("a run on a free race with %s = %s was taken", field, value)
				.isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);
	}

	/** AND ON A CORRECTION OF A RESULT ON A RACE THAT FIXES NOTHING, where all four stay
	 *  the member's exactly as they do on a fresh report of the same kind
	 *  ({@link #everyWayARunOnAFreeRaceCanFailToHoldTogether}), so each of the four is
	 *  judged there too. A correction of a race that fixes something is a different case:
	 *  what the race fixes there is never even asked of the request, so sending it broken
	 *  is not refused - it is ignored
	 *  ({@link #aCorrectionOnARaceOfALengthTakesTheLengthTheClimbAndTheFallOffTheRaceToo},
	 *  {@link #aCorrectionOnATimedRaceTakesTheTimeOffTheRaceAndTheRestFromTheMember}). */
	@ParameterizedTest(name = "{0} = {1}")
	@CsvSource(delimiter = '|', value = {
			"distanceKm | <out>   ",
			"distanceKm | 0       ",
			"distanceKm | 1.00001 ",
			"ascentM    | <out>   ",
			"ascentM    | -1      ",
			"descentM   | -1      ",
			"seconds    | 0       "})
	void everyWayACorrectionOnAFreeRaceCanFailToHoldTogether(String field, String value)
			throws Exception {
		Map<String, Object> fields = new HashMap<>();

		fields.put("distanceKm", "12.00");
		fields.put("ascentM", 10);
		fields.put("descentM", 20);
		fields.put("seconds", 3000);
		fields.put("link", "https://rezultati.rs/ispravka-slobodne");

		if ("<out>".equals(value)) {
			fields.remove(field);
		} else {
			fields.put(field, value);
		}

		assertThat(reasonIn(correctedAs(ME, myOtherResult, form(fields))))
				.as("a correction on a free race with %s = %s was taken", field, value)
				.isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);

		assertThat(secondsOf(myOtherResult))
				.as("a refused correction moved the result all the same")
				.isEqualTo(3000);
	}

	/** The event a described run names where a case does not care which (PDL P9, 19.10.2026: the
	 *  member's form asks for the event first, and the route requires one of the two ways). */
	private static final String AN_EVENT_HE_TYPED = "Opisani dogadjaj";

	/** A described form written inline, with the event every described run now names added to it:
	 *  `Map.of` takes ten pairs, and the forms that need it already carry ten. */
	private static Map<String, Object> withAnEvent(Map<String, Object> described) {
		Map<String, Object> fields = new HashMap<>(described);

		fields.put("eventName", AN_EVENT_HE_TYPED);

		return fields;
	}

	/** The one described request that works, for a case to break one thing about. */
	private Map<String, Object> aDescribedRun() {
		Map<String, Object> fields = new HashMap<>();

		fields.put("eventName", AN_EVENT_HE_TYPED);

		fields.put("raceName", "Opisana trka");
		fields.put("day", "2027-02-02");
		fields.put("raceKind", "free");
		fields.put("placeId", aTownFromTheCodebook());
		fields.put("distanceKm", "12.00");
		fields.put("ascentM", 100);
		fields.put("descentM", 90);
		fields.put("seconds", 3600);
		fields.put("link", "https://rezultati.rs/opisana");

		return fields;
	}

	@Test
	void aRaceIdThatNamesNothingIsAnAnswerAndNotAServerFault() throws Exception {
		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceId", futureRace + 1000,
				"seconds", 3600,
				"link", "https://rezultati.rs/nepoznata")))))
				.isEqualTo(ResultWriteApi.THE_RACE_IS_NOT_KNOWN);
	}

	/**
	 * A TIME OF NOUGHT IS NOT A RUN, AND A CLIMB OF NOUGHT IS A FLAT RACE.
	 *
	 * <p>Two constraints that read alike and are not the same rule
	 * ({@code result_submission_seconds_positive} against
	 * {@code result_submission_ascent_not_negative}), so one guard written for both would
	 * either refuse every flat race or write a row the table throws out as a 500.
	 */
	@Test
	void noughtSecondsIsRefusedAndNoughtMetresOfClimbIsNot() throws Exception {
		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceId", freeRace,
				"distanceKm", "8.50",
				"ascentM", 0,
				"descentM", 0,
				"seconds", 0,
				"link", "https://rezultati.rs/nula")))))
				.isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);

		assertThat(reportedAs(ME, form(Map.of(
				"raceId", freeRace,
				"distanceKm", "8.50",
				"ascentM", 0,
				"descentM", 0,
				"seconds", 2700,
				"link", "https://rezultati.rs/ravna"))).getStatus())
				.as("a flat race was refused for having no climb")
				.isEqualTo(201);
	}

	/**
	 * A FIFTH DECIMAL IS REFUSED RATHER THAN ROUNDED AWAY.
	 *
	 * <p>{@code numeric(8,4)} does not throw a fifth decimal out, it rounds it, so without
	 * this the portal would carry a length nobody entered - the identical fault V25 found in
	 * {@code numeric(6,2)} one scale lower.
	 */
	@Test
	void aLengthWithMoreDecimalsThanTheColumnKeepsIsRefused() throws Exception {
		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceName", "Premerena trka",
				"eventName", AN_EVENT_HE_TYPED,
				"day", "2027-02-02",
				"raceKind", "free",
				"placeId", aTownFromTheCodebook(),
				"distanceKm", "42.19501",
				"ascentM", 0,
				"descentM", 0,
				"seconds", 3600,
				"link", "https://rezultati.rs/premereno")))))
				.isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);
	}

	/*
	 * CORRECTING ONE
	 */

	/**
	 * A CORRECTION BECOMES A NEW SUBMISSION THAT NAMES THE RESULT IT CORRECTS, AND THE RESULT
	 * ITSELF IS NOT TOUCHED.
	 *
	 * <p>Owner, 28.08.2026, choosing between four outcomes: „Stari rezultat ostaje u poretku
	 * dok ispravka ceka, i menja se tek kad je moderator odobri." What that overturned was
	 * measured the same day - a profile falling from 180 runs to 179 the moment a correction
	 * was SENT - so the second half of this case is as much the decision as the first.
	 */
	@Test
	void aCorrectionIsANewSubmissionAndLeavesTheResultWhereItStands() throws Exception {
		MockHttpServletResponse answered = correctedAs(ME, myResult, correction(
				"42.20", 350, 410, 11400, "https://rezultati.rs/ispravka", "Sat je bio pogresan"));

		assertThat(answered.getStatus()).isEqualTo(200);

		assertThat(theSubmission(idIn(answered)))
				.as("the correction did not name the result it corrects")
				.containsEntry("amends_result_id", myResult)
				.containsEntry("race_id", lengthRaceIRan)
				.containsEntry("event_id", null)
				.containsEntry("event_name", null)
				.containsEntry("race_date", LocalDate.of(2027, 5, 5))
				.containsEntry("seconds", 11400)
				/* NOT the 42,20 that was sent: a race of a length fixes the distance on a
				   correction exactly as it does on a fresh report (figuresOf, and the class
				   note on ResultWriteApi). */
				.containsEntry("distance_km", MEASURED_EXACTLY)
				.containsEntry("race_name", null);

		assertThat(secondsOf(myResult))
				.as("sending a correction moved the result that is still in the standings")
				.isEqualTo(12000);
	}

	/**
	 * A CORRECTION ON A RACE OF A LENGTH TAKES THE LENGTH, THE CLIMB AND THE FALL OFF THE
	 * RACE TOO, exactly as a fresh report does.
	 *
	 * <p>Sent a length, a climb and a fall that would each refuse a FRESH report on their
	 * own ({@link #everyWayARunOnAFreeRaceCanFailToHoldTogether}'s own values), to prove
	 * two things at once: the row that comes out carries the race's figures and not these,
	 * and the request is not refused for them either, because a race of a length does not
	 * ask the member for them in the first place. PDL, owner, 03.08.2026: „ispravka
	 * [duzine, uspona, spusta] stize svima koji su je istrcali, a ne na jednoj prijavi" -
	 * which a correction that accepted them from the member, or refused him for them,
	 * would defeat either way.
	 */
	@Test
	void aCorrectionOnARaceOfALengthTakesTheLengthTheClimbAndTheFallOffTheRaceToo()
			throws Exception {
		MockHttpServletResponse answered = correctedAs(ME, myResult, correction(
				"0", -1, -1, 11400, "https://rezultati.rs/ispravka-duzine", ""));

		assertThat(answered.getStatus())
				.as("a length, a climb or a fall that would refuse a fresh report blocked a"
						+ " correction the race does not even ask them of")
				.isEqualTo(200);

		assertThat(theSubmission(idIn(answered)))
				.as("a length, a climb or a fall nothing like what was sent reached the row")
				.containsEntry("distance_km", MEASURED_EXACTLY)
				.containsEntry("ascent_m", 350)
				.containsEntry("descent_m", 410)
				/* And the time is still his to correct - a race of a length does not fix it. */
				.containsEntry("seconds", 11400);
	}

	/**
	 * AND ON A TIMED RACE IT IS THE OTHER WAY ROUND: THE TIME COMES OFF THE RACE AND THE
	 * REST IS THE MEMBER'S.
	 *
	 * <p>Owner, 29.08.2026: „Na vremenskoj trci clan unosi duzinu, uspon i spust. Vreme ne
	 * unosi, jer je zadato trkom." Sent a time of nought, which would refuse a fresh
	 * report outright ({@code result_submission_seconds_positive}), to prove the same two
	 * things the length case above does: the row carries the race's own limit and not
	 * this, and the request is not refused for it either.
	 */
	@Test
	void aCorrectionOnATimedRaceTakesTheTimeOffTheRaceAndTheRestFromTheMember()
			throws Exception {
		MockHttpServletResponse answered = correctedAs(FIRST_WRITTEN, timedResult, correction(
				"70.50", 140, 150, 0, "https://rezultati.rs/ispravka-vremenske", ""));

		assertThat(answered.getStatus())
				.as("a time that would refuse a fresh report blocked a correction the race"
						+ " does not even ask it of")
				.isEqualTo(200);

		assertThat(theSubmission(idIn(answered)))
				.as("a time nothing like what was sent reached the row")
				.containsEntry("seconds", 21600)
				.containsEntry("distance_km", new BigDecimal("70.5000"))
				.containsEntry("ascent_m", 140)
				.containsEntry("descent_m", 150);
	}

	/** A CORRECTION ASKS FOR THE PROOF AGAIN (owner, 27.08.2026: „menja i dostavlja dokaz za
	 *  tu izmenu (ponovo)"). */
	@Test
	void aCorrectionWithNoFreshProofIsRefused() throws Exception {
		assertThat(reasonIn(correctedAs(ME, myResult,
				correction("42.20", 350, 410, 11400, null, "Verujte mi"))))
				.isEqualTo(ResultWriteApi.WHY_NOT.get(Outcome.NOTHING_SHOWS_IT_HAPPENED));

		assertThat(howManySubmissions()).isZero();
	}

	@Test
	void aCorrectionMissingOneOfTheFourFiguresIsRefused() throws Exception {
		assertThat(reasonIn(correctedAs(ME, myResult,
				correction("42.20", 350, 410, null, "https://rezultati.rs/ispravka", ""))))
				.isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);
	}

	/*
	 * TAKING ONE BACK
	 */

	/**
	 * A RESULT IS DELETED AT ONCE, EVEN THOUGH NOTHING ASKS WHETHER IT WAS VERIFIED.
	 *
	 * <p>Owner, 27.08.2026: „Clan sme da obrise svoj rezultat i posle verifikacije.
	 * Verifikacija je provera tacnosti, ne prenos vlasnistva nad zapisom." His OTHER result
	 * and somebody else's result on the same race both stay, which is what makes this a
	 * statement about one row rather than about the table.
	 */
	@Test
	void aResultIsDeletedAtOnceAndNothingElseGoesWithIt() throws Exception {
		assertThat(deletedAs(ME, myResult).getStatus()).isEqualTo(204);

		assertThat(stillThere(myResult)).isFalse();
		assertThat(stillThere(myOtherResult)).as("his other result went too").isTrue();
		assertThat(stillThere(somebodyElsesResult)).as("somebody else's result went too").isTrue();
	}

	/**
	 * AND A CORRECTION WAITING ON IT GOES WITH IT, which is V31's cascade rather than a
	 * second statement in the route.
	 *
	 * <p>Left without it, the queue would hold an item about a run nobody can see, and a
	 * moderator approving it would write a result out of a row whose original is gone.
	 */
	@Test
	void deletingAResultTakesTheCorrectionWaitingOnItOutOfTheQueue() throws Exception {
		long correction = idIn(correctedAs(ME, myResult, correction("42.20", 350, 410, 11400,
				"https://rezultati.rs/ispravka", "")));

		deletedAs(ME, myResult);

		assertThat(db.sql("select count(*) from result_submission where id = ?")
				.param(correction).query(Long.class).single())
				.as("the correction outlived the result it corrects")
				.isZero();

		assertThat(db.sql("select count(*) from verification where result_submission_id = ?")
				.param(correction).query(Long.class).single())
				.as("a queue item was left pointing at a run nobody can see")
				.isZero();
	}

	/*
	 * WHOSE RESULT IT IS
	 */

	/**
	 * SOMEBODY ELSE'S RESULT IS NOT THERE, for both verbs, and it is a 404 and never a 403.
	 *
	 * <p>ADL A8, the owner, 13.09.2026: a member who may not do something is answered „isti
	 * odgovor kao da adresa ne postoji, jer ne sme ni da sazna da radnja postoji". A 403 on
	 * {@code /api/results/5} would hand out a count of results one id at a time.
	 */
	@Test
	void somebodyElsesResultIsNotThereForEitherVerb() throws Exception {
		assertThat(correctedAs(ME, somebodyElsesResult, correction("42.20", 350, 410, 11400,
				"https://rezultati.rs/tudje", "")).getStatus())
				.isEqualTo(404);

		assertThat(deletedAs(ME, somebodyElsesResult).getStatus()).isEqualTo(404);

		assertThat(stillThere(somebodyElsesResult))
				.as("somebody else's result was deleted by the member asking")
				.isTrue();
		assertThat(howManySubmissions()).isZero();
		assertThat(SMTP.getReceivedMessages())
				.as("a message went out about a result that is not his")
				.isEmpty();
	}

	@Test
	void aResultThatIsNotThereReadsTheSameAsOneThatIsNotHis() throws Exception {
		assertThat(deletedAs(ME, somebodyElsesResult + 1000).getStatus()).isEqualTo(404);
	}

	/**
	 * AN ACCOUNT THAT NAMES NO MEMBER IS SENT AWAY EMPTY-HANDED FROM ALL THREE.
	 *
	 * <p>V23 calls it the ordinary case rather than a fault - „Empty for a moderator who does
	 * not race" - and there is simply nobody to file a run under.
	 */
	@Test
	void anAccountThatNamesNoMemberIsSentAwayFromAllThree() throws Exception {
		Cookie his = new Cookie(SessionCookie.NAME,
				sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret());

		assertThat(sent(post("/api/results").contentType(MediaType.APPLICATION_JSON)
				.content(ordinaryReport()), his).getStatus()).isEqualTo(404);

		assertThat(sent(put("/api/results/" + myResult).contentType(MediaType.APPLICATION_JSON)
				.content(correction("42.20", 350, 410, 11400, "https://rezultati.rs/x", "")), his)
				.getStatus()).isEqualTo(404);

		assertThat(sent(delete("/api/results/" + myResult), his).getStatus()).isEqualTo(404);

		assertThat(stillThere(myResult)).isTrue();
		assertThat(howManySubmissions()).isZero();
	}

	/*
	 * THE MESSAGE, WHICH IS THE WHOLE POINT
	 */

	/**
	 * A CHANGE CARRIES THE OLD VALUE, AND THAT IS THE ONE THING THIS INCREMENT EXISTS FOR.
	 *
	 * <p>PDL P22: „obavestenje MORA da sadrzi staru vrednost, jer ona nigde drugde ne
	 * prezivljava." The old time is 12000 seconds and the new one is 11400, and every figure
	 * of the fixture is chosen so the two texts cannot be confused: a route that wrote the new
	 * value into both halves would produce a message in which „3:10:00" appears twice, which
	 * is what the last assertion refuses.
	 */
	@Test
	void theMessageAboutAChangeCarriesTheOldValueAndTheNewOne() throws Exception {
		correctedAs(ME, myResult, correction("42.20", 350, 410, 11400,
				"https://rezultati.rs/ispravka", ""));

		String body = bodyOfTheMessageThatWentOut();

		assertThat(body)
				.as("the old value did not survive into the message")
				.contains("3:20:00")
				.contains("123,45 bodova")
				.contains("Dugi maraton, 05.05.2027")
				.as("the new value is not in the message either")
				.contains("3:10:00");

		assertThat(body.split("3:20:00", -1))
				.as("the old time is not there at all, or the new one was written twice")
				.hasSize(2);
	}

	/**
	 * A DELETION CARRIES IT TOO, and that is the half of the decision that closes the hole.
	 *
	 * <p>„Isto obavestenje ide i kad se obrise verifikovan rezultat... Bez ove dve stavke,
	 * brisanje i uvoz postaju nacin da se rezultat promeni bez traga."
	 */
	@Test
	void theMessageAboutADeletionCarriesWhatTheResultSaid() throws Exception {
		deletedAs(ME, myResult);

		assertThat(bodyOfTheMessageThatWentOut())
				.as("the result was deleted and nothing recorded what it had said")
				.contains("Dugi maraton, 05.05.2027, 42,20 km, uspon 350 m, spust 410 m,"
						+ " vreme 3:20:00, 123,45 bodova");
	}

	/**
	 * A FRESH REPORT'S LINE IN HIS INBOX CARRIES THE FIGURES THE PORTAL WROTE DOWN AND THE
	 * POINTS IT WORKED OUT.
	 *
	 * <p>Read off the inbox and not off a letter, because since 09.10.2026 there is no letter
	 * when a run is sent in ({@link #sendingOneInWritesTheLineInHisInboxAndPostsNoLetter}): the
	 * line is the whole of what he is told until a moderator approves it.
	 *
	 * <p>The points are asked of {@link BtlScoreCalculator} here rather than typed, so this
	 * case cannot go on passing beside a route that started accepting them from a request -
	 * and the request itself carries no field for them at all.
	 */
	@Test
	void aFreshReportCarriesWhatWasSentInAndThePointsTheFormulaGives() throws Exception {
		reportedAs(ME, ordinaryReport());

		assertThat(theLineInTheInboxOf(ME).get(1))
				.contains("Dugi maraton, 05.05.2027, 42,20 km, uspon 350 m, spust 410 m,"
						+ " vreme 3:25:45, "
						+ BtlScoreCalculator.calculate(42.2035, 350, 410, 12345)
								.toPlainString().replace('.', ',')
						+ " bodova");
	}

	/**
	 * SENDING ONE IN TELLS HIM IN HIS INBOX AND POSTS NOTHING, AND THE RELAY WAS THERE TO POST
	 * TO.
	 *
	 * <p>The owner chose among the outcomes offered on 09.10.2026, and the record words his
	 * choice as PDL P9, 09.10.2026, „Pri slanju rezultata clan dobija samo red u sanducetu; mejl
	 * stize tek kad je rezultat odobren". The server used to post at both moments, so a member
	 * would have had two letters about one run; the letter at the approval is
	 * {@code VerificationWriteApiTest}'s to hold.
	 *
	 * <p><b>No letter is also exactly what a relay that is down looks like</b>, so the case does
	 * not stop at the absence. The same member then corrects a result, and that letter has to
	 * arrive, to him alone: a route that had stopped posting anything at all, or a mail server
	 * that never came up, fails at the second half instead of passing at the first.
	 */
	@Test
	void sendingOneInWritesTheLineInHisInboxAndPostsNoLetter() throws Exception {
		assertThat(reportedAs(ME, ordinaryReport()).getStatus()).isEqualTo(201);

		assertThat(theLineInTheInboxOf(ME).get(0))
				.as("sending a run in did not tell him in his inbox")
				.isEqualTo("Primili smo vaš rezultat");
		assertThat(SMTP.getReceivedMessages())
				.as("a letter went out when the run was sent in, and the letter belongs to the"
						+ " approval")
				.isEmpty();

		correctedAs(ME, myResult, correction("42.20", 350, 410, 11400,
				"https://rezultati.rs/ispravka", ""));

		assertThat(theMessageThatWentOut().getSubject())
				.as("the letter about the correction did not arrive, so the absence above says"
						+ " nothing about the route")
				.isEqualTo("Primili smo izmenu vašeg rezultata");
	}

	/**
	 * THE LEAGUE GETS NO COPY OF WHAT HE DOES TO HIS OWN RESULT, for either verb.
	 *
	 * <p>PDL P9, 25.09.2026, „Skrivena kopija ligi NE ide kad clan sam menja ili brise svoj
	 * rezultat", and the owner's own words for it: „Covek ima pravo da obrise svoj rezultat bez
	 * javljanja i time se i tabele i obracuni automatski azuriraju. Ispravka svakako ide Adminu
	 * na odobrenje." It is the one written exception to „Skrivena kopija svakog takvog
	 * obavestenja ide na administrativnu adresu lige", and a copy that came back would read
	 * exactly like the rule.
	 *
	 * <p><b>Both verbs, and the member's letters counted as well as the league's absence</b>,
	 * because no letter at all satisfies „the league got none" just as well. The copy that stays
	 * - the approval's - is {@code VerificationWriteApiTest}'s.
	 *
	 * <p>Every case that reads a letter asks the same of its envelope through
	 * {@link #theMessageThatWentOut}; this one names the league's address, which is the copy the
	 * decision is about, and asks the headers too, where a copy written into {@code Cc} rather
	 * than {@code Bcc} would show.
	 */
	@Test
	void theLeagueGetsNoCopyOfWhatHeDoesToHisOwnResult() throws Exception {
		correctedAs(ME, myResult, correction("42.20", 350, 410, 11400,
				"https://rezultati.rs/ispravka", ""));
		deletedAs(ME, myOtherResult);

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).as("not one letter for each of the two").hasSize(2);

		assertThat(everyAddressThatGotACopy())
				.as("the league was copied on what the member did to his own result")
				.doesNotContain(theLeague)
				.as("the two letters did not go to the member and to nobody else")
				.containsExactly(MY_ADDRESS);

		for (MimeMessage one : arrived) {
			assertThat(Arrays.stream(one.getAllRecipients()).map(Object::toString))
					.as("a letter names somebody other than the member as a recipient")
					.containsExactly(MY_ADDRESS);
		}
	}

	/**
	 * AND THE SAME MESSAGE IS IN HIS INBOX, word for word.
	 *
	 * <p>„...i ISTA PORUKA ide u portalski inboks." Read out of {@code message} and compared
	 * with what actually travelled, rather than with a second copy of the expected text: a
	 * route that worded the two differently is exactly what this refuses, and comparing each
	 * against a literal would not have seen it.
	 */
	@Test
	void theSameMessageIsInHisInboxWordForWord() throws Exception {
		deletedAs(ME, myResult);

		MimeMessage arrived = theMessageThatWentOut();

		assertThat(theLineInTheInboxOf(ME))
				.as("the inbox says something other than what the message said")
				.containsExactly(arrived.getSubject(), asItWasWritten(arrived));
	}

	/** What travelled, with the line endings SMTP put on it taken back off: a message goes
	 *  down the wire in CRLF by the protocol's own rule, and the row it was written from
	 *  never had them. */
	private static String asItWasWritten(MimeMessage arrived) throws Exception {
		return ((String) arrived.getContent()).replace("\r\n", "\n").stripTrailing();
	}

	/**
	 * THE MESSAGE IS ADDRESSED TO HIM AND NOT TO THE LEAGUE, and the row says so.
	 *
	 * <p>V13: {@code message.to_id} left empty means EVERYBODY, so a row about nobody would
	 * post a member's own result to every member of the portal. The fixture already holds one
	 * such message, so „addressed to him" and „addressed to the league" are two readable
	 * states rather than one.
	 */
	@Test
	void theLineInTheInboxIsHisAndNotTheWholeLeaguesOrSomebodyElsesInbox() throws Exception {
		reportedAs(ME, ordinaryReport());

		assertThat(db.sql("select count(*) from message m join competitor c on c.id = m.to_id"
						+ " where c.member_number = ? and m.from_id is null"
						+ " and m.subject = 'Primili smo vaš rezultat'")
				.param(ME).query(Long.class).single())
				.as("the member was not told, or was told in somebody else's inbox")
				.isEqualTo(1);

		assertThat(db.sql("select count(*) from message where to_id is null"
						+ " and subject = 'Primili smo vaš rezultat'")
				.query(Long.class).single())
				.as("a member's own result was posted to the whole league")
				.isZero();

		assertThat(db.sql("select count(*) from message m join competitor c on c.id = m.to_id"
						+ " where c.member_number = ? and m.subject = 'Primili smo vaš rezultat'")
				.param(SOMEONE_ELSE).query(Long.class).single())
				.as("somebody else was told about this member's result")
				.isZero();
	}

	/**
	 * A RELAY THAT WILL NOT TAKE IT DOES NOT UNDO WHAT HAPPENED.
	 *
	 * <p>{@link RegistrationApi}'s decision, made again for this route: the member's result IS
	 * deleted, and nothing he can do at that screen produces a letter. What keeps the record
	 * is the inbox row, written inside the transaction - so this case measures both halves at
	 * once, the answer he gets and the record that survives the relay being down.
	 */
	@Test
	void aRelayThatIsDownDoesNotUndoTheDeletionAndDoesNotLoseTheRecord() throws Exception {
		SMTP.getSmtp().stopService();

		assertThat(deletedAs(ME, myResult).getStatus())
				.as("the member was told nothing happened, and everything had")
				.isEqualTo(204);

		assertThat(stillThere(myResult)).isFalse();
		assertThat(theLineInTheInboxOf(ME).get(0))
				.as("the relay being down cost the league its record")
				.isEqualTo("Vaš rezultat je obrisan");
	}

	/**
	 * A CORRECTION IS TOLD IN HIS OWN LANGUAGE, IN THE LETTER AND IN HIS INBOX ALIKE.
	 *
	 * <p>The owner's answer of 10.10.2026, Q3 (A): the inbox copy of the messages about a result
	 * follows the language of the letter. He chose English and the member written first did not, so
	 * a language read off another account than the one the letter goes to is Serbian here, and so is
	 * a letter that was always Serbian. The inbox is compared with what travelled, so an inbox left
	 * Serbian beside an English letter fails too.
	 */
	@Test
	void aCorrectionIsToldInHisOwnLanguageInTheLetterAndInTheInboxAlike() throws Exception {
		db.sql("update account set mail_language = 'en' where email = ?").param(MY_ADDRESS).update();

		correctedAs(ME, myResult, correction("42.20", 350, 410, 11400,
				"https://rezultati.rs/ispravka", ""));

		MimeMessage arrived = theMessageThatWentOut();

		assertThat(arrived.getSubject()).isEqualTo("We have received a change to your result");
		assertThat(asItWasWritten(arrived))
				.contains("Old value:\nDugi maraton, 5 May 2027, 42.20 km, ascent 350 m, descent 410 m,"
						+ " time 3:20:00, 123.45 points")
				.endsWith("Balkanska trkačka liga");
		assertThat(theLineInTheInboxOf(ME))
				.as("the inbox says something other than what the English letter said")
				.containsExactly(arrived.getSubject(), asItWasWritten(arrived));
	}

	/** And the other way round: he is Serbian and the member written first chose English. */
	@Test
	void aDeletionIsToldInSerbianToAMemberWhoKeptSerbianWhateverTheOthersChose() throws Exception {
		db.sql("update account set mail_language = 'en' where email = 'ana@primer.rs'").update();
		db.sql("update account set mail_language = 'en' where email = ?").param(SOMEBODY_ELSES_ADDRESS)
				.update();

		deletedAs(ME, myResult);

		MimeMessage arrived = theMessageThatWentOut();

		assertThat(arrived.getSubject()).isEqualTo("Vaš rezultat je obrisan");
		assertThat(theLineInTheInboxOf(ME)).containsExactly(arrived.getSubject(), asItWasWritten(arrived));
	}

	/**
	 * A RUN SENT IN IS TOLD IN HIS INBOX IN HIS LANGUAGE, with no letter, and the language is his
	 * and not that of the member written first.
	 */
	@Test
	void aRunSentInIsToldInHisInboxInHisLanguage() throws Exception {
		db.sql("update account set mail_language = 'en' where email = ?").param(MY_ADDRESS).update();

		assertThat(reportedAs(ME, ordinaryReport()).getStatus()).isEqualTo(201);

		assertThat(theLineInTheInboxOf(ME).get(0)).isEqualTo("We have received your result");
		assertThat(theLineInTheInboxOf(ME).get(1)).contains(" points").doesNotContain("bodova");
		assertThat(SMTP.getReceivedMessages()).isEmpty();
	}

	/*
	 * FIXTURE
	 */

	private void competitor(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, "
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, "
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, first, last, String.format("%016x", ++issued))
				.update();
	}

	/** One event per race, so no two races of this fixture share a day through their event. */
	private long race(String name, String day, String kind, int limitSeconds, BigDecimal km,
			int up, int down) {
		long event = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
						+ " description, link) values (?, ?, date '" + day + "',"
						+ " (select id from place where rank = 1), 'race', false, '', '')"
						+ " returning id")
				.params("dogadjaj-" + String.format("%016x", ++issued), name)
				.query(Long.class).single();

		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, date '" + day + "', ?, ?, ?, ?, ?) returning id")
				.params(event, name, kind, limitSeconds, km, up, down)
				.query(Long.class).single();
	}

	private long ran(String member, long raceId, String day, String km, int up, int down,
			int seconds, String points) {
		return db.sql("insert into result (competitor_id, race_id, race_date, distance_km,"
						+ " ascent_m, descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?), ?,"
						+ " date '" + day + "', ?, ?, ?, ?, ?) returning id")
				.params(member, raceId, new BigDecimal(km), up, down, seconds,
						new BigDecimal(points))
				.query(Long.class).single();
	}

	/** @param member whose it is, or {@code null} for the whole league (V13). */
	private void alreadyInTheInbox(String member, String subject) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body)"
						+ " values ((select id from competitor where member_number = ?), null,"
						+ " 'Ranije', ?, 'Telo')")
				.params(member, subject).update();
	}

	/** Somebody else's run, already waiting, queued exactly the way the route queues one. */
	private void waitingResultOf(String member) {
		long submission = db.sql("insert into result_submission (competitor_id, race_id,"
						+ " race_date, distance_km, ascent_m, descent_m, seconds, link, comment)"
						+ " values ((select id from competitor where member_number = ?), ?,"
						+ " date '2027-05-05', 42.2035, 350, 410, 10800,"
						+ " 'https://rezultati.rs/vec-ceka', '') returning id")
				.params(member, lengthRace).query(Long.class).single();

		db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " result_submission_id)"
						+ " values ('results', (select id from competitor where member_number = ?),"
						+ " 'Dugi maraton', '', ?)")
				.params(member, submission).update();
	}

	/**
	 * A TOWN AS IT TRAVELS, WHICH IS THE MARK AND NOT THE ROW KEY, AND ONE WHERE THE TWO
	 * DIFFER.
	 *
	 * <p>{@link PlaceApi} serves {@code place.geonames_id}; {@code place.id} is a bigserial
	 * the portal has never published. The first draft of this file sent the KEY, and with it
	 * every case here passed against a route that wrote the arriving number straight into the
	 * column - code and cases agreeing with each other and neither agreeing with the portal,
	 * which is the fault {@code EveryRouteFindsATownByItsMarkTest} exists to refuse and the
	 * one that caught this route.
	 *
	 * <p><b>The town is chosen where the mark is the key of no row at all</b>, which is 46,989
	 * of the codebook's 47,016: so a route reading it as a key finds nothing and the foreign
	 * key refuses the row, rather than quietly writing a different town.
	 */
	private long aTownFromTheCodebook() {
		return db.sql("select geonames_id from place"
						+ " where geonames_id > (select max(id) from place) and rank > 1"
						+ " order by rank limit 1")
				.query(Long.class).single();
	}

	/** And the row that mark names, which is what has to end up in the column. */
	private long theKeyOf(long mark) {
		return db.sql("select id from place where geonames_id = ?")
				.param(mark).query(Long.class).single();
	}

	/** A country as it travels, which is the CODE {@link CountryApi} serves. */
	private static String aCountryCode() {
		return "RS";
	}

	private long theKeyOfTheCountry() {
		return db.sql("select id from country where code = ?")
				.param(aCountryCode()).query(Long.class).single();
	}

	private void account(String email, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, memberNumber).update();

		openSession(email);
	}

	private void moderatorWithNoCompetitor(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?,"
						+ " (select id from role where code = 'moderator'))")
				.param(email).update();

		openSession(email);
	}

	private void openSession(String email) {
		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/*
	 * ASKING
	 */

	private Cookie cookieOf(String memberNumber) {
		String email = db.sql("select a.email from account a join competitor c"
						+ " on c.id = a.competitor_id where c.member_number = ?")
				.param(memberNumber).query(String.class).single();

		return new Cookie(SessionCookie.NAME, sessions.get(email).secret());
	}

	private MockHttpServletResponse reportedAs(String memberNumber, String body) throws Exception {
		return sent(post("/api/results").contentType(MediaType.APPLICATION_JSON).content(body),
				cookieOf(memberNumber));
	}

	private MockHttpServletResponse correctedAs(String memberNumber, long id, String body)
			throws Exception {
		return sent(put("/api/results/" + id).contentType(MediaType.APPLICATION_JSON).content(body),
				cookieOf(memberNumber));
	}

	private MockHttpServletResponse deletedAs(String memberNumber, long id) throws Exception {
		return sent(delete("/api/results/" + id), cookieOf(memberNumber));
	}

	private MockHttpServletResponse sent(MockHttpServletRequestBuilder asking, Cookie carrying)
			throws Exception {
		return http.perform(asking.with(csrf()).cookie(carrying)).andReturn().getResponse();
	}

	/** The ordinary request every case starts from: a run on the race in the calendar. */
	private String ordinaryReport() {
		return form(Map.of(
				"raceId", lengthRace,
				"seconds", 12345,
				"link", "https://rezultati.rs/moja-trka",
				"comment", "Bilo je vruce."));
	}

	/** Written as a map rather than through {@code ResultWriteApi.Ran}, so a case can leave a
	 *  field out ALTOGETHER rather than send it as null - which is what a real form does, and
	 *  the two reach Jackson the same way only by accident. */
	private String form(Map<String, Object> fields) {
		return mapper.writeValueAsString(fields);
	}

	private String correction(String km, Integer up, Integer down, Integer seconds, String link,
			String comment) {
		Map<String, Object> fields = new HashMap<>();

		fields.put("distanceKm", km);
		fields.put("ascentM", up);
		fields.put("descentM", down);
		fields.put("seconds", seconds);
		fields.put("link", link);
		fields.put("comment", comment);

		return mapper.writeValueAsString(fields);
	}

	/*
	 * READING BACK
	 */

	private long idIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("id").asLong();
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	/**
	 * THE ROW AS IT REALLY IS, read column by column rather than through the route that wrote
	 * it.
	 *
	 * <p>The day is turned into a {@link LocalDate} here because the driver hands back a
	 * {@code java.sql.Date}, whose {@code equals} is about a moment in the machine's own zone:
	 * compared as it comes, a case about the day of a race would be a case about the zone the
	 * test happens to run in.
	 */
	private Map<String, Object> theSubmission(long id) {
		Map<String, Object> row = db.sql("select race_id, race_date, race_name, race_kind,"
						+ " place_id, city, country_id, distance_km, ascent_m, descent_m, seconds,"
						+ " link, comment, amends_result_id, event_id, event_name"
						+ " from result_submission where id = ?")
				.param(id)
				.query()
				.singleRow();

		row.replace("race_date", ((java.sql.Date) row.get("race_date")).toLocalDate());

		return row;
	}

	private long howManySubmissions() {
		return db.sql("select count(*) from result_submission where competitor_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(ME).query(Long.class).single();
	}

	private boolean stillThere(long result) {
		return db.sql("select count(*) from result where id = ?")
				.param(result).query(Long.class).single() == 1;
	}

	private int secondsOf(long result) {
		return db.sql("select seconds from result where id = ?")
				.param(result).query(Integer.class).single();
	}

	/** The one line this route wrote into his inbox, ASSERTED to be one rather than taken with
	 *  {@code single()}: a route that wrote none, or wrote it into somebody else's inbox, then
	 *  fails a case on this sentence instead of on a driver exception that says nothing. */
	private List<String> theLineInTheInboxOf(String memberNumber) {
		List<List<String>> lines = db.sql("select m.subject, m.body from message m"
						+ " join competitor c on c.id = m.to_id"
						+ " where c.member_number = ? and m.from_name = 'Rezultati'")
				.param(memberNumber)
				.query((row, one) -> List.of(row.getString(1), row.getString(2)))
				.list();

		assertThat(lines).as("not exactly one line about his result in the inbox of " + memberNumber)
				.hasSize(1);

		return lines.get(0);
	}

	private String bodyOfTheMessageThatWentOut() throws Exception {
		return (String) theMessageThatWentOut().getContent();
	}

	/**
	 * WHAT TRAVELLED, having first said who got it: the member, once, and nobody else.
	 *
	 * <p>WHO it went to is asserted here rather than left to the one case that is about the
	 * league's copy ({@link #theLeagueGetsNoCopyOfWhatHeDoesToHisOwnResult}), so every case
	 * reading a body also measures that the league was not copied and that nobody else was.
	 *
	 * <p><b>The wait is for one letter and it cannot end before a second one would have
	 * arrived.</b> GreenMail delivers to every address of the envelope before it answers the
	 * data with „250 OK" (read off 2.1.5's {@code DataCommand}, which calls
	 * {@code SmtpManager.send} first), the sending side does not give the request back before
	 * that answer, and the route posts inside the request. So by the time a case reads this, a
	 * copy to the league would already be here - which is what the copy put back in measures.
	 */
	private MimeMessage theMessageThatWentOut() {
		assertThat(SMTP.waitForIncomingEmail(5000, 1)).isTrue();

		assertThat(everyAddressThatGotACopy())
				.as("the letter did not reach the member, or reached somebody besides him")
				.containsExactly(MY_ADDRESS);

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).as("more than the one letter went out").hasSize(1);

		return arrived[0];
	}

	/**
	 * EVERY ADDRESS THAT REALLY RECEIVED A COPY, ASKED OF THE ENVELOPE AND NOT OF THE HEADERS.
	 *
	 * <p><b>A blind copy leaves no header at all, and that is the whole difficulty.</b>
	 * Whoever sends a message strips {@code Bcc} out of it before it travels, so every stored
	 * copy carries the SAME {@code To} and the same everything else. Measured on this very
	 * fixture while these letters still copied the league (until 09.10.2026):
	 * {@code getAllRecipients()} answered {@code [vera@primer.rs]} on BOTH copies, and
	 * {@code getReceivedMessagesForDomain}, which reads exactly that, answered nought for the
	 * league's domain. Read that way, a route that copied the league again would look identical
	 * to one that does not.
	 *
	 * <p>What DOES survive is the envelope: GreenMail opens a mailbox for each {@code RCPT TO}
	 * it is given, so its user manager is the list of addresses the relay was really asked to
	 * deliver to - which is the one question this is about.
	 */
	private static List<String> everyAddressThatGotACopy() {
		return SMTP.getUserManager().listUser().stream().map(GreenMailUser::getEmail).toList();
	}
}

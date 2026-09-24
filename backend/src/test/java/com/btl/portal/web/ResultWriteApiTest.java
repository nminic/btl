package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.result.ProofThatTheRunHappened.Outcome;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.user.GreenMailUser;
import jakarta.mail.Message.RecipientType;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
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
 * PDL P22 makes the message the league's ONLY record of what a result used to say: „Posto
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

	/** Read off the configuration rather than written here, so „where the blind copy goes"
	 *  is one fact and not two that can drift (the same arrangement {@code PostmanTest}
	 *  makes for the address messages leave from). */
	@Value("${btl.mail.league}")
	private String theLeague;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	private long lengthRace;

	private long timeRace;

	private long freeRace;

	private long futureRace;

	/** The result the cases act on: {@link #ME}'s SECOND, on {@link #lengthRace}. */
	private long myResult;

	/** His first, on another race, so „his result" is never „his only result". */
	private long myOtherResult;

	/** Somebody else's, on the same race and with the same three figures. */
	private long somebodyElsesResult;

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
	void threeMembersFourRacesAndThreeResults() {
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

		/* Somebody else's first, so the lowest id in `result` is not mine. */
		somebodyElsesResult = ran(SOMEONE_ELSE, lengthRace, "2027-05-05", "42.20", 350, 410, 11000,
				"130.00");
		myOtherResult = ran(ME, freeRace, "2027-03-03", "12.00", 10, 20, 3000, "45.60");
		myResult = ran(ME, lengthRace, "2027-05-05", "42.20", 350, 410, 12000, "123.45");

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

	/**
	 * A RACE THE CALENDAR DOES NOT HOLD IS DESCRIBED, AND EVERY COLUMN AN APPROVAL WILL NEED
	 * IS COLLECTED.
	 *
	 * <p>PDL: „Clan sme da unese trku koje nema u kalendaru. Tada administrator kreira
	 * dogadjaj i trku uz rezultat, i sve troje nastaje istovremeno."
	 */
	@Test
	void aRaceTheCalendarDoesNotHoldIsDescribedInFull() throws Exception {
		MockHttpServletResponse answered = reportedAs(ME, form(Map.of(
				"raceName", "  Trka kroz sumu  ",
				"day", "2027-02-02",
				"raceKind", "free",
				"placeId", aTownFromTheCodebook(),
				"distanceKm", "21.0975",
				"ascentM", 300,
				"descentM", 280,
				"seconds", 7200,
				"link", "https://rezultati.rs/kroz-sumu",
				"comment", "Blatnjavo")));

		assertThat(answered.getStatus()).isEqualTo(201);

		assertThat(theSubmission(idIn(answered)))
				.containsEntry("race_id", null)
				.containsEntry("race_name", "Trka kroz sumu")
				.containsEntry("race_kind", "free")
				.containsEntry("race_date", LocalDate.of(2027, 2, 2))
				.containsEntry("city", null)
				/* 21,0975 is the true half marathon, and PDL P5 says in as many words that it
				   must NOT come out as one. Kept to four decimals it is stored as typed; at two
				   it would be 21,10, which the portal calls a half. */
				.containsEntry("distance_km", new BigDecimal("21.0975"));
	}

	/** A TOWN TYPED BY HAND NAMES ITS COUNTRY, which is
	 *  {@code result_submission_typed_town_names_its_country} asked before the row rather
	 *  than after it. */
	@Test
	void aTownTypedByHandComesWithItsCountry() throws Exception {
		Map<String, Object> described = new HashMap<>(Map.of(
				"raceName", "Trka na Zlatiboru",
				"day", "2027-02-02",
				"raceKind", "free",
				"city", "Zaselak",
				"countryId", aCountry(),
				"distanceKm", "15.00",
				"ascentM", 0,
				"descentM", 0,
				"seconds", 3600,
				"link", "https://rezultati.rs/zlatibor"));

		assertThat(theSubmission(idIn(reportedAs(ME, form(described)))))
				.containsEntry("city", "Zaselak")
				.containsEntry("place_id", null);

		described.remove("countryId");

		assertThat(reasonIn(reportedAs(ME, form(described))))
				.as("a town typed with no country was taken")
				.isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);
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
	@Test
	void aRaceStillToBeRunIsRefusedOnBothRoads() throws Exception {
		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceId", futureRace,
				"seconds", 3600,
				"link", "https://rezultati.rs/buduca")))))
				.isEqualTo(ResultWriteApi.THE_RACE_HAS_NOT_BEEN_RUN);

		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceName", "Sutrasnja",
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

	/** A REQUEST THAT BOTH PICKS A RACE AND DESCRIBES ONE IS TWO ANSWERS TO ONE QUESTION, and
	 *  V10's biconditional means there is no row that could be written from it. */
	@Test
	void aRequestThatNamesARaceTwiceIsRefused() throws Exception {
		assertThat(reasonIn(reportedAs(ME, form(Map.of(
				"raceId", lengthRace,
				"raceName", "Ipak druga trka",
				"seconds", 3600,
				"link", "https://rezultati.rs/dva-puta")))))
				.isEqualTo(ResultWriteApi.THE_RACE_IS_NAMED_TWICE);

		assertThat(howManySubmissions()).isZero();
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
				.containsEntry("race_id", lengthRace)
				.containsEntry("race_date", LocalDate.of(2027, 5, 5))
				.containsEntry("seconds", 11400)
				/* A correction carries the numbers the MEMBER sent, never the race's: PDL,
				   27.08.2026, „Time ispravka ostaje izmena BROJEVA i dokaza." */
				.containsEntry("distance_km", new BigDecimal("42.2000"))
				.containsEntry("race_name", null);

		assertThat(secondsOf(myResult))
				.as("sending a correction moved the result that is still in the standings")
				.isEqualTo(12000);
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
	 * A FRESH REPORT CARRIES THE FIGURES THE PORTAL WROTE DOWN AND THE POINTS IT WORKED OUT.
	 *
	 * <p>The points are asked of {@link BtlScoreCalculator} here rather than typed, so this
	 * case cannot go on passing beside a route that started accepting them from a request -
	 * and the request itself carries no field for them at all.
	 */
	@Test
	void aFreshReportCarriesWhatWasSentInAndThePointsTheFormulaGives() throws Exception {
		reportedAs(ME, ordinaryReport());

		assertThat(bodyOfTheMessageThatWentOut())
				.contains("Dugi maraton, 05.05.2027, 42,20 km, uspon 350 m, spust 410 m,"
						+ " vreme 3:25:45, "
						+ BtlScoreCalculator.calculate(42.2035, 350, 410, 12345)
								.toPlainString().replace('.', ',')
						+ " bodova");
	}

	/**
	 * THE LEAGUE GETS A COPY AND IT IS BLIND, and the member's own letter does not say so.
	 *
	 * <p>PDL P22: „Skrivena kopija svakog takvog obavestenja ide na administrativnu adresu
	 * lige." Blind rather than plain, because written into {@code Cc} it would tell the member
	 * the league reads his post and would put the league's address in the headers of a letter
	 * he may forward anywhere.
	 */
	@Test
	void theLeagueGetsABlindCopyOfEveryOneOfThem() throws Exception {
		deletedAs(ME, myResult);

		theMessageThatWentOut();

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).as("somebody got a copy nobody decided on").hasSize(2);

		for (MimeMessage one : arrived) {
			/* AND NEITHER COPY SAYS THE LEAGUE IS READING. Written into `Cc` rather than
			   `Bcc`, this header would name the league in a letter the member may forward
			   anywhere - and a route that sent to the wrong member would be caught here
			   too, because this address is the one read off his account. */
			assertThat(Arrays.stream(one.getRecipients(RecipientType.TO)).map(Object::toString))
					.as("a copy named somebody other than the member in its To")
					.containsExactly(MY_ADDRESS);

			assertThat(one.getHeader("Bcc"))
					.as("the blind copy was not blind")
					.isNull();
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

	/*
	 * FIXTURE
	 */

	private void competitor(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
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

	private long aTownFromTheCodebook() {
		return db.sql("select id from place where rank = 1").query(Long.class).single();
	}

	private long aCountry() {
		return db.sql("select id from country where code = 'RS'").query(Long.class).single();
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
						+ " link, comment, amends_result_id from result_submission where id = ?")
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

	private List<String> theLineInTheInboxOf(String memberNumber) {
		return db.sql("select m.subject, m.body from message m"
						+ " join competitor c on c.id = m.to_id"
						+ " where c.member_number = ? and m.from_name = 'Rezultati'")
				.param(memberNumber)
				.query((row, one) -> List.of(row.getString(1), row.getString(2)))
				.single();
	}

	private String bodyOfTheMessageThatWentOut() throws Exception {
		return (String) theMessageThatWentOut().getContent();
	}

	/**
	 * WHAT TRAVELLED, having first said who got it.
	 *
	 * <p>Both stored copies are the same message - the relay is handed one and delivers it
	 * twice - so which of the two is read does not matter, and WHO the two went to is asserted
	 * here rather than left to the one case that is about the blind copy. Every case reading a
	 * body therefore also measures that the league was copied and that nobody else was.
	 */
	private MimeMessage theMessageThatWentOut() {
		assertThat(SMTP.waitForIncomingEmail(5000, 2)).isTrue();

		assertThat(everyAddressThatGotACopy())
				.as("the message did not reach the member and the league, and nobody else")
				.containsExactlyInAnyOrder(MY_ADDRESS, theLeague);

		return SMTP.getReceivedMessages()[0];
	}

	/**
	 * EVERY ADDRESS THAT REALLY RECEIVED A COPY, ASKED OF THE ENVELOPE AND NOT OF THE HEADERS.
	 *
	 * <p><b>A blind copy leaves no header at all, and that is the whole difficulty.</b>
	 * Whoever sends a message strips {@code Bcc} out of it before it travels, so both stored
	 * copies carry the SAME {@code To} and the same everything else. Measured on this very
	 * fixture: {@code getAllRecipients()} answers {@code [vera@primer.rs]} on BOTH, and
	 * {@code getReceivedMessagesForDomain}, which reads exactly that, answers nought for the
	 * league's domain. Read that way, a route that never copied the league would look
	 * identical to one that did.
	 *
	 * <p>What DOES survive is the envelope: GreenMail opens a mailbox for each {@code RCPT TO}
	 * it is given, so its user manager is the list of addresses the relay was really asked to
	 * deliver to - which is the one question this is about.
	 */
	private static List<String> everyAddressThatGotACopy() {
		return SMTP.getUserManager().listUser().stream().map(GreenMailUser::getEmail).toList();
	}
}

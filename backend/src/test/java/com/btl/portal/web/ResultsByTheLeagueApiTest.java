package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.user.GreenMailUser;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE LEAGUE ENTERS, CHANGES AND DELETES RESULTS FROM THE EVENT PAGE ({@link ResultsByTheLeagueApi},
 * PDL P9, 18.10.2026).
 *
 * <p><b>THE AXES, AND WHERE EACH STATE STANDS IN THE FIXTURE.</b> Every fact a route reads has more
 * than one source in the fixture, so a route that read the wrong one is told apart from the right
 * one:
 * <ul>
 * <li><b>Who asks:</b> nobody, a competitor, a moderator of the events only, a moderator of the
 * results who does not race, a moderator of the results who races (Mira), the superadmin.
 * <li><b>Who the run is:</b> Ana (an account, Serbian, a membership of 2027), Bojan (an account,
 * English, a membership of 2027 that the cases about a lack of one take away), Vera (no account, a
 * membership), Mira (the moderator herself), Dragan (an account, Serbian, NO membership: the member
 * the running season refuses), a competitor with no number.
 * <li><b>The clock:</b> a day inside 2027 (2027 is running), the autumn of 2026 (no season runs),
 * 10:00 on 1 January 2028 and the second before and the second of 16:00 (2027 is past and not yet
 * frozen, then frozen), and 2 January 2028 (2027 frozen).
 * <li><b>The race:</b> one of each kind, two of them in one event (so „this race" is never „this
 * event"), a race of 2026, one in the future and one in another event.
 * <li><b>What waits:</b> his own report for this race, his own report for another race of the
 * event, somebody else's report for this race, a refused one, and a correction of a result.
 * <li><b>The category:</b> a member it closes for, one it does not reach, and one already over
 * the threshold.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3335",
		"spring.mail.properties.mail.smtp.auth=false"})
@Transactional
class ResultsByTheLeagueApiTest {

	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3335));

	/** 15.06.2027: the first season is running and every race but one is behind it. */
	private static final Instant IN_JUNE = Instant.parse("2027-06-15T10:00:00Z");

	/** 02.01.2028, after 2027 froze at 16:00 the day before. */
	private static final Instant AFTER_THE_FREEZE = Instant.parse("2028-01-02T10:00:00Z");

	/** 10:00 on 1 January 2028 in Belgrade: 2028 is the season being run and 2027 is past, not frozen. */
	private static final Instant THE_MORNING_OF_THE_NEW_YEAR = Instant.parse("2028-01-01T09:00:00Z");

	/** 15:59:59 in Belgrade on 1 January 2028, the last second 2027 is not frozen. */
	private static final Instant A_SECOND_BEFORE_THE_FREEZE = Instant.parse("2028-01-01T14:59:59Z");

	/** 16:00:00 in Belgrade on 1 January 2028, the second 2027 freezes. */
	private static final Instant THE_SECOND_OF_THE_FREEZE = Instant.parse("2028-01-01T15:00:00Z");

	/** 18.10.2026: no season is being run, and a race of 2026 is a race before the league. */
	private static final Instant IN_THE_AUTUMN_OF_2026 = Instant.parse("2026-10-18T10:00:00Z");

	private static final String DRAGAN = "000005";

	private static final String ANA = "000010";

	private static final String BOJAN = "000020";

	private static final String VERA = "000030";

	private static final String MIRA = "000040";

	private static final String NOBODY_HOLDS_THIS = "000999";

	private static final String ANAS_ADDRESS = "ana@primer.rs";

	private static final String BOJANS_ADDRESS = "bojan@primer.rs";

	private static final String DRAGANS_ADDRESS = "dragan@primer.rs";

	private static final String MIRAS_ADDRESS = "mira@primer.rs";

	private static final String RESULTS_MODERATOR = "rezultati@primer.rs";

	private static final String EVENTS_MODERATOR = "dogadjaji@primer.rs";

	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	private static final int AN_HOUR = 3600;

	private static final int SIX_HOURS = 21600;

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	@Value("${btl.mail.league}")
	private String theLeague;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	private long theOtherEventsRace;

	private long theTen;

	private long theHill;

	private long theSixHours;

	private long theOldRace;

	private long theRaceToCome;

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
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(IN_JUNE);
		}
	}

	@BeforeEach
	void fiveMembersSixRacesAndFiveCallers() {
		clock.moveTo(IN_JUNE);

		member(DRAGAN, "Dragan", "Dragic");
		member(ANA, "Ana", "Anic");
		member(BOJAN, "Bojan", "Bojic");
		member(VERA, "Vera", "Veric");
		member(MIRA, "Mira", "Miric");
		withoutANumber("Neko", "Bezbroja");

		account(DRAGANS_ADDRESS, "competitor", "Dragan", "Dragic", DRAGAN);
		account(ANAS_ADDRESS, "competitor", "Ana", "Anic", ANA);
		account(BOJANS_ADDRESS, "competitor", "Bojan", "Bojic", BOJAN);
		account(MIRAS_ADDRESS, "moderator", "Mira", "Miric", MIRA);
		account(RESULTS_MODERATOR, "moderator", "Rezultat", "Rezultatic", null);
		account(EVENTS_MODERATOR, "moderator", "Dogadjaj", "Dogadjajic", null);
		account(THE_SUPERADMIN, "superadmin", "Sanja", "Simic", null);
		ticked(MIRAS_ADDRESS, "queue:results");
		ticked(RESULTS_MODERATOR, "queue:results");
		ticked(EVENTS_MODERATOR, "entity:events");

		db.sql("update account set mail_language = 'en' where email = ?").param(BOJANS_ADDRESS).update();

		membership(ANA, 2027);
		membership(BOJAN, 2027);
		membership(VERA, 2027);
		membership(MIRA, 2027);

		/* THE OTHER EVENT'S RACE IS WRITTEN FIRST and the event page's three after it, so none of
		   the three is the lowest key and the length race is neither the lowest nor the highest. */
		long theOtherEvent = event("drugi-dogadjaj-2027", "Drugi dogadjaj", LocalDate.of(2027, 4, 10));

		theOtherEventsRace = race(theOtherEvent, "Prolecna desetka", LocalDate.of(2027, 4, 10),
				"length", 0, "10.00", 50, 50);

		long theEvent = event("prvi-dogadjaj-2027", "Prvi dogadjaj", LocalDate.of(2027, 5, 8));

		theHill = race(theEvent, "Brdska trka", LocalDate.of(2027, 5, 8), "free", 0, "0", 0, 0);
		theTen = race(theEvent, "Desetka", LocalDate.of(2027, 5, 8), "length", 0, "10.00", 100, 80);
		theSixHours = race(theEvent, "Sestocasovna", LocalDate.of(2027, 5, 8), "time", SIX_HOURS,
				"0", 0, 0);
		theOldRace = race(event("stari-dogadjaj-2026", "Stari dogadjaj", LocalDate.of(2026, 9, 12)),
				"Stari polumaraton", LocalDate.of(2026, 9, 12), "length", 0, "21.10", 0, 0);
		theRaceToCome = race(event("buduci-dogadjaj-2027", "Buduci dogadjaj", LocalDate.of(2027, 9, 1)),
				"Buduca trka", LocalDate.of(2027, 9, 1), "length", 0, "10.00", 0, 0);

		/* THE CATEGORY: Ana is short of the threshold by less than one run, Mira is over it already
		   and Vera has nothing, which is three states rather than two. */
		resultAlreadyCounted(ANA, theOtherEventsRace, LocalDate.of(2027, 4, 10), AN_HOUR, "9.50");
		resultAlreadyCounted(MIRA, theOtherEventsRace, LocalDate.of(2027, 4, 10), AN_HOUR, "15.00");
	}

	/* ===================================================================== the door */

	/**
	 * THE RIGHT THAT CHECKS RESULTS OPENS IT AND NO OTHER (PDL P9, 18.10.2026, „otvara pravo provere
	 * rezultata"), 401 and 404 for the rest (ADL A8).
	 */
	@Test
	void onlyTheRightThatChecksResultsOpensTheRoad() throws Exception {
		String one = rows(row(VERA, null, null, null, AN_HOUR));

		assertThat(entered(null, theTen, one).getStatus()).isEqualTo(401);
		assertThat(entered(ANAS_ADDRESS, theTen, one).getStatus()).isEqualTo(404);
		assertThat(entered(EVENTS_MODERATOR, theTen, one).getStatus()).isEqualTo(404);
		assertThat(resultsOf(VERA)).isEmpty();

		assertThat(entered(RESULTS_MODERATOR, theTen, one).getStatus()).isEqualTo(201);
		assertThat(resultsOf(VERA)).hasSize(1);
	}

	@Test
	void theSuperadminNeedsNoTick() throws Exception {
		assertThat(entered(THE_SUPERADMIN, theTen, rows(row(VERA, null, null, null, AN_HOUR)))
				.getStatus()).isEqualTo(201);
		assertThat(http.perform(asking(THE_SUPERADMIN, get("/api/results/runners"))).andReturn()
				.getResponse().getStatus()).isEqualTo(200);
	}

	/* ===================================================================== the list */

	/**
	 * EVERY MEMBER WITH A NUMBER, ACTIVE OR NOT, AND NOBODY WITHOUT ONE („U padajućoj listi su svi
	 * članovi sa članskim brojem, aktivni i neaktivni").
	 */
	@Test
	void theListIsEveryMemberWithANumberActiveOrNot() throws Exception {
		db.sql("update competitor set active = false where member_number = ?").param(BOJAN).update();

		assertThat(http.perform(asking(null, get("/api/results/runners"))).andReturn().getResponse()
				.getStatus()).isEqualTo(401);
		assertThat(http.perform(asking(EVENTS_MODERATOR, get("/api/results/runners"))).andReturn()
				.getResponse().getStatus()).isEqualTo(404);

		JsonNode runners = runners();
		List<String> numbers = StreamSupport.stream(runners.spliterator(), false)
				.map(one -> one.path("memberNumber").asString()).toList();

		assertThat(numbers).containsExactly(DRAGAN, ANA, BOJAN, VERA, MIRA);
		assertThat(runners.get(2).path("firstName").asString()).isEqualTo("Bojan");
		assertThat(runners.get(2).path("lastName").asString()).isEqualTo("Bojic");
	}

	@Test
	void everyFieldTheEventPageReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/results/runners", runners(),
				"results/runners.json");
	}

	/* ===================================================================== what a row is */

	/** A RACE OF A LENGTH: its course is its own whatever the row says, the time is the runner's. */
	@Test
	void aRaceOfALengthCountsItsOwnCourseAndTheRunnersTime() throws Exception {
		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(VERA, "50.00", 9, 9, AN_HOUR)))
				.getStatus()).isEqualTo(201);

		assertThat(resultsOf(VERA)).containsExactly(figures(theTen, "10", 100, 80, AN_HOUR,
				BtlScoreCalculator.calculate(10.0, 100, 80, AN_HOUR)));
	}

	/** A RACE TO A LIMIT: its time is its limit, the course is the runner's. */
	@Test
	void aRaceToALimitCountsItsLimitAndTheRunnersCourse() throws Exception {
		assertThat(entered(RESULTS_MODERATOR, theSixHours, rows(row(VERA, "61.2500", 420, 380, 999)))
				.getStatus()).isEqualTo(201);

		assertThat(resultsOf(VERA)).containsExactly(figures(theSixHours, "61.25", 420, 380, SIX_HOURS,
				BtlScoreCalculator.calculate(61.25, 420, 380, SIX_HOURS)));
	}

	/** A FREE RACE: all six are the runner's, and a row missing any one of the four is refused. */
	@Test
	void aFreeRaceCountsAllSixAndRefusesARowMissingOne() throws Exception {
		MockHttpServletResponse missing = entered(RESULTS_MODERATOR, theHill, rows(
				row(VERA, "12.00", 300, null, 5000),
				row(BOJAN, null, 300, 250, 5000),
				row(ANA, "12.00", null, 250, 5000),
				row(MIRA, "12.00", 300, 250, null)));

		assertThat(missing.getStatus()).isEqualTo(400);
		assertThat(wrongRows(missing)).containsExactly("0 theFormIsNotComplete",
				"1 theFormIsNotComplete", "2 theFormIsNotComplete", "3 theFormIsNotComplete");

		assertThat(entered(RESULTS_MODERATOR, theHill, rows(row(VERA, "12.00", 300, 250, 5000)))
				.getStatus()).isEqualTo(201);
		assertThat(resultsOf(VERA)).containsExactly(figures(theHill, "12", 300, 250, 5000,
				BtlScoreCalculator.calculate(12.0, 300, 250, 5000)));
	}

	/* ===================================================================== a save of several rows */

	/**
	 * ONE WRONG ROW AND NOTHING IS SAVED, AND THE ANSWER SAYS WHICH ROW AND WHY („ako ijedan red nije
	 * ispravan, ništa se ne čuva i portal kaže koji red i zašto"). The wrong row is the middle one,
	 * so a route that wrote up to the first wrong row has one row to have written.
	 */
	@Test
	void oneWrongRowSavesNothingAndNamesTheRowAndWhy() throws Exception {
		MockHttpServletResponse answer = entered(RESULTS_MODERATOR, theTen, rows(
				row(VERA, null, null, null, AN_HOUR),
				row(NOBODY_HOLDS_THIS, null, null, null, AN_HOUR),
				row(BOJAN, null, null, null, AN_HOUR)));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(ResultsByTheLeagueApi.A_ROW_IS_WRONG);
		assertThat(wrongRows(answer)).containsExactly("1 theMemberIsNotKnown");

		assertThat(resultsOf(VERA)).isEmpty();
		assertThat(resultsOf(BOJAN)).isEmpty();
		assertThat(db.sql("select count(*) from message").query(Integer.class).single()).isZero();
		assertThat(SMTP.getReceivedMessages()).isEmpty();
	}

	/** THE SAME MEMBER ON TWO ROWS: both rows are named, neither is written. */
	@Test
	void aMemberOnTwoRowsIsRefusedOnBoth() throws Exception {
		MockHttpServletResponse answer = entered(RESULTS_MODERATOR, theTen, rows(
				row(VERA, null, null, null, AN_HOUR),
				row(BOJAN, null, null, null, AN_HOUR),
				row(VERA, null, null, null, 2 * AN_HOUR)));

		assertThat(wrongRows(answer)).containsExactly("0 theMemberIsNamedTwice",
				"2 theMemberIsNamedTwice");
		assertThat(resultsOf(VERA)).isEmpty();
		assertThat(resultsOf(BOJAN)).isEmpty();
	}

	/** A ROW THAT IS NOT THERE, AND A ROW THAT NAMES NOBODY, are both a member nobody holds. */
	@Test
	void aRowThatIsNothingIsAMemberNobodyHolds() throws Exception {
		MockHttpServletResponse answer = entered(RESULTS_MODERATOR, theTen,
				"{\"rows\":[null,{\"seconds\":3600}]}");

		assertThat(wrongRows(answer)).containsExactly("0 theMemberIsNotKnown",
				"1 theMemberIsNotKnown");
	}

	/**
	 * ONE RESULT ON A RACE (PDL P6, 09.09.2026), and a result on another race of the same event
	 * refuses nothing („ali sme imati više rezultata na istom događaju").
	 */
	@Test
	void aResultOnThisRaceRefusesAndOneOnAnotherRaceOfTheEventDoesNot() throws Exception {
		resultAlreadyCounted(VERA, theTen, LocalDate.of(2027, 5, 8), AN_HOUR, "5.00");
		resultAlreadyCounted(BOJAN, theHill, LocalDate.of(2027, 5, 8), AN_HOUR, "5.00");

		MockHttpServletResponse answer = entered(RESULTS_MODERATOR, theTen, rows(
				row(BOJAN, null, null, null, AN_HOUR),
				row(VERA, null, null, null, AN_HOUR)));

		assertThat(wrongRows(answer)).containsExactly("1 heHasAResultOnThisRace");

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(BOJAN, null, null, null, AN_HOUR)))
				.getStatus()).isEqualTo(201);
	}

	/**
	 * HIS OWN REPORT THAT WAITS FOR THIS RACE REFUSES THE ROW, AND THE OTHER THREE SOURCES DO NOT:
	 * his report for another race of the event, somebody else's report for this race, and a report
	 * of his that was refused („Kad za tu trku član već ima prijavu ili ispravku koja čeka").
	 */
	@Test
	void hisWaitingReportForThisRaceRefusesAndTheOtherSourcesDoNot() throws Exception {
		waitingFor(ANA, theTen, null);
		waitingFor(VERA, theHill, null);
		waitingFor(DRAGAN, theTen, null);
		refusedFor(BOJAN, theTen);

		MockHttpServletResponse answer = entered(RESULTS_MODERATOR, theTen, rows(
				row(VERA, null, null, null, AN_HOUR),
				row(ANA, null, null, null, AN_HOUR),
				row(BOJAN, null, null, null, AN_HOUR),
				row(MIRA, null, null, null, AN_HOUR)));

		assertThat(wrongRows(answer)).containsExactly("1 hisSubmissionWaits");

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(
				row(VERA, null, null, null, AN_HOUR),
				row(BOJAN, null, null, null, AN_HOUR),
				row(MIRA, null, null, null, AN_HOUR))).getStatus()).isEqualTo(201);
	}

	@Test
	void aRaceStillToComeAndARaceThatIsNotThere() throws Exception {
		MockHttpServletResponse toCome = entered(RESULTS_MODERATOR, theRaceToCome,
				rows(row(VERA, null, null, null, AN_HOUR)));

		assertThat(toCome.getStatus()).isEqualTo(400);
		assertThat(reasonIn(toCome)).isEqualTo(ResultWriteApi.THE_RACE_HAS_NOT_BEEN_RUN);

		long nothing = db.sql("select coalesce(max(id), 0) + 1000 from race").query(Long.class).single();

		assertThat(entered(RESULTS_MODERATOR, nothing, rows(row(VERA, null, null, null, AN_HOUR)))
				.getStatus()).isEqualTo(404);
		assertThat(resultsOf(VERA)).isEmpty();
	}

	@Test
	void anEmptySaveAndOneOfMoreRowsThanOneSaveCarries() throws Exception {
		assertThat(reasonIn(entered(RESULTS_MODERATOR, theTen, "{\"rows\":[]}")))
				.isEqualTo(CompetitorWriteApi.THE_GROUP_IS_EMPTY);
		assertThat(reasonIn(entered(RESULTS_MODERATOR, theTen, "{}")))
				.isEqualTo(CompetitorWriteApi.THE_GROUP_IS_EMPTY);

		StringJoiner many = new StringJoiner(",", "{\"rows\":[", "]}");

		for (int one = 0; one <= CompetitorWriteApi.THE_MOST_IN_ONE_GROUP; one++) {
			many.add(row(VERA, null, null, null, AN_HOUR));
		}

		assertThat(reasonIn(entered(RESULTS_MODERATOR, theTen, many.toString())))
				.isEqualTo(CompetitorWriteApi.THE_GROUP_IS_TOO_BIG);
	}

	/* ===================================================================== what the member is told */

	/**
	 * AN ENTRY IN A SEASON HE IS A MEMBER OF IS TOLD AS AN APPROVAL, IN HIS INBOX AND BY LETTER, AND
	 * THE LETTER IS COPIED TO THE LEAGUE IN BLIND („istu poruku kao kad mu moderator odobri rezultat,
	 * u sanduče i mejlom"). Nobody else hears a word, and no line is addressed to everybody.
	 */
	@Test
	void anEntryInHisSeasonIsToldAsAnApprovalAndCopiedToTheLeague() throws Exception {
		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(ANA, null, null, null, AN_HOUR)))
				.getStatus()).isEqualTo(201);

		assertThat(subjectsTo(ANA)).containsExactly("Vaš rezultat je odobren",
				"Početnička kategorija vam je zatvorena");
		assertThat(nobodyElseWasWrittenTo(ANA)).isTrue();

		MimeMessage letter = theOneLetterTo(ANAS_ADDRESS);

		assertThat(letter.getSubject()).isEqualTo("Vaš rezultat je odobren");
		assertThat(envelope()).containsExactlyInAnyOrder(ANAS_ADDRESS, theLeague);
		assertThat(bodiesTo(ANA).get(0)).isEqualTo(letter.getContent().toString()
				.replace("\r\n", "\n").strip());
	}

	/**
	 * AN ENTRY FOR A YEAR HE HOLDS NO MEMBERSHIP OF says so, IN HIS LANGUAGE, and the moderator's
	 * language is not read: the moderator kept Serbian and Bojan chose English.
	 *
	 * <p>Since the league enters the running season only for a member of it, a year without a
	 * membership is a PAST year, and a past year that has not frozen is the sixteen hours of 1 January
	 * between the end of the season and its freeze: the clock stands there. Any later moment is a
	 * frozen season and has the owner's sentence for it ({@link #aRunOfAFrozenSeasonIsToldWithTheOwnersSentence}).
	 */
	@Test
	void anEntryForAYearWithoutAMembershipIsToldSoInHisLanguage() throws Exception {
		clock.moveTo(THE_MORNING_OF_THE_NEW_YEAR);
		withoutAMembership(BOJAN, 2027);

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(BOJAN, null, null, null, AN_HOUR)))
				.getStatus()).isEqualTo(201);

		MimeMessage letter = theOneLetterTo(BOJANS_ADDRESS);

		assertThat(letter.getSubject()).isEqualTo("A result has been entered for you");
		assertThat(letter.getContent().toString()).contains("membership of the league for 2027");
		assertThat(subjectsTo(BOJAN)).containsExactly("A result has been entered for you");
		assertThat(envelope()).containsExactlyInAnyOrder(BOJANS_ADDRESS, theLeague);
	}

	/** And the other way round: a moderator who chose English does not turn Ana's letter English. */
	@Test
	void aModeratorWhoChoseEnglishDoesNotTurnTheMembersLetterEnglish() throws Exception {
		db.sql("update account set mail_language = 'en' where email = ?").param(RESULTS_MODERATOR)
				.update();

		entered(RESULTS_MODERATOR, theHill, rows(row(ANA, "1.00", 0, 0, AN_HOUR)));

		assertThat(theOneLetterTo(ANAS_ADDRESS).getSubject()).isEqualTo("Vaš rezultat je odobren");
	}

	/**
	 * A RUN BEFORE 2027 says that it counts in no season, although Ana holds a membership of 2027:
	 * the year is asked before the membership, and asked the other way round the words would say
	 * she lacked one. It moves no category either.
	 */
	@Test
	void anEntryBeforeTheLeagueIsToldSoAndMovesNoCategory() throws Exception {
		assertThat(entered(RESULTS_MODERATOR, theOldRace, rows(row(ANA, null, null, null, 4000)))
				.getStatus()).isEqualTo(201);

		assertThat(subjectsTo(ANA)).containsExactly("Unet vam je rezultat");
		assertThat(bodiesTo(ANA).get(0)).contains("pre prve zvanične sezone lige (2027)")
				.doesNotContain("Za godinu");
		assertThat(envelope()).containsExactlyInAnyOrder(ANAS_ADDRESS, theLeague);
	}

	/**
	 * THE MEMBERSHIP ASKED IS THE ONE OF THE RUN'S YEAR, and no other: Dragan holds 2028 and not 2027,
	 * so a run of 2027 counts in no season for him. At 10:00 on 1 January 2028 the season being run
	 * is 2028, which is the membership he holds, and a route that asked the clock's season (or any
	 * membership at all) would call him a member of 2027.
	 */
	@Test
	void theMembershipAskedIsTheOneOfTheYearOfTheRun() throws Exception {
		clock.moveTo(THE_MORNING_OF_THE_NEW_YEAR);
		membership(DRAGAN, 2028);

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(DRAGAN, null, null, null,
			AN_HOUR))).getStatus()).isEqualTo(201);
		assertThat(subjectsTo(DRAGAN)).containsExactly("Unet vam je rezultat");
		assertThat(bodiesTo(DRAGAN).get(0)).contains("Za godinu 2027 nemate zapis o članstvu");
	}

	/** A MEMBER WITH NO ACCOUNT gets the line in his inbox, in Serbian, and no letter at all. */
	@Test
	void aMemberWithNoAccountGetsTheLineAndNoLetter() throws Exception {
		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(VERA, null, null, null, AN_HOUR)))
				.getStatus()).isEqualTo(201);

		assertThat(subjectsTo(VERA)).containsExactly("Vaš rezultat je odobren");
		assertThat(SMTP.getReceivedMessages()).isEmpty();
	}

	/**
	 * A MODERATOR WHO ENTERS HER OWN RUN IS COPIED TO THE LEAGUE TOO: the exception of 25.09.2026 is
	 * for a member acting on his own result while a correction goes to the admin anyway, and nothing
	 * here goes to anybody (the coordinator's derivation, written on {@link ResultsByTheLeagueApi}).
	 * Mira is already over the threshold, so nothing is said about her category.
	 */
	@Test
	void aModeratorEnteringHerOwnRunIsCopiedToTheLeagueAndIsNotToldAboutACategoryAlreadyClosed()
			throws Exception {
		assertThat(entered(MIRAS_ADDRESS, theTen, rows(row(MIRA, null, null, null, AN_HOUR)))
				.getStatus()).isEqualTo(201);

		theOneLetterTo(MIRAS_ADDRESS);
		assertThat(envelope()).containsExactlyInAnyOrder(MIRAS_ADDRESS, theLeague);
		assertThat(subjectsTo(MIRA)).containsExactly("Vaš rezultat je odobren");
	}

	@Test
	void aRelayThatIsDownUndoesNothing() throws Exception {
		SMTP.getSmtp().stopService();

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(ANA, null, null, null, AN_HOUR)))
				.getStatus()).isEqualTo(201);
		assertThat(resultsOf(ANA)).hasSize(1);
		assertThat(subjectsTo(ANA)).contains("Vaš rezultat je odobren");
	}

	/* ===================================================================== the running season */

	/**
	 * THE RUNNING SEASON IS ENTERED ONLY FOR A MEMBER OF IT, AND ONE REFUSED ROW SAVES NOTHING (PDL P9,
	 * 18.10.2026: „Za trku iz TEKUĆE sezone liga unosi rezultat samo članu koji ima članstvo za tu
	 * sezonu; inače se red odbija uz rečenicu"). Dragan has no membership and stands between two
	 * members: the answer names his row and no other, and neither member is written either.
	 */
	@Test
	void theRunningSeasonIsEnteredOnlyForAMemberOfItAndOneRefusedRowSavesNothing() throws Exception {
		MockHttpServletResponse answer = entered(RESULTS_MODERATOR, theTen, rows(
			row(ANA, null, null, null, AN_HOUR),
			row(DRAGAN, null, null, null, AN_HOUR),
			row(VERA, null, null, null, AN_HOUR)));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(ResultsByTheLeagueApi.A_ROW_IS_WRONG);
		assertThat(wrongRows(answer)).containsExactly("1 heHoldsNoMembershipOfTheRunningSeason");
		assertThat(resultsOf(ANA)).isEmpty();
		assertThat(resultsOf(VERA)).isEmpty();
		assertThat(resultsOf(DRAGAN)).isEmpty();
		assertThat(db.sql("select count(*) from message").query(Integer.class).single()).isZero();
		assertThat(SMTP.getReceivedMessages()).isEmpty();

		membership(DRAGAN, 2027);

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(DRAGAN, null, null, null, AN_HOUR)))
			.getStatus()).as("the same row with the membership of the race's season").isEqualTo(201);
	}

	/**
	 * THE MEMBERSHIP ASKED IS THE RACE'S SEASON, NOT ANY MEMBERSHIP, NOT THE CLOCK'S SEASON AND NOT HIS
	 * LATEST. Three states of the member against the two seasons, each in a clock where the two
	 * differ:
	 * <ul>
	 * <li>in June 2027, a member who holds only 2028 (any membership exists, the race's season is
	 * not among them);
	 * <li>in March 2028, a member who holds only 2027, the race being of 2028 (his latest membership
	 * is not the season being run);
	 * <li>in March 2028, a member who holds 2028 and a race of 2028 (the two years agree).
	 * </ul>
	 */
	@Test
	void theMembershipAskedIsTheRacesSeasonAndNotAnyMembershipNorTheLatest() throws Exception {
		membership(DRAGAN, 2028);

		assertThat(wrongRows(entered(RESULTS_MODERATOR, theTen, rows(row(DRAGAN, null, null, null,
			AN_HOUR))))).containsExactly("0 heHoldsNoMembershipOfTheRunningSeason");

		clock.moveTo(Instant.parse("2028-03-01T10:00:00Z"));

		long theNextYearsRace = aRaceOf2028("dogadjaj-2028", LocalDate.of(2028, 2, 1));

		assertThat(wrongRows(entered(RESULTS_MODERATOR, theNextYearsRace, rows(row(ANA, null, null,
			null, AN_HOUR))))).containsExactly("0 heHoldsNoMembershipOfTheRunningSeason");
		assertThat(resultsOfIds(ANA)).hasSize(1);

		assertThat(entered(RESULTS_MODERATOR, theNextYearsRace, rows(row(DRAGAN, null, null, null,
			AN_HOUR))).getStatus()).isEqualTo(201);
		assertThat(subjectsTo(DRAGAN)).containsExactly("Vaš rezultat je odobren");
	}

	/**
	 * A RACE OF A PAST SEASON ASKS NO MEMBERSHIP („Za prošle godine i pre 2027 ostaje unos svima sa
	 * članskim brojem"), AND THE PAST IS DEFINED BY THE RACE'S YEAR AGAINST THE CLOCK. Dragan holds no
	 * membership at all, and is entered for a race of 2027 once 2027 has frozen, for one of 2027 in
	 * the sixteen hours before it freezes (2028 is running by then), and for a race of 2026.
	 */
	@Test
	void aPastSeasonAndTheYearsBeforeTheLeagueAskForNoMembership() throws Exception {
		assertThat(entered(RESULTS_MODERATOR, theOldRace, rows(row(DRAGAN, null, null, null, 4000)))
			.getStatus()).as("a race of 2026, the clock inside 2027").isEqualTo(201);

		clock.moveTo(THE_MORNING_OF_THE_NEW_YEAR);

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(DRAGAN, null, null, null, AN_HOUR)))
			.getStatus()).as("a race of 2027 the morning after its last day").isEqualTo(201);

		clock.moveTo(AFTER_THE_FREEZE);

		assertThat(entered(RESULTS_MODERATOR, theHill, rows(row(DRAGAN, "12.00", 300, 250, 5000)))
			.getStatus()).as("a race of 2027 once it has frozen").isEqualTo(201);
	}

	/**
	 * IN THE AUTUMN OF 2026 NO SEASON IS BEING RUN, although {@code seasonBeingRun} names 2026: a race
	 * of 2026 is a race before the league and asks no membership. A route that took „the season
	 * being run" as it comes would call 2026 the running season and refuse Dragan.
	 */
	@Test
	void aRaceOf2026IsNeverTheRunningSeasonEvenInTheAutumnOf2026() throws Exception {
		clock.moveTo(IN_THE_AUTUMN_OF_2026);

		assertThat(entered(RESULTS_MODERATOR, theOldRace, rows(row(DRAGAN, null, null, null, 4000)))
			.getStatus()).isEqualTo(201);
		assertThat(bodiesTo(DRAGAN).get(0)).contains("pre prve zvanične sezone lige (2027)");
	}

	/**
	 * THE RUNNING SEASON TURNS AT THE NEW YEAR AND NOT AT THE FREEZE: at 10:00 on 1 January 2028 a race
	 * of 2028 (run that morning) is of the running season, and Ana, who holds 2027 only, is refused.
	 */
	@Test
	void theRunningSeasonTurnsAtTheNewYear() throws Exception {
		clock.moveTo(THE_MORNING_OF_THE_NEW_YEAR);

		long thisMorning = aRaceOf2028("novogodisnji-2028", LocalDate.of(2028, 1, 1));

		assertThat(wrongRows(entered(RESULTS_MODERATOR, thisMorning, rows(row(ANA, null, null, null,
			AN_HOUR))))).containsExactly("0 heHoldsNoMembershipOfTheRunningSeason");
		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(ANA, null, null, null, AN_HOUR)))
			.getStatus()).as("2027 is past by now and Ana holds it").isEqualTo(201);
	}

	/**
	 * THE PENCIL AND THE X DO NOT ASK FOR THE MEMBERSHIP (see the class note, a reading and not a
	 * decision): Dragan has a result on a race of the running season and no membership of it, which
	 * is the state a membership struck out later leaves behind. The league can still correct it and
	 * remove it.
	 */
	@Test
	void thePencilAndTheXAskForNoMembershipOfTheRunningSeason() throws Exception {
		long dragans = resultAlreadyCounted(DRAGAN, theTen, LocalDate.of(2027, 5, 8), 7200, "1.14",
			"10.00", 100, 80);

		assertThat(changed(RESULTS_MODERATOR, theTen, dragans, figuresBody(null, null, null, AN_HOUR))
			.getStatus()).isEqualTo(204);
		assertThat(removed(RESULTS_MODERATOR, theTen, dragans).getStatus()).isEqualTo(204);
	}

	/* ===================================================================== a season that has frozen */

	/**
	 * A RUN OF A FROZEN SEASON IS TOLD WITH THE OWNER'S SENTENCE, FOR A MEMBER AND A NON-MEMBER ALIKE
	 * (PDL P9, 18.10.2026: „Rezultat u ZAMRZNUTOJ sezoni dobija posebnu rečenicu"), in each one's own
	 * language: Ana holds 2027, Dragan does not, Bojan holds it and chose English. The season in the
	 * sentence is the race's, 2027, while the clock stands in 2028. Nothing is said about a category.
	 */
	@Test
	void aRunOfAFrozenSeasonIsToldWithTheOwnersSentence() throws Exception {
		clock.moveTo(AFTER_THE_FREEZE);

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(
			row(ANA, null, null, null, AN_HOUR),
			row(DRAGAN, null, null, null, AN_HOUR),
			row(BOJAN, null, null, null, AN_HOUR))).getStatus()).isEqualTo(201);

		String sentence = "Sezona 2027 je zamrznuta, pa rezultat ostaje u vašoj istoriji, a tabela, plasmani"
			+ " i nagrade te sezone se ne menjaju.";

		for (String serbian : List.of(ANA, DRAGAN)) {
			assertThat(subjectsTo(serbian)).containsExactly("Unet vam je rezultat");
			assertThat(bodiesTo(serbian).get(0)).startsWith("Liga vam je unela rezultat:")
				.contains(sentence).doesNotContain("ulazi u").doesNotContain("Za godinu");
		}

		assertThat(subjectsTo(BOJAN)).containsExactly("A result has been entered for you");
		assertThat(bodiesTo(BOJAN).get(0)).startsWith("The league has entered a result for you:")
			.contains("Season 2027 is frozen, so the result stays in your history, and the table,"
				+ " rankings and awards of that season do not change.");
		assertThat(SMTP.waitForIncomingEmail(5000, 3)).isTrue();
		assertThat(envelope()).containsExactlyInAnyOrder(ANAS_ADDRESS, DRAGANS_ADDRESS, BOJANS_ADDRESS,
			theLeague);
	}

	/**
	 * THE FREEZE IS AT SIXTEEN HUNDRED AND NOT AT THE NEW YEAR: a second before it Vera's run is told
	 * as an approval, and on the second itself Ana's is told with the sentence of a frozen season.
	 */
	@Test
	void theSentenceOfAFrozenSeasonStartsOnTheSecondOfTheFreeze() throws Exception {
		clock.moveTo(A_SECOND_BEFORE_THE_FREEZE);

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(VERA, null, null, null, AN_HOUR)))
			.getStatus()).isEqualTo(201);
		assertThat(subjectsTo(VERA).get(0)).isEqualTo("Vaš rezultat je odobren");

		clock.moveTo(THE_SECOND_OF_THE_FREEZE);

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(ANA, null, null, null, AN_HOUR)))
			.getStatus()).isEqualTo(201);
		assertThat(subjectsTo(ANA)).containsExactly("Unet vam je rezultat");
		assertThat(bodiesTo(ANA).get(0)).contains("Sezona 2027 je zamrznuta");
	}

	/**
	 * A NON-MEMBER IN THE SIXTEEN HOURS BEFORE THE FREEZE is told he holds no membership of 2027 and not
	 * that the season is frozen, which it is not yet.
	 */
	@Test
	void aSeasonThatHasNotFrozenYetIsNotToldItHas() throws Exception {
		clock.moveTo(THE_MORNING_OF_THE_NEW_YEAR);

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(DRAGAN, null, null, null, AN_HOUR)))
			.getStatus()).isEqualTo(201);
		assertThat(bodiesTo(DRAGAN).get(0)).contains("Za godinu 2027 nemate zapis o članstvu")
			.doesNotContain("zamrznuta");
	}

	/* ===================================================================== the pencil and the x */

	/**
	 * THE PENCIL CHANGES THE FIGURES AT ONCE, AND THE LETTER CARRIES THE OLD RUN BEFORE THE NEW ONE,
	 * copied to the league (PDL P9, „izmena i brisanje rade po P22 (mejl sa starom vrednošću i
	 * skrivenom kopijom ligi)"). The race stays the one it was.
	 */
	@Test
	void thePencilChangesTheFiguresAtOnceAndTellsTheOldValueBeforeTheNew() throws Exception {
		long hers = resultAlreadyCounted(ANA, theHill, LocalDate.of(2027, 5, 8), 5000, "6.68",
				"12.00", 300, 250);

		assertThat(changed(RESULTS_MODERATOR, theHill, hers, figuresBody("11.50", 280, 260, 4800))
				.getStatus()).isEqualTo(204);

		assertThat(resultsOf(ANA)).contains(figures(theHill, "11.5", 280, 260, 4800,
				BtlScoreCalculator.calculate(11.5, 280, 260, 4800)));

		String body = bodiesTo(ANA).get(0);

		assertThat(subjectsTo(ANA).get(0)).isEqualTo("Vaš rezultat je izmenjen");
		assertThat(body.indexOf("12,00 km")).isGreaterThan(0).isLessThan(body.indexOf("11,50 km"));
		assertThat(theOneLetterTo(ANAS_ADDRESS).getSubject()).isEqualTo("Vaš rezultat je izmenjen");
		assertThat(envelope()).containsExactlyInAnyOrder(ANAS_ADDRESS, theLeague);
	}

	/** On a race of a length the pencil changes the time and nothing the race fixes. */
	@Test
	void thePencilOnARaceOfALengthChangesOnlyTheTime() throws Exception {
		long veras = resultAlreadyCounted(VERA, theTen, LocalDate.of(2027, 5, 8), AN_HOUR, "5.00",
				"10.00", 100, 80);

		assertThat(changed(RESULTS_MODERATOR, theTen, veras, figuresBody("50.00", 1, 1, 3300))
				.getStatus()).isEqualTo(204);
		assertThat(resultsOf(VERA)).containsExactly(figures(theTen, "10", 100, 80, 3300,
				BtlScoreCalculator.calculate(10.0, 100, 80, 3300)));
	}

	@Test
	void thePencilRefusesARunThatIsNotWhole() throws Exception {
		long veras = resultAlreadyCounted(VERA, theHill, LocalDate.of(2027, 5, 8), AN_HOUR, "5.00",
				"10.00", 100, 80);

		MockHttpServletResponse answer = changed(RESULTS_MODERATOR, theHill, veras,
				figuresBody("10.00", 100, 80, null));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(subjectsTo(VERA)).isEmpty();
	}

	/**
	 * A RESULT IS FOUND ONLY ON ITS OWN RACE: addressed through another race of the same event it is
	 * not there, for the pencil and for the x, and neither is a result that does not exist.
	 */
	@Test
	void aResultIsFoundOnlyOnItsOwnRace() throws Exception {
		long veras = resultAlreadyCounted(VERA, theHill, LocalDate.of(2027, 5, 8), AN_HOUR, "5.00",
				"10.00", 100, 80);

		assertThat(changed(RESULTS_MODERATOR, theTen, veras, figuresBody(null, null, null, 3000))
				.getStatus()).isEqualTo(404);
		assertThat(removed(RESULTS_MODERATOR, theTen, veras).getStatus()).isEqualTo(404);
		assertThat(removed(RESULTS_MODERATOR, theHill, veras + 1000).getStatus()).isEqualTo(404);
		assertThat(resultsOf(VERA)).hasSize(1);
		assertThat(subjectsTo(VERA)).isEmpty();
	}

	/**
	 * THE PENCIL AND THE X ARE REFUSED WHILE HIS CORRECTION OF THAT RESULT WAITS (the coordinator's
	 * derivation from the decision about an entry), and a report of his for another race of the
	 * event refuses neither.
	 */
	@Test
	void thePencilAndTheXAreRefusedWhileHisCorrectionWaits() throws Exception {
		long anas = resultAlreadyCounted(ANA, theHill, LocalDate.of(2027, 5, 8), AN_HOUR, "5.00",
				"10.00", 100, 80);

		waitingFor(ANA, theHill, anas);

		MockHttpServletResponse pencil = changed(RESULTS_MODERATOR, theHill, anas,
				figuresBody("10.00", 100, 80, 3000));

		assertThat(pencil.getStatus()).isEqualTo(409);
		assertThat(reasonIn(pencil)).isEqualTo(ResultsByTheLeagueApi.HIS_SUBMISSION_WAITS);

		MockHttpServletResponse x = removed(RESULTS_MODERATOR, theHill, anas);

		assertThat(x.getStatus()).isEqualTo(409);
		assertThat(reasonIn(x)).isEqualTo(ResultsByTheLeagueApi.HIS_SUBMISSION_WAITS);
		assertThat(resultsOf(ANA)).hasSize(1);
		assertThat(subjectsTo(ANA)).isEmpty();

		long veras = resultAlreadyCounted(VERA, theHill, LocalDate.of(2027, 5, 8), AN_HOUR, "5.00",
				"10.00", 100, 80);

		waitingFor(VERA, theTen, null);

		assertThat(changed(RESULTS_MODERATOR, theHill, veras, figuresBody("10.00", 100, 80, 3000))
				.getStatus()).isEqualTo(204);
		assertThat(removed(RESULTS_MODERATOR, theHill, veras).getStatus()).isEqualTo(204);
	}

	/** THE X DELETES AT ONCE, AND THE LETTER CARRIES WHAT IT WAS, copied to the league. */
	@Test
	void theXDeletesAtOnceAndTheLetterCarriesWhatItWas() throws Exception {
		long bojans = resultAlreadyCounted(BOJAN, theHill, LocalDate.of(2027, 5, 8), 4321, "5.00",
				"13.70", 100, 80);

		assertThat(removed(RESULTS_MODERATOR, theHill, bojans).getStatus()).isEqualTo(204);

		assertThat(resultsOf(BOJAN)).isEmpty();

		MimeMessage letter = theOneLetterTo(BOJANS_ADDRESS);

		assertThat(letter.getSubject()).isEqualTo("Your result has been deleted");
		assertThat(letter.getContent().toString()).contains("13.70 km").contains("1:12:01");
		assertThat(envelope()).containsExactlyInAnyOrder(BOJANS_ADDRESS, theLeague);
		assertThat(subjectsTo(BOJAN)).containsExactly("Your result has been deleted");
	}

	/* ===================================================================== the category */

	/**
	 * AN ENTRY THAT TAKES HER OVER THE THRESHOLD CLOSES THE SEASON AFTER THE RUN'S, AND THE X OPENS IT
	 * AGAIN, each told in her inbox; Vera, who stays under it, is told nothing about it.
	 */
	@Test
	void anEntryOverTheThresholdClosesTheNextSeasonAndTheXOpensItAgain() throws Exception {
		MockHttpServletResponse answer = entered(RESULTS_MODERATOR, theTen, rows(
				row(VERA, null, null, null, AN_HOUR),
				row(ANA, null, null, null, AN_HOUR)));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(subjectsTo(VERA)).containsExactly("Vaš rezultat je odobren");
		assertThat(subjectsTo(ANA)).containsExactly("Vaš rezultat je odobren",
				"Početnička kategorija vam je zatvorena");
		assertThat(bodiesTo(ANA).get(1)).isEqualTo("Liga vam je unela rezultat sa trke Desetka od"
				+ " 08.05.2027. Time ste u zvaničnoj sezoni prešli prag od 12 bodova, pa vam je"
				+ " početnička kategorija zatvorena za sezonu 2028.");

		long anas = new ObjectMapper().readTree(answer.getContentAsString()).path("results").get(1)
				.asLong();

		assertThat(removed(RESULTS_MODERATOR, theTen, anas).getStatus()).isEqualTo(204);
		assertThat(subjectsTo(ANA).get(3)).isEqualTo("Početnička kategorija vam je ponovo otvorena");
		assertThat(bodiesTo(ANA).get(3)).contains("obrisala rezultat sa trke Desetka")
				.contains("pali ispod praga od 12 bodova").contains("za sezonu 2028.");
	}

	/** And the pencil, in both directions: slower opens it again, faster closes it. */
	@Test
	void thePencilMovesTheCategoryEitherWay() throws Exception {
		long anas = resultAlreadyCounted(ANA, theTen, LocalDate.of(2027, 5, 8), 7200, "1.14",
				"10.00", 100, 80);

		changed(RESULTS_MODERATOR, theTen, anas, figuresBody(null, null, null, AN_HOUR));

		assertThat(subjectsTo(ANA)).containsExactly("Vaš rezultat je izmenjen",
				"Početnička kategorija vam je zatvorena");
		assertThat(bodiesTo(ANA).get(1)).contains("izmenila rezultat");

		changed(RESULTS_MODERATOR, theTen, anas, figuresBody(null, null, null, 7200));

		assertThat(subjectsTo(ANA).get(3)).isEqualTo("Početnička kategorija vam je ponovo otvorena");
	}

	/**
	 * A FROZEN SEASON IS NOT ASKED ABOUT ITS CATEGORY: the run is written and told, and nothing is
	 * said about a category the freeze has already given out („zamrznute tabele su konstante").
	 */
	@Test
	void aFrozenSeasonIsNotAskedAboutItsCategory() throws Exception {
		clock.moveTo(AFTER_THE_FREEZE);

		assertThat(entered(RESULTS_MODERATOR, theTen, rows(row(ANA, null, null, null, AN_HOUR)))
				.getStatus()).isEqualTo(201);
		assertThat(subjectsTo(ANA)).containsExactly("Unet vam je rezultat");

		long anas = resultsOfIds(ANA).get(1);

		changed(RESULTS_MODERATOR, theTen, anas, figuresBody(null, null, null, 7200));
		removed(RESULTS_MODERATOR, theTen, anas);

		assertThat(subjectsTo(ANA)).containsExactly("Unet vam je rezultat",
				"Vaš rezultat je izmenjen", "Vaš rezultat je obrisan");
	}

	/* ===================================================================== helpers */

	private MockHttpServletResponse entered(String email, long race, String body) throws Exception {
		return http.perform(asking(email, post("/api/races/" + race + "/results"))
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse changed(String email, long race, long result, String body)
			throws Exception {
		return http.perform(asking(email, put("/api/races/" + race + "/results/" + result))
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse removed(String email, long race, long result) throws Exception {
		return http.perform(asking(email, delete("/api/races/" + race + "/results/" + result)))
				.andReturn().getResponse();
	}

	private JsonNode runners() throws Exception {
		MockHttpServletResponse answer = http.perform(asking(RESULTS_MODERATOR,
				get("/api/results/runners"))).andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(200);

		return new ObjectMapper().readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	/** Every request carries a CSRF token, so a refusal is never the chain's 403 instead. */
	private MockHttpServletRequestBuilder asking(String email, MockHttpServletRequestBuilder what) {
		what.with(csrf());

		return email == null ? what
				: what.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private static String rows(String... each) {
		return "{\"rows\":[" + String.join(",", each) + "]}";
	}

	private static String row(String number, String km, Integer up, Integer down, Integer seconds) {
		return "{\"memberNumber\":\"" + number + "\"," + figuresOnly(km, up, down, seconds) + "}";
	}

	private static String figuresBody(String km, Integer up, Integer down, Integer seconds) {
		return "{" + figuresOnly(km, up, down, seconds) + "}";
	}

	private static String figuresOnly(String km, Integer up, Integer down, Integer seconds) {
		return "\"distanceKm\":" + km + ",\"ascentM\":" + up + ",\"descentM\":" + down
				+ ",\"seconds\":" + seconds;
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("reason").asString();
	}

	/** The refused rows of an answer as „place reason", in the order the answer gives them. */
	private List<String> wrongRows(MockHttpServletResponse answer) throws Exception {
		List<String> wrong = new ArrayList<>();

		for (JsonNode one : new ObjectMapper().readTree(answer.getContentAsString()).path("rows")) {
			wrong.add(one.path("row").asInt() + " " + one.path("reason").asString());
		}

		return wrong;
	}

	/** A result as one line: its race, its four figures and its points. */
	private static String figures(long race, String km, int up, int down, int seconds,
			BigDecimal points) {
		return race + ": " + new BigDecimal(km).stripTrailingZeros().toPlainString() + " km, up " + up
				+ ", down " + down + ", " + seconds + " s, " + points.stripTrailingZeros().toPlainString();
	}

	private List<String> resultsOf(String number) {
		return db.sql("select r.race_id, r.distance_km, r.ascent_m, r.descent_m, r.seconds, r.points"
						+ " from result r join competitor c on c.id = r.competitor_id"
						+ " where c.member_number = ? and r.race_id <> ? order by r.id")
				.params(number, theOtherEventsRace)
				.query((row, one) -> figures(row.getLong(1), row.getBigDecimal(2).toPlainString(),
						row.getInt(3), row.getInt(4), row.getInt(5), row.getBigDecimal(6)))
				.list();
	}

	private List<Long> resultsOfIds(String number) {
		return db.sql("select r.id from result r join competitor c on c.id = r.competitor_id"
						+ " where c.member_number = ? order by r.id")
				.param(number).query(Long.class).list();
	}

	private List<String> subjectsTo(String number) {
		return db.sql("select subject from message where to_id = (select id from competitor where"
						+ " member_number = ?) order by id")
				.param(number).query(String.class).list();
	}

	private List<String> bodiesTo(String number) {
		return db.sql("select body from message where to_id = (select id from competitor where"
						+ " member_number = ?) order by id")
				.param(number).query(String.class).list();
	}

	/** No line to anybody but him, and none addressed to everybody (V13: empty means all). */
	private boolean nobodyElseWasWrittenTo(String number) {
		return db.sql("select count(*) from message where to_id is null or to_id <>"
						+ " (select id from competitor where member_number = ?)")
				.param(number).query(Integer.class).single() == 0;
	}

	/** Every address the relay was asked to deliver to, the blind copy among them. */
	private List<String> envelope() {
		return SMTP.getUserManager().listUser().stream().map(GreenMailUser::getEmail).toList();
	}

	/** The one letter that went out, and it names only him in its headers. */
	private MimeMessage theOneLetterTo(String address) throws Exception {
		assertThat(SMTP.waitForIncomingEmail(5000, 1)).as("no letter went out").isTrue();

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(Arrays.stream(arrived[0].getAllRecipients()).map(Object::toString))
				.containsExactly(address);

		return arrived[0];
	}

	private void member(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true,"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, String.format("%016x", ++issued))
				.update();
	}

	private void withoutANumber(String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (null, ?, ?, 'M', date '1991-01-01',"
						+ " (select id from place where rank = 1), 2027, false, false,"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(first, last, String.format("%016x", ++issued))
				.update();
	}

	private void account(String email, String role, String first, String last, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values (?, ?, ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(first, last, email, role, member).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private void membership(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}

	/** A membership taken away again, for the case that needs a member without the one the fixture gave. */
	private void withoutAMembership(String number, int season) {
		db.sql("delete from membership where competitor_id = (select id from competitor where"
			+ " member_number = ?) and season = ?").params(number, season).update();
	}

	/** A race of 2028, which the clock has to be inside 2028 or later to enter a result for. */
	private long aRaceOf2028(String slug, LocalDate day) {
		return race(event(slug, "Dogadjaj " + slug, day), "Zimska desetka", day, "length", 0, "10.00", 0, 0);
	}

	private long event(String slug, String name, LocalDate date) {
		return db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
						+ " description, link) values (?, ?, ?,"
						+ " (select id from place where rank = 1), 'race', false, '', '')"
						+ " returning id")
				.params(slug, name, date)
				.query(Long.class).single();
	}

	private long race(long event, String name, LocalDate day, String kind, int limit,
			String distance, int ascent, int descent) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, ?, ?, ?, cast(? as numeric), ?, ?) returning id")
				.params(event, name, day, kind, limit, distance, ascent, descent)
				.query(Long.class).single();
	}

	private long resultAlreadyCounted(String number, long race, LocalDate day, int seconds,
			String points) {
		return resultAlreadyCounted(number, race, day, seconds, points, "10.00", 50, 50);
	}

	private long resultAlreadyCounted(String number, long race, LocalDate day, int seconds,
			String points, String distance, int ascent, int descent) {
		return db.sql("insert into result (competitor_id, race_id, race_date, distance_km,"
						+ " ascent_m, descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?), ?, ?,"
						+ " cast(? as numeric), ?, ?, ?, cast(? as numeric)) returning id")
				.params(number, race, day, distance, ascent, descent, seconds, points)
				.query(Long.class).single();
	}

	/** A report waiting for a race, or a correction of a result where {@code amends} names one. */
	private void waitingFor(String number, long race, Long amends) {
		long submission = submission(number, race, amends);

		db.sql("insert into verification (queue, competitor_id, subject, body, result_submission_id)"
						+ " values ('results', (select id from competitor where member_number = ?),"
						+ " 'Rezultat', '', ?)")
				.params(number, submission).update();
	}

	private void refusedFor(String number, long race) {
		long submission = submission(number, race, null);

		db.sql("insert into verification (queue, competitor_id, subject, body, result_submission_id,"
						+ " state, decided_at, decided_by_name, reason)"
						+ " values ('results', (select id from competitor where member_number = ?),"
						+ " 'Rezultat', '', ?, 'rejected', now(), 'Neko Drugi', 'Nema dokaza')")
				.params(number, submission).update();
	}

	private long submission(String number, long race, Long amends) {
		return db.sql("insert into result_submission (competitor_id, race_id, race_date, distance_km,"
						+ " ascent_m, descent_m, seconds, link, comment, amends_result_id)"
						+ " values ((select id from competitor where member_number = ?), ?,"
						+ " (select date from race where id = ?), 10.00, 100, 80, 3600,"
						+ " 'https://primer.rs/rezultati', '', ?) returning id")
				.params(number, race, race, amends)
				.query(Long.class).single();
	}
}

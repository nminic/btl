package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.mail.WhatAResultChangeSays;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.season.SeasonClock;
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
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A CORRECTED RACE IS A CORRECTION OF EVERY RUN ALREADY COUNTED AT IT, END TO END.
 *
 * <p>PDL P4, the owner's decision of 20.09.2026, in his own words: „Upisao bih nule, a onda
 * kad jednog dana promenim, portal treba da preracuna i bodove osim ako je sezona zamrznuta."
 * {@code RaceWriteApi.change} carries the decision, the two derivations put to the owner on
 * 09.10.2026 (every figure the race fixes, not only the climb and the fall; and a save that
 * moves nothing the race fixes recounts nothing), and his three answers of 10.10.2026 (PDL P4,
 * „Preračun bodova pri izmeni mera trke: tri odgovora (PR 504)"): a race that carries an
 * approved run keeps its kind, refused with a reason; a frozen season and a year before the
 * first one count nothing again; and a member whose run moved is told in his inbox, with the
 * run as it was and as it is, and again when it closes or opens his beginners' category for
 * the next season - never by post.
 *
 * <p><b>THE FIXTURE IS BUILT SO THAT EVERY VALUE A CASE READS CAN ARRIVE FROM ONE PLACE
 * ONLY.</b>
 *
 * <ul>
 * <li><b>The race corrected and the races not corrected are three.</b> {@link #theMarathon}
 * is corrected; {@link #itsHalf} runs under the same event and {@link #anotherEventsTen}
 * under another, and both carry runs whose points the formula would never give
 * ({@link #NOT_WHAT_THE_FORMULA_GIVES}), so a recount that reached them shows.
 * <li><b>The runs at the marathon are four and none is the only one of its kind:</b> one
 * runner twice, at two different times, a second runner whose fee has lapsed, and a fourth
 * whose run already stands at the course the correction writes. A recount that took one run
 * per member, or the first run's time for all, or only active members, answers differently
 * from one that took every row; and a line about a run the correction did not move is a line
 * about nothing.
 * <li><b>A figure the race fixes and a figure the runner brings are never the same
 * number.</b> The marathon's climb is unlike its fall, before and after, so a recount that
 * swapped them shows; six hours carry a climb and a fall of their own that are unlike both
 * runners', so a recount that read the race's climb into a run to a limit shows.
 * <li><b>The race as it was and the race as it is are told apart in the line a member
 * reads:</b> the correction of the marathon also renames it and moves it a day, so the run as
 * it was and the run as it is name two different races on two different days.
 * <li><b>Who is told is told apart from who is not:</b> the members whose runs moved; the
 * member whose run did not; the member with only a WAITING run at the marathon; and the whole
 * league, which a line with no addressee would reach (V13).
 * <li><b>The season a race is in and the season the clock is in are told apart at one
 * instant:</b> half an hour after the freeze, a race of 2027 (frozen) and a race of
 * 1 January 2028 (running) are corrected side by side.
 * <li><b>A run still waiting and a submission already decided stand at the marathon</b>, so
 * a recount that reached {@code result_submission} shows; and a race that carries ONLY a
 * waiting run ({@link #aCrossCountry}) may still change its kind.
 * <li><b>A member just under the beginners' threshold and nowhere near it run the same
 * race</b> ({@link #anotherEventsTen}), so a correction of it moves one category and not the
 * other.
 * </ul>
 *
 * <p><b>Where the formula is asked, it is asked and not typed</b>, the shape
 * {@code VerificationWriteApiTest} keeps: {@link BtlScoreCalculator} is the one home for it
 * and its golden set is untouchable.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ARaceCorrectedRecountsItsRunsTest {

	private static final String MODERATOR = "kalendar@primer.rs";

	/** Noon in Belgrade, with 2027 running and nowhere near a freeze. */
	private static final Instant WHILE_2027_RUNS = Instant.parse("2027-10-15T10:00:00Z");

	/** 15:59:59 in Belgrade on 1 January 2028: 2027 has stopped taking reports at ten and
	 *  has not frozen yet. */
	private static final Instant A_SECOND_BEFORE_THE_FREEZE = Instant.parse("2028-01-01T14:59:59Z");

	/** 16:30 in Belgrade on the same day, and 15:30 on a clock that reads UTC, which is still
	 *  before four: a server reading the machine's zone thinks 2027 has not frozen. */
	private static final Instant HALF_AN_HOUR_AFTER_THE_FREEZE =
			Instant.parse("2028-01-01T15:30:00Z");

	/** Noon in Belgrade in October 2026, when 2026 is no season and has not "frozen" either. */
	private static final Instant WHILE_2026_IS_HISTORY = Instant.parse("2026-10-15T10:00:00Z");

	/** Points no run at these races would ever be counted at, so a recount that reached a
	 *  run carrying them leaves a different number behind. */
	private static final BigDecimal NOT_WHAT_THE_FORMULA_GIVES = new BigDecimal("12.34");

	private static final LocalDate THE_MARATHONS_DAY = LocalDate.parse("2027-05-09");

	private static final LocalDate SIX_HOURS_DAY = LocalDate.parse("2027-06-12");

	private static final LocalDate THE_FREE_ONES_DAY = LocalDate.parse("2027-07-03");

	private static final LocalDate THE_TENS_DAY = LocalDate.parse("2027-09-05");

	private static final LocalDate NEW_YEARS_DAY = LocalDate.parse("2028-01-01");

	private static final LocalDate A_DAY_OF_HISTORY = LocalDate.parse("2026-04-12");

	/** What a line in the inbox about a run counted again is called. */
	private static final String RECOUNTED = "Vaš rezultat je preračunat";

	/** The member who runs the marathon twice. */
	private static final String RUNNER = "000901";

	/** The member whose fee has lapsed, which takes nothing away from his record. */
	private static final String LAPSED = "000902";

	/** A member with a waiting run at the marathon and counted runs elsewhere. */
	private static final String A_THIRD = "000903";

	/** A member whose run at the marathon already stands at the course the correction writes. */
	private static final String ALREADY_THERE = "000904";

	/** A member whose one run of 2027 is the ten, just under the beginners' threshold. */
	private static final String ROOKIE = "000905";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private String session;

	private long theMarathon;

	private long itsHalf;

	private long aCrossCountry;

	private long anotherEventsTen;

	private long sixHours;

	private long theFreeOne;

	private long newYearsRace;

	private long aRaceOfHistory;

	private long runner;

	private long lapsed;

	private long third;

	private long alreadyThere;

	private long rookie;

	private long runnersFirst;

	private long runnersSecond;

	private long lapsedRun;

	private long alreadyThereRun;

	private long runAtTheHalf;

	private long runAtTheTen;

	private long rookiesRun;

	private long runnersSixHours;

	private long thirdsSixHours;

	private long runAtTheFreeOne;

	private long runOnNewYearsDay;

	private long runOfHistory;

	private long waitingSubmission;

	private long decidedSubmission;

	/** The last line any inbox held when the fixture was written, so a case reads only the
	 *  lines its own request wrote. */
	private long linesBefore;

	/**
	 * A CLOCK THE CASE MOVES, so that four moments around two New Years are one fixture.
	 *
	 * <p>The shape {@code LeagueWriteApiTest} uses, and for its reason: it reports UTC as its zone
	 * on purpose, so a server that reads this zone instead of re-reading the instant in the
	 * league's own time answers with the wrong side of 16:00 on the one afternoon that matters.
	 */
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
			return new AClockTheCaseMoves(WHILE_2027_RUNS);
		}
	}

	/**
	 * EIGHT RACES OVER SIX EVENTS, TWELVE RUNS, THREE SUBMISSIONS AND ONE MODERATOR.
	 *
	 * <p>Every run a case expects to be counted again is written at the points the formula gives
	 * for its figures today, so „counted again at the old figures" and „not counted again" are
	 * the same answer and both fail. Every run a case expects to stay is written at
	 * {@link #NOT_WHAT_THE_FORMULA_GIVES}, or carries figures the correction moves, so a recount
	 * that reached it cannot leave it as it was.
	 */
	@BeforeEach
	void eightRacesTwelveRunsAndThreeSubmissions() {
		clock.moveTo(WHILE_2027_RUNS);

		event("maraton-2027", "Prolecni maraton", THE_MARATHONS_DAY);
		event("sest-sati-2027", "Sest sati", SIX_HOURS_DAY);
		event("slobodna-2027", "Slobodna trka", THE_FREE_ONES_DAY);
		event("desetka-2027", "Jesenja desetka", THE_TENS_DAY);
		event("novogodisnja-2028", "Novogodisnja trka", NEW_YEARS_DAY);
		event("istorija-2026", "Stara trka", A_DAY_OF_HISTORY);

		theMarathon = race("maraton-2027", "Maraton", THE_MARATHONS_DAY, "length", 0, "42.2", 300, 280);
		itsHalf = race("maraton-2027", "Polumaraton", THE_MARATHONS_DAY, "length", 0, "21.1", 150, 140);
		aCrossCountry = race("maraton-2027", "Kros", THE_MARATHONS_DAY, "length", 0, "5", 50, 50);
		sixHours = race("sest-sati-2027", "Sest sati", SIX_HOURS_DAY, "time", 21600, "0", 350, 410);
		theFreeOne = race("slobodna-2027", "Slobodna", THE_FREE_ONES_DAY, "free", 0, "0", 200, 210);
		anotherEventsTen = race("desetka-2027", "Desetka", THE_TENS_DAY, "length", 0, "10", 120, 110);
		newYearsRace = race("novogodisnja-2028", "Novogodisnja", NEW_YEARS_DAY, "length", 0, "5", 40, 30);
		aRaceOfHistory = race("istorija-2026", "Stara", A_DAY_OF_HISTORY, "length", 0, "21.1", 100, 90);

		runner = competitor(RUNNER, "0011223344556601");
		lapsed = competitor(LAPSED, "0011223344556602");
		third = competitor(A_THIRD, "0011223344556603");
		alreadyThere = competitor(ALREADY_THERE, "0011223344556604");
		rookie = competitor(ROOKIE, "0011223344556605");

		/* THE MEMBER WHOSE FEE HAS LAPSED, the precedent's own statement
		   (`PairWriteApiTest`, `CommentApiTest`): his record stays his and a correction of the
		   race reaches it like anybody's. */
		db.sql("update competitor set active = false where member_number = ?").param(LAPSED).update();

		runnersFirst = result(runner, theMarathon, "42.2", 300, 280, 12600, counted("42.2", 300, 280, 12600));
		runnersSecond = result(runner, theMarathon, "42.2", 300, 280, 13800, counted("42.2", 300, 280, 13800));
		lapsedRun = result(lapsed, theMarathon, "42.2", 300, 280, 15000, counted("42.2", 300, 280, 15000));
		alreadyThereRun = result(alreadyThere, theMarathon, "42.195", 520, 310, 16000,
				counted("42.195", 520, 310, 16000));
		runAtTheHalf = result(runner, itsHalf, "21.1", 150, 140, 6000, NOT_WHAT_THE_FORMULA_GIVES);
		runAtTheTen = result(third, anotherEventsTen, "10", 120, 110, 2700, NOT_WHAT_THE_FORMULA_GIVES);
		rookiesRun = result(rookie, anotherEventsTen, "10", 120, 110, 2700, counted("10", 120, 110, 2700));
		runnersSixHours = result(runner, sixHours, "61.3", 120, 130, 21600, counted("61.3", 120, 130, 21600));
		thirdsSixHours = result(third, sixHours, "55", 90, 80, 21600, counted("55", 90, 80, 21600));
		runAtTheFreeOne = result(lapsed, theFreeOne, "8.5", 60, 70, 3100, NOT_WHAT_THE_FORMULA_GIVES);
		runOnNewYearsDay = result(third, newYearsRace, "5", 40, 30, 1500, counted("5", 40, 30, 1500));
		runOfHistory = result(runner, aRaceOfHistory, "21.1", 100, 90, 6300, counted("21.1", 100, 90, 6300));

		waitingSubmission = submission(third, theMarathon, "42.2", 300, 280, 14400);
		queued(third, waitingSubmission, false);
		decidedSubmission = submission(runner, theMarathon, "42.2", 300, 280, 12600);
		queued(runner, decidedSubmission, true);
		queued(runner, submission(runner, aCrossCountry, "5", 50, 50, 1300), false);

		session = account(MODERATOR);
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'entity:events')")
				.param(MODERATOR).update();

		linesBefore = db.sql("select coalesce(max(id), 0) from message").query(Long.class).single();
	}

	/**
	 * THE MOMENTS THESE CASES STAND AT ANSWER THE WAY THE CASES NEED, asked of
	 * {@link SeasonClock} itself rather than assumed.
	 *
	 * <p>Without this the cases below could go on passing on a fixture that no longer
	 * separates what they claim to separate: a freeze moved to ten in the morning would make
	 * the case a second before four measure nothing, and an October of 2026 that counted as
	 * frozen would make the case about history measure the freeze instead.
	 */
	@Test
	void theMomentsTheseCasesStandAtAnswerTheWayTheCasesNeed() {
		assertThat(SeasonClock.isFrozen(2027, at(WHILE_2027_RUNS))).isFalse();
		assertThat(SeasonClock.isFrozen(2027, at(A_SECOND_BEFORE_THE_FREEZE)))
				.as("a second before four, 2027 has frozen already, so that case measures nothing")
				.isFalse();
		assertThat(at(A_SECOND_BEFORE_THE_FREEZE).isAfter(SeasonClock.reportingEnds(2027)))
				.as("that second must stand after the end of reporting, or it cannot tell the two"
						+ " moments apart")
				.isTrue();
		assertThat(SeasonClock.isFrozen(2027, at(HALF_AN_HOUR_AFTER_THE_FREEZE))).isTrue();
		assertThat(SeasonClock.isFrozen(2028, at(HALF_AN_HOUR_AFTER_THE_FREEZE))).isFalse();
		assertThat(LocalTime.ofInstant(HALF_AN_HOUR_AFTER_THE_FREEZE, ZoneOffset.UTC))
				.as("half past four in Belgrade must read before four on a clock in UTC, or the"
						+ " case cannot tell the two zones apart")
				.isBefore(LocalTime.of(16, 0));
		assertThat(SeasonClock.isFrozen(2026, at(WHILE_2026_IS_HISTORY)))
				.as("2026 must not be frozen yet in October 2026, or the case about history"
						+ " measures the freeze and not the first season")
				.isFalse();
	}

	/**
	 * A CORRECTED COURSE REACHES EVERY RUN AT THE RACE, AND NOT ONE ROW ANYWHERE ELSE, AND EACH
	 * MEMBER WHOSE RUN MOVED IS TOLD IN HIS INBOX AND NOBODY ELSE IS.
	 *
	 * <p>The marathon is corrected to 42,195 km with a climb of 520 m and a fall of 310 m, and
	 * renamed and moved a day in the same request. Each of its three runs at the old course -
	 * the same runner's two and the lapsed member's one - comes back at the race's new course,
	 * its own time, the points the formula gives for those four, and the category 42,195 is
	 * (PDL P5: not a marathon but a longer race). The run already at the new course stays as it
	 * was. The half under the same event, the ten under another, and the two submissions at the
	 * marathon itself stay exactly as they were.
	 *
	 * <p>PDL P4, the owner's answer of 10.10.2026, in the journal's wording: „red u sandučetu sa
	 * starom i novom vrednošću", „mejl ne ide". One line per run that moved, to its member: the
	 * runner reads two, the lapsed member one, the member whose run did not move none, the member
	 * with only a waiting run at the marathon none, and no line is addressed to everybody.
	 */
	@Test
	void aCorrectedCourseReachesEveryRunAtTheRaceAndOnlyItsMembersAreTold() throws Exception {
		Map<Long, Run> untouched = rowsOf(runAtTheHalf, runAtTheTen, alreadyThereRun);
		List<Object> submissionsBefore = List.of(submitted(waitingSubmission),
				submitted(decidedSubmission));

		for (int seconds : new int[] {12600, 13800, 15000}) {
			theFormulaTellsTheseApart(seconds);
		}

		assertThat(change(theMarathon, ofALength("Maraton Avala", THE_MARATHONS_DAY.plusDays(1),
				"42.195", 520, 310)).getStatus()).isEqualTo(200);

		assertThat(rowOf(runnersFirst)).as("the runner's first run").isEqualTo(
				countedAt("42.195", 520, 310, 12600, "long"));
		assertThat(rowOf(runnersSecond)).as("the runner's second run, at a time of its own")
				.isEqualTo(countedAt("42.195", 520, 310, 13800, "long"));
		assertThat(rowOf(lapsedRun)).as("the run of the member whose fee has lapsed")
				.isEqualTo(countedAt("42.195", 520, 310, 15000, "long"));

		assertThat(rowsOf(runAtTheHalf, runAtTheTen, alreadyThereRun))
				.as("a run at another race, or one the correction did not move, was written over")
				.isEqualTo(untouched);
		assertThat(List.of(submitted(waitingSubmission), submitted(decidedSubmission)))
				.as("a submission at the race was written over").isEqualTo(submissionsBefore);

		assertThat(linesTo(runner)).as("the runner reads one line for each of his two runs")
				.extracting(Line::subject).containsExactly(RECOUNTED, RECOUNTED);
		assertThat(linesTo(runner).get(0).body()).contains(asItWasAndAsItIs(12600));
		assertThat(linesTo(runner).get(1).body()).contains(asItWasAndAsItIs(13800));
		assertThat(linesTo(lapsed)).extracting(Line::subject).containsExactly(RECOUNTED);
		assertThat(linesTo(lapsed).get(0).body()).contains(asItWasAndAsItIs(15000));
		assertThat(linesTo(alreadyThere)).as("a line about a run the correction did not move")
				.isEmpty();
		assertThat(linesTo(third)).as("a line about a run that is still waiting").isEmpty();
		assertThat(newLines()).as("a line nobody but its own three members should have read")
				.hasSize(3).allSatisfy(line -> assertThat(line.to()).isNotNull());
	}

	/**
	 * A CORRECTED LIMIT REACHES EVERY RUN AT A RACE TO A LIMIT, AND EACH RUNNER KEEPS WHAT HE
	 * COVERED.
	 *
	 * <p>PDL P4, 29.08.2026, in the journal's wording: on a race to a limit {@code Tsec} is the
	 * race's own limit, the same for everyone who finished it, while the length, the climb and
	 * the fall are the runner's. Six hours become twenty four: both runs take the new limit and
	 * keep their own course, which is unlike the race's own climb and fall.
	 */
	@Test
	void aCorrectedLimitReachesEveryRunAndEachRunnerKeepsWhatHeCovered() throws Exception {
		assertThat(BtlScoreCalculator.calculate(61.3, 350, 130, 86400))
				.as("the race's climb read into the run would have to come out different")
				.isNotEqualByComparingTo(BtlScoreCalculator.calculate(61.3, 120, 130, 86400));
		assertThat(BtlScoreCalculator.calculate(61.3, 120, 130, 21600))
				.as("the run's old time would have to come out different")
				.isNotEqualByComparingTo(BtlScoreCalculator.calculate(61.3, 120, 130, 86400));

		assertThat(change(sixHours, toALimit("Sest sati", SIX_HOURS_DAY, 86400, 350, 410))
				.getStatus()).isEqualTo(200);

		assertThat(rowOf(runnersSixHours)).isEqualTo(countedAt("61.3", 120, 130, 86400, "ultra"));
		assertThat(rowOf(thirdsSixHours)).isEqualTo(countedAt("55", 90, 80, 86400, "ultra"));
		assertThat(linesTo(runner)).extracting(Line::subject).containsExactly(RECOUNTED);
		assertThat(linesTo(third)).extracting(Line::subject).containsExactly(RECOUNTED);
	}

	/**
	 * THE SAME COURSE SENT AGAIN, AT ANOTHER SCALE AND UNDER ANOTHER NAME AND DAY, COUNTS
	 * NOTHING AGAIN AND TELLS NOBODY.
	 *
	 * <p>The screen sends every race of an event each time the event is saved, so this is the
	 * ordinary request and not a curiosity. The length goes out as {@code 42.20} against the
	 * {@code 42.2000} the column reads back, the name changes and the day moves inside 2027.
	 * The marathon's runs are put at points the formula would not give them first, so a
	 * recount over the same course would still leave a trace.
	 */
	@Test
	void theSameCourseSentAgainCountsNothingAgainAndTellsNobody() throws Exception {
		db.sql("update result set points = ? where race_id = ?")
				.params(NOT_WHAT_THE_FORMULA_GIVES, theMarathon).update();
		Map<Long, Run> before = rowsOf(runnersFirst, runnersSecond, lapsedRun, alreadyThereRun,
				runAtTheHalf, runAtTheTen);

		assertThat(change(theMarathon, ofALength("Maraton pod drugim imenom",
				THE_MARATHONS_DAY.plusDays(1), "42.20", 300, 280)).getStatus()).isEqualTo(200);

		assertThat(rowsOf(runnersFirst, runnersSecond, lapsedRun, alreadyThereRun, runAtTheHalf,
				runAtTheTen))
				.as("a save that moved nothing the race fixes counted a run again")
				.isEqualTo(before);
		assertThat(newLines()).as("a save that moved nothing told somebody something").isEmpty();
	}

	/**
	 * A FIGURE THE KIND DOES NOT FIX MOVES NO RUN: the climb and the fall of a race to a limit,
	 * and of a free race.
	 */
	@Test
	void aFigureTheKindDoesNotFixMovesNoRun() throws Exception {
		db.sql("update result set points = ? where race_id = ?")
				.params(NOT_WHAT_THE_FORMULA_GIVES, sixHours).update();
		Map<Long, Run> before = rowsOf(runnersSixHours, thirdsSixHours, runAtTheFreeOne);

		assertThat(change(sixHours, toALimit("Sest sati", SIX_HOURS_DAY, 21600, 500, 600))
				.getStatus()).isEqualTo(200);
		assertThat(change(theFreeOne, free("Slobodna", THE_FREE_ONES_DAY, 333, 222)).getStatus())
				.isEqualTo(200);

		assertThat(rowsOf(runnersSixHours, thirdsSixHours, runAtTheFreeOne))
				.as("a climb or a fall that is in no run's score counted a run again")
				.isEqualTo(before);
		assertThat(newLines()).isEmpty();
	}

	/**
	 * PDL P4, THE OWNER'S ANSWER OF 10.10.2026: A RACE THAT CARRIES AN APPROVED RUN KEEPS ITS
	 * KIND, AND NOTHING IS LOST.
	 *
	 * <p>In the journal's wording: „Promena VRSTE trke koja već ima odobrene rezultate se odbija
	 * uz razlog (409), kao pomeranje trke preko 1. januara; ništa se ne gubi." The review of this
	 * route measured what it closes: the marathon turned into six hours left its runs as they
	 * were, and the NEXT save, correcting only the limit, took every runner's real time away for
	 * good. So both saves are sent here, and both are refused.
	 *
	 * <p>The other side of the line: a race that carries only a WAITING run changes its kind,
	 * because a waiting run is counted at its approval against the race as it stands then.
	 */
	@Test
	void aRaceWithACountedRunKeepsItsKindAndNothingIsLost() throws Exception {
		Map<Long, Run> before = rowsOf(runnersFirst, runnersSecond, lapsedRun, alreadyThereRun);

		MockHttpServletResponse toSixHours = change(theMarathon,
				toALimit("Maraton", THE_MARATHONS_DAY, 21600, 300, 280));
		MockHttpServletResponse thenItsLimit = change(theMarathon,
				toALimit("Maraton", THE_MARATHONS_DAY, 25200, 300, 280));

		/* THE HARM FIRST, so that a route which let the change of kind through fails here on the
		   runner's lost time - the finding itself - and not only on a status code. */
		assertThat(rowsOf(runnersFirst, runnersSecond, lapsedRun, alreadyThereRun))
				.as("a runner's own time was written over").isEqualTo(before);
		assertThat(List.of(toSixHours.getStatus(), thenItsLimit.getStatus()))
				.containsExactly(409, 409);
		assertThat(List.of(reasonIn(toSixHours), reasonIn(thenItsLimit))).containsOnly(
				RaceWriteApi.THE_KIND_CANNOT_CHANGE_ONCE_RUNS_ARE_COUNTED);
		assertThat(kindOf(theMarathon)).as("the race took the kind it was refused")
				.isEqualTo("length");
		assertThat(newLines()).isEmpty();

		assertThat(change(aCrossCountry, toALimit("Kros", THE_MARATHONS_DAY, 3600, 50, 50))
				.getStatus()).as("a race with only a waiting run at it kept its kind")
				.isEqualTo(200);
		assertThat(kindOf(aCrossCountry)).isEqualTo("time");
	}

	/**
	 * A REFUSED EDIT COUNTS NOTHING AGAIN, and it is a real hazard and not a formality: a
	 * refusal the route RETURNS commits whatever was written before it.
	 *
	 * <p>PDL P10b refuses the marathon carried across 1 January with its runs; the same request
	 * corrects its climb, so a recount that ran before the refusal would stand under the 409.
	 */
	@Test
	void aRefusedEditCountsNothingAgain() throws Exception {
		Map<Long, Run> before = rowsOf(runnersFirst, runnersSecond, lapsedRun);

		MockHttpServletResponse answer = change(theMarathon,
				ofALength("Maraton", LocalDate.parse("2026-12-30"), "42.2", 520, 280));

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(RaceWriteApi.THE_DATE_WOULD_MOVE_A_RESULT_TO_ANOTHER_YEAR);
		assertThat(rowsOf(runnersFirst, runnersSecond, lapsedRun))
				.as("a refused edit counted the runs again").isEqualTo(before);
		assertThat(newLines()).isEmpty();
	}

	/**
	 * A CORRECTION THAT CARRIES A MEMBER OVER THE BEGINNERS' THRESHOLD CLOSES HIS CATEGORY FOR
	 * THE NEXT SEASON, AND HE IS TOLD.
	 *
	 * <p>PDL P4, the owner's answer of 10.10.2026, in the journal's wording: „poruku o
	 * početničkoj kategoriji kad joj preračun zatvori ili ponovo otvori pravo, u oba smera". The
	 * ten is corrected from 10 to 12 km: the rookie's one run of 2027 goes from under twelve
	 * points to over it, so the beginners' category closes for 2028, the season after the
	 * race's. The other member at the ten was over the threshold before and is over it after:
	 * he reads the line about his run and nothing about his category.
	 */
	@Test
	void aCorrectionThatCarriesAMemberOverTheThresholdClosesHisCategoryAndHeIsTold()
			throws Exception {
		assertThat(counted("10", 120, 110, 2700)).isLessThan(new BigDecimal("12"));
		assertThat(counted("12", 120, 110, 2700)).isGreaterThanOrEqualTo(new BigDecimal("12"));

		assertThat(change(anotherEventsTen, ofALength("Desetka", THE_TENS_DAY, "12", 120, 110))
				.getStatus()).isEqualTo(200);

		assertThat(linesTo(rookie)).extracting(Line::subject).containsExactly(RECOUNTED,
				"Početnička kategorija vam je zatvorena");
		assertThat(linesTo(rookie).get(1).body())
				.contains("Ispravljene su mere trke Desetka od 05.09.2027")
				.contains("prešli prag od 12 bodova")
				.contains("zatvorena za sezonu 2028.");
		assertThat(linesTo(third)).extracting(Line::subject).containsExactly(RECOUNTED);
	}

	/**
	 * AND A CORRECTION THAT TAKES HIM BACK UNDER IT OPENS THE CATEGORY AGAIN, AND HE IS TOLD
	 * THAT TOO - the other direction of the same answer.
	 */
	@Test
	void aCorrectionThatTakesAMemberBackUnderTheThresholdOpensHisCategoryAgainAndHeIsTold()
			throws Exception {
		db.sql("update result set seconds = 2400, points = ? where id = ?")
				.params(counted("10", 120, 110, 2400), rookiesRun).update();
		assertThat(counted("10", 120, 110, 2400)).isGreaterThanOrEqualTo(new BigDecimal("12"));
		assertThat(counted("9.5", 120, 110, 2400)).isLessThan(new BigDecimal("12"));

		assertThat(change(anotherEventsTen, ofALength("Desetka", THE_TENS_DAY, "9.5", 120, 110))
				.getStatus()).isEqualTo(200);

		assertThat(linesTo(rookie)).extracting(Line::subject).containsExactly(RECOUNTED,
				"Početnička kategorija vam je ponovo otvorena");
		assertThat(linesTo(rookie).get(1).body())
				.contains("pali ispod praga od 12 bodova")
				.contains("ponovo otvorena za sezonu 2028.");
		assertThat(linesTo(third)).extracting(Line::subject).containsExactly(RECOUNTED);
	}

	/**
	 * IN THE SIX HOURS BEFORE THE FREEZE, A RACE OF THE SEASON JUST ENDED IS STILL COUNTED
	 * AGAIN.
	 *
	 * <p>PDL P9: the season ends at midnight, reporting at ten, and the tables freeze at four -
	 * „Šest sati između dva roka je prostor da administrator stigne da verifikuje poslednje
	 * prijave." A correction a second before four is a correction of a season still being
	 * counted.
	 */
	@Test
	void inTheSixHoursBeforeTheFreezeARaceOfTheSeasonJustEndedIsStillCountedAgain() throws Exception {
		clock.moveTo(A_SECOND_BEFORE_THE_FREEZE);

		assertThat(change(theMarathon, ofALength("Maraton", THE_MARATHONS_DAY, "42.195", 520, 310))
				.getStatus()).isEqualTo(200);

		assertThat(rowOf(runnersFirst)).isEqualTo(countedAt("42.195", 520, 310, 12600, "long"));
		assertThat(rowOf(lapsedRun)).isEqualTo(countedAt("42.195", 520, 310, 15000, "long"));
	}

	/**
	 * PDL P4, THE OWNER'S ANSWER OF 10.10.2026: AFTER THE FREEZE A RACE OF THE FROZEN SEASON
	 * COUNTS NOTHING AGAIN, WHILE A RACE OF THE SEASON NOW RUNNING DOES, AT THE SAME INSTANT.
	 *
	 * <p>In the journal's wording: „U zamrznutoj sezoni i u istoriji pre 2027 izmena mera trke ne
	 * menja ništa, ni profil ni tabelu". The pair is what makes the season asked the RACE'S: a
	 * route asking the clock's year would count the marathon of 2027 again, and one asking the
	 * year before the clock's would leave the race of 1 January 2028.
	 */
	@Test
	void afterTheFreezeARaceOfTheFrozenSeasonCountsNothingAgainWhileOneOfTheRunningSeasonDoes()
			throws Exception {
		clock.moveTo(HALF_AN_HOUR_AFTER_THE_FREEZE);
		Map<Long, Run> frozen = rowsOf(runnersFirst, runnersSecond, lapsedRun);

		assertThat(change(theMarathon, ofALength("Maraton", THE_MARATHONS_DAY, "42.195", 520, 310))
				.getStatus()).isEqualTo(200);
		assertThat(change(newYearsRace, ofALength("Novogodisnja", NEW_YEARS_DAY, "5.2", 60, 45))
				.getStatus()).isEqualTo(200);

		assertThat(rowsOf(runnersFirst, runnersSecond, lapsedRun))
				.as("a race of a frozen season counted its runs again").isEqualTo(frozen);
		assertThat(rowOf(runOnNewYearsDay)).as("a race of the season now running")
				.isEqualTo(countedAt("5.2", 60, 45, 1500, "short"));
		assertThat(newLines()).as("only the run of the season now running is told about")
				.extracting(Line::to).containsExactly(third);
	}

	/**
	 * PDL P4, THE OWNER'S ANSWER OF 10.10.2026: A RACE FROM BEFORE THE FIRST SEASON COUNTS
	 * NOTHING AGAIN.
	 *
	 * <p>PDL P12: „Nigde na portalu nema sezone pre 2027." The clock stands in October 2026,
	 * when {@link SeasonClock#isFrozen} does not yet hold 2026 frozen, so what keeps the run
	 * of history as it was is the first season and nothing else.
	 */
	@Test
	void aRaceFromBeforeTheFirstSeasonCountsNothingAgain() throws Exception {
		clock.moveTo(WHILE_2026_IS_HISTORY);
		Map<Long, Run> before = rowsOf(runOfHistory);

		assertThat(change(aRaceOfHistory, ofALength("Stara", A_DAY_OF_HISTORY, "21.1", 150, 120))
				.getStatus()).isEqualTo(200);

		assertThat(rowsOf(runOfHistory)).as("a run of history was counted again").isEqualTo(before);
		assertThat(newLines()).isEmpty();
	}

	/** What the formula gives for a marathon's three runs, before and after, and with the climb
	 *  and the fall the wrong way round: three different numbers, or the case measures less than
	 *  it says. */
	private static void theFormulaTellsTheseApart(int seconds) {
		BigDecimal after = BtlScoreCalculator.calculate(42.195, 520, 310, seconds);

		assertThat(after).as("the old course gives the same points at %s s", seconds)
				.isNotEqualByComparingTo(BtlScoreCalculator.calculate(42.2, 300, 280, seconds));
		assertThat(after).as("the climb and the fall swapped give the same points at %s s", seconds)
				.isNotEqualByComparingTo(BtlScoreCalculator.calculate(42.195, 310, 520, seconds));
	}

	/**
	 * THE RUN AS IT WAS AND AS IT IS, in the order the line must carry them: the marathon on its
	 * old day under its old name at the old course, and the race as renamed and moved at the
	 * new one. Written by {@link WhatAResultChangeSays#inWords}, which is how the route writes a
	 * run, so what this measures is WHICH run stands where and not how a run is spelt.
	 */
	private static String asItWasAndAsItIs(int seconds) {
		WhatAResultChangeSays.Run was = new WhatAResultChangeSays.Run("Maraton", THE_MARATHONS_DAY,
				new BigDecimal("42.2"), 300, 280, seconds, counted("42.2", 300, 280, seconds));
		WhatAResultChangeSays.Run is = new WhatAResultChangeSays.Run("Maraton Avala",
				THE_MARATHONS_DAY.plusDays(1), new BigDecimal("42.195"), 520, 310, seconds,
				counted("42.195", 520, 310, seconds));

		return "Stara vrednost:\n" + WhatAResultChangeSays.inWords(was) + "\n\nNova vrednost:\n"
				+ WhatAResultChangeSays.inWords(is);
	}

	/** A run as the table holds it, in the four figures, the points and the category. */
	private record Run(BigDecimal distanceKm, int ascentM, int descentM, int seconds,
			BigDecimal points, String category) {
	}

	/** One line in an inbox, as the table holds it: whose, and what it says. */
	private record Line(Long to, String subject, String body) {
	}

	/**
	 * A run counted at these four figures, as the database would hold it: the length at the
	 * column's scale and the points the one home for the formula gives, at its two decimals.
	 */
	private static Run countedAt(String km, int ascent, int descent, int seconds, String category) {
		return new Run(new BigDecimal(km).setScale(4), ascent, descent, seconds,
				counted(km, ascent, descent, seconds), category);
	}

	private static BigDecimal counted(String km, int ascent, int descent, int seconds) {
		return BtlScoreCalculator.calculate(new BigDecimal(km).doubleValue(), ascent, descent, seconds);
	}

	private Run rowOf(long result) {
		return db.sql("select distance_km, ascent_m, descent_m, seconds, points, category from result"
						+ " where id = ?")
				.param(result)
				.query((row, one) -> new Run(row.getBigDecimal(1), row.getInt(2), row.getInt(3),
						row.getInt(4), row.getBigDecimal(5), row.getString(6)))
				.single();
	}

	private Map<Long, Run> rowsOf(long... results) {
		Map<Long, Run> rows = new LinkedHashMap<>();

		for (long result : results) {
			rows.put(result, rowOf(result));
		}

		return rows;
	}

	/** Every line written into any inbox since the fixture, addressed or not, in order. */
	private List<Line> newLines() {
		return db.sql("select to_id, subject, body from message where id > ? order by id")
				.param(linesBefore)
				.query((row, one) -> new Line(row.getObject(1, Long.class), row.getString(2),
						row.getString(3)))
				.list();
	}

	/** The lines written since the fixture into one member's inbox, in order. */
	private List<Line> linesTo(long member) {
		return newLines().stream().filter(line -> Long.valueOf(member).equals(line.to())).toList();
	}

	/** The four figures a submission carries, which no recount of a race may write over. */
	private List<Object> submitted(long submission) {
		return db.sql("select distance_km, ascent_m, descent_m, seconds from result_submission"
						+ " where id = ?")
				.param(submission)
				.query((row, one) -> List.<Object>of(row.getBigDecimal(1), row.getInt(2),
						row.getInt(3), row.getInt(4)))
				.single();
	}

	private String kindOf(long race) {
		return db.sql("select kind from race where id = ?").param(race).query(String.class).single();
	}

	private static String reasonIn(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("reason").asString();
	}

	/** An instant read in the league's own time, which is how every season question is asked. */
	private static ZonedDateTime at(Instant instant) {
		return instant.atZone(SeasonClock.ZONE);
	}

	private void event(String slug, String name, LocalDate day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, ?,"
						+ " (select id from place where rank = 1), null, null, 'race', false, '', '')")
				.params(slug, name, day).update();
	}

	private long race(String eventSlug, String name, LocalDate day, String kind, int limit, String km,
			int ascent, int descent) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false, ?, ?, ?,"
						+ " cast(? as numeric), ?, ?) returning id")
				.params(eventSlug, name, day, kind, limit, km, ascent, descent)
				.query(Long.class).single();
	}

	/** The statement {@code RaceWriteApiTest} writes a member with, column for column. */
	private long competitor(String number, String referral) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Trkac', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment', ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, referral).query(Long.class).single();
	}

	/** The day comes off the race, which is what the composite key demands. */
	private long result(long competitor, long race, String km, int ascent, int descent, int seconds,
			BigDecimal points) {
		return db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " select ?, id, date, cast(? as numeric), ?, ?, ?, ? from race where id = ?"
						+ " returning id")
				.params(competitor, km, ascent, descent, seconds, points, race)
				.query(Long.class).single();
	}

	private long submission(long competitor, long race, String km, int ascent, int descent,
			int seconds) {
		return db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " distance_km, ascent_m, descent_m, seconds, link, comment)"
						+ " select ?, id, date, cast(? as numeric), ?, ?, ?,"
						+ " 'https://primer.rs/rezultati', '' from race where id = ? returning id")
				.params(competitor, km, ascent, descent, seconds, race)
				.query(Long.class).single();
	}

	/** Its row in the results tab, waiting or already approved under somebody's name. */
	private void queued(long competitor, long submission, boolean approved) {
		if (approved) {
			db.sql("insert into verification (queue, competitor_id, subject, body, state,"
							+ " decided_at, decided_by_name, result_submission_id)"
							+ " values ('results', ?, 'Rezultat', '', 'approved', now(), 'Neko Drugi', ?)")
					.params(competitor, submission).update();
		} else {
			db.sql("insert into verification (queue, competitor_id, subject, body,"
							+ " result_submission_id) values ('results', ?, 'Rezultat', '', ?)")
					.params(competitor, submission).update();
		}
	}

	private String account(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
						+ " 'Probic', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

		SecretToken token = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, token.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return token.secret();
	}

	private MockHttpServletResponse change(long race, Form typed) throws Exception {
		return http.perform(put("/api/races/" + race).with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(typed))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	/** What the event screen sends for one race, every field of it (ADL A54). */
	private record Form(Long eventId, String name, Boolean renamed, LocalDate date, String kind,
			Integer limitSeconds, BigDecimal distanceKm, Integer ascentM, Integer descentM) {
	}

	private static Form ofALength(String name, LocalDate day, String km, int ascent, int descent) {
		return new Form(null, name, true, day, "length", null, new BigDecimal(km), ascent, descent);
	}

	private static Form toALimit(String name, LocalDate day, int limit, int ascent, int descent) {
		return new Form(null, name, true, day, "time", limit, null, ascent, descent);
	}

	private static Form free(String name, LocalDate day, int ascent, int descent) {
		return new Form(null, name, true, day, "free", null, null, ascent, descent);
	}
}

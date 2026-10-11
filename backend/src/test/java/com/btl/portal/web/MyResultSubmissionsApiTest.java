package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE RUNS ONE MEMBER SENT IN AND NOBODY HAS COUNTED, against a real database.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND, on each axis listed below.</b> The
 * rule the repository holds itself to since 06.09.2026, applied one axis at a time and to these
 * axes only: the list is what this fixture holds apart, and not a claim that nothing else in it
 * runs in step. Two pairs of keys that do are named after the list, because a review measured
 * them.
 *
 * <ul>
 * <li><b>Whose.</b> Four members and the one asking is written third, neither first nor last;
 * a member written before him and one written after him have runs too, and the OTHER member
 * has a run in every state the asker has one in, on the very race the asker ran, so „mine" and
 * „every run in this state" and „every run on this race" are three different answers. <b>His
 * account is written under a key that is not his member's</b> ({@link #MY_ACCOUNT_KEY}), so the
 * number this route is handed off the session and the number it must answer from are two
 * numbers; {@link #theTwoKeysThatCouldBeConfusedAreDifferentNumbers} reads both out of the
 * database.</li>
 * <li><b>Which state.</b> The asker has runs waiting and runs sent back, which are served, and a
 * run approved, which is not: so „mine" is never „every run of mine".</li>
 * <li><b>Which kind of run.</b> Fresh runs and corrections of a counted result, each both waiting
 * and sent back, and the two corrections are of two different counted results.</li>
 * <li><b>Which race.</b> Runs on races the calendar holds and runs on races the member
 * described, one described with a town out of the codebook and one with a town he typed.</li>
 * <li><b>Which name.</b> The race of a length was renamed AFTER the runs on it were sent, so
 * the name the queue row carries, the name of its event and the name of the race today are two
 * strings, and only one of them is right.</li>
 * <li><b>Which figures.</b> The race of a length was measured again and the race to a limit was
 * given a longer limit after the runs on them were sent, so what was sent and what an approval
 * would count are two numbers on both kinds a race fixes something on.</li>
 * <li><b>Which day.</b> Every run was sent in June and run months before it, so the day it was
 * run and the day it was sent are never one string.</li>
 * <li><b>Which words.</b> Every reason differs from the comment beside it, and every link from
 * every comment.</li>
 * <li><b>Which order.</b> The runs are written in an order that is neither the order they were
 * sent in nor its reverse, and two of the asker's were sent in one instant, the later key
 * written second, so the day alone, the key alone and both the other way round are four
 * different lists.</li>
 * </ul>
 *
 * <p><b>TWO PAIRS OF KEYS ARE NOT HELD APART, and nothing here claims they are.</b> The key of a
 * run against the key of the queue row it waits behind ({@code result_submission.id} against
 * {@code verification.id}), and the key of an event against the key of its race
 * ({@code btl_event.id} against {@code race.id}, the {@code race_id} a run carries). Written
 * alone, this fixture gives both keys of each pair the same number, because it writes one queue
 * row for every run and one race for every event, so a reading that took the wrong key of either
 * pair would answer here exactly as the right one does (found in review, PR 506, 09.10.2026).
 * That is a separate job of its own: no case in this file measures it, and a case that reads one
 * of those four keys says nothing about which of its pair it was handed.
 *
 * <p>{@link #theFixtureHoldsApartEveryPairThisFileComparesAcross} and
 * {@link #theTwoKeysThatCouldBeConfusedAreDifferentNumbers} assert each of those, so a fixture
 * that stops separating one of them fails by its own name rather than leaving a case green over
 * two values that agree.
 *
 * <p><b>No mail server of its own.</b> Nothing here sends anything; the one case that sends a run
 * through {@link ResultWriteApi} meets whatever the default relay address answers, and that route
 * takes a relay that will not take its message as an ordinary afternoon.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MyResultSubmissionsApiTest {

	private static final String PATH = "/api/me/result-submissions";

	/** Has one run waiting, on the race to a limit, newer than any of the asker's. */
	private static final String FIRST_WRITTEN = "000100";

	/** Has a run in every one of the three states, on the race the asker ran too. */
	private static final String SOMEONE_ELSE = "000200";

	/** The member every case asks as, written third: neither first nor last. */
	private static final String ME = "000300";

	/** Written after the asker, with a run waiting, so the asker is not the newest member either. */
	private static final String LAST_WRITTEN = "000400";

	private static final String MY_ADDRESS = "vera@primer.rs";

	/**
	 * THE ASKER'S ACCOUNT KEY, forced far above anything {@code account_id_seq} hands out in a run:
	 * the device {@code ModeratorApiTest.HER_COMPETITOR_ID} uses for the same pair (there it is the
	 * member's key that is forced) and {@code CommentApiTest} for its comment keys. This route is
	 * handed {@code account.id} off the session and must answer from
	 * {@code competitor.id}; both are {@code bigserial}s out of independent sequences, and a
	 * fixture that lets both come from the sequences puts the asker at the same offset in each, so
	 * a route that kept the key it was handed answered his runs correctly by accident (found in
	 * review, PR 506, 09.10.2026: the account's key put where the member's belongs left every case
	 * green). The sequence is left where it was, so nothing written afterwards collides with this
	 * key, and {@link #theTwoKeysThatCouldBeConfusedAreDifferentNumbers} reads both keys out of
	 * the database rather than trusting this number.
	 */
	private static final long MY_ACCOUNT_KEY = 900301;

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	/** Who decided every run that was decided, which the answer must not say. */
	private static final String THE_MODERATOR = "Moderatorka Odlucna";

	/** The event, and the name its race of a length carried on the day the runs were sent. */
	private static final String THE_EVENT = "Beogradski maraton";

	/** And the race's own name today, which is the only one of the two the answer may carry. */
	private static final String THE_RACE_NOW = "Beogradski polumaraton";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	private long lengthRace;

	private long timeRace;

	private long freeRace;

	private long myResult;

	private long myOtherResult;

	private long refusedOnTheLimit;

	private long waitingOnTheLength;

	private long waitingCorrection;

	private long refusedDescribed;

	private long waitingDescribed;

	private long refusedCorrection;

	@BeforeEach
	void threeMembersThreeRacesAndRunsInEveryState() {
		competitor(FIRST_WRITTEN, "Ana", "Prva");
		competitor(SOMEONE_ELSE, "Bojan", "Drugi");
		competitor(ME, "Vera", "Treca");
		competitor(LAST_WRITTEN, "Dejan", "Cetvrti");

		account("ana@primer.rs", FIRST_WRITTEN);
		account("bojan@primer.rs", SOMEONE_ELSE);
		accountAtKey(MY_ACCOUNT_KEY, MY_ADDRESS, ME);
		moderatorWithNoCompetitor(MODERATOR_WHO_DOES_NOT_RACE);

		/* THREE RACES OF THREE KINDS, as they stood on the day the runs were sent. Two are in a
		   town out of the codebook and one in a town its event typed, so a run's town is read
		   off its event both ways. */
		lengthRace = race(eventInATownOfTheBook(THE_EVENT, "2026-04-12"), THE_EVENT, "2026-04-12",
				"length", 0, "21.1000", 120, 110);
		timeRace = race(eventInATypedTown("Novosadska noc", "2026-05-16", "Futog", "RS"),
				"Dvanaest sati", "2026-05-16", "time", 21600, "0", 0, 0);
		freeRace = race(eventInATownOfTheBook("Fruskogorski trail", "2026-03-21"),
				"Fruskogorski trail", "2026-03-21", "free", 0, "0", 0, 0);

		/* Somebody else's first, so the lowest id in `result` is not mine. */
		ran(SOMEONE_ELSE, lengthRace, "2026-04-12", "21.1000", 120, 110, 5000, "12.00");
		myResult = ran(ME, lengthRace, "2026-04-12", "21.1000", 120, 110, 5600, "10.00");
		myOtherResult = ran(ME, freeRace, "2026-03-21", "14.0000", 400, 380, 7200, "8.00");

		/* MY RUNS, WRITTEN IN AN ORDER THAT IS NEITHER THE ORDER THEY WERE SENT IN NOR ITS
		   REVERSE. The two sent at nine on 9 June are written the earlier key first, and the one
		   that must come first is the later key. */
		refusedOnTheLimit = fromTheCalendar(ME, timeRace, "2026-05-16", "60.5000", 300, 290,
				21600, "https://rezultati.rs/dvanaest-sati", "Sat je stao na pedesetom kilometru",
				null);
		decided(refusedOnTheLimit, "Dvanaest sati", "2026-06-05 09:00:00+00", "rejected",
				"2026-06-06 10:00:00+00", "Link ne vodi na zvanicne rezultate.");

		waitingOnTheLength = fromTheCalendar(ME, lengthRace, "2026-04-12", "21.1000", 120, 110,
				5400, "https://rezultati.rs/maraton", "Startni broj 412", null);
		waiting(waitingOnTheLength, THE_EVENT, "2026-06-02 09:00:00+00");

		waitingCorrection = fromTheCalendar(ME, lengthRace, "2026-04-12", "21.1000", 120, 110,
				5300, "https://rezultati.rs/ispravka-maratona", "Ispravljam vreme", myResult);
		waiting(waitingCorrection, THE_EVENT, "2026-06-09 09:00:00+00");

		refusedDescribed = describedInATownOfTheBook(ME, "Planinska trka", "length", "2026-05-25",
				"18.0000", 900, 900, 8000, "https://rezultati.rs/planina",
				"Nema zvanicnog merenja");
		decided(refusedDescribed, "Planinska trka", "2026-06-03 09:00:00+00", "rejected",
				"2026-06-04 10:00:00+00", "Trka nije zvanicno merena.");

		waitingDescribed = describedInATypedTown(ME, "Trka oko zaliva", "free", "2026-05-20",
				"Kotor", "ME", "25.0000", 600, 600, 9000, "https://rezultati.rs/zaliv",
				"Opisujem trku koje nema");
		waiting(waitingDescribed, "Trka oko zaliva", "2026-06-09 09:00:00+00");

		refusedCorrection = fromTheCalendar(ME, freeRace, "2026-03-21", "14.0000", 400, 380, 7000,
				"https://rezultati.rs/ispravka-traila", "Bilo je krace", myOtherResult);
		decided(refusedCorrection, "Fruskogorski trail", "2026-06-07 09:00:00+00", "rejected",
				"2026-06-08 10:00:00+00", "Dokaz ne pokazuje ovo vreme.");

		/* MY APPROVED RUN, which is a result now and must stay out of this answer. */
		long approvedOfMine = fromTheCalendar(ME, freeRace, "2026-03-21", "13.0000", 350, 340,
				6900, "https://rezultati.rs/odobreno", "Ovaj je uracunat", null);
		decided(approvedOfMine, "Fruskogorski trail", "2026-06-01 09:00:00+00", "approved",
				"2026-06-01 12:00:00+00", null);

		/* SOMEBODY ELSE'S RUNS IN ALL THREE STATES, ON THE VERY RACE MINE ARE ON. */
		long hisWaiting = fromTheCalendar(SOMEONE_ELSE, lengthRace, "2026-04-12", "21.1000", 120,
				110, 5100, "https://rezultati.rs/tudje-ceka", "Tudji komentar", null);
		waiting(hisWaiting, THE_EVENT, "2026-06-04 09:00:00+00");

		long hisRefused = fromTheCalendar(SOMEONE_ELSE, lengthRace, "2026-04-12", "21.1000", 120,
				110, 5200, "https://rezultati.rs/tudje-odbijeno", "Tudji drugi komentar", null);
		decided(hisRefused, THE_EVENT, "2026-06-06 09:00:00+00", "rejected",
				"2026-06-06 12:00:00+00", "Tudji razlog.");

		long hisApproved = fromTheCalendar(SOMEONE_ELSE, lengthRace, "2026-04-12", "21.1000", 120,
				110, 5150, "https://rezultati.rs/tudje-odobreno", "Tudji treci komentar", null);
		decided(hisApproved, THE_EVENT, "2026-06-08 09:00:00+00", "approved",
				"2026-06-08 12:00:00+00", null);

		/* AND THE FIRST MEMBER'S, NEWER THAN ANY OF MINE, so the first member's list and mine
		   are two different non-empty answers. */
		long hersWaiting = fromTheCalendar(FIRST_WRITTEN, timeRace, "2026-05-16", "58.0000", 250,
				240, 21600, "https://rezultati.rs/njeno", "Njen komentar", null);
		waiting(hersWaiting, "Dvanaest sati", "2026-06-10 09:00:00+00");

		/* AND THE LAST MEMBER'S, so a member written after me has a run in a state mine are in. */
		long hisLaterWaiting = fromTheCalendar(LAST_WRITTEN, freeRace, "2026-03-21", "15.5000", 420,
				410, 7600, "https://rezultati.rs/poslednji", "Poslednji komentar", null);
		waiting(hisLaterWaiting, "Fruskogorski trail", "2026-06-11 09:00:00+00");

		/* RENAMED AND MEASURED AGAIN AFTER EVERY RUN ON THEM WAS SENT, so every copy taken on the
		   day a run was sent is stale. */
		db.sql("update race set name = ?, renamed = true, distance_km = 21.0975, ascent_m = 125,"
						+ " descent_m = 115 where id = ?")
				.params(THE_RACE_NOW, lengthRace).update();
		db.sql("update race set limit_seconds = 43200 where id = ?").param(timeRace).update();
	}

	/*
	 * WHO MAY ASK
	 */

	/**
	 * A VISITOR IS REFUSED BEFORE THE ROUTE, AND A MEMBER IS ANSWERED.
	 *
	 * <p>ADL P-javno keeps the route off {@code READ_BY_ANYBODY}: what a member sent in and how it
	 * was decided is about him and means nothing to anybody else.
	 */
	@Test
	void aVisitorIsRefusedBeforeTheRouteAndAMemberIsAnswered() throws Exception {
		assertThat(http.perform(get(PATH)).andReturn().getResponse().getStatus())
				.as("a visitor with no session read what a member sent in")
				.isEqualTo(401);

		assertThat(asked(MY_ADDRESS).getStatus())
				.as("a member was refused his own runs")
				.isEqualTo(200);
	}

	/**
	 * AN ACCOUNT THAT RACES NOT IS ANSWERED AN EMPTY LIST, AND NOT A REFUSAL.
	 *
	 * <p>V23 lets a moderator who does not race have no {@code competitor} row, so nothing can
	 * have been sent in his name: {@code MyApplicationsApi}'s answer to the identical account.
	 */
	@Test
	void anAccountThatRacesNotIsAnsweredAnEmptyListAndNotARefusal() throws Exception {
		MockHttpServletResponse answer = asked(MODERATOR_WHO_DOES_NOT_RACE);

		assertThat(answer.getStatus())
				.as("an account with no member behind it was refused rather than answered empty")
				.isEqualTo(200);
		JsonNode list = mapper.readTree(answer.getContentAsString());

		assertThat(list.isArray()).as("the answer is not a list").isTrue();
		assertThat(list.size())
				.as("an account with no member behind it was answered somebody's runs")
				.isZero();
	}

	/*
	 * WHICH RUNS, AND IN WHAT ORDER
	 */

	/**
	 * MY RUNS THAT WAIT OR WERE SENT BACK, NEWEST FIRST, THE KEY BREAKING A TIE, AND NO OTHER
	 * RUN.
	 *
	 * <p>Not my approved one, not somebody else's in any of the three states on the same race,
	 * and not the first member's newer one. The keys are asked of the store, never read off the
	 * answer being checked.
	 */
	@Test
	void myRunsThatWaitOrWereSentBackComeBackNewestFirstAndNoOtherRun() throws Exception {
		List<JsonNode> mine = rows(MY_ADDRESS);

		assertThat(mine.stream().map(one -> one.get("id").asLong()).toList())
				.as("the answer is not my waiting and refused runs, newest first and then by the key")
				.containsExactly(waitingDescribed, waitingCorrection, refusedCorrection,
						refusedOnTheLimit, refusedDescribed, waitingOnTheLength);
		assertThat(mine.stream().map(one -> one.get("state").asString()).toList())
				.as("a run answered with a state that is not its own")
				.containsExactly("waiting", "waiting", "rejected", "rejected", "rejected", "waiting");
	}

	/*
	 * WHAT A RUN ANSWERS WITH
	 */

	/**
	 * A RUN ON A RACE OF THE CALENDAR ANSWERS WITH THE RACE AS IT IS CALLED NOW, AND WITH THE
	 * FIGURES AN APPROVAL WOULD COUNT NOW.
	 *
	 * <p>The race of a length fixes the distance, the climb and the fall, and all three were
	 * measured again after the runs on it were sent; the race to a limit fixes the time, and its
	 * limit was lengthened since. The free race fixes nothing, so its run answers with what was
	 * sent. The name is the race's today, which is neither the queue row's copy nor the event's.
	 */
	@Test
	void aRunOnARaceOfTheCalendarAnswersWithTheRaceAsItIsNowAndWhatAnApprovalWouldCount()
			throws Exception {
		List<JsonNode> mine = mySix();

		assertThat(mine.stream().map(one -> one.get("raceName").asString()).toList())
				.as("a race is not named as it is called now")
				.containsExactly("Trka oko zaliva", THE_RACE_NOW, "Fruskogorski trail",
						"Dvanaest sati", "Planinska trka", THE_RACE_NOW);
		assertThat(mine.stream().map(MyResultSubmissionsApiTest::raceIdOf).toList())
				.as("a run is not tied to the race it was run on, or a described one is")
				.containsExactly(null, lengthRace, freeRace, timeRace, null, lengthRace);

		assertThat(figuresOf(mine.get(5))).as("the race of a length, as it is measured now")
				.containsExactly("21.0975", "125", "115", "5400");
		assertThat(figuresOf(mine.get(1))).as("the correction on the race of a length")
				.containsExactly("21.0975", "125", "115", "5300");
		assertThat(figuresOf(mine.get(3))).as("the race to a limit, at its limit as it is now")
				.containsExactly("60.5", "300", "290", "43200");
		assertThat(figuresOf(mine.get(2))).as("the free race, as the member sent it")
				.containsExactly("14", "400", "380", "7000");
	}

	/**
	 * A DESCRIBED RUN ANSWERS WITH WHAT THE MEMBER SENT, BECAUSE THERE IS NO RACE TO ASK.
	 */
	@Test
	void aDescribedRunAnswersWithWhatTheMemberSentBecauseThereIsNoRaceToAsk() throws Exception {
		List<JsonNode> mine = mySix();

		assertThat(figuresOf(mine.get(0))).containsExactly("25", "600", "600", "9000");
		assertThat(figuresOf(mine.get(4))).containsExactly("18", "900", "900", "8000");
	}

	/**
	 * THE DAY IS THE DAY THE RACE WAS RUN, AND NEVER THE DAY THE RUN WAS SENT.
	 */
	@Test
	void theDayIsTheDayTheRaceWasRunAndNeverTheDayTheRunWasSent() throws Exception {
		assertThat(rows(MY_ADDRESS).stream().map(one -> one.get("raceDate").asString()).toList())
				.as("a run answered with a day that is not the day it was run")
				.containsExactly("2026-05-20", "2026-04-12", "2026-03-21", "2026-05-16",
						"2026-05-25", "2026-04-12");
	}

	/**
	 * THE KIND AND THE TOWN ARE THE RACE'S AND ITS EVENT'S ON THE CALENDAR, AND THE MEMBER'S OWN
	 * ON A DESCRIBED RUN.
	 *
	 * <p>The form that sends a refused run again asks for both on every road, so a run answering
	 * without them could not be sent again without the member typing them anew.
	 */
	@Test
	void theKindAndTheTownAreTheRacesOnTheCalendarAndTheMembersOnADescribedRun() throws Exception {
		List<JsonNode> mine = mySix();
		String first = nameOfTheBooksTown(1);
		String second = nameOfTheBooksTown(2);

		assertThat(mine.stream().map(one -> one.get("raceKind").asString()).toList())
				.containsExactly("free", "length", "free", "time", "length", "length");
		assertThat(mine.stream().map(one -> one.get("city").asString()).toList())
				.as("a run answered with a town that is not its race's or its own")
				.containsExactly("Kotor", first, first, "Futog", second, first);
		assertThat(mine.stream().map(one -> one.get("country").asString()).toList())
				.containsExactly("ME", codeOfTheBooksTown(1), codeOfTheBooksTown(1), "RS",
						codeOfTheBooksTown(2), codeOfTheBooksTown(1));
	}

	/**
	 * A RUN SENT BACK CARRIES THE MODERATOR'S REASON, A RUN THAT WAITS CARRIES NONE, AND THE
	 * MEMBER'S OWN WORDS AND LINK ARE EACH IN THEIR OWN PLACE.
	 *
	 * <p>ADL A36, O11: a refused run stays „sa stanjem i razlogom". The queue row's {@code body}
	 * holds the member's comment, and every reason here differs from it.
	 */
	@Test
	void aRunSentBackCarriesTheModeratorsReasonAndARunThatWaitsNone() throws Exception {
		List<JsonNode> mine = mySix();

		assertThat(mine.stream().map(MyResultSubmissionsApiTest::reasonOf).toList())
				.as("a reason is not the moderator's, or a run that waits carries one")
				.containsExactly(null, null, "Dokaz ne pokazuje ovo vreme.",
						"Link ne vodi na zvanicne rezultate.", "Trka nije zvanicno merena.", null);
		assertThat(mine.stream().map(one -> one.get("comment").asString()).toList())
				.containsExactly("Opisujem trku koje nema", "Ispravljam vreme", "Bilo je krace",
						"Sat je stao na pedesetom kilometru", "Nema zvanicnog merenja",
						"Startni broj 412");
		assertThat(mine.stream().map(one -> one.get("link").asString()).toList())
				.containsExactly("https://rezultati.rs/zaliv", "https://rezultati.rs/ispravka-maratona",
						"https://rezultati.rs/ispravka-traila", "https://rezultati.rs/dvanaest-sati",
						"https://rezultati.rs/planina", "https://rezultati.rs/maraton");
	}

	/**
	 * A CORRECTION NAMES THE COUNTED RESULT IT CORRECTS, AND A FRESH RUN NAMES NONE.
	 *
	 * <p>The two corrections are of two different results, and neither result's key is the
	 * key of the run that corrects it.
	 */
	@Test
	void aCorrectionNamesTheCountedResultItCorrectsAndAFreshRunNone() throws Exception {
		assertThat(rows(MY_ADDRESS).stream().map(MyResultSubmissionsApiTest::amendsOf).toList())
				.as("a correction does not name the result it corrects, or a fresh run names one")
				.containsExactly(null, myResult, myOtherResult, null, null, null);
	}

	/**
	 * NEITHER WHO DECIDED, NOR WHEN, NOR THE DAY A RUN WAS SENT IS ANYWHERE IN THE ANSWER, AND IT
	 * CARRIES EXACTLY THE SIXTEEN NAMES IT DECLARES.
	 *
	 * <p>Who decided is left out on a reading of the owner's choice of 19.09.2026 (when the portal
	 * writes to a member the sender is the league, and the record's reason is that a moderator's
	 * name „odalo bi ko je odbio uplatu ili koga izbacio"); see the class note on
	 * {@code MyResultSubmissionsApi}. Every run here was sent and decided in June and run in
	 * spring, so no day of June belongs in this answer.
	 */
	@Test
	void neitherWhoDecidedNorWhenNorTheDaySentIsInTheAnswer() throws Exception {
		String whole = asked(MY_ADDRESS).getContentAsString();

		assertThat(whole)
				.as("the answer names the moderator who decided")
				.doesNotContain(THE_MODERATOR)
				.as("the answer carries a day a run was sent or decided on")
				.doesNotContain("2026-06-");

		assertThat(Answers.fieldsOf(mySix().get(0)))
				.as("the answer carries a name nobody decided it should, or lost one")
				.containsExactlyInAnyOrder("id", "state", "raceId", "raceName", "raceDate",
						"raceKind", "city", "country", "distanceKm", "ascentM", "descentM",
						"seconds", "link", "comment", "reason", "amendsResultId");
	}

	/** NO FIELD OF IT IS THE SAME IN EVERY RECORD, so no field could be answered by a constant. */
	@Test
	void noFieldIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord(PATH, mapper.readTree(asked(MY_ADDRESS).getContentAsString()));
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ONE THIS ROUTE ANSWERS WITH, and the answer carries no name
	 * the portal does not read, held against the file the screen's own cases are served
	 * ({@code frontend/src/test/mock/me/result-submissions.json}, written with „Moji rezultati" on
	 * the server, R2 of the results flows). The route and the screen came in two pull requests;
	 * this is where the two ends are held against each other, in both directions.
	 */
	@Test
	void everyFieldThePortalReadsIsOneThisRouteAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered(PATH,
				mapper.readTree(asked(MY_ADDRESS).getContentAsString()), "me/result-submissions.json");
	}

	/*
	 * THE TWO HALVES MEET
	 */

	/**
	 * A RUN AND A CORRECTION SENT THROUGH THEIR OWN ROUTES COME BACK HERE AS THEY WERE SENT.
	 *
	 * <p>{@link ResultWriteApi} writes what this reads, and a case that only ever inserted the
	 * rows by hand would hold the reader to a shape the writer does not produce. Both are sent in
	 * the one transaction the case runs in, so both are raised at one instant and the later key,
	 * the correction, comes first.
	 */
	@Test
	void aRunAndACorrectionSentThroughTheirOwnRoutesComeBackHereAsTheyWereSent()
			throws Exception {
		Map<String, Object> run = Map.of("raceId", lengthRace, "seconds", 4321,
				"link", "https://rezultati.rs/kroz-rutu", "comment", "Poslato kroz rutu");

		assertThat(sent(post("/api/results").contentType(MediaType.APPLICATION_JSON)
				.content(mapper.writeValueAsString(run)), MY_ADDRESS).getStatus())
				.isEqualTo(201);

		Map<String, Object> correction = new HashMap<>();

		correction.put("distanceKm", "15.0000");
		correction.put("ascentM", 410);
		correction.put("descentM", 390);
		correction.put("seconds", 7100);
		correction.put("link", "https://rezultati.rs/ispravka-kroz-rutu");
		correction.put("comment", "Ispravka kroz rutu");

		assertThat(sent(put("/api/results/" + myOtherResult).contentType(MediaType.APPLICATION_JSON)
				.content(mapper.writeValueAsString(correction)), MY_ADDRESS).getStatus())
				.isEqualTo(200);

		List<JsonNode> mine = rows(MY_ADDRESS);

		assertThat(mine).hasSize(8);

		JsonNode theCorrection = mine.get(0);
		JsonNode theRun = mine.get(1);

		assertThat(theCorrection.get("state").asString()).isEqualTo("waiting");
		assertThat(amendsOf(theCorrection)).isEqualTo(myOtherResult);
		assertThat(raceIdOf(theCorrection)).isEqualTo(freeRace);
		assertThat(figuresOf(theCorrection)).containsExactly("15", "410", "390", "7100");
		assertThat(theCorrection.get("link").asString())
				.isEqualTo("https://rezultati.rs/ispravka-kroz-rutu");

		assertThat(theRun.get("state").asString()).isEqualTo("waiting");
		assertThat(amendsOf(theRun)).isNull();
		assertThat(raceIdOf(theRun)).isEqualTo(lengthRace);
		assertThat(theRun.get("raceName").asString()).isEqualTo(THE_RACE_NOW);
		assertThat(figuresOf(theRun)).containsExactly("21.0975", "125", "115", "4321");
		assertThat(theRun.get("comment").asString()).isEqualTo("Poslato kroz rutu");
	}

	/*
	 * THE FLOOR UNDER THE FIXTURE
	 */

	/**
	 * THE TWO KEYS THAT COULD BE CONFUSED ARE DIFFERENT NUMBERS, and both are read out of the
	 * database rather than trusted from {@link #MY_ACCOUNT_KEY}: the floor {@code MeApiTest} keeps
	 * under the same pair, with the same name.
	 *
	 * <p>What this route is handed is {@code account.id} and what it must answer from is
	 * {@code competitor.id}. Nothing makes those two disagree on their own, so every case that
	 * asks as the asker is green on any fixture that puts him at the same offset in both tables,
	 * whichever of the two keys the route used. If this ever goes red, no case that asks as him is
	 * measuring which one it was, and {@link #MY_ACCOUNT_KEY} wants looking at rather than this
	 * case relaxing.
	 */
	@Test
	void theTwoKeysThatCouldBeConfusedAreDifferentNumbers() {
		assertThat(competitorIdOf(ME))
				.as("the asker's member and his account carry the same key, so a route handed the"
						+ " account's key where the member's belongs answers his runs correctly by"
						+ " accident and no case that asks as him says which of the two it used")
				.isNotEqualTo(accountIdOf(MY_ADDRESS));
	}

	/**
	 * THE FIXTURE HOLDS APART EVERY PAIR THIS FILE COMPARES ACROSS, said by the database rather
	 * than by the comments above it.
	 */
	@Test
	void theFixtureHoldsApartEveryPairThisFileComparesAcross() {
		assertThat(statesOn(SOMEONE_ELSE, lengthRace))
				.as("somebody else has no run in one of the states mine are in, on my race")
				.containsExactlyInAnyOrder("waiting", "rejected", "approved");
		assertThat(statesOf(LAST_WRITTEN))
				.as("nobody written after me has a run, so a run of a key past mine is never somebody else's")
				.contains("waiting");
		assertThat(statesOf(ME))
				.as("I have no approved run, so my runs and my runs in these two states agree")
				.contains("approved");

		assertThat(db.sql("select name from race where id = ?").param(lengthRace)
				.query(String.class).single())
				.as("the race was not renamed after the runs on it were sent")
				.isNotEqualTo(subjectOf(waitingOnTheLength))
				.isNotEqualTo(db.sql("select e.name from btl_event e join race r on r.event_id = e.id"
								+ " where r.id = ?").param(lengthRace).query(String.class).single());

		assertThat(db.sql("select distance_km from race where id = ?").param(lengthRace)
				.query(BigDecimal.class).single())
				.as("the race of a length was not measured again after the runs on it were sent")
				.isNotEqualByComparingTo(db.sql("select distance_km from result_submission where id = ?")
						.param(waitingOnTheLength).query(BigDecimal.class).single());
		assertThat(db.sql("select limit_seconds from race where id = ?").param(timeRace)
				.query(Integer.class).single())
				.as("the race to a limit kept the limit the run on it was sent at")
				.isNotEqualTo(db.sql("select seconds from result_submission where id = ?")
						.param(refusedOnTheLimit).query(Integer.class).single());

		assertThat(db.sql("select count(*) from verification v"
						+ " join result_submission rs on rs.id = v.result_submission_id"
						+ " where v.reason = v.body or v.reason = rs.comment or v.reason = rs.link")
				.query(Long.class).single())
				.as("a reason is the comment or the link beside it")
				.isZero();
		assertThat(db.sql("select count(*) from result_submission where link = comment")
				.query(Long.class).single())
				.as("a link is the comment beside it")
				.isZero();

		assertThat(db.sql("select count(*) from result_submission rs"
						+ " join verification v on v.result_submission_id = rs.id"
						+ " where rs.race_date = cast(v.raised_at at time zone 'Europe/Belgrade' as date)")
				.query(Long.class).single())
				.as("a run was sent on the very day it was run")
				.isZero();

		List<Long> sentOrder = db.sql("select rs.id from result_submission rs"
						+ " join verification v on v.result_submission_id = rs.id"
						+ " where rs.competitor_id = (select id from competitor where member_number = ?)"
						+ " and v.state <> 'approved' order by v.raised_at desc, rs.id desc")
				.param(ME).query(Long.class).list();
		List<Long> keyOrder = sentOrder.stream().sorted((a, b) -> Long.compare(b, a)).toList();

		assertThat(sentOrder)
				.as("my runs were written in the order they were sent, so the key alone sorts them too")
				.isNotEqualTo(keyOrder)
				.isNotEqualTo(keyOrder.reversed());
		assertThat(db.sql("select count(*) from (select v.raised_at from verification v"
						+ " join result_submission rs on rs.id = v.result_submission_id"
						+ " where rs.competitor_id = (select id from competitor where member_number = ?)"
						+ " and v.state <> 'approved' group by v.raised_at having count(*) > 1) tied")
				.param(ME).query(Long.class).single())
				.as("no two of my runs were sent in one instant, so nothing tests the key's tie")
				.isEqualTo(1L);

		assertThat(db.sql("select count(*) from verification v"
						+ " join result_submission rs on rs.id = v.result_submission_id"
						+ " where rs.competitor_id = (select id from competitor where member_number = ?)"
						+ " and (to_char(v.raised_at at time zone 'Europe/Belgrade', 'YYYY-MM') <> '2026-06'"
						+ " or (v.decided_at is not null"
						+ " and to_char(v.decided_at at time zone 'Europe/Belgrade', 'YYYY-MM') <> '2026-06')"
						+ " or to_char(rs.race_date, 'YYYY-MM') = '2026-06')")
				.param(ME).query(Long.class).single())
				.as("a run of mine was sent or decided outside June, or run in it, so a day of June in the"
						+ " answer would not be a day a run was sent or decided on")
				.isZero();
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

	private long eventInATownOfTheBook(String name, String day) {
		return db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
						+ " description, link) values (?, ?, date '" + day + "',"
						+ " (select id from place where rank = 1), 'race', false, '', '')"
						+ " returning id")
				.params("dogadjaj-" + String.format("%016x", ++issued), name)
				.query(Long.class).single();
	}

	private long eventInATypedTown(String name, String day, String city, String country) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, date '" + day + "', null, ?,"
						+ " (select id from country where code = ?), 'race', false, '', '')"
						+ " returning id")
				.params("dogadjaj-" + String.format("%016x", ++issued), name, city, country)
				.query(Long.class).single();
	}

	private long race(long event, String name, String day, String kind, int limitSeconds,
			String km, int up, int down) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, date '" + day + "', ?, ?, cast(? as numeric), ?, ?)"
						+ " returning id")
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

	/** A run on a race the calendar holds, with the figures as they were sent. */
	private long fromTheCalendar(String member, long raceId, String day, String km, int up,
			int down, int seconds, String link, String comment, Long amends) {
		return db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " distance_km, ascent_m, descent_m, seconds, link, comment, amends_result_id)"
						+ " values ((select id from competitor where member_number = ?), ?,"
						+ " date '" + day + "', cast(? as numeric), ?, ?, ?, ?, ?, ?) returning id")
				.params(member, raceId, km, up, down, seconds, link, comment, amends)
				.query(Long.class).single();
	}

	/** A run on a race the calendar does not hold, in a town out of the codebook. */
	private long describedInATownOfTheBook(String member, String name, String kind, String day,
			String km, int up, int down, int seconds, String link, String comment) {
		return db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " race_name, race_kind, place_id, distance_km, ascent_m, descent_m, seconds,"
						+ " link, comment) values ((select id from competitor where member_number = ?),"
						+ " null, date '" + day + "', ?, ?, (select id from place where rank = 2),"
						+ " cast(? as numeric), ?, ?, ?, ?, ?) returning id")
				.params(member, name, kind, km, up, down, seconds, link, comment)
				.query(Long.class).single();
	}

	/** A run on a race the calendar does not hold, in a town the member typed. */
	private long describedInATypedTown(String member, String name, String kind, String day,
			String city, String country, String km, int up, int down, int seconds, String link,
			String comment) {
		return db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " race_name, race_kind, city, country_id, distance_km, ascent_m, descent_m,"
						+ " seconds, link, comment) values ((select id from competitor where member_number = ?),"
						+ " null, date '" + day + "', ?, ?, ?, (select id from country where code = ?),"
						+ " cast(? as numeric), ?, ?, ?, ?, ?) returning id")
				.params(member, name, kind, city, country, km, up, down, seconds, link, comment)
				.query(Long.class).single();
	}

	/**
	 * The queue row a run waits behind, written the way {@link ResultWriteApi} writes it: the race's
	 * name as it was that day, and the member's comment as the body, taken off the run itself so the
	 * two cannot be told different stories.
	 */
	private void waiting(long submission, String subject, String raisedAt) {
		db.sql("insert into verification (queue, competitor_id, subject, body, raised_at, state,"
						+ " result_submission_id) select 'results', competitor_id, ?, comment,"
						+ " timestamptz '" + raisedAt + "', 'waiting', id"
						+ " from result_submission where id = ?")
				.params(subject, submission).update();
	}

	/** And one a moderator has already decided, which V9 keeps standing with who and when. */
	private void decided(long submission, String subject, String raisedAt, String state,
			String decidedAt, String reason) {
		db.sql("insert into verification (queue, competitor_id, subject, body, raised_at, state,"
						+ " decided_at, decided_by_name, reason, result_submission_id)"
						+ " select 'results', competitor_id, ?, comment, timestamptz '" + raisedAt + "',"
						+ " ?, timestamptz '" + decidedAt + "', ?, ?, id"
						+ " from result_submission where id = ?")
				.params(subject, state, THE_MODERATOR, reason, submission).update();
	}

	private void account(String email, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, memberNumber).update();

		openSession(email);
	}

	/**
	 * The ASKER'S account, written under a key chosen here and not under the sequence's next one;
	 * see {@link #MY_ACCOUNT_KEY} for why.
	 */
	private void accountAtKey(long key, String email, String memberNumber) {
		db.sql("insert into account (id, first_name, last_name, email, role_id, competitor_id) values"
						+ " (?, 'Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(key, email, memberNumber).update();

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
	 * ASKING AND READING BACK
	 */

	private Cookie cookieOf(String email) {
		return new Cookie(SessionCookie.NAME, sessions.get(email).secret());
	}

	private MockHttpServletResponse asked(String email) throws Exception {
		return http.perform(get(PATH).cookie(cookieOf(email))).andReturn().getResponse();
	}

	private MockHttpServletResponse sent(MockHttpServletRequestBuilder asking, String email)
			throws Exception {
		return http.perform(asking.with(csrf()).cookie(cookieOf(email))).andReturn().getResponse();
	}

	/**
	 * MY SIX RUNS, asserted to be six before any of them is read by its place: read by its place
	 * out of a shorter list, a case would fall over on an index rather than fail on what it is
	 * about, and a mutation it caught would read as an error instead of an assertion.
	 */
	private List<JsonNode> mySix() throws Exception {
		List<JsonNode> mine = rows(MY_ADDRESS);

		assertThat(mine)
				.as("my answer is not my six runs, so no run of it can be read by its place")
				.hasSize(6);

		return mine;
	}

	private List<JsonNode> rows(String email) throws Exception {
		List<JsonNode> out = new ArrayList<>();

		for (JsonNode one : mapper.readTree(asked(email).getContentAsString())) {
			out.add(one);
		}

		return out;
	}

	/**
	 * The four figures in the order a run is scored on, the length with its trailing noughts taken
	 * off: the answer writes the scale the column keeps (60.5000), and what reads it back may hand it
	 * on as 60.5, so it is the number and not its spelling that is compared.
	 */
	private static List<String> figuresOf(JsonNode one) {
		return List.of(one.get("distanceKm").decimalValue().stripTrailingZeros().toPlainString(),
				one.get("ascentM").asString(), one.get("descentM").asString(),
				one.get("seconds").asString());
	}

	private static Long raceIdOf(JsonNode one) {
		return one.get("raceId").isNull() ? null : one.get("raceId").asLong();
	}

	private static Long amendsOf(JsonNode one) {
		return one.get("amendsResultId").isNull() ? null : one.get("amendsResultId").asLong();
	}

	private static String reasonOf(JsonNode one) {
		return one.get("reason").isNull() ? null : one.get("reason").asString();
	}

	private String nameOfTheBooksTown(int rank) {
		return db.sql("select name from place where rank = ?").param(rank)
				.query(String.class).single();
	}

	private String codeOfTheBooksTown(int rank) {
		return db.sql("select c.code from place p join country c on c.id = p.country_id"
						+ " where p.rank = ?")
				.param(rank).query(String.class).single();
	}

	private long competitorIdOf(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	private long accountIdOf(String email) {
		return db.sql("select id from account where email = ?").param(email)
				.query(Long.class).single();
	}

	private String subjectOf(long submission) {
		return db.sql("select subject from verification where result_submission_id = ?")
				.param(submission).query(String.class).single();
	}

	private List<String> statesOn(String member, long raceId) {
		return db.sql("select v.state from verification v"
						+ " join result_submission rs on rs.id = v.result_submission_id"
						+ " where rs.race_id = ?"
						+ " and rs.competitor_id = (select id from competitor where member_number = ?)")
				.params(raceId, member).query(String.class).list();
	}

	private List<String> statesOf(String member) {
		return db.sql("select v.state from verification v"
						+ " join result_submission rs on rs.id = v.result_submission_id"
						+ " where rs.competitor_id = (select id from competitor where member_number = ?)")
				.param(member).query(String.class).list();
	}
}

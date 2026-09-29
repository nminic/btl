package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.verification.HoldingAnItem;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A MODERATOR ANSWERING SOMETHING IN THE QUEUE, AND HOLDING IT WHILE HE READS IT.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND, on any axis an assertion
 * below reads a value along.</b> The axes were counted rather than felt, which is the rule
 * of 06.09.2026 and its correction the same afternoon:
 *
 * <ul>
 * <li><b>Every moderator holds exactly ONE queue, and they are DIFFERENT queues.</b> This
 * is the axis that matters most and the one a fixture normally misses: with a plain
 * competitor as the only refused case, „may he moderate THIS tab" and „does he hold ANY tab"
 * answer alike on every request. {@link #aModeratorIsToldNothingAboutAnItemInATabHeDoesNotHold}
 * asks a man who genuinely holds {@code queue:comments} about a {@code profiles} row.
 * <li><b>TWO moderators hold the profiles tab</b>, so „somebody else is reading it" is a
 * state two people who may both decide can be in, rather than a state only an outsider
 * reaches.
 * <li><b>The deciding moderator's ACCOUNT and his MEMBER row carry different names.</b> PDL
 * P21 puts a parent on the account of a competitor under sixteen, so the two really do
 * differ; with one name they are one value read twice and the assertion about who decided
 * measures nothing.
 * <li><b>Three items wait in the profiles tab and one has been answered</b>, so „this item"
 * is never „the first item" and „waiting" is never „every row in the tab".
 * <li><b>One waiting item carries a picture and the others do not</b>, which is the only way
 * {@code verification_decided_keeps_no_photo} is ever touched: nothing on this server writes
 * a picture into that tab yet, so a fixture made of what the portal writes never reaches it.
 * <li><b>One waiting item is about NOBODY.</b> V9 makes {@code competitor_id} nullable on
 * purpose and a decision must not fall over it.
 * <li><b>Three members plus the moderator's own child</b>, so „that member" is never „the
 * only member".
 * <li><b>TWO RUNS CLIMB FURTHER THAN THEY FALL</b> (PR 443 review), where every other run
 * climbs exactly as far as it falls and sits on a race carrying the same two numbers. On those
 * the formula gives the same points either way round, so an approval that wrote the drop where
 * the climb belongs, worked the points out from the two swapped, or read them off the race
 * instead of off the run agreed with every assertion made about it. One of the two is a first
 * report and one a correction, because different statements write them; and the first is run
 * at a race that fixes nothing, so the race has no figures of its own to stand in for what the
 * runner sent.
 * <li><b>THE CLOCK STANDS IN MARCH</b>, where {@link SeasonClock#transfersTakeEffect} answers
 * 2028 and {@link SeasonClock#seasonBeingPaidFor} answers 2027. Inside the transfer window
 * the two agree and a route reading the wrong one is right anyway - which is exactly how the
 * portal shipped this mistake once before (06.09.2026: „a team proposal sent in December and
 * approved on 5 January wrote the RUNNING season").
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3334",
		"spring.mail.properties.mail.smtp.auth=false"})
@Transactional
class VerificationWriteApiTest {

	/**
	 * ITS OWN MAIL PORT, 3334, and it is the tenth.
	 *
	 * <p>{@link MailServerForACase} carries the reason at length and takes the number as an
	 * ARGUMENT precisely so two classes cannot quietly settle on one. The nine already spoken
	 * for when this was written are 3325 to 3333 with no gap, across nine classes, so this is
	 * the next number rather than a chosen one. A port taken twice is the worst failure this
	 * suite has, because it reads EXACTLY like a caught mutation - exit code 1, a real
	 * {@code Tests run:} line, a big number, and not one case actually run. The sign of it is
	 * {@code Errors:} equal to {@code Tests run:}.
	 *
	 * <p>This class needs one at all from the day an approved result is posted (PDL P22, „Član
	 * dobija mejl kad mu je rezultat odobren"). Without a server the send throws, the route
	 * logs and carries on, and every case would be green over a letter nobody proved was
	 * written.
	 */
	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3334));

	/**
	 * Noon in Belgrade on 15 March 2027, and both halves of that are chosen.
	 *
	 * <p>MARCH, because the two season functions differ there by a whole year; 2027, because
	 * the answer is then 2028 while the season that is RUNNING is 2027, so a team written
	 * with the wrong one is written into a season that is already under way.
	 */
	private static final Instant IN_MARCH = Instant.parse("2027-03-15T11:00:00Z");

	/** The season a team approved at {@link #IN_MARCH} starts collecting points in. */
	private static final int STARTS_IN = 2028;

	/** And the season that is running then, which is the wrong answer. */
	private static final int STILL_RUNNING = 2027;

	/** Holds {@code queue:profiles} and nothing else. His account is a parent's. */
	private static final String PROFILES_MODERATOR = "profili@primer.rs";

	/** Holds {@code queue:profiles} too, so „somebody else" is somebody who also may. */
	private static final String THE_OTHER_PROFILES_MODERATOR = "profili2@primer.rs";

	/** Holds {@code queue:comments} and nothing else, and is asked about a profiles row. */
	private static final String COMMENTS_MODERATOR = "komentari@primer.rs";

	/** Holds {@code queue:teams} and nothing else. */
	private static final String TEAMS_MODERATOR = "timovi@primer.rs";

	/** Every right, with no tick anywhere (V5's {@code rights_mode = 'all'}). */
	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	/** Signed in and holding nothing, which is every member of the league. */
	private static final String A_COMPETITOR = "takmicar@primer.rs";

	private static final String ANA = "000010";

	private static final String BOJAN = "000020";

	private static final String VERA = "000030";

	/** The moderator's child, whose profile his ACCOUNT is not named after. */
	private static final String DETE = "000040";

	/** The name on the deciding moderator's ACCOUNT, which is the parent's. */
	private static final String THE_PARENTS_NAME = "Roditelj Roditeljic";

	/** And the name on the member row behind that same account, which is the child's. */
	private static final String THE_CHILDS_FIRST_NAME = "Dete";

	private static final String THE_REASON = "Slika je mutna, posalji ostriju";

	/** What Bojan and Vera ran their ten kilometres in. */
	private static final int AN_HOUR = 3600;

	/** What Ana ran the marathon in, and it is worth well over the twelve point threshold. */
	private static final int FOUR_HOURS = 14400;

	/** What Vera says her ten kilometres really took, and it is NOT {@link #AN_HOUR}: a
	 *  correction whose figures equal the counted ones would let a case about „the standings
	 *  changed" pass over a route that wrote nothing at all. */
	private static final int CORRECTED_TIME = 3300;

	/** What Vera's correction says her ten kilometres climbed and fell. The climb is not the
	 *  drop, and neither is the {@code 50} that the result she is correcting and the race both
	 *  carry: a correction that wrote nothing of them, or the wrong one of them, would
	 *  otherwise leave a row that is right by accident. */
	private static final int CORRECTED_CLIMB = 170;

	private static final int CORRECTED_DROP = 55;

	/** Ana's run at the free race: how long it took her, how far she went, and how far she
	 *  climbed and fell - four numbers the race says nothing about. The climb is not the drop
	 *  here either. */
	private static final int TWO_HOURS = 7200;

	private static final String TRAIL_KM = "14.35";

	private static final int TRAIL_CLIMB = 780;

	private static final int TRAIL_DROP = 210;

	/** What a member who left the beginners' category months ago already carries. It is not
	 *  written as twelve: the threshold is {@link Category#FIRST_SEASON_POINTS} and one place,
	 *  and this is plainly past it whatever that number becomes. */
	private static final String WELL_OVER_THE_THRESHOLD = "26.50";

	private static final String THE_TEAM = "Timocka trkacka druzina";

	/** The whole of {@code verification.body} for a comments row (dva izvora, jedna vrednost):
	 *  {@link #commentSubmissionWaitingFor} gives {@code comment_submission.body} the real
	 *  submitted text and {@code verification.body} this fixed literal instead - never a
	 *  concatenation of the two, or the real text would still be a substring of the queue's
	 *  own column and a case that checked for its absence would find it anyway. So a write
	 *  that published the queue copy and a read that served the submitted text are each caught
	 *  by a case that would otherwise pass on two columns that happened to agree. */
	private static final String QUEUE_BODY_MARKER = "STAVKA U REDU, NIJE OBJAVLJENI TEKST";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	/** Asked by the cases about the beginners' category, so they read the answer through the
	 *  same component the route does rather than through a query of their own. */
	@Autowired
	private BestOfficialSeason bestOfficialSeason;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/** The text item about Ana, which most cases below answer. */
	private long anasText;

	/** The item carrying a picture, which is the only one that ever clears a photo. */
	private long verasPicture;

	/** An item about nobody in the record at all. */
	private long aboutNobody;

	/** One already answered, so „already decided" is a real row and not a mutation. */
	private long alreadyAnswered;

	/** The team proposal Bojan sent. */
	private long bojansTeam;

	/** A waiting comment about the event with two races, one Saturday and one Sunday. */
	private long anasComment;

	/** A waiting comment, never rated, for the refusal cases - made LAST of the three by id,
	 *  after {@code bojansComment} was moved off that spot in round 7 (PR 354 review): see
	 *  the field comment below for why the middle spot is the one that matters. */
	private long verasComment;

	/** A third waiting comment, made SECOND, NEITHER FIRST NOR LAST BY id (PR 354 review,
	 *  round 4, blizanac visokog iz kruga 1; moved off the last spot in round 7, where a
	 *  commit had claimed this shape while the code still made it last). With only
	 *  {@code anasComment} and {@code verasComment}, the one this fixture ever approves -
	 *  {@code anasComment} - was made FIRST and so always happened to equal
	 *  {@code min(comment_submission.id)} too; a write that read the lowest id in the table
	 *  instead of the one the queue row actually named agreed with every comments case by
	 *  accident, exactly the fault the event axis of the same statement is already guarded
	 *  against below. {@code bojansComment} is neither {@code anasComment} nor
	 *  {@code verasComment}'s twin: it is approved in its own case, and made second, neither
	 *  an id below it nor one above it is the right answer, so that case is caught by a query
	 *  that fell back to the lowest id in the table and by one that fell back to the highest,
	 *  not only by one of the two. */
	private long bojansComment;

	/** The event every comment in this fixture is about. */
	private long theWeekendEvent;

	/** 42,195 km, the one value that tells a narrow column from a wide one. */
	private long theMarathon;

	/** A second race, so „the race" is never „the only race". */
	private long theShortRace;

	/** The result Vera already has counted, and the one her correction amends. */
	private long verasCountedRun;

	/** Made FIRST of the five, because the floor over the tabs reads the lowest id. */
	private long bojansRun;

	/** Made SECOND: neither the lowest nor the highest id in the tab. */
	private long anasMarathon;

	/** A correction of {@link #verasCountedRun}, which an approval must overwrite. */
	private long verasCorrection;

	/** A run on a race the calendar does not hold, which this route refuses. */
	private long aRunOnARaceNobodyHasEnteredYet;

	/** A results row naming no submission, which V10 permits and this route refuses. */
	private long aResultsRowNamingNoRun;

	/** A second run for a member who was over the threshold before this branch existed. */
	private long detesSecondRun;

	/** A race that fixes nothing, so what a run at it says is all the runner's own. */
	private long theTrail;

	/** A first report whose climb is not its drop, at {@link #theTrail}. */
	private long anasTrailRun;

	/** A second, unrelated event: what proves a comment is filed under the one it was
	 *  actually about rather than under any other row that happens to exist. */
	private long anotherEvent;

	private static final LocalDate SATURDAY = LocalDate.of(2027, 4, 10);

	private static final LocalDate THE_OTHER_EVENTS_DAY = LocalDate.of(2027, 5, 1);

	/**
	 * A CLOCK THE CASE MOVES, copied from {@code PairWriteApiTest} with its reason.
	 *
	 * <p>It reports UTC as its zone on purpose: whoever works out a season has to re-read the
	 * instant in the league's own time, and a server that reads this zone instead answers with
	 * the wrong year on the one night that matters.
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
			return new AClockTheCaseMoves(IN_MARCH);
		}
	}

	@BeforeEach
	void sixAccountsFourMembersAndFiveTabs() {
		clock.moveTo(IN_MARCH);

		member(ANA, "Ana", "Anic");
		member(BOJAN, "Bojan", "Bojic");
		member(VERA, "Vera", "Veric");
		member(DETE, THE_CHILDS_FIRST_NAME, "Detic");

		/* THE PARENT HOLDS THE CHILD'S ACCOUNT (PDL P21), which is what makes
		   `account.first_name` and `competitor.first_name` two values rather than one. */
		account(PROFILES_MODERATOR, "moderator", "Roditelj", "Roditeljic", DETE);
		account(THE_OTHER_PROFILES_MODERATOR, "moderator", "Druga", "Drugic", null);
		account(COMMENTS_MODERATOR, "moderator", "Komentar", "Komentaric", null);
		account(TEAMS_MODERATOR, "moderator", "Timo", "Timic", BOJAN);
		account(THE_SUPERADMIN, "superadmin", "Sanja", "Simic", null);
		account(A_COMPETITOR, "competitor", "Tijana", "Takic", ANA);

		ticked(PROFILES_MODERATOR, "queue:profiles");
		ticked(THE_OTHER_PROFILES_MODERATOR, "queue:profiles");
		ticked(COMMENTS_MODERATOR, "queue:comments");
		ticked(TEAMS_MODERATOR, "queue:teams");

		/* FOUR IN THE PROFILES TAB AND NOT ONE, so „this item" is never „the first item". */
		waiting("profiles", BOJAN, "Biografija Bojana", "Trcim od 2019.", null);
		anasText = waiting("profiles", ANA, "Biografija Ane", "Trcim od 2021. godine", null);
		verasPicture = waiting("profiles", VERA, "Slika Vere", "vera.jpg", photograph());
		aboutNobody = waitingAboutNobody("profiles", "Neko ko nije u evidenciji");
		alreadyAnswered = decided("profiles", BOJAN, "Vec odluceno", "approved", null);

		bojansTeam = teamProposalWaitingFor(BOJAN, THE_TEAM);

		/* TWO EVENTS, NOT ONE, so a write that filed a comment under `min(id)` or under
		   `max(id)` instead of the event it was actually about has somewhere else to be
		   caught reaching. AND theWeekendEvent IS MADE SECOND, NEITHER FIRST NOR LAST BY
		   id (PR 354 review): with `anasComment` made first and `verasComment` made last,
		   the one this fixture approves in its own case - `bojansComment`, made second -
		   is neither the lowest nor the highest id in the table either way. */
		anotherEvent = event("drugi-dogadjaj-v30", "Drugi dogadjaj", THE_OTHER_EVENTS_DAY);

		theWeekendEvent = event("prvi-dogadjaj-v30", "Prvi dogadjaj", SATURDAY);

		anasComment = commentSubmissionWaitingFor(ANA, theWeekendEvent, "Komentar o prvom dogadjaju",
				4, 5, 3, "Odlicna staza");
		/* MADE SECOND ON PURPOSE (PR 354 review, round 4; moved off the last spot in round 7):
		   see the field comment above for why the id axis needs a third row in the middle,
		   between the other two, and not at either end. */
		bojansComment = commentSubmissionWaitingFor(BOJAN, theWeekendEvent, "Komentar Bojana",
				5, 4, 5, "Sjajna organizacija");
		verasComment = commentSubmissionWaitingFor(VERA, theWeekendEvent, "Komentar Vere", 0, 0, 0, "");

		/* TWO RACES IN THE CALENDAR AND NOT ONE, in two events, so „the race" is never „the
		   only race" and a write that read `min(race.id)` has somewhere to be caught.

		   THE MARATHON IS MEASURED AT 42,195 ON PURPOSE. It is the number V25 and V32 both
		   use to say what a narrow column costs, and the only value in this fixture that
		   tells a `numeric(6,2)` column apart from a `numeric(8,4)` one. Approved into the
		   old column it would be stored as 42.20, and `result.category` would then say
		   `marathon` while `race.category` says `long` - two rows about one run, disagreeing,
		   silently. */
		theMarathon = race(theWeekendEvent, "Maraton", SATURDAY, "42.1950", 300, 300);
		theShortRace = race(anotherEvent, "Desetka", THE_OTHER_EVENTS_DAY, "10.00", 50, 50);

		/* A RESULT VERA ALREADY HAS, so a correction is a correction OF something and the
		   standings have an old value to keep while it waits. */
		verasCountedRun = resultAlreadyCounted(VERA, theShortRace, THE_OTHER_EVENTS_DAY,
				"10.00", 50, 50, AN_HOUR, "3.73");

		/* FIVE ROWS IN THE RESULTS TAB, and each is a different one of the five states this
		   route can meet. `bojansRun` is made FIRST because the floor over the five tabs takes
		   `order by id limit 1`, and it is the one no other case depends on.

		   `anasMarathon` is made SECOND, neither first nor last, so the case that approves it
		   is caught by a read that fell back to the lowest id in the table and by one that
		   fell back to the highest. */
		bojansRun = runWaitingFor(BOJAN, theShortRace, THE_OTHER_EVENTS_DAY, "10.00", 50, 50,
				AN_HOUR, null);
		anasMarathon = runWaitingFor(ANA, theMarathon, SATURDAY, "42.1950", 300, 300,
				FOUR_HOURS, null);
		verasCorrection = runWaitingFor(VERA, theShortRace, THE_OTHER_EVENTS_DAY, "10.00",
				CORRECTED_CLIMB, CORRECTED_DROP, CORRECTED_TIME, verasCountedRun);
		aRunOnARaceNobodyHasEnteredYet = describedRunWaitingFor(ANA, THE_OTHER_EVENTS_DAY);
		aResultsRowNamingNoRun = waiting("results", VERA, "Red bez prijave", "", null);

		/* AND A MEMBER WHO WAS ALREADY OVER THE THRESHOLD BEFORE ANY OF THIS, which is the
		   third state of the category axis and the one a fixture normally misses. With only
		   „he crosses it now" and „he is nowhere near", a route that told every member on
		   every approval and a route that told the right one are told apart by the second
		   case alone - and a member who crossed the threshold last month would be told again
		   on every run he sends for the rest of the season. */
		resultAlreadyCounted(DETE, theMarathon, SATURDAY, "42.1950", 300, 300, FOUR_HOURS,
				WELL_OVER_THE_THRESHOLD);
		detesSecondRun = runWaitingFor(DETE, theShortRace, THE_OTHER_EVENTS_DAY, "10.00", 50, 50,
				AN_HOUR, null);

		/* A RUN WHOSE CLIMB IS NOT ITS DROP, AT A RACE THAT CARRIES NEITHER (PR 443 review).
		   Every run above climbs exactly as far as it falls and sits on a race carrying the
		   same two numbers, so an approval that swapped them, or read them off the race,
		   agreed with every assertion made about it. This is the first-report half of the
		   answer, and `verasCorrection` above is the other half, for the statement that
		   overwrites.

		   It is Ana's because she has an account, so the letter about it has somewhere to go,
		   and no counted result, so `onlyResultOf` still names the one row it writes. The race
		   is FREE, which is what makes the figures hers: on a free race the four figures are
		   what THIS runner covered (V7), so nothing on the race can be mistaken for what she
		   sent. */
		theTrail = freeRace(theWeekendEvent, "Brdska trka", SATURDAY);
		anasTrailRun = runWaitingFor(ANA, theTrail, SATURDAY, TRAIL_KM, TRAIL_CLIMB, TRAIL_DROP,
				TWO_HOURS, null);

		waiting("payments", VERA, "Uplata", "", null);
	}

	// ----- the doors -------------------------------------------------------------------

	@Test
	void somebodyNotSignedInIsRefusedBeforeAnyOfThisRuns() throws Exception {
		assertThat(http.perform(asking(null, post(hold(anasText))))
				.andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(http.perform(asking(null, delete(hold(anasText))))
				.andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(answer(null, anasText, true, null)).isEqualTo(401);

		/* AND ON THE TAB V30 ADDED (PR 354 review, ADL A8): the door runs before
		   `itemHeMayModerate` ever reads which tab the row stands in, so it must refuse
		   somebody not signed in exactly as readily here as on profiles above. */
		assertThat(answer(null, anasComment, true, null)).isEqualTo(401);
	}

	@Test
	void aPlainCompetitorIsToldTheAddressIsNotThere() throws Exception {
		assertThat(answer(A_COMPETITOR, anasText, true, null)).isEqualTo(404);
		assertThat(take(A_COMPETITOR, anasText)).isEqualTo(404);
	}

	/**
	 * THE AXIS THIS WHOLE FILE IS BUILT AROUND.
	 *
	 * <p>He is a real moderator with a real queue tick, and the row is in another tab. A
	 * route asking „does he hold any queue" would let him through, and every case written
	 * with a plain competitor would stay green while it did.
	 */
	@Test
	void aModeratorIsToldNothingAboutAnItemInATabHeDoesNotHold() throws Exception {
		assertThat(answer(COMMENTS_MODERATOR, anasText, true, null)).isEqualTo(404);
		assertThat(take(COMMENTS_MODERATOR, anasText)).isEqualTo(404);
		assertThat(letGo(COMMENTS_MODERATOR, anasText)).isEqualTo(404);

		/* AND THE ROW IS UNTOUCHED, which is the half a status alone does not say. */
		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	/**
	 * THE SAME AXIS, ASKED OF THE TAB V30 ADDED (PR 354 review, ADL A8).
	 *
	 * <p>Until this case, every door test in this file asked only about a {@code profiles}
	 * row, so a door that opened {@code comments} to anybody signed in - the shape the
	 * review's mutation took - answered every one of them exactly as it always had and
	 * failed nothing.
	 */
	@Test
	void aModeratorIsToldNothingAboutAWaitingCommentWhenHeDoesNotHoldThatQueue() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasComment, true, null)).isEqualTo(404);
		assertThat(take(PROFILES_MODERATOR, anasComment)).isEqualTo(404);
		assertThat(letGo(PROFILES_MODERATOR, anasComment)).isEqualTo(404);

		assertThat(stateOf(anasComment)).isEqualTo("waiting");
	}

	/**
	 * An item he may not see and an item that is not there are one answer, so the key never
	 * becomes an oracle for what is standing in the queue.
	 */
	@Test
	void anItemHeMayNotSeeAnswersExactlyAsOneThatIsNotThere() throws Exception {
		var refused = http.perform(asking(COMMENTS_MODERATOR, post(hold(anasText))))
				.andReturn().getResponse();
		var missing = http.perform(asking(COMMENTS_MODERATOR, post(hold(9_999_999L))))
				.andReturn().getResponse();

		assertThat(refused.getStatus()).isEqualTo(missing.getStatus());
		assertThat(refused.getContentAsString()).isEqualTo(missing.getContentAsString());
	}

	// ----- holding ---------------------------------------------------------------------

	@Test
	void heTakesTheItemAndIsToldHowLongHeHasIt() throws Exception {
		var answer = http.perform(asking(PROFILES_MODERATOR, post(hold(anasText))))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(answer.getContentAsString())
				.contains("\"secondsLeft\":" + HoldingAnItem.QUIET.toSeconds());

		assertThat(heldBy(anasText)).isEqualTo(accountOf(PROFILES_MODERATOR));
	}

	@Test
	void anItemSomebodyElseIsReadingIsRefusedToEverybodyElse() throws Exception {
		assertThat(take(THE_OTHER_PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(409);
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(409);

		/* AND IT IS STILL THE OTHER MAN'S, which „409" alone does not say. */
		assertThat(heldBy(anasText)).isEqualTo(accountOf(THE_OTHER_PROFILES_MODERATOR));
		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	@Test
	void hisOwnHoldIsNeverInHisWay() throws Exception {
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(200);
	}

	/**
	 * THE OWNER'S FIFTEEN MINUTES, MEASURED ON BOTH SIDES OF ITSELF.
	 *
	 * <p>„Zakljucavanje ISTICE posle vremena mirovanja, i tada stavku uzima ko hoce" (owner,
	 * 18.09.2026), chosen against the cost he was shown: „pad pregledaca ili zatvoren laptop
	 * drzali bi stavku zauvek".
	 *
	 * <p><b>One fixture and two moments, which is the only shape that measures this.</b> A
	 * case that takes a hold and asks straight away is green whether the spell is fifteen
	 * minutes or a fortnight; what says which is asking again after it should have run out.
	 * The hold below is the SAME hold both times and only the clock moves.
	 */
	@Test
	void aHoldStandsInTheWayForFifteenMinutesAndNotAMinuteLonger() throws Exception {
		assertThat(take(THE_OTHER_PROFILES_MODERATOR, anasText)).isEqualTo(200);

		clock.moveTo(IN_MARCH.plus(Duration.ofMinutes(3)));
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(409);
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(409);

		clock.moveTo(IN_MARCH.plus(Duration.ofMinutes(16)));
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);
		assertThat(heldBy(anasText)).isEqualTo(accountOf(PROFILES_MODERATOR));
	}

	@Test
	void heLetsGoOfHisOwnAndNothingIsLeftHolding() throws Exception {
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(letGo(PROFILES_MODERATOR, anasText)).isEqualTo(204);
		assertThat(holdsOn(anasText)).isZero();

		/* Letting go of nothing is not a fault: a screen closed twice has done nothing. */
		assertThat(letGo(PROFILES_MODERATOR, anasText)).isEqualTo(204);
	}

	@Test
	void aModeratorMayNotTakeAHoldOffAnother() throws Exception {
		assertThat(take(THE_OTHER_PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(letGo(PROFILES_MODERATOR, anasText)).isEqualTo(409);
		assertThat(heldBy(anasText)).isEqualTo(accountOf(THE_OTHER_PROFILES_MODERATOR));
	}

	/**
	 * „Superadmin SME da otme tudje zakljucavanje, I ONAJ KOME JE OTETO TO SAZNA" (owner,
	 * 18.09.2026), with the cost he accepted written beside it: „jedna ruta vise i jedna
	 * poruka u sanduce, da moderator ne otkrije tek kad mu odluka ne prodje."
	 */
	@Test
	void theSuperadminTakesAHoldAwayAndTheManWhoHeldItIsTold() throws Exception {
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(letGo(THE_SUPERADMIN, anasText)).isEqualTo(204);
		assertThat(holdsOn(anasText)).isZero();

		/* TO HIM AND NOT TO THE LEAGUE: an empty `to_id` is everybody (V13). */
		assertThat(db.sql("select count(*) from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(DETE).query(Integer.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from message where to_id is null")
				.query(Integer.class).single()).isZero();
	}

	/**
	 * V23 says an account naming no member is the ordinary case for a moderator who does not
	 * race, so there may be no inbox to write to. The hold still goes.
	 */
	@Test
	void aHoldIsTakenAwayFromAModeratorWhoDoesNotRaceAndThereIsSimplyNobodyToTell()
			throws Exception {
		assertThat(take(THE_OTHER_PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(letGo(THE_SUPERADMIN, anasText)).isEqualTo(204);
		assertThat(holdsOn(anasText)).isZero();
		assertThat(db.sql("select count(*) from message").query(Integer.class).single()).isZero();
	}

	/**
	 * AND NOTHING IS HELD IN A TAB THIS ROUTE CANNOT ANSWER.
	 *
	 * <p>Without this a moderator of payments takes an item, is told he has fifteen minutes,
	 * and at the end of them is refused 409 whatever he presses. That is the same refusal he
	 * would have had at once, delivered a quarter of an hour late and after he has read the
	 * thing. The superadmin is asked here because he holds every tab, so the refusal cannot
	 * be his rights - it is the tab.
	 */
	@Test
	void nothingIsHeldInATabThisRouteCannotAnswer() throws Exception {
		long payment = db.sql("select id from verification where queue = 'payments'"
				+ " and state = 'waiting' order by id limit 1").query(Long.class).single();

		assertThat(take(THE_SUPERADMIN, payment)).isEqualTo(409);
		assertThat(holdsOn(payment)).isZero();

		assertThat(take(THE_SUPERADMIN, anasText))
				.as("the superadmin cannot hold anything at all, so the refusal above is not"
						+ " about the tab")
				.isEqualTo(200);
	}

	@Test
	void nothingIsHeldInOrderToBeReadOnceItHasBeenAnswered() throws Exception {
		assertThat(take(PROFILES_MODERATOR, alreadyAnswered)).isEqualTo(409);
		assertThat(holdsOn(alreadyAnswered)).isZero();
	}

	// ----- deciding --------------------------------------------------------------------

	@Test
	void approvingATextPutsItOnTheProfileAndTakesTheItemOutOfTheQueue() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(200);

		assertThat(stateOf(anasText)).isEqualTo("approved");
		assertThat(db.sql("select bio from competitor where member_number = ?")
				.param(ANA).query(String.class).single()).isEqualTo("Trcim od 2021. godine");

		/* AND IT IS GONE FOR EVERYBODY, which needs no mechanism of its own: the queue serves
		   `state = 'waiting'`, so one answer removes it from every screen at once. */
		assertThat(http.perform(asking(PROFILES_MODERATOR, get("/api/verification")))
				.andReturn().getResponse().getContentAsString())
				.doesNotContain("Biografija Ane");
	}

	/**
	 * „Poruka o odbijanju ide sa svih redova verifikacije... razlog stize u sanduce onome ko
	 * je stavku poslao" (owner, PDL P22, 15.08.2026).
	 *
	 * <p><b>TO HIM AND NEVER TO THE LEAGUE.</b> {@code message.to_id} left empty means
	 * everybody (V13), so the source this assertion reads is swapped deliberately: a refusal
	 * posted to the whole portal would satisfy „the member was told" just as well.
	 */
	@Test
	void aRefusalSaysWhyAndTheReasonReachesThatMemberAndNobodyElse() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, verasPicture, false, THE_REASON)).isEqualTo(200);

		assertThat(stateOf(verasPicture)).isEqualTo("rejected");
		assertThat(db.sql("select reason from verification where id = ?")
				.param(verasPicture).query(String.class).single()).isEqualTo(THE_REASON);

		assertThat(db.sql("select body from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(VERA).query(String.class).single()).isEqualTo(THE_REASON);

		assertThat(db.sql("select count(*) from message where to_id is null")
				.query(Integer.class).single()).isZero();
		assertThat(db.sql("select count(*) from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(ANA).query(Integer.class).single()).isZero();
	}

	/**
	 * „Uz odbijanje je komentar obavezan" (owner, 06.08.2026), and the schema says the same
	 * with {@code btrim}: a box holding spaces is a box nobody filled in.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "   "})
	void aRefusalWithNothingInTheBoxIsNotADecision(String typed) throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, false, typed)).isEqualTo(400);
		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	/**
	 * AN EMPTY OBJECT IS A FORM NOBODY FILLED IN, and it is the only incomplete body that
	 * reaches the method at all: a missing or unreadable one is refused by the chain, which
	 * is why the route carries no null check over it.
	 */
	/**
	 * THE FORM IS NOT SPOKEN OF TO SOMEBODY WHO MAY NOT DECIDE, and this is a leak rather
	 * than a tidiness.
	 *
	 * <p>Asked the other way round - the body checked before the door - a plain competitor
	 * sending an empty object was answered 400 while the same body on an address that maps
	 * nothing was answered 404. One request, and he has learnt that an administrative action
	 * lives there, which ADL A8 forbids in as many words: „ne sme ni da sazna da radnja
	 * postoji". The bytes of that difference are measured over a socket in
	 * {@code RightsOverRealHttpTest}; what is held here is the order of the two checks.
	 *
	 * <p><b>Both askers are refused for different reasons and must answer alike:</b> the
	 * competitor holds nothing, the comments moderator holds a tab that is not this row's.
	 */
	@ParameterizedTest
	@ValueSource(strings = {A_COMPETITOR, COMMENTS_MODERATOR})
	void aFormThatSaysNothingIsNotSpokenOfToSomebodyWhoMayNotDecide(String asker) throws Exception {
		assertThat(http.perform(asking(asker, post(decision(anasText)))
						.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andReturn().getResponse().getStatus())
				.as("an incomplete form is answered about before the door is, so the refusal"
						+ " tells him the route is there")
				.isEqualTo(404);

		assertThat(http.perform(asking(PROFILES_MODERATOR, post(decision(anasText)))
						.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andReturn().getResponse().getStatus())
				.as("nobody at all is told 400 for an empty form, so the two answers above are"
						+ " equal for a reason that has nothing to do with the door")
				.isEqualTo(400);
	}

	@Test
	void aBodyThatSaysNothingAtAllIsNotADecision() throws Exception {
		assertThat(http.perform(asking(PROFILES_MODERATOR, post(decision(anasText)))
						.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andReturn().getResponse().getStatus()).isEqualTo(400);

		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	@Test
	void aRefusalWithNoBoxAtAllIsNotADecisionEither() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, false, null)).isEqualTo(400);
		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	/**
	 * V9's {@code verification_refusal_says_why} is a biconditional, so an approval must carry
	 * NO reason. A moderator who typed something and then pressed yes would otherwise have his
	 * note written beside an approval and the row thrown out.
	 */
	@Test
	void anApprovalCarriesNoReasonEvenWhenTheBoxWasFilledIn() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, true, THE_REASON)).isEqualTo(200);

		assertThat(db.sql("select reason from verification where id = ?")
				.param(anasText).query(String.class).optional()).isEmpty();
	}

	@Test
	void answeringSomethingSomebodyAnsweredAlreadyIsRefusedAndChangesNothing() throws Exception {
		String who = db.sql("select decided_by_name from verification where id = ?")
				.param(alreadyAnswered).query(String.class).single();

		assertThat(answer(PROFILES_MODERATOR, alreadyAnswered, false, THE_REASON)).isEqualTo(409);

		assertThat(stateOf(alreadyAnswered)).isEqualTo("approved");
		assertThat(db.sql("select decided_by_name from verification where id = ?")
				.param(alreadyAnswered).query(String.class).single()).isEqualTo(who);
	}

	/**
	 * THE PICTURE GOES THE MOMENT THE ROW IS ANSWERED, EITHER WAY.
	 *
	 * <p>{@code verification_decided_keeps_no_photo} is what insists, and this item is
	 * written by hand because nothing on this server writes a picture into that tab yet - so a
	 * fixture made of what the portal really writes never touches the constraint at all.
	 */
	@Test
	void decidingLetsGoOfThePictureAndApprovingOneMakesItHisPortrait() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, verasPicture, true, null)).isEqualTo(200);

		assertThat(db.sql("select photo_id from verification where id = ?")
				.param(verasPicture).query(Long.class).optional()).isEmpty();
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional()).isNotEmpty();
	}

	@Test
	void aRefusedPictureIsLetGoOfWithoutBecomingAnybodysPortrait() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, verasPicture, false, THE_REASON)).isEqualTo(200);

		assertThat(db.sql("select photo_id from verification where id = ?")
				.param(verasPicture).query(Long.class).optional()).isEmpty();
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional()).isEmpty();
	}

	/**
	 * V9 makes {@code competitor_id} nullable on purpose - „A payment waiting to be recognised
	 * may be about a person who is not one yet" - so a decision must not fall over a row that
	 * names nobody, and there is simply nobody to write to.
	 */
	@Test
	void anItemAboutNobodyIsAnsweredAndNobodyIsWrittenTo() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, aboutNobody, false, THE_REASON)).isEqualTo(200);

		assertThat(stateOf(aboutNobody)).isEqualTo("rejected");
		assertThat(db.sql("select count(*) from message").query(Integer.class).single()).isZero();
	}

	/**
	 * WHO DECIDED IS THE NAME ON THE ACCOUNT AND NOT THE NAME ON THE MEMBER ROW BEHIND IT.
	 *
	 * <p>Two different values rather than one read twice: PDL P21 puts a parent on the account
	 * of a competitor under sixteen, so this moderator signs in as {@code Roditelj Roditeljic}
	 * while the member his account names is {@code Dete Detic}.
	 */
	@Test
	void theDecisionKeepsTheNameOnTheAccountAndNotTheNameOnHisMemberRow() throws Exception {
		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(200);

		assertThat(db.sql("select decided_by_name from verification where id = ?")
				.param(anasText).query(String.class).single())
				.isEqualTo(THE_PARENTS_NAME)
				.doesNotContain(THE_CHILDS_FIRST_NAME);

		assertThat(db.sql("select decided_by from verification where id = ?")
				.param(anasText).query(Long.class).single())
				.isEqualTo(accountOf(PROFILES_MODERATOR));
	}

	@Test
	void answeringAnItemLetsGoOfWhateverWasHoldingIt() throws Exception {
		assertThat(take(PROFILES_MODERATOR, anasText)).isEqualTo(200);

		assertThat(answer(PROFILES_MODERATOR, anasText, true, null)).isEqualTo(200);
		assertThat(holdsOn(anasText)).isZero();
	}

	// ----- what an approval means ------------------------------------------------------

	/**
	 * „Odobrenje pravi tim... i od tog trenutka imaju Admin prava za svoj tim" (owner,
	 * 03.08.2026), and „Odobrenje novog tima upisuje osnivaca u taj tim" (05.09.2026), which a
	 * review of PR 186 found when approval wrote the team and left the founder out of it.
	 */
	@Test
	void approvingATeamMakesItPutsTheFounderInItAndTellsHim() throws Exception {
		assertThat(answer(TEAMS_MODERATOR, bojansTeam, true, null)).isEqualTo(200);

		assertThat(db.sql("select slug from team where name = ?")
				.param(THE_TEAM).query(String.class).single()).isEqualTo("timocka-trkacka-druzina");

		assertThat(db.sql("select admin_id from team where name = ?")
				.param(THE_TEAM).query(Long.class).single()).isEqualTo(memberId(BOJAN));

		assertThat(db.sql("select count(*) from team_membership m join team t on t.id = m.team_id"
						+ " where t.name = ? and m.competitor_id = ? and m.season_to is null")
				.params(THE_TEAM, memberId(BOJAN)).query(Integer.class).single()).isEqualTo(1);

		assertThat(db.sql("select count(*) from message where to_id = ?")
				.param(memberId(BOJAN)).query(Integer.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from message where to_id is null")
				.query(Integer.class).single()).isZero();
	}

	/**
	 * THE SEASON IS THE ONE TRANSFERS TAKE EFFECT IN, AND THE PORTAL HAS ALREADY GOT THIS
	 * WRONG ONCE.
	 *
	 * <p>{@link SeasonClock#transfersTakeEffect} carries the measurement: „a team proposal
	 * sent in December and approved on 5 January wrote the RUNNING season, and the team
	 * counted that member's results from the middle of it" (06.09.2026). The clock stands in
	 * March precisely so the two answers differ, and both numbers are asserted rather than
	 * only the right one - otherwise this reads as „some season was written".
	 */
	@Test
	void theTeamAndItsFounderBothStartInTheSeasonTransfersTakeEffectIn() throws Exception {
		assertThat(SeasonClock.transfersTakeEffect(IN_MARCH.atZone(SeasonClock.ZONE)))
				.isEqualTo(STARTS_IN);
		assertThat(SeasonClock.seasonBeingPaidFor(IN_MARCH.atZone(SeasonClock.ZONE)))
				.isEqualTo(STILL_RUNNING);

		assertThat(answer(TEAMS_MODERATOR, bojansTeam, true, null)).isEqualTo(200);

		assertThat(db.sql("select first_season from team where name = ?")
				.param(THE_TEAM).query(Integer.class).single()).isEqualTo(STARTS_IN);

		assertThat(db.sql("select m.season_from from team_membership m join team t"
						+ " on t.id = m.team_id where t.name = ?")
				.param(THE_TEAM).query(Integer.class).single()).isEqualTo(STARTS_IN);
	}

	@Test
	void refusingATeamMakesNoTeamAndTellsTheMemberWhy() throws Exception {
		assertThat(answer(TEAMS_MODERATOR, bojansTeam, false, THE_REASON)).isEqualTo(200);

		assertThat(db.sql("select count(*) from team").query(Integer.class).single()).isZero();
		assertThat(db.sql("select count(*) from team_membership")
				.query(Integer.class).single()).isZero();
		assertThat(db.sql("select body from message where to_id = ?")
				.param(memberId(BOJAN)).query(String.class).single()).isEqualTo(THE_REASON);
	}

	/**
	 * „Naziv ne sme biti zauzet nekim vec odobrenim timom" (PDL P13), measured by the ADDRESS
	 * the name makes and not by its letters (ADL, 03.08.2026).
	 *
	 * <p><b>And the item stays in the queue.</b> An answer that cannot be carried out must not
	 * leave the row marked answered and the team unmade, which is the one outcome nobody could
	 * undo from a screen.
	 */
	@Test
	void aTeamWhoseAddressHasBeenTakenSinceIsRefusedAndItsItemStaysInTheQueue() throws Exception {
		db.sql("insert into team (slug, name, bio, link, place_id, first_season)"
						+ " values ('timocka-trkacka-druzina', 'Timocka Trkacka Druzina', '', '',"
						+ " (select id from place where rank = 1), ?)")
				.param(STARTS_IN).update();

		assertThat(answer(TEAMS_MODERATOR, bojansTeam, true, null)).isEqualTo(409);

		assertThat(stateOf(bojansTeam)).isEqualTo("waiting");
		assertThat(db.sql("select count(*) from team_membership")
				.query(Integer.class).single()).isZero();
	}

	@Test
	void aFounderWhoIsAlreadyInATeamIsRefusedAndHisItemStaysInTheQueue() throws Exception {
		long other = db.sql("insert into team (slug, name, bio, link, place_id, first_season)"
						+ " values ('neki-drugi-tim', 'Neki drugi tim', '', '',"
						+ " (select id from place where rank = 1), ?) returning id")
				.param(STARTS_IN).query(Long.class).single();

		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, ?)")
				.params(memberId(BOJAN), other, STARTS_IN).update();

		assertThat(answer(TEAMS_MODERATOR, bojansTeam, true, null)).isEqualTo(409);

		assertThat(stateOf(bojansTeam)).isEqualTo("waiting");
		assertThat(db.sql("select count(*) from team where name = ?")
				.param(THE_TEAM).query(Integer.class).single()).isZero();
	}

	// ----- comments, and the one refusal that needs no reason (ADL A64) -----------------

	/**
	 * THE SUBMISSION BECOMES A PUBLISHED COMMENT, under the event it was written about and
	 * not under whichever event a query happened to find first.
	 *
	 * <p>{@code theWeekendEvent} is not the only event in the fixture and is neither the
	 * first nor the last one made ({@code anotherEvent} is made before it and
	 * {@code theBareEvent} after), so a write that filed the comment under the lowest id,
	 * the highest id, or under none at all, is caught here and not only by a query that
	 * never had another event to confuse it with.
	 */
	@Test
	void approvingACommentPublishesItUnderTheEventItWasWrittenAboutAndRemovesItFromTheQueue()
			throws Exception {
		assertThat(answer(COMMENTS_MODERATOR, anasComment, true, null)).isEqualTo(200);

		assertThat(stateOf(anasComment)).isEqualTo("approved");

		assertThat(db.sql("select count(*) from event_comment where event_id = ?")
				.param(theWeekendEvent).query(Integer.class).single())
				.as("the comment did not land under the event it was written about")
				.isOne();

		assertThat(db.sql("select who from event_comment where event_id = ?")
				.param(theWeekendEvent).query(String.class).single()).isEqualTo("Ana Anic");
		assertThat(db.sql("select rating_organisation from event_comment where event_id = ?")
				.param(theWeekendEvent).query(Integer.class).single()).isEqualTo(4);
		assertThat(db.sql("select rating_value from event_comment where event_id = ?")
				.param(theWeekendEvent).query(Integer.class).single()).isEqualTo(5);
		assertThat(db.sql("select rating_ambience from event_comment where event_id = ?")
				.param(theWeekendEvent).query(Integer.class).single()).isEqualTo(3);
		assertThat(db.sql("select body from event_comment where event_id = ?")
				.param(theWeekendEvent).query(String.class).single()).isEqualTo("Odlicna staza");

		assertThat(db.sql("select count(*) from event_comment where event_id = ?")
				.param(anotherEvent).query(Integer.class).single())
				.as("a comment about the weekend event was filed under a different one too")
				.isZero();
	}

	/**
	 * AND THE SUBMISSION A CASE APPROVES IS NEVER CONFUSED WITH WHICHEVER ROW HAPPENS TO
	 * CARRY THE FIXTURE'S LOWEST OR HIGHEST {@code comment_submission.id} (PR 354 review,
	 * round 4, blizanac visokog iz kruga 1 - jednu tabelu dalje; widened to guard both ends
	 * in round 7, after a commit claimed this shape a round early while the row it names was
	 * still the one made last).
	 *
	 * <p>{@code bojansComment} is not the only comment submission in the fixture and is made
	 * SECOND, neither first nor last by id: {@code anasComment}, the one every other case
	 * above approves, is made FIRST and so always happens to equal
	 * {@code min(comment_submission.id)}, and {@code verasComment} is made LAST and so always
	 * happens to equal {@code max(comment_submission.id)}. A write that read either the
	 * lowest or the highest id in the table instead of the id the queue row actually named is
	 * therefore caught here, and this is the axis round 2 counted for the event a comment is
	 * filed under but not, until round 7, for the submission a comment is read from, in the
	 * very same statement.
	 */
	@Test
	void approvingACommentMadeBetweenTheOthersIsNotConfusedWithTheFixturesLowestOrHighestId()
			throws Exception {
		assertThat(answer(COMMENTS_MODERATOR, bojansComment, true, null)).isEqualTo(200);

		assertThat(db.sql("select who from event_comment where event_id = ?")
				.param(theWeekendEvent).query(String.class).single())
				.as("the comment made between the other two in the fixture published under a"
						+ " different author's name")
				.isEqualTo("Bojan Bojic");
		assertThat(db.sql("select rating_organisation from event_comment where event_id = ?")
				.param(theWeekendEvent).query(Integer.class).single()).isEqualTo(5);
		assertThat(db.sql("select rating_value from event_comment where event_id = ?")
				.param(theWeekendEvent).query(Integer.class).single()).isEqualTo(4);
		assertThat(db.sql("select rating_ambience from event_comment where event_id = ?")
				.param(theWeekendEvent).query(Integer.class).single()).isEqualTo(5);
		assertThat(db.sql("select body from event_comment where event_id = ?")
				.param(theWeekendEvent).query(String.class).single())
				.isEqualTo("Sjajna organizacija");
	}

	/**
	 * AND UNDER THE NAME THE MEMBER CARRIES AT THE MOMENT OF PUBLISHING, NEVER THE ONE
	 * CAPTURED WHEN HE SENT IT IN (ADL A64 A5, 22.09.2026).
	 *
	 * <p>Ana renames herself between sending {@code anasComment} in and a moderator
	 * approving it, so her name at submission ("Ana Anic") and her name at the moment of
	 * approval ("Ana Novic") disagree on purpose - the one axis a name read from anywhere
	 * but fresh off {@code competitor}, at the moment {@code publishTheComment} runs, cannot
	 * be told apart from the fix by, since both would answer "Ana Anic" when nobody has
	 * renamed anybody.
	 */
	@Test
	void approvingACommentPublishesItUnderTheNameTheMemberCarriesNowNotTheOneHeSentItUnder()
			throws Exception {
		db.sql("update competitor set first_name = 'Ana', last_name = 'Novic'"
						+ " where member_number = ?")
				.param(ANA).update();

		assertThat(answer(COMMENTS_MODERATOR, anasComment, true, null)).isEqualTo(200);

		assertThat(db.sql("select who from event_comment where event_id = ?")
				.param(theWeekendEvent).query(String.class).single())
				.as("the published comment carried the name captured at submission,"
						+ " not the one the member carries now")
				.isEqualTo("Ana Novic");
	}

	/**
	 * A WAITING COMMENT IS SERVED ITS OWN QUEUE BODY, NEVER THE SUBMITTED TEXT (dva izvora,
	 * jedna vrednost, PR 354 review).
	 *
	 * <p>{@link #commentSubmissionWaitingFor} gives {@code verification.body} and
	 * {@code comment_submission.body} different text on purpose - see its own comment - so
	 * a read that joined to the submission's text instead of the queue row's own column is
	 * caught here and not only by the two happening to agree.
	 */
	@Test
	void aWaitingCommentIsServedItsOwnQueueBodyNeverTheSubmittedText() throws Exception {
		String served = http.perform(asking(COMMENTS_MODERATOR, get("/api/verification")))
				.andReturn().getResponse().getContentAsString();

		assertThat(served)
				.as("the queue did not serve its own body column at all")
				.contains(QUEUE_BODY_MARKER);
		assertThat(served)
				.as("the queue served the submitted text instead of its own body column")
				.doesNotContain("Odlicna staza");
	}

	/**
	 * A COMMENT IS NEVER REFUSED FOR WANT OF A REASON (ADL A64 A4).
	 *
	 * <p>PDL P22, „ne odbija nego brise, a napomena je
	 * neobavezna", the same sentence stated twice in the diary. So the empty box that turns {@link #aRefusalWithNothingInTheBoxIsNotADecision}
	 * into a 400 on the profiles tab must turn into a plain 200 here, and nothing is
	 * published: {@code publishTheComment} is never called on a refusal, which this proves
	 * by there being no row in {@code event_comment} afterwards.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "   "})
	void refusingACommentNeedsNoReasonAndNeverTellsTheMemberWhy(String nothing) throws Exception {
		assertThat(answer(COMMENTS_MODERATOR, anasComment, false, nothing)).isEqualTo(200);

		assertThat(stateOf(anasComment)).isEqualTo("rejected");
		assertThat(db.sql("select count(*) from event_comment").query(Integer.class).single())
				.as("a refused comment was published anyway")
				.isZero();

		/* AND NOBODY IS TOLD, which is the other half of PDL P22, „Jedini red bez njega je red
		   komentara, gde se ne odbija nego brise, a napomena je neobavezna i namenjena
		   moderatorima": the note beside a deleted comment is never a reason handed to the member the way
		   PDL P22 hands one to every other queue's refusal. */
		assertThat(db.sql("select count(*) from message").query(Integer.class).single())
				.as("a comment's refusal reached somebody's inbox")
				.isZero();
	}

	/**
	 * AND WHEN A MODERATOR DOES TYPE A NOTE, IT IS STILL KEPT - on the row, for whichever
	 * moderator reads it next - AND STILL NEVER SENT.
	 *
	 * <p>Read beside the case above on purpose: the exception is about the ABSENCE of a
	 * reason, not about refusing to record one that was given. A change that widened the
	 * exception into „comments never keeps a reason at all" would pass the case above and
	 * fail only this one.
	 */
	@Test
	void refusingACommentWithARealReasonStoresItButStillTellsNobody() throws Exception {
		assertThat(answer(COMMENTS_MODERATOR, verasComment, false, THE_REASON)).isEqualTo(200);

		assertThat(db.sql("select reason from verification where id = ?")
				.param(verasComment).query(String.class).single())
				.isEqualTo(THE_REASON);
		assertThat(db.sql("select count(*) from message").query(Integer.class).single()).isZero();
	}

	// ----- the results tab -------------------------------------------------------------

	/**
	 * AN APPROVED RUN BECOMES A RESULT, AND THE EXACT LENGTH SURVIVES THE JOURNEY.
	 *
	 * <p>PDL P9: „Rezultat ulazi u rang liste tek posle odobrenja." Nothing counts a
	 * submission, so the row this writes is the whole of that sentence.
	 *
	 * <p><b>THE TWO ROWS ABOUT ONE RUN ARE ASSERTED TO AGREE, and that is the spoj this case
	 * exists for rather than a flourish.</b> The length is asserted on the RESULT and the
	 * category is asserted to equal the RACE's, which are two different tables reached by two
	 * different statements. Without V47 the result's {@code numeric(6,2)} column rounds
	 * 42,1950 to 42,20, its own generated column then says {@code marathon} while the race it
	 * was run at says {@code long}, and nothing anywhere is violated - which is exactly what
	 * V25 wrote down as the cost of leaving the column narrow. Reverting V47 alone fails both
	 * halves of this case.
	 *
	 * <p>The points are asserted against {@link BtlScoreCalculator} rather than against a
	 * number typed here, because the formula and its golden set are the one home for that
	 * question and a second copy of the answer would be a second home.
	 */
	@Test
	void anApprovedRunBecomesAResultAndTheExactLengthSurvives() throws Exception {
		assertThat(answer(THE_SUPERADMIN, anasMarathon, true, null)).isEqualTo(200);

		Counted counted = counted(onlyResultOf(ANA)).orElseThrow();

		assertThat(counted.distanceKm())
				.as("the length the member ran is not the length the portal counted")
				.isEqualByComparingTo("42.1950");
		assertThat(counted.seconds()).isEqualTo(FOUR_HOURS);
		assertThat(counted.points()).isEqualByComparingTo(
				BtlScoreCalculator.calculate(new BigDecimal("42.1950").doubleValue(), 300, 300,
						FOUR_HOURS));

		assertThat(counted.category())
				.as("the result and the race it was run at disagree about what sort of race it was")
				.isEqualTo(db.sql("select category from race where id = ?").param(theMarathon)
						.query(String.class).single());
	}

	/**
	 * A RUN THAT CLIMBS FURTHER THAN IT FALLS IS COUNTED WITH EACH FIGURE WHERE HE SENT IT
	 * (PR 443 review).
	 *
	 * <p>The route hands the pair {@code (climb, drop)} side by side to a call that works out
	 * the points and to two statements, one for a first report and one for a correction, so a
	 * pair the wrong way round is one transposition from the right one, and it is invisible
	 * on any run whose two figures are the same number, which was every run this file made
	 * before this one. It is not a small fault: the formula weighs a metre climbed by 1.25 and
	 * a metre fallen by 0.75, so on this run the points differ between the two orders. This
	 * case is the first report; {@link #anApprovedCorrectionOverwritesTheRunItAmendsAndDoesNotAddASecond}
	 * is the correction.
	 *
	 * <p><b>Every place the figures could come from is a different number here</b>, so
	 * passing cannot have been done by any of the others: the climb he sent, the drop he
	 * sent, and the race's own figures, which are nought because the race is free.
	 *
	 * <p>The points are asked of {@link BtlScoreCalculator} rather than typed, for the reason
	 * {@link #anApprovedRunBecomesAResultAndTheExactLengthSurvives} gives, and the first
	 * assertion is the floor under that: it fails if the figures are ever moved to two the
	 * formula cannot tell apart.
	 */
	@Test
	void aRunWhoseClimbIsNotItsDropIsCountedWithEachFigureWhereHeSentIt() throws Exception {
		theFormulaTellsTheTwoOrdersApart(TRAIL_KM, TRAIL_CLIMB, TRAIL_DROP, TWO_HOURS);

		assertThat(answer(THE_SUPERADMIN, anasTrailRun, true, null)).isEqualTo(200);

		Counted counted = counted(onlyResultOf(ANA)).orElseThrow();

		assertThat(counted.ascentM())
				.as("the climb that was counted is not the one he sent")
				.isEqualTo(TRAIL_CLIMB);
		assertThat(counted.descentM())
				.as("the drop that was counted is not the one he sent")
				.isEqualTo(TRAIL_DROP);
		assertThat(counted.points())
				.as("the points were worked out from something other than what he sent")
				.isEqualByComparingTo(BtlScoreCalculator.calculate(
						new BigDecimal(TRAIL_KM).doubleValue(), TRAIL_CLIMB, TRAIL_DROP,
						TWO_HOURS));
	}

	/**
	 * AND NOBODY ELSE IS TOUCHED BY IT.
	 *
	 * <p>Three members and three different states: Ana gains a result, Bojan's own waiting run
	 * is still waiting, and Vera's counted run is untouched. A statement that wrote the result
	 * against {@code min(competitor.id)} or against the moderator instead of the member passes
	 * every case above and fails this one.
	 */
	@Test
	void onlyHisOwnRunIsCountedAndTheOtherTwoMembersAreLeftAsTheyWere() throws Exception {
		assertThat(answer(THE_SUPERADMIN, anasMarathon, true, null)).isEqualTo(200);

		assertThat(howManyResults(ANA)).as("his own").isEqualTo(1);
		assertThat(howManyResults(BOJAN)).as("a member whose run is still waiting").isZero();
		assertThat(howManyResults(VERA)).as("a member who had one before and sent nothing new")
				.isEqualTo(1);
		assertThat(counted(verasCountedRun).orElseThrow().seconds()).isEqualTo(AN_HOUR);
	}

	/**
	 * A CORRECTION OVERWRITES THE RUN IT AMENDS AND DOES NOT ADD A SECOND ONE.
	 *
	 * <p>Owner, 28.08.2026, choosing between four outcomes: „Odobrenje ispravke zamenjuje
	 * rezultat, dakle stari izlazi i novi ulazi u istom trenutku." Asserted as a COUNT and as
	 * the same row id, not only as the new figures: a statement that inserted instead of
	 * updating would leave the new numbers exactly where this case looks for them while
	 * doubling the member's season.
	 *
	 * <p>The race is asserted unchanged because the owner said so the day before: „Menja se
	 * sve osim trke."
	 *
	 * <p><b>The climb and the drop are asserted as well</b> (PR 443 review). The statement that
	 * overwrites names them beside the time, and a correction that changed only the time
	 * would keep the old two while the points, worked out from the new ones, no longer agreed
	 * with them. The correction sends a climb that is not its drop and unlike the two it
	 * replaces, so swapping them, or writing neither, is a different row from the right one.
	 */
	@Test
	void anApprovedCorrectionOverwritesTheRunItAmendsAndDoesNotAddASecond() throws Exception {
		/* THE FIXTURE STARTS WITH FIGURES UNLIKE THE ONES SENT, and each is asked rather than
		   assumed: a correction that wrote nothing of them would otherwise agree with this
		   case exactly as one that wrote them. */
		Counted before = counted(verasCountedRun).orElseThrow();

		assertThat(before.ascentM())
				.as("the counted climb is the correction's, so this measures nothing")
				.isNotEqualTo(CORRECTED_CLIMB);
		assertThat(before.descentM())
				.as("the counted drop is the correction's, so this measures nothing")
				.isNotEqualTo(CORRECTED_DROP);
		theFormulaTellsTheTwoOrdersApart("10.00", CORRECTED_CLIMB, CORRECTED_DROP, CORRECTED_TIME);

		assertThat(answer(THE_SUPERADMIN, verasCorrection, true, null)).isEqualTo(200);

		assertThat(howManyResults(VERA)).as("the correction added a second run").isEqualTo(1);
		assertThat(onlyResultOf(VERA)).as("it is the same row and not a new one")
				.isEqualTo(verasCountedRun);

		Counted counted = counted(verasCountedRun).orElseThrow();

		assertThat(counted.seconds()).isEqualTo(CORRECTED_TIME);
		assertThat(counted.ascentM())
				.as("the correction kept the climb it replaced, or wrote the drop in its place")
				.isEqualTo(CORRECTED_CLIMB);
		assertThat(counted.descentM())
				.as("the correction kept the drop it replaced, or wrote the climb in its place")
				.isEqualTo(CORRECTED_DROP);
		assertThat(counted.points()).isEqualByComparingTo(
				BtlScoreCalculator.calculate(new BigDecimal("10.00").doubleValue(),
						CORRECTED_CLIMB, CORRECTED_DROP, CORRECTED_TIME));
		assertThat(db.sql("select race_id from result where id = ?").param(verasCountedRun)
				.query(Long.class).single()).as("the race moved").isEqualTo(theShortRace);
	}

	/**
	 * A REFUSED CORRECTION LEAVES THE STANDINGS EXACTLY WHERE THEY WERE.
	 *
	 * <p>Owner, 28.08.2026, and it is the half of his decision the portal once got wrong in
	 * the direction that costs the member: „Odbijanje ne menja ništa." The fault that was
	 * measured on the day is written down beside it - the profile fell from 180 runs and
	 * 1.752,86 points to 179 and 1.744,60, with no way back.
	 *
	 * <p>Asserted on the OLD time and the OLD points rather than only on the count, because a
	 * refusal that wrote the new figures anyway would leave the count at one.
	 */
	@Test
	void aRefusedCorrectionLeavesTheStandingsExactlyWhereTheyWere() throws Exception {
		assertThat(answer(THE_SUPERADMIN, verasCorrection, false, THE_REASON)).isEqualTo(200);

		assertThat(howManyResults(VERA)).isEqualTo(1);

		Counted counted = counted(verasCountedRun).orElseThrow();

		assertThat(counted.seconds()).as("a refusal moved the standings").isEqualTo(AN_HOUR);
		assertThat(counted.points()).isEqualByComparingTo("3.73");

		assertThat(bodyOfTheMessageTo(VERA)).contains(THE_REASON);
	}

	/**
	 * APPROVING A RUN OVER THE THRESHOLD CLOSES THE BEGINNERS' CATEGORY FOR THE SEASON AFTER
	 * IT, AND NEVER FOR THE SEASON THE RUN BELONGS TO.
	 *
	 * <p>Owner, 26.09.2026: „ako odobrenje prevede clanov zbir tekuce sezone na 12 ili vise,
	 * pocetnicka mu se za NAREDNU sezonu zatvara istog trenutka." <b>Both halves are asserted
	 * and the second is the one that cost a whole round of review once already</b>: the run is
	 * in 2027 and it closes 2028, while 2027 itself stays open. A season's category was
	 * decided off the seasons BEFORE it, and a season is never before itself - a portal that
	 * let a running season close on itself from the inside would tell a member his category
	 * was shut because he finished a season that is still being run.
	 *
	 * <p>Nothing is stored and nothing is asserted to be stored: the right is DERIVED (owner,
	 * 26.09.2026, „racunaj da clan bira ono sto ZELI"), so what this reads is the same
	 * question the screen asks, through the same two classes that own its halves.
	 */
	@Test
	void anApprovalOverTheThresholdClosesTheNextSeasonAndLeavesTheRunsOwnSeasonOpen()
			throws Exception {
		long ana = memberId(ANA);

		assertThat(beginnersCategoryIsOpenFor(ana, 2028)).as("the fixture starts with it open")
				.isTrue();

		assertThat(answer(THE_SUPERADMIN, anasMarathon, true, null)).isEqualTo(200);

		assertThat(beginnersCategoryIsOpenFor(ana, 2028))
				.as("the season after the run did not close").isFalse();
		assertThat(beginnersCategoryIsOpenFor(ana, 2027))
				.as("the run's own season closed on itself, which no decision asks for").isTrue();
	}

	/**
	 * AND HE IS TOLD, WITH THE REASON IN IT.
	 *
	 * <p>Owner, 27.09.2026, choosing the first of three outcomes: „Poruka nosi razlog: koji
	 * rezultat je odobren, koliko bodova nosi, i da mu je time pocetnicka zatvorena za narednu
	 * sezonu." He refused silence and he refused an explanation on a page the member has no
	 * reason to open.
	 *
	 * <p>The season in the message is asserted to be 2028 and not 2027, which is the same axis
	 * as the case above read from the member's side: a message naming the run's own season
	 * would be telling him something the portal does not do.
	 */
	@Test
	void andHeIsToldWhichSeasonItClosedAndWhatClosedIt() throws Exception {
		assertThat(answer(THE_SUPERADMIN, anasMarathon, true, null)).isEqualTo(200);

		String said = bodyOfTheMessageTo(ANA);

		assertThat(said).contains("2028");
		assertThat(said).as("it names the run's own season instead of the one that closed")
				.doesNotContain("2027");
		assertThat(said).contains(String.valueOf(Category.FIRST_SEASON_POINTS));
	}

	/**
	 * A RUN WELL UNDER THE THRESHOLD CLOSES NOTHING AND SAYS NOTHING.
	 *
	 * <p>The other state of the same axis, and without it the case above is satisfied by a
	 * route that sends that message on every approval. Ten kilometres in an hour is worth
	 * under four points, so the threshold is nowhere near.
	 */
	@Test
	void aRunUnderTheThresholdClosesNothingAndTheMemberHearsNothingAboutCategories()
			throws Exception {
		assertThat(answer(THE_SUPERADMIN, bojansRun, true, null)).isEqualTo(200);

		assertThat(beginnersCategoryIsOpenFor(memberId(BOJAN), 2028)).isTrue();
		assertThat(db.sql("select count(*) from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(BOJAN).query(Integer.class).single())
				.as("he was told about a category nothing moved").isZero();
	}

	/**
	 * AND A MEMBER WHO WAS ALREADY OVER THE THRESHOLD IS NOT TOLD AGAIN.
	 *
	 * <p>The third state of the axis, and the one that turns „he is told when it closes" into
	 * „he is told when it closes, once". A member who crossed twelve points in April and goes
	 * on running would otherwise be told his beginners' category had just been shut on every
	 * result he sent for the rest of the season - each message true about the category and
	 * false about the word „time", which is what the owner's sentence is built on: „ako
	 * odobrenje PREVEDE clanov zbir... na 12 ili vise".
	 *
	 * <p>It is a different member from the two above and he had his points before this fixture
	 * queued anything, so „already over" is a state of the record rather than something an
	 * earlier case in the same run left behind.
	 */
	@Test
	void aMemberWhoWasAlreadyOverTheThresholdIsNotToldAgain() throws Exception {
		assertThat(beginnersCategoryIsOpenFor(memberId(DETE), 2028))
				.as("the fixture did not put him over it, so this measures nothing").isFalse();

		assertThat(answer(THE_SUPERADMIN, detesSecondRun, true, null)).isEqualTo(200);

		assertThat(howManyResults(DETE)).as("the run was counted all the same").isEqualTo(2);
		assertThat(db.sql("select count(*) from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(DETE).query(Integer.class).single())
				.as("he was told again about a category that closed months ago").isZero();
	}

	/**
	 * A RELAY THAT WILL NOT TAKE IT DOES NOT UNDO THE DECISION.
	 *
	 * <p>{@link ResultWriteApi}'s decision, made again for this route and for the same reason:
	 * the moderator's answer was correct and the result belongs in the standings, so failing
	 * his request because the post office is down would undo a decision that was rightly made.
	 * What survives instead is the row, written inside the transaction the letter waits for.
	 *
	 * <p>The relay is stopped rather than imitated, so what is measured is the real failure the
	 * real client throws.
	 */
	@Test
	void aRelayThatIsDownDoesNotUndoTheApprovalOrTheResult() throws Exception {
		SMTP.getSmtp().stopService();

		assertThat(answer(THE_SUPERADMIN, anasMarathon, true, null))
				.as("the moderator was refused because the post office was down").isEqualTo(200);

		assertThat(stateOf(anasMarathon)).isEqualTo("approved");
		assertThat(counted(onlyResultOf(ANA)).orElseThrow().seconds()).isEqualTo(FOUR_HOURS);
	}

	/**
	 * A RUN ON A RACE THE CALENDAR DOES NOT HOLD IS REFUSED, AND STAYS IN THE QUEUE.
	 *
	 * <p>PDL: „Član sme da unese trku koje nema u kalendaru. Tada administrator kreira događaj
	 * i trku uz rezultat, i sve troje nastaje istovremeno." That is three writes into two
	 * tables this route does not touch, so it says so instead of doing half of it.
	 *
	 * <p><b>The item is asserted to be still WAITING, which is the whole point.</b> Recording
	 * the decision and writing nothing would take the row out of every moderator's screen for
	 * ever while the member's run reached nothing - the one outcome a screen cannot undo.
	 */
	@Test
	void aRunOnARaceTheCalendarDoesNotHoldIsRefusedAndStaysInTheQueue() throws Exception {
		MockHttpServletResponse refused = decide(THE_SUPERADMIN, aRunOnARaceNobodyHasEnteredYet,
				true, null);

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(reasonIn(refused)).startsWith("Trka nije u kalendaru");

		assertThat(stateOf(aRunOnARaceNobodyHasEnteredYet)).isEqualTo("waiting");
		assertThat(howManyResults(ANA)).isZero();
	}

	/**
	 * AND SO IS A ROW IN THAT TAB THAT NAMES NO RUN AT ALL.
	 *
	 * <p>V10 permits it in as many words and says the one-directional check is deliberate: „A
	 * results row without a submission is a real thing... so the other direction would be
	 * false." Nothing writes one today, so this case builds one the way the schema allows and
	 * asks what the route does with it. A route that read the pointer without asking answers
	 * a permitted state with a 500, which tells the moderator nothing he can act on.
	 */
	@Test
	void aResultsRowThatNamesNoRunIsRefusedRatherThanFallingOver() throws Exception {
		MockHttpServletResponse refused = decide(THE_SUPERADMIN, aResultsRowNamingNoRun, true, null);

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(reasonIn(refused)).isEqualTo("Stavka ne nosi prijavljen rezultat.");

		assertThat(stateOf(aResultsRowNamingNoRun)).isEqualTo("waiting");
	}

	/**
	 * AN APPROVED RUN IS POSTED TO THE MEMBER, AND A REFUSED ONE IS NOT POSTED AT ALL.
	 *
	 * <p>PDL P22 names both and they are different channels on purpose: „Član dobija mejl kad
	 * mu je rezultat odobren", and for a refusal „razlog stize u sanduce onome ko je stavku
	 * poslao". So the letter goes out on an approval and the inbox carries the refusal, and a
	 * route that sent both on both would pass either case written alone.
	 *
	 * <p>The address is asserted to be the MEMBER's and not the moderator's, which are two
	 * different accounts here - the superadmin decides and Ana owns the run. A route that
	 * posted to {@code asking.account()}, which is what the precedent in
	 * {@code ResultWriteApi} does for its own routes, would send a moderator letters about
	 * other people's running.
	 */
	@Test
	void anApprovedRunIsPostedToTheMemberAndARefusedOneIsNotPostedAtAll() throws Exception {
		assertThat(answer(THE_SUPERADMIN, anasMarathon, true, null)).isEqualTo(200);

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).as("nothing went out about an approved result").isNotEmpty();
		assertThat(arrived[0].getAllRecipients()[0].toString())
				.as("the letter went to whoever decided instead of whoever ran")
				.isEqualTo(A_COMPETITOR);
		assertThat(arrived[0].getSubject()).contains("odobren");

		int afterTheApproval = arrived.length;

		assertThat(answer(THE_SUPERADMIN, bojansRun, false, THE_REASON)).isEqualTo(200);

		assertThat(SMTP.getReceivedMessages())
				.as("a refusal was posted, and no decision asks for that")
				.hasSize(afterTheApproval);
		assertThat(bodyOfTheMessageTo(BOJAN)).contains(THE_REASON);
	}

	/**
	 * AND THE LETTER NAMES THE CLIMB AND THE DROP IN THE ORDER HE SENT THEM (PR 443 review).
	 *
	 * <p>The run the letter tells him about is built at a third place, beside the two
	 * statements and from the same two figures, so it is a third place they can be turned
	 * round. The sister route asserts this of its own letter
	 * ({@code ResultWriteApiTest.aFreshReportCarriesWhatWasSentInAndThePointsTheFormulaGives});
	 * this route's letter was asserted for its recipient and its subject and not for a word
	 * of its body.
	 */
	@Test
	void theLetterAboutSuchARunNamesTheClimbAndTheDropInTheOrderHeSentThem() throws Exception {
		assertThat(answer(THE_SUPERADMIN, anasTrailRun, true, null)).isEqualTo(200);

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).as("nothing went out about an approved result").isNotEmpty();
		assertThat(arrived[0].getContent().toString())
				.as("the letter names the climb and the drop the other way round")
				.contains("uspon " + TRAIL_CLIMB + " m, spust " + TRAIL_DROP + " m");
	}

	/**
	 * AND A MEMBER WITH NO ACCOUNT IS NOT AN ERROR, HE IS SIMPLY NOT POSTED TO.
	 *
	 * <p>Vera races and has no account, which is the ordinary state rather than a curiosity:
	 * the league's imported history is members who never had one („NIKO SE NE DOVODI U PORTAL
	 * DOK SE SAM NE PRIJAVI", owner 27.09.2026), and V23 lets an account go while the member
	 * it belonged to stays. So the result is written and counted exactly as anybody else's,
	 * and nothing goes out, and neither of those is allowed to depend on the other.
	 */
	@Test
	void aMemberWithNoAccountIsCountedJustTheSameAndNothingIsPosted() throws Exception {
		int before = SMTP.getReceivedMessages().length;

		assertThat(answer(THE_SUPERADMIN, verasCorrection, true, null)).isEqualTo(200);

		assertThat(counted(verasCountedRun).orElseThrow().seconds())
				.as("having no address stopped the result being counted").isEqualTo(CORRECTED_TIME);
		assertThat(SMTP.getReceivedMessages()).hasSize(before);
	}

	/**
	 * A MODERATOR OF ANOTHER TAB IS TOLD THE ADDRESS IS NOT THERE, ON THIS TAB TOO.
	 *
	 * <p>The axis the whole file is built around, asked once more about the tab this increment
	 * added: the comments moderator genuinely holds a queue, so a route asking „does he hold
	 * any" rather than „may he moderate THIS one" lets him decide somebody's running. The
	 * numbers are 401 and 404 and never 403 (ADL A8).
	 */
	@Test
	void aModeratorOfAnotherTabIsToldTheResultsAddressIsNotThere() throws Exception {
		assertThat(answer(COMMENTS_MODERATOR, anasMarathon, true, null)).isEqualTo(404);
		assertThat(answer(A_COMPETITOR, anasMarathon, true, null)).isEqualTo(404);
		assertThat(answer(null, anasMarathon, true, null)).isEqualTo(401);

		assertThat(stateOf(anasMarathon)).isEqualTo("waiting");
		assertThat(howManyResults(ANA)).isZero();
	}

	/**
	 * AND A RUN THAT HAS ALREADY BEEN DECIDED IS NOT DECIDED AGAIN.
	 *
	 * <p>Without it an approval repeated - a double click, a retried request - writes the
	 * member's run into the standings twice, and nothing in the schema refuses a second
	 * identical result.
	 */
	@Test
	void aRunAlreadyDecidedIsNotCountedASecondTime() throws Exception {
		assertThat(answer(THE_SUPERADMIN, bojansRun, true, null)).isEqualTo(200);
		assertThat(answer(THE_SUPERADMIN, bojansRun, true, null)).isEqualTo(409);

		assertThat(howManyResults(BOJAN)).as("it was counted twice").isEqualTo(1);
	}

	/*
	 * SIX CASES STOOD HERE, FROM V30 UNTIL PDL P10a, 22.09.2026 (ADL A64 A2, A3): approving
	 * moved an event and its races together, by the same number of days and reading the
	 * event's day fresh rather than off the stale report; the calendar could move backwards;
	 * a refusal told the member why, like every queue but comments; and an approval that
	 * would carry a written result across 1 January was refused, by the identical question
	 * {@code EventWriteApiTest} and {@code RaceWriteApiTest} ask (PDL P10b) and not by a
	 * copy of it. The owner's decision the same day, in as many words: „Redova je pet, ne
	 * šest." What P10b guards is unmoved - „Ovo nikad nije bilo o prijavi termina... bilo bi
	 * dostizno i da prijave nikad nije bilo" - and stays covered from the administrator's
	 * own screen, where it was reachable all along.
	 */

	/**
	 * THE FLOOR UNDER THE LIST OF TABS THIS ROUTE CARRIES OUT.
	 *
	 * <p>It asks the DATABASE for every queue there is rather than repeating a list, so a
	 * sixth tab - or a fifth that grows a consequence - fails here until somebody decides
	 * what answering it means. ONE of the five is refused today, {@code payments}, and it is
	 * refused because nothing lets a member reach that tab at all. {@code results} was the
	 * second until ADL A36's boundary was settled („Rezultat i rang liste su UNUTAR
	 * transakcije; dukati i posta idu POSLE nje", owner 21.09.2026) and V47 closed V25's debt
	 * on the column an approval copies. A sixth was refused nowhere - {@code schedule}
	 * carried out its own approval, from V30 until PDL P10a, 22.09.2026 took the tab away
	 * the same day: „Redova je pet, ne šest."
	 */
	@Test
	void everyTabIsEitherCarriedOutOrRefusedAndNoneIsQuietlyRecorded() throws Exception {
		List<String> tabs = db.sql("select target from admin_right where scope = 'queue'"
				+ " order by target").query(String.class).list();

		assertThat(tabs).hasSize(5);

		for (String tab : tabs) {
			Long item = db.sql("select id from verification where queue = ? and state = 'waiting'"
					+ " order by id limit 1").param(tab).query(Long.class).optional().orElse(null);

			assertThat(item).as("the fixture holds nothing waiting in " + tab).isNotNull();

			int status = answer(THE_SUPERADMIN, item, true, null);

			if (List.of("profiles", "teams", "comments", "results").contains(tab)) {
				assertThat(status).as(tab + " is carried out").isEqualTo(200);
				assertThat(stateOf(item)).isEqualTo("approved");
			} else {
				assertThat(status).as(tab + " has no consequence written for it yet")
						.isEqualTo(409);
				assertThat(stateOf(item)).as(tab + " must not be quietly recorded")
						.isEqualTo("waiting");
			}
		}
	}

	// ----- the fixture -----------------------------------------------------------------

	private String hold(long id) {
		return "/api/verification/" + id + "/hold";
	}

	private String decision(long id) {
		return "/api/verification/" + id + "/decision";
	}

	/**
	 * <b>Every request here carries a CSRF token, including the ones made with no session at
	 * all.</b> Without it the chain answers 403 before authentication is ever reached, and a
	 * case asserting „somebody not signed in is refused" would be green while measuring the
	 * wrong refusal entirely - the same shape of false pass this project has written down
	 * elsewhere.
	 */
	private MockHttpServletRequestBuilder asking(String email, MockHttpServletRequestBuilder what) {
		what.with(csrf());

		return email == null ? what
				: what.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private int take(String email, long id) throws Exception {
		return http.perform(asking(email, post(hold(id)))).andReturn().getResponse().getStatus();
	}

	private int letGo(String email, long id) throws Exception {
		return http.perform(asking(email, delete(hold(id)))).andReturn().getResponse().getStatus();
	}

	private int answer(String email, long id, boolean approved, String reason) throws Exception {
		return decide(email, id, approved, reason).getStatus();
	}

	/** The same call {@link #answer} makes, with the body kept rather than thrown away -
	 *  what a PDL P10b refusal needs, since the status alone does not say which of this
	 *  route's several 409s answered. */
	private MockHttpServletResponse decide(String email, long id, boolean approved, String reason)
			throws Exception {
		String body = reason == null
				? "{\"approved\":" + approved + "}"
				: "{\"approved\":" + approved + ",\"reason\":\"" + reason + "\"}";

		return http.perform(asking(email, post(decision(id)))
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andReturn().getResponse();
	}

	private String reasonIn(MockHttpServletResponse response) throws Exception {
		return new ObjectMapper().readTree(response.getContentAsString()).path("reason").asString();
	}

	private String stateOf(long id) {
		return db.sql("select state from verification where id = ?")
				.param(id).query(String.class).single();
	}

	private long heldBy(long id) {
		return db.sql("select held_by from verification_lock where verification_id = ?")
				.param(id).query(Long.class).single();
	}

	private int holdsOn(long id) {
		return db.sql("select count(*) from verification_lock where verification_id = ?")
				.param(id).query(Integer.class).single();
	}

	private long accountOf(String email) {
		return db.sql("select id from account where email = ?")
				.param(email).query(Long.class).single();
	}

	private long memberId(String number) {
		return db.sql("select id from competitor where member_number = ?")
				.param(number).query(Long.class).single();
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

	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}
	}

	private void member(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, String.format("%016x", ++issued))
				.update();
	}

	private long photograph() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(String.format("%064x", ++issued))
				.query(Long.class).single();
	}

	private long waiting(String queue, String memberNumber, String subject, String body,
			Long photograph) {
		return db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values (?, (select id from competitor where member_number = ?), ?, ?, ?)"
						+ " returning id")
				.params(queue, memberNumber, subject, body, photograph)
				.query(Long.class).single();
	}

	private long waitingAboutNobody(String queue, String subject) {
		return db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values (?, null, ?, '') returning id")
				.params(queue, subject)
				.query(Long.class).single();
	}

	private long decided(String queue, String memberNumber, String subject, String state,
			String reason) {
		return db.sql("insert into verification (queue, competitor_id, subject, body, state,"
						+ " decided_at, decided_by_name, reason)"
						+ " values (?, (select id from competitor where member_number = ?), ?, '', ?,"
						+ " now(), 'Neko Drugi', ?) returning id")
				.params(queue, memberNumber, subject, state, reason)
				.query(Long.class).single();
	}

	private long teamProposalWaitingFor(String memberNumber, String name) {
		long proposal = db.sql("insert into team_proposal (competitor_id, name, bio, link, place_id)"
						+ " values ((select id from competitor where member_number = ?), ?,"
						+ " 'Devet ljudi iz Zajecara', '', (select id from place where rank = 1))"
						+ " returning id")
				.params(memberNumber, name)
				.query(Long.class).single();

		return db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " team_proposal_id) values ('teams',"
						+ " (select id from competitor where member_number = ?), ?, '', ?)"
						+ " returning id")
				.params(memberNumber, name, proposal)
				.query(Long.class).single();
	}

	/** A minimal event, no town chosen by anybody in particular and no races of its own -
	 *  nothing here writes a race any more, since {@code moveTheEvent} left with the
	 *  schedule queue it moved races for (PDL P10a, 22.09.2026). */
	private long event(String slug, String name, LocalDate date) {
		return db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
						+ " description, link) values (?, ?, ?,"
						+ " (select id from place where rank = 1), 'race', false, '', '')"
						+ " returning id")
				.params(slug, name, date)
				.query(Long.class).single();
	}

	/**
	 * A RACE IN THE CALENDAR, of the only kind a result can be reported for here.
	 *
	 * <p>The distance is handed over as TEXT and cast in SQL rather than as a {@code double},
	 * so 42,195 arrives as the four decimals {@code race.distance_km} has held since V25 and
	 * not as whatever a binary floating point number happens to be nearest to. That is the
	 * same rule ADL A12 states for the column itself.
	 */
	private long race(long event, String name, LocalDate day, String distance, int ascent,
			int descent) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, ?, 'length', 0, cast(? as numeric), ?, ?)"
						+ " returning id")
				.params(event, name, day, distance, ascent, descent)
				.query(Long.class).single();
	}

	/**
	 * A RACE THAT FIXES NOTHING: no length, no time limit, no climb and no drop.
	 *
	 * <p>On a free race the four figures of a run are what THAT runner covered (V7), so the
	 * race's own two, which {@link RaceWriteApi} writes as nought when they are left out, are
	 * not the runner's and nothing read off it can be mistaken for them. {@link #race} cannot
	 * make this one, because it writes a race of a length.
	 */
	private long freeRace(long event, String name, LocalDate day) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, ?, 'free', 0, 0, 0, 0) returning id")
				.params(event, name, day)
				.query(Long.class).single();
	}

	/** A result that is already counted, written straight in: it is what the portal looked
	 *  like before this fixture's queue rows were sent, not something a route here made. */
	private long resultAlreadyCounted(String memberNumber, long raceId, LocalDate day,
			String distance, int ascent, int descent, int seconds, String points) {
		return db.sql("insert into result (competitor_id, race_id, race_date, distance_km,"
						+ " ascent_m, descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?), ?, ?,"
						+ " cast(? as numeric), ?, ?, ?, cast(? as numeric)) returning id")
				.params(memberNumber, raceId, day, distance, ascent, descent, seconds, points)
				.query(Long.class).single();
	}

	/**
	 * A RUN WAITING TO BE JUDGED, on a race the calendar holds.
	 *
	 * <p>No points column is written and there is none to write: V10 gave
	 * {@code result_submission} the four figures the formula is fed and nothing else, which is
	 * the schema saying what ADL A12a says in words - the server computes them.
	 *
	 * @param amends the result this corrects, or {@code null} for a first report
	 */
	private long runWaitingFor(String memberNumber, long raceId, LocalDate day, String distance,
			int ascent, int descent, int seconds, Long amends) {
		long submission = db.sql("insert into result_submission (competitor_id, race_id,"
						+ " race_date, distance_km, ascent_m, descent_m, seconds, link, comment,"
						+ " amends_result_id)"
						+ " values ((select id from competitor where member_number = ?), ?, ?,"
						+ " cast(? as numeric), ?, ?, ?, 'https://primer.rs/rezultati', '', ?)"
						+ " returning id")
				.params(memberNumber, raceId, day, distance, ascent, descent, seconds, amends)
				.query(Long.class).single();

		return queued(memberNumber, submission);
	}

	/**
	 * AND ONE ON A RACE NOBODY HAS ENTERED IN THE CALENDAR, which V10 takes on purpose - „One
	 * way or the other, never both and never neither" - and which this route refuses to
	 * approve, because making the event and the race with it is a road of its own (PDL, „Član
	 * sme da unese trku koje nema u kalendaru").
	 */
	private long describedRunWaitingFor(String memberNumber, LocalDate day) {
		long submission = db.sql("insert into result_submission (competitor_id, race_id,"
						+ " race_date, race_name, race_kind, place_id, distance_km, ascent_m,"
						+ " descent_m, seconds, link, comment)"
						+ " values ((select id from competitor where member_number = ?), null, ?,"
						+ " 'Trka koje nema u kalendaru', 'length',"
						+ " (select id from place where rank = 1), 12.00, 10, 10, 3000,"
						+ " 'https://primer.rs/rezultati', '') returning id")
				.params(memberNumber, day)
				.query(Long.class).single();

		return queued(memberNumber, submission);
	}

	private long queued(String memberNumber, long submission) {
		return db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " result_submission_id) values ('results',"
						+ " (select id from competitor where member_number = ?), 'Rezultat', '', ?)"
						+ " returning id")
				.params(memberNumber, submission)
				.query(Long.class).single();
	}

	/**
	 * THE ONE RESULT HE HAS, and it throws where he has none or more than one.
	 *
	 * <p>{@code single()} rather than a first row, on purpose: „he has exactly one" is half of
	 * what most of these cases are asserting, and a helper that quietly took the first would
	 * let a route that inserted a second pass every case that then read its figures.
	 */
	private long onlyResultOf(String memberNumber) {
		return db.sql("select id from result where competitor_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(memberNumber)
				.query(Long.class).single();
	}

	/**
	 * THE SAME QUESTION THE SCREEN ASKS, through the two classes that own its halves.
	 *
	 * <p>Twelve is not written here and must not be: {@link Category#FIRST_SEASON_POINTS} is
	 * one number in one place, and a case carrying its own copy would go on passing after
	 * somebody moved it.
	 */
	private boolean beginnersCategoryIsOpenFor(long member, int season) {
		return Category.firstSeasonAllowed(bestOfficialSeason.pointsFor(member, season));
	}

	/**
	 * THE FLOOR UNDER A CASE THAT READS POINTS OFF A RUN WHOSE CLIMB IS NOT ITS DROP.
	 *
	 * <p>The formula weighs the two differently, but at two decimals two figures close enough
	 * give the same points either way round, and then a swap the case exists to see would go
	 * on passing. Asked inside the case itself, so the figures cannot be moved to something
	 * that measures nothing without this failing first.
	 */
	private static void theFormulaTellsTheTwoOrdersApart(String km, int climb, int drop,
			int seconds) {
		double distance = new BigDecimal(km).doubleValue();

		assertThat(BtlScoreCalculator.calculate(distance, climb, drop, seconds))
				.as("the formula gives the run the same points either way round, so this"
						+ " measures nothing")
				.isNotEqualByComparingTo(BtlScoreCalculator.calculate(distance, drop, climb,
						seconds));
	}

	/** What the portal put in his inbox, and it throws where there is nothing or more than
	 *  one - so a case about the message a member got cannot pass on somebody else's. */
	private String bodyOfTheMessageTo(String memberNumber) {
		return db.sql("select body from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(memberNumber)
				.query(String.class).single();
	}

	/** What is counted for one member, or nothing where he has no result at all. */
	private Optional<Counted> counted(long resultId) {
		return db.sql("select distance_km, ascent_m, descent_m, seconds, points, category"
						+ " from result where id = ?")
				.param(resultId)
				.query((row, one) -> new Counted(row.getBigDecimal(1), row.getInt(2), row.getInt(3),
						row.getInt(4), row.getBigDecimal(5), row.getString(6)))
				.optional();
	}

	private int howManyResults(String memberNumber) {
		return db.sql("select count(*) from result where competitor_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(memberNumber)
				.query(Integer.class).single();
	}

	/** One counted run, in the six values every case below reads it by. The climb and the drop
	 *  are here from PR 443's review on: until then no assertion in this file read either off
	 *  a counted row, and every run it wrote had the two equal. */
	private record Counted(BigDecimal distanceKm, int ascentM, int descentM, int seconds,
			BigDecimal points, String category) {
	}

	/**
	 * A COMMENT WAITING TO BE PUBLISHED, with the event already on it, the shape
	 * {@code comment_submission} carries under ADL A64 A1. It carries no name of its own
	 * (ADL A64 A5, 22.09.2026): {@code publishTheComment} reads that fresh off
	 * {@code competitor} through {@code competitor_id} instead, so this fixture does not
	 * hand it one either.
	 *
	 * <p><b>{@code verification.body} is deliberately NOT {@code body} (PR 354 review, dva
	 * izvora jedna vrednost).</b> The two used to carry the same text, so a write that
	 * published the queue's own column instead of the submission's, or a read that served
	 * the submission's instead of the queue's own, each agreed with the assertions by
	 * accident. {@link #QUEUE_BODY_MARKER} never appears in {@code comment_submission.body}
	 * and {@code body} itself never appears in {@code verification.body}, so either swap is
	 * now somewhere to be caught.
	 */
	private long commentSubmissionWaitingFor(String memberNumber, long eventId, String subject,
			int organisation, int value, int ambience, String body) {
		long submission = db
				.sql("insert into comment_submission (event_id, competitor_id,"
						+ " rating_organisation, rating_value, rating_ambience, body) values (?,"
						+ " (select id from competitor where member_number = ?), ?, ?, ?, ?)"
						+ " returning id")
				.params(eventId, memberNumber, organisation, value, ambience, body)
				.query(Long.class).single();

		return db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " comment_submission_id) values ('comments',"
						+ " (select id from competitor where member_number = ?), ?, ?, ?)"
						+ " returning id")
				.params(memberNumber, subject, QUEUE_BODY_MARKER, submission)
				.query(Long.class).single();
	}
}

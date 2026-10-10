package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.TheEndOfTheTransaction;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.verification.HoldingAnItem;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.user.GreenMailUser;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

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
 * <li><b>Four members plus the moderator's own child</b>, so „that member" is never „the
 * only member".
 * <li><b>The member whose run is approved and the member behind the deciding account are two
 * different members</b> ({@link #RESULTS_MODERATOR} races), so „whose result is this" has a
 * wrong answer that is a real row rather than a null.
 * <li><b>All three kinds of race</b>: a length, which fixes the distance, the climb and the
 * drop; a limit, which fixes the time; and a free race, which fixes nothing. Which figures an
 * approval reads off the race and which off the run is a different answer on each.
 * <li><b>RUNS THAT CLIMB FURTHER THAN THEY FALL</b> (PR 443 review), where every run on a race
 * of a length climbs exactly as far as it falls and sits on a race carrying the same two
 * numbers. On those the formula gives the same points either way round, so an approval that
 * wrote the drop where the climb belongs, or worked the points out from the two swapped, agreed
 * with every assertion made about it. The two that review asked for are a first report and a
 * correction, because different statements write them, and both are run at the free race; the
 * run at the race to a limit is a third.
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

	/**
	 * Holds {@code queue:results} and nothing else, AND RACES: the account names {@link #MIRA}.
	 *
	 * <p>Every other case of this tab is decided by the superadmin, who has no member row, so a
	 * route that wrote the result to whoever DECIDED rather than to whoever RAN would fall over a
	 * null there instead of being caught writing the wrong member's result. With a moderator who
	 * runs, the two are two different members and the mistake is a row in the wrong place.
	 */
	private static final String RESULTS_MODERATOR = "rezultati@primer.rs";

	private static final String ANA = "000010";

	private static final String BOJAN = "000020";

	private static final String VERA = "000030";

	/** The moderator's child, whose profile his ACCOUNT is not named after. */
	private static final String DETE = "000040";

	/** The member behind {@link #RESULTS_MODERATOR}'s account, who runs a race to a limit. */
	private static final String MIRA = "000050";

	/** What the race to a limit runs to, and so the only time a run at it is counted at. */
	private static final int SIX_HOURS = 21600;

	/** What Mira covered in those six hours, and how far she climbed and fell: three numbers
	 *  the race says nothing about, and the climb is not the drop. */
	private static final String MIRAS_KM = "52.4000";

	private static final int MIRAS_CLIMB = 640;

	private static final int MIRAS_DROP = 610;

	/** The time the moderator sets on Ana's marathon in place of hers: 3:55:00, which is not
	 *  {@link #FOUR_HOURS}, so an approval that counted what she sent is a different row. */
	private static final int THE_TIME_HE_SETS = 14100;

	/** The name on the deciding moderator's ACCOUNT, which is the parent's. */
	private static final String THE_PARENTS_NAME = "Roditelj Roditeljic";

	/** And the name on the member row behind that same account, which is the child's. */
	private static final String THE_CHILDS_FIRST_NAME = "Dete";

	private static final String THE_REASON = "Slika je mutna, posalji ostriju";

	/** The owner's sentence for a decision about a picture that is not the one he looked at, said
	 *  whole and with its full stop (PDL, 10.10.2026), and the same for the approval and the
	 *  refusal. Written out here and not read off the route's constant, so a route that reworded
	 *  it fails the case instead of agreeing with itself. */
	private static final String THE_PICTURE_WAS_CHANGED = "Slika je promenjena, pogledaj je ponovo.";

	private static final String THE_FORM_IS_NOT_COMPLETE = "Forma nije popunjena.";

	private static final String A_SEEN_PICTURE_GOES_WITH_A_PICTURE =
			"Viđena slika se zadaje samo uz odluku o slici.";

	private static final String SOMEBODY_ANSWERED_IT_ALREADY = "O stavci je već odlučeno.";

	/** What Bojan and Vera ran their ten kilometres in. */
	private static final int AN_HOUR = 3600;

	/** What Ana ran the marathon in, and it is worth well over the twelve point threshold. */
	private static final int FOUR_HOURS = 14400;

	/** What Vera says her ten kilometres really took, and it is NOT {@link #AN_HOUR}: a
	 *  correction whose figures equal the counted ones would let a case about „the standings
	 *  changed" pass over a route that wrote nothing at all. */
	private static final int CORRECTED_TIME = 3300;

	/** What Vera's correction says her ten kilometres climbed and fell. The climb is not the
	 *  drop, and neither is the {@code 50} the result she is correcting carries or the nought of
	 *  the free race it was run at: a correction that wrote nothing of them, the wrong one of
	 *  them, or the race's, would otherwise leave a row that is right by accident. */
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

	/** Read off the configuration rather than written here, so „where the blind copy goes" is
	 *  one fact and not two that can drift - the arrangement {@code ResultWriteApiTest} made
	 *  first, for the letters that copied the league until 09.10.2026. */
	@Value("${btl.mail.league}")
	private String theLeague;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/** The text item about Ana, which most cases below answer. */
	private long anasText;

	/** The item carrying a picture, which is the only one that ever clears a photo. */
	private long verasPicture;

	/** The key of the picture {@link #verasPicture} holds: what a moderator who looked at it
	 *  names when he answers (PDL, 10.10.2026, „odluka nosi otisak"). */
	private long verasPhoto;

	/** The circle Vera's picture was made with, written the way a screen sends the numbers back:
	 *  the ones it read off the answer, {@code 0.11} for the column's {@code 0.11000000}. Taken
	 *  from the fixture when it is made and never read off the row at the press. */
	private String verasCircle;

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

	/** A run on a race the calendar does not hold, which a plain approval does not count: the
	 *  answer has to name the race. */
	private long aRunOnARaceNobodyHasEnteredYet;

	/** A results row naming no submission, which V10 permits and this route refuses. */
	private long aResultsRowNamingNoRun;

	/** A second run for a member who was over the threshold before this branch existed. */
	private long detesSecondRun;

	/** A race that fixes nothing, so what a run at it says is all the runner's own. */
	private long theTrail;

	/** A first report whose climb is not its drop, at {@link #theTrail}. */
	private long anasTrailRun;

	/** A race to a limit: it fixes the time and nothing else. */
	private long theTimedRace;

	/** Mira's run at {@link #theTimedRace}, sent at the race's own limit as the member's
	 *  route writes it. */
	private long mirasRun;

	/** A second, unrelated event: what proves a comment is filed under the one it was
	 *  actually about rather than under any other row that happens to exist. */
	private long anotherEvent;

	/**
	 * THE TWO RACE DAYS OF THIS FIXTURE, AND BOTH ARE BEFORE THE CLOCK ({@link #IN_MARCH}).
	 *
	 * <p>They stood on 10 April and 1 May, after the clock, from the day this file was written
	 * until the approval learnt to refuse a run on a race that has not been run yet (PDL P9,
	 * owner, 11.08.2026: „Ne sme, ne može biti rezultata u budućnosti"). Measured then: fifteen
	 * cases fell, every one of them on a run a member could never have sent, because
	 * {@code ResultWriteApi} refuses a run on a race still to come. So the days moved to two
	 * Saturdays before the clock rather than the clock moving after them - the clock stands
	 * where it does for the two season functions, and that reason is untouched. A run on a race
	 * still to come is now a state one case makes on purpose
	 * ({@link #aRunOnARaceMovedIntoTheFutureIsNotCountedAndWaits}).
	 */
	private static final LocalDate SATURDAY = LocalDate.of(2027, 3, 6);

	private static final LocalDate THE_OTHER_EVENTS_DAY = LocalDate.of(2027, 3, 13);

	/**
	 * THE DAY A MEMBER SAYS HE RAN A RACE THE CALENDAR DOES NOT HOLD, and it is none of the
	 * other days a case could read in its place: not a race day of the fixture, not the day the
	 * clock stands on ({@link #IN_MARCH}), and not the day his run was sent, which is the
	 * database's own moment ({@code verification.raised_at}) and lies months earlier.
	 */
	private static final LocalDate THE_DAY_HE_RAN = LocalDate.of(2027, 3, 7);

	/** The town of the codebook a member names for a race he describes, by its rank: not the
	 *  town of rank 1, where every member and every event of the fixture stands. */
	private static final int THE_TOWN_HE_NAMED = 2;

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
	void sevenAccountsFiveMembersAndFiveTabs() {
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
		verasPhoto = photograph();
		verasCircle = circleOf(verasPhoto);
		verasPicture = waiting("profiles", VERA, "Slika Vere", "vera.jpg", verasPhoto);
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
		theTrail = freeRace(theWeekendEvent, "Brdska trka", SATURDAY);

		/* A RESULT VERA ALREADY HAS, so a correction is a correction OF something and the
		   standings have an old value to keep while it waits.

		   AT THE FREE RACE, because her correction climbs further than it falls (PR 443 review)
		   and only a race that fixes nothing leaves those two to the runner. An approval reads
		   the climb and the drop off a race of a length (`WhatARaceCarries.figuresOf`), whose two
		   are equal here, so at the ten kilometres the case about the statement that overwrites
		   would measure nothing - and the member's own correction could never have carried two
		   figures of its own there in the first place. */
		verasCountedRun = resultAlreadyCounted(VERA, theTrail, SATURDAY, "10.00", 50, 50,
				AN_HOUR, "3.73");

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
		verasCorrection = runWaitingFor(VERA, theTrail, SATURDAY, "10.00", CORRECTED_CLIMB,
				CORRECTED_DROP, CORRECTED_TIME, verasCountedRun);
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
		   Every other run on a race of a length climbs exactly as far as it falls and sits on a
		   race carrying the same two numbers, so an approval that swapped them agreed with every
		   assertion made about it. This is the first-report half of the answer, and
		   `verasCorrection` above is the other half, for the statement that overwrites.

		   It is Ana's because she has an account, so the letter about it has somewhere to go,
		   and no counted result, so `onlyResultOf` still names the one row it writes. The race
		   is FREE, which is what makes the figures hers: on a free race the four figures are
		   what THIS runner covered (V7), so nothing on the race can be mistaken for what she
		   sent. */
		anasTrailRun = runWaitingFor(ANA, theTrail, SATURDAY, TRAIL_KM, TRAIL_CLIMB, TRAIL_DROP,
				TWO_HOURS, null);

		/* A MODERATOR WHO RACES, AND A RACE TO A LIMIT SHE HAS RUN. The third kind of race, so
		   all three of „which figures does the race fix" are in this fixture, and a member
		   whose account decides results, so „whose result is this" has two candidates on one
		   request. The run is sent at the limit itself, which is what `ResultWriteApi` writes
		   for a race to a limit. */
		member(MIRA, "Mira", "Miric");
		account(RESULTS_MODERATOR, "moderator", "Rezultat", "Rezultatic", MIRA);
		ticked(RESULTS_MODERATOR, "queue:results");
		theTimedRace = timedRace(theWeekendEvent, "Sestocasovna", SATURDAY, SIX_HOURS);
		mirasRun = runWaitingFor(MIRA, theTimedRace, SATURDAY, MIRAS_KM, MIRAS_CLIMB, MIRAS_DROP,
				SIX_HOURS, null);

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
	 * <p>The owner chose on 18.09.2026, among the outcomes offered with their costs, that a
	 * hold EXPIRES after a time of rest and that anybody may then take the item (the journal's
	 * wording of the choice, not a sentence of his), against the cost he was shown: a browser
	 * that crashed or a laptop that was closed would hold the item for ever.
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
	 * THE SUPERADMIN MAY TAKE ANOTHER'S HOLD AWAY, AND THE ONE IT IS TAKEN FROM IS TOLD: the
	 * owner's choice of 18.09.2026 among the outcomes offered (the journal's wording, not a
	 * sentence of his), with the cost he accepted written beside it: one route more and one
	 * message in the inbox, so that a moderator does not find out only when his decision is
	 * refused.
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
		assertThat(answerSeeing(PROFILES_MODERATOR, verasPicture, false, THE_REASON, verasPhoto))
				.isEqualTo(200);

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
	 * lives there, which ADL A8 forbids: the owner's own words in that section, of
	 * 30.07.2026, are „Ne treba ni da budu svesni moderatori da postoje akcije koje im nisu
	 * dodeljene." The bytes of that difference are measured over a socket in
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
		assertThat(answerSeeing(PROFILES_MODERATOR, verasPicture, true, null, verasPhoto))
				.isEqualTo(200);

		assertThat(db.sql("select photo_id from verification where id = ?")
				.param(verasPicture).query(Long.class).optional()).isEmpty();
		/* THE PICTURE HE NAMED, and not just some picture: a portrait that was any photo row at all
		   would satisfy „it became his portrait" as well. */
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional()).contains(verasPhoto);
	}

	@Test
	void aRefusedPictureIsLetGoOfWithoutBecomingAnybodysPortrait() throws Exception {
		assertThat(answerSeeing(PROFILES_MODERATOR, verasPicture, false, THE_REASON, verasPhoto))
				.isEqualTo(200);

		assertThat(db.sql("select photo_id from verification where id = ?")
				.param(verasPicture).query(Long.class).optional()).isEmpty();
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional()).isEmpty();
	}

	// ----- the picture the moderator saw (PDL, 10.10.2026) -----------------------------------

	/**
	 * A DECISION ABOUT A PICTURE IS A DECISION ABOUT THE PICTURE HE SAW, AND AN APPROVAL OF ONE
	 * THE MEMBER HAS SINCE REPLACED PUBLISHES NOTHING.
	 *
	 * <p>PDL, the owner's answer of 10.10.2026: „Odobrava se samo slika koju je moderator video
	 * (odluka nosi otisak; promenjena slika se odbija rečenicom)." Until it, this press published
	 * whatever the row held when it arrived, and the row is the one a member's second send
	 * repoints under the moderator's hand (the cost the owner accepted, PDL 27.09.2026).
	 *
	 * <p><b>The picture he names is the OLD one and the row holds the NEW one</b>, which is the one
	 * arrangement in which „the key from the request" and „the key from the row at the moment of
	 * the press" disagree. A case in which the member sent nothing agrees with a route that reads
	 * the row, so it measures nothing about the claim (the shape this file's head calls two sources
	 * of one value). <b>What stands after it is measured on every column the decision writes</b>,
	 * because „409" alone is also what a route would answer after it had published the picture.
	 */
	@Test
	void anApprovalOfAPictureTheMemberHasSinceReplacedIsRefusedAndTheNewOneIsNotPublished()
			throws Exception {

		long newer = theMemberSendsAnother(verasPicture);

		MockHttpServletResponse answered =
				decideSeeing(PROFILES_MODERATOR, verasPicture, true, null, verasPhoto);

		assertThat(answered.getStatus())
				.as("the moderator approved a picture that is no longer the one on the row, and it"
						+ " was not refused")
				.isEqualTo(409);
		assertThat(reasonIn(answered)).isEqualTo(THE_PICTURE_WAS_CHANGED);
		nothingWasDecided(verasPicture, newer);
	}

	/**
	 * AND A REFUSAL OF ONE THE MEMBER HAS SINCE REPLACED IS REFUSED WITH THE SAME WORDS.
	 *
	 * <p>PDL, 10.10.2026, the owner choosing between the outcomes offered: „I odbijanje slike traži
	 * viđenu sliku. Obe odluke o profilnoj slici, odobravanje i odbijanje, važe samo za sliku koju
	 * je moderator video; ako je slika u međuvremenu promenjena, odluka se odbija istom rečenicom".
	 * The outcome he turned down is the one the first version of this route had: „da otisak traži
	 * samo odobravanje (član bi dobio odbijenu sliku koju niko nije pogledao)". <b>So the member
	 * is told nothing here</b>: a reason typed about one picture must not reach him as the verdict
	 * on another, and that is what the message count in {@link #nothingWasDecided} holds.
	 */
	@Test
	void aRefusalOfAPictureTheMemberHasSinceReplacedIsRefusedWithTheSameSentenceAndTellsHimNothing()
			throws Exception {

		long newer = theMemberSendsAnother(verasPicture);

		MockHttpServletResponse answered =
				decideSeeing(PROFILES_MODERATOR, verasPicture, false, THE_REASON, verasPhoto);

		assertThat(answered.getStatus())
				.as("the moderator refused a picture that is no longer the one he looked at, and it"
						+ " was recorded")
				.isEqualTo(409);
		assertThat(reasonIn(answered)).isEqualTo(THE_PICTURE_WAS_CHANGED);
		nothingWasDecided(verasPicture, newer);
	}

	/**
	 * A DECISION ABOUT A PICTURE THAT NAMES NONE IS A FORM NOT FILLED IN, FOR BOTH ANSWERS.
	 *
	 * <p>A field whose absence switched the check off would be a check anybody could skip (ADL A8,
	 * owner, 19.09.2026: „Izostavljeno polje nikad ne sme tiho da promeni vrednost"), and so would
	 * a check that only one of the two answers asks. The two are one loop here so that neither
	 * can be satisfied by a route that guards the other.
	 */
	@Test
	void aDecisionAboutAPictureThatNamesNoPictureIsAFormNotFilledIn() throws Exception {
		for (boolean approved : new boolean[] {true, false}) {
			MockHttpServletResponse answered = decideSeeing(PROFILES_MODERATOR, verasPicture,
					approved, approved ? null : THE_REASON, null);

			assertThat(answered.getStatus())
					.as("a decision that named no picture (approved=%s) was taken", approved)
					.isEqualTo(400);
			assertThat(reasonIn(answered)).isEqualTo(THE_FORM_IS_NOT_COMPLETE);
			nothingWasDecided(verasPicture, verasPhoto);
		}
	}

	/**
	 * AND A PICTURE NAMED BESIDE A ROW THAT HOLDS NONE IS REFUSED, WHICHEVER PART OF IT IS NAMED,
	 * which is the rule this route keeps for every field that rides with one kind of decision only.
	 *
	 * <p>The row is a biography. Taken and dropped, the key would tell whoever sent it that it was
	 * kept; and the screen sends one only where it drew a picture (`PendingQueue.tsx`), so this is
	 * a request that did not come from it. <b>The key alone, the circle alone and both are three
	 * rows</b>, because the guard asks about two fields and a case that named both could not tell a
	 * guard that asks about both from one that asks about either: removing the key from the question
	 * left the key refused only when the circle came with it (measured by a mutation of the series
	 * that first ran this as one case with both named, which survived).
	 */
	@ParameterizedTest
	@ValueSource(strings = {"KEY_ONLY", "CIRCLE_ONLY", "BOTH"})
	void aPictureNamedBesideARowThatHoldsNoneIsRefusedForBothAnswers(String named) throws Exception {
		for (boolean approved : new boolean[] {true, false}) {
			MockHttpServletResponse answered = decideSeeing(PROFILES_MODERATOR, anasText, approved,
					approved ? null : THE_REASON, named.equals("CIRCLE_ONLY") ? null : verasPhoto,
					named.equals("KEY_ONLY") ? null : verasCircle);

			assertThat(answered.getStatus())
					.as("%s was taken beside a biography (approved=%s)", named, approved)
					.isEqualTo(400);
			assertThat(reasonIn(answered)).isEqualTo(A_SEEN_PICTURE_GOES_WITH_A_PICTURE);
			assertThat(stateOf(anasText)).isEqualTo("waiting");
			assertThat(db.sql("select bio from competitor where member_number = ?")
					.param(ANA).query(String.class).single())
					.as("the biography was published although the request was refused")
					.isEmpty();
		}
	}

	/**
	 * THE KEY OF ANOTHER ROW'S PICTURE IS NOT THE PICTURE OF THIS ROW, and neither is a key no
	 * picture has.
	 *
	 * <p>Both are the same refusal as a picture replaced, and the second is not a fault: a
	 * comparison written as „does a photo with this key exist" accepts the first, and one that
	 * hands the key to a statement that wants a row would fall over on the second. Vera's row
	 * holds {@link #verasPhoto}; another member's picture waits beside it, so the key sent is a
	 * real waiting picture that is simply not hers.
	 */
	@Test
	void theKeyOfAnotherRowsPictureOrOfNoPictureIsNotThePictureOfThisRow() throws Exception {
		long bojansPhoto = photograph();

		waiting("profiles", BOJAN, "Slika Bojana", "bojan.jpg", bojansPhoto);

		for (long named : new long[] {bojansPhoto, 9_000_000_000L}) {
			MockHttpServletResponse answered =
					decideSeeing(PROFILES_MODERATOR, verasPicture, true, null, named);

			assertThat(answered.getStatus())
					.as("key %d was taken for the picture of Vera's row", named)
					.isEqualTo(409);
			assertThat(reasonIn(answered)).isEqualTo(THE_PICTURE_WAS_CHANGED);
			nothingWasDecided(verasPicture, verasPhoto);
		}
	}

	/**
	 * THE SAME FILE SENT AGAIN IS A NEW PICTURE, and the decision about the old one is refused.
	 *
	 * <p>This pins a boundary and does not argue for it. The key is issued once and never again,
	 * so a picture replaced by one of the same bytes is a different key; the cost is a moderator
	 * who is asked to look again at what he already saw, and that is the safe direction. A digest
	 * of the bytes would have called it unchanged, and would also have called unchanged a picture
	 * replaced and then replaced back. The decision about the new key goes through.
	 */
	@Test
	void theSameFileSentAgainIsANewPictureAndTheDecisionAboutTheOldOneIsRefused() throws Exception {
		long again = theSameFileSentAgain(verasPicture);

		assertThat(db.sql("select digest from photo where id = ?").param(again)
				.query(String.class).single())
				.as("the second picture is not the same file, so this case is about two files")
				.isEqualTo(db.sql("select digest from photo where id = ?").param(verasPhoto)
						.query(String.class).single());

		assertThat(decideSeeing(PROFILES_MODERATOR, verasPicture, true, null, verasPhoto).getStatus())
				.isEqualTo(409);
		nothingWasDecided(verasPicture, again);

		assertThat(decideSeeing(PROFILES_MODERATOR, verasPicture, true, null, again).getStatus())
				.isEqualTo(200);
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional()).contains(again);
	}

	/**
	 * A CIRCLE MOVED OVER THE SAME PICTURE IS A CHANGE OF WHAT HE SAW, FOR BOTH ANSWERS: THE
	 * DECISION IS REFUSED AND THE ROW STAYS WITH THE CIRCLE THE MEMBER LEFT.
	 *
	 * <p>{@code MePhotoApi.send} with no file moves the circle on the row of the picture that is
	 * there, so the KEY does not move. A case that pinned exactly that as a limit stood here until
	 * 10.10.2026, when the print was extended to the circle: the record of 27.09.2026 has a circle
	 * moved over the same picture overwrite the waiting row as a new picture does („da pomerim krug
	 * da gadja drugi deo slike, opet se salje na verifikaciju i gazi trenutan red kod verifikatora"),
	 * and a decision is only about what the moderator saw. Measured on the route before the circle
	 * was part of it: the key 1 before and 1 after, and a decision naming the old key answered 200
	 * and published the moved circle.
	 *
	 * <p>All three fractions move here; {@link #aCircleMovedInOnlyOneFractionIsStillAnotherCircle}
	 * moves them one at a time. The circle named is the one the picture HAD (the fixture's, never
	 * read off the row at the press) and the key is the one the row still holds, so the only thing
	 * in the request that disagrees with the row is the circle. What stands after the refusal is
	 * asked of every column, and of the circle: the refusal does not put the member's move back.
	 */
	@ParameterizedTest
	@ValueSource(booleans = {true, false})
	void aCircleMovedOverTheSamePictureRefusesTheDecisionAndLeavesTheRowAsTheMemberLeftIt(
			boolean approved) throws Exception {

		theMemberMovesTheCircle(verasPhoto, "0.125", "0.875", "0.625");

		MockHttpServletResponse answered = decideSeeing(PROFILES_MODERATOR, verasPicture, approved,
				approved ? null : THE_REASON, verasPhoto);

		assertThat(answered.getStatus())
				.as("the moderator decided about a circle that is no longer the one on the row, and it"
						+ " was not refused (approved=%s)", approved)
				.isEqualTo(409);
		assertThat(reasonIn(answered)).isEqualTo(THE_PICTURE_WAS_CHANGED);
		nothingWasDecided(verasPicture, verasPhoto);
		assertThat(circleOn(verasPhoto))
				.as("the refusal did not leave the circle where the member put it")
				.isEqualTo("0.12500000/0.87500000/0.62500000");
	}

	/**
	 * AND ONE FRACTION OF THE THREE MOVED IS ALREADY ANOTHER CIRCLE.
	 *
	 * <p>A comparison that left one of the three out would pass the case above, which moves all of
	 * them, and a member who drags the circle straight across moves one. Each column is moved on its
	 * own by the same small step, the picture and its key stay, and the decision names the circle as
	 * it was.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"crop_x", "crop_y", "crop_diameter"})
	void aCircleMovedInOnlyOneFractionIsStillAnotherCircle(String column) throws Exception {
		db.sql("update photo set " + column + " = " + column + " + 0.05 where id = ?")
				.param(verasPhoto).update();

		MockHttpServletResponse answered =
				decideSeeing(PROFILES_MODERATOR, verasPicture, true, null, verasPhoto);

		assertThat(answered.getStatus())
				.as("%s moved on its own and the decision about the old circle was not refused", column)
				.isEqualTo(409);
		assertThat(reasonIn(answered)).isEqualTo(THE_PICTURE_WAS_CHANGED);
		nothingWasDecided(verasPicture, verasPhoto);
	}

	/**
	 * AFTER THE REFUSAL THE ROW STILL CAN BE DECIDED, by the moderator who looks again: naming the
	 * circle as it stands now goes through, and what it publishes is that circle.
	 *
	 * <p>This is the other half of „i red ostaje" (PDL, 10.10.2026): a refusal that left the row
	 * waiting but unable to be answered would satisfy every assertion of the cases above.
	 */
	@Test
	void afterTheRefusalADecisionNamingTheCircleAsItStandsNowGoesThrough() throws Exception {
		theMemberMovesTheCircle(verasPhoto, "0.125", "0.875", "0.625");

		assertThat(answerSeeing(PROFILES_MODERATOR, verasPicture, true, null, verasPhoto))
				.isEqualTo(409);

		assertThat(decideSeeing(PROFILES_MODERATOR, verasPicture, true, null, verasPhoto,
				circleOf(verasPhoto)).getStatus())
				.as("the moderator who looked again was refused")
				.isEqualTo(200);
		assertThat(stateOf(verasPicture)).isEqualTo("approved");
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional()).contains(verasPhoto);
		assertThat(circleOn(verasPhoto)).isEqualTo("0.12500000/0.87500000/0.62500000");
	}

	/**
	 * THE CIRCLE IS COMPARED BY VALUE AND NOT BY SPELLING: the column keeps eight decimals and the
	 * number a screen sends back is the one it read, so {@code 0.3} is the circle the column holds as
	 * {@code 0.30000000}.
	 *
	 * <p>{@code BigDecimal.equals} compares the scale as well and would call all of these but the
	 * eight-decimal one another circle, refusing every approval the screen ever sends. The spellings
	 * are the ones a client can honestly produce for the same number: padded, unpadded, with more
	 * digits than the column keeps, and in exponent form.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"0.3", "0.30", "0.30000000", "0.3000000000", "3E-1"})
	void theCircleIsComparedByValueAndNotBySpelling(String spelled) throws Exception {
		theMemberMovesTheCircle(verasPhoto, "0.3", "0.7", "0.45");

		String circle = "{\"x\":" + spelled + ",\"y\":0.7,\"size\":0.45}";

		assertThat(decideSeeing(PROFILES_MODERATOR, verasPicture, true, null, verasPhoto, circle)
				.getStatus())
				.as("the circle spelled %s was taken for another circle", spelled)
				.isEqualTo(200);
	}

	/**
	 * A PICTURE NAMED WITHOUT ITS CIRCLE, OR A CIRCLE WITHOUT ITS PICTURE, OR A CIRCLE WITH A
	 * FRACTION MISSING, IS A FORM NOT FILLED IN.
	 *
	 * <p>The key alone is not the print (the case above that moves the circle is what shows it), so
	 * a request that names the key and leaves the circle out would be a check anybody could skip
	 * (ADL A8, owner, 19.09.2026: „Izostavljeno polje nikad ne sme tiho da promeni vrednost"). The
	 * halves are separate guards of one function and each is its own row here, so that removing any
	 * one leaves a case that fails: a missing part is read as a missing circle, and the whole of it
	 * as a refusal of the form and not as a fault of the server.
	 */
	@ParameterizedTest
	@ValueSource(strings = {
		"KEY_ONLY",
		"CIRCLE_ONLY",
		"{\"y\":0.7,\"size\":0.45}",
		"{\"x\":0.3,\"size\":0.45}",
		"{\"x\":0.3,\"y\":0.7}",
		"{}"})
	void aPictureNamedWithoutItsWholeCircleIsAFormNotFilledIn(String what) throws Exception {
		for (boolean approved : new boolean[] {true, false}) {
			MockHttpServletResponse answered = switch (what) {
				case "KEY_ONLY" -> decideSeeing(PROFILES_MODERATOR, verasPicture, approved,
						approved ? null : THE_REASON, verasPhoto, null);
				case "CIRCLE_ONLY" -> decideSeeing(PROFILES_MODERATOR, verasPicture, approved,
						approved ? null : THE_REASON, null, verasCircle);
				default -> decideSeeing(PROFILES_MODERATOR, verasPicture, approved,
						approved ? null : THE_REASON, verasPhoto, what);
			};

			assertThat(answered.getStatus())
					.as("a decision naming %s was taken (approved=%s)", what, approved)
					.isEqualTo(400);
			assertThat(reasonIn(answered)).isEqualTo(THE_FORM_IS_NOT_COMPLETE);
			nothingWasDecided(verasPicture, verasPhoto);
		}
	}

	/**
	 * A ROW SOMEBODY ELSE DECIDED IS ANSWERED AS DECIDED, and not as a picture that changed or as
	 * a request that named a picture where the row now holds none.
	 *
	 * <p>A decided row keeps no picture (V9), so a late request that still names one meets a row
	 * for which „a key beside a row that holds none" is true. The refusal that is owed to it is the
	 * one it always got, and that depends on the state being asked before the key is
	 * (`DecidingOnASubmission.decide`, ahead of the transaction): moved after it, this answers 400
	 * about the form of a request that was perfectly well formed when the moderator pressed.
	 */
	@Test
	void aModeratorWhoMeetsAPictureSomebodyElseDecidedIsToldSoAndNotThatItChanged()
			throws Exception {

		assertThat(answerSeeing(PROFILES_MODERATOR, verasPicture, true, null, verasPhoto))
				.isEqualTo(200);

		for (boolean approved : new boolean[] {true, false}) {
			MockHttpServletResponse late = decideSeeing(THE_OTHER_PROFILES_MODERATOR, verasPicture,
					approved, approved ? null : THE_REASON, verasPhoto);

			assertThat(late.getStatus()).as("late answer, approved=%s", approved).isEqualTo(409);
			assertThat(reasonIn(late)).isEqualTo(SOMEBODY_ANSWERED_IT_ALREADY);
		}

		assertThat(stateOf(verasPicture)).isEqualTo("approved");
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional()).contains(verasPhoto);
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
	 * „ako ga prihvate, clanu odmah treba da stigne obavestenje u portal inboks da je njihov
	 * tim prihvacen i od tog trenutka imaju Admin prava za svoj tim" (owner, 03.08.2026), and the
	 * entry of 05.09.2026, which is not his sentence: a review of PR 186 found that approval
	 * wrote the team and left the founder out of it.
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
	 * ONLY THE SUBMISSION AN APPROVAL DECIDES IS WRITTEN OVER, AND EVERY OTHER ONE IS LEFT AS IT
	 * WAS (PR 495 review).
	 *
	 * <p>{@link #onlyHisOwnRunIsCountedAndTheOtherTwoMembersAreLeftAsTheyWere} holds that approving
	 * one member's run leaves the other members' results where they were; this holds the same of
	 * the submissions. {@code VerificationWriteApi.countTheResult} writes what was counted back
	 * into the decided submission with {@code where id = ?}, and the other cases that read a
	 * submission after an answer all read the one that answer was about, so a statement naming
	 * more rows than that one wrote the right figures where they were looked for and agreed with
	 * every case. The review measured two that did: {@code where id >= ?}, which reaches every
	 * later row whoever's it is, and {@code where competitor_id = (select competitor_id from
	 * result_submission where id = ?)}, which reaches every row of the same member. Neither
	 * failed a case.
	 *
	 * <p><b>It asks the table and not a list.</b> Every submission but the decided one is read
	 * before the answer and again after it, and the two readings must be equal row for row. The
	 * comparison names no row, so a row the fixture gains later is watched without anybody adding
	 * it to anything.
	 *
	 * <p><b>The rows beside the decided one are drawn so that a wider statement, along any axis,
	 * reaches one.</b> Vera's correction is the one decided. Her second correction of the same
	 * run waits beside it: the same member, the same race and the same run amended (nothing in
	 * {@code ResultWriteApi} refuses a second correction while one is waiting, as its class
	 * comment says). Ana's run at the same race is another member's, and so are the rows made
	 * before Vera's. The floor asserts the axes the review's two statements reach along - a row
	 * before, a row after, a row of the same member and a row of another - and that no neighbour
	 * carries the figures the answer writes or the ones her correction carried until then, or a
	 * statement that wrote them into it would change nothing anybody could see.
	 *
	 * <p>That the decided submission IS written over with what was counted is a different fact,
	 * held by the cases that read it through {@code submitted}. This one asserts nothing about it.
	 */
	@Test
	void onlyTheSubmissionAnApprovalDecidesIsWrittenOverAndEveryOtherOneIsLeftAsItWas()
			throws Exception {
		runWaitingFor(VERA, theTrail, SATURDAY, "10.00", 120, 40, 3400, verasCountedRun);

		long decided = db.sql("select result_submission_id from verification where id = ?")
				.param(verasCorrection).query(Long.class).single();
		String whatHerCorrectionSaid = fourFigures("10.00", CORRECTED_CLIMB, CORRECTED_DROP,
				CORRECTED_TIME);
		String whatTheAnswerWrites = fourFigures("10.5", 180, 60, 3250);
		List<Sent> before = everySubmissionBut(verasCorrection);

		assertThat(before).extracting(Sent::figures)
				.as("a neighbour carries what the answer writes or what her correction said, so a"
						+ " write into it would change nothing anybody could see")
				.doesNotContain(whatHerCorrectionSaid, whatTheAnswerWrites);
		assertThat(before)
				.as("no submission stands before the decided one, so every earlier row is out of"
						+ " reach and this measures nothing along that axis")
				.anyMatch(each -> each.id() < decided);
		assertThat(before)
				.as("no submission stands after the decided one, so every later row is out of"
						+ " reach and this measures nothing along that axis")
				.anyMatch(each -> each.id() > decided);
		assertThat(before)
				.as("Vera has no other submission, so the same member is out of reach and this"
						+ " measures nothing along that axis")
				.anyMatch(each -> each.member().equals(VERA));
		assertThat(before)
				.as("nobody but Vera has a submission, so another member is out of reach and this"
						+ " measures nothing along that axis")
				.anyMatch(each -> !each.member().equals(VERA));

		assertThat(decideWith(THE_SUPERADMIN, verasCorrection, "{\"approved\":true,\"amended\":"
				+ "{\"distanceKm\":10.5,\"ascentM\":180,\"descentM\":60,\"seconds\":3250}}")
				.getStatus()).isEqualTo(200);
		assertThat(stateOf(verasCorrection)).as("the answer was not given").isEqualTo("approved");

		assertThat(everySubmissionBut(verasCorrection))
				.as("an approval wrote over a submission it did not decide")
				.containsExactlyElementsOf(before);
	}

	/**
	 * A CORRECTION OVERWRITES THE RUN IT AMENDS AND DOES NOT ADD A SECOND ONE.
	 *
	 * <p>The owner chose on 28.08.2026 between four outcomes, and what follows from the one he
	 * took is that the approval replaces the result, so the old one leaves and the new one
	 * enters in the same moment (the journal's wording of what follows, not his sentence).
	 * Asserted as a COUNT and as
	 * the same row id, not only as the new figures: a statement that inserted instead of
	 * updating would leave the new numbers exactly where this case looks for them while
	 * doubling the member's season.
	 *
	 * <p>The race is asserted unchanged because the owner answered so the day before
	 * (27.08.2026, in the journal's wording of his answer): everything is changed except the
	 * race.
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
				.query(Long.class).single()).as("the race moved").isEqualTo(theTrail);
	}

	/**
	 * A REFUSED CORRECTION LEAVES THE STANDINGS EXACTLY WHERE THEY WERE.
	 *
	 * <p>The owner's choice of 28.08.2026, and it is the half of what follows from it that the
	 * portal once got wrong in the direction that costs the member: a refusal changes nothing
	 * (the journal's wording, not his sentence). The fault that was
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
	 * <p>The owner's decision of 26.09.2026, in the journal's wording and not in a sentence of
	 * his: if an approval takes the member's total for the current season to twelve or more,
	 * the beginners' category closes for the NEXT season at once. <b>Both halves are asserted
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
	 * AND HE IS TOLD, WITH THE REASON IN IT: THE THIRD PART OF IT, WHICH SEASON CLOSED AND AT
	 * WHAT THRESHOLD.
	 *
	 * <p>PDL, the entry titled Ponisten izbor kategorije se javlja clanu, sa razlogom
	 * (27.09.2026): the owner chose the first of three outcomes offered, with my recommendation
	 * beside it, and the outcome is that the member is told. He refused silence and he refused
	 * an explanation on a page the member has no reason to open. <b>What the message carries is
	 * how that entry writes the outcome down - which result was approved, how many points it is
	 * worth, and that the beginners' category is closed for the next season - and it is NOT a
	 * sentence he said</b>: it is not in quotation marks there, and the first form of it, in the
	 * entry of 26.09.2026, is marked as my reasoning awaiting his confirmation. So the three
	 * parts are held separately: this case holds the third and
	 * {@link #andHeIsToldWhichRunWasApprovedAndWhatItIsWorth} holds the first two.
	 *
	 * <p>The season in the message is asserted to be 2028 and not 2027, which is the same axis
	 * as the case above read from the member's side: a message naming the run's own season
	 * would be telling him something the portal does not do. <b>It is asserted on the SENTENCE
	 * and not on the bare year</b>, because the message also names the day of the run
	 * (06.03.2027), and a year that is merely somewhere in the text says nothing about which
	 * season closed. The threshold is asserted the same way, as the phrase that names it and
	 * not as a number that happens to be somewhere: with a race, a day and the points in the
	 * text, a bare twelve could come from any of them.
	 */
	@Test
	void andHeIsToldWhichSeasonItClosedAndWhatClosedIt() throws Exception {
		assertThat(answer(THE_SUPERADMIN, anasMarathon, true, null)).isEqualTo(200);

		String said = bodyOfTheMessageTo(ANA);

		assertThat(said).contains("za sezonu 2028");
		assertThat(said).as("it names the run's own season instead of the one that closed")
				.doesNotContain("za sezonu 2027");
		assertThat(said).contains("prag od " + Category.FIRST_SEASON_POINTS + " bodova");
	}

	/**
	 * AND HE IS TOLD WHICH RUN IT WAS AND WHAT IT IS WORTH: THE FIRST TWO PARTS OF IT.
	 *
	 * <p>The message named neither the race nor the day until it was read against the entry
	 * above, although both were in hand a few lines from where it is written - they are what the
	 * letter about the same approval already carries - and a member with several results could
	 * not tell WHICH of them had closed his category. And nothing held the points at all: the
	 * case above reads the season and the threshold, so the message could have carried any
	 * number there.
	 *
	 * <p><b>THE ARRANGEMENT IS WHAT MAKES THE RACE AND THE DAY MEAN SOMETHING (dva izvora, jedna
	 * vrednost).</b> Bojan is given two OTHER counted results, one run before the approved day
	 * and one after it, with one worth more than the approved run and the other less, so the
	 * approved run is the middle of the three by date and by points: neither first nor last of
	 * anything a message could take its race from - the member's first result, his last, his
	 * best, his worst. The other wrong sources are asked of as well: the event the race belongs
	 * to (the owner's words of 29.08.2026 about the sentence over the result form are „Nikad
	 * događaj, uvek trka." and carrying them to this message is my reading, not his word about
	 * it), and, for the day, the clock, which stands in March. Each wrong value is asserted
	 * ABSENT as well as the right one present, because a text that names two races is not
	 * telling him which.
	 *
	 * <p>He is under the threshold before the approval and over it after, and the case says so
	 * itself, so that it cannot measure a member who was already shut out.
	 */
	@Test
	void andHeIsToldWhichRunWasApprovedAndWhatItIsWorth() throws Exception {
		long bojan = memberId(BOJAN);
		LocalDate theLaterDay = LocalDate.of(2027, 6, 5);
		long theLaterRace = race(anotherEvent, "Trinaestica", theLaterDay, "13.00", 100, 100);

		resultAlreadyCounted(BOJAN, theMarathon, SATURDAY, "42.1950", 300, 300, FOUR_HOURS,
				"11.00");
		resultAlreadyCounted(BOJAN, theLaterRace, theLaterDay, "13.00", 100, 100, AN_HOUR,
				"0.40");

		assertThat(beginnersCategoryIsOpenFor(bojan, 2028))
				.as("the category is shut before the approval, so nothing it does can close it and"
						+ " the case measures nothing")
				.isTrue();

		assertThat(answer(THE_SUPERADMIN, bojansRun, true, null)).isEqualTo(200);

		assertThat(beginnersCategoryIsOpenFor(bojan, 2028))
				.as("the approval did not cross the threshold, so no message is owed and the case"
						+ " measures nothing")
				.isFalse();

		String said = bodyOfTheMessageTo(BOJAN);
		String points = db.sql("select points from result where competitor_id = ? and race_id = ?")
				.params(bojan, theShortRace).query(String.class).single();

		assertThat(said).as("the race it names is not the one that was approved")
				.contains("Desetka");
		assertThat(said).as("the day it names is not the day that run was run")
				.contains("13.03.2027");
		assertThat(said.contains(points) || said.contains(points.replace('.', ',')))
				.as("the points it names are not the approved run's, which are %s", points)
				.isTrue();

		assertThat(said)
				.as("it names the race of another result of his, or the event's own name")
				.doesNotContain("Maraton").doesNotContain("Trinaestica")
				.doesNotContain("Drugi dogadjaj");
		assertThat(said)
				.as("it names the day of another result of his, or the day it was approved")
				.doesNotContain("06.03.2027").doesNotContain("05.06.2027")
				.doesNotContain("15.03.2027");
		assertThat(said)
				.as("it names the points of another result of his")
				.doesNotContain("11.00").doesNotContain("11,00")
				.doesNotContain("0.40").doesNotContain("0,40");
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
	 * false about the word „time", which is what the decision of 26.09.2026 is built on (the
	 * journal's wording: when the approval TAKES the member's total to twelve or more).
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
	 * A RUN ON A RACE THE CALENDAR DOES NOT HOLD IS NOT APPROVED BY A PLAIN YES, AND STAYS IN THE
	 * QUEUE WITH NOTHING WRITTEN INTO THE CALENDAR.
	 *
	 * <p>Since R3 such a run is approved here on one of two roads the answer names (the cases
	 * below, under „a run on a race the calendar does not hold"). An answer naming neither is
	 * refused rather than taken as „make it out of what the member typed", which is the choice the
	 * plan of R3 made and wrote down beside {@code THE_RACE_IS_NOT_IN_THE_CALENDAR}.
	 *
	 * <p><b>The item is asserted to be still WAITING, and the calendar untouched, which is the
	 * whole point.</b> Recording the decision and writing nothing would take the row out of every
	 * moderator's screen for ever while the member's run reached nothing - the one outcome a
	 * screen cannot undo - and writing an event and a race nobody named would be the other.
	 */
	@Test
	void aPlainApprovalOfARunOnARaceTheCalendarDoesNotHoldIsRefusedAndWritesNothing()
			throws Exception {
		int events = howManyEvents();
		int races = howManyRaces();

		MockHttpServletResponse refused = decide(THE_SUPERADMIN, aRunOnARaceNobodyHasEnteredYet,
				true, null);

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(reasonIn(refused)).startsWith("Trke nema u kalendaru");

		assertThat(stateOf(aRunOnARaceNobodyHasEnteredYet)).isEqualTo("waiting");
		assertThat(howManyResults(ANA)).isZero();
		assertThat(howManyEvents()).as("an event was written that nobody named").isEqualTo(events);
		assertThat(howManyRaces()).as("a race was written that nobody named").isEqualTo(races);
	}

	// ----- a run on a race the calendar does not hold (R3) --------------------------------------

	/**
	 * AN APPROVAL THAT MAKES THE RACE WRITES THE EVENT, THE RACE AND THE RESULT AT ONCE, AND THE
	 * SUBMISSION POINTS AT THE RACE.
	 *
	 * <p>PDL P9, in the record's wording: „Član sme da unese trku koje nema u kalendaru. Tada
	 * administrator kreira događaj i trku uz rezultat, i sve troje nastaje istovremeno."
	 *
	 * <p><b>Every name is a different value</b>: what the member typed, what the moderator calls
	 * the event and what he calls the race. So an event or a race written under the wrong one of
	 * the three is a different row. <b>The town is one nobody else in the fixture stands in</b>,
	 * and it is read off the codebook here, before the answer, because the submission's own town
	 * is emptied by it. <b>The climb is not the drop</b>, so a race that carried them the other way
	 * round is caught, and the formula is asked to tell the two orders apart first.
	 */
	@Test
	void aNewRaceOfALengthIsMadeWithItsEventAndTheResultAndTheSubmissionPointsAtIt()
			throws Exception {
		theFormulaTellsTheTwoOrdersApart("15.5", 220, 180, 4500);

		long run = describedRun(ANA, "Tuđa trka", "length", THE_DAY_HE_RAN, "15.5000", 220, 180,
				4500);
		long theTown = placeOfRank(THE_TOWN_HE_NAMED);

		assertThat(decideWith(THE_SUPERADMIN, run, makingTheRace("Jarkovačka staza",
				"Jarkovačka desetka", "length", null)).getStatus()).isEqualTo(200);

		assertThat(stateOf(run)).isEqualTo("approved");

		AnEvent event = eventAt("jarkovacka-staza-2027").orElseThrow(
				() -> new AssertionError("no event answers at the address of the name the moderator"
						+ " gave it and the year the member ran"));

		assertThat(event.name()).isEqualTo("Jarkovačka staza");
		assertThat(event.date()).as("the event begins on the day of its one race")
				.isEqualTo(THE_DAY_HE_RAN);
		assertThat(event.placeId()).as("the event does not stand in the town the member named")
				.isEqualTo(theTown);
		assertThat(event.city()).isNull();
		assertThat(event.countryId()).isNull();
		assertThat(event.kind()).isEqualTo("race");
		assertThat(event.featured()).isFalse();
		assertThat(event.description()).isEmpty();
		assertThat(event.link())
				.as("the event's link is the organiser's page, and the member's proof is not that")
				.isEmpty();

		List<ARace> under = racesOf(event.id());

		assertThat(under).as("the event holds one race, the one the run is counted on").hasSize(1);
		assertThat(under.get(0).name()).isEqualTo("Jarkovačka desetka");
		assertThat(under.get(0).renamed()).as("the race's name was given by hand").isTrue();
		assertThat(under.get(0).date()).isEqualTo(THE_DAY_HE_RAN);
		assertThat(under.get(0).kind()).isEqualTo("length");
		assertThat(under.get(0).fixes())
				.as("a race of a length fixes the distance, the climb and the fall it was made of")
				.isEqualTo(fourFigures("15.5", 220, 180, 0));

		AResult result = theResultOf(ANA);

		assertThat(result.raceId()).as("the result is not on the race the approval made")
				.isEqualTo(under.get(0).id());
		assertThat(result.raceDate()).isEqualTo(THE_DAY_HE_RAN);
		assertThat(result.figures()).isEqualTo(fourFigures("15.5", 220, 180, 4500));
		assertThat(result.points()).isEqualByComparingTo(
				BtlScoreCalculator.calculate(15.5, 220, 180, 4500));

		assertThat(whatTheSubmissionSays(run))
				.as("the decided submission still describes a race instead of naming the one it"
						+ " was counted on")
				.isEqualTo(new Described(under.get(0).id(), THE_DAY_HE_RAN, null, null, null, null,
						null, fourFigures("15.5", 220, 180, 4500)));

		/* AND THE EVENT'S DAY IS ITS FIRST RACE'S, which V29 asks only when the transaction
		   commits and a case like this one never does. */
		TheEndOfTheTransaction.broughtForward(db);
	}

	/**
	 * ON A NEW RACE TO A LIMIT THE TIME IS THE RACE'S LIMIT, AND THE KIND IS THE MODERATOR'S.
	 *
	 * <p>PDL P9, owner, 30.08.2026: „a ja ću lako promeniti njegovo vreme sa recimo 23:23:15 na
	 * 24:00:00". The member hinted a race of a length and sent his own 23:23:15; the moderator
	 * decides it is a race to a limit and sets the limit, and his distance, climb and fall in
	 * place of the member's - every one of the four different from what was sent, so a race or a
	 * result written from the sent copy is a different row.
	 */
	@Test
	void aNewRaceToALimitTakesTheTimeAsItsLimitAndTheRunIsCountedAtIt() throws Exception {
		long run = describedRun(ANA, "Noćni krug", "length", THE_DAY_HE_RAN, "60.0000", 400, 390,
				84195);

		assertThat(decideWith(THE_SUPERADMIN, run, makingTheRace("Dvadesetčetiri sata",
				"Dvadesetčetvoročasovna", "time", "{\"distanceKm\":61.25,\"ascentM\":410,"
						+ "\"descentM\":395,\"seconds\":86400}")).getStatus()).isEqualTo(200);

		AnEvent event = theEventAt("dvadesetcetiri-sata-2027");
		List<ARace> under = racesOf(event.id());

		assertThat(under).hasSize(1);
		assertThat(under.get(0).kind())
				.as("the race took the member's hint rather than the moderator's decision")
				.isEqualTo("time");
		assertThat(under.get(0).limitSeconds()).isEqualTo(86400);
		assertThat(under.get(0).fixes())
				.as("a race to a limit fixes the time and nothing else: no distance, and a climb and"
						+ " a fall it cannot know in advance")
				.isEqualTo(fourFigures("0", 0, 0, 86400));

		assertThat(theResultOf(ANA).figures())
				.as("the run is counted at the limit and at the moderator's own three")
				.isEqualTo(fourFigures("61.25", 410, 395, 86400));
		assertThat(theResultOf(ANA).points()).isEqualByComparingTo(
				BtlScoreCalculator.calculate(61.25, 410, 395, 86400));
	}

	/** A NEW FREE RACE FIXES NOTHING, and the run is counted at all four of the member's own. */
	@Test
	void aNewFreeRaceFixesNothingAndTheRunIsCountedAtAllFourOfHis() throws Exception {
		long run = describedRun(ANA, "Planinski uspon", "time", THE_DAY_HE_RAN, "18.4000", 1250, 300,
				9000);

		assertThat(decideWith(THE_SUPERADMIN, run, makingTheRace("Visoki vrh", "Visoki vrh", "free",
				null)).getStatus()).isEqualTo(200);

		List<ARace> under = racesOf(theEventAt("visoki-vrh-2027").id());

		assertThat(under).hasSize(1);
		assertThat(under.get(0).kind()).isEqualTo("free");
		assertThat(under.get(0).fixes()).isEqualTo(fourFigures("0", 0, 0, 0));
		assertThat(theResultOf(ANA).figures()).isEqualTo(fourFigures("18.4", 1250, 300, 9000));
	}

	/**
	 * THE EVENT STANDS IN THE TOWN THE MEMBER TYPED WHERE HE TYPED ONE, WITH ITS COUNTRY, AND A
	 * RACE OF A LENGTH IS MADE OF THE FIGURES THE MODERATOR SET.
	 *
	 * <p>PDL P9, 30.08.2026, in the record's wording: „Događaj u kalendaru nosi grad i državu, a
	 * forma ih nije tražila, pa bi događaj napravljen pri verifikaciji ostao bez mesta." The other
	 * way a town is held, beside the codebook's above; neither is the member's own, and the
	 * country is not his town's either (his stands in the codebook, in another country).
	 *
	 * <p><b>The moderator sets all four figures, each different from what was sent</b>, so a race
	 * of a length made of the sent copy - its distance, its climb or its fall - is a different row
	 * from the one made of his.
	 */
	@Test
	void theEventStandsInTheTownTheMemberTypedAndTheRaceIsMadeOfTheModeratorsFigures()
			throws Exception {
		long run = describedRun(ANA, "Gradska trka", "length", THE_DAY_HE_RAN, null,
				"Bela Palanka", "RS", "10.0000", 40, 35, 2900);

		assertThat(decideWith(THE_SUPERADMIN, run, makingTheRace("Belopalanačka trka",
				"Belopalanačka trka", "length", "{\"distanceKm\":10.4,\"ascentM\":55,"
						+ "\"descentM\":45,\"seconds\":2950}")).getStatus()).isEqualTo(200);

		AnEvent event = theEventAt("belopalanacka-trka-2027");

		assertThat(event.placeId()).isNull();
		assertThat(event.city()).isEqualTo("Bela Palanka");
		assertThat(event.countryId()).isEqualTo(countryCoded("RS"));

		assertThat(theOneRaceOf(event.id()).fixes())
				.as("the race was made of the figures the member sent and not of the moderator's")
				.isEqualTo(fourFigures("10.4", 55, 45, 0));
		assertThat(theResultOf(ANA).figures()).isEqualTo(fourFigures("10.4", 55, 45, 2950));
	}

	/**
	 * THE SAME NAME TWICE IN ONE YEAR GETS THE NEXT FREE NUMBER, AND IS NOT REFUSED.
	 *
	 * <p>PDL, owner, 19.09.2026, choosing among four outcomes offered, in the record's wording:
	 * „Adresa događaja je naziv i godina, a isti naziv dvaput u istoj godini dobija redni broj."
	 * Two addresses of that name are taken already, so the next is the THIRD and not the second;
	 * and a name spelt with letters the address does not keep is the same address, so „Trka
	 * Čačak" meets „Trka Cacak" and is numbered rather than written over it or refused.
	 */
	@Test
	void theSameNameTwiceInOneYearGetsTheNextFreeNumberRatherThanARefusal() throws Exception {
		event("zimska-trka-2027", "Zimska trka", LocalDate.of(2027, 1, 16));
		event("zimska-trka-2027-2", "Zimska trka", LocalDate.of(2027, 2, 13));
		event("trka-cacak-2027", "Trka Cacak", LocalDate.of(2027, 2, 20));

		long one = describedRun(ANA, "Zimska", "length", THE_DAY_HE_RAN, "8.0000", 30, 30, 2000);
		long other = describedRun(BOJAN, "Čačak", "length", THE_DAY_HE_RAN, "9.0000", 35, 25, 2300);

		assertThat(decideWith(THE_SUPERADMIN, one, makingTheRace("Zimska trka", "Zimska trka",
				"length", null)).getStatus()).isEqualTo(200);
		assertThat(decideWith(THE_SUPERADMIN, other, makingTheRace("Trka Čačak", "Trka Čačak",
				"length", null)).getStatus()).isEqualTo(200);

		assertThat(eventAt("zimska-trka-2027-3"))
				.as("the third event of that name that year was not given the next free number")
				.isPresent();
		assertThat(eventAt("trka-cacak-2027-2")).isPresent();
		assertThat(theResultOf(ANA).raceId())
				.isEqualTo(theOneRaceOf(theEventAt("zimska-trka-2027-3").id()).id());
	}

	/**
	 * AND THE SAME NAME IN ANOTHER YEAR IS NOT NUMBERED AT ALL, because the year is in the
	 * address: „Prolećna trka" of 2026 and of 2027 are two addresses that never met.
	 */
	@Test
	void theSameNameInAnotherYearIsNotNumbered() throws Exception {
		event("prolecna-trka-2026", "Prolećna trka", LocalDate.of(2026, 4, 4));

		long run = describedRun(ANA, "Prolećna", "length", THE_DAY_HE_RAN, "7.0000", 20, 20, 1900);

		assertThat(decideWith(THE_SUPERADMIN, run, makingTheRace("Prolećna trka", "Prolećna trka",
				"length", null)).getStatus()).isEqualTo(200);

		assertThat(eventAt("prolecna-trka-2027")).isPresent();
		assertThat(eventAt("prolecna-trka-2027-2")).isEmpty();
	}

	/**
	 * A RUN IS COUNTED ON A RACE OF THE CALENDAR THE MODERATOR CHOSE, BY ITS KEY, AND THAT RACE
	 * ANSWERS FOR WHAT IT FIXES AND FOR ITS DAY.
	 *
	 * <p>PDL P9, owner, 30.08.2026: „kad odem da verifikujem drugom članu mogu da zamenim njegov
	 * naziv događaja i izbor trke autocompletom sad već postojeće trke", and in the record's
	 * wording the choice „popuni i zaključa ono što trka zadaje".
	 *
	 * <p><b>Three races carry the name „Desetka" and the one chosen is the middle one by key</b>,
	 * so a race found by its name - first or last - is a different row; <b>and the last one is run
	 * on the same Saturday</b>, so a race found by its day is a different row as well. <b>The
	 * member's day, his distance, climb and fall are all different from the race's</b>, so a
	 * result written from any of them is a different row too; only his time is his.
	 */
	@Test
	void aRunIsCountedOnTheRaceOfTheCalendarChosenByItsKeyAndTheRaceAnswersForWhatItFixes()
			throws Exception {
		long chosen = race(theWeekendEvent, "Desetka", SATURDAY, "10.5000", 70, 40);
		race(event("treci-dogadjaj-r3", "Treći događaj", SATURDAY), "Desetka", SATURDAY, "9.8000",
				20, 20);

		long run = describedRun(ANA, "Desetka u parku", "free", LocalDate.of(2027, 3, 8),
				"11.0000", 90, 80, 2500);
		int events = howManyEvents();
		int races = howManyRaces();

		assertThat(decideWith(THE_SUPERADMIN, run, onTheRace(chosen, null)).getStatus())
				.isEqualTo(200);

		AResult result = theResultOf(ANA);

		assertThat(result.raceId()).as("the run is counted on a race other than the one chosen")
				.isEqualTo(chosen);
		assertThat(result.raceDate()).as("the run carries the day the member typed, and the race"
				+ " answers for its own").isEqualTo(SATURDAY);
		assertThat(result.figures())
				.as("the race of a length did not answer for the distance, the climb and the fall")
				.isEqualTo(fourFigures("10.5", 70, 40, 2500));

		assertThat(whatTheSubmissionSays(run)).isEqualTo(new Described(chosen, SATURDAY, null,
				null, null, null, null, fourFigures("10.5", 70, 40, 2500)));
		assertThat(howManyEvents()).as("an event was made for a run whose race was chosen")
				.isEqualTo(events);
		assertThat(howManyRaces()).isEqualTo(races);

		/* AND THE LETTER NAMES THE RACE'S DAY AND NOT THE ONE THE MEMBER TYPED. */
		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).isNotEmpty();
		assertThat(arrived[0].getContent().toString()).contains("Desetka, 06.03.2027");
	}

	/**
	 * ON A RACE TO A LIMIT THE CHOSEN RACE'S LIMIT IS THE TIME, NOT THE ONE THE MEMBER TYPED.
	 *
	 * <p>PDL P9, 30.08.2026, in the record's wording: the formula counts by the limit „isto kao da
	 * je došlo iz kalendara, pa odluka od 29.08.2026 važi na oba puta". The member typed his own
	 * five hours and fifty minutes; the race runs to six.
	 */
	@Test
	void aRunCountedOnARaceToALimitIsCountedAtTheLimitAndNotAtTheTimeHeTyped() throws Exception {
		long run = describedRun(BOJAN, "Šestočasovna trka", "time", THE_DAY_HE_RAN, "50.1000", 600,
				580, 21000);

		assertThat(decideWith(THE_SUPERADMIN, run, onTheRace(theTimedRace, null)).getStatus())
				.isEqualTo(200);

		assertThat(theResultOf(BOJAN).figures()).isEqualTo(fourFigures("50.1", 600, 580,
				SIX_HOURS));
	}

	/** A RACE STILL TO COME IS REFUSED THE SAME WAY WHICHEVER ROAD NAMED IT, and the run waits,
	 *  still describing the race the member typed. */
	@Test
	void aRaceStillToComeIsRefusedWhenChosenAndTheRunWaitsAsItWas() throws Exception {
		long future = race(event("buduca-trka-r3", "Buduća trka", LocalDate.of(2027, 4, 10)),
				"Buduća trka", LocalDate.of(2027, 4, 10), "21.1000", 100, 100);
		long run = describedRun(ANA, "Buduća", "length", THE_DAY_HE_RAN, "21.1000", 100, 100, 6000);
		Described before = whatTheSubmissionSays(run);

		MockHttpServletResponse refused = decideWith(THE_SUPERADMIN, run, onTheRace(future, null));

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(reasonIn(refused)).startsWith("Trka još nije održana");
		assertThat(stateOf(run)).isEqualTo("waiting");
		assertThat(whatTheSubmissionSays(run)).isEqualTo(before);
		assertThat(howManyResults(ANA)).isZero();
	}

	/** A KEY NO RACE ANSWERS TO is a form fault about the race the form carries, and nothing is
	 *  decided. */
	@Test
	void aRaceNoRowAnswersToIsAFormFaultAndNothingIsDecided() throws Exception {
		long nobody = db.sql("select coalesce(max(id), 0) + 1000 from race").query(Long.class)
				.single();

		MockHttpServletResponse refused = decideWith(THE_SUPERADMIN, aRunOnARaceNobodyHasEnteredYet,
				onTheRace(nobody, null));

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(reasonIn(refused)).isEqualTo("Te trke nema u kalendaru.");
		assertThat(stateOf(aRunOnARaceNobodyHasEnteredYet)).isEqualTo("waiting");
	}

	/**
	 * THE RACE IS NAMED ONLY BESIDE AN APPROVAL OF A RUN IN THE RESULTS TAB: beside a refusal it
	 * names a race nobody counts on, and on another tab a race for a thing that is not a run.
	 * Both ways of naming it, and both are refused rather than quietly dropped.
	 */
	@Test
	void aRaceNamedBesideARefusalOrOnAnotherTabIsRefusedAndNothingIsDecided() throws Exception {
		String making = "\"newRace\":{\"eventName\":\"Događaj\",\"raceName\":\"Trka\","
				+ "\"raceKind\":\"length\"}";
		String choosing = "\"raceId\":" + theShortRace;

		for (String named : List.of(making, choosing)) {
			MockHttpServletResponse refusal = decideWith(THE_SUPERADMIN,
					aRunOnARaceNobodyHasEnteredYet,
					"{\"approved\":false,\"reason\":\"" + THE_REASON + "\"," + named + "}");
			MockHttpServletResponse elsewhere = decideWith(THE_SUPERADMIN, anasText,
					"{\"approved\":true," + named + "}");

			assertThat(refusal.getStatus()).as(named).isEqualTo(400);
			assertThat(reasonIn(refusal)).startsWith("Trka se zadaje samo uz odobrenje");
			assertThat(elsewhere.getStatus()).as(named).isEqualTo(400);
			assertThat(reasonIn(elsewhere)).startsWith("Trka se zadaje samo uz odobrenje");
		}

		assertThat(stateOf(aRunOnARaceNobodyHasEnteredYet)).isEqualTo("waiting");
		assertThat(stateOf(anasText)).isEqualTo("waiting");
	}

	/**
	 * A RUN WHOSE RACE THE CALENDAR HOLDS IS NOT MOVED TO ANOTHER RACE, OR MADE INTO A NEW ONE,
	 * BY AN APPROVAL: both are refused, and the run is not counted anywhere.
	 */
	@Test
	void aRunFromTheCalendarIsNotCountedOnARaceTheAnswerNames() throws Exception {
		MockHttpServletResponse made = decideWith(THE_SUPERADMIN, anasMarathon,
				makingTheRace("Drugi maraton", "Drugi maraton", "length", null));
		MockHttpServletResponse moved = decideWith(THE_SUPERADMIN, anasMarathon,
				onTheRace(theShortRace, null));

		assertThat(made.getStatus()).isEqualTo(400);
		assertThat(reasonIn(made)).startsWith("Trka se zadaje samo uz odobrenje");
		assertThat(moved.getStatus()).isEqualTo(400);
		assertThat(reasonIn(moved)).startsWith("Trka se zadaje samo uz odobrenje");
		assertThat(stateOf(anasMarathon)).isEqualTo("waiting");
		assertThat(howManyResults(ANA)).isZero();
		assertThat(eventAt("drugi-maraton-2027")).isEmpty();
	}

	/** A NEW RACE AND A RACE OF THE CALENDAR IN ONE ANSWER is no race a run could be counted on. */
	@Test
	void aRaceNamedTwiceIsRefusedAndNothingIsDecided() throws Exception {
		MockHttpServletResponse refused = decideWith(THE_SUPERADMIN, aRunOnARaceNobodyHasEnteredYet,
				"{\"approved\":true,\"raceId\":" + theShortRace + ",\"newRace\":{\"eventName\":"
						+ "\"Događaj\",\"raceName\":\"Trka\",\"raceKind\":\"length\"}}");

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(reasonIn(refused)).isEqualTo("Trka je zadata dvaput: ili nova ili postojeća.");
		assertThat(stateOf(aRunOnARaceNobodyHasEnteredYet)).isEqualTo("waiting");
	}

	/**
	 * A NEW RACE WITH A NAME LEFT OUT, A KIND NOBODY KNOWS, OR FIGURES OF HIS OWN THAT LEAVE ONE
	 * OUT IS A FORM NOT FILLED IN, and nothing is written into the calendar.
	 *
	 * <p>None of the three names falls back on what the member typed, which would be the reading
	 * of an omitted field ADL A8 forbids, „vrati na podrazumevano". A kind left out is asked for
	 * itself before the list of kinds is asked about it, because that list is a {@code Set.of} and
	 * throws on {@code null}. And a race made of the run is made of all four of its figures, so an
	 * amendment that leaves one out is not one.
	 */
	@ParameterizedTest
	@ValueSource(strings = {
			"{\"approved\":true,\"newRace\":{\"raceName\":\"Trka\",\"raceKind\":\"length\"}}",
			"{\"approved\":true,\"newRace\":{\"eventName\":\"   \",\"raceName\":\"Trka\","
					+ "\"raceKind\":\"length\"}}",
			"{\"approved\":true,\"newRace\":{\"eventName\":\"Događaj\",\"raceKind\":\"length\"}}",
			"{\"approved\":true,\"newRace\":{\"eventName\":\"Događaj\",\"raceName\":\"\","
					+ "\"raceKind\":\"length\"}}",
			"{\"approved\":true,\"newRace\":{\"eventName\":\"Događaj\",\"raceName\":\"Trka\"}}",
			"{\"approved\":true,\"newRace\":{\"eventName\":\"Događaj\",\"raceName\":\"Trka\","
					+ "\"raceKind\":\"brdska\"}}",
			"{\"approved\":true,\"newRace\":{\"eventName\":\"Događaj\",\"raceName\":\"Trka\","
					+ "\"raceKind\":\"length\"},\"amended\":{\"distanceKm\":12.0,\"ascentM\":10,"
					+ "\"seconds\":3000}}"})
	void aNewRaceLeftIncompleteIsAFormNotFilledInAndNothingIsWritten(String body) throws Exception {
		int events = howManyEvents();

		MockHttpServletResponse refused = decideWith(THE_SUPERADMIN, aRunOnARaceNobodyHasEnteredYet,
				body);

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(reasonIn(refused)).isEqualTo("Forma nije popunjena.");
		assertThat(stateOf(aRunOnARaceNobodyHasEnteredYet)).isEqualTo("waiting");
		assertThat(howManyEvents()).isEqualTo(events);
	}

	/**
	 * THE SECOND MEMBER WHO RAN THE SAME RACE WAITS UNTOUCHED WHILE THE FIRST IS APPROVED, AND IS
	 * THEN COUNTED ON THE RACE THAT APPROVAL MADE.
	 *
	 * <p>PDL P9, owner, 30.08.2026: „Ja kad unesem događaj i trku prilikom verifikacije rezultata
	 * prvog člana, kad odem da verifikujem drugom članu mogu da zamenim njegov naziv događaja i
	 * izbor trke autocompletom sad već postojeće trke." The two runs carry the same name typed and
	 * the same day, so an approval that wrote over every submission of that name - or of that day -
	 * would reach the second one, and his submission is read before the first answer and after it.
	 */
	@Test
	void theSecondMemberWhoRanTheSameRaceIsCountedOnTheRaceTheFirstApprovalMade()
			throws Exception {
		long anas = describedRun(ANA, "Noćna trka Zemun", "length", THE_DAY_HE_RAN, "5.0000", 15, 10,
				1500);
		long bojans = describedRun(BOJAN, "Noćna trka Zemun", "free", THE_DAY_HE_RAN, "5.3000", 25,
				20, 1700);
		Described bojansBefore = whatTheSubmissionSays(bojans);

		assertThat(decideWith(THE_SUPERADMIN, anas, makingTheRace("Noćna trka Zemun",
				"Noćna trka Zemun", "length", null)).getStatus()).isEqualTo(200);

		assertThat(whatTheSubmissionSays(bojans))
				.as("the first approval wrote over a submission it did not decide")
				.isEqualTo(bojansBefore);
		assertThat(stateOf(bojans)).isEqualTo("waiting");

		AnEvent event = theEventAt("nocna-trka-zemun-2027");
		long theRace = theOneRaceOf(event.id()).id();

		assertThat(decideWith(THE_SUPERADMIN, bojans, onTheRace(theRace, null)).getStatus())
				.isEqualTo(200);

		assertThat(racesOf(event.id())).as("the second approval made a race of its own")
				.hasSize(1);
		assertThat(theResultOf(BOJAN).raceId()).isEqualTo(theRace);
		assertThat(theResultOf(BOJAN).figures())
				.as("the race the first approval made answers for what it fixes")
				.isEqualTo(fourFigures("5", 15, 10, 1700));
		assertThat(theResultOf(ANA).raceId()).isEqualTo(theRace);
	}

	/**
	 * AND A SECOND RACE FOR THE SAME RUN IS NOT PREVENTED: a moderator who names the event
	 * otherwise makes a second event and a second race.
	 *
	 * <p>ADL, owner, 11.09.2026, the cost he accepted in the record's wording: „kalendar dobija
	 * trke koje niko nije planirao, i duplikati se ne sprečavaju".
	 */
	@Test
	void aSecondRaceForTheSameRunIsMadeWhenTheModeratorNamesItOtherwise() throws Exception {
		long anas = describedRun(ANA, "Noćna trka Zemun", "length", THE_DAY_HE_RAN, "5.0000", 15, 10,
				1500);
		long bojans = describedRun(BOJAN, "Noćna trka Zemun", "length", THE_DAY_HE_RAN, "5.0000",
				15, 10, 1700);

		assertThat(decideWith(THE_SUPERADMIN, anas, makingTheRace("Noćna trka Zemun",
				"Noćna trka Zemun", "length", null)).getStatus()).isEqualTo(200);
		assertThat(decideWith(THE_SUPERADMIN, bojans, makingTheRace("Zemunska noćna trka",
				"Zemunska noćna trka", "length", null)).getStatus()).isEqualTo(200);

		assertThat(eventAt("nocna-trka-zemun-2027")).isPresent();
		assertThat(eventAt("zemunska-nocna-trka-2027")).isPresent();
		assertThat(theResultOf(ANA).raceId()).isNotEqualTo(theResultOf(BOJAN).raceId());
	}

	/**
	 * A MODERATOR WHO RACES MAKES THE RACE, AND THE RESULT IS THE RUNNER'S, NOT HERS.
	 *
	 * <p>Mira decides results and runs herself, so „whose result is this" has a wrong answer that
	 * is a real member rather than a null.
	 */
	@Test
	void aModeratorWhoRacesMakesTheRaceAndTheResultIsTheRunners() throws Exception {
		long run = describedRun(ANA, "Rečna trka", "length", THE_DAY_HE_RAN, "6.0000", 12, 9, 1800);

		assertThat(decideWith(RESULTS_MODERATOR, run, makingTheRace("Rečna trka", "Rečna trka",
				"length", null)).getStatus()).isEqualTo(200);

		assertThat(howManyResults(ANA)).isEqualTo(1);
		assertThat(howManyResults(MIRA)).isZero();
	}

	/**
	 * THE LETTER NAMES THE RACE THE MODERATOR NAMED AND THE DAY IT WAS RUN, and never the words
	 * the member typed: from the approval on, that run is counted on that race (PDL P9, owner,
	 * 30.08.2026: „od tog trenutka se tako vodi rezultat u sistemu").
	 */
	@Test
	void theLetterAboutARunOnANewRaceNamesTheRaceTheModeratorNamed() throws Exception {
		long run = describedRun(ANA, "Tuđa trka", "length", THE_DAY_HE_RAN, "15.5000", 220, 180,
				4500);

		assertThat(decideWith(THE_SUPERADMIN, run, makingTheRace("Jarkovačka staza",
				"Jarkovačka desetka", "length", null)).getStatus()).isEqualTo(200);

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).isNotEmpty();
		assertThat(arrived[0].getContent().toString())
				.contains("Jarkovačka desetka, 07.03.2027")
				.doesNotContain("Tuđa trka");
	}

	/**
	 * FROM THE APPROVAL ON, HIS OWN CORRECTION IS JUDGED BY THE RACE THE APPROVAL MADE.
	 *
	 * <p>PDL P9, owner, 30.08.2026: „Član od tog trenutka može tražiti kroz portal promenu svog
	 * rezultata regularno, na novodefinisanom događaju", and in the record's wording, „ispravka se
	 * ravna po tome šta ta trka zadaje, bez ijednog novog pravila". The race is of a length, so the
	 * distance he sends in his correction is not his to set, and the correction carries the race's.
	 */
	@Test
	void hisOwnCorrectionAfterTheApprovalIsJudgedByTheRaceTheApprovalMade() throws Exception {
		long run = describedRun(ANA, "Tuđa trka", "length", THE_DAY_HE_RAN, "15.5000", 220, 180,
				4500);

		assertThat(decideWith(THE_SUPERADMIN, run, makingTheRace("Jarkovačka staza",
				"Jarkovačka desetka", "length", null)).getStatus()).isEqualTo(200);

		long result = onlyResultOf(ANA);

		MockHttpServletResponse corrected = http.perform(asking(A_COMPETITOR,
						put("/api/results/" + result))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"distanceKm\":99.0,\"ascentM\":1,\"descentM\":1,\"seconds\":4400,"
								+ "\"link\":\"https://primer.rs/ispravka\",\"comment\":\"\"}"))
				.andReturn().getResponse();

		assertThat(corrected.getStatus()).isEqualTo(200);
		assertThat(db.sql("select distance_km || ' ' || ascent_m || ' ' || descent_m || ' '"
						+ " || seconds from result_submission where amends_result_id = ?")
				.param(result).query(String.class).single())
				.as("his correction set what the race the approval made fixes")
				.isEqualTo("15.5000 220 180 4400");
	}

	/**
	 * THE RUN IS SEEN UNDER ITS NEW RACE AND EVENT, WHERE EVERY OTHER RESULT IS SEEN.
	 *
	 * <p>PDL P9, 30.08.2026, in the record's wording: „Rezultat prvog člana se veže za trku koja
	 * je tim upisom nastala, pa se vidi u tabeli te trke i na strani događaja kao i svi posle
	 * njega." Asked of the public read every table and every event page draws results from.
	 */
	@Test
	void theRunIsServedUnderTheRaceAndTheEventTheApprovalMade() throws Exception {
		long run = describedRun(ANA, "Tuđa trka", "length", THE_DAY_HE_RAN, "15.5000", 220, 180,
				4500);

		assertThat(decideWith(THE_SUPERADMIN, run, makingTheRace("Jarkovačka staza",
				"Jarkovačka desetka", "length", null)).getStatus()).isEqualTo(200);

		long result = onlyResultOf(ANA);
		var served = new ObjectMapper().readTree(http.perform(get("/api/results"))
				.andReturn().getResponse().getContentAsString());
		var hers = StreamSupport.stream(served.spliterator(), false)
				.filter(one -> one.path("id").asLong() == result)
				.findFirst()
				.orElseThrow(() -> new AssertionError("the run is not served at all"));

		assertThat(hers.path("eventSlug").asString()).isEqualTo("jarkovacka-staza-2027");
		assertThat(hers.path("eventName").asString()).isEqualTo("Jarkovačka staza");
		assertThat(hers.path("raceName").asString()).isEqualTo("Jarkovačka desetka");
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
	 * AND THE LEAGUE IS COPIED ON IT IN BLIND, WHICH SINCE 09.10.2026 NO OTHER LETTER ABOUT A
	 * RESULT IS.
	 *
	 * <p>Until then {@code ResultWriteApiTest} asked the envelope of every letter about a
	 * member's own result for the member and the league, and that was the one place on this
	 * server where a blind copy was ever seen to arrive. Those letters copy nobody now (PDL P9,
	 * 25.09.2026, „Skrivena kopija ligi NE ide kad član sam menja ili briše svoj rezultat"), so
	 * this case holds the copy that stays - and with it the half of {@code Postman} that puts
	 * one on a message at all. Why this letter keeps it is written at
	 * {@code VerificationWriteApi.post}, and it is a reading put to the owner on 09.10.2026: if
	 * he decides an approval is not copied, this is the case that turns round.
	 *
	 * <p>Asked of the ENVELOPE, because a blind copy leaves no header behind
	 * ({@code ResultWriteApiTest.everyAddressThatGotACopy} carries the measurement), and of the
	 * headers of every stored copy as well, because the league written into {@code Cc} would be
	 * reached just the same and would be named in a letter the member may forward anywhere.
	 */
	@Test
	void theLetterAboutAnApprovedRunIsCopiedToTheLeagueInBlind() throws Exception {
		assertThat(answer(THE_SUPERADMIN, anasMarathon, true, null)).isEqualTo(200);

		assertThat(SMTP.getUserManager().listUser().stream().map(GreenMailUser::getEmail))
				.as("the letter about an approved run did not reach the member and the league,"
						+ " and nobody else")
				.containsExactlyInAnyOrder(A_COMPETITOR, theLeague);

		for (MimeMessage one : SMTP.getReceivedMessages()) {
			assertThat(Arrays.stream(one.getAllRecipients()).map(Object::toString))
					.as("the copy to the league was not blind: an address beside the member's"
							+ " stands in the letter itself")
					.containsExactly(A_COMPETITOR);
		}
	}

	/**
	 * AND THE LETTER NAMES THE CLIMB AND THE DROP IN THE ORDER HE SENT THEM (PR 443 review).
	 *
	 * <p>The run the letter tells him about is built at a third place, beside the two
	 * statements and from the same two figures, so it is a third place they can be turned
	 * round. The sister route asserts this of the line it writes into the inbox when a run is
	 * sent in
	 * ({@code ResultWriteApiTest.aFreshReportCarriesWhatWasSentInAndThePointsTheFormulaGives}),
	 * which since 09.10.2026 is all it writes then; this route's letter was asserted for its
	 * recipient and its subject and not for a word of its body.
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

	// ----- what an approval counts ------------------------------------------------------

	/**
	 * THE MODERATOR'S OWN TIME IS COUNTED IN PLACE OF THE RUNNER'S, AND ON A RACE OF A LENGTH
	 * NOTHING ELSE OF HIS IS READ.
	 *
	 * <p>PDL P9, a decision the record carries without a date, in its wording: the
	 * administration changes „samo činjenične podatke (vreme, dužina, uspon, spust, trka, link),
	 * nikad bodove direktno". So the figures travel with the approval and the points are worked
	 * out from them. On a race of a length the distance, the climb and the drop are the race's
	 * (the record of 03.08.2026, in its wording: „to su zvanični podaci i moderator ih ispravlja
	 * na trci"), so of the four only the time is his to set here.
	 *
	 * <p><b>Two bodies and one answer.</b> The first sends all four, the three the race fixes set
	 * to numbers that are none of the race's, so a route that took them writes a different row.
	 * The second sends the time alone, so a route that judged the AMENDMENT for completeness
	 * rather than what is counted refuses a form that is complete.
	 *
	 * <p><b>Every place that carries what was counted is asserted</b>: the result, its points,
	 * the submission it was decided from (written over with what was counted, see
	 * {@code VerificationWriteApi.countTheResult}) and the letter. Each would read 4:00:00 if
	 * the time she sent were counted instead.
	 */
	@ParameterizedTest
	@ValueSource(strings = {
			"{\"approved\":true,\"amended\":{\"distanceKm\":40.0,\"ascentM\":1,\"descentM\":2,"
					+ "\"seconds\":14100}}",
			"{\"approved\":true,\"amended\":{\"seconds\":14100}}"})
	void theModeratorsTimeIsCountedInPlaceOfTheRunnersAndTheRaceKeepsWhatItFixes(String body)
			throws Exception {
		assertThat(decideWith(THE_SUPERADMIN, anasMarathon, body).getStatus()).isEqualTo(200);

		Counted counted = counted(onlyResultOf(ANA)).orElseThrow();

		assertThat(fourFiguresOf(counted))
				.as("the time she sent was counted rather than the one he set, or a figure the race"
						+ " fixes was taken off his form")
				.isEqualTo(fourFigures("42.1950", 300, 300, THE_TIME_HE_SETS));
		assertThat(counted.points()).isEqualByComparingTo(BtlScoreCalculator.calculate(
				new BigDecimal("42.1950").doubleValue(), 300, 300, THE_TIME_HE_SETS));
		assertThat(fourFiguresOf(submitted(anasMarathon)))
				.as("the decided submission keeps what was sent beside what was counted")
				.isEqualTo(fourFigures("42.1950", 300, 300, THE_TIME_HE_SETS));

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).as("nothing went out about an approved result").isNotEmpty();
		assertThat(arrived[0].getContent().toString())
				.as("the letter names the time she sent and not the one that was counted")
				.contains("vreme 3:55:00").doesNotContain("vreme 4:00:00");
	}

	/**
	 * ON A RACE TO A LIMIT IT IS THE OTHER WAY ROUND: THE DISTANCE, THE CLIMB AND THE DROP ARE
	 * HIS TO SET, AND THE TIME IS THE RACE'S WHATEVER HE SENDS.
	 *
	 * <p>PDL P9, the owner's choice of 29.08.2026 among the outcomes offered, in the record's
	 * wording: „Na vremenskoj trci vreme ne unosi, jer je zadato trkom." Every figure he sets
	 * differs from what she sent, and the time he sends is not the limit, so a route that
	 * ignored his figures and a route that took all four of them each write a different row.
	 */
	@Test
	void onARaceToALimitHeSetsTheDistanceAndTheClimbAndTheTimeStaysTheRaces() throws Exception {
		theFormulaTellsTheTwoOrdersApart("53.1", 655, 620, SIX_HOURS);

		assertThat(decideWith(THE_SUPERADMIN, mirasRun, "{\"approved\":true,\"amended\":"
				+ "{\"distanceKm\":53.1,\"ascentM\":655,\"descentM\":620,\"seconds\":18000}}")
				.getStatus()).isEqualTo(200);

		Counted counted = counted(onlyResultOf(MIRA)).orElseThrow();

		assertThat(fourFiguresOf(counted))
				.as("his distance, climb or drop was not counted, or his time was counted in place"
						+ " of the race's limit")
				.isEqualTo(fourFigures("53.1", 655, 620, SIX_HOURS));
		assertThat(counted.points()).isEqualByComparingTo(BtlScoreCalculator.calculate(
				new BigDecimal("53.1").doubleValue(), 655, 620, SIX_HOURS));
	}

	/**
	 * AND A CORRECTION APPROVED WITH FIGURES OF HIS OWN OVERWRITES THE COUNTED RUN WITH THEM.
	 *
	 * <p>The statement that overwrites a counted run is not the one that inserts a new one, so
	 * what it writes is asked on its own. The run is at the free race, which leaves all four to
	 * the runner, and every figure he sets differs from what she sent and from what is counted
	 * now - so a route that wrote her figures, or left the old ones, is a different row.
	 */
	@Test
	void aCorrectionApprovedWithFiguresOfHisOwnOverwritesTheRunWithThem() throws Exception {
		theFormulaTellsTheTwoOrdersApart("10.5", 180, 60, 3250);

		assertThat(decideWith(THE_SUPERADMIN, verasCorrection, "{\"approved\":true,\"amended\":"
				+ "{\"distanceKm\":10.5,\"ascentM\":180,\"descentM\":60,\"seconds\":3250}}")
				.getStatus()).isEqualTo(200);

		assertThat(howManyResults(VERA)).as("the correction added a second run").isEqualTo(1);

		Counted counted = counted(verasCountedRun).orElseThrow();

		assertThat(fourFiguresOf(counted)).isEqualTo(fourFigures("10.5", 180, 60, 3250));
		assertThat(counted.points()).isEqualByComparingTo(BtlScoreCalculator.calculate(
				new BigDecimal("10.5").doubleValue(), 180, 60, 3250));
		assertThat(fourFiguresOf(submitted(verasCorrection)))
				.as("the decided correction keeps what was sent beside what was counted")
				.isEqualTo(fourFigures("10.5", 180, 60, 3250));
	}

	/**
	 * A FIGURE THE RACE LEAVES TO THE RUNNER, MISSING FROM HIS FIGURES OR NOT A FIGURE AT ALL,
	 * IS A FORM NOT FILLED IN, AND NOTHING MOVES.
	 *
	 * <p>Judged by the three checks the member's own report is judged by
	 * ({@code ResultWriteApi.notADistance} and the two beside it), because the numbers go into
	 * the same columns: a distance missing or carrying a fifth decimal the column would not keep,
	 * and a climb or a drop below nought. On the race to a limit, so the time is the race's and
	 * the other three are his. The time is the other case below.
	 *
	 * <p>Asserted on the item, the standings and the submission: a route that wrote any of them
	 * before judging the figures leaves it changed under a refusal.
	 */
	@ParameterizedTest
	@ValueSource(strings = {
			"{\"approved\":true,\"amended\":{\"ascentM\":655,\"descentM\":620}}",
			"{\"approved\":true,\"amended\":{\"distanceKm\":53.12345,\"ascentM\":655,"
					+ "\"descentM\":620}}",
			"{\"approved\":true,\"amended\":{\"distanceKm\":53.1,\"ascentM\":-1,\"descentM\":620}}",
			"{\"approved\":true,\"amended\":{\"distanceKm\":53.1,\"ascentM\":655,\"descentM\":-1}}"})
	void aFigureLeftToTheRunnerThatIsMissingOrIsNoFigureIsAFormNotFilledIn(String body)
			throws Exception {
		MockHttpServletResponse refused = decideWith(THE_SUPERADMIN, mirasRun, body);

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(reasonIn(refused)).isEqualTo("Forma nije popunjena.");

		assertThat(stateOf(mirasRun)).isEqualTo("waiting");
		assertThat(howManyResults(MIRA)).isZero();
		assertThat(fourFiguresOf(submitted(mirasRun)))
				.isEqualTo(fourFigures(MIRAS_KM, MIRAS_CLIMB, MIRAS_DROP, SIX_HOURS));
	}

	/**
	 * AND THE TIME, ON A RACE OF A LENGTH, WHERE IT IS THE ONE FIGURE LEFT TO THE RUNNER.
	 *
	 * <p>The three the race fixes are sent here and the time is not, so the form is complete in
	 * every figure the race answers for and empty in the one it does not.
	 */
	@Test
	void anAmendmentWithoutTheTimeOnARaceOfALengthIsAFormNotFilledIn() throws Exception {
		MockHttpServletResponse refused = decideWith(THE_SUPERADMIN, anasMarathon,
				"{\"approved\":true,\"amended\":{\"distanceKm\":42.195,\"ascentM\":300,"
						+ "\"descentM\":300}}");

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(reasonIn(refused)).isEqualTo("Forma nije popunjena.");

		assertThat(stateOf(anasMarathon)).isEqualTo("waiting");
		assertThat(howManyResults(ANA)).isZero();
		assertThat(fourFiguresOf(submitted(anasMarathon)))
				.isEqualTo(fourFigures("42.1950", 300, 300, FOUR_HOURS));
	}

	/**
	 * FIGURES OF HIS OWN BESIDE A REFUSAL, OR ON AN ITEM THAT IS NOT A RUN, ARE REFUSED RATHER
	 * THAN QUIETLY DROPPED.
	 *
	 * <p>Either way the moderator would be told his answer was recorded while the numbers he
	 * typed went nowhere. A form fault and not a state, so 400, and nothing is decided: the run
	 * is not refused and the text is not published.
	 */
	@Test
	void figuresOfHisOwnBesideARefusalOrOnAnotherTabAreRefusedAndNothingIsDecided()
			throws Exception {
		MockHttpServletResponse besideARefusal = decideWith(THE_SUPERADMIN, bojansRun,
				"{\"approved\":false,\"reason\":\"" + THE_REASON + "\",\"amended\":"
						+ "{\"seconds\":3500}}");
		MockHttpServletResponse onAText = decideWith(THE_SUPERADMIN, anasText,
				"{\"approved\":true,\"amended\":{\"seconds\":3500}}");

		for (MockHttpServletResponse refused : List.of(besideARefusal, onAText)) {
			assertThat(refused.getStatus()).isEqualTo(400);
			assertThat(reasonIn(refused))
					.isEqualTo("Izmena vrednosti ide samo uz odobrenje rezultata.");
		}

		assertThat(stateOf(bojansRun)).as("the run was refused all the same").isEqualTo("waiting");
		assertThat(stateOf(anasText)).as("the text was published all the same").isEqualTo("waiting");
		assertThat(db.sql("select count(*) from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(BOJAN).query(Integer.class).single())
				.as("he was told his run was refused").isZero();
	}

	/**
	 * A RACE CORRECTED SINCE THE RUN WAS SENT IS COUNTED AS IT STANDS NOW, AND ITS CATEGORY
	 * FOLLOWS.
	 *
	 * <p>The record of 03.08.2026, in its wording: the distance, the climb and the drop are
	 * corrected on the race, „gde ispravka stiže svima koji su je istrčali, a ne na jednoj
	 * prijavi". A run still waiting is one of those, so the copy taken off the race on the day it
	 * was sent is not what it is counted at. Carrying that to the moment of approval is my
	 * reading of the record ({@code WhatARaceCarries.figuresOf}), not a sentence of the owner's.
	 *
	 * <p>The marathon is corrected to 42,2 with a climb unlike its drop, and every figure differs
	 * from the copy. 42,2 is a marathon and 42,195 is not (PDL P5), so the category is a value
	 * the copy and the race cannot share either.
	 */
	@Test
	void aRaceCorrectedSinceTheRunWasSentIsCountedAsItStandsNow() throws Exception {
		db.sql("update race set distance_km = 42.2, ascent_m = 320, descent_m = 280 where id = ?")
				.param(theMarathon).update();
		theFormulaTellsTheTwoOrdersApart("42.2", 320, 280, FOUR_HOURS);

		assertThat(answer(THE_SUPERADMIN, anasMarathon, true, null)).isEqualTo(200);

		Counted counted = counted(onlyResultOf(ANA)).orElseThrow();

		assertThat(fourFiguresOf(counted))
				.as("the run was counted at the copy taken when it was sent, not at the race")
				.isEqualTo(fourFigures("42.2", 320, 280, FOUR_HOURS));
		assertThat(counted.category()).isEqualTo("marathon");
		assertThat(fourFiguresOf(submitted(anasMarathon)))
				.isEqualTo(fourFigures("42.2", 320, 280, FOUR_HOURS));
	}

	/**
	 * A RUN ON A RACE MOVED INTO THE FUTURE IS NOT COUNTED, AND WAITS FOR THE DAY.
	 *
	 * <p>PDL P9, owner, 11.08.2026: „Ne sme, ne može biti rezultata u budućnosti." The member's
	 * route refuses such a run when it is sent; this one was sent on time and the race moved
	 * after it, which the calendar may do and V10's {@code on update cascade} carries the run
	 * along with. Asking it again at the approval is my reading of that decision.
	 *
	 * <p><b>The day of the race counts as run, and the day is Belgrade's.</b> The second answer
	 * is given half an hour after midnight on the race day in Belgrade, which is still the day
	 * before in UTC: a route that asked the machine's zone, or that refused the race's own day,
	 * refuses it there.
	 */
	@Test
	void aRunOnARaceMovedIntoTheFutureIsNotCountedAndWaits() throws Exception {
		LocalDate aWeekLater = LocalDate.of(2027, 3, 20);

		db.sql("update btl_event set date = ? where id = ?").params(aWeekLater, anotherEvent)
				.update();
		db.sql("update race set date = ? where id = ?").params(aWeekLater, theShortRace).update();

		MockHttpServletResponse refused = decide(THE_SUPERADMIN, bojansRun, true, null);

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(reasonIn(refused))
				.isEqualTo("Trka još nije održana, pa rezultat ne može da se odobri.");
		assertThat(stateOf(bojansRun)).isEqualTo("waiting");
		assertThat(howManyResults(BOJAN)).isZero();

		clock.moveTo(Instant.parse("2027-03-19T23:30:00Z"));

		assertThat(answer(THE_SUPERADMIN, bojansRun, true, null))
				.as("the race was run today in Belgrade and the run was refused as still to come")
				.isEqualTo(200);
		assertThat(howManyResults(BOJAN)).isEqualTo(1);
	}

	/**
	 * A MODERATOR WHO RACES APPROVES ANOTHER MEMBER'S RUN, AND THE RESULT IS THE RUNNER'S.
	 *
	 * <p>The deciding account names a member of its own, so a result written against the wrong
	 * one of the two is a real row in the standings rather than a statement falling over a null,
	 * which is all the superadmin, who has no member row, could show. The letter is asked along
	 * the same axis: it goes to the runner and not to the moderator.
	 */
	@Test
	void aModeratorWhoRacesApprovesAnotherMembersRunAndTheResultIsTheRunners() throws Exception {
		assertThat(answer(RESULTS_MODERATOR, anasMarathon, true, null)).isEqualTo(200);

		assertThat(howManyResults(ANA)).as("the member who ran").isEqualTo(1);
		assertThat(howManyResults(MIRA)).as("the member behind the account that decided").isZero();

		MimeMessage[] arrived = SMTP.getReceivedMessages();

		assertThat(arrived).as("nothing went out about an approved result").isNotEmpty();
		assertThat(arrived[0].getAllRecipients()[0].toString())
				.as("the letter went to whoever decided instead of whoever ran")
				.isEqualTo(A_COMPETITOR);
	}

	/**
	 * AND HER OWN RUN AS WELL.
	 *
	 * <p>PDL P9, the owner's choice of 09.10.2026 among the outcomes offered and against the
	 * recommendation that came with them, in the record's wording: „Moderator sme da odluči i o
	 * sopstvenoj prijavi rezultata, kao i do sada." Written as a case because the recommendation
	 * was the other way round, so a route that grew the refusal it recommended would otherwise
	 * stay green.
	 */
	@Test
	void aModeratorMayDecideHerOwnRun() throws Exception {
		assertThat(answer(RESULTS_MODERATOR, mirasRun, true, null)).isEqualTo(200);

		assertThat(howManyResults(MIRA)).isEqualTo(1);
	}

	/*
	 * SIX CASES STOOD HERE, FROM V30 UNTIL PDL P10a, 22.09.2026 (ADL A64 A2, A3): approving
	 * moved an event and its races together, by the same number of days and reading the
	 * event's day fresh rather than off the stale report; the calendar could move backwards;
	 * a refusal told the member why, like every queue but comments; and an approval that
	 * would carry a written result across 1 January was refused, by the identical question
	 * {@code EventWriteApiTest} and {@code RaceWriteApiTest} ask (PDL P10b) and not by a
	 * copy of it. The owner's decision the same day (PDL P10a), which the journal words as five
	 * queues and not six. What P10b guards is unmoved - the journal's reason is that it was never
	 * about the schedule proposal and would be reachable if no proposal had ever existed - and
	 * stays covered from the administrator's
	 * own screen, where it was reachable all along.
	 */

	/**
	 * THE FLOOR UNDER THE LIST OF TABS THIS ROUTE CARRIES OUT.
	 *
	 * <p>It asks the DATABASE for every queue there is rather than repeating a list, so a
	 * sixth tab - or a fifth that grows a consequence - fails here until somebody decides
	 * what answering it means. ONE of the five is refused today, {@code payments}, and it is
	 * refused because nothing lets a member reach that tab at all. {@code results} was the
	 * second until ADL A36's boundary was settled (the owner's choice of 21.09.2026: the result
	 * and the rankings inside the transaction, the ducats and the post after it) and V47 closed V25's debt
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

	/**
	 * A DECISION CARRYING FIGURES OF THE MODERATOR'S OWN, written out whole as JSON so that what
	 * is left OUT of it is exactly what the case leaves out - which is half of what the cases
	 * about it measure.
	 */
	private MockHttpServletResponse decideWith(String email, long id, String body) throws Exception {
		return http.perform(asking(email, post(decision(id)))
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andReturn().getResponse();
	}

	/**
	 * A DECISION ABOUT A PICTURE, written out whole so that what it names is exactly what the case
	 * names: {@code seen} is the key of the picture the moderator looked at, and left out when it
	 * is {@code null}; the circle is Vera's ({@link #verasCircle}) beside any key. Neither is EVER
	 * read off the row here, which is what every case about the picture he saw depends on: a helper
	 * that looked them up at the moment of the press would be the very route this case is written
	 * against.
	 */
	private MockHttpServletResponse decideSeeing(String email, long id, boolean approved,
			String reason, Long seen) throws Exception {

		return decideSeeing(email, id, approved, reason, seen, seen == null ? null : verasCircle);
	}

	/** The same with the circle named by the case, as the JSON object a screen sends, or left out
	 *  when it is {@code null}. */
	private MockHttpServletResponse decideSeeing(String email, long id, boolean approved,
			String reason, Long seen, String circle) throws Exception {

		String body = "{\"approved\":" + approved
				+ (reason == null ? "" : ",\"reason\":\"" + reason + "\"")
				+ (seen == null ? "" : ",\"seenPhotoId\":" + seen)
				+ (circle == null ? "" : ",\"seenCrop\":" + circle) + "}";

		return decideWith(email, id, body);
	}

	private int answerSeeing(String email, long id, boolean approved, String reason, Long seen)
			throws Exception {

		return decideSeeing(email, id, approved, reason, seen).getStatus();
	}

	/**
	 * WHAT A MEMBER'S SECOND SEND DOES TO THE ROW THAT WAITS (`MePhotoApi.send`, PDL 27.09.2026):
	 * the pointer moves to a new picture and the row keeps its key, so a moderator who has the row
	 * open is holding a row that now names another picture. The old picture is not deleted here:
	 * the database does that at the end of a transaction (V54) and these cases never commit.
	 *
	 * @return the key of the picture the row holds now
	 */
	private long theMemberSendsAnother(long item) {
		long other = photograph();

		db.sql("update verification set photo_id = ? where id = ?").params(other, item).update();

		return other;
	}

	/** The same, with the bytes the row already held: a new picture with the old one's digest. */
	private long theSameFileSentAgain(long item) {
		long again = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) select media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter from photo where id ="
						+ " (select photo_id from verification where id = ?) returning id")
				.param(item).query(Long.class).single();

		db.sql("update verification set photo_id = ? where id = ?").params(again, item).update();

		return again;
	}

	/**
	 * EVERYTHING A DECISION WRITES, AND NONE OF IT IS THERE: the row still waits, still holds the
	 * picture it held, carries no trace of an answer, nothing was published on Vera's profile, and
	 * nothing was written to her. Asked of every column on purpose, because a refusal that had
	 * already claimed the row would answer the same status.
	 *
	 * @param holding the key of the picture the row should be holding now
	 */
	private void nothingWasDecided(long item, long holding) {
		assertThat(stateOf(item)).as("the row was decided although the decision was refused")
				.isEqualTo("waiting");
		assertThat(db.sql("select photo_id from verification where id = ?").param(item)
				.query(Long.class).single())
				.as("the row does not hold the picture it held before the refused decision")
				.isEqualTo(holding);
		assertThat(db.sql("select count(*) from verification where id = ? and decided_at is null"
						+ " and decided_by is null and decided_by_name is null and reason is null")
				.param(item).query(Integer.class).single())
				.as("a column of the decision was written although it was refused")
				.isEqualTo(1);
		assertThat(db.sql("select photo_id from competitor where member_number = ?")
				.param(VERA).query(Long.class).optional())
				.as("a picture was published on Vera's profile although the decision was refused")
				.isEmpty();
		assertThat(db.sql("select count(*) from message where to_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(VERA).query(Integer.class).single())
				.as("Vera was written to although the decision was refused")
				.isZero();
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

	/**
	 * A picture of its own digest AND OF ITS OWN CIRCLE. The circle differs from every other
	 * picture's, because a decision names a circle and a comparison that read the circle of another
	 * picture, or of the member's portrait, would otherwise find the same three numbers and agree.
	 */
	private long photograph() {
		int n = ++issued;
		int step = n % 50;

		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, ?, ?, ?) returning id")
				.params(String.format("%064x", n), BigDecimal.valueOf(10 + step, 2),
						BigDecimal.valueOf(90 - step, 2), BigDecimal.valueOf(30 + step, 2))
				.query(Long.class).single();
	}

	/** The circle of a picture as a screen would send it back: the number it read, without the
	 *  zeros the column pads it with. */
	private String circleOf(long photo) {
		return db.sql("select crop_x, crop_y, crop_diameter from photo where id = ?").param(photo)
				.query((row, number) -> "{\"x\":" + plain(row.getBigDecimal(1)) + ",\"y\":"
						+ plain(row.getBigDecimal(2)) + ",\"size\":" + plain(row.getBigDecimal(3)) + "}")
				.single();
	}

	private static String plain(BigDecimal fraction) {
		return fraction.stripTrailingZeros().toPlainString();
	}

	/** What the column holds, padded as the column pads it: for asking what stands after a refusal. */
	private String circleOn(long photo) {
		return db.sql("select crop_x || '/' || crop_y || '/' || crop_diameter from photo where id = ?")
				.param(photo).query(String.class).single();
	}

	/** WHAT A MEMBER'S SEND WITH NO FILE DOES (`MePhotoApi.send`): the circle moves on the row of the
	 *  picture that is there, and the pointer and the key stay where they were. */
	private void theMemberMovesTheCircle(long photo, String x, String y, String size) {
		db.sql("update photo set crop_x = ?, crop_y = ?, crop_diameter = ? where id = ?")
				.params(new BigDecimal(x), new BigDecimal(y), new BigDecimal(size), photo).update();
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

	/**
	 * A RACE TO A LIMIT: it fixes the time and nothing else, so its distance is nought by
	 * {@code race_only_a_length_race_fixes_a_distance} and its own climb and fall are nought
	 * because nothing reads them - what a runner covers on it is his own (V7).
	 */
	private long timedRace(long event, String name, LocalDate day, int limitSeconds) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, ?, 'time', ?, 0, 0, 0) returning id")
				.params(event, name, day, limitSeconds)
				.query(Long.class).single();
	}

	/**
	 * FOUR FIGURES AS ONE VALUE, so a case compares them whole and a failure names all four.
	 *
	 * <p>The distance is compared by its value and not by its digits: the column keeps four
	 * decimals whatever was typed, so {@code 42.2} and {@code 42.2000} are one distance here, as
	 * they are to the category the schema works out of it.
	 */
	private static String fourFigures(String km, int climb, int drop, int seconds) {
		return new BigDecimal(km).stripTrailingZeros().toPlainString() + " km, up " + climb
				+ " m, down " + drop + " m, " + seconds + " s";
	}

	private static String fourFiguresOf(Counted row) {
		return fourFigures(row.distanceKm().toPlainString(), row.ascentM(), row.descentM(),
				row.seconds());
	}

	/** What a decided or waiting submission holds now, in the four figures an approval writes
	 *  back into it. */
	private Counted submitted(long item) {
		return db.sql("select rs.distance_km, rs.ascent_m, rs.descent_m, rs.seconds"
						+ " from result_submission rs join verification v"
						+ " on v.result_submission_id = rs.id where v.id = ?")
				.param(item)
				.query((row, one) -> new Counted(row.getBigDecimal(1), row.getInt(2), row.getInt(3),
						row.getInt(4), null, null))
				.single();
	}

	/**
	 * EVERY SUBMISSION BUT THE ONE BEHIND {@code item}: whose it is, which row it is and the four
	 * figures it carries now, in the order of the table's own key.
	 *
	 * <p>Read off the table and not off the fixture's fields, so a row the fixture gains later is
	 * in it without anybody adding it to a list. The decided row is the one left out, because what
	 * an answer does to it is what the cases that read it through {@link #submitted} are for.
	 */
	private List<Sent> everySubmissionBut(long item) {
		return db.sql("select c.member_number, rs.id, rs.distance_km, rs.ascent_m, rs.descent_m,"
						+ " rs.seconds from result_submission rs"
						+ " join competitor c on c.id = rs.competitor_id"
						+ " where rs.id <> (select v.result_submission_id from verification v"
						+ " where v.id = ?) order by rs.id")
				.param(item)
				.query((row, one) -> new Sent(row.getString(1), row.getLong(2),
						fourFigures(row.getBigDecimal(3).toPlainString(), row.getInt(4),
								row.getInt(5), row.getInt(6))))
				.list();
	}

	/** One submission as another case sees it: whose it is, which row, and what it carries. */
	private record Sent(String member, long id, String figures) {
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
	 * way or the other, never both and never neither" - and which a plain approval does not
	 * count: the answer has to name the race (PDL, „Član sme da unese trku koje nema u
	 * kalendaru"). The cases about the two roads that do count it make their own, with
	 * {@link #describedRun}.
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
	 * A RUN ON A RACE THE CALENDAR DOES NOT HOLD, described the way {@code ResultWriteApi}
	 * writes one: the name the member typed, the kind he hinted, the day he ran, his six measures
	 * and the town he named.
	 *
	 * <p><b>The town is never the one his profile names</b> ({@link #member} puts every member at
	 * the town of rank 1, and {@link #event} every event of the fixture there too), so an event
	 * made in a member's town, or in some town an event of the fixture happens to stand in, is a
	 * different row from the one the member named. It is a town of the codebook by its rank, or,
	 * with {@code rank} left empty, one typed with its country.
	 */
	private long describedRun(String memberNumber, String typedName, String hintedKind,
			LocalDate day, Integer rank, String typedCity, String countryCode, String km, int climb,
			int drop, int seconds) {
		long submission = db.sql("insert into result_submission (competitor_id, race_id,"
						+ " race_date, race_name, race_kind, place_id, city, country_id, distance_km,"
						+ " ascent_m, descent_m, seconds, link, comment)"
						+ " values ((select id from competitor where member_number = ?), null, ?, ?, ?,"
						+ " (select id from place where rank = ?), ?,"
						+ " (select id from country where code = ?), cast(? as numeric), ?, ?, ?,"
						+ " 'https://primer.rs/rezultati/van-kalendara', '') returning id")
				.params(memberNumber, day, typedName, hintedKind, rank, typedCity, countryCode, km,
						climb, drop, seconds)
				.query(Long.class).single();

		return queued(memberNumber, submission);
	}

	/** The same run, at the town of the codebook the cases about a new race name. */
	private long describedRun(String memberNumber, String typedName, String hintedKind,
			LocalDate day, String km, int climb, int drop, int seconds) {
		return describedRun(memberNumber, typedName, hintedKind, day, THE_TOWN_HE_NAMED, null, null,
				km, climb, drop, seconds);
	}

	/** An answer that makes the event and the race, as JSON, with or without figures of the
	 *  moderator's own after it. */
	private static String makingTheRace(String eventName, String raceName, String kind,
			String amended) {
		return "{\"approved\":true,\"newRace\":{\"eventName\":\"" + eventName + "\",\"raceName\":\""
				+ raceName + "\",\"raceKind\":\"" + kind + "\"}"
				+ (amended == null ? "" : ",\"amended\":" + amended) + "}";
	}

	/** An answer that counts the run on a race of the calendar, as JSON. */
	private static String onTheRace(long race, String amended) {
		return "{\"approved\":true,\"raceId\":" + race
				+ (amended == null ? "" : ",\"amended\":" + amended) + "}";
	}

	private int howManyEvents() {
		return db.sql("select count(*) from btl_event").query(Integer.class).single();
	}

	private int howManyRaces() {
		return db.sql("select count(*) from race").query(Integer.class).single();
	}

	private long placeOfRank(int rank) {
		return db.sql("select id from place where rank = ?").param(rank).query(Long.class).single();
	}

	private long countryCoded(String code) {
		return db.sql("select id from country where code = ?").param(code).query(Long.class)
				.single();
	}

	/** An event as the calendar holds it, found by its address and by nothing else. */
	private Optional<AnEvent> eventAt(String address) {
		return db.sql("select id, name, date, place_id, city, country_id, kind, featured,"
						+ " description, link from btl_event where slug = ?")
				.param(address)
				.query((row, one) -> new AnEvent(row.getLong(1), row.getString(2),
						row.getDate(3).toLocalDate(), row.getObject(4, Long.class), row.getString(5),
						row.getObject(6, Long.class), row.getString(7), row.getBoolean(8),
						row.getString(9), row.getString(10)))
				.optional();
	}

	/** The event at that address, and a failed assertion naming the address where there is
	 *  none: a case that reads an event the route did not make fails on that sentence. */
	private AnEvent theEventAt(String address) {
		return eventAt(address).orElseThrow(
				() -> new AssertionError("no event answers at " + address));
	}

	/** Every race under one event, in the order of their keys. */
	private List<ARace> racesOf(long event) {
		return db.sql("select id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
						+ " descent_m from race where event_id = ? order by id")
				.param(event)
				.query((row, one) -> new ARace(row.getLong(1), row.getString(2), row.getBoolean(3),
						row.getDate(4).toLocalDate(), row.getString(5), row.getInt(6),
						fourFigures(row.getBigDecimal(7).toPlainString(), row.getInt(8), row.getInt(9),
								row.getInt(6))))
				.list();
	}

	/** The race a member's one result is counted on, the day it carries, its four figures and
	 *  its points. */
	private AResult theResultOf(String memberNumber) {
		List<AResult> his = db.sql("select race_id, race_date, distance_km, ascent_m, descent_m, seconds, points"
						+ " from result where competitor_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(memberNumber)
				.query((row, one) -> new AResult(row.getLong(1), row.getDate(2).toLocalDate(),
						fourFigures(row.getBigDecimal(3).toPlainString(), row.getInt(4),
								row.getInt(5), row.getInt(6)),
						row.getBigDecimal(7)))
				.list();

		assertThat(his).as("%s has no result, or more than one", memberNumber).hasSize(1);

		return his.get(0);
	}

	/** The one race under an event, and a failed assertion where there is none or more. */
	private ARace theOneRaceOf(long event) {
		List<ARace> under = racesOf(event);

		assertThat(under).as("the event holds no race, or more than one").hasSize(1);

		return under.get(0);
	}

	/** Everything a submission says about its race, as it stands now: the race it points at and
	 *  that race's day, or the five columns that describe one instead, and its four figures. */
	private Described whatTheSubmissionSays(long item) {
		return db.sql("select rs.race_id, rs.race_date, rs.race_name, rs.race_kind, rs.place_id,"
						+ " rs.city, rs.country_id, rs.distance_km, rs.ascent_m, rs.descent_m,"
						+ " rs.seconds from result_submission rs join verification v"
						+ " on v.result_submission_id = rs.id where v.id = ?")
				.param(item)
				.query((row, one) -> new Described(row.getObject(1, Long.class),
						row.getDate(2).toLocalDate(), row.getString(3), row.getString(4),
						row.getObject(5, Long.class), row.getString(6), row.getObject(7, Long.class),
						fourFigures(row.getBigDecimal(8).toPlainString(), row.getInt(9),
								row.getInt(10), row.getInt(11))))
				.single();
	}

	private record AnEvent(long id, String name, LocalDate date, Long placeId, String city,
			Long countryId, String kind, boolean featured, String description, String link) {
	}

	/** One race, with what it fixes in the shape {@link #fourFigures} writes: its limit stands
	 *  where a run's time would. */
	private record ARace(long id, String name, boolean renamed, LocalDate date, String kind,
			int limitSeconds, String fixes) {
	}

	private record AResult(long raceId, LocalDate raceDate, String figures, BigDecimal points) {
	}

	private record Described(Long raceId, LocalDate raceDate, String raceName, String raceKind,
			Long placeId, String city, Long countryId, String figures) {
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

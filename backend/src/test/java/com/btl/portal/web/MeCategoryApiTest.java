package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * GET /api/me/category: WHAT A MEMBER HAS ASKED FOR, WHAT HE IS ENTITLED TO, AND WHAT THE TWO
 * MAKE TOGETHER.
 *
 * <p><b>THE CLOCK IS 15 OCTOBER 2028 AND THAT DATE IS THE FIXTURE.</b> It is the only kind of
 * moment at which every axis this resource has is in a measurable state at once:
 *
 * <ul>
 * <li>the renewal window is open, so {@link SeasonClock#seasonBeingPaidFor} names <b>2029</b>
 *     and not the running year - a version reading {@code seasonBeingRun} or the plain
 *     calendar answers 2028 and every case below sees it;
 * <li>the deadline for 2029 is 1 January 2029 at 10:00, which has not passed, so
 *     {@code open} is true and the cases that need it false move the clock themselves;
 * <li>and there are <b>two</b> official seasons behind it, 2027 and 2028, plus a year before
 *     the league that must be ignored. A fixture inside 2027 cannot tell „the best single
 *     season" from „the only season there is", which is the fault this rule was written
 *     against.
 * </ul>
 *
 * <p><b>FIVE MEMBERS, AND THE ONE UNDER TEST IS NEVER THE FIRST BY KEY NOR THE ONLY ONE OF HIS
 * KIND.</b> Each is here against a specific way a wrong answer would look right:
 *
 * <ul>
 * <li><b>{@link #FIRST_BY_KEY} is inserted first and WANTS the beginners' category</b>, while
 *     the member under test does not. A query that answered „the first row", or resolved the
 *     member any way other than off the session, answers {@code true} where the truth is
 *     {@code false}.
 * <li><b>{@link #HE_ASKS} has points in three years and his best single season is under the
 *     threshold while his TOTAL is over it.</b> 50 points in 2026, 7 in 2027 and 7 in 2028: a
 *     query sunming across seasons answers 64 and shuts the category, a query that forgot the
 *     league begins in 2027 answers 50 and shuts it, and only „the best single OFFICIAL
 *     season" answers 7 and leaves it open. Both of those wrong answers really happened - the
 *     summing one closed the category to thirty of thirty two members on 15.08.2026.
 * <li><b>{@link #JUST_UNDER} and {@link #OVER_THE_LINE} sit either side of the threshold by a
 *     hundredth</b>, 11.99 and 12.00, so the comparison is measured at the boundary and in
 *     both directions rather than with a comfortable gap.
 * <li><b>{@link #OVER_THE_LINE} also WANTS what he may not have</b>, which is the state the
 *     owner's decision of 26.09.2026 creates on purpose: his wish stays as he left it and his
 *     category is his age band. A resource that stored the category instead of the wish cannot
 *     produce this row at all.
 * <li><b>{@link #FREED_OF_THE_FEE} pays nothing, ever</b> (Pravilnik član 15), and is answered
 *     exactly as everybody else. Twenty nine of the thirty two members in the shipped data are
 *     freed of the fee, and the draft box this route replaces was drawn only for members who
 *     are not - so this is the case that would have been the whole portal.
 * </ul>
 *
 * <p>Genders and years of birth differ so that the derived codes differ: a case comparing one
 * member's category against another's cannot pass by accident.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MeCategoryApiTest {

	private static final String PATH = "/api/me/category";

	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzz";

	/** Inside the renewal window, two official seasons deep. See the note on this class. */
	private static final Instant IN_OCTOBER_2028 = Instant.parse("2028-10-15T12:00:00Z");

	/** The season being chosen at that moment, spelt out so a case cannot drift with the code. */
	private static final int THE_SEASON_BEING_CHOSEN = 2029;

	/**
	 * THE FIRST MEMBER BY KEY, and he wants the opposite of what the member under test wants.
	 */
	private static final String FIRST_BY_KEY = "000041";

	/** The member every case below asks about. */
	private static final String HE_ASKS = "000042";

	/** 11.99 in one official season: still a beginner, by a hundredth. */
	private static final String JUST_UNDER = "000043";

	/** 12.00 in one official season: no longer a beginner, and he still wants to be. */
	private static final String OVER_THE_LINE = "000044";

	/** Pays nothing ever, and it makes no difference to anything here. */
	private static final String FREED_OF_THE_FEE = "000045";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private final ObjectMapper mapper = new ObjectMapper();

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/** The same shape {@code MembershipWriteApiTest} uses, and it reports UTC for the same reason. */
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
			return new AClockTheCaseMoves(IN_OCTOBER_2028);
		}
	}

	@BeforeEach
	void fiveMembersThreeSeasonsAndAModeratorWhoDoesNotRace() {
		clock.moveTo(IN_OCTOBER_2028);

		competitor(FIRST_BY_KEY, "Prva", "Po Kljucu", "F", "1990-01-01", true, "payment");
		competitor(HE_ASKS, "Drugi", "Pita", "M", "1985-01-01", false, "payment");
		competitor(JUST_UNDER, "Treca", "Za Dlaku", "F", "2005-01-01", true, "payment");
		competitor(OVER_THE_LINE, "Cetvrti", "Presao", "M", "1970-01-01", true, "payment");
		competitor(FREED_OF_THE_FEE, "Peta", "Ne Placa", "F", "1995-01-01", false, "feeExempt");

		account(FIRST_BY_KEY + "@primer.rs", "competitor", FIRST_BY_KEY);
		account(HE_ASKS + "@primer.rs", "competitor", HE_ASKS);
		account(JUST_UNDER + "@primer.rs", "competitor", JUST_UNDER);
		account(OVER_THE_LINE + "@primer.rs", "competitor", OVER_THE_LINE);
		account(FREED_OF_THE_FEE + "@primer.rs", "competitor", FREED_OF_THE_FEE);
		account(MODERATOR_WHO_DOES_NOT_RACE, "moderator", null);

		/* THREE YEARS, AND ONE OF THEM IS NOT A SEASON. A race in 2026 is what the portal
		   calls imported history, and PDL P7 (owner, 11.08.2026) says it counts for nobody:
		   „gledaju se samo zvanicne BTL sezone... tako da u prvoj sezoni u teoriji svi mogu
		   da odu u Prvu Sezonu." The schema allows the row - the >= 2027 checks are on tables
		   with a season COLUMN and a race has only a date - so only the query refuses it. */
		aRaceThatHappened("pre-lige", "Trka pre lige", "2026-05-10");
		aRaceThatHappened("prva-sezona", "Trka prve sezone", "2027-05-10");
		aRaceThatHappened("druga-sezona", "Trka druge sezone", "2028-05-10");

		aRunBy(HE_ASKS, "Trka pre lige", "2026-05-10", "50.00");
		aRunBy(HE_ASKS, "Trka prve sezone", "2027-05-10", "7.00");
		aRunBy(HE_ASKS, "Trka druge sezone", "2028-05-10", "7.00");

		aRunBy(JUST_UNDER, "Trka prve sezone", "2027-05-10", "11.99");
		aRunBy(OVER_THE_LINE, "Trka prve sezone", "2027-05-10", "12.00");
	}

	/**
	 * A VISITOR IS REFUSED BY THE CHAIN, AND A MEMBER IS NOT.
	 *
	 * <p>Already measured for every mapped {@code GET} by {@code ApiSecurityTest}; kept here
	 * beside the half that proves a real member is served 200, so the refusal is not read as a
	 * refusal of everybody.
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsRefusedAndAMemberIsNot() throws Exception {
		assertThat(http.perform(get(PATH)).andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(asked(HE_ASKS).getStatus()).isEqualTo(200);
	}

	/**
	 * AN ACCOUNT WITH NO MEMBER BEHIND IT IS ANSWERED EXACTLY AS AN ADDRESS THAT IS NOT THERE.
	 *
	 * <p>Both halves are asserted and not one: that the unmapped address really answers 404, so
	 * the equality is not two 200s agreeing, and that the two carry the same status and the same
	 * body. A refusal that differed by so much as a body would tell a moderator who does not
	 * race that a category lives at an address the portal never offered him (ADL A8, owner
	 * 13.09.2026: the numbers are 401 and 404, never 403).
	 */
	@Test
	void aModeratorWhoDoesNotRaceIsToldNothingIsHere() throws Exception {
		MockHttpServletResponse refused = askedBy(MODERATOR_WHO_DOES_NOT_RACE, PATH);
		MockHttpServletResponse nowhere = askedBy(MODERATOR_WHO_DOES_NOT_RACE, NOTHING_IS_THERE);

		assertThat(nowhere.getStatus())
				.as("an address nothing maps stopped answering 404, so the comparison below "
						+ "compares two answers that are both fine")
				.isEqualTo(404);

		assertThat(refused.getStatus()).isEqualTo(nowhere.getStatus());
		assertThat(refused.getContentAsString()).isEqualTo(nowhere.getContentAsString());
	}

	/**
	 * THE SEASON IS THE ONE ON SALE, WHICH IN OCTOBER IS NOT THE ONE BEING RUN.
	 *
	 * <p>This is the case that tells {@link SeasonClock#seasonBeingPaidFor} from the two methods
	 * it is most easily confused with. At this moment the year is 2028, the season being run is
	 * 2028, and the answer must be 2029 - so a version spelling {@code getYear()},
	 * {@code seasonBeingRun} or a plain calendar read answers 2028 and fails here.
	 * {@code transfersTakeEffect} happens to agree in October and is told apart by
	 * {@link #outsideTheWindowTheSeasonBeingChosenIsTheOneBeingRunAndItsDeadlineHasGone}.
	 */
	@Test
	void theSeasonBeingChosenIsTheOneOnSaleAndNotTheOneBeingRun() throws Exception {
		assertThat(answerFor(HE_ASKS).path("season").asInt()).isEqualTo(THE_SEASON_BEING_CHOSEN);

		assertThat(THE_SEASON_BEING_CHOSEN)
				.as("the fixture no longer stands in a year where the season on sale and the "
						+ "season being run differ, so this case cannot tell them apart")
				.isNotEqualTo(SeasonClock.seasonBeingRun(IN_OCTOBER_2028.atZone(SeasonClock.ZONE)));
	}

	/**
	 * THE BEST SINGLE OFFICIAL SEASON, WHICH IS NEITHER A TOTAL NOR ALL OF HISTORY.
	 *
	 * <p>{@link #HE_ASKS} has 50 points before the league, 7 in 2027 and 7 in 2028. Three
	 * answers are possible and two of them are faults this portal has really had: 64 (summed
	 * across seasons, which shut the category to thirty of thirty two members on 15.08.2026),
	 * 50 (counting the imported history, the same fault by another road) and 7. Only the third
	 * leaves the beginners' category open, so one boolean tells all three apart.
	 */
	@Test
	void theRightIsReadOffTheBestSingleOfficialSeasonAndNotOffASumNorOffHistory() throws Exception {
		assertThat(answerFor(HE_ASKS).path("firstSeasonAllowed")
				.asBoolean())
				.as("his 7 points in a season were read as 64 across seasons, or as the 50 he "
						+ "took before the league existed")
				.isTrue();
	}

	/**
	 * THE THRESHOLD IS MEASURED AT THE HUNDREDTH, IN BOTH DIRECTIONS.
	 *
	 * <p>11.99 and 12.00 are one hundredth apart and on opposite sides of the answer, which is
	 * what makes {@code < 12} measurable rather than merely true. {@code numeric(8,2)} is the
	 * scale the schema stores points at, so a hundredth is the smallest difference there is and
	 * this is the tightest the case can be.
	 */
	@Test
	void aHundredthUnderTheThresholdIsStillOpenAndTheThresholdItselfIsNot() throws Exception {
		assertThat(answerFor(JUST_UNDER).path("firstSeasonAllowed").asBoolean())
				.as("11.99 points shut the beginners' category, so the threshold is not 12")
				.isTrue();
		assertThat(answerFor(OVER_THE_LINE).path("firstSeasonAllowed").asBoolean())
				.as("12.00 points left it open, and PDL P7 says twelve is the way out")
				.isFalse();
	}

	/**
	 * A WISH THE MEMBER NO LONGER HAS A RIGHT TO STAYS HIS WISH, AND HIS CATEGORY IS HIS AGE
	 * BAND.
	 *
	 * <p>This is the whole of the owner's decision of 26.09.2026 in one row - „racunaj da clan
	 * bira ono sto ZELI, ali ga superadmin / moderator verifikacijom necega moze gurnuti u
	 * starosnu kategoriju" - and a resource that stored the category rather than the wish could
	 * not produce it. All three fields are asserted, because two of them agreeing is exactly
	 * what a version that overwrote the wish would look like: {@code firstSeason} true,
	 * {@code firstSeasonAllowed} false, {@code category} his band.
	 *
	 * <p><b>And the comparison is against another member rather than against a literal alone.</b>
	 * {@link #JUST_UNDER} wants the same thing and may have it, so the pair differs in the right
	 * and in nothing else the route reads.
	 */
	@Test
	void theWishSurvivesLosingTheRightAndTheCategoryDoesNot() throws Exception {
		JsonNode overTheLine = answerFor(OVER_THE_LINE);

		assertThat(overTheLine.path("firstSeason").asBoolean())
				.as("his wish was rewritten by the portal, which is the one thing storing a wish "
						+ "instead of a category is meant to prevent")
				.isTrue();
		assertThat(overTheLine.path("firstSeasonAllowed").asBoolean()).isFalse();
		assertThat(overTheLine.path("category").asString())
				.as("he is 59 in 2029 and no longer a beginner, so he runs in 55+")
				.isEqualTo("M55+");

		JsonNode justUnder = answerFor(JUST_UNDER);

		assertThat(justUnder.path("firstSeason").asBoolean()).isTrue();
		assertThat(justUnder.path("category").asString())
				.as("she wants the beginners' category and may have it, so the pair above differs "
						+ "in the RIGHT and not in the wish")
				.isEqualTo("Ž R");
	}

	/**
	 * THE CATEGORY IS READ OFF THE ASKER AND NOT OFF THE FIRST ROW.
	 *
	 * <p>{@link #FIRST_BY_KEY} is inserted before anybody else and wants the beginners'
	 * category; {@link #HE_ASKS} does not. A route that resolved the member any way other than
	 * off the session lands on the first row and answers her wish and her band.
	 */
	@Test
	void eachMemberIsAnsweredHisOwnWishAndHisOwnBand() throws Exception {
		assertThat(answerFor(HE_ASKS).path("firstSeason").asBoolean()).isFalse();
		assertThat(answerFor(HE_ASKS).path("category").asString())
				.as("he is 44 in 2029 and wants his age band")
				.isEqualTo("M40-54");

		assertThat(answerFor(FIRST_BY_KEY).path("firstSeason").asBoolean()).isTrue();
		assertThat(answerFor(FIRST_BY_KEY).path("category").asString()).isEqualTo("Ž R");
	}

	/**
	 * A MEMBER FREED OF THE FEE IS ANSWERED EXACTLY AS ONE WHO PAYS.
	 *
	 * <p>Owner, 26.09.2026: „Clan je nov, uplatio je clanarinu (ili nije), ali moze da bira u
	 * koju ce kategoriju." The draft box this route replaces was drawn only for a member who is
	 * NOT freed of the fee, and twenty nine of the thirty two members in the shipped data are
	 * freed of it, so a route that asked about money would be wrong for very nearly everybody.
	 * Nothing in this class's production code reads {@code membership_basis}, and this is the
	 * case that would fail if it started to.
	 */
	@Test
	void payingNothingEverMakesNoDifferenceToTheChoice() throws Exception {
		JsonNode freed = answerFor(FREED_OF_THE_FEE);

		assertThat(freed.path("open").asBoolean()).isTrue();
		assertThat(freed.path("firstSeasonAllowed").asBoolean()).isTrue();
		assertThat(freed.path("season").asInt()).isEqualTo(THE_SEASON_BEING_CHOSEN);
		assertThat(freed.path("category").asString()).isEqualTo("Ž25-39");
	}

	/**
	 * THE CHOICE IS OPEN UNTIL TEN ON THE FIRST MORNING OF ITS SEASON, AND SHUT FROM IT.
	 *
	 * <p>Three moments and not two, because the interesting one is in the middle: at 09:59 on 1
	 * January the renewal window has ALREADY SHUT by the calendar - it runs to 31 December - and
	 * the member may still choose. That is the ten hours the draft screen lost by drawing the
	 * box under {@code inYearlyWindow}, and it is why this answer is the server's.
	 *
	 * <p>The last moment is two hours later, inside the six hours that belong to the moderator,
	 * where the choice is shut and the season that ended has not yet frozen.
	 */
	@Test
	void theChoiceIsOpenThroughTheLastHoursOfTheWindowAndShutsAtTen() throws Exception {
		assertThat(answerFor(HE_ASKS).path("open").asBoolean())
				.as("October is inside the window and the choice was shut")
				.isTrue();

		clock.moveTo(Instant.parse("2029-01-01T08:59:00Z"));
		assertThat(answerFor(HE_ASKS).path("open").asBoolean())
				.as("09:59 in Belgrade on 1 January is a minute before the deadline and the "
						+ "choice was already shut, which is the ten hours the calendar loses")
				.isTrue();

		clock.moveTo(Instant.parse("2029-01-01T09:00:00Z"));
		assertThat(answerFor(HE_ASKS).path("open").asBoolean())
				.as("ten o'clock itself is still open, so the deadline never arrives")
				.isFalse();

		clock.moveTo(Instant.parse("2029-01-01T11:00:00Z"));
		assertThat(answerFor(HE_ASKS).path("open").asBoolean()).isFalse();
	}

	/**
	 * OUTSIDE THE WINDOW THE SEASON BEING CHOSEN IS THE ONE BEING RUN, AND ITS DEADLINE IS GONE.
	 *
	 * <p>In June the member is not choosing anything: what is on sale is the season he is
	 * already running, and its deadline passed on 1 January. So the pair of answers is 2028 and
	 * {@code open: false} - and this is the case that tells {@code seasonBeingPaidFor} from
	 * {@code transfersTakeEffect}, which answers 2029 on this day too and would leave the choice
	 * open for six more months.
	 */
	@Test
	void outsideTheWindowTheSeasonBeingChosenIsTheOneBeingRunAndItsDeadlineHasGone()
			throws Exception {

		clock.moveTo(Instant.parse("2028-06-15T12:00:00Z"));

		JsonNode inJune = answerFor(HE_ASKS);

		assertThat(inJune.path("season").asInt())
				.as("in June what is on sale is the running season, and transfersTakeEffect "
						+ "would have said 2029")
				.isEqualTo(2028);
		assertThat(inJune.path("open").asBoolean())
				.as("the deadline for 2028 passed on 1 January 2028 and the member was still "
						+ "being offered the choice in June")
				.isFalse();
	}

	/**
	 * A MEMBER WITH NO RESULTS AT ALL IS A BEGINNER, WHICH IS EVERYBODY TODAY.
	 *
	 * <p>Owner, 11.08.2026: „Ko nema nijednu raniju sezonu, uvek sme." The query behind it takes
	 * a maximum over no rows, which in SQL is null, and a null read as a number would be either
	 * a server fault or a zero nobody chose. This is the case that holds the {@code coalesce}.
	 */
	@Test
	void aMemberWhoHasNeverRacedIsStillABeginner() throws Exception {
		assertThat(answerFor(FIRST_BY_KEY).path("firstSeasonAllowed").asBoolean()).isTrue();
		assertThat(answerFor(FREED_OF_THE_FEE).path("firstSeasonAllowed").asBoolean()).isTrue();
	}

	/**
	 * THE COLUMN THE WISH IS STORED IN NAMES ONE SEASON, AND THE DEBT BECOMES LIVE IN OCTOBER
	 * 2027.
	 *
	 * <p>This case measures nothing about behaviour and is here to put a date in the suite
	 * rather than only in a document. {@code competitor.first_season_2027} can hold the wish for
	 * one season, and the owner chose on 27.09.2026 to keep it and record the debt („da zapises
	 * kao tehnicki dug da se ne zaboravi i resi strukturalno nekad sto pre") after being shown
	 * that moving it touches 172 places in 95 files.
	 *
	 * <p><b>What is asserted is the instant the two part company</b>, against a fixed moment and
	 * never against the machine's clock: from 1 October 2027 the season being chosen is 2028 and
	 * the column is still named for 2027, so from then a wish written for one season overwrites
	 * the other. The fixture above already stands past that date, which is why the route it
	 * tests is honest about what it does and not about what the column is called.
	 */
	@Test
	void theColumnAndTheSeasonAgreeOnlyWhileTheSeasonIsTheFirstOne() {
		Instant beforeTheDebtIsLive = Instant.parse("2027-09-30T21:00:00Z");
		Instant afterTheDebtIsLive = Instant.parse("2027-09-30T23:00:00Z");

		assertThat(SeasonClock.seasonBeingPaidFor(beforeTheDebtIsLive.atZone(SeasonClock.ZONE)))
				.as("the column and the season agreed until 1 October 2027 and no longer do, "
						+ "so the debt this case names has moved")
				.isEqualTo(SeasonClock.FIRST_SEASON);

		assertThat(SeasonClock.seasonBeingPaidFor(afterTheDebtIsLive.atZone(SeasonClock.ZONE)))
				.as("from midnight in Belgrade on 1 October 2027 the wish is for a season the "
						+ "column cannot name, and PENDING.md carries what that costs")
				.isEqualTo(SeasonClock.FIRST_SEASON + 1);
	}

	/* ------------------------------------------------------------------- the fixture */

	private void competitor(String number, String first, String last, String gender,
			String birthDate, boolean firstSeason, String basis) {

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, cast(? as date),"
						+ " (select id from place where rank = 1), 2027, ?, true, ?,"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, birthDate, firstSeason, basis,
						String.format("%016x", ++issued))
				.update();
	}

	private void account(String email, String role, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		if (memberNumber != null) {
			db.sql("update account set competitor_id ="
							+ " (select id from competitor where member_number = ?) where email = ?")
					.params(memberNumber, email).update();
		}

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** One race a member can have run, with an event over it, since a result needs both. */
	private void aRaceThatHappened(String eventSlug, String raceName, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, cast(? as date), (select id from place where rank = 1),"
						+ " null, null, 'race', false, '', '')")
				.params(eventSlug, "Trka " + eventSlug, day).update();

		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " cast(? as date), 'length', 0, 10.00, 0, 0)")
				.params(eventSlug, raceName, day).update();
	}

	private void aRunBy(String memberNumber, String raceName, String day, String points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from race where name = ?), cast(? as date), 10.00, 0, 0,"
						+ " 3600, cast(? as numeric))")
				.params(memberNumber, raceName, day, points).update();
	}

	/* -------------------------------------------------------------------- the answers */

	private JsonNode answerFor(String memberNumber) throws Exception {
		return mapper.readTree(asked(memberNumber).getContentAsString());
	}

	private MockHttpServletResponse asked(String memberNumber) throws Exception {
		return askedBy(memberNumber + "@primer.rs", PATH);
	}

	private MockHttpServletResponse askedBy(String email, String path) throws Exception {
		return http.perform(get(path)
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}
}

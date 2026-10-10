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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * A TEAM NAMES THE MEMBERS WHO LEFT IT, FOR THE SEASONS THEY WERE IN IT, ONLY UNTIL THE LAST OF THEM
 * FREEZES, AND IT IS THE SAME ANSWER FOR EVERY READER.
 *
 * <p><b>What was measured before this field existed (10.10.2026).</b>
 * {@code TeamWriteApi.leave} ends a membership that has begun with {@code season_to} set to the
 * season being run, and the three places that answer „which team is he in" all ask for the
 * membership that has NOT ended ({@code CompetitorApi}, {@code MeApi} and {@code TeamApi}'s
 * {@code alsoIn}). So from the moment a member pressed „Izađi iz tima" inside the window, no door of
 * the server named him on that team for the season he was still in it. A probe with five members
 * of one team, three of whom left in October 2027, found the leavers' records answering
 * {@code teamId} null and the team's {@code alsoInTheTeam} naming none of them, to a visitor and to
 * an active member alike; the portal works the standing out of those two answers
 * ({@code data/derive.ts}, {@code rankTeams}), so the team's table for 2027 lost them.
 *
 * <p><b>What this holds.</b> {@code endedMemberships} names every membership of the team that has
 * ended and whose last season has not frozen, of a member whose fee is standing, with the season it
 * began in and the last season he is in it (both inclusive, as V11 writes {@code season_to}). A
 * season freezes on 1 January at 16:00 of the year after it. The answer is the same for every reader,
 * it carries those three values and nothing else, and it never names a membership that has not ended:
 * those stay on the two doors they were on, the member's record and {@code alsoInTheTeam}.
 *
 * <p><b>The decisions it carries out, and whose words are whose.</b> PDL, [ODLUKA 29.09.2026,
 * vlasnik]: „Promena stupa na snagu 1. januara naredne sezone, i to samo ako je članstvo aktivno za
 * tu sezonu." The reason put to the owner when he chose to let members out only inside the window
 * (his choice of 24.09.2026, between offered outcomes; the reason is not his sentence) was that „tim
 * nosi bodove kroz sezonu, pa bi izlazak usred nje značio da tabela u januaru i tabela u junu govore
 * različito o istoj sezoni". PDL's own record of the decision of 25.09.2026 says „član po toj odluci
 * ostaje u timu do 31.12" (a record, not a quotation), and Član 56 of the rulebook as published
 * (V46) says the member's contribution to the team in that season stays, which V46's header names
 * as the agent's derivation, put to the owner before he chose. Read together: the team has him for
 * the season he leaves in and not from the next. THAT READING IS DERIVED. HOW FAR IT IS PUBLISHED ON
 * THIS RESOURCE IS DECIDED: PDL, [ODLUKA 10.10.2026, vlasnik, izabrao između ponuđenih, uz moju
 * preporuku], question 38, the outcome „Do zamrzavanja" (the wording is the journal's and not his
 * sentence): the list of a team carries a member who left only while „sezona njegovog članstva nije
 * zamrznuta (1. januar u 16:00)", because „dok sezona izlaska teče i dok njen zbir računa ekran, tim
 * ga broji i javno imenuje". The two outcomes he refused, with the cost put to him, were forever for
 * every season and forever for the season of the exit only. That narrows a second time the boundary
 * of 13.09.2026 that keeps who is in a team off it (the first narrowing is the hidden member's), and
 * only as far as that sentence goes.
 *
 * <p><b>What it does NOT decide.</b> Which of the two teams a member's own page draws in October, the
 * one of his open membership or the one of the season running, is still open (PDL: „Nijedna odluka ne
 * govori koji od dva tima član sopstvena strana crta u oktobru"); nothing here moves the record. Nor
 * does it touch the order of the list: that is the aggregated list's (a low finding), and the cases
 * here read it only as far as the member number and the season each entry carries.
 *
 * <p><b>THE LEAVERS COME OUT OF THE REAL ROUTE, IN TWO YEARS, AND THE CLOCK IS THE DIAL OF THE
 * READING.</b> The membership rows below are written by pressing the button ({@code DELETE
 * /api/teams/{id}/membership}) and not by an insert, so the season the route writes and the season
 * this resource reads back are one measured fact and not two fixtures agreeing with each other. Five
 * members leave in the first October. The one who has been in the team since 2027 leaves in the
 * second, a year on, and that happens only in the cases that ask for the second year
 * ({@link #inTheSecondOctoberTheMemberOfTwoSeasonsLeaves}), so no case reads at a moment before a row
 * it reads could have been written. Every case that reads an answer moves the clock to the moment it
 * asks at, and what it reads is a function of the rows and of that moment alone:
 *
 * <ul>
 * <li>{@link #OCTOBER_2027}: the five have just pressed. The season being run is 2027, the same number
 * as the season they began in, so nothing here tells the season on the row from the season being run.
 * <li>{@link #ONE_MINUTE_BEFORE_2027_FREEZES}: 15:59 on 1 January 2028 in Belgrade. The season being run
 * has been 2028 for sixteen hours and the rows still say 2027, which is what tells the two apart, and
 * the table of 2027 has not frozen: they are named.
 * <li>{@link #WHEN_2027_FREEZES}: 16:00 sharp. The season of their last day is exactly the season that
 * freezes at that moment: they are not named.
 * <li>The same three a year on, for the member who was in the team for 2027 and 2028
 * ({@link #OCTOBER_2028}, {@link #ONE_MINUTE_BEFORE_2028_FREEZES}, {@link #WHEN_2028_FREEZES}). In the
 * first of them the table of 2027 has frozen and his membership began in it, and he is named, because
 * the season that counts is the last one of his membership and not the first.
 * </ul>
 *
 * <p><b>Nobody here is the only one of his kind</b>, on every axis an assertion reads along:
 *
 * <ul>
 * <li>{@link #A_LEAVER} is visible and {@link #A_HIDDEN_LEAVER} hides his profile: both are named,
 * for every reader, and neither is on {@code alsoInTheTeam}.
 * <li>{@link #THE_STAYER} sits in the seat of the team and {@link #A_HIDDEN_STAYER} hides his
 * profile: neither has left, so neither is on the new field, and the second stays on the old door.
 * <li>{@link #THE_MOVER} leaves one team and joins another for the next season, and
 * {@link #THE_REJOINER} leaves and joins the SAME team again: the first tells the team of the ended
 * row from the team of the open one, and the second is one member with two memberships in one team.
 * <li>{@link #TWO_SEASONS_LEAVER} began in 2027 and leaves in 2028, so {@code since} and
 * {@code until} are two numbers, and so is the axis the freeze adds: his membership BEGAN in a season
 * that is frozen at a moment when its last season is not. A condition asked of the season it began in
 * drops him while he is named; one asked of the season being run drops him sixteen hours early. Every
 * {@code first_season} in the fixture is a third and a fourth (2019 for the members, 2030 for the
 * teams), so a season read from the wrong column is a wrong number.
 * <li>The leavers of the first October have {@code until} equal to the season that freezes at
 * {@link #WHEN_2027_FREEZES}, and the leaver of the second has {@code until} one season later than
 * the last frozen season at {@link #OCTOBER_2028}: the source of the number and the subject of the
 * decision are the same season in the first, and are not in the second. They cannot share one answer,
 * because a membership ending with 2028 is written in October 2028, and the cases do not pretend it
 * is written earlier.
 * <li>{@link #A_LAPSED_LEAVER} left and has not paid: not named, and asked at the moments when he WOULD
 * be, since after the freeze he is named nowhere for a second reason. {@link #THE_ONE_WITH_NO_NUMBER}
 * left and has no member number: named, because the record door has no condition on the number either.
 * <li>{@link #THE_ONLY_ONE_IN_C} leaves a team of one, which stays (the row of his leaving is a row)
 * and now names him, for as long as the season he was in it for has not frozen.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ATeamNamesWhoLeftItForTheSeasonTheyLeftInTest {

	private static final ZoneId BELGRADE = ZoneId.of("Europe/Belgrade");

	/**
	 * The last season a membership of this fixture can be in that has frozen before any moment of the
	 * first year: 2026 froze on 1 January 2027, and no membership begins before 2027
	 * ({@code team_membership_season_from_not_before_the_league}), so nothing in the fixture is frozen.
	 */
	private static final int NO_SEASON_OF_THE_FIXTURE_HAS_FROZEN = 2026;

	/**
	 * A moment a case asks at, with three numbers written by hand and not worked out. They are what the
	 * case CLAIMS about that moment: the last season whose table has frozen, how many memberships of
	 * active members that have ended are named by the field, and how many are left out because their
	 * last season has frozen. {@link #theMomentsSitWhereTheirNamesSayTheyDo} holds the first against
	 * {@code SeasonClock}, and the floor under the three doors holds the other two against the database.
	 */
	private record Moment(String name, Instant at, int frozenThrough, int endedAndNamed,
			int endedAndFrozen) {
	}

	/** 11:00 in Belgrade on 20 October 2027, inside the window: the five of the first October have just pressed. */
	private static final Moment OCTOBER_2027 = new Moment("20 October 2027, 11:00",
			inBelgrade(2027, 10, 20, 11, 0), NO_SEASON_OF_THE_FIXTURE_HAS_FROZEN, 6, 0);

	/** 15:59 on 1 January 2028: the season being run is already 2028 and the table of 2027 has not frozen. */
	private static final Moment ONE_MINUTE_BEFORE_2027_FREEZES = new Moment("1 January 2028, 15:59",
			inBelgrade(2028, 1, 1, 15, 59), NO_SEASON_OF_THE_FIXTURE_HAS_FROZEN, 6, 0);

	/** 16:00 sharp on 1 January 2028: the table of 2027 freezes at this moment, and not a minute after. */
	private static final Moment WHEN_2027_FREEZES = new Moment("1 January 2028, 16:00",
			inBelgrade(2028, 1, 1, 16, 0), 2027, 0, 6);

	/** 11:00 on 20 October 2028: the table of 2027 has been frozen since January, the second leaver has just pressed. */
	private static final Moment OCTOBER_2028 = new Moment("20 October 2028, 11:00",
			inBelgrade(2028, 10, 20, 11, 0), 2027, 1, 6);

	/** 15:59 on 1 January 2029: the season being run is already 2029 and the table of 2028 has not frozen. */
	private static final Moment ONE_MINUTE_BEFORE_2028_FREEZES = new Moment("1 January 2029, 15:59",
			inBelgrade(2029, 1, 1, 15, 59), 2027, 1, 6);

	/** 16:00 sharp on 1 January 2029: the table of 2028 freezes, and with it the last of the memberships. */
	private static final Moment WHEN_2028_FREEZES = new Moment("1 January 2029, 16:00",
			inBelgrade(2029, 1, 1, 16, 0), 2028, 0, 7);

	/** The moments of the first year, which the cases ask of the world the first October made. */
	private static final List<Moment> THE_FIRST_YEAR = List.of(OCTOBER_2027, ONE_MINUTE_BEFORE_2027_FREEZES,
			WHEN_2027_FREEZES);

	/** The moments of the second year, which the cases ask of the world after the second October. */
	private static final List<Moment> THE_SECOND_YEAR = List.of(OCTOBER_2028,
			ONE_MINUTE_BEFORE_2028_FREEZES, WHEN_2028_FREEZES);

	/** Visible, in team A since 2027, and the one who sits in its seat. */
	private static final String THE_STAYER = "000101";

	/** Visible, in team A since 2027, leaves it in October 2027. */
	private static final String A_LEAVER = "000102";

	/** Hides his profile, in team A since 2027, leaves it in October 2027. */
	private static final String A_HIDDEN_LEAVER = "000103";

	/** Leaves team A in October 2027 and is written into team B for 2028, as joining writes it. */
	private static final String THE_MOVER = "000104";

	/** Hides his profile and stays in team A: the member the old door is still for. */
	private static final String A_HIDDEN_STAYER = "000105";

	/** Left team A in 2027 and has not paid since: the row exists and nobody may name him. */
	private static final String A_LAPSED_LEAVER = "000106";

	/**
	 * In team A since 2027, leaves in October 2028: two seasons, so {@code since} is not {@code until},
	 * and the season his membership began in is frozen when its last season is not.
	 */
	private static final String TWO_SEASONS_LEAVER = "000107";

	/** Leaves team A in October 2027 and is written into team A again for 2028. */
	private static final String THE_REJOINER = "000108";

	/** Alone in team C since 2027, and leaves it in October 2027. */
	private static final String THE_ONLY_ONE_IN_C = "000109";

	/** Active, with no member number, and left team A in 2027 (written directly: he cannot sign in). */
	private static final String THE_ONE_WITH_NO_NUMBER = "no number";

	private static final String TEAM_A = "tim-a";

	private static final String TEAM_B = "tim-b";

	private static final String TEAM_C = "tim-c";

	/** The season every competitor of the fixture began racing in: not one a membership can be. */
	private static final int HIS_FIRST_SEASON = 2019;

	/** The season every team of the fixture began in: not one a membership can be either. */
	private static final int ITS_FIRST_SEASON = 2030;

	private static final String THE_ACTIVE_READER = THE_STAYER + "@primer.rs";

	/** A member whose fee has lapsed, signed in: answered what a visitor is, about a hidden profile. */
	private static final String THE_LAPSED_READER = A_LAPSED_LEAVER + "@primer.rs";

	private static final String THE_MODERATOR = "moderator-timova@primer.rs";

	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	/**
	 * Every kind of reader this resource tells apart, the visitor first (the request without a cookie).
	 * The rule about a hidden profile splits them in two, and the answer under test must not.
	 */
	private static final List<String> EVERY_KIND_OF_READER = Arrays.asList(null, THE_ACTIVE_READER,
			THE_LAPSED_READER, THE_MODERATOR, THE_SUPERADMIN);

	private static final List<String> THOSE_WHO_MAY_NOT_READ_A_HIDDEN_PROFILE =
			Arrays.asList(null, THE_LAPSED_READER);

	/** The field under test, written out so that a rename has to fail a case and not rename the case. */
	private static final String ENDED_MEMBERSHIPS = "endedMemberships";

	private static final String ALSO_IN_THE_TEAM = "alsoInTheTeam";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private final ObjectMapper mapper = new ObjectMapper();

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/** A clock the case moves, because the window and the freeze are boundaries in time. */
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
			return new AClockTheCaseMoves(OCTOBER_2027.at());
		}
	}

	/**
	 * THE WORLD OF THE FIRST OCTOBER, in which everybody who leaves in it has pressed the button.
	 *
	 * <p>Written in the order it happens: the people and the teams, the memberships as an approval
	 * writes them, then the five who leave in 2027, then what joining writes for two of them. Every
	 * press is asserted to be let through, so a fixture that stopped being able to leave says so here and
	 * not as a list that is quietly short. The sixth, who leaves a year on, is the cases' to press
	 * ({@link #inTheSecondOctoberTheMemberOfTwoSeasonsLeaves}), and until then he is a member of team A
	 * like the stayer.
	 */
	@BeforeEach
	void everybodyWhoLeavesInTheFirstOctoberHasPressedTheButton() throws Exception {
		clock.moveTo(OCTOBER_2027.at());

		for (String number : List.of(THE_STAYER, A_LEAVER, A_HIDDEN_LEAVER, THE_MOVER, A_HIDDEN_STAYER,
				TWO_SEASONS_LEAVER, THE_REJOINER, THE_ONLY_ONE_IN_C)) {
			competitor(number, true);
			account(emailOf(number), "competitor", number);
		}

		/* The member whose fee has lapsed IS a signed in reader, and he is also a leaver. */
		competitor(A_LAPSED_LEAVER, false);
		account(THE_LAPSED_READER, "competitor", A_LAPSED_LEAVER);

		long noNumber = competitorWithNoNumber();

		account(THE_MODERATOR, "moderator", null);
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'entity:teams')")
				.param(THE_MODERATOR).update();
		account(THE_SUPERADMIN, "superadmin", null);

		db.sql("update competitor set profile_hidden = true where member_number in (?, ?)")
				.params(A_HIDDEN_LEAVER, A_HIDDEN_STAYER).update();

		team(TEAM_A, "Tim A");
		team(TEAM_B, "Tim B");
		team(TEAM_C, "Tim C");

		/* The seat of A is the stayer's, so a number read off the seat is nobody who left. */
		db.sql("update team set admin_id = (select id from competitor where member_number = ?)"
						+ " where slug = ?").params(THE_STAYER, TEAM_A).update();

		for (String number : List.of(THE_STAYER, A_LEAVER, A_HIDDEN_LEAVER, THE_MOVER, A_HIDDEN_STAYER,
				TWO_SEASONS_LEAVER, THE_REJOINER)) {
			inATeam(number, TEAM_A, 2027);
		}

		inATeam(THE_ONLY_ONE_IN_C, TEAM_C, 2027);

		/* Left in 2027 without the button, because neither of them can sign in as a member. */
		leftIn(A_LAPSED_LEAVER, TEAM_A, 2027, 2027);
		leftInById(noNumber, TEAM_A, 2027, 2027);

		for (String number : List.of(A_LEAVER, A_HIDDEN_LEAVER, THE_MOVER, THE_REJOINER)) {
			leaves(number, TEAM_A);
		}

		leaves(THE_ONLY_ONE_IN_C, TEAM_C);

		/* What joining writes, which is an open membership from the season being paid for. */
		inATeam(THE_MOVER, TEAM_B, 2028);
		inATeam(THE_REJOINER, TEAM_A, 2028);
	}

	/**
	 * A MEMBER WHO LEFT IS NAMED ON THE TEAM HE LEFT, WITH THE SEASONS HE WAS IN IT FOR, FROM THE
	 * MOMENT HE PRESSED.
	 *
	 * <p>Written out team by team and not read back out of the database, because what is measured is
	 * exactly WHO is named WHERE and with WHICH two numbers. It fails for each way the field can be
	 * wrong at once: an open membership named as ended (the stayers, the mover's row in B and the
	 * rejoiner's second row would be extra), a lapsed leaver named, a team's list hung on another team
	 * (B has nobody who left and C has one), and a number read off the seat or the season off a column
	 * that is not the row's.
	 *
	 * <p>The order is the member number and then the season, with the one who has no number last, so
	 * two memberships of one member in one team come out in the order he had them.
	 */
	@Test
	void aMemberWhoLeftIsNamedOnTheTeamHeLeftWithTheSeasonsHeWasInItFor() throws Exception {
		assertThat(namedAt(OCTOBER_2027, null))
				.as("a visitor was not told, team by team, exactly the memberships that have ended, of"
						+ " members whose fee is standing, with the season each began in and the last"
						+ " season he was in it, at the moment they pressed")
				.isEqualTo(thoseWhoLeftInTheFirstOctober());
	}

	/**
	 * ONE MINUTE BEFORE THE SEASON FREEZES THEY ARE STILL NAMED: 15:59 on 1 January, in Belgrade.
	 *
	 * <p>The case that tells the freeze from the turn of the year. The season being run has been 2028
	 * for sixteen hours, since midnight, and the table of 2027 is still being worked out, so the team
	 * still counts the members whose last season was 2027, and says 2027 and not the season being run.
	 * The answer is the one they were given on the day they pressed, word for word.
	 *
	 * <p>It does not fail for the condition taken off, because at this moment nothing differs, and that
	 * is the next case's. It fails for a boundary at midnight or at the ten in the morning that
	 * reporting ends at (they are gone at 15:59), for the season being run asked in place of the season
	 * the row ends with, for the season before the last one asked in its place, and for a moment
	 * shifted a minute on.
	 */
	@Test
	void aMemberWhoLeftIsStillNamedOneMinuteBeforeHisSeasonFreezes() throws Exception {
		assertThat(namedAt(ONE_MINUTE_BEFORE_2027_FREEZES, null))
				.as("at 15:59 on 1 January 2028 the table of 2027 has not frozen, so the members whose"
						+ " last season it was are still named, with the season on their row")
				.isEqualTo(thoseWhoLeftInTheFirstOctober());
	}

	/**
	 * FROM THE MOMENT THE SEASON FREEZES THEY ARE NAMED NO MORE: 16:00 on 1 January, in Belgrade.
	 *
	 * <p>The other side of the boundary, at the exact minute the tables freeze, in both years: nobody
	 * is named. At this moment the season of their last day is exactly the season that freezes, which
	 * is the state where the source of the number and the subject of the decision are one season.
	 *
	 * <p>It fails for the condition taken off, for a moment that is the clock of the machine and not
	 * the bean (the machine says 2026 and everything is still named), for the season after the last
	 * one asked in place of the last, and for a moment shifted a minute back.
	 */
	@Test
	void aMemberWhoLeftIsNamedNoMoreFromTheMomentHisSeasonFreezes() throws Exception {
		assertThat(namedAt(WHEN_2027_FREEZES, null))
				.as("at 16:00 on 1 January 2028 the table of 2027 has frozen, so nobody whose last"
						+ " season it was is named")
				.isEqualTo(nobody());

		inTheSecondOctoberTheMemberOfTwoSeasonsLeaves();

		assertThat(namedAt(WHEN_2028_FREEZES, null))
				.as("at 16:00 on 1 January 2029 the table of 2028 has frozen, and with it the last"
						+ " membership the field named")
				.isEqualTo(nobody());
	}

	/**
	 * A MEMBERSHIP OF TWO SEASONS IS NAMED UNTIL THE LAST OF THEM FREEZES, AND NOT THE FIRST.
	 *
	 * <p>The member who has been in team A since 2027 leaves in October 2028. The table of 2027, the
	 * season his membership began in, froze in January and took the five of the first October with it;
	 * his membership is named from the day he presses until 15:59 on 1 January 2029, with both
	 * numbers ({@code 2027-2028}), and gone at 16:00. The middle moment is the one where the season
	 * being run has already moved on to 2029 and his row still ends with 2028.
	 *
	 * <p>It fails for the freeze asked of the season he began in (he is gone on the day he presses),
	 * of the first season of the league whatever the row says (the same), of the season being run
	 * (gone at midnight, sixteen hours early), and for the condition taken off (the five of 2027 stay).
	 */
	@Test
	void aMembershipOfTwoSeasonsIsNamedUntilTheLastOfThemFreezesAndNotTheFirst() throws Exception {
		inTheSecondOctoberTheMemberOfTwoSeasonsLeaves();

		for (Moment moment : List.of(OCTOBER_2028, ONE_MINUTE_BEFORE_2028_FREEZES)) {
			assertThat(namedAt(moment, null))
					.as("at %s only the membership of the member of two seasons is named: the five of"
							+ " 2027 froze with their table, and his last season has not", moment.name())
					.isEqualTo(thoseWhoLeftInTheSecondOctober());
		}

		assertThat(namedAt(WHEN_2028_FREEZES, null))
				.as("at %s his last season has frozen, so he is named no more", WHEN_2028_FREEZES.name())
				.isEqualTo(nobody());
	}

	/**
	 * IT IS THE SAME ANSWER FOR EVERY KIND OF READER, which is the difference between this field and
	 * the one beside it.
	 *
	 * <p>{@code alsoInTheTeam} is a reader's own: it carries a hidden member only to those who may not
	 * read a hidden profile, because the others are told by the record. A membership that has ended is
	 * on no record at all, so there is nothing to be told twice and nobody to be spared: a field written
	 * with the same condition would give the visitor a hidden leaver and the active member none, and
	 * the team would lose him for exactly the readers whose record cannot name him.
	 *
	 * <p>Five readers, split by the rule about a hidden profile into two who may read one (an active
	 * member and the administration, a moderator over the teams and the superadmin) and two who may
	 * not (a visitor and a member whose fee has lapsed), asked at the last minute before the freeze, so
	 * the list compared is not empty and „the same" is not two empty lists.
	 */
	@Test
	void itIsTheSameAnswerForEveryKindOfReader() throws Exception {
		at(ONE_MINUTE_BEFORE_2027_FREEZES);

		Map<String, String> toAVisitor = endedByTeam(null);

		assertThat(toAVisitor.get(TEAM_A))
				.as("a visitor is told nobody who left team A (or no list at all, which a missing key"
						+ " reads as the empty text), so „the same for everybody” compares nothing")
				.startsWith("[{");

		for (String reader : EVERY_KIND_OF_READER) {
			assertThat(endedByTeam(reader))
					.as("%s was told something other than what a visitor is about the members who left"
							+ " (a hidden leaver is the one who tells the two sets of readers apart)",
							reader == null ? "a visitor" : reader)
					.isEqualTo(toAVisitor);
		}
	}

	/**
	 * THE THREE DOORS NAME EVERY MEMBERSHIP OF AN ACTIVE MEMBER ONCE, TO EVERY CALLER, UNTIL AN ENDED
	 * ONE FREEZES, AND NONE AFTER THAT.
	 *
	 * <p>The floor under the third door, and the sibling of
	 * {@code TeamApiTest.theTwoDoorsNameEveryStandingMembershipOnceToEveryCaller}, which asks the
	 * same of the open memberships alone. A membership is named on the member's record where it has
	 * not ended and the profile is open to the caller; on {@code alsoInTheTeam} where it has not ended
	 * and the profile is NOT open to him; and on {@code endedMemberships} where it has ended and its
	 * last season has not frozen. Asked as a list and compared with its multiplicity, so it holds both
	 * halves at once: none is lost between the doors, and none stands on two. A membership that has
	 * ended and whose last season has frozen is on none, and that is asked too: the list of what is
	 * expected is cut by the last frozen season WRITTEN BY HAND for the moment, not by asking
	 * {@code SeasonClock} again, so the case does not mirror the code.
	 *
	 * <p>The six moments are the six of the class note, in the world they belong to: the first three
	 * in the world the first October made, the last three after the second. At each of them the
	 * numbers the moment carries are held against the database as well, so a fixture that no longer has
	 * an ended membership to name, or one to leave out, says so instead of asking the third door of
	 * nothing.
	 *
	 * <p>It fails for a third door that forgets the {@code not ended} condition (every open membership
	 * named twice), for one written with the condition of the second (the leaver of a hidden profile
	 * named to the readers who may not read it and lost to the others), for the second door losing its
	 * {@code not ended} condition (the hidden leaver named on both), for a record that starts naming an
	 * ended membership, for a door that drops the member with no number, and for a freeze that is
	 * missing, early, late, or asked of the wrong season.
	 */
	@Test
	void theThreeDoorsNameEveryMembershipOfAnActiveMemberOnceToEveryCallerUntilAnEndedOneFreezes()
			throws Exception {
		for (Moment moment : THE_FIRST_YEAR) {
			everyMembershipIsNamedOnceAndAFrozenOneNotAtAll(moment);
		}

		inTheSecondOctoberTheMemberOfTwoSeasonsLeaves();

		for (Moment moment : THE_SECOND_YEAR) {
			everyMembershipIsNamedOnceAndAFrozenOneNotAtAll(moment);
		}
	}

	/**
	 * A MEMBER WHO HIDES HIS PROFILE AND LEFT IS NEVER ON THE DOOR FOR THOSE WHO STAYED.
	 *
	 * <p>The old door is asked in both directions, each with a member that tells it from the other:
	 * to a reader who may not read a hidden profile team A names exactly the hidden member who is
	 * still in it (and not the one who left, who is on the new field), and to a reader who may read
	 * one it names nobody. Taking the condition {@code not ended} off the old door is what lets a
	 * hidden leaver in, and it is the one change the case above and this one fail for together. It is
	 * asked at the last minute before the freeze, when the hidden leaver is on the new field, so the
	 * old door has something it could wrongly be carrying.
	 */
	@Test
	void aHiddenMemberWhoLeftIsNotOnTheDoorForThoseWhoStayed() throws Exception {
		at(ONE_MINUTE_BEFORE_2027_FREEZES);

		for (String reader : EVERY_KIND_OF_READER) {
			List<String> onTheOldDoor = new ArrayList<>();

			for (JsonNode team : teams(reader)) {
				for (JsonNode also : team.path(ALSO_IN_THE_TEAM)) {
					onTheOldDoor.add(numberOf(also));
				}
			}

			if (THOSE_WHO_MAY_NOT_READ_A_HIDDEN_PROFILE.contains(reader)) {
				assertThat(onTheOldDoor)
						.as("%s may not read a hidden profile, so the team names to him the hidden"
								+ " member who is still in it and nobody who left",
								reader == null ? "a visitor" : reader)
						.containsExactly(A_HIDDEN_STAYER);
			}
			else {
				assertThat(onTheOldDoor)
						.as("%s may read a hidden profile, so his records name every link and the team"
								+ " names nobody a second time", reader)
						.isEmpty();
			}
		}
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED IS NAMED NOWHERE, which is the rule the whole of this resource
	 * keeps.
	 *
	 * <p>PDL P11 and P13: a member who has not paid is not on any public list (the two lists that
	 * name a member of a team, {@code /api/competitors} and this one, end on the same condition).
	 * His row of {@code team_membership} is asked for and found, and the question is asked of
	 * every kind of reader on the whole text, not on a field, so it holds however the number is spelt.
	 * It is asked at the two moments when his row would be named if the condition were gone: after the
	 * freeze he is named nowhere for a second reason, and a case asked there would pass without it.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsNamedNowhere() throws Exception {
		assertThat(db.sql("select c.active from team_membership m join competitor c on"
						+ " c.id = m.competitor_id where c.member_number = ? and m.season_to is not null")
				.param(A_LAPSED_LEAVER).query(Boolean.class).single())
				.as("the member this case rests on has not left, or has paid, so nothing is measured")
				.isFalse();

		for (Moment moment : List.of(OCTOBER_2027, ONE_MINUTE_BEFORE_2027_FREEZES)) {
			at(moment);

			for (String reader : EVERY_KIND_OF_READER) {
				assertThat(wholeTeams(reader))
						.as("the number of a member whose fee has lapsed left the server with the teams,"
								+ " to %s at %s", reader == null ? "a visitor" : reader, moment.name())
						.doesNotContain(A_LAPSED_LEAVER);
			}
		}
	}

	/**
	 * A TEAM WHOSE ONLY MEMBER LEFT STAYS, AND NOW NAMES HIM, FOR AS LONG AS HIS SEASON HAS NOT FROZEN.
	 *
	 * <p>{@code ATeamGoesWithItsLastMember} asks whether the team has any row at all, and the row of a
	 * leaving is a row, so the team is still on the list until the season turns. What that used to
	 * cost is written on that class: a team drawn with nobody in it. This is the half that closes
	 * for the season he was in it for: the answer names him, and names him on the new field and not on
	 * the old one. What it costs after the freeze is that class's to say, and this one does not pin it.
	 */
	@Test
	void aTeamWhoseOnlyMemberLeftStillStandsAndNamesHim() throws Exception {
		at(ONE_MINUTE_BEFORE_2027_FREEZES);

		JsonNode c = teamNamed(null, TEAM_C);

		assertThat(endedOn(c)).containsExactly(THE_ONLY_ONE_IN_C + " 2027-2027");
		assertThat(c.path(ALSO_IN_THE_TEAM).size())
				.as("a member who left is on the door for those who are still in the team")
				.isZero();
	}

	/**
	 * EMPTY IS A VALUE, AND THE KEY IS NEVER ABSENT, for any reader and any team, and whatever
	 * emptied the list.
	 *
	 * <p>Team B has nobody who left, so it is the team that tells {@code []} from a missing key or a
	 * JSON null; and from the moment the season freezes every team's list is empty because the filter
	 * took the rows out, which is the other way to an empty list and a different line of the code. The
	 * portal reads the list without a branch for either, and a key carrying null would be a fifth
	 * shape for one sentence.
	 */
	@Test
	void emptyIsAValueAndTheKeyIsNeverAbsent() throws Exception {
		allTheTeamsAnswerWithAList(ONE_MINUTE_BEFORE_2027_FREEZES);

		assertThat(teamNamed(null, TEAM_B).path(ENDED_MEMBERSHIPS).size())
				.as("the team nobody left has somebody on its list of those who did")
				.isZero();

		allTheTeamsAnswerWithAList(WHEN_2027_FREEZES);

		inTheSecondOctoberTheMemberOfTwoSeasonsLeaves();

		allTheTeamsAnswerWithAList(WHEN_2028_FREEZES);
	}

	/**
	 * NOTHING BUT THE THREE VALUES LEAVES: not the reason, not a date, not a key.
	 *
	 * <p>{@code left_reason} is a sentence a person may one day be shown ({@code Membership}), and
	 * what a screen needs to draw a roster is who, from which season and until which. A fourth
	 * component added to the record is a fact published about a member without anybody having decided
	 * it.
	 */
	@Test
	void nothingButTheThreeValuesLeavesWithAMemberWhoLeft() throws Exception {
		at(ONE_MINUTE_BEFORE_2027_FREEZES);

		int seen = 0;

		for (JsonNode team : teams(null)) {
			for (JsonNode left : team.path(ENDED_MEMBERSHIPS)) {
				assertThat(Answers.fieldsOf(left))
						.as("a membership that ended is told with something other than who, since and"
								+ " until")
						.containsExactly("memberNumber", "since", "until");
				seen++;
			}
		}

		assertThat(seen).as("nobody who left is named, so no entry was looked at").isPositive();
	}

	/**
	 * THE FIXTURE SAYS WHAT IT CLAIMS TO SAY, asked of the database rather than trusted from the
	 * constants above.
	 *
	 * <p>Every assertion in this file rests on one of these, and each is a way a whole file could
	 * measure nothing: seasons that are secretly one number make „read off the wrong column"
	 * unmeasurable, a seat held by somebody who left makes a number read off the seat the right one,
	 * and a leaver who is not really active, or not really numbered, is a case about nobody. It is
	 * asked of the world of the first October and then of the world after the second, which adds the
	 * one membership that spans two seasons.
	 */
	@Test
	void theFixtureSeparatesTheAxesItSaysItSeparates() throws Exception {
		assertThat(db.sql("select distinct first_season from competitor").query(Integer.class).list())
				.as("a competitor of the fixture began racing in a season a membership can be")
				.containsExactly(HIS_FIRST_SEASON);
		assertThat(db.sql("select distinct first_season from team").query(Integer.class).list())
				.as("a team of the fixture began in a season a membership can be")
				.containsExactly(ITS_FIRST_SEASON);
		assertThat(db.sql("select distinct season_from from team_membership order by 1")
				.query(Integer.class).list())
				.as("the seasons a membership began in are not the two the cases are written against")
				.containsExactly(2027, 2028);
		assertThat(db.sql("select c.member_number from team t join competitor c on c.id = t.admin_id")
				.query(String.class).list())
				.as("the seat is held by somebody who left, so a number read off it is a leaver's")
				.containsExactly(THE_STAYER);
		assertThat(db.sql("select count(*) from competitor where member_number is null and active")
				.query(Long.class).single())
				.as("the member with no number is gone or not active")
				.isEqualTo(1L);
		assertThat(db.sql("select count(*) from team_membership m join competitor c on c.id ="
						+ " m.competitor_id where c.member_number = ? and m.team_id ="
						+ " (select id from team where slug = ?) and m.season_to is null")
				.params(THE_REJOINER, TEAM_A).query(Long.class).single())
				.as("the rejoiner has no open membership in the team he left")
				.isEqualTo(1L);

		/* The world of the first October. */
		assertThat(db.sql("select distinct season_to from team_membership where season_to is not null"
						+ " order by 1").query(Integer.class).list())
				.as("the seasons the leavers of the first October were in the team until are not 2027")
				.containsExactly(2027);
		assertThat(db.sql("select count(*) from team_membership where season_to > season_from")
				.query(Long.class).single())
				.as("somebody was in a team for two seasons before the second October")
				.isZero();
		assertThat(db.sql("select count(*) from team_membership where season_to is not null")
				.query(Long.class).single())
				.as("the memberships that ended in the first October are not the seven this file is"
						+ " written against (the lapsed leaver and the one with no number among them)")
				.isEqualTo(7L);

		/* The world after the second. */
		inTheSecondOctoberTheMemberOfTwoSeasonsLeaves();

		assertThat(db.sql("select distinct season_to from team_membership where season_to is not null"
						+ " order by 1").query(Integer.class).list())
				.as("the seasons the leavers were in the team until are not the two the clocks write")
				.containsExactly(2027, 2028);
		assertThat(db.sql("select count(*) from team_membership where season_to > season_from")
				.query(Long.class).single())
				.as("nobody was in a team for two seasons, so since and until are one number")
				.isEqualTo(1L);
		assertThat(db.sql("select count(*) from team_membership m join competitor c on c.id ="
						+ " m.competitor_id where c.member_number = ? and m.season_from = 2027"
						+ " and m.season_to = 2028")
				.param(TWO_SEASONS_LEAVER).query(Long.class).single())
				.as("the member of two seasons did not begin in 2027 and end with 2028")
				.isEqualTo(1L);
		assertThat(db.sql("select count(*) from team_membership where season_to is not null")
				.query(Long.class).single())
				.as("the memberships that ended in the fixture are not the eight this file is written against")
				.isEqualTo(8L);
	}

	/**
	 * THE MOMENTS SIT WHERE THEIR NAMES SAY THEY DO, asked of {@code SeasonClock} and not of the
	 * constants that were written beside the names.
	 *
	 * <p>The cases around the freeze are only as sharp as the moments they ask at, and the numbers a
	 * moment carries are written by hand. This holds them to the one home of the boundary: the last
	 * frozen season is frozen at the moment and the next one is not, the moments before and after a
	 * freeze are one minute either side of it and the same minute as {@code tablesFreeze}, and the
	 * season being run at the minute before is already the next one, which is what makes „the season on
	 * the row" and „the season being run" two different numbers there. If the owner moves the freeze,
	 * this is the case that says which constants to move.
	 */
	@Test
	void theMomentsSitWhereTheirNamesSayTheyDo() {
		for (Moment moment : List.of(OCTOBER_2027, ONE_MINUTE_BEFORE_2027_FREEZES, WHEN_2027_FREEZES,
				OCTOBER_2028, ONE_MINUTE_BEFORE_2028_FREEZES, WHEN_2028_FREEZES)) {
			ZonedDateTime at = moment.at().atZone(SeasonClock.ZONE);

			assertThat(SeasonClock.isFrozen(moment.frozenThrough(), at))
					.as("at %s the table of %d has not frozen", moment.name(), moment.frozenThrough())
					.isTrue();
			assertThat(SeasonClock.isFrozen(moment.frozenThrough() + 1, at))
					.as("at %s the table of %d has frozen already", moment.name(), moment.frozenThrough() + 1)
					.isFalse();
		}

		assertThat(WHEN_2027_FREEZES.at()).isEqualTo(SeasonClock.tablesFreeze(2027).toInstant());
		assertThat(ONE_MINUTE_BEFORE_2027_FREEZES.at())
				.isEqualTo(SeasonClock.tablesFreeze(2027).toInstant().minus(Duration.ofMinutes(1)));
		assertThat(WHEN_2028_FREEZES.at()).isEqualTo(SeasonClock.tablesFreeze(2028).toInstant());
		assertThat(ONE_MINUTE_BEFORE_2028_FREEZES.at())
				.isEqualTo(SeasonClock.tablesFreeze(2028).toInstant().minus(Duration.ofMinutes(1)));

		assertThat(SeasonClock.seasonBeingRun(OCTOBER_2027.at().atZone(SeasonClock.ZONE)))
				.as("the season being run in the first October is the season the leavers began in")
				.isEqualTo(2027);
		assertThat(SeasonClock.seasonBeingRun(ONE_MINUTE_BEFORE_2027_FREEZES.at().atZone(SeasonClock.ZONE)))
				.as("at 15:59 on 1 January 2028 the season being run is not the season on the rows")
				.isEqualTo(2028);
		assertThat(SeasonClock.seasonBeingRun(OCTOBER_2028.at().atZone(SeasonClock.ZONE)))
				.as("the season being run in the second October is the season his membership ends with")
				.isEqualTo(2028);
		assertThat(SeasonClock.seasonBeingRun(ONE_MINUTE_BEFORE_2028_FREEZES.at().atZone(SeasonClock.ZONE)))
				.as("at 15:59 on 1 January 2029 the season being run is not the season on his row")
				.isEqualTo(2029);
	}

	/** One membership as the doors name it, whichever door it came by. */
	private record Link(String memberNumber, long team, int since, Integer until) {
	}

	/** A moment in Belgrade, which is where the league keeps its time, as the instant it is. */
	private static Instant inBelgrade(int year, int month, int day, int hour, int minute) {
		return ZonedDateTime.of(year, month, day, hour, minute, 0, 0, BELGRADE).toInstant();
	}

	/** What the first October's leavers are named as, team by team, for any moment before 2027 freezes. */
	private static Map<String, List<String>> thoseWhoLeftInTheFirstOctober() {
		Map<String, List<String>> named = new LinkedHashMap<>();

		named.put(TEAM_A, List.of(
				A_LEAVER + " 2027-2027",
				A_HIDDEN_LEAVER + " 2027-2027",
				THE_MOVER + " 2027-2027",
				THE_REJOINER + " 2027-2027",
				THE_ONE_WITH_NO_NUMBER + " 2027-2027"));
		named.put(TEAM_B, List.of());
		named.put(TEAM_C, List.of(THE_ONLY_ONE_IN_C + " 2027-2027"));

		return named;
	}

	/** What is named while only the second October's leaver is: the table of 2027 has frozen, 2028's has not. */
	private static Map<String, List<String>> thoseWhoLeftInTheSecondOctober() {
		Map<String, List<String>> named = new LinkedHashMap<>();

		named.put(TEAM_A, List.of(TWO_SEASONS_LEAVER + " 2027-2028"));
		named.put(TEAM_B, List.of());
		named.put(TEAM_C, List.of());

		return named;
	}

	/** What is named once every table the leavers were in has frozen: every team, and nobody. */
	private static Map<String, List<String>> nobody() {
		Map<String, List<String>> named = new LinkedHashMap<>();

		named.put(TEAM_A, List.of());
		named.put(TEAM_B, List.of());
		named.put(TEAM_C, List.of());

		return named;
	}

	/** Moves the clock to the moment a case asks at. */
	private void at(Moment moment) {
		clock.moveTo(moment.at());
	}

	/**
	 * A YEAR ON, THE MEMBER WHO HAS BEEN IN TEAM A SINCE 2027 PRESSES THE BUTTON: his membership ends
	 * with 2028, and the table of 2027 that his membership began in has been frozen since January.
	 * Asserted to be let through, like every press.
	 */
	private void inTheSecondOctoberTheMemberOfTwoSeasonsLeaves() throws Exception {
		clock.moveTo(OCTOBER_2028.at());

		leaves(TWO_SEASONS_LEAVER, TEAM_A);
	}

	/** What every team of the answer lists as „number since-until", asked of the reader at the moment. */
	private Map<String, List<String>> namedAt(Moment moment, String reader) throws Exception {
		at(moment);

		Map<String, List<String>> named = new LinkedHashMap<>();

		for (JsonNode team : teams(reader)) {
			named.put(team.path("slug").asString(), endedOn(team));
		}

		return named;
	}

	/** Every team answers, to every reader, with the key present and a list in it. */
	private void allTheTeamsAnswerWithAList(Moment moment) throws Exception {
		at(moment);

		for (String reader : EVERY_KIND_OF_READER) {
			for (JsonNode team : teams(reader)) {
				assertThat(team.path(ENDED_MEMBERSHIPS).isArray())
						.as("%s answered team %s at %s with no list of the members who left; empty is a"
								+ " value and the key is never absent", reader == null ? "a visitor" : reader,
								team.path("slug").asString(), moment.name())
						.isTrue();
			}
		}
	}

	/**
	 * The floor under the three doors at one moment: the memberships of active members that have not
	 * ended, and those that have ended and whose last season has NOT frozen by the moment, are named
	 * exactly once between the doors; those that have ended and have frozen are named nowhere.
	 */
	private void everyMembershipIsNamedOnceAndAFrozenOneNotAtAll(Moment moment) throws Exception {
		at(moment);

		List<Link> held = db.sql("select c.member_number, m.team_id, m.season_from, m.season_to"
						+ " from team_membership m join competitor c on c.id = m.competitor_id"
						+ " where c.active")
				.query((row, one) -> new Link(row.getString(1), row.getLong(2), row.getInt(3),
						row.getObject(4) == null ? null : row.getInt(4)))
				.list();

		List<Link> toBeNamed = held.stream()
				.filter(one -> one.until() == null || one.until() > moment.frozenThrough())
				.toList();

		assertThat(held)
				.as("at %s the fixture holds no membership that has not ended, so the first two doors are"
						+ " not both asked", moment.name())
				.anyMatch(one -> one.until() == null);
		assertThat(toBeNamed.stream().filter(one -> one.until() != null).count())
				.as("at %s the fixture does not hold as many memberships that have ended and not frozen as"
						+ " this case is written against, so the third door is asked of something other than"
						+ " it says", moment.name())
				.isEqualTo((long) moment.endedAndNamed());
		assertThat(held.stream().filter(one -> one.until() != null && one.until() <= moment.frozenThrough())
				.count())
				.as("at %s the fixture does not hold as many memberships that have ended and frozen as"
						+ " this case is written against, so nothing is left out for the freeze to leave out",
						moment.name())
				.isEqualTo((long) moment.endedAndFrozen());

		for (String reader : EVERY_KIND_OF_READER) {
			List<Link> named = new ArrayList<>();

			for (JsonNode one : competitors(reader)) {
				if (!one.path("teamId").isNull()) {
					named.add(new Link(numberOf(one), one.path("teamId").asLong(),
							one.path("teamSince").asInt(), null));
				}
			}

			for (JsonNode team : teams(reader)) {
				for (JsonNode also : team.path(ALSO_IN_THE_TEAM)) {
					named.add(new Link(numberOf(also), team.path("id").asLong(),
							also.path("since").asInt(), null));
				}

				for (JsonNode left : team.path(ENDED_MEMBERSHIPS)) {
					named.add(new Link(numberOf(left), team.path("id").asLong(),
							left.path("since").asInt(), left.path("until").asInt()));
				}
			}

			assertThat(named)
					.as("at %s the three doors together did not name, to %s, every membership of an active"
							+ " member exactly once and no membership whose last season had frozen: one was"
							+ " lost between them, stood on two, or outlived its table", moment.name(),
							reader == null ? "a visitor" : reader)
					.containsExactlyInAnyOrderElementsOf(toBeNamed);
		}
	}

	/** The member number of a record, which is null for the one member the fixture has no number for. */
	private static String numberOf(JsonNode one) {
		return one.path("memberNumber").isNull() ? null : one.path("memberNumber").asString();
	}

	/** One team's list of those who left, as „number since-until" in the order it came back. */
	private static List<String> endedOn(JsonNode team) {
		List<String> told = new ArrayList<>();

		for (JsonNode left : team.path(ENDED_MEMBERSHIPS)) {
			told.add((numberOf(left) == null ? THE_ONE_WITH_NO_NUMBER : numberOf(left)) + " "
					+ left.path("since").asInt() + "-" + left.path("until").asInt());
		}

		return told;
	}

	/** The list of every team, as the exact text this reader was told, by address. */
	private Map<String, String> endedByTeam(String email) throws Exception {
		Map<String, String> told = new LinkedHashMap<>();

		for (JsonNode team : teams(email)) {
			told.put(team.path("slug").asString(), team.path(ENDED_MEMBERSHIPS).toString());
		}

		return told;
	}

	private JsonNode teamNamed(String email, String slug) throws Exception {
		for (JsonNode team : teams(email)) {
			if (slug.equals(team.path("slug").asString())) {
				return team;
			}
		}

		throw new AssertionError(slug + " is not on /api/teams");
	}

	private JsonNode teams(String email) throws Exception {
		return mapper.readTree(wholeTeams(email));
	}

	private String wholeTeams(String email) throws Exception {
		return asked("/api/teams", email).getContentAsString(StandardCharsets.UTF_8);
	}

	private JsonNode competitors(String email) throws Exception {
		return mapper.readTree(asked("/api/competitors", email).getContentAsString(StandardCharsets.UTF_8));
	}

	/** @param email null for the visitor, which is the same request without the cookie */
	private MockHttpServletResponse asked(String path, String email) throws Exception {
		MockHttpServletRequestBuilder asking = get(path);

		if (email != null) {
			asking = asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
		}

		MockHttpServletResponse answer = http.perform(asking).andReturn().getResponse();

		assertThat(answer.getStatus()).as("GET %s as %s", path, email).isEqualTo(200);

		return answer;
	}

	/** „Izađi iz tima", sent the way a browser sends it: no body and no content type. */
	private void leaves(String memberNumber, String teamSlug) throws Exception {
		long team = db.sql("select id from team where slug = ?").param(teamSlug)
				.query(Long.class).single();

		MockHttpServletResponse answer = http.perform(delete("/api/teams/" + team + "/membership")
						.with(csrf()).cookie(new Cookie(SessionCookie.NAME,
								sessions.get(emailOf(memberNumber)).secret())))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("%s pressed „Izađi iz tima” in %s and was not let out, so the row this fixture rests on"
						+ " was never written", memberNumber, teamSlug)
				.isEqualTo(204);
	}

	private static String emailOf(String memberNumber) {
		return memberNumber + "@primer.rs";
	}

	private void competitor(String number, boolean active) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), " + HIS_FIRST_SEASON + ", false, ?,"
						+ " 'payment', ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, active, String.format("%016x", ++issued))
				.update();
	}

	/**
	 * A MEMBER WHOSE FEE IS STANDING AND WHO HAS NO MEMBER NUMBER, which V16 allows and nothing ties to
	 * {@code active}: the record door has no condition on the number, and neither does this one.
	 *
	 * @return his {@code competitor.id}, which is what a membership is written by
	 */
	private long competitorWithNoNumber() {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (null, 'Probni', 'Bezbrojni', 'M', date '1992-03-08',"
						+ " (select id from place where rank = 1), " + HIS_FIRST_SEASON + ", false,"
						+ " true, 'payment', ?, '', false, 'none', 'Otac', 'Ulica 3', 'S',"
						+ " timestamptz '2026-01-01 10:00:00+00') returning id")
				.param(String.format("%016x", ++issued))
				.query(Long.class).single();
	}

	private void team(String slug, String name) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id)"
						+ " values (?, ?, '', '', (select id from place where rank = 1), null, null,"
						+ " null, ?, null)")
				.params(slug, name, ITS_FIRST_SEASON).update();
	}

	/** An open membership, which is what an approval and a joining write. */
	private void inATeam(String memberNumber, String teamSlug, int seasonFrom) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?)")
				.params(memberNumber, teamSlug, seasonFrom)
				.update();
	}

	/** A membership that has ended, written directly for a member who cannot press the button. */
	private void leftIn(String memberNumber, String teamSlug, int from, int to) {
		leftInById(db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single(), teamSlug, from, to);
	}

	private void leftInById(long competitor, String teamSlug, int from, int to) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to,"
						+ " left_reason) values (?, (select id from team where slug = ?), ?, ?,"
						+ " 'Presao u drugi tim')")
				.params(competitor, teamSlug, from, to).update();
	}

	/** An account, signed in, and the member behind it where there is one. */
	private void account(String email, String role, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Ime', 'Prezime', ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, role, memberNumber).update();

		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}
}

package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * MAKING A COMPETITION THAT RUNS ALONGSIDE, CHANGING IT, DELETING IT, AND SAYING WHICH
 * RACES COUNT TOWARDS IT - END TO END, AGAINST A REAL DATABASE.
 *
 * <p><b>Authorisation is not measured here.</b> {@code RightsAtTheDoorTest} asks it of
 * EVERY route carrying {@link RightIsNeeded}, by its own method, and it reaches these five
 * on the day they are mapped rather than on the day somebody remembers to add them to a
 * list. One case below holds the same thing for defence in depth and the rest of this file
 * measures what is this resource's own.
 *
 * <p><b>THE CLOCK STANDS IN MARCH 2028, AND EVERY WORD OF THAT IS CHOSEN.</b>
 *
 * <ul>
 * <li><b>2028</b>, because a season freezes on 1 January at 16:00 of the year AFTER it
 * ({@link SeasonClock#tablesFreeze}) and the schema refuses a league before 2027
 * ({@code league_season_not_before_the_league}). 2028 is the first moment at which a
 * FROZEN league can exist at all, which is what half this file is about.
 * <li><b>March</b>, because {@link SeasonClock#seasonBeingPaidFor} and
 * {@link SeasonClock#aLeagueMayBeMadeFor} answer differently there and agree from October
 * on. A route asking the wrong season question would be right for a quarter of the year,
 * and {@link #theTwoSeasonQuestionsDisagreeAtThisMoment} refuses to let this file be green
 * on that account.
 * <li><b>And the four seasons around it are four different answers:</b> 2027 is past AND
 * frozen, 2028 is running, 2029 is next, 2030 is one too far. So „refused" is measured on
 * BOTH sides of the pair the owner allowed and never on one.
 * </ul>
 *
 * <p><b>NOTHING IN THE FIXTURE IS THE ONLY ONE OF ITS KIND, AND THE AXES ARE COUNTED
 * RATHER THAN FELT.</b>
 *
 * <ul>
 * <li>Four leagues, and the one acted on ({@link #acted}) is neither the first written,
 * nor the lowest key, nor the only one of its season - so „this league", „the first
 * league" and „the only league of 2028" are three different answers.
 * <li>The race that enters it is the SECOND of three under its event, so „the race asked
 * for" and „the first race of that day" are two numbers.
 * <li>The day that is entered whole holds TWO races, so „every race of it" and „its race"
 * differ.
 * <li>A race of the right season that nothing counts, so an answer built out of the
 * calendar rather than out of the league fails.
 * <li>A race that counts towards ANOTHER league already, so taking it out of one is
 * measurably not taking it out of both.
 * <li>Two frozen standings, so „the standing" is never „the only row of that table".
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class LeagueWriteApiTest {

	private static final String MODERATOR = "lige@primer.rs";

	/** Noon in Belgrade on 15 March 2028. See the head of this class for every word of it. */
	private static final Instant IN_MARCH = Instant.parse("2028-03-15T11:00:00Z");

	private static final int FROZEN = 2027;

	private static final int RUNNING = 2028;

	private static final int NEXT = 2029;

	private static final int TOO_FAR = 2030;

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	private String session;

	/** The league every case acts on: written third, of the season that is running. */
	private long acted;

	/** Another of the same season, which already counts the race {@link #acted} will. */
	private long neighbour;

	/** One whose season has frozen, which is the state two decisions are about. */
	private long frozen;

	/** One of the season after this, which counts nothing at all. */
	private long empty;

	private long theSecondOfThree;

	private long theThirdOfThree;

	private long aRaceNobodyCounts;

	private long aRaceOfTheFrozenSeason;

	private long theDayWithTwoRaces;

	private long theDayThatStraddlesTheNewYear;

	private long theDayWithNoRaces;

	/**
	 * A CLOCK THE CASE MOVES, so that a frozen season and a running one are one fixture.
	 *
	 * <p>It reports UTC as its zone on purpose, the shape every other case in this package
	 * uses: whoever works out a season has to re-read the instant in the league's own time,
	 * and a server that reads this zone instead answers with the wrong year on the one night
	 * that matters.
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
	void fourLeaguesFiveDaysAndEightRaces() {
		clock.moveTo(IN_MARCH);

		frozen = league("zimska-2027", "Zimska liga 2027", FROZEN);
		neighbour = league("prva-2028", "Prva liga 2028", RUNNING);
		acted = league("druga-2028", "Druga liga 2028", RUNNING);
		empty = league("naredna-2029", "Naredna liga 2029", NEXT);

		long spring = event("prolecni-2028", "2028-03-02");
		race(spring, "Prolecna prva", "2028-03-02");
		theSecondOfThree = race(spring, "Prolecna druga", "2028-03-03");
		theThirdOfThree = race(spring, "Prolecna treca", "2028-03-04");

		theDayWithTwoRaces = event("jesenji-2028", "2028-09-05");
		race(theDayWithTwoRaces, "Jesenja prva", "2028-09-05");
		race(theDayWithTwoRaces, "Jesenja druga", "2028-09-06");

		long unrelated = event("nevezani-2028", "2028-07-07");
		aRaceNobodyCounts = race(unrelated, "Nevezana", "2028-07-07");

		long old = event("stari-2027", "2027-05-05");
		aRaceOfTheFrozenSeason = race(old, "Stara", "2027-05-05");

		/* One event, two mornings, two SEASONS - which V7 allows and which is the one
		   arrangement in which „every race of that day" is not all of one year. */
		theDayThatStraddlesTheNewYear = event("docek-2028", "2028-12-31");
		race(theDayThatStraddlesTheNewYear, "Ispracaj", "2028-12-31");
		race(theDayThatStraddlesTheNewYear, "Docek", "2029-01-01");

		/* Entered a fortnight before its distances are known, which is a real state of the
		   calendar (owner, 23.08.2026) and not a broken row. */
		theDayWithNoRaces = event("najavljeni-2028", "2028-11-11");

		counts(acted, theThirdOfThree);
		counts(neighbour, theSecondOfThree);
		counts(frozen, aRaceOfTheFrozenSeason);

		stoodAt(frozen, "Zimska liga 2027", FROZEN, 1);
		stoodAt(neighbour, "Prva liga 2028", RUNNING, 1);

		session = account(MODERATOR);
		ticked(MODERATOR, "entity:leagues");
	}

	/**
	 * THE FIXTURE ITSELF, ASKED WHETHER IT MEASURES WHAT THIS FILE SAYS IT DOES.
	 *
	 * <p>Every sentence in the head of this class about „never the only one of its kind" is
	 * a claim about rows, and a claim about rows is the first thing to go quietly untrue
	 * when somebody tidies the fixture. Asked here rather than trusted, once, so that the
	 * forty assertions below keep meaning what they say.
	 */
	@Test
	void nothingActedOnIsTheFirstOrTheOnlyOneOfItsKind() {
		assertThat(acted)
				.as("the league acted on holds the lowest key, so this league and the first league"
						+ " are one answer and no case below can tell them apart")
				.isGreaterThan(Math.min(frozen, neighbour));
		assertThat(seasonOf(acted))
				.as("the league acted on is the only one of its season, so an answer that read the"
						+ " season instead of the key would pass everything below")
				.isEqualTo(seasonOf(neighbour));
		assertThat(theSecondOfThree)
				.as("the race that enters is the first of its day, so the race asked for and the"
						+ " first race of that event are one number")
				.isGreaterThan(db.sql("select min(id) from race where event_id ="
						+ " (select event_id from race where id = ?)")
						.param(theSecondOfThree).query(Long.class).single());
		assertThat(racesUnder(theDayWithTwoRaces))
				.as("the day entered whole holds one race, so every race of it and its race are"
						+ " the same list")
				.hasSize(2);
		assertThat(howManySeasonsUnder(theDayThatStraddlesTheNewYear))
				.as("the day that straddles the New Year holds one season, so all of it or none of"
						+ " it has nothing to be measured on")
				.isEqualTo(2);
		assertThat(db.sql("select count(*) from season_league_standing").query(Long.class).single())
				.as("one frozen standing, so the one that must survive a deletion is also the only"
						+ " row of its table")
				.isEqualTo(2);
	}

	/**
	 * AND THE TWO SEASON QUESTIONS REALLY DO DISAGREE AT THIS MOMENT.
	 *
	 * <p>{@link SeasonClock#seasonBeingPaidFor} is what the portal asks about MEMBERSHIP and
	 * steps into next year on 1 October; a league is made for the year that is running or
	 * the next one. From October to December those two overlap, and a route reading the
	 * wrong one would be right anyway - so this file stands where they differ, and says so
	 * rather than relying on the reader to check the date.
	 */
	@Test
	void theTwoSeasonQuestionsDisagreeAtThisMoment() {
		assertThat(SeasonClock.seasonBeingPaidFor(IN_MARCH.atZone(SeasonClock.ZONE)))
				.as("what is on sale in March is not the season that is running, so this file"
						+ " stands where the two questions agree")
				.isEqualTo(RUNNING);
		assertThat(SeasonClock.aLeagueMayBeMadeFor(NEXT, IN_MARCH.atZone(SeasonClock.ZONE)))
				.as("a league for the season after this one is refused, so a route that answered"
						+ " the membership question instead would be right anyway")
				.isTrue();
		assertThat(SeasonClock.isFrozen(FROZEN, IN_MARCH.atZone(SeasonClock.ZONE))).isTrue();
		assertThat(SeasonClock.isFrozen(RUNNING, IN_MARCH.atZone(SeasonClock.ZONE))).isFalse();
	}

	@ParameterizedTest
	@ValueSource(ints = {RUNNING, NEXT})
	void aLeagueIsMadeForTheSeasonRunningAndForTheOneAfterIt(int season) throws Exception {
		MockHttpServletResponse answer = add(new LeagueWriteApi.Upsert("Zimska liga",
				"zimska-" + season, season, "Boduju se sve trke", "Pehari za prva tri"));

		assertThat(answer.getStatus()).isEqualTo(201);

		/* READ OFF THE ROW AND NEVER OUT OF THE ANSWER, which is the difference between
		   measuring what was written and repeating what was sent. Every one of the five
		   fields is different from every other, so two columns written the wrong way round
		   are two failures and not a pass. */
		assertThat(db.sql("select name, season, rules, prizes from league where slug = ?")
				.param("zimska-" + season)
				.query((row, one) -> List.of(row.getString(1), row.getInt(2), row.getString(3),
						row.getString(4)))
				.single())
				.containsExactly("Zimska liga", season, "Boduju se sve trke", "Pehari za prva tri");
	}

	/**
	 * AND THE BOUNDARY IS MEASURED FROM BOTH SIDES, which is the whole reason there are two
	 * numbers here.
	 *
	 * <p>2027 is the year before the one that is running and 2030 is one past the pair the
	 * owner allowed. A route that clamped only downwards would pass on the first and fail on
	 * the second, and one that read „this year or any later" the other way round.
	 */
	@ParameterizedTest
	@ValueSource(ints = {FROZEN, TOO_FAR})
	void aSeasonOutsideThisOneAndTheNextIsRefusedAndNothingIsWritten(int season) throws Exception {
		MockHttpServletResponse answer = add(new LeagueWriteApi.Upsert("Nemoguca liga",
				"nemoguca-liga", season, "", ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString())
				.contains(LeagueWriteApi.THE_SEASON_IS_NOT_THIS_ONE_OR_THE_NEXT);
		assertThat(howManyLeagues()).isEqualTo(4);
	}

	@Test
	void anAddressSomebodyAlreadyAnswersAtIsRefusedAndTheirLeagueIsLeftAlone() throws Exception {
		MockHttpServletResponse answer = add(new LeagueWriteApi.Upsert("Nova liga", "druga-2028",
				RUNNING, "Nova pravila", "Nove nagrade"));

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(answer.getContentAsString()).contains(LeagueWriteApi.THE_ADDRESS_IS_TAKEN);
		assertThat(nameOf(acted)).isEqualTo("Druga liga 2028");
		assertThat(howManyLeagues()).isEqualTo(4);
	}

	/**
	 * THE ADDRESS IS TYPED HERE AND NOT WORKED OUT, so the shape is the one thing standing
	 * between a form and {@code league_slug_shape} - and a check constraint met with a full
	 * form is a 500.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"Zimska Liga", "zimska liga", "-zimska", "zimska-", "zimska--liga",
			"zimska_liga", "zimskać"})
	void anAddressTheSchemaWouldRefuseIsRefusedWithASentence(String address) throws Exception {
		MockHttpServletResponse answer = add(new LeagueWriteApi.Upsert("Zimska liga", address,
				RUNNING, "", ""));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString()).contains(LeagueWriteApi.THE_ADDRESS_IS_NOT_SHAPED);
		assertThat(howManyLeagues()).isEqualTo(4);
	}

	/**
	 * A NAME OF NOTHING AT ALL, and a form that left something out.
	 *
	 * <p>The blank name is the case {@code league_name_not_blank} would otherwise answer
	 * with a 500, and it is measured with SPACES rather than with the empty string: an
	 * emptiness check that forgot to strip passes the second and fails the first.
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "null", value = {"'   ', zimska-liga, 2028", "null, zimska-liga, 2028",
			"Zimska, null, 2028", "Zimska, '  ', 2028", "Zimska, zimska-liga, null"})
	void aFormThatIsNotCompleteIsRefused(String name, String slug, Integer season)
			throws Exception {
		MockHttpServletResponse answer = add(new LeagueWriteApi.Upsert(name, slug, season, null,
				null));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString()).contains(LeagueWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(howManyLeagues()).isEqualTo(4);
	}

	/** What a competition announced before anybody has written its propositions carries. */
	@Test
	void rulesAndPrizesLeftOutAreKeptAsNothingRatherThanAsNull() throws Exception {
		assertThat(add(new LeagueWriteApi.Upsert("  Zimska liga  ", "zimska-liga", RUNNING, null,
				null)).getStatus()).isEqualTo(201);

		assertThat(db.sql("select name, rules, prizes from league where slug = 'zimska-liga'")
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getString(3)))
				.single())
				.as("the name is written with the spaces it was typed with, which the schema's own"
						+ " check would have refused")
				.containsExactly("Zimska liga", "", "");
	}

	@Test
	void aLeagueOfASeasonThatHasNotFrozenIsChanged() throws Exception {
		MockHttpServletResponse answer = change(acted, new LeagueWriteApi.Upsert("Preimenovana",
				"preimenovana-2028", RUNNING, "Druga pravila", "Druge nagrade"));

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(db.sql("select slug, name, season, rules, prizes from league where id = ?")
				.param(acted)
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getInt(3),
						row.getString(4), row.getString(5)))
				.single())
				.containsExactly("preimenovana-2028", "Preimenovana", RUNNING, "Druga pravila",
						"Druge nagrade");
	}

	/**
	 * AND ONE WHOSE SEASON HAS FROZEN IS REFUSED, AND TOLD WHY (PDL P15a, owner 22.09.2026).
	 *
	 * <p><b>The second case is the axis and not a repetition.</b> The request names a season
	 * that has NOT frozen, which is the one shape in which „asked of the row" and „asked of
	 * the form" give different answers: read off the form, a frozen league would be editable
	 * by anybody who also moved it into a live year, which is the very request the decision
	 * exists to refuse.
	 */
	@ParameterizedTest
	@ValueSource(ints = {FROZEN, RUNNING})
	void aLeagueOfAFrozenSeasonIsRefusedWhicheverSeasonTheFormNames(int asked) throws Exception {
		MockHttpServletResponse answer = change(frozen, new LeagueWriteApi.Upsert("Preimenovana",
				"preimenovana-2027", asked, "Druga pravila", "Druge nagrade"));

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(answer.getContentAsString()).contains(LeagueWriteApi.THE_SEASON_IS_FROZEN);
		assertThat(db.sql("select slug, name, season from league where id = ?").param(frozen)
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getInt(3)))
				.single())
				.containsExactly("zimska-2027", "Zimska liga 2027", FROZEN);
	}

	/**
	 * A SEASON THAT IS LEFT ALONE IS NOT A SEASON BEING SET, AND THE SIXTEEN HOURS OF 1
	 * JANUARY ARE WHERE THAT DIFFERENCE IS THE WHOLE ANSWER.
	 *
	 * <p>The running year turns at midnight and a season freezes at 16:00 that same day
	 * ({@link SeasonClock#tablesFreeze}), so for sixteen hours the season that has just
	 * ended is NEITHER „this one or the next" NOR frozen. Asked of every edit, „may a league
	 * be made for this season" would refuse a rename in that window - and refuse it with a
	 * sentence about making a league, which is not what was being done.
	 *
	 * <p><b>Both halves in one case, because one half alone is not an answer.</b> Left as it
	 * stands, the season goes through; MOVED to the same year that is now running, it is
	 * refused - not because 2028 is a bad year, but because this league counts a race and
	 * {@code league_race_league_fk} carries no {@code on update cascade}. A route that
	 * simply stopped asking about the season would pass the first half and fail the second.
	 */
	@Test
	void aSeasonLeftAloneIsEditedInTheHoursBeforeItFreezes() throws Exception {
		clock.moveTo(Instant.parse("2028-01-01T07:00:00Z"));

		assertThat(SeasonClock.isFrozen(FROZEN, Instant.parse("2028-01-01T07:00:00Z")
				.atZone(SeasonClock.ZONE)))
				.as("the season has already frozen at this moment, so the window this case is"
						+ " about does not exist and nothing below measures it")
				.isFalse();
		assertThat(SeasonClock.aLeagueMayBeMadeFor(FROZEN, Instant.parse("2028-01-01T07:00:00Z")
				.atZone(SeasonClock.ZONE)))
				.as("a league may still be MADE for this season at this moment, so a season being"
						+ " set and one being left alone give the same answer here")
				.isFalse();

		assertThat(change(frozen, new LeagueWriteApi.Upsert("Preimenovana", "zimska-2027", FROZEN,
				"Druga pravila", "Druge nagrade")).getStatus()).isEqualTo(200);
		assertThat(nameOf(frozen)).isEqualTo("Preimenovana");

		MockHttpServletResponse moved = change(frozen, new LeagueWriteApi.Upsert("Pomerena",
				"zimska-2027", RUNNING, "", ""));

		assertThat(moved.getStatus()).isEqualTo(409);
		assertThat(moved.getContentAsString())
				.contains(LeagueWriteApi.THE_SEASON_CANNOT_MOVE_WHILE_RACES_COUNT);
		assertThat(seasonOf(frozen)).isEqualTo(FROZEN);
	}

	/**
	 * AND A FORM IS JUDGED ON THE WAY IN HERE TOO, WHICH IS THE HALF THIS FILE WAS MISSING.
	 *
	 * <p><b>Found by the coverage gate on 24.09.2026 and not by reading.</b> Every other
	 * case sent this route a form that was already good, so the branch that hands a refusal
	 * back was written, shipped and never once taken - one line and one branch of the whole
	 * class. {@link LeagueWriteApi#whatIsWrongWith} exists so that a league written and a
	 * league changed are judged by one set of rules; that it HAS two callers said nothing
	 * about whether the second one was ever measured.
	 *
	 * <p><b>The season out of range is asked of the league that counts NOTHING, and that is
	 * the axis rather than tidiness.</b> A league that counts a race is refused a season it
	 * may not have AND a season it may not move to, by two different rules with two different
	 * sentences, and a case over such a league cannot say which of the two answered. Asked of
	 * {@link #empty}, only one of them can.
	 */
	@Test
	void aFormThisRouteWouldNotHaveAcceptedIsRefusedOnTheWayInHereToo() throws Exception {
		MockHttpServletResponse blank = change(acted,
				new LeagueWriteApi.Upsert("   ", "druga-2028", RUNNING, "", ""));

		assertThat(blank.getStatus()).isEqualTo(400);
		assertThat(blank.getContentAsString()).contains(LeagueWriteApi.THE_FORM_IS_NOT_COMPLETE);

		MockHttpServletResponse shaped = change(acted,
				new LeagueWriteApi.Upsert("Druga liga 2028", "Druga Liga", RUNNING, "", ""));

		assertThat(shaped.getStatus()).isEqualTo(400);
		assertThat(shaped.getContentAsString())
				.contains(LeagueWriteApi.THE_ADDRESS_IS_NOT_SHAPED);

		MockHttpServletResponse far = change(empty,
				new LeagueWriteApi.Upsert("Naredna liga 2029", "naredna-2029", TOO_FAR, "", ""));

		assertThat(far.getStatus()).isEqualTo(400);
		assertThat(far.getContentAsString())
				.as("a league that counts nothing was refused for the season it may not MOVE to"
						+ " rather than for the season it may not have, so the two refusals are"
						+ " one answer here")
				.contains(LeagueWriteApi.THE_SEASON_IS_NOT_THIS_ONE_OR_THE_NEXT);

		/* AND NONE OF THE THREE WROTE ANYTHING, which is the half a status code does not
		   carry: a route that refused after it had already updated the row would answer 400
		   and leave the league renamed. */
		assertThat(db.sql("select slug, name, season from league where id = ?").param(acted)
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getInt(3)))
				.single())
				.containsExactly("druga-2028", "Druga liga 2028", RUNNING);
		assertThat(seasonOf(empty)).isEqualTo(NEXT);
	}

	@Test
	void changingALeagueThatIsNotThereIsAnsweredWithNothingAtAll() throws Exception {
		MockHttpServletResponse answer = change(theKeyNobodyHolds(),
				new LeagueWriteApi.Upsert("Zimska", "zimska-liga", RUNNING, "", ""));

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString())
				.as("a league somebody may not touch and one that is not there have to read the"
						+ " same, and a reason is something only one of them could have")
				.isEmpty();
	}

	@Test
	void aLeagueKeepsItsOwnAddressAndMayNotTakeAnother() throws Exception {
		assertThat(change(acted, new LeagueWriteApi.Upsert("Druga liga 2028", "prva-2028", RUNNING,
				"", "")).getStatus()).isEqualTo(409);
		assertThat(nameOf(neighbour)).isEqualTo("Prva liga 2028");

		assertThat(change(acted, new LeagueWriteApi.Upsert("Isto ime", "druga-2028", RUNNING,
				"", "")).getStatus())
				.as("a league saved twice at its own address finds its own row and is refused by a"
						+ " check that forgot to leave itself out")
				.isEqualTo(200);
		assertThat(nameOf(acted)).isEqualTo("Isto ime");
	}

	/**
	 * THE SEASON CANNOT MOVE UNDER A LEAGUE THAT COUNTS RACES, and it MAY move under one
	 * that counts none - which is the same route answering two ways about one field.
	 *
	 * <p>Both halves are here because the refusal is the schema's (see
	 * {@link LeagueWriteApi#change}): {@code league_race_league_fk} carries no
	 * {@code on update cascade}, so the first half is „told why instead of a 500" and the
	 * second is „and nothing else was quietly forbidden along with it".
	 */
	@Test
	void theSeasonMovesUnderALeagueThatCountsNothingAndNotUnderOneThatCountsSomething()
			throws Exception {
		MockHttpServletResponse refused = change(acted, new LeagueWriteApi.Upsert("Druga liga",
				"druga-2028", NEXT, "", ""));

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(refused.getContentAsString())
				.contains(LeagueWriteApi.THE_SEASON_CANNOT_MOVE_WHILE_RACES_COUNT);
		assertThat(seasonOf(acted)).isEqualTo(RUNNING);

		assertThat(change(empty, new LeagueWriteApi.Upsert("Naredna liga", "naredna-2029", RUNNING,
				"", "")).getStatus()).isEqualTo(200);
		assertThat(seasonOf(empty)).isEqualTo(RUNNING);
	}

	@Test
	void aLeagueIsDeletedWithTheRowsThatSaidWhatItCountedAndWithNobodyElsesEver()
			throws Exception {
		assertThat(remove(acted).getStatus()).isEqualTo(204);

		assertThat(howManyLeagues()).isEqualTo(3);
		assertThat(counted(acted)).isEmpty();
		assertThat(counted(neighbour))
				.as("the neighbour's own list went with it, so the delete reached further than the"
						+ " league it was asked about")
				.containsExactly(theSecondOfThree);
	}

	/**
	 * AND A FROZEN ONE IS DELETED TOO, WHICH IS THE OWNER'S OWN CORRECTION (PDL P15c).
	 *
	 * <p>He overturned the cost I put on this and he was right to: V17 provided for it.
	 * What is measured is the sentence in V17's heading - the standing stays, with the
	 * league's name on it - and the pointer emptying is the foreign key's doing rather than
	 * this route's.
	 */
	@Test
	void aLeagueWhoseSeasonHasFrozenIsDeletedAndItsStandingStaysWithItsName() throws Exception {
		assertThat(remove(frozen).getStatus()).isEqualTo(204);

		assertThat(db.sql("select league_name, position from season_league_standing"
						+ " where season = ?").param(FROZEN)
				.query((row, one) -> List.of(row.getString(1), row.getInt(2)))
				.single())
				.as("the standing of a deleted league lost the name it carried its own copy of")
				.containsExactly("Zimska liga 2027", 1);
		assertThat(db.sql("select count(*) from season_league_standing where season = ?"
						+ " and league_id is not null").param(FROZEN).query(Long.class).single())
				.as("the standing still points at a league that is gone")
				.isZero();

		assertThat(db.sql("select league_id from season_league_standing where season = ?")
				.param(RUNNING).query(Long.class).single())
				.as("the other season's standing lost its league as well, so the emptying reached"
						+ " past the row that was deleted")
				.isEqualTo(neighbour);
	}

	@Test
	void deletingALeagueThatIsNotThereIsAnsweredWithNothingAtAll() throws Exception {
		MockHttpServletResponse answer = remove(theKeyNobodyHolds());

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
		assertThat(howManyLeagues()).isEqualTo(4);
	}

	/**
	 * ONE RACE, CHOSEN OFF A DAY OF THREE (PDL P15a, owner 22.09.2026: „jednu po jednu").
	 *
	 * <p>The one chosen is the SECOND of its day, so a route reading the event and taking
	 * its first race answers with a number this case refuses.
	 */
	@Test
	void oneRaceOfADayEntersALeagueAndTheOthersOfThatDayStayOut() throws Exception {
		assertThat(countRace(acted, theSecondOfThree).getStatus()).isEqualTo(204);

		assertThat(counted(acted)).containsExactlyInAnyOrder(theSecondOfThree, theThirdOfThree);
		assertThat(counted(neighbour))
				.as("the neighbour already counted this race and the write reached its rows too")
				.containsExactly(theSecondOfThree);
	}

	/**
	 * AND CHOOSING THE DAY WRITES EVERY RACE OF IT, which is the screen's convenience and
	 * never a second fact (V19, owner 12.09.2026).
	 */
	@Test
	void choosingADayEntersEveryRaceOfItAndNothingOfAnyOtherDay() throws Exception {
		assertThat(countDay(acted, theDayWithTwoRaces).getStatus()).isEqualTo(204);

		assertThat(counted(acted))
				.containsExactlyInAnyOrderElementsOf(withAdded(racesUnder(theDayWithTwoRaces),
						theThirdOfThree));
		assertThat(counted(acted)).doesNotContain(aRaceNobodyCounts);
	}

	@ParameterizedTest
	@CsvSource({"true, true", "false, false"})
	void namingBothARaceAndADayAndNamingNeitherAreTheSameRefusal(boolean race, boolean day)
			throws Exception {
		MockHttpServletResponse answer = http.perform(post("/api/leagues/" + acted + "/races")
						.with(csrf()).contentType(MediaType.APPLICATION_JSON)
						.content(json(new LeagueWriteApi.Counting(race ? theSecondOfThree : null,
								day ? theDayWithTwoRaces : null)))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString()).contains(LeagueWriteApi.THE_RACE_IS_NOT_SAID_ONCE);
		assertThat(counted(acted)).containsExactly(theThirdOfThree);
	}

	/**
	 * A RACE OF ANOTHER YEAR CANNOT COUNT, AND THE SCHEMA IS STILL WHAT SAYS SO.
	 *
	 * <p>V19 put the season inside both of {@code league_race}'s foreign keys so that nobody
	 * has to remember the rule. What the route adds is the SENTENCE: without it the row is
	 * handed to PostgreSQL and an administrator meets a 500 after filling in a form.
	 */
	@Test
	void aRaceOfAnotherYearIsRefusedWithASentenceAndNothingIsWritten() throws Exception {
		MockHttpServletResponse answer = countRace(acted, aRaceOfTheFrozenSeason);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(answer.getContentAsString())
				.contains(LeagueWriteApi.THE_RACE_IS_NOT_OF_THE_LEAGUES_SEASON);
		assertThat(counted(acted)).containsExactly(theThirdOfThree);
	}

	/**
	 * AND A DAY THAT STRADDLES A NEW YEAR ENTERS WHOLE OR NOT AT ALL.
	 *
	 * <p>The one arrangement in which „every race of that day" is not all of one season, and
	 * the only one that tells „refused" apart from „wrote the half that fitted". An event may
	 * run over more than one morning (V7) and nothing stops the two falling either side of 1
	 * January.
	 */
	@Test
	void aDayWhoseRacesFallInTwoSeasonsEntersWholeOrNotAtAll() throws Exception {
		MockHttpServletResponse answer = countDay(acted, theDayThatStraddlesTheNewYear);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(answer.getContentAsString())
				.contains(LeagueWriteApi.THE_RACE_IS_NOT_OF_THE_LEAGUES_SEASON);
		assertThat(counted(acted))
				.as("the half of the day that fitted the season was written, so a competition now"
						+ " counts a morning of a day nobody entered whole")
				.containsExactly(theThirdOfThree);
	}

	@Test
	void aRaceThatAlreadyCountsIsNotASecondFact() throws Exception {
		assertThat(countRace(acted, theThirdOfThree).getStatus()).isEqualTo(204);

		assertThat(counted(acted)).containsExactly(theThirdOfThree);
	}

	@Test
	void aRaceNobodyHasIsRefusedAndSoIsADayNobodyHas() throws Exception {
		MockHttpServletResponse noRace = countRace(acted, theKeyNobodyHolds());

		assertThat(noRace.getStatus()).isEqualTo(400);
		assertThat(noRace.getContentAsString()).contains(LeagueWriteApi.THE_RACE_IS_NOT_KNOWN);

		MockHttpServletResponse noDay = countDay(acted, theKeyNobodyHolds());

		assertThat(noDay.getStatus()).isEqualTo(400);
		assertThat(noDay.getContentAsString()).contains(LeagueWriteApi.THE_EVENT_IS_NOT_KNOWN);
		assertThat(counted(acted)).containsExactly(theThirdOfThree);
	}

	/**
	 * AND A DAY THAT IS REALLY THERE AND HOLDS NOTHING YET SAYS THE OTHER THING.
	 *
	 * <p>Two sentences rather than one, because they send an administrator to two different
	 * places: a key nothing answers to is a form that is wrong, and an event entered before
	 * its distances are known is a calendar he finishes filling in.
	 */
	@Test
	void aDayWithNoRacesUnderItYetSaysSoRatherThanThatItIsNotThere() throws Exception {
		MockHttpServletResponse answer = countDay(acted, theDayWithNoRaces);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString()).contains(LeagueWriteApi.THE_EVENT_HOLDS_NO_RACES);
	}

	/**
	 * AND AFTER THE SEASON FREEZES, NOTHING ENTERS (PDL P15a, owner 22.09.2026).
	 *
	 * <p>His own words about his own sentence: „dodavanje <b>tokom</b> sezone je dozvoljeno,
	 * dodavanje <b>posle zamrzavanja</b> nije."
	 */
	@Test
	void noRaceEntersALeagueWhoseSeasonHasFrozen() throws Exception {
		long anotherOfThatYear = race(db.sql("select event_id from race where id = ?")
				.param(aRaceOfTheFrozenSeason).query(Long.class).single(), "Druga stara",
				"2027-05-06");

		MockHttpServletResponse answer = countRace(frozen, anotherOfThatYear);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(answer.getContentAsString()).contains(LeagueWriteApi.THE_SEASON_IS_FROZEN);
		assertThat(counted(frozen)).containsExactly(aRaceOfTheFrozenSeason);
	}

	@Test
	void enteringARaceIntoALeagueThatIsNotThereIsAnsweredWithNothingAtAll() throws Exception {
		MockHttpServletResponse answer = countRace(theKeyNobodyHolds(), theSecondOfThree);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
	}

	/**
	 * A RACE LEAVES ONE COMPETITION AND GOES ON COUNTING TOWARDS THE OTHER.
	 *
	 * <p>One race may count towards several competitions of the same season (owner,
	 * 12.09.2026), which is why {@code league_race_pk} is over the PAIR. A statement naming
	 * the race alone passes every other case in this file and fails this one.
	 */
	@Test
	void aRaceLeavesOneCompetitionAndStaysInTheOther() throws Exception {
		assertThat(countRace(acted, theSecondOfThree).getStatus()).isEqualTo(204);

		assertThat(stopCounting(acted, theSecondOfThree).getStatus()).isEqualTo(204);

		assertThat(counted(acted)).containsExactly(theThirdOfThree);
		assertThat(counted(neighbour)).containsExactly(theSecondOfThree);
	}

	/**
	 * AND IT LEAVES A FROZEN ONE TOO (PDL P15c, owner 22.09.2026: „Pod 2, mogu da je izbacim
	 * rucno"), which is the one place this pair of routes is deliberately not symmetrical.
	 */
	@Test
	void aRaceLeavesALeagueWhoseSeasonHasFrozen() throws Exception {
		assertThat(stopCounting(frozen, aRaceOfTheFrozenSeason).getStatus()).isEqualTo(204);

		assertThat(counted(frozen)).isEmpty();
	}

	@Test
	void takingOutARaceThatNeverCountedAndOneOfAnotherLeagueAreBothAnsweredWithNothing()
			throws Exception {
		assertThat(stopCounting(acted, aRaceNobodyCounts).getStatus()).isEqualTo(404);

		assertThat(stopCounting(acted, theSecondOfThree).getStatus())
				.as("this race counts towards the NEIGHBOUR and not towards this league, so a"
						+ " statement that forgot which league it was reading took it away")
				.isEqualTo(404);
		assertThat(counted(neighbour)).containsExactly(theSecondOfThree);
	}

	/**
	 * AND ONE CASE FOR DEFENCE IN DEPTH, although {@code RightsAtTheDoorTest} sweeps all
	 * five of these routes by asking the dispatcher.
	 */
	@Test
	void nobodySignedInWritesNothing() throws Exception {
		MockHttpServletResponse answer = http.perform(post("/api/leagues").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(json(new LeagueWriteApi.Upsert("Zimska", "zimska-liga", RUNNING,
								"", ""))))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(401);
		assertThat(howManyLeagues()).isEqualTo(4);
	}

	private long league(String slug, String name, int season) {
		return db.sql("insert into league (slug, name, season, rules, prizes)"
						+ " values (?, ?, ?, ?, ?) returning id")
				.params(slug, name, season, "Pravila " + slug, "Nagrade " + slug)
				.query(Long.class).single();
	}

	private long event(String slug, String day) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, date '" + day + "',"
						+ " (select id from place where rank = 1), null, null, 'race', false,"
						+ " '', '') returning id")
				.params(slug, "Dogadjaj " + slug).query(Long.class).single();
	}

	private long race(long event, String name, String day) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, ?, false, date '" + day
						+ "', 'length', 0, 10.00, 0, 0) returning id")
				.params(event, name).query(Long.class).single();
	}

	private void counts(long league, long race) {
		db.sql("insert into league_race (league_id, season, race_id)"
						+ " select ?, season, ? from league where id = ?")
				.params(league, race, league).update();
	}

	/** A frozen standing, which is what a deleted league must leave standing. */
	private void stoodAt(long league, String named, int season, int position) {
		db.sql("insert into season_league_standing (season, league_id, league_name, position,"
						+ " competitor_id, who, gender, points) values (?, ?, ?, ?, null, null,"
						+ " 'M', 12.34)")
				.params(season, league, named, position).update();
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

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private MockHttpServletResponse add(LeagueWriteApi.Upsert typed) throws Exception {
		return http.perform(post("/api/leagues").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(typed))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse change(long id, LeagueWriteApi.Upsert typed) throws Exception {
		return http.perform(put("/api/leagues/" + id).with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(typed))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse remove(long id) throws Exception {
		return http.perform(delete("/api/leagues/" + id).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse countRace(long league, long race) throws Exception {
		return counting(league, new LeagueWriteApi.Counting(race, null));
	}

	private MockHttpServletResponse countDay(long league, long event) throws Exception {
		return counting(league, new LeagueWriteApi.Counting(null, event));
	}

	private MockHttpServletResponse counting(long league, LeagueWriteApi.Counting asked)
			throws Exception {
		return http.perform(post("/api/leagues/" + league + "/races").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(json(asked))
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse stopCounting(long league, long race) throws Exception {
		return http.perform(delete("/api/leagues/" + league + "/races/" + race).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session)))
				.andReturn().getResponse();
	}

	private String json(Object typed) {
		return new ObjectMapper().writeValueAsString(typed);
	}

	private List<Long> counted(long league) {
		return db.sql("select race_id from league_race where league_id = ? order by race_id")
				.param(league).query(Long.class).list();
	}

	private List<Long> racesUnder(long event) {
		return db.sql("select id from race where event_id = ? order by id").param(event)
				.query(Long.class).list();
	}

	private long howManySeasonsUnder(long event) {
		return db.sql("select count(distinct season) from race where event_id = ?").param(event)
				.query(Long.class).single();
	}

	private static List<Long> withAdded(List<Long> these, long one) {
		return java.util.stream.Stream.concat(these.stream(), java.util.stream.Stream.of(one))
				.toList();
	}

	private long howManyLeagues() {
		return db.sql("select count(*) from league").query(Long.class).single();
	}

	private String nameOf(long league) {
		return db.sql("select name from league where id = ?").param(league)
				.query(String.class).single();
	}

	private int seasonOf(long league) {
		return db.sql("select season from league where id = ?").param(league)
				.query(Integer.class).single();
	}

	/** A key no row holds, asked of the table rather than written out as a big number. */
	private long theKeyNobodyHolds() {
		return db.sql("select coalesce(max(id), 0) + 1 from league").query(Long.class).single()
				+ db.sql("select coalesce(max(id), 0) + 1 from race").query(Long.class).single()
				+ db.sql("select coalesce(max(id), 0) + 1 from btl_event").query(Long.class)
				.single();
	}
}

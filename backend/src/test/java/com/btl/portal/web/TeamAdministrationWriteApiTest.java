package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.TheEndOfTheTransaction;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.lang.reflect.RecordComponent;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE ADMINISTRATION CHANGING A TEAM DIRECTLY, END TO END: what the row becomes, what it keeps,
 * and who is turned away before anything is written.
 *
 * <p><b>NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on every axis an assertion below reads a
 * value along:
 *
 * <ul>
 * <li><b>Three teams, and the one every case changes is written SECOND</b>, so „the team in the
 * address", „the first team" and „the last team" are three different keys and a statement that
 * lost its condition writes into the wrong one where it can be seen.
 * <li><b>The team being changed carries everything the form does not ask for</b> - a description,
 * a link, a mark and a first season that is neither the clock's year nor the season a team made
 * today would collect from - so „left as it was" cannot be satisfied by an empty column.
 * <li><b>It stands on a row of the world codebook</b>, so the typed town a change writes is a
 * different shape from the one it replaces and „the town was written" is not „the town was
 * already there". <b>One case starts from the other shape instead</b>, a team whose town is
 * already typed, which is the shape a team the portal makes comes out with, so „the town was
 * written" is not „the town was kept" either.
 * <li><b>Its seat is held by the member who joined LATER</b> ({@link #THE_SEAT}, from
 * {@link #A_SEASON_STILL_TO_COME}), while {@link #THE_LONGEST} has stood in it since
 * {@link #A_SEASON_ALREADY_RUNNING}. „The seat as it stands" and „the seat the standing rule
 * would pick" are two different people, and so a seat left alone is told apart from a seat
 * worked out again.
 * <li><b>Three people who may not take the seat, each for a different reason</b>: a member of
 * another team, a member of this one whose fee has lapsed, and a number nobody has.
 * <li><b>A change the team's own administrator sent is waiting in the queue</b>, under a name of
 * its own, so „the queue was left alone" is not satisfied by a queue with nothing in it.
 * <li><b>Every name a case sends that is meant to be kept carries spaces around it</b>, so an
 * answer echoed off the request and an answer read off the row are two different strings.
 * <li><b>The clock stands OUTSIDE the transfer window</b> for every case but the one that moves
 * it, so a route that started asking the window would refuse nearly everything below.
 * </ul>
 *
 * <p><b>Where the door is measured, and where it is not.</b> {@code RightsAtTheDoorTest} sweeps
 * every route a right guards for somebody who is not signed in and for a plain member. What it
 * cannot see is WHICH right: here a moderator holding the queue of teams, one holding another
 * entity, the team's own administrator and a plain member of it are all refused, while the two
 * ways into {@link TeamApi#OVER_THE_TEAMS} - a ticked box and the superadmin's mode - both pass.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TeamAdministrationWriteApiTest {

	/** 12:00 in Belgrade on 15 June 2027: the transfer window is shut. */
	private static final Instant OUTSIDE_THE_WINDOW = Instant.parse("2027-06-15T10:00:00Z");

	/** 11:00 in Belgrade on 10 November 2027: the transfer window is open. */
	private static final Instant INSIDE_THE_WINDOW = Instant.parse("2027-11-10T10:00:00Z");

	/** Written first, so it holds the smallest key of the three. Its name is the taken one. */
	private static final String FIRST_TEAM = "prvi-tim";

	private static final String FIRST_TEAMS_NAME = "Prvi tim";

	/** The team every case changes, written second. */
	private static final String THE_TEAM = "dunavski-trkaci";

	private static final String THE_TEAMS_NAME = "Dunavski trkači";

	/** Written last, so it holds the largest key, and somebody stands in it. */
	private static final String ANOTHER_TEAM = "savski-trkaci";

	private static final String ANOTHER_TEAMS_NAME = "Savski trkači";

	/** What the team says about itself, which the administration's form never asks for. */
	private static final String ITS_BIO = "Trčimo uz Dunav, subotom ujutru.";

	private static final String ITS_LINK = "https://dunavski-trkaci.example";

	/**
	 * The season every team in the fixture collects from: neither the clock's year nor the season a
	 * team made on either day of this file would start in, so nothing below can satisfy „left as it
	 * was" by writing a season it worked out.
	 */
	private static final int ITS_FIRST_SEASON = 2030;

	private static final int A_SEASON_ALREADY_RUNNING = 2027;

	private static final int A_SEASON_STILL_TO_COME = 2029;

	/** Sits in the seat, and joined for a season that has not begun. */
	private static final String THE_SEAT = "000110";

	/** Has stood in the team since the season that is running, and sits in nothing. */
	private static final String THE_LONGEST = "000120";

	/** In the team on the record, and his fee has lapsed, so he stands in it nowhere. */
	private static final String LAPSED = "000130";

	/** Stands in {@link #ANOTHER_TEAM}. */
	private static final String ELSEWHERE = "000140";

	/** A member number nobody has. */
	private static final String NOBODY_HAS_IT = "999999";

	private static final String MODERATOR_OVER_TEAMS = "timovi@primer.rs";

	private static final String THE_SUPERADMIN = "superadmin@primer.rs";

	/** Holds the queue of teams and not the teams: he decides proposals, nothing else. */
	private static final String MODERATOR_OVER_THE_QUEUE = "red-timova@primer.rs";

	private static final String MODERATOR_OVER_SOMETHING_ELSE = "dogadjaji@primer.rs";

	/** {@link #THE_SEAT}'s own account: he runs the team and holds no right at all. */
	private static final String THE_TEAMS_OWN_ADMINISTRATOR = "sediste@primer.rs";

	/** {@link #THE_LONGEST}'s own account. */
	private static final String A_PLAIN_MEMBER = "najduze@primer.rs";

	/** The name the change waiting in the queue asks for, which no case sends. */
	private static final String THE_WAITING_CHANGES_NAME = "Dunavski trkači Zemun";

	/** No country is served under it, and the fixture says so out loud below. */
	private static final String A_COUNTRY_NOBODY_SERVES = "QQ";

	/**
	 * The administration's own form, read off the working tree rather than described: what the
	 * screen sends is a fact about a file, and a sentence claiming to know it is worth nothing.
	 */
	private static final Path THE_ADMINISTRATIONS_FORM =
			Path.of("..", "frontend", "src", "forms", "definitions", "admin-tim.form.json");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/** The key of the team every case changes, kept from the moment it is written: no change moves it. */
	private long theTeamsKey;

	private long theLogo;

	private long theWaitingChange;

	/**
	 * A CLOCK THE CASE MOVES, so that the day the window is shut and the day it is open are one
	 * fixture and two assertions. Nothing in the route reads it today, and that is what the case
	 * about the window holds: a route that began asking the window off the {@link Clock} bean, the
	 * way every other route on this server asks it, would be refused on the shut day.
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
			return new AClockTheCaseMoves(OUTSIDE_THE_WINDOW);
		}
	}

	@BeforeEach
	void threeTeamsAndEveryoneWhoMightAskAboutTheMiddleOne() {
		clock.moveTo(OUTSIDE_THE_WINDOW);

		team(FIRST_TEAM, FIRST_TEAMS_NAME);
		team(THE_TEAM, THE_TEAMS_NAME);
		team(ANOTHER_TEAM, ANOTHER_TEAMS_NAME);

		theTeamsKey = db.sql("select id from team where slug = ?").param(THE_TEAM)
				.query(Long.class).single();

		theLogo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 100, ?, 0.5, 0.5, 1) returning id")
				.param("a".repeat(64))
				.query(Long.class)
				.single();

		db.sql("update team set bio = ?, link = ?, logo_id = ? where slug = ?")
				.params(ITS_BIO, ITS_LINK, theLogo, THE_TEAM).update();

		competitor(THE_SEAT);
		competitor(THE_LONGEST);
		competitor(LAPSED);
		competitor(ELSEWHERE);

		db.sql("update competitor set active = false where member_number = ?").param(LAPSED).update();

		inATeam(THE_LONGEST, THE_TEAM, A_SEASON_ALREADY_RUNNING);
		inATeam(THE_SEAT, THE_TEAM, A_SEASON_STILL_TO_COME);
		inATeam(LAPSED, THE_TEAM, A_SEASON_ALREADY_RUNNING);
		inATeam(ELSEWHERE, ANOTHER_TEAM, A_SEASON_ALREADY_RUNNING);

		seatOf(THE_TEAM, competitorId(THE_SEAT));

		moderator(MODERATOR_OVER_TEAMS);
		ticked(MODERATOR_OVER_TEAMS, TeamApi.OVER_THE_TEAMS);

		moderator(MODERATOR_OVER_THE_QUEUE);
		ticked(MODERATOR_OVER_THE_QUEUE, "queue:teams");

		moderator(MODERATOR_OVER_SOMETHING_ELSE);
		ticked(MODERATOR_OVER_SOMETHING_ELSE, "entity:events");

		superadmin(THE_SUPERADMIN);

		member(THE_TEAMS_OWN_ADMINISTRATOR, THE_SEAT);
		member(A_PLAIN_MEMBER, THE_LONGEST);

		theWaitingChange = aChangeWaitingFor(THE_TEAM, THE_SEAT, THE_WAITING_CHANGES_NAME);
	}

	/**
	 * THE FIXTURE SAYS WHAT IT CLAIMS TO SAY, asked of the database rather than trusted from the
	 * constants above. Each line is a way the whole file could measure nothing.
	 */
	@Test
	void theFixtureSeparatesTheAxesItSaysItSeparates() {
		assertThat(theTeam())
				.as("the team every case changes holds the smallest or the largest key, so a statement"
						+ " that writes into the first or the last team writes into the right one")
				.isNotEqualTo(db.sql("select min(id) from team").query(Long.class).single())
				.isNotEqualTo(db.sql("select max(id) from team").query(Long.class).single());

		assertThat(db.sql("select bio <> '' and link <> '' and logo_id is not null"
						+ " and place_id is not null and city is null and country_id is null"
						+ " and first_season = ? from team where slug = ?")
				.params(ITS_FIRST_SEASON, THE_TEAM).query(Boolean.class).single())
				.as("the team being changed does not carry everything the form leaves alone, or its"
						+ " town is not the codebook's, so 'left as it was' is satisfied by nothing")
				.isTrue();

		assertThat(List.of(
				SeasonClock.transfersTakeEffect(OUTSIDE_THE_WINDOW.atZone(SeasonClock.ZONE)),
				SeasonClock.transfersTakeEffect(INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE)),
				OUTSIDE_THE_WINDOW.atZone(SeasonClock.ZONE).getYear()))
				.as("the team's first season is a number this file's clock could work out")
				.doesNotContain(ITS_FIRST_SEASON);

		assertThat(db.sql("with standing as (" + TeamApi.WHO_STANDS_IN_A_TEAM + ")"
						+ " select s.member_number from standing s"
						+ " join team t on t.id = s.team_id where t.slug = ?"
						+ " order by s.season_from, s.member_number")
				.param(THE_TEAM).query(String.class).list())
				.as("who stands in the team being changed, longest first: the lapsed member must"
						+ " not, and the seat's holder must not be the longest standing")
				.containsExactly(THE_LONGEST, THE_SEAT);

		assertThat(db.sql("select count(*) from team_membership m join competitor c"
						+ " on c.id = m.competitor_id join team t on t.id = m.team_id"
						+ " where c.member_number = ? and t.slug = ? and m.season_to is null")
				.params(LAPSED, THE_TEAM).query(Long.class).single())
				.as("the lapsed member is not in the team on the record, so refusing him says nothing"
						+ " about the fee")
				.isEqualTo(1L);

		assertThat(db.sql("with standing as (" + TeamApi.WHO_STANDS_IN_A_TEAM + ")"
						+ " select t.slug from standing s join team t on t.id = s.team_id"
						+ " where s.member_number = ?")
				.param(ELSEWHERE).query(String.class).list())
				.containsExactly(ANOTHER_TEAM);

		assertThat(db.sql("select count(*) from competitor where member_number = ?")
				.param(NOBODY_HAS_IT).query(Long.class).single())
				.isZero();

		assertThat(db.sql("select count(*) from country where code = ?")
				.param(A_COUNTRY_NOBODY_SERVES).query(Long.class).single())
				.as("the country this file calls unknown is one the codebook serves")
				.isZero();

		assertThat(SeasonClock.transferWindowOpen(OUTSIDE_THE_WINDOW.atZone(SeasonClock.ZONE)))
				.as("the day this file calls outside the window is inside it")
				.isFalse();
		assertThat(SeasonClock.transferWindowOpen(INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE)))
				.as("the day this file calls inside the window is outside it")
				.isTrue();

		assertThat(theWaitingChange())
				.as("the change waiting in the queue is not waiting, or is not about this team")
				.isEqualTo(List.of(String.valueOf(theTeam()), THE_WAITING_CHANGES_NAME, "waiting"));
	}

	/**
	 * THE ADMINISTRATION CHANGES THE NAME, THE TOWN AND THE SEAT, AND THE TEAM IS WHAT IT SENT.
	 *
	 * <p>PDL, „Administracija pravi i menja tim direktno, bez reda za moderaciju" (09.10.2026, the
	 * journal's wording of the owner's choice). The two ways into {@link TeamApi#OVER_THE_TEAMS}
	 * arrive by different roads - a ticked box, and the superadmin's mode - and a route asking the
	 * wrong one of those two questions passes for one and fails for the other.
	 *
	 * <p><b>The body is written with the form's own names and not built from the record</b>, so
	 * the case also says that what the screen sends is what the route reads: a request built from
	 * {@link TeamAdministrationWriteApi.Changed} would agree with the record whatever either said.
	 */
	@ParameterizedTest
	@ValueSource(strings = {MODERATOR_OVER_TEAMS, THE_SUPERADMIN})
	void theAdministrationChangesTheNameTheTownAndTheSeat(String who) throws Exception {
		MockHttpServletResponse answer = changeAs(who, theTeam(),
				form("  Dunavski trkači Vukovar  ", "  Vukovar  ", "HR", THE_LONGEST));

		assertThat(answer.getStatus()).as("%s could not change a team", who).isEqualTo(200);

		assertThat(theRowOf(theTeam())).containsExactly(
				"dunavski-trkaci-vukovar", "Dunavski trkači Vukovar", "no place", "Vukovar", "HR",
				String.valueOf(competitorId(THE_LONGEST)));

		JsonNode said = mapper.readTree(answer.getContentAsString());

		assertThat(List.of(said.path("id").asLong(), said.path("slug").asString(),
				said.path("name").asString()))
				.as("the answer is not the row as it now stands")
				.isEqualTo(List.of(theTeam(), "dunavski-trkaci-vukovar", "Dunavski trkači Vukovar"));

		assertThat(db.sql("select slug, name from team where slug <> ? order by id")
				.param("dunavski-trkaci-vukovar")
				.query((row, one) -> row.getString(1) + " " + row.getString(2)).list())
				.as("a team the request did not name was written into")
				.containsExactly(FIRST_TEAM + " " + FIRST_TEAMS_NAME,
						ANOTHER_TEAM + " " + ANOTHER_TEAMS_NAME);
	}

	/**
	 * A TOWN THAT WAS ALREADY TYPED IS REPLACED, AND ITS COUNTRY WITH IT, NOT KEPT BECAUSE IT IS
	 * THERE.
	 *
	 * <p>Every other case changes a team that stands on a row of the codebook, with no typed town
	 * and no country, so a statement that keeps what a column already holds
	 * ({@code coalesce(city, ?)}, {@code coalesce(country_id, ?)}) writes the right value over
	 * both of those empty columns, and no other case could tell it from the right statement. The
	 * shape that matters is the other one {@code team_town_is_from_the_codebook_or_typed} allows,
	 * and it is the shape a team the portal makes comes out with: {@link TeamWriteApi#propose}
	 * writes the town of a proposal as typed, and the approval copies it into the team.
	 *
	 * <p>The town the team starts with, the town the request sends and the town the change waiting
	 * in the queue carries are three different towns in three different countries, so whichever of
	 * them a wrong statement writes is told from the right one. The form is the one the list's
	 * cell sends, with the seat left out, so the town and its country are all that move.
	 */
	@Test
	void aTownThatWasTypedIsReplacedAndItsCountryWithIt() throws Exception {
		townTypedOf(THE_TEAM, "Banja Luka", "BA");

		assertThat(theRowOf(theTeam()).subList(2, 5))
				.as("the team was not given a typed town, so the change below replaces nothing")
				.containsExactly("no place", "Banja Luka", "BA");

		assertThat(changeAs(MODERATOR_OVER_TEAMS, theTeam(), form(THE_TEAMS_NAME, "Vukovar", "HR"))
				.getStatus())
				.isEqualTo(200);

		assertThat(theRowOf(theTeam()).subList(2, 5))
				.as("a town that was already typed was kept, or the country it stands in was")
				.containsExactly("no place", "Vukovar", "HR");
	}

	/**
	 * WHAT THE FORM DOES NOT ASK FOR IS LEFT AS IT WAS, AND THE MARK MOST OF ALL.
	 *
	 * <p>The class's own reasoning, marked there as reasoning and not a decision: a change sent
	 * from a form must not quietly empty what the form never offered to change. The mark's row is
	 * read after the end of the transaction is brought forward, because an emptied
	 * {@code logo_id} takes its {@code photo} row only then (V54), and before that it would still
	 * be standing whatever the route had done.
	 */
	@Test
	void nothingTheFormDoesNotAskForIsTouched() throws Exception {
		List<String> memberships = theMemberships();

		assertThat(changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form("  Dunavski trkači Vukovar  ", "  Vukovar  ", "HR", THE_LONGEST)).getStatus())
				.isEqualTo(200);

		assertThat(db.sql("select bio, link, logo_id, first_season from team where id = ?")
				.param(theTeam())
				.query((row, one) -> List.of(row.getString(1), row.getString(2),
						String.valueOf(row.getObject(3)), String.valueOf(row.getInt(4))))
				.single())
				.containsExactly(ITS_BIO, ITS_LINK, String.valueOf(theLogo),
						String.valueOf(ITS_FIRST_SEASON));

		assertThat(theMemberships())
				.as("who is in a team moved with a change of its name, town and seat")
				.isEqualTo(memberships);

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(db.sql("select exists(select 1 from photo where id = ?)").param(theLogo)
				.query(Boolean.class).single())
				.as("the team's mark went with a change that never asked about it")
				.isTrue();
	}

	/**
	 * A TEAM IS NEVER REFUSED THE ADDRESS IT ALREADY HAS, which is where the source of „taken" and
	 * the thing being changed are the same row.
	 *
	 * <p>Capitals, the hooks over letters and the script all leave the address where it is (ADL,
	 * „Velika slova, kvačice i znaci interpunkcije se ne računaju kao razlika"), so each of these
	 * is the team's own address, and each is kept as it was typed.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"  Dunavski trkači  ", "  DUNAVSKI TRKACI  ", "  Дунавски тркачи  "})
	void theTeamsOwnAddressNeverClashesWithItself(String name) throws Exception {
		assertThat(changeAs(MODERATOR_OVER_TEAMS, theTeam(), form(name, "Novi Sad", "RS")).getStatus())
				.as("%s was refused for clashing with the team it is the name of", name)
				.isEqualTo(200);

		assertThat(theRowOf(theTeam()).subList(0, 2)).containsExactly(THE_TEAM, name.strip());
	}

	/**
	 * A NAME WHOSE ADDRESS ANOTHER TEAM ANSWERS AT IS REFUSED, AND NOTHING MOVES.
	 *
	 * <p>Measured by the address and not by the letters, so the three spellings below are one
	 * team's address and the first team's.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"  Prvi tim  ", "  PRVI TIM!  ", "  Први тим  "})
	void aNameAnotherTeamAnswersAtIsRefused(String name) throws Exception {
		MockHttpServletResponse answer = changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form(name, "Vukovar", "HR", THE_LONGEST));

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(TeamAdministrationWriteApi.THE_ADDRESS_IS_TAKEN);
		assertThat(theRowOf(theTeam())).isEqualTo(asItStood());
	}

	/** PDL P13: a name that makes no address is refused rather than made into a page nobody opens. */
	@ParameterizedTest
	@ValueSource(strings = {"  !!! ---  ", "  Υψηλάντειος  ", "  ...  "})
	void aNameNoPageCouldBeOpenedAtIsRefused(String name) throws Exception {
		MockHttpServletResponse answer = changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form(name, "Vukovar", "HR"));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(TeamAdministrationWriteApi.THE_NAME_MAKES_NO_ADDRESS);
		assertThat(theRowOf(theTeam())).isEqualTo(asItStood());
	}

	/** Absent, empty and a run of spaces are one answer in each of the three fields. */
	@ParameterizedTest
	@CsvSource(nullValues = "NIC", value = {
			"NIC, Vukovar, HR", "'', Vukovar, HR", "'   ', Vukovar, HR",
			"Dobar tim, NIC, HR", "Dobar tim, '', HR", "Dobar tim, '   ', HR",
			"Dobar tim, Vukovar, NIC", "Dobar tim, Vukovar, ''", "Dobar tim, Vukovar, '   '"})
	void aFormMissingSomethingIsRefused(String name, String city, String country) throws Exception {
		MockHttpServletResponse answer = changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form(name, city, country, THE_LONGEST));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(TeamAdministrationWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(theRowOf(theTeam())).isEqualTo(asItStood());
	}

	@Test
	void aCountryNobodyServesIsRefused() throws Exception {
		MockHttpServletResponse answer = changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form("Dobar tim", "Vukovar", A_COUNTRY_NOBODY_SERVES, THE_LONGEST));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(TeamAdministrationWriteApi.THE_COUNTRY_IS_NOT_KNOWN);
		assertThat(theRowOf(theTeam())).isEqualTo(asItStood());
	}

	/**
	 * A REQUEST THAT DOES NOT NAME THE SEAT LEAVES IT AS IT STANDS, IN EVERY SHAPE A SEAT TAKES.
	 *
	 * <p>The cell that changes a town on the list does not speak for the seat, and the seat is
	 * served to the administration in four shapes: a member, a member who no longer stands in the
	 * team, somebody who holds it with no member number, and nobody. Left alone is what each of
	 * them must stay, and the middle two are where „left alone" and „worked out again by the
	 * standing rule" give different answers.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"the member who sits in it", "a member whose fee lapsed",
			"somebody with no member number", "nobody"})
	void aRequestThatDoesNotNameTheSeatLeavesItAsItStands(String whoSits) throws Exception {
		Long sitting = switch (whoSits) {
			case "the member who sits in it" -> competitorId(THE_SEAT);
			case "a member whose fee lapsed" -> competitorId(LAPSED);
			case "somebody with no member number" -> aCompetitorWithNoNumber();
			default -> null;
		};

		seatOf(THE_TEAM, sitting);

		assertThat(changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form("  Dunavski trkači Vukovar  ", "Vukovar", "HR")).getStatus())
				.isEqualTo(200);

		assertThat(theSeat()).as("the seat held by %s moved", whoSits).isEqualTo(sitting);
		assertThat(theRowOf(theTeam()).get(1)).isEqualTo("Dunavski trkači Vukovar");
	}

	/**
	 * AND A SEAT NAMED AS NOTHING IS THE SAME AS A SEAT NOT NAMED: null, empty and spaces.
	 *
	 * <p>Asked over the lapsed member's seat, where keeping it, emptying it and working it out
	 * again by the standing rule are three different answers.
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "NIC", value = {"NIC", "''", "'   '"})
	void aSeatNamedAsNothingIsASeatNotNamed(String organizer) throws Exception {
		seatOf(THE_TEAM, competitorId(LAPSED));

		assertThat(changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form("Dunavski trkači Vukovar", "Vukovar", "HR", organizer)).getStatus())
				.isEqualTo(200);

		assertThat(theSeat()).isEqualTo(competitorId(LAPSED));
	}

	/**
	 * THE SEAT GOES ONLY TO SOMEBODY STANDING IN THIS TEAM, and the whole request is refused with
	 * it: the name it carried is not written either.
	 */
	@ParameterizedTest
	@ValueSource(strings = {ELSEWHERE, LAPSED, NOBODY_HAS_IT})
	void theSeatGoesOnlyToSomebodyStandingInTheTeam(String number) throws Exception {
		MockHttpServletResponse answer = changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form("Dunavski trkači Vukovar", "Vukovar", "HR", number));

		assertThat(answer.getStatus()).as("the seat went to %s", number).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(TeamAdministrationWriteApi.HE_IS_NOT_IN_THE_TEAM);
		assertThat(theRowOf(theTeam())).isEqualTo(asItStood());
	}

	/**
	 * AND STANDING IN IT IS A MEMBERSHIP WITH NO END, WHATEVER SEASON IT BEGINS IN.
	 *
	 * <p>{@link #THE_SEAT} joined for a season that has not begun, which is the ordinary case of a
	 * member who came in during the window. {@link TeamApi#WHO_STANDS_IN_A_TEAM} counts him, and so
	 * the seat may be handed to him; the case above it hands it the other way, to a member whose
	 * season HAS begun.
	 */
	@Test
	void theSeatMayGoToAMemberWhoseMembershipBeginsNextSeason() throws Exception {
		seatOf(THE_TEAM, competitorId(THE_LONGEST));

		assertThat(changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form("Dunavski trkači", "Novi Sad", "RS", THE_SEAT)).getStatus())
				.isEqualTo(200);

		assertThat(theSeat()).isEqualTo(competitorId(THE_SEAT));
	}

	@Test
	void aTeamThatIsNotThereIsNotFoundAndNothingIsWritten() throws Exception {
		long nobodysKey = db.sql("select max(id) + 1000 from team").query(Long.class).single();
		List<String> before = everyTeam();

		assertThat(changeAs(MODERATOR_OVER_TEAMS, nobodysKey,
				form("Dobar tim", "Vukovar", "HR", THE_LONGEST)).getStatus())
				.isEqualTo(404);

		assertThat(everyTeam()).isEqualTo(before);
	}

	/**
	 * NO TRANSFER WINDOW: a name, a town and a seat change on a day the window is shut exactly as
	 * on a day it is open. Derived from PDL „drži sve što menja sastav tima: ulazak u tim, izlazak,
	 * osnivanje i brisanje tima" (29.09.2026), and the class says why.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"2027-06-15T10:00:00Z", "2027-11-10T10:00:00Z"})
	void theWindowBindsNoChangeOfNameTownOrSeat(String moment) throws Exception {
		clock.moveTo(Instant.parse(moment));

		assertThat(changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form("Dunavski trkači Vukovar", "Vukovar", "HR", THE_LONGEST)).getStatus())
				.as("a change was refused on %s", moment)
				.isEqualTo(200);

		assertThat(theSeat()).isEqualTo(competitorId(THE_LONGEST));
	}

	/**
	 * A CHANGE THE TEAM'S OWN ADMINISTRATOR SENT, AND THAT STILL WAITS, IS LEFT WHERE IT IS: its
	 * name, its team and its place in the queue. Nothing decided that a direct change withdraws it.
	 */
	@Test
	void aChangeWaitingInTheQueueIsLeftWhereItIs() throws Exception {
		assertThat(changeAs(MODERATOR_OVER_TEAMS, theTeam(),
				form("Dunavski trkači Vukovar", "Vukovar", "HR", THE_LONGEST)).getStatus())
				.isEqualTo(200);

		assertThat(theWaitingChange())
				.isEqualTo(List.of(String.valueOf(theTeam()), THE_WAITING_CHANGES_NAME, "waiting"));
	}

	/**
	 * NOBODY BUT THE ADMINISTRATION GETS PAST THE DOOR, and each of these is somebody a weaker door
	 * would let through: the moderator of the very queue where teams are proposed, a moderator of
	 * another entity, the team's own administrator - whose change goes through the queue - and a
	 * plain member of the team.
	 */
	@ParameterizedTest
	@ValueSource(strings = {MODERATOR_OVER_THE_QUEUE, MODERATOR_OVER_SOMETHING_ELSE,
			THE_TEAMS_OWN_ADMINISTRATOR, A_PLAIN_MEMBER})
	void nobodyButTheAdministrationGetsPastTheDoor(String who) throws Exception {
		assertThat(changeAs(who, theTeam(),
				form("Dunavski trkači Vukovar", "Vukovar", "HR", THE_LONGEST)).getStatus())
				.as("%s changed a team", who)
				.isEqualTo(404);

		assertThat(theRowOf(theTeam())).isEqualTo(asItStood());
	}

	@Test
	void somebodyWhoIsNotSignedInIsAskedToSignIn() throws Exception {
		assertThat(changeAs(null, theTeam(),
				form("Dunavski trkači Vukovar", "Vukovar", "HR", THE_LONGEST)).getStatus())
				.isEqualTo(401);

		assertThat(theRowOf(theTeam())).isEqualTo(asItStood());
	}

	/**
	 * EVERY FIELD THE ADMINISTRATION'S FORM DEFINES IS ONE THIS ROUTE TAKES, AND THE OTHER WAY
	 * ROUND.
	 *
	 * <p>A field the form asks for that the record has no name for is a field Jackson drops while
	 * the administration is told 200; a field the record takes that no form sends is a name nobody
	 * is ever going to fill in. The country is one of the form's own fields here, unlike the
	 * member's form, where a town writes it beside itself.
	 */
	@Test
	void everyFieldTheAdministrationsFormDefinesIsOneThisRouteTakes() throws Exception {
		List<String> onTheForm = new ArrayList<>();

		for (JsonNode field : mapper.readTree(Files.readString(THE_ADMINISTRATIONS_FORM)).path("fields")) {
			onTheForm.add(field.path("name").asString());
		}

		assertThat(onTheForm)
				.as("%s defines no field at all, so this compares nothing", THE_ADMINISTRATIONS_FORM)
				.isNotEmpty();

		assertThat(Arrays.stream(TeamAdministrationWriteApi.Changed.class.getRecordComponents())
				.map(RecordComponent::getName).toList())
				.as("the route and the administration's form do not name the same fields")
				.containsExactlyInAnyOrderElementsOf(onTheForm);
	}

	private void team(String slug, String name) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id)"
						+ " values (?, ?, '', '', (select id from place where rank = 1), null, null,"
						+ " null, ?, null)")
				.params(slug, name, ITS_FIRST_SEASON).update();
	}

	private void competitor(String number) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, String.format("%016x", ++issued))
				.update();
	}

	/** Somebody who registered and has no member number (V16), which a seat may still name. */
	private long aCompetitorWithNoNumber() {
		competitor(null);

		return db.sql("select id from competitor where member_number is null")
				.query(Long.class).single();
	}

	private void inATeam(String memberNumber, String teamSlug, int seasonFrom) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?)")
				.params(memberNumber, teamSlug, seasonFrom)
				.update();
	}

	private void seatOf(String teamSlug, Long competitor) {
		db.sql("update team set admin_id = ? where slug = ?").params(competitor, teamSlug).update();
	}

	/**
	 * Gives a team a town of its own typing and no pointer into the codebook: the other shape
	 * {@code team_town_is_from_the_codebook_or_typed} allows, besides the one the fixture writes.
	 */
	private void townTypedOf(String teamSlug, String city, String countryCode) {
		db.sql("update team set place_id = null, city = ?,"
						+ " country_id = (select id from country where code = ?) where slug = ?")
				.params(city, countryCode, teamSlug).update();
	}

	/** A change of a team that exists, queued exactly the way V11 and V9 queue one together. */
	private long aChangeWaitingFor(String teamSlug, String memberNumber, String name) {
		long change = db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link,"
						+ " city, country_id)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?, '', '', 'Zemun',"
						+ " (select id from country where code = 'RS'))"
						+ " returning id")
				.params(memberNumber, teamSlug, name)
				.query(Long.class).single();

		db.sql("insert into verification (queue, competitor_id, subject, body, team_proposal_id)"
						+ " values ('teams', (select id from competitor where member_number = ?), ?,"
						+ " '', ?)")
				.params(memberNumber, name, change).update();

		return change;
	}

	private void member(String email, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, memberNumber).update();

		openSession(email);
	}

	/** An account naming no member at all, which V23 calls the ordinary case for a moderator. */
	private void moderator(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

		openSession(email);
	}

	private void superadmin(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Vrhovni', 'Bezimeni', ?, (select id from role where code = 'superadmin'))")
				.param(email).update();

		openSession(email);
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
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

	/**
	 * @param email who asks, or null for somebody with no session at all - a request with no
	 *              cookie header, the way a browser that has never signed in sends one
	 */
	private MockHttpServletResponse changeAs(String email, long team, String body) throws Exception {
		MockHttpServletRequestBuilder asking = put("/api/teams/" + team).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(body);

		return http.perform(email == null ? asking
						: asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}

	/** The form as the screen sends it when the seat is left out, which the list's cell does. */
	private String form(String name, String city, String country) {
		Map<String, String> fields = new LinkedHashMap<>();

		fields.put("name", name);
		fields.put("city", city);
		fields.put("country", country);

		return mapper.writeValueAsString(fields);
	}

	/** The whole form, written with its own four names rather than built from the record. */
	private String form(String name, String city, String country, String organizer) {
		Map<String, String> fields = new LinkedHashMap<>();

		fields.put("name", name);
		fields.put("city", city);
		fields.put("country", country);
		fields.put("organizerMemberNumber", organizer);

		return mapper.writeValueAsString(fields);
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	/**
	 * The key of the team every case changes, as the fixture wrote it and never as a name or an
	 * address finds it: a statement that wrote into the wrong team would otherwise be read back off
	 * the wrong team and agree with itself.
	 */
	private long theTeam() {
		return theTeamsKey;
	}

	/**
	 * One team as the change writes it: its address, its name, its town as „no place" or the
	 * codebook row's key, the typed town, its country's code, and who sits in the seat.
	 */
	private List<String> theRowOf(long team) {
		return db.sql("select t.slug, t.name, t.place_id, t.city, c.code, t.admin_id from team t"
						+ " left join country c on c.id = t.country_id where t.id = ?")
				.param(team)
				.query((row, one) -> Arrays.asList(row.getString(1), row.getString(2),
						row.getObject(3) == null ? "no place" : "a place", row.getString(4),
						row.getString(5), String.valueOf(row.getObject(6))))
				.single();
	}

	/** The row of the team being changed as the fixture wrote it, for the cases that write nothing. */
	private List<String> asItStood() {
		return Arrays.asList(THE_TEAM, THE_TEAMS_NAME, "a place", null, null,
				String.valueOf(competitorId(THE_SEAT)));
	}

	/**
	 * Who sits in the seat, or null for nobody. Read as a list and not with {@code single()}, which
	 * refuses a null value outright even when exactly one row came back - and an empty seat is one
	 * of the four states the cases above ask about.
	 */
	private Long theSeat() {
		List<Long> seat = db.sql("select admin_id from team where id = ?").param(theTeam())
				.query((row, one) -> row.getObject(1, Long.class)).list();

		assertThat(seat).as("the team every case changes is gone").hasSize(1);

		return seat.get(0);
	}

	private long competitorId(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	/** Every membership row there is, whole and in order. */
	private List<String> theMemberships() {
		return db.sql("select m.competitor_id, m.team_id, m.season_from, m.season_to"
						+ " from team_membership m order by m.id")
				.query((row, one) -> row.getLong(1) + " " + row.getLong(2) + " " + row.getInt(3)
						+ " " + row.getObject(4))
				.list();
	}

	/** Every team there is, whole, for the cases that must write nothing at all. */
	private List<String> everyTeam() {
		return db.sql("select id, slug, name, place_id, city, country_id, admin_id, bio, link,"
						+ " logo_id, first_season from team order by id")
				.query((row, one) -> {
					List<String> columns = new ArrayList<>();

					for (int at = 1; at <= 11; at++) {
						columns.add(String.valueOf(row.getObject(at)));
					}

					return String.join(" | ", columns);
				})
				.list();
	}

	/** The change waiting in the queue: the team it names, its name, and its row's state. */
	private List<String> theWaitingChange() {
		return db.sql("select tp.team_id, tp.name, v.state from team_proposal tp"
						+ " join verification v on v.team_proposal_id = tp.id where tp.id = ?")
				.param(theWaitingChange)
				.query((row, one) -> List.of(String.valueOf(row.getLong(1)), row.getString(2),
						row.getString(3)))
				.single();
	}
}

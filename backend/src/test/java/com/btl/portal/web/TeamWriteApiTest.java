package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.team.Membership;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A MEMBER PUTTING A TEAM FORWARD, END TO END: what goes into the queue, who is sent away,
 * and what is left standing when somebody is.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on every axis an assertion
 * below reads a value along:
 *
 * <ul>
 * <li><b>Five competitors, and the one who proposes is written THIRD</b>, so „the member
 * asking" and „the first member" are different keys and a statement that lost its condition
 * answers differently.
 * <li><b>TWO of them are in a team, and BOTH are refused</b>, which is the axis a fixture
 * where nobody has a team cannot separate at all - and the axis a fixture with only ONE of
 * them separates only halfway. {@link #HAS_A_TEAM} joined for a season that has not begun
 * and {@link #IN_A_TEAM_NOW} for one that has; a rule reading the season instead of the
 * record answers one of them correctly and the other not, which is what a round on
 * 19.09.2026 measured.
 * <li><b>The two teams they are in are two different rows, and neither is the team whose
 * name is taken</b>, so „a team exists", „his team" and „the taken name" are three things
 * and not one.
 * <li><b>Four different years, never one.</b> The clock's year is 2027, the season a
 * membership would begin in is 2028, {@link #HAS_A_TEAM} joined for 2029 and every team
 * carries {@code first_season} 2030 - so „derived from the window" and „today's year" can
 * never hand back the same number. {@link #IN_A_TEAM_NOW}'s 2027 is the clock's year ON
 * PURPOSE, because being in a team NOW is what it means.
 * <li><b>Somebody else has a proposal and a queue row of the identical shape</b>, waiting,
 * written first, so „the proposal this request made" is never „the only proposal" and never
 * „the first one".
 * <li><b>And the queue holds a row that is not a team's at all</b>, so „the teams tab" and
 * „the queue" are two different counts.
 * <li><b>The name sent is never the name stored.</b> Every name a case sends that is meant to
 * be accepted carries spaces around it, so an answer echoed off the request and an answer
 * read off the row are two different strings.
 * </ul>
 *
 * <p><b>Authorisation as a rule is not measured here.</b> This route carries no
 * {@link RightIsNeeded} and needs none - every member may found a team - so
 * {@code RightsAtTheDoorTest} has nothing to sweep. What IS measured here is the one thing
 * that sweep could not see either way: that a stranger is refused before the handler runs,
 * which is {@code ApiSecurity} opening {@code /api/teams} for reading and not for writing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TeamWriteApiTest {

	/** 11:00 in Belgrade on 3 October 2027, well inside the transfer window. */
	private static final Instant INSIDE_THE_WINDOW = Instant.parse("2027-10-03T09:00:00Z");

	/** Written first, has no team, and never asks for anything. */
	private static final String FIRST_WRITTEN = "000100";

	/**
	 * In a team from a season that has NOT begun, and refused for it.
	 *
	 * <p>The easier half of the axis, and the one a rule reading the season gets right by
	 * accident; {@link #IN_A_TEAM_NOW} is the other half.
	 */
	private static final String HAS_A_TEAM = "000200";

	/** The member every case asks with, written third. */
	private static final String ME = "000300";

	/** Has a proposal and a queue row already waiting, neither of which may move. */
	private static final String SOMEONE_ELSE = "000400";

	/**
	 * IN A TEAM RIGHT NOW, which is the half of the axis a round on 19.09.2026 found
	 * measured by nothing at all.
	 *
	 * <p>His membership is what an approval writes ({@code Membership.open}): it begins in
	 * a season that HAS begun and it has no end. With only {@link #HAS_A_TEAM} in the
	 * fixture, narrowing {@code membershipsOf} to {@code season_from > 2028} left the whole
	 * gate green - 2035 cases - while every member who really is in a team today could
	 * found a second one, and the approval would then break
	 * {@code team_membership_one_team_at_a_time}.
	 */
	private static final String IN_A_TEAM_NOW = "000500";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	/** The team whose name is taken, which is NOT the team anybody is in. */
	private static final String TAKEN_NAME = "Dunavski trkači";

	private static final String TAKEN_ADDRESS = "dunavski-trkaci";

	/** And the team {@link #HAS_A_TEAM} is in, which no case proposes the name of. */
	private static final String HIS_TEAM = "sava-runners";

	/**
	 * And a THIRD team, which is {@link #IN_A_TEAM_NOW}'s.
	 *
	 * <p>A third row rather than a second member of the same one, so „a team exists",
	 * „the team whose name is taken" and „the team each refused member is in" are four
	 * different rows and no assertion below can be satisfied by whichever came first.
	 */
	private static final String THE_OTHER_TEAM = "timocki-tim";

	/**
	 * The season every team in the fixture collects from.
	 *
	 * <p>Neither the clock's year nor the season a membership begins in, so „the season
	 * this route worked out" cannot be satisfied by reading one of those instead.
	 */
	private static final int A_SEASON_NO_CASE_COMPUTES = 2030;

	/**
	 * The season {@link #HAS_A_TEAM}'s membership begins in, which has not begun.
	 *
	 * <p>PDL P13, 05.09.2026: a member „upisan u Dunav sa {@code teamSince: 2027}" is not
	 * counted in the team on a day in 2026 and is still refused the founding of one, because
	 * the question is „imas li tim" and not „da li si bio u timu ove sezone".
	 */
	private static final int A_SEASON_STILL_TO_COME = 2029;

	/**
	 * The season {@link #IN_A_TEAM_NOW}'s membership begins in, which HAS begun.
	 *
	 * <p>2027 and not a choice: {@code team_membership_season_from_not_before_the_league}
	 * refuses anything earlier, and the league's first season is the only one that has
	 * begun while this file's clock reads 2027. It is the clock's year on purpose - being
	 * in a team NOW is what it means - and the other three numbers in this fixture are all
	 * different from it, so nothing below can read the wrong one and still be right.
	 */
	private static final int A_SEASON_ALREADY_RUNNING = 2027;

	/**
	 * The member's own form, read off the working tree rather than described.
	 *
	 * <p>The same place {@code WhatRegistrationAsksForTest} reads the registration's form
	 * from, for the same reason: what a screen asks for is a fact about a file, and a
	 * sentence in a comment claiming to know it is worth nothing.
	 */
	private static final Path THE_MEMBERS_FORM =
			Path.of("..", "frontend", "src", "forms", "definitions", "predlog-tima.form.json");

	/** No country is served under it, and the fixture says so out loud below. */
	private static final String A_COUNTRY_NOBODY_SERVES = "QQ";

	/**
	 * THE WORD A VOLUNTARY EXIT WRITES INTO {@code left_reason}, SPELLED OUT HERE AND NOT
	 * READ OFF {@link Membership#LEFT_ON_HIS_OWN}.
	 *
	 * <p><b>A mutation found this and nothing else would have.</b> Written as the constant,
	 * both sides of the assertion came from ONE source: changing the production value changed
	 * the expectation with it, so „the reason the portal writes" was measured by nothing at
	 * all and the mutation that replaces it passed green. That is „nikad jedna konstanta za
	 * dve uloge" in its plainest form, and the only way to tell the two roles apart is for the
	 * case to carry its own copy of what it expects.
	 *
	 * <p><b>Two homes is the price and it is the right one here.</b> The other home is the
	 * record's, and this one is a fixture: it says what a reader of the database will find,
	 * the way {@code pages/publicData.test.tsx} carries a hand written table of addresses. If
	 * somebody changes the word, this fails and asks whether the change was meant - which is
	 * exactly the question a column that has to tell a voluntary exit from the 1 January job
	 * should raise once.
	 */
	private static final String THE_REASON_A_MEMBER_LEAVING_WRITES = "izašao iz tima";

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

	/**
	 * A CLOCK THE CASE MOVES, because the window is a boundary in time and both of its
	 * edges have to be asked in one fixture.
	 *
	 * <p>It reports UTC as its zone on purpose, the same shape {@code ResultApiTest} uses:
	 * whoever asks whether the window is open has to re-read the instant in the league's own
	 * time, and a server that reads this zone instead answers with the wrong month on the two
	 * nights that matter.
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
			return new AClockTheCaseMoves(INSIDE_THE_WINDOW);
		}
	}

	@BeforeEach
	void fourMembersOfWhomOneIsInATeam() {
		clock.moveTo(INSIDE_THE_WINDOW);

		competitor(FIRST_WRITTEN);
		competitor(HAS_A_TEAM);
		competitor(ME);
		competitor(SOMEONE_ELSE);
		competitor(IN_A_TEAM_NOW);

		team(TAKEN_ADDRESS, TAKEN_NAME);
		team(HIS_TEAM, "Sava Runners");
		team(THE_OTHER_TEAM, "Timocki tim");

		/* BOTH HALVES OF ONE AXIS, and the two rows differ in nothing but the season they
		   begin in: one has not begun and one has. A rule that reads the season instead of
		   the record answers one of them correctly and the other not. */
		inATeam(HAS_A_TEAM, HIS_TEAM, A_SEASON_STILL_TO_COME);
		inATeam(IN_A_TEAM_NOW, THE_OTHER_TEAM, A_SEASON_ALREADY_RUNNING);

		account("prvi@primer.rs", FIRST_WRITTEN);
		account("ima-tim@primer.rs", HAS_A_TEAM);
		account("ja@primer.rs", ME);
		account("neko-drugi@primer.rs", SOMEONE_ELSE);
		account("u-timu-sada@primer.rs", IN_A_TEAM_NOW);
		moderatorWithNoCompetitor(MODERATOR_WHO_DOES_NOT_RACE);

		proposalWaitingFor(SOMEONE_ELSE, "Timocki trkaci");

		/* A row in the queue that is not a team's at all, so „the queue" and „the teams tab"
		   are two different numbers and a statement that lost its queue can be seen. */
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('comments', (select id from competitor where member_number = ?),"
						+ " 'Komentar koji ceka', '')")
				.param(FIRST_WRITTEN).update();
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

	private void team(String slug, String name) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id)"
						+ " values (?, ?, '', '', (select id from place where rank = 1), null, null,"
						+ " null, ?, null)")
				.params(slug, name, A_SEASON_NO_CASE_COMPUTES).update();
	}

	/** An open membership, which is what an approval writes ({@code Membership.open}). */
	private void inATeam(String memberNumber, String teamSlug, int seasonFrom) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?)")
				.params(memberNumber, teamSlug, seasonFrom)
				.update();
	}

	/** Somebody else's proposal, queued exactly the way V11 and V9 queue one together. */
	private void proposalWaitingFor(String memberNumber, String name) {
		long proposal = db.sql("insert into team_proposal (competitor_id, name, bio, link, place_id)"
						+ " values ((select id from competitor where member_number = ?), ?, '', '',"
						+ " (select id from place where rank = 1))"
						+ " returning id")
				.params(memberNumber, name)
				.query(Long.class).single();

		db.sql("insert into verification (queue, competitor_id, subject, body, team_proposal_id)"
						+ " values ('teams', (select id from competitor where member_number = ?), ?,"
						+ " '', ?)")
				.params(memberNumber, name, proposal).update();
	}

	private void account(String email, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, memberNumber).update();

		openSession(email);
	}

	/** An account naming no member at all, which V23 calls the ordinary case for a moderator. */
	private void moderatorWithNoCompetitor(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code = 'moderator'))")
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

	private String cookieOf(String memberNumber) {
		return sessions.get(db.sql("select a.email from account a join competitor c"
						+ " on c.id = a.competitor_id where c.member_number = ?")
				.param(memberNumber).query(String.class).single()).secret();
	}

	private MockHttpServletResponse proposeAs(String memberNumber, String body) throws Exception {
		return sent(body, new Cookie(SessionCookie.NAME, cookieOf(memberNumber)));
	}

	/**
	 * @param carrying the session, or null for somebody who has none - which is not the same
	 *                 request with an empty list of cookies but a request with no cookie
	 *                 header at all, the way a browser that has never signed in sends one
	 */
	private MockHttpServletResponse sent(String body, Cookie carrying) throws Exception {
		MockHttpServletRequestBuilder asking = post("/api/teams").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(body);

		return http.perform(carrying == null ? asking : asking.cookie(carrying))
				.andReturn().getResponse();
	}

	/** The ordinary request every case starts from, with one field replaced. */
	private String form(String name, String note, String bio, String link, String city,
			String country) {
		return mapper.writeValueAsString(
				new TeamWriteApi.Proposed(name, note, bio, link, city, country));
	}

	private String naming(String name) {
		return form(name, null, null, null, "  Novi Sad  ", "RS");
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	private long howManyProposals() {
		return db.sql("select count(*) from team_proposal").query(Long.class).single();
	}

	private long howManyWaitingInTheTeamsQueue() {
		return db.sql("select count(*) from verification where queue = 'teams'"
				+ " and state = 'waiting'").query(Long.class).single();
	}

	private long howManyTeams() {
		return db.sql("select count(*) from team").query(Long.class).single();
	}

	private long howManyMemberships() {
		return db.sql("select count(*) from team_membership").query(Long.class).single();
	}

	/** One proposal read back whole, as a list of column values in a fixed order. */
	private List<Object> proposalNamed(String name) {
		return db.sql("select tp.competitor_id, tp.team_id, tp.name, tp.bio, tp.link, tp.place_id,"
						+ " tp.city, tp.country_id, tp.logo_id from team_proposal tp where tp.name = ?")
				.param(name)
				.query((row, one) -> List.of(row.getObject(1), String.valueOf(row.getObject(2)),
						row.getString(3), row.getString(4), row.getString(5),
						String.valueOf(row.getObject(6)), String.valueOf(row.getObject(7)),
						String.valueOf(row.getObject(8)), String.valueOf(row.getObject(9))))
				.single();
	}

	private long competitorId(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	/**
	 * THE FIXTURE SAYS WHAT IT CLAIMS TO SAY, asked of the database rather than trusted
	 * from the constants above.
	 *
	 * <p>Every assertion in this file rests on one of these, and each of them is a way the
	 * whole file could measure nothing: a member who is not really in a team makes the
	 * refusal below a claim about nothing, three years that are secretly one number makes
	 * „derived from the window" unmeasurable, and a country code somebody does serve makes
	 * the refusal of an unknown one a refusal of a known one.
	 */
	@Test
	void theFixtureSeparatesTheAxesItSaysItSeparates() {
		int joined = SeasonClock.seasonBeingPaidFor(INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE));

		assertThat(db.sql("select c.member_number, m.season_from from team_membership m"
						+ " join competitor c on c.id = m.competitor_id"
						+ " where m.season_to is null and m.season_from > ?"
						+ " order by c.member_number")
				.param(joined)
				.query((row, one) -> row.getString(1)).list())
				.as("nobody in this fixture is in a team for a season still to come, so the half"
						+ " of the axis the owner's own example is about measures nothing")
				.containsExactly(HAS_A_TEAM);

		assertThat(db.sql("select c.member_number from team_membership m"
						+ " join competitor c on c.id = m.competitor_id"
						+ " where m.season_to is null and m.season_from <= ?"
						+ " order by c.member_number")
				.param(joined)
				.query(String.class).list())
				.as("nobody in this fixture is in a team ALREADY, so narrowing the lookup to"
						+ " memberships that have not begun leaves every case below green")
				.containsExactly(IN_A_TEAM_NOW);

		assertThat(db.sql("select count(*) from team_membership m join competitor c"
						+ " on c.id = m.competitor_id where c.member_number = ?")
				.param(ME).query(Long.class).single())
				.as("the member who proposes is in a team, so the ordinary case measures a refusal")
				.isZero();

		int year = INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE).getYear();

		assertThat(List.of(year, joined, A_SEASON_NO_CASE_COMPUTES, A_SEASON_STILL_TO_COME))
				.as("two of the four years this fixture tells apart are the same number, so a"
						+ " route reading the wrong one answers correctly anyway")
				.doesNotHaveDuplicates();

		assertThat(A_SEASON_ALREADY_RUNNING)
				.as("the membership that is meant to have BEGUN begins after the season being"
						+ " joined, so it is a second copy of the other half of the axis")
				.isLessThan(joined);

		assertThat(db.sql("select count(*) from country where code = ?")
				.param(A_COUNTRY_NOBODY_SERVES).query(Long.class).single())
				.as("the country this file calls unknown is one the codebook serves")
				.isZero();

		assertThat(db.sql("select count(*) from verification").query(Long.class).single())
				.as("the queue holds nothing but the teams tab, so the whole queue and that one tab"
						+ " are the same number and a statement that lost its tab cannot be seen")
				.isGreaterThan(howManyWaitingInTheTeamsQueue());
	}

	/**
	 * A MEMBER WITH NO TEAM PUTS ONE FORWARD, AND IT IS STANDING IN THE TEAMS QUEUE.
	 *
	 * <p>The whole row is read back out of both tables, because the two halves of this write
	 * are two facts: a proposal nobody queued reaches no moderator and is dropped by
	 * {@code MyApplicationsApi} on purpose, and a queue row pointing at nothing is a card
	 * with nothing on it.
	 *
	 * <p><b>And the team itself is counted afterwards.</b> Approving is somebody else's act
	 * and writes the team and the founder's membership (PDL P13, 05.09.2026); a route that
	 * did any of it here would leave a team nobody decided on, visible in the league.
	 */
	@Test
	void aMemberWithNoTeamPutsOneForwardAndItWaitsInTheQueue() throws Exception {
		long proposalsBefore = howManyProposals();

		MockHttpServletResponse answer = proposeAs(ME,
				form("  Dunavski   TRKAČ  ", "  Zato sto trcimo zajedno  ",
						"  Ekipa sa Dunava  ", null, "  Novi Sad  ", "RS"));

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(howManyProposals())
				.as("the proposal was not written")
				.isEqualTo(proposalsBefore + 1);

		assertThat(proposalNamed("Dunavski   TRKAČ"))
				.as("the row does not hold what was sent: the town, the description and the link"
						+ " are the columns an approval builds the team out of, `team_id` being empty"
						+ " is what makes this a NEW team rather than a change to one, and the NOTE is"
						+ " not here at all because this table has no column for it")
				.containsExactly(competitorId(ME), "null", "Dunavski   TRKAČ",
						"Ekipa sa Dunava", "", "null", "Novi Sad", String.valueOf(countryKey()), "null");

		assertThat(theQueueRowFor("Dunavski   TRKAČ"))
				.as("the queue row does not carry the proposal, the member it is about, the name"
						+ " and the NOTE, in the tab that is the only one V11 lets a proposal stand"
						+ " in. The description is not what a moderator reads here: the two are sent"
						+ " as different words and must land in different places")
				.containsExactly("teams", competitorId(ME), "Dunavski   TRKAČ",
						"Zato sto trcimo zajedno", "waiting", proposalIdNamed("Dunavski   TRKAČ"),
						"null", "null");

		assertThat(howManyTeams())
				.as("a team was written, and nobody has decided on this proposal yet")
				.isEqualTo(3);
		assertThat(howManyMemberships())
				.as("somebody was put into a team, and nobody has decided on this proposal yet")
				.isEqualTo(2);
	}

	/**
	 * AND THE NAME IN THE ANSWER COMES OUT OF THE ROW AND NOT OUT OF THE REQUEST.
	 *
	 * <p>The two differ on purpose: the name is stripped on the way in, because
	 * {@code team_proposal_name_not_blank} refuses a blank one and a name with spaces round
	 * it is not the name a team would be called. Handed back off the request, this answer
	 * would agree with the table on every request that worked and would therefore be a claim
	 * about nothing - which is the same reason {@code ModeratorWriteApi} reads its row of
	 * ticks back and {@code RegistrationApi} reads the address back off the account.
	 */
	@Test
	void theAnswerCarriesTheNameTheRowHoldsAndNotTheOneThatWasSent() throws Exception {
		String sent = "   Savski trkaci   ";

		MockHttpServletResponse answer = proposeAs(ME, naming(sent));

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(mapper.readTree(answer.getContentAsString()).path("name").asString())
				.as("the answer carries the name as it was TYPED, which is a value this route"
						+ " never wrote down anywhere")
				.isNotEqualTo(sent)
				.isEqualTo(db.sql("select name from team_proposal where id = ?")
						.param(idIn(answer)).query(String.class).single());

		assertThat(idIn(answer))
				.as("the answer names somebody else's proposal, which is the one written first")
				.isEqualTo(proposalIdNamed("Savski trkaci"))
				.isNotEqualTo(proposalIdNamed("Timocki trkaci"));
	}

	/**
	 * A MEMBER WHO IS ALREADY IN A TEAM IS SENT AWAY, AND THE QUESTION IS ASKED OF BOTH
	 * HALVES OF THE AXIS.
	 *
	 * <p>PDL P13, 05.09.2026: „„Nema tim" se cita sa zapisa ({@code teamId}), ne po
	 * sezoni". The owner's own example is a member the portal does not count in his team
	 * today and still refuses, because founding one now would leave him in two on
	 * 1 January - that is {@link #HAS_A_TEAM}, whose membership begins in 2029.
	 *
	 * <p><b>And the ordinary member, who is in a team RIGHT NOW, is the half a round on
	 * 19.09.2026 found measured by nothing.</b> With only the first of the two in the
	 * fixture, narrowing {@code membershipsOf} to {@code season_from > 2028} passed the
	 * WHOLE gate, 2035 cases, while every member who really is in a team could found a
	 * second one - and the approval would then break
	 * {@code team_membership_one_team_at_a_time} with the member holding a proposal nobody
	 * could ever decide. Two halves, two rows, and they differ in nothing but the season
	 * their membership begins in.
	 */
	@ParameterizedTest
	@ValueSource(strings = {HAS_A_TEAM, IN_A_TEAM_NOW})
	void aMemberWhoIsInATeamOnTheRecordIsSentAway(String memberNumber) throws Exception {
		long proposalsBefore = howManyProposals();
		long waitingBefore = howManyWaitingInTheTeamsQueue();

		MockHttpServletResponse answer = proposeAs(memberNumber, naming("  Novi tim  "));

		assertThat(answer.getStatus())
				.as("%s is already in a team on the record and founded a second one", memberNumber)
				.isEqualTo(404);
		assertThat(answer.getContentAsString())
				.as("the refusal explains itself, and the owner deleted the sentence that did"
						+ " (PDL P13, 05.09.2026)")
				.isEmpty();

		assertThat(howManyProposals())
				.as("a refused proposal was written anyway")
				.isEqualTo(proposalsBefore);
		assertThat(howManyWaitingInTheTeamsQueue())
				.as("a refused proposal reached the queue anyway")
				.isEqualTo(waitingBefore);
	}

	/**
	 * AND SO IS AN ACCOUNT THAT NAMES NO MEMBER AT ALL.
	 *
	 * <p>V23 lets {@code account.competitor_id} be null for „a moderator who does not race,
	 * which is the ordinary case and not a fault", and {@code team_proposal.competitor_id} is
	 * NOT NULL because only a member may propose a team (V11). There is nobody to file it
	 * under, and the answer is the one {@code InboxApi} and {@code NotificationApi} already
	 * give him.
	 */
	@Test
	void anAccountThatNamesNoMemberIsSentAway() throws Exception {
		long proposalsBefore = howManyProposals();

		MockHttpServletResponse answer = sent(naming("  Moderatorski tim  "), new Cookie(
				SessionCookie.NAME, sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret()));

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(howManyProposals())
				.as("a proposal was filed under an account with no member behind it")
				.isEqualTo(proposalsBefore);
	}

	/**
	 * THE WINDOW IS OPEN FROM 1 OCTOBER TO 31 DECEMBER, AND IT IS MEASURED IN BELGRADE.
	 *
	 * <p>Owner, 05.09.2026: „Tim se osniva samo u prelaznom roku, 1. oktobra do 31.
	 * decembra." Both edges are asked, and each is asked from both sides, because a rule
	 * written with the wrong comparison passes one side and fails the other.
	 *
	 * <p><b>And the two instants that open and shut it are chosen so that reading the
	 * server's own zone gives the wrong answer.</b> The moment the window opens is
	 * 30 September in UTC, and the moment it shuts is 31 December in UTC - so a route that
	 * asked the machine what month it is would refuse the first request of the window and
	 * accept the first request after it. That is ADL A36 O2's sentence about
	 * {@code Europe/Belgrade} written as two failures rather than as a comment.
	 */
	@ParameterizedTest
	@CsvSource({
			"2027-09-30T21:59:00Z, 404, the last minute of September in Belgrade",
			"2027-09-30T22:00:00Z, 201, midnight opening 1 October in Belgrade",
			"2027-12-31T22:59:00Z, 201, the last minute of 31 December in Belgrade",
			"2027-12-31T23:00:00Z, 404, midnight opening 1 January in Belgrade"})
	void aTeamIsFoundedOnlyInsideTheTransferWindow(String moment, int expected, String what)
			throws Exception {

		clock.moveTo(Instant.parse(moment));

		long proposalsBefore = howManyProposals();

		assertThat(proposeAs(ME, naming("  Zimski trkaci  ")).getStatus())
				.as("%s (%s) was answered wrongly", what, moment)
				.isEqualTo(expected);

		assertThat(howManyProposals())
				.as("%s: the proposal was written when it should not have been, or not written"
						+ " when it should", what)
				.isEqualTo(expected == 201 ? proposalsBefore + 1 : proposalsBefore);
	}

	/**
	 * A NAME A TEAM ALREADY ANSWERS AT IS REFUSED, AND IT IS COMPARED AS AN ADDRESS.
	 *
	 * <p>ADL, 03.08.2026: „Naziv tima se proverava po adresi koju pravi, ne po slovima...
	 * „Dunavski trkaci" i „Dunavski Trkaci" su dva naziva i jedna adresa", and Cyrillic and
	 * Latin are one script for this purpose, so „Дунавски тркачи" is the same team again.
	 * Compared by the letters, every one of these would be let through to sit in a queue
	 * nobody could ever approve, because {@code team_slug_unique} would refuse the team.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"  Dunavski trkači  ", "  Dunavski Trkaci  ", "  DUNAVSKI-TRKACI  ",
			"  Дунавски тркачи  "})
	void aNameAnApprovedTeamAlreadyAnswersAtIsRefused(String name) throws Exception {
		long proposalsBefore = howManyProposals();

		MockHttpServletResponse answer = proposeAs(ME, naming(name));

		assertThat(answer.getStatus())
				.as("'%s' makes the address a team already holds and was accepted", name)
				.isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(TeamWriteApi.THE_ADDRESS_IS_TAKEN);
		assertThat(howManyProposals()).isEqualTo(proposalsBefore);
	}

	/**
	 * BUT A PROPOSAL WAITING FOR THAT NAME IS NOT A TEAM, SO THE NAME IS STILL FREE.
	 *
	 * <p>PDL P13: „Naziv ne sme biti zauzet nekim vec ODOBRENIM timom." This is the other
	 * side of the boundary the case above holds, and it is the answer to two members
	 * proposing one name on one day: both are written and both wait, because a proposal has
	 * no address to take and V11 gives {@code team_proposal} no {@code slug} for exactly that
	 * reason. Whoever decides refuses the second one then, when there really is a team.
	 *
	 * <p>Read the other way round - over {@code team_proposal} as well - this route would be
	 * holding a name for somebody a moderator may yet turn down.
	 */
	@Test
	void twoMembersMayProposeOneNameBecauseNeitherOfThemIsATeamYet() throws Exception {
		assertThat(proposeAs(SOMEONE_ELSE, naming("  Moravski trkaci  ")).getStatus())
				.isEqualTo(201);

		assertThat(proposeAs(ME, naming("  Moravski Trkaci  ")).getStatus())
				.as("the second proposal of one name was refused, so the portal is holding a name"
						+ " for somebody a moderator may yet turn down")
				.isEqualTo(201);

		assertThat(db.sql("select count(*) from team_proposal where name in (?, ?)")
				.params("Moravski trkaci", "Moravski Trkaci").query(Long.class).single())
				.as("one of the two proposals is not in the queue")
				.isEqualTo(2);
	}

	/**
	 * A NAME THAT MAKES NO ADDRESS AT ALL IS REFUSED ON THE FORM.
	 *
	 * <p>PDL P13: „naziv mora da sadrzi bar jedno slovo nase abecede ili cirilice ili cifru,
	 * jer se od njega pravi adresa strane. Naziv od samih znakova, ili napisan pismom koje
	 * portal ne prepisuje, nema stranu, pa se odbija na formi umesto da tiho napravi tim koji
	 * se ne moze otvoriti." Accepted, the first such team answers at an address with nothing
	 * in it and every one after it is told its name is taken though the two share nothing.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"  !!! ---  ", "  Υψηλάντειος  ", "  ...  "})
	void aNameNoPageCouldBeOpenedAtIsRefused(String name) throws Exception {
		MockHttpServletResponse answer = proposeAs(ME, naming(name));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("'%s' makes no address and was not refused for that", name)
				.isEqualTo(TeamWriteApi.THE_NAME_MAKES_NO_ADDRESS);
	}

	/**
	 * A FORM MISSING ONE OF THE THREE THINGS IT ASKS FOR IS REFUSED.
	 *
	 * <p>Absent, empty and a run of spaces are one answer and not three: JSON has a null, a
	 * form has an empty box and a person has a space bar, and a guard written against one of
	 * the three lets the other two through to a column whose {@code btrim(...) <> ''} would
	 * then refuse them as a server fault in the middle of a write.
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "NIC", value = {
			"NIC, Novi Sad, RS", "'', Novi Sad, RS", "'   ', Novi Sad, RS",
			"Dobar tim, NIC, RS", "Dobar tim, '', RS", "Dobar tim, '   ', RS",
			"Dobar tim, Novi Sad, NIC", "Dobar tim, Novi Sad, ''", "Dobar tim, Novi Sad, '   '"})
	void aFormMissingSomethingIsRefused(String name, String city, String country) throws Exception {
		MockHttpServletResponse answer =
				proposeAs(ME, form(name, null, null, null, city, country));

		assertThat(answer.getStatus())
				.as("name=[%s] city=[%s] country=[%s] was accepted", name, city, country)
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(TeamWriteApi.THE_FORM_IS_NOT_COMPLETE);
	}

	/**
	 * A COUNTRY THE CODEBOOK DOES NOT SERVE IS ANSWERED AS A SENTENCE AND NOT AS A SERVER
	 * FAULT.
	 *
	 * <p>{@code team_proposal_country_fk} would refuse it anyway, as a constraint violation
	 * arriving after the member had finished filling the form in. That is the same fault
	 * {@code EventWriteApi} turns into an answer one resource along.
	 */
	@Test
	void aCountryNobodyServesIsRefused() throws Exception {
		MockHttpServletResponse answer = proposeAs(ME,
				form("  Timski tim  ", null, null, null, "  Novi Sad  ", A_COUNTRY_NOBODY_SERVES));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(TeamWriteApi.THE_COUNTRY_IS_NOT_KNOWN);
		assertThat(howManyProposals()).isOne();
	}

	/**
	 * AND SO IS A LINK THAT IS NOT ONE.
	 *
	 * <p>{@code team_proposal_link_shape} is the same expression {@code btl_event_link_shape}
	 * carries, and {@code WhatAnEventCarries.linkIsShaped} is the one home for it - measured
	 * against PostgreSQL's own verdict over every character of the basic plane by
	 * {@code EventShapesMatchTheSchemaTest}. A second spelling of the rule here would be one
	 * free to let through what the table refuses, which reaches the member as a 500.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"primer.rs/tim", "ftp://primer.rs", "https://", "https://a.rs/b c"})
	void aLinkThatIsNotOneIsRefused(String link) throws Exception {
		MockHttpServletResponse answer = proposeAs(ME,
				form("  Linkovani tim  ", "", "", link, "  Novi Sad  ", "RS"));

		assertThat(answer.getStatus())
				.as("'%s' was accepted as a link", link)
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(TeamWriteApi.THE_LINK_IS_NOT_SHAPED);
	}

	/**
	 * AND A LINK THAT IS ONE IS WRITTEN DOWN AS IT STANDS.
	 *
	 * <p>The other direction of the case above, which a route refusing every link would pass.
	 */
	@Test
	void aLinkThatIsOneIsKept() throws Exception {
		assertThat(proposeAs(ME, form("  Linkovani tim  ", "", "", "  https://primer.rs/tim  ",
				"  Novi Sad  ", "RS")).getStatus()).isEqualTo(201);

		assertThat(db.sql("select link from team_proposal where name = ?").param("Linkovani tim")
				.query(String.class).single())
				.isEqualTo("https://primer.rs/tim");
	}

	/**
	 * AND NOBODY WHO IS NOT SIGNED IN REACHES THIS AT ALL.
	 *
	 * <p>{@code /api/teams} is on {@code ApiSecurity.READ_BY_ANYBODY}, and since 18.09.2026
	 * that list is opened by METHOD: {@code GET}, {@code HEAD} and {@code OPTIONS}. This is
	 * the first write to sit on an open path since that narrowing, so the sentence it was
	 * written for is measured here rather than assumed - and the number is 401 rather than
	 * 404, because a browser that got 404 could not tell an ended session from a wrong
	 * address and nothing could offer him the way back in.
	 */
	@Test
	void somebodyWhoIsNotSignedInIsAskedToSignIn() throws Exception {
		MockHttpServletResponse answer = sent(naming("  Tim bez naloga  "), null);

		assertThat(answer.getStatus()).isEqualTo(401);
		assertThat(howManyProposals())
				.as("a proposal was written by somebody the portal knows nothing about")
				.isOne();
	}

	/**
	 * AND A WRITE THAT NAMES NO TYPE IS AN ADDRESS THAT IS NOT THERE, NOT AN ADDRESS THAT
	 * WANTS A DIFFERENT TYPE.
	 *
	 * <p>415 says „this address is here and takes something else", which is the same
	 * sentence as saying it is there - the leak {@code NothingIsHereRatherThanAlmost} exists
	 * against, and the one branch of it that class says it cannot close, because a media
	 * type refused while a handler is already running is raised far from
	 * {@code handleNoMatch}. Declared on the mapping instead, the request never matches and
	 * the dispatcher raises it where the portal's rule can turn it into „no handler".
	 *
	 * <p><b>Asked of a signed in member</b>, because a stranger is refused 401 by the chain
	 * before any of this and would pass whatever the mapping said.
	 *
	 * <p>What this case cannot see is whether the two answers are the same BYTES: MockMvc
	 * does not run the container's ERROR dispatch. That half is
	 * {@code RightsOverRealHttpTest}, off a socket, and it is the case that found this.
	 */
	@Test
	void aWriteThatNamesNoTypeIsAnAddressThatIsNotThere() throws Exception {
		MockHttpServletResponse answer = http.perform(post("/api/teams").with(csrf())
						.content(naming("  Tim bez tipa  "))
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(ME))))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("a write with no content type was told which type this address wants, which"
						+ " is the same sentence as telling him the address is there")
				.isEqualTo(404);

		assertThat(http.perform(post("/api/zzzzzz").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(ME))))
				.andReturn().getResponse().getStatus())
				.as("an address that maps nothing no longer answers 404, so there is nothing"
						+ " being compared here")
				.isEqualTo(answer.getStatus());
	}

	/**
	 * EVERY FIELD THE MEMBER'S FORM DEFINES IS ONE THIS ROUTE UNDERSTANDS, AND EVERY NAME
	 * THE ROUTE TAKES BESIDES IS ONE THE FORM REALLY DOES NOT ASK FOR.
	 *
	 * <p><b>Neither side is written here.</b> The form is read off the working tree, the
	 * shape of the request is read off the record's own components, and the only list is
	 * {@link TeamWriteApi#ASKED_FOR_BEFORE_THE_FORM_ASKS}, which this case holds to being
	 * true in both directions - so a field added to the form tomorrow fails the build until
	 * somebody decides where it goes, and a name that starts being asked for cannot sit on
	 * that list excusing nothing. It is the shape {@code WhatRegistrationAsksForTest}
	 * already uses for the registration's own form file.
	 *
	 * <p><b>It exists because the comparison was made by eye and was wrong.</b> The record
	 * said it was „what the form sends and nothing besides" while differing from that file
	 * in two of five names, and a member sending the form's own {@code note} was answered
	 * 201 with a queue card that had nothing on it: Jackson drops a field nothing is named
	 * for. A sentence claiming a file says something is worth exactly as much as whatever
	 * reads the file.
	 */
	@Test
	void everyFieldTheFormDefinesIsOneThisRouteUnderstands() throws Exception {
		List<String> onTheForm = new ArrayList<>();

		for (JsonNode field : mapper.readTree(Files.readString(THE_MEMBERS_FORM)).path("fields")) {
			onTheForm.add(field.path("name").asString());
		}

		assertThat(onTheForm)
				.as("%s defines no field at all, so this compares nothing", THE_MEMBERS_FORM)
				.isNotEmpty();

		List<String> theRouteTakes = new ArrayList<>();

		for (RecordComponent one : TeamWriteApi.Proposed.class.getRecordComponents()) {
			theRouteTakes.add(one.getName());
		}

		assertThat(theRouteTakes)
				.as("a field the member's form asks for is one this route has no name for, so"
						+ " Jackson drops it and he is answered 201 with it thrown away")
				.containsAll(onTheForm);

		assertThat(TeamWriteApi.ASKED_FOR_BEFORE_THE_FORM_ASKS)
				.as("a name excused as one the form does not ask for is one the form DOES ask"
						+ " for, so the list is excusing nothing")
				.doesNotContainAnyElementsOf(onTheForm)
				.allSatisfy(named -> assertThat(theRouteTakes)
						.as("%s is excused as a field this route takes before the form asks for"
								+ " it, and this route does not take it at all", named)
						.contains(named));

		assertThat(theRouteTakes)
				.as("this route takes a field that is neither on the member's form nor named as"
						+ " one the form does not ask for yet")
				.allMatch(one -> onTheForm.contains(one)
						|| TeamWriteApi.ASKED_FOR_BEFORE_THE_FORM_ASKS.contains(one));
	}

	/**
	 * AND WHAT THE FORM REALLY SENDS REACHES THE MODERATOR.
	 *
	 * <p>The body below is written out with the form's own four names and nothing else -
	 * not built from {@code Proposed}, because a request built from the record would agree
	 * with the record whatever either of them said. That is the measurement the floor above
	 * cannot make: the floor says the names line up, this says the words arrive.
	 *
	 * <p>„Zasto ovaj tim" is what {@code teams.proposeNote} asks him, and
	 * {@code teams.proposeBody} draws it on the card. Answered 201 with it dropped, the
	 * member would be told his proposal was sent and the moderator would be shown a name
	 * and nothing else.
	 */
	@Test
	void whatTheFormSendsIsWhatTheModeratorReads() throws Exception {
		MockHttpServletResponse answer = proposeAs(ME, "{\"name\": \"  Pancevacki trkaci  \","
				+ " \"city\": \"  Pancevo  \", \"country\": \"RS\","
				+ " \"note\": \"  Trcimo svake subote i hocemo svoj tim  \"}");

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(db.sql("select v.body from verification v join team_proposal tp"
						+ " on tp.id = v.team_proposal_id where tp.name = ?")
				.param("Pancevacki trkaci").query(String.class).single())
				.as("what the member wrote to whoever decides did not reach the queue card")
				.isEqualTo("Trcimo svake subote i hocemo svoj tim");

		assertThat(db.sql("select bio from team_proposal where name = ?")
				.param("Pancevacki trkaci").query(String.class).single())
				.as("the note was written into the team's own description as well, which is a"
						+ " second home for it and a description nobody wrote")
				.isEmpty();
	}

	private long countryKey() {
		return db.sql("select id from country where code = 'RS'").query(Long.class).single();
	}

	private long proposalIdNamed(String name) {
		return db.sql("select id from team_proposal where name = ?").param(name)
				.query(Long.class).single();
	}

	private long idIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("id").asLong();
	}

	/**
	 * „IZADJI IZ TIMA", SENT THE WAY A BROWSER SENDS IT: no body and no content type.
	 *
	 * <p>Not {@link #sent}, which puts {@code application/json} and a body on every request
	 * it makes. A {@code DELETE} carries neither, and the difference is measurable rather
	 * than tidy: a {@code consumes} added to the mapping would match a request carrying a
	 * type and refuse this one, so a case that sent JSON would go on passing while the real
	 * button answered 404.
	 */
	private MockHttpServletResponse leaveAs(String memberNumber, String teamSlug)
			throws Exception {

		return http.perform(delete("/api/teams/" + teamId(teamSlug) + "/membership").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(memberNumber))))
				.andReturn().getResponse();
	}

	private long teamId(String slug) {
		return db.sql("select id from team where slug = ?").param(slug).query(Long.class).single();
	}

	/**
	 * EVERY MEMBERSHIP ROW THIS MEMBER HAS, WHOLE AND IN ORDER, as strings a case can read.
	 *
	 * <p>All of them and not the open one, which is the difference between the two things
	 * leaving can write: a membership that has BEGUN is still a row afterwards and one that
	 * has NOT is no row at all. Asked for „his open membership" instead, both answers would
	 * be „none" and the two branches would be one assertion.
	 *
	 * <p>The team, both seasons and the reason together, because each is a way the write
	 * could be wrong on its own: the wrong team ended, the wrong season written, or a row
	 * ended without saying why - which is the pair {@code team_membership_leaving_says_why}
	 * refuses one table along.
	 */
	private List<String> membershipsOf(String memberNumber) {
		return db.sql("select t.slug || ' ' || m.season_from || '-' || coalesce(m.season_to::text,"
						+ " 'open') || ' ' || coalesce(m.left_reason, 'still in it')"
						+ " from team_membership m join team t on t.id = m.team_id"
						+ " where m.competitor_id = ? order by m.id")
				.param(competitorId(memberNumber))
				.query(String.class).list();
	}

	/** Who is NAMED in the team's seat, which V11 keeps as a column that may be empty. */
	private String seatOf(String slug) {
		return db.sql("select coalesce(c.member_number, 'nobody') from team t"
						+ " left join competitor c on c.id = t.admin_id where t.slug = ?")
				.param(slug)
				.query(String.class).single();
	}

	private void sitsInTheSeatOf(String memberNumber, String slug) {
		db.sql("update team set admin_id = (select id from competitor where member_number = ?)"
						+ " where slug = ?")
				.params(memberNumber, slug).update();
	}

	/**
	 * A MEMBERSHIP THAT HAS BEGUN IS ENDED WITH THIS SEASON AND NOT REMOVED.
	 *
	 * <p>Owner, 24.09.2026: „Iz tima se izlazi u istom prozoru u kom se i ulazi (1.10-31.12)",
	 * his reason being that „tim nosi bodove kroz sezonu, pa bi izlazak usred nje znacio da
	 * tabela u januaru i tabela u junu govore razlicito o istoj sezoni". So the row stays and
	 * says he was in the team for the whole of 2027, which V11's {@code season_to} spells as
	 * „the last season he is in it", and he is out of it from 2028.
	 *
	 * <p><b>This is the half a route that simply deleted the row would fail, and nothing else
	 * would notice.</b> A member gone from the table is a member gone from the season he ran
	 * in, and the table for 2027 would then say two different things in June and in November.
	 * So the case reads the ROW and not the absence of one.
	 *
	 * <p><b>And the team he leaves is not the only team, nor the one whose name is taken, nor
	 * the one anybody else is in</b> - the fixture keeps three - so „his membership ended" and
	 * „the table was emptied" are two different databases afterwards.
	 *
	 * <p><b>TWO MOMENTS AND NOT ONE, BECAUSE ON THIS FILE'S OWN DAY THE ANSWER HAS TWO
	 * SOURCES AND THEY ARE THE SAME NUMBER.</b> The fixture's clock reads October 2027 and
	 * {@link #IN_A_TEAM_NOW}'s membership begins in 2027, so „the season being run" and „the
	 * season the membership began in" are both 2027: a route writing
	 * {@code season_to = season_from} passes the first run and has ended every membership in
	 * the season it started. The second run is the same October a year later, where the two
	 * are 2028 and 2027, and only one of them is the answer.
	 *
	 * @param moment   the October the member presses in
	 * @param seasonTo the last season he is then in the team
	 */
	@ParameterizedTest
	@CsvSource({
			"2027-10-03T09:00:00Z, 2027, the season the membership also began in",
			"2028-10-03T09:00:00Z, 2028, a season that is not the one it began in"})
	void aMembershipThatHasBegunIsEndedWithThisSeasonAndNotRemoved(String moment, int seasonTo,
			String what) throws Exception {

		clock.moveTo(Instant.parse(moment));

		long rowsBefore = howManyMemberships();

		assertThat(leaveAs(IN_A_TEAM_NOW, THE_OTHER_TEAM).getStatus())
				.as("a member inside the transfer window was refused the way out of his team")
				.isEqualTo(204);

		assertThat(membershipsOf(IN_A_TEAM_NOW))
				.as("%s: the row was removed, or ended in the wrong season, or ended with the"
						+ " wrong reason", what)
				.containsExactly(THE_OTHER_TEAM + " " + A_SEASON_ALREADY_RUNNING + "-" + seasonTo
						+ " " + THE_REASON_A_MEMBER_LEAVING_WRITES);

		assertThat(howManyMemberships())
				.as("somebody else's membership went with his")
				.isEqualTo(rowsBefore);

		assertThat(membershipsOf(HAS_A_TEAM))
				.as("the other member's membership was touched")
				.containsExactly(HIS_TEAM + " " + A_SEASON_STILL_TO_COME + "-open still in it");
	}

	/**
	 * A MEMBERSHIP THAT HAS NOT BEGUN IS REMOVED RATHER THAN ENDED.
	 *
	 * <p>The ordinary case rather than an edge, and that is the point of it: joining writes
	 * {@code season_from = }{@link SeasonClock#seasonBeingPaidFor}, which inside the transfer
	 * window is NEXT year, so a member who joined in October and changed his mind in November
	 * has a membership that begins in a season nobody has run.
	 *
	 * <p>Ended with {@code season_to}, the smallest number the schema would take is
	 * {@code season_from} itself, and such a row says he WAS in the team for a season he
	 * never saw. There is no history in it to keep.
	 *
	 * <p><b>Both halves of this axis are in the fixture and they differ in nothing but the
	 * season</b>: {@link #IN_A_TEAM_NOW} began in 2027 and {@link #HAS_A_TEAM} begins in 2029,
	 * and the two cases read two different databases afterwards. A route that always ended the
	 * row fails here on the constraint; one that always removed it fails the case above.
	 */
	@Test
	void aMembershipThatHasNotBegunIsRemovedRatherThanEnded() throws Exception {
		long rowsBefore = howManyMemberships();

		assertThat(leaveAs(HAS_A_TEAM, HIS_TEAM).getStatus()).isEqualTo(204);

		assertThat(membershipsOf(HAS_A_TEAM))
				.as("a membership that never began was kept, saying he was in the team for a"
						+ " season he never saw")
				.isEmpty();

		assertThat(howManyMemberships()).isEqualTo(rowsBefore - 1);

		assertThat(membershipsOf(IN_A_TEAM_NOW))
				.as("the other member's membership went with his")
				.containsExactly(THE_OTHER_TEAM + " " + A_SEASON_ALREADY_RUNNING
						+ "-open still in it");
	}

	/**
	 * AND WHAT LEAVING BUYS HIM IS THE NEXT SEASON, WHICH IS THE TWO READINGS AGREEING.
	 *
	 * <p>„Nema tim" is read off the record (PDL, 05.09.2026), and the record after leaving is
	 * a membership ENDED in the season being run. {@code Membership.standsInTheWayOfJoiningIn}
	 * is the one place that turns it back into an answer, and the answer has to be: not for
	 * this season, yes for the next. That is the whole of what the transfer window is for.
	 *
	 * <p><b>It is measured through {@code POST /api/teams} rather than asserted</b>, because
	 * the two readings live in two places - this route writes {@code season_to} and that one
	 * reads it - and a case over one of them alone cannot see them drift. Narrow the write to
	 * „remove the row" and this passes for the wrong reason; widen the read to „has an open
	 * membership" and it passes while a member founds a second team for a season he is still
	 * in one for.
	 */
	@Test
	void leavingFreesHimForTheNextSeasonAndTheDatabaseAgrees() throws Exception {
		assertThat(proposeAs(IN_A_TEAM_NOW, naming("Zimski trkaci")).getStatus())
				.as("a member who is in a team was allowed to found another")
				.isEqualTo(404);

		assertThat(leaveAs(IN_A_TEAM_NOW, THE_OTHER_TEAM).getStatus()).isEqualTo(204);

		assertThat(proposeAs(IN_A_TEAM_NOW, naming("Zimski trkaci")).getStatus())
				.as("a member who has left is still held by the team he left")
				.isEqualTo(201);

		assertThat(db.sql("select count(*) from team_membership where competitor_id = ?"
						+ " and int4range(season_from, coalesce(season_to + 1, 2147483647))"
						+ " && int4range(?, 2147483647)")
				.params(competitorId(IN_A_TEAM_NOW), A_SEASON_ALREADY_RUNNING + 1)
				.query(Long.class).single())
				.as("the row he left behind still covers the season he would join for, which is"
						+ " the range team_membership_one_team_at_a_time refuses")
				.isZero();
	}

	/**
	 * THE ADMINISTRATOR'S SEAT EMPTIES WHEN IT IS HE WHO LEAVES, AND NOBODY ELSE'S DOES.
	 *
	 * <p>PDL P13, 11.08.2026: „Kad je administrator tima obrisan na zahtev ili
	 * diskvalifikovan, biva isto sto i kad ode sam", and PDL „Inkrement 133", 04.09.2026:
	 * „Administrator tima je onaj ko je tim osnovao, a kad se mesto isprazni preuzima ga clan
	 * koji je najduze u timu." V11 keeps {@code admin_id} as the record of who was NAMED -
	 * „It EMPTIES rather than blocking anything" - so leaving nulls it and the query that
	 * already answers succession takes it from there.
	 *
	 * <p><b>THREE SEATS, AND ONE OF THEM IS HIS OWN IN A TEAM HE IS NOT LEAVING.</b> Each is
	 * a way the condition {@code where id = ? and admin_id = ?} could be written with one
	 * half missing, and no two of them can be told apart by a fixture with one seat in it:
	 *
	 * <ul>
	 * <li><b>The team he leaves, where he sits</b> - the seat must empty.
	 * <li><b>Another team where HE sits and which he is not leaving</b> - the seat must
	 * stay, which is what {@code and id = ?} is for. A seat naming somebody who is not in
	 * the team is not a broken row: V11 keeps {@code admin_id} as who was NAMED and
	 * {@link TeamApi} works succession out from the roster, so this is an ordinary state and
	 * leaving a DIFFERENT team says nothing about it.
	 * <li><b>A team where somebody else sits</b> - the seat must stay, which is what
	 * {@code and admin_id = ?} is for.
	 * </ul>
	 */
	@Test
	void theAdministratorsSeatEmptiesWhenHeLeavesAndNobodyElsesDoes() throws Exception {
		sitsInTheSeatOf(IN_A_TEAM_NOW, THE_OTHER_TEAM);
		sitsInTheSeatOf(IN_A_TEAM_NOW, TAKEN_ADDRESS);
		sitsInTheSeatOf(HAS_A_TEAM, HIS_TEAM);

		assertThat(leaveAs(IN_A_TEAM_NOW, THE_OTHER_TEAM).getStatus()).isEqualTo(204);

		assertThat(seatOf(THE_OTHER_TEAM))
				.as("the seat still names a member who has left the team")
				.isEqualTo("nobody");

		assertThat(seatOf(TAKEN_ADDRESS))
				.as("his seat in a team he did NOT leave was emptied, which is leaving one team"
						+ " costing him another")
				.isEqualTo(IN_A_TEAM_NOW);

		assertThat(seatOf(HIS_TEAM))
				.as("another team's seat was emptied by somebody leaving a third one")
				.isEqualTo(HAS_A_TEAM);
	}

	/**
	 * AND A MEMBER WHO IS NOT IN THE SEAT LEAVES IT EXACTLY WHERE IT IS.
	 *
	 * <p>The other state of the same axis, and it is the one a route with no condition at all
	 * would fail: written {@code set admin_id = null where id = ?}, the ordinary member
	 * walking out takes the administrator's title with him.
	 */
	@Test
	void aMemberWhoIsNotInTheSeatLeavesItWhereItIs() throws Exception {
		sitsInTheSeatOf(HAS_A_TEAM, THE_OTHER_TEAM);

		assertThat(leaveAs(IN_A_TEAM_NOW, THE_OTHER_TEAM).getStatus()).isEqualTo(204);

		assertThat(seatOf(THE_OTHER_TEAM))
				.as("an ordinary member leaving took the administrator's seat with him")
				.isEqualTo(HAS_A_TEAM);
	}

	/**
	 * LEAVING HAPPENS ONLY INSIDE THE TRANSFER WINDOW, AND THE MEMBERSHIP IS UNTOUCHED
	 * OUTSIDE IT.
	 *
	 * <p>Owner, 24.09.2026: the same window joining is in. The four moments are
	 * {@code aTeamIsFoundedOnlyInsideTheTransferWindow}'s, to the minute, because it is the
	 * same window read for the other direction - and they are the minutes on either side of
	 * midnight in BELGRADE, which is ADL A36 O2 written as two failures rather than as a
	 * comment: a server reading its own zone accepts the last request before the window and
	 * refuses the first inside it.
	 *
	 * <p><b>And the refusal carries a reason, which the founding one does not.</b> There the
	 * window is one of two refusals told apart and a member is not to learn which stopped him;
	 * here the only caller who gets this far is somebody the portal agrees is in this team,
	 * asking about his own membership, so there is nothing left to hide.
	 */
	@ParameterizedTest
	@CsvSource({
			"2027-09-30T21:59:00Z, 409, the last minute of September in Belgrade",
			"2027-09-30T22:00:00Z, 204, midnight opening 1 October in Belgrade",
			"2027-12-31T22:59:00Z, 204, the last minute of 31 December in Belgrade",
			"2027-12-31T23:00:00Z, 409, midnight opening 1 January in Belgrade"})
	void aMemberLeavesHisTeamOnlyInsideTheTransferWindow(String moment, int expected, String what)
			throws Exception {

		clock.moveTo(Instant.parse(moment));

		MockHttpServletResponse answer = leaveAs(IN_A_TEAM_NOW, THE_OTHER_TEAM);

		assertThat(answer.getStatus())
				.as("%s (%s) was answered wrongly", what, moment)
				.isEqualTo(expected);

		if (expected == 409) {
			assertThat(reasonIn(answer))
					.as("%s: the member was refused without being told what stopped him", what)
					.isEqualTo(TeamWriteApi.THE_WINDOW_IS_SHUT);

			assertThat(membershipsOf(IN_A_TEAM_NOW))
					.as("%s: the membership was written to on a day the window is shut", what)
					.containsExactly(THE_OTHER_TEAM + " " + A_SEASON_ALREADY_RUNNING
							+ "-open still in it");
		}
	}

	/**
	 * A TEAM HE IS NOT IN ANSWERS WHAT AN ADDRESS THAT IS NOT THERE ANSWERS.
	 *
	 * <p>ADL A8: „prijavljen kome pravo nedostaje dobija 404, isti odgovor kao da adresa ne
	 * postoji." Four callers and one answer - a member in no team at all, a member in a
	 * DIFFERENT team, a team key nobody carries, and a member whose fee has lapsed - so a
	 * caller walking the keys learns neither which teams exist nor who is in them.
	 *
	 * <p><b>The second of the four is the one that matters</b>: a route that read „his open
	 * membership" and ignored the team in the address would end the wrong team's membership
	 * and answer 204, and a fixture with one team in it could not tell the two apart.
	 */
	@Test
	void aTeamHeIsNotInAnswersWhatAnAddressThatIsNotThereAnswers() throws Exception {
		long rowsBefore = howManyMemberships();

		MockHttpServletResponse noTeamAtAll = leaveAs(ME, THE_OTHER_TEAM);

		assertThat(noTeamAtAll.getStatus()).isEqualTo(404);
		assertThat(noTeamAtAll.getContentAsString())
				.as("the refusal said something, and there is nothing here to say")
				.isEmpty();

		assertThat(leaveAs(IN_A_TEAM_NOW, HIS_TEAM).getStatus())
				.as("a member ended his membership of a team that was not the one in the address")
				.isEqualTo(404);

		assertThat(http.perform(delete("/api/teams/" + (teamId(THE_OTHER_TEAM) + 100_000)
						+ "/membership").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(IN_A_TEAM_NOW))))
				.andReturn().getResponse().getStatus())
				.as("a team key nobody carries is told apart from a team he is not in")
				.isEqualTo(404);

		assertThat(howManyMemberships()).as("a membership went").isEqualTo(rowsBefore);
		assertThat(membershipsOf(IN_A_TEAM_NOW))
				.containsExactly(THE_OTHER_TEAM + " " + A_SEASON_ALREADY_RUNNING
						+ "-open still in it");
	}

	/**
	 * AND AN ACCOUNT THAT NAMES NO MEMBER LEAVES NOTHING EITHER.
	 *
	 * <p>V23 lets {@code account.competitor_id} be null for „a moderator who does not race,
	 * which is the ordinary case and not a fault". There is nobody here whose membership this
	 * could be, so the answer is {@code propose}'s and {@link InboxApi}'s: 404 with nothing in
	 * it, by ADL A8.
	 *
	 * <p><b>This case exists because the coverage gate found the branch, not because the
	 * branch looked doubtful.</b> {@code JaCoCo} reported one line and one of two branches
	 * uncovered in {@code TeamWriteApi.leave}, and it was exactly this one: {@code propose}
	 * asks the same first question and has been measured since it was written, while the way
	 * out asked it and nobody ever arrived. A branch nothing reaches is a branch nothing holds
	 * - swap the {@code return away()} for anything at all and no case moves.
	 *
	 * <p>{@code PairWriteApi.breakUp} asks the identical question and
	 * {@code anAccountThatNamesNoMemberEndsNothing} is its case, which is why the report named
	 * one class and not two. The class was swept in both routes rather than in the one that
	 * was red.
	 */
	@Test
	void anAccountThatNamesNoMemberLeavesNothing() throws Exception {
		long rowsBefore = howManyMemberships();

		MockHttpServletResponse answer = http.perform(
						delete("/api/teams/" + teamId(THE_OTHER_TEAM) + "/membership").with(csrf())
								.cookie(new Cookie(SessionCookie.NAME,
										sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret())))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("an account with no member behind it reached a membership that is not his")
				.isEqualTo(404);

		assertThat(answer.getContentAsString())
				.as("the refusal explains itself, and the owner deleted the sentence that did"
						+ " (PDL P13, 05.09.2026)")
				.isEmpty();

		assertThat(howManyMemberships())
				.as("a membership went on behalf of an account that names nobody")
				.isEqualTo(rowsBefore);

		assertThat(membershipsOf(IN_A_TEAM_NOW))
				.containsExactly(THE_OTHER_TEAM + " " + A_SEASON_ALREADY_RUNNING
						+ "-open still in it");
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED IS NOBODY AT THIS ADDRESS.
	 *
	 * <p>PDL P13, 19.09.2026: „Clan kome je istekla clanarina dopire samo do strane za obnovu,
	 * i automatski ispada iz svih timova i parova kad pocne sezona... jer se sve akcije za
	 * njega brane." Leaving a team is such an action, and he needs no route for it: the same
	 * decision has him falling out of every team when the season turns.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedIsNobodyAtThisAddress() throws Exception {
		db.sql("update competitor set active = false where member_number = ?")
				.param(IN_A_TEAM_NOW).update();

		assertThat(leaveAs(IN_A_TEAM_NOW, THE_OTHER_TEAM).getStatus())
				.as("a member whose fee has lapsed reached a route that is not the renewal page")
				.isEqualTo(404);

		assertThat(membershipsOf(IN_A_TEAM_NOW))
				.containsExactly(THE_OTHER_TEAM + " " + A_SEASON_ALREADY_RUNNING
						+ "-open still in it");
	}

	/**
	 * AND A STRANGER IS REFUSED BY THE CHAIN, BEFORE THIS CLASS RUNS.
	 *
	 * <p>401 and not 404, which is ADL A8's other half. The path is worth a word: it sits
	 * UNDER {@code /api/teams}, which is on {@link ApiSecurity#READ_BY_ANYBODY}, and that list
	 * holds whole addresses rather than prefixes - so this sub-path was never open to a
	 * visitor for any verb.
	 */
	@Test
	void somebodyWhoIsNotSignedInIsAskedToLeaveNothing() throws Exception {
		assertThat(http.perform(delete("/api/teams/" + teamId(THE_OTHER_TEAM) + "/membership")
						.with(csrf()))
				.andReturn().getResponse().getStatus())
				.as("a stranger reached a write under an address opened for reading")
				.isEqualTo(401);

		assertThat(membershipsOf(IN_A_TEAM_NOW))
				.containsExactly(THE_OTHER_TEAM + " " + A_SEASON_ALREADY_RUNNING
						+ "-open still in it");
	}

	/** The queue row about one proposed name, read back whole. */
	private List<Object> theQueueRowFor(String name) {
		return db.sql("select v.queue, v.competitor_id, v.subject, v.body, v.state,"
						+ " v.team_proposal_id, v.photo_id, v.decided_at"
						+ " from verification v join team_proposal tp on tp.id = v.team_proposal_id"
						+ " where tp.name = ?")
				.param(name)
				.query((row, one) -> List.of(row.getString(1), row.getObject(2), row.getString(3),
						row.getString(4), row.getString(5), row.getObject(6),
						String.valueOf(row.getObject(7)), String.valueOf(row.getObject(8))))
				.single();
	}
}

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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A MEMBER PUTTING A TEAM FORWARD, END TO END: what goes into the queue, who is sent away,
 * and what is left standing when somebody is.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on every axis an assertion
 * below reads a value along:
 *
 * <ul>
 * <li><b>Four competitors, and the one who proposes is written THIRD</b>, so „the member
 * asking" and „the first member" are different keys and a statement that lost its condition
 * answers differently.
 * <li><b>Somebody in the fixture IS in a team, and he is refused</b>, which is the one axis
 * a fixture where nobody has a team cannot separate at all: with only members who have none,
 * a route that never asked the question passes every case here.
 * <li><b>The team he is in is not the team whose name is taken</b>, so „a team exists" and
 * „his team" are two rows.
 * <li><b>His membership begins in a season that has NOT started</b> (2029, while the clock
 * reads 2027 and the season being joined is 2028), which is the owner's own case of
 * 05.09.2026 and the one that tells „he has a team on the record" from „he is in a team this
 * season" apart. Read by season he has none and must still be refused.
 * <li><b>Three different years, never one.</b> The clock's year is 2027, the season a
 * membership would begin in is 2028, and every team in the fixture carries
 * {@code first_season} 2030 - so „derived from the window" and „today's year" can never
 * hand back the same number.
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

	/** In a team, and the one member this route has to refuse. */
	private static final String HAS_A_TEAM = "000200";

	/** The member every case asks with, written third. */
	private static final String ME = "000300";

	/** Has a proposal and a queue row already waiting, neither of which may move. */
	private static final String SOMEONE_ELSE = "000400";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	/** The team whose name is taken, which is NOT the team anybody is in. */
	private static final String TAKEN_NAME = "Dunavski trkači";

	private static final String TAKEN_ADDRESS = "dunavski-trkaci";

	/** And the team {@link #HAS_A_TEAM} is in, which no case proposes the name of. */
	private static final String HIS_TEAM = "sava-runners";

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

	/** No country is served under it, and the fixture says so out loud below. */
	private static final String A_COUNTRY_NOBODY_SERVES = "QQ";

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

		team(TAKEN_ADDRESS, TAKEN_NAME);
		team(HIS_TEAM, "Sava Runners");

		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?)")
				.params(HAS_A_TEAM, HIS_TEAM, A_SEASON_STILL_TO_COME)
				.update();

		account("prvi@primer.rs", FIRST_WRITTEN);
		account("ima-tim@primer.rs", HAS_A_TEAM);
		account("ja@primer.rs", ME);
		account("neko-drugi@primer.rs", SOMEONE_ELSE);
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
	private String form(String name, String bio, String link, String city, String country) {
		return mapper.writeValueAsString(
				new TeamWriteApi.Proposed(name, bio, link, city, country));
	}

	private String naming(String name) {
		return form(name, null, null, "  Novi Sad  ", "RS");
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
		assertThat(db.sql("select count(*) from team_membership m join competitor c"
						+ " on c.id = m.competitor_id where c.member_number = ? and m.season_to is null")
				.param(HAS_A_TEAM).query(Long.class).single())
				.as("nobody in this fixture is in a team, so every case below is green whether or"
						+ " not the route ever asks")
				.isOne();

		assertThat(db.sql("select count(*) from team_membership m join competitor c"
						+ " on c.id = m.competitor_id where c.member_number = ?")
				.param(ME).query(Long.class).single())
				.as("the member who proposes is in a team, so the ordinary case measures a refusal")
				.isZero();

		int year = INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE).getYear();

		assertThat(List.of(year, SeasonClock.seasonBeingPaidFor(
						INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE)), A_SEASON_NO_CASE_COMPUTES,
						A_SEASON_STILL_TO_COME))
				.as("two of the four years this fixture uses are the same number, so a route"
						+ " reading the wrong one answers correctly anyway")
				.doesNotHaveDuplicates();

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
				form("  Dunavski   TRKAČ  ", "  Trcimo zajedno  ", null, "  Novi Sad  ", "RS"));

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(howManyProposals())
				.as("the proposal was not written")
				.isEqualTo(proposalsBefore + 1);

		assertThat(proposalNamed("Dunavski   TRKAČ"))
				.as("the row does not hold what was sent: the town, the description and the link"
						+ " are the four columns an approval builds the team out of, and `team_id`"
						+ " being empty is what makes this a NEW team rather than a change to one")
				.containsExactly(competitorId(ME), "null", "Dunavski   TRKAČ", "Trcimo zajedno", "",
						"null", "Novi Sad", String.valueOf(countryKey()), "null");

		assertThat(theQueueRowFor("Dunavski   TRKAČ"))
				.as("the queue row does not carry the proposal, the member it is about, the name"
						+ " and the description, in the tab that is the only one V11 lets a proposal"
						+ " stand in")
				.containsExactly("teams", competitorId(ME), "Dunavski   TRKAČ", "Trcimo zajedno",
						"waiting", proposalIdNamed("Dunavski   TRKAČ"), "null", "null");

		assertThat(howManyTeams())
				.as("a team was written, and nobody has decided on this proposal yet")
				.isEqualTo(2);
		assertThat(howManyMemberships())
				.as("somebody was put into a team, and nobody has decided on this proposal yet")
				.isOne();
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
	 * A MEMBER WHO IS ALREADY IN A TEAM IS SENT AWAY, AND HIS MEMBERSHIP BEGINS IN A SEASON
	 * THAT HAS NOT STARTED.
	 *
	 * <p>That last half is the whole case rather than a detail of it. PDL P13, 05.09.2026:
	 * „„Nema tim" se cita sa zapisa ({@code teamId}), ne po sezoni", with the owner's own
	 * example of a member the portal does not count in his team today and still refuses,
	 * because founding one now would leave him in two on 1 January. A condition comparing his
	 * membership's season with the one being joined lets him through, and every other case in
	 * this file stays green.
	 */
	@Test
	void aMemberWhoseTeamStartsNextSeasonIsStillAMemberWithATeam() throws Exception {
		long proposalsBefore = howManyProposals();
		long waitingBefore = howManyWaitingInTheTeamsQueue();

		MockHttpServletResponse answer = proposeAs(HAS_A_TEAM, naming("  Novi tim  "));

		assertThat(answer.getStatus())
				.as("a member already in a team founded a second one")
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
				proposeAs(ME, form(name, null, null, city, country));

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
				form("  Timski tim  ", null, null, "  Novi Sad  ", A_COUNTRY_NOBODY_SERVES));

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
				form("  Linkovani tim  ", "", link, "  Novi Sad  ", "RS"));

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
		assertThat(proposeAs(ME, form("  Linkovani tim  ", "", "  https://primer.rs/tim  ",
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

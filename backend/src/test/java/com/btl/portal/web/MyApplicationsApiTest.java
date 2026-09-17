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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * EVERYTHING ONE COMPETITOR IS WAITING TO HEAR BACK ABOUT, and nothing anybody
 * else is.
 *
 * <p>Every axis this fixture separates is separated on purpose, the same
 * discipline {@code AttendanceApiTest} and {@code JoiningConstraintsTest} already
 * hold to for the same four tables: never one competitor, never one team, never
 * one row of a kind, never a day equal to the day this suite's own clock would
 * read, and always somebody else's row of the identical shape sitting in the
 * database to prove it was left out on purpose rather than never written.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MyApplicationsApiTest {

	private static final String ME = "000100";

	/** Has one row in every one of the four tables, none of which name {@link #ME}. */
	private static final String SOMEONE_ELSE = "000200";

	/** Asked by {@link #ME} into a pair; never the one who asked. */
	private static final String PAIR_TO = "000300";

	/** Asked {@link #ME} into a pair; never the one who was asked. */
	private static final String PAIR_FROM = "000400";

	/** {@link #SOMEONE_ELSE}'s own pair question, naming neither {@link #ME} nor either of
	 *  the two above. */
	private static final String THIRD_PARTY = "000500";

	private static final String ME_EMAIL = "ja@primer.rs";

	private static final String MODERATOR_EMAIL = "moderator-bez-clana@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private int issued;

	private SecretToken session;

	@BeforeEach
	void aCompetitorFourTeamsHeIsWaitingOnAndSomebodyElsesRowsOfEveryKind() {
		competitor(ME, "Ja", "Pitam", "M");
		competitor(SOMEONE_ELSE, "Neko", "Drugi", "F");
		competitor(PAIR_TO, "Kome", "Saljem", "M");
		competitor(PAIR_FROM, "Ko", "Meni Salje", "F");
		competitor(THIRD_PARTY, "Trece", "Lice", "M");

		team("tim-jedan", "Tim Jedan");
		team("tim-dva", "Tim Dva");
		team("tim-tri", "Tim Tri");
		team("tim-cetiri", "Tim Cetiri");
		team("tim-za-izmenu", "Tim Za Izmenu");
		team("tudji-tim-prijave", "Tudji Tim Prijave");
		team("tudji-tim-poziva", "Tudji Tim Poziva");

		/* TWO APPLICATIONS OF MINE, TO TWO DIFFERENT TEAMS, WRITTEN OUT OF DATE ORDER
		   so a missing `order by` answers in the wrong order. */
		application(ME, "tim-dva", "2026-08-20 09:00:00+00");
		application(ME, "tim-jedan", "2026-08-10 09:00:00+00");
		/* SOMEBODY ELSE'S APPLICATION, to a team of its own, which must never reach me. */
		application(SOMEONE_ELSE, "tudji-tim-prijave", "2026-08-11 09:00:00+00");

		/* TWO INVITATIONS OF MINE, FROM TWO DIFFERENT TEAMS, likewise scrambled. */
		invitation("tim-cetiri", ME, "2026-08-22 09:00:00+00");
		invitation("tim-tri", ME, "2026-08-12 09:00:00+00");
		/* SOMEBODY ELSE'S INVITATION, from a team of its own. */
		invitation("tudji-tim-poziva", SOMEONE_ELSE, "2026-08-13 09:00:00+00");

		/* TWO PROPOSALS OF MINE STILL WAITING: one names no team at all (a brand new
		   one), one names an existing team (a change to it) - so the nullable column
		   genuinely varies and is not merely left the same by accident. Scrambled. */
		proposalWaiting(ME, "Predlog Izmene", "tim-za-izmenu", "2026-08-25 09:00:00+00");
		proposalWaiting(ME, "Sasvim Nov Tim", null, "2026-08-05 09:00:00+00");
		/* A THIRD PROPOSAL OF MINE, ALREADY DECIDED WEEKS AGO. ADL A42: a decided
		   verification row stands for ever, so this row is not going anywhere, and
		   the only thing that keeps it out of the answer is reading `state`. */
		proposalDecided(ME, "Vec Odluceno", null, "2026-07-01 09:00:00+00",
				"2026-07-05 09:00:00+00", "approved", "Taj Moderator");
		/* SOMEBODY ELSE'S PROPOSAL, still waiting, which must never reach me. */
		proposalWaiting(SOMEONE_ELSE, "Tudji Predlog", null, "2026-08-14 09:00:00+00");

		/* ONE PAIR INVITATION I SENT AND ONE I RECEIVED, so both directions of the one
		   table are exercised, with two different counterparts. Scrambled. */
		pairInvite(PAIR_FROM, ME, "2026-08-28 09:00:00+00");
		pairInvite(ME, PAIR_TO, "2026-08-15 09:00:00+00");
		/* SOMEBODY ELSE'S PAIR QUESTION, between two people who are neither of us. */
		pairInvite(SOMEONE_ELSE, THIRD_PARTY, "2026-08-16 09:00:00+00");

		account(ME_EMAIL, ME);
	}

	private void competitor(String number, String first, String last, String gender) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, first, last, gender, String.format("%016x", ++issued))
				.update();
	}

	private void team(String slug, String name) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id)"
						+ " values (?, ?, '', '', (select id from place where rank = 1), null, null,"
						+ " null, 2027, null)")
				.params(slug, name).update();
	}

	private long teamId(String slug) {
		return db.sql("select id from team where slug = ?").param(slug).query(Long.class).single();
	}

	private void application(String memberNumber, String teamSlug, String askedAt) {
		db.sql("insert into team_application (competitor_id, team_id, season, asked_at)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), 2028, timestamptz '" + askedAt + "')")
				.params(memberNumber, teamSlug).update();
	}

	private void invitation(String teamSlug, String memberNumber, String sentAt) {
		db.sql("insert into team_invitation (team_id, competitor_id, season, sent_at)"
						+ " values ((select id from team where slug = ?),"
						+ " (select id from competitor where member_number = ?), 2028,"
						+ " timestamptz '" + sentAt + "')")
				.params(teamSlug, memberNumber).update();
	}

	/**
	 * A team proposal still standing in the moderator's queue, exactly the shape
	 * V11 and V9 give it together: the proposal itself, and the {@code verification}
	 * row that queues it, {@code state = 'waiting'}.
	 */
	private void proposalWaiting(String memberNumber, String name, String teamSlug, String raisedAt) {
		long proposalId = insertProposal(memberNumber, name, teamSlug);

		db.sql("insert into verification (queue, competitor_id, subject, body, raised_at, state,"
						+ " team_proposal_id)"
						+ " values ('teams', (select id from competitor where member_number = ?), ?, '',"
						+ " timestamptz '" + raisedAt + "', 'waiting', ?)")
				.params(memberNumber, name, proposalId).update();
	}

	/**
	 * A team proposal whose queue row has already been decided, which ADL A42 keeps
	 * standing for ever. The one row this whole file exists to keep out of the
	 * answer.
	 */
	private void proposalDecided(String memberNumber, String name, String teamSlug, String raisedAt,
			String decidedAt, String state, String decidedByName) {
		long proposalId = insertProposal(memberNumber, name, teamSlug);

		db.sql("insert into verification (queue, competitor_id, subject, body, raised_at, state,"
						+ " decided_at, decided_by_name, team_proposal_id)"
						+ " values ('teams', (select id from competitor where member_number = ?), ?, '',"
						+ " timestamptz '" + raisedAt + "', ?, timestamptz '" + decidedAt + "', ?, ?)")
				.params(memberNumber, name, state, decidedByName, proposalId).update();
	}

	/**
	 * A proposal names a town in one of the two shapes V11 allows, exactly as a team
	 * itself does, and the constraint is an XOR: without a town at all the insert is
	 * refused. {@code place_id} is used here, the same codebook reference every
	 * other fixture in this package writes.
	 */
	private long insertProposal(String memberNumber, String name, String teamSlug) {
		if (teamSlug == null) {
			return db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link,"
							+ " place_id)"
							+ " values ((select id from competitor where member_number = ?), null, ?,"
							+ " '', '', (select id from place where rank = 1))"
							+ " returning id")
					.params(memberNumber, name)
					.query(Long.class).single();
		}

		return db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link, place_id)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?, '', '',"
						+ " (select id from place where rank = 1))"
						+ " returning id")
				.params(memberNumber, teamSlug, name)
				.query(Long.class).single();
	}

	private void pairInvite(String from, String to, String sentAt) {
		db.sql("insert into pair_invite (from_id, to_id, sent_at)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?),"
						+ " timestamptz '" + sentAt + "')")
				.params(from, to).update();
	}

	/** A signed in account naming a competitor, through {@code account.competitor_id} (V23). */
	private void account(String email, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, memberNumber).update();

		openSession(email);
	}

	/** A signed in account naming NO competitor at all: a moderator who does not race. */
	private void moderatorWithNoCompetitor(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

		openSession(email);
	}

	private void openSession(String email) {
		session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();
	}

	private MockHttpServletRequestBuilder asking() {
		return get("/api/me/applications").cookie(new Cookie(SessionCookie.NAME, session.secret()));
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(
				http.perform(asking()).andReturn().getResponse().getContentAsString());
	}

	private record Application(long id, long teamId, String date) {
	}

	private List<Application> teamApplications(JsonNode whole) {
		List<Application> out = new ArrayList<>();
		for (JsonNode one : whole.path("teamApplications")) {
			out.add(new Application(one.path("id").asLong(), one.path("teamId").asLong(),
					one.path("date").asString()));
		}
		return out;
	}

	private List<Application> teamInvitations(JsonNode whole) {
		List<Application> out = new ArrayList<>();
		for (JsonNode one : whole.path("teamInvitations")) {
			out.add(new Application(one.path("id").asLong(), one.path("teamId").asLong(),
					one.path("date").asString()));
		}
		return out;
	}

	private record Proposal(long id, Long teamId, String name, String date) {
	}

	private List<Proposal> teamProposals(JsonNode whole) {
		List<Proposal> out = new ArrayList<>();
		for (JsonNode one : whole.path("teamProposals")) {
			JsonNode teamId = one.path("teamId");
			out.add(new Proposal(one.path("id").asLong(), teamId.isNull() ? null : teamId.asLong(),
					one.path("name").asString(), one.path("date").asString()));
		}
		return out;
	}

	private record Invite(String memberNumber, boolean sentByMe, String date) {
	}

	private List<Invite> pairInvites(JsonNode whole) {
		List<Invite> out = new ArrayList<>();
		for (JsonNode one : whole.path("pairInvites")) {
			out.add(new Invite(one.path("memberNumber").asString(), one.path("sentByMe").asBoolean(),
					one.path("date").asString()));
		}
		return out;
	}

	/**
	 * A VISITOR WHO IS NOT SIGNED IN IS REFUSED, AND A SIGNED IN COMPETITOR IS NOT.
	 *
	 * <p>ADL P-javno keeps this route off {@code READ_BY_ANYBODY}: the answer is
	 * about one competitor and means nothing to anybody else, the same closedness
	 * {@code AttendanceApiTest} measures for {@code /api/attendance}.
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsRefusedAndASignedInCompetitorIsNot() throws Exception {
		assertThat(http.perform(get("/api/me/applications")).andReturn().getResponse().getStatus())
				.as("a visitor with no session read what a signed in competitor is waiting on")
				.isEqualTo(401);

		assertThat(http.perform(asking()).andReturn().getResponse().getStatus())
				.as("a signed in competitor was refused his own list")
				.isEqualTo(200);
	}

	/**
	 * A MODERATOR WITH NO COMPETITOR RECORD GETS FOUR EMPTY LISTS, NOT A REFUSAL.
	 *
	 * <p>V23 lets {@code account.competitor_id} be null for exactly this account,
	 * and none of the four tables can name a competitor who does not exist. Four
	 * empty lists is the honest answer, the same shape {@code ModeratorApi} and
	 * {@code VerificationApi} use for "nothing waiting": an empty list is not a
	 * broken record, and this is not the 404 a moderator with no queue is refused
	 * with elsewhere - this route is open to every signed in account.
	 */
	@Test
	void aModeratorWithNoCompetitorRecordGetsFourEmptyListsNotARefusal() throws Exception {
		moderatorWithNoCompetitor(MODERATOR_EMAIL);

		JsonNode whole = answer();

		assertThat(http.perform(asking()).andReturn().getResponse().getStatus())
				.as("a moderator with no racing record at all was refused rather than answered empty")
				.isEqualTo(200);
		assertThat(teamApplications(whole)).isEmpty();
		assertThat(teamInvitations(whole)).isEmpty();
		assertThat(teamProposals(whole)).isEmpty();
		assertThat(pairInvites(whole)).isEmpty();
	}

	/**
	 * MY OWN TWO APPLICATIONS, OLDEST FIRST, AND NOBODY ELSE'S.
	 */
	@Test
	void myTeamApplicationsComeBackOldestFirstAndOnlyMine() throws Exception {
		List<Application> mine = teamApplications(answer());

		assertThat(mine).as("one of my two applications is missing").hasSize(2);
		assertThat(mine).as("the answer is not in order by the day asked")
				.containsExactly(
						new Application(mine.get(0).id(), teamId("tim-jedan"), "2026-08-10"),
						new Application(mine.get(1).id(), teamId("tim-dva"), "2026-08-20"));

		assertThat(mine.stream().map(Application::teamId))
				.as("somebody else's application to a team of its own reached my answer")
				.doesNotContain(teamId("tudji-tim-prijave"));
	}

	/**
	 * MY OWN TWO INVITATIONS, OLDEST FIRST, AND NOBODY ELSE'S.
	 */
	@Test
	void myTeamInvitationsComeBackOldestFirstAndOnlyMine() throws Exception {
		List<Application> mine = teamInvitations(answer());

		assertThat(mine).as("one of my two invitations is missing").hasSize(2);
		assertThat(mine).as("the answer is not in order by the day sent")
				.containsExactly(
						new Application(mine.get(0).id(), teamId("tim-tri"), "2026-08-12"),
						new Application(mine.get(1).id(), teamId("tim-cetiri"), "2026-08-22"));

		assertThat(mine.stream().map(Application::teamId))
				.as("somebody else's invitation from a team of its own reached my answer")
				.doesNotContain(teamId("tudji-tim-poziva"));
	}

	/**
	 * MY TWO PROPOSALS STILL WAITING COME BACK, OLDEST FIRST; THE ONE ALREADY
	 * DECIDED DOES NOT, AND NEITHER DOES SOMEBODY ELSE'S.
	 *
	 * <p>The row this whole file is really about: {@code team_proposal} carries no
	 * state of its own, {@code verification} does, and ADL A42 keeps a decided
	 * {@code verification} row standing for ever. Reading {@code team_proposal}
	 * without joining to {@code verification.state = 'waiting'} would answer with
	 * "Vec Odluceno" alongside the two still open - approved five weeks before this
	 * fixture's own clock even starts.
	 */
	@Test
	void myWaitingProposalsComeBackAndTheDecidedOneDoesNot() throws Exception {
		List<Proposal> mine = teamProposals(answer());

		assertThat(mine.stream().map(Proposal::name))
				.as("the proposal decided weeks ago is still answering as waiting")
				.doesNotContain("Vec Odluceno");
		assertThat(mine.stream().map(Proposal::name))
				.as("somebody else's still-waiting proposal reached my answer")
				.doesNotContain("Tudji Predlog");

		assertThat(mine).as("one of my two still-waiting proposals is missing").hasSize(2);
		assertThat(mine).as("the answer is not in order by the day raised, or does not carry both")
				.containsExactly(
						new Proposal(mine.get(0).id(), null, "Sasvim Nov Tim", "2026-08-05"),
						new Proposal(mine.get(1).id(), teamId("tim-za-izmenu"), "Predlog Izmene",
								"2026-08-25"));
	}

	/**
	 * MY PAIR QUESTIONS COME BACK FROM BOTH DIRECTIONS, WITH MEMBER NUMBERS AND NOT
	 * RAW IDENTIFIERS, OLDEST FIRST; SOMEBODY ELSE'S QUESTION DOES NOT.
	 *
	 * <p>{@code pair_invite} is one table for both directions (V12: "svako sme da
	 * posalje zahtev svakome"), so the one I sent and the one I was sent both belong
	 * here, told apart by {@code sentByMe} rather than by two different lists that
	 * would invent a split the schema does not draw.
	 */
	@Test
	void myPairInvitesComeBackFromBothDirectionsAndSomebodyElsesDoesNot() throws Exception {
		List<Invite> mine = pairInvites(answer());

		assertThat(mine)
				.as("the answer is not in order by the day sent, or does not carry both directions")
				.containsExactly(
						new Invite(PAIR_TO, true, "2026-08-15"),
						new Invite(PAIR_FROM, false, "2026-08-28"));

		assertThat(mine.stream().map(Invite::memberNumber))
				.as("a pair question between two other people reached my answer")
				.doesNotContain(SOMEONE_ELSE, THIRD_PARTY);
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED IS NOT NAMED, AND THE INVITE ITSELF STAYS.
	 *
	 * <p><b>Why the number goes and the row does not.</b> {@code /api/competitors} stops
	 * carrying a member the day his fee lapses, so a number that is HERE and missing
	 * THERE is the difference between two answers, and that difference says he did not
	 * renew - „sve u vezi sa clanarinom" is what Article 74 shuts. The row is his own
	 * and he is the one who withdraws it, so it stays; the person behind it stops being
	 * named. Owner, 13.09.2026: „Kad je sporno, polje se IZOSTAVLJA i izostavljanje se
	 * imenuje sa razlogom."
	 *
	 * <p><b>The two sides are set up differently on purpose.</b> The lapsed member is the
	 * one I INVITED and the active one is the one who invited ME, so an answer that read
	 * the wrong side of the invite would put the null on the wrong row and this case
	 * would say so. A case where both sides lapsed, or where the lapsed one sat on the
	 * side the query happens to read first, would pass either way.
	 */
	@Test
	void aPairInviteToSomebodyWhoDidNotRenewKeepsTheRowAndDropsTheName() throws Exception {
		db.sql("update competitor set active = false where member_number = ?")
				.param(PAIR_TO).update();

		List<Invite> mine = pairInvites(answer());

		assertThat(mine)
				.as("the invite disappeared with the member, or the member is still named")
				.containsExactly(
						new Invite("", true, "2026-08-15"),
						new Invite(PAIR_FROM, false, "2026-08-28"));
	}

	/** NO FIELD OF ANY OF THE FOUR LISTS IS THE SAME IN EVERY RECORD OF IT. */
	@Test
	void noFieldOfAnyListIsTheSameInEveryRecord() throws Exception {
		JsonNode whole = answer();

		Answers.noFieldIsTheSameInEveryRecord("/api/me/applications#teamApplications",
				whole.path("teamApplications"));
		Answers.noFieldIsTheSameInEveryRecord("/api/me/applications#teamInvitations",
				whole.path("teamInvitations"));
		Answers.noFieldIsTheSameInEveryRecord("/api/me/applications#teamProposals",
				whole.path("teamProposals"));
		Answers.noFieldIsTheSameInEveryRecord("/api/me/applications#pairInvites",
				whole.path("pairInvites"));
	}
}

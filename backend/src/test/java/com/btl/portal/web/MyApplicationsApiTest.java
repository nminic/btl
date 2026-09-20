package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
 *
 * <p><b>THREE OF THOSE AXES WERE NAMED HERE AND NOT SEPARATED, AND THAT WAS
 * MEASURED ON 20.09.2026 RATHER THAN NOTICED.</b> The owner's rule of 06.09.2026 -
 * if right and wrong behaviour give the same value, the case says nothing - is
 * what each of the three breaks, and each was proved by a query that answers from
 * the WRONG source and passed this whole file:
 *
 * <ul>
 * <li><b>The zone.</b> All eight marks read {@code 09:00:00+00}, which is one and
 * the same calendar day in Belgrade and in UTC, so {@code atZone(ZoneOffset.UTC)}
 * passed. Four of them now fall half an hour before midnight, and a day read in
 * the wrong zone is a day earlier.</li>
 * <li><b>The key.</b> Every expected {@code id} was read off the ANSWER being
 * checked, so {@code select team_id, team_id, ...} and {@code select v.id, ...}
 * both passed: it did not matter what the column was, only that the record it
 * stood in was the right one. Each is now asked of the store, the way
 * {@link #teamId} always was, which is the move {@code ReviewQueue.approve} made
 * on the same class.</li>
 * <li><b>The tie.</b> Every list was settled by its day alone, because no two rows
 * of one list shared an instant, so the last term of each {@code order by} decided
 * nothing and could be removed. Two rows of every list now share one.</li>
 * </ul>
 *
 * <p>And a fourth, of the same shape: {@code verification.subject} and {@code
 * team_proposal.name} carried ONE value, so a query reading the queue row's
 * subject where the route reads the proposal's name passed. See
 * {@link #queueSubjectFor}.
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

	/**
	 * Asked by {@link #ME} at the very instant {@link #PAIR_FROM} asked him, and the one
	 * whose fee never lapses - so a row that keeps its name stands beside one that loses
	 * it, on the same side of the table and on the same day.
	 */
	private static final String PAIR_TIED = "000600";

	private static final String ME_EMAIL = "ja@primer.rs";

	private static final String MODERATOR_EMAIL = "moderator-bez-clana@primer.rs";

	/**
	 * A MOMENT THAT IS NOT THE SAME DAY IN BOTH ZONES, one in each of the four lists.
	 *
	 * <p>Half past eleven at night in UTC is half past one the NEXT morning in Belgrade, so
	 * the day this route answers with is not the day the mark is written with, and the two
	 * can no longer be mistaken for each other. Written {@code 09:00:00+00}, as all eight
	 * marks of this fixture were until 20.09.2026, they are one and the same date and the
	 * zone is measured by nothing.
	 */
	private static final String THE_NIGHT_BEFORE_I_ASKED_A_TEAM = "2026-08-09 23:30:00+00";

	private static final String THE_NIGHT_BEFORE_A_TEAM_ASKED_ME = "2026-08-11 23:30:00+00";

	private static final String THE_NIGHT_BEFORE_I_PROPOSED = "2026-08-04 23:30:00+00";

	private static final String THE_NIGHT_BEFORE_I_ASKED_TO_PAIR = "2026-08-14 23:30:00+00";

	/**
	 * AND ONE INSTANT SHARED BY TWO ROWS OF EVERY LIST, which is what the last term of
	 * every {@code order by} this route makes is for.
	 *
	 * <p>Without a tie, a list settled by its day alone comes back in exactly the order a
	 * list settled by its day AND its key does, so the second term decides nothing and
	 * removing it costs nothing - measured on 20.09.2026, all four removed at once, whole
	 * file green.
	 */
	private static final String BOTH_APPLICATIONS_AT_ONCE = "2026-08-20 09:00:00+00";

	private static final String BOTH_INVITATIONS_AT_ONCE = "2026-08-22 09:00:00+00";

	private static final String BOTH_PROPOSALS_AT_ONCE = "2026-08-25 09:00:00+00";

	private static final String BOTH_PAIR_QUESTIONS_AT_ONCE = "2026-08-28 09:00:00+00";

	/**
	 * THE KEYS ARE WRITTEN RATHER THAN DRAWN, AND THE SMALLER ONE OF A TIED PAIR IS
	 * WRITTEN SECOND.
	 *
	 * <p>A sequence hands out keys in the order rows are written, so a table holds its rows
	 * in exactly the order their keys give: {@code order by asked_at} and {@code order by
	 * asked_at, id} then answer alike whatever the fixture does, and the tie above would
	 * measure nothing. Written down, the tied pair is left in the OPPOSITE order, and the
	 * two queries part company. Measured on a real PostgreSQL 18 before this fixture was
	 * changed: with the later key written first, {@code order by asked_at} answers with it
	 * first and {@code order by asked_at, id} with the earlier one, through the join as
	 * well as off one table.
	 *
	 * <p>{@link #ITS_OWN_DAY} is the LARGEST of the three on purpose. It is the row that
	 * must come FIRST, so a list settled by the key alone is a third list again and not the
	 * right one.
	 */
	private static final long ITS_OWN_DAY = 5L;

	/** Of the two rows sharing an instant, the one that must come SECOND. Written first. */
	private static final long TIED_LATER = 3L;

	/** And the one that must come FIRST. Written second. */
	private static final long TIED_EARLIER = 2L;

	private static final long ALREADY_DECIDED = 8L;

	private static final long SOMEBODY_ELSES = 9L;

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private int issued;

	private SecretToken session;

	@BeforeEach
	void aCompetitorEverythingHeIsWaitingOnAndSomebodyElsesRowsOfEveryKind() {
		competitor(ME, "Ja", "Pitam", "M");
		competitor(SOMEONE_ELSE, "Neko", "Drugi", "F");
		competitor(PAIR_TO, "Kome", "Saljem", "M");
		competitor(PAIR_FROM, "Ko", "Meni Salje", "F");
		competitor(THIRD_PARTY, "Trece", "Lice", "M");
		competitor(PAIR_TIED, "Istog", "Trenutka", "F");

		team("tim-jedan", "Tim Jedan");
		team("tim-dva", "Tim Dva");
		team("tim-tri", "Tim Tri");
		team("tim-cetiri", "Tim Cetiri");
		team("tim-pet", "Tim Pet");
		team("tim-sest", "Tim Sest");
		team("tim-za-izmenu", "Tim Za Izmenu");
		team("tudji-tim-prijave", "Tudji Tim Prijave");
		team("tudji-tim-poziva", "Tudji Tim Poziva");

		/* THREE APPLICATIONS OF MINE, TO THREE DIFFERENT TEAMS, WRITTEN OUT OF DATE ORDER
		   so a missing `order by` answers in the wrong order - and two of them written at
		   ONE instant, the later key first, so the last term of that `order by` is the only
		   thing standing between those two. */
		application(TIED_LATER, ME, "tim-dva", BOTH_APPLICATIONS_AT_ONCE);
		application(TIED_EARLIER, ME, "tim-pet", BOTH_APPLICATIONS_AT_ONCE);
		application(ITS_OWN_DAY, ME, "tim-jedan", THE_NIGHT_BEFORE_I_ASKED_A_TEAM);
		/* SOMEBODY ELSE'S APPLICATION, to a team of its own, which must never reach me. */
		application(SOMEBODY_ELSES, SOMEONE_ELSE, "tudji-tim-prijave", "2026-08-11 09:00:00+00");

		/* THREE INVITATIONS OF MINE, FROM THREE DIFFERENT TEAMS, the same way. */
		invitation(TIED_LATER, "tim-cetiri", ME, BOTH_INVITATIONS_AT_ONCE);
		invitation(TIED_EARLIER, "tim-sest", ME, BOTH_INVITATIONS_AT_ONCE);
		invitation(ITS_OWN_DAY, "tim-tri", ME, THE_NIGHT_BEFORE_A_TEAM_ASKED_ME);
		/* SOMEBODY ELSE'S INVITATION, from a team of its own. */
		invitation(SOMEBODY_ELSES, "tudji-tim-poziva", SOMEONE_ELSE, "2026-08-13 09:00:00+00");

		/* THREE PROPOSALS OF MINE STILL WAITING: one names an existing team (a change to
		   it) and two name none at all (brand new ones), so the nullable column genuinely
		   varies and is not merely left the same by accident. */
		proposalWaiting(TIED_LATER, ME, "Predlog Izmene", "tim-za-izmenu", BOTH_PROPOSALS_AT_ONCE);
		proposalWaiting(TIED_EARLIER, ME, "Jos Jedan Predlog", null, BOTH_PROPOSALS_AT_ONCE);
		proposalWaiting(ITS_OWN_DAY, ME, "Sasvim Nov Tim", null, THE_NIGHT_BEFORE_I_PROPOSED);
		/* A FOURTH PROPOSAL OF MINE, ALREADY DECIDED WEEKS AGO. ADL A42: a decided
		   verification row stands for ever, so this row is not going anywhere, and
		   the only thing that keeps it out of the answer is reading `state`. */
		proposalDecided(ALREADY_DECIDED, ME, "Vec Odluceno", null, "2026-07-01 09:00:00+00",
				"2026-07-05 09:00:00+00", "approved", "Taj Moderator");
		/* SOMEBODY ELSE'S PROPOSAL, still waiting, which must never reach me. */
		proposalWaiting(SOMEBODY_ELSES, SOMEONE_ELSE, "Tudji Predlog", null,
				"2026-08-14 09:00:00+00");

		/* TWO PAIR QUESTIONS I SENT AND ONE I RECEIVED, so both directions of the one table
		   are exercised, with three different counterparts - and the tie runs ACROSS the
		   two directions, so a list settled by anything but the day and the key answers in
		   the wrong one. */
		pairInvite(TIED_LATER, PAIR_FROM, ME, BOTH_PAIR_QUESTIONS_AT_ONCE);
		pairInvite(TIED_EARLIER, ME, PAIR_TIED, BOTH_PAIR_QUESTIONS_AT_ONCE);
		pairInvite(ITS_OWN_DAY, ME, PAIR_TO, THE_NIGHT_BEFORE_I_ASKED_TO_PAIR);
		/* SOMEBODY ELSE'S PAIR QUESTION, between two people who are neither of us. */
		pairInvite(SOMEBODY_ELSES, SOMEONE_ELSE, THIRD_PARTY, "2026-08-16 09:00:00+00");

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

	private void application(long key, String memberNumber, String teamSlug, String askedAt) {
		db.sql("insert into team_application (id, competitor_id, team_id, season, asked_at)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), 2028, timestamptz '" + askedAt + "')")
				.params(key, memberNumber, teamSlug).update();
	}

	private void invitation(long key, String teamSlug, String memberNumber, String sentAt) {
		db.sql("insert into team_invitation (id, team_id, competitor_id, season, sent_at)"
						+ " values (?, (select id from team where slug = ?),"
						+ " (select id from competitor where member_number = ?), 2028,"
						+ " timestamptz '" + sentAt + "')")
				.params(key, teamSlug, memberNumber).update();
	}

	/**
	 * THE NAME THE QUEUE ROW CARRIES, AND IT IS NOT THE NAME THE PROPOSAL CARRIES.
	 *
	 * <p>Two columns in two tables and nothing in the schema keeps them equal: V9's
	 * {@code subject} is what a moderator reads off the card, V11's {@code name} is the
	 * address a team is asking for. The one route that writes both copies the second into
	 * the first today ({@code TeamWriteApi}), and a fixture that repeats that copy measures
	 * NEITHER - which is what this one did until 20.09.2026, so a query answering with
	 * {@code verification.subject} where the route reads {@code team_proposal.name} passed
	 * every case in the file. Owner, 06.09.2026: if the same value can arrive from two
	 * places, the case says nothing about either.
	 */
	private static String queueSubjectFor(String name) {
		return "U redu za timove: " + name;
	}

	/**
	 * A team proposal still standing in the moderator's queue, exactly the shape
	 * V11 and V9 give it together: the proposal itself, and the {@code verification}
	 * row that queues it, {@code state = 'waiting'}.
	 */
	private void proposalWaiting(long key, String memberNumber, String name, String teamSlug,
			String raisedAt) {
		insertProposal(key, memberNumber, name, teamSlug);

		db.sql("insert into verification (queue, competitor_id, subject, body, raised_at, state,"
						+ " team_proposal_id)"
						+ " values ('teams', (select id from competitor where member_number = ?), ?, '',"
						+ " timestamptz '" + raisedAt + "', 'waiting', ?)")
				.params(memberNumber, queueSubjectFor(name), key).update();
	}

	/**
	 * A team proposal whose queue row has already been decided, which ADL A42 keeps
	 * standing for ever. The one row this whole file exists to keep out of the
	 * answer.
	 */
	private void proposalDecided(long key, String memberNumber, String name, String teamSlug,
			String raisedAt, String decidedAt, String state, String decidedByName) {
		insertProposal(key, memberNumber, name, teamSlug);

		db.sql("insert into verification (queue, competitor_id, subject, body, raised_at, state,"
						+ " decided_at, decided_by_name, team_proposal_id)"
						+ " values ('teams', (select id from competitor where member_number = ?), ?, '',"
						+ " timestamptz '" + raisedAt + "', ?, timestamptz '" + decidedAt + "', ?, ?)")
				.params(memberNumber, queueSubjectFor(name), state, decidedByName, key).update();
	}

	/**
	 * A proposal names a town in one of the two shapes V11 allows, exactly as a team
	 * itself does, and the constraint is an XOR: without a town at all the insert is
	 * refused. {@code place_id} is used here, the same codebook reference every
	 * other fixture in this package writes.
	 */
	private void insertProposal(long key, String memberNumber, String name, String teamSlug) {
		if (teamSlug == null) {
			db.sql("insert into team_proposal (id, competitor_id, team_id, name, bio, link,"
							+ " place_id)"
							+ " values (?, (select id from competitor where member_number = ?), null, ?,"
							+ " '', '', (select id from place where rank = 1))")
					.params(key, memberNumber, name).update();
			return;
		}

		db.sql("insert into team_proposal (id, competitor_id, team_id, name, bio, link, place_id)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?, '', '',"
						+ " (select id from place where rank = 1))")
				.params(key, memberNumber, teamSlug, name).update();
	}

	private void pairInvite(long key, String from, String to, String sentAt) {
		db.sql("insert into pair_invite (id, from_id, to_id, sent_at)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?),"
						+ " timestamptz '" + sentAt + "')")
				.params(key, from, to).update();
	}

	/**
	 * THE KEY THE DATABASE REALLY HOLDS, asked of it the way {@link #teamId} always was.
	 *
	 * <p>Until 20.09.2026 every expected key in this file was read off the ANSWER being
	 * checked - {@code new Application(mine.get(0).id(), ...)} - so the route could have
	 * answered with any column at all and the case could not tell. Measured that day:
	 * {@code select team_id, team_id, asked_at} and {@code select v.id, tp.team_id, ...}
	 * both passed the whole file. This is the same move {@code ReviewQueue.approve} made on
	 * the identical class, „which is why it is now measured against the store itself".
	 */
	private long applicationId(String teamSlug) {
		return db.sql("select id from team_application"
						+ " where team_id = (select id from team where slug = ?)"
						+ " and competitor_id = (select id from competitor where member_number = ?)")
				.params(teamSlug, ME).query(Long.class).single();
	}

	private long invitationId(String teamSlug) {
		return db.sql("select id from team_invitation"
						+ " where team_id = (select id from team where slug = ?)"
						+ " and competitor_id = (select id from competitor where member_number = ?)")
				.params(teamSlug, ME).query(Long.class).single();
	}

	private long proposalId(String name) {
		return db.sql("select id from team_proposal where name = ?").param(name)
				.query(Long.class).single();
	}

	private long pairInviteId(String from, String to) {
		return db.sql("select id from pair_invite"
						+ " where from_id = (select id from competitor where member_number = ?)"
						+ " and to_id = (select id from competitor where member_number = ?)")
				.params(from, to).query(Long.class).single();
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

	private record Invite(long id, String memberNumber, boolean sentByMe, String date) {
	}

	private List<Invite> pairInvites(JsonNode whole) {
		List<Invite> out = new ArrayList<>();
		for (JsonNode one : whole.path("pairInvites")) {
			/* A MISSING NUMBER COMES BACK AS null AND NOT AS "". `asString()` folds three
			   different answers - the field absent, the field null, and the field served
			   as an empty string - into one value, so a case built on it cannot tell
			   „the field was left out" from „the field was served empty". The decision of
			   13.09.2026 is about leaving it OUT, and `CommentApiTest` asserts exactly
			   that with `isNull()`. */
			/* A KEY THAT IS NOT THERE IS NOT THE SAME AS ONE THAT IS null, and an earlier
			   draft folded them together with `isMissingNode() ||`. The wire carries
			   `"memberNumber":null` today; dropping the key instead - one annotation on
			   the record does it - changes what the portal promises, and the reader has
			   to be able to say so. `CommentApiTest` reads it this way for the same
			   reason. */
			JsonNode number = one.get("memberNumber");
			assertThat(number)
					.as("the answer stopped carrying `memberNumber` at all, which is a different"
							+ " promise from carrying it empty")
					.isNotNull();
			out.add(new Invite(one.path("id").asLong(), number.isNull() ? null : number.asString(),
					one.path("sentByMe").asBoolean(), one.path("date").asString()));
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
	 * MY OWN THREE APPLICATIONS, OLDEST FIRST AND THEN BY THE KEY, AND NOBODY ELSE'S.
	 *
	 * <p>Two of the three were asked in the same instant, so the day cannot decide between
	 * them and the key is what does - and the one with the smaller key was written second,
	 * so the order the table holds them in is the other one.
	 */
	@Test
	void myTeamApplicationsComeBackOldestFirstAndOnlyMine() throws Exception {
		List<Application> mine = teamApplications(answer());

		assertThat(mine).as("one of my three applications is missing").hasSize(3);
		assertThat(mine).as("the answer is not in order by the day asked and then by the key")
				.containsExactly(
						new Application(applicationId("tim-jedan"), teamId("tim-jedan"), "2026-08-10"),
						new Application(applicationId("tim-pet"), teamId("tim-pet"), "2026-08-20"),
						new Application(applicationId("tim-dva"), teamId("tim-dva"), "2026-08-20"));

		assertThat(mine.stream().map(Application::teamId))
				.as("somebody else's application to a team of its own reached my answer")
				.doesNotContain(teamId("tudji-tim-prijave"));
	}

	/**
	 * MY OWN THREE INVITATIONS, OLDEST FIRST AND THEN BY THE KEY, AND NOBODY ELSE'S.
	 */
	@Test
	void myTeamInvitationsComeBackOldestFirstAndOnlyMine() throws Exception {
		List<Application> mine = teamInvitations(answer());

		assertThat(mine).as("one of my three invitations is missing").hasSize(3);
		assertThat(mine).as("the answer is not in order by the day sent and then by the key")
				.containsExactly(
						new Application(invitationId("tim-tri"), teamId("tim-tri"), "2026-08-12"),
						new Application(invitationId("tim-sest"), teamId("tim-sest"), "2026-08-22"),
						new Application(invitationId("tim-cetiri"), teamId("tim-cetiri"), "2026-08-22"));

		assertThat(mine.stream().map(Application::teamId))
				.as("somebody else's invitation from a team of its own reached my answer")
				.doesNotContain(teamId("tudji-tim-poziva"));
	}

	/**
	 * MY THREE PROPOSALS STILL WAITING COME BACK, OLDEST FIRST AND THEN BY THE KEY; THE ONE
	 * ALREADY DECIDED DOES NOT, AND NEITHER DOES SOMEBODY ELSE'S.
	 *
	 * <p>The row this whole file is really about: {@code team_proposal} carries no
	 * state of its own, {@code verification} does, and ADL A42 keeps a decided
	 * {@code verification} row standing for ever. Reading {@code team_proposal}
	 * without joining to {@code verification.state = 'waiting'} would answer with
	 * "Vec Odluceno" alongside the others still open - approved five weeks before this
	 * fixture's own clock even starts.
	 *
	 * <p>And the name comes off the PROPOSAL, which the queue row's own subject can no
	 * longer be mistaken for: see {@link #queueSubjectFor}.
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

		assertThat(mine).as("one of my three still-waiting proposals is missing").hasSize(3);
		assertThat(mine).as("the answer is not in order by the day raised and then by the key,"
						+ " or does not carry all three")
				.containsExactly(
						new Proposal(proposalId("Sasvim Nov Tim"), null, "Sasvim Nov Tim",
								"2026-08-05"),
						new Proposal(proposalId("Jos Jedan Predlog"), null, "Jos Jedan Predlog",
								"2026-08-25"),
						new Proposal(proposalId("Predlog Izmene"), teamId("tim-za-izmenu"),
								"Predlog Izmene", "2026-08-25"));
	}

	/**
	 * MY PAIR QUESTIONS COME BACK FROM BOTH DIRECTIONS, WITH MEMBER NUMBERS AND NOT
	 * RAW IDENTIFIERS, OLDEST FIRST AND THEN BY THE KEY; SOMEBODY ELSE'S QUESTION DOES NOT.
	 *
	 * <p>{@code pair_invite} is one table for both directions (V12: "svako sme da
	 * posalje zahtev svakome"), so the one I sent and the one I was sent both belong
	 * here, told apart by {@code sentByMe} rather than by two different lists that
	 * would invent a split the schema does not draw.
	 *
	 * <p>The tie runs ACROSS those two directions - one I sent and one I was sent, in the
	 * same instant - so an answer settled by anything but the day and then the key puts
	 * them the other way round.
	 */
	@Test
	void myPairInvitesComeBackFromBothDirectionsAndSomebodyElsesDoesNot() throws Exception {
		List<Invite> mine = pairInvites(answer());

		assertThat(mine)
				.as("the answer is not in order by the day sent and then by the key, or does not"
						+ " carry both directions")
				.containsExactly(
						new Invite(pairInviteId(ME, PAIR_TO), PAIR_TO, true, "2026-08-15"),
						new Invite(pairInviteId(ME, PAIR_TIED), PAIR_TIED, true, "2026-08-28"),
						new Invite(pairInviteId(PAIR_FROM, ME), PAIR_FROM, false, "2026-08-28"));

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
	 * <p><b>BOTH SIDES, and that is the whole reason this case is parameterised.</b> The
	 * first draft lapsed only the member I had INVITED, so „did not renew" and „an invite
	 * I sent" were ONE AXIS: an answer dropping the name by DIRECTION rather than by
	 * membership gave the same list, and {@code else true} on the other branch passed the
	 * suite green. Measured on review, and it is the class this project has written down
	 * four times over - if the expected value can arrive from two places, the case
	 * measures neither.
	 *
	 * <p>So the same case runs twice with the sides swapped. Whichever one lapses is the
	 * one that loses its name, and the other keeps it; a query reading the wrong side
	 * fails on one of the two runs, and a query ignoring membership fails on both. And
	 * {@link #PAIR_TIED} is the third, on the SAME side as one of the two and on the same
	 * day as the other, so „the side" and „the day" cannot stand in for membership either.
	 */
	@ParameterizedTest
	@ValueSource(strings = {PAIR_TO, PAIR_FROM})
	void aPairInviteToSomebodyWhoDidNotRenewKeepsTheRowAndDropsTheName(String lapsed)
			throws Exception {
		db.sql("update competitor set active = false where member_number = ?")
				.param(lapsed).update();

		List<Invite> mine = pairInvites(answer());

		/* THE WHOLE RECORD, and `sentByMe` with it. An earlier draft compared two
		   projections - the numbers and the days - and by splitting them it dropped the
		   third column out of every case in the file: `sentByMe` was then measured only
		   where both sides are active. Measured on review, and it was a guard this file
		   HAD and this change had killed: a query putting the fee guard around `sentByMe`
		   too answers `false` for the lapsed row, so an invite the member SENT is drawn
		   as one he RECEIVED, and the screen reads the whole meaning of the row from that
		   field. */
		assertThat(mine)
				.as("the member who did not renew is still named, somebody else stopped being,"
						+ " an invite disappeared with its member, or a direction was turned round")
				.containsExactly(
						new Invite(pairInviteId(ME, PAIR_TO),
								lapsed.equals(PAIR_TO) ? null : PAIR_TO, true, "2026-08-15"),
						new Invite(pairInviteId(ME, PAIR_TIED), PAIR_TIED, true, "2026-08-28"),
						new Invite(pairInviteId(PAIR_FROM, ME),
								lapsed.equals(PAIR_FROM) ? null : PAIR_FROM, false, "2026-08-28"));

		assertThat(answer().toString())
				.as("the number of the member who did not renew is still somewhere in the answer")
				.doesNotContain(lapsed);
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

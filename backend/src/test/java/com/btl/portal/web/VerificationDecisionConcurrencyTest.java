package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * TWO MODERATORS ANSWERING ONE ITEM AT THE SAME INSTANT PRODUCE ONE DECISION.
 *
 * <p>The owner's requirement, PDL P9, 18.09.2026, and it is the sentence he wrote under his
 * own decision about the queue: „odluka jednog moderatora je odmah skida svima, i drugi
 * moderator na zauzetu stavku dobija <b>odbijenicu, ne tihi neuspeh</b>."
 *
 * <p><b>THIS IS THE ONE FILE THOSE SENTENCES CAN BE MEASURED IN, and the reason is the
 * owner's own precedent.</b> {@code PaymentNumberConcurrencyTest} exists because „Java
 * provera-pa-upis prolazi svaki sekvencijalni slucaj i pada samo ovde", and what was wrong
 * here was exactly that shape: {@code DecidingOnASubmission.decide} read the state, found it
 * waiting, and the update that followed carried no condition on it. Every sequential case in
 * {@code VerificationWriteApiTest} passed, including one written for „already decided",
 * because sequentially the read and the write cannot be separated.
 *
 * <p><b>What that really produced, measured before it was fixed:</b> twelve times out of
 * twelve both moderators were answered 200. With one approving and one refusing, six times
 * out of six the team was made and its founder written into it, and the same man was ALSO
 * sent a message saying his item had been refused - two messages contradicting each other in
 * one inbox, with the row settled on {@code approved} and no fault raised anywhere.
 *
 * <p><b>NOT {@code @Transactional}</b>, for the reason the precedent sets out: a test managed
 * transaction is bound to the calling thread, so a worker calling through {@code MockMvc}
 * gets a connection and a transaction of its own and the two really do overlap. The cost is
 * that every row here is a real commit against the database the whole suite shares, so the
 * {@code finally} blocks below take them out again by key whether the assertions passed or
 * not.
 *
 * <p><b>The assertions are INVARIANTS and never „the first thread wins".</b> Which of two
 * threads reaches the row first is not something a case may claim; what must hold is that
 * exactly one of them was told yes, exactly one consequence exists, and the consequence is
 * the one the winner asked for.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class VerificationDecisionConcurrencyTest {

	/** Distinct from every other fixture's moderators, on purpose: these rows are committed. */
	private static final String ONE_MODERATOR = "istovremena-odluka-prvi@primer.rs";

	private static final String THE_OTHER_MODERATOR = "istovremena-odluka-drugi@primer.rs";

	private static final String THE_FOUNDER = "000931";

	private static final String THE_TEAM = "Istovremeni trkacki klub";

	private static final String THE_SLUG = "istovremeni-trkacki-klub";

	private static final String THE_REASON = "Naziv nije u skladu sa pravilnikom";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private long founder;

	private long proposal;

	private long teamItem;

	private long profileItem;

	private final java.util.Map<String, String> sessions = new java.util.HashMap<>();

	@BeforeEach
	void twoModeratorsOneProposalAndOneProfile() {
		moderator(ONE_MODERATOR);
		moderator(THE_OTHER_MODERATOR);

		founder = db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni',"
						+ " 'Osnivac', 'M', date '1990-05-05', " + A_TOWN + ", null, null, 2027,"
						+ " false, true, 'payment', '00112233445588a1', null, '', false, 'none',"
						+ " 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.param(THE_FOUNDER)
				.query(Long.class).single();

		proposal = db.sql("insert into team_proposal (competitor_id, name, bio, link, place_id)"
						+ " values (?, ?, '', '', " + A_TOWN + ") returning id")
				.params(founder, THE_TEAM)
				.query(Long.class).single();

		teamItem = db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " team_proposal_id) values ('teams', ?, ?, '', ?) returning id")
				.params(founder, THE_TEAM, proposal)
				.query(Long.class).single();

		profileItem = db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('profiles', ?, 'Biografija osnivaca', 'Trcim od 2019.')"
						+ " returning id")
				.param(founder)
				.query(Long.class).single();
	}

	/**
	 * Real commits, so a real delete, children before parents.
	 *
	 * <p>Every one of these keys cascades, and they are written out anyway so that a future
	 * migration narrowing one cannot turn this cleanup into a constraint violation nobody
	 * sees until here. That is the precedent's own sentence and its reason.
	 */
	@AfterEach
	void takeThemBackOut() {
		db.sql("delete from team_membership where competitor_id = ?").param(founder).update();
		db.sql("delete from team where slug = ?").param(THE_SLUG).update();
		db.sql("delete from message where to_id = ?").param(founder).update();
		db.sql("delete from verification_lock where verification_id in (?, ?)")
				.params(teamItem, profileItem).update();
		db.sql("delete from verification where id in (?, ?)").params(teamItem, profileItem).update();
		db.sql("delete from team_proposal where id = ?").param(proposal).update();
		db.sql("delete from competitor where id = ?").param(founder).update();

		for (String email : sessions.keySet()) {
			db.sql("delete from account where email = ?").param(email).update();
		}
	}

	/**
	 * ONE 200, ONE 409, ONE MESSAGE, AND THE CONSEQUENCE IS THE WINNER'S.
	 *
	 * <p><b>Approval against refusal and not two approvals</b>, because two approvals are the
	 * easy half: they collide on a constraint and one of them comes back 500, which is a
	 * fault somebody would notice. The dangerous pair is the one whose two outcomes are both
	 * legal on their own, where nothing collides and nothing is raised - the portal simply
	 * does both.
	 */
	@Test
	void anApprovalAndARefusalOfOneItemAtOneInstantLeaveOneAnswerAndOneConsequence()
			throws Exception {
		List<MockHttpServletResponse> both = atTheSameInstant(
				() -> answer(ONE_MODERATOR, teamItem, true, null),
				() -> answer(THE_OTHER_MODERATOR, teamItem, false, THE_REASON));

		assertThat(both.stream().map(MockHttpServletResponse::getStatus).sorted().toList())
				.as("both moderators were told their answer was recorded, so the item was"
						+ " decided twice and the second decision left no trace of the first")
				.containsExactly(200, 409);

		String state = db.sql("select state from verification where id = ?")
				.param(teamItem).query(String.class).single();

		assertThat(state).isIn("approved", "rejected");

		int teams = db.sql("select count(*) from team where slug = ?")
				.param(THE_SLUG).query(Integer.class).single();
		int memberships = db.sql("select count(*) from team_membership where competitor_id = ?")
				.param(founder).query(Integer.class).single();

		assertThat(teams)
				.as("the row says %s and the number of teams does not follow from it", state)
				.isEqualTo("approved".equals(state) ? 1 : 0);
		assertThat(memberships)
				.as("a team was made without its founder in it, or a founder was written into a"
						+ " team that was never made")
				.isEqualTo(teams);

		/* ONE MESSAGE, AND IT IS THE WINNER'S. Both answers write to the same inbox - an
		   approval of a team and a refusal of anything - so a count of one is not enough on
		   its own; what it says has to match what the row says happened. */
		List<String> told = db.sql("select subject from message where to_id = ? order by id")
				.param(founder).query(String.class).list();

		assertThat(told)
				.as("the founder was written to twice, once to say his team was accepted and once"
						+ " to say his item was refused")
				.hasSize(1);
		assertThat(told.get(0))
				.isEqualTo("approved".equals(state) ? "Tim je prihvaćen" : "Stavka je odbijena");
	}

	/**
	 * AND THE SAME ANSWER FOR TWO APPROVALS, which must be a refusal and never a fault.
	 *
	 * <p>Before the condition on the state was written, one of these two came back <b>500</b>
	 * six times out of six: the schema caught what the route did not, and the moderator was
	 * shown a server fault where the owner asked for „odbijenicu, ne tihi neuspeh". A 500 is
	 * neither.
	 */
	@Test
	void twoApprovalsOfOneItemAtOneInstantGiveARefusalAndNotAFault() throws Exception {
		List<MockHttpServletResponse> both = atTheSameInstant(
				() -> answer(ONE_MODERATOR, teamItem, true, null),
				() -> answer(THE_OTHER_MODERATOR, teamItem, true, null));

		assertThat(both.stream().map(MockHttpServletResponse::getStatus).sorted().toList())
				.as("one of the two was answered with something other than yes or „somebody got"
						+ " there first", (Object[]) null)
				.containsExactly(200, 409);

		assertThat(db.sql("select count(*) from team where slug = ?")
				.param(THE_SLUG).query(Integer.class).single()).isEqualTo(1);
	}

	/**
	 * TAKING A HOLD IS THE SAME SHAPE AND WAS WRONG IN THE SAME WAY.
	 *
	 * <p>Measured before the fix: twelve times out of twelve both moderators were answered
	 * 200 on a free item, while the table held one row. The count was right and what each man
	 * was told was not, which is the half a comment about the table cannot cover.
	 */
	@Test
	void twoModeratorsTakingOneFreeItemLeaveOneHolderAndOneRefusal() throws Exception {
		List<MockHttpServletResponse> both = atTheSameInstant(
				() -> take(ONE_MODERATOR, profileItem),
				() -> take(THE_OTHER_MODERATOR, profileItem));

		assertThat(both.stream().map(MockHttpServletResponse::getStatus).sorted().toList())
				.as("both were told the item was theirs, and one of them is about to read"
						+ " something somebody else is deciding")
				.containsExactly(200, 409);

		assertThat(db.sql("select count(*) from verification_lock where verification_id = ?")
				.param(profileItem).query(Integer.class).single()).isEqualTo(1);

		/* AND THE ONE HOLDING IT IS THE ONE WHO WAS TOLD SO. A count of one is satisfied by
		   the loser holding it just as well as by the winner. */
		long holder = db.sql("select held_by from verification_lock where verification_id = ?")
				.param(profileItem).query(Long.class).single();

		String winner = both.get(0).getStatus() == 200 ? ONE_MODERATOR : THE_OTHER_MODERATOR;

		assertThat(holder)
				.as("the item is held by the moderator who was refused it")
				.isEqualTo(accountOf(winner));
	}

	/** Two calls released together, in the order they were given. */
	private List<MockHttpServletResponse> atTheSameInstant(
			Callable<MockHttpServletResponse> one, Callable<MockHttpServletResponse> other)
			throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(2);
		CyclicBarrier bothReady = new CyclicBarrier(2);

		try {
			Future<MockHttpServletResponse> first = pool.submit(() -> {
				bothReady.await();
				return one.call();
			});
			Future<MockHttpServletResponse> second = pool.submit(() -> {
				bothReady.await();
				return other.call();
			});

			return List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
		} finally {
			pool.shutdownNow();
		}
	}

	private MockHttpServletResponse answer(String email, long id, boolean approved, String reason)
			throws Exception {
		String body = reason == null
				? "{\"approved\":" + approved + "}"
				: "{\"approved\":" + approved + ",\"reason\":\"" + reason + "\"}";

		return http.perform(post("/api/verification/" + id + "/decision").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email)))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse take(String email, long id) throws Exception {
		return http.perform(post("/api/verification/" + id + "/hold").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email))))
				.andReturn().getResponse();
	}

	private long accountOf(String email) {
		return db.sql("select id from account where email = ?")
				.param(email).query(Long.class).single();
	}

	private void moderator(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

		for (String right : List.of("queue:teams", "queue:profiles")) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session.secret());
	}
}

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
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
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
 *
 * <p><b>THE BARRIER ABOVE CANNOT PROMISE THAT {@code write}'s {@code claimed == 0} IS EVER
 * REACHED, and CI measured the gap it leaves.</b> {@link CyclicBarrier} only makes both
 * threads START at the same instant; if the scheduler then runs one thread's whole request,
 * read, update and commit, before the other thread's read even happens, the second read
 * meets a row {@link DecidingOnASubmission#decide} already calls {@code ALREADY_DECIDED} on
 * its own, OUTSIDE this route's transaction, and {@code write} is never entered at all. That
 * refusal and the one this file is named for carry the same reason and the same status, so a
 * green barrier test cannot say which of the two it exercised. Measured 21.09.2026: {@code
 * main} at a commit and a PR touching two unrelated frontend files at the SAME commit gave
 * the SAME {@code Tests run: 2482, Failures: 0, Errors: 0}, and JaCoCo told the two apart -
 * {@code web/VerificationWriteApi} missing exactly the one branch the barrier had not, that
 * run, forced. {@code theLoserMeetsARowAlreadyClaimedEveryTimeAndNotOnlyWhenTheSchedulerRaces}
 * below exists because of that measurement: it takes the ordering away from the scheduler by
 * holding the row's own lock, so the branch is covered every run and not only when the two
 * threads happen to overlap. It is additional to the barrier tests above and not a
 * replacement for them - they still are the only cases that leave the ORDER of the two
 * requests to chance, which is what an invariant rather than a forced outcome has to do.
 *
 * <p><b>TAKING A HOLD HAS THE SAME GAP AND IT IS WIDER, so it is forced the same way.</b>
 * {@code hold} refuses at {@code HoldingAnItem.mayTouch}, which is a plain read outside any
 * transaction, so a sequential „take it twice" stops there every time and the count the claim
 * answers with ({@code taken == 0}) is unreachable except by a real collision. {@code
 * theSecondHoldIsRefusedByTheRowItselfAndNotByTheCheckThatCameBeforeIt} takes the ordering
 * away from the scheduler for that route too, and it does it with the same held row: writing
 * into {@code verification_lock} takes {@code FOR KEY SHARE} on {@code verification} through
 * the key V28 gives it, which the {@code FOR UPDATE} here conflicts with. <b>Both forced cases
 * ask the LOCK MANAGER whether the requests have arrived</b> ({@code blockedBehindThisHold}),
 * and both assert that neither request had been ANSWERED while they were stopped there -
 * which is what names the branch, since the two refusals each route can give carry the same
 * words and the same status.
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

	/**
	 * THE ROW'S OWN LOCK, HELD FROM THIS THREAD, so the requests of the two forced cases below
	 * queue behind it rather than behind a barrier the scheduler is free to honour or not. See
	 * the class comment for why the {@link CyclicBarrier} tests cannot do this on their own.
	 */
	@Autowired
	private TransactionTemplate holdingTheRow;

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

	/**
	 * THE LOSER MEETS A ROW ALREADY CLAIMED BECAUSE THE LOCK SAYS SO, NOT BECAUSE THE
	 * SCHEDULER HAPPENED TO RUN THE TWO REQUESTS CLOSE ENOUGH TOGETHER.
	 *
	 * <p>This case holds {@code verification}'s own row on a connection neither HTTP thread
	 * ever touches, before either is asked to decide anything. Nothing has written to the row
	 * yet, so both threads' read of it inside {@code itemHeMayModerate} finds {@code waiting}
	 * regardless of which the scheduler happens to run first; both then reach the update inside
	 * {@code VerificationWriteApi.write}, and both queue behind the SAME lock this case is
	 * holding - the identical "update takes the conflicting row's lock" behaviour the comment
	 * over {@code hold} already measures for that route. Only once {@code pg_stat_activity}
	 * itself reports two OTHER backends waiting on a lock does releasing the lock mean anything:
	 * one of the two then updates the row and commits, and the other, unblocked in turn,
	 * re-reads a row that no longer says {@code waiting} and matches nothing - which is the
	 * branch this whole file exists to force rather than to hope for.
	 *
	 * <p><b>The wait for both to arrive happens WHILE the lock is held</b>, and the two
	 * {@code Future.get} calls happen only AFTER {@code holdingTheRow.execute} returns and the
	 * lock is released - reversed, the two requests could never finish and this case would
	 * hang rather than fail.
	 */
	@Test
	void theLoserMeetsARowAlreadyClaimedEveryTimeAndNotOnlyWhenTheSchedulerRaces() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			Callable<MockHttpServletResponse> theApproval =
					() -> answer(ONE_MODERATOR, teamItem, true, null);
			Callable<MockHttpServletResponse> theRefusal =
					() -> answer(THE_OTHER_MODERATOR, teamItem, false, THE_REASON);

			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(teamItem).query(Integer.class).single();

				assertThat(blockedBehindThisHold())
						.as("the row is locked and nothing has been submitted yet, so a count of"
								+ " backends held up by this connection that is not nought is"
								+ " counting something other than the two requests below")
						.isZero();

				submitted.add(pool.submit(theApproval));
				submitted.add(pool.submit(theRefusal));

				try {
					waitUntilBothRequestsAreBlockedBehindThisHold(submitted);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				/* AND NEITHER HAS BEEN ANSWERED, which is what names the branch. Both 409s this
				   route can give an item that is waiting carry the same words, so a status on
				   its own cannot say which of them came back. A request refused by the check
				   before the update is answered without touching the row again and its Future
				   is done by now; both of these are inside the database, stopped by this
				   connection, with nothing written and nothing said. */
				assertThat(submitted)
						.as("a request that is not held up by this hold was refused before it"
								+ " reached the update, which is the branch this case is written"
								+ " to keep away from")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			MockHttpServletResponse approval = submitted.get(0).get(30, TimeUnit.SECONDS);
			MockHttpServletResponse refusal = submitted.get(1).get(30, TimeUnit.SECONDS);

			assertThat(List.of(approval.getStatus(), refusal.getStatus()).stream().sorted().toList())
					.as("holding the row's lock until pg_stat_activity shows both requests queued"
							+ " behind it must still leave exactly one decision recorded and one"
							+ " refused, whichever the database let through first")
					.containsExactly(200, 409);

			assertThat(db.sql("select state from verification where id = ?")
					.param(teamItem).query(String.class).single())
					.isIn("approved", "rejected");
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * THE SECOND HOLD IS REFUSED BY THE ROW ITSELF AND NOT BY THE CHECK THAT CAME BEFORE IT.
	 *
	 * <p><b>The sequential case cannot reach this branch and never will.</b> {@code hold} asks
	 * {@code HoldingAnItem.mayTouch} first, off a plain read taken outside any transaction, and
	 * refuses there the moment a live hold belonging to somebody else is on the row. So „take it
	 * twice" - the shape every other case in {@code VerificationWriteApiTest} is written in -
	 * stops at that check every single time, and the count the claim itself answers with
	 * ({@code taken == 0}) is reached only when two moderators really are inside the statement
	 * together. {@code twoModeratorsTakingOneFreeItemLeaveOneHolderAndOneRefusal} above leaves
	 * that to a {@link CyclicBarrier}, which starts them together and then hands the ordering
	 * to the scheduler - the same dependence measured on the deciding route on 21.09.2026,
	 * where two runs of identical code gave identical test counts and different coverage.
	 *
	 * <p><b>What this case does instead.</b> It locks {@code verification}'s own row from a
	 * connection neither HTTP thread ever touches. Nothing holds the item yet, so both threads'
	 * read finds it free and both pass {@code mayTouch} whichever runs first; both then reach
	 * the insert, and the insert cannot proceed, because writing a child row takes {@code FOR
	 * KEY SHARE} on the parent through {@code verification_lock_verification_fk} and that
	 * conflicts with the {@code FOR UPDATE} held here. Measured 22.09.2026 against an empty
	 * {@code postgres:18.6} with this same key: {@code for update} stops that insert and
	 * {@code for no key update} does not, which is why the lock this case takes is the stronger
	 * one and why swapping it is the first mutation this case has to fail on.
	 *
	 * <p><b>THE BRANCH IS NAMED BY THE BLOCKING AND NOT BY THE STATUS, and that is a limit of
	 * this route written down rather than left to be found.</b> Both refusals {@code hold} can
	 * give an item that is still waiting - the check before the insert and the count after it -
	 * answer 409 with {@code SOMEBODY_ELSE_IS_READING_IT}, byte for byte the same response. No
	 * assertion over the answer, the body, the table or the holder can tell them apart, because
	 * from outside they are the same thing: one man was told somebody else has it. What IS
	 * observable is that neither request had been answered at a moment when both were stopped
	 * inside the database by this connection's lock - a request refused by the check would have
	 * been answered long before, having touched the row once and never come back. That pair of
	 * assertions, and not the 409, is what says the loser met the count.
	 */
	@Test
	void theSecondHoldIsRefusedByTheRowItselfAndNotByTheCheckThatCameBeforeIt() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			Callable<MockHttpServletResponse> oneTaking = () -> take(ONE_MODERATOR, profileItem);
			Callable<MockHttpServletResponse> theOtherTaking =
					() -> take(THE_OTHER_MODERATOR, profileItem);

			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(profileItem).query(Integer.class).single();

				assertThat(blockedBehindThisHold())
						.as("the row is locked and nothing has been submitted yet, so a count of"
								+ " backends held up by this connection that is not nought is"
								+ " counting something other than the two requests below")
						.isZero();

				submitted.add(pool.submit(oneTaking));
				submitted.add(pool.submit(theOtherTaking));

				try {
					waitUntilBothRequestsAreBlockedBehindThisHold(submitted);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				/* AND NEITHER HAS BEEN ANSWERED. See the note above: this is the whole of what
				   tells this branch from the check before it, since the two refusals are the
				   same bytes. Both are stopped inside the insert, so both got past the check
				   with the item free, and whichever loses will lose on the count. */
				assertThat(submitted)
						.as("a request that is not held up by this hold was refused before it"
								+ " reached the insert, which is the branch this case is written"
								+ " to keep away from")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			MockHttpServletResponse one = submitted.get(0).get(30, TimeUnit.SECONDS);
			MockHttpServletResponse theOther = submitted.get(1).get(30, TimeUnit.SECONDS);

			assertThat(List.of(one.getStatus(), theOther.getStatus()).stream().sorted().toList())
					.as("both moderators were inside the insert with the item free, and the row"
							+ " let them both out saying yes - so one of them is about to read"
							+ " something the other is deciding")
					.containsExactly(200, 409);

			assertThat(db.sql("select count(*) from verification_lock where verification_id = ?")
					.param(profileItem).query(Integer.class).single()).isEqualTo(1);

			/* AND THE ONE HOLDING IT IS THE ONE WHO WAS TOLD SO, the same sentence the barrier
			   case makes: a count of one is satisfied by the loser holding it just as well. */
			long holder = db.sql("select held_by from verification_lock where verification_id = ?")
					.param(profileItem).query(Long.class).single();

			String winner = one.getStatus() == 200 ? ONE_MODERATOR : THE_OTHER_MODERATOR;

			assertThat(holder)
					.as("the item is held by the moderator who was refused it")
					.isEqualTo(accountOf(winner));
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * Polled rather than assumed, the same discipline {@code RegistrationOverRealHttpTest}
	 * already applies to {@code pg_stat_activity}: a fixed sleep would either run too short on
	 * a loaded machine and release the lock before both requests arrive - the very flakiness
	 * these cases exist to remove - or run so long it slows the suite for nothing.
	 *
	 * <p>One method for both forced cases, because they are one question - „are both requests
	 * now stopped inside the database by the row this connection is holding" - and two copies
	 * of it would be free to drift apart while both went on looking green.
	 */
	private void waitUntilBothRequestsAreBlockedBehindThisHold(
			List<Future<MockHttpServletResponse>> submitted) throws InterruptedException {
		Instant deadline = Instant.now().plusSeconds(10);

		while (blockedBehindThisHold() < 2) {
			if (Instant.now().isAfter(deadline)) {
				List<String> snapshot = db.sql("select pid || ' ' || state || ' ' || coalesce("
								+ "wait_event_type, '-') || ' ' || coalesce(wait_event, '-')"
								+ " || ' blocked_by=' || pg_blocking_pids(pid)::text || ' | '"
								+ " || coalesce(query, '-') from pg_stat_activity"
								+ " where datname = current_database()")
						.query(String.class).list();
				List<String> futureState = submitted.stream()
						.map(f -> "done=" + f.isDone() + " cancelled=" + f.isCancelled())
						.toList();

				throw new IllegalStateException(
						"both requests should have been queued behind the held row lock within"
								+ " ten seconds, and the lock manager never showed two behind this"
								+ " connection. Futures: " + futureState + " Snapshot: " + snapshot);
			}

			Thread.sleep(20);
		}
	}

	/**
	 * HOW MANY BACKENDS ARE STOPPED BY THE LOCK <b>THIS CONNECTION</b> IS HOLDING, asked of the
	 * lock manager itself rather than read off anybody's state.
	 *
	 * <p><b>Of this connection, and that word is the whole of it.</b> One Testcontainers
	 * database is shared by the whole suite, so a count of every backend with {@code
	 * wait_event_type = 'Lock'} is satisfied by any other context blocked on anything at all -
	 * and the sentence these two cases assert, that the two requests they submitted are stopped
	 * behind the row they locked, would then be true about somebody else's backends.
	 * {@code pg_blocking_pids} answers who is blocking whom, so rooting the set at {@code
	 * pg_backend_pid()} lets nothing in that this connection is not the reason for.
	 *
	 * <p><b>RECURSIVE, because Postgres queues the SECOND waiter behind the FIRST and not
	 * behind the holder.</b> Measured 21.09.2026 on this same container: of the two backends
	 * genuinely stopped behind a held row, one waits on a {@code transactionid} - this
	 * connection's - and the other on a {@code tuple} the first waiter already holds. Rooted at
	 * this pid and read one level deep the count is 1 and the wait above would time out on a
	 * pair that had arrived. The closure is the shape of the queue rather than a guess at its
	 * depth: whatever chain leads back here is counted, and nothing else can.
	 *
	 * <p><b>Nothing is read off {@code state} or {@code query}, and that is not a preference.</b>
	 * Measured the same day: a backend really stopped on a row lock reports {@code state =
	 * 'idle'} through PgJDBC's extended protocol, with {@code query} still showing its
	 * connection's setup statement rather than the statement that is blocked. A condition
	 * written against either never saw the two and timed out with both futures un-done. The
	 * lock manager has no such second version of the truth.
	 *
	 * <p><b>The floor under it is in the cases themselves</b>: each asserts this answers
	 * {@code 0} with the row locked and nothing submitted yet, so a predicate stuck at two -
	 * or one that counts the suite rather than these requests - fails before the race begins.
	 */
	private int blockedBehindThisHold() {
		return db.sql("with recursive behind_this_hold(pid) as ("
						+ " select a.pid from pg_stat_activity a"
						+ " where pg_backend_pid() = any(pg_blocking_pids(a.pid))"
						+ " union"
						+ " select a.pid from pg_stat_activity a, behind_this_hold b"
						+ " where b.pid = any(pg_blocking_pids(a.pid)))"
						+ " select count(*) from behind_this_hold")
				.query(Integer.class).single();
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

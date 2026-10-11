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

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
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
 * ask the LOCK MANAGER whether the requests have arrived</b> ({@link BlockedBehindThisHold}),
 * and both assert that neither request had been ANSWERED while they were stopped there -
 * which is what names the branch. Each route has a PAIR of refusals that cannot be told
 * apart from outside: on the deciding route the row read as already answered and the update
 * that matched nothing, both {@code SOMEBODY_ANSWERED_IT_ALREADY}; on the holding route the
 * check before the insert and the count after it, both {@code SOMEBODY_ELSE_IS_READING_IT}.
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

	/**
	 * WHAT THE CASES ABOUT A RACE THE CALENDAR DOES NOT HOLD CALL THE EVENTS THEY MAKE, and every
	 * address begins with the same words so the cleanup can take them all back by them: these rows
	 * are committed, and one left behind would refuse the next run's approval as an event that is
	 * in the calendar already.
	 */
	private static final String MADE_BY_THESE_CASES = "van-kalendara-istovremeno-%";

	private static final String ONE_NAME = "Van kalendara istovremeno prvi";

	private static final String ONE_ADDRESS = "van-kalendara-istovremeno-prvi-2026";

	private static final String THE_OTHER_NAME = "Van kalendara istovremeno drugi";

	private static final String THE_OTHER_ADDRESS = "van-kalendara-istovremeno-drugi-2026";

	private static final String A_THIRD_NAME = "Van kalendara istovremeno treci";

	private static final String A_THIRD_ADDRESS = "van-kalendara-istovremeno-treci-2026";

	/** What the member typed for the race, which no event of these cases is called. */
	private static final String THE_NAME_HE_TYPED = "Trka koje nema";

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

	/* THE RUN OF THE ONE CASE ABOUT THE RESULTS TAB, and what makes it one: an event, a race and
	   the submission behind the queue row. Nought until that case makes them, so the cleanup
	   below deletes nothing for the cases that do not. */
	private long theEvent;

	private long theRace;

	private long theRun;

	private long runItem;

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
		db.sql("delete from verification_lock where verification_id in (?, ?, ?)")
				.params(teamItem, profileItem, runItem).update();
		db.sql("delete from verification where id in (?, ?, ?)")
				.params(teamItem, profileItem, runItem).update();
		db.sql("delete from result where competitor_id = ?").param(founder).update();
		db.sql("delete from result_submission where id = ?").param(theRun).update();
		db.sql("delete from race where id = ?").param(theRace).update();
		db.sql("delete from btl_event where id = ?").param(theEvent).update();
		/* AND EVERY EVENT A CASE ABOUT A RACE THE CALENDAR DOES NOT HOLD MADE, with its races, by
		   the words its address begins with: those keys are not this case's to know, because
		   the route made them. */
		db.sql("delete from btl_event where slug like ?").param(MADE_BY_THESE_CASES).update();
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

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet, so a count of"
								+ " backends held up by this connection that is not nought is"
								+ " counting something other than the two requests below")
						.isZero();

				submitted.add(pool.submit(theApproval));
				submitted.add(pool.submit(theRefusal));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				/* AND NEITHER HAS BEEN ANSWERED, which is what names the branch. The refusal
				   `decide` gives when it reads a row already answered and the one `write`
				   gives when its update matches nothing are the same words, `SOMEBODY_ANSWERED
				   _IT_ALREADY`, so a status on its own cannot say which came back - which is
				   the very pair the note at the head of this class says a green barrier run
				   cannot tell apart. A request refused on the read is answered without going
				   near the row again and its Future is done by now; both of these are inside
				   the database, stopped by this connection, with nothing written. */
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

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet, so a count of"
								+ " backends held up by this connection that is not nought is"
								+ " counting something other than the two requests below")
						.isZero();

				submitted.add(pool.submit(oneTaking));
				submitted.add(pool.submit(theOtherTaking));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
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
	 * TWO APPROVALS OF ONE RUN, EACH WITH FIGURES OF ITS OWN, COUNT IT ONCE AND AT THE WINNER'S
	 * FIGURES, IN THE STANDINGS AND IN THE SUBMISSION ALIKE.
	 *
	 * <p><b>Why the results tab needs a forced case of its own.</b> Approving a run writes two
	 * rows after the claim: the result, and the submission it was decided from, written over with
	 * what was counted. Both must come AFTER the claim, and no sequential case can say whether
	 * they do: the second of two approvals meets a row already decided outside any transaction
	 * and never reaches either statement. Here both requests are inside the update together,
	 * stopped by this connection exactly as in
	 * {@link #theLoserMeetsARowAlreadyClaimedEveryTimeAndNotOnlyWhenTheSchedulerRaces}, so a
	 * statement moved in front of the claim is one the loser runs as well - a second result, or
	 * the loser's figures in the submission beside the winner's in the standings.
	 *
	 * <p><b>The two moderators set different figures and both differ from what was sent, in every
	 * one of the four</b>, so „the result and the submission agree" cannot be met by both still
	 * holding the copy that was sent, and „they are the winner's" cannot be met by the loser's.
	 */
	@Test
	void twoApprovalsOfOneRunWithFiguresOfTheirOwnCountItOnceAndAtTheWinnersFigures()
			throws Exception {
		aRunWaitsInTheResultsTab();

		String oneSets = "21.0000 310 120 6000";
		String theOtherSets = "23.5000 450 90 7000";

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			Callable<MockHttpServletResponse> one = () -> answerWith(ONE_MODERATOR, runItem,
					"{\"approved\":true,\"amended\":{\"distanceKm\":21.0,\"ascentM\":310,"
							+ "\"descentM\":120,\"seconds\":6000}}");
			Callable<MockHttpServletResponse> theOther = () -> answerWith(THE_OTHER_MODERATOR,
					runItem, "{\"approved\":true,\"amended\":{\"distanceKm\":23.5,\"ascentM\":450,"
							+ "\"descentM\":90,\"seconds\":7000}}");

			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(runItem).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet, so a count of"
								+ " backends held up by this connection that is not nought is"
								+ " counting something other than the two requests below")
						.isZero();

				submitted.add(pool.submit(one));
				submitted.add(pool.submit(theOther));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				assertThat(submitted)
						.as("a request that is not held up by this hold was refused before it"
								+ " reached the claim, which is the branch this case is written to"
								+ " keep away from")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			MockHttpServletResponse first = submitted.get(0).get(30, TimeUnit.SECONDS);
			MockHttpServletResponse second = submitted.get(1).get(30, TimeUnit.SECONDS);

			assertThat(List.of(first.getStatus(), second.getStatus()).stream().sorted().toList())
					.containsExactly(200, 409);

			String winners = first.getStatus() == 200 ? oneSets : theOtherSets;

			assertThat(db.sql("select distance_km || ' ' || ascent_m || ' ' || descent_m || ' '"
							+ " || seconds from result where competitor_id = ?")
					.param(founder).query(String.class).list())
					.as("the run was counted twice, or at the figures of the moderator who was"
							+ " refused")
					.containsExactly(winners);
			assertThat(db.sql("select distance_km || ' ' || ascent_m || ' ' || descent_m || ' '"
							+ " || seconds from result_submission where id = ?")
					.param(theRun).query(String.class).single())
					.as("the submission says something other than what the standings counted, so"
							+ " the moderator who was refused wrote into it")
					.isEqualTo(winners);
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * TWO APPROVALS OF ONE RUN ON A RACE THE CALENDAR DOES NOT HOLD MAKE ONE EVENT, ONE RACE AND
	 * ONE RESULT, AND THE EVENT IS THE WINNER'S.
	 *
	 * <p>Making the event and the race are two more statements after the claim, and the claim is
	 * what keeps the loser out of them (ADL O14, the owner's choice of 21.09.2026, in the record's
	 * wording: „u transakciji su rezultat, rang liste, trka i događaj ako nastaju"). No sequential
	 * case can say they come after it: the second of two approvals meets a row already decided
	 * outside any transaction and never reaches either. Here both requests are inside the claim
	 * together, stopped by this connection exactly as in
	 * {@link #theLoserMeetsARowAlreadyClaimedEveryTimeAndNotOnlyWhenTheSchedulerRaces}, so a
	 * statement moved in front of the claim is one the loser runs as well - and a second event,
	 * with a race and no result on it, is left in the calendar.
	 *
	 * <p><b>The two moderators name the event differently</b>, so which of the two events exists
	 * says whose approval made it, and the loser's name standing in the calendar is the fault.
	 */
	@Test
	void twoApprovalsOfOneRunOnARaceTheCalendarDoesNotHoldMakeOneEventOneRaceAndOneResult()
			throws Exception {
		aRunOnARaceTheCalendarDoesNotHoldWaits();

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			Callable<MockHttpServletResponse> one = () -> answerWith(ONE_MODERATOR, runItem,
					makingTheRace(ONE_NAME));
			Callable<MockHttpServletResponse> theOther = () -> answerWith(THE_OTHER_MODERATOR,
					runItem, makingTheRace(THE_OTHER_NAME));

			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from verification where id = ? for update")
						.param(runItem).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet, so a count of"
								+ " backends held up by this connection that is not nought is"
								+ " counting something other than the two requests below")
						.isZero();

				submitted.add(pool.submit(one));
				submitted.add(pool.submit(theOther));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				assertThat(submitted)
						.as("a request that is not held up by this hold was refused before it"
								+ " reached the claim, which is the branch this case is written to"
								+ " keep away from")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			MockHttpServletResponse first = submitted.get(0).get(30, TimeUnit.SECONDS);
			MockHttpServletResponse second = submitted.get(1).get(30, TimeUnit.SECONDS);

			assertThat(List.of(first.getStatus(), second.getStatus()).stream().sorted().toList())
					.containsExactly(200, 409);

			String winners = first.getStatus() == 200 ? ONE_ADDRESS : THE_OTHER_ADDRESS;
			String losers = first.getStatus() == 200 ? THE_OTHER_ADDRESS : ONE_ADDRESS;

			assertThat(eventAt(losers))
					.as("the moderator who was refused made an event, and a race nobody ran stands"
							+ " in the calendar")
					.isEmpty();

			long event = eventAt(winners).orElseThrow(
					() -> new AssertionError("the moderator who was told yes made no event"));
			List<Long> races = db.sql("select id from race where event_id = ?").param(event)
					.query(Long.class).list();

			assertThat(races).hasSize(1);
			assertThat(db.sql("select count(*) from result where race_id = ? and competitor_id = ?")
					.params(races.get(0), founder).query(Integer.class).single())
					.as("the race was made and the run not counted on it, or counted twice")
					.isEqualTo(1);
			assertThat(db.sql("select race_id from result_submission where id = ?")
					.param(theRun).query(Long.class).single())
					.as("the submission points at a race other than the one it was counted on")
					.isEqualTo(races.get(0));
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * AN APPROVAL THAT FAILS AFTER THE EVENT AND THE RACE ARE WRITTEN LEAVES NEITHER BEHIND, AND THE
	 * RUN STILL WAITING AS THE MEMBER SENT IT.
	 *
	 * <p>The cost the owner accepted with the decision, in the record's wording (PDL P9,
	 * 30.08.2026): „prevezivanje mora da bude atomsko sa upisom trke, inače nastane trka bez
	 * rezultata ili rezultat koji pokazuje na trku koje nema." A race with no result is exactly what
	 * an event and a race written on their own, outside the transaction that counts the run, would
	 * leave the moment anything after them failed - and nothing in a case that commits nothing, or
	 * in one where nothing fails, can see it.
	 *
	 * <p><b>So the approval is made to fail at its last statement, and nowhere else.</b> This
	 * connection holds the submission's row; the request writes the event, the race and the result,
	 * and stops at the statement that points the submission at the race. While it stands there,
	 * the lock manager is asked which tables it has already written - the event, the race and the
	 * result have to be among them, or the failure below would come before the writes it is about -
	 * and then its statement is cancelled. What a cancelled statement leaves is a fault answered
	 * by PostgreSQL's own code for it, {@code 57014}, and the verdict asks for that code and for no
	 * other reason to fail.
	 *
	 * <p><b>And the same answer, sent again with nothing holding the row, goes through</b>, so the
	 * failure was the cancellation and not something wrong with what was sent.
	 */
	@Test
	void anApprovalThatFailsAfterTheRaceIsWrittenLeavesNoEventNoRaceAndTheRunWaiting()
			throws Exception {
		aRunOnARaceTheCalendarDoesNotHoldWaits();

		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from result_submission where id = ? for update")
						.param(theRun).query(Integer.class).single();

				submitted.add(pool.submit(() -> answerWith(ONE_MODERATOR, runItem,
						makingTheRace(A_THIRD_NAME))));

				long stopped = theOneStoppedBehindThisHold();

				assertThat(db.sql("select c.relname from pg_locks l join pg_class c"
								+ " on c.oid = l.relation where l.pid = ? and l.granted"
								+ " and l.mode = 'RowExclusiveLock'")
						.param(stopped).query(String.class).list())
						.as("the request was stopped before it wrote the event, the race and the"
								+ " result, so cancelling it says nothing about them")
						.contains("btl_event", "race", "result");

				assertThat(db.sql("select pg_cancel_backend(cast(? as integer))").param(stopped)
						.query(Boolean.class).single()).isTrue();

				return null;
			});

			Throwable failed = catchThrowable(() -> submitted.get(0).get(30, TimeUnit.SECONDS));

			assertThat(sqlStateIn(failed))
					.as("the approval failed for a reason other than the cancellation: %s", failed)
					.isEqualTo("57014");

			assertThat(eventAt(A_THIRD_ADDRESS))
					.as("the event outlived the approval that made it, with a race nobody's run is"
							+ " counted on")
					.isEmpty();
			assertThat(db.sql("select count(*) from race where name = ?").param(A_THIRD_NAME)
					.query(Integer.class).single()).isZero();
			assertThat(db.sql("select count(*) from result where competitor_id = ?").param(founder)
					.query(Integer.class).single()).isZero();
			assertThat(db.sql("select state from verification where id = ?").param(runItem)
					.query(String.class).single()).isEqualTo("waiting");
			assertThat(db.sql("select race_name from result_submission where id = ? and race_id"
							+ " is null").param(theRun).query(String.class).single())
					.as("the submission no longer describes the race the member typed")
					.isEqualTo(THE_NAME_HE_TYPED);

			/* AND WITH NOTHING HOLDING THE ROW, THE SAME ANSWER GOES THROUGH. */
			assertThat(answerWith(ONE_MODERATOR, runItem, makingTheRace(A_THIRD_NAME)).getStatus())
					.isEqualTo(200);
			assertThat(eventAt(A_THIRD_ADDRESS)).isPresent();
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * AN ADDRESS TAKEN AFTER THE APPROVAL ASKED ABOUT IT REFUSES THE APPROVAL, AND THE ROW IT HAD
	 * CLAIMED WAITS AGAIN.
	 *
	 * <p>PDL, the owner's answer of 10.10.2026: „ako događaj postoji a trke nema, odobrenje se
	 * odbija". The route asks before it claims the row, and that question cannot see an event
	 * another approval is writing at the same moment, because that event is not committed yet; only
	 * the unique index sees it, and by then the row is claimed.
	 *
	 * <p><b>So this connection is the other approval.</b> It writes an event at the address the
	 * request is about to make and holds it uncommitted. The request asks, finds nothing, claims the
	 * row and stops at its own insert, behind this connection: nothing else the route does waits on
	 * an event nobody has committed, so being held up here is being at that insert, and the lock
	 * manager says when it is ({@link BlockedBehindThisHold}). Then this connection commits.
	 *
	 * <p>What has to be left is a refusal in the sentence the same refusal gets before the claim, and
	 * nothing of the answer: the row waiting, no race, no result, the submission as the member sent
	 * it, and one event at that address - the one that took it.
	 */
	@Test
	void anAddressTakenAfterTheApprovalAskedAboutItRefusesItAndTheRowWaitsAgain() throws Exception {
		aRunOnARaceTheCalendarDoesNotHoldWaits();

		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			long theOneThatTookIt = holdingTheRow.execute(heldOpen -> {
				long event = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
								+ " description, link) values (?, ?, date '2026-09-12', " + A_TOWN + ","
								+ " 'race', false, '', '') returning id")
						.params(A_THIRD_ADDRESS, A_THIRD_NAME).query(Long.class).single();

				submitted.add(pool.submit(() -> answerWith(ONE_MODERATOR, runItem,
						makingTheRace(A_THIRD_NAME))));

				theOneStoppedBehindThisHold();

				return event;
			});

			MockHttpServletResponse refused = submitted.get(0).get(30, TimeUnit.SECONDS);

			assertThat(refused.getStatus()).isEqualTo(409);
			assertThat(refused.getContentAsString(StandardCharsets.UTF_8))
					.contains("Događaj sa tim nazivom u toj godini već postoji.");

			assertThat(db.sql("select id from btl_event where slug like ?").param(MADE_BY_THESE_CASES)
					.query(Long.class).list())
					.as("the refused approval left an event of its own, numbered or not")
					.containsExactly(theOneThatTookIt);
			assertThat(db.sql("select count(*) from race where name = ?").param(A_THIRD_NAME)
					.query(Integer.class).single()).isZero();
			assertThat(db.sql("select count(*) from result where competitor_id = ?").param(founder)
					.query(Integer.class).single()).isZero();
			assertThat(db.sql("select state from verification where id = ?").param(runItem)
					.query(String.class).single())
					.as("the row the refused approval had claimed was left decided")
					.isEqualTo("waiting");
			assertThat(db.sql("select race_name from result_submission where id = ? and race_id"
							+ " is null").param(theRun).query(String.class).single())
					.as("the submission no longer describes the race the member typed")
					.isEqualTo(THE_NAME_HE_TYPED);
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * A RUN OF THE FOUNDER'S WAITING IN THE RESULTS TAB ON A RACE THE CALENDAR DOES NOT HOLD,
	 * described the way the member's own route writes one, on a day this clock - the real one - has
	 * long passed.
	 */
	private void aRunOnARaceTheCalendarDoesNotHoldWaits() {
		theRun = db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " race_name, race_kind, place_id, distance_km, ascent_m, descent_m, seconds,"
						+ " link, comment) values (?, null, date '2026-09-12', ?, 'length', " + A_TOWN
						+ ", 12.0000, 80, 60, 3300, 'https://primer.rs/rezultati', '') returning id")
				.params(founder, THE_NAME_HE_TYPED).query(Long.class).single();

		runItem = db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " result_submission_id) values ('results', ?, ?, '', ?) returning id")
				.params(founder, THE_NAME_HE_TYPED, theRun).query(Long.class).single();
	}

	/** An approval that makes the event and its race of a length under one name, as JSON. */
	private static String makingTheRace(String name) {
		return "{\"approved\":true,\"newRace\":{\"eventName\":\"" + name + "\",\"raceName\":\""
				+ name + "\",\"raceKind\":\"length\"}}";
	}

	private Optional<Long> eventAt(String address) {
		return db.sql("select id from btl_event where slug = ?").param(address).query(Long.class)
				.optional();
	}

	/**
	 * THE ONE REQUEST STOPPED BEHIND THIS CONNECTION, once it is there, and its backend.
	 *
	 * <p>Waited for through {@link BlockedBehindThisHold#count}, which reads the lock manager fresh
	 * each time; the backend is then read through the same question, so the one cancelled is the
	 * one this connection is holding up and no other.
	 */
	private long theOneStoppedBehindThisHold() {
		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < 1) {
			if (Instant.now().isAfter(deadline)) {
				throw new IllegalStateException("the request never reached the statement this"
						+ " connection is holding up");
			}

			try {
				Thread.sleep(20);
			} catch (InterruptedException e) {
				throw new RuntimeException(e);
			}
		}

		db.sql("select pg_stat_clear_snapshot()::text").query(String.class).single();

		return db.sql("select pid from pg_stat_activity where pg_backend_pid() = any("
						+ "pg_blocking_pids(pid))")
				.query(Long.class).single();
	}

	/** The SQLSTATE of the first database fault in a chain of causes, or nothing. */
	private static String sqlStateIn(Throwable failed) {
		for (Throwable cause = failed; cause != null; cause = cause.getCause()) {
			if (cause instanceof SQLException fault && fault.getSQLState() != null) {
				return fault.getSQLState();
			}
		}

		return null;
	}

	/**
	 * A RUN OF THE FOUNDER'S WAITING IN THE RESULTS TAB, AT A FREE RACE ALREADY RUN.
	 *
	 * <p>Free, so all four figures are the runner's and every one a moderator sets is counted;
	 * run on a day this clock - the real one - has long passed. Sent at 20 km, 200 m up, 100 m
	 * down and 1:50:00, which neither moderator above sets.
	 */
	private void aRunWaitsInTheResultsTab() {
		theEvent = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
						+ " description, link) values ('istovremena-odluka-trka', 'Istovremena trka',"
						+ " date '2026-09-05', " + A_TOWN + ", 'race', false, '', '') returning id")
				.query(Long.class).single();

		theRace = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, 'Slobodna trka', false,"
						+ " date '2026-09-05', 'free', 0, 0, 0, 0) returning id")
				.param(theEvent).query(Long.class).single();

		theRun = db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " distance_km, ascent_m, descent_m, seconds, link, comment) values (?, ?,"
						+ " date '2026-09-05', 20.0000, 200, 100, 6600, 'https://primer.rs/rezultati',"
						+ " '') returning id")
				.params(founder, theRace).query(Long.class).single();

		runItem = db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " result_submission_id) values ('results', ?, 'Slobodna trka', '', ?)"
						+ " returning id")
				.params(founder, theRun).query(Long.class).single();
	}

	/** The same call {@link #answer} makes, with the body written out whole. */
	private MockHttpServletResponse answerWith(String email, long id, String body)
			throws Exception {
		return http.perform(post("/api/verification/" + id + "/decision").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email)))
						.contentType(MediaType.APPLICATION_JSON)
						.content(body))
				.andReturn().getResponse();
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

		for (String right : List.of("queue:teams", "queue:profiles", "queue:results")) {
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

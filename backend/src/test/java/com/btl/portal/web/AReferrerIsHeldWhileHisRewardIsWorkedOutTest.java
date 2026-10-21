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
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.ObjectMapper;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * THE REFERRER'S ROW IS HELD WHILE HIS REWARD IS WORKED OUT FROM HIS COUNTRY, AND THE HOLD CANNOT DEADLOCK WITH
 * THE TWO DOORS THAT TAKE IT (PENDING, review of PR 576, 19.10.2026: {@code BalanceBook#aReferralWasActivated}
 * read the country of whoever brought a member in without holding his row).
 *
 * <p><b>What can go wrong without the hold.</b> The reward is written in the money of the referrer's country,
 * and {@link MeWriteApi} moves that country while it restates his whole book in the new money. If the reward
 * is worked out in the old money, the change commits (restating a book that does not hold the reward yet) and
 * the reward is written afterwards, a line in a money he has left sits on his book where his balance never
 * counts it. {@link #aRewardIsWorkedOutInTheMoneyOfTheCountryTheReferrerHasJustMovedTo} is the order that
 * hurts, forced: the move is another transaction of the case's own that has written the new country and has
 * not committed; the activation has to stand behind it, and once it is let go the reward is in the new money.
 *
 * <p><b>The change is simulated and not sent, and that is deliberate.</b> A real change of country commits
 * in one breath, so no schedule can be forced between its two statements; what matters here is only that it
 * holds the referrer's row from its {@code update} to its commit, which one statement of a held transaction
 * does. The case does not wait on a timeout: with the hold missing the activation is answered at once, and
 * {@link AHeldTransaction#untilBehind} fails on its assertion that a request stands behind the move.
 *
 * <p><b>The lock order, measured and not argued.</b> {@link #aGrantAndAPaymentForTwoMembersOfOneReferrerTakeTurnsAndBreakNoDeadlock}
 * holds the referrer's row {@code for update}, which is what a payment booked for the referrer himself holds,
 * and sends the two doors that reach {@code aReferralWasActivated} for two of his members at the same time:
 * the administration's grant ({@link GrantingASeason}) and a booked payment ({@link BookingAPayment}). Each
 * holds its own member's row first and wants the referrer's second, and both must be let through in turn,
 * with a reward line for each and without the database breaking a deadlock.
 *
 * <p><b>A RENEWAL TAKES NOTHING OF THE REFERRER (review of PR 611, round 1).</b> The hold above is for the day the
 * reward is first worked out. A member who is activated again, a renewal, has his line already, and then the
 * statement that writes it falls to {@code on conflict do nothing} and touches nothing of the referrer, which is
 * all the two other writers that take the referrer before his member rely on: the save of results over both
 * ({@code ResultsByTheLeagueApi}, {@code select ... where id in (...) order by id for update}, the older row
 * first) and the deletion of the referrer ({@code CompetitorWriteApi}, whose {@code ON DELETE SET NULL} then
 * updates the member). A hold taken on every activation put the grant between those two orders and the database
 * broke a deadlock, measured as a 500 on the grant. {@link #aResultsSaveOverTheReferrerAndAMemberRenewingBreaksNoDeadlock}
 * and {@link #theDeletionOfTheReferrerAndTheRenewalOfAMemberOfHisBreakNoDeadlock} stop the other writer behind a hold
 * on the referrer, send the renewal, and ask that the renewal is answered while the hold is still kept.
 *
 * <p><b>NOT {@code @Transactional}</b>: the writers are different connections and their rows are real commits,
 * taken back out by {@link #andNothingOfItIsLeftBehind}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AReferrerIsHeldWhileHisRewardIsWorkedOutTest {

	/** The renewal window of 2027: what is on sale is 2028, and a Serbian member sends 4.200 dinars. */
	private static final Instant IN_OCTOBER_2027 = Instant.parse("2027-10-20T09:00:00Z");

	/** Distinct from every other fixture's, on purpose: these rows are committed. */
	private static final String THE_CASHIER = "preporucilac-drzan-blagajnik@primer.rs";

	private static final String THE_REFERRERS_NUMBER = "000961";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	/** {@code rank = 1} is Shanghai, billed in euro. */
	private static final String A_TOWN_ABROAD = "(select id from place where rank = 1)";

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		Clock aClockInTheRenewalWindow() {
			return Clock.fixed(IN_OCTOBER_2027, ZoneOffset.UTC);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private DataSource pool;

	/** What the requests threw, by message: an exception out of {@code perform} is a 500. */
	private final List<String> thrown = new CopyOnWriteArrayList<>();

	private String cookie;

	private long cashier;

	/** Lives in Serbia and is billed in dinars, with a number and an active membership. */
	private long referrer;

	/** Both brought in by {@link #referrer}, both new: no number, not active, in Serbia. */
	private long firstNewcomer;

	private long secondNewcomer;

	/** Brought in by {@link #referrer}, holding 2027 free of the fee and already paid for: zero until a case makes him. */
	private long renewing;

	@BeforeEach
	void aReferrerAndTwoMembersHeBroughtIn() {
		thrown.clear();
		renewing = 0;

		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Drzan', 'Blagajnik', ?, (select id from role where code = 'moderator'))")
				.param(THE_CASHIER).update();

		cashier = db.sql("select id from account where email = ?").param(THE_CASHIER)
				.query(Long.class).single();

		db.sql("insert into account_admin_right (account_id, right_code) values (?, 'queue:payments')")
				.param(cashier).update();

		db.sql("insert into account_admin_right (account_id, right_code) values (?, '" + CompetitorApi.OVER_THE_MEMBERS + "')")
				.param(cashier).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values (?, ?, ?, ?, ?)")
				.params(cashier, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();

		referrer = member(THE_REFERRERS_NUMBER, "0011aabbccddee61", true, null);
		firstNewcomer = member(null, "0011aabbccddee62", false, referrer);
		secondNewcomer = member(null, "0011aabbccddee63", false, referrer);
	}

	/** Real commits, so a real delete, children before parents. */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		for (long member : new long[] {renewing, firstNewcomer, secondNewcomer, referrer}) {
			db.sql("delete from message where to_id = ?").param(member).update();
			db.sql("delete from membership where competitor_id = ?").param(member).update();
			db.sql("delete from payment where competitor_id = ?").param(member).update();
			db.sql("delete from balance_entry where competitor_id = ?").param(member).update();
		}

		db.sql("delete from competitor where id in (?, ?, ?, ?)")
				.params(renewing, firstNewcomer, secondNewcomer, referrer).update();
		db.sql("delete from account_session where account_id = ?").param(cashier).update();
		db.sql("delete from account_admin_right where account_id = ?").param(cashier).update();
		db.sql("delete from account where id = ?").param(cashier).update();
	}

	/**
	 * THE REFERRER MOVES TO ANOTHER COUNTRY AT THE INSTANT A MEMBER HE BROUGHT IN IS ACTIVATED, and the reward is
	 * in the money he has moved to.
	 *
	 * <p>The referrer lives in Serbia, so read before the move his reward is 600 dinars. A transaction of the
	 * case's own writes his new town (Shanghai, billed in euro) and does not commit. The administration grants
	 * his member a season free of the fee; the grant has to stand behind the move, and when the move commits
	 * it reads the new country and writes 5 euro. A grant that read the country before the move wrote 600 dinars
	 * into a book that is now in euro.
	 */
	@Test
	void aRewardIsWorkedOutInTheMoneyOfTheCountryTheReferrerHasJustMovedTo() throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(1);
		List<Future<Integer>> submitted = new ArrayList<>();
		int answer;

		try (AHeldTransaction theMove = new AHeldTransaction(pool)) {
			assertThat(theMove.behind()).as("the move is held and nothing has been submitted yet").isZero();

			theMove.db().sql("update competitor set place_id = " + A_TOWN_ABROAD + " where id = ?")
					.param(referrer).update();

			Future<Integer> grant = requests.submit(() -> granted(firstNewcomer));
			submitted.add(grant);

			theMove.untilBehind(1, submitted);
			theMove.commit();

			answer = grant.get(30, TimeUnit.SECONDS);
		} finally {
			requests.shutdownNow();
		}

		assertThat(answer).as("the grant was refused; what the database said: " + thrown).isEqualTo(201);
		assertThat(bookOf(referrer))
				.as("the reward was written in the money the referrer had left")
				.isEqualTo("referral 5.00 EUR");
	}

	/**
	 * A GRANT AND A BOOKED PAYMENT FOR TWO MEMBERS OF ONE REFERRER, STOPPED BEHIND A HOLD ON HIM, TAKE TURNS.
	 *
	 * <p>The hold is {@code for update}, what a payment booked for the referrer himself keeps from its first
	 * statement to its commit. Both requests hold their own member first, reach the referrer's row second and
	 * stand there; when the hold is let go the first takes the row, writes its reward and commits, and the
	 * second takes it in turn. Both are answered 201, each member's reward is on the referrer's book, and the
	 * database broke no deadlock.
	 */
	@Test
	void aGrantAndAPaymentForTwoMembersOfOneReferrerTakeTurnsAndBreakNoDeadlock() throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(2);
		List<Future<Integer>> submitted = new ArrayList<>();
		List<Integer> answers = new ArrayList<>();

		try (AHeldTransaction thePayerOfTheReferrer = new AHeldTransaction(pool)) {
			assertThat(thePayerOfTheReferrer.behind())
					.as("the referrer is held and nothing has been submitted yet").isZero();

			thePayerOfTheReferrer.db().sql("select id from competitor where id = ? for update")
					.param(referrer).query(Long.class).single();

			submitted.add(requests.submit(() -> granted(firstNewcomer)));
			submitted.add(requests.submit(() -> paid(secondNewcomer)));

			thePayerOfTheReferrer.untilBehind(2, submitted);
			thePayerOfTheReferrer.commit();

			for (Future<Integer> one : submitted) {
				answers.add(one.get(30, TimeUnit.SECONDS));
			}
		} finally {
			requests.shutdownNow();
		}

		assertThat(thrown).as("the database broke a deadlock between the two doors").noneMatch(
				said -> said.contains("deadlock detected"));
		assertThat(answers).as("a door was answered with a fault; what the database said: " + thrown)
				.containsExactly(201, 201);
		assertThat(bookOf(referrer))
				.as("each of his two members earned him one reward")
				.isEqualTo("referral 600.00 RSD, referral 600.00 RSD");
	}

	/**
	 * A REFERRER WHO WAS REWARDED BEFORE, FOR A MEMBER HE HAS NEVER BEEN REWARDED FOR, IS HELD ALL THE SAME.
	 *
	 * <p>The hold is asked for the member and not for the referrer: {@code secondNewcomer} has already earned
	 * him a line, {@code firstNewcomer} has not. A check that looked at the referrer's own book would find a
	 * line, take no hold and let the reward be worked out in the old money; the move to euro is the order that
	 * shows it, as in {@link #aRewardIsWorkedOutInTheMoneyOfTheCountryTheReferrerHasJustMovedTo}.
	 */
	@Test
	void aReferrerRewardedBeforeIsHeldAllTheSameForAMemberNeverRewarded() throws Exception {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, referred_competitor_id,"
						+ " occurred_at, recorded_by, recorded_by_name) values (?, 600, 'RSD', 'referral', ?,"
						+ " timestamptz '2027-01-10 10:00:00+00', ?, 'Drzan Blagajnik')")
				.params(referrer, secondNewcomer, cashier).update();

		ExecutorService requests = Executors.newFixedThreadPool(1);
		List<Future<Integer>> submitted = new ArrayList<>();
		int answer;

		try (AHeldTransaction theMove = new AHeldTransaction(pool)) {
			theMove.db().sql("update competitor set place_id = " + A_TOWN_ABROAD + " where id = ?")
					.param(referrer).update();

			Future<Integer> grant = requests.submit(() -> granted(firstNewcomer));
			submitted.add(grant);

			theMove.untilBehind(1, submitted);
			theMove.commit();

			answer = grant.get(30, TimeUnit.SECONDS);
		} finally {
			requests.shutdownNow();
		}

		assertThat(answer).as("the grant was refused; what the database said: " + thrown).isEqualTo(201);
		assertThat(bookOf(referrer))
				.as("the reward for the member never rewarded was written in the money the referrer had left")
				.isEqualTo("referral 600.00 RSD, referral 5.00 EUR");
	}

	/**
	 * A SAVE OF RESULTS OVER THE REFERRER AND HIS MEMBER, AND THE MEMBER IS RENEWED: no deadlock.
	 *
	 * <p>The save is the exact statement of {@code ResultsByTheLeagueApi#judged}, the older row first. It is
	 * stopped behind a hold on the referrer, the renewal of his member is sent behind it, and the hold is let
	 * go. The renewal holds its member's row and, a line being there already, asks nothing of the referrer, so
	 * it is answered while the hold is still kept and the save then takes both rows in turn.
	 */
	@Test
	void aResultsSaveOverTheReferrerAndAMemberRenewingBreaksNoDeadlock() throws Exception {
		aMemberHoldingTheLastSeasonAndAlreadyRewardedFor();

		Outcome outcome = theRenewalMeetsAWriterOfTheReferrer(this::aResultsSaveOverTheReferrerAndTheMember);

		outcome.assertNoDeadlock();
		assertThat(outcome.otherSaid()).as(outcome.said()).isEqualTo("locked both");
		assertThat(outcome.grant()).as(outcome.said()).isEqualTo(201);
		assertThat(outcome.grantWasAnsweredWhileTheReferrerWasHeld())
				.as("a renewal asked something of the referrer: " + outcome.said()).isTrue();
		assertThat(bookOf(referrer)).as("the renewal wrote a second reward").isEqualTo("referral 600.00 RSD");
	}

	/**
	 * THE REFERRER IS DELETED AND A MEMBER OF HIS IS RENEWED: no deadlock.
	 *
	 * <p>The real route, {@code DELETE /api/competitors/{number}}, whose {@code delete from competitor} takes the
	 * referrer's row and then, through {@code competitor_referred_by_fk ... ON DELETE SET NULL}, updates the row
	 * of his member. Stopped behind the same hold, with the renewal sent behind it, the deletion goes through once
	 * the renewal has committed and the member stays, no longer anyone's.
	 */
	@Test
	void theDeletionOfTheReferrerAndTheRenewalOfAMemberOfHisBreakNoDeadlock() throws Exception {
		aMemberHoldingTheLastSeasonAndAlreadyRewardedFor();

		Outcome outcome = theRenewalMeetsAWriterOfTheReferrer(this::theReferrerDeleted);

		outcome.assertNoDeadlock();
		assertThat(outcome.otherSaid()).as(outcome.said()).startsWith("DELETE 2");
		assertThat(outcome.grant()).as(outcome.said()).isEqualTo(201);
		assertThat(outcome.grantWasAnsweredWhileTheReferrerWasHeld())
				.as("a renewal asked something of the referrer: " + outcome.said()).isTrue();
		assertThat(db.sql("select count(*) from competitor where id = ?").param(referrer).query(Long.class).single())
				.as("the referrer is gone").isZero();
		assertThat(db.sql("select count(*) from competitor where id = ? and referred_by is null")
				.param(renewing).query(Long.class).single())
				.as("the member stays, brought in by no one").isEqualTo(1L);
	}

	/** What one meeting of a renewal and a writer of the referrer came to. */
	private record Outcome(String otherSaid, int grant, boolean grantWasAnsweredWhileTheReferrerWasHeld,
	                       List<String> thrown) {

		String said() {
			return "the other writer said [" + otherSaid + "], the grant answered " + grant + ", thrown " + thrown;
		}

		void assertNoDeadlock() {
			assertThat(said()).as("the database broke a deadlock").doesNotContain("deadlock");
		}
	}

	/**
	 * A hold on the referrer, the other writer stopped behind it, the renewal sent behind that, the hold let go.
	 * Whether the renewal was answered before the hold went is measured and not assumed: it is polled for, and a
	 * renewal that stands in the referrer's queue is seen as a second request behind the hold.
	 */
	private Outcome theRenewalMeetsAWriterOfTheReferrer(Callable<String> theOtherWriter) throws Exception {
		ExecutorService requests = Executors.newFixedThreadPool(2);
		String otherSaid;
		int grantAnswer;
		boolean answeredWhileHeld;

		try (AHeldTransaction theHold = new AHeldTransaction(pool)) {
			theHold.db().sql("select id from competitor where id = ? for update")
					.param(referrer).query(Long.class).single();

			Future<String> other = requests.submit(theOtherWriter);
			theHold.untilBehind(1, List.of(other));

			Future<Integer> grant = requests.submit(() -> granted(renewing));
			Instant deadline = Instant.now().plusSeconds(15);

			while (!grant.isDone() && theHold.behind() < 2 && Instant.now().isBefore(deadline)) {
				Thread.sleep(20);
			}

			answeredWhileHeld = grant.isDone();
			theHold.commit();

			otherSaid = other.get(60, TimeUnit.SECONDS);
			grantAnswer = grant.get(60, TimeUnit.SECONDS);
		} finally {
			requests.shutdownNow();
		}

		return new Outcome(otherSaid, grantAnswer, answeredWhileHeld, List.copyOf(thrown));
	}

	/**
	 * Holds 2027 free of the fee, as of January, and the referrer has been rewarded for him: what a renewal in
	 * the window of October 2027 meets.
	 */
	private void aMemberHoldingTheLastSeasonAndAlreadyRewardedFor() {
		renewing = member("000962", "0011aabbccddee64", true, referrer);

		db.sql("insert into membership (competitor_id, season, basis, decided_by, decided_by_name, decided_at)"
						+ " values (?, 2027, 'feeExempt', ?, 'Drzan Blagajnik', timestamptz '2027-01-10 10:00:00+00')")
				.params(renewing, cashier).update();
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, referred_competitor_id,"
						+ " occurred_at, recorded_by, recorded_by_name) values (?, 600, 'RSD', 'referral', ?,"
						+ " timestamptz '2027-01-10 10:00:00+00', ?, 'Drzan Blagajnik')")
				.params(referrer, renewing, cashier).update();
	}

	/** The exact statement of {@code ResultsByTheLeagueApi#judged}, in a transaction of its own. */
	private String aResultsSaveOverTheReferrerAndTheMember() throws Exception {
		try (AHeldTransaction save = new AHeldTransaction(pool)) {
			try {
				save.db().sql("select id from competitor where id in (:ids) order by id for update")
						.param("ids", List.of(referrer, renewing)).query(Long.class).list();
				save.commit();

				return "locked both";
			} catch (Exception failure) {
				return failure.toString();
			}
		}
	}

	private String theReferrerDeleted() {
		return "DELETE " + answered(delete("/api/competitors/" + THE_REFERRERS_NUMBER)
				.param("account", CompetitorWriteApi.DELETE_THE_ACCOUNT)
				.with(csrf())
				.cookie(new Cookie(SessionCookie.NAME, cookie)));
	}

	private long member(String number, String referralCode, boolean active, Long referredBy) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, referral_code, referred_by, bio,"
						+ " profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at) values (?, 'Probni', 'Preporucen', 'M', date '1990-05-15',"
						+ " " + A_TOWN_IN_SERBIA + ", 2027, false, ?, ?, ?, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, active, referralCode, referredBy)
				.query(Long.class).single();
	}

	/** The administration frees a member of the fee: {@link GrantingASeason}. */
	private int granted(long member) {
		return answered(post("/api/memberships").with(csrf())
				.cookie(new Cookie(SessionCookie.NAME, cookie))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"competitorId\":" + member + ",\"ground\":\"feeExempt\"}"));
	}

	/** A moderator recognises the money a Serbian member sent: {@link BookingAPayment}. */
	private int paid(long member) {
		return answered(post("/api/payments").with(csrf())
				.cookie(new Cookie(SessionCookie.NAME, cookie))
				.contentType(MediaType.APPLICATION_JSON)
				.content(new ObjectMapper().writeValueAsString(
						new PaymentApi.Confirm(member, new BigDecimal("4200.00"), false, "ips", null))));
	}

	private int answered(MockHttpServletRequestBuilder request) {
		try {
			return http.perform(request).andReturn().getResponse().getStatus();
		} catch (Exception failure) {
			StringBuilder chain = new StringBuilder();

			for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
				chain.append(cause).append(" | ");
			}

			thrown.add(chain.toString());

			return 500;
		}
	}

	/** The book of one member as one string, in the order it was written. */
	private String bookOf(long member) {
		return db.sql("select coalesce(string_agg(reason || ' ' || amount || ' ' || currency, ', '"
						+ " order by id), 'no lines') from balance_entry where competitor_id = ?")
				.param(member).query(String.class).single();
	}
}

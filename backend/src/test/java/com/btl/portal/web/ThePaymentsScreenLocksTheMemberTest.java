package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.ServletException;
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
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE PAYMENTS SCREEN TAKES THE MEMBER'S ROW BEFORE IT READS HIS MONEY, AS THE MEMBER'S OWN ROW AND
 * {@code PUT /api/me} DO, SO THE THREE OF THEM TAKE TURNS.
 *
 * <p><b>Two facts that lived in two places with nothing between them</b> (security review of PR 568,
 * 18.10.2026, recorded as reasoning and measured here): which MONEY a member is billed in and what his
 * book holds. {@link MeWriteApi} restates the book when he changes country (PDL 26); {@link
 * PaymentApi} reads the money first and the book afterwards and, with no lock on his row, could read
 * the book the restatement had already emptied or spend out of a book the restatement had already
 * read. {@link MemberPaymentApi} takes {@code select ... for update} on the row first; this screen
 * did not, so a press on the row and a press on the screen for one member and one season were not
 * ordered either.
 *
 * <p><b>NOT {@code @Transactional}, and the order is taken from the lock manager and not from the
 * scheduler</b>: the case holds a lock itself, submits the FIRST request, waits until the lock manager
 * shows it stopped, and only then submits the SECOND. The rows are real commits and {@link
 * #andNothingOfItIsLeftBehind} takes them back out.
 *
 * <p><b>THE ROW CASES HOLD THE MEMBER'S ROW {@code FOR UPDATE}</b> and queue the two presses behind
 * it in the named order; either order ends in one payment and one harmless repeat.
 *
 * <p><b>THE BALANCE CASE DOES NOT HOLD HIS ROW AND THAT IS MEASURED, NOT CHOSEN.</b> A first draft
 * held the row {@code FOR NO KEY UPDATE} and queued his change of country and the booking behind it,
 * expecting the one queued first to be let through first. Postgres does not promise that: over six runs
 * of the unguarded screen the failing book came out in some and a clean one in others. What is
 * deterministic is a stop that does not involve his row at all. The member was brought in by somebody,
 * so a booking ends by writing the referrer's reward ({@link BalanceBook#aReferralWasActivated}), and
 * that {@code insert} waits for any other transaction holding the same {@code referred_competitor_id}.
 * The case holds exactly that, so the unguarded screen has spent his five euro and sits uncommitted
 * one statement before its end, while his change of country, which needs nothing the case holds, runs
 * to its commit and reads a book from which the spend is invisible. Only then is the hold let go. The
 * guarded screen is stopped at its FIRST statement instead, because its {@code for update} meets the
 * {@code for key share} that the held {@code insert} took on his row, and takes his money as the
 * change of country left it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ThePaymentsScreenLocksTheMemberTest {

	private static final Instant AFTER_THE_FIFTEENTH = Instant.parse("2027-10-20T09:00:00Z");

	/** Distinct from every other fixture's, on purpose: these rows are committed. */
	private static final String MODERATOR = "uplate-zakljucavanje-moderator@primer.rs";

	private static final String HIS_ACCOUNT = "uplate-zakljucavanje-clan@primer.rs";

	private static final String THE_NUMBER = "000991";

	private static final String HE_BROUGHT_IN_THE_NUMBER = "000992";

	private static final String THE_REFERRER_NUMBER = "000993";

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockAfterTheFifteenth() {
			return Clock.fixed(AFTER_THE_FIFTEENTH, ZoneOffset.UTC);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holdingTheRow;

	private String moderatorCookie;

	private String memberCookie;

	private long moderator;

	private long himself;

	private long hisAccount;

	private long heBroughtIn;

	private long referrer;

	@BeforeEach
	void aModeratorAndAMemberRenewingWithFiveEuroOnHisBook() {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Mira', 'Zakljucana', ?, (select id from role where code = 'moderator'))")
				.param(MODERATOR).update();

		moderator = db.sql("select id from account where email = ?").param(MODERATOR)
				.query(Long.class).single();

		for (String right : List.of("entity:members", "queue:payments")) {
			db.sql("insert into account_admin_right (account_id, right_code) values (?, ?)")
					.params(moderator, right).update();
		}

		moderatorCookie = openedSession(moderator);

		himself = aMember(THE_NUMBER, "0011aabbccdd9e91", "Probni", true);
		heBroughtIn = aMember(HE_BROUGHT_IN_THE_NUMBER, "0011aabbccdd9e92", "Doveden", false);
		referrer = aMember(THE_REFERRER_NUMBER, "0011aabbccdd9e93", "Zavodnik", true);

		db.sql("update competitor set referred_by = ? where id = ?").params(referrer, himself).update();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Zakljucan', ?, (select id from role where code = 'competitor'), ?)")
				.params(HIS_ACCOUNT, himself).update();

		hisAccount = db.sql("select id from account where email = ?").param(HIS_ACCOUNT)
				.query(Long.class).single();

		memberCookie = openedSession(hisAccount);

		/* FIVE EURO, because the place of rank one is abroad (the money he is billed in is the euro) and
		   a referral is the one reason a book can be opened with that does not need a payment. */
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
						+ " referred_competitor_id, occurred_at, recorded_by_name) values"
						+ " (?, 5, 'EUR', 'referral', ?, timestamptz '2027-10-02 09:00:00+00', 'Neko Ko Je Knjizio')")
				.params(himself, heBroughtIn).update();
	}

	private long aMember(String number, String code, String first, boolean active) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, referral_code, bio,"
						+ " profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at) values (?, ?, 'Zakljucan', 'M', date '1990-05-15',"
						+ " (select id from place where rank = 1), 2027, false, ?, ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, first, active, code).query(Long.class).single();
	}

	private String openedSession(long account) {
		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values (?, ?, ?, ?, ?)")
				.params(account, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}

	/** Real commits, so a real delete, children before parents. */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		for (long member : new long[] { himself, heBroughtIn, referrer }) {
			db.sql("delete from message where to_id = ?").param(member).update();
			db.sql("delete from membership where competitor_id = ?").param(member).update();
			db.sql("delete from payment where competitor_id = ?").param(member).update();
			db.sql("delete from balance_entry where competitor_id = ?").param(member).update();
			db.sql("delete from balance_promise where competitor_id = ?").param(member).update();
		}

		db.sql("delete from account_session where account_id in (?, ?)").params(moderator, hisAccount).update();
		db.sql("delete from account_admin_right where account_id = ?").param(moderator).update();
		db.sql("delete from account where id in (?, ?)").params(moderator, hisAccount).update();
		db.sql("delete from competitor where id in (?, ?, ?)").params(himself, heBroughtIn, referrer).update();
	}

	/**
	 * HIS CHANGE OF COUNTRY RUNS TO ITS COMMIT WHILE THE SCREEN'S BOOKING STANDS ONE STATEMENT FROM ITS
	 * END, and the book must still come out right.
	 *
	 * <p>This is the interleaving that left the euro book below nought: the unguarded screen has spent
	 * his five euro and not committed, the change of country reads five euro, moves it to six hundred
	 * dinars and commits, and the screen then commits its spend. The euro side sums to minus what the
	 * screen spent and the dinar side holds all of it. With the screen's lock the screen is stopped
	 * before it reads anything, the change of country runs first, and the screen then finds him billed
	 * in dinars and spends out of the six hundred it finds there.
	 */
	@Test
	void aChangeOfCountryThatCommitsInTheMiddleOfABookingLeavesNoCurrencyOfHisBookBelowNought()
			throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();
		MockHttpServletResponse changed;

		try {
			changed = holdingTheRow.execute(held -> {
				/* THE REFERRER'S REWARD FOR HIM, written and not committed: the booking's last write is
				   the same row, so it waits for this transaction (on conflict do nothing waits for the
				   holder of a conflicting key). Nothing here touches his own row except the key share that
				   the foreign key takes, which stops a `for update` on it and nothing else. */
				db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
								+ " referred_competitor_id, occurred_at, recorded_by_name) values"
								+ " (?, 5, 'EUR', 'referral', ?, timestamptz '2027-10-02 09:00:00+00',"
								+ " 'Neko Ko Je Knjizio')")
						.params(referrer, himself).update();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the reward is written and nothing has been submitted yet")
						.isZero();

				try {
					submitted.add(pool.submit(this::theScreenBooksHimWithHisBalance));
					untilThisManyAreStopped(1, submitted);

					Future<MockHttpServletResponse> hisChange = pool.submit(this::movesToSerbia);
					MockHttpServletResponse answered = hisChange.get(30, TimeUnit.SECONDS);

					assertThat(submitted.get(0).isDone())
							.as("the booking was answered although the reward it waits for is not settled")
							.isFalse();

					held.setRollbackOnly();
					return answered;
				} catch (Exception e) {
					throw new IllegalStateException(e);
				}
			});

			MockHttpServletResponse booked = submitted.get(0).get(30, TimeUnit.SECONDS);

			assertThat(changed.getStatus()).as("his change of country").isEqualTo(200);
			assertThat(booked.getStatus()).as("the screen's booking").isEqualTo(201);

			assertNoCurrencyOfHisBookIsBelowNought();
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * THE ROW BOOKS FIRST AND THE SCREEN SECOND FOR ONE MEMBER AND ONE SEASON: the screen is the
	 * harmless repeat and not a 500.
	 *
	 * <p>Without the screen's lock the screen read that no payment stood, was stopped by the hold at its
	 * first {@code insert}, and after the row's booking committed lost to {@code payment_one_a_season}
	 * with a 500 ({@link PaymentApi}'s heading used to name it). With it the screen waits, reads the
	 * row's payment, and answers what {@code RecordingAPayment} answers to a repeat: 200 and nothing
	 * written.
	 */
	@Test
	void aPressOnTheRowAndThenOneOnTheScreenForOneSeasonBookOnePaymentAndTheSecondIsTheRepeat()
			throws Exception {

		List<MockHttpServletResponse> both = inThisOrder("for update",
				this::theRowBooksHim, this::theScreenBooksHimWithHisBalance);

		assertThat(both.get(0).getStatus()).as("the press on his row").isEqualTo(201);
		assertThat(both.get(1).getStatus()).as("the press on the screen, a repeat of the first")
				.isEqualTo(200);

		assertThat(db.sql("select count(*) from payment where competitor_id = ? and season = 2028")
				.param(himself).query(Long.class).single()).isOne();
		assertThat(db.sql("select count(*) from message where to_id = ?")
				.param(himself).query(Long.class).single())
				.as("the member was told twice about one payment")
				.isOne();
	}

	/**
	 * THE SAME PRESS ON THE SCREEN WITH THE BOX CLEARED, because the lock is about the member's row and
	 * not about whether his balance pays: a lock taken only for a press that spends the balance would
	 * leave this one a 500.
	 */
	@Test
	void aPressOnTheRowAndThenOneOnTheScreenWithTheBoxClearedIsTheRepeatToo() throws Exception {
		List<MockHttpServletResponse> both = inThisOrder("for update",
				this::theRowBooksHim, () -> theScreenBooksHim(false));

		assertThat(both.get(0).getStatus()).as("the press on his row").isEqualTo(201);
		assertThat(both.get(1).getStatus()).as("the press on the screen, a repeat of the first")
				.isEqualTo(200);

		assertThat(db.sql("select count(*) from payment where competitor_id = ? and season = 2028")
				.param(himself).query(Long.class).single()).isOne();
	}

	/** The other order: the screen books and the row is the repeat, which is the row door's own lock. */
	@Test
	void aPressOnTheScreenAndThenOneOnTheRowForOneSeasonBookOnePaymentAndTheRowIsTheRepeat()
			throws Exception {

		List<MockHttpServletResponse> both = inThisOrder("for update",
				this::theScreenBooksHimWithHisBalance, this::theRowBooksHim);

		assertThat(both.get(0).getStatus()).as("the press on the screen").isEqualTo(201);
		assertThat(both.get(1).getStatus()).as("the press on his row, a repeat of the first")
				.isEqualTo(200);

		assertThat(db.sql("select count(*) from payment where competitor_id = ? and season = 2028")
				.param(himself).query(Long.class).single()).isOne();
		assertThat(db.sql("select count(*) from message where to_id = ?")
				.param(himself).query(Long.class).single())
				.as("a repeat on the row told him about a payment it did not write")
				.isZero();
	}

	/**
	 * THE BOOK, ONE LINE PER CURRENCY: a sum across two of them is not a number, and a book with a
	 * currency below nought is the one {@code BalanceBook} cannot read back.
	 */
	private void assertNoCurrencyOfHisBookIsBelowNought() {
		List<String> lines = db.sql("select reason || ' ' || amount || ' ' || currency"
						+ " from balance_entry where competitor_id = ? order by id")
				.param(himself).query(String.class).list();

		for (String currency : List.of("EUR", "RSD")) {
			BigDecimal sum = db.sql("select coalesce(sum(amount), 0) from balance_entry"
							+ " where competitor_id = ? and currency = ?")
					.params(himself, currency).query(BigDecimal.class).single();

			assertThat(sum.signum())
					.as("his " + currency + " book is below nought, so the two doors did not take turns."
							+ " The lines: " + lines)
					.isGreaterThanOrEqualTo(0);
		}

		assertThat(db.sql("select coalesce(sum(amount), 0) from balance_entry"
						+ " where competitor_id = ? and currency = 'EUR'")
				.param(himself).query(BigDecimal.class).single().signum())
				.as("the euro side is restated to exactly nought when he leaves it. The lines: " + lines)
				.isZero();
	}

	/**
	 * THE HOLD, THEN THE FIRST REQUEST, THEN THE SECOND, each submitted only when the lock manager shows
	 * the one before it stopped behind this connection. {@code MemberPaymentTwiceAtOneInstantTest}'s
	 * shape, with the wait for ONE request that file has no need of.
	 *
	 * @param lock {@code for update} or {@code for no key update}, and the class heading says which case
	 *             wants which
	 */
	private List<MockHttpServletResponse> inThisOrder(String lock,
			Callable<MockHttpServletResponse> first, Callable<MockHttpServletResponse> second)
			throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from competitor where id = ? " + lock)
						.param(himself).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet")
						.isZero();

				try {
					submitted.add(pool.submit(first));
					untilThisManyAreStopped(1, submitted);

					submitted.add(pool.submit(second));
					untilThisManyAreStopped(2, submitted);
				} catch (InterruptedException e) {
					throw new IllegalStateException(e);
				}

				assertThat(submitted)
						.as("a request was answered before it reached the database")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			return List.of(submitted.get(0).get(30, TimeUnit.SECONDS),
					submitted.get(1).get(30, TimeUnit.SECONDS));
		} finally {
			pool.shutdownNow();
		}
	}

	private void untilThisManyAreStopped(int expected, List<Future<MockHttpServletResponse>> submitted)
			throws InterruptedException {

		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < expected) {
			if (Instant.now().isAfter(deadline)) {
				throw new IllegalStateException(expected + " request(s) should have been stopped behind"
						+ " the held row within ten seconds. Futures: "
						+ submitted.stream().map(ThePaymentsScreenLocksTheMemberTest::whatBecameOf).toList());
			}

			Thread.sleep(20);
		}
	}

	/** What a request that was not stopped answered, because „done” alone does not say which way. */
	private static String whatBecameOf(Future<MockHttpServletResponse> request) {
		if (!request.isDone()) {
			return "still running";
		}

		try {
			MockHttpServletResponse answered = request.get();
			return answered.getStatus() + " " + answered.getContentAsString();
		} catch (Exception e) {
			return "failed: " + e;
		}
	}

	private MockHttpServletResponse movesToSerbia() throws Exception {
		long aTownInSerbia = db.sql("select geonames_id from place where country_id ="
						+ " (select id from country where code = 'RS') order by rank limit 1")
				.query(Long.class).single();

		return http.perform(put("/api/me").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, memberCookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"placeId\": " + aTownInSerbia + "}"))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse theScreenBooksHimWithHisBalance() throws Exception {
		return theScreenBooksHim(true);
	}

	private MockHttpServletResponse theScreenBooksHim(boolean withTheBalance) throws Exception {
		return answered(post("/api/payments").with(csrf())
				.cookie(new Cookie(SessionCookie.NAME, moderatorCookie))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"competitorId\": " + himself + ", \"received\": 1,"
						+ " \"useTheBalance\": " + withTheBalance + ", \"method\": \"paypal\"}"));
	}

	private MockHttpServletResponse theRowBooksHim() throws Exception {
		return answered(post("/api/members/" + THE_NUMBER + "/payment").with(csrf())
				.cookie(new Cookie(SessionCookie.NAME, moderatorCookie))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"received\": 1, \"method\": \"paypal\"}"));
	}

	/**
	 * WHAT THE REQUEST ANSWERED, A FAULT INCLUDED. MockMvc rethrows what no handler turned into an
	 * answer, where the server answers 500, so a booking that lost to the database would otherwise end
	 * the case with an exception instead of with the status the case asserts on.
	 */
	private MockHttpServletResponse answered(MockHttpServletRequestBuilder request) throws Exception {
		try {
			return http.perform(request).andReturn().getResponse();
		} catch (ServletException fault) {
			MockHttpServletResponse failed = new MockHttpServletResponse();
			failed.setStatus(500);
			failed.getWriter().write(String.valueOf(fault.getMostSpecificCause()));

			return failed;
		}
	}
}

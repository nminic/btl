package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
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
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

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
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A MODERATOR WHO PRESSES „ODOBRI" TWICE ACTIVATES ONE MEMBERSHIP AND SPENDS ONE MEMBER NUMBER.
 *
 * <p><b>Why the second press is answered at all rather than refused.</b> The route already answers a
 * repeat with 200 and writes nothing ({@code GrantingAMembership.Outcome.ALREADY_GRANTED_ON_THIS_GROUND}),
 * and says why in so many words: „a moderator working a list somebody reads to him clicks the same row
 * twice, and a second write would draw a second member number". That held for a second press that
 * arrived AFTER the first had committed. Two presses that arrived together both read that no row stood,
 * both drew a number, and the second lost to {@code membership_pk}: a 500 for a press the route was
 * written to be harmless for, and a number spent for good - {@code member_number_seq} is a sequence, so
 * a value drawn inside a transaction that goes back is never handed out again. PDL, „Clanski broj se
 * nikad ne dodeljuje dvaput" (31.07.2026).
 *
 * <p><b>NOT {@code @Transactional}, and the order is taken away from the scheduler</b>, both for the
 * reasons {@code VerificationDecisionConcurrencyTest} gives: the case holds the member's row {@code FOR
 * UPDATE} before either press is sent, waits until both are stopped inside the database, and only then
 * lets go. Rows are real commits and {@link #andNothingOfItIsLeftBehind} takes them back out.
 *
 * <p><b>THE THREE STATES ARE THE THREE WAYS THE SAME PRESS ARRIVES</b>, and each is its own row of the
 * parameter rather than an assumption that one stands for the others: the ground that spends nothing
 * and the ground that spends his book, each for a man who has never had a number; and a man who
 * already has one, for whom nothing is drawn at all and what the race costs is only the 500.
 *
 * <p><b>The clock is fixed in June 2027</b>, so the season sold is 2027 whatever day the suite runs on,
 * and this file builds its own context for it rather than borrowing a neighbour's.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class FreeingTwiceAtOneInstantTest {

	private static final Instant IN_JUNE_2027 = Instant.parse("2027-06-15T09:00:00Z");

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockInJune2027() {
			return Clock.fixed(IN_JUNE_2027, ZoneOffset.UTC);
		}
	}

	/** Distinct from every other fixture's moderator, on purpose: these rows are committed. */
	private static final String CASHIER = "dva-klika-odobri@primer.rs";

	/** {@code rank = 1} is a town abroad, so his book and his fee are in euro. */
	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** The number the third state already carries, distinct from every other fixture's. */
	private static final String THE_NUMBER_HE_HAS = "000942";

	/** How the same press arrives. */
	enum Press {

		/** „Odobri oslobodjenje od clanarine" for a man who has never had a number. */
		FREE_OF_THE_FEE_AND_NEVER_NUMBERED("feeExempt", false),

		/** „Odobri iz balansa" for the same man, whose book covers the fee. */
		FROM_HIS_BALANCE_AND_NEVER_NUMBERED("balance", false),

		/** The exemption again, for a man who has been a member and keeps his number. */
		FREE_OF_THE_FEE_AND_ALREADY_NUMBERED("feeExempt", true);

		final String ground;

		final boolean alreadyNumbered;

		Press(String ground, boolean alreadyNumbered) {
			this.ground = ground;
			this.alreadyNumbered = alreadyNumbered;
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private TransactionTemplate holdingTheRow;

	private String cookie;

	private long cashier;

	private final List<Long> competitors = new ArrayList<>();

	@BeforeEach
	void aCashierWhoMayActivate() {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Blagajnik', 'Dvoklikovic', ?, (select id from role where code = 'moderator'))")
				.param(CASHIER).update();

		cashier = db.sql("select id from account where email = ?").param(CASHIER)
				.query(Long.class).single();

		db.sql("insert into account_admin_right (account_id, right_code) values (?, 'queue:payments')")
				.param(cashier).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values (?, ?, ?, ?, ?)")
				.params(cashier, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();
	}

	/**
	 * Real commits, so a real delete, children before parents, and the constraint the last case adds
	 * goes whether or not that case got as far as its own {@code finally}.
	 */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("alter table membership drop constraint if exists b203_the_database_refuses_this_booking")
				.update();

		for (long one : competitors) {
			db.sql("delete from membership where competitor_id = ?").param(one).update();
			db.sql("delete from balance_entry where competitor_id = ? or referred_competitor_id = ?")
					.params(one, one).update();
		}
		for (long one : competitors.reversed()) {
			db.sql("delete from competitor where id = ?").param(one).update();
		}

		db.sql("delete from account_session where account_id = ?").param(cashier).update();
		db.sql("delete from account_admin_right where account_id = ?").param(cashier).update();
		db.sql("delete from account where id = ?").param(cashier).update();
	}

	private long competitor(String memberNumber, String referralCode) {
		long id = db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni',"
						+ " 'Dvoklikovic', 'M', date '1990-05-15', " + A_TOWN + ", null, null, 2027,"
						+ " false, false, 'payment', ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(memberNumber, referralCode)
				.query(Long.class).single();

		competitors.add(id);

		return id;
	}

	/**
	 * THE BOOK THE BALANCE GROUND SPENDS, written as the one reason a balance can come to exist: a
	 * referral, which names the man it was earned for. Fifty euro covers any row of the price list
	 * this member can be sold.
	 */
	private void aBookThatCoversTheFee(long him) {
		long broughtIn = competitor(null, "b2032000000000b9");

		db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
						+ " referred_competitor_id, occurred_at, recorded_by_name)"
						+ " values (?, 50.00, 'EUR', 'referral', ?, ?, 'Neko Ko Je Knjizio')")
				.params(him, broughtIn, Timestamp.from(IN_JUNE_2027)).update();
	}

	/**
	 * THE NEXT NUMBER THE SEQUENCE WOULD HAND OUT, asked by taking one.
	 *
	 * <p>Taking one rather than reading {@code last_value}, because a sequence nobody has called yet
	 * answers its start value with {@code is_called} false, and a reading that has to know which of
	 * the two it is looking at is a second question. After this call the next draw is exactly one
	 * higher, so the number of draws a press made is the difference and nothing else.
	 */
	private long aNumberTakenNow() {
		return db.sql("select nextval('member_number_seq')").query(Long.class).single();
	}

	private long theLastNumberTaken() {
		return db.sql("select last_value from member_number_seq").query(Long.class).single();
	}

	@ParameterizedTest
	@EnumSource(Press.class)
	void twoPressesAtOnceActivateOnceAndDrawAtMostOneNumber(Press press) throws Exception {
		long him = competitor(press.alreadyNumbered ? THE_NUMBER_HE_HAS : null, "b2032000000000a" + press.ordinal());

		if (press.ground.equals("balance")) {
			aBookThatCoversTheFee(him);
		}

		long before = aNumberTakenNow();

		List<MockHttpServletResponse> both = atOnceBehindTheHeldRow(him,
				() -> pressed(him, press.ground), () -> pressed(him, press.ground));

		assertThat(both.stream().map(MockHttpServletResponse::getStatus).sorted().toList())
				.as("the second press was answered with a fault, or both were told they activated him")
				.containsExactly(200, 201);

		String standing = db.sql("select member_number from competitor where id = ?").param(him)
				.query(String.class).single();

		List<String> answered = new ArrayList<>();

		for (MockHttpServletResponse one : both) {
			answered.add(mapper.readTree(one.getContentAsString()).path("memberNumber").asString());
		}

		assertThat(answered)
				.as("the press that was answered 200 did not name the number the other press gave him")
				.containsExactly(standing, standing);

		assertThat(theLastNumberTaken() - before)
				.as("the sequence moved by more than the one activation that happened, so a number was"
						+ " drawn and thrown away")
				.isEqualTo(press.alreadyNumbered ? 0L : 1L);

		if (!press.alreadyNumbered) {
			assertThat(standing)
					.as("the number he holds is not the one the sequence handed out for this press")
					.isEqualTo(String.format("%06d", before + 1));
		}

		assertThat(db.sql("select count(*) from membership where competitor_id = ? and season = 2027")
				.param(him).query(Long.class).single()).isOne();

		assertThat(db.sql("select count(*) from balance_entry where competitor_id = ?"
						+ " and reason = 'membership'").param(him).query(Long.class).single())
				.as("his book was charged for the press that changed nothing")
				.isEqualTo(press.ground.equals("balance") ? 1L : 0L);
	}

	/**
	 * AND A BOOKING THE DATABASE REFUSES SPENDS NO NUMBER, WHICH IS WHERE THE DRAW STANDS AND NOT A
	 * PROPERTY OF THE LOCK.
	 *
	 * <p>The lock above is what keeps two presses from meeting {@code membership_pk}, and with it in
	 * place no refusal the portal can reach today comes after the decision on this route - which is
	 * exactly why the position of the draw cannot be measured by the race. So the refusal is put there
	 * by hand: a constraint this case adds to {@code membership} and takes away again, which refuses
	 * the one row this press would write. It stands in for any refusal the schema makes later, the way
	 * {@code V35} once did on QA, and asks the one thing the draw's position decides: whether the
	 * sequence moved for a booking that did not happen. {@code PaymentApi} measured its own move with
	 * a refusal of the same kind, a free price row meeting {@code payment_amount_positive}.
	 */
	@Test
	void aBookingTheDatabaseRefusesDrawsNoNumber() {
		long him = competitor(null, "b2032000000000c1");

		db.sql("alter table membership add constraint b203_the_database_refuses_this_booking"
				+ " check (competitor_id <> " + him + ") not valid").update();

		long before = aNumberTakenNow();

		Throwable refused = catchThrowable(() -> pressed(him, "feeExempt"));

		assertThat(refused)
				.as("the booking went through, so nothing below is about a booking the database"
						+ " refused")
				.isNotNull()
				.hasStackTraceContaining("b203_the_database_refuses_this_booking");

		assertThat(theLastNumberTaken())
				.as("a booking the database refused still spent a member number, so the draw stands"
						+ " ahead of the writes it depends on")
				.isEqualTo(before);

		assertThat(db.sql("select member_number from competitor where id = ?").param(him)
				.query(String.class).optional())
				.isEmpty();
	}

	/**
	 * BOTH PRESSES STOPPED INSIDE THE DATABASE BEFORE EITHER COULD COMMIT, AND ONLY THEN RELEASED.
	 *
	 * <p>{@code VerificationDecisionConcurrencyTest}'s shape: the two are counted WHILE the lock is
	 * held, neither may have been answered by then, and the futures are read only once it is let go.
	 */
	private List<MockHttpServletResponse> atOnceBehindTheHeldRow(long him,
			Callable<MockHttpServletResponse> one, Callable<MockHttpServletResponse> other)
			throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from competitor where id = ? for update")
						.param(him).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet, so a count that is"
								+ " not nought is counting something other than the two presses")
						.isZero();

				submitted.add(pool.submit(one));
				submitted.add(pool.submit(other));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new IllegalStateException(e);
				}

				assertThat(submitted)
						.as("a press was answered before it reached the database, so the two did not"
								+ " meet where this case is written to make them meet")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			return List.of(submitted.get(0).get(30, TimeUnit.SECONDS),
					submitted.get(1).get(30, TimeUnit.SECONDS));
		} finally {
			pool.shutdownNow();
		}
	}

	private MockHttpServletResponse pressed(long him, String ground) throws Exception {
		return http.perform(post("/api/memberships").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(mapper.writeValueAsString(new MembershipWriteApi.Grant(him, ground))))
				.andReturn().getResponse();
	}
}

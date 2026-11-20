package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;

/**
 * {@code DELETE /api/me} ASKS WHETHER HE MAY GO UNDER ITS HOLDS AND NOT BEFORE THEM, which one thread
 * cannot show (see {@link MeLeavingApi}).
 *
 * <p>Committed rows and a second transaction, so not {@code @Transactional}: what is measured is what
 * the route sees of somebody else's commit. Everything the fixture writes is taken away after each case.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ALeavingAsSomethingIsWrittenForHimTest {

	private static final String EMAIL = "odlazak-istovremeno@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holding;

	private long him;

	private SecretToken hisSession;

	private SecretToken hisOtherTab;

	@BeforeEach
	void aMemberWhoNeverBecameOneWithTwoTabsOpen() {
		him = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at) values (null, 'Probni',"
						+ " 'Istovremeni', 'M', date '1990-01-01', (select id from place where rank = 1), 2027,"
						+ " '0d1a00000000e5c1', '', false, 'none', 'Otac', 'Ulica 1', 'M', now()) returning id")
				.query(Long.class).single();
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, password_hash,"
						+ " email_confirmed_at, created_at) values ('Probni', 'Istovremeni', ?,"
						+ " (select id from role where code = 'competitor'), ?, '{bcrypt}$2a$10$abcdefghijklmnopqrstuv',"
						+ " now(), now())")
				.params(EMAIL, him).update();

		hisSession = session();
		hisOtherTab = session();
	}

	private SecretToken session() {
		SecretToken token = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash) values"
						+ " ((select id from account where email = ?), ?)")
				.params(EMAIL, token.hash()).update();

		return token;
	}

	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from payment where competitor_id = ?").param(him).update();
		db.sql("delete from account where email = ?").param(EMAIL).update();
		db.sql("delete from competitor where id = ?").param(him).update();
	}

	private MockHttpServletResponse leaving(SecretToken session) throws Exception {
		return http.perform(delete("/api/me").with(csrf()).cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse();
	}

	private boolean stands() {
		return db.sql("select count(*) from competitor where id = ?").param(him).query(Long.class).single() == 1;
	}

	@Test
	void aPaymentWrittenWhileHePressesKeepsHim() throws Exception {
		ExecutorService pool = Executors.newSingleThreadExecutor();
		List<Future<MockHttpServletResponse>> pressed = new ArrayList<>();

		try {
			holding.execute(heldOpen -> {
				db.sql("select id from competitor where id = ? for update").param(him).query(Long.class).single();
				db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
								+ " fee, method, state) values (?, 2028, null,"
								+ " (select id from price_row order by sort_order limit 1), 35.00, 'EUR', 3.00,"
								+ " 'paypal', 'awaited')")
						.param(him).update();

				pressed.add(pool.submit(() -> leaving(hisSession)));

				untilBehind(1, pressed);

				return null;
			});

			MockHttpServletResponse answer = pressed.get(0).get(30, TimeUnit.SECONDS);

			assertThat(answer.getStatus())
					.as("the payment booked while he pressed was not seen, so whether he may go was asked"
							+ " before the hold on his row")
					.isEqualTo(404);
			assertThat(stands()).as("he was deleted with a payment beside him").isTrue();
		} finally {
			pool.shutdownNow();
		}
	}

	@Test
	void twoTabsPressingAtOnceDeleteHimOnceAndTheSecondIsTold404() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> pressed = new ArrayList<>();

		try {
			holding.execute(heldOpen -> {
				db.sql("select id from account where email = ? for update").param(EMAIL).query(Long.class).single();

				pressed.add(pool.submit(() -> leaving(hisSession)));
				pressed.add(pool.submit(() -> leaving(hisOtherTab)));

				untilBehind(2, pressed);

				return null;
			});

			List<Integer> answered = new ArrayList<>();

			for (Future<MockHttpServletResponse> one : pressed) {
				answered.add(one.get(30, TimeUnit.SECONDS).getStatus());
			}

			assertThat(answered).as("two presses at one moment").containsExactlyInAnyOrder(204, 404);
			assertThat(stands()).isFalse();
		} finally {
			pool.shutdownNow();
		}
	}

	private void untilBehind(int expected, List<Future<MockHttpServletResponse>> pressed) {
		try {
			long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);

			while (BlockedBehindThisHold.count(db) < expected && System.nanoTime() < deadline
					&& pressed.stream().noneMatch(Future::isDone)) {
				Thread.sleep(20);
			}
		}
		catch (InterruptedException stopped) {
			Thread.currentThread().interrupt();
		}

		assertThat(BlockedBehindThisHold.count(db))
				.as("the presses stopped behind the hold this transaction keeps (done: "
						+ pressed.stream().map(Future::isDone).toList() + ")")
				.isGreaterThanOrEqualTo(expected);
	}
}

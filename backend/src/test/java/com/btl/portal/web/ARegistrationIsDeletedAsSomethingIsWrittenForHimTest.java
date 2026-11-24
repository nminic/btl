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
 * {@code DELETE /api/members/unnumbered/{competitorId}} ASKS WHETHER THE REGISTRATION MAY GO UNDER ITS HOLDS AND NOT
 * BEFORE THEM, which one thread cannot show (PENDING, review of PR 811: removing both {@code for update} of
 * {@link ARegistrationIsDeletedApi} passed {@link ARegistrationIsDeletedApiTest}). The precedent is
 * {@link ALeavingAsSomethingIsWrittenForHimTest}, for {@code DELETE /api/me}.
 *
 * <p><b>What the hold is for.</b> A payment written for him in another transaction that has not committed is
 * invisible to the question whether he may go; if the question is asked before the hold, he is deleted, the payment
 * commits against a row that is gone and is left with {@code competitor_id} null
 * ({@code on delete set null}), which is money with nobody. The payment is written the way a real one is, a plain
 * {@code insert}, whose foreign key takes the lock on his row that the route then queues behind.
 *
 * <p>Committed rows and a second transaction, so not {@code @Transactional}: what is measured is what the route
 * sees of somebody else's commit. Everything the fixture writes is taken away after each case.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ARegistrationIsDeletedAsSomethingIsWrittenForHimTest {

	private static final String HIS_ADDRESS = "prijava-istovremeno@primer.rs";

	private static final String THE_ADMINISTRATION = "uprava-prijava-istovremeno@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holding;

	private long him;

	private SecretToken theAdministration;

	@BeforeEach
	void aRegistrationWhoNeverBecameAMemberAndAnAdministrationThatMayDeleteIt() {
		him = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at) values (null, 'Probni',"
						+ " 'Prijavljeni', 'M', date '1990-01-01', (select id from place where rank = 1), 2027,"
						+ " '0d1a00000000e5c2', '', false, 'none', 'Otac', 'Ulica 1', 'M', now()) returning id")
				.query(Long.class).single();
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, password_hash,"
						+ " created_at) values ('Probni', 'Prijavljeni', ?,"
						+ " (select id from role where code = 'competitor'), ?, '{bcrypt}$2a$10$abcdefghijklmnopqrstuv',"
						+ " now())")
				.params(HIS_ADDRESS, him).update();
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, password_hash,"
						+ " email_confirmed_at, created_at) values ('Uprava', 'Prijava', ?,"
						+ " (select id from role where code = 'moderator'), null,"
						+ " '{bcrypt}$2a$10$abcdefghijklmnopqrstuv', now(), now())")
				.param(THE_ADMINISTRATION).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(THE_ADMINISTRATION, CompetitorApi.OVER_THE_MEMBERS).update();

		theAdministration = SecretToken.fresh();
		db.sql("insert into account_session (account_id, token_hash) values"
						+ " ((select id from account where email = ?), ?)")
				.params(THE_ADMINISTRATION, theAdministration.hash()).update();
	}

	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from payment where competitor_id = ?").param(him).update();
		db.sql("delete from account where email in (?, ?)").params(HIS_ADDRESS, THE_ADMINISTRATION).update();
		db.sql("delete from competitor where id = ?").param(him).update();
	}

	private MockHttpServletResponse deleting() throws Exception {
		return http.perform(delete("/api/members/unnumbered/" + him).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, theAdministration.secret())))
				.andReturn().getResponse();
	}

	private boolean stands() {
		return db.sql("select count(*) from competitor where id = ?").param(him).query(Long.class).single() == 1;
	}

	@Test
	void aPaymentWrittenWhileTheAdministrationPressesKeepsHimAndLeavesNoPaymentWithNobody() throws Exception {
		ExecutorService pool = Executors.newSingleThreadExecutor();
		List<Future<MockHttpServletResponse>> pressed = new ArrayList<>();

		try {
			holding.execute(heldOpen -> {
				db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
								+ " fee, method, state) values (?, 2028, null,"
								+ " (select id from price_row order by sort_order limit 1), 35.00, 'EUR', 3.00,"
								+ " 'paypal', 'awaited')")
						.param(him).update();

				pressed.add(pool.submit(this::deleting));

				untilBehind(1, pressed);

				return null;
			});

			MockHttpServletResponse answer = pressed.get(0).get(30, TimeUnit.SECONDS);

			assertThat(answer.getStatus())
					.as("the payment written while he was pressed was not seen, so whether he may go was asked"
							+ " before the hold on his row")
					.isEqualTo(404);
			assertThat(stands()).as("he was deleted with a payment beside him").isTrue();
			assertThat(db.sql("select count(*) from payment where competitor_id = ?").param(him)
					.query(Long.class).single()).as("the payment lost its owner").isOne();
		} finally {
			pool.shutdownNow();
		}
	}

	@Test
	void twoPressesAtOnceDeleteHimOnceAndTheSecondIsTold404() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> pressed = new ArrayList<>();

		try {
			holding.execute(heldOpen -> {
				db.sql("select id from account where email = ? for update").param(HIS_ADDRESS).query(Long.class)
						.single();

				pressed.add(pool.submit(this::deleting));
				pressed.add(pool.submit(this::deleting));

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

package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.token.SecretToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A SWEEP AND A CONFIRMATION IN THE SAME INSTANT: THE CONFIRMATION WINS, BECAUSE THE SWEEP HOLDS
 * THE ACCOUNT BEFORE IT DECIDES.
 *
 * <p>{@code UnconfirmedAccountsAreSwept.goes} takes the account {@code for update} and only then asks
 * whether the member may go. {@code EmailConfirmationApi.confirm} takes the same account first too
 * (PR 633). This holds the account exactly as a confirmation does, in a transaction of its own on a
 * connection of its own ({@link AHeldTransaction}, the portal's presedan), lets the sweep run into
 * it and stop ({@link BlockedBehindThisHold}), writes the confirmation and commits. A sweep that
 * waited for the hold asks its question of the confirmed row and leaves him; a sweep that took no
 * hold decided off the unconfirmed row and deletes a confirmed member, which is the failure this
 * case exists to name.
 *
 * <p><b>Not {@code @Transactional}</b>, because two transactions have to meet: the rows are
 * committed, and taken away after the case.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ASweepMeetsAConfirmationTest {

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String THE_ADDRESS = "sudar-cistaca-i-potvrde@primer.rs";

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private CompetitorWriteApi members;

	@Autowired
	private DataSource pool;

	private long account;

	@BeforeEach
	void aRegistrationWhoseLinkHasRunOut() {
		long member = db.sql("insert into competitor (first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values ('Probni', 'Sudar', 'M', date '1990-01-01', " + A_TOWN_IN_SERBIA
						+ ", 2027, false, '5ad0c157aa11b0e1', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.query(Long.class).single();

		account = db.sql("insert into account (first_name, last_name, email, role_id, competitor_id,"
						+ " password_hash, created_at) values ('Probni', 'Sudar', ?,"
						+ " (select id from role where code = 'competitor'), ?, '{bcrypt}$2a$10$abcdefghijklmnopqrstuv',"
						+ " now() - interval '8 days') returning id")
				.params(THE_ADDRESS, member).query(Long.class).single();

		db.sql("insert into email_verification_token (account_id, token_hash, expires_at)"
						+ " values (?, ?, now() - interval '1 hour')")
				.params(account, SecretToken.fresh().hash()).update();
	}

	@AfterEach
	void nothingThisCaseWroteOutlivesIt() {
		db.sql("delete from email_verification_token where account_id in"
				+ " (select id from account where email = ?)").param(THE_ADDRESS).update();
		db.sql("delete from account where email = ?").param(THE_ADDRESS).update();
		db.sql("delete from competitor where referral_code = '5ad0c157aa11b0e1'").update();
	}

	@Test
	void aConfirmationTheSweepWaitedForKeepsTheMember() throws Exception {
		UnconfirmedAccountsAreSwept sweep = new UnconfirmedAccountsAreSwept(db,
				Clock.fixed(Instant.now().plus(Duration.ofMinutes(1)), ZoneOffset.UTC), inOneTransaction, members);
		ExecutorService aside = Executors.newSingleThreadExecutor();

		try (AHeldTransaction confirming = new AHeldTransaction(pool)) {
			confirming.db().sql("select id from account where id = ? for update").param(account)
					.query(Long.class).single();

			Future<?> swept = aside.submit(sweep::sweep);

			confirming.untilBehind(1, List.of(swept));
			confirming.db().sql("update account set email_confirmed_at = now() where id = ?")
					.param(account).update();
			confirming.commit();

			swept.get(30, TimeUnit.SECONDS);
		} finally {
			aside.shutdownNow();
		}

		assertThat(db.sql("select count(*) from account where id = ? and email_confirmed_at is not null")
						.param(account).query(Long.class).single())
				.as("a confirmed account was deleted by the sweep")
				.isOne();
	}
}

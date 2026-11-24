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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;

/**
 * THE WRITE OF A SPONSOR'S LOGO TAKES THE TABLE BEFORE THE ROW, AS EVERY OTHER WRITE OF A SPONSOR DOES
 * ({@link SponsorLogoApi}, {@link SponsorWriteApi#lock}; independent review of PR 826, round 2, 24.11.2026, low).
 *
 * <p>The two doors took the two locks in opposite orders, so a change of a sponsor and a logo of the same sponsor at
 * one instant met each other halfway and the database ended one of them with {@code deadlock detected}, which the
 * administration was answered with a 500 (measured by the review in two {@code psql} sessions). A deadlock is the
 * kind of fault no sequential case can reach, and a barrier hits it when the scheduler is kind, so this case does not
 * try to cause one. It asks the thing the cure consists of: with a writer in the middle of its work, holding the
 * table, a logo request waits at the TABLE and has not yet taken the ROW. In the other order it holds the row while
 * it waits for the table, which is the half of a deadlock that is missing the other half.
 *
 * <p>The row is asked after the request is seen, by the lock manager, to be stopped behind this connection, with
 * {@code for update skip locked}: it answers nothing where somebody else holds the row, and the row where nobody does.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ASponsorsLogoTakesTheTableBeforeTheRowTest {

	private static final String THE_SUPERADMIN = "logo-redosled-superadmin@primer.rs";

	private static final String THE_NAME = "Redosled brava";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holdingTheTable;

	private long sponsor;

	private String cookie;

	@BeforeEach
	void aSponsorAndTheSuperadmin() {
		sponsor = db.sql("insert into sponsor (name, url, description_sr, main, position)"
						+ " values (?, 'https://redosled.primer.rs/', 'Opis', false,"
						+ " (select coalesce(max(position) + 1, 0) from sponsor)) returning id")
				.param(THE_NAME).query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at, password_hash)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = 'superadmin'),"
						+ " timestamptz '2026-09-02 10:00:00+00', null)")
				.param(THE_SUPERADMIN).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_SUPERADMIN, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();
	}

	/** Real commits, so a real delete. */
	@AfterEach
	void takeThemBackOut() {
		db.sql("delete from sponsor where id = ?").param(sponsor).update();
		db.sql("delete from account where email = ?").param(THE_SUPERADMIN).update();
	}

	private MockHttpServletResponse theLogoTakenDown() throws Exception {
		return http.perform(delete("/api/sponsors/" + sponsor + "/logo").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();
	}

	@Test
	void aLogoRequestStandingBehindAWriterWaitsAtTheTableAndHasNotTakenTheRow() throws Exception {
		ExecutorService pool = Executors.newSingleThreadExecutor();

		try {
			Future<MockHttpServletResponse> submitted = holdingTheTable.execute(heldOpen -> {
				/* A WRITER IN THE MIDDLE OF ITS WORK: the table lock `SponsorWriteApi` takes before anything else. */
				SponsorWriteApi.lock(db);

				assertThat(BlockedBehindThisHold.count(db)).as("nothing has been submitted yet").isZero();

				Future<MockHttpServletResponse> request = pool.submit(this::theLogoTakenDown);
				Instant deadline = Instant.now().plusSeconds(10);

				try {
					while (BlockedBehindThisHold.count(db) < 1) {
						if (request.isDone() || Instant.now().isAfter(deadline)) {
							throw new AssertionError("the logo request was not stopped behind the table lock (done="
									+ request.isDone() + "), so it does not wait for a writer at all");
						}

						Thread.sleep(20);
					}
				} catch (InterruptedException e) {
					throw new RuntimeException(e);
				}

				/* AND THE ROW IS STILL FREE: a request that waits for the table while holding the row is the
				   order that deadlocks with a writer that holds the table and wants the row. */
				assertThat(db.sql("select id from sponsor where id = ? for update skip locked").param(sponsor)
						.query(Long.class).list())
						.as("the logo request took the row of the sponsor before it had the table")
						.containsExactly(sponsor);

				return request;
			});

			assertThat(submitted.get(30, TimeUnit.SECONDS).getStatus()).isEqualTo(204);
		} finally {
			pool.shutdownNow();
		}
	}
}

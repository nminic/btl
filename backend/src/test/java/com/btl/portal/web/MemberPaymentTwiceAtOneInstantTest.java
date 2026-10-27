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
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

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

/**
 * TWO PRESSES OF „UPIŠI UPLATU” ON ONE ROW AT ONE INSTANT BOOK ONE PAYMENT AND TELL THE MEMBER ONCE.
 *
 * <p><b>What this measures is the lock {@link MemberPaymentApi} takes on the member's row</b>, the
 * shape {@link MembershipWriteApi} keeps and {@code FreeingTwiceAtOneInstantTest} measures for it.
 * Without it both presses read that no payment stands for the season, both insert one, and the second
 * loses to {@code payment_one_a_season} with a 500. With it the second waits for the first to commit,
 * reads its row, and is the harmless repeat: 200, nothing written, nothing said.
 *
 * <p><b>NOT {@code @Transactional}, and the order is taken from the scheduler</b>, for the reasons
 * {@code VerificationDecisionConcurrencyTest} gives: the case holds the member's row {@code FOR UPDATE}
 * before either press is sent, waits until both are stopped inside the database, and only then lets
 * go. The rows are real commits and {@link #andNothingOfItIsLeftBehind} takes them back out.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class MemberPaymentTwiceAtOneInstantTest {

	private static final Instant AFTER_THE_FIFTEENTH = Instant.parse("2027-11-16T09:00:00Z");

	/** Distinct from every other fixture's, on purpose: these rows are committed. */
	private static final String MODERATOR = "dva-klika-upis-uplate@primer.rs";

	private static final String THE_NUMBER = "000973";

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

	private String cookie;

	private long moderator;

	private long him;

	@BeforeEach
	void aModeratorOverTheMembersAndALapsedMember() {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Mira', 'Dvoklikovic', ?, (select id from role where code = 'moderator'))")
				.param(MODERATOR).update();

		moderator = db.sql("select id from account where email = ?").param(MODERATOR)
				.query(Long.class).single();

		db.sql("insert into account_admin_right (account_id, right_code) values (?, 'entity:members')")
				.param(moderator).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values (?, ?, ?, ?, ?)")
				.params(moderator, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookie = session.secret();

		him = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, referral_code, bio,"
						+ " profile_hidden, birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at) values (?, 'Probni', 'Dvoklikovic', 'M', date '1990-05-15',"
						+ " (select id from place where rank = 1), 2027, false, false, '0011aabbccddeef9', '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.param(THE_NUMBER).query(Long.class).single();
	}

	/** Real commits, so a real delete, children before parents. */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from message where to_id = ?").param(him).update();
		db.sql("delete from membership where competitor_id = ?").param(him).update();
		db.sql("delete from payment where competitor_id = ?").param(him).update();
		db.sql("delete from balance_entry where competitor_id = ?").param(him).update();
		db.sql("delete from competitor where id = ?").param(him).update();
		db.sql("delete from account_session where account_id = ?").param(moderator).update();
		db.sql("delete from account_admin_right where account_id = ?").param(moderator).update();
		db.sql("delete from account where id = ?").param(moderator).update();
	}

	@Test
	void twoPressesAtOnceBookOnePaymentAndTellHimOnce() throws Exception {
		List<MockHttpServletResponse> both = atOnceBehindTheHeldRow(this::pressed, this::pressed);

		assertThat(both.stream().map(MockHttpServletResponse::getStatus).sorted().toList())
				.as("the second press was answered with a fault, or both were told they booked him")
				.containsExactly(200, 201);

		assertThat(db.sql("select count(*) from payment where competitor_id = ? and season = 2028")
				.param(him).query(Long.class).single()).isOne();
		assertThat(db.sql("select count(*) from message where to_id = ?")
				.param(him).query(Long.class).single())
				.as("the member was told twice about one payment")
				.isOne();
	}

	/** {@code FreeingTwiceAtOneInstantTest}'s shape, which says why each step is where it is. */
	private List<MockHttpServletResponse> atOnceBehindTheHeldRow(Callable<MockHttpServletResponse> one,
			Callable<MockHttpServletResponse> other) throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from competitor where id = ? for update")
						.param(him).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet")
						.isZero();

				submitted.add(pool.submit(one));
				submitted.add(pool.submit(other));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new IllegalStateException(e);
				}

				assertThat(submitted)
						.as("a press was answered before it reached the database")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			return List.of(submitted.get(0).get(30, TimeUnit.SECONDS),
					submitted.get(1).get(30, TimeUnit.SECONDS));
		} finally {
			pool.shutdownNow();
		}
	}

	private MockHttpServletResponse pressed() throws Exception {
		return http.perform(post("/api/members/" + THE_NUMBER + "/payment").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"received\": 38, \"method\": \"paypal\"}"))
				.andReturn().getResponse();
	}
}

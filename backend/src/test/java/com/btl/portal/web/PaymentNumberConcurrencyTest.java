package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
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
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
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
 * TWO APPROVALS AT THE SAME INSTANT NEVER RECEIVE THE SAME MEMBER NUMBER.
 *
 * <p>The task's own requirement: „Dodela mora da bude bezbedna pri istovremenosti:
 * dva odobrenja u isti cas ne smeju da daju isti broj. Sprovedi to ogranicenjem u
 * bazi ili sekvencom, ne proverom u Javi." {@code PaymentApi.drawANumber} reads
 * {@code nextval('member_number_seq')} and nothing else, and this is the one
 * mutation that check cannot be proven against by a single thread: a Java
 * check-then-act ({@code max(member_number) + 1}, read in Java, written back)
 * would pass every sequential test in {@code PaymentApiTest} and only fail here,
 * where two transactions genuinely overlap.
 *
 * <p><b>NOT {@code @Transactional}, AND THAT IS THE WHOLE POINT OF THIS FILE BEING
 * SEPARATE FROM {@code PaymentApiTest}.</b> A test-managed transaction is bound to
 * the CALLING thread only ({@code TransactionSynchronizationManager} is a
 * {@code ThreadLocal}); a worker thread calling through {@code MockMvc} gets a
 * connection and a transaction of its own regardless, so the two competing
 * {@code PaymentApi.confirm} calls below really do run as two independent
 * transactions against the real container, which is the one arrangement that can
 * exercise the sequence's own concurrency guarantee rather than PostgreSQL's MVCC
 * snapshot isolation hiding a race that would still be there. The cost is that
 * this class's rows are REAL commits against the database every other test in the
 * suite shares (`DatabaseTest`'s own note: „rolled back rather than cleaned up"),
 * so the {@code finally} block below deletes every row it made, by id, whether the
 * assertion above it passed or not.
 *
 * <p><b>THE CLOCK IS FIXED HERE TOO, AND ON PURPOSE A DIFFERENT DAY FROM
 * {@code PaymentApiTest}.</b> {@code PaymentApi} no longer takes a season from the
 * request; it reads {@link com.btl.portal.domain.season.SeasonClock#seasonBeingPaidFor}
 * off the booking day instead (PDL, POTVRDJENO 13.09.2026). {@code PaymentApiTest}
 * fixes {@code NOW} inside the transfer window, where the season sold happens to be
 * one number a bug could also produce by accident (a hardcoded constant, say, or the
 * request body this route used to read). Fixing a SECOND, unrelated day here - before
 * the window opens, where the season sold is the calendar year rather than the year
 * after it - is what tells the two apart.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PaymentNumberConcurrencyTest {

	/** Distinct from every other fixture's example moderator, on purpose: see the class comment. */
	private static final String MODERATOR = "istovremena-odobrenja@primer.rs";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	/** 11:00 in Belgrade on 30 September, the day before the transfer window opens (V8, `SeasonClock`). */
	private static final Instant NOW = Instant.parse("2027-09-30T09:00:00Z");

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockOutsideTheTransferWindow() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}

	private String cookie;

	private long account(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:payments')")
				.param(email).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		this.cookie = session.secret();

		return db.sql("select id from account where email = ?").param(email).query(Long.class).single();
	}

	private long competitor(String referralSuffix) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (null, 'Probni',"
						+ " 'Takmicar', 'M', ?, " + A_TOWN + ", null, null, 2027, false, false, 'payment',"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(java.sql.Date.valueOf(LocalDate.of(1990, 1, 1)), "00112233445577" + referralSuffix)
				.query(Long.class).single();
	}

	private MockHttpServletResponse confirm(long competitorId) throws Exception {
		String json = mapper.writeValueAsString(
				new PaymentApi.Confirm(competitorId, "EUR", "card", null));

		return http.perform(post("/api/payments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json))
				.andReturn().getResponse();
	}

	@Test
	void twoSimultaneousFirstPaymentsNeverReceiveTheSameNumber() throws Exception {
		long moderatorId = account(MODERATOR);
		long first = competitor("a1");
		long second = competitor("a2");

		ExecutorService pool = Executors.newFixedThreadPool(2);
		CyclicBarrier bothReady = new CyclicBarrier(2);

		try {
			Callable<MockHttpServletResponse> approveFirst = () -> {
				bothReady.await();
				return confirm(first);
			};
			Callable<MockHttpServletResponse> approveSecond = () -> {
				bothReady.await();
				return confirm(second);
			};

			Future<MockHttpServletResponse> outcomeOne = pool.submit(approveFirst);
			Future<MockHttpServletResponse> outcomeTwo = pool.submit(approveSecond);

			MockHttpServletResponse responseOne = outcomeOne.get(30, TimeUnit.SECONDS);
			MockHttpServletResponse responseTwo = outcomeTwo.get(30, TimeUnit.SECONDS);

			assertThat(responseOne.getStatus()).as(responseOne.getContentAsString()).isEqualTo(201);
			assertThat(responseTwo.getStatus()).as(responseTwo.getContentAsString()).isEqualTo(201);

			PaymentApi.Confirmed bodyOne =
					mapper.readValue(responseOne.getContentAsString(), PaymentApi.Confirmed.class);
			PaymentApi.Confirmed bodyTwo =
					mapper.readValue(responseTwo.getContentAsString(), PaymentApi.Confirmed.class);

			assertThat(bodyOne.memberNumber())
					.as("two competitors approved at the same instant were handed the same member number")
					.isNotEqualTo(bodyTwo.memberNumber());

			assertThat(db.sql("select count(distinct member_number) from competitor where id in (?, ?)")
					.params(first, second).query(Long.class).single())
					.as("the database itself shows one number written for two different men")
					.isEqualTo(2L);

			/* THE DISCRIMINATING ASSERTION OF THE CLASS COMMENT ABOVE: 2027, not 2028.
			   Both payments were booked on 30 September, the day this class fixes the
			   clock to and PaymentApiTest never touches. */
			assertThat(db.sql("select distinct season from payment where competitor_id in (?, ?)")
					.params(first, second).query(Integer.class).single())
					.as("a payment booked outside the transfer window should be filed under the"
							+ " calendar year of its booking day, not the season PaymentApiTest's"
							+ " fixture inside the window sells")
					.isEqualTo(2027);
		} finally {
			pool.shutdownNow();

			/* REAL COMMITS, SO A REAL DELETE - this class carries no test transaction to roll
			   them back with. Children before parents, although every one of these foreign
			   keys cascades, so that a future migration narrowing a cascade cannot turn this
			   cleanup into a constraint violation nobody sees until here. */
			db.sql("delete from payment where competitor_id in (?, ?)").params(first, second).update();
			db.sql("delete from membership where competitor_id in (?, ?)").params(first, second).update();
			db.sql("delete from competitor where id in (?, ?)").params(first, second).update();
			db.sql("delete from account_session where account_id = ?").param(moderatorId).update();
			db.sql("delete from account_admin_right where account_id = ?").param(moderatorId).update();
			db.sql("delete from account where id = ?").param(moderatorId).update();
		}
	}
}

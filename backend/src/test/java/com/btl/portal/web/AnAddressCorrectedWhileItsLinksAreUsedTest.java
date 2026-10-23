package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE ADMINISTRATION CORRECTING AN ADDRESS NOT YET CONFIRMED, AT THE SAME INSTANT AS SOMEBODY USES OR
 * ASKS FOR A LINK SENT TO THE OLD ONE (22.10.2026, the security review of PR 633).
 *
 * <p>What was found: a link read before the correction committed confirmed the NEW address, and a
 * link asked for at the old address could be written after the correction had retired every other
 * one. The repair is one order kept by every route that touches an account's address or its links:
 * the account row first, the link after ({@link MemberDataWriteApi}, {@link EmailConfirmationApi},
 * {@link PasswordResetApi}).
 *
 * <p><b>Each case forces the interleaving rather than hoping for it</b>, the shape
 * {@link AMemberCorrectsTheTextWhileTheDecisionWaitsTest} uses: this class holds the account row,
 * sends the two requests in a known order, waits until the lock manager shows both stopped behind
 * it ({@link BlockedBehindThisHold}), and only then lets go. So the claim measured is the RACE, the
 * one order in which the fault lived, and not the order a sequential case would give.
 *
 * <p>Not {@code @Transactional}: the requests run on their own connections and have to see what the
 * others commit, so every row is written for real and taken out again after each case.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AnAddressCorrectedWhileItsLinksAreUsedTest {

	private static final String HE = "000971";

	private static final String THE_OLD_ADDRESS = "staro-utrka@primer.rs";

	private static final String THE_NEW_ADDRESS = "novo-utrka@primer.rs";

	private static final String THE_SUPERADMIN = "superadmin-utrka@primer.rs";

	private static final String A_GOOD_PASSWORD = "Duga Lozinka Za Probu 2026";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holdingTheRow;

	@MockitoSpyBean
	private Postman postman;

	private long he;

	private long hisAccount;

	private String superadminSession;

	@BeforeEach
	void aMemberWhoseAddressIsNotConfirmedAndTheSuperadmin() {
		doNothing().when(postman).send(any(Said.class), anyString());

		he = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Utrka', 'Utrkic', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1),"
						+ " 2027, false, true, '00112233445599d7', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.param(HE).query(Long.class).single();

		/* NO PASSWORD, as an invited member has none until he takes the account over: so spending a
		   password link also confirms the address (`PasswordResetApi`), which is the fourth road. */
		hisAccount = db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Utrka', 'Utrkic', ?, (select id from role where code = 'competitor'), ?)"
						+ " returning id")
				.params(THE_OLD_ADDRESS, he).query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Super', 'Admin', ?, (select id from role where code = 'superadmin'))")
				.param(THE_SUPERADMIN).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_SUPERADMIN, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		superadminSession = session.secret();
	}

	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from message where to_id = ?").param(he).update();
		db.sql("delete from email_verification_token where account_id = ?").param(hisAccount).update();
		db.sql("delete from password_reset_token where account_id = ?").param(hisAccount).update();
		db.sql("delete from account where id = ?").param(hisAccount).update();
		db.sql("delete from account where email = ?").param(THE_SUPERADMIN).update();
		db.sql("delete from competitor where id = ?").param(he).update();
	}

	/** A link of his of the given kind, written for real, and the secret the letter would carry. */
	private String aLink(String table) {
		SecretToken link = SecretToken.fresh();

		db.sql("insert into " + table + " (account_id, token_hash) values (?, ?)")
				.params(hisAccount, link.hash()).update();

		return link.secret();
	}

	private MockHttpServletResponse sent(MockHttpServletRequestBuilder asks) throws Exception {
		return http.perform(asks.with(csrf()).contentType(MediaType.APPLICATION_JSON)).andReturn().getResponse();
	}

	private MockHttpServletResponse theCorrection() throws Exception {
		return sent(put("/api/members/" + HE + "/data").content("{\"email\": \"" + THE_NEW_ADDRESS + "\"}")
				.cookie(new Cookie(SessionCookie.NAME, superadminSession)));
	}

	/**
	 * THE TWO REQUESTS, IN THIS ORDER, STOPPED BEHIND THE HELD ACCOUNT, and then let go. The first
	 * is queued for the row before the second is sent, so it is the first to get it.
	 */
	private List<MockHttpServletResponse> inThisOrder(Callable<MockHttpServletResponse> first,
			Callable<MockHttpServletResponse> second) throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select id from account where id = ? for update").param(hisAccount).query(Long.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("nothing has been sent yet, so a count that is not nought counts something else")
						.isZero();

				submitted.add(pool.submit(first));
				untilBehind(1, submitted);
				submitted.add(pool.submit(second));
				untilBehind(2, submitted);

				return null;
			});

			List<MockHttpServletResponse> answers = new ArrayList<>();

			for (Future<MockHttpServletResponse> one : submitted) {
				answers.add(one.get(30, TimeUnit.SECONDS));
			}

			return answers;
		} finally {
			pool.shutdownNow();
		}
	}

	private void untilBehind(int expected, List<Future<MockHttpServletResponse>> submitted) {
		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < expected) {
			if (Instant.now().isAfter(deadline) || submitted.stream().anyMatch(Future::isDone)) {
				throw new IllegalStateException("expected " + expected + " request(s) stopped behind the held"
						+ " account, and the lock manager shows " + BlockedBehindThisHold.count(db)
						+ " (done: " + submitted.stream().map(Future::isDone).toList() + ")");
			}

			try {
				Thread.sleep(20);
			} catch (InterruptedException e) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException(e);
			}
		}
	}

	private String addressAndConfirmed() {
		return db.sql("select email || ' ' || (email_confirmed_at is not null) from account where id = ?")
				.param(hisAccount).query(String.class).single();
	}

	/** Every address a letter went to, in order. */
	private List<String> lettersWentTo() {
		ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);

		verify(postman, atLeast(0)).send(any(Said.class), to.capture());

		return to.getAllValues();
	}

	@Test
	void aConfirmationReadBeforeTheCorrectionDoesNotConfirmTheNewAddress() throws Exception {
		String opened = aLink("email_verification_token");

		List<MockHttpServletResponse> answers = inThisOrder(this::theCorrection,
				() -> sent(post("/api/email-confirmation").content("{\"token\": \"" + opened + "\"}")));

		assertThat(answers.get(0).getStatus()).as("the correction").isEqualTo(200);
		assertThat(answers.get(1).getStatus())
				.as("the link to the old address was retired by the correction that got the row first")
				.isEqualTo(400);
		assertThat(addressAndConfirmed()).isEqualTo(THE_NEW_ADDRESS + " false");
	}

	@Test
	void aConfirmationThatGetsTheRowFirstMakesTheAddressHisAndTheCorrectionIsRefused() throws Exception {
		String opened = aLink("email_verification_token");

		List<MockHttpServletResponse> answers = inThisOrder(
				() -> sent(post("/api/email-confirmation").content("{\"token\": \"" + opened + "\"}")),
				this::theCorrection);

		assertThat(answers.get(0).getStatus()).as("the confirmation").isEqualTo(204);
		assertThat(answers.get(1).getStatus()).as("the correction of an address now confirmed").isEqualTo(409);
		assertThat(answers.get(1).getContentAsString()).contains(MemberDataWriteApi.THE_ADDRESS_IS_CONFIRMED);
		assertThat(addressAndConfirmed()).isEqualTo(THE_OLD_ADDRESS + " true");
		assertThat(lettersWentTo()).isEmpty();
	}

	@Test
	void aNewLinkAskedForAtTheOldAddressIsNeitherWrittenNorSent() throws Exception {
		List<MockHttpServletResponse> answers = inThisOrder(this::theCorrection,
				() -> sent(post("/api/email-confirmation/resend").content("{\"email\": \"" + THE_OLD_ADDRESS + "\"}")));

		assertThat(answers.get(0).getStatus()).isEqualTo(200);
		assertThat(answers.get(1).getStatus()).isEqualTo(204);

		/* ONE LINK, THE CORRECTION'S OWN, and one letter, to the new address. */
		assertThat(db.sql("select count(*) from email_verification_token where account_id = ?")
				.param(hisAccount).query(Long.class).single()).isOne();
		assertThat(lettersWentTo()).containsExactly(THE_NEW_ADDRESS);
	}

	@Test
	void aPasswordLinkAskedForAtTheOldAddressIsNeitherWrittenNorSent() throws Exception {
		List<MockHttpServletResponse> answers = inThisOrder(this::theCorrection,
				() -> sent(post("/api/password-reset/request").content("{\"email\": \"" + THE_OLD_ADDRESS + "\"}")));

		assertThat(answers.get(0).getStatus()).isEqualTo(200);
		assertThat(answers.get(1).getStatus()).isEqualTo(204);
		assertThat(db.sql("select count(*) from password_reset_token where account_id = ?")
				.param(hisAccount).query(Long.class).single()).isZero();
		assertThat(lettersWentTo()).containsExactly(THE_NEW_ADDRESS);
	}

	/**
	 * A PASSWORD LINK SPENT IN THE SAME INSTANT: the spend that comes second finds the link gone, and
	 * neither request fails. Before the account was locked first, the spend held the link and waited
	 * for the account while the correction held the account and waited for the link, and PostgreSQL
	 * ended one of the two in an error.
	 */
	@Test
	void aPasswordLinkSpentBehindTheCorrectionIsGoneAndNeitherRequestFails() throws Exception {
		String opened = aLink("password_reset_token");

		List<MockHttpServletResponse> answers = inThisOrder(this::theCorrection,
				() -> sent(post("/api/password-reset").content("{\"token\": \"" + opened + "\", \"password\": \""
						+ A_GOOD_PASSWORD + "\", \"passwordRepeat\": \"" + A_GOOD_PASSWORD + "\"}")));

		assertThat(answers.get(0).getStatus()).as("the correction").isEqualTo(200);
		assertThat(answers.get(1).getStatus()).as("the spend of a link the correction retired").isEqualTo(400);
		assertThat(addressAndConfirmed()).isEqualTo(THE_NEW_ADDRESS + " false");
		assertThat(db.sql("select password_hash is null from account where id = ?").param(hisAccount)
				.query(Boolean.class).single()).isTrue();
	}
}

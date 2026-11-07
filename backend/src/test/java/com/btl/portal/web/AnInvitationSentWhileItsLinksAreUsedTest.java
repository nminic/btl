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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * THE ADMINISTRATION SENDING A NEW INVITATION AT THE SAME INSTANT AS ANOTHER PRESS OF THE SAME BUTTON, OR AS THE
 * MEMBER SPENDING A LINK HE WAS SENT ({@code MemberInvitationApi}, PENDING item 42 of PR 691 and 692).
 *
 * <p>What is held: the route takes the account row {@code for update} first, inside its transaction, and only then
 * asks whether the account has a password and deletes the links. {@code MemberInvitationApiTest} is
 * {@code @Transactional}, so it runs every case on ONE connection and can never see two requests meet; the
 * claim that two presses leave one live link, and that a password set in the same instant is not met by a
 * link written for an account that has one, was therefore held by nothing. This class forces each interleaving
 * the shape {@link AnAddressCorrectedWhileItsLinksAreUsedTest} uses: it holds the account row, sends the two
 * requests in a known order, waits until the lock manager shows both stopped behind it
 * ({@link BlockedBehindThisHold}), and only then lets go.
 *
 * <p><b>The collision was measured before this class was written, not assumed.</b> Without the hold, two
 * presses both read the account, both delete the links that are there and both write one, so TWO invitations
 * stand and the sentence the letter makes true, „Prethodni link više ne važi”, is false for the first.
 *
 * <p>Not {@code @Transactional}: the requests run on their own connections and have to see what the others
 * commit, so every row is written for real and taken out again after each case.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AnInvitationSentWhileItsLinksAreUsedTest {

	private static final String HE = "000975";

	private static final String HIS_ADDRESS = "pozvani-utrka@primer.rs";

	private static final String THE_SUPERADMIN = "superadmin-pozivnica-utrka@primer.rs";

	private static final String A_GOOD_PASSWORD = "trcim.kroz.sumu.2027";

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
	void aMemberEnteredByTheAdministrationWhoHasNoPasswordAndTheSuperadmin() {
		doNothing().when(postman).send(any(Said.class), anyString());

		he = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Pozvani', 'Utrkic', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1),"
						+ " 2027, '00112233445599d8', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.param(HE).query(Long.class).single();

		/* NO PASSWORD: an invitation is for a member who has none yet. */
		hisAccount = db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Pozvani', 'Utrkic', ?, (select id from role where code = 'competitor'), ?)"
						+ " returning id")
				.params(HIS_ADDRESS, he).query(Long.class).single();

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

	private MockHttpServletResponse thePress() throws Exception {
		return sent(post("/api/members/" + HE + "/invitation")
				.cookie(new Cookie(SessionCookie.NAME, superadminSession)));
	}

	private MockHttpServletResponse theSpendOf(String link) throws Exception {
		return sent(post("/api/password-reset").content("{\"token\": \"" + link + "\", \"password\": \""
				+ A_GOOD_PASSWORD + "\", \"passwordRepeat\": \"" + A_GOOD_PASSWORD + "\"}"));
	}

	/**
	 * THE TWO REQUESTS, IN THIS ORDER, STOPPED BEHIND THE HELD ACCOUNT, and then let go. The first is queued for
	 * the row before the second is sent, so it is the first to get it.
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

	private long linksOf(String table) {
		return db.sql("select count(*) from " + table + " where account_id = ?").param(hisAccount)
				.query(Long.class).single();
	}

	/** Every letter that went out, in order. */
	private List<Said> lettersSent() {
		ArgumentCaptor<Said> said = ArgumentCaptor.forClass(Said.class);

		verify(postman, atLeast(0)).send(said.capture(), anyString());

		return said.getAllValues();
	}

	/** The secret in a letter's link, the way the member would copy it. */
	private static String secretIn(Said letter) {
		Matcher token = Pattern.compile("nova-lozinka\\?token=([A-Za-z0-9_-]+)").matcher(letter.body());

		assertThat(token.find()).as("the letter carries a link to set a password").isTrue();

		return token.group(1);
	}

	/**
	 * TWO PRESSES AT ONCE: both are answered 200 and two letters go, but ONE invitation stands and it is the
	 * second's. The first press wrote a link and the second, which waited for the row, deleted it before writing
	 * its own, which is what „Prethodni link više ne važi” says. Read off the rows and not off the count alone:
	 * the secret in the first letter is no row, the secret in the second letter is the row.
	 */
	@Test
	void twoPressesAtOnceLeaveOneLiveInvitationAndItIsTheSecondOnes() throws Exception {
		List<MockHttpServletResponse> answers = inThisOrder(this::thePress, this::thePress);

		assertThat(answers).extracting(MockHttpServletResponse::getStatus).containsExactly(200, 200);

		List<Said> letters = lettersSent();

		assertThat(letters).hasSize(2);
		assertThat(linksOf("password_reset_token")).as("the first press's link was deleted by the second").isOne();
		assertThat(db.sql("select token_hash from password_reset_token where account_id = ?").param(hisAccount)
				.query(String.class).single()).isEqualTo(SecretToken.hashOf(secretIn(letters.get(1))));
		assertThat(db.sql("select count(*) from password_reset_token where token_hash = ?")
				.param(SecretToken.hashOf(secretIn(letters.get(0)))).query(Long.class).single())
				.as("the link of the first letter is no longer a row").isZero();
		assertThat(linksOf("email_verification_token")).isZero();
	}

	/**
	 * A PASSWORD SET IN THE SAME INSTANT, AND FIRST: the spend takes the row, sets the password and removes its
	 * link, so the press that waited meets an account that has one, is refused {@code thePasswordIsSet}, and
	 * writes no link and sends no letter. Without the row held first, the press reads the account before the
	 * password is there and writes an invitation for an account that has one.
	 */
	@Test
	void aPasswordSetFirstRefusesThePressAndLeavesNoInvitationBehind() throws Exception {
		String opened = aLink("password_reset_token");

		List<MockHttpServletResponse> answers = inThisOrder(() -> theSpendOf(opened), this::thePress);

		assertThat(answers.get(0).getStatus()).as("the spend").isEqualTo(204);
		assertThat(answers.get(1).getStatus()).as("the press for an account that has a password now")
				.isEqualTo(409);
		assertThat(answers.get(1).getContentAsString()).contains(MemberInvitationApi.THE_PASSWORD_IS_SET);
		assertThat(db.sql("select count(*) from password_reset_token where account_id = ? and used_at is null")
				.param(hisAccount).query(Long.class).single())
				.as("the spend marked his link used, and the press wrote no new one").isZero();
		assertThat(db.sql("select password_hash is not null from account where id = ?").param(hisAccount)
				.query(Boolean.class).single()).isTrue();
		assertThat(lettersSent()).isEmpty();
	}

	/**
	 * THE PRESS FIRST: it retires the link the member was about to spend, so the spend that waited finds it gone
	 * (400) and the account still has no password. Without the row held first, the spend takes the link and sets
	 * the password while the press is deleting it, and the member ends up with a password AND an invitation
	 * written for an account that has one.
	 */
	@Test
	void aPressFirstRetiresTheLinkThatWasAboutToBeSpent() throws Exception {
		String old = aLink("password_reset_token");

		List<MockHttpServletResponse> answers = inThisOrder(this::thePress, () -> theSpendOf(old));

		assertThat(answers.get(0).getStatus()).as("the press").isEqualTo(200);
		assertThat(answers.get(1).getStatus()).as("the spend of a link the press retired").isEqualTo(400);
		assertThat(db.sql("select password_hash is null from account where id = ?").param(hisAccount)
				.query(Boolean.class).single()).isTrue();
		assertThat(linksOf("password_reset_token")).isOne();
		assertThat(lettersSent()).hasSize(1);
	}
}

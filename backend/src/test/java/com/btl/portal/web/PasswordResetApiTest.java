package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.PasswordPolicy;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;

import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A FORGOTTEN PASSWORD, END TO END, against a real database and a real mail server -
 * the same arrangement {@code RegistrationApiTest} and {@code EmailConfirmationApiTest}
 * use, and for the same reason: {@code request} sends after its own commit.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3328",
		"spring.mail.properties.mail.smtp.auth=false",
		"btl.portal.address=https://probni-portal.primer.rs"})
@Transactional
class PasswordResetApiTest {

	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3328));

	/** Twelve characters and not on the shipped list, the same one {@code RegistrationApiTest} uses. */
	private static final String NEW_PASSWORD = "trcim.kroz.sumu.2027";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Value("${btl.portal.address}")
	private String portal;

	private int addresses;

	private String aFreshAddress() {
		addresses++;
		return "reset-" + addresses + "-" + System.nanoTime() + "@primer.rs";
	}

	/* `first_name`/`last_name` are `not null` since V23 ("the account carries its own
	   name"), unrelated to anything this class measures - the same placeholder
	   `RightsAtTheDoorTest` and `EmailConfirmationApiTest` use for their own throwaway
	   accounts. */
	private long anAccount(String email) {
		return db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'competitor'))"
						+ " returning id")
				.param(email).query(Long.class).single();
	}

	/** An account already locked out, the way ten wrong guesses in a row leave one. */
	private long aLockedAccount(String email) {
		long account = anAccount(email);

		db.sql("update account set failed_sign_ins = 10, locked_until = now() + interval '15 minutes'"
						+ " where id = ?")
				.param(account).update();

		return account;
	}

	private String aValidToken(long account) {
		SecretToken token = SecretToken.fresh();

		db.sql("insert into password_reset_token (account_id, token_hash) values (?, ?)")
				.params(account, token.hash()).update();

		return token.secret();
	}

	private String anExpiredToken(long account) {
		SecretToken token = SecretToken.fresh();

		/* BOTH MOMENTS ARE MOVED INTO THE PAST, AND NOT ONLY `expires_at`. `created_at`
		   defaults to `now()`, which is the same instant `expires_at` would otherwise be
		   measured against - and `password_reset_token_ends_after_it_began` demands
		   `expires_at > created_at` whatever either one is. A row born now and already
		   expired a second ago fails that check before it fails the one this case means
		   to test, so both are set explicitly, far enough apart that they cannot cross,
		   and both still before the real `now()` this row is read back against. */
		db.sql("insert into password_reset_token (account_id, token_hash, created_at, expires_at)"
						+ " values (?, ?, now() - interval '2 hours', now() - interval '1 hour')")
				.params(account, token.hash()).update();

		return token.secret();
	}

	private String aSpentToken(long account) {
		SecretToken token = SecretToken.fresh();

		db.sql("insert into password_reset_token (account_id, token_hash, used_at)"
						+ " values (?, ?, now())")
				.params(account, token.hash()).update();

		return token.secret();
	}

	/** Null until a reset actually sets one - which every case that asks for this before a
	 *  successful reset relies on, so it is read as an optional rather than demanded. */
	private String passwordHashOf(long account) {
		return db.sql("select password_hash from account where id = ?")
				.param(account).query(String.class).optional().orElse(null);
	}

	private MockHttpServletResponse request(String email) throws Exception {
		return http.perform(post("/api/password-reset/request").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":" + quoteOrNull(email) + "}"))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse reset(String token, String password, String repeat)
			throws Exception {
		return http.perform(post("/api/password-reset").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":" + quoteOrNull(token)
								+ ",\"password\":" + quoteOrNull(password)
								+ ",\"passwordRepeat\":" + quoteOrNull(repeat) + "}"))
				.andReturn().getResponse();
	}

	private static String quoteOrNull(String value) {
		return value == null ? "null" : "\"" + value.replace("\"", "\\\"") + "\"";
	}

	private MimeMessage waitForOne() {
		assertThat(SMTP.waitForIncomingEmail(5000, 1))
				.as("no message reached the mail server in five seconds")
				.isTrue();

		return SMTP.getReceivedMessages()[0];
	}

	/** Kept local to this class for the same reason {@code EmailConfirmationApiTest} keeps
	 *  its own copy: neither file's helpers are a dependency the other has to know about. */
	private static String theTokenInside(String body) {
		int at = body.indexOf("?token=");

		assertThat(at).as("the message carries no link at all:%n%s", body).isNotNegative();

		String rest = body.substring(at + "?token=".length());
		int ends = 0;

		while (ends < rest.length() && (Character.isLetterOrDigit(rest.charAt(ends))
				|| rest.charAt(ends) == '-' || rest.charAt(ends) == '_')) {
			ends++;
		}

		return rest.substring(0, ends);
	}

	/** One entry of the shipped list, read the same way {@code RegistrationApiTest} does. */
	private static String theFirstLeakedPasswordTheListHolds() throws Exception {
		try (var lines = new java.io.BufferedReader(new java.io.InputStreamReader(
				PasswordResetApiTest.class.getResourceAsStream(
						com.btl.portal.domain.account.BreachedPasswords.RESOURCE),
				StandardCharsets.UTF_8))) {

			return lines.lines().map(String::strip)
					.filter(one -> !one.isEmpty() && !one.startsWith("#"))
					.findFirst()
					.orElseThrow(() -> new AssertionError("the shipped list of leaked passwords"
							+ " holds nothing, so this case measures nothing"));
		}
	}

	@Test
	void requestSendsAFreshLinkToAnExistingAddress() throws Exception {
		String email = aFreshAddress();
		/* UNCONFIRMED, ON PURPOSE: unlike `EmailConfirmationApi.resend`, a reset does
		   not ask whether the address has been confirmed - see the class comment on
		   `PasswordResetApi` for why V18 requires exactly that. */
		long account = anAccount(email);

		assertThat(request(email).getStatus()).isEqualTo(204);

		String secret = theTokenInside(waitForOne().getContent().toString());
		long opens = db.sql("select account_id from password_reset_token where token_hash = ?")
				.param(SecretToken.hashOf(secret)).query(Long.class).single();

		assertThat(opens).isEqualTo(account);
	}

	@Test
	void requestGivesTheSameAnswerWhetherOrNotTheAddressExists() throws Exception {
		String realAddress = aFreshAddress();
		anAccount(realAddress);

		MockHttpServletResponse forARealAddress = request(realAddress);
		MockHttpServletResponse forNoAddressAtAll = request(aFreshAddress());

		assertThat(forARealAddress.getStatus())
				.as("asking to reset a password told apart an address that belongs to somebody"
						+ " from one that does not")
				.isEqualTo(forNoAddressAtAll.getStatus());
		assertThat(forNoAddressAtAll.getContentAsString())
				.isEqualTo(forARealAddress.getContentAsString());
	}

	@Test
	void requestToAnAddressNobodyHoldsSendsNothing() throws Exception {
		assertThat(request(aFreshAddress()).getStatus()).isEqualTo(204);
		assertThat(SMTP.getReceivedMessages()).isEmpty();
	}

	@Test
	void aBlankOrMissingEmailSendsNothing() throws Exception {
		assertThat(request(null).getStatus()).isEqualTo(204);
		assertThat(request("").getStatus()).isEqualTo(204);
		assertThat(SMTP.getReceivedMessages()).isEmpty();
	}

	@Test
	void requestBuildsTheLinkFromTheSettingAndNotFromWhoeverAsked() throws Exception {
		String email = aFreshAddress();
		anAccount(email);

		MockHttpServletResponse answer = http.perform(post("/api/password-reset/request")
						.with(csrf())
						.header("Host", "zlo.rs")
						.header("X-Forwarded-Host", "zlo.rs")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"" + email + "\"}"))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(204);

		String body = waitForOne().getContent().toString();

		assertThat(body).doesNotContain("zlo.rs")
				.contains(portal + Message.SET_A_NEW_PASSWORD.path() + "?token=");
	}

	/** See {@code EmailConfirmationApiTest.aRelayThatRefusesTheMessageStillLeavesTheTokenBehind}
	 *  for why this is not reproved with a real socket the way registration's own send is. */
	@Test
	void aRelayThatRefusesTheMessageStillLeavesTheTokenBehind() throws Exception {
		String email = aFreshAddress();
		long account = anAccount(email);

		SMTP.getSmtp().stopService();

		assertThat(request(email).getStatus()).isEqualTo(204);
		assertThat(db.sql("select count(*) from password_reset_token where account_id = ?")
				.param(account).query(Integer.class).single())
				.as("the fresh token did not survive a relay that refused the message")
				.isOne();
	}

	@Test
	void aValidTokenSetsTheNewPassword() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);

		MockHttpServletResponse answer = reset(token, NEW_PASSWORD, NEW_PASSWORD);

		assertThat(answer.getStatus()).isEqualTo(204);
		assertThat(new StoredPassword().matches(NEW_PASSWORD, passwordHashOf(account))).isTrue();
	}

	@Test
	void resettingHandsOutNoSession() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);

		MockHttpServletResponse answer = reset(token, NEW_PASSWORD, NEW_PASSWORD);

		assertThat(answer.getCookie(SessionCookie.NAME))
				.as("prijava bez lozinke se ne uvodi, i ovo mu je dalo jednu")
				.isNull();
	}

	@Test
	void resettingClearsAnyLockTheAccountWasUnder() throws Exception {
		String email = aFreshAddress();
		long account = aLockedAccount(email);
		String token = aValidToken(account);

		assertThat(reset(token, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(204);

		/* Queried as two precise types rather than compared inside a generic map, so
		   the case cannot be fooled by whatever Java type a driver happens to hand
		   back for `smallint` - see `izvedi-ne-pretpostavljaj` in spirit: assert what
		   was actually read, not what a `Map<String, Object>` equality is assumed to
		   do with it. */
		assertThat(db.sql("select failed_sign_ins from account where id = ?")
				.param(account).query(Integer.class).single())
				.as("the count of failed sign ins survived a password reset")
				.isZero();
		assertThat(db.sql("select locked_until from account where id = ?")
				.param(account).query(java.sql.Timestamp.class).optional())
				.as("the lock survived a password reset that proved who was asking")
				.isEmpty();
	}

	@Test
	void anExpiredTokenIsRefusedAndChangesNothing() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = anExpiredToken(account);
		String before = passwordHashOf(account);

		MockHttpServletResponse answer = reset(token, NEW_PASSWORD, NEW_PASSWORD);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString())
				.isEqualTo("{\"reason\":\"" + PasswordResetApi.THE_LINK_IS_NOT_VALID + "\"}");
		assertThat(passwordHashOf(account)).isEqualTo(before);
	}

	@Test
	void aTokenNobodyHasIsRefused() throws Exception {
		assertThat(reset(SecretToken.fresh().secret(), NEW_PASSWORD, NEW_PASSWORD).getStatus())
				.isEqualTo(400);
	}

	@Test
	void aBlankOrMissingTokenIsRefused() throws Exception {
		assertThat(reset(null, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(400);
		assertThat(reset("", NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(400);
	}

	/**
	 * A SPENT TOKEN CANNOT BE SPENT TWICE, and this is the one case that measures both
	 * halves of it: the first attempt succeeds and the second, with the identical
	 * token, is refused rather than allowed to set yet another password.
	 */
	@Test
	void aUsedTokenCannotBeUsedTwice() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);

		assertThat(reset(token, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(204);

		String secondPassword = "drugi.pokusaj.lozinke";
		MockHttpServletResponse second = reset(token, secondPassword, secondPassword);

		assertThat(second.getStatus())
				.as("a token already spent was accepted a second time")
				.isEqualTo(400);
		assertThat(new StoredPassword().matches(secondPassword, passwordHashOf(account)))
				.as("the second attempt overwrote the password the first one set")
				.isFalse();
	}

	@Test
	void aTokenAlreadyMarkedSpentIsRefused() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aSpentToken(account);

		assertThat(reset(token, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(400);
	}

	/**
	 * THE TOKEN IS HASHED BEFORE IT IS EVER COMPARED - see
	 * {@code EmailConfirmationApiTest.theStoredHashDoesNotConfirmAnythingWhenItIsSentBackAsTheToken}
	 * for the identical concern over the other table.
	 */
	@Test
	void theStoredHashDoesNotWorkAsTheTokenItself() throws Exception {
		long account = anAccount(aFreshAddress());
		aValidToken(account);

		String hashInTheRow = db.sql("select token_hash from password_reset_token"
						+ " where account_id = ?")
				.param(account).query(String.class).single();

		assertThat(reset(hashInTheRow, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(400);
	}

	/**
	 * NEITHER FIELD MAY BE MISSING, ASKED OF EACH ONE ON ITS OWN.
	 *
	 * <p>{@code typed.password() == null || typed.passwordRepeat() == null} is written
	 * so that a missing repeat is caught even when the first half is not null - which
	 * needs its own request to measure, because a call that leaves out the password
	 * itself never evaluates the second half at all.
	 */
	@Test
	void aMissingPasswordOrRepeatIsRefused() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);

		assertThat(reset(token, null, NEW_PASSWORD).getContentAsString())
				.isEqualTo("{\"reason\":\"" + PasswordResetApi.THE_FORM_IS_NOT_COMPLETE + "\"}");
		assertThat(reset(token, NEW_PASSWORD, null).getContentAsString())
				.isEqualTo("{\"reason\":\"" + PasswordResetApi.THE_FORM_IS_NOT_COMPLETE + "\"}");

		assertThat(passwordHashOf(account))
				.as("a request missing a field it needs set a password anyway")
				.isNull();
	}

	@Test
	void resettingOneAccountsTokenDoesNotResetAnother() throws Exception {
		long first = anAccount(aFreshAddress());
		long second = anAccount(aFreshAddress());
		String tokenForSecond = aValidToken(second);
		String beforeForFirst = passwordHashOf(first);

		assertThat(reset(tokenForSecond, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(204);

		assertThat(passwordHashOf(first))
				.as("a token minted for one account changed a different one's password")
				.isEqualTo(beforeForFirst);
	}

	@Test
	void theTwoPasswordsHaveToBeTheSameOne() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);

		MockHttpServletResponse answer = reset(token, NEW_PASSWORD, NEW_PASSWORD + "x");

		assertThat(answer.getContentAsString())
				.isEqualTo("{\"reason\":\"" + PasswordResetApi.THE_FORM_IS_NOT_COMPLETE + "\"}");
		assertThat(passwordHashOf(account)).isNull();
	}

	@Test
	void aShortPasswordIsRefused() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);
		String eleven = "a".repeat(PasswordPolicy.SHORTEST - 1);

		assertThat(reset(token, eleven, eleven).getContentAsString())
				.isEqualTo("{\"reason\":\"" + PasswordResetApi.THE_FORM_IS_NOT_COMPLETE + "\"}");
		assertThat(passwordHashOf(account)).isNull();
	}

	@Test
	void aLeakedPasswordIsToldApart() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);
		String leaked = theFirstLeakedPasswordTheListHolds();

		MockHttpServletResponse answer = reset(token, leaked, leaked);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString())
				.isEqualTo("{\"reason\":\"" + PasswordResetApi.THE_PASSWORD_HAS_LEAKED + "\"}");
		assertThat(passwordHashOf(account)).isNull();
	}

	@Test
	void aRequestWithNoFormAtAllNeverReachesUsEitherRoute() throws Exception {
		assertThat(http.perform(post("/api/password-reset/request").with(csrf())
						.contentType(MediaType.APPLICATION_JSON))
				.andReturn().getResponse().getStatus()).isEqualTo(400);
		assertThat(http.perform(post("/api/password-reset").with(csrf())
						.contentType(MediaType.APPLICATION_JSON))
				.andReturn().getResponse().getStatus()).isEqualTo(400);
	}
}

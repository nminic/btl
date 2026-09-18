package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.PasswordPolicy;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;

import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
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
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

	/** A live session for that account, opened directly the way {@code WhoIsAskingTest}
	 *  opens its own - this class has no sign in of its own to open one through. */
	private SecretToken aSessionFor(long account) {
		SecretToken session = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash) values (?, ?)")
				.params(account, session.hash()).update();

		return session;
	}

	/** Whether a session opened by {@link #aSessionFor} still has a row at all - what
	 *  {@code WhoIsAsking} reads to decide who is asking. */
	private boolean sessionStillExists(SecretToken session) {
		return db.sql("select count(*) from account_session where token_hash = ?")
				.param(session.hash()).query(Integer.class).single() > 0;
	}

	/** Whichever cookie a browser carries after signing in, asking the one route every
	 *  session in this portal is read by - the same probe the VISOK 1 finding itself
	 *  used to measure the gap this class now closes. */
	private MockHttpServletResponse me(SecretToken carrying) throws Exception {
		return http.perform(get("/api/me").cookie(new Cookie(SessionCookie.NAME, carrying.secret())))
				.andReturn().getResponse();
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

	/**
	 * A SESSION SURVIVES A PASSWORD RESET - VISOK 1, security review of PR 292.
	 *
	 * <p>V18 names "a member changes his password" as the first of the three reasons
	 * a session is a row and not a signed token. Whoever is holding a cookie this
	 * member did not just mint - a borrowed computer, a copied browser profile - must
	 * stop being let in the instant this member proves he can still read his own
	 * mailbox and picks a new password; a row nobody deleted at that moment leaves
	 * the reset unable to do the one thing it exists for.
	 *
	 * <p>TWO sessions of the one account, and each of them asked about by name. An
	 * account holding a single row cannot tell "every session of this account" from
	 * "some one row of this account", so a delete carrying a {@code limit} would end
	 * the member's own cookie, leave the copied one alive - and pass. Whichever of
	 * the two such a delete chose to keep, it is named below.
	 */
	@Test
	void resettingEndsEverySessionOfTheAccount() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);
		SecretToken older = aSessionFor(account);
		SecretToken newer = aSessionFor(account);

		assertThat(me(older).getStatus())
				.as("the older session was not even live before the reset, so this proves"
						+ " nothing")
				.isEqualTo(200);
		assertThat(me(newer).getStatus())
				.as("the newer session was not even live before the reset, so this proves"
						+ " nothing")
				.isEqualTo(200);

		assertThat(reset(token, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(204);

		assertThat(me(older).getStatus())
				.as("a cookie minted before the password was reset still signed somebody in"
						+ " afterwards")
				.isEqualTo(401);
		assertThat(me(newer).getStatus())
				.as("the second of this account's two cookies still signed somebody in after"
						+ " the reset")
				.isEqualTo(401);
		assertThat(sessionStillExists(older))
				.as("the older of this account's two session rows survived a password reset")
				.isFalse();
		assertThat(sessionStillExists(newer))
				.as("the newer of this account's two session rows survived a password reset")
				.isFalse();
	}

	/**
	 * AND ONLY THIS ACCOUNT'S SESSIONS - the same shape {@code SignOutApiTest} demands
	 * of signing out: a fix broad enough to end every session in the table would pass
	 * every case above, which never has a second account's session to lose.
	 */
	@Test
	void resettingLeavesAnotherAccountsSessionAlone() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);
		SecretToken theirs = aSessionFor(anAccount(aFreshAddress()));

		assertThat(reset(token, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(204);

		assertThat(me(theirs).getStatus())
				.as("resetting one account's password signed a different account out")
				.isEqualTo(200);
	}

	/**
	 * A FINISHED RESET RETIRES EVERY OTHER LIVE LINK OF THE SAME ACCOUNT - VISOK 2,
	 * security review of PR 292. Without this, an old link still sitting in a mail
	 * archive or a forwarded message sets the password again after the member who
	 * asked for this reset believes he is done, undoing it with nothing left to show
	 * that anything happened.
	 */
	@Test
	void resettingRetiresEveryOtherLiveTokenOfTheSameAccount() throws Exception {
		long account = anAccount(aFreshAddress());
		String first = aValidToken(account);
		String second = aValidToken(account);

		assertThat(reset(first, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(204);

		String secondPassword = "drugi.token.pokusaj.2027";
		MockHttpServletResponse answer = reset(second, secondPassword, secondPassword);

		assertThat(answer.getStatus())
				.as("a second live token for the very same account still worked after the first"
						+ " reset had already finished")
				.isEqualTo(400);
		assertThat(answer.getContentAsString())
				.isEqualTo("{\"reason\":\"" + PasswordResetApi.THE_LINK_IS_NOT_VALID + "\"}");
		assertThat(new StoredPassword().matches(secondPassword, passwordHashOf(account)))
				.as("a token that should have been retired overwrote the password the first one set")
				.isFalse();
	}

	/**
	 * AND ONLY THIS ACCOUNT'S OTHER TOKENS - the same axis
	 * {@code resettingLeavesAnotherAccountsSessionAlone} counts for VISOK 1. A fix
	 * broad enough to retire every live {@code password_reset_token} row in the
	 * table, not only this account's, would still pass the case above, which never
	 * has a second account's token to lose.
	 */
	@Test
	void resettingLeavesAnotherAccountsLiveTokenAlone() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);
		long another = anAccount(aFreshAddress());
		String theirToken = aValidToken(another);

		assertThat(reset(token, NEW_PASSWORD, NEW_PASSWORD).getStatus()).isEqualTo(204);

		String theirPassword = "njihova.sopstvena.lozinka.2027";
		MockHttpServletResponse answer = reset(theirToken, theirPassword, theirPassword);

		assertThat(answer.getStatus())
				.as("resetting one account's password retired a different account's still live token")
				.isEqualTo(204);
		assertThat(new StoredPassword().matches(theirPassword, passwordHashOf(another))).isTrue();
	}

	/**
	 * THE MESSAGE GOES TO THE ROW'S OWN SPELLING, NOT TO WHAT WAS TYPED - SREDNJI 3,
	 * security review of PR 292. The same property {@code RegistrationApiTest
	 * .theAddressIsStoredFoldedAndSigningInFindsItHoweverItIsTypedBack} measures for
	 * registration's own send, asked again here because a reset link is a second,
	 * independent place this portal addresses a message by an account.
	 *
	 * <p>Capitals and not a trailing space, unlike that other case: {@code
	 * withoutTheSpacesAround} already takes a space off before either spelling is
	 * compared, so a space could not tell the two apart. Case can, because
	 * {@code lower(email) = lower(?)} finds the same row whichever case asked, and
	 * only one of the two spellings is the mailbox the account was ever confirmed at.
	 */
	@Test
	void requestSendsToTheRowsOwnSpellingNotToWhatWasTyped() throws Exception {
		String stored = aFreshAddress();
		anAccount(stored);

		String typedInCapitals = stored.toUpperCase(Locale.ROOT);

		assertThat(typedInCapitals)
				.as("this case is written around two different spellings of one address, and"
						+ " capitalising it must actually produce a different string or it measures"
						+ " nothing")
				.isNotEqualTo(stored);

		assertThat(request(typedInCapitals).getStatus()).isEqualTo(204);

		assertThat(waitForOne().getAllRecipients()[0].toString())
				.as("the reset link went to the address as it was typed on the form rather than to"
						+ " the one the account itself carries")
				.isEqualTo(stored);
	}

	/**
	 * THE LINK IS JUDGED BEFORE THE PASSWORD - SREDNJI 4, security review of PR 292.
	 * {@code PasswordResetTest.theLinkIsJudgedBeforeThePassword} already proves this
	 * of the domain class; this proves the route actually asks it. Without this fix,
	 * an empty token turned this route into a way to run any password past the breach
	 * list for free: a breached password and a fine one, held against no token at
	 * all, read apart from each other and neither reading said anything about a link
	 * that was never there.
	 */
	@Test
	void aDeadLinkSaysTheSameThingWhicheverThePasswordIs() throws Exception {
		String leaked = theFirstLeakedPasswordTheListHolds();

		MockHttpServletResponse withALeakedPassword = reset(null, leaked, leaked);
		MockHttpServletResponse withAFinePassword = reset(null, NEW_PASSWORD, NEW_PASSWORD);

		assertThat(withALeakedPassword.getStatus())
				.as("an empty token told a leaked password apart from a fine one")
				.isEqualTo(withAFinePassword.getStatus());
		assertThat(withALeakedPassword.getContentAsString())
				.isEqualTo(withAFinePassword.getContentAsString())
				.isEqualTo("{\"reason\":\"" + PasswordResetApi.THE_LINK_IS_NOT_VALID + "\"}");
	}
}

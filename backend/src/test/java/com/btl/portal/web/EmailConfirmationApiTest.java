package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;

import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
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
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * CONFIRMING AN ADDRESS AND ASKING FOR THE LINK AGAIN, against a real database and a
 * real mail server - the same arrangement {@code RegistrationApiTest} uses and for the
 * same reason: {@code resend} sends after its own commit, and with nothing listening
 * every case here would be about a relay rather than about this route.
 *
 * <p>Its own port, on its own account addresses, so that {@code MailServerForACase}'s
 * own reason for existing (three classes once shared 3025 and one bind out of thirty
 * failed the lot) is not repeated a fourth time.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3327",
		"spring.mail.properties.mail.smtp.auth=false",
		"btl.portal.address=https://probni-portal.primer.rs"})
@Transactional
class EmailConfirmationApiTest {

	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3327));

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Value("${btl.portal.address}")
	private String portal;

	private int addresses;

	@BeforeEach
	void aFreshAddressForEveryCase() {
		/* EACH ACCOUNT AT ITS OWN ADDRESS, so a query that finds "the one row" is
		   never ambiguous about which case put it there. */
		addresses++;
	}

	private String aFreshAddress() {
		return "potvrda-" + addresses + "-" + System.nanoTime() + "@primer.rs";
	}

	/* `first_name`/`last_name` are `not null` since V23 ("the account carries its own
	   name"), unrelated to anything this class measures - a placeholder, the same one
	   `RightsAtTheDoorTest` uses for its own throwaway accounts. */
	private long anAccount(String email) {
		return db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'competitor'))"
						+ " returning id")
				.param(email).query(Long.class).single();
	}

	private long anAccount(String email, Instant confirmedAt) {
		long account = anAccount(email);

		db.sql("update account set email_confirmed_at = ? where id = ?")
				.params(java.sql.Timestamp.from(confirmedAt), account).update();

		return account;
	}

	/** A live token for that account, and the secret half of it. */
	private String aValidToken(long account) {
		SecretToken token = SecretToken.fresh();

		db.sql("insert into email_verification_token (account_id, token_hash) values (?, ?)")
				.params(account, token.hash()).update();

		return token.secret();
	}

	/** The same, born already expired. */
	private String anExpiredToken(long account) {
		SecretToken token = SecretToken.fresh();

		db.sql("insert into email_verification_token (account_id, token_hash, expires_at)"
						+ " values (?, ?, now() - interval '1 second')")
				.params(account, token.hash()).update();

		return token.secret();
	}

	private Instant confirmedAtOf(long account) {
		return db.sql("select email_confirmed_at from account where id = ?")
				.param(account).query(java.sql.Timestamp.class).single().toInstant();
	}

	private boolean isConfirmed(long account) {
		return db.sql("select email_confirmed_at is not null from account where id = ?")
				.param(account).query(Boolean.class).single();
	}

	private MockHttpServletResponse confirm(String token) throws Exception {
		return http.perform(post("/api/email-confirmation").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"token\":" + quoteOrNull(token) + "}"))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse resend(String email) throws Exception {
		return http.perform(post("/api/email-confirmation/resend").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":" + quoteOrNull(email) + "}"))
				.andReturn().getResponse();
	}

	private static String quoteOrNull(String value) {
		return value == null ? "null" : "\"" + value + "\"";
	}

	private MimeMessage waitForOne() {
		assertThat(SMTP.waitForIncomingEmail(5000, 1))
				.as("no message reached the mail server in five seconds")
				.isTrue();

		return SMTP.getReceivedMessages()[0];
	}

	/** The token out of the link in a message, the same reader {@code RegistrationApiTest}
	 *  keeps, kept here too rather than shared, so that neither file's test helpers are a
	 *  dependency the other has to know about. */
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

	@Test
	void aValidTokenConfirmsTheAddress() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = aValidToken(account);

		MockHttpServletResponse answer = confirm(token);

		assertThat(answer.getStatus()).isEqualTo(204);
		assertThat(isConfirmed(account)).isTrue();
	}

	@Test
	void anExpiredTokenIsRefused() throws Exception {
		long account = anAccount(aFreshAddress());
		String token = anExpiredToken(account);

		MockHttpServletResponse answer = confirm(token);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString())
				.isEqualTo("{\"reason\":\"" + EmailConfirmationApi.THE_LINK_IS_NOT_VALID + "\"}");
		assertThat(isConfirmed(account))
				.as("a link that had already run out confirmed the address anyway")
				.isFalse();
	}

	@Test
	void aTokenNobodyHasIsRefused() throws Exception {
		MockHttpServletResponse answer = confirm(SecretToken.fresh().secret());

		assertThat(answer.getStatus()).isEqualTo(400);
	}

	@Test
	void aBlankOrMissingTokenIsRefused() throws Exception {
		assertThat(confirm(null).getStatus()).isEqualTo(400);
		assertThat(confirm("").getStatus()).isEqualTo(400);
		assertThat(confirm("   ").getStatus()).isEqualTo(400);
	}

	/**
	 * THE TOKEN IS HASHED BEFORE IT IS EVER COMPARED, so the value the row actually
	 * holds is refused when it is sent back AS IF it were the secret. Were the
	 * comparison written the other way round - the column read literally and compared
	 * with what arrived - this would be the one case that catches it, because a hash
	 * is not its own preimage.
	 */
	@Test
	void theStoredHashDoesNotConfirmAnythingWhenItIsSentBackAsTheToken() throws Exception {
		long account = anAccount(aFreshAddress());
		aValidToken(account);

		String hashInTheRow = db.sql("select token_hash from email_verification_token"
						+ " where account_id = ?")
				.param(account).query(String.class).single();

		assertThat(confirm(hashInTheRow).getStatus()).isEqualTo(400);
		assertThat(isConfirmed(account)).isFalse();
	}

	@Test
	void confirmingOneAccountsTokenDoesNotConfirmAnother() throws Exception {
		long first = anAccount(aFreshAddress());
		long second = anAccount(aFreshAddress());
		String tokenForSecond = aValidToken(second);

		assertThat(confirm(tokenForSecond).getStatus()).isEqualTo(204);

		assertThat(isConfirmed(second)).isTrue();
		assertThat(isConfirmed(first))
				.as("a token minted for one account confirmed a different one")
				.isFalse();
	}

	@Test
	void confirmingATokenTwiceKeepsTheFirstMoment() throws Exception {
		Instant firstMoment = Instant.parse("2026-01-01T00:00:00Z");
		long account = anAccount(aFreshAddress(), firstMoment);
		/* A second, still live link for the same, already confirmed account - V6
		   allows exactly this (no unique key over account_id). */
		String secondToken = aValidToken(account);

		assertThat(confirm(secondToken).getStatus()).isEqualTo(204);
		assertThat(confirmedAtOf(account))
				.as("a second click overwrote when the address was really first confirmed")
				.isEqualTo(firstMoment);
	}

	@Test
	void aRequestWithNoFormAtAllNeverReachesUs() throws Exception {
		MockHttpServletResponse answer = http.perform(post("/api/email-confirmation").with(csrf())
						.contentType(MediaType.APPLICATION_JSON))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(400);
	}

	@Test
	void resendSendsAFreshLinkToAnUnconfirmedAddress() throws Exception {
		String email = aFreshAddress();
		long account = anAccount(email);

		assertThat(resend(email).getStatus()).isEqualTo(204);

		String secret = theTokenInside(waitForOne().getContent().toString());
		long opens = db.sql("select account_id from email_verification_token where token_hash = ?")
				.param(SecretToken.hashOf(secret)).query(Long.class).single();

		assertThat(opens).isEqualTo(account);
	}

	@Test
	void resendGivesTheSameAnswerWhetherOrNotTheAddressExists() throws Exception {
		String realAddress = aFreshAddress();
		anAccount(realAddress);

		MockHttpServletResponse forARealAddress = resend(realAddress);
		MockHttpServletResponse forNoAddressAtAll = resend(aFreshAddress());

		assertThat(forARealAddress.getStatus())
				.as("asking for the link again told apart an address that belongs to somebody"
						+ " from one that does not")
				.isEqualTo(forNoAddressAtAll.getStatus());
		assertThat(forNoAddressAtAll.getContentAsString()).isEqualTo(forARealAddress.getContentAsString());
	}

	@Test
	void resendToAnAddressNobodyHoldsSendsNothing() throws Exception {
		assertThat(resend(aFreshAddress()).getStatus()).isEqualTo(204);
		assertThat(SMTP.getReceivedMessages())
				.as("a message went out for an address that names no account")
				.isEmpty();
	}

	@Test
	void resendToAnAlreadyConfirmedAddressSendsNothing() throws Exception {
		String email = aFreshAddress();
		anAccount(email, Instant.now());

		assertThat(resend(email).getStatus()).isEqualTo(204);
		assertThat(SMTP.getReceivedMessages())
				.as("an address that has nothing left to confirm was mailed a confirmation link")
				.isEmpty();
	}

	@Test
	void aBlankOrMissingEmailSendsNothing() throws Exception {
		assertThat(resend(null).getStatus()).isEqualTo(204);
		assertThat(resend("").getStatus()).isEqualTo(204);
		assertThat(SMTP.getReceivedMessages()).isEmpty();
	}

	/**
	 * THE LINK IS BUILT FROM THE SETTING AND NOT FROM WHOEVER ASKED, the same property
	 * {@code RegistrationApiTest.theLinkIsBuiltFromTheSettingAndNotFromWhoeverAsked}
	 * measures for registration's own message, asked again here because resending
	 * builds a message through a second, independent call to the same {@code Portal}.
	 */
	@Test
	void resendBuildsTheLinkFromTheSettingAndNotFromWhoeverAsked() throws Exception {
		String email = aFreshAddress();
		anAccount(email);

		MockHttpServletResponse answer = http.perform(post("/api/email-confirmation/resend")
						.with(csrf())
						.header("Host", "zlo.rs")
						.header("X-Forwarded-Host", "zlo.rs")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"" + email + "\"}"))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(204);

		String body = waitForOne().getContent().toString();

		assertThat(body).doesNotContain("zlo.rs")
				.contains(portal + Message.CONFIRM_THE_ADDRESS.path() + "?token=");
	}

	/**
	 * A RELAY THAT REFUSES THE MESSAGE STILL LEAVES THE FRESH TOKEN BEHIND, the same
	 * shape {@code RegistrationOverRealHttpTest} measures at length for registration's
	 * own send. The deeper property that suite proves with a real socket - that the
	 * commit is a real one, independent of what this test's own transaction does at
	 * the end - is not reproved here: this route's write-then-send shape is the exact
	 * one already measured there, over the same {@code TransactionTemplate} and the
	 * same pool, and what is new in this class is the lookup, not the transaction
	 * boundary. What this case does prove, which nothing else here can, is that a
	 * relay saying no does not turn into a 500 or an undone row.
	 */
	@Test
	void aRelayThatRefusesTheMessageStillLeavesTheTokenBehind() throws Exception {
		String email = aFreshAddress();
		long account = anAccount(email);

		SMTP.getSmtp().stopService();

		MockHttpServletResponse answer = resend(email);

		assertThat(answer.getStatus())
				.as("a relay that would not take the message turned a successful resend into an"
						+ " error")
				.isEqualTo(204);
		assertThat(db.sql("select count(*) from email_verification_token where account_id = ?")
				.param(account).query(Integer.class).single())
				.as("the fresh token did not survive a relay that refused the message")
				.isOne();
	}
}

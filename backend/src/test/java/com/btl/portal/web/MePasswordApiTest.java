package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A MEMBER CHANGING HIS PASSWORD WHILE SIGNED IN: THE OLD ONE IS ASKED FOR, AND EVERY OTHER
 * SESSION ENDS.
 *
 * <p>Owner, PDL P28b, 5, 24.09.2026, between offered outcomes: „Promena lozinke dok je clan
 * prijavljen trazi STARU lozinku i ODJAVLJUJE SVE OSTALE SESIJE. Razlog: ako se lozinka
 * menja zbog sumnje da je neko zna, promena bez odjave ne resava nista."
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on every axis an assertion
 * reads a value along. Each of these is a way this whole file could be green and measure
 * nothing:
 *
 * <ul>
 * <li><b>THREE PEOPLE, AND THE ONE WHO ASKS IS WRITTEN SECOND.</b> „The account asking" and
 * „the first account by key" are then different rows, so a statement that lost its condition
 * answers differently.
 * <li><b>EVERY PASSWORD IS DIFFERENT AND NONE IS SHARED.</b> Measured over a fixture where
 * two members have one password, „his old password" and „somebody's old password" are one
 * answer.
 * <li><b>THE MEMBER WHO ASKS HOLDS THREE SESSIONS AND NOT ONE.</b> With one, „every other
 * session ended" and „every session ended" are one answer, and the route could sign him out
 * of the browser he is typing in and still pass. The one he asks FROM is deliberately not
 * the first he opened, so „the one that survives" is never „the oldest".
 * <li><b>SOMEBODY ELSE HOLDS SESSIONS TOO</b>, so „every other session of THIS account" is
 * never „every session in the table".
 * <li><b>The new password is never the old one and never anybody else's</b>, so a statement
 * that wrote the wrong parameter comes back visibly wrong rather than accidentally right.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MePasswordApiTest {

	/** Written first, asks for nothing, and must never move. */
	private static final String FIRST_WRITTEN = "prvi@primer.rs";

	/** The one who asks, written SECOND. */
	private static final String ME = "ja@primer.rs";

	/** Somebody else with sessions of his own, so „his" is never „every". */
	private static final String SOMEBODY_ELSE = "neko-drugi@primer.rs";

	/** An account that holds a session and no password at all, which V18 makes a real state. */
	private static final String NEVER_SET_A_PASSWORD = "pocasni@primer.rs";

	private static final String MY_OLD_PASSWORD = "moja.stara.lozinka.2026";

	private static final String MY_NEW_PASSWORD = "moja.nova.lozinka.2027";

	/** Nobody else's is ever mine, which is what makes „the right row" measurable. */
	private static final String SOMEBODY_ELSES_PASSWORD = "tudja.lozinka.koja.nije.moja";

	private static final String FIRST_WRITTENS_PASSWORD = "prva.lozinka.u.tabeli.2026";

	/**
	 * A password that is long enough and is on the list of the leaked.
	 *
	 * <p>Read out of the portal's own list rather than guessed at, for the reason
	 * {@code BreachedPasswords} gives about the list being a file: a word written here that
	 * the file does not hold would make the case green by measuring the wrong refusal.
	 */
	private static final String A_LEAKED_PASSWORD = "passwordpassword";

	private static final String NOTHING_IS_THERE = "/api/nema-ovoga";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	/** Every session that was opened, by the address that holds it, in the order opened. */
	private final Map<String, List<SecretToken>> sessions = new HashMap<>();

	@BeforeEach
	void fourAccountsAndSixSessions() {
		account(FIRST_WRITTEN, FIRST_WRITTENS_PASSWORD, 1);
		account(ME, MY_OLD_PASSWORD, 3);
		account(SOMEBODY_ELSE, SOMEBODY_ELSES_PASSWORD, 2);
		account(NEVER_SET_A_PASSWORD, null, 1);
	}

	private void account(String email, String password, int howManySessions) {
		db.sql("insert into account (first_name, last_name, email, role_id, password_hash)"
						+ " values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'competitor'), ?)")
				.params(email, password == null ? null : new StoredPassword().of(password))
				.update();

		sessions.put(email, new ArrayList<>());

		for (int i = 0; i < howManySessions; i++) {
			openSession(email);
		}
	}

	private void openSession(String email) {
		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.get(email).add(session);
	}

	/**
	 * The session a case asks FROM, and it is the SECOND of the three rather than the first.
	 *
	 * <p>„The one that survives" and „the oldest one" are then two different rows, so a
	 * delete written as „keep the first" rather than „keep the one that asked" is caught.
	 */
	private String theSessionIAskFrom() {
		return sessions.get(ME).get(1).secret();
	}

	private long accountOf(String email) {
		return db.sql("select id from account where email = ?").param(email).query(Long.class)
				.single();
	}

	private String passwordHashOf(String email) {
		return db.sql("select password_hash from account where email = ?").param(email)
				.query(String.class).optional().orElse(null);
	}

	private long howManySessionsOf(String email) {
		return db.sql("select count(*) from account_session where account_id = ?")
				.param(accountOf(email)).query(Long.class).single();
	}

	private boolean stillOpen(SecretToken session) {
		return db.sql("select count(*) from account_session where token_hash = ?")
				.param(session.hash()).query(Long.class).single() == 1;
	}

	private String body(String oldPassword, String password, String repeat) {
		Map<String, Object> typed = new LinkedHashMap<>();

		typed.put("oldPassword", oldPassword);
		typed.put("password", password);
		typed.put("passwordRepeat", repeat);

		return mapper.writeValueAsString(typed);
	}

	private MockHttpServletResponse asking(String cookie, String body) throws Exception {
		return http.perform(put("/api/me/password").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(body)
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	/**
	 * THE WHOLE ERRAND: the password moves, the other two sessions go, and the one that
	 * asked goes on answering.
	 *
	 * <p><b>The session is proved still open by USING it</b>, against {@code GET /api/me},
	 * rather than by counting a row. A row that is there and a cookie the chain still lets
	 * through are two different claims, and the member's word for „am I still signed in" is
	 * the second.
	 */
	@Test
	void thePasswordMovesAndEveryOtherSessionEnds() throws Exception {
		MockHttpServletResponse answer = asking(theSessionIAskFrom(),
				body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD));

		assertThat(answer.getStatus()).isEqualTo(204);

		assertThat(new StoredPassword().matches(MY_NEW_PASSWORD, passwordHashOf(ME)))
				.as("the new password was not written")
				.isTrue();
		assertThat(new StoredPassword().matches(MY_OLD_PASSWORD, passwordHashOf(ME)))
				.as("the old password still opens the account")
				.isFalse();

		assertThat(stillOpen(sessions.get(ME).get(0)))
				.as("a session this member did not ask from is still open, so the owner's"
						+ " sentence about every OTHER session has not happened")
				.isFalse();
		assertThat(stillOpen(sessions.get(ME).get(2))).isFalse();

		assertThat(stillOpen(sessions.get(ME).get(1)))
				.as("the row of the session that asked is gone, so the member signed himself out"
						+ " of the browser he is typing in")
				.isTrue();

		assertThat(http.perform(get("/api/me")
						.cookie(new Cookie(SessionCookie.NAME, theSessionIAskFrom())))
				.andReturn().getResponse().getStatus())
				.as("the session that asked no longer opens anything, which is the portal"
						+ " answering 204 and then refusing him everything")
				.isEqualTo(200);
	}

	/**
	 * AND NOBODY ELSE IS SIGNED OUT BY IT.
	 *
	 * <p><b>The mutation this is written against:</b> a delete that lost its
	 * {@code account_id}, which a fixture with one account in it could never see.
	 */
	@Test
	void nobodyElseIsSignedOutAndNobodyElsesPasswordMoves() throws Exception {
		assertThat(asking(theSessionIAskFrom(),
				body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD)).getStatus())
				.isEqualTo(204);

		assertThat(howManySessionsOf(SOMEBODY_ELSE))
				.as("somebody else was signed out of everything by a password this member changed")
				.isEqualTo(2);
		assertThat(howManySessionsOf(FIRST_WRITTEN)).isEqualTo(1);

		assertThat(new StoredPassword().matches(SOMEBODY_ELSES_PASSWORD,
				passwordHashOf(SOMEBODY_ELSE)))
				.as("somebody else's password was written over")
				.isTrue();
		assertThat(new StoredPassword().matches(FIRST_WRITTENS_PASSWORD,
				passwordHashOf(FIRST_WRITTEN)))
				.as("the first account by key had its password changed by another account's"
						+ " request")
				.isTrue();
	}

	/**
	 * A WRONG OLD PASSWORD CHANGES NOTHING AND ENDS NOTHING.
	 *
	 * <p>Three things are asserted and the third is the one worth naming: a refusal must not
	 * have signed anybody out on the way to being refused. The route is one transaction, so
	 * this also measures that the refusal happens before either statement rather than after
	 * one of them.
	 */
	@Test
	void aWrongOldPasswordChangesNothingAndEndsNothing() throws Exception {
		MockHttpServletResponse answer = asking(theSessionIAskFrom(),
				body("ovo.nije.moja.stara.lozinka", MY_NEW_PASSWORD, MY_NEW_PASSWORD));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePasswordApi.THE_OLD_PASSWORD_IS_WRONG);

		assertThat(new StoredPassword().matches(MY_OLD_PASSWORD, passwordHashOf(ME)))
				.as("the password moved although the request was refused")
				.isTrue();
		assertThat(howManySessionsOf(ME))
				.as("a refused request signed the member out of his other devices")
				.isEqualTo(3);
	}

	/**
	 * AND SOMEBODY ELSE'S PASSWORD IS NOT „THE OLD ONE" EITHER.
	 *
	 * <p><b>The mutation this is written against:</b> a lookup that reads {@code password_hash}
	 * without naming the account - which a fixture where everybody shares a password could
	 * never see, and which is why no two accounts here share one.
	 */
	@Test
	void anotherMembersPasswordIsNotThisMembersOldOne() throws Exception {
		assertThat(reasonIn(asking(theSessionIAskFrom(),
				body(SOMEBODY_ELSES_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD))))
				.as("a password belonging to another account was taken as this member's old one")
				.isEqualTo(MePasswordApi.THE_OLD_PASSWORD_IS_WRONG);

		assertThat(new StoredPassword().matches(MY_OLD_PASSWORD, passwordHashOf(ME))).isTrue();
	}

	/**
	 * AN ACCOUNT THAT NEVER HAD A PASSWORD IS TOLD THE OLD ONE IS WRONG.
	 *
	 * <p>V18 makes {@code password_hash} nullable on purpose, for honorary members and for
	 * invited moderators. Such an account cannot sign in, so what holds a session for it is a
	 * row written some other way - which is exactly this fixture. What must not happen is a
	 * 500: {@code StoredPassword.matches} is never handed a null to compare against.
	 */
	@Test
	void anAccountThatNeverHadAPasswordIsNotGivenOneByThisRoute() throws Exception {
		MockHttpServletResponse answer = asking(
				sessions.get(NEVER_SET_A_PASSWORD).get(0).secret(),
				body("bilo.sta.sto.neko.otkuca", MY_NEW_PASSWORD, MY_NEW_PASSWORD));

		assertThat(answer.getStatus())
				.as("an account with no password came back as something other than a refusal,"
						+ " which is what comparing against a null looks like")
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePasswordApi.THE_OLD_PASSWORD_IS_WRONG);

		assertThat(passwordHashOf(NEVER_SET_A_PASSWORD))
				.as("a route that asks for an old password gave one to an account that had none")
				.isNull();
	}

	/**
	 * A FORM THAT IS NOT COMPLETE, in every way it can fail to be.
	 *
	 * <p>One answer for all of them, which is {@link PasswordResetApi}'s own arrangement and
	 * its reason: the fix the member makes is the same one. Each row is a different box, so
	 * a condition that lost one of the three is caught.
	 */
	@ParameterizedTest
	@CsvSource({
			"'', nova.lozinka.koja.valja, nova.lozinka.koja.valja",
			"moja.stara.lozinka.2026, '', ''",
			"moja.stara.lozinka.2026, nova.lozinka.koja.valja, '   '",
			"moja.stara.lozinka.2026, nova.lozinka.koja.valja, druga.lozinka.koja.valja",
			"moja.stara.lozinka.2026, kratka, kratka" })
	void aFormThatIsNotCompleteChangesNothing(String old, String password, String repeat)
			throws Exception {

		MockHttpServletResponse answer = asking(theSessionIAskFrom(),
				body(old.isEmpty() ? null : old, password.isEmpty() ? null : password,
						repeat.isEmpty() ? null : repeat));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePasswordApi.THE_FORM_IS_NOT_COMPLETE);

		assertThat(new StoredPassword().matches(MY_OLD_PASSWORD, passwordHashOf(ME))).isTrue();
		assertThat(howManySessionsOf(ME)).isEqualTo(3);
	}

	/**
	 * A NEW PASSWORD THAT HAS ALREADY LEAKED IS TOLD SO, AND IT IS A DIFFERENT SENTENCE.
	 *
	 * <p>{@link RegistrationApi}'s reason for telling it apart: it is the one fix nobody
	 * could have known about before pressing the button. A member told „the form is not
	 * complete" would type the same thing again with a digit on the end.
	 */
	@Test
	void aLeakedPasswordIsRefusedAndSaidToBeLeaked() throws Exception {
		MockHttpServletResponse answer = asking(theSessionIAskFrom(),
				body(MY_OLD_PASSWORD, A_LEAKED_PASSWORD, A_LEAKED_PASSWORD));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("a password on the portal's own list of leaked ones was either taken or"
						+ " refused as though the form were incomplete")
				.isEqualTo(MePasswordApi.THE_PASSWORD_HAS_LEAKED);

		assertThat(new StoredPassword().matches(MY_OLD_PASSWORD, passwordHashOf(ME))).isTrue();
	}

	/**
	 * AND THE OLD PASSWORD IS JUDGED FIRST, WHICH IS WHAT KEEPS THE ANSWER FROM SAYING
	 * ANYTHING ABOUT THE NEW ONE.
	 *
	 * <p>{@link PasswordResetApi}'s correction of 12.09.2026, applied to the thing that
	 * stands in for its link. Judged the other way round, somebody who typed the old password
	 * wrongly would still be told whether his new one is on the list - an answer about a
	 * password the portal is not going to store, to somebody who has not proved he may store
	 * one.
	 *
	 * <p><b>The mutation this is written against:</b> swapping the two blocks. The case then
	 * answers {@code thePasswordHasLeaked} instead.
	 */
	@Test
	void theOldPasswordIsJudgedBeforeTheNewOne() throws Exception {
		assertThat(reasonIn(asking(theSessionIAskFrom(),
				body("ovo.nije.moja.stara.lozinka", A_LEAKED_PASSWORD, A_LEAKED_PASSWORD))))
				.as("a wrong old password was still told something about the new one")
				.isEqualTo(MePasswordApi.THE_OLD_PASSWORD_IS_WRONG);
	}

	/**
	 * THE LOCK IS LIFTED, and it is reachable rather than tidy.
	 *
	 * <p>An account is locked by somebody ELSE guessing at it (V18,
	 * {@code account_locked_only_after_enough_failures} requires ten failures behind any
	 * lock), and the member whose laptop is still signed in is the one person who can end
	 * that by moving the password. Left standing, the portal would tell a member who just
	 * proved he knows his own password to come back in fifteen minutes.
	 */
	@Test
	void changingThePasswordEndsALockSomebodyElseCaused() throws Exception {
		db.sql("update account set failed_sign_ins = 10, locked_until = ? where id = ?")
				.params(Timestamp.from(Instant.now().plus(Duration.ofMinutes(15))), accountOf(ME))
				.update();

		assertThat(asking(theSessionIAskFrom(),
				body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD)).getStatus())
				.isEqualTo(204);

		Map<String, Object> after = db.sql("select failed_sign_ins, locked_until from account"
				+ " where id = ?").param(accountOf(ME)).query().singleRow();

		assertThat(((Number) after.get("failed_sign_ins")).intValue())
				.as("the count of failed attempts survived a password the member proved he owns")
				.isZero();
		assertThat(after.get("locked_until"))
				.as("the account is still locked after its owner changed its password")
				.isNull();
	}

	@Test
	void somebodyWhoIsNotSignedInIsAskedToSignIn() throws Exception {
		MockHttpServletResponse answer = http.perform(put("/api/me/password").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD)))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(401);
		assertThat(new StoredPassword().matches(MY_OLD_PASSWORD, passwordHashOf(ME))).isTrue();
	}

	/**
	 * AND A WRITE THAT NAMES NO TYPE IS AN ADDRESS THAT IS NOT THERE.
	 *
	 * <p>The same sentence {@code MeWriteApiTest} measures for its own mapping: 415 would say
	 * „this address is here and takes something else". Compared against an address that maps
	 * nothing rather than against a number written down.
	 */
	@Test
	void aWriteThatNamesNoTypeIsAnAddressThatIsNotThere() throws Exception {
		MockHttpServletResponse answer = http.perform(put("/api/me/password").with(csrf())
						.content(body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD))
						.cookie(new Cookie(SessionCookie.NAME, theSessionIAskFrom())))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(404);

		assertThat(http.perform(put(NOTHING_IS_THERE).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, theSessionIAskFrom())))
				.andReturn().getResponse().getStatus())
				.as("an address that maps nothing no longer answers 404, so there is nothing"
						+ " being compared here")
				.isEqualTo(answer.getStatus());
	}
}

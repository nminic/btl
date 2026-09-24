package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.account.SignIn;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
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
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3331",
		"spring.mail.properties.mail.smtp.auth=false",
		"btl.portal.address=https://probni-portal.primer.rs"})
@Transactional
class MePasswordApiTest {

	/**
	 * A REAL MAIL SERVER, ON A PORT OF THIS CLASS'S OWN.
	 *
	 * <p>The same arrangement the other four sending routes have, and 3331 because 3325 to
	 * 3330 are already taken. {@link MailServerForACase} says why the number is handed in
	 * rather than counted here, and what sharing one costs: twenty-nine errors in one class,
	 * every one of them a failure to bind, with not a single case run and an exit code that
	 * reads exactly like a caught mutation.
	 */
	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3331));

	/** Written first, asks for nothing, and must never move. */
	private static final String FIRST_WRITTEN = "prvi@primer.rs";

	/** The one who asks, written SECOND. */
	private static final String ME = "ja@primer.rs";

	/** Somebody else with sessions of his own, so „his" is never „every". */
	private static final String SOMEBODY_ELSE = "neko-drugi@primer.rs";

	/** An account that holds a session and no password at all, which V18 makes a real state. */
	private static final String NEVER_SET_A_PASSWORD = "pocasni@primer.rs";

	/**
	 * An account holding a session whose address nobody has confirmed.
	 *
	 * <p><b>The same shape as {@link #NEVER_SET_A_PASSWORD} and for the same reason.</b> The
	 * portal as it runs cannot make one - {@code SignIn} refuses an unconfirmed address before
	 * anything else, and signing in is the only thing that mints a session - so what holds one
	 * is a row written by hand, by a migration or by an import. That is exactly the case
	 * {@code SignIn.decide} keeps a branch for, and this route inherits it by asking that
	 * class rather than judging the password itself.
	 */
	private static final String ADDRESS_NEVER_CONFIRMED = "nepotvrdjen@primer.rs";

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
		accountWithNoConfirmedAddress(ADDRESS_NEVER_CONFIRMED);
	}

	/** The same as {@link #account}, with the one column left empty that the portal fills. */
	private void accountWithNoConfirmedAddress(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id, password_hash)"
						+ " values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'competitor'), ?)")
				.params(email, new StoredPassword().of(MY_OLD_PASSWORD))
				.update();

		sessions.put(email, new ArrayList<>());
		openSession(email);
	}

	/**
	 * An account with a confirmed address, and the confirmation is not decoration.
	 *
	 * <p><b>It is what a session MEANS.</b> {@code SignIn} refuses an unconfirmed address
	 * before it asks anything else - „Potvrda mejla je obavezan uslov za aktivaciju naloga"
	 * (PDL P22) - and {@code SignInApi} is the only thing in this portal that mints a session
	 * row. So an account holding one has a confirmed address by construction, and a fixture
	 * that left the column empty was describing a state the portal cannot be in.
	 *
	 * <p>It began to matter on 25.09.2026, when this route stopped judging the old password
	 * itself and started asking {@link SignIn#decide} - which reads that column, as it must.
	 * Nine cases went red at once and every one of them was the fixture rather than the route.
	 */
	private void account(String email, String password, int howManySessions) {
		db.sql("insert into account (first_name, last_name, email, role_id, password_hash,"
						+ " email_confirmed_at) values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'competitor'), ?, now())")
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

	private MimeMessage waitForOne() {
		assertThat(SMTP.waitForIncomingEmail(5000, 1))
				.as("no message reached the mail server in five seconds")
				.isTrue();

		return SMTP.getReceivedMessages()[0];
	}

	/** Subject and body as one string, which is what „nothing of his leaked" is asked over. */
	private static String wholeOf(MimeMessage message) throws Exception {
		return message.getSubject() + "\n" + message.getContent().toString();
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
	 * AN ADDRESS NOBODY HAS CONFIRMED IS NOT A WAY IN HERE EITHER, AND NO MISS IS COUNTED.
	 *
	 * <p>{@code SignIn} refuses it before it asks anything else, quoting PDL: „Potvrda adrese
	 * elektronske poste je prva, i uslov za sve ostalo." This route inherits that by asking
	 * that class instead of comparing the password itself, and the case is here because the
	 * inheritance is the whole point: a second copy of the rule would have had five branches
	 * to get right and this is one of them.
	 *
	 * <p><b>The password used is the RIGHT one</b>, so what is measured is the address and not
	 * the password - handed a wrong one, „refused because unconfirmed" and „refused because
	 * wrong" would be one answer and this case would say nothing.
	 *
	 * <p><b>AND NOTHING IS COUNTED AGAINST IT</b>, which is {@code SignIn}'s own reason: a
	 * miss counted at an account nobody can yet sign in to would let a stranger shut it for
	 * ever, before its owner had once used it.
	 */
	@Test
	void anAddressNobodyHasConfirmedIsNotAWayIn() throws Exception {
		MockHttpServletResponse answer = asking(
				sessions.get(ADDRESS_NEVER_CONFIRMED).get(0).secret(),
				body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD));

		assertThat(answer.getStatus())
				.as("an account whose address nobody has confirmed changed its password, so the"
						+ " first condition of all is not being asked on this door")
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePasswordApi.THE_OLD_PASSWORD_IS_WRONG);

		assertThat(new StoredPassword().matches(MY_OLD_PASSWORD,
				passwordHashOf(ADDRESS_NEVER_CONFIRMED)))
				.as("the password moved although the request was refused")
				.isTrue();

		assertThat(((Number) db.sql("select failed_sign_ins from account where email = ?")
				.param(ADDRESS_NEVER_CONFIRMED).query(Integer.class).single()).intValue())
				.as("a miss was counted against an account nobody can sign in to, so a stranger"
						+ " could shut it for ever before its owner ever used it")
				.isZero();
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
	 * GUESSING AT THE OLD PASSWORD IS COUNTED, AND THE TENTH MISS SHUTS THE ACCOUNT.
	 *
	 * <p><b>Owner, ADL A43.1, 11.09.2026: „zakljucavanje | posle 10 neuspelih pokusaja, 15
	 * minuta".</b> Until a security review on 25.09.2026 this route enforced none of it:
	 * twenty-five wrong old passwords in a row were twenty-five plain refusals,
	 * {@code failed_sign_ins} stayed at nought and {@code locked_until} stayed null. That is
	 * an unlimited oracle behind the very door this route asks for the old password to
	 * protect - somebody holding a stolen cookie could guess without limit and without a
	 * trace.
	 *
	 * <p><b>Both sides of the boundary, because one side is not a boundary.</b> At nine
	 * misses the account is counted and still open; the tenth shuts it. The numbers come off
	 * {@link SignIn#ENOUGH_MISSES_TO_LOCK} rather than being typed here, so the day the owner
	 * moves his number this case moves with it instead of quietly measuring the old one.
	 */
	@Test
	void guessingAtTheOldPasswordIsCountedAndTheTenthMissShutsTheAccount() throws Exception {
		for (int miss = 1; miss < SignIn.ENOUGH_MISSES_TO_LOCK; miss++) {
			assertThat(reasonIn(asking(theSessionIAskFrom(),
					body("pogresna.lozinka.broj." + miss, MY_NEW_PASSWORD, MY_NEW_PASSWORD))))
					.isEqualTo(MePasswordApi.THE_OLD_PASSWORD_IS_WRONG);
		}

		Map<String, Object> afterNine = db.sql("select failed_sign_ins, locked_until from account"
				+ " where id = ?").param(accountOf(ME)).query().singleRow();

		assertThat(((Number) afterNine.get("failed_sign_ins")).intValue())
				.as("guesses at the old password are not counted at all, so this address is an"
						+ " unlimited oracle and ADL A43.1 is enforced on one door only")
				.isEqualTo(SignIn.ENOUGH_MISSES_TO_LOCK - 1);
		assertThat(afterNine.get("locked_until"))
				.as("the account was shut before the owner's tenth miss")
				.isNull();

		assertThat(reasonIn(asking(theSessionIAskFrom(),
				body("pogresna.lozinka.deseta", MY_NEW_PASSWORD, MY_NEW_PASSWORD))))
				.isEqualTo(MePasswordApi.THE_OLD_PASSWORD_IS_WRONG);

		assertThat(db.sql("select locked_until from account where id = ?")
				.param(accountOf(ME)).query(java.sql.Timestamp.class).optional())
				.as("the tenth miss did not shut the account, so the lock the owner decided on"
						+ " never arrives through this door")
				.isPresent();
	}

	/**
	 * AND A LOCKED ACCOUNT IS NOT OPENED BY THE RIGHT PASSWORD EITHER, OR THE LOCK IS A
	 * SUGGESTION.
	 *
	 * <p>{@code SignIn} says it in those words about its own door, and it is the same rule
	 * here because it is the same rule: the decision names ten attempts and does not name a
	 * door. Measured before the fix, an account locked BY HAND went on answering as though it
	 * were open.
	 *
	 * <p><b>The answer is the one a wrong password gets</b>, deliberately: told apart, the
	 * refusal becomes a way of asking what state an account is in.
	 */
	@Test
	void anAccountThatIsShutStaysShutEvenForTheRightOldPassword() throws Exception {
		db.sql("update account set failed_sign_ins = ?, locked_until = ? where id = ?")
				.params(SignIn.ENOUGH_MISSES_TO_LOCK,
						Timestamp.from(Instant.now().plus(SignIn.LOCKED_FOR)), accountOf(ME))
				.update();

		MockHttpServletResponse answer = asking(theSessionIAskFrom(),
				body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD));

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("a locked account is told something different from a wrong password, which"
						+ " turns the refusal into a way of asking what state it is in")
				.isEqualTo(MePasswordApi.THE_OLD_PASSWORD_IS_WRONG);

		assertThat(new StoredPassword().matches(MY_OLD_PASSWORD, passwordHashOf(ME)))
				.as("A SHUT ACCOUNT LET ITS PASSWORD BE CHANGED, so the lock is a suggestion")
				.isTrue();
		assertThat(howManySessionsOf(ME))
				.as("a refused request still signed the member out of his other devices")
				.isEqualTo(3);
	}

	/**
	 * A LOCK THAT HAS RUN OUT IS OVER, which is the other side of the same boundary.
	 *
	 * <p>Without this, „the lock is respected" and „a locked account is shut for ever" are one
	 * answer, and the fifteen minutes the owner chose would be a number nothing reads.
	 */
	@Test
	void aLockThatHasRunOutDoesNotStandInTheWay() throws Exception {
		db.sql("update account set failed_sign_ins = ?, locked_until = ? where id = ?")
				.params(SignIn.ENOUGH_MISSES_TO_LOCK,
						Timestamp.from(Instant.now().minus(Duration.ofMinutes(1))), accountOf(ME))
				.update();

		assertThat(asking(theSessionIAskFrom(),
				body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD)).getStatus())
				.as("a lock that ran out a minute ago is still shutting the door, so the fifteen"
						+ " minutes the owner chose mean nothing")
				.isEqualTo(204);

		assertThat(new StoredPassword().matches(MY_NEW_PASSWORD, passwordHashOf(ME))).isTrue();
	}

	/**
	 * AND A FORM THAT IS NOT COMPLETE IS NOT A GUESS.
	 *
	 * <p><b>The mutation this is written against:</b> counting the miss before the form is
	 * judged. A member who left a box empty has guessed at nothing, and counting it would let
	 * anybody shut an account by sending ten empty forms - which is exactly the harm
	 * {@code SignIn} refuses to allow for an address nobody holds.
	 */
	@Test
	void aFormThatIsNotCompleteIsNotCountedAsAGuess() throws Exception {
		for (int empty = 0; empty < SignIn.ENOUGH_MISSES_TO_LOCK + 2; empty++) {
			assertThat(asking(theSessionIAskFrom(), body(null, null, null)).getStatus())
					.isEqualTo(400);
		}

		Map<String, Object> after = db.sql("select failed_sign_ins, locked_until from account"
				+ " where id = ?").param(accountOf(ME)).query().singleRow();

		assertThat(((Number) after.get("failed_sign_ins")).intValue())
				.as("an empty form was counted as a guess, so anybody can shut an account by"
						+ " sending ten of them")
				.isZero();
		assertThat(after.get("locked_until")).isNull();
	}

	/**
	 * A SUCCESSFUL CHANGE FORGETS THE MISSES AND THE LOCK THEY LEFT BEHIND.
	 *
	 * <p><b>THIS CASE USED TO SAY SOMETHING ELSE, AND WHAT IT SAID WAS WRONG.</b> It set a
	 * lock fifteen minutes into the future and required the right old password to go through
	 * anyway, on the reasoning that „the member whose laptop is still signed in is the one
	 * person who can end that by moving the password". That was written while the route
	 * ignored the lock entirely, and a security review on 25.09.2026 named it: a lock that the
	 * right password opens is a suggestion, which is {@code SignIn}'s own sentence about its
	 * own door. {@code anAccountThatIsShutStaysShutEvenForTheRightOldPassword} now holds the
	 * opposite, and it is the correct one.
	 *
	 * <p><b>What survives from it is the half that was always true:</b> misses count guesses
	 * at an account, and somebody who has just proved he knows his own password was not
	 * guessing. So the lock here is one that has already RUN OUT - V18's
	 * {@code account_locked_only_after_enough_failures} means a lock cannot exist without ten
	 * misses behind it, so the pair is what a real account looks like a quarter of an hour
	 * after somebody gave up guessing at it - and after a successful change both are gone.
	 */
	@Test
	void changingThePasswordEndsALockSomebodyElseCaused() throws Exception {
		db.sql("update account set failed_sign_ins = ?, locked_until = ? where id = ?")
				.params(SignIn.ENOUGH_MISSES_TO_LOCK,
						Timestamp.from(Instant.now().minus(Duration.ofMinutes(1))), accountOf(ME))
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
				.as("the spent lock was left on the row, so the next miss would start from a"
						+ " count and a moment that belong to somebody else's guessing")
				.isNull();
	}

	/**
	 * THE MEMBER IS TOLD BY POST, AND THE NOTICE CARRIES NEITHER PASSWORD.
	 *
	 * <p>PDL P22, 11.08.2026 makes „promena lozinke" one of the six mandatory messages. What
	 * it carries is the owner's own reading of P9 applied correctly: WHEN it changed and how
	 * many other devices were signed out - never the old password, which this portal does not
	 * hold at all (V18 keeps a BCrypt hash).
	 *
	 * <p><b>The last assertion is a SWEEP and not a spot check</b>, which is the shape
	 * {@code newPassword.test.tsx} uses on the other side of the repository for the same
	 * question: every place a value could land is looked at, subject and body together, rather
	 * than the one place somebody thought of.
	 */
	@Test
	void theMemberIsPostedANoticeThatCarriesNeitherPassword() throws Exception {
		assertThat(asking(theSessionIAskFrom(),
				body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD)).getStatus())
				.isEqualTo(204);

		MimeMessage posted = waitForOne();

		assertThat(posted.getAllRecipients()[0].toString())
				.as("the notice went to somebody who is not the member whose password moved")
				.isEqualTo(ME);

		String whole = wholeOf(posted);

		/* THE COUNT IS READ AS „OTHERS" AND NOT AS „ALL", and the first draft of this
		   assertion could not tell them apart: it asked for the character `2`, which the
		   moment supplies four times over in „24.09.2026". Two sources for one value, which
		   is the very fault this branch spent the day measuring in other people's fixtures.

		   The member holds THREE sessions and asks from one, so „others" is 2 and „all" is 3.
		   Asked over the rendered pair - a colon, the number, a full stop - the two are
		   different strings, and a route that counted every session instead of every other
		   one comes back visibly wrong rather than accidentally right. */
		assertThat(whole)
				.as("the notice does not say how many other devices were signed out, which is"
						+ " the half of the owner's decision of 24.09.2026 a member cannot see"
						+ " anywhere else")
				.contains(": 2.");

		assertThat(whole)
				.as("the notice counted EVERY session rather than every OTHER one, so it tells"
						+ " the member the browser he is reading in was signed out too")
				.doesNotContain(": 3.");

		assertThat(whole)
				.as("A PASSWORD LEFT THIS PORTAL BY POST. The old one cannot even be produced"
						+ " (V18 keeps a hash) and the new one is the member's secret; PDL P9's"
						+ " rule about carrying the old value is about an administrator editing"
						+ " a RESULT, and it does not carry across to this")
				.doesNotContain(MY_OLD_PASSWORD)
				.doesNotContain(MY_NEW_PASSWORD)
				.doesNotContain(SOMEBODY_ELSES_PASSWORD);
	}

	/**
	 * AND A REFUSED REQUEST POSTS NOTHING AT ALL.
	 *
	 * <p><b>The mutation this is written against:</b> sending before the refusal is decided,
	 * or sending on every road out of the handler. A member told „your password has changed"
	 * about a change that did not happen would be worse than not being told at all: it is the
	 * portal teaching him to ignore exactly the warning that is meant to alarm him.
	 */
	@Test
	void aRefusedRequestPostsNothing() throws Exception {
		assertThat(asking(theSessionIAskFrom(),
				body("ovo.nije.moja.stara.lozinka", MY_NEW_PASSWORD, MY_NEW_PASSWORD))
				.getStatus()).isEqualTo(400);

		assertThat(SMTP.getReceivedMessages())
				.as("a refused change told the member his password had moved")
				.isEmpty();
	}

	/**
	 * A RELAY THAT WILL NOT TAKE THE NOTICE DOES NOT UNDO THE CHANGE.
	 *
	 * <p>{@code EmailConfirmationApiTest.aRelayThatRefusesTheMessageStillLeavesTheTokenBehind}
	 * is the precedent, and the reason is the same one: by the time the relay is asked, the
	 * answer is already true. His password HAS changed and his other devices ARE signed out,
	 * so turning a relay's silence into a refusal would tell him nothing happened while
	 * everything had.
	 *
	 * <p>What he loses is the warning, and that is written down rather than pretended away:
	 * the way out is the reset link, which is the road this class sits beside.
	 */
	@Test
	void aRelayThatWillNotTakeTheNoticeLeavesThePasswordChanged() throws Exception {
		SMTP.getSmtp().stopService();

		assertThat(asking(theSessionIAskFrom(),
				body(MY_OLD_PASSWORD, MY_NEW_PASSWORD, MY_NEW_PASSWORD)).getStatus())
				.as("a relay that would not take the notice turned a change that really happened"
						+ " into an error")
				.isEqualTo(204);

		assertThat(new StoredPassword().matches(MY_NEW_PASSWORD, passwordHashOf(ME)))
				.as("the new password did not survive a relay that refused the notice")
				.isTrue();
		assertThat(howManySessionsOf(ME))
				.as("the other sessions did not stay ended when the notice could not go out")
				.isEqualTo(1);
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

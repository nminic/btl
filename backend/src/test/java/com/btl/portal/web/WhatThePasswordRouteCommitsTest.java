package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.account.SignIn;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * WHAT THE PASSWORD ROUTE COMMITS: THE MISS A WRONG OLD PASSWORD COSTS, THE FORGETTING A PROVED ONE
 * EARNS, AND THE CHANGE ITSELF.
 *
 * <p>{@code MePasswordApi} does all of its writing inside one {@code TransactionTemplate} and keeps
 * what it wrote on a refusal by RETURNING the refusal and not by throwing it. Its own comments say so
 * twice: the miss is „WRITTEN FROM INSIDE THE TRANSACTION AND STILL KEPT", and the count and the lock
 * forgotten the moment the old password is proved are „KEPT on a refusal below". The template rolls
 * back on an exception and on a rollback mark and on nothing else, so what keeps those writes is only
 * the absence of a mark: one {@code setRollbackOnly()} anywhere in the route would take them back while
 * the member is answered exactly as before.
 *
 * <p><b>THAT IS NOT MEASURABLE IN {@code MePasswordApiTest}, AND THE REASON IS THE CLASS AND NOT ITS
 * CASES.</b> It is {@code @Transactional}, so the route's template JOINS the transaction the test is
 * holding instead of opening one of its own. A rollback mark set inside the route then marks a
 * transaction the test is still reading from: everything the route wrote stays readable until the
 * test's own rollback, and „written and kept" cannot be told from „written and undone". A mark set on
 * the refusals of the password policy, and a mark set on every refusal, both leave every case of that
 * class green; both turn this one red.
 *
 * <p><b>NOT {@code @Transactional}, SO WHAT IS READ BACK IS WHAT WAS COMMITTED.</b> Each request gets a
 * connection and a transaction of its own and the test reads through another, which is the shape
 * {@code ATextSentTwiceAtOnceTest} and {@code VerificationDecisionConcurrencyTest} already have for a
 * different reason, and the cost is theirs too: the rows are real commits against the database every
 * class that shares this context reads, so {@link #nothingOfItIsLeftBehind} takes them out by key
 * whether the case passed or not, and both addresses are distinct from every other fixture's.
 *
 * <p><b>AND THE FIRST LINE OF THE SETUP ASKS THE THREAD WHETHER THAT IS STILL TRUE.</b> Nothing in the
 * cases below depends on the annotation being absent: put it back and every one of them goes on
 * passing and measures nothing, which is the very thing this class replaces. So the setup refuses to
 * run inside a transaction at all. It asks Spring's own record of the thread and does not read the
 * annotations of this file, because the question is about what happens and not about what is written.
 * Measured 02.10.2026: with the annotation back and this line taken out, a rollback mark on every
 * outcome of the route left all four cases green; with the line in, all four go red before a request
 * is sent.
 *
 * <p><b>NO MAILBOX AND NO PORT.</b> The refusals send nothing. The last case does send, to the
 * development default relay that points at nothing, and that is by design and not by luck: the route
 * turns a relay that will not take the notice into a logged warning and answers 204 all the same
 * ({@code MePasswordApiTest.aRelayThatWillNotTakeTheNoticeLeavesThePasswordChanged}), so nothing here
 * binds a number and nothing here can collide with the classes that do.
 *
 * <p><b>NOBODY HERE IS THE ONLY ONE OF THEIR KIND</b>, on the axes an assertion reads a value along.
 * Each is a way this class could be green and measure nothing:
 *
 * <ul>
 * <li><b>TWO ACCOUNTS AT NINE MISSES, AND THE ONE WHO ASKS IS WRITTEN SECOND.</b> „The account asking",
 * „the first account" and „every account" are three different rows, so a statement that lost its
 * condition answers differently, and the other account's nine is read back after every request.
 * <li><b>EVERY CASE STARTS AT NINE.</b> „Forgotten" (nought), „untouched" (nine) and „counted" (ten,
 * locked) are three different strings and none of them is what the fixture started with, so no outcome
 * can be a count that nothing touched. The numbers come off {@link SignIn#ENOUGH_MISSES_TO_LOCK}, for
 * the reason {@code MePasswordApiTest} gives: the day the owner moves his number this class moves with
 * it.
 * <li><b>THE NEW PASSWORD IS NEVER THE OLD ONE, AND EVERY REFUSAL IS READ BY ITS REASON</b>, so a 400
 * that came from a different line than the one a case is written for is not taken for the right one.
 * <li><b>THE LOCK IS READ AS „OPEN" OR „LOCKED" AND NOTHING FINER.</b> Nine misses cannot carry a lock
 * ({@code account_locked_only_after_enough_failures}), so „open" after a refusal says the column was
 * left alone and „locked" after the tenth says it was written. How long it lasts is
 * {@code SignInTest}'s question and not this class's.
 * </ul>
 *
 * <p>The owner's decision the miss carries out is ADL A43.1, 11.09.2026: „zakljucavanje | posle 10
 * neuspelih pokusaja, 15 minuta". The forgetting is a reading of it and not his word:
 * {@code MePasswordApi} derives it from {@code SignInApi}'s sentence that somebody who has just
 * signed in was not guessing. What is measured here is only that it is KEPT.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class WhatThePasswordRouteCommitsTest {

	/** Distinct from every other fixture's accounts, on purpose: these rows are committed. */
	private static final String ME = "lozinka-se-potvrdjuje-ja@primer.rs";

	/** Somebody else at nine misses, written FIRST, so „the first account" is never „the one asking". */
	private static final String SOMEBODY_ELSE = "lozinka-se-potvrdjuje-neko-drugi@primer.rs";

	private static final String MY_OLD_PASSWORD = "moja.stara.lozinka.2026";

	private static final String MY_NEW_PASSWORD = "moja.nova.lozinka.2027";

	/** Nobody else's is ever mine. */
	private static final String SOMEBODY_ELSES_PASSWORD = "tudja.lozinka.koja.nije.moja";

	private static final String A_WRONG_OLD_PASSWORD = "ovo.nije.moja.stara.lozinka";

	/**
	 * Long enough and on the portal's own list of the leaked, which is why the policy refuses it and
	 * the form does not.
	 */
	private static final String A_LEAKED_PASSWORD = "passwordpassword";

	/** One slip from the lock, which is where every case starts. */
	private static final int NINE_MISSES = SignIn.ENOUGH_MISSES_TO_LOCK - 1;

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	private SecretToken session;

	@BeforeEach
	void twoAccountsEachOneSlipFromTheLock() {
		assertThat(TransactionSynchronizationManager.isActualTransactionActive())
				.as("a transaction is bound to the test thread, so the route's own transaction joins it"
						+ " and what is read back is no longer what was committed: this class would go on"
						+ " passing while it measures nothing")
				.isFalse();

		account(SOMEBODY_ELSE, SOMEBODY_ELSES_PASSWORD);
		account(ME, MY_OLD_PASSWORD);

		session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(ME, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();
	}

	/**
	 * Real commits, so a real delete, children before parents.
	 *
	 * <p>The session key cascades and is written out anyway, so that a future migration narrowing it
	 * cannot turn this cleanup into a constraint violation nobody sees until here. That is the
	 * precedent's own sentence and its reason.
	 */
	@AfterEach
	void nothingOfItIsLeftBehind() {
		db.sql("delete from account_session where account_id in"
						+ " (select id from account where email in (?, ?))")
				.params(ME, SOMEBODY_ELSE).update();
		db.sql("delete from account where email in (?, ?)").params(ME, SOMEBODY_ELSE).update();
	}

	/**
	 * THE FORGETTING IS COMMITTED ALTHOUGH THE NEW PASSWORD IS REFUSED.
	 *
	 * <p>He proved his old password with nine misses behind him and chose a password the policy
	 * refuses, one that has leaked and one that is too short, a row each because they are two
	 * different lines of the route. Both are answered 400 and both must leave nought and no lock on
	 * the row that is READ BACK: he has just shown he owns the account, and a refusal he can mend by
	 * typing again must not leave him one miss from the lock.
	 *
	 * <p><b>The mutations this is written against:</b> a rollback mark set on every refusal that is
	 * not the wrong old password, which turns both rows red; and a mark set on one of the two
	 * policy refusals alone, which turns only that row red.
	 */
	@ParameterizedTest
	@CsvSource({
			A_LEAKED_PASSWORD + ", " + MePasswordApi.THE_PASSWORD_HAS_LEAKED,
			"kratka, " + MePasswordApi.THE_FORM_IS_NOT_COMPLETE })
	void theForgettingStaysCommittedWhenTheNewPasswordIsRefused(String refusedNew, String reason)
			throws Exception {

		MockHttpServletResponse answer = asking(MY_OLD_PASSWORD, refusedNew);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("the refusal is not the one this row is written for")
				.isEqualTo(reason);

		assertThat(missesAndLockOf(ME))
				.as("the member proved his old password and the forgetting did not survive the refusal"
						+ " of the new one, so he is still one miss from the lock")
				.isEqualTo("0 open");
		assertThat(missesAndLockOf(SOMEBODY_ELSE))
				.as("somebody else's misses were forgotten by a password he never typed")
				.isEqualTo(NINE_MISSES + " open");
	}

	/**
	 * A MISS AT THE OLD PASSWORD IS COMMITTED, AND THE TENTH SHUTS THE ACCOUNT.
	 *
	 * <p>The older half of the same property: a wrong old password is answered 400 like the two
	 * refusals above, so a rollback mark set on EVERY refusal takes the miss back with them and the
	 * count stays at nine. Guessing at this door then costs nothing and ADL A43.1 is carried out in a
	 * transaction that is thrown away.
	 *
	 * <p><b>The mutations this is written against:</b> a rollback mark set on every refusal, which
	 * turns this case red along with the two rows above; and the miss written against every account
	 * instead of the one asking, which {@code MePasswordApiTest} cannot see because it reads only the
	 * account that asks. A mark set on the policy refusals alone leaves this case green and belongs to
	 * the rows above.
	 */
	@Test
	void aMissAtTheOldPasswordStaysCommittedAndTheTenthShutsTheAccount() throws Exception {
		MockHttpServletResponse answer = asking(A_WRONG_OLD_PASSWORD, MY_NEW_PASSWORD);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(MePasswordApi.THE_OLD_PASSWORD_IS_WRONG);

		assertThat(missesAndLockOf(ME))
				.as("the miss did not survive the refusal, so the tenth guess never shuts the door")
				.isEqualTo(SignIn.ENOUGH_MISSES_TO_LOCK + " locked");
		assertThat(missesAndLockOf(SOMEBODY_ELSE))
				.as("the miss was written against somebody who never guessed")
				.isEqualTo(NINE_MISSES + " open");
	}

	/**
	 * A CHANGE THAT GOES THROUGH IS COMMITTED AS WELL, WHICH IS THE THIRD PLACE THE SAME BLIND SPOT HAS
	 * AN INSTANCE.
	 *
	 * <p>A rollback mark set on a change that succeeds would answer 204, tell the member his password
	 * moved, and leave the old one standing. {@code MePasswordApiTest} cannot see it for the reason
	 * the head of this class gives, and it is the loudest of the three: the other two lose a count,
	 * this one loses the thing the member asked for.
	 *
	 * <p>The notice goes to a relay that is not there. The route answers 204 regardless (see the head
	 * of this class), and the one logged warning with its stack trace is all this case adds to the
	 * output.
	 *
	 * <p><b>The mutation this is written against:</b> a rollback mark set on the change that goes
	 * through and on nothing else, which turns only this case red. A mark set on every outcome turns
	 * all four red, so it is not the one that shows this case is needed.
	 */
	@Test
	void theNewPasswordAndTheForgettingAreCommittedWhenTheChangeGoesThrough() throws Exception {
		assertThat(asking(MY_OLD_PASSWORD, MY_NEW_PASSWORD).getStatus()).isEqualTo(204);

		assertThat(new StoredPassword().matches(MY_NEW_PASSWORD, passwordHashOf(ME)))
				.as("the member was told 204 and the new password is not the one that stands")
				.isTrue();
		assertThat(missesAndLockOf(ME))
				.as("the change went through and the forgetting did not survive it")
				.isEqualTo("0 open");
		assertThat(missesAndLockOf(SOMEBODY_ELSE))
				.as("somebody else's misses were forgotten by a password he never typed")
				.isEqualTo(NINE_MISSES + " open");
	}

	/** An account with a confirmed address, one slip from the lock, written by hand. */
	private void account(String email, String password) {
		db.sql("insert into account (first_name, last_name, email, role_id, password_hash,"
						+ " email_confirmed_at, failed_sign_ins) values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'competitor'), ?, now(), ?)")
				.params(email, new StoredPassword().of(password), NINE_MISSES)
				.update();
	}

	private MockHttpServletResponse asking(String old, String password) throws Exception {
		Map<String, Object> typed = new LinkedHashMap<>();

		typed.put("oldPassword", old);
		typed.put("password", password);
		typed.put("passwordRepeat", password);

		return http.perform(put("/api/me/password").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session.secret()))
						.contentType(MediaType.APPLICATION_JSON)
						.content(mapper.writeValueAsString(typed)))
				.andReturn().getResponse();
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	/** The count of misses and whether a lock is written on the row, as one string. */
	private String missesAndLockOf(String email) {
		return db.sql("select failed_sign_ins || ' ' || case when locked_until is null then 'open'"
						+ " else 'locked' end from account where email = ?")
				.param(email).query(String.class).single();
	}

	private String passwordHashOf(String email) {
		return db.sql("select password_hash from account where email = ?").param(email)
				.query(String.class).single();
	}
}

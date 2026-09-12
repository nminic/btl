package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SignIn;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.token.SecretToken;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Signing in, end to end, against a real database. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SignInApiTest {

	private static final String ADDRESS = "prijava@primer.rs";

	private static final String RIGHT = "dvanaest1234sasvim";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@BeforeEach
	void anAccountToSignInTo() {
		db.sql("insert into account (email, role_id, password_hash) values (?,"
						+ " (select id from role where code = 'competitor'), ?)")
				.params(ADDRESS, new StoredPassword().of(RIGHT))
				.update();
	}

	private MockHttpServletResponse typed(String email, String password) throws Exception {
		return http.perform(post("/api/sign-in").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
				.andReturn().getResponse();
	}

	private int missesAt(String email) {
		return db.sql("select failed_sign_ins from account where email = ?")
				.param(email).query(Integer.class).single();
	}

	@Test
	void theRightPasswordGetsACookieAndNothingElse() throws Exception {
		MockHttpServletResponse answer = typed(ADDRESS, RIGHT);

		assertThat(answer.getStatus()).isEqualTo(204);
		assertThat(answer.getContentAsString()).as("the answer said something about the member").isEmpty();
		assertThat(answer.getCookie(SessionCookie.NAME)).isNotNull();
	}

	/**
	 * THE COOKIE CARRIES THE SECRET AND THE DATABASE HOLDS ONLY WHAT IT HASHES TO.
	 *
	 * <p>This is the whole reason `account_session` stores a digest, and the case
	 * that would fail the day somebody writes the secret into the row for
	 * convenience. Both halves are here: what is in the row is not what is in the
	 * cookie, and it IS what the cookie hashes to.
	 */
	@Test
	void theCookieCarriesTheSecretAndTheRowOnlyItsHash() throws Exception {
		String carried = typed(ADDRESS, RIGHT).getCookie(SessionCookie.NAME).getValue();

		String stored = db.sql("select token_hash from account_session"
						+ " where account_id = (select id from account where email = ?)")
				.param(ADDRESS).query(String.class).single();

		assertThat(stored).as("the secret itself was written into the database").isNotEqualTo(carried);
		assertThat(SecretToken.matches(carried, stored))
				.as("the row is not what the cookie hashes to, so the cookie opens nothing")
				.isTrue();
	}

	/**
	 * And the cookie is fitted with every flag, which is what its name insists on.
	 *
	 * <p>A browser refuses to store a `__Host-` cookie at all unless it is Secure,
	 * has no Domain and has Path=/, so two of these are enforced by the name; the
	 * case says them anyway, because the day somebody renames it the enforcement
	 * goes with the name and nothing else would notice.
	 */
	@Test
	void theCookieIsFittedWithEveryFlag() throws Exception {
		MockHttpServletResponse answer = typed(ADDRESS, RIGHT);

		assertThat(SessionCookie.NAME).startsWith("__Host-");
		assertThat(answer.getCookie(SessionCookie.NAME).isHttpOnly())
				.as("a script on the page could read the session").isTrue();
		assertThat(answer.getCookie(SessionCookie.NAME).getSecure())
				.as("the session would travel over plain http").isTrue();
		assertThat(answer.getCookie(SessionCookie.NAME).getPath()).isEqualTo("/");
		assertThat(answer.getCookie(SessionCookie.NAME).getMaxAge())
				.isEqualTo((int) SessionCookie.LASTS.toSeconds());
		assertThat(answer.getHeader("Set-Cookie")).contains("SameSite=Strict");
	}

	/**
	 * EVERY NO IS THE SAME NO.
	 *
	 * <p>Four ways of not getting in, and nothing in any of them says whether the
	 * address exists: same status, same empty body, and no cookie. This is the case
	 * that fails the day somebody adds a helpful message.
	 */
	@Test
	void everyNoIsTheSameNo() throws Exception {
		db.sql("insert into account (email, role_id) values ('bezlozinke@primer.rs',"
				+ " (select id from role where code = 'competitor'))").update();
		db.sql("update account set failed_sign_ins = 10, locked_until = now() + interval '15 minutes'"
				+ " where email = ?").param(ADDRESS).update();

		for (String[] way : new String[][] {
				{"nema@primer.rs", RIGHT}, {"bezlozinke@primer.rs", RIGHT},
				{ADDRESS, RIGHT}, {ADDRESS, "pogresna"}}) {
			MockHttpServletResponse answer = typed(way[0], way[1]);

			assertThat(answer.getStatus()).as("'%s' was answered differently", way[0]).isEqualTo(401);
			assertThat(answer.getContentAsString()).isEmpty();
			assertThat(answer.getCookie(SessionCookie.NAME)).isNull();
		}
	}

	@Test
	void aWrongPasswordIsCountedAndTheTenthShutsTheAccount() throws Exception {
		for (int miss = 1; miss < SignIn.ENOUGH_MISSES_TO_LOCK; miss++) {
			typed(ADDRESS, "pogresna");
			assertThat(missesAt(ADDRESS)).isEqualTo(miss);
			assertThat(db.sql("select locked_until from account where email = ?")
					.param(ADDRESS).query(java.sql.Timestamp.class).optional())
					.as("the account was shut after %d misses", miss)
					.isEmpty();
		}

		typed(ADDRESS, "pogresna");

		assertThat(missesAt(ADDRESS)).isEqualTo(SignIn.ENOUGH_MISSES_TO_LOCK);
		assertThat(db.sql("select locked_until from account where email = ?")
				.param(ADDRESS).query(java.sql.Timestamp.class).optional())
				.as("the tenth miss did not shut the account")
				.isPresent();
	}

	/** And signing in forgets them, because they count guesses and somebody who got
	 *  in was not guessing. */
	@Test
	void signingInForgetsTheMisses() throws Exception {
		typed(ADDRESS, "pogresna");
		assertThat(missesAt(ADDRESS)).isOne();

		typed(ADDRESS, RIGHT);

		assertThat(missesAt(ADDRESS)).isZero();
	}

	/**
	 * AN ADDRESS NOBODY HAS LEAVES NOTHING BEHIND.
	 *
	 * <p>Not merely "is refused": no row is written, which is what stops a stranger
	 * shutting an address he does not own by typing at it. The count is taken over
	 * the whole table, so a row created anywhere fails this.
	 */
	@Test
	void anAddressNobodyHasLeavesNothingBehind() throws Exception {
		int before = db.sql("select count(*) from account").query(Integer.class).single();

		for (int attempt = 0; attempt < SignIn.ENOUGH_MISSES_TO_LOCK + 2; attempt++) {
			typed("nema@primer.rs", "bilo sta");
		}

		assertThat(db.sql("select count(*) from account").query(Integer.class).single())
				.as("typing at an address nobody has created something")
				.isEqualTo(before);
		assertThat(db.sql("select count(*) from account_session").query(Integer.class).single()).isZero();
	}

	/**
	 * A REQUEST WITH NO FORM AT ALL NEVER REACHES US.
	 *
	 * <p>{@code @RequestBody} is required, so Spring turns such a request away with
	 * 400 before the method runs. That is what lets the method not check for it, and
	 * this is the case that holds the guarantee: were the annotation ever made
	 * optional, the form would arrive as null and the first thing touched would
	 * throw.
	 */
	@Test
	void aRequestWithNoFormAtAllNeverReachesUs() throws Exception {
		assertThat(http.perform(post("/api/sign-in").with(csrf())
						.contentType(MediaType.APPLICATION_JSON))
				.andReturn().getResponse().getStatus())
				.as("a request with no body at all got as far as the method")
				.isEqualTo(400);

		assertThat(missesAt(ADDRESS)).isZero();
	}

	/**
	 * WITHOUT THE TOKEN THE FORM IS REFUSED, and that is the CSRF guard measured
	 * rather than assumed.
	 *
	 * <p>Every other case here carries one. This one does not, and must be turned
	 * away before it reaches a password comparison at all: refused with no cookie
	 * and no miss counted, or another site could spend somebody's ten tries for him.
	 */
	@Test
	void withoutTheTokenTheFormIsRefused() throws Exception {
		MockHttpServletResponse answer = http.perform(post("/api/sign-in")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"" + ADDRESS + "\",\"password\":\"" + RIGHT + "\"}"))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(403);
		assertThat(answer.getCookie(SessionCookie.NAME)).isNull();
		assertThat(missesAt(ADDRESS)).as("a request nobody proved came from the portal cost a miss").isZero();
	}

	/**
	 * A FORM WITH NOTHING IN IT IS REFUSED BEFORE ANYTHING IS COMPARED.
	 *
	 * <p>Five shapes of nothing, and they are five because each is a different way
	 * for a field to be absent: left blank, left as spaces, sent as JSON null, and
	 * left out of the document altogether. A guard written against one of them lets
	 * the others through to a password comparison against whatever they are.
	 *
	 * <p>None of them costs a miss, or anybody could spend somebody else's ten
	 * tries by posting an empty form at his address.
	 */
	@Test
	void aFormWithNothingInItIsRefusedBeforeAnythingIsCompared() throws Exception {
		assertThat(typed("", "").getStatus()).isEqualTo(401);
		assertThat(typed(ADDRESS, "  ").getStatus()).isEqualTo(401);
		assertThat(typed("   ", RIGHT).getStatus()).isEqualTo(401);

		for (String document : new String[] {"{}", "{\"email\":null,\"password\":null}",
				"{\"email\":\"" + ADDRESS + "\"}"}) {
			assertThat(http.perform(post("/api/sign-in").with(csrf())
							.contentType(MediaType.APPLICATION_JSON).content(document))
					.andReturn().getResponse().getStatus())
					.as("a form sent as %s was not refused", document)
					.isEqualTo(401);
		}

		assertThat(missesAt(ADDRESS)).as("an empty form was counted as a guess").isZero();
	}
}

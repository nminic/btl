package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Signing out, end to end, against a real database. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SignOutApiTest {

	private static final String MINE = "odjava@primer.rs";

	private static final String SOMEBODY_ELSE = "drugi@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/** The one being signed out. */
	private SecretToken thisOne;

	/** The same member on another device, which must be left alone. */
	private SecretToken myOtherDevice;

	/** And somebody else entirely, which must be left alone as well. */
	private SecretToken hers;

	@BeforeEach
	void threeSessionsAcrossTwoMembers() {
		thisOne = SecretToken.fresh();
		myOtherDevice = SecretToken.fresh();
		hers = SecretToken.fresh();

		member(MINE);
		member(SOMEBODY_ELSE);

		open(MINE, thisOne);
		open(MINE, myOtherDevice);
		open(SOMEBODY_ELSE, hers);
	}

	private void member(String email) {
		db.sql("insert into account (email, role_id) values (?,"
						+ " (select id from role where code = 'competitor'))")
				.param(email).update();
	}

	private void open(String email, SecretToken session) {
		db.sql("insert into account_session (account_id, token_hash)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, session.hash()).update();
	}

	private boolean stillOpen(SecretToken session) {
		return db.sql("select count(*) from account_session where token_hash = ?")
				.param(session.hash()).query(Integer.class).single() == 1;
	}

	private MockHttpServletResponse signOut(String carrying) throws Exception {
		var asked = post("/api/sign-out").with(csrf());

		if (carrying != null) {
			asked = asked.cookie(new Cookie(SessionCookie.NAME, carrying));
		}

		return http.perform(asked).andReturn().getResponse();
	}

	/**
	 * ONE SESSION ENDS AND THE OTHER TWO DO NOT.
	 *
	 * <p>Three rows and not one, because "delete every session this member has" and
	 * "delete every session there is" both pass a case with a single row. The
	 * member's own second device is the one that catches the first, and the other
	 * member catches the second.
	 */
	@Test
	void theSessionThatWasCarriedEndsAndNoOtherDoes() throws Exception {
		MockHttpServletResponse answer = signOut(thisOne.secret());

		assertThat(answer.getStatus()).isEqualTo(204);
		assertThat(stillOpen(thisOne)).as("the session that was signed out is still open").isFalse();
		assertThat(stillOpen(myOtherDevice))
				.as("signing out on one device ended the member's session on another")
				.isTrue();
		assertThat(stillOpen(hers))
				.as("signing out ended a session belonging to somebody else")
				.isTrue();
	}

	/**
	 * THE ROW KEEPS A HASH, SO THE COOKIE IS HASHED BEFORE IT IS LOOKED UP.
	 *
	 * <p>Sending what the row actually stores must find nothing. Were the query
	 * written against the stored value directly, this would delete the row and the
	 * case above would pass just the same, while a stolen copy of the database
	 * became enough to end anybody's session.
	 */
	@Test
	void whatTheRowStoresIsNotWhatOpensIt() throws Exception {
		signOut(thisOne.hash());

		assertThat(stillOpen(thisOne))
				.as("the value stored in the row was accepted as the cookie")
				.isTrue();
	}

	/**
	 * EVERY WAY OF SIGNING OUT IS ANSWERED THE SAME WAY.
	 *
	 * <p>A real cookie, a made up one, an empty one and none at all: same status,
	 * same empty body, same expiring cookie. Told apart, this route becomes a way
	 * of asking whether a token is real, and somebody holding a stolen one could
	 * find out without using it.
	 */
	@Test
	void everyWayOfSigningOutLooksTheSame() throws Exception {
		for (String carrying : new String[] {thisOne.secret(), SecretToken.fresh().secret(), "", null}) {
			MockHttpServletResponse answer = signOut(carrying);

			assertThat(answer.getStatus()).as("'%s' was answered differently", carrying).isEqualTo(204);
			assertThat(answer.getContentAsString()).isEmpty();
			assertThat(answer.getHeader("Set-Cookie"))
					.as("'%s' did not get the cookie replaced", carrying)
					.contains(SessionCookie.NAME + "=;")
					.contains("Max-Age=0");
		}
	}

	/**
	 * AND THE COOKIE THAT REPLACES IT IS THE SAME COOKIE IN EVERY WAY BUT TWO.
	 *
	 * <p>A browser matches a cookie by name, domain and path. One arriving with a
	 * different Path or SameSite is a second cookie rather than a replacement: the
	 * browser keeps the first and goes on sending it, and the member reads that he
	 * is signed out while he is not.
	 *
	 * <p><b>The two sets are compared whole, and no flag is named here.</b> Written
	 * as a list of flags each looked for with "contains", it passed a cookie whose
	 * path was {@code /api} - because {@code Path=/api} contains {@code Path=/},
	 * which is exactly the substring somebody reaches for. Measured 12.09.2026 by a
	 * mutation that changed the path and cost nothing. Compared as sets there is no
	 * such hole, and a flag added to one and not the other fails here without
	 * anybody remembering to add it.
	 *
	 * <p>What is left out of the comparison is the value, which is the point of the
	 * replacement, and the two attributes that carry the expiry, which are the other
	 * point. {@code everyWayOfSigningOutLooksTheSame} is where those are measured.
	 */
	@Test
	void theReplacingCookieMatchesTheOneItReplaces() throws Exception {
		Set<String> ending = everythingBesidesTheExpiry(signOut(thisOne.secret()).getHeader("Set-Cookie"));
		Set<String> starting = everythingBesidesTheExpiry(
				SessionCookie.carrying(SecretToken.fresh().secret()).toString());

		assertThat(starting)
				.as("the cookie handed out at sign in carries no flags at all, so this compares nothing")
				.isNotEmpty();
		assertThat(ending)
				.as("the cookie that replaces it differs, so the browser keeps both and sends the old one")
				.isEqualTo(starting);
	}

	/** Every attribute of a Set-Cookie but its value and the two that say when it ends. */
	private static Set<String> everythingBesidesTheExpiry(String setCookie) {
		return Arrays.stream(setCookie.split(";"))
				.map(String::trim)
				.skip(1)
				.filter(one -> !one.startsWith("Max-Age") && !one.startsWith("Expires"))
				.collect(Collectors.toSet());
	}

	/**
	 * WITHOUT THE TOKEN NOTHING IS ENDED.
	 *
	 * <p>Signing somebody out against his will is a small harm and a real one, and
	 * it is the only thing this route can be made to do from another site.
	 */
	@Test
	void withoutTheTokenTheSessionStands() throws Exception {
		MockHttpServletResponse answer = http.perform(post("/api/sign-out")
						.cookie(new Cookie(SessionCookie.NAME, thisOne.secret())))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(403);
		assertThat(stillOpen(thisOne))
				.as("a request nobody proved came from the portal ended a session")
				.isTrue();
	}
}

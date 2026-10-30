package com.btl.portal.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * What the wrapper does with the headers it is handed, without a server in the way.
 *
 * <p>The cases over a real socket measure the two routes that set the session cookie.
 * Neither of them sets anything else before it does, so the part that keeps what was
 * there is not reached by them, and it is the part a route written later would need.
 */
class OneSessionCookieTest {

	private static final String CSRF = "XSRF-TOKEN=abc; Path=/; SameSite=Strict";

	private static final String OVER = "__Host-btl=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict";

	private final MockHttpServletResponse underneath = new MockHttpServletResponse();

	private final OneSessionCookie answering = new OneSessionCookie(underneath);

	/**
	 * A HEADER THAT IS NOT THE SESSION'S GOES THROUGH AS IT IS, and so does a cookie that is
	 * not the session's: a header of another name, and a Set-Cookie of another cookie.
	 */
	@Test
	void anythingThatIsNotTheSessionCookieIsAddedAsItIs() {
		answering.addHeader("X-Probni", "1");
		answering.addHeader("x-probni", "2");
		answering.addHeader(HttpHeaders.SET_COOKIE, CSRF);

		assertThat(underneath.getHeaders("X-Probni")).containsExactly("1", "2");
		assertThat(underneath.getHeaders(HttpHeaders.SET_COOKIE)).containsExactly(CSRF);
	}

	/**
	 * WHAT THE ROUTE SAYS ABOUT THE SESSION REPLACES WHAT THE FILTER SAID, and the cookie
	 * that was set before either of them is still there, once.
	 */
	@Test
	void theRoutesWordOnTheSessionReplacesTheRenewalAndKeepsTheRest() {
		answering.addHeader(HttpHeaders.SET_COOKIE, CSRF);
		answering.renewed("tajna");

		assertThat(underneath.getHeaders(HttpHeaders.SET_COOKIE))
				.as("the renewal is not written, so this measures nothing")
				.hasSize(2)
				.anyMatch(one -> one.startsWith(SessionCookie.NAME + "=tajna;"));

		answering.addHeader(HttpHeaders.SET_COOKIE, OVER);

		assertThat(underneath.getHeaders(HttpHeaders.SET_COOKIE))
				.as("the answer carries more or fewer cookies than the session's and the CSRF one,"
						+ " or both kinds of the session's")
				.hasSize(2)
				.contains(CSRF)
				.filteredOn(SessionCookie::isOne)
				.hasSize(1)
				.allMatch(one -> one.startsWith(SessionCookie.NAME + "=; ") && one.contains("Max-Age=0"));
	}

	/** AND WITH NOTHING BEFORE IT, A SESSION COOKIE IS JUST ADDED. */
	@Test
	void aSessionCookieWithNothingBeforeItIsJustSet() {
		answering.addHeader(HttpHeaders.SET_COOKIE, OVER);

		assertThat(underneath.getHeaders(HttpHeaders.SET_COOKIE)).hasSize(1)
				.allMatch(one -> one.startsWith(SessionCookie.NAME + "=; ") && one.contains("Max-Age=0"));
	}

	/** A HEADER WITH NO VALUE IS NOT THE SESSION'S, and is passed on rather than failing here. */
	@Test
	void aSetCookieWithNoValueIsNotTakenForTheSessionsAndFailsNothing() {
		assertThatCode(() -> answering.addHeader(HttpHeaders.SET_COOKIE, null)).doesNotThrowAnyException();
	}
}

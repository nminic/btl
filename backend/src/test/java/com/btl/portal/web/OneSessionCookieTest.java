package com.btl.portal.web;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the wrapper does with a renewal it was handed, without a server in the way.
 *
 * <p>The cases over a real socket ({@link TheSessionCookieFollowsTheSessionOverRealHttpTest}) measure
 * the routes the portal has. These measure the three ways a route can write a cookie of its own -
 * {@code addHeader}, {@code setHeader} and {@code addCookie} - of which the portal's routes use only
 * the second, through {@code ResponseEntity}; a route written next year may use either of the others.
 *
 * <p><b>Every case counts how many times the row was renewed</b>, because the rule is that the row
 * and the cookie go together: a case that only read the cookie would pass a wrapper that renewed the
 * row and then decided not to say so.
 */
class OneSessionCookieTest {

	private static final String CSRF = "XSRF-TOKEN=abc; Path=/; SameSite=Strict";

	private static final String OVER = "__Host-btl=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict";

	private final MockHttpServletResponse underneath = new MockHttpServletResponse();

	private final OneSessionCookie answering = new OneSessionCookie(underneath);

	/** How many times the renewing {@code update} ran. */
	private final AtomicInteger renewed = new AtomicInteger();

	private void dueAndTheRowIsThere() {
		answering.renewWhenAnswered("tajna", () -> {
			renewed.incrementAndGet();
			return 1;
		});
	}

	private java.util.List<String> aboutTheSession() {
		return underneath.getHeaders(HttpHeaders.SET_COOKIE).stream().filter(SessionCookie::isOne).toList();
	}

	/**
	 * AN ANSWER THAT SAYS NOTHING ABOUT CACHING, AND NOTHING ABOUT THE SESSION, IS RENEWED when it is
	 * committed, once, and the cookie it already carried stays beside the session's.
	 */
	@Test
	void anOrdinaryAnswerIsRenewedOnceWhenItIsCommitted() throws Exception {
		dueAndTheRowIsThere();
		answering.addHeader(HttpHeaders.SET_COOKIE, CSRF);

		assertThat(renewed).as("the row was renewed before the answer was committed").hasValue(0);

		answering.flushBuffer();
		answering.answered();

		assertThat(renewed).hasValue(1);
		assertThat(underneath.getHeaders(HttpHeaders.SET_COOKIE)).hasSize(2).contains(CSRF);
		assertThat(aboutTheSession()).singleElement().asString().startsWith(SessionCookie.NAME + "=tajna;");
	}

	/** AN ANSWER THAT SAYS {@code no-store} IS RENEWED, and so is one that wrote no body at all. */
	@Test
	void anAnswerThatForbidsKeepingIsRenewedEvenWithNoBody() {
		dueAndTheRowIsThere();
		answering.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, max-age=0, must-revalidate");

		answering.answered();

		assertThat(renewed).hasValue(1);
		assertThat(aboutTheSession()).hasSize(1);
	}

	/** AN ANSWER A CACHE MAY KEEP RENEWS NOTHING, neither the row nor the cookie. */
	@Test
	void anAnswerACacheMayKeepRenewsNothing() throws Exception {
		dueAndTheRowIsThere();
		answering.setHeader(HttpHeaders.CACHE_CONTROL, "max-age=86400, private");

		answering.flushBuffer();
		answering.answered();

		assertThat(renewed).as("the row was renewed for an answer that could not carry its cookie").hasValue(0);
		assertThat(aboutTheSession()).isEmpty();
	}

	/** A ROW THAT IS GONE BY THEN GETS NO COOKIE. */
	@Test
	void aRowThatIsGoneGetsNoCookie() throws Exception {
		answering.renewWhenAnswered("tajna", () -> {
			renewed.incrementAndGet();
			return 0;
		});

		answering.flushBuffer();

		assertThat(renewed).as("the row was never asked, so this measures nothing").hasValue(1);
		assertThat(aboutTheSession()).isEmpty();
	}

	/**
	 * A ROUTE THAT SAYS SOMETHING ABOUT THE SESSION'S COOKIE IS THE ONLY ONE THAT DOES, however it
	 * writes it: through {@code addHeader}, through {@code setHeader}, or through {@code addCookie}.
	 */
	@Test
	void theRoutesWordThroughAddHeaderIsTheOnlyOne() throws Exception {
		dueAndTheRowIsThere();
		answering.addHeader(HttpHeaders.SET_COOKIE, OVER);

		answering.flushBuffer();

		assertThat(renewed).hasValue(0);
		assertThat(aboutTheSession()).singleElement().asString().contains("Max-Age=0").doesNotContain("tajna");
	}

	@Test
	void theRoutesWordThroughSetHeaderIsTheOnlyOne() throws Exception {
		dueAndTheRowIsThere();
		answering.addHeader(HttpHeaders.SET_COOKIE, CSRF);
		answering.setHeader(HttpHeaders.SET_COOKIE, OVER);

		answering.flushBuffer();

		assertThat(renewed).hasValue(0);
		assertThat(aboutTheSession()).singleElement().asString().contains("Max-Age=0").doesNotContain("tajna");
	}

	@Test
	void theRoutesWordThroughAddCookieIsTheOnlyOne() throws Exception {
		dueAndTheRowIsThere();
		answering.addCookie(new Cookie(SessionCookie.NAME, ""));

		answering.flushBuffer();

		assertThat(renewed).hasValue(0);
		assertThat(aboutTheSession()).hasSize(1).noneMatch(one -> one.contains("tajna"));
	}

	/**
	 * AND SPRING'S OWN WAY OF WRITING A HEADER, which empties the name before it adds: the route's
	 * cookie emptied that way and never written again is no word about the session, so the renewal
	 * goes.
	 */
	@Test
	void aSetCookieEmptiedAndNotWrittenAgainIsNoWordAboutTheSession() throws Exception {
		dueAndTheRowIsThere();
		answering.addHeader(HttpHeaders.SET_COOKIE, OVER);
		answering.setHeader(HttpHeaders.SET_COOKIE, null);

		answering.flushBuffer();

		assertThat(renewed).hasValue(1);
		assertThat(aboutTheSession()).hasSize(1).allMatch(one -> one.contains("tajna"));
	}

	/** AN ANSWER COMMITTED UNDERNEATH WITHOUT THIS WRAPPER SEEING IT RENEWS NOTHING, not even the row. */
	@Test
	void anAnswerCommittedUnderneathRenewsNothing() {
		dueAndTheRowIsThere();
		underneath.setCommitted(true);

		answering.answered();

		assertThat(renewed).hasValue(0);
		assertThat(aboutTheSession()).isEmpty();
	}

	/** AND NOTHING DUE, NOTHING DONE, whichever way the answer ends. */
	@Test
	void nothingDueIsNothingDone() throws Exception {
		answering.flushBuffer();
		answering.answered();

		assertThat(underneath.getHeaders(HttpHeaders.SET_COOKIE)).isEmpty();
	}
}

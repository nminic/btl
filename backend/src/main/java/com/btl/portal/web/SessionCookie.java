package com.btl.portal.web;

import org.springframework.http.ResponseCookie;

import java.time.Duration;

/**
 * The cookie a signed in member carries, and every decision about it in one
 * place.
 *
 * <p>There is one of these and it is read by everything that asks who is
 * knocking, so the flags are written once rather than at each call site. A flag
 * forgotten at one of two call sites is a flag that is off half the time and
 * looks on when anybody checks.
 */
final class SessionCookie {

	/**
	 * Its name, and the prefix is part of the name on purpose.
	 *
	 * <p>{@code __Host-} is not decoration: a browser refuses to store a cookie
	 * under it unless the cookie is Secure, has no Domain, and has Path=/. So a
	 * mistake in any of those three stops the cookie working at all rather than
	 * quietly weakening it, which is the difference between a bug somebody reports
	 * in a minute and one nobody notices for a year. It also means no other host
	 * under the domain can set a cookie by this name and have ours read it.
	 */
	static final String NAME = "__Host-btl";

	/** Thirty days, which is what `account_session.expires_at` defaults to (V18). */
	static final Duration LASTS = Duration.ofDays(30);

	private SessionCookie() {
	}

	/**
	 * The cookie to hand back, holding the secret itself.
	 *
	 * <p>The secret travels here and nowhere else: the database keeps only what it
	 * hashes to, so a stolen copy of the database lets nobody in.
	 *
	 * <p><b>SameSite=Strict</b>, and that is a decision with a cost. Strict means
	 * the cookie is not sent when somebody arrives by following a link from another
	 * site, so a member clicking a link to his own profile from an email lands
	 * signed out and has to click again. Lax would spare him that and would also
	 * send the cookie on any top level navigation another site can cause. The
	 * portal has nothing that a GET changes, so Lax would be defensible; Strict is
	 * chosen because the cost is one extra click on a link nobody sends today, and
	 * it can be loosened the day somebody does send one.
	 */
	static ResponseCookie carrying(String secret) {
		return base(secret).maxAge(LASTS).build();
	}

	/* SIGNING OUT IS NOT HERE, and the empty cookie that does it is not here either.
	   It was written and then removed: nothing called it, so nothing measured it, and
	   a method nobody calls is a rule that can be wrong for a year without a word.

	   When it comes back it belongs beside the route that signs somebody out, and the
	   one thing to know then is that every flag must match the cookie being replaced -
	   a browser that sees a different Path or SameSite keeps both and goes on sending
	   the old one. That is why `base` exists. */

	private static ResponseCookie.ResponseCookieBuilder base(String value) {
		return ResponseCookie.from(NAME, value)
				.httpOnly(true)
				.secure(true)
				.path("/")
				.sameSite("Strict");
	}
}

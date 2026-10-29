package com.btl.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.http.HttpHeaders;

import java.util.List;

/**
 * THE ANSWER, WITH AT MOST ONE COOKIE UNDER THE SESSION'S NAME.
 *
 * <p>Renewing hands the cookie back before the route has run, and two routes
 * set it themselves: signing in sets a new one and signing out sets one that is
 * already over. Added side by side the answer would carry two cookies of one
 * name, and which of them a browser keeps would be a matter of the order they
 * were written in. For signing out that is the difference between a member who
 * is signed out and one who is handed his old session back in the same answer.
 *
 * <p><b>So whatever a route says about the session cookie replaces what was
 * said before it, here, once</b>, and not at each route: a route written next
 * year that sets the cookie is covered without knowing this exists, provided it
 * sets it the way both routes do, as a {@code Set-Cookie} header (which is how
 * {@code ResponseEntity} writes one). A route calling {@code addCookie} would go
 * round this. Every other {@code Set-Cookie} the answer already carries, the
 * CSRF token among them, is put back as it was.
 */
final class OneSessionCookie extends HttpServletResponseWrapper {

	OneSessionCookie(HttpServletResponse response) {
		super(response);
	}

	void renewed(String secret) {
		super.addHeader(HttpHeaders.SET_COOKIE, SessionCookie.carrying(secret).toString());
	}

	@Override
	public void addHeader(String name, String value) {
		if (!HttpHeaders.SET_COOKIE.equalsIgnoreCase(name) || !SessionCookie.isOne(value)) {
			super.addHeader(name, value);
			return;
		}

		List<String> others = getHeaders(HttpHeaders.SET_COOKIE).stream()
				.filter(one -> !SessionCookie.isOne(one))
				.toList();

		super.setHeader(HttpHeaders.SET_COOKIE, value);

		for (String other : others) {
			super.addHeader(HttpHeaders.SET_COOKIE, other);
		}
	}
}

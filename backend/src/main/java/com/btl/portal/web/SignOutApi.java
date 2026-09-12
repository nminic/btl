package com.btl.portal.web;

import com.btl.portal.domain.token.SecretToken;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Signing out, which is the one route that answers the same way whatever happens.
 *
 * <p><b>Always 204, and always with the cookie already over.</b> A cookie nobody
 * has, a cookie that ended last month, a cookie somebody made up: all of them get
 * the same answer, because the alternative is a way of asking the portal whether
 * a token is real. Somebody holding a stolen cookie could then find out whether
 * it still opens anything without ever using it.
 *
 * <p><b>The cookie comes back even when there was no row to delete</b>, and that
 * is not tidiness. The case it is for is a session that ended on its own: the row
 * is gone, the browser still carries the cookie, and if the answer did not
 * replace it the member would go on sending a cookie nothing can clear.
 *
 * <p><b>One session ends, not all of them.</b> The row is found by what the
 * cookie hashes to, so signing out on a telephone leaves the one on the laptop
 * alone. Written as "delete every session of this member" it would pass every
 * case that only ever has one, which is why {@code SignOutApiTest} gives the
 * member two.
 *
 * <p>The route is open rather than authenticated, and {@link ApiSecurity} says
 * why beside the line that opens it.
 */
@RestController
class SignOutApi {

	private final JdbcClient db;

	SignOutApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param carried the cookie, if the browser sent one. Optional, because the
	 *                answer is the same either way and a missing cookie is not an
	 *                error to report but the ordinary case of somebody who was
	 *                already signed out
	 */
	@PostMapping("/api/sign-out")
	ResponseEntity<Void> signOut(
			@CookieValue(name = SessionCookie.NAME, required = false) String carried) {

		if (carried != null && !carried.isBlank()) {
			/* Hashed before it is used, the same way the row was written. Nothing that
			   came off the wire ever reaches a query as itself. */
			db.sql("delete from account_session where token_hash = ?")
					.param(SecretToken.hashOf(carried))
					.update();
		}

		/* NOTHING IS DONE ABOUT A CONTAINER SESSION HERE, and that is deliberate
		   rather than forgotten. A line invalidating one was written and taken out:
		   no chain creates a session, so the branch could never run, and a branch
		   nothing can reach is a branch nothing can measure. What holds that
		   guarantee instead is `SignInOverRealHttpTest.nothingHandsOutASessionToAnybody`,
		   which asks the container itself, over a real socket, on both chains. The day
		   something does create one, that case goes red and this comment is where to
		   come back to. */

		return ResponseEntity.noContent()
				.header(HttpHeaders.SET_COOKIE, SessionCookie.gone().toString())
				.build();
	}
}

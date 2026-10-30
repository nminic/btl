package com.btl.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.web.util.OnCommittedResponseWrapper;

import java.util.Locale;
import java.util.function.IntSupplier;

/**
 * THE ANSWER, AND THE RENEWAL OF THE SESSION DECIDED AT THE MOMENT THE ANSWER IS COMMITTED.
 *
 * <p>{@link WhoIsAsking} knows before the route runs whether a session is due for renewal. It
 * does not know what the answer will be, and two things about the answer decide whether the
 * renewal may happen at all. So the filter hands the renewal here, and this does it - the row
 * and the cookie, together, or neither - when the answer is committed: on the first byte that
 * leaves, a flush, {@code sendError} or {@code sendRedirect} (which is what
 * {@link OnCommittedResponseWrapper} reports, the same hook Spring Security's
 * {@code HeaderWriterFilter} writes {@code Cache-Control} from), or, for an answer that wrote
 * no body at all, when the filter calls {@link #answered()} after the chain.
 *
 * <ul>
 * <li><b>Not on an answer that may be kept.</b> An answer whose own {@code Cache-Control} does
 * not say {@code no-store} - the pictures {@link PhotoApi} serves for a day, privately - is an
 * answer a cache may store, and a {@code Set-Cookie} stored with it is the member's secret handed
 * to whoever is served that copy next. Nothing between the server and the browser keeps such an
 * answer today; a rule at the edge that kept {@code /api/photos/*} regardless of what the origin
 * says would (security review of PR 656, 29.10.2026). So such an answer renews nothing: not the
 * cookie, and not the row either, because a row renewed without its cookie is the very gap the
 * renewal exists to close. The session is renewed by the next answer that is not kept, which on
 * a portal page is the one beside it. An answer that names no {@code Cache-Control} of its own is
 * NOT kept: the chain's header writer sits outside this filter and writes {@code no-store} on it
 * a moment later, which the case over a real socket reads off the renewed answer rather than
 * assuming.
 * <li><b>Not on an answer whose route has already said something about the session's cookie.</b>
 * Signing in hands out a new one and signing out hands out one that is over; a renewal added
 * beside either would leave the browser to choose between two cookies of one name. The question
 * is asked of the headers the answer CARRIES at that moment, and not of the calls that put them
 * there, so it is the same answer whether a route wrote its cookie through {@code addHeader},
 * through {@code setHeader} (which is how {@code ResponseEntity} writes every header in Spring 7,
 * emptying the name first), or through {@code addCookie}: all three end up as a
 * {@code Set-Cookie} line on the answer, and that line is what is read.
 * <li><b>And the cookie goes only if the row was really renewed</b>, that is, only if the
 * {@code update} touched exactly one row, and the row it names is the one with the id AND the hash
 * of the secret that arrived. A session deleted after the filter found it - signed out in another
 * tab, or ended by a password reset - is not handed back to the browser, and neither is a secret
 * that a password change replaced while the request was on its way: the row is still there, but it
 * is no longer the row that secret opens.
 * </ul>
 *
 * <p><b>WHAT IS NOT COVERED, and it is a boundary rather than an oversight.</b>
 *
 * <ul>
 * <li>A deletion that commits AFTER the renewing {@code update} returned 1 and before the browser
 * has the answer: the cookie goes out for a row that no longer exists. The row does not come back,
 * so the next request from that browser is simply not signed in; what the browser holds is a
 * dead secret with thirty days on it, the same thing it held before the renewal.
 * <li>An answer the chain refuses by throwing - 401 and 404 written by
 * {@code ExceptionTranslationFilter}, which sits outside this filter and writes to the answer it
 * was given - renews nothing, because nothing here is ever told about it. The member's next
 * answered request renews it.
 * <li>The renewal is written on the thread that commits the answer, and a route that commits it
 * inside its own transaction ({@code sendError} from a {@code @Transactional} method) has the
 * renewal written in that transaction. Every such route today returns straight after
 * {@code sendError}, so the transaction commits; one that rolled back afterwards would take the
 * row back while the cookie had already gone.
 * </ul>
 */
final class OneSessionCookie extends OnCommittedResponseWrapper {

	private String secret;

	private IntSupplier renewingTheRow;

	OneSessionCookie(HttpServletResponse response) {
		super(response);
	}

	/**
	 * The renewal this answer will carry if it may.
	 *
	 * @param secret         the secret that arrived, which is the one the row was found by and
	 *                       the one the renewing {@code update} must name it by again
	 * @param renewingTheRow the {@code update} of the row, returning how many rows it touched;
	 *                       run here and nowhere else, so the row is never renewed when the
	 *                       cookie may not go
	 */
	void renewWhenAnswered(String secret, IntSupplier renewingTheRow) {
		this.secret = secret;
		this.renewingTheRow = renewingTheRow;
	}

	/**
	 * The chain has returned. An answer that wrote nothing is committed by the container after
	 * this, so this is the last moment its headers can still be written; an answer that is
	 * already committed underneath without this wrapper having seen it is left alone entirely.
	 */
	void answered() {
		if (!getResponse().isCommitted()) {
			settle();
		}

		renewingTheRow = null;
	}

	@Override
	protected void onResponseCommitted() {
		settle();
	}

	private void settle() {
		IntSupplier renewing = renewingTheRow;
		renewingTheRow = null;

		if (renewing == null || mayBeKept() || theRouteSpokeAboutTheSession()) {
			return;
		}

		if (renewing.getAsInt() == 1) {
			super.addHeader(HttpHeaders.SET_COOKIE, SessionCookie.carrying(secret).toString());
		}
	}

	/** Whether the answer's own {@code Cache-Control} lets a cache store it. */
	private boolean mayBeKept() {
		java.util.Collection<String> said = getHeaders(HttpHeaders.CACHE_CONTROL);

		return !said.isEmpty() && said.stream()
				.noneMatch(one -> one.toLowerCase(Locale.ROOT).contains("no-store"));
	}

	private boolean theRouteSpokeAboutTheSession() {
		return getHeaders(HttpHeaders.SET_COOKIE).stream().anyMatch(SessionCookie::isOne);
	}
}

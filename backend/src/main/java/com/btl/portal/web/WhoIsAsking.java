package com.btl.portal.web;

import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.rights.TheNamedSuperadmin;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * WHO IS ASKING, worked out once at the front of every request under {@code /api}.
 *
 * <p>The cookie carries a secret and the row keeps only what it hashes to, so the
 * value that arrives is hashed before it is looked for. That is the same
 * arrangement signing in writes and signing out reads, and it is the reason a
 * stolen copy of the database opens nothing.
 *
 * <p><b>Not being signed in is not an error here.</b> No cookie, a cookie nobody
 * has, a session that ended: all three leave the request anonymous and go on.
 * What happens next is the chain's business - a codebook is answered, anything
 * else is 401 - and a filter that answered for it would be deciding twice.
 *
 * <p><b>A use is written down once a day, not once a click.</b> {@link SessionLife}
 * owns that rule and this asks it rather than repeating it: a member reading ten
 * pages in a minute must not cost ten writes, and a session that has been used
 * must not end on the calendar while somebody is in the middle of using it.
 *
 * <p><b>The renewal is one statement and it names the session by its id.</b>
 * Written against the hash it would be the same row today, and it would stop
 * being so the moment anything else reads a session; written against the account
 * it would move every device that member has.
 *
 * <p><b>AND THIS IS WHERE THE SUPERADMIN IS DECIDED, once, for the whole request.</b>
 * The owner named him by an address in the server's settings rather than by anything the
 * portal can write (PDL P21, 14.09.2026, „Superadmin se ne pravi kroz portal"), so the
 * role this filter hands on is not always the role the row carries.
 * {@link TheNamedSuperadmin} holds the whole of that question and this asks it in the one
 * place that already knows whose request this is - so {@link MeApi} tells the browser
 * which screens to draw, and {@link WhatHeMayDo} answers "may he", off ONE answer.
 * Derived twice they could disagree, and the half that disagreed would be a portal
 * drawing an administration whose routes refuse it, or worse, refusing to draw one whose
 * routes are open.
 */
final class WhoIsAsking extends OncePerRequestFilter {

	private final JdbcClient db;

	private final TheNamedSuperadmin named;

	WhoIsAsking(JdbcClient db, TheNamedSuperadmin named) {
		this.db = db;
		this.named = named;
	}

	/**
	 * What a session is worth knowing about, and nothing else is read.
	 *
	 * @param role            the role the ROW carries, before the settings are consulted
	 * @param address         {@code account.email}, read to be compared with the setting
	 *                        and never handed on
	 * @param addressConfirmed whether the address has been confirmed, which is the half of
	 *                        the owner's sentence that a claimed address does not satisfy
	 * @param everyRightRole  the name of the role holding {@code rights_mode = 'all'},
	 *                        read off the table rather than written here as the word
	 *                        {@code superadmin}: V5's partial unique index
	 *                        {@code role_only_one_holds_every_right} makes at most one role
	 *                        carry it and {@code RolesAndRightsTest} holds that there is
	 *                        one, so this is the schema answering rather than a second home
	 *                        for which role that is
	 */
	private record Open(long session, long account, String role, String address,
			boolean addressConfirmed, String everyRightRole, SessionLife.Session life) {

		/** The role this request carries, which is the row's unless the settings say otherwise. */
		String roleAfter(TheNamedSuperadmin named) {
			return named.covers(address, addressConfirmed) ? everyRightRole : role;
		}
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain chain) throws ServletException, IOException {

		Instant now = Instant.now();

		carried(request)
				.flatMap(this::sessionFor)
				.filter(one -> SessionLife.stillOpen(one.life(), now))
				.ifPresent(one -> {
					String role = one.roleAfter(named);

					SecurityContextHolder.getContext().setAuthentication(
							new UsernamePasswordAuthenticationToken(new Member(one.account(), role), null,
									List.of(new SimpleGrantedAuthority(
											"ROLE_" + role.toUpperCase(Locale.ROOT)))));

					if (SessionLife.worthRenewing(one.life(), now)) {
						db.sql("update account_session set last_used_at = ?, expires_at = ? where id = ?")
								.params(java.sql.Timestamp.from(now),
										java.sql.Timestamp.from(SessionLife.renewedUntil(now)),
										one.session())
								.update();
					}
				});

		/* THE CONTEXT IS NOT CLEARED HERE, and the line that did it was taken out
		   the same hour it was written.

		   It read as free tidiness: the thread goes back to a pool, so empty what is
		   on it. What it actually did was answer 403 to everybody who is not signed
		   in. `AuthorizationFilter` sits just after this one and throws; the exception
		   travels back up through this method, so a `finally` empties the context
		   BEFORE `ExceptionTranslationFilter` catches it. That filter then asks who
		   was asking, gets nobody rather than the anonymous token Spring put there,
		   and answers access denied instead of "you are not signed in".

		   ADL A46 says an unauthenticated request is answered 401, and the case that
		   holds it is `WhoIsAskingTest.nobodySignedInIsNobody`. Spring clears the
		   context itself, at the far end of the chain, where nothing is left to read
		   it. */
		chain.doFilter(request, response);
	}

	private static Optional<String> carried(HttpServletRequest request) {
		Cookie[] cookies = request.getCookies();

		if (cookies == null) {
			return Optional.empty();
		}

		/* No check for a null value, and that is measured rather than assumed: a
		   cookie is parsed out of a header by the container, so its value is at worst
		   the empty string. A check for null was written here and taken out because
		   nothing could reach it, and a branch nothing can reach is a branch nothing
		   can measure. If that assumption is ever wrong the next line throws, the
		   request is answered 500, and it is one line to find. */
		return java.util.Arrays.stream(cookies)
				.filter(one -> SessionCookie.NAME.equals(one.getName()))
				.map(Cookie::getValue)
				.filter(one -> !one.isBlank())
				.findFirst();
	}

	/**
	 * The session, the account behind it, and what the settings need in order to say
	 * whether that account is the superadmin - in the ONE statement this filter already
	 * made.
	 *
	 * <p>The address and the role holding every right are two columns more on a row that
	 * was being fetched anyway, so naming the superadmin costs no second round trip on any
	 * request. Asked separately it would be one more query per request for a question
	 * whose answer is no for everybody but one person.
	 */
	private Optional<Open> sessionFor(String secret) {
		return db.sql("select s.id, s.account_id, r.code, a.email, a.email_confirmed_at,"
						+ " (select code from role where rights_mode = 'all'),"
						+ " s.last_used_at, s.expires_at"
						+ " from account_session s"
						+ " join account a on a.id = s.account_id"
						+ " join role r on r.id = a.role_id"
						+ " where s.token_hash = ?")
				.param(SecretToken.hashOf(secret))
				.query((row, one) -> new Open(row.getLong(1), row.getLong(2), row.getString(3),
						row.getString(4), row.getTimestamp(5) != null, row.getString(6),
						new SessionLife.Session(row.getTimestamp(7).toInstant(),
								row.getTimestamp(8).toInstant())))
				.optional();
	}

	/**
	 * Who the portal has decided is asking.
	 *
	 * <p>The account and its role, and deliberately not a member number. Until
	 * 14.09.2026 the reason was that there was nothing to read one through; since
	 * V23 there is, because the owner decided „jedan nalog je tacno jedan clan"
	 * (PDL P21, 14.09.2026, „Jedan nalog je tacno jedan clan") and the link is a column on {@code
	 * account}.
	 *
	 * <p><b>What keeps it out now is what this record is for.</b> It is what the
	 * guard hands to every controller on every request, so anything in it is
	 * fetched on every request whether or not the route wants it, and a resource
	 * that needs the member reads him by the account it already has. The link is
	 * also empty for anybody who does not race, so the field would be null on the
	 * requests of a moderator and every reader would carry a branch for it.
	 */
	record Member(long account, String role) {
	}
}

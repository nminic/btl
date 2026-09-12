package com.btl.portal.web;

import com.btl.portal.domain.account.SessionLife;
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
 */
final class WhoIsAsking extends OncePerRequestFilter {

	private final JdbcClient db;

	WhoIsAsking(JdbcClient db) {
		this.db = db;
	}

	/** What a session is worth knowing about, and nothing else is read. */
	private record Open(long session, long account, String role, SessionLife.Session life) {
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
			FilterChain chain) throws ServletException, IOException {

		Instant now = Instant.now();

		carried(request)
				.flatMap(this::sessionFor)
				.filter(one -> SessionLife.stillOpen(one.life(), now))
				.ifPresent(one -> {
					SecurityContextHolder.getContext().setAuthentication(
							new UsernamePasswordAuthenticationToken(new Member(one.account(), one.role()), null,
									List.of(new SimpleGrantedAuthority(
											"ROLE_" + one.role().toUpperCase(Locale.ROOT)))));

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

	private Optional<Open> sessionFor(String secret) {
		return db.sql("select s.id, s.account_id, r.code, s.last_used_at, s.expires_at"
						+ " from account_session s"
						+ " join account a on a.id = s.account_id"
						+ " join role r on r.id = a.role_id"
						+ " where s.token_hash = ?")
				.param(SecretToken.hashOf(secret))
				.query((row, one) -> new Open(row.getLong(1), row.getLong(2), row.getString(3),
						new SessionLife.Session(row.getTimestamp(4).toInstant(),
								row.getTimestamp(5).toInstant())))
				.optional();
	}

	/**
	 * Who the portal has decided is asking.
	 *
	 * <p>The account and its role, and deliberately not a member number: V7 says in
	 * as many words that nothing joins an account to a competitor in either
	 * direction, because how many accounts one member may have is not decided. A
	 * field invented here would be the place that decision quietly got made.
	 */
	record Member(long account, String role) {
	}
}

package com.btl.portal.web;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

import java.util.List;

/**
 * Who may ask the server for what.
 *
 * <p><b>Everything is shut and a few things are opened by name.</b> Written the
 * other way round - open by default, shut what needs shutting - a route added
 * without a line here would be a route anybody could read, and it would be found
 * by whoever read it rather than by whoever wrote it. This way the same mistake
 * is a route nobody can reach, which is a bug report and not a leak.
 *
 * <p><b>A codebook is public and a person is not.</b> Places and countries are
 * lists of towns and states: nothing in them belongs to anybody. Everything else
 * waits for the increment that gives it a rule, and until then it is shut, which
 * is the safe direction while the portal still serves its own copies.
 *
 * <p><b>Nothing here keeps a session yet</b>, and that is a decision rather than
 * an omission: sessions arrive with signing in, and a server that creates one
 * for an anonymous reader of a codebook hands out a cookie that means nothing
 * and has to be minded anyway.
 *
 * <p>An unauthenticated request is answered 401 and not redirected to a form.
 * The portal is a single page application; a redirect to a login page is an
 * answer its fetch cannot read, and it would arrive as a parse error rather than
 * as "you are not signed in".
 */
@Configuration
class ApiSecurity {

	/**
	 * WHAT ANYBODY MAY READ, in one list because two places would disagree.
	 *
	 * <p>The codebooks, the calendar and the leagues: a list of towns, a list of
	 * states, what was run and when, and what each league counts and pays. Nothing in
	 * any of them belongs to anybody; the calendar is the page a visitor comes to the
	 * portal for, and somebody deciding whether to join reads a league's rules before
	 * anything else. Who RAN a race is a different resource and is not opened here.
	 *
	 * <p><b>It is a constant rather than four arguments because the guard reads
	 * it.</b> `ApiSecurityTest` takes every route on this list and asks whether a
	 * sub-path, a different spelling of it and a trailing slash are still shut, and
	 * whether writing to it is refused. Written out at the call site, each route
	 * added later would have had to be added to those cases by somebody who
	 * remembered they existed - and a review on 12.09.2026 measured what that costs:
	 * two routes were added here and to nothing else, so widening one of them to
	 * `/api/events/**` cost nothing in the whole suite.
	 */
	static final List<String> READ_BY_ANYBODY =
			List.of("/api/places", "/api/countries", "/api/events", "/api/races",
					"/api/leagues");

	@Bean
	SecurityFilterChain api(HttpSecurity http, JdbcClient db) throws Exception {
		return http
				.securityMatcher("/api/**")
				.authorizeHttpRequests(routes -> routes
						.requestMatchers(READ_BY_ANYBODY.toArray(String[]::new)).permitAll()
						/* Signing in is open by necessity: nobody can be asked to be signed in
						   in order to sign in. It is still the one open route that WRITES, and
						   what stands in front of it is that every wrong answer costs the guesser
						   a miss. The CSRF token below is NOT part of that, and the note on it
						   says why. */
						.requestMatchers("/api/sign-in").permitAll()
						/* AND SIGNING OUT IS OPEN TOO, which reads wrong until the case it is
						   for: a member whose session ended already. Asked to be signed in in
						   order to sign out, he is answered 401, the cookie in his browser is
						   never replaced, and nothing in the portal can ever clear it. What an
						   attacker gains by the route being open is that he can end a session
						   he cannot read, and only if he also holds the CSRF token; what the
						   member gains is that signing out works in the one case he needs it. */
						.requestMatchers("/api/sign-out").permitAll()
						.anyRequest().authenticated())
				/* AND NOW THERE IS A COOKIE, SO CSRF PROTECTION IS BACK. This chain gave
				   none until signing in existed, and the comment here said in as many words
				   that it would return with the cookie it is about. It has.

				   `csrf.spa()` and not a repository written out by hand, and a security round
				   on 12.09.2026 is why. Setting only `CookieCsrfTokenRepository.withHttpOnlyFalse()`
				   leaves the DEFAULT request handler in place, and that one expects the header to
				   carry an XOR masked token, not the raw value from the cookie. So a script doing
				   exactly what this comment described - read the cookie, echo it in a header -
				   got 403 on every request, correct password included. Not an attack: a door
				   nobody could open, and the test suite said the guard was proved.

				   `spa()` sets the same cookie repository AND the handler that goes with it.
				   The token is kept in a cookie rather than the session, which matters twice
				   over: the server stays without session state, and the case saying nothing
				   hands out a session keeps holding. The cookie is readable by script on
				   purpose - that is the whole mechanism, because another site can make a
				   browser send a request but cannot read a cookie from this origin.

				   WHAT THIS TOKEN DOES AND WHAT IT DOES NOT, because a round on 12.09.2026
				   proved the sentence that stood here wrong. It said the token was a second
				   lock beside SameSite. It is not a lock against anybody who speaks HTTP
				   directly: the check is that the cookie and the header MATCH, and neither is
				   tied to a secret the server keeps, so a caller writing his own request picks
				   both and passes. Measured, not argued: a request carrying a value the server
				   never issued, in both places, was accepted.

				   What it guards is the one thing it can - a browser made to send a request
				   from another site, which can be given a header but cannot read a cookie from
				   this origin to put in one.

				   And against that single case it is the SECOND guard, not the first. The
				   session cookie is SameSite=Strict, so a browser does not send it from another
				   site at all, and this application configures no CORS anywhere, so a cross
				   site request carrying this header would not survive its preflight. The token
				   is here because one guard that everything depends on is one mistake away from
				   none. Nothing else in the portal may be written as though it stopped a direct
				   caller. */
				.csrf(csrf -> csrf.spa())
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.httpBasic(basic -> basic.disable())
				.formLogin(form -> form.disable())
				/* AND WHO IS ASKING IS WORKED OUT BEFORE ANYTHING IS AUTHORISED, which is
				   what `addFilterBefore` is for. Put after `AuthorizationFilter` it would
				   run on a request that had already been refused, and every signed in
				   member would be answered 401 by a chain that was about to know who he
				   is. `ApiSecurityTest` measures that a member reaches a route that asks
				   for him. */
				.addFilterBefore(new WhoIsAsking(db), AuthorizationFilter.class)
				.exceptionHandling(handling -> handling
						.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
				.build();
	}

	/**
	 * And everything outside {@code /api} is left alone.
	 *
	 * <p>The portal itself is served by nginx and never reaches this application;
	 * what does reach it is the health check, which Spring Boot leaves open on
	 * purpose and which the container's own probe calls. Without this second chain
	 * the default one would apply and would ask a machine-to-machine probe to log
	 * in.
	 *
	 * <p><b>AND THIS CHAIN KEEPS NO SESSION EITHER.</b> It carried CSRF protection
	 * until a security round on 11.09.2026 measured what that costs against a live
	 * server: the default token repository is the one kept IN THE SESSION, so it
	 * calls {@code getSession()} the moment an unsafe method arrives without a
	 * token - before anything has decided whether the path even exists. A POST to a
	 * made up address came back 403 with a fresh {@code JSESSIONID} on it, and two
	 * of them came back with two different ones, which is a server handing out
	 * state to anybody who asks for it in a loop.
	 *
	 * <p>Turning it off here is the same sentence as on the chain above, for the
	 * same reason: CSRF protection guards a browser that sends credentials it was
	 * given, and nothing in this application gives any. It comes back with the
	 * cookie it is about, and when it does it will be the chain that HAS the cookie
	 * that gets it.
	 */
	@Bean
	SecurityFilterChain everythingElse(HttpSecurity http) throws Exception {
		return http
				.authorizeHttpRequests(routes -> routes.anyRequest().permitAll())
				.csrf(csrf -> csrf.disable())
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.build();
	}
}

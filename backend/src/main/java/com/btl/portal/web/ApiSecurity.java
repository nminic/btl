package com.btl.portal.web;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

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

	@Bean
	SecurityFilterChain api(HttpSecurity http) throws Exception {
		return http
				.securityMatcher("/api/**")
				.authorizeHttpRequests(routes -> routes
						.requestMatchers("/api/places", "/api/countries").permitAll()
						/* Signing in is open by necessity: nobody can be asked to be signed in
						   in order to sign in. It is still the one open route that WRITES, and
						   what stands in front of it is the CSRF token below and the fact that
						   every wrong answer costs the guesser a miss. */
						.requestMatchers("/api/sign-in").permitAll()
						.anyRequest().authenticated())
				/* AND NOW THERE IS A COOKIE, SO CSRF PROTECTION IS BACK. This chain gave
				   none until signing in existed, and the comment here said in as many words
				   that it would return with the cookie it is about. It has.

				   The token is kept in a COOKIE and not in the session, which matters twice
				   over: the server stays without session state, and the case saying nothing
				   hands out a session keeps holding. `withHttpOnlyFalse` is what lets the
				   portal's own script read the token and echo it in a header, which is the
				   whole mechanism - another site can make a browser send a request, but it
				   cannot read a cookie from this origin to put in a header.

				   The session cookie itself is SameSite=Strict, so it is not sent from
				   another site at all; the CSRF token is the second lock, on the reasoning
				   that one lock which everything depends on is one mistake away from none. */
				.csrf(csrf -> csrf.csrfTokenRepository(
						org.springframework.security.web.csrf.CookieCsrfTokenRepository.withHttpOnlyFalse()))
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.httpBasic(basic -> basic.disable())
				.formLogin(form -> form.disable())
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

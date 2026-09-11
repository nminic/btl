package com.btl.portal.web;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
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
						.anyRequest().authenticated())
				/* No cookie is issued and no session is kept, so there is no session for
				   anybody to ride: CSRF protection guards a browser that sends credentials
				   it was given, and nothing here gives any. It comes back in the increment
				   that signs somebody in, together with the cookie it is about. */
				.csrf(csrf -> csrf.disable())
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
	 */
	@Bean
	SecurityFilterChain everythingElse(HttpSecurity http) throws Exception {
		return http
				.authorizeHttpRequests(routes -> routes.anyRequest().permitAll())
				.csrf(Customizer.withDefaults())
				.build();
	}
}

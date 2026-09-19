package com.btl.portal.web;

import com.btl.portal.domain.rights.TheNamedSuperadmin;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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
	 * <p><b>And the price list, which the owner opened by name.</b> 04.08.2026,
	 * deleting the page that used to carry it: „cene su javne u Clanu 14 Pravilnika",
	 * and the fee beside them „se prikazuje svima, samo je ne placaju svi". It is what
	 * somebody reads BEFORE registering, so a price list behind a sign-in would be the
	 * portal asking to be joined before it says what joining costs.
	 *
	 * <p><b>And the written pages, which the portal must be able to show before anybody
	 * signs in at all.</b> A privacy policy and terms of use only a member could read
	 * would be the portal asking somebody to accept them before they can be read
	 * (`PDL.md`:3094, „moraju postojati pre lansiranja"), the rulebook is what those
	 * same terms point a prospective member at for the price of joining, and the
	 * president's address is drawn on the front page, which is the first thing a
	 * visitor sees.
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
					"/api/leagues", "/api/results",
					"/api/competitors",
					"/api/ducats",
					"/api/pairs",
					"/api/teams",
					"/api/pricing",
					"/api/pages");

	/**
	 * @param namedSuperadmins the addresses {@code deploy/.env} names, taken as an ARRAY so
	 *                         that the property binder does the splitting - it is the thing
	 *                         that already decides what a list-valued property looks like,
	 *                         and it decides it the same way for this file, for a
	 *                         {@code -D} on the command line and for the environment
	 *                         variable the deploy stacks set. More than one is the point
	 *                         rather than a nicety: „superadminskih naloga sme da bude vise
	 *                         ... sprovodi se brojem adresa u podesavanjima" (PDL P21).
	 *                         <p>WHAT CARRIES „Portal mora da radi normalno, bez
	 *                         superadmina, i bez pada" IS NOT THIS DEFAULT but the
	 *                         {@code btl.superadmin.email=} line in
	 *                         {@code application.properties}, and that is measured rather
	 *                         than believed: with the {@code :} taken off this placeholder
	 *                         the context still starts, because the key is declared there.
	 *                         The default is a second floor under a context assembled
	 *                         without that file - it costs a character and it is not what
	 *                         the requirement rests on
	 */
	@Bean
	SecurityFilterChain api(HttpSecurity http, JdbcClient db,
			@Value("${btl.superadmin.email:}") String[] namedSuperadmins) throws Exception {
		String[] open = READ_BY_ANYBODY.toArray(String[]::new);

		return http
				.securityMatcher("/api/**")
				.authorizeHttpRequests(routes -> routes
						/* WHAT IS OPEN IS OPEN FOR READING, AND SINCE 18.09.2026 THAT IS SAID
						   IN METHODS AND NOT ONLY IN THE NAME OF THE LIST.

						   Until this increment the rule above carried no method, so a path on
						   this list was open to every verb there is. Nothing measured it,
						   because no open path had ever mapped anything but a GET: the two
						   guarded routes on the portal, `/api/moderators` and `/api/payments`,
						   are both off this list. `/api/events` is the first path that is read
						   by anybody AND written by somebody, and it is what made the gap
						   visible rather than what created it.

						   WHAT THE GAP WAS, measured rather than argued. `WhatHeMayDo` casts
						   the principal to `WhoIsAsking.Member` and says in its own javadoc why
						   it does not ask whether there is one: a route that needs a right is a
						   route this file has not opened, so the chain answers 401 first. That
						   sentence stops being true the moment a guarded route sits on an open
						   path. A POST arriving here with no session is anonymous, its
						   principal is the string "anonymousUser", and the cast is a
						   ClassCastException - so the answer is 500, which is a THIRD answer
						   on /api that says "this address exists and takes a POST" while an
						   address mapping nothing goes on saying 404.

						   Shut by narrowing what is opened rather than by naming the verbs that
						   write, which is the same direction the whole file is written in: a
						   method nobody thought of is shut by this shape and open by the other
						   one. `OpenRoutesStayReadOnlyTest` holds the behaviour over a real
						   socket, and `anOpenPathIsOpenForReadingAndNotForWriting` holds the
						   rule itself. */
						.requestMatchers(HttpMethod.GET, open).permitAll()
						/* AND HEAD, which is the same read without the body. Spring serves it
						   off the GET handler, so leaving it out would not shut a route - it
						   would make the calendar answer 401 to the one verb that asks whether
						   it has changed. */
						.requestMatchers(HttpMethod.HEAD, open).permitAll()
						/* AND OPTIONS, which is NOT a read and is opened anyway, one line above
						   the rule that shuts it everywhere else. What is open by name has
						   nothing to hide about which verbs it takes, and
						   `askingWhatAnOpenRouteTakesIsLeftAlone` measures exactly that over
						   the whole list.

						   THE PRICE, named here rather than left to be found: `Allow` on an
						   open path now lists the writes that path maps, so OPTIONS on
						   /api/events says a POST lives there. That is a real sentence about a
						   real route, and it is accepted because this path is one a visitor is
						   invited to - the leak the rule below exists against is the
						   enumeration of addresses nobody could guess, and /api/events is not
						   one of those. Shutting it instead would overturn a decision measured
						   on 13.09.2026, which is not this increment's to overturn. */
						.requestMatchers(HttpMethod.OPTIONS, open).permitAll()
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
						/* AND REGISTERING IS OPEN FOR THE SAME REASON SIGNING IN IS: nobody
						   can be asked to be a member in order to become one. PDL:
						   „Registracija se radi iskljucivo na sajtu. Niko ne moze tehnicki da
						   se registruje mimo sistema", so this is the one door there is, and a
						   door only members may open would be a portal that cannot gain any.

						   IT IS THE FIRST OPEN ROUTE THAT MAKES SOMETHING, and it is worth
						   saying what stands in front of it, because it is less than what
						   stands in front of signing in. There, every wrong answer costs the
						   guesser one of ten misses; here there is nothing to guess at, and
						   what a caller spends is the server's: a full bcrypt, two rows and a
						   round trip to the relay, all inside one transaction. The CSRF token
						   below is not that guard and the note on it says why - it stops a
						   browser made to send a request from another site, and nothing else.

						   WHAT IS MISSING, NAMED HERE RATHER THAN LEFT TO BE FOUND: a rate
						   limit. `frontend/nginx.conf` gives `/api/sign-in` an exact-match
						   `limit_req` and writes out at length why an anonymous request that
						   costs a bcrypt inside a transaction can stop the whole portal; every
						   word of that applies here, and registering adds one of its own -
						   unlimited, it is a way of making the portal send mail to any address
						   anybody names, which is how a relay gets blacklisted. That line
						   belongs in nginx beside the one it copies, and PDL's „bot provera na
						   prijavi takmicara" belongs with it. Neither is in this increment. */
						.requestMatchers("/api/registration").permitAll()
						/* B66: CONFIRMING AN ADDRESS AND ASKING FOR A FORGOTTEN PASSWORD, open for
						   the same reason signing in is - whoever is asking has, by definition,
						   no session yet. PDL, owner, 31.07.2026: confirming the address is "uslov
						   za sve ostalo", so requiring the very thing it is a precondition of would
						   leave nobody able to satisfy it. PDL of 5284: a forgotten password is
						   asked for by "standardnim postupkom", which starts from a member who
						   cannot sign in - that is the whole reason he is here.

						   WHAT STANDS IN FRONT OF EACH ONE, named the way `/api/registration`'s own
						   note names it. `/api/email-confirmation` and `/api/password-reset` ask
						   for a 256 bit token nobody can guess at any rate a lock would help
						   against, so neither needs one. `/api/email-confirmation/resend` and
						   `/api/password-reset/request` ask only for an address and, like
						   `/api/registration`, cost this server a database round trip and, when an
						   account answers, a trip to the relay - so the same rate limit
						   `frontend/nginx.conf` gives registration belongs beside these two, and is
						   not in this increment either. */
						.requestMatchers("/api/email-confirmation").permitAll()
						.requestMatchers("/api/email-confirmation/resend").permitAll()
						.requestMatchers("/api/password-reset").permitAll()
						.requestMatchers("/api/password-reset/request").permitAll()
						/* AND NOTHING ELSE UNDER /api ANSWERS `OPTIONS`. Measured on a running
						   server on 13.09.2026, and it was a hole rather than an untidiness.

						   Spring answers `OPTIONS` ITSELF, out of the methods a path maps, and
						   never reaches the handler - so no annotation on that handler is read and
						   nothing about rights is consulted. A route that needs a right answered
						   200 with `Allow: GET,HEAD,OPTIONS` to a moderator who may not read it
						   and to a plain member, while an address that maps nothing answered 404.
						   That difference is a list of every administrative address, one request
						   at a time, and `Allow` adds which methods each of them takes.

						   It matters MORE now, not less: the refusal became 404 on 13.09.2026 so
						   that an address would not say it exists, and `OPTIONS` said it anyway,
						   whatever number a refused GET carried.

						   Denied by PATH and not by what is behind it, which is the whole point:
						   an address that exists and one that does not are refused by the same
						   line and answer the same thing, so there is nothing to count. The
						   routes opened above keep answering it, because their rule is matched
						   first.

						   THE DAY THIS APPLICATION CONFIGURES CORS, THIS LINE MOVES. A preflight
						   is an `OPTIONS` a browser sends on its own, and CORS support answers it
						   before this rule is reached only if it is configured to. There is no
						   CORS anywhere today (the note on the token below says so), the portal
						   is served from one origin, and nothing calls `OPTIONS` on purpose. */
						.requestMatchers(HttpMethod.OPTIONS, "/api/**").denyAll()
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
				.addFilterBefore(new WhoIsAsking(db, new TheNamedSuperadmin(namedSuperadmins)),
						AuthorizationFilter.class)
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

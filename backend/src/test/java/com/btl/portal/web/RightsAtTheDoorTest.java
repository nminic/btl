package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;

/**
 * WHO MAY, and what somebody who may not is told.
 *
 * <p>The owner, 13.09.2026: "superadmin odmah, moderator po privilegiji". Three
 * sentences come out of that and each is a case here: the superadmin passes with
 * nothing ticked, a moderator passes exactly where a box has been ticked for him, and
 * what he has no box for is REFUSED rather than queued - the queues are for what
 * members send in, not for what a moderator does.
 *
 * <p>And the refusal is <b>404</b>, decided by the owner the same day: a deep link held
 * by somebody without the right already lands him on the front page, the administration
 * draws no screen he may not open, so the server must not be the one place that says the
 * address is there.
 *
 * <p><b>TWO routes, asking for DIFFERENT rights, and that is not decoration.</b> With
 * one guarded route in the whole suite, "the right this route asks for" and "the only
 * right there is" are the same string, and a door reading a FIXED code passed every case
 * in this file on 13.09.2026. Two rights held by two moderators cross, so no constant
 * can satisfy both.
 *
 * <p>Both routes are registered for this test and nowhere else, the way
 * {@code ApiSecurityTest} registers one with a variable in it. This increment adds no
 * resource and no writing of any kind.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class RightsAtTheDoorTest {

	/** TWO ROUTES THAT NEED DIFFERENT RIGHTS, registered for this test and nowhere else. */
	@TestConfiguration
	static class TwoRoutesThatNeedDifferentRights {

		static final String ONE = "/api/one-that-needs-a-right";

		static final String ONE_NEEDS = "entity:members";

		static final String TWO = "/api/another-that-needs-another-right";

		static final String TWO_NEEDS = "queue:results";

		@RestController
		static class Probe {

			/** Never reached by anybody who may not, so its body is one no refusal may carry. */
			@GetMapping(ONE)
			@RightIsNeeded(ONE_NEEDS)
			String one() {
				return "through";
			}

			@GetMapping(TWO)
			@RightIsNeeded(TWO_NEEDS)
			String two() {
				return "through";
			}
		}
	}

	/**
	 * ROUTES UNDER {@code /api} THAT ANSWER WITHOUT ASKING FOR A RIGHT.
	 *
	 * <p>Three, and each of them a decision somebody made out loud. {@code /api/me} says
	 * who the portal thinks is asking and is meaningless to anybody it is not about;
	 * signing in and signing out are open by necessity and {@code ApiSecurity} says why
	 * beside each of them.
	 *
	 * <p><b>This is a written list, and the floor under it is in the same file.</b>
	 * {@code everyRouteUnderTheApiEitherNeedsARightOrIsNamedHere} reads the other side
	 * off the dispatcher and compares the two EXACTLY, so a name that stops being a route
	 * fails just as loudly as a route that is not named. Padding it to make a build pass
	 * is therefore not possible quietly, which is the whole reason it is a snapshot
	 * rather than a rule.
	 */
	private static final Set<String> ANSWERS_WITHOUT_A_RIGHT =
			Set.of("/api/me", "/api/sign-in", "/api/sign-out");

	private static final String HOLDS_THE_FIRST = "prvo-pravo@primer.rs";

	private static final String HOLDS_THE_SECOND = "drugo-pravo@primer.rs";

	private static final String EVERYTHING = "superadmin@primer.rs";

	private static final String A_MEMBER = "takmicar@primer.rs";

	private static final String NOTHING_IS_THERE = "/api/nema-ovoga";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/** The dispatcher, asked which routes declare what, rather than a list written again. */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/**
	 * FOUR PEOPLE, AND NOT ONE OF THEM IS THE ONLY ONE OF HIS KIND.
	 *
	 * <ul>
	 * <li><b>Two ticks each, never one.</b> With a single tick apiece, "holds any right at
	 * all" and "holds THIS right" give the same answer on every request below.
	 * <li><b>Each moderator holds the tick the OTHER one is refused.</b> Without that, a
	 * lookup that forgot to name the account would hand back an empty set anyway and pass,
	 * and a door asking for a fixed right would agree with one asking for its own.
	 * <li><b>Three modes and not one.</b> The superadmin holds nothing in the matrix and
	 * must pass; the competitor holds nothing and must not. Read as ticks alone the first
	 * is refused, read as "is he signed in" the second is let through.
	 * </ul>
	 */
	@BeforeEach
	void fourPeopleWhoAreNotEachOther() {
		account(HOLDS_THE_FIRST, "moderator");
		account(HOLDS_THE_SECOND, "moderator");
		account(EVERYTHING, "superadmin");
		account(A_MEMBER, "competitor");

		ticked(HOLDS_THE_FIRST, TwoRoutesThatNeedDifferentRights.ONE_NEEDS, "queue:payments");
		ticked(HOLDS_THE_SECOND, TwoRoutesThatNeedDifferentRights.TWO_NEEDS, "entity:events");
	}

	private void account(String email, String role) {
		db.sql("insert into account (email, role_id) values (?, (select id from role where code = ?))")
				.params(email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}
	}

	private MockHttpServletRequestBuilder carrying(MockHttpServletRequestBuilder asking,
			String email) {
		return email == null ? asking
				: asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private MockHttpServletResponse asked(String path, String email) throws Exception {
		return http.perform(carrying(get(path), email)).andReturn().getResponse();
	}

	private int statusOf(String path, String email) throws Exception {
		return asked(path, email).getStatus();
	}

	private MockHttpServletResponse askedWhatItTakes(String path, String email) throws Exception {
		return http.perform(carrying(options(path), email)).andReturn().getResponse();
	}

	/**
	 * A MODERATOR PASSES EXACTLY WHERE A BOX HAS BEEN TICKED FOR HIM.
	 *
	 * <p>The second half of the owner's sentence, and the half a portal defending itself
	 * with the word "moderator" would fail: the two moderators here differ in nothing
	 * except which boxes they hold.
	 */
	@Test
	void aModeratorWhoHoldsTheTickPasses() throws Exception {
		assertThat(statusOf(TwoRoutesThatNeedDifferentRights.ONE, HOLDS_THE_FIRST))
				.as("a moderator was refused a right that has been ticked for him")
				.isEqualTo(200);
	}

	/**
	 * AND IS REFUSED A RIGHT ANOTHER MODERATOR HOLDS.
	 *
	 * <p>Third part of the owner's sentence: what he has no privilege for "ne moze
	 * uopste", so a refusal and not a queue. He holds two ticks, neither of them this
	 * one, and the moderator beside him holds exactly this one - which is what makes the
	 * answer about HIM, and is the case the lookup in {@code WhatHeMayDo} names where it
	 * says the condition is about the account.
	 */
	@Test
	void aModeratorIsRefusedARightAnotherModeratorHolds() throws Exception {
		assertThat(db.sql("select count(*) from account_admin_right g join account a"
						+ " on a.id = g.account_id where a.email = ? and g.right_code = ?")
				.params(HOLDS_THE_FIRST, TwoRoutesThatNeedDifferentRights.ONE_NEEDS)
				.query(Integer.class).single())
				.as("nobody else holds this tick, so being refused it says nothing about whose"
						+ " ticks were read")
				.isOne();

		MockHttpServletResponse answer =
				asked(TwoRoutesThatNeedDifferentRights.ONE, HOLDS_THE_SECOND);

		assertThat(answer.getStatus())
				.as("a moderator holding %s and entity:events was let through a door asking for"
						+ " %s, which the moderator beside him holds",
						TwoRoutesThatNeedDifferentRights.TWO_NEEDS,
						TwoRoutesThatNeedDifferentRights.ONE_NEEDS)
				.isEqualTo(404);

		assertThat(answer.getStatus())
				.as("the refusal is 403, which says the address is real; the owner decided 404"
						+ " on 13.09.2026 precisely so that it would not")
				.isNotEqualTo(403);

		/* AND IT SAYS NOTHING. A body of any kind is something an address that is not
		   there would not have, and a body naming the missing right is the one place on
		   the portal that would tell a moderator an action he was not given exists
		   (ADL A8, 30.07.2026). */
		assertThat(answer.getContentAsString())
				.as("the refusal carried a body, which an address that is not there would not")
				.isEmpty();
	}

	/**
	 * AND EACH MODERATOR PASSES ONLY THE DOOR HIS OWN TICK OPENS.
	 *
	 * <p><b>This is the case a fixed right cannot survive, and it exists because one
	 * did.</b> On 13.09.2026 the door was made to ask for {@code entity:members} no matter
	 * what the route declared, and all 1567 cases stayed green - there was one guarded
	 * route and it asked for exactly that. The scenario behind it: a moderator ticked only
	 * for {@code queue:results} opens a route needing {@code entity:pricing} and rewrites
	 * the membership fee.
	 *
	 * <p>Four answers, crossed. Any single right written into the door agrees with one
	 * row and contradicts the other.
	 */
	@Test
	void eachModeratorPassesOnlyTheDoorHisOwnTickOpens() throws Exception {
		assertThat(TwoRoutesThatNeedDifferentRights.ONE_NEEDS)
				.as("both routes ask for the same right, so crossing them compares nothing")
				.isNotEqualTo(TwoRoutesThatNeedDifferentRights.TWO_NEEDS);

		assertThat(statusOf(TwoRoutesThatNeedDifferentRights.ONE, HOLDS_THE_FIRST))
				.as("the moderator ticked for the first right was refused the first door")
				.isEqualTo(200);
		assertThat(statusOf(TwoRoutesThatNeedDifferentRights.TWO, HOLDS_THE_FIRST))
				.as("the moderator ticked for the FIRST right opened the door asking for the"
						+ " SECOND, so the door is not reading what the route declared")
				.isEqualTo(404);

		assertThat(statusOf(TwoRoutesThatNeedDifferentRights.TWO, HOLDS_THE_SECOND))
				.as("the moderator ticked for the second right was refused the second door")
				.isEqualTo(200);
		assertThat(statusOf(TwoRoutesThatNeedDifferentRights.ONE, HOLDS_THE_SECOND))
				.as("the moderator ticked for the SECOND right opened the door asking for the"
						+ " FIRST, so the door is not reading what the route declared")
				.isEqualTo(404);
	}

	/**
	 * THE SUPERADMIN PASSES BOTH, WITH NOTHING TICKED ANYWHERE.
	 *
	 * <p>First part of the owner's sentence, and the one a portal that reads only the
	 * matrix gets wrong: he has no row in it on purpose (PDL P28a), because there is
	 * nothing to give him and nothing to take away. Both doors, so "everywhere a
	 * moderator with the tick passes" is measured rather than asserted.
	 */
	@Test
	void aSuperadminPassesWithoutASingleTick() throws Exception {
		assertThat(db.sql("select count(*) from account_admin_right where account_id ="
						+ " (select id from account where email = ?)")
				.param(EVERYTHING).query(Integer.class).single())
				.as("the superadmin was given ticks, so this case no longer says what it says")
				.isZero();

		assertThat(statusOf(TwoRoutesThatNeedDifferentRights.ONE, EVERYTHING))
				.as("the superadmin was refused, which is the matrix being read as the whole rule")
				.isEqualTo(200);
		assertThat(statusOf(TwoRoutesThatNeedDifferentRights.TWO, EVERYTHING))
				.as("the superadmin passed one door and not the other")
				.isEqualTo(200);
	}

	/**
	 * AND A MEMBER IS REFUSED, signed in or not.
	 *
	 * <p>His role holds nothing and can hold nothing. Without this case a door defended
	 * by "is there a session" reads exactly like one defended by a right.
	 */
	@Test
	void aCompetitorIsRefusedAlthoughHeIsSignedIn() throws Exception {
		assertThat(statusOf(TwoRoutesThatNeedDifferentRights.ONE, A_MEMBER))
				.as("being signed in was enough to open an administrative door")
				.isEqualTo(404);
	}

	/**
	 * A REFUSED MODERATOR IS TOLD NO MORE THAN SOMEBODY ASKING FOR NOTHING.
	 *
	 * <p><b>This is the owner's decision of 13.09.2026, written as a comparison rather
	 * than as a number.</b> Asked for a number, this case would go on passing the day the
	 * answer for an address that does not exist moved; asked as "are these two the same",
	 * it does not. A door that answers 403 fails it, and so does a door that answers 200.
	 */
	@Test
	void aRefusedModeratorIsToldNoMoreThanSomebodyAskingForNothing() throws Exception {
		int refused = statusOf(TwoRoutesThatNeedDifferentRights.ONE, HOLDS_THE_SECOND);
		int nothingThere = statusOf(NOTHING_IS_THERE, HOLDS_THE_SECOND);

		assertThat(refused)
				.as("a route he may not read answers differently from an address that is not"
						+ " there, so the portal tells him the address exists")
				.isEqualTo(nothingThere);

		assertThat(refused)
				.as("he was let through, so there is nothing being compared here")
				.isNotEqualTo(200);
	}

	/**
	 * NOBODY SIGNED IN IS ASKED TO SIGN IN, AND NOT REFUSED AND NOT LOST.
	 *
	 * <p>401, and both of the other two answers are named because each is a different
	 * mistake. 403 would say the address is real, to somebody the portal knows nothing
	 * about. 404 would throw away the one sentence the portal still needs to be able to
	 * say - a browser that gets it cannot tell "your session ran out" from "wrong
	 * address", and the single page application would stop offering to sign in.
	 *
	 * <p>It also holds the order this layer depends on: the chain refuses first, which is
	 * why {@code WhatHeMayDo} takes the session without asking whether there is one.
	 */
	@Test
	void nobodySignedInIsAskedToSignInRatherThanRefused() throws Exception {
		int answer = statusOf(TwoRoutesThatNeedDifferentRights.ONE, null);

		assertThat(answer).as("a stranger was not asked to sign in").isEqualTo(401);
		assertThat(answer)
				.as("a stranger was told a route needing a right exists")
				.isNotEqualTo(403);
		assertThat(answer)
				.as("a stranger cannot tell an ended session from a wrong address, so nothing"
						+ " can offer him the way back in")
				.isNotEqualTo(404);
	}

	/**
	 * THE RIGHT IS READ OFF THE SESSION AND OFF NOTHING THE CALLER WROTE.
	 *
	 * <p>The moderator who may not asks while handing the portal the superadmin's account
	 * and role in a header, in a query parameter and in the body. Every one of those is a
	 * thing the caller picks, and a permission read out of any of them is a permission he
	 * granted himself. The identity handed over is one that WOULD pass, so "read from the
	 * session" and "read from the request" cannot give the same answer.
	 */
	@Test
	void theRightIsReadFromTheSessionAndNotFromTheRequest() throws Exception {
		long his = db.sql("select id from account where email = ?").param(EVERYTHING)
				.query(Long.class).single();

		MockHttpServletResponse answer = http.perform(
						carrying(get(TwoRoutesThatNeedDifferentRights.ONE), HOLDS_THE_SECOND)
								.header("X-Account", his)
								.header("X-Role", "superadmin")
								.param("account", String.valueOf(his))
								.param("role", "superadmin")
								.contentType("application/json")
								.content("{\"account\":" + his + ",\"role\":\"superadmin\",\"right\":\""
										+ TwoRoutesThatNeedDifferentRights.ONE_NEEDS + "\"}"))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("an identity written into the request by whoever made it decided what he may do")
				.isEqualTo(404);
	}

	/**
	 * AND A ROUTE THAT DECLARES NOTHING IS LEFT ALONE.
	 *
	 * <p>Asked of {@code /api/me}, the portal's own route and not a probe, by a member
	 * with no administrative standing at all. A door that shut everything would pass every
	 * case above this one and would take the portal down on the first screen a member
	 * opens.
	 */
	@Test
	void aRouteThatDeclaresNoRightIsLeftAlone() throws Exception {
		assertThat(statusOf("/api/me", A_MEMBER))
				.as("a route that asks for no right was refused anyway")
				.isEqualTo(200);
	}

	/**
	 * AND AN ADDRESS NOTHING MAPS IS STILL NOT THERE.
	 *
	 * <p>Signed in, so the chain lets him past and the dispatcher answers. What answers is
	 * the handler that serves static files, which is not a method of this portal's and has
	 * no annotation to read. Without the line in the door that says so, this is a class
	 * cast and a 500 - a portal that breaks on a mistyped address.
	 */
	@Test
	void aSignedInMemberAskingForSomethingThatIsNotThereIsToldSo() throws Exception {
		assertThat(statusOf(NOTHING_IS_THERE, A_MEMBER))
				.as("a signed in member asking for an address nothing maps was not told it is"
						+ " not there")
				.isEqualTo(404);
	}

	/**
	 * AND ASKING WHAT A ROUTE TAKES SAYS NO MORE THAN ASKING FOR NOTHING.
	 *
	 * <p><b>Measured on a running server on 13.09.2026 and it was a hole.</b> Spring
	 * answers {@code OPTIONS} itself, out of the methods a path maps, and never dispatches
	 * to a handler - so no annotation is read and the door is not consulted at all. A
	 * guarded route answered 200 with {@code Allow: GET,HEAD,OPTIONS}, to a moderator who
	 * may not read it and to a plain member, while an address mapping nothing answered
	 * 404. One request per guess is then a list of every administrative address, and
	 * {@code Allow} says which methods each takes.
	 *
	 * <p>It matters more since the refusal became 404, not less: the whole purpose of that
	 * decision is that an address does not say it exists, and {@code OPTIONS} said it
	 * whatever number a refused read carried.
	 *
	 * <p>Asked by a plain member, because the leak was never about rights: he is somebody
	 * the portal will have thousands of.
	 */
	@Test
	void askingWhatAGuardedRouteTakesSaysNoMoreThanAskingForNothing() throws Exception {
		MockHttpServletResponse guarded =
				askedWhatItTakes(TwoRoutesThatNeedDifferentRights.ONE, A_MEMBER);

		assertThat(guarded.getStatus())
				.as("OPTIONS on a route he may not read answers differently from OPTIONS on an"
						+ " address that is not there, which is every administrative address"
						+ " enumerable one request at a time")
				.isEqualTo(askedWhatItTakes(NOTHING_IS_THERE, A_MEMBER).getStatus());

		assertThat(guarded.getStatus())
				.as("OPTIONS on a guarded route was answered")
				.isNotEqualTo(200);

		assertThat(guarded.getHeader("Allow"))
				.as("the answer listed which methods the route takes, which is the same sentence"
						+ " as saying it is there")
				.isNull();
	}

	/**
	 * AND ASKING IT OF AN OPEN ROUTE IS LEFT ALONE.
	 *
	 * <p>The other direction, and it is the one a blanket refusal would break. The six
	 * open resources are opened by name above that rule in {@code ApiSecurity}, so nothing
	 * about them changed; shutting {@code OPTIONS} across the whole of {@code /api} would
	 * pass the case above this one and fail here.
	 */
	@Test
	void askingWhatAnOpenRouteTakesIsLeftAlone() throws Exception {
		assertThat(askedWhatItTakes("/api/places", null).getStatus())
				.as("a catalogue anybody may read stopped saying what it takes")
				.isEqualTo(200);
	}

	/**
	 * EVERY RIGHT A ROUTE ASKS FOR IS ONE THE MATRIX REALLY HOLDS.
	 *
	 * <p><b>The floor under the annotation and the reason it is safe to use.</b> A misspelt
	 * right is not a door that is shut: {@code AdminRights} answers a superadmin yes to ANY
	 * string, so {@code entity:member} without its s would refuse every moderator and let
	 * through the one account that can do the most damage, with every other case in this
	 * file still green.
	 *
	 * <p>Neither side is written here. What the routes ask for is read off the dispatcher,
	 * and what the matrix holds off {@code admin_right}, where V5 generates the code from
	 * the pair that makes it. The foreign key on {@code account_admin_right} does not do
	 * this job: it guards a right somebody is GIVEN, not one a ROUTE asks for.
	 */
	@Test
	void everyRightARouteAsksForIsOneTheMatrixHolds() {
		List<String> asked = rightsRoutesAskFor();

		assertThat(asked)
				.as("no route asks for a right at all, so this compares nothing")
				.isNotEmpty();

		List<String> held = db.sql("select code from admin_right").query(String.class).list();

		assertThat(held)
				.as("the matrix holds no rights at all, so anything would be a subset of it")
				.isNotEmpty();

		assertThat(asked)
				.as("a route asks for a right the matrix does not hold; every moderator is refused"
						+ " it and the superadmin is let through, because his mode answers yes to"
						+ " any string there is")
				.isSubsetOf(held);
	}

	/**
	 * AND EVERY ROUTE THAT NEEDS A RIGHT IS SHUT TO SOMEBODY WHO IS NOT SIGNED IN.
	 *
	 * <p><b>A floor holding up a line that is NOT written.</b> {@code WhatHeMayDo} takes
	 * the session without asking whether there is one, because a route that needs a right
	 * is a route {@code ApiSecurity} has not opened and the chain answers 401 first.
	 * Written as a branch it could never be reached, and a branch nothing reaches is a
	 * branch nothing measures. So the precondition is measured over every route carrying a
	 * right rather than assumed in a comment.
	 */
	@Test
	void everyRouteThatNeedsARightIsShutToSomebodyWhoIsNotSignedIn() throws Exception {
		List<String> guarded = routesThatNeedARight();

		assertThat(guarded)
				.as("no route needs a right at all, so this asks about nothing")
				.isNotEmpty();

		for (String path : guarded) {
			assertThat(statusOf(path, null))
					.as("%s needs a right and answered somebody who is not signed in; the code that"
							+ " reads the session takes it without asking whether there is one", path)
					.isEqualTo(401);
		}
	}

	/**
	 * AND EVERY ROUTE UNDER {@code /api} EITHER NEEDS A RIGHT OR IS NAMED ON PURPOSE.
	 *
	 * <p><b>This is the floor under the mechanism itself, and it exists because the
	 * mechanism lets anything through by default.</b> A route written without the
	 * annotation is open to every signed in account, silently: measured on 13.09.2026, a
	 * route added with one happy case passed 1568 cases, and swapping the moderator in that
	 * case for a plain competitor passed too - he really was reading it. Without any case
	 * of its own the build still fell over, but on the coverage threshold and not on a
	 * sentence about permission, which is an objection that disappears the moment somebody
	 * writes the first case.
	 *
	 * <p>That is the same failure {@code ApiSecurity} is written backwards to avoid - shut
	 * unless opened by name - and {@code RightIsNeeded} names it as its own reason for
	 * existing. It cannot be fixed by defaulting to refusal here, because {@code /api/me}
	 * and signing in must answer without a right; so what is derived is the LIST, and the
	 * three that answer without one are named above. A fourth arrives at this line and
	 * asks for a decision once, instead of waiting to be found.
	 *
	 * <p>Compared exactly, both ways, which is what keeps the snapshot from being padded:
	 * a name here that is not a route fails as loudly as a route that is not named.
	 */
	@Test
	void everyRouteUnderTheApiEitherNeedsARightOrIsNamedHere() {
		List<String> withoutARight = mappings.getHandlerMethods().entrySet().stream()
				.filter(one -> rightOf(one.getValue()) == null)
				.flatMap(one -> pathsOf(one.getKey()))
				.filter(path -> path.startsWith("/api/"))
				.filter(path -> !ApiSecurity.READ_BY_ANYBODY.contains(path))
				.distinct().sorted().toList();

		assertThat(withoutARight)
				.as("every route under /api is either open or needs a right, which cannot be true"
						+ " while the portal serves who is asking")
				.isNotEmpty();

		assertThat(withoutARight)
				.as("a route under /api neither opens itself by name nor asks for a right, so"
						+ " every signed in account reads it - a competitor included; if that is"
						+ " meant, it belongs in ANSWERS_WITHOUT_A_RIGHT with the reason beside it")
				.containsExactlyInAnyOrderElementsOf(ANSWERS_WITHOUT_A_RIGHT);
	}

	/** What the routes declare, asked of the dispatcher as objects rather than read as text. */
	private List<String> rightsRoutesAskFor() {
		return mappings.getHandlerMethods().values().stream()
				.map(RightsAtTheDoorTest::rightOf)
				.filter(Objects::nonNull)
				.map(RightIsNeeded::value)
				.distinct().sorted().toList();
	}

	/** And the addresses those routes answer to, with a sample value where a variable stands. */
	private List<String> routesThatNeedARight() {
		return mappings.getHandlerMethods().entrySet().stream()
				.filter(one -> rightOf(one.getValue()) != null)
				.map(Map.Entry::getKey)
				.flatMap(RightsAtTheDoorTest::pathsOf)
				.map(pattern -> pattern.replaceAll("\\{[^/}]*\\}", "1").replace("**", "1"))
				.distinct().sorted().toList();
	}

	private static RightIsNeeded rightOf(HandlerMethod method) {
		return method.getMethodAnnotation(RightIsNeeded.class);
	}

	private static Stream<String> pathsOf(RequestMappingInfo info) {
		PathPatternsRequestCondition patterns = info.getPathPatternsCondition();
		return patterns == null ? info.getDirectPaths().stream() : patterns.getPatternValues().stream();
	}
}

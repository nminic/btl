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
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHO MAY, and what somebody who may not is told.
 *
 * <p>The owner, 13.09.2026: "superadmin odmah, moderator po privilegiji". Three
 * sentences come out of that and each is a case here: the superadmin passes with
 * nothing ticked, a moderator passes exactly where a box has been ticked for him, and
 * what he has no box for is REFUSED rather than queued - the queues are for what
 * members send in, not for what a moderator does.
 *
 * <p><b>The route these ask about is registered for this test and nowhere else</b>,
 * the same way {@code ApiSecurityTest} registers one with a variable in it. This
 * increment adds no resource and no writing of any kind; what it adds is the layer
 * that answers "may he", and a layer with nothing in front of it is a layer no case
 * can measure. When the first administrative route arrives it declares its right in
 * the same way, and the two floors at the bottom of this file take it in without a
 * line being added here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class RightsAtTheDoorTest {

	/** A ROUTE THAT NEEDS A RIGHT, registered for this test and nowhere else. */
	@TestConfiguration
	static class ARouteThatNeedsARight {

		static final String RIGHT = "entity:members";

		static final String PATH = "/api/one-that-needs-a-right";

		@RestController
		static class Probe {

			/**
			 * Never reached by anybody who may not, which is the point: what it answers
			 * with is a body no refusal may ever carry.
			 */
			@GetMapping(PATH)
			@RightIsNeeded(RIGHT)
			String guarded() {
				return "through";
			}
		}
	}

	/** The right the guarded route asks for, and the two nobody in this file is asked about. */
	private static final String THE_TICK = ARouteThatNeedsARight.RIGHT;

	private static final String WITHOUT = "bez-prava@primer.rs";

	private static final String WITH = "sa-pravom@primer.rs";

	private static final String EVERYTHING = "superadmin@primer.rs";

	private static final String A_MEMBER = "takmicar@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/** The dispatcher, asked which routes declare a right, rather than a list written again. */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	/**
	 * FOUR PEOPLE, AND NOT ONE OF THEM IS THE ONLY ONE OF HIS KIND.
	 *
	 * <p>Each pair in here exists because without it a wrong answer and a right one
	 * would read the same:
	 *
	 * <ul>
	 * <li><b>Two ticks each, never one.</b> With a single tick apiece, "holds any right
	 * at all" and "holds THIS right" give the same answer on every request below.
	 * <li><b>Somebody else holds the tick that is asked for.</b> Without him, a lookup
	 * that forgot to name the account would hand the moderator without it an empty set
	 * anyway and pass.
	 * <li><b>Three modes and not one.</b> The superadmin holds nothing in the matrix and
	 * must pass; the competitor holds nothing and must not. Read as ticks alone the
	 * first is refused, read as "is he signed in" the second is let through.
	 * </ul>
	 */
	@BeforeEach
	void fourPeopleWhoAreNotEachOther() {
		account(WITHOUT, "moderator");
		account(WITH, "moderator");
		account(EVERYTHING, "superadmin");
		account(A_MEMBER, "competitor");

		ticked(WITHOUT, "queue:results", "entity:events");
		ticked(WITH, THE_TICK, "queue:payments");
	}

	private void account(String email, String role) {
		db.sql("insert into account (email, role_id) values (?, (select id from role where code = ?))")
				.params(email, role).update();
	}

	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}
	}

	private SecretToken signedIn(String email) {
		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session;
	}

	private MockHttpServletResponse asked(String path, String email) throws Exception {
		MockHttpServletRequestBuilder asking = get(path);

		if (email != null) {
			asking = asking.cookie(new Cookie(SessionCookie.NAME, signedIn(email).secret()));
		}

		return http.perform(asking).andReturn().getResponse();
	}

	private int statusOf(String path, String email) throws Exception {
		return asked(path, email).getStatus();
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
		assertThat(statusOf(ARouteThatNeedsARight.PATH, WITH))
				.as("a moderator was refused a right that has been ticked for him")
				.isEqualTo(200);
	}

	/**
	 * AND IS REFUSED WHERE ONE HAS NOT, although he holds two others.
	 *
	 * <p>Third part of the owner's sentence: what he has no privilege for "ne moze
	 * uopste", so 403 and not 202 and not a queue. The other moderator holds exactly
	 * this tick, which is what makes the answer about him and not about moderators.
	 */
	@Test
	void aModeratorWhoHoldsTwoOtherTicksIsRefused() throws Exception {
		MockHttpServletResponse answer = asked(ARouteThatNeedsARight.PATH, WITHOUT);

		assertThat(answer.getStatus())
				.as("a moderator holding queue:results and entity:events was let through a door"
						+ " that asks for %s, which another moderator holds", THE_TICK)
				.isEqualTo(403);

		/* AND THE REFUSAL SAYS NOTHING. ADL A8, 30.07.2026, in the owner's words: a
		   moderator is not to know that actions he was not given even exist. A body
		   naming the right he is missing is the one place on the portal that would tell
		   him, and it is the shape a helpful hand adds without thinking. */
		assertThat(answer.getContentAsString())
				.as("the refusal carried a body, and a body here is where the missing right"
						+ " gets named")
				.isEmpty();
	}

	/**
	 * THE SUPERADMIN PASSES WITH NOTHING TICKED ANYWHERE.
	 *
	 * <p>First part of the owner's sentence, and the one a portal that reads only the
	 * matrix gets wrong: he has no row in it on purpose (PDL P28a), because there is
	 * nothing to give him and nothing to take away. He is asked about the same route the
	 * moderator with the tick passes, so "everywhere a moderator with the tick passes"
	 * is measured rather than asserted.
	 */
	@Test
	void aSuperadminPassesWithoutASingleTick() throws Exception {
		assertThat(db.sql("select count(*) from account_admin_right where account_id ="
						+ " (select id from account where email = ?)")
				.param(EVERYTHING).query(Integer.class).single())
				.as("the superadmin was given ticks, so this case no longer says what it says")
				.isZero();

		assertThat(statusOf(ARouteThatNeedsARight.PATH, EVERYTHING))
				.as("the superadmin was refused, which is the matrix being read as the whole rule")
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
		assertThat(statusOf(ARouteThatNeedsARight.PATH, A_MEMBER))
				.as("being signed in was enough to open an administrative door")
				.isEqualTo(403);
	}

	/**
	 * NOBODY SIGNED IN IS ASKED TO SIGN IN, AND NOT REFUSED.
	 *
	 * <p>401 and not 403, and the difference is not a nicety: 403 answers that the
	 * address is real and that there is something behind it, to somebody the portal
	 * knows nothing about. It also holds the order this layer depends on - the chain
	 * refuses first - which is why {@code WhatHeMayDo} takes the session without asking
	 * whether there is one.
	 */
	@Test
	void nobodySignedInIsAskedToSignInRatherThanRefused() throws Exception {
		assertThat(statusOf(ARouteThatNeedsARight.PATH, null))
				.as("a stranger was told a route needing a right exists")
				.isEqualTo(401);
	}

	/**
	 * THE RIGHT IS READ OFF THE SESSION AND OFF NOTHING THE CALLER WROTE.
	 *
	 * <p>The moderator who may not asks while handing the portal the superadmin's
	 * account and role in a header, in a query parameter and in the body. Every one of
	 * those is a thing the caller picks, and a permission read out of any of them is a
	 * permission he granted himself. The identity handed over is one that WOULD pass, so
	 * "read from the session" and "read from the request" cannot give the same answer.
	 */
	@Test
	void theRightIsReadFromTheSessionAndNotFromTheRequest() throws Exception {
		long his = db.sql("select id from account where email = ?").param(EVERYTHING)
				.query(Long.class).single();

		MockHttpServletResponse answer = http.perform(get(ARouteThatNeedsARight.PATH)
						.cookie(new Cookie(SessionCookie.NAME, signedIn(WITHOUT).secret()))
						.header("X-Account", his)
						.header("X-Role", "superadmin")
						.param("account", String.valueOf(his))
						.param("role", "superadmin")
						.contentType("application/json")
						.content("{\"account\":" + his + ",\"role\":\"superadmin\",\"right\":\""
								+ THE_TICK + "\"}"))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("an identity written into the request by whoever made it decided what he may do")
				.isEqualTo(403);
	}

	/**
	 * AND A ROUTE THAT DECLARES NOTHING IS LEFT ALONE.
	 *
	 * <p>Asked of {@code /api/me}, which is the portal's own route and not a probe, by a
	 * member with no administrative standing at all. A door that shut everything would
	 * pass every case above this one and would take the portal down on the first screen
	 * a member opens.
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
	 * <p>Signed in, so the chain lets him past and the dispatcher answers. What answers
	 * is the handler that serves static files, which is not a method of this portal's
	 * and has no annotation to read. Without the line in the door that says so, this is
	 * a class cast and a 500 - a portal that breaks on a mistyped address.
	 */
	@Test
	void aSignedInMemberAskingForSomethingThatIsNotThereIsToldSo() throws Exception {
		assertThat(statusOf("/api/nema-ovoga", A_MEMBER))
				.as("a signed in member asking for an address nothing maps was not told it is"
						+ " not there")
				.isEqualTo(404);
	}

	/**
	 * EVERY RIGHT A ROUTE ASKS FOR IS ONE THE MATRIX REALLY HOLDS.
	 *
	 * <p><b>This is the floor under the annotation and it is the reason the annotation
	 * is safe to use.</b> A misspelt right is not a door that is shut: {@code
	 * AdminRights} answers a superadmin yes to ANY string, so {@code entity:member}
	 * without its s would refuse every moderator and let the one account that can do the
	 * most damage straight through. Every case above this one would still be green.
	 *
	 * <p>Neither side of the comparison is written here. What the routes ask for is read
	 * off the dispatcher, and what the matrix holds is read off {@code admin_right},
	 * which is where V5 generates the code from the pair that makes it.
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
	 * <p><b>The second floor, and it holds up a line that is NOT written.</b> {@code
	 * WhatHeMayDo} takes the session without asking whether there is one, because a
	 * route that needs a right is a route {@code ApiSecurity} has not opened and the
	 * chain answers 401 first. Written as a branch it could never be reached, and a
	 * branch nothing reaches is a branch nothing measures. So the precondition is
	 * measured instead of being assumed, over every route that carries a right rather
	 * than the one somebody remembered.
	 *
	 * <p>The day a route is both opened to anybody and given a right to ask for, this
	 * goes red, and it goes red before the portal answers 500 to a stranger.
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

	/** What the routes declare, asked of the dispatcher as objects rather than read as text. */
	private List<String> rightsRoutesAskFor() {
		return mappings.getHandlerMethods().values().stream()
				.map(RightsAtTheDoorTest::rightOf)
				.filter(java.util.Objects::nonNull)
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

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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
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
@Import({TestcontainersConfiguration.class, ProbeRoutes.class})
@Transactional
class RightsAtTheDoorTest {

	/**
	 * ROUTES THE PORTAL ANSWERS WITHOUT ASKING FOR A RIGHT, wherever they are.
	 *
	 * <p>Each one a decision somebody made out loud. {@code /api/me} says who the portal
	 * thinks is asking and is meaningless to anybody it is not about; signing in and signing
	 * out are open by necessity and {@code ApiSecurity} says why beside each of them;
	 * {@code /error} is the error document itself, reached by the container when something
	 * has already gone wrong, and a portal that asked for a right before it could report an
	 * error would have nothing to report it with.
	 *
	 * <p><b>And {@code /api/comments} is the fourth, arriving on 13.09.2026 exactly the way
	 * the last paragraph of this note says a fourth would.</b> It is the first route of this
	 * portal that is neither public nor administrative. „Komentare vide samo prijavljeni
	 * clanovi BTL. Drugim (posetiocima) se ne prikazuju" (owner, 11.08.2026), so it is not on
	 * {@code READ_BY_ANYBODY} and the chain answers a visitor 401; and reading a comment is
	 * not a moderator's action, so there is no box to tick for it and EVERY signed in account
	 * reads it, a plain competitor included. That is the sentence the assertion below asks
	 * somebody to write down, and it is written down here. What holds the other half - that a
	 * visitor really is refused - is {@code CommentApiTest}, because this file measures what a
	 * route DECLARES and not what the chain in front of it does.
	 *
	 * <p><b>And {@code /api/attendance} joins it, closed the identical way and for the
	 * identical reason.</b> It is neither public nor administrative either: „Tu listu ko je
	 * prijavljen takođe vide samo ulogovani članovi" (owner, 11.08.2026), so it is absent from
	 * {@code READ_BY_ANYBODY} and a visitor is refused before this door is ever asked; and
	 * reading who is going is not a moderator's action, so there is no box to tick for it and
	 * every signed in account reads it, a plain competitor included. {@code AttendanceApiTest}
	 * holds the other half, that a visitor really is refused, because this file only measures
	 * what a route DECLARES.
	 *
	 * <p><b>AND {@code /api/verification} IS THE SIXTH, AND IT IS HERE FOR A REASON
	 * NEITHER OF THE OTHER TWO HAS: THE PRIVILEGE IS DECIDED BY THE ROW AND NOT BY THE
	 * ROUTE.</b> {@link RightIsNeeded} names ONE code, and the verification screen has SIX
	 * queues with one right apiece ({@code PDL.md:3906}, V5's six {@code queue:} rows).
	 * The question that resource answers is not „may he" but „which of the six may he",
	 * because a moderator holding {@code queue:comments} and nothing else must be served
	 * the comments and must not learn that a payments queue exists (owner, 30.07.2026,
	 * {@code PDL.md:4308}: „Ne skriva se samo ekran nego i saznanje da ekran postoji").
	 * One code written on the route could only be one of the six, so it would shut the
	 * route to five moderators out of six or open all six queues to any one of them.
	 *
	 * <p><b>Which means this floor stops asserting anything about that address, and the
	 * two guards it would have given it are owed elsewhere.</b> Said plainly because a
	 * name on this list reads as „every signed in account reads it" and for this one that
	 * is FALSE: a competitor is refused, and so is a moderator with no queue ticked. What
	 * holds that is {@code VerificationApiTest}, which asks as a competitor and demands
	 * 404, and {@code RightsOverRealHttpTest.theQueueSaysNothingToSomebodyWithNoQueueOfHisOwn},
	 * which compares his refusal with the answer to an address that does not exist, byte
	 * for byte, off a socket - the only place the container's ERROR dispatch runs.
	 *
	 * <p><b>This list is not about {@code /api}, and that is the correction of 13.09.2026.</b>
	 * It said {@code /api/} once, and a review measured what that was worth: a
	 * {@code @GetMapping("/cenovnik")} written without the annotation answered 200 to
	 * somebody who is not signed in at all, and the whole suite stayed green. One character
	 * outside {@code /api} there is no interceptor, no chain that asks for a session and no
	 * floor - so the floor now looks at everything the portal's controllers map, and
	 * anything meant to answer without a right is named here with its reason.
	 *
	 * <p><b>It is a written list, and the floor under it is in the same file.</b>
	 * {@code everyRouteTheControllersMapEitherNeedsARightOrIsNamedHere} reads the other side
	 * off the dispatcher and compares the two EXACTLY, so a name that stops being a route
	 * fails just as loudly as a route that is not named. Padding it to make a build pass is
	 * therefore not possible quietly, which is the whole reason it is a snapshot rather than
	 * a rule.
	 */
	private static final Set<String> ANSWERS_WITHOUT_A_RIGHT =
			Set.of("/api/me", "/api/sign-in", "/api/sign-out", "/api/comments",
					"/api/attendance", "/api/verification", "/error");

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

		ticked(HOLDS_THE_FIRST, ProbeRoutes.THE_RIGHT_IT_NEEDS, "queue:payments");
		ticked(HOLDS_THE_SECOND, ProbeRoutes.THE_OTHER_RIGHT, "entity:events");
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', ?, (select id from role where code = ?))")
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
		assertThat(statusOf(ProbeRoutes.NEEDS_A_RIGHT, HOLDS_THE_FIRST))
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
				.params(HOLDS_THE_FIRST, ProbeRoutes.THE_RIGHT_IT_NEEDS)
				.query(Integer.class).single())
				.as("nobody else holds this tick, so being refused it says nothing about whose"
						+ " ticks were read")
				.isOne();

		MockHttpServletResponse answer =
				asked(ProbeRoutes.NEEDS_A_RIGHT, HOLDS_THE_SECOND);

		assertThat(answer.getStatus())
				.as("a moderator holding %s and entity:events was let through a door asking for"
						+ " %s, which the moderator beside him holds",
						ProbeRoutes.THE_OTHER_RIGHT,
						ProbeRoutes.THE_RIGHT_IT_NEEDS)
				.isEqualTo(404);

		assertThat(answer.getStatus())
				.as("the refusal is 403, which says the address is real; the owner decided 404"
						+ " on 13.09.2026 precisely so that it would not")
				.isNotEqualTo(403);

		/* WHAT THE REFUSAL LOOKS LIKE IS NOT ASKED HERE, and the case that used to ask it
		   was wrong. It asserted the body was EMPTY, which is the opposite of what the
		   owner's decision needs: an address that is not there answers with the error
		   document the container writes, so a refusal that carries nothing is a refusal
		   anybody can tell apart from it. Worse, the assertion could not have been right
		   either way - MockMvc does not run the container's ERROR dispatch, so the body is
		   empty here whatever the code does. It is measured in `RightsOverRealHttpTest`,
		   off a socket, against the whole answer. */
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
		assertThat(ProbeRoutes.THE_RIGHT_IT_NEEDS)
				.as("both routes ask for the same right, so crossing them compares nothing")
				.isNotEqualTo(ProbeRoutes.THE_OTHER_RIGHT);

		assertThat(statusOf(ProbeRoutes.NEEDS_A_RIGHT, HOLDS_THE_FIRST))
				.as("the moderator ticked for the first right was refused the first door")
				.isEqualTo(200);
		assertThat(statusOf(ProbeRoutes.NEEDS_ANOTHER_RIGHT, HOLDS_THE_FIRST))
				.as("the moderator ticked for the FIRST right opened the door asking for the"
						+ " SECOND, so the door is not reading what the route declared")
				.isEqualTo(404);

		assertThat(statusOf(ProbeRoutes.NEEDS_ANOTHER_RIGHT, HOLDS_THE_SECOND))
				.as("the moderator ticked for the second right was refused the second door")
				.isEqualTo(200);
		assertThat(statusOf(ProbeRoutes.NEEDS_A_RIGHT, HOLDS_THE_SECOND))
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

		assertThat(statusOf(ProbeRoutes.NEEDS_A_RIGHT, EVERYTHING))
				.as("the superadmin was refused, which is the matrix being read as the whole rule")
				.isEqualTo(200);
		assertThat(statusOf(ProbeRoutes.NEEDS_ANOTHER_RIGHT, EVERYTHING))
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
		assertThat(statusOf(ProbeRoutes.NEEDS_A_RIGHT, A_MEMBER))
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
		int refused = statusOf(ProbeRoutes.NEEDS_A_RIGHT, HOLDS_THE_SECOND);
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
		int answer = statusOf(ProbeRoutes.NEEDS_A_RIGHT, null);

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
						carrying(get(ProbeRoutes.NEEDS_A_RIGHT), HOLDS_THE_SECOND)
								.header("X-Account", his)
								.header("X-Role", "superadmin")
								.param("account", String.valueOf(his))
								.param("role", "superadmin")
								.contentType("application/json")
								.content("{\"account\":" + his + ",\"role\":\"superadmin\",\"right\":\""
										+ ProbeRoutes.THE_RIGHT_IT_NEEDS + "\"}"))
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
				askedWhatItTakes(ProbeRoutes.NEEDS_A_RIGHT, A_MEMBER);

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
	 * AND ASKING IT OF AN OPEN ROUTE IS LEFT ALONE, of EVERY open route.
	 *
	 * <p>The other direction, and it is the one a blanket refusal would break. What is
	 * opened by name is opened above that rule in {@code ApiSecurity}, so nothing about it
	 * changed; shutting {@code OPTIONS} across the whole of {@code /api} would pass the case
	 * above this one and fail here.
	 *
	 * <p><b>The list is read off the constant and not written again</b>, which is the shape
	 * {@code ApiSecurityTest.noOpenRouteOpensAnythingBesideIt} already uses and the reason it
	 * uses it: this case named {@code /api/places} alone, so a rule that shut {@code OPTIONS}
	 * for nine of the open resources and left the tenth would have passed the whole suite.
	 * Nothing here counts them either - a number in a comment is read as though somebody had
	 * counted, so nobody counts again.
	 */
	@Test
	void askingWhatAnOpenRouteTakesIsLeftAlone() throws Exception {
		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("nothing is open at all, so this asks about nothing")
				.isNotEmpty();

		for (String open : ApiSecurity.READ_BY_ANYBODY) {
			assertThat(askedWhatItTakes(open, null).getStatus())
					.as("%s is open to anybody and stopped saying what it takes", open)
					.isEqualTo(200);
		}
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
	 *
	 * <p><b>Over every route the DOOR decides and not only over those that name a right</b>
	 * (14.09.2026). {@code /api/moderators} is guarded by {@code OnlyTheSuperadmin} and
	 * declares no right at all, and the precondition this case holds up is the same one
	 * for it: {@code WhatHeMayDo.holdsEveryRightThereIs} takes the session without asking
	 * whether there is one.
	 */
	@Test
	void everyRouteThatNeedsARightIsShutToSomebodyWhoIsNotSignedIn() throws Exception {
		List<String> guarded = routesTheDoorDecides();

		assertThat(guarded)
				.as("no route is decided at the door at all, so this asks about nothing")
				.isNotEmpty();

		for (String path : guarded) {
			assertThat(statusOf(path, null))
					.as("%s is decided at the door and answered somebody who is not signed in; the"
							+ " code that reads the session takes it without asking whether there"
							+ " is one", path)
					.isEqualTo(401);
		}
	}

	/**
	 * AND EVERY ROUTE THE DOOR DECIDES IS SHUT TO A PLAIN MEMBER, although he is signed in.
	 *
	 * <p><b>This is the floor under the MARK, and it closes the one gap the mark could
	 * otherwise open.</b> {@code AskedAtTheDoor} says that an annotation is one the door
	 * asks about, and the floor below counts guarded routes by it - but carrying the mark
	 * does not make {@code RightsAtTheDoor} ask anything. An annotation marked and not
	 * wired into {@code preHandle} would be a guard that guards nothing, and the route
	 * wearing it would quietly answer every signed in account while this file went on
	 * calling it guarded.
	 *
	 * <p>So it is measured rather than trusted, over every such route and by asking the
	 * person a portal has thousands of: a competitor whose role holds nothing and can hold
	 * nothing. A door defended by „is there a session" reads exactly like one defended by
	 * a right until this case is written, and a mark with nothing behind it reads exactly
	 * like a guard.
	 *
	 * <p><b>Derived from the dispatcher, so it has no list either</b>, and it names no
	 * annotation - the route added tomorrow under a guard nobody here has heard of is
	 * asked on the day it is mapped.
	 */
	@Test
	void everyRouteTheDoorDecidesIsShutToACompetitorAlthoughHeIsSignedIn() throws Exception {
		List<String> guarded = routesTheDoorDecides();

		assertThat(guarded)
				.as("no route is decided at the door at all, so this asks about nothing")
				.isNotEmpty();

		for (String path : guarded) {
			assertThat(statusOf(path, A_MEMBER))
					.as("%s is decided at the door and being signed in was enough to open it; a"
							+ " guard annotation the door does not actually ask about looks exactly"
							+ " like one it does", path)
					.isEqualTo(404);
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
	 *
	 * <p><b>And it looks at EVERYTHING the controllers map, not at {@code /api}.</b> Written
	 * with that filter it closed the class only under {@code /api}, and one character outside
	 * it there is no interceptor ({@code addPathPatterns("/api/**")}), no chain asking for a
	 * session (the second one ends in {@code permitAll}) and, until this line changed, no
	 * floor either. Measured on 13.09.2026: a route mapped at {@code /cenovnik} without the
	 * annotation answered 200 to a stranger, and all 1572 cases stayed green.
	 *
	 * <p><b>AND "GUARDED" IS NO LONGER THE SAME SENTENCE AS "CARRIES
	 * {@code RightIsNeeded}", which is the correction of 14.09.2026.</b>
	 * {@code /api/moderators} is guarded and declares no right, because there is no tick
	 * that opens it and the owner refused to invent one („Ne treba ni da postoji kolona
	 * moderatori jer samo superadmin ima ta prava", 13.08.2026, {@code PDL.md:4403}). Read
	 * as before, this floor would have forced that route into the snapshot above as one
	 * that answers WITHOUT a guard, which is the exact opposite of the truth and would be
	 * a lie sitting inside the floor.
	 *
	 * <p><b>And it is not repaired with a list of the two annotation types.</b> That is
	 * the shape the repo measured and rejected on 05.09.2026: a list inside a floor is
	 * another thing somebody has to remember to extend, and the day a third kind of guard
	 * arrived this floor would go on passing while demanding that its routes be declared
	 * unguarded. What the question binds to instead is something the language already
	 * says - {@link #theDoorDecides} asks each annotation whether it is itself marked
	 * {@link AskedAtTheDoor} - so a third kind is counted on the day it is written, and
	 * nothing here names either of the two that exist.
	 */
	@Test
	void everyRouteTheControllersMapEitherNeedsARightOrIsNamedHere() {
		List<String> withoutAGuard = mappings.getHandlerMethods().entrySet().stream()
				.filter(one -> !theDoorDecides(one.getValue()))
				.flatMap(one -> pathsOf(one.getKey()))
				.filter(path -> !ApiSecurity.READ_BY_ANYBODY.contains(path))
				.distinct().sorted().toList();

		assertThat(withoutAGuard)
				.as("every route the portal maps is either open or decided at the door, which"
						+ " cannot be true while the portal serves who is asking")
				.isNotEmpty();

		assertThat(withoutAGuard)
				.as("a route neither opens itself by name nor is decided at the door. Under /api"
						+ " that means every signed in account reads it, a competitor included;"
						+ " OUTSIDE /api it means anybody at all does, signed in or not. If that is"
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
	private List<String> routesTheDoorDecides() {
		return mappings.getHandlerMethods().entrySet().stream()
				.filter(one -> theDoorDecides(one.getValue()))
				.map(Map.Entry::getKey)
				.flatMap(RightsAtTheDoorTest::pathsOf)
				.map(pattern -> pattern.replaceAll("\\{[^/}]*\\}", "1").replace("**", "1"))
				.distinct().sorted().toList();
	}

	private static RightIsNeeded rightOf(HandlerMethod method) {
		return method.getMethodAnnotation(RightIsNeeded.class);
	}

	/**
	 * WHETHER THIS ROUTE IS ONE THE DOOR DECIDES, ASKED OF THE ANNOTATIONS THEMSELVES.
	 *
	 * <p><b>There is no list of guard annotations here, and that is the whole of this
	 * method.</b> Until 14.09.2026 „guarded" and „carries {@code RightIsNeeded}" were the
	 * same sentence, because there was one kind of guard. {@code OnlyTheSuperadmin} is the
	 * second - {@code /api/moderators} is opened by no tick at all (owner, 13.08.2026,
	 * {@code PDL.md:4403}), so it can declare no right - and the obvious repair, a list of
	 * the two annotation types, is the shape the repo measured and rejected on 05.09.2026:
	 * a list inside a floor is another thing somebody has to remember to extend, and the
	 * day a third kind of guard is written this floor would go on passing while demanding
	 * that its routes be declared as answering WITHOUT a guard.
	 *
	 * <p>So what is asked is what the language already says. Each annotation on the method
	 * is asked whether it is itself marked {@code AskedAtTheDoor}, which is the mark
	 * {@code RightIsNeeded} and {@code OnlyTheSuperadmin} both carry and which a third kind
	 * carries by being written at all. Nothing here names either of them.
	 */
	private static boolean theDoorDecides(HandlerMethod method) {
		return Stream.of(method.getMethod().getAnnotations())
				.anyMatch(one -> one.annotationType().isAnnotationPresent(AskedAtTheDoor.class));
	}

	private static Stream<String> pathsOf(RequestMappingInfo info) {
		PathPatternsRequestCondition patterns = info.getPathPatternsCondition();
		return patterns == null ? info.getDirectPaths().stream() : patterns.getPatternValues().stream();
	}
}

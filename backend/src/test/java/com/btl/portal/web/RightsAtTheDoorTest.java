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
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.web.access.WebInvocationPrivilegeEvaluator;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

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
	 * queues with one right apiece (PDL P28a, 24.08.2026, „Verifikacija ima šest redova", V5's six
	 * {@code queue:} rows). The question that resource answers is not „may he" but „which of the six
	 * may he", because a moderator holding {@code queue:comments} and nothing else must be served
	 * the comments and must not learn that a payments queue exists (owner, 30.07.2026, PDL P28a,
	 * 30.07.2026, „Moderator vidi samo redove i entitete": „Ne skriva se samo ekran nego i saznanje
	 * da ekran postoji"). One code written on the route could only be one of the six, so it would
	 * shut the route to five moderators out of six or open all six queues to any one of them.
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
	 * <p><b>AND {@code /api/registration} IS THE SEVENTH, AND IT IS THE FIRST ON THIS LIST
	 * THAT MAKES SOMETHING.</b> Signing in and signing out are open by necessity and
	 * neither creates a person; registering does, and it is open for the same shape of
	 * reason - nobody can be asked to be a member in order to become one, and PDL says
	 * there is no other door („Registracija se radi iskljucivo na sajtu. Niko ne moze
	 * tehnicki da se registruje mimo sistema"). It carries no right because there is no box
	 * anybody could tick that would let a visitor in; {@code ApiSecurity} opens it by name
	 * beside the other two, with the reason written there, and with what is NOT in front of
	 * it written there too.
	 *
	 * <p><b>AND {@code /api/inbox} IS THE EIGHTH, AND LIKE {@code /api/verification} IT
	 * MAKES THIS FLOOR ASSERT LESS THAN ITS NAME SUGGESTS.</b> A message may be private to
	 * one member (V13: „empty means everybody", so a named addressee means somebody in
	 * particular), so it is absent from {@code READ_BY_ANYBODY} and a visitor is refused
	 * before this door runs at all. But unlike {@code /api/comments} and
	 * {@code /api/attendance}, „every signed in account reads it" is not quite true here
	 * either: an account naming no member - a moderator who does not race - is refused 404
	 * by the controller itself, the identical shape {@code /api/verification} already has
	 * for a moderator with no queue ticked. There is no box to tick for having an inbox at
	 * all; it is not a privilege a superadmin grants, it is a consequence of being a member,
	 * so the check lives in {@code InboxApi} (through {@code MemberOfAccount}) rather than
	 * behind {@link RightIsNeeded}. {@code InboxApiTest} holds both halves: a visitor is
	 * refused, and so is a signed in account with no member behind it.
	 *
	 * <p><b>AND {@code /api/me/notifications} IS THE NINTH, CLOSED THE IDENTICAL WAY AND
	 * FOR THE IDENTICAL REASON.</b> A member's own six switches over the bell's mail (PDL
	 * P22) are exactly as personal as his inbox, and an account with no member behind it is
	 * refused the same 404, off the same {@code MemberOfAccount} lookup. {@code NotificationApiTest}
	 * holds both halves for this route the way {@code InboxApiTest} does for the other.
	 *
	 * <p><b>This list is not about {@code /api}, and that is the correction of 13.09.2026.</b>
	 * It said {@code /api/} once, and a review measured what that was worth: a
	 * {@code @GetMapping("/cenovnik")} written without the annotation answered 200 to
	 * somebody who is not signed in at all, and the whole suite stayed green. One character
	 * outside {@code /api} there is no interceptor, no chain that asks for a session and no
	 * floor - so the floor now looks at everything the portal's controllers map, and
	 * anything meant to answer without a right is named here with its reason.
	 *
	 * <p><b>AND {@code /api/me/applications} IS THE EIGHTH, CLOSED THE IDENTICAL WAY AND
	 * FOR THE IDENTICAL REASON {@code /api/attendance} IS.</b> ADL P-javno keeps it off
	 * {@code READ_BY_ANYBODY} - it answers nobody but the one competitor it is about, so a
	 * visitor is refused 401 before this door is ever asked - and reading what you yourself
	 * are waiting on is not a moderator's action, so there is no box to tick for it and
	 * every signed in account reads it, a plain competitor included.
	 * {@code MyApplicationsApiTest} holds the other half, that a visitor really is refused,
	 * because this file only measures what a route DECLARES.
	 *
	 * <p><b>AND B66 ADDS FOUR MORE, EACH OPEN FOR THE IDENTICAL REASON
	 * {@code /api/registration} IS.</b> {@code /api/email-confirmation} and
	 * {@code /api/password-reset} ask for a 256 bit token out of a link in a message, never
	 * for a session; {@code /api/email-confirmation/resend} and
	 * {@code /api/password-reset/request} ask only for an address, from somebody who is, by
	 * construction, not signed in - a member who could sign in would not be confirming his
	 * address or resetting a password he has forgotten. There is no box anybody could tick
	 * that would let such a person in, which is the same sentence written above about
	 * registering, and {@code ApiSecurity} opens all four by name with the reason written
	 * there.
	 *
	 * <p><b>AND B77 ADDS ONE, WHICH IS THE FIRST ROUTE A MEMBER WRITES AT A SUB-PATH.</b>
	 * {@code PUT /api/pairs/{id}} is somebody answering a question that was put to HIM, and
	 * there is no box anybody could tick that would open it: pairing up is what every member
	 * may do, which is the sentence {@code /api/comments} and {@code /api/me/applications} are
	 * on this list for. <b>What stands in place of a right is the invitation itself.</b> A
	 * {@code pair_invite} names the one person who may answer it, so the thing that protects
	 * this address is not a privilege somebody holds but the row's own {@code to_id}:
	 * {@code PairWriteApi} asks for the question AND its addressee in one statement, and
	 * {@code PairWriteApiTest} measures that a question belonging to somebody else answers
	 * exactly what a question that does not exist answers. The path cannot go on
	 * {@link ApiSecurity#READ_BY_ANYBODY} instead, because that list GRANTS reading to a
	 * visitor and nothing at this address may be read at all - {@code /api/pairs} is on it and
	 * this is a different path.
	 *
	 * <p><b>AND B77's OTHER HALF, {@code POST /api/pairs}, WHICH NOBODY HAD TO NAME UNTIL
	 * 19.09.2026 BECAUSE THE FLOOR THREW IT AWAY BY ADDRESS.</b> Putting the question is the
	 * same sentence as answering it - „pairing up is what every member may do" - and it is
	 * guarded by the same thing, the row rather than a privilege: the invitation names one
	 * addressee and {@code PairWriteApi} refuses a member who is already paired, so what
	 * stops a stranger is that there is nobody for him to be. It is written here in its own
	 * paragraph and not folded into the one above, because the two arrive by DIFFERENT
	 * roads: {@code /api/pairs/{id}} was always visible to this floor and was named the day
	 * it was written, while {@code /api/pairs} is on {@link ApiSecurity#READ_BY_ANYBODY} -
	 * pairs are read publicly (Pravilnik, Clan 73) - and a floor keyed by path alone excused
	 * every verb at that address, writing included.
	 *
	 * <p><b>AND THAT IS THE MEASUREMENT THIS SNAPSHOT'S SHAPE COST, AND WHY THE COST WAS
	 * TAKEN.</b> Until 18.09.2026 every write on this portal was a moderator's, and a bare
	 * path was enough because a write could not hide behind a read. In one day that went from
	 * none to three: {@code POST /api/teams}, {@code POST /api/pairs} and
	 * {@code PUT /api/pairs/{id}}, with more already in review behind them. EVERY ONE of the
	 * three would have been invisible to the old floor - two excused by an address on the
	 * open list, the third by a bare path standing in for every verb it maps. The old shape
	 * was cheaper to write and blind to a whole KIND of action rather than to one route;
	 * whoever grumbles at this list in a year is reading the bill for that.
	 *
	 * <p>The number is measured and not an impression: the seven writes this list carried
	 * before that day - signing in and out, registering, and the four links out of a message
	 * - are all on the routes {@code ApiSecurity} opens BY NAME to a stranger, because nobody
	 * can be asked to be signed in in order to sign in. Not one of them is a member acting as
	 * a member, and every one of the three above is.
	 *
	 * <p><b>WHICH MEANS, FROM 19.09.2026, WHAT EVERY FUTURE WRITE OWES.</b> Any route the
	 * portal adds must either carry a guard or be named HERE with its VERB, and there is no
	 * third way out: a bare path no longer covers a verb nobody considered. It is a line of
	 * work per route, and it falls exactly where the decision is - on whoever knows why the
	 * route answers without a right.
	 *
	 * <p><b>And what this list will say after a merge can be asked BEFORE the merge.</b>
	 * {@code backend/tools/what_the_door_will_say.py} reads the controllers, the open list
	 * and this snapshot straight out of git for a ref it never checks out, and prints the
	 * pairs the floor would list; it refuses to report at all unless it first reproduces this
	 * snapshot exactly over the ref that carries it. It found all three of the entries above
	 * while their branches were still in review, which is the alternative to finding them one
	 * at a time on a red gate.
	 *
	 * <p><b>It is a written list, and the floor under it is in the same file.</b>
	 * {@code everyRouteTheControllersMapEitherNeedsARightOrIsNamedHere} reads the other side
	 * off the dispatcher and compares the two EXACTLY, so a name that stops being a route
	 * fails just as loudly as a route that is not named. Padding it to make a build pass is
	 * therefore not possible quietly, which is the whole reason it is a snapshot rather than
	 * a rule.
	 *
	 * <p><b>AND EACH NAME CARRIES ITS VERB SINCE 19.09.2026, because a path is not a
	 * route.</b> Written as bare paths, a name here excused an address for EVERY method it
	 * maps: {@code /api/comments} standing for a {@code GET} would have gone on standing for
	 * a {@code POST} added to the same address tomorrow, and nothing would have said so. The
	 * floor keys by the pair, so the two sides can only be compared as pairs, and a verb
	 * added to an address already named arrives here and asks for a decision once.
	 *
	 * <p>{@code ANY /error} is the one entry that names no verb, because the mapping names
	 * none: {@code BasicErrorController} limits nothing and answers whatever the container
	 * dispatches to it. It is written as the word rather than as eight lines, and the floor
	 * never treats it as an excuse for a verb, because a mapping that limits no verb cannot
	 * be excused by the open list at all.
	 *
	 * <p><b>AND {@code POST /api/teams} IS THE FIRST WRITE ON THIS LIST, WHICH IS A
	 * DIFFERENT SENTENCE FROM EVERY ONE ABOVE IT.</b> Everything else here either answers a
	 * read or is open because nobody could be asked to be signed in for it. This one is a
	 * write done by a MEMBER: „only a member can propose a team" (V11), so there is no box a
	 * superadmin could tick that would open it, and {@link RightIsNeeded} could only name one
	 * that shuts it to the people it is for. What stands in its place is that the proposal is
	 * not the team - it goes into a queue and a moderator decides - so the privilege sits on
	 * the DECISION and not on the proposing, and {@code TeamWriteApi} carries the four
	 * refusals that make „a member" mean a member: signed in, with a competitor record, in no
	 * team, inside the transfer window.
	 *
	 * <p>It arrives here the way this note says a new one would, and it is the reason the
	 * floor below was corrected on 19.09.2026: {@code /api/teams} is on
	 * {@code READ_BY_ANYBODY}, so read by the path alone this route was excused by the
	 * address and this line would never have been written. It was invisible for the length of
	 * one merge.
	 */
	private static final Set<String> ANSWERS_WITHOUT_A_RIGHT =
			Set.of("GET /api/me", "POST /api/sign-in", "POST /api/sign-out",
					"GET /api/comments", "GET /api/attendance", "GET /api/verification",
					"POST /api/registration", "GET /api/inbox", "GET /api/me/notifications",
					"GET /api/me/applications", "POST /api/email-confirmation",
					"POST /api/email-confirmation/resend", "POST /api/password-reset",
					"POST /api/password-reset/request", "POST /api/teams",
					"POST /api/pairs", "PUT /api/pairs/{id}", "ANY /error");

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

	/**
	 * THE CHAIN ITSELF, ASKED WHETHER IT WOULD LET A STRANGER DO THIS AT THIS ADDRESS.
	 *
	 * <p><b>This is here instead of the three verbs written out again.</b>
	 * {@code ApiSecurity.READ_BY_ANYBODY} says WHICH addresses are open and says nothing
	 * about the methods; the methods are three lines inside the chain's lambda, and until
	 * 18.09.2026 there were none at all - a path on that list was open to every verb there
	 * is. Copied here as a set of names, they would be a second home of that fact, and the
	 * day the chain opened a fourth verb or dropped one, the two would disagree with nothing
	 * to say so.
	 *
	 * <p>{@link WebInvocationPrivilegeEvaluator} is the question asked of the thing that
	 * answers it. Spring Security builds one per {@code SecurityFilterChain} out of the very
	 * rules {@code ApiSecurity} writes, and {@code isAllowed(path, method, null)} is "would
	 * an unauthenticated caller be authorised for this". There is no list to keep, and no
	 * spelling of a rule to recognise.
	 *
	 * <p>What it is NOT is a way of asking whether a route is reachable: everything the
	 * chain opens by name - signing in, registering, the two links out of a message - is
	 * allowed to a stranger too, and each of those is a decision that belongs in the
	 * snapshot above rather than one that excuses itself. So the excuse below is the
	 * CONJUNCTION: on the open list, and granted this verb.
	 */
	@Autowired
	private WebInvocationPrivilegeEvaluator privileges;

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

	/**
	 * AND ONE ASKED BY ITS OWN METHOD, which is what a route is.
	 *
	 * <p><b>It carries a CSRF token, and without one it would measure the wrong filter.</b>
	 * {@code CsrfFilter} stands in front of {@code AuthorizationFilter}, so a {@code POST}
	 * sent without a token is answered 403 before anything has decided who is asking - and
	 * both floors below would pass on that 403 while the door behind it was wide open. This
	 * is not a theory: {@code OpenRoutesStayReadOnlyTest} says in as many words that
	 * {@code ApiSecurityTest.nothingOpenForReadingIsOpenForWriting} is refused by the CSRF
	 * filter rather than by any rule about rights. A {@code GET} carrying one is unchanged,
	 * since the filter does not ask about safe methods at all.
	 */
	private int statusOf(Route route, String email) throws Exception {
		return http.perform(carrying(request(route.how(), route.where()).with(csrf()), email))
				.andReturn().getResponse().getStatus();
	}

	private MockHttpServletResponse askedWhatItTakes(String path, String email) throws Exception {
		return http.perform(carrying(options(path), email)).andReturn().getResponse();
	}

	private MockHttpServletResponse askedWhetherItChanged(String path) throws Exception {
		return http.perform(head(path)).andReturn().getResponse();
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
	/**
	 * AND ASKING AN OPEN ROUTE WHETHER IT CHANGED IS LEFT ALONE TOO.
	 *
	 * <p>{@code HEAD} is the same read without the body, and Spring serves it off the
	 * {@code GET} handler, so it is opened on its own line beside {@code GET} and
	 * {@code OPTIONS}. Of those three, two were already held - {@code GET} by
	 * {@code ApiSecurityTest.noOpenRouteOpensAnythingBesideIt} and {@code OPTIONS} by the
	 * case above - and {@code HEAD} by nothing at all.
	 *
	 * <p>Measured 18.09.2026, which is why this exists: deleting the {@code HEAD} line
	 * from {@code ApiSecurity} took the WHOLE gate green, 1977 cases, while every one of
	 * the open paths began answering 401 to it. The calendar is the page a visitor comes
	 * for, and a browser asking whether it changed would have been turned away with
	 * nothing measuring the turn.
	 *
	 * <p>The list is read off the constant for the same reason the case above reads it.
	 */
	@Test
	void askingWhetherAnOpenRouteChangedIsLeftAlone() throws Exception {
		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("nothing is open at all, so this asks about nothing")
				.isNotEmpty();

		for (String open : ApiSecurity.READ_BY_ANYBODY) {
			assertThat(askedWhetherItChanged(open).getStatus())
					.as("%s is open to anybody and stopped answering whether it changed", open)
					.isEqualTo(200);
		}
	}

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
		List<Route> guarded = routesTheDoorDecides();

		assertThat(guarded)
				.as("no route is decided at the door at all, so this asks about nothing")
				.isNotEmpty();

		for (Route route : guarded) {
			assertThat(statusOf(route, null))
					.as("%s is decided at the door and answered somebody who is not signed in; the"
							+ " code that reads the session takes it without asking whether there"
							+ " is one, so what comes back is a ClassCastException rather than a"
							+ " refusal", route)
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
		List<Route> guarded = routesTheDoorDecides();

		assertThat(guarded)
				.as("no route is decided at the door at all, so this asks about nothing")
				.isNotEmpty();

		for (Route route : guarded) {
			assertThat(statusOf(route, A_MEMBER))
					.as("%s is decided at the door and being signed in was enough to open it; a"
							+ " guard annotation the door does not actually ask about looks exactly"
							+ " like one it does", route)
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
	 * moderatori jer samo superadmin ima ta prava", PDL P28a, 13.08.2026, „Moderatori
	 * nemaju kolonu"). Read as before, this floor would have forced that route into the snapshot
	 * above as one that answers WITHOUT a guard, which is the exact opposite of the truth and would
	 * be a lie sitting inside the floor.
	 *
	 * <p><b>And it is not repaired with a list of the two annotation types.</b> That is
	 * the shape the repo measured and rejected on 05.09.2026: a list inside a floor is
	 * another thing somebody has to remember to extend, and the day a third kind of guard
	 * arrived this floor would go on passing while demanding that its routes be declared
	 * unguarded. What the question binds to instead is something the language already
	 * says - {@link #theDoorDecides} asks each annotation whether it is itself marked
	 * {@link AskedAtTheDoor} - so a third kind is counted on the day it is written, and
	 * nothing here names either of the two that exist.
	 *
	 * <p><b>AND IT KEYS BY THE PAIR AND NOT BY THE PATH, which is the correction of
	 * 19.09.2026 and was a hole rather than an untidiness.</b> The excuse used to be
	 * {@code READ_BY_ANYBODY.contains(path)}, which threw away the METHOD - so a route
	 * WRITING to an address anybody may read was excused by the address. Measured before the
	 * correction, on this branch: {@code @RightIsNeeded} taken off {@code POST /api/events},
	 * which is every signed in competitor writing the league's calendar, left this class and
	 * {@code ApiSecurityTest} and {@code OpenRoutesStayReadOnlyTest} all green - 28 cases,
	 * BUILD SUCCESS. Taken off {@code POST /api/races} it did the same.
	 *
	 * <p><b>Where the hole came from is worth a line, because half of it was repaired and
	 * the half in the guard was not.</b> Until 18.09.2026 the open list really did open every
	 * verb, and this filter was a true sentence about it. PR 295 narrowed the chain to
	 * {@code GET}, {@code HEAD} and {@code OPTIONS} on the day {@code /api/events} became the
	 * first address read by anybody and written by somebody. The chain stopped agreeing with
	 * this line that day, and nothing was measuring the difference.
	 *
	 * <p><b>And the verbs are not copied here.</b> {@link #privileges} asks the chain
	 * {@code ApiSecurity} built, so what is excused is exactly what is granted, and a fourth
	 * verb opened tomorrow needs no edit here. What the guard under this one holds is the
	 * other direction: that what the chain grants there is still the two reads and
	 * {@code OPTIONS} that somebody decided to open, and nothing beside them.
	 */
	@Test
	void everyRouteTheControllersMapEitherNeedsARightOrIsNamedHere() {
		List<String> withoutAGuard = mappings.getHandlerMethods().entrySet().stream()
				.filter(one -> !theDoorDecides(one.getValue()))
				.flatMap(one -> declaredMethodsOf(one.getKey())
						.flatMap(how -> pathsOf(one.getKey())
								.filter(path -> !anybodyMayDoThis(how, path))
								.map(path -> how + " " + path)))
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

	/**
	 * AND THE OPEN LIST GRANTS TWO READS AND {@code OPTIONS}, WHICH IS THE FLOOR UNDER THE
	 * LINE ABOVE.
	 *
	 * <p>The excuse above asks {@link #privileges} rather than a list, and that is only worth
	 * anything while the evaluator really distinguishes one verb from another. An evaluator
	 * wired to the wrong chain, or answering yes to everything, would excuse every route on
	 * the open list - writes included - and the floor above would go back to passing on the
	 * very mutation it exists for, silently. Measured rather than assumed, and this is the
	 * case that measures it.
	 *
	 * <p><b>{@code OPTIONS} IS IN THAT LIST AND IT IS NOT A READ, and this case said
	 * otherwise until a review on 19.09.2026.</b> Its name and its note both claimed
	 * „reading", while the line below has always demanded {@code OPTIONS} as well -
	 * {@code ApiSecurity} says so in as many words („AND OPTIONS, which is NOT a read and is
	 * opened anyway"), and the decision to leave it open is the owner's and is written down
	 * (`ADL.md`:801). So the claim was narrower than the code, which is the shape of thing
	 * this whole branch exists to remove.
	 *
	 * <p><b>WHAT THIS FLOOR THEREFORE DOES NOT SEE, named rather than left to be found: a
	 * handler MAPPED for {@code OPTIONS} on an open path.</b> Measured the same day - an
	 * unguarded {@code @RequestMapping(method = OPTIONS)} on {@code /api/events} passes, and
	 * it passes correctly by this file's own rule, because the chain really does grant that
	 * verb there. Nothing maps one today and Spring answers {@code OPTIONS} itself out of the
	 * methods a path maps, so it would take a handler written on purpose; whoever writes one
	 * is deciding that an open path may answer a non-read without a guard, and this note is
	 * where that decision is owed. {@code HEAD} sits in the same list and is NOT a boundary,
	 * because {@code HEAD} is a read.
	 *
	 * <p><b>It is a snapshot of THREE VERBS and it is the only place they are written in this
	 * file.</b> Nothing reads it; it asserts. {@code ApiSecurity} is the one home of the
	 * decision, this says out loud what that home currently says, and the day it opens a
	 * fourth verb or drops one this fails and somebody writes down why once - instead of the
	 * floor above quietly excusing a verb nobody decided to open.
	 *
	 * <p>The verbs it asks about are {@link HttpMethod#values()}, which is the language's own
	 * enumeration rather than a fourth list; asserted non-trivial first, because a set of
	 * verbs holding no write would make every line below true while asking nothing.
	 */
	@Test
	void theOpenListGrantsTwoReadsAndOptionsAndNothingElse() {
		List<String> everyVerbThereIs =
				Stream.of(HttpMethod.values()).map(HttpMethod::name).sorted().toList();

		assertThat(everyVerbThereIs)
				.as("the verbs asked about hold no write, so nothing below could fail")
				.contains("POST", "PUT", "PATCH", "DELETE");

		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("nothing is open at all, so this asks about nothing")
				.isNotEmpty();

		for (String open : ApiSecurity.READ_BY_ANYBODY) {
			assertThat(everyVerbThereIs.stream().filter(how -> anybodyMayDoThis(how, open)).toList())
					.as("%s is open for a verb nobody decided to open, or has stopped being open"
							+ " for one that was decided; whichever it is, the line that excuses"
							+ " routes on the open list is no longer excusing what ApiSecurity"
							+ " grants", open)
					.containsExactly("GET", "HEAD", "OPTIONS");

			/* AND A MAPPING THAT LIMITS NO VERB IS GRANTED NOTHING, which is the fact
			   `anybodyMayDoThis` leans on since the clause that used to assert it in code was
			   measured to be a belt with no buckle. `LIMITS_NO_VERB` is not a verb any rule in
			   `ApiSecurity` names, so the evaluator falls through to `authenticated()` and
			   denies a stranger. Pinned here rather than assumed: the day that stops holding,
			   `/error` would start borrowing an open path's excuse and this says so first. */
			assertThat(anybodyMayDoThis(LIMITS_NO_VERB, open))
					.as("a mapping that limits no verb was granted %s by the chain, so the floor"
							+ " above would excuse one instead of making it name itself", open)
					.isFalse();
		}
	}

	/**
	 * WHETHER A STRANGER MAY DO THIS VERB AT THIS ADDRESS BECAUSE THE ADDRESS IS OPEN.
	 *
	 * <p>Both halves are needed and each without the other is wrong. Without the list, every
	 * route {@code ApiSecurity} opens by name - signing in, registering, the two links out of
	 * a message - would excuse itself, and the snapshot above would lose the decisions it
	 * exists to hold; outside {@code /api} the second chain permits everything, so
	 * {@code /error} and anything mapped beside it would drop out too, which is exactly the
	 * hole of 13.09.2026 reopened. Without the evaluator, a write to an address anybody may
	 * READ is excused by the address, which is the hole this whole case is about.
	 *
	 * <p><b>A mapping that limits no verb is never excused, and what says so is the CHAIN and
	 * not a word written here.</b> A first draft opened with
	 * {@code !LIMITS_NO_VERB.equals(how)} and a sentence crediting it; a review on 19.09.2026
	 * measured that taking the clause out leaves the whole package green, because
	 * {@link #LIMITS_NO_VERB} is not a verb any rule in {@code ApiSecurity} names, so the
	 * evaluator falls through to {@code anyRequest().authenticated()} and denies it. The
	 * clause was a belt with no buckle beside a sentence crediting the belt, so it is gone
	 * and the fact it was standing in for is PINNED instead, in
	 * {@link #theOpenListGrantsTwoReadsAndOptionsAndNothingElse} - which falls the day that
	 * fall-through stops holding, and a clause with no case never would have.
	 *
	 * <p><b>The boundary of reading the list as TEXT, written down because it is not
	 * obvious.</b> {@code contains(path)} compares literal strings, while the same entries
	 * reach the chain as Spring patterns. The day somebody widens an entry to
	 * {@code /api/events/**} - which {@code ApiSecurity}'s own note names as a move that was
	 * considered - the chain would open {@code GET /api/events/{id}} while this line would
	 * not excuse it, and the floor would demand it be named in the snapshot. That is a false
	 * alarm and not a hole: it errs towards asking for a decision, which is the direction
	 * this file is written in, and whoever widens the entry answers it once.
	 */
	private boolean anybodyMayDoThis(String how, String path) {
		return ApiSecurity.READ_BY_ANYBODY.contains(path)
				&& privileges.isAllowed(null, path, how, null);
	}

	/** What the routes declare, asked of the dispatcher as objects rather than read as text. */
	private List<String> rightsRoutesAskFor() {
		return mappings.getHandlerMethods().values().stream()
				.map(RightsAtTheDoorTest::rightOf)
				.filter(Objects::nonNull)
				.map(RightIsNeeded::value)
				.distinct().sorted().toList();
	}

	/**
	 * AND THE ROUTES THOSE ARE, each as the METHOD it answers to and the address it
	 * answers at, with a sample value where a variable stands.
	 *
	 * <p><b>The method is part of a route, and until 18.09.2026 this file said it was
	 * not.</b> It gathered paths and asked every one of them with a {@code GET}, which was
	 * true of the portal exactly while no guarded route shared a path with anything else:
	 * the two that existed, {@code /api/moderators} and {@code /api/payments}, each had a
	 * path to themselves. {@code /api/events} is read by anybody and written by somebody,
	 * so a {@code GET} sent at it reaches the CALENDAR - and the two floors below would
	 * have been measuring the open route while reporting on the guarded one. Asked of
	 * {@code /api/events/1}, where only {@code PUT} and {@code DELETE} live, a {@code GET}
	 * is worse than wrong: {@code NothingIsHereRatherThanAlmost} turns the dispatcher's 405
	 * into a 404, which is the very number
	 * {@link #everyRouteTheDoorDecidesIsShutToACompetitorAlthoughHeIsSignedIn} demands, so
	 * that floor would have passed on a route it never reached.
	 *
	 * <p><b>Asked of the dispatcher rather than worked out from the annotation.</b>
	 * {@code RequestMappingInfo} already holds the methods a route answers to; reading
	 * {@code @PostMapping} and friends would be a list of annotation types inside a floor,
	 * which is the shape this file rejected on 05.09.2026 and again in
	 * {@link #theDoorDecides}.
	 */
	/**
	 * WHAT STANDS WHERE A PATH VARIABLE DOES, and it is not a number on purpose.
	 *
	 * <p>The sweep below asks every guarded route what a plain member gets, and reads 404
	 * as the door having refused him. With a NUMBER in that place those are not the same
	 * question: a route that looks the row up and answers 404 because it is not there says
	 * 404 whether the door decided or not, so the assertion is empty for it.
	 *
	 * <p>Measured 18.09.2026, and it was a real hole. Knocking the door out FOR DELETE
	 * ALONE left this whole class green, 17 cases, while every delete on the portal stood
	 * open to any signed-in member. The same mutation for PUT did fall, but by accident:
	 * the probe sends no body, so Spring answers 400 before the handler, which is not this
	 * file measuring anything either.
	 *
	 * <p>A word that cannot be a key changes the question. The door runs in
	 * {@code preHandle}, BEFORE any path variable is bound, so it still answers 404 to
	 * somebody it refuses; everything downstream answers 400, because nothing turns this
	 * into the {@code long} the method asks for. Refused and not-there stop being the same
	 * number, and the sweep goes back to measuring the door.
	 */
	private static final String NOT_AN_ID = "nije-kljuc";

	private List<Route> routesTheDoorDecides() {
		return mappings.getHandlerMethods().entrySet().stream()
				.filter(one -> theDoorDecides(one.getValue()))
				.flatMap(one -> methodsOf(one.getKey())
						.flatMap(how -> pathsOf(one.getKey())
								.map(pattern -> new Route(how,
										pattern.replaceAll("\\{[^/}]*\\}", NOT_AN_ID)
											.replace("**", NOT_AN_ID)))))
				.distinct().sorted(Route.BY_ADDRESS).toList();
	}

	/** One route: the method it answers to and the address it answers at. */
	private record Route(HttpMethod how, String where) {

		private static final Comparator<Route> BY_ADDRESS =
				Comparator.comparing(Route::where).thenComparing(one -> one.how().name());

		@Override
		public String toString() {
			return how + " " + where;
		}
	}

	/**
	 * The methods a route answers to, or {@code GET} for one that limits none.
	 *
	 * <p>A mapping with no method condition answers every verb there is, so any of them
	 * would do and {@code GET} is the one the rest of this file already speaks. It is a
	 * real shape - {@code @RequestMapping} without a method writes it - and no guarded
	 * route on the portal has it today, which is why it is an answer here rather than a
	 * branch somebody has to remember.
	 */
	private static Stream<HttpMethod> methodsOf(RequestMappingInfo info) {
		Set<RequestMethod> declared = info.getMethodsCondition().getMethods();

		return declared.isEmpty() ? Stream.of(HttpMethod.GET)
				: declared.stream().map(one -> HttpMethod.valueOf(one.name()));
	}

	/** What a mapping that limits no verb is called where routes are keyed by one. */
	private static final String LIMITS_NO_VERB = "ANY";

	/**
	 * The verbs a mapping LIMITS ITSELF TO, as names, or {@link #LIMITS_NO_VERB} for one
	 * that limits none.
	 *
	 * <p><b>It is not {@link #methodsOf} and the difference is the whole point.</b> That one
	 * answers "which verb shall I send at this route" and a mapping limiting none may be
	 * asked with any, so it says {@code GET}. This one answers "which verbs does this route
	 * ANSWER", and {@code GET} would be a lie for a mapping that answers eight - the kind of
	 * lie that would let a {@code GET} named in a snapshot excuse the other seven.
	 */
	private static Stream<String> declaredMethodsOf(RequestMappingInfo info) {
		Set<RequestMethod> declared = info.getMethodsCondition().getMethods();

		return declared.isEmpty() ? Stream.of(LIMITS_NO_VERB)
				: declared.stream().map(RequestMethod::name);
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
	 * PDL P28a, 13.08.2026, „Moderatori nemaju kolonu"), so it can declare no right - and the
	 * obvious repair, a list of the two annotation types, is the shape the repo measured and
	 * rejected on 05.09.2026: a list inside a floor is another thing somebody has to remember to
	 * extend, and the day a third kind of guard is written this floor would go on passing while
	 * demanding that its routes be declared as answering WITHOUT a guard.
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

package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHO THE MODERATORS ARE, read by the superadmin and by nobody else at all.
 *
 * <p>Closed twice over and each shutting answers different people, so each has its own
 * case: a visitor who is not signed in is refused by the chain, because the route is
 * absent from {@code ApiSecurity.READ_BY_ANYBODY} the way {@code AttendanceApiTest} and
 * {@code CommentApiTest} measure for their own resources; and everybody signed in who is
 * not the superadmin is refused at the door, including a moderator holding every one of
 * the ticks there are.
 *
 * <p><b>NOBODY HERE IS THE ONLY ONE OF HIS KIND, on any axis this file's assertions read
 * a value along</b> (the rule of 06.09.2026, and its correction the same afternoon that
 * the axes get counted rather than guessed):
 *
 * <ul>
 * <li><b>Four moderators, not one</b>, so „this moderator's ticks" and „every tick
 * anybody was given" are different lists. Their ticks are two, one, none and all.
 * <li><b>The one tick {@link #ONE_TICK} holds is held by nobody else</b>, and the two
 * {@link #TWO_TICKS} holds do not include it - so a query that forgot to name the
 * account hands each of them the other's and fails, rather than handing back a set that
 * happens to be right.
 * <li><b>Two accounts that are NOT moderators</b>, one of each remaining kind that can
 * hold a session: the superadmin, whom {@code PDL.md:4422} keeps out of this table, and
 * a plain competitor. A condition that dropped only one of the two passes half of this
 * file and fails the other half.
 * <li><b>The address order is not the insertion order</b>, so a query with no
 * {@code order by} answers in an order the last case does not accept.
 * <li><b>The reader is not one of the read.</b> Every request below is made by the
 * superadmin, whose own address must not appear in the answer - so „the address on the
 * session" and „an address off the table" cannot be the same string.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ModeratorApiTest {

	/** The one account that may read this, and the one that must not be IN it. */
	private static final String EVERYTHING = "superadmin@primer.rs";

	/** A moderator with two ticks, neither of them the one below. */
	private static final String TWO_TICKS = "vesna@primer.rs";

	/** And one with a single tick nobody else in the fixture holds. */
	private static final String ONE_TICK = "bojan@primer.rs";

	/** The ordinary case: just made, and may do nothing yet. */
	private static final String NO_TICKS = "novi@primer.rs";

	/** And the one the guard is really about: every box in the matrix ticked. */
	private static final String EVERY_TICK = "iskusni@primer.rs";

	/** Signed in and holding nothing, which is most of the portal. */
	private static final String A_MEMBER = "takmicar@primer.rs";

	private static final String FIRST_OF_TWO = "entity:members";

	private static final String SECOND_OF_TWO = "queue:payments";

	private static final String THE_ONLY_ONE = "entity:events";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/**
	 * SIX ACCOUNTS ACROSS THREE ROLES, FOUR OF WHICH ANSWER.
	 *
	 * <p>Written in an order that is neither the alphabetical order of the addresses nor
	 * the order the cases below read them in, so the ordering case measures an
	 * {@code order by} rather than the order {@code account.id} happens to run in.
	 */
	@BeforeEach
	void sixAccountsAcrossThreeRoles() {
		account(EVERYTHING, "superadmin");
		account(TWO_TICKS, "moderator");
		account(NO_TICKS, "moderator");
		account(A_MEMBER, "competitor");
		account(EVERY_TICK, "moderator");
		account(ONE_TICK, "moderator");

		ticked(TWO_TICKS, FIRST_OF_TWO, SECOND_OF_TWO);
		ticked(ONE_TICK, THE_ONLY_ONE);
		ticked(EVERY_TICK, everyRightThereIs().toArray(String[]::new));
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

	/** Every box the matrix holds, read off the schema rather than written out here. */
	private List<String> everyRightThereIs() {
		return db.sql("select code from admin_right order by code").query(String.class).list();
	}

	private long accountOf(String email) {
		return db.sql("select id from account where email = ?").param(email)
				.query(Long.class).single();
	}

	private int ticksOf(String email) {
		return db.sql("select count(*) from account_admin_right where account_id ="
						+ " (select id from account where email = ?)")
				.param(email).query(Integer.class).single();
	}

	/** What the TABLE says one account holds, which is what the floors below compare against. */
	private List<String> ticksInTheTableOf(String email) {
		return db.sql("select right_code from account_admin_right where account_id ="
						+ " (select id from account where email = ?) order by right_code")
				.param(email).query(String.class).list();
	}

	private MockHttpServletRequestBuilder asking(String email) {
		MockHttpServletRequestBuilder asks = get("/api/moderators");
		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private int statusOf(String email) throws Exception {
		return http.perform(asking(email)).andReturn().getResponse().getStatus();
	}

	/** What the superadmin is served, which is the only reading that gets a body. */
	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(http.perform(asking(EVERYTHING))
				.andReturn().getResponse().getContentAsString());
	}

	/** The one record with this address, found by the address and never by position. */
	private JsonNode served(String email) throws Exception {
		for (JsonNode one : answer()) {
			if (email.equals(one.path("email").asString())) {
				return one;
			}
		}
		throw new AssertionError("/api/moderators did not answer with " + email + " at all");
	}

	private List<String> addresses() throws Exception {
		List<String> out = new ArrayList<>();
		for (JsonNode one : answer()) {
			out.add(one.path("email").asString());
		}
		return out;
	}

	private List<String> rightsOf(String email) throws Exception {
		List<String> out = new ArrayList<>();
		for (JsonNode one : served(email).path("rights")) {
			out.add(one.asString());
		}
		return out;
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ANSWERED, EXCEPT THE TWO THE SCHEMA HAS NOWHERE TO
	 * HOLD, and those are named here with the reason.
	 *
	 * <p><b>{@code firstName} and {@code lastName} are not withheld, they are not
	 * there.</b> {@code account} is an id, an address, a role and the moment the address
	 * was confirmed (V6); names live on {@code competitor}, and NOTHING joins an account
	 * to a competitor in either direction. That is a decision and not an oversight - V7
	 * and {@code MeApi} both say so in as many words, „because how many accounts one
	 * member may have is not decided. Inventing the join here is how that decision would
	 * quietly get made by whoever wrote this line" - and it is one of the three questions
	 * waiting for the owner's word ({@code btl-produkt/PENDING.md}, „Veza naloga i
	 * takmicara").
	 *
	 * <p><b>So this case is where that omission is written down, rather than a comment.</b>
	 * The rule is ADL P-javno's, of 13.09.2026: „izostavljena polja se imenuju u samom
	 * slucaju sa razlogom, da izostavljanje bude odluka a ne propust". {@code Answers}
	 * checks both halves of each name - that the portal really serves it, so a stale name
	 * cannot quietly excuse a field that went missing for another reason, and that the
	 * answer really leaves it out, so naming it here is a claim rather than a wish.
	 *
	 * <p><b>What the portal will do about it is not this increment's to decide.</b> The
	 * screen that draws moderators is not switched to this endpoint here (A50: the portal
	 * changes files once, together, when every resource exists), so nothing wired today
	 * goes blank for the want of a name.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/moderators", answer(), "moderators.json",
				"firstName", "lastName");
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/moderators", answer());
	}

	/**
	 * A VISITOR WHO IS NOT SIGNED IN IS ASKED TO SIGN IN, AND NOT TOLD THE ADDRESS IS
	 * NOT THERE.
	 *
	 * <p>Nothing about moderators is public: ADL P-javno, 13.09.2026, names this resource
	 * among the seven the rule covers and the rule is „javno je ono sto Clan 73 nabraja, i
	 * nista vise" ({@code ADL.md:3206}). Article 73 lists nothing whatever about them.
	 *
	 * <p><b>401 and not 404, which is the distinction {@code RightsAtTheDoor} exists to
	 * keep.</b> A browser that gets 404 cannot tell „your session ran out" from „wrong
	 * address", and the single page application stops offering the way back in. The
	 * number is therefore named in both directions here.
	 *
	 * <p><b>And the 200 is half of this case rather than decoration.</b> Without it, a
	 * resource that refused everybody would pass the refusal above and read as though the
	 * rule held.
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsAskedToSignIn() throws Exception {
		int visitor = statusOf(null);

		assertThat(visitor)
				.as("a visitor was served the moderators, and Article 73 lists nothing about them")
				.isEqualTo(401);
		assertThat(visitor)
				.as("a visitor cannot tell an ended session from a wrong address, so nothing can"
						+ " offer him the way back in")
				.isNotEqualTo(404);

		assertThat(statusOf(EVERYTHING))
				.as("the superadmin was refused his own screen, so the refusal above is not about"
						+ " who is asking")
				.isEqualTo(200);
	}

	/**
	 * A MODERATOR HOLDING EVERY TICK THERE IS IS STILL REFUSED, and that is the whole of
	 * this route's guard rather than an edge of it.
	 *
	 * <p>The owner, 30.07.2026: „Ekran sa moderatorima vidi samo Superadmin"
	 * ({@code PDL.md:4438}), and the reason with it - „Bez te granice moderator bi sam
	 * sebi mogao da dodeli prava, pa granularna prava ne bi značila ništa." So no tick
	 * opens this, which is why there is no column for it in the matrix („Ne treba ni da
	 * postoji kolona moderatori jer samo superadmin ima ta prava", 13.08.2026,
	 * {@code PDL.md:4403}).
	 *
	 * <p><b>The ticks are read off {@code admin_right} and not written out here</b>, so
	 * the thirteenth right added tomorrow is on this moderator the day it exists. A list
	 * of twelve typed into this file would go on saying „every tick" while meaning
	 * „twelve of thirteen", and a guard reading „does he hold them all" would then let
	 * him through with nothing failing.
	 *
	 * <p><b>The refusal is 404 and not 403</b> (owner, 13.09.2026, {@code ADL.md:783}):
	 * the server must not be the one place that says the address is there.
	 *
	 * <p><b>And the superadmin's 200 in the same case is the anchor</b> - without it a
	 * route that was simply broken would pass this.
	 */
	@Test
	void aModeratorHoldingEveryTickThereIsIsStillRefused() throws Exception {
		List<String> matrix = everyRightThereIs();

		assertThat(matrix)
				.as("the matrix holds no rights at all, so holding every tick is holding none and"
						+ " this case measures nothing")
				.isNotEmpty();
		assertThat(ticksOf(EVERY_TICK))
				.as("this moderator does not really hold every tick there is, so being refused"
						+ " says nothing about a tick not opening this")
				.isEqualTo(matrix.size());

		int refused = statusOf(EVERY_TICK);

		assertThat(refused)
				.as("a moderator with every one of the %d ticks read the list of moderators, so he"
						+ " can tick himself one more", matrix.size())
				.isEqualTo(404);
		assertThat(refused)
				.as("the refusal is 403, which says the address is real; the owner decided 404 on"
						+ " 13.09.2026 precisely so that it would not")
				.isNotEqualTo(403);

		assertThat(statusOf(EVERYTHING))
				.as("the superadmin was refused his own screen, so the refusal above is a route"
						+ " that is shut to everybody rather than a tick that does not open it")
				.isEqualTo(200);
	}

	/**
	 * NEITHER THE SUPERADMIN NOR A PLAIN MEMBER IS AMONG THE MODERATORS.
	 *
	 * <p>„Superadmin nema kućice. On sme sve, uvek, i ne pojavljuje se u ovoj tabeli kao
	 * neko kome se prava dodeljuju" ({@code PDL.md:4422}). Serving him would put on the
	 * screen a row whose empty list of ticks reads as „may do nothing" about the one
	 * account that may do everything, and a box beside it that means nothing whichever
	 * way it is left.
	 *
	 * <p><b>Two accounts and not one, because they fail different mistakes.</b> A
	 * condition written as „his role is not the one that holds everything" drops the
	 * superadmin and keeps the competitor; one written as „he has administrative
	 * standing" drops the competitor and keeps the superadmin. Only a condition naming
	 * the moderator's role drops both.
	 *
	 * <p><b>The floors are what make the absences measurements.</b> An assertion that
	 * somebody is missing is satisfied just as well by his never having been written, so
	 * each of the two is read back out of the database first.
	 */
	@Test
	void neitherTheSuperadminNorAPlainMemberIsAmongTheModerators() throws Exception {
		assertThat(db.sql("select r.code from account a join role r on r.id = a.role_id"
						+ " where a.email = ?").param(EVERYTHING).query(String.class).single())
				.as("the fixture's superadmin is not a superadmin, so his absence below is not"
						+ " about his role")
				.isEqualTo("superadmin");
		assertThat(db.sql("select r.code from account a join role r on r.id = a.role_id"
						+ " where a.email = ?").param(A_MEMBER).query(String.class).single())
				.as("the fixture's competitor is not a competitor, so his absence below is not"
						+ " about his role")
				.isEqualTo("competitor");

		List<String> answered = addresses();

		assertThat(answered)
				.as("the superadmin came out of the list of people whose rights are given to them,"
						+ " and PDL.md:4422 keeps him out of it")
				.doesNotContain(EVERYTHING);
		assertThat(answered)
				.as("an account with no administrative standing at all came out of the list of"
						+ " moderators")
				.doesNotContain(A_MEMBER);
		assertThat(answered)
				.as("nobody at all came out, so the two absences above are about an empty answer"
						+ " rather than about the role")
				.contains(TWO_TICKS);
	}

	/**
	 * THE WHOLE SET OF MODERATORS IS ANSWERED, EXACTLY.
	 *
	 * <p>Read as a complete set rather than by position, so a query answering with the
	 * first row whatever was asked for - or with one account too many, or one too few -
	 * is caught here even where it would print a plausible single record.
	 */
	@Test
	void theWholeSetOfModeratorsIsAnsweredExactly() throws Exception {
		assertThat(addresses())
				.containsExactlyInAnyOrder(TWO_TICKS, ONE_TICK, NO_TICKS, EVERY_TICK);
	}

	/**
	 * EACH MODERATOR ANSWERS WITH HIS OWN TICKS AND NOT WITH ANOTHER'S.
	 *
	 * <p>{@code WhatHeMayDo} carries this warning beside the statement it is about:
	 * without the condition naming the account, every moderator holds every tick anybody
	 * was ever given, and a suite whose fixture has one moderator in it does not notice.
	 * This fixture has four, and the two read here are crossed - the single tick
	 * {@link #ONE_TICK} holds is one {@link #TWO_TICKS} does not, and neither of the two
	 * {@link #TWO_TICKS} holds is the one {@link #ONE_TICK} does - so no single list can
	 * satisfy both assertions.
	 *
	 * <p><b>The floor is that the crossing is real, and it is read back out of the
	 * database</b> rather than asserted from this file's own constants, because the day
	 * somebody gives both moderators the same tick this case would go on passing while
	 * comparing nothing.
	 *
	 * <p><b>It is disjointness and not „held by exactly one", and the difference was
	 * measured rather than argued.</b> The first draft asked that {@link #THE_ONLY_ONE} be
	 * held by one account in the whole table, and it failed at once: {@link #EVERY_TICK}
	 * holds every code there is by construction, so NO code can ever be held by exactly
	 * one person while he is in the fixture - and he has to be, because he is the case the
	 * guard exists for. What the two assertions below actually need is weaker and exact:
	 * that no single list of ticks can satisfy both of them.
	 */
	@Test
	void eachModeratorAnswersWithHisOwnTicksAndNotWithAnothersTicks() throws Exception {
		List<String> his = ticksInTheTableOf(ONE_TICK);
		List<String> hers = ticksInTheTableOf(TWO_TICKS);

		assertThat(his).as("the moderator with one tick holds none, so this compares nothing")
				.isNotEmpty();
		assertThat(hers).as("the moderator with two ticks holds none, so this compares nothing")
				.isNotEmpty();
		assertThat(his)
				.as("the two moderators this case crosses share a tick, so one list could satisfy"
						+ " both assertions below and neither of them is about whose ticks were read")
				.doesNotContainAnyElementsOf(hers);

		assertThat(rightsOf(ONE_TICK))
				.as("the moderator with one tick was answered somebody else's")
				.containsExactly(THE_ONLY_ONE);

		assertThat(rightsOf(TWO_TICKS))
				.as("the moderator with two ticks was answered somebody else's")
				.containsExactlyInAnyOrder(FIRST_OF_TWO, SECOND_OF_TWO);
	}

	/**
	 * A MODERATOR WITH NOTHING TICKED IS ON THE LIST, WITH AN EMPTY LIST OF TICKS.
	 *
	 * <p><b>He is the ordinary case and not the exotic one.</b> The superadmin opens this
	 * screen precisely in order to give a newly made moderator his first tick, so a
	 * moderator who is invisible until he has one can never be given one. The portal's own
	 * type already says it: „An empty list is not a broken record, it is a moderator who
	 * has just been made and may do nothing yet" ({@code frontend/src/data/types.ts}).
	 *
	 * <p><b>An empty list and not nothing</b>, the same sentence {@code LeagueApi} writes
	 * for a league no race counts towards yet. An inner join to
	 * {@code account_admin_right} drops the row whole and silently; a
	 * {@code coalesce(..., '{}')} answers the empty list. Both halves are read here,
	 * because a field that is absent and a field that is an empty array are two different
	 * answers to the screen that draws them.
	 *
	 * <p><b>The floor is that he really holds nothing</b>, read out of the database:
	 * otherwise an empty list could be an empty list of something he has.
	 */
	@Test
	void aModeratorWithNothingTickedIsOnTheListWithAnEmptyListOfTicks() throws Exception {
		assertThat(ticksOf(NO_TICKS))
				.as("the fixture's newly made moderator holds ticks, so an empty list below would"
						+ " be a lost list rather than an empty one")
				.isZero();

		assertThat(addresses())
				.as("a moderator with nothing ticked fell out of the answer, and he is the one the"
						+ " superadmin opens this screen to give a first tick to")
				.contains(NO_TICKS);

		assertThat(served(NO_TICKS).path("rights").isArray())
				.as("a moderator with nothing ticked answers with something that is not a list at"
						+ " all, so the screen has nothing to draw an empty row from")
				.isTrue();
		assertThat(rightsOf(NO_TICKS))
				.as("a moderator with nothing ticked was answered somebody's ticks")
				.isEmpty();
	}

	/**
	 * AND THE IDENTIFIER IS THE ACCOUNT'S OWN KEY, not the slug the prototype file used.
	 *
	 * <p>The decision {@code CalendarApi} took on 12.09.2026 and {@code AttendanceApi}
	 * repeats: the shapes are the schema's and not the file's, so this answers with
	 * {@code account.id} where {@code moderators.json} carried {@code mod-radulovic}.
	 *
	 * <p><b>Read for two of them and not for one.</b> With a single record the id and
	 * „the first id in the table" are the same number, and a resource answering with a
	 * constant or with the wrong row would pass. The two are read by ADDRESS, so the
	 * pairing is what is measured rather than the presence of a number.
	 */
	@Test
	void theIdentifierIsTheAccountsOwnKeyAndNotTheFilesSlug() throws Exception {
		assertThat(accountOf(ONE_TICK))
				.as("two accounts of the fixture share an id, which no bigserial does")
				.isNotEqualTo(accountOf(NO_TICKS));

		assertThat(served(ONE_TICK).path("id").asLong())
				.as("the moderator with one tick answered with somebody else's account id")
				.isEqualTo(accountOf(ONE_TICK));
		assertThat(served(NO_TICKS).path("id").asLong())
				.as("the newly made moderator answered with somebody else's account id")
				.isEqualTo(accountOf(NO_TICKS));
	}

	/**
	 * AND THE ANSWER IS IN ADDRESS ORDER, which is total because the address is unique.
	 *
	 * <p>V6 puts a unique index on {@code lower(email)}, so no two rows tie and the answer
	 * cannot reshuffle between two readings of data nobody touched. The fixture writes its
	 * six accounts in an order that is neither this one nor the one the cases above read
	 * them in, so a query with no {@code order by} comes back in the order the rows happen
	 * to sit in.
	 */
	@Test
	void theAnswerIsInAddressOrder() throws Exception {
		List<String> answered = addresses();

		assertThat(answered).as("fewer than two records compares nothing about order")
				.hasSizeGreaterThan(1);

		assertThat(answered)
				.as("the answer is not in address order")
				.containsExactlyElementsOf(answered.stream().sorted().toList());

		assertThat(db.sql("select a.email from account a join role r on r.id = a.role_id"
						+ " where r.code = 'moderator' order by a.id").query(String.class).list())
				.as("the moderators were written in address order, so an answer coming back in the"
						+ " order the rows were written would pass the case above with no"
						+ " `order by` at all")
				.isNotEqualTo(answered);
	}
}

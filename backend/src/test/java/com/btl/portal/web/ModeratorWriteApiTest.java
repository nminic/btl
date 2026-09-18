package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE SUPERADMIN TICKING ONE MODERATOR'S BOXES AND TAKING A MODERATOR OUT, END TO END.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on any axis an assertion
 * below reads a value along (the rule of 06.09.2026 and its correction the same afternoon,
 * that the axes are counted rather than guessed):
 *
 * <ul>
 * <li><b>Four moderators, and the one acted on is written SECOND</b>, so „the moderator
 * named" and „the first moderator" are different keys and a statement that dropped its
 * condition answers differently.
 * <li><b>The ticks of the four are disjoint by construction</b> and it is read back out of
 * the database rather than trusted from these constants, so „his ticks" and „every tick
 * anybody holds" can never be the same list.
 * <li><b>What is SENT is never what he already holds.</b> It takes one box away, leaves
 * one where it is and adds one that is not his, so „the table was written" and „the table
 * already said that" are three different answers rather than one.
 * <li><b>TWO SUPERADMIN ACCOUNTS AND NOT ONE</b>, because „a superadmin" and „the last
 * remaining superadmin" are two different rows (ADL A40, 14.09.2026: „superadminskih
 * naloga sme da bude vise"). With one account in the fixture every claim about the second
 * half of PDL P28a's sentence would be a claim about the first.
 * <li><b>The one who is refused holds EVERY box there is</b>, read off {@code admin_right},
 * so „holds nothing" and „holds everything" cannot both be what the refusal is about.
 * <li><b>The asker is never the acted on.</b> Every request below is made by the
 * superadmin, who is not a moderator and therefore not a row either route can reach.
 * <li><b>The moment a tick was given is in the PAST in the fixture</b>, so „the box was
 * left alone" and „the box was written again" are different instants rather than one.
 * </ul>
 *
 * <p><b>AND ONE AXIS THAT THIS FIXTURE CANNOT SEPARATE EVERYWHERE, said here rather than
 * left to be found.</b> While {@link #EVERY_TICK} is in it, „every code the matrix holds"
 * and „every code anybody has been given" are THE SAME LIST, because he holds all of them
 * and he has to - he is the case {@link OnlyTheSuperadmin} exists for. So a resource
 * reading the matrix out of {@code account_admin_right} instead of out of
 * {@code admin_right} answers identically almost everywhere here, and that is measured
 * rather than feared: such a mutation passed all seventeen of these cases before
 * {@link #everyCodeTheMatrixHoldsMayBeTicked} broke the axis inside itself, by taking him
 * out first. Every other case in this file is blind to that one swap, on purpose, and that
 * is the cost of keeping a moderator who holds everything.
 *
 * <p><b>Authorisation as a rule is not measured here.</b> {@code RightsAtTheDoorTest}
 * sweeps every route the door decides, by its own method, and asks it of a stranger and of
 * a plain member; both of these are in that sweep from the day they are mapped. What is
 * asked here is what that sweep cannot see: that a refused write left the row it named
 * exactly as it was. That distinction is not theoretical - it was a high finding on PR 295,
 * where a {@code DELETE} answered 404 both to somebody refused and to a key nobody held,
 * and only the surviving row told the two apart.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ModeratorWriteApiTest {

	/** The one account that may ask, and one that neither route may reach. */
	private static final String EVERYTHING = "superadmin@primer.rs";

	/**
	 * A SECOND superadmin account, which is what makes „the last remaining superadmin" a
	 * different row from „a superadmin" (ADL A40, 14.09.2026).
	 */
	private static final String THE_OTHER_SUPERADMIN = "drugi-super@primer.rs";

	/** Written FIRST and never acted on, so the lowest key is never the right answer. */
	private static final String FIRST_WRITTEN = "prvi@primer.rs";

	/** The moderator every case acts on, written second. */
	private static final String ACTED = "kome-se-menja@primer.rs";

	/** A third, whose ticks must not move when the second one's do. */
	private static final String ANOTHER = "treci@primer.rs";

	/** And the one the guard is really about: every box in the matrix ticked. */
	private static final String EVERY_TICK = "iskusni@primer.rs";

	/** Signed in and holding nothing, which is most of the portal. */
	private static final String A_MEMBER = "takmicar@primer.rs";

	/** A box {@link #ACTED} holds and the save below takes away. */
	private static final String TAKEN_AWAY = "entity:members";

	/** A box he holds and the save leaves where it is, which is the third of the three paths. */
	private static final String LEFT_ALONE = "queue:payments";

	/** And one he does not hold, which the save gives him. */
	private static final String GIVEN = "entity:events";

	/** Held by the first moderator alone, so no single list satisfies two assertions. */
	private static final String THE_FIRST_ONES = "entity:teams";

	/** And by the third alone. */
	private static final String THE_THIRD_ONES = "queue:results";

	/**
	 * The day the fixture's ticks were given, which is not the day the case runs.
	 *
	 * <p>Without it, „this box was left alone" and „this box was written again" are the
	 * same instant to the nearest anything, and the one decision {@link ModeratorWriteApi}
	 * takes about HOW it writes - V18's „a right is granted once" - is measured by nothing.
	 */
	private static final String LONG_AGO = "2026-08-01 06:00:00+00";

	/**
	 * The name a decision was made under, which has to outlive the account that made it.
	 *
	 * <p>It shares NO WORD with the name on {@link #ACTED}'s account, first or last, which
	 * is the correction B56's review made one resource along: a fixture in which the two
	 * sources agree on one of the two words lets a wrong source pass behind the word they
	 * share. A name read off the account here would give „Petar Petric" and could not be
	 * mistaken for either of these two.
	 */
	private static final String THE_NAME_HE_DECIDED_UNDER = "Marko Odlucni";

	/** And the one he recorded a payment under, different again for the same reason. */
	private static final String THE_NAME_HE_RECORDED_UNDER = "Milan Blagajnik";

	/** Named, so the two rows below are found by what they are and never by being the only ones. */
	private static final String WHAT_HE_DECIDED = "Komentar o kome je odluceno";

	private static final String THE_REFERENCE_HE_RECOGNISED = "20280070";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/**
	 * SEVEN ACCOUNTS ACROSS THREE ROLES, FOUR OF THEM MODERATORS.
	 *
	 * <p>Written in an order in which the moderator acted on is neither the first nor the
	 * last, and in which the two superadmins do not sit together, so nothing below can be
	 * satisfied by a statement that reached for whichever row came first.
	 */
	@BeforeEach
	void sevenAccountsAcrossThreeRoles() {
		account(FIRST_WRITTEN, "moderator", "Prvi", "Prvic");
		account(EVERYTHING, "superadmin", "Nikola", "Minic");
		account(ACTED, "moderator", "Petar", "Petric");
		account(A_MEMBER, "competitor", "Takmicar", "Trkacki");
		account(EVERY_TICK, "moderator", "Iskusni", "Iskic");
		account(THE_OTHER_SUPERADMIN, "superadmin", "Drugi", "Superic");
		account(ANOTHER, "moderator", "Treci", "Trecic");

		ticked(ACTED, TAKEN_AWAY, LEFT_ALONE);
		ticked(FIRST_WRITTEN, THE_FIRST_ONES);
		ticked(ANOTHER, THE_THIRD_ONES);
		ticked(EVERY_TICK, everyRightThereIs().toArray(String[]::new));
	}

	private void account(String email, String role, String first, String last) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values (?, ?, ?, (select id from role where code = ?))")
				.params(first, last, email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** Ticked long ago, so that leaving a box alone and writing it again read differently. */
	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code, granted_at)"
							+ " values ((select id from account where email = ?), ?,"
							+ " timestamptz '" + LONG_AGO + "')")
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

	/** What the TABLE says one account holds, which is what every floor below compares against. */
	private List<String> ticksInTheTableOf(String email) {
		return db.sql("select right_code from account_admin_right where account_id ="
						+ " (select id from account where email = ?) order by right_code")
				.param(email).query(String.class).list();
	}

	/** When one box was given, to the instant. */
	private Instant whenGiven(String email, String right) {
		return db.sql("select granted_at from account_admin_right where account_id ="
						+ " (select id from account where email = ?) and right_code = ?")
				.params(email, right).query(Instant.class).single();
	}

	private String roleOf(String email) {
		return db.sql("select r.code from account a join role r on r.id = a.role_id"
				+ " where a.email = ?").param(email).query(String.class).single();
	}

	private boolean stillThere(String email) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from account where email = ?)")
				.param(email).query(Boolean.class).single());
	}

	private long howManySuperadmins() {
		return db.sql("select count(*) from account a join role r on r.id = a.role_id"
				+ " where r.rights_mode = 'all'").query(Long.class).single();
	}

	private MockHttpServletResponse save(long id, String body, String asking) throws Exception {
		return http.perform(put("/api/moderators/" + id).with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(body)
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(asking).secret())))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse save(long id, List<String> rights) throws Exception {
		return save(id, ticks(rights), EVERYTHING);
	}

	private MockHttpServletResponse remove(long id, String asking) throws Exception {
		return http.perform(delete("/api/moderators/" + id).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(asking).secret())))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse remove(long id) throws Exception {
		return remove(id, EVERYTHING);
	}

	private static String ticks(List<String> rights) {
		return new ObjectMapper().writeValueAsString(new ModeratorWriteApi.Ticks(rights));
	}

	private static String reasonIn(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("reason").asString();
	}

	/** The rights the ANSWER carries, which is a different place from the table. */
	private static List<String> rightsIn(MockHttpServletResponse answer) throws Exception {
		List<String> out = new ArrayList<>();
		for (JsonNode one : new ObjectMapper().readTree(answer.getContentAsString()).path("rights")) {
			out.add(one.asString());
		}
		return out;
	}

	/**
	 * WHAT THE SUPERADMIN SAVED IS WHAT THE TABLE HOLDS AFTERWARDS, AND WHAT THE ANSWER
	 * SAYS COMES OUT OF THE TABLE.
	 *
	 * <p>„Prava se zadaju kućicama u tabeli: red je moderator, kolone su prava" (PDL P28a,
	 * 30.07.2026), so a save is a whole row of boxes and not a box and a direction. The set
	 * sent here differs from the set held in BOTH directions at once - one box off, one
	 * left where it was, one on - because a route that only ever added, or only ever
	 * removed, satisfies a case that moves the row one way.
	 *
	 * <p><b>The answer and the table are asked separately, and they are two places a wrong
	 * answer could come from.</b> A resource that handed the request back would agree with
	 * the table on every request that worked, which is exactly why echoing looks right; the
	 * screen redraws itself from this answer, so a portal that echoed would draw a row of
	 * boxes nobody had written.
	 *
	 * <p><b>Which is why the order sent here is NOT the order answered</b>, and that is the
	 * whole of what makes the assertion on the answer a claim about its source. The request
	 * names {@link #LEFT_ALONE} first and {@link #GIVEN} second; the table hands them back
	 * by code, which is the other way round, and is the order {@code ModeratorApi} serves
	 * the same list in. So the two are compared exactly and in order: a resource echoing
	 * the request answers the right SET and the wrong sequence, and with
	 * {@code containsExactlyInAnyOrder} in this line it would pass.
	 *
	 * <p><b>And the three moderators nobody asked about are read too</b>, because a
	 * statement that lost the condition naming the account writes the row to all of them
	 * and answers correctly for the one that was asked.
	 */
	@Test
	void theBoxesSavedAreTheBoxesTheTableHoldsAfterwards() throws Exception {
		assertThat(ticksInTheTableOf(ACTED))
				.as("the fixture's moderator does not hold the box this save takes away, or does"
						+ " already hold the one it gives, so the save moves the row in one"
						+ " direction only and measures half of what it claims")
				.containsExactlyInAnyOrder(TAKEN_AWAY, LEFT_ALONE)
				.doesNotContain(GIVEN);

		MockHttpServletResponse answer = save(accountOf(ACTED), List.of(LEFT_ALONE, GIVEN));

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(rightsIn(answer))
				.as("the answer does not carry the row that was saved")
				.containsExactly(GIVEN, LEFT_ALONE);
		assertThat(ticksInTheTableOf(ACTED))
				.as("the answer said one thing and the table says another, which is what an"
						+ " answer echoed off the request looks like")
				.containsExactly(GIVEN, LEFT_ALONE);

		assertThat(ticksInTheTableOf(FIRST_WRITTEN))
				.as("saving one moderator's boxes moved another's, so the statement is about"
						+ " every row rather than about the account it was given")
				.containsExactly(THE_FIRST_ONES);
		assertThat(ticksInTheTableOf(ANOTHER))
				.as("saving one moderator's boxes moved a third one's")
				.containsExactly(THE_THIRD_ONES);
		assertThat(ticksInTheTableOf(EVERY_TICK))
				.as("saving one moderator's boxes moved the ticks of the one who holds them all")
				.containsExactlyElementsOf(everyRightThereIs());
	}

	/**
	 * A BOX ALREADY TICKED IS NOT TICKED AGAIN, which is V18's own sentence and not a
	 * tidiness.
	 *
	 * <p>„THE PAIR IS THE KEY, so a right is granted once. Ticking a box that is already
	 * ticked is not a second fact, and there is no order in which somebody was given
	 * things" (V18). The easy way to write this route is to empty the row and write it
	 * back, and it passes every other case in this file: the set afterwards is right. What
	 * it moves is {@code granted_at} on every box that did not change, so the day anybody
	 * asks when a moderator was given something the answer is the last time anybody pressed
	 * Save.
	 *
	 * <p><b>Both halves, because one of them is the floor of the other.</b> The box that
	 * stayed keeps the instant it had; the box that arrived does NOT have that instant, so
	 * the first half is a claim about the write rather than about a column nothing ever
	 * sets.
	 */
	@Test
	void aBoxAlreadyTickedIsNotTickedAgain() throws Exception {
		Instant before = whenGiven(ACTED, LEFT_ALONE);

		assertThat(before)
				.as("the fixture gave this box at the moment the case runs, so an instant that did"
						+ " not move and one that was rewritten cannot be told apart")
				.isBefore(Instant.now().minus(Duration.ofDays(1)));

		assertThat(save(accountOf(ACTED), List.of(LEFT_ALONE, GIVEN)).getStatus()).isEqualTo(200);

		assertThat(whenGiven(ACTED, LEFT_ALONE))
				.as("a box that was already ticked was ticked again, so the row was emptied and"
						+ " written back and every moment in it now says when Save was pressed")
				.isEqualTo(before);
		assertThat(whenGiven(ACTED, GIVEN))
				.as("a box given for the first time carries the moment the fixture used, so"
						+ " nothing above is a claim about this column being written at all")
				.isNotEqualTo(before);
	}

	/**
	 * A MODERATOR MAY HAVE EVERY BOX TAKEN AWAY, AND HE IS STILL A MODERATOR.
	 *
	 * <p>„An empty list is not a broken record, it is a moderator who has just been made
	 * and may do nothing yet" ({@code frontend/src/data/types.ts}), and the state is
	 * reachable from both sides: {@code ModeratorApiTest} holds that it can be READ, and
	 * this holds that it can be written. The account stays, because taking every right away
	 * and deleting somebody are two different decisions and this route is asked for the
	 * first.
	 *
	 * <p><b>The floor is that he really held something</b>, so an empty row afterwards is
	 * a row that was emptied rather than one that was always empty.
	 */
	@Test
	void everyBoxMayBeTakenAwayAndHeIsStillThere() throws Exception {
		assertThat(ticksInTheTableOf(ACTED))
				.as("the fixture's moderator holds nothing, so emptying his row says nothing")
				.isNotEmpty();

		MockHttpServletResponse answer = save(accountOf(ACTED), List.of());

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(rightsIn(answer))
				.as("a moderator who may do nothing was answered somebody's boxes")
				.isEmpty();
		assertThat(ticksInTheTableOf(ACTED))
				.as("the boxes were taken away in the answer and not in the table")
				.isEmpty();
		assertThat(stillThere(ACTED))
				.as("taking every box away deleted the moderator, and those are two decisions")
				.isTrue();
	}

	/**
	 * A REQUEST THAT NAMES NO LIST AT ALL IS NOT A MODERATOR WHO MAY DO NOTHING.
	 *
	 * <p>The two are one field apart in the body and opposite in meaning. Read as the
	 * second - which is what happens when a missing field is turned into an empty list -
	 * a request that lost its field on the way strips a moderator of everything and answers
	 * 200, and the case above would go on passing because it sends the empty list on
	 * purpose.
	 *
	 * <p>The row is read afterwards, because a refusal that had already written half of
	 * itself would answer 400 and leave the moderator holding nothing.
	 */
	@Test
	void aRequestWithNoListAtAllIsRefusedAndTakesNothingAway() throws Exception {
		List<String> before = ticksInTheTableOf(ACTED);

		MockHttpServletResponse answer = save(accountOf(ACTED), "{}", EVERYTHING);

		assertThat(answer.getStatus())
				.as("a request naming no boxes at all was accepted, so a body that lost its field"
						+ " takes every right a moderator has")
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(ModeratorWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(ticksInTheTableOf(ACTED))
				.as("the request was refused and the boxes moved anyway")
				.isEqualTo(before);
	}

	/**
	 * A CODE THE MATRIX DOES NOT HOLD IS REFUSED AS A SENTENCE, AND NOTHING IS WRITTEN.
	 *
	 * <p><b>{@code entity:moderators} is the first row and it is the point rather than an
	 * example.</b> The owner refused to create that box - „Ne treba ni da postoji kolona
	 * moderatori jer samo superadmin ima ta prava" (PDL P28a, 13.08.2026, „Moderatori nemaju
	 * kolonu") - so a route that took it would give a moderator a tick whose only possible
	 * meaning is the one thing PDL P21 keeps for the superadmin, and
	 * {@code RightsAtTheDoorTest.everyRightARouteAsksForIsOneTheMatrixHolds} cannot see it,
	 * because no route ASKS for that code.
	 *
	 * <p><b>Refused as a sentence and not as a constraint violation.</b>
	 * {@code account_admin_right_right_fk} would refuse it anyway (V18), as a 500 reaching
	 * the superadmin after he had filled the screen in.
	 *
	 * <p><b>The last row mixes a good code with a bad one</b>, which is the shape that
	 * separates „every code is judged" from „the first one is". A route that wrote as it
	 * went would leave the good half written and answer 400.
	 *
	 * <p><b>And the floor is read off the table</b>, so this says „the matrix does not hold
	 * it" rather than „I believe it does not".
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "-", value = {
			"entity:moderators, -",
			"entity:races, -",
			"Entity:members, -",
			"'', -",
			"entity:moderators, entity:leagues",
	})
	void aCodeTheMatrixDoesNotHoldIsRefusedAndNothingIsWritten(String invented, String beside)
			throws Exception {

		assertThat(everyRightThereIs())
				.as("the matrix holds this code after all, so refusing it is not what this measures")
				.doesNotContain(invented);

		List<String> before = ticksInTheTableOf(ACTED);
		List<String> sent = beside == null ? List.of(invented) : List.of(beside, invented);

		MockHttpServletResponse answer = save(accountOf(ACTED), sent);

		assertThat(answer.getStatus())
				.as("%s was accepted as a right, and the matrix does not hold it", invented)
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(ModeratorWriteApi.A_RIGHT_THE_MATRIX_DOES_NOT_HOLD);
		assertThat(ticksInTheTableOf(ACTED))
				.as("%s was refused and the row was written anyway", invented)
				.isEqualTo(before);
	}

	/**
	 * AND EVERY CODE THE MATRIX DOES HOLD MAY BE TICKED, which is the other direction and
	 * the floor under the case above.
	 *
	 * <p>Without it a route that refused every code whatever passes every row above while
	 * the screen can tick nothing at all. The list is read off {@code admin_right} and is
	 * not twelve names written here, so the thirteenth right added tomorrow is measured on
	 * the day it exists rather than waiting for somebody to remember this file.
	 *
	 * <p><b>AND THE MODERATOR WHO HOLDS EVERYTHING IS TAKEN OUT BEFORE THE QUESTION IS
	 * ASKED, which is the whole floor rather than tidying up.</b> While he is in the
	 * fixture, „every code the matrix holds" and „every code anybody has ever been given"
	 * are the SAME LIST, so a resource that read the second instead of the first would
	 * answer identically and this case would measure nothing - the rule of 06.09.2026 about
	 * two sources of one value. It is not a theory: a mutation reading the matrix out of
	 * {@code account_admin_right} rather than out of {@code admin_right} passed all
	 * seventeen cases of this file until this line existed, and that is a resource in which
	 * the very first right ever granted decides what may be granted afterwards.
	 *
	 * <p>He is taken out through the route under test rather than with a statement of this
	 * file's own, and the gap it leaves is read back before anything is asked through it.
	 *
	 * <p>Read back out of the table, because an answer that echoed the request would satisfy
	 * this with nothing written.
	 */
	@Test
	void everyCodeTheMatrixHoldsMayBeTicked() throws Exception {
		List<String> matrix = everyRightThereIs();

		assertThat(matrix)
				.as("the matrix holds no codes at all, so ticking every one of them ticks none")
				.isNotEmpty();

		assertThat(remove(accountOf(EVERY_TICK)).getStatus()).isEqualTo(204);

		assertThat(codesAnybodyHolds())
				.as("somebody has still been given every code the matrix holds, so the matrix and"
						+ " the list of what anybody was given are the same answer, and nothing"
						+ " below can tell which of the two the resource read")
				.hasSizeLessThan(matrix.size());

		assertThat(save(accountOf(ACTED), matrix).getStatus()).isEqualTo(200);

		assertThat(ticksInTheTableOf(ACTED))
				.as("a code the matrix really holds was refused, or was answered for and not"
						+ " written")
				.containsExactlyElementsOf(matrix);
	}

	/**
	 * Every code anybody has been GIVEN, which is a different list from the matrix and is
	 * the one a resource must not mistake for it.
	 */
	private List<String> codesAnybodyHolds() {
		return db.sql("select distinct right_code from account_admin_right order by right_code")
				.query(String.class).list();
	}

	/**
	 * A TICK TAKEN AWAY SHUTS THE DOOR THE MODERATOR WENT THROUGH A MOMENT AGO.
	 *
	 * <p><b>The one case that says this route means anything.</b> Everything else here
	 * measures a table; the owner's sentence is about what somebody may do - „Šta konkretno
	 * neki moderator sme zavisi od prava koja mu je Superadmin dodelio" (PDL P21) - and
	 * between the table and the door stand {@code WhatHeMayDo} and {@code RightsAtTheDoor}.
	 * A route that wrote a row nothing reads would pass every other case in this file.
	 *
	 * <p><b>Measured on a real guarded route, in both directions, and by two numbers that
	 * do not depend on any row existing.</b> {@code POST /api/payments} needs
	 * {@code queue:payments}: sent with an empty form by somebody who holds the tick it is
	 * answered 400 by the resource, and by somebody who does not it is answered 404 at the
	 * door. Neither number is about a payment, so nothing has to be written to ask the
	 * question, and the two cannot coincide.
	 *
	 * <p><b>Both directions, because they are different mistakes.</b> A portal that never
	 * read the table again would keep the first answer; one that cached the row would keep
	 * the second.
	 */
	@Test
	void aTickTakenAwayShutsTheDoorAndOneGivenBackOpensIt() throws Exception {
		assertThat(ticksInTheTableOf(ACTED))
				.as("the fixture's moderator does not hold the tick this case takes away")
				.contains(LEFT_ALONE);

		assertThat(whatTheQueueSays(ACTED))
				.as("a moderator holding queue:payments was refused at the door, so the two"
						+ " numbers below are not about the tick at all")
				.isEqualTo(400);

		assertThat(save(accountOf(ACTED), List.of(GIVEN)).getStatus()).isEqualTo(200);

		assertThat(whatTheQueueSays(ACTED))
				.as("the tick was taken out of the table and the door went on opening, so what the"
						+ " superadmin saves is not what decides")
				.isEqualTo(404);

		assertThat(save(accountOf(ACTED), List.of(GIVEN, LEFT_ALONE)).getStatus()).isEqualTo(200);

		assertThat(whatTheQueueSays(ACTED))
				.as("the tick was given back and the door stayed shut, so the answer above was a"
						+ " door that shuts rather than a table that is read")
				.isEqualTo(400);
	}

	/**
	 * What a guarded route answers this account, with a form it refuses on its own terms.
	 *
	 * <p>400 means he got through the door and the resource judged his form; 404 means the
	 * door refused him. Nothing is written either way, so this may be asked as often as a
	 * case likes.
	 */
	private int whatTheQueueSays(String email) throws Exception {
		return http.perform(post("/api/payments").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content("{}")
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse().getStatus();
	}

	/**
	 * A MODERATOR HOLDING EVERY TICK THERE IS IS REFUSED BOTH ROUTES, AND WHAT HE ASKED
	 * ABOUT IS UNTOUCHED AFTERWARDS.
	 *
	 * <p>„Bez te granice moderator bi sam sebi mogao da dodeli prava, pa granularna prava ne
	 * bi značila ništa" (PDL P28a, 30.07.2026). There is no box that opens this, which is
	 * why there is no column for it in the matrix, so holding all of them changes nothing.
	 *
	 * <p><b>The second half of every assertion is the case.</b> Both routes answer 404 to a
	 * key nobody holds as well, on purpose (ADL A8 applied to a row), so the number alone
	 * says nothing whatever. The row he named really exists and is read back afterwards -
	 * which is exactly the hole PR 295 was found to have, where a {@code DELETE} said 404
	 * both when it refused and when there was nothing there.
	 *
	 * <p><b>And the superadmin doing the same two things is the anchor</b>: without it a
	 * pair of routes that refused everybody would pass this.
	 */
	@Test
	void aModeratorHoldingEveryTickThereIsIsRefusedBothRoutes() throws Exception {
		List<String> matrix = everyRightThereIs();

		assertThat(ticksInTheTableOf(EVERY_TICK))
				.as("this moderator does not really hold every tick there is, so being refused"
						+ " says nothing about a tick not opening these")
				.containsExactlyElementsOf(matrix);

		MockHttpServletResponse saved =
				save(accountOf(ACTED), ticks(List.of(GIVEN)), EVERY_TICK);

		assertThat(saved.getStatus())
				.as("a moderator with every one of the %d ticks rewrote another moderator's boxes,"
						+ " so he can tick himself the rest", matrix.size())
				.isEqualTo(404);
		assertThat(saved.getStatus())
				.as("the refusal is 403, which says the address is real; the owner decided 404 on"
						+ " 13.09.2026 precisely so that it would not")
				.isNotEqualTo(403);
		assertThat(ticksInTheTableOf(ACTED))
				.as("the save was refused and the boxes moved anyway, so the 404 above is the one"
						+ " that means nothing was there while the row is very much there")
				.containsExactlyInAnyOrder(TAKEN_AWAY, LEFT_ALONE);

		MockHttpServletResponse removed = remove(accountOf(ACTED), EVERY_TICK);

		assertThat(removed.getStatus())
				.as("a moderator with every tick deleted another moderator")
				.isEqualTo(404);
		assertThat(stillThere(ACTED))
				.as("the delete was refused and the moderator disappeared anyway")
				.isTrue();

		assertThat(save(accountOf(ACTED), List.of(GIVEN)).getStatus())
				.as("the superadmin was refused the same save, so the refusals above are routes"
						+ " that are shut to everybody rather than a guard that asks who")
				.isEqualTo(200);
		assertThat(remove(accountOf(ACTED)).getStatus())
				.as("the superadmin was refused the same delete")
				.isEqualTo(204);
	}

	/**
	 * A SUPERADMIN CANNOT TAKE HIS OWN RIGHTS AWAY HERE, AND CANNOT DELETE HIMSELF.
	 *
	 * <p><b>The first half of the owner's sentence of 11.08.2026</b>, „Superadmin ne sme da
	 * oduzme prava sebi ni poslednjem preostalom Superadminu", and it is taken on its own
	 * because the two halves are not the same claim.
	 *
	 * <p>What „taking rights away" can even mean for him is settled by the schema. He has
	 * no boxes - „Superadmin nema kućice. On sme sve, uvek, i ne pojavljuje se u ovoj tabeli
	 * kao neko kome se prava dodeljuju" (PDL P28a, 30.07.2026) - so what he holds is
	 * {@code role.rights_mode}, and neither route touches a role at all. The two ways to
	 * reach him through this resource are therefore his key on either route, and both find
	 * no row: he is not a moderator.
	 *
	 * <p><b>Three things are read afterwards and not one</b>, because they are three
	 * different ways of getting it wrong: his account may not disappear, his role may not
	 * change, and no row may be written for him into the table he is not in.
	 */
	@Test
	void aSuperadminCannotTakeHisOwnRightsAwayNorDeleteHimself() throws Exception {
		assertThat(roleOf(EVERYTHING))
				.as("the fixture's superadmin is not one, so nothing below is about his role")
				.isEqualTo("superadmin");

		MockHttpServletResponse saved = save(accountOf(EVERYTHING), List.of());

		assertThat(saved.getStatus())
				.as("the superadmin reached his own row on the moderators' screen, and PDL P28a,"
						+ " 30.07.2026 keeps him out of that table altogether")
				.isEqualTo(404);
		assertThat(saved.getContentAsString())
				.as("a key that is not a moderator was answered with a reason, which is a sentence"
						+ " about something that does not exist")
				.isEmpty();

		assertThat(remove(accountOf(EVERYTHING)).getStatus())
				.as("the superadmin deleted his own account through the moderators' screen, and"
						+ " the portal would then hold no account that may anything")
				.isEqualTo(404);

		assertThat(stillThere(EVERYTHING))
				.as("the superadmin's account is gone")
				.isTrue();
		assertThat(roleOf(EVERYTHING))
				.as("the superadmin is no longer a superadmin")
				.isEqualTo("superadmin");
		assertThat(ticksInTheTableOf(EVERYTHING))
				.as("a row was written into the matrix for the one account that has no row in it")
				.isEmpty();
	}

	/**
	 * AND NEITHER CAN HE TAKE ANOTHER SUPERADMIN'S AWAY, WHICHEVER OF THEM IS THE LAST.
	 *
	 * <p><b>The second half of the same sentence, and it is a different claim because
	 * superadmin accounts may be several.</b> „Superadminskih naloga sme da bude vise"
	 * (ADL A40, 14.09.2026); {@code role_only_one_holds_every_right} does not forbid it,
	 * because that index is over the ROLE and not over the accounts carrying it. So „the
	 * last remaining superadmin" is a question about a number of rows, and this fixture
	 * holds two of them precisely so that the answer below cannot be about being the only
	 * one.
	 *
	 * <p><b>Nothing here counts anything, and that is the decision rather than a gap.</b>
	 * The owner closed the question from a different side on the same day: „posto uloga ne
	 * stoji kao zapis koji se dodeljuje, nego se izvodi iz podesavanja, superadmin ne moze
	 * da se obrise ni razvlasti kroz portal uopste ... Zabrana ... postaje nepotrebna po
	 * konstrukciji: nema radnje koja bi je prekrsila" (PDL P21, 14.09.2026, „Superadmin se
	 * ne pravi kroz portal"). A route that counted remaining superadmins would be a portal
	 * in which deleting one of two is allowed, which is the thing that decision took away,
	 * and it would put a second home under a fact the settings own.
	 *
	 * <p><b>So the measurement is the opposite of a count:</b> with two superadmins in the
	 * table, deleting one is refused exactly as deleting the only one would be, and the
	 * count does not move.
	 */
	@Test
	void andNeitherCanHeTakeAnotherSuperadminsAwayThoughThereAreTwo() throws Exception {
		assertThat(howManySuperadmins())
				.as("the fixture holds one superadmin account, so a refusal below is a refusal to"
						+ " delete the LAST one and says nothing about the second half of the"
						+ " owner's sentence")
				.isEqualTo(2);
		assertThat(accountOf(THE_OTHER_SUPERADMIN))
				.as("the two superadmins of the fixture are one account")
				.isNotEqualTo(accountOf(EVERYTHING));

		assertThat(save(accountOf(THE_OTHER_SUPERADMIN), List.of(GIVEN)).getStatus())
				.as("one superadmin rewrote another's rights through the moderators' screen")
				.isEqualTo(404);
		assertThat(remove(accountOf(THE_OTHER_SUPERADMIN)).getStatus())
				.as("one superadmin deleted another although PDL P21, 14.09.2026 says no action"
						+ " through the portal can")
				.isEqualTo(404);

		assertThat(stillThere(THE_OTHER_SUPERADMIN))
				.as("the second superadmin's account is gone")
				.isTrue();
		assertThat(roleOf(THE_OTHER_SUPERADMIN))
				.as("the second superadmin is no longer one")
				.isEqualTo("superadmin");
		assertThat(ticksInTheTableOf(THE_OTHER_SUPERADMIN))
				.as("a row was written into the matrix for an account that has none")
				.isEmpty();
		assertThat(howManySuperadmins())
				.as("the portal holds fewer superadmin accounts than it did")
				.isEqualTo(2);
	}

	/**
	 * DELETING A MODERATOR TAKES HIS TICKS AND HIS WAY IN, AND LEAVES EVERY OTHER
	 * MODERATOR STANDING.
	 *
	 * <p><b>What goes with him is the schema's sentence and not this route's</b>, written
	 * in {@code account_admin_right_account_fk} and {@code account_session_account_fk} (V18)
	 * as {@code on delete cascade}. It is measured here anyway, and for a reason that is not
	 * repetition: this is the only place that says the ROUTE deleted the account it was
	 * given, and the cascade is what makes „deleted" mean that a cookie he still holds stops
	 * working at his next request rather than at its own expiry.
	 *
	 * <p><b>Three other moderators are read afterwards</b>, one of whom holds every tick
	 * there is, so a statement with no condition - or one deleting every row of the matrix
	 * rather than his - answers differently. The one deleted is written second, so the
	 * lowest key is not the right answer either.
	 */
	@Test
	void deletingAModeratorTakesHisTicksAndHisSessionAndNobodyElses() throws Exception {
		long his = accountOf(ACTED);

		assertThat(ticksInTheTableOf(ACTED))
				.as("the moderator being deleted holds nothing, so his ticks disappearing says"
						+ " nothing")
				.isNotEmpty();
		assertThat(sessionsOf(his))
				.as("the moderator being deleted has no session, so its disappearing says nothing")
				.isOne();

		assertThat(remove(his).getStatus()).isEqualTo(204);

		assertThat(stillThere(ACTED))
				.as("the route answered 204 and the account is still there")
				.isFalse();
		assertThat(ticksInTheTableOf(ACTED))
				.as("the ticks of a deleted moderator outlived him, pointing at nobody")
				.isEmpty();
		assertThat(sessionsOf(his))
				.as("a deleted moderator's session outlived him, so his cookie still signs him in")
				.isZero();

		assertThat(ticksInTheTableOf(FIRST_WRITTEN))
				.as("deleting one moderator took another moderator's ticks")
				.containsExactly(THE_FIRST_ONES);
		assertThat(ticksInTheTableOf(EVERY_TICK))
				.as("deleting one moderator emptied the matrix")
				.containsExactlyElementsOf(everyRightThereIs());
		assertThat(stillThere(ANOTHER))
				.as("deleting one moderator deleted another")
				.isTrue();
		assertThat(stillThere(FIRST_WRITTEN))
				.as("deleting one moderator deleted the first one written")
				.isTrue();
	}

	private long sessionsOf(long account) {
		return db.sql("select count(*) from account_session where account_id = ?")
				.param(account).query(Long.class).single();
	}

	/**
	 * AND THE DECISIONS HE MADE OUTLIVE HIM, UNDER THE NAME HE MADE THEM UNDER.
	 *
	 * <p><b>Nothing in the route says this and nothing in it should.</b>
	 * {@code verification_decided_by} and {@code payment_recorded_by} are
	 * {@code on delete set null} beside a {@code decided_by_name} and a
	 * {@code recorded_by_name} that are plain text (V9, V16), which V9 states as the rule it
	 * copied from {@code event_comment}: a decision was made, it stays made, and it says by
	 * whom. A {@code delete from verification} written into this route would be a second
	 * answer to a question the schema has already answered, and the day the two disagreed
	 * the schema would win silently.
	 *
	 * <p><b>Measured all the same, and V9's own comment says why it is not repetition.</b>
	 * The constraint holding „a decided row says by whom" was once written over
	 * {@code decided_by} rather than over the NAME, and the two then contradicted the
	 * foreign key: deleting the account of a moderator who had ever decided anything failed
	 * outright. So „he may be deleted" is a claim about this route meeting the schema, and
	 * it is a claim that has already been false once.
	 *
	 * <p><b>The name is asserted and not only the emptied pointer</b>, because a cascade
	 * that took the rows away would satisfy „the pointer is empty" by having nothing to
	 * point.
	 */
	@Test
	void theDecisionsHeMadeOutliveHimUnderTheNameHeMadeThemUnder() throws Exception {
		long his = accountOf(ACTED);
		long runner = competitor("000901", "0011223344556601");

		decided(his);
		recorded(his, runner);

		assertThat(remove(his).getStatus()).isEqualTo(204);

		assertThat(db.sql("select decided_by is null and decided_by_name = ? from verification"
						+ " where subject = ?")
						.params(THE_NAME_HE_DECIDED_UNDER, WHAT_HE_DECIDED)
						.query(Boolean.class).optional())
				.as("the decision a deleted moderator made went with him, or kept pointing at an"
						+ " account that is not there, or lost the name it was made under")
				.contains(true);

		assertThat(db.sql("select recorded_by is null and recorded_by_name = ? from payment"
						+ " where reference = ?")
						.params(THE_NAME_HE_RECORDED_UNDER, THE_REFERENCE_HE_RECOGNISED)
						.query(Boolean.class).optional())
				.as("the payment a deleted moderator recognised went with him, or lost the name it"
						+ " was recognised under")
				.contains(true);

		assertThat(db.sql("select count(*) from competitor where id = ?").param(runner)
						.query(Long.class).single())
				.as("deleting a moderator's account took a member's record with it, and"
						+ " account_competitor_fk is RESTRICT - the one such key in this schema"
						+ " that guards a person rather than a codebook - precisely so that a"
						+ " person is never deleted as a side effect")
				.isOne();
	}

	/** A decided row of the queue, under this account and under a name of its own. */
	private void decided(long account) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, raised_at,"
						+ " state, decided_at, decided_by, decided_by_name, reason)"
						+ " values ('comments', null, ?, '', null,"
						+ " timestamptz '2026-08-01 06:00:00+00', 'approved',"
						+ " timestamptz '2026-08-02 06:00:00+00', ?, ?, null)")
				.params(WHAT_HE_DECIDED, account, THE_NAME_HE_DECIDED_UNDER).update();
	}

	/** And a payment he recognised, which is the same shape one table along. */
	private void recorded(long account, long runner) {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount,"
						+ " currency, fee, method, state, recorded_at, recorded_by, recorded_by_name)"
						+ " values (?, 2028, ?, (select id from price_row where key = 'early'),"
						+ " 35.00, 'EUR', 3.00, 'card', 'recorded',"
						+ " timestamptz '2027-10-02 09:00:00+00', ?, ?)")
				.params(runner, THE_REFERENCE_HE_RECOGNISED, account, THE_NAME_HE_RECORDED_UNDER)
				.update();
	}

	private long competitor(String number, String referral) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Trkac', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment', ?,"
						+ " '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, referral).query(Long.class).single();
	}

	/**
	 * AN ACCOUNT THAT IS NOT A MODERATOR READS EXACTLY LIKE ONE THAT IS NOT THERE.
	 *
	 * <p>Both routes and both kinds of key, because the condition is written once in each
	 * statement. 404 with no body is the same answer {@code RightsAtTheDoor} gives a refused
	 * caller, which is ADL A8 applied to a row: a body of any kind is something an address
	 * that does not exist would not have.
	 *
	 * <p><b>The plain member is the half that says this is about the ROLE.</b> A key nobody
	 * holds would be refused by a statement with no condition on the role at all, so on its
	 * own it measures nothing about who may be written; his account is read back afterwards
	 * because a route that deleted him would answer 404 and delete him.
	 */
	@Test
	void anAccountThatIsNotAModeratorReadsLikeOneThatIsNotThere() throws Exception {
		MockHttpServletResponse saved = save(-1, List.of(GIVEN));

		assertThat(saved.getStatus()).isEqualTo(404);
		assertThat(saved.getContentAsString())
				.as("a key nobody holds was answered with a reason")
				.isEmpty();

		MockHttpServletResponse removed = remove(-1);

		assertThat(removed.getStatus()).isEqualTo(404);
		assertThat(removed.getContentAsString()).isEmpty();

		assertThat(save(accountOf(A_MEMBER), List.of(GIVEN)).getStatus())
				.as("an account with no administrative standing at all was given a tick, which is"
						+ " a competitor who may now moderate")
				.isEqualTo(404);
		assertThat(remove(accountOf(A_MEMBER)).getStatus())
				.as("a competitor's account was deleted through the moderators' screen")
				.isEqualTo(404);

		assertThat(stillThere(A_MEMBER))
				.as("the delete was refused and the competitor's account went anyway")
				.isTrue();
		assertThat(ticksInTheTableOf(A_MEMBER))
				.as("a tick was written for an account whose role can hold none")
				.isEmpty();
	}
}

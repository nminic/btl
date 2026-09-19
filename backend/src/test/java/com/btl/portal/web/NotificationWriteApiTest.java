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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.lang.reflect.RecordComponent;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * PUT /api/me/notifications: A MEMBER TURNING HIS OWN MAIL ON AND OFF.
 *
 * <p><b>FOUR PEOPLE, AND NOT ONE OF THEM IS THE ONLY ONE OF HIS KIND.</b> Every number below
 * is a setting that would let a right answer and a wrong one produce the same row, and every
 * one of them was chosen against a fault that this suite could otherwise not see.
 *
 * <ul>
 * <li><b>Nobody's switches are all alike, and the edit turns some ON and some OFF.</b> With a
 * row of six falses turned into six trues, „the route wrote what was sent" and „the route
 * wrote true into every column" are one row and the case says nothing. The member who acts
 * starts at an alternating mixture and sends a mixture that leaves one switch on, leaves one
 * off, turns two on and turns two off.
 * <li><b>There is a SECOND member with a row of his own, and his row is a different
 * mixture.</b> A query that answered a constant row, or one that read {@code account_id}
 * where it should read {@code competitor_id}, has somebody to disagree with it.
 * <li><b>That second member is the FIRST BY KEY.</b> He is inserted before anybody else, so a
 * statement that wrote „the first row" or resolved the member some way other than off the
 * session lands on him - and every case below asserts his row is exactly what it was.
 * <li><b>A third member has NO ROW AT ALL</b>, which {@link NotificationApi} calls the
 * ordinary state for most members today, so „make one" and „change one" are two measured
 * states and not one.
 * <li><b>And a fourth whose fee has lapsed</b>, because this route deliberately does not ask
 * about it and a decision nothing measures is an opinion.
 * </ul>
 *
 * <p><b>THE FLOOR UNDER THE SIX IS THE CATALOGUE AND NOT A LIST WRITTEN HERE.</b> Every case
 * that needs to know what the switches are asks {@code information_schema} for the columns of
 * {@code notification_setting} that are not part of its primary key. What that can and cannot
 * promise is written over {@link #theSwitchesAreTheTablesOwnColumnsInAllThreePlaces}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class NotificationWriteApiTest {

	private static final String PATH = "/api/me/notifications";

	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzz";

	/**
	 * THE FIRST MEMBER BY KEY, whose row nothing in this file is allowed to move.
	 *
	 * <p>Inserted before anybody else on purpose: a write that landed on „the first row", or
	 * on a member worked out some way other than off the session, lands on him.
	 */
	private static final String ANOTHER_MEMBER = "000041";

	/** The member who does the choosing in every case below. */
	private static final String HE_CHOOSES = "000042";

	/** A member with no row in {@code notification_setting} at all. */
	private static final String NEVER_OPENED = "000043";

	/** A member whose fee has lapsed: {@code competitor.active} is false. */
	private static final String LAPSED = "000044";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	/** What {@link #ANOTHER_MEMBER} holds, and goes on holding whatever anybody else does. */
	private static final List<Boolean> HIS_NEIGHBOURS_ROW =
			List.of(false, false, true, true, false, false);

	/** Alternating, so a column read one seat along answers at least one switch wrong. */
	private static final List<Boolean> WHERE_HE_STARTS =
			List.of(true, false, true, false, true, false);

	/**
	 * WHAT HE SENDS, AND IT IS A MIXTURE IN BOTH DIRECTIONS.
	 *
	 * <p>Against {@link #WHERE_HE_STARTS} this leaves the first switch ON, turns the second
	 * ON, turns the third OFF, leaves the fourth OFF, turns the fifth OFF and turns the sixth
	 * ON. So „he turned everything on", „he turned everything off", „nothing was written at
	 * all" and „the row was inverted" are four different rows, and this is none of them.
	 */
	private static final List<Boolean> WHAT_HE_CHOOSES =
			List.of(true, true, false, false, false, true);

	/** What the lapsed member holds before he is asked to change anything. */
	private static final List<Boolean> WHERE_THE_LAPSED_ONE_STARTS =
			List.of(true, true, true, false, false, false);

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final ObjectMapper mapper = new ObjectMapper();

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	@BeforeEach
	void fourMembersAndOneModerator() {
		competitor(ANOTHER_MEMBER, "Prva", "Po Kljucu", true);
		competitor(HE_CHOOSES, "Drugi", "Bira", true);
		competitor(NEVER_OPENED, "Treca", "Nije Otvorila", true);
		competitor(LAPSED, "Cetvrti", "Nije Platio", false);

		account(ANOTHER_MEMBER + "@primer.rs", "competitor", ANOTHER_MEMBER);
		account(HE_CHOOSES + "@primer.rs", "competitor", HE_CHOOSES);
		account(NEVER_OPENED + "@primer.rs", "competitor", NEVER_OPENED);
		account(LAPSED + "@primer.rs", "competitor", LAPSED);
		account(MODERATOR_WHO_DOES_NOT_RACE, "moderator", null);

		row(ANOTHER_MEMBER, HIS_NEIGHBOURS_ROW);
		row(HE_CHOOSES, WHERE_HE_STARTS);
		row(LAPSED, WHERE_THE_LAPSED_ONE_STARTS);
	}

	/**
	 * A VISITOR IS REFUSED BY THE CHAIN, AND A MEMBER IS NOT.
	 *
	 * <p>Already measured for every mapped route by {@code ApiSecurityTest}; kept here beside
	 * the pair that proves a real member is served 200, so it is not read as a refusal of
	 * everybody.
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsRefused() throws Exception {
		assertThat(sent(null, body(WHAT_HE_CHOOSES)).getStatus()).isEqualTo(401);
		assertThat(sent(HE_CHOOSES, body(WHAT_HE_CHOOSES)).getStatus()).isEqualTo(200);
	}

	/**
	 * AN ACCOUNT WITH NO MEMBER BEHIND IT HAS NO SWITCHES TO WRITE, AND ITS REFUSAL IS NOT
	 * TOLD APART FROM AN ADDRESS THAT IS NOT THERE.
	 *
	 * <p><b>The comparison is against a {@code PUT} carrying the same JSON at an address
	 * nothing maps</b>, and both halves of it are asserted rather than one: that the unmapped
	 * address really answers 404, so the equality below is not two 200s agreeing, and that
	 * the two answers carry the same status and the same body. A refusal that differed from
	 * „there is nothing here" by so much as a body would tell a moderator who does not race
	 * that writing lives at an address the portal never offered him.
	 *
	 * <p>What {@code MockMvc} cannot see is the LENGTH of what a real container sends on the
	 * error dispatch, which is why {@code RightsOverRealHttpTest} measures the same pair over
	 * a socket for the {@code GET} of this path. That is the reason the route answers with
	 * {@code sendError} rather than with a status of its own.
	 */
	@Test
	void anAccountWithNoMemberBehindItIsToldTheAddressIsNotThere() throws Exception {
		MockHttpServletResponse refused = sentBy(MODERATOR_WHO_DOES_NOT_RACE, PATH,
				body(WHAT_HE_CHOOSES));
		MockHttpServletResponse nowhere = sentBy(MODERATOR_WHO_DOES_NOT_RACE, NOTHING_IS_THERE,
				body(WHAT_HE_CHOOSES));

		assertThat(nowhere.getStatus())
				.as("the address nothing maps did not answer 404, so comparing the refusal with"
						+ " it says nothing about what the refusal hides")
				.isEqualTo(404);

		assertThat(List.of(refused.getStatus(), refused.getContentAsString()))
				.as("an account naming no member was answered differently from an address that"
						+ " is not there, and the difference says writing lives here")
				.isEqualTo(List.of(nowhere.getStatus(), nowhere.getContentAsString()));

		assertThat(howManyRows())
				.as("a row was written for an account that names no member")
				.isEqualTo(3);
	}

	/**
	 * A BODY NOBODY CAN READ SAYS NOTHING TO AN ACCOUNT THIS ADDRESS IS NOT FOR, AND STILL
	 * SAYS WHAT IS MISSING TO ONE IT IS FOR.
	 *
	 * <p><b>The leak this closes.</b> With the switches declared as {@code @RequestBody}, a
	 * body was read while ARGUMENTS WERE RESOLVED - before the first line of {@code change} -
	 * so a signed in account with no member behind it sent a body Jackson could not parse and
	 * was answered 400, while the identical request to an address that maps nothing answered
	 * 404. One request, and the difference said „a PUT with a body lives here", which is
	 * exactly what the note at the top of {@link NotificationWriteApi} claims cannot happen.
	 *
	 * <p><b>Both directions, because one of them alone is satisfied by a route that refuses
	 * everybody.</b> The first half demands the member-less account be told nothing; a
	 * handler answering 404 to every unreadable body would pass it and would take away the
	 * only sentence the portal owes a member whose own request really is broken. The second
	 * half is that sentence, and the last status comparison says the two answers are not the
	 * same one.
	 *
	 * <p>The empty body is asked for the same reason absent and blank are asked of every
	 * field: „no body at all" and „a body that will not parse" are one answer, and both have
	 * to reach the same refusal.
	 */
	@Test
	void aBodyNobodyCanReadIsRefusedAfterWhoIsAskingAndNotBefore() throws Exception {
		String notJson = "{oops";

		MockHttpServletResponse nowhereMalformed =
				sentBy(MODERATOR_WHO_DOES_NOT_RACE, NOTHING_IS_THERE, notJson);
		MockHttpServletResponse nowhereEmpty =
				sentBy(MODERATOR_WHO_DOES_NOT_RACE, NOTHING_IS_THERE, "");

		assertThat(nowhereMalformed.getStatus())
				.as("the address nothing maps did not answer 404 to a malformed body, so"
						+ " comparing the refusal with it says nothing about what the refusal"
						+ " hides")
				.isEqualTo(404);
		assertThat(nowhereEmpty.getStatus())
				.as("the address nothing maps did not answer 404 to an empty body either")
				.isEqualTo(404);

		MockHttpServletResponse toNoMemberMalformed =
				sentBy(MODERATOR_WHO_DOES_NOT_RACE, PATH, notJson);
		MockHttpServletResponse toNoMemberEmpty = sentBy(MODERATOR_WHO_DOES_NOT_RACE, PATH, "");

		assertThat(List.of(toNoMemberMalformed.getStatus(),
				toNoMemberMalformed.getContentAsString()))
				.as("an account naming no member was told something other than what an address"
						+ " mapping nothing answers, so a body the portal cannot parse tells him"
						+ " a PUT lives at this address")
				.isEqualTo(List.of(nowhereMalformed.getStatus(),
						nowhereMalformed.getContentAsString()));
		assertThat(List.of(toNoMemberEmpty.getStatus(), toNoMemberEmpty.getContentAsString()))
				.as("an account naming no member was told something other than what an address"
						+ " mapping nothing answers, for a body carrying nothing at all")
				.isEqualTo(List.of(nowhereEmpty.getStatus(), nowhereEmpty.getContentAsString()));

		MockHttpServletResponse toAMember = sent(HE_CHOOSES, notJson);

		assertThat(toAMember.getStatus())
				.as("a member this address really is for was not told his request is unusable")
				.isEqualTo(400);
		assertThat(reasonIn(toAMember))
				.as("a member whose body could not be read at all was refused for some other"
						+ " reason")
				.isEqualTo(NotificationWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(missingIn(toAMember))
				.as("a member whose body could not be read at all was not told every switch was"
						+ " missing")
				.containsExactlyElementsOf(switchesAsTheFormNamesThem());
		assertThat(toAMember.getStatus())
				.as("the two are one answer, so this route refuses everybody alike and the half"
						+ " above measures nothing")
				.isNotEqualTo(toNoMemberMalformed.getStatus());

		assertThat(rowOf(HE_CHOOSES))
				.as("a body nobody could read moved the row anyway")
				.isEqualTo(WHERE_HE_STARTS);
		assertThat(howManyRows())
				.as("a row was written for an account naming no member, or for a body nobody"
						+ " could read")
				.isEqualTo(3);
	}

	/**
	 * AND A WRITE CARRYING NO {@code Content-Type} IS ANSWERED LIKE AN ADDRESS THAT IS NOT
	 * THERE, WHICH IS WHAT {@code consumes} ON THE MAPPING BUYS.
	 *
	 * <p>Without it the path and the method still match, the request reaches the argument
	 * resolver, and the answer is <b>415</b> - a number that says „this address is here and
	 * wants a different type", while an address mapping nothing goes on saying 404. Declared
	 * on the mapping, the same request never matches at all, the dispatcher raises it from
	 * {@code handleNoMatch}, and {@code NothingIsHereRatherThanAlmost} turns it into the 404
	 * every unmapped address answers.
	 *
	 * <p><b>This case exists because its absence was measured.</b> Taking {@code consumes}
	 * off the mapping left every other case in this file green, and left
	 * {@code RightsAtTheDoorTest}, {@code RightsOverRealHttpTest} and
	 * {@code OpenRoutesStayReadOnlyTest} green too - the sentence was in the javadoc and
	 * nothing held it.
	 *
	 * <p><b>AND ITS FIRST DRAFT MEASURED ITSELF, which was caught the same way.</b> That
	 * draft rested the whole claim on {@code typeless} agreeing with {@code nowhere}, and a
	 * mutation pointing BOTH sides at the real address left it green: the assertion had
	 * become {@code x isEqualTo x}, and nothing else in the case would have noticed. The
	 * claim is now the literal 404 with an empty body, which no partner can satisfy on its
	 * behalf, and the comparison stayed as what it always was - corroboration that this 404
	 * is the same 404 an absent address answers with.
	 *
	 * <p>Signed in, because an unauthenticated caller is refused 401 at both addresses and
	 * the two would then agree for a reason that has nothing to do with this rule. <b>The
	 * anchor is asked LAST, on purpose:</b> a proper write moves the row, and a row moved
	 * before the typeless request is measured would hold the very values that request
	 * carries, so „nothing was written" and „this was written" would be one row.
	 */
	@Test
	void aWriteCarryingNoContentTypeIsAnsweredLikeAnAddressThatIsNotThere() throws Exception {
		MockHttpServletResponse typeless = untyped(HE_CHOOSES, PATH);
		MockHttpServletResponse nowhere = untyped(HE_CHOOSES, NOTHING_IS_THERE);

		/* THE CLAIM IS THIS LITERAL AND NOT THE COMPARISON BELOW IT, which is a correction
		   rather than a preference: written the other way round, with the whole claim resting
		   on `typeless` agreeing with `nowhere`, a mutation that points BOTH sides at the real
		   address left the case green - the assertion had become `x isEqualTo x`. 415 is what
		   a mapping without `consumes` answers here and 404 is what an address mapping nothing
		   answers, so the number itself is the measurement. */
		assertThat(List.of(typeless.getStatus(), typeless.getContentAsString()))
				.as("a write with no Content-Type was told this address is here and wants a"
						+ " different type, which an address that is not there never says")
				.isEqualTo(List.of(404, ""));

		assertThat(nowhere.getStatus())
				.as("an address nothing maps did not answer 404 to a typeless write either, so"
						+ " the 404 above is not what an absent address looks like on this server")
				.isEqualTo(404);

		assertThat(List.of(typeless.getStatus(), typeless.getContentAsString()))
				.as("the two answers are both 404 and still differ, so one of them says"
						+ " something about the address the other does not")
				.isEqualTo(List.of(nowhere.getStatus(), nowhere.getContentAsString()));

		assertThat(rowOf(HE_CHOOSES))
				.as("a request the dispatcher never matched moved the row anyway")
				.isEqualTo(WHERE_HE_STARTS);

		/* AND THE ADDRESS REALLY IS THERE, asked after everything above rather than before
		   it: a route that was simply broken would be missing for everybody, the two answers
		   compared above would be two absent places, and the comparison would hold having
		   measured nothing. */
		assertThat(sent(HE_CHOOSES, body(WHAT_HE_CHOOSES)).getStatus())
				.as("this address does not answer a proper write at all, so comparing a typeless"
						+ " one with a missing address measures nothing")
				.isEqualTo(200);
	}

	/**
	 * HIS OWN SWITCHES MOVE, THE ROW HOLDS WHAT HE SENT, AND HIS NEIGHBOUR'S ROW DOES NOT
	 * MOVE.
	 *
	 * <p>Three claims and not one, because each of them fails to a different fault: the row
	 * read by a plain {@code select} catches a write that did not happen or landed elsewhere;
	 * the answer catches an {@code on conflict do nothing} where an update belongs; and the
	 * neighbour's row catches a statement that resolved the member some way other than off
	 * the session. He is the first row by key, so „the first one" lands on him.
	 *
	 * <p>The edit is asserted to really be a mixture before anything else, so the case cannot
	 * quietly become „he turned everything on" the day somebody edits a constant.
	 */
	@Test
	void hisOwnSwitchesMoveAndHisNeighboursRowDoesNot() throws Exception {
		assertThat(WHAT_HE_CHOOSES)
				.as("what he sends is what he already had, so nothing about this case moves")
				.isNotEqualTo(WHERE_HE_STARTS);
		assertThat(WHAT_HE_CHOOSES.stream().distinct().toList())
				.as("he sends the same value for all six switches, so what was sent and one"
						+ " literal in every column are the same row")
				.hasSize(2);
		assertThat(turnedOn()).as("the edit turns no switch ON, so it measures one direction")
				.isNotEmpty();
		assertThat(turnedOff()).as("the edit turns no switch OFF, so it measures one direction")
				.isNotEmpty();

		MockHttpServletResponse answer = sent(HE_CHOOSES, body(WHAT_HE_CHOOSES));

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(rowOf(HE_CHOOSES))
				.as("the row does not hold what he chose")
				.isEqualTo(WHAT_HE_CHOOSES);

		assertThat(switchesIn(answer))
				.as("the answer does not agree with the row it claims to be about")
				.isEqualTo(WHAT_HE_CHOOSES);

		assertThat(rowOf(ANOTHER_MEMBER))
				.as("one member's choice moved another member's row")
				.isEqualTo(HIS_NEIGHBOURS_ROW);

		assertThat(howManyRowsFor(NEVER_OPENED))
				.as("a row appeared for a member who was never asked about")
				.isZero();
	}

	/**
	 * A MEMBER WHO HAS NEVER OPENED SETTINGS GETS A ROW MADE FOR HIM, WHICH IS NOT AN ERROR.
	 *
	 * <p>V13 gives {@code notification_setting} a primary key and no row of its own, and
	 * {@code default false} is a rule about a COLUMN of a row that exists. So „he has no row"
	 * is the ordinary state and the route has to answer it, which it does with the statement
	 * that also changes one rather than with a branch.
	 *
	 * <p>That he really has no row is asserted FIRST: a default answered for a member who
	 * already had one would prove nothing.
	 */
	@Test
	void aMemberWhoHasNeverOpenedSettingsGetsHisRowMade() throws Exception {
		assertThat(howManyRowsFor(NEVER_OPENED))
				.as("this member already has a row, so making one for him proves nothing")
				.isZero();

		MockHttpServletResponse answer = sent(NEVER_OPENED, body(WHAT_HE_CHOOSES));

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(howManyRowsFor(NEVER_OPENED))
				.as("no row was made for a member who had none")
				.isEqualTo(1);
		assertThat(rowOf(NEVER_OPENED)).isEqualTo(WHAT_HE_CHOOSES);
		assertThat(switchesIn(answer)).isEqualTo(WHAT_HE_CHOOSES);

		assertThat(rowOf(HE_CHOOSES))
				.as("making one member's row moved another member's")
				.isEqualTo(WHERE_HE_STARTS);
	}

	/**
	 * AND CHOOSING SILENCE IS THE SAME ANSWER AS NEVER HAVING BEEN HERE, WHICH IS THE OTHER
	 * DIRECTION OF THE SAME BOUNDARY.
	 *
	 * <p>{@link NotificationApi} answers a member with no row exactly as it answers a row of
	 * six falses - „mejl zamor ubija dostavljivost" does not stop applying to a member for
	 * the sole reason he has not opened the panel. A member who turns everything off must
	 * therefore read back the identical answer he read before he had a row at all, or the
	 * portal would have two ways of saying one thing.
	 */
	@Test
	void chosenSilenceReadsBackAsNeverHavingBeenHere() throws Exception {
		String beforeHeHadARow = http.perform(reading(NEVER_OPENED)).andReturn().getResponse()
				.getContentAsString();

		List<Boolean> everythingOff = switchColumns().stream().map(any -> false).toList();
		MockHttpServletResponse answer = sent(NEVER_OPENED, body(everythingOff));

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(howManyRowsFor(NEVER_OPENED))
				.as("turning everything off wrote no row, so the two readings agree for the"
						+ " wrong reason")
				.isEqualTo(1);

		assertThat(http.perform(reading(NEVER_OPENED)).andReturn().getResponse()
				.getContentAsString())
				.as("a row of silence and no row at all are answered differently")
				.isEqualTo(beforeHeHadARow);
	}

	/**
	 * THE TWO VERBS OF THIS ADDRESS ANSWER ONE SHAPE, BYTE FOR BYTE.
	 *
	 * <p>The write answers {@link NotificationApi.Settings}, the reading half's own record,
	 * so this holds by construction today; it is a case rather than a sentence because the
	 * day somebody gives the write a record of its own, the two are free to part and nothing
	 * else in the suite would notice. What a screen reads off one verb of an address it must
	 * be able to read off the other.
	 */
	@Test
	void theTwoVerbsOfThisAddressAnswerOneShape() throws Exception {
		String written = sent(HE_CHOOSES, body(WHAT_HE_CHOOSES)).getContentAsString();
		String read = http.perform(reading(HE_CHOOSES)).andReturn().getResponse()
				.getContentAsString();

		assertThat(written)
				.as("the write answered nothing at all, so comparing it with the read says"
						+ " nothing")
				.isNotEmpty();
		assertThat(written)
				.as("the two verbs of one address answer two different shapes")
				.isEqualTo(read);
	}

	/**
	 * A SWITCH LEFT OUT IS REFUSED AND NAMED, ONE CASE PER SWITCH THE TABLE HAS.
	 *
	 * <p>ADL A54, 19.09.2026: „`PUT` koji ne posalje neko polje odbija se sa 400, i kaze se
	 * sta fali." Both halves are asked here: the number, and the name of the field the caller
	 * failed to send.
	 *
	 * <p><b>Each one is sent twice, as an explicit null and with the KEY REMOVED, and the two
	 * answers must be identical.</b> Those are two different bodies and the route must not
	 * tell them apart: a {@code @JsonSetter(nulls = Nulls.SKIP)} or a default filled in by a
	 * compact constructor would part them, and the suite would stay green while a form that
	 * omitted a switch silently took a default - which is the exact fault A54 was written
	 * about. The key is checked to have really been there to remove, so a name that is no
	 * longer a field cannot send the same bytes twice and compare nothing.
	 *
	 * <p>And nothing is written by any of it: a refused form that moved the row would be A54
	 * satisfied on paper and broken in the table.
	 */
	@Test
	void everySwitchLeftOutIsRefusedAndNamedAndNothingIsWritten() throws Exception {
		List<String> switches = switchesAsTheFormNamesThem();

		assertThat(switches)
				.as("the catalogue names no switch at all, so this case drives nothing")
				.isNotEmpty();

		for (String one : switches) {
			MockHttpServletResponse nulled = sent(HE_CHOOSES, bodyWithNull(one));
			MockHttpServletResponse absent = sent(HE_CHOOSES, bodyWithout(one));

			assertThat(absent.getStatus())
					.as("a form that does not send %s at all was not refused", one)
					.isEqualTo(400);
			assertThat(reasonIn(absent))
					.as("a form missing %s was refused for some other reason", one)
					.isEqualTo(NotificationWriteApi.THE_FORM_IS_NOT_COMPLETE);
			assertThat(missingIn(absent))
					.as("a form missing %s did not say that is what was missing", one)
					.containsExactly(one);

			assertThat(List.of(nulled.getStatus(), nulled.getContentAsString()))
					.as("`\"%s\": null` and a body with no `%s` at all are answered differently,"
							+ " so the two shapes have parted and only one is measured", one, one)
					.isEqualTo(List.of(absent.getStatus(), absent.getContentAsString()));

			assertThat(rowOf(HE_CHOOSES))
					.as("a form refused for missing %s moved the row anyway", one)
					.isEqualTo(WHERE_HE_STARTS);
		}
	}

	/**
	 * AND A FORM THAT NAMES NO SWITCH AT ALL IS TOLD ABOUT EVERY ONE OF THEM, IN THE ORDER
	 * THE TABLE CARRIES THEM.
	 *
	 * <p>The case above sends five of six and could be satisfied by a route that stopped at
	 * the first thing it found missing. This one asks for the whole list, and it compares it
	 * with the catalogue in ordinal order, so the order the six are named in is the table's
	 * own rather than one somebody chose.
	 */
	@Test
	void aFormThatNamesNoSwitchAtAllIsToldAboutEveryOne() throws Exception {
		MockHttpServletResponse refused = sent(HE_CHOOSES, "{}");

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(missingIn(refused))
				.as("an empty form was not told about every switch, in the table's own order")
				.containsExactlyElementsOf(switchesAsTheFormNamesThem());
		assertThat(rowOf(HE_CHOOSES)).isEqualTo(WHERE_HE_STARTS);
	}

	/**
	 * FLIPPING ONE SWITCH MOVES THAT COLUMN AND NO OTHER, ONE CASE PER SWITCH THE TABLE HAS.
	 *
	 * <p><b>This is the half of the floor that is about BEHAVIOUR rather than about names.</b>
	 * The case below it compares three sets of names, which catches a column that arrives or
	 * a field that goes; this catches a column that is named everywhere and written into the
	 * wrong place - two switches swapped, one ignored, one wired to its neighbour. Every
	 * other case in this file sends a body that changes several switches at once, and a route
	 * that wrote the whole mixture into a column of its own choosing would satisfy them all
	 * as long as the mixture came out right in the end.
	 *
	 * <p>Each turn starts from a known row, sends that row with EXACTLY ONE value flipped,
	 * and then asserts all six: the one that had to move, and the five that had to stay.
	 */
	@Test
	void flippingOneSwitchMovesThatColumnAndNoOther() throws Exception {
		List<String> switches = switchesAsTheFormNamesThem();

		assertThat(switches)
				.as("the catalogue names no switch at all, so this case drives nothing")
				.isNotEmpty();

		for (int seat = 0; seat < switches.size(); seat++) {
			row(HE_CHOOSES, WHERE_HE_STARTS);

			List<Boolean> flipped = new ArrayList<>(WHERE_HE_STARTS);
			flipped.set(seat, !WHERE_HE_STARTS.get(seat));

			MockHttpServletResponse answer = sent(HE_CHOOSES, body(flipped));

			assertThat(answer.getStatus())
					.as("flipping %s alone was refused", switches.get(seat))
					.isEqualTo(200);
			assertThat(rowOf(HE_CHOOSES))
					.as("flipping %s alone did not leave the row with that one switch moved and"
							+ " the other five where they were", switches.get(seat))
					.isEqualTo(flipped);
			assertThat(switchesIn(answer))
					.as("the answer after flipping %s does not agree with the row",
							switches.get(seat))
					.isEqualTo(flipped);
			assertThat(rowOf(ANOTHER_MEMBER))
					.as("flipping %s moved another member's row", switches.get(seat))
					.isEqualTo(HIS_NEIGHBOURS_ROW);
		}
	}

	/**
	 * THE SWITCHES THIS ROUTE WRITES ARE THE TABLE'S OWN SWITCH COLUMNS, AND SO ARE THE ONES
	 * THE READING HALF ANSWERS.
	 *
	 * <p><b>This is the floor the increment turns on, and it is asked of the CATALOGUE rather
	 * than of a list written here.</b> PDL P22 draws a hard line - „Uvek mejl, bez
	 * iskljucivanja: onih sest" against „Zvono uvek, mejl podrazumevano ISKLJUCEN, clan ga sam
	 * pali: sve drustveno i sporedno" - and V13 turned the second half into six columns,
	 * saying why there is no seventh: „A seventh switch is a migration rather than a row
	 * somebody typed", and of the mandatory six, „a column for them would be a promise the
	 * portal must refuse to keep." A column added to this table tomorrow for one of those six
	 * would overturn the owner's decision, and this is what stops it doing so quietly.
	 *
	 * <p><b>Three sources and no list.</b> The columns of {@code notification_setting} that
	 * are not part of its primary key, read out of {@code information_schema}; the components
	 * of {@link NotificationWriteApi.Switches}, which is what this route accepts; and the
	 * components of {@link NotificationApi.Settings}, which is what the reading half has
	 * answered since before this increment. The order is compared too, because the order the
	 * missing switches are named in is the record's.
	 *
	 * <p><b>WHAT THIS FLOOR DOES NOT PROMISE, written down rather than left to be found.</b>
	 * It cannot say that a column arriving tomorrow is not one of P22's six MANDATORY mails,
	 * because which six those are lives in {@code PDL.md}, which is deliberately outside this
	 * repository - the journals hold operating detail and the repository is public. What it
	 * does promise is that such a column cannot arrive SILENTLY: the build fails the day it is
	 * added, on this case and on the two above it, and somebody has to decide what it is
	 * before anything will compile green. That is the difference between a decision being
	 * overturned and a decision being overturned unnoticed, and it is the whole of what a
	 * floor in this repository can buy here.
	 */
	@Test
	void theSwitchesAreTheTablesOwnColumnsInAllThreePlaces() {
		List<String> fromTheTable = switchesAsTheFormNamesThem();

		assertThat(fromTheTable)
				.as("the catalogue answered with no switch columns, so both comparisons below"
						+ " are against an empty list and hold about nothing")
				.isNotEmpty();

		assertThat(componentsOf(NotificationWriteApi.Switches.class))
				.as("what this route accepts is no longer the set of switches the table has,"
						+ " in the table's own order")
				.containsExactlyElementsOf(fromTheTable);

		assertThat(componentsOf(NotificationApi.Settings.class))
				.as("what the reading half of this address answers is no longer the set of"
						+ " switches the table has, in the table's own order")
				.containsExactlyElementsOf(fromTheTable);
	}

	/**
	 * A MEMBER WHOSE FEE HAS LAPSED CHOOSES HIS OWN MAIL TOO, AND THE BOUNDARY IN THE OTHER
	 * DIRECTION IS MEASURED IN THE SAME CASE.
	 *
	 * <p>This route deliberately does not ask {@code competitor.active}, which is derived
	 * rather than dictated and is argued at the top of {@link NotificationWriteApi}: the
	 * reading half does not ask it either, so refusing here would leave him a panel he can
	 * read and cannot save; PDL's rule of 13.09.2026 is about a PUBLIC answer NAMING such a
	 * member, and this resource names nobody; and the two writing routes that DO ask it ask
	 * it about the other person, of whom there is none here.
	 *
	 * <p><b>Both sides, because a route that refused nobody would satisfy the first half
	 * alone.</b> He is answered exactly as an active member is, AND an account that names no
	 * member is still refused at the same address with the same body - so the line this route
	 * draws is „is there a member behind this account", and it is not drawn anywhere else.
	 */
	@Test
	void aMemberWhoseFeeHasLapsedChoosesHisOwnMailAndAnAccountWithNoMemberStillCannot()
			throws Exception {

		assertThat(db.sql("select active from competitor where member_number = ?")
						.param(LAPSED).query(Boolean.class).single())
				.as("this member has not lapsed at all, so the case measures an ordinary member")
				.isFalse();

		MockHttpServletResponse lapsed = sent(LAPSED, body(WHAT_HE_CHOOSES));
		MockHttpServletResponse active = sent(HE_CHOOSES, body(WHAT_HE_CHOOSES));

		assertThat(lapsed.getStatus())
				.as("a member whose fee has lapsed is answered differently from one whose has"
						+ " not, at an address that names nobody")
				.isEqualTo(active.getStatus());
		assertThat(rowOf(LAPSED))
				.as("a member whose fee has lapsed was answered 200 and his row did not move")
				.isEqualTo(WHAT_HE_CHOOSES);
		assertThat(WHAT_HE_CHOOSES)
				.as("he was already holding this, so his row moving proves nothing")
				.isNotEqualTo(WHERE_THE_LAPSED_ONE_STARTS);

		assertThat(sentBy(MODERATOR_WHO_DOES_NOT_RACE, PATH, body(WHAT_HE_CHOOSES)).getStatus())
				.as("an account that names no member was served this address too, so the route"
						+ " refuses nobody and the half above says nothing")
				.isEqualTo(404);
	}

	/* ------------------------------------------------------------------ the catalogue */

	/**
	 * THE SWITCHES, AS THE TABLE HAS THEM: every column of {@code notification_setting} that
	 * is not part of its primary key, in the order V13 declares them.
	 *
	 * <p>The primary key is asked for rather than named, so „which column is not a switch" is
	 * the catalogue's answer and not this file's. A table that gained a second key column
	 * tomorrow would drop it here without anybody editing a list.
	 */
	private List<String> switchColumns() {
		return db.sql("select c.column_name from information_schema.columns c"
						+ " where c.table_schema = current_schema()"
						+ "   and c.table_name = 'notification_setting'"
						+ "   and c.column_name not in ("
						+ "        select k.column_name from information_schema.table_constraints t"
						+ "          join information_schema.key_column_usage k"
						+ "            on k.constraint_name = t.constraint_name"
						+ "           and k.table_schema = t.table_schema"
						+ "         where t.table_schema = current_schema()"
						+ "           and t.table_name = 'notification_setting'"
						+ "           and t.constraint_type = 'PRIMARY KEY')"
						+ " order by c.ordinal_position")
				.query(String.class)
				.list();
	}

	/** The same switches under the names JSON uses, which is the column name in camel case. */
	private List<String> switchesAsTheFormNamesThem() {
		return switchColumns().stream().map(NotificationWriteApiTest::asTheFormNamesIt).toList();
	}

	/**
	 * {@code comment_mail} to {@code commentMail}, by a rule rather than by a table.
	 *
	 * <p>A map from column to field would be a second list needing its own floor, which is
	 * the thing this whole file is written to avoid.
	 */
	private static String asTheFormNamesIt(String column) {
		String[] parts = column.split("_");
		StringBuilder name = new StringBuilder(parts[0]);

		for (int next = 1; next < parts.length; next++) {
			name.append(Character.toUpperCase(parts[next].charAt(0)))
					.append(parts[next].substring(1));
		}

		return name.toString();
	}

	/** The names in one record, which is what a body is read and written by. */
	private static List<String> componentsOf(Class<?> record) {
		return Arrays.stream(record.getRecordComponents()).map(RecordComponent::getName).toList();
	}

	/* ------------------------------------------------------------------- the fixture */

	private void competitor(String number, String first, String last, boolean active) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, active, String.format("%016x", ++issued))
				.update();
	}

	private void account(String email, String role, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		if (memberNumber != null) {
			db.sql("update account set competitor_id ="
							+ " (select id from competitor where member_number = ?) where email = ?")
					.params(memberNumber, email).update();
		}

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** A row of switches for one member, written or rewritten by key. */
	private void row(String memberNumber, List<Boolean> switches) {
		db.sql("insert into notification_setting (competitor_id, comment_mail, team_mail,"
						+ " pair_mail, lift_mail, badge_mail, inbox_mail) values"
						+ " ((select id from competitor where member_number = ?), ?, ?, ?, ?, ?, ?)"
						+ " on conflict (competitor_id) do update set"
						+ " comment_mail = excluded.comment_mail, team_mail = excluded.team_mail,"
						+ " pair_mail = excluded.pair_mail, lift_mail = excluded.lift_mail,"
						+ " badge_mail = excluded.badge_mail, inbox_mail = excluded.inbox_mail")
				.params(memberNumber, switches.get(0), switches.get(1), switches.get(2),
						switches.get(3), switches.get(4), switches.get(5))
				.update();
	}

	/* ------------------------------------------------------------------- the requests */

	private String body(List<Boolean> switches) {
		return completeBody(switches).toString();
	}

	private ObjectNode completeBody(List<Boolean> switches) {
		ObjectNode body = mapper.createObjectNode();
		List<String> named = switchesAsTheFormNamesThem();

		for (int seat = 0; seat < named.size(); seat++) {
			body.put(named.get(seat), switches.get(seat));
		}

		return body;
	}

	/** A complete form with one switch sent as an explicit JSON null. */
	private String bodyWithNull(String field) {
		ObjectNode body = completeBody(WHAT_HE_CHOOSES);

		assertThat(body.has(field))
				.as("a complete form carries no %s, so nulling it changes nothing", field)
				.isTrue();

		return body.putNull(field).toString();
	}

	/** The same form with the KEY taken out, rather than set to null. */
	private String bodyWithout(String field) {
		ObjectNode body = completeBody(WHAT_HE_CHOOSES);

		assertThat(body.remove(field))
				.as("a complete form carries no key called %s, so this would send the same bytes"
						+ " twice and compare nothing", field)
				.isNotNull();

		return body.toString();
	}

	private MockHttpServletResponse sent(String memberNumber, String body) throws Exception {
		return sentBy(memberNumber == null ? null : memberNumber + "@primer.rs", PATH, body);
	}

	/**
	 * @param email the session to send it with, or null for somebody who has none - which is
	 *              not the same request with an empty list of cookies but a request with no
	 *              cookie header at all, the way a browser that has never signed in sends one
	 */
	private MockHttpServletResponse sentBy(String email, String path, String body)
			throws Exception {

		MockHttpServletRequestBuilder asking = put(path).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(body);

		return http.perform(email == null ? asking
						: asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}

	/**
	 * The same write with a body and NO {@code Content-Type} at all, which is not the same
	 * request with an empty type but a request whose header is absent.
	 */
	private MockHttpServletResponse untyped(String memberNumber, String path) throws Exception {
		return http.perform(put(path).with(csrf()).content(body(WHAT_HE_CHOOSES))
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(memberNumber + "@primer.rs").secret())))
				.andReturn().getResponse();
	}

	private MockHttpServletRequestBuilder reading(String memberNumber) {
		return get(PATH).cookie(new Cookie(SessionCookie.NAME,
				sessions.get(memberNumber + "@primer.rs").secret()));
	}

	/* -------------------------------------------------------------------- the answers */

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	private List<String> missingIn(MockHttpServletResponse answer) throws Exception {
		List<String> named = new ArrayList<>();
		mapper.readTree(answer.getContentAsString()).path("missing")
				.forEach(one -> named.add(one.asString()));
		return named;
	}

	/** The six switches out of an answer, in the order the table carries them. */
	private List<Boolean> switchesIn(MockHttpServletResponse answer) throws Exception {
		JsonNode body = mapper.readTree(answer.getContentAsString());

		return switchesAsTheFormNamesThem().stream().map(one -> {
			assertThat(body.has(one))
					.as("the answer carries no %s at all, so reading it as false says nothing",
							one)
					.isTrue();
			return body.path(one).asBoolean();
		}).toList();
	}

	/* ----------------------------------------------------------------------- the table */

	/** One member's row, in the order the table carries its switches. */
	private List<Boolean> rowOf(String memberNumber) {
		return switchColumns().stream()
				.map(column -> db.sql("select " + column + " from notification_setting"
								+ " where competitor_id ="
								+ " (select id from competitor where member_number = ?)")
						.param(memberNumber).query(Boolean.class).single())
				.toList();
	}

	private int howManyRows() {
		return db.sql("select count(*) from notification_setting").query(Integer.class).single();
	}

	private int howManyRowsFor(String memberNumber) {
		return db.sql("select count(*) from notification_setting where competitor_id ="
						+ " (select id from competitor where member_number = ?)")
				.param(memberNumber).query(Integer.class).single();
	}

	/** The seats whose value this edit turns ON, which the main case demands not be empty. */
	private static List<Integer> turnedOn() {
		return seatsWhere(true);
	}

	/** And the seats it turns OFF. */
	private static List<Integer> turnedOff() {
		return seatsWhere(false);
	}

	private static List<Integer> seatsWhere(boolean to) {
		List<Integer> seats = new ArrayList<>();

		for (int seat = 0; seat < WHAT_HE_CHOOSES.size(); seat++) {
			if (WHAT_HE_CHOOSES.get(seat) == to && WHERE_HE_STARTS.get(seat) != to) {
				seats.add(seat);
			}
		}

		return seats;
	}
}

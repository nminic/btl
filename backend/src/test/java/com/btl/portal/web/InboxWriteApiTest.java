package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
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

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * POST /api/inbox: ONE MEMBER WRITING TO ONE OTHER, AND TO NOBODY ELSE AT ALL.
 *
 * <p><b>FIVE MEMBERS, AND THE SENDER AND THE ADDRESSEE ARE NEITHER OF THEM THE FIRST ROW
 * OF ANYTHING.</b> {@link #A_STRANGER} is written first so he holds the lowest key in
 * {@code competitor} and the first row of {@code account}; he takes part in nothing below
 * and must see nothing. A query writing {@code to_id} or {@code from_id} off
 * {@code min(id)} therefore names him and fails, and one reading the asking account off
 * „the first session" does too. {@link #LAPSED} and {@link #HIDDEN} are the two states the
 * portal treats oppositely and which a single condition would confuse.
 *
 * <p><b>THE THIRD MEMBER IS NEVER EMPTY-HANDED.</b> „His inbox does not carry it" is
 * satisfied by an inbox with nothing in it, so {@link #A_STRANGER} has a message of his own
 * and a broadcast before this route writes anything, and the case that asks about him says
 * both halves: what he does hold, and what he does not.
 *
 * <p><b>THREE MESSAGES EXIST BEFORE ANY CASE RUNS, AND ONE OF THEM IS A BROADCAST.</b>
 * Nothing this route writes is ever the only row in {@code message}, so a count that goes
 * from nought to one cannot pass for a measurement; and the broadcast is what makes
 * „no message to the whole league was written" a comparison rather than a tautology. All
 * three carry fixed days in July, which is neither the day this suite runs nor the moment
 * the route writes.
 *
 * <p><b>AND EVERY ACCOUNT IS NAMED DIFFERENTLY FROM THE MEMBER BEHIND IT.</b>
 * {@code message.from_name} could be read off either table and the two say different things
 * on purpose, so the case about the sender's name measures WHICH of the two a row carries
 * rather than merely that it carries a name.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class InboxWriteApiTest {

	private static final String PATH = "/api/inbox";

	/**
	 * An address of THE SAME LENGTH that maps nothing, for a refusal to be compared with.
	 *
	 * <p>The length matters because the error document carries the path that was asked for,
	 * so two addresses of different lengths differ by a number that says nothing about
	 * whether either of them exists ({@code RightsOverRealHttpTest}, 13.09.2026). The
	 * byte-for-byte half of that comparison is that file's, off a real socket; what is asked
	 * here is what MockMvc can answer, which is the status and whether there is a body.
	 */
	private static final String NOTHING_IS_THERE = "/api/zzzzz";

	/** First by key in {@code competitor} and in {@code account}, and party to nothing. */
	private static final String A_STRANGER = "000011";

	private static final String RECIPIENT = "000022";

	private static final String SENDER = "000033";

	/** A member whose fee has lapsed: {@code active} is false, so the portal shows him nowhere. */
	private static final String LAPSED = "000044";

	/** Hidden from a VISITOR and shown to a signed in reader ({@code visible.ts}). */
	private static final String HIDDEN = "000055";

	/** A member number of the right shape that belongs to nobody. */
	private static final String NOBODY_HAS_THIS = "000099";

	private static final String STRANGER_SIGNS_IN = "stranac@primer.rs";

	private static final String RECIPIENT_SIGNS_IN = "prima@primer.rs";

	private static final String SENDER_SIGNS_IN = "salje@primer.rs";

	/** Signed in and holding no member behind the account at all - a moderator who does not race. */
	private static final String NO_MEMBER = "mod@primer.rs";

	private static final String TO_THE_STRANGER = "Sta je treca clanica vec imala";

	private static final String ALREADY_HIS = "Sta je primalac vec imao";

	private static final String A_BROADCAST = "Sta je liga rekla svima";

	private static final String A_TITLE = "Prevoz do Zlatibora";

	private static final String A_TEXT = "Krecem u petak u sest, ima mesta za dvoje.";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/** The application's own mapper, so a request is built the way one really arrives. */
	@Autowired
	private ObjectMapper mapper;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	private int bodies = 1;

	@BeforeEach
	void fiveMembersThreeAccountsAndThreeMessages() {
		competitor(A_STRANGER, "Ana", "Prva", true, false);
		competitor(RECIPIENT, "Bojana", "Druga", true, false);
		competitor(SENDER, "Vesna", "Treca", true, false);
		competitor(LAPSED, "Gordana", "Cetvrta", false, false);
		competitor(HIDDEN, "Dunja", "Peta", true, true);

		/* THE NAME ON THE ACCOUNT IS NEVER THE NAME ON THE MEMBER. Both tables carry a
		   first and a last name and nothing makes them agree, so `from_name` read off the
		   wrong one is a value this fixture can see. */
		account(STRANGER_SIGNS_IN, "competitor", "Nalog", "Strancev");
		belongsTo(STRANGER_SIGNS_IN, A_STRANGER);
		account(RECIPIENT_SIGNS_IN, "competitor", "Nalog", "Primaocev");
		belongsTo(RECIPIENT_SIGNS_IN, RECIPIENT);
		account(SENDER_SIGNS_IN, "competitor", "Nalog", "Posiljaocev");
		belongsTo(SENDER_SIGNS_IN, SENDER);
		account(NO_MEMBER, "moderator", "Nikad", "Clan");

		message(TO_THE_STRANGER, A_STRANGER, "2026-07-11 09:00:00+00");
		message(ALREADY_HIS, RECIPIENT, "2026-07-03 09:00:00+00");
		message(A_BROADCAST, null, "2026-07-22 09:00:00+00");
	}

	private void competitor(String number, String first, String last, boolean active,
			boolean hidden) {

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01', (select id from place where rank = 1),"
						+ " 2027, false, ?, 'payment', ?, '', ?, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, active, String.format("%016x", ++issued), hidden)
				.update();
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

	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}

	/** @param toNumber who it is for, or {@code null} for the whole league */
	private void message(String subject, String toNumber, String sentAt) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body, sent_at) values"
						+ " ((select id from competitor where member_number = ?), null, 'Portal',"
						+ " ?, ?, timestamptz '" + sentAt + "')")
				.params(toNumber, subject, "Telo " + (bodies++) + ", i ono nije naslov.")
				.update();
	}

	private long keyOf(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	private long broadcasts() {
		return db.sql("select count(*) from message where to_id is null").query(Long.class).single();
	}

	private long messages() {
		return db.sql("select count(*) from message").query(Long.class).single();
	}

	/** One written row, read back out of the database and never off what was sent. */
	private Map<String, Object> rowOf(long message) {
		return db.sql("select * from message where id = ?").param(message).query().singleRow();
	}

	private String written(String to, String subject, String body) {
		return mapper.writeValueAsString(new InboxWriteApi.Written(to, subject, body));
	}

	private MockHttpServletResponse writing(String email, String json) throws Exception {
		MockHttpServletRequestBuilder asking = post(PATH).with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(json);

		if (email != null) {
			asking = asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
		}

		return http.perform(asking).andReturn().getResponse();
	}

	private MockHttpServletResponse writing(String email, String to, String subject, String body)
			throws Exception {
		return writing(email, written(to, subject, body));
	}

	/** The key of the message a 201 says it wrote. */
	private long idIn(MockHttpServletResponse answer) throws Exception {
		assertThat(answer.getStatus())
				.as("the message was not written at all, so there is no row to read: %s",
						answer.getContentAsString())
				.isEqualTo(201);

		return mapper.readTree(answer.getContentAsString()).path("id").asLong();
	}

	/** What the READING half of this same path serves somebody, which is where a message ends. */
	private MockHttpServletResponse reading(String email) throws Exception {
		return http.perform(get(PATH)
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}

	private List<String> inboxOf(String email) throws Exception {
		List<String> subjects = new ArrayList<>();
		for (JsonNode one : mapper.readTree(reading(email).getContentAsString())) {
			subjects.add(one.path("subject").asString());
		}
		return subjects;
	}

	/**
	 * A VISITOR WHO IS NOT SIGNED IN IS ASKED TO SIGN IN, AND A MEMBER IS SERVED.
	 *
	 * <p>The token is carried on purpose: {@code CsrfFilter} stands in front of
	 * {@code AuthorizationFilter}, so a {@code POST} without one is answered 403 before
	 * anything has decided who is asking - and this case would then pass on a 403 with the
	 * door behind it wide open, which is the trap {@code RightsAtTheDoorTest} writes down.
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsRefusedAndAMemberIsNot() throws Exception {
		assertThat(writing(null, RECIPIENT, A_TITLE, A_TEXT).getStatus()).isEqualTo(401);
		assertThat(writing(SENDER_SIGNS_IN, RECIPIENT, A_TITLE, A_TEXT).getStatus()).isEqualTo(201);
	}

	/**
	 * AN ACCOUNT WITH NO MEMBER BEHIND IT IS TOLD THE ADDRESS IS NOT THERE, IN THE SAME
	 * WORDS THE READING HALF USES.
	 *
	 * <p>V23 lets {@code account.competitor_id} be null for „a moderator who does not race,
	 * which is the ordinary case and not a fault", and {@code message.from_id} points at
	 * {@code competitor}: there is nobody to send from. The refusal is compared with an
	 * address that maps nothing rather than with the number 404, because the whole point is
	 * that he cannot tell this address from one that is not there - and it is compared with
	 * what the {@code GET} on this same path answers him, because a difference between the
	 * two verbs would say that writing lives here.
	 */
	@Test
	void anAccountWithNoMemberBehindItIsToldTheAddressIsNotThere() throws Exception {
		MockHttpServletResponse refused = writing(NO_MEMBER, RECIPIENT, A_TITLE, A_TEXT);

		MockHttpServletResponse nothingIsThere = http.perform(post(NOTHING_IS_THERE).with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content("{}")
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(NO_MEMBER).secret())))
				.andReturn().getResponse();

		assertThat(refused.getStatus())
				.as("an account naming no member wrote a message, or was told this address exists")
				.isEqualTo(nothingIsThere.getStatus());
		assertThat(refused.getContentAsString())
				.as("the refusal carried a body, which an address that is not there would not have")
				.isEqualTo(nothingIsThere.getContentAsString())
				.isEmpty();

		/* AND IT IS THE SAME REFUSAL THE READING HALF GIVES HIM. The two verbs share a
		   path, so a member-less account that could tell them apart would learn from the
		   difference that writing lives at an address the portal never offered him. */
		assertThat(refused.getStatus())
				.as("the two verbs of this one path refuse the same account differently")
				.isEqualTo(reading(NO_MEMBER).getStatus());

		assertThat(messages())
				.as("a message was written for an account that names no member")
				.isEqualTo(3);
	}

	/**
	 * IT LANDS IN HIS INBOX, AND IN NOBODY ELSE'S - NOT THE SENDER'S AND NOT A THIRD
	 * MEMBER'S.
	 *
	 * <p><b>This case is the one the repository's own finding about this table is about.</b>
	 * „Sanduce propusta i {@code to === ''} (cela liga), pa poruka adresirana na sve
	 * zadovoljava tvrdnju „clan je obavesten" isto kao ona adresirana na njega... a svaki
	 * clan portala cita tudju odluku." So it is not enough that the addressee has it: the
	 * third member must NOT, and his inbox must not be empty while it says so.
	 *
	 * <p>The row itself is read out of the database by the key the answer carries, never off
	 * what was sent, and both pointers are compared with the database's own keys.
	 */
	@Test
	void theMessageLandsInHisInboxAndInNobodyElses() throws Exception {
		long written = idIn(writing(SENDER_SIGNS_IN, RECIPIENT, A_TITLE, A_TEXT));

		assertThat(inboxOf(RECIPIENT_SIGNS_IN))
				.as("what was written to him did not reach his inbox")
				.contains(A_TITLE);

		assertThat(inboxOf(SENDER_SIGNS_IN))
				.as("the sender was served his own outgoing message, which is not addressed to him")
				.doesNotContain(A_TITLE);

		assertThat(inboxOf(STRANGER_SIGNS_IN))
				.as("a member who is party to nothing has an empty inbox, so „he does not see it\""
						+ " below is satisfied by there being nothing to see")
				.contains(TO_THE_STRANGER, A_BROADCAST)
				.as("a message between two other members reached a third one")
				.doesNotContain(A_TITLE);

		Map<String, Object> row = rowOf(written);

		assertThat(row.get("to_id"))
				.as("the message was not addressed to the member it names")
				.isEqualTo(keyOf(RECIPIENT));
		assertThat(row.get("from_id"))
				.as("the message was not sent by the member who is asking")
				.isEqualTo(keyOf(SENDER));
	}

	/**
	 * NO MEMBER CAN WRITE TO THE WHOLE LEAGUE, WHATEVER SHAPE „NOBODY IN PARTICULAR" TAKES.
	 *
	 * <p>V13 makes the league the ABSENCE of an addressee, and PDL P18 says a member's
	 * messages are „privatne poruke izmedju clanova". So an empty addressee is a field
	 * nobody filled in, and the proof is not that the request is refused - it is that the
	 * number of messages with no addressee did not move. There is a broadcast in the fixture
	 * already, so that number is one and not nought and a route writing a second one would
	 * be seen.
	 */
	@ParameterizedTest
	@NullSource
	@ValueSource(strings = {"", "   "})
	void nobodyWritesToTheWholeLeague(String toNobodyInParticular) throws Exception {
		MockHttpServletResponse refused =
				writing(SENDER_SIGNS_IN, toNobodyInParticular, A_TITLE, A_TEXT);

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(refused.getContentAsString()).contains(InboxWriteApi.THE_FORM_IS_NOT_COMPLETE);

		assertThat(broadcasts())
				.as("a member addressed the whole league, so every member of the portal now reads"
						+ " what was written to one of them")
				.isEqualTo(1);
		assertThat(messages()).as("something was written anyway").isEqualTo(3);
	}

	/** AND A TITLE NOBODY FILLED IN IS THE SAME ANSWER, which is what V13 refuses blank. */
	@ParameterizedTest
	@NullSource
	@ValueSource(strings = {"", "   "})
	void aTitleNobodyFilledInIsRefused(String noTitle) throws Exception {
		MockHttpServletResponse refused = writing(SENDER_SIGNS_IN, RECIPIENT, noTitle, A_TEXT);

		assertThat(refused.getStatus()).isEqualTo(400);
		assertThat(refused.getContentAsString()).contains(InboxWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(messages()).as("a message with no title was written").isEqualTo(3);
	}

	/**
	 * A MEMBER THE PORTAL DOES NOT SHOW AND A NUMBER NOBODY HAS ARE ONE ANSWER, BYTE FOR
	 * BYTE.
	 *
	 * <p>PDL P11: „Ako skriven profil vodi na naslovnu a nepostojeci kaze „nije pronadjen",
	 * posetilac po razlici saznaje koji brojevi pripadaju skrivenim clanovima, sto je upravo
	 * ono sto se krije. Oba slucaja dobijaju isti ishod." {@link #LAPSED} is a real row with
	 * a real number whose membership has ended; {@link #NOBODY_HAS_THIS} is a number of the
	 * same shape that names nothing. Told apart by so much as a different reason, this route
	 * is a way of reading which numbers belong to members who have lapsed.
	 */
	@Test
	void aMemberThePortalDoesNotShowAnswersExactlyAsANumberNobodyHas() throws Exception {
		MockHttpServletResponse toNobody = writing(SENDER_SIGNS_IN, NOBODY_HAS_THIS, A_TITLE, A_TEXT);
		MockHttpServletResponse toTheLapsed = writing(SENDER_SIGNS_IN, LAPSED, A_TITLE, A_TEXT);

		assertThat(toTheLapsed.getStatus())
				.as("a member whose membership has lapsed is refused differently from a number"
						+ " nobody has, so the difference says which numbers are his")
				.isEqualTo(toNobody.getStatus());
		assertThat(toTheLapsed.getContentAsString())
				.isEqualTo(toNobody.getContentAsString());

		assertThat(toNobody.getStatus()).isEqualTo(400);
		assertThat(toNobody.getContentAsString()).contains(InboxWriteApi.THE_MEMBER_IS_NOT_KNOWN);

		assertThat(messages())
				.as("a message was written to somebody the portal does not show")
				.isEqualTo(3);
	}

	/**
	 * AND A MEMBER HIDDEN FROM VISITORS IS NOT THAT, WHICH IS THE OTHER SIDE OF THE SAME
	 * RULE.
	 *
	 * <p>{@code pages/profile/visible.ts}: {@code active && !(profileHidden && reader ===
	 * null)}. Whoever reaches this route is signed in, so a hidden profile is one he sees
	 * and one he may write to. Read as a single „is he hidden" the two members below give
	 * one answer, and this case is what tells them apart.
	 */
	@Test
	void aMemberHiddenFromVisitorsMayStillBeWrittenTo() throws Exception {
		long written = idIn(writing(SENDER_SIGNS_IN, HIDDEN, A_TITLE, A_TEXT));

		assertThat(rowOf(written).get("to_id"))
				.as("a member hidden from visitors but shown to a signed in reader could not be"
						+ " written to, so `profile_hidden` is being read as `active`")
				.isEqualTo(keyOf(HIDDEN));
	}

	/**
	 * THE SENDER'S NAME IS THE ONE THE LEAGUE KNOWS HIM BY, NOT THE ONE ON HIS MAILBOX AND
	 * NOT ONE HE CHOSE.
	 *
	 * <p>V13 keeps {@code from_name} because „the member may ask to be deleted (PDL P23) and
	 * what he wrote does not go with him. The pointer empties, the name does not." There are
	 * three places that value could come from - the request, {@code account}, and
	 * {@code competitor} - and this fixture makes all three different so the row can say
	 * which one it holds. The request carries no field for it at all, which the last
	 * assertion is about: Jackson drops a name nothing is declared for, so a route that
	 * started taking one would have to declare it.
	 */
	@Test
	void theSenderIsNamedByHisMemberRecordAndNotByHisAccount() throws Exception {
		long written = idIn(writing(SENDER_SIGNS_IN,
				"{\"to\":\"" + RECIPIENT + "\",\"subject\":\"" + A_TITLE + "\",\"body\":\""
						+ A_TEXT + "\",\"from\":\"Neko Sasvim Drugi\"}"));

		assertThat(rowOf(written).get("from_name"))
				.as("the message does not carry the name the league knows the sender by")
				.isEqualTo("Vesna Treca");

		assertThat(db.sql("select first_name || ' ' || last_name from account where email = ?")
						.param(SENDER_SIGNS_IN).query(String.class).single())
				.as("the account and the member are named alike, so this case cannot tell which"
						+ " of the two the row was read from")
				.isNotEqualTo("Vesna Treca");
	}

	/**
	 * THE TITLE IS STRIPPED ON THE WAY IN AND THE ANSWER CARRIES THE ROW'S OWN.
	 *
	 * <p>This is the case a trivially satisfied assertion would pass: an answer echoing
	 * {@code typed.subject()} back agrees with the request on every request that worked, and
	 * says nothing about whether a row exists or what is in it. A title sent with spaces
	 * around it is what tells the echo from the row - the two are different values on
	 * purpose - and the key is compared with the database's own for that title rather than
	 * trusted.
	 */
	@Test
	void theAnswerIsReadBackOutOfTheRowAndNotOffTheRequest() throws Exception {
		String padded = "   " + A_TITLE + "   ";
		MockHttpServletResponse answer = writing(SENDER_SIGNS_IN, RECIPIENT, padded, A_TEXT);
		JsonNode said = new ObjectMapper().readTree(answer.getContentAsString());

		assertThat(said.path("subject").asString())
				.as("the answer handed back what was sent rather than what was stored")
				.isEqualTo(A_TITLE)
				.isNotEqualTo(padded);

		assertThat(said.path("id").asLong())
				.as("the answer does not carry the key of the row it wrote")
				.isEqualTo(db.sql("select id from message where subject = ?").param(A_TITLE)
						.query(Long.class).single());

		assertThat(rowOf(said.path("id").asLong()).get("body"))
				.as("the text of the message is not the one that was sent")
				.isEqualTo(A_TEXT);
	}

	/**
	 * A MESSAGE THAT IS ALL TITLE IS A WHOLE ROW, WHICH IS V13'S DECISION AND NOT THIS
	 * ROUTE'S.
	 *
	 * <p>{@code message_subject_not_blank} exists and no such check over {@code body} does -
	 * the same pair {@code competitor.bio} carries, „NOT NULL and may be empty". Absent and
	 * empty are one answer here and not two, which is why both are asked.
	 */
	@ParameterizedTest
	@NullSource
	@ValueSource(strings = {""})
	void theTextMayBeEmptyAndTheRowIsWhole(String noText) throws Exception {
		long written = idIn(writing(SENDER_SIGNS_IN, RECIPIENT, A_TITLE, noText));

		assertThat(rowOf(written).get("body"))
				.as("an empty text was refused or stored as something other than empty")
				.isEqualTo("");
	}

	/**
	 * THE MOMENT IS THE DATABASE'S, AND NOTHING THIS ROUTE WRITES ASKS A QUESTION.
	 *
	 * <p>{@code sent_at} is V13's {@code now()} and there is no field for it in what
	 * arrives. Measured against the fixture rather than against the clock of the machine
	 * running this: every message that was already there is dated in July, so a moment read
	 * off anything else - a copied value, an epoch, the oldest row - puts this one somewhere
	 * other than at the top of an inbox the portal orders „newest first".
	 *
	 * <p>{@code team_invitation_id} and {@code pair_invite_id} are what draw „Prihvati" and
	 * „Odbij" under a message ({@code MessageDetail.tsx}). A member writing to a member asks
	 * nothing the portal can answer for him, and a row carrying either would offer a button
	 * pointing at an invitation that does not exist.
	 */
	@Test
	void theMomentIsTheDatabasesAndNothingWrittenHereAsksAQuestion() throws Exception {
		long written = idIn(writing(SENDER_SIGNS_IN, RECIPIENT, A_TITLE, A_TEXT));

		assertThat(inboxOf(RECIPIENT_SIGNS_IN))
				.as("what was just written is not the newest thing in his inbox, so its moment"
						+ " came from somewhere other than the database's own now()")
				.startsWith(A_TITLE);

		assertThat(rowOf(written).get("team_invitation_id"))
				.as("a message one member wrote to another carries a team invitation")
				.isNull();
		assertThat(rowOf(written).get("pair_invite_id"))
				.as("a message one member wrote to another carries a pair invite")
				.isNull();
	}

	/**
	 * WRITING TO HIMSELF IS WRITTEN DOWN, BECAUSE NOTHING DECIDED THAT IT SHOULD NOT BE.
	 *
	 * <p>A boundary rather than a feature: V13 puts no check on it, no decision of the
	 * owner's mentions it, and a refusal invented in the route would afterwards read like
	 * one somebody took. Measured here so the boundary is a fact about the portal rather
	 * than a sentence in a comment.
	 */
	@Test
	void writingToHimselfIsWrittenDownBecauseNothingRefusesIt() throws Exception {
		long written = idIn(writing(SENDER_SIGNS_IN, SENDER, A_TITLE, A_TEXT));

		assertThat(rowOf(written).get("to_id")).isEqualTo(keyOf(SENDER));
		assertThat(inboxOf(SENDER_SIGNS_IN)).contains(A_TITLE);
	}

	/**
	 * AN ADDRESS THAT WANTS JSON AND IS SENT NONE IS AN ADDRESS THAT IS NOT THERE.
	 *
	 * <p>Without {@code consumes} on the mapping the request reaches the argument resolver
	 * and is answered 415 - „this address is here and wants a different type" - while an
	 * address mapping nothing goes on saying 404, and that difference is what tells somebody
	 * a write lives at an address the portal never offered him. Unlike {@code /api/teams},
	 * this path is on no open list and answers no {@code OPTIONS}, so there is nothing else
	 * here saying it out loud. Compared with an address of the same length that maps nothing
	 * rather than with the number, for the reason every refusal in this repository is.
	 */
	@Test
	void anAddressThatWantsJsonAndIsSentNoneIsAnAddressThatIsNotThere() throws Exception {
		Cookie signedIn = new Cookie(SessionCookie.NAME, sessions.get(SENDER_SIGNS_IN).secret());

		assertThat(http.perform(post(PATH).with(csrf()).cookie(signedIn))
						.andReturn().getResponse().getStatus())
				.as("a POST carrying no content type was answered something other than what an"
						+ " address that maps nothing answers, so this address says it exists")
				.isEqualTo(http.perform(post(NOTHING_IS_THERE).with(csrf()).cookie(signedIn))
						.andReturn().getResponse().getStatus());

		assertThat(messages()).as("something was written from a request that matched nothing")
				.isEqualTo(3);
	}
}

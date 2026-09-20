package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
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

import java.lang.reflect.RecordComponent;
import java.nio.file.Files;
import java.nio.file.Path;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A MEMBER CHANGING WHAT THE PORTAL SAYS ABOUT HIM, END TO END: which half waits, which
 * half takes effect at once, and what is left standing when neither does.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on every axis an assertion
 * below reads a value along. Each of these is a way this whole file could be green and
 * measure nothing:
 *
 * <ul>
 * <li><b>Eight competitors, and the one who asks in most cases is written THIRD.</b> „The
 * member asking" and „the first member by key" are different rows, so a statement that
 * lost its condition and took the first row instead answers differently.
 * <li><b>EVERY MEMBER'S STANDING TEXT IS DIFFERENT AND NONE OF THEM IS EMPTY.</b> „The old
 * text still stands" measured over an empty one would be the same string as „the column
 * was emptied", and measured over a shared one would be the same string as „somebody
 * else's".
 * <li><b>{@code profile_hidden} starts both ways.</b> Measured over a fixture where
 * everybody is visible, „the switch was not touched" and „the switch was set to false" are
 * one answer; {@link #ALREADY_HIDDEN} is the row that tells them apart, and the case that
 * sends a text and no switch asks him.
 * <li><b>THE NAME ON THE ACCOUNT IS NEVER THE NAME ON THE MEMBER.</b> Every account here
 * is „Roditelj Roditeljevic" and every member has a name of his own, which is the ordinary
 * shape rather than a contrivance: PDL P21 gives a member under sixteen an account his
 * parent holds. The card a moderator reads carries the member's name, and a route reading
 * the account's would be green in any fixture where the two agree.
 * <li><b>Somebody else's text is already waiting, and it is written FIRST.</b> So „this
 * member's waiting text" is never „the only one" and never „the first one".
 * <li><b>The profiles tab holds four different states at once</b> - a waiting text, a
 * waiting PICTURE, a text that was refused, and nothing - and a fifth row waits in another
 * tab entirely. Four different members carry them, so the guard that refuses a second text
 * has four separate answers to get right.
 * <li><b>The text sent is never the text stored.</b> Every text a case sends that is meant
 * to be accepted carries spaces around it, so an answer echoed off the request and a row
 * read out of the table are two different strings.
 * </ul>
 *
 * <p><b>Authorisation as a rule is not measured here.</b> This route carries no
 * {@link RightIsNeeded} and needs none - every member edits his own profile - so
 * {@code RightsAtTheDoorTest} has nothing to sweep and {@code /api/me} is already named in
 * its snapshot as a path. What IS measured here is what that sweep cannot see either way:
 * that a stranger is refused before the handler runs, and that an account naming no member
 * is answered as though the address were not there.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MeWriteApiTest {

	/** Written first, never asks for anything, and must never move. */
	private static final String FIRST_WRITTEN = "000100";

	/**
	 * Somebody else, whose text is already waiting and was written FIRST into the queue.
	 *
	 * <p>Hidden, and every case that changes a switch leaves him hidden: „the row this
	 * request changed" and „the first row" are then two different answers.
	 */
	private static final String SOMEONE_ELSE = "000200";

	/** The member most cases ask with, written third. */
	private static final String ME = "000300";

	/** His own text is standing in the queue undecided, so a second one is refused. */
	private static final String WHOSE_TEXT_WAITS = "000400";

	/** His text was REFUSED, which is the one state that must NOT stop him sending another. */
	private static final String WHOSE_TEXT_WAS_REFUSED = "000500";

	/** What is waiting on him is in another tab altogether, and it stops nothing. */
	private static final String WAITING_IN_ANOTHER_TAB = "000600";

	/** What is waiting on him is a PICTURE, which is not a text and stops nothing. */
	private static final String WHOSE_PICTURE_WAITS = "000700";

	/** Hidden from the start, which is the only row that can say „the switch was not touched". */
	private static final String ALREADY_HIDDEN = "000800";

	private static final String MODERATOR_WHO_DOES_NOT_RACE = "moderator@primer.rs";

	/** Holds the tick that opens the tab this route writes into, and holds a second one. */
	private static final String MODERATOR_OF_PROFILES = "profili@primer.rs";

	/**
	 * The name on EVERY account, and it is on no member.
	 *
	 * <p>PDL P21: a member under sixteen has his account held by a parent, so the two names
	 * differing is the ordinary case. A queue card about a child's profile carries the
	 * child's name.
	 */
	private static final String THE_NAME_ON_THE_ACCOUNT = "Roditelj";

	private static final String THE_SURNAME_ON_THE_ACCOUNT = "Roditeljevic";

	/** The member's own name, which is what a card about his profile must carry. */
	private static final String MY_NAME = "Milica";

	private static final String MY_SURNAME = "Mitrovic";

	/** What stands on {@link #ME}'s profile before any case runs, and it is not empty. */
	private static final String THE_TEXT_ON_MY_PROFILE = "Trcim od 2014. i volim duge staze.";

	/** {@link #WHOSE_TEXT_WAITS}'s words, already in front of a moderator. */
	private static final String THE_TEXT_ALREADY_WAITING = "Prvi tekst koji vec ceka odluku.";

	/** And {@link #SOMEONE_ELSE}'s, written into the queue before anybody else's. */
	private static final String SOMEBODY_ELSES_WAITING_TEXT = "Tudji tekst koji ceka prvi.";

	/**
	 * The member's own form, read off the working tree rather than described.
	 *
	 * <p>The same file {@code WhatRegistrationAsksForTest} reads and the same shape
	 * {@code TeamWriteApiTest} uses for its own form: what a box holds is a fact about a
	 * file, and a number in a comment claiming to know it is worth nothing.
	 */
	private static final Path THE_FORM_THE_BOX_IS_ON =
			Path.of("..", "frontend", "src", "forms", "definitions", "registracija.form.json");

	private static final String THE_PROFILES_TAB = "profiles";

	/**
	 * An address of the same shape that maps nothing, which every refusal here is compared
	 * against rather than compared with a number written down.
	 */
	private static final String NOTHING_IS_THERE = "/api/nema-ovoga";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	@BeforeEach
	void eightMembersInFiveDifferentStates() {
		competitor(FIRST_WRITTEN, "Prvi", "Prvic", "Prvi upisan i nikada ne pita nista.", false);
		competitor(SOMEONE_ELSE, "Sasa", "Sasic", "Tudja biografija koja stoji na tudjem profilu.",
				true);
		competitor(ME, MY_NAME, MY_SURNAME, THE_TEXT_ON_MY_PROFILE, false);
		competitor(WHOSE_TEXT_WAITS, "Vera", "Veric", "Biografija onoga ciji tekst ceka.", false);
		competitor(WHOSE_TEXT_WAS_REFUSED, "Ognjen", "Ognjenic", "Biografija onoga ko je odbijen.",
				true);
		competitor(WAITING_IN_ANOTHER_TAB, "Tamara", "Tamic", "Biografija onoga ko ceka u timovima.",
				false);
		competitor(WHOSE_PICTURE_WAITS, "Pavle", "Pavlic", "Biografija onoga cija slika ceka.",
				false);
		competitor(ALREADY_HIDDEN, "Helena", "Helenic", "Biografija onoga ko je vec skriven.", true);

		account("prvi@primer.rs", FIRST_WRITTEN);
		account("neko-drugi@primer.rs", SOMEONE_ELSE);
		account("ja@primer.rs", ME);
		account("tekst-ceka@primer.rs", WHOSE_TEXT_WAITS);
		account("odbijen@primer.rs", WHOSE_TEXT_WAS_REFUSED);
		account("drugi-red@primer.rs", WAITING_IN_ANOTHER_TAB);
		account("slika-ceka@primer.rs", WHOSE_PICTURE_WAITS);
		account("vec-skriven@primer.rs", ALREADY_HIDDEN);

		moderatorWithNoCompetitor(MODERATOR_WHO_DOES_NOT_RACE);
		moderatorWithNoCompetitor(MODERATOR_OF_PROFILES);

		/* TWO TICKS AND NOT ONE, which is `RightsAtTheDoorTest`'s own reason: with a single
		   tick apiece, „holds any right at all" and „holds THIS right" give the same answer
		   on every request. */
		ticked(MODERATOR_OF_PROFILES, "queue:" + THE_PROFILES_TAB, "queue:teams");

		/* WRITTEN FIRST INTO THE QUEUE, so „the text this member is waiting on" is never
		   „the first row" and never „the only one". */
		waitingText(SOMEONE_ELSE, SOMEBODY_ELSES_WAITING_TEXT);
		waitingText(WHOSE_TEXT_WAITS, THE_TEXT_ALREADY_WAITING);

		/* THE THREE STATES THAT MUST NOT BE MISTAKEN FOR A WAITING TEXT. */
		refusedText(WHOSE_TEXT_WAS_REFUSED, "Tekst koji je moderator odbio.");
		waitingInTeams(WAITING_IN_ANOTHER_TAB, "Timocka trkacka druzina");
		waitingPicture(WHOSE_PICTURE_WAITS);
	}

	private void competitor(String number, String first, String last, String bio, boolean hidden) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, ?, ?, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(number, first, last, String.format("%016x", ++issued), bio, hidden)
				.update();
	}

	/** An account whose NAME is nobody's member name, for the reason at the head of this file. */
	private void account(String email, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " (?, ?, ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(THE_NAME_ON_THE_ACCOUNT, THE_SURNAME_ON_THE_ACCOUNT, email, memberNumber)
				.update();

		openSession(email);
	}

	/** An account naming no member at all, which V23 calls the ordinary case for a moderator. */
	private void moderatorWithNoCompetitor(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code = 'moderator'))")
				.param(email).update();

		openSession(email);
	}

	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}
	}

	private void openSession(String email) {
		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	/** Somebody's text standing in the profiles tab, queued the way V9 queues one. */
	private void waitingText(String memberNumber, String text) {
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " 'Neko Nekic', ?)")
				.params(THE_PROFILES_TAB, memberNumber, text).update();
	}

	/**
	 * A text that has been REFUSED, which V9 says stands in the table for ever.
	 *
	 * <p>{@code decided_at}, {@code decided_by_name} and {@code reason} are all three
	 * required together: {@code verification_decided_says_when},
	 * {@code verification_decided_says_who} and {@code verification_refusal_says_why} are
	 * biconditionals, so a row refused with half of them is a row the database will not
	 * hold.
	 */
	private void refusedText(String memberNumber, String text) {
		db.sql("insert into verification (queue, competitor_id, subject, body, state, decided_at,"
						+ " decided_by_name, reason)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " 'Neko Nekic', ?, 'rejected', timestamptz '2026-09-01 10:00:00+00',"
						+ " 'Moderator Bezimeni', 'Napisi nesto o trcanju, a ne o poslu.')")
				.params(THE_PROFILES_TAB, memberNumber, text).update();
	}

	/** A row waiting in a tab that is not this route's at all. */
	private void waitingInTeams(String memberNumber, String subject) {
		db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('teams', (select id from competitor where member_number = ?), ?, '')")
				.params(memberNumber, subject).update();
	}

	/**
	 * A PICTURE waiting in the profiles tab, which is the other half of that tab.
	 *
	 * <p>PDL P28a, 06.08.2026 puts biographies and pictures in one row, „isti clan, isti
	 * profil, dve stavke koje moderator gleda zajedno", and {@code photo_id} is what the
	 * schema offers to tell the two apart.
	 */
	private void waitingPicture(String memberNumber) {
		String digest = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
				+ " values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)").param(digest).update();

		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values (?, (select id from competitor where member_number = ?),"
						+ " 'Neko Nekic', '', (select id from photo where digest = ?))")
				.params(THE_PROFILES_TAB, memberNumber, digest).update();
	}

	private String cookieOf(String memberNumber) {
		return sessions.get(db.sql("select a.email from account a join competitor c"
						+ " on c.id = a.competitor_id where c.member_number = ?")
				.param(memberNumber).query(String.class).single()).secret();
	}

	/** The ordinary request, built out of the record so its own shape is what is sent. */
	private String change(String bio, Boolean profileHidden) {
		return mapper.writeValueAsString(new MeWriteApi.Change(bio, profileHidden));
	}

	private MockHttpServletResponse changeAs(String memberNumber, String body) throws Exception {
		return sent(body, new Cookie(SessionCookie.NAME, cookieOf(memberNumber)));
	}

	private MockHttpServletResponse changeAs(String memberNumber, String bio, Boolean hidden)
			throws Exception {

		return changeAs(memberNumber, change(bio, hidden));
	}

	/**
	 * @param carrying the session, or null for somebody who has none - which is not the same
	 *                 request with an empty list of cookies but a request with no cookie
	 *                 header at all, the way a browser that has never signed in sends one
	 */
	private MockHttpServletResponse sent(String body, Cookie carrying) throws Exception {
		MockHttpServletRequestBuilder asking = put("/api/me").with(csrf())
				.contentType(MediaType.APPLICATION_JSON).content(body);

		return http.perform(carrying == null ? asking : asking.cookie(carrying))
				.andReturn().getResponse();
	}

	private JsonNode answerIn(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString());
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return answerIn(answer).path("reason").asString();
	}

	private long competitorId(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	/** One member's two columns, read back out of the row as a pair. */
	private List<Object> profileOf(String memberNumber) {
		return db.sql("select bio, profile_hidden from competitor where member_number = ?")
				.param(memberNumber)
				.query((row, one) -> List.<Object>of(row.getString(1), row.getBoolean(2)))
				.single();
	}

	/** One queue row read back whole, in a fixed order. */
	private List<Object> queueRowNumbered(long id) {
		return db.sql("select queue, competitor_id, subject, body, state,"
						+ " photo_id, decided_at, reason from verification where id = ?")
				.param(id)
				.query((row, one) -> List.of(row.getString(1), row.getObject(2), row.getString(3),
						row.getString(4), row.getString(5), String.valueOf(row.getObject(6)),
						String.valueOf(row.getObject(7)), String.valueOf(row.getObject(8))))
				.single();
	}

	private List<String> textsWaitingFor(String memberNumber) {
		return db.sql("select body from verification where queue = ? and state = 'waiting'"
						+ " and photo_id is null and competitor_id ="
						+ " (select id from competitor where member_number = ?)"
						+ " order by raised_at, id")
				.params(THE_PROFILES_TAB, memberNumber)
				.query(String.class).list();
	}

	private long howManyRowsInTheQueue() {
		return db.sql("select count(*) from verification").query(Long.class).single();
	}

	// ------------------------------------------------------------------------------------

	/**
	 * THE FIXTURE SAYS WHAT IT CLAIMS TO SAY, asked of the database rather than trusted from
	 * the constants above.
	 *
	 * <p>Every assertion in this file rests on one of these, and each of them is a way the
	 * whole file could measure nothing: a member who is first by key makes „his own row"
	 * unmeasurable, an empty standing text makes „the old words still stand" the same string
	 * as „the column was emptied", an account whose name matches the member's makes the
	 * subject unmeasurable, and a fixture where everybody is visible cannot tell „not
	 * touched" from „set to false".
	 */
	@Test
	void theFixtureSeparatesTheAxesItSaysItSeparates() {
		assertThat(competitorId(ME))
				.as("the member every case asks with is the first row in the table, so a statement"
						+ " that lost its condition and took the first member answers the same way")
				.isGreaterThan(competitorId(FIRST_WRITTEN))
				.isGreaterThan(competitorId(SOMEONE_ELSE));

		assertThat(db.sql("select count(distinct bio) from competitor").query(Long.class).single())
				.as("two members share a standing text, so the words that came back could be"
						+ " somebody else's and nothing would say so")
				.isEqualTo(8);

		assertThat(db.sql("select count(*) from competitor where btrim(bio) = ''")
				.query(Long.class).single())
				.as("somebody's standing text is empty, and empty is the same string as a column"
						+ " that was emptied")
				.isZero();

		assertThat(db.sql("select count(distinct profile_hidden) from competitor")
				.query(Long.class).single())
				.as("every member starts on the same side of the switch, so a switch that was not"
						+ " touched and one that was set to that value cannot be told apart")
				.isEqualTo(2);

		assertThat(db.sql("select count(*) from account a join competitor c on c.id ="
						+ " a.competitor_id where a.first_name = c.first_name")
				.query(Long.class).single())
				.as("an account carries the same name as the member it names, so a card built out"
						+ " of the account would be right by accident")
				.isZero();

		assertThat(db.sql("select min(id) from verification").query(Long.class).single())
				.as("the first row in the queue is not somebody else's, so this member's waiting"
						+ " text and the first waiting text of all are the same row")
				.isEqualTo(db.sql("select min(id) from verification where competitor_id = ?")
						.param(competitorId(SOMEONE_ELSE)).query(Long.class).single());

		assertThat(textsWaitingFor(ME))
				.as("the member every case asks with already has a text waiting, so the ordinary"
						+ " case below is measuring a refusal")
				.isEmpty();

		assertThat(textsWaitingFor(WHOSE_TEXT_WAITS))
				.as("the member who is meant to be refused a second text has none waiting")
				.containsExactly(THE_TEXT_ALREADY_WAITING);

		assertThat(db.sql("select state from verification where competitor_id = ?")
				.param(competitorId(WHOSE_TEXT_WAS_REFUSED)).query(String.class).list())
				.as("the refused member's row is not refused at all, so the case saying a decision"
						+ " is no bar measures nothing")
				.containsExactly("rejected");

		assertThat(db.sql("select queue from verification where competitor_id = ?")
				.param(competitorId(WAITING_IN_ANOTHER_TAB)).query(String.class).list())
				.as("the row meant to be in another tab is in this one")
				.containsExactly("teams");

		assertThat(db.sql("select count(*) from verification where queue = ? and photo_id is not"
						+ " null and competitor_id = ?")
				.params(THE_PROFILES_TAB, competitorId(WHOSE_PICTURE_WAITS))
				.query(Long.class).single())
				.as("the row meant to carry a picture carries none, so a guard that reads"
						+ " photo_id is being asked nothing")
				.isOne();

		assertThat(profileOf(ALREADY_HIDDEN).get(1))
				.as("the one member who is meant to start hidden is not hidden")
				.isEqualTo(true);
	}

	/**
	 * THE ORDINARY ERRAND: THE TEXT GOES TO A MODERATOR AND THE PROFILE KEEPS THE APPROVED
	 * WORDS.
	 *
	 * <p>PDL P11, 12.08.2026, of the picture and therefore of the other half of the same
	 * queue row: „Dok nova slika ceka, na profilu stoji ona koja je odobrena."
	 */
	@Test
	void aTextGoesToTheQueueAndTheProfileKeepsTheWordsThatWereApproved() throws Exception {
		MockHttpServletResponse answer =
				changeAs(ME, "  Trcim od 2014. i sada trcim ultramaratone.  ", null);

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(answerIn(answer).path("bio").asString())
				.as("the answer handed back the words that are WAITING as though they were the"
						+ " profile's, which is the portal publishing an unapproved text through"
						+ " its own server")
				.isEqualTo(THE_TEXT_ON_MY_PROFILE);

		assertThat(profileOf(ME))
				.as("the profile took the new words at once, so nobody approves anything")
				.isEqualTo(List.of(THE_TEXT_ON_MY_PROFILE, false));

		assertThat(textsWaitingFor(ME))
				.as("the text was stored as it arrived rather than as it is kept, or it did not"
						+ " reach the queue at all")
				.containsExactly("Trcim od 2014. i sada trcim ultramaratone.");

		assertThat(answerIn(answer).path("waiting").asLong())
				.as("the answer does not name the row now standing, so the member is told nothing"
						+ " about what became of his words")
				.isEqualTo(db.sql("select id from verification where competitor_id = ?"
								+ " and queue = ? and state = 'waiting'")
						.params(competitorId(ME), THE_PROFILES_TAB).query(Long.class).single());

		assertThat(profileOf(SOMEONE_ELSE))
				.as("somebody else's profile moved")
				.isEqualTo(List.of("Tudja biografija koja stoji na tudjem profilu.", true));

		assertThat(textsWaitingFor(SOMEONE_ELSE))
				.as("somebody else's waiting text moved, and his was already there before this"
						+ " request - so his waiting text was no bar to this one either")
				.containsExactly(SOMEBODY_ELSES_WAITING_TEXT);
	}

	/**
	 * AND THE CARD CARRIES THE MEMBER'S OWN NAME, WHICH IS NOT THE NAME ON HIS ACCOUNT.
	 *
	 * <p>V9 makes {@code subject} NOT NULL because it „carries the name in every case", and
	 * PDL P21 is why the two names differ in the ordinary case: a member under sixteen has
	 * his account held by a parent. A moderator judging a child's profile is shown the
	 * child.
	 */
	@Test
	void theCardCarriesTheMembersOwnNameAndNotTheNameOnHisAccount() throws Exception {
		MockHttpServletResponse answer = changeAs(ME, "  Nove reci o meni.  ", null);

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(queueRowNumbered(answerIn(answer).path("waiting").asLong()))
				.as("the row a moderator will read is not the one this route says it wrote, or it"
						+ " carries somebody's account name, or a state and a decision this route"
						+ " has no business writing")
				.isEqualTo(List.of(THE_PROFILES_TAB, competitorId(ME),
						MY_NAME + " " + MY_SURNAME, "Nove reci o meni.", "waiting",
						"null", "null", "null"));
	}

	/**
	 * AND THE ROW REALLY REACHES THE MODERATOR WHO HOLDS THAT TAB.
	 *
	 * <p>Asked of {@code GET /api/verification} rather than of the column this route wrote,
	 * which is a second source for one fact: the tab name is checked by whether the row
	 * comes out for somebody holding {@code queue:profiles}, and V9 generates
	 * {@code right_code} out of it, so a tab nobody may moderate is a row the key refuses.
	 */
	@Test
	void theWaitingTextReachesWhoeverHoldsTheProfilesTab() throws Exception {
		assertThat(changeAs(ME, "  Tekst za moderatora.  ", null).getStatus()).isEqualTo(200);

		JsonNode queues = mapper.readTree(http.perform(get("/api/verification")
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MODERATOR_OF_PROFILES).secret())))
				.andReturn().getResponse().getContentAsString());

		List<String> onTheProfilesTab = new ArrayList<>();

		for (JsonNode tab : queues) {
			if (THE_PROFILES_TAB.equals(tab.path("queue").asString())) {
				for (JsonNode item : tab.path("waiting")) {
					onTheProfilesTab.add(item.path("body").asString());
				}
			}
		}

		assertThat(onTheProfilesTab)
				.as("what the member sent never reached the tab a moderator works in, so it waits"
						+ " where nobody looks")
				.contains("Tekst za moderatora.");
	}

	/**
	 * THE SWITCH TAKES EFFECT AT ONCE AND NOBODY IS ASKED ABOUT IT.
	 *
	 * <p>PDL P23, 06.09.2026: „Skrivanje profila se pravi. Jedno polje na clanu i jedan
	 * prekidac u Podesavanjima." Nothing decided that it waits, and there is nothing about
	 * it to judge.
	 *
	 * <p><b>And it asserts that the TEXT was not touched</b>, which is the half a case
	 * changing both things at once cannot claim.
	 */
	@Test
	void theSwitchTakesEffectAtOnceAndAsksNobody() throws Exception {
		long before = howManyRowsInTheQueue();

		MockHttpServletResponse answer = changeAs(ME, null, true);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(answerIn(answer).path("profileHidden").asBoolean())
				.as("the answer does not say the switch was applied, so the one half of this"
						+ " request that did take effect is the half nobody is told about")
				.isTrue();

		assertThat(profileOf(ME))
				.as("the switch did not move, or the text moved with it")
				.isEqualTo(List.of(THE_TEXT_ON_MY_PROFILE, true));

		assertThat(howManyRowsInTheQueue())
				.as("hiding a profile put something in front of a moderator, and no decision"
						+ " anywhere says it waits for one")
				.isEqualTo(before);

		assertThat(answerIn(answer).path("waiting").isNull())
				.as("the answer names a waiting text although this member has none")
				.isTrue();
	}

	/** And the same road back: unhiding is the member's own choice too. */
	@Test
	void unhidingTakesEffectAtOnceToo() throws Exception {
		MockHttpServletResponse answer = changeAs(ALREADY_HIDDEN, null, false);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(answerIn(answer).path("profileHidden").asBoolean()).isFalse();
		assertThat(profileOf(ALREADY_HIDDEN).get(1))
				.as("a member who asked to be visible again is still hidden")
				.isEqualTo(false);
	}

	/**
	 * A TEXT SENT WITH NO SWITCH LEAVES A HIDDEN PROFILE HIDDEN.
	 *
	 * <p>This is the case a primitive {@code boolean} cannot pass. Jackson leaves one at
	 * {@code false} for a field nobody sent, so a member mending a sentence would publish
	 * the page he chose to keep from visitors - PDL P23's whole subject and a promise the
	 * privacy policy makes. Asked of the one member who starts hidden, because on anybody
	 * else „not touched" and „set to false" are the same answer.
	 */
	@Test
	void aTextSentWithNoSwitchLeavesAHiddenProfileHidden() throws Exception {
		MockHttpServletResponse answer = changeAs(ALREADY_HIDDEN, "  Samo menjam reci.  ", null);

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(profileOf(ALREADY_HIDDEN).get(1))
				.as("a member who changed only his words was published to every visitor")
				.isEqualTo(true);

		assertThat(answerIn(answer).path("profileHidden").asBoolean())
				.as("the answer told him his profile is open, which the row does not say")
				.isTrue();
	}

	/** Both at once, and each half goes its own way inside one request. */
	@Test
	void bothAtOnceAndEachHalfGoesItsOwnWay() throws Exception {
		MockHttpServletResponse answer = changeAs(ME, "  I reci i prekidac.  ", true);

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(profileOf(ME))
				.as("the switch did not take effect, or the text did")
				.isEqualTo(List.of(THE_TEXT_ON_MY_PROFILE, true));

		assertThat(textsWaitingFor(ME))
				.as("the text did not reach the queue although the switch was applied")
				.containsExactly("I reci i prekidac.");
	}

	/**
	 * A SECOND TEXT WHILE ONE WAITS IS REFUSED, AND THE FIRST IS THE ONE STILL STANDING.
	 *
	 * <p>{@code pages/member/ProfileBio.tsx} draws no button while one stands, „a second ask
	 * gives a moderator two texts of one person and no question to answer", and names the
	 * hole it cannot close from a browser. This is the side that can.
	 */
	@Test
	void aSecondTextWhileOneWaitsIsRefusedAndTheFirstIsTheOneStanding() throws Exception {
		MockHttpServletResponse answer = changeAs(WHOSE_TEXT_WAITS, "  Drugi pokusaj.  ", null);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(MeWriteApi.A_TEXT_ALREADY_WAITS);

		assertThat(textsWaitingFor(WHOSE_TEXT_WAITS))
				.as("a moderator now holds two texts of one member and no question he can answer")
				.containsExactly(THE_TEXT_ALREADY_WAITING);
	}

	/**
	 * AND A REFUSAL COMMITS NOTHING, WHICH IS WHY THE CONFLICT IS ASKED BEFORE THE FIRST
	 * WRITE.
	 *
	 * <p>{@code TransactionTemplate.execute} rolls back on an exception and not on a
	 * returned value, so a 409 decided after the switch had been written would be a refusal
	 * reported over a change that was kept - and the member would be hidden by a request he
	 * was told did nothing.
	 */
	@Test
	void aRefusedRequestLeavesTheSwitchWhereItWas() throws Exception {
		MockHttpServletResponse answer =
				changeAs(WHOSE_TEXT_WAITS, "  Drugi pokusaj sa prekidacem.  ", true);

		assertThat(answer.getStatus()).isEqualTo(409);

		assertThat(profileOf(WHOSE_TEXT_WAITS).get(1))
				.as("the request was refused and the switch moved anyway, so the member was told"
						+ " nothing happened while his profile was hidden")
				.isEqualTo(false);
	}

	/**
	 * A TEXT THAT WAS REFUSED IS NO BAR TO SENDING ANOTHER, WHICH IS THE WHOLE ERRAND.
	 *
	 * <p>Owner, PDL P22, 15.08.2026: the panel exists because „odbijena biografija stizala
	 * clanu uz razlog, a clan nije imao gde da napise novu... odbijanje se vraca, clan
	 * ispravi i posalje ponovo". A guard written over the tab rather than over
	 * {@code state = 'waiting'} shuts the one door this route was built to open.
	 */
	@Test
	void aTextThatWasRefusedIsNoBarToSendingAnother() throws Exception {
		MockHttpServletResponse answer =
				changeAs(WHOSE_TEXT_WAS_REFUSED, "  Ispravljen tekst o trcanju.  ", null);

		assertThat(answer.getStatus())
				.as("a member whose text was refused cannot send a new one, which is the errand"
						+ " this whole route was asked for")
				.isEqualTo(200);

		assertThat(textsWaitingFor(WHOSE_TEXT_WAS_REFUSED))
				.containsExactly("Ispravljen tekst o trcanju.");

		assertThat(db.sql("select count(*) from verification where state = 'rejected'"
						+ " and competitor_id = ?")
				.param(competitorId(WHOSE_TEXT_WAS_REFUSED)).query(Long.class).single())
				.as("the refused row was taken away, and V9 says a decided row stands for ever")
				.isOne();
	}

	/** Something waiting in ANOTHER tab is not this member's text waiting. */
	@Test
	void aRowWaitingInAnotherTabIsNoBar() throws Exception {
		MockHttpServletResponse answer =
				changeAs(WAITING_IN_ANOTHER_TAB, "  Tekst dok tim ceka.  ", null);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(textsWaitingFor(WAITING_IN_ANOTHER_TAB))
				.containsExactly("Tekst dok tim ceka.");
	}

	/**
	 * AND A PICTURE WAITING IS NOT A TEXT WAITING, ALTHOUGH THEY SHARE A TAB.
	 *
	 * <p>PDL P28a, 06.08.2026 puts both in one row of the verification screen - „isti clan,
	 * isti profil, dve stavke koje moderator gleda zajedno" - and says the two are answered
	 * differently: „razlikuje se samo sta moderator pise, jer se slika menja po instrukciji
	 * a tekst se pise ponovo". So a member whose picture is being judged may still mend a
	 * sentence, and the answer must name the TEXT rather than whichever row came first.
	 */
	@Test
	void aPictureWaitingIsNotATextWaiting() throws Exception {
		MockHttpServletResponse answer =
				changeAs(WHOSE_PICTURE_WAITS, "  Tekst dok slika ceka.  ", null);

		assertThat(answer.getStatus())
				.as("a member whose picture is with a moderator cannot change a word of his text")
				.isEqualTo(200);

		assertThat(textsWaitingFor(WHOSE_PICTURE_WAITS)).containsExactly("Tekst dok slika ceka.");

		assertThat(queueRowNumbered(answerIn(answer).path("waiting").asLong()).get(3))
				.as("the answer named the waiting PICTURE rather than the text, so the member is"
						+ " pointed at a row that is not his words")
				.isEqualTo("Tekst dok slika ceka.");

		assertThat(db.sql("select count(*) from verification where queue = ? and photo_id is not"
						+ " null and competitor_id = ?")
				.params(THE_PROFILES_TAB, competitorId(WHOSE_PICTURE_WAITS))
				.query(Long.class).single())
				.as("the picture waiting on him was taken away by a request about his words")
				.isOne();
	}

	/**
	 * WHOSE PROFILE MOVES IS READ OFF THE SESSION, AND A BODY NAMING SOMEBODY ELSE CHANGES
	 * NOTHING ABOUT HIM.
	 *
	 * <p>There is no member in the path and none in the record, so a field naming one is a
	 * field Jackson drops. This sends exactly that request and then reads three other
	 * members' rows back.
	 */
	@Test
	void aBodyNamingSomebodyElseStillChangesOnlyTheCallersOwnProfile() throws Exception {
		MockHttpServletResponse answer = changeAs(ME, "{\"memberNumber\": \"" + SOMEONE_ELSE
				+ "\", \"competitorId\": " + competitorId(SOMEONE_ELSE)
				+ ", \"bio\": \"  Tekst upucen na tudji broj.  \", \"profileHidden\": true}");

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(profileOf(ME))
				.as("the caller's own row did not move, so this request reached somebody else")
				.isEqualTo(List.of(THE_TEXT_ON_MY_PROFILE, true));

		assertThat(textsWaitingFor(ME)).containsExactly("Tekst upucen na tudji broj.");

		assertThat(profileOf(SOMEONE_ELSE))
				.as("a member changed another member's profile by naming him in the body")
				.isEqualTo(List.of("Tudja biografija koja stoji na tudjem profilu.", true));

		assertThat(textsWaitingFor(SOMEONE_ELSE))
				.as("a text was filed under somebody who did not write it")
				.containsExactly(SOMEBODY_ELSES_WAITING_TEXT);

		assertThat(profileOf(FIRST_WRITTEN))
				.as("the first member in the table moved, which is what a statement that lost its"
						+ " condition does")
				.isEqualTo(List.of("Prvi upisan i nikada ne pita nista.", false));

		assertThat(textsWaitingFor(FIRST_WRITTEN)).isEmpty();
	}

	/**
	 * AN ACCOUNT THAT NAMES NO MEMBER IS ANSWERED AS THOUGH THE ADDRESS WERE NOT THERE, AND
	 * THAT IS ASKED WITH THREE DIFFERENT BODIES BECAUSE ONE OF THEM USED TO ANSWER
	 * DIFFERENTLY.
	 *
	 * <p>V23: {@code account.competitor_id} is null for „a moderator who does not race,
	 * which is the ordinary case and not a fault". ADL A8, 13.09.2026: „Server odbija bez
	 * privilegije sa 404, ne sa 403."
	 *
	 * <p><b>Why three bodies and not one, and this is the whole of a finding of
	 * 19.09.2026.</b> With the body read while arguments are resolved, a request this portal
	 * cannot parse never reached the refusal at all and was answered 400 by the container,
	 * while the same request to an address that maps nothing answered 404. One request, and
	 * the difference said „a write lives at this address" to somebody the portal offers that
	 * write on no screen. A case sending only valid JSON is green either way, which is why
	 * this route had the leak with twenty three cases standing.
	 *
	 * <p><b>Compared against an address that really is not there</b>, with the identical
	 * body, so the claim is „these answer alike" rather than „this answers 404" - the shape
	 * {@code VerificationApiTest} and {@code RightsAtTheDoorTest} both use. What this cannot
	 * see is whether the two are alike ON THE WIRE, because MockMvc runs no ERROR dispatch;
	 * that half is {@code RightsOverRealHttpTest}'s and is named in {@link MeWriteApi} rather
	 * than imitated here.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"{\"bio\": \"Moderator pise o sebi.\", \"profileHidden\": true}",
			"{oops", ""})
	void anAccountThatNamesNoMemberIsSentAwayWhateverHeSent(String body) throws Exception {
		long before = howManyRowsInTheQueue();
		Cookie his = new Cookie(SessionCookie.NAME,
				sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret());

		MockHttpServletResponse answer = sent(body, his);

		assertThat(answer.getStatus())
				.as("an account with no member behind it was told something about this address"
						+ " that an address which is not there would not have told him")
				.isEqualTo(http.perform(put(NOTHING_IS_THERE).with(csrf())
								.contentType(MediaType.APPLICATION_JSON).content(body).cookie(his))
						.andReturn().getResponse().getStatus());

		assertThat(answer.getContentAsString())
				.as("the refusal carries a body, which is a sentence about an address that is"
						+ " meant to answer as though it were not there")
				.isEmpty();

		assertThat(howManyRowsInTheQueue())
				.as("an account naming no member put something in the queue, and V9 gives that row"
						+ " nobody to file it under")
				.isEqualTo(before);

		assertThat(db.sql("select count(*) from competitor where profile_hidden").query(Long.class)
				.single())
				.as("somebody's profile was hidden by a request from an account that names no"
						+ " member")
				.isEqualTo(3);
	}

	/**
	 * AND WHAT OPTIONS SAYS ABOUT THIS ADDRESS IS MEASURED RATHER THAN ASSUMED AWAY.
	 *
	 * <p>The refusal above is built to keep a member-less account from learning that a write
	 * lives here. A claim like that is worth nothing if another verb says it out loud, which
	 * is what {@code NothingIsHereRatherThanAlmost} keeps {@code OPTIONS} able to do: it
	 * calls the dispatcher's own lookup precisely so an address can still answer what it
	 * takes.
	 *
	 * <p><b>MEASURED, AND THE ANSWER IS THAT IT SAYS NOTHING.</b> {@code ApiSecurity} shuts
	 * {@code OPTIONS} on every path under {@code /api} that is not on the open list, in as
	 * many words and for this very reason - „an address that exists and one that does not
	 * are refused by the same line and answer the same thing, so there is nothing to count".
	 * {@code /api/me} is not on that list, so the verbs it maps are not spoken anywhere. The
	 * sentence in {@link MeWriteApi} therefore stands as written.
	 *
	 * <p><b>Both halves, because a case asserting only the refusal would pass on an address
	 * that answered nothing at all.</b> The same request to an open path is answered, and
	 * its {@code Allow} really does name verbs - so what is measured here is a difference
	 * between two paths and not a server that refuses {@code OPTIONS} outright.
	 *
	 * <p>The day CORS is configured this line moves, which {@code ApiSecurity} says of
	 * itself; this case is what would notice.
	 */
	@Test
	void optionsSaysNothingAboutTheVerbsThisAddressTakes() throws Exception {
		Cookie his = new Cookie(SessionCookie.NAME,
				sessions.get(MODERATOR_WHO_DOES_NOT_RACE).secret());

		MockHttpServletResponse shut = http.perform(options("/api/me").cookie(his))
				.andReturn().getResponse();

		assertThat(shut.getHeader("Allow"))
				.as("OPTIONS named the verbs this address takes to an account that is refused the"
						+ " write, which is the thing the refusal above is built to keep from him")
				.isNull();

		MockHttpServletResponse open = http.perform(options("/api/teams").cookie(his))
				.andReturn().getResponse();

		assertThat(open.getHeader("Allow"))
				.as("no path on this portal answers OPTIONS at all, so the silence above is the"
						+ " server's habit rather than a rule about this address")
				.contains("GET");

		assertThat(shut.getStatus())
				.as("this address answers OPTIONS exactly as the open one does, so nothing"
						+ " separates them")
				.isNotEqualTo(open.getStatus());
	}

	/**
	 * A BODY THAT NAMES NEITHER FIELD IS A FORM NOBODY FILLED IN, AND IT SAYS WHAT IS
	 * MISSING.
	 *
	 * <p>ADL A54's second half, which has no exception on any route: „kad se forma odbije,
	 * kaze se sta fali." A 400 that names nothing leaves a caller with a full form and no
	 * idea which box the server could not see.
	 *
	 * <p><b>And a body this portal cannot read is the same answer</b>, because neither
	 * carries a single value this route could act on. That case is here rather than in a
	 * file of its own because it is the same sentence about the same request.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"{}", "{\"bio\": null, \"profileHidden\": null}",
			"{\"memberNumber\": \"000100\"}", "{oops", ""})
	void aBodyThatNamesNeitherFieldIsRefusedAndSaysWhatIsMissing(String body) throws Exception {
		long before = howManyRowsInTheQueue();

		MockHttpServletResponse answer = changeAs(ME, body);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("the reason moved when the list was added beside it, so every caller reading"
						+ " a refusal by its reason stopped working")
				.isEqualTo(MeWriteApi.THE_FORM_IS_NOT_COMPLETE);

		List<String> missing = new ArrayList<>();

		for (JsonNode one : answerIn(answer).path("missing")) {
			missing.add(one.asString());
		}

		assertThat(missing)
				.as("the refusal does not say which fields the server could not see, which ADL"
						+ " A54 asks for on every route without exception")
				.isEqualTo(MeWriteApi.WHAT_THIS_ROUTE_TAKES);

		assertThat(profileOf(ME)).isEqualTo(List.of(THE_TEXT_ON_MY_PROFILE, false));
		assertThat(howManyRowsInTheQueue()).isEqualTo(before);
	}

	/**
	 * AND WHAT IT CALLS MISSING IS EVERY FIELD THIS ROUTE REALLY TAKES, asked of the record
	 * rather than of the list beside it.
	 *
	 * <p>The floor under {@link MeWriteApi#WHAT_THIS_ROUTE_TAKES}, in the same commit as the
	 * list, which is {@code RaceWriteApiTest.everyFieldAnEditMustSend}'s own
	 * arrangement. A third field added to {@link MeWriteApi.Change} tomorrow fails the build
	 * until somebody decides whether leaving it out is a refusal, instead of quietly not
	 * being named in one.
	 */
	@Test
	void whatThisRouteSaysIsMissingIsEveryFieldItTakes() {
		List<String> onTheRecord = new ArrayList<>();

		for (RecordComponent one : MeWriteApi.Change.class.getRecordComponents()) {
			onTheRecord.add(one.getName());
		}

		assertThat(onTheRecord)
				.as("the request record carries no components at all, so this compares nothing")
				.isNotEmpty();

		assertThat(MeWriteApi.WHAT_THIS_ROUTE_TAKES)
				.as("a field this route takes is one its refusal never names, or it names one it"
						+ " does not take")
				.containsExactlyInAnyOrderElementsOf(onTheRecord);
	}

	/**
	 * A BLANK TEXT REMOVES WHAT STANDS, AND IT DOES IT AT ONCE.
	 *
	 * <p>Owner, PDL P11, 19.09.2026: „Prazan tekst znaci BRISANJE biografije, i stupa odmah,
	 * bez moderacije. „Skloni moju biografiju" je pravo clana nad sopstvenim podatkom, ne
	 * predlog, isto kao sto je 12.08.2026 odluceno za sliku." His reason for not sending it
	 * through moderation is in the same entry: „prazno ne moze da bude neprikladno", and V9
	 * already uses a blank {@code body} to mean something else.
	 *
	 * <p><b>The first draft of this route REFUSED a blank text</b>, and that was an agent's
	 * boundary rather than anybody's decision; it was reported as one and the owner settled
	 * it the other way. This is the case that keeps it settled.
	 *
	 * <p>Asked with three shapes of nothing, because a guard written against one of them
	 * lets the other two through - the list {@link RegistrationApi} keeps for the same
	 * reason.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", " ", "   \t\n  "})
	void aBlankTextRemovesWhatStandsAndDoesItAtOnce(String nothing) throws Exception {
		long before = howManyRowsInTheQueue();

		MockHttpServletResponse answer = changeAs(ME, nothing, null);

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(profileOf(ME))
				.as("a member asked for his own words to come down and they are still standing,"
						+ " or his switch moved with them")
				.isEqualTo(List.of("", false));

		assertThat(answerIn(answer).path("bio").asString())
				.as("the answer still hands back the words the profile no longer carries")
				.isEmpty();

		assertThat(howManyRowsInTheQueue())
				.as("removing his own text put a card in front of a moderator, and the owner's"
						+ " reason for not doing that is that nothing empty can be unsuitable")
				.isEqualTo(before);

		assertThat(answerIn(answer).path("waiting").isNull())
				.as("the answer names a waiting text although this member has none")
				.isTrue();
	}

	/**
	 * AND REMOVING WHAT STANDS IS NOT REFUSED BECAUSE A PROPOSAL OF HIS IS UNDECIDED.
	 *
	 * <p>The guard that answers 409 asks whether a TEXT was sent and not whether the field
	 * was. Asked the second way, a member wanting his own words taken down would be refused
	 * on account of somebody else's queue - a right withheld until a moderator gets round to
	 * a different question.
	 *
	 * <p><b>And the boundary that follows is measured here rather than argued:</b> the
	 * waiting text stays waiting. Nothing decided that removing what stands withdraws what
	 * was proposed, and the two decisions of 19.09.2026 are about different things.
	 */
	@Test
	void removingWhatStandsIsNotRefusedWhileAProposalOfHisWaits() throws Exception {
		MockHttpServletResponse answer = changeAs(WHOSE_TEXT_WAITS, "", null);

		assertThat(answer.getStatus())
				.as("a member was refused the removal of his own biography because a proposal of"
						+ " his is standing in a queue")
				.isEqualTo(200);

		assertThat(profileOf(WHOSE_TEXT_WAITS).get(0))
				.as("his words are still on the profile")
				.isEqualTo("");

		assertThat(textsWaitingFor(WHOSE_TEXT_WAITS))
				.as("removing what stands took the waiting text with it, which is a withdrawal"
						+ " nobody decided")
				.containsExactly(THE_TEXT_ALREADY_WAITING);

		assertThat(answerIn(answer).path("waiting").asLong())
				.as("the answer stopped naming the text that is still with a moderator")
				.isEqualTo(db.sql("select id from verification where competitor_id = ?"
								+ " and queue = ? and state = 'waiting'")
						.params(competitorId(WHOSE_TEXT_WAITS), THE_PROFILES_TAB)
						.query(Long.class).single());
	}

	/**
	 * THE SWITCH AND THE REMOVAL TRAVEL TOGETHER, WHICH IS ONE STATEMENT AND NOT TWO.
	 *
	 * <p>Both are immediate and both are columns of {@code competitor}, so {@link MeWriteApi}
	 * writes them with a single {@code update} and there is no moment at which one could
	 * have happened and the other not.
	 *
	 * <p><b>WHAT THIS CASE CANNOT DO, said plainly rather than left looking like an
	 * oversight.</b> It cannot make half of that statement fail, because nothing about a
	 * boolean or an empty string can be refused by {@code competitor}'s constraints - V7
	 * bounds the member number, the names, the gender, the basis, the birthday choice, the
	 * referral code and the town, and says nothing about these two columns. So „together or
	 * not at all" rests on there being one statement, and what this case holds is the other
	 * half of that claim: that one request really does move both. The pair that CAN come
	 * apart is the immediate write and the queue row, and
	 * {@code TheSwitchAndTheTextAreOneThingTest} is where that is measured.
	 */
	@Test
	void theSwitchAndTheRemovalTravelTogether() throws Exception {
		assertThat(profileOf(ALREADY_HIDDEN))
				.as("the member this asks about is already where the request would put him, so"
						+ " nothing below could move")
				.isEqualTo(List.of("Biografija onoga ko je vec skriven.", true));

		MockHttpServletResponse answer = changeAs(ALREADY_HIDDEN, "  ", false);

		assertThat(answer.getStatus()).isEqualTo(200);

		assertThat(profileOf(ALREADY_HIDDEN))
				.as("one half of the request landed and the other did not")
				.isEqualTo(List.of("", false));
	}

	/**
	 * A MEMBER WHOSE TEXT IS WAITING IS TOLD SO EVEN WHEN HE ONLY FLICKS THE SWITCH.
	 *
	 * <p>{@code waiting} is read off the queue and not off what THIS request wrote, and
	 * until this case nothing held that. Filled only when the request queued something, the
	 * Settings screen would be handed {@code waiting: null} while a text of his really is
	 * with a moderator; {@code ProfileBio.tsx} hides the button on exactly that field, so it
	 * would draw one, the member would send a second text, and the 409 he then meets
	 * explains nothing to him.
	 */
	@Test
	void aMemberWhoseTextWaitsIsToldSoWhenHeOnlyFlicksTheSwitch() throws Exception {
		MockHttpServletResponse answer = changeAs(WHOSE_TEXT_WAITS, null, true);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(profileOf(WHOSE_TEXT_WAITS).get(1)).isEqualTo(true);

		assertThat(answerIn(answer).path("waiting").asLong())
				.as("a request that queued nothing answered that nothing of his is waiting, while"
						+ " his words are in front of a moderator")
				.isEqualTo(db.sql("select id from verification where competitor_id = ?"
								+ " and queue = ? and state = 'waiting'")
						.params(competitorId(WHOSE_TEXT_WAITS), THE_PROFILES_TAB)
						.query(Long.class).single());

		assertThat(textsWaitingFor(WHOSE_TEXT_WAITS))
				.as("flicking the switch disturbed the text that was waiting")
				.containsExactly(THE_TEXT_ALREADY_WAITING);
	}

	/**
	 * A TEXT LONGER THAN THE BOX IS REFUSED AND ONE EXACTLY AS LONG IS NOT, WHICH IS THE
	 * BOUNDARY IN BOTH DIRECTIONS.
	 *
	 * <p>PDL P11, 31.07.2026: „Biografija je ogranicena na 360 znakova, bez skrola u
	 * kartici." A route refusing everything would satisfy the first half of this case, and
	 * a route refusing nothing would satisfy the second.
	 */
	@Test
	void aTextLongerThanTheBoxIsRefusedAndOneExactlyAsLongIsNot() throws Exception {
		long before = howManyRowsInTheQueue();

		MockHttpServletResponse tooLong =
				changeAs(ME, "a".repeat(MeWriteApi.AS_LONG_AS_THE_FORM_ALLOWS + 1), null);

		assertThat(tooLong.getStatus()).isEqualTo(400);
		assertThat(reasonIn(tooLong)).isEqualTo(MeWriteApi.THE_TEXT_IS_TOO_LONG);
		assertThat(howManyRowsInTheQueue()).isEqualTo(before);

		/* AND THE LENGTH IS THE ONE THAT WOULD BE STORED: the spaces are stripped before the
		   count, so a full box that ends in a newline is not refused for a character nothing
		   keeps. */
		MockHttpServletResponse exactly = changeAs(ME,
				"  " + "b".repeat(MeWriteApi.AS_LONG_AS_THE_FORM_ALLOWS) + "  ", null);

		assertThat(exactly.getStatus())
				.as("a text that fits the member's own box exactly was refused, so the boundary is"
						+ " in the wrong place or the count is made over what arrived")
				.isEqualTo(200);

		assertThat(textsWaitingFor(ME))
				.containsExactly("b".repeat(MeWriteApi.AS_LONG_AS_THE_FORM_ALLOWS));
	}

	/**
	 * AND THE NUMBER IS THE FORM'S OWN, READ OFF THE FILE RATHER THAN REMEMBERED.
	 *
	 * <p>PDL P11, 31.07.2026 says where the limit lives: „Ogranicenje stoji na polju u formi
	 * registracije ({@code registracija.form.json})", and {@code ProfileBio.tsx} draws its
	 * box with {@code limitOf(registracija, 'bio')}. This is the floor under the constant:
	 * the day the owner moves the box, the build stops until the server moves with it. It
	 * is the same arrangement {@code WhatRegistrationAsksForTest} and
	 * {@code TeamWriteApiTest} have for what their own forms ask.
	 */
	@Test
	void theLimitIsTheOneTheMembersOwnBoxCarries() throws Exception {
		JsonNode theBox = null;

		for (JsonNode field : mapper.readTree(Files.readString(THE_FORM_THE_BOX_IS_ON))
				.path("fields")) {

			if ("bio".equals(field.path("name").asString())) {
				theBox = field;
			}
		}

		assertThat(theBox)
				.as("%s has no field called bio at all, so this compares nothing",
						THE_FORM_THE_BOX_IS_ON)
				.isNotNull();

		assertThat(theBox.path("maxLength").asInt())
				.as("the box the member types into and the number this server refuses him by are"
						+ " two different numbers, so one of them is a limit nobody decided")
				.isEqualTo(MeWriteApi.AS_LONG_AS_THE_FORM_ALLOWS);
	}

	@Test
	void somebodyWhoIsNotSignedInIsAskedToSignIn() throws Exception {
		long before = howManyRowsInTheQueue();

		MockHttpServletResponse answer = sent(change("  Tekst bez naloga.  ", true), null);

		assertThat(answer.getStatus()).isEqualTo(401);
		assertThat(howManyRowsInTheQueue())
				.as("a text was queued by somebody the portal knows nothing about")
				.isEqualTo(before);
	}

	/**
	 * AND A WRITE THAT NAMES NO TYPE IS AN ADDRESS THAT IS NOT THERE, NOT AN ADDRESS THAT
	 * WANTS A DIFFERENT TYPE.
	 *
	 * <p>415 says „this address is here and takes something else", which is the leak
	 * {@link NothingIsHereRatherThanAlmost} exists against and the one branch it says it
	 * cannot close, because a media type refused while a handler is already running is
	 * raised far from {@code handleNoMatch}. Declared on the mapping instead, the request
	 * never matches and the dispatcher raises it where the portal's rule turns it into „no
	 * handler". {@code TeamWriteApi} measured this on 19.09.2026.
	 *
	 * <p><b>Asked of a signed in member</b>, because a stranger is refused 401 by the chain
	 * before any of it.
	 */
	@Test
	void aWriteThatNamesNoTypeIsAnAddressThatIsNotThere() throws Exception {
		MockHttpServletResponse answer = http.perform(put("/api/me").with(csrf())
						.content(change("  Tekst bez tipa.  ", null))
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(ME))))
				.andReturn().getResponse();

		assertThat(answer.getStatus())
				.as("a write with no content type was told which type this address wants, which is"
						+ " the same sentence as telling him the address is there")
				.isEqualTo(404);

		assertThat(http.perform(put("/api/zzzzzz").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookieOf(ME))))
				.andReturn().getResponse().getStatus())
				.as("an address that maps nothing no longer answers 404, so there is nothing being"
						+ " compared here")
				.isEqualTo(answer.getStatus());
	}
}

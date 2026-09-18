package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
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
 * GET /api/inbox: HIS OWN MESSAGES, PLUS EVERYTHING SENT TO THE WHOLE LEAGUE.
 *
 * <p><b>Three members and never two</b>, the same reason {@code WhoseMessageItIsTest}
 * gives: two would let "the addressee" and "the one asking" be told apart and nothing
 * more, and would let a filter comparing against one remembered id pass by accident.
 * {@link #ME}, {@link #HER} and {@link #A_THIRD} are never a message's only reader, only
 * one of its readers, and never the first row {@code account} or {@code competitor}
 * happens to hand back.
 *
 * <p><b>No message is the only one, no member is the only one, and nothing is dated
 * today.</b> Every {@code sent_at} below is a fixed timestamp on a different day, and the
 * fixture is written in an order that is neither the chronological order nor the order the
 * cases expect back, so the ordering case measures {@code order by sent_at desc} rather
 * than the order the rows happen to have been written in or the day the suite happened to
 * run.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class InboxApiTest {

	private static final String PATH = "/api/inbox";

	/** An address of the same length that maps nothing, for the 404 to be compared with. */
	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzz";

	private static final String ME = "000001";

	private static final String HER = "000002";

	private static final String A_THIRD = "000003";

	/** Signed in and holding no member behind the account at all - a moderator who does
	 *  not race, the ordinary case since 14.09.2026. */
	private static final String NO_MEMBER = "mod@primer.rs";

	/** Runs the bodies apart from one another and from every subject. */
	private int bodies = 1;

	private static final String TO_ME_READ = "Za mene, procitana";

	private static final String TO_ME_UNREAD = "Za mene, jos neprocitana";

	private static final String BROADCAST_SHE_READ = "Broadcast koji je ona procitala";

	private static final String BROADCAST_NOBODY_READ = "Broadcast koji niko nije procitao";

	private static final String ASKS_ABOUT_A_TEAM = "Poziv u tim";

	private static final String ASKS_ABOUT_A_PAIR = "Zahtev za trkacki par";

	private static final String TO_HER = "Za nju, nikad za mene";

	private static final String TO_A_THIRD = "Za trecu clanicu, nikad za mene ni za nju";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	/**
	 * THREE MEMBERS, SIX MESSAGES ACROSS SIX DIFFERENT DAYS, AND ONE ACCOUNT WITH NO
	 * MEMBER AT ALL.
	 *
	 * <p>Written in an order that matches none of the three orders that matter here -
	 * not {@code sent_at}, not the order the cases expect the answer in, and not the
	 * addressee - so no case below can be satisfied by a query that forgot the {@code
	 * where} or the {@code order by} and happened to agree with how this method was
	 * typed.
	 */
	@BeforeEach
	void threeMembersAndSixMessages() {
		competitor(ME, "Prva", "Clanica");
		competitor(HER, "Druga", "Clanica");
		competitor(A_THIRD, "Treca", "Clanica");

		account("ja@primer.rs", "competitor", "Prva", "Clanica");
		belongsTo("ja@primer.rs", ME);
		account("ona@primer.rs", "competitor", "Druga", "Clanica");
		belongsTo("ona@primer.rs", HER);
		account("treca@primer.rs", "competitor", "Treca", "Clanica");
		belongsTo("treca@primer.rs", A_THIRD);
		account(NO_MEMBER, "moderator", "Nikad", "Clan");

		team();
		teamInvitation(ME);
		pairInvite(HER, ME);

		message(ASKS_ABOUT_A_PAIR, ME, null, "Portal", "2026-08-05 09:00:00+00", null, pairInviteId());
		message(TO_HER, HER, ME, "Prva Clanica", "2026-07-20 09:00:00+00", null, null);
		message(BROADCAST_SHE_READ, null, null, "Portal", "2026-07-10 09:00:00+00", null, null);
		message(TO_ME_READ, ME, HER, "Druga Clanica", "2026-07-01 09:00:00+00", null, null);
		message(TO_A_THIRD, A_THIRD, null, "Portal", "2026-07-25 09:00:00+00", null, null);
		message(ASKS_ABOUT_A_TEAM, ME, null, "Portal", "2026-08-01 09:00:00+00", teamInvitationId(), null);
		message(BROADCAST_NOBODY_READ, null, null, "Portal", "2026-07-15 09:00:00+00", null, null);
		message(TO_ME_UNREAD, ME, HER, "Druga Clanica", "2026-07-05 09:00:00+00", null, null);

		markRead(BROADCAST_SHE_READ, HER);
		markRead(TO_ME_READ, ME);
	}

	private void competitor(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01', (select id from place where rank = 1),"
						+ " 2027, false, true, 'payment', ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, String.format("%016x", ++issued))
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

	/** The link V23 wrote down: this account IS that member. */
	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}

	private void team() {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values ('tim-za-sanduce', 'Tim za sanduce', '', '',"
						+ " (select id from place where rank = 1), null, null, null, 2027, null)")
				.update();
	}

	private void teamInvitation(String memberNumber) {
		db.sql("insert into team_invitation (team_id, competitor_id, season) values"
						+ " ((select id from team where slug = 'tim-za-sanduce'),"
						+ " (select id from competitor where member_number = ?), 2027)")
				.param(memberNumber).update();
	}

	private void pairInvite(String from, String to) {
		db.sql("insert into pair_invite (from_id, to_id) values"
						+ " ((select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(from, to).update();
	}

	private long teamInvitationId() {
		return db.sql("select id from team_invitation").query(Long.class).single();
	}

	private long pairInviteId() {
		return db.sql("select id from pair_invite").query(Long.class).single();
	}

	/** The database's own key for the message of this subject, compared rather than
	 *  trusted, the same reason {@link #teamInvitationId()} and {@link #pairInviteId()}
	 *  are read off the row instead of remembered. */
	private long messageId(String subject) {
		return db.sql("select id from message where subject = ?").param(subject)
				.query(Long.class).single();
	}

	/** The database's own text for the message of this subject, so a comparison can ask
	 *  whether the answer carries THIS row's body rather than merely something shaped
	 *  like one. */
	private String bodyOf(String subject) {
		return db.sql("select body from message where subject = ?").param(subject)
				.query(String.class).single();
	}

	/**
	 * @param toNumber   who it is for, or {@code null} for the whole league - a
	 *                   {@code member_number} that matches no row is exactly what a null
	 *                   parameter produces, so the subquery itself turns "nobody" into the
	 *                   empty addressee V13 gives the league
	 * @param fromNumber who sent it, or {@code null} for the portal itself
	 */
	private void message(String subject, String toNumber, String fromNumber, String fromName,
			String sentAt, Long teamInvitationId, Long pairInviteId) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body, sent_at,"
						+ " team_invitation_id, pair_invite_id) values ("
						+ "(select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?),"
						+ " ?, ?, ?, timestamptz '" + sentAt + "', ?, ?)")
				/* THE BODY IS ITS OWN TEXT AND NOT THE SUBJECT REPHRASED. An earlier draft
				   built it as "Tekst poruke: " + subject, which made `body` vary only
				   because `subject` varied - two names for one source, so a query reading
				   the subject where the body belongs still gave a list where no field was
				   constant. The floor below cannot see that; only a comparison against
				   text nobody else carries can. The number is arbitrary and deliberately
				   unlike anything in the subject. */
				.params(toNumber, fromNumber, fromName, subject,
						"Telo " + (bodies++) + ", i ono nije naslov.", teamInvitationId,
						pairInviteId)
				.update();
	}

	private void markRead(String subject, String byMemberNumber) {
		db.sql("insert into message_read (message_id, competitor_id) values"
						+ " ((select id from message where subject = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(subject, byMemberNumber).update();
	}

	private MockHttpServletRequestBuilder asking(String email) {
		MockHttpServletRequestBuilder asks = get(PATH);
		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private int statusOf(String path, String email) throws Exception {
		MockHttpServletRequestBuilder asks = get(path);
		if (email != null) {
			asks = asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
		}
		return http.perform(asks).andReturn().getResponse().getStatus();
	}

	private String whole(String email) throws Exception {
		return http.perform(asking(email)).andReturn().getResponse().getContentAsString();
	}

	private JsonNode answer(String email) throws Exception {
		return new ObjectMapper().readTree(whole(email));
	}

	private List<String> subjectsServedTo(String email) throws Exception {
		List<String> out = new ArrayList<>();
		for (JsonNode one : answer(email)) {
			out.add(one.path("subject").asString());
		}
		return out;
	}

	private JsonNode item(String email, String subject) throws Exception {
		for (JsonNode one : answer(email)) {
			if (subject.equals(one.path("subject").asString())) {
				return one;
			}
		}
		throw new AssertionError(PATH + " did not answer " + email + " with " + subject);
	}

	/**
	 * A VISITOR WHO IS NOT SIGNED IN IS ASKED TO SIGN IN, NOT TOLD THERE IS NOTHING HERE.
	 *
	 * <p>Already measured for every mapped route by
	 * {@code ApiSecurityTest.everyRouteNobodyOpenedIsARouteNobodyCanRead}; kept here too,
	 * in the same file as the fixture that proves a real member is served 200, so the
	 * refusal above is not read as "this resource refuses everybody".
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsRefused() throws Exception {
		assertThat(statusOf(PATH, null)).isEqualTo(401);
		assertThat(statusOf(PATH, "ja@primer.rs")).isEqualTo(200);
	}

	/**
	 * AN ACCOUNT WITH NO MEMBER BEHIND IT IS TOLD THE ADDRESS IS NOT THERE.
	 *
	 * <p>The header only ever shows the envelope beside a signed in member
	 * ({@code memberNumber !== null}, {@code app/Shell.tsx}); a moderator who does not
	 * race has no row in {@code competitor} and therefore no inbox, not an empty one.
	 */
	@Test
	void anAccountWithNoMemberBehindItIsToldTheAddressIsNotThere() throws Exception {
		assertThat(statusOf(PATH, NO_MEMBER))
				.as("an account naming no member was served an inbox, or told one exists")
				.isEqualTo(statusOf(NOTHING_IS_THERE, NO_MEMBER));

		assertThat(whole(NO_MEMBER))
				.as("the refusal carried a body, which an address that is not there would not have")
				.isEmpty();
	}

	/**
	 * HIS OWN MESSAGES AND EVERY BROADCAST ARE HIS; SOMEBODY ELSE'S NAMED MESSAGE NEVER
	 * IS, NOT EVEN AS A SUBSTRING OF THE ANSWER.
	 *
	 * <p>The decision this measures: „poruka sme da bude adresirana na jednog clana ili
	 * na celu ligu, i prazan primalac znaci cela liga." A filter written against either
	 * half alone - only his own, or only the empty addressee - would be right about half
	 * of what is really in his inbox and wrong about the other half without a single red
	 * case, which is why both halves and both kinds of exclusion are asked here together.
	 */
	@Test
	void theInboxHoldsHisOwnAndEveryBroadcastButNeverSomebodyElses() throws Exception {
		assertThat(subjectsServedTo("ja@primer.rs"))
				.as("a message addressed to him by name did not reach his own inbox")
				.contains(TO_ME_READ, TO_ME_UNREAD)
				.as("a broadcast, read or not, did not reach a member it was never addressed away from")
				.contains(BROADCAST_SHE_READ, BROADCAST_NOBODY_READ)
				.as("a message addressed to somebody else by name reached this member anyway")
				.doesNotContain(TO_HER, TO_A_THIRD);

		assertThat(subjectsServedTo("ona@primer.rs"))
				.as("her own message did not reach her own inbox")
				.contains(TO_HER)
				.contains(BROADCAST_SHE_READ, BROADCAST_NOBODY_READ)
				.as("a message addressed to another member by name reached this one instead")
				.doesNotContain(TO_ME_READ, TO_ME_UNREAD, TO_A_THIRD);

		assertThat(whole("ja@primer.rs"))
				.as("the body of a message that is never his sat in his answer as text, even if no"
						+ " field of the served shape happened to carry it")
				.doesNotContain(bodyOf(TO_HER))
				.doesNotContain(bodyOf(TO_A_THIRD));
	}

	/**
	 * READ IS PERSONAL, EVEN ON A MESSAGE EVERYBODY SHARES.
	 *
	 * <p>The rule this project wrote down about exactly this shape: a case where „the
	 * whole league" and „this one member" produce the same visible fact measures
	 * nothing, so the setup here gives one broadcast a reader who is NOT the one asking
	 * (`message_read` names her, not him) and asks his copy of it separately.
	 */
	@Test
	void readingABroadcastIsPersonalAndDoesNotMarkItReadForAnybodyElse() throws Exception {
		assertThat(item("ja@primer.rs", TO_ME_READ).path("read").asBoolean())
				.as("a message he has a row in message_read for came back unread")
				.isTrue();
		assertThat(item("ja@primer.rs", TO_ME_UNREAD).path("read").asBoolean())
				.as("a message nobody has read for him came back read")
				.isFalse();

		assertThat(item("ja@primer.rs", BROADCAST_SHE_READ).path("read").asBoolean())
				.as("a broadcast only SHE has read came back read for HIM, so reading it is being"
						+ " decided by whether anybody at all has, not by whether he has")
				.isFalse();
		assertThat(item("ona@primer.rs", BROADCAST_SHE_READ).path("read").asBoolean())
				.as("the same broadcast, read by her, came back unread in her own answer")
				.isTrue();

		assertThat(item("ja@primer.rs", BROADCAST_NOBODY_READ).path("read").asBoolean())
				.as("a broadcast nobody has read came back read for him")
				.isFalse();
	}

	/**
	 * NEWEST FIRST, MEASURED ACROSS SIX DIFFERENT DAYS WRITTEN IN A SEVENTH ORDER.
	 *
	 * <p>{@code SessionProvider.tsx}: „Newest first, so what just arrived is at the top
	 * of the panel and of the inbox." None of the six messages his inbox holds share a
	 * day, and the fixture writes them in an order that matches neither this one nor the
	 * order they were typed above it, so this measures {@code order by} and not luck.
	 */
	@Test
	void newestMessagesComeFirst() throws Exception {
		assertThat(subjectsServedTo("ja@primer.rs")).containsExactly(ASKS_ABOUT_A_PAIR, ASKS_ABOUT_A_TEAM,
				BROADCAST_NOBODY_READ, BROADCAST_SHE_READ, TO_ME_UNREAD, TO_ME_READ);
	}

	/**
	 * THE DAY IS THE DAY IN BELGRADE, NOT ON THE MACHINE THIS SUITE HAPPENS TO RUN ON.
	 *
	 * <p>{@code pom.xml} pins every test's JVM to {@code America/Los_Angeles} on purpose -
	 * neither the league's own zone nor UTC - precisely so a query that read
	 * {@code ZoneId.systemDefault()} instead of {@link SeasonClock#ZONE} would answer a
	 * different day and be caught here. The instant below is the same one
	 * {@code VerificationApiTest} and {@code AttendanceApiTest} already measured to
	 * separate the three: half past ten at night in UTC on 14 September is already the
	 * 15th in Belgrade, and still the 14th in plain UTC and in Los Angeles, which are the
	 * two zones this method could wrongly read.
	 */
	@Test
	void theDayIsTheDayInBelgradeAndNotOnTheMachineRunningTheSuite() throws Exception {
		message("Poslato uvece po srednjoevropskom", ME, null, "Portal", "2026-09-14 22:30:00+00",
				null, null);

		assertThat(item("ja@primer.rs", "Poslato uvece po srednjoevropskom").path("date").asString())
				.as("an instant that is 22:30 UTC on the 14th, and already the 15th in Belgrade, was"
						+ " dated the 14th - the day in UTC or in Los Angeles rather than the league's own")
				.isEqualTo("2026-09-15");
	}

	/**
	 * A MESSAGE THAT ASKS CARRIES THE BARE IDENTITY OF WHAT IT ASKS ABOUT, AND A PLAIN
	 * MESSAGE CARRIES NEITHER.
	 *
	 * <p>{@code MessageDetail.tsx} reads {@code message.invitation} /
	 * {@code message.pairInvite} off this same list to decide whether to draw an answer
	 * at all, so both have to be the row's own foreign key and not, say, a boolean saying
	 * only that one of the two is set - the two screens that read them are different
	 * screens ({@code session/context.ts}: „the compiler is then the thing that keeps
	 * them apart").
	 */
	@Test
	void aMessageThatAsksCarriesTheBareIdentityOfWhatItAsksAbout() throws Exception {
		assertThat(item("ja@primer.rs", ASKS_ABOUT_A_TEAM).path("teamInvitationId").asLong())
				.isEqualTo(teamInvitationId());
		assertThat(item("ja@primer.rs", ASKS_ABOUT_A_TEAM).path("pairInviteId").isNull())
				.as("a message about a team invitation also carried a pair invite id")
				.isTrue();

		assertThat(item("ja@primer.rs", ASKS_ABOUT_A_PAIR).path("pairInviteId").asLong())
				.isEqualTo(pairInviteId());
		assertThat(item("ja@primer.rs", ASKS_ABOUT_A_PAIR).path("teamInvitationId").isNull())
				.as("a message about a pair invite also carried a team invitation id")
				.isTrue();

		assertThat(item("ja@primer.rs", TO_ME_READ).path("teamInvitationId").isNull())
				.as("a plain message that asks nothing carried a team invitation id")
				.isTrue();
		assertThat(item("ja@primer.rs", TO_ME_READ).path("pairInviteId").isNull())
				.as("a plain message that asks nothing carried a pair invite id")
				.isTrue();
	}

	/**
	 * EVERY FIELD THE PORTAL DRAWS BY IS ANSWERED, AND {@code to} NEVER LEAVES.
	 *
	 * <p>{@code MessagesMenu}, {@code Messages} and {@code MessageDetail} together read
	 * id, from, subject, body, date, read and the two question ids off {@code Message} -
	 * see {@code InboxApi}'s own note on each. {@code to} is not among them: no screen
	 * reads it, the filter above already spent it deciding whether a row belongs in this
	 * answer at all, and serving it back would be one column of "just in case".
	 */
	@Test
	void everyFieldAScreenReadsIsAnsweredAndTheAddresseeNeverLeaves() throws Exception {
		assertThat(Answers.fieldsOf(item("ja@primer.rs", TO_ME_READ)))
				.containsExactlyInAnyOrder("id", "from", "subject", "body", "date", "read",
						"teamInvitationId", "pairInviteId");
	}

	/**
	 * AND NO FIELD OF THE ANSWER IS THE SAME IN EVERY MESSAGE, which is the floor every
	 * other list of this API stands on and this one was delivered without.
	 *
	 * <p><b>What its absence let through, measured rather than imagined.</b> A query
	 * answering {@code 0} for every {@code id} and the BODY in place of the sender
	 * passed the whole gate, 1787 cases green. A member would then see every message
	 * under one identifier - each row leading to the same screen, and a read mark
	 * written against message zero - and read the text of the message where the sender's
	 * name belongs. P23 is what makes that name load-bearing: the pointer empties, the
	 * name does not.
	 *
	 * <p>The case above compares the NAMES of the fields and this one their VALUES, and
	 * neither one stands for the other: names cannot see a column read for another
	 * column, and values cannot see a field that stopped being answered at all.
	 */
	@Test
	void noFieldOfTheInboxIsTheSameInEveryMessage() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/inbox", answer("ja@primer.rs"));
	}

	/**
	 * AND EACH OF THE FOUR IS THE COLUMN IT SAYS IT IS, {@code id} compared with the
	 * database's own key for this row and the rest with text nothing else in the answer
	 * carries.
	 *
	 * <p><b>Why the floor above is not enough, measured rather than argued.</b> It says
	 * only that no field is a CONSTANT. With it in place, {@code from := body} still
	 * passed the whole gate, 1790 cases green: a member would read the text of the
	 * message where the sender's name belongs, on both screens that draw it. The floor
	 * cannot see a column read for another column; it never asks whose value a field
	 * carries. {@code id} fell through the same gap a different way: {@code id :=
	 * team_invitation_id} answers {@code 0} for five of his six messages and the one
	 * invitation's own id for the sixth, and two distinct values already satisfy "not a
	 * constant" - the whole gate stayed green, 1791 cases.
	 *
	 * <p>So this case names them. {@code id} is the row's own primary key, {@code from}
	 * is a person, {@code subject} is a title and {@code body} is a text that is none of
	 * those three - four sources that cannot stand in for one another, which is why the
	 * fixture stopped deriving the body from the subject in the commit that first wrote
	 * three of these four comparisons. {@code id} is compared with the database's own key
	 * for this exact row, the same way
	 * {@link #aMessageThatAsksCarriesTheBareIdentityOfWhatItAsksAbout} compares
	 * {@code teamInvitationId} and {@code pairInviteId} rather than trusting a shape.
	 * {@code body} is compared the identical way now and not by its shape any more: a
	 * query that reads a neighbouring row's body still spells "Telo N, i ono nije
	 * naslov." for some other N, so {@code startsWith}/{@code endsWith} could not tell
	 * one member's own text from the row beside it. {@code CommentApiTest} compares its
	 * body against literal text for the identical reason.
	 */
	@Test
	void theIdTheSenderTheTitleAndTheTextAreEachTheirOwnColumn() throws Exception {
		JsonNode one = item("ja@primer.rs", TO_ME_READ);

		assertThat(one.path("id").asLong())
				.as("`id` does not carry this message's own primary key")
				.isEqualTo(messageId(TO_ME_READ));
		assertThat(one.path("from").asString())
				.as("`from` does not carry the name of whoever sent it")
				.isEqualTo("Druga Clanica");
		assertThat(one.path("subject").asString())
				.as("`subject` does not carry the title of the message")
				.isEqualTo(TO_ME_READ);
		assertThat(one.path("body").asString())
				.as("`body` does not carry this message's own text; a column is being read"
						+ " in place of another, possibly this same row's neighbour")
				.isEqualTo(bodyOf(TO_ME_READ));
	}
}

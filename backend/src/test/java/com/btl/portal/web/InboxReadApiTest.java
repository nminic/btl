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
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * POST /api/inbox/{id}/read: OPENING A MESSAGE IS WHAT MAKES IT READ, AND NOTHING ELSE DOES.
 *
 * <p><b>SIX MESSAGES, SO NEITHER A BROADCAST NOR THE ONE UNDER TEST IS THE ONLY ONE OF ITS
 * KIND.</b> Two broadcasts exist so that marking one read cannot be confused with marking „the"
 * broadcast, and {@link #RECIPIENT} holds two private messages of his own so that this route
 * marking the one named by {@code id} cannot be confused with marking "his next unread one" or
 * "his first one". {@link #TARGET} - the message every case below marks read - is neither the
 * first row in {@code message} nor {@link #RECIPIENT}'s first message, so a query built off
 * {@code min(id)} or off "whichever of his is oldest" fails every case that reads it back.
 *
 * <p><b>FOUR MEMBERS, AND THE FIRST BY KEY IS PARTY TO NOTHING UNDER TEST.</b>
 * {@link #A_STRANGER} holds the lowest key in both {@code competitor} and {@code account} and
 * never signs in below; a lookup keyed off "the first account" or "the first competitor" rather
 * than the session would name him instead of whoever is really asking.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class InboxReadApiTest {

	/** First by key in {@code competitor} and in {@code account}, and party to nothing below. */
	private static final String A_STRANGER = "000011";

	private static final String RECIPIENT = "000022";

	private static final String SENDER = "000033";

	/** Addressee of a private message of his own, and never {@link #RECIPIENT}'s. */
	private static final String THIRD = "000044";

	private static final String STRANGER_SIGNS_IN = "stranac@primer.rs";

	private static final String RECIPIENT_SIGNS_IN = "prima@primer.rs";

	private static final String SENDER_SIGNS_IN = "salje@primer.rs";

	private static final String THIRD_SIGNS_IN = "treci@primer.rs";

	/** Signed in and holding no member behind the account at all - a moderator who does not race. */
	private static final String NO_MEMBER = "mod@primer.rs";

	private static final String TO_STRANGER = "Prva poruka u celoj tabeli";

	private static final String TO_RECIPIENT_EARLIER = "Sta je primalac vec imao pre mete";

	private static final String BROADCAST_ONE = "Prvo obavestenje cele lige";

	/** The message every case below opens. Neither the first row nor his first message. */
	private static final String TARGET = "Prevoz do Zlatibora";

	private static final String TO_THIRD = "Poruka za treceg clana";

	private static final String BROADCAST_TWO = "Drugo obavestenje cele lige";

	/** A key of the right shape that no message in this fixture ever takes. */
	private static final long NONEXISTENT_MESSAGE = 999_999L;

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	@BeforeEach
	void fourMembersAndSixMessages() {
		competitor(A_STRANGER, "Ana", "Prva");
		competitor(RECIPIENT, "Bojana", "Druga");
		competitor(SENDER, "Vesna", "Treca");
		competitor(THIRD, "Gordana", "Cetvrta");

		account(STRANGER_SIGNS_IN, "competitor", "Nalog", "Strancev");
		belongsTo(STRANGER_SIGNS_IN, A_STRANGER);
		account(RECIPIENT_SIGNS_IN, "competitor", "Nalog", "Primaocev");
		belongsTo(RECIPIENT_SIGNS_IN, RECIPIENT);
		account(SENDER_SIGNS_IN, "competitor", "Nalog", "Posiljaocev");
		belongsTo(SENDER_SIGNS_IN, SENDER);
		account(THIRD_SIGNS_IN, "competitor", "Nalog", "Treceg");
		belongsTo(THIRD_SIGNS_IN, THIRD);
		account(NO_MEMBER, "moderator", "Nikad", "Clan");

		/* ORDER MATTERS: TARGET IS NEITHER FIRST IN THE TABLE NOR FIRST OF RECIPIENT'S OWN. */
		message(TO_STRANGER, A_STRANGER, null);
		message(TO_RECIPIENT_EARLIER, RECIPIENT, null);
		message(BROADCAST_ONE, null, null);
		message(TARGET, RECIPIENT, SENDER);
		message(TO_THIRD, THIRD, SENDER);
		message(BROADCAST_TWO, null, null);
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

	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}

	/**
	 * @param toNumber   who it is for, or {@code null} for the whole league
	 * @param fromNumber who sent it, or {@code null} for the portal itself
	 */
	private void message(String subject, String toNumber, String fromNumber) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body) values"
						+ " ((select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?), 'Portal', ?,"
						+ " 'Telo, i ono nije naslov.')")
				.params(toNumber, fromNumber, subject)
				.update();
	}

	private long keyOf(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	private long idOf(String subject) {
		return db.sql("select id from message where subject = ?").param(subject)
				.query(Long.class).single();
	}

	private long messageReadRows() {
		return db.sql("select count(*) from message_read").query(Long.class).single();
	}

	private boolean wasMarkedReadBy(String subject, String memberNumber) {
		return db.sql("select count(*) from message_read where message_id = ? and competitor_id = ?")
				.params(idOf(subject), keyOf(memberNumber))
				.query(Long.class).single() > 0;
	}

	private Instant readAt(String subject, String memberNumber) {
		return db.sql("select read_at from message_read where message_id = ? and competitor_id = ?")
				.params(idOf(subject), keyOf(memberNumber))
				.query(Timestamp.class).single().toInstant();
	}

	private MockHttpServletResponse marking(String email, long id) throws Exception {
		MockHttpServletRequestBuilder asking = post("/api/inbox/" + id + "/read").with(csrf());

		if (email != null) {
			asking = asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
		}

		return http.perform(asking).andReturn().getResponse();
	}

	/** What the READING half of this resource serves somebody, which is where a message ends. */
	private MockHttpServletResponse reading(String email) throws Exception {
		return http.perform(get("/api/inbox")
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}

	private Map<String, Boolean> readFlagsOf(String email) throws Exception {
		Map<String, Boolean> flags = new LinkedHashMap<>();

		for (JsonNode one : mapper.readTree(reading(email).getContentAsString())) {
			flags.put(one.path("subject").asString(), one.path("read").asBoolean());
		}

		return flags;
	}

	/**
	 * A VISITOR WHO IS NOT SIGNED IN IS ASKED TO SIGN IN, AND A MEMBER IS SERVED.
	 *
	 * <p>The token is carried on purpose, exactly as {@code InboxWriteApiTest} carries it: a
	 * {@code POST} with no CSRF token is refused 403 before anybody has decided who is asking,
	 * and this case would then pass on a 403 with the door behind it wide open.
	 */
	@Test
	void aVisitorWhoIsNotSignedInIsRefusedAndAMemberIsNot() throws Exception {
		long target = idOf(TARGET);

		assertThat(marking(null, target).getStatus()).isEqualTo(401);
		assertThat(marking(RECIPIENT_SIGNS_IN, target).getStatus()).isEqualTo(204);
	}

	/**
	 * AN ACCOUNT WITH NO MEMBER BEHIND IT IS TOLD THE ADDRESS IS NOT THERE, IN THE SAME WORDS
	 * THE READING HALF OF THIS RESOURCE USES.
	 *
	 * <p>V23 lets {@code account.competitor_id} be null for „a moderator who does not race,
	 * which is the ordinary case and not a fault", and there is nobody to mark anything read
	 * for. Compared with what {@code GET /api/inbox} answers him rather than with the bare
	 * number 404, because the whole point is that he cannot tell this address from one that
	 * does not exist for him at all.
	 */
	@Test
	void anAccountWithNoMemberBehindItIsToldTheAddressIsNotThere() throws Exception {
		MockHttpServletResponse refused = marking(NO_MEMBER, idOf(TARGET));
		MockHttpServletResponse readingRefused = reading(NO_MEMBER);

		assertThat(refused.getStatus())
				.as("an account naming no member marked a message read, or was told this"
						+ " address exists")
				.isEqualTo(readingRefused.getStatus())
				.isEqualTo(404);
		assertThat(refused.getContentAsString())
				.as("the refusal carried a body, which an address that is not there would not")
				.isEqualTo(readingRefused.getContentAsString())
				.isEmpty();

		assertThat(messageReadRows())
				.as("something was written for an account that names no member")
				.isZero();
	}

	/**
	 * A MEMBER WHO IS NOT THE ADDRESSEE IS REFUSED EXACTLY AS A MESSAGE THAT DOES NOT EXIST
	 * IS, BYTE FOR BYTE.
	 *
	 * <p>ADL A8: a signed in caller who lacks the right is told the identical nothing an
	 * address that is not there tells him, never 403. {@link #THIRD} is party to a message of
	 * his own ({@link #TO_THIRD}) - so this is not a member with an empty inbox learning
	 * nothing by default - and {@link #TARGET} is addressed to {@link #RECIPIENT} and to
	 * nobody else.
	 */
	@Test
	void aMemberWhoIsNotTheAddresseeIsRefusedExactlyAsAMissingMessageIs() throws Exception {
		MockHttpServletResponse somebodyElses = marking(THIRD_SIGNS_IN, idOf(TARGET));
		MockHttpServletResponse doesNotExist = marking(THIRD_SIGNS_IN, NONEXISTENT_MESSAGE);

		assertThat(somebodyElses.getStatus())
				.as("a message addressed to somebody else was refused differently from one"
						+ " that does not exist, so the difference says which ids are taken")
				.isEqualTo(doesNotExist.getStatus())
				.isEqualTo(404);
		assertThat(somebodyElses.getContentAsString())
				.isEqualTo(doesNotExist.getContentAsString())
				.isEmpty();

		assertThat(messageReadRows())
				.as("a message was marked read by somebody it was not addressed to, or a"
						+ " nonexistent message was marked read by somebody")
				.isZero();
	}

	/**
	 * A MEMBER WITH MESSAGES OF HIS OWN IS REFUSED THE SAME WAY FOR AN ID THAT NAMES NOTHING.
	 *
	 * <p>{@link #RECIPIENT} owns two real messages, so this is not merely „an empty inbox
	 * refuses everything" - a route that checked only „does he own at least one message"
	 * rather than the specific {@code id} would pass this member and fail only a stranger.
	 */
	@Test
	void aMemberWithMessagesOfHisOwnIsRefusedForAnIdThatNamesNoMessage() throws Exception {
		MockHttpServletResponse refused = marking(RECIPIENT_SIGNS_IN, NONEXISTENT_MESSAGE);

		assertThat(refused.getStatus()).isEqualTo(404);
		assertThat(refused.getContentAsString()).isEmpty();
		assertThat(messageReadRows()).isZero();
	}

	/**
	 * OPENING HIS OWN MESSAGE MARKS IT READ, AND NONE OF HIS OTHER MESSAGES.
	 *
	 * <p>{@link #RECIPIENT} holds a second message ({@link #TO_RECIPIENT_EARLIER}) that this
	 * call never names, so a route acting on „his next unread one" rather than on the
	 * {@code id} in the path would mark the wrong row and this case would catch it both ways:
	 * in {@code message_read} directly and in what {@code GET /api/inbox} then shows him.
	 */
	@Test
	void openingHisOwnMessageMarksOnlyThatOneReadAndTheInboxSaysSo() throws Exception {
		assertThat(marking(RECIPIENT_SIGNS_IN, idOf(TARGET)).getStatus()).isEqualTo(204);

		assertThat(wasMarkedReadBy(TARGET, RECIPIENT)).isTrue();
		assertThat(wasMarkedReadBy(TO_RECIPIENT_EARLIER, RECIPIENT))
				.as("opening one message marked a different message of his read too")
				.isFalse();

		Map<String, Boolean> flags = readFlagsOf(RECIPIENT_SIGNS_IN);
		assertThat(flags.get(TARGET))
				.as("the message just opened is not shown as read on his own inbox")
				.isTrue();
		assertThat(flags.get(TO_RECIPIENT_EARLIER))
				.as("a message that was not opened is shown as read anyway")
				.isFalse();
	}

	/**
	 * OPENING IT A SECOND TIME CHANGES NOTHING: NO ERROR, NO SECOND ROW, NO NEW {@code read_at}.
	 *
	 * <p>{@code message_read_pk} is {@code (message_id, competitor_id)}, so a route that
	 * inserted without {@code on conflict} would answer a duplicate-key failure on the second
	 * call rather than the same success, and one that updated {@code read_at} unconditionally
	 * would move the moment every time the member reopens a message he has already read - the
	 * decision under test names neither a button to unmark nor a reason to move the clock.
	 */
	@Test
	void openingItASecondTimeChangesNothing() throws Exception {
		long target = idOf(TARGET);

		assertThat(marking(RECIPIENT_SIGNS_IN, target).getStatus()).isEqualTo(204);
		Instant firstReadAt = readAt(TARGET, RECIPIENT);

		assertThat(marking(RECIPIENT_SIGNS_IN, target).getStatus())
				.as("opening an already read message failed instead of doing nothing")
				.isEqualTo(204);

		assertThat(db.sql("select count(*) from message_read where message_id = ? and competitor_id = ?")
						.params(target, keyOf(RECIPIENT)).query(Long.class).single())
				.as("a second row appeared for one message and one reader")
				.isEqualTo(1);
		assertThat(readAt(TARGET, RECIPIENT))
				.as("read_at moved on a second call, so a read receipt would say when a"
						+ " message was last reopened rather than when it was first read")
				.isEqualTo(firstReadAt);
	}

	/**
	 * A BROADCAST IS MARKED READ FOR THE ONE MEMBER WHO OPENED IT, AND FOR NOBODY ELSE.
	 *
	 * <p>V13's own note on {@code message_read}: unread is the absence of a row, which is what
	 * lets an announcement reach every member without a row per member the moment it is sent.
	 * A second broadcast ({@link #BROADCAST_TWO}) sits in the fixture untouched, so a route
	 * that matched „any broadcast" rather than the {@code id} in the path would mark it too and
	 * this case would catch that as well as the narrower confusion between readers.
	 */
	@Test
	void theBroadcastIsMarkedReadForTheOneReaderAndNobodyElse() throws Exception {
		assertThat(marking(SENDER_SIGNS_IN, idOf(BROADCAST_ONE)).getStatus()).isEqualTo(204);

		assertThat(wasMarkedReadBy(BROADCAST_ONE, SENDER)).isTrue();
		assertThat(wasMarkedReadBy(BROADCAST_ONE, RECIPIENT))
				.as("one member opening the league's announcement marked it read for another")
				.isFalse();
		assertThat(wasMarkedReadBy(BROADCAST_ONE, THIRD)).isFalse();
		assertThat(wasMarkedReadBy(BROADCAST_TWO, SENDER))
				.as("opening one broadcast marked a different broadcast read too")
				.isFalse();

		assertThat(readFlagsOf(RECIPIENT_SIGNS_IN).get(BROADCAST_ONE))
				.as("the announcement shows as read on a screen that never opened it")
				.isFalse();
	}
}

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
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * GET /api/me/notifications: THE SIX SWITCHES P22 GIVES A MEMBER OVER THE BELL'S MAIL.
 *
 * <p><b>Two members and never one</b>, so a query that answered with a constant row, or
 * one that read {@code account_id} where it should read {@code competitor_id}, has
 * somebody to disagree with it. Neither of the two has all six switches alike: the one who
 * has touched the panel has three on and three off in an alternating pattern, so a query
 * that swapped any two of the six columns changes at least one of the six fields this case
 * checks by name, and a query that answered every switch with the same literal fails on
 * sight.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class NotificationApiTest {

	private static final String PATH = "/api/me/notifications";

	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzz";

	private static final String NEVER_VISITED_SETTINGS = "000004";

	private static final String TOUCHED_EVERY_SWITCH = "000005";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	@BeforeEach
	void twoMembersAndOneModerator() {
		competitor(NEVER_VISITED_SETTINGS, "Nikad", "Nije Otvorila");
		competitor(TOUCHED_EVERY_SWITCH, "Dodirnula", "Sve Prekidace");

		account("nikad@primer.rs", "competitor", "Nikad", "Nije Otvorila");
		belongsTo("nikad@primer.rs", NEVER_VISITED_SETTINGS);
		account("dodirnula@primer.rs", "competitor", "Dodirnula", "Sve Prekidace");
		belongsTo("dodirnula@primer.rs", TOUCHED_EVERY_SWITCH);
		account("mod@primer.rs", "moderator", "Nikad", "Clan");

		/* Alternating on purpose: every neighbouring pair of columns differs, so a query
		   that read column N+1 where it should read column N answers at least one of the
		   six fields wrong. */
		db.sql("insert into notification_setting (competitor_id, comment_mail, team_mail,"
						+ " pair_mail, lift_mail, badge_mail, inbox_mail) values"
						+ " ((select id from competitor where member_number = ?),"
						+ " true, false, true, false, true, false)")
				.param(TOUCHED_EVERY_SWITCH)
				.update();
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

	/** Already measured for every mapped route by {@code ApiSecurityTest}; kept here beside
	 *  the fixture that proves a real member is served 200, so it is not read as a refusal
	 *  of everybody. */
	@Test
	void aVisitorWhoIsNotSignedInIsRefused() throws Exception {
		assertThat(statusOf(PATH, null)).isEqualTo(401);
		assertThat(statusOf(PATH, "nikad@primer.rs")).isEqualTo(200);
	}

	/**
	 * AN ACCOUNT WITH NO MEMBER BEHIND IT HAS NO SWITCHES TO READ.
	 *
	 * <p>{@code Settings.tsx} is only ever reached from behind the same
	 * {@code memberNumber !== null} gate the inbox is; a moderator who does not race is
	 * answered the same way an address that maps nothing is.
	 */
	@Test
	void anAccountWithNoMemberBehindItIsToldTheAddressIsNotThere() throws Exception {
		assertThat(statusOf(PATH, "mod@primer.rs"))
				.as("an account naming no member was served settings, or told they exist")
				.isEqualTo(statusOf(NOTHING_IS_THERE, "mod@primer.rs"));

		assertThat(whole("mod@primer.rs"))
				.as("the refusal carried a body, which an address that is not there would not have")
				.isEmpty();
	}

	/**
	 * A MEMBER WHO HAS NEVER OPENED SETTINGS HAS EVERY SWITCH OFF, NOT AN ERROR.
	 *
	 * <p>Nothing writes {@code notification_setting} on registration, so this is the
	 * ordinary state for most members today. V13 defaults every column to {@code false}
	 * for a row that exists; this answers identically for the member who has no row at
	 * all, which P22's own reasoning demands - „mejl zamor ubija dostavljivost" does not
	 * stop applying to a member for the sole reason he has not yet opened the panel.
	 */
	@Test
	void aMemberWhoHasNeverVisitedSettingsHasEverySwitchOff() throws Exception {
		assertThat(db.sql("select count(*) from notification_setting where competitor_id ="
						+ " (select id from competitor where member_number = ?)")
						.param(NEVER_VISITED_SETTINGS).query(Integer.class).single())
				.as("this member already has a row, so a default answered for him proves nothing")
				.isZero();

		JsonNode settings = answer("nikad@primer.rs");

		assertThat(settings.path("commentMail").asBoolean()).isFalse();
		assertThat(settings.path("teamMail").asBoolean()).isFalse();
		assertThat(settings.path("pairMail").asBoolean()).isFalse();
		assertThat(settings.path("liftMail").asBoolean()).isFalse();
		assertThat(settings.path("badgeMail").asBoolean()).isFalse();
		assertThat(settings.path("inboxMail").asBoolean()).isFalse();
	}

	/**
	 * EACH OF THE SIX NAMES EXACTLY THE COLUMN V13 GIVES IT, IN AN ALTERNATING FIXTURE
	 * THAT CATCHES A COLUMN MOVED ONE SEAT.
	 */
	@Test
	void theSixSwitchesAnswerWithTheirOwnColumnAndNoneOfItsNeighbours() throws Exception {
		JsonNode settings = answer("dodirnula@primer.rs");

		assertThat(settings.path("commentMail").asBoolean()).as("comment_mail").isTrue();
		assertThat(settings.path("teamMail").asBoolean()).as("team_mail").isFalse();
		assertThat(settings.path("pairMail").asBoolean()).as("pair_mail").isTrue();
		assertThat(settings.path("liftMail").asBoolean()).as("lift_mail").isFalse();
		assertThat(settings.path("badgeMail").asBoolean()).as("badge_mail").isTrue();
		assertThat(settings.path("inboxMail").asBoolean()).as("inbox_mail").isFalse();
	}

	/**
	 * AND NOTHING BEYOND THE SIX IS ANSWERED - NOT THE STALE PROTOTYPE KEYS
	 * {@code resultApproved}, {@code resultChanged} or {@code newsletter}
	 * ({@code session/context.ts}), which P22 either forbids switching off or never
	 * mentions at all.
	 */
	@Test
	void onlyTheSixSwitchesP22ActuallyDecidedAreAnswered() throws Exception {
		assertThat(Answers.fieldsOf(answer("dodirnula@primer.rs")))
				.containsExactlyInAnyOrder("commentMail", "teamMail", "pairMail", "liftMail",
						"badgeMail", "inboxMail");
	}
}

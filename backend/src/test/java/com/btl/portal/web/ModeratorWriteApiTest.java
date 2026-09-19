package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import jakarta.mail.Address;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE SUPERADMIN MAKING A MODERATOR, TICKING HIS BOXES AND TAKING HIS MODERATORSHIP AWAY,
 * END TO END.
 *
 * <p><b>NOBODY AND NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on any axis an assertion
 * below reads a value along (the rule of 06.09.2026 and its correction the same afternoon,
 * that the axes are counted rather than guessed):
 *
 * <ul>
 * <li><b>Four moderators, and the one acted on is written SECOND</b>, so „the moderator
 * named" and „the first moderator" are different keys and a statement that dropped its
 * condition answers differently.
 * <li><b>TWO OF THE FOUR MODERATORS ALSO RACE AND TWO DO NOT</b>, which is the owner's own
 * requirement of 19.09.2026 - „postavka mora da ima moderatora koji JESTE takmicar i
 * moderatora koji NIJE, i da tvrdi razlicit ishod za svakoga" - and it is two of each
 * rather than one, so „the moderator who races" is never the only account naming a member.
 * <li><b>And the plain member's account names NOBODY</b>, on purpose: he is the account
 * both routes must refuse, and were he to name a member the role a lost condition would
 * write him is the role he already has, so the refusal and the write would read the same.
 * <li><b>Every address written by the fixture is written by name</b>, and the one the
 * invitation is asserted to reach is neither the first nor the last of them, so „his
 * mailbox" and „a mailbox" are different answers.
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
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		/* A PORT OF THIS CLASS'S OWN, which is `MailServerForACase`'s own measurement: three
		   classes sharing 3025 is a socket that has not finished letting go when the next
		   class binds, and the failure it produces reads as twenty nine caught mutations. */
		"spring.mail.port=3329",
		"spring.mail.properties.mail.smtp.auth=false",
		"btl.portal.address=https://probni-portal.primer.rs"})
@Transactional
class ModeratorWriteApiTest {

	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3329));

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

	/**
	 * The address the superadmin types when he makes somebody a moderator, and nobody in
	 * the fixture holds it.
	 *
	 * <p><b>It is typed in mixed case on purpose.</b> One address is one account whatever
	 * case it is typed in (owner, 08.09.2026), the row is written folded
	 * ({@code WhatAnAddressLooksLike.asItIsStored}), and what a telephone keyboard offers
	 * first is a capital letter. So „what was typed" and „what the row carries" are two
	 * different strings here, which is what makes every assertion below about the row an
	 * assertion about the row.
	 */
	private static final String INVITED = "Nova.Moderatorka@primer.rs";

	/** The same address as the account carries it, which is what the message is sent to. */
	private static final String INVITED_AS_STORED = "nova.moderatorka@primer.rs";

	/** Long enough and not on the shipped list, the same one {@code PasswordResetApiTest} uses. */
	private static final String THE_PASSWORD_HE_PICKS = "trcim.kroz.sumu.2027";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Value("${btl.portal.address}")
	private String portal;

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

		/* TWO OF THE FOUR MODERATORS ALSO RACE, which is the owner's requirement of
		   19.09.2026 that the fixture hold one of each - and two rather than one, so that
		   „the moderator who races" is not also „the only account that names a member".
		   `ACTED` is one of them and `FIRST_WRITTEN`, whom nothing acts on, is the other:
		   a statement that lost the key it was given would move a man who must not move,
		   and his role is read at the end of every case that strips anybody.

		   AND `A_MEMBER` DELIBERATELY NAMES NOBODY. He is the account both routes must
		   refuse, and the refusal is read off his role afterwards; given a member record
		   he would be left a `competitor` by the strip that must never reach him, which is
		   the role he already carries, and the two would be one value. */
		races(ACTED, "000801", "0011223344556681");
		races(FIRST_WRITTEN, "000802", "0011223344556682");

		ticked(ACTED, TAKEN_AWAY, LEFT_ALONE);
		ticked(FIRST_WRITTEN, THE_FIRST_ONES);
		ticked(ANOTHER, THE_THIRD_ONES);
		ticked(EVERY_TICK, everyRightThereIs().toArray(String[]::new));

		/* A TOKEN THAT IS NOBODY'S BUSINESS HERE, so the row the invitation writes is never
		   the only one in the table and „his token" and „a token" are two different
		   answers. It is read back untouched by the case that reads his. */
		db.sql("insert into password_reset_token (account_id, token_hash) values"
						+ " ((select id from account where email = ?), ?)")
				.params(ANOTHER, SOMEBODY_ELSES_TOKEN.hash()).update();
	}

	/** A token of another account's, minted once so both halves of a case can name it. */
	private static final SecretToken SOMEBODY_ELSES_TOKEN = SecretToken.fresh();

	/**
	 * This account is also a member of the league, which is the fact
	 * {@link ModeratorWriteApi#remove} reads to decide what he is left with.
	 *
	 * <p>The member's name is deliberately not the account's: „Ime i prezime nosi sam
	 * nalog" (owner, 14.09.2026) and the two are two facts about two things, so a
	 * statement reading the wrong one cannot pass behind a word they share.
	 */
	private void races(String email, String number, String referral) {
		long runner = competitor(number, referral);

		db.sql("update account set competitor_id = ? where email = ?")
				.params(runner, email).update();
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

	private MockHttpServletResponse make(String body, String asking) throws Exception {
		return http.perform(post("/api/moderators").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(body)
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(asking).secret())))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse make(String first, String last, String email) throws Exception {
		return make(invited(first, last, email), EVERYTHING);
	}

	private static String invited(String first, String last, String email) {
		return new ObjectMapper()
				.writeValueAsString(new ModeratorWriteApi.Invited(first, last, email));
	}

	/** What the ROW holds for one address, which is where every claim about a write lands. */
	private record Row(long id, String firstName, String lastName, String email, String role,
			String passwordHash, Instant addressConfirmedAt, Long competitorId) {
	}

	private Row rowOf(String email) {
		return db.sql("select a.id, a.first_name, a.last_name, a.email, r.code, a.password_hash,"
						+ " a.email_confirmed_at, a.competitor_id"
						+ " from account a join role r on r.id = a.role_id where a.email = ?")
				.param(email)
				.query((one, i) -> new Row(one.getLong(1), one.getString(2), one.getString(3),
						one.getString(4), one.getString(5), one.getString(6),
						one.getTimestamp(7) == null ? null : one.getTimestamp(7).toInstant(),
						one.getObject(8) == null ? null : one.getLong(8)))
				.single();
	}

	/** Which account one token opens, so „his token" is read off the row and not off a count. */
	private long whatTheTokenOpens(String secret) {
		return db.sql("select account_id from password_reset_token where token_hash = ?")
				.param(SecretToken.hashOf(secret)).query(Long.class).single();
	}

	private boolean theTokenIsStillUnspent(SecretToken token) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from password_reset_token"
						+ " where token_hash = ? and used_at is null)")
				.param(token.hash()).query(Boolean.class).single());
	}

	/** One message, waited for rather than looked for, the shape every mail case here uses. */
	private static MimeMessage theOneMessage() {
		assertThat(SMTP.waitForIncomingEmail(5000, 1))
				.as("no message reached the mail server in five seconds")
				.isTrue();
		assertThat(SMTP.getReceivedMessages())
				.as("more than one message went out for one invitation")
				.hasSize(1);

		return SMTP.getReceivedMessages()[0];
	}

	/**
	 * Who the message went to, and it is asked as „who ELSE" as much as „who".
	 *
	 * <p>A message addressed to every account of the fixture satisfies „he was told" just
	 * as well as one addressed to him, which is the rule of 06.09.2026 about a recipient.
	 */
	private static String theOnlyRecipientOf(MimeMessage message) throws Exception {
		Address[] to = message.getAllRecipients();

		assertThat(to).as("the message went to more than one mailbox, or to none").hasSize(1);

		return to[0].toString();
	}

	/** Kept local for the same reason {@code PasswordResetApiTest} keeps its own copy. */
	private static String theTokenInside(String body) {
		int at = body.indexOf("?token=");

		assertThat(at).as("the message carries no link at all:%n%s", body).isNotNegative();

		String rest = body.substring(at + "?token=".length());
		int ends = 0;

		while (ends < rest.length() && (Character.isLetterOrDigit(rest.charAt(ends))
				|| rest.charAt(ends) == '-' || rest.charAt(ends) == '_')) {
			ends++;
		}

		return rest.substring(0, ends);
	}

	private MockHttpServletResponse signIn(String email, String password) throws Exception {
		return http.perform(post("/api/sign-in").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(
								Map.of("email", email, "password", password))))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse setThePassword(String token, String password) throws Exception {
		return http.perform(post("/api/password-reset").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(Map.of("token", token,
								"password", password, "passwordRepeat", password))))
				.andReturn().getResponse();
	}

	/** What one cookie is answered at the one route every session of this portal is read by. */
	private MockHttpServletResponse me(String secret) throws Exception {
		return http.perform(get("/api/me").cookie(new Cookie(SessionCookie.NAME, secret)))
				.andReturn().getResponse();
	}

	private static String roleIn(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString()).path("role").asString();
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
				.as("a moderator with every tick stripped another moderator")
				.isEqualTo(404);
		assertThat(stillThere(ACTED))
				.as("the refusal was answered and the moderator's account disappeared anyway")
				.isTrue();
		assertThat(roleOf(ACTED))
				.as("the refusal was answered and his moderatorship went anyway - and since"
						+ " 19.09.2026 the account surviving no longer says it did not, because"
						+ " that is what a SUCCESSFUL strip leaves behind too")
				.isEqualTo("moderator");
		assertThat(ticksInTheTableOf(ACTED))
				.as("the refusal was answered and his boxes were emptied anyway")
				.containsExactlyInAnyOrder(TAKEN_AWAY, LEFT_ALONE);

		assertThat(save(accountOf(ACTED), List.of(GIVEN)).getStatus())
				.as("the superadmin was refused the same save, so the refusals above are routes"
						+ " that are shut to everybody rather than a guard that asks who")
				.isEqualTo(200);
		assertThat(remove(accountOf(ACTED)).getStatus())
				.as("the superadmin was refused the same delete")
				.isEqualTo(204);
	}

	/**
	 * A SUPERADMIN CANNOT TAKE HIS OWN RIGHTS AWAY HERE, AND CANNOT STRIP HIMSELF.
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
	void aSuperadminCannotTakeHisOwnRightsAwayNorStripHimself() throws Exception {
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
				.as("the superadmin reached his own row on the other route of this screen, and"
						+ " the portal would then hold one account fewer that may anything")
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
				.as("one superadmin stripped another although PDL P21, 14.09.2026 says no action"
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
	 * TAKING A MODERATORSHIP AWAY TAKES HIS TICKS, LEAVES HIS ACCOUNT AND HIS WAY IN, AND
	 * LEAVES EVERY OTHER MODERATOR STANDING.
	 *
	 * <p><b>The owner, 19.09.2026: „«Obrisi moderatora» skida ulogu i prava, a nalog
	 * ostaje."</b> Every line below was the opposite until that day, which is why the
	 * account, the session and the row itself are all read and not only the ticks: this is
	 * the case that fails the moment anybody writes {@code delete from account} here again.
	 *
	 * <p><b>The ticks are read because nothing else takes them now.</b>
	 * {@code account_admin_right_account_fk} cascades when the ACCOUNT goes (V18), and the
	 * account no longer goes, so „gubi... sve kucice" is a statement this route has to
	 * carry rather than a key that carries it.
	 *
	 * <p><b>And the session is read in the other direction, which is the half that is easy
	 * to lose.</b> His cookie still opens a session - what it is worth is decided fresh on
	 * every request, and the case below measures that it is worth nothing administratively
	 * - so a route that deleted his sessions „to be safe" would sign a competitor out of
	 * the portal the owner has just said he keeps.
	 *
	 * <p><b>Three other moderators are read afterwards</b>, one of whom holds every tick
	 * there is, so a statement with no condition - or one emptying every row of the matrix
	 * rather than his - answers differently. The one stripped is written second, so the
	 * lowest key is not the right answer either, and the first one written also races, so
	 * a statement that lost its key would be caught by his role as well as by his ticks.
	 */
	@Test
	void strippingAModeratorTakesHisTicksAndLeavesHisAccountAndNobodyElses() throws Exception {
		long his = accountOf(ACTED);

		assertThat(ticksInTheTableOf(ACTED))
				.as("the moderator being stripped holds nothing, so his ticks disappearing says"
						+ " nothing")
				.isNotEmpty();
		assertThat(sessionsOf(his))
				.as("the moderator being stripped has no session, so its surviving says nothing")
				.isOne();

		assertThat(remove(his).getStatus()).isEqualTo(204);

		assertThat(stillThere(ACTED))
				.as("the route deleted the account, and the owner decided on 19.09.2026 that"
						+ " taking a moderatorship away is not taking a man off the portal")
				.isTrue();
		assertThat(accountOf(ACTED))
				.as("the account at that address is a different row, so it was deleted and"
						+ " written again rather than left alone")
				.isEqualTo(his);
		assertThat(ticksInTheTableOf(ACTED))
				.as("the boxes of a stripped moderator stayed, so making him a moderator again"
						+ " would hand him a set the superadmin never ticked")
				.isEmpty();
		assertThat(sessionsOf(his))
				.as("a stripped moderator's session was ended, so a man who is still a competitor"
						+ " was signed out of the portal by losing something else")
				.isOne();

		assertThat(ticksInTheTableOf(FIRST_WRITTEN))
				.as("stripping one moderator took another moderator's ticks")
				.containsExactly(THE_FIRST_ONES);
		assertThat(roleOf(FIRST_WRITTEN))
				.as("stripping one moderator took another moderator's role, and this one races so"
						+ " a statement that lost its key wrote him the same word it wrote the"
						+ " man who was named")
				.isEqualTo("moderator");
		assertThat(ticksInTheTableOf(EVERY_TICK))
				.as("stripping one moderator emptied the matrix")
				.containsExactlyElementsOf(everyRightThereIs());
		assertThat(roleOf(ANOTHER))
				.as("stripping one moderator took a third one's role")
				.isEqualTo("moderator");
		assertThat(stillThere(FIRST_WRITTEN))
				.as("stripping one moderator deleted the first one written")
				.isTrue();
	}

	private long sessionsOf(long account) {
		return db.sql("select count(*) from account_session where account_id = ?")
				.param(account).query(Long.class).single();
	}

	/**
	 * AND THE DECISIONS HE MADE ARE NOT TOUCHED AT ALL, POINTER AND NAME BOTH.
	 *
	 * <p><b>This case said the opposite until 19.09.2026, and the difference between the
	 * two is the whole of the owner's decision.</b> It used to read
	 * {@code decided_by is null}, because {@code verification_decided_by} and
	 * {@code payment_recorded_by} are {@code on delete set null} (V9, V16) and the route
	 * deleted the account they pointed at. Nothing is deleted now, so the pointer still
	 * names him - and that is the sharpest thing in this file that a route reverted to
	 * {@code delete from account} cannot satisfy: the emptied pointer and the kept one are
	 * different values rather than different words about one.
	 *
	 * <p><b>The name is read beside the pointer</b>, because V9 keeps
	 * {@code decided_by_name} as plain text precisely so that a decision says by whom
	 * whatever happens to the account, and a case reading only the pointer would pass over
	 * a route that emptied the name.
	 *
	 * <p><b>And his member record is read last</b>, for a reason that has outlived the
	 * deletion it was written about: {@code account_competitor_fk} is
	 * {@code on delete restrict}, the one such key in this schema that guards a person
	 * rather than a codebook (V23, owner 14.09.2026), and nothing here may write
	 * {@code competitor_id} in either direction. „Rezultati stoje netaknuti" is the owner's
	 * own half-sentence of 19.09.2026, and what holds it is that his row in
	 * {@code competitor} - which is what every result of his points at - is not this
	 * route's to reach.
	 */
	@Test
	void theDecisionsHeMadeAreNotTouchedAndNeitherIsHisMemberRecord() throws Exception {
		long his = accountOf(ACTED);
		long runner = rowOf(ACTED).competitorId();

		assertThat(runner)
				.as("the moderator this case strips does not race, so nothing below is about the"
						+ " member record of a man who does")
				.isNotNull();

		decided(his);
		recorded(his, runner);

		assertThat(remove(his).getStatus()).isEqualTo(204);

		assertThat(db.sql("select decided_by = ? and decided_by_name = ? from verification"
						+ " where subject = ?")
						.params(his, THE_NAME_HE_DECIDED_UNDER, WHAT_HE_DECIDED)
						.query(Boolean.class).optional())
				.as("the decision a stripped moderator made stopped pointing at him, which is what"
						+ " on delete set null does when the account it names is deleted, or it"
						+ " lost the name it was made under")
				.contains(true);

		assertThat(db.sql("select recorded_by = ? and recorded_by_name = ? from payment"
						+ " where reference = ?")
						.params(his, THE_NAME_HE_RECORDED_UNDER, THE_REFERENCE_HE_RECOGNISED)
						.query(Boolean.class).optional())
				.as("the payment a stripped moderator recognised stopped pointing at him, or lost"
						+ " the name it was recognised under")
				.contains(true);

		assertThat(rowOf(ACTED).competitorId())
				.as("taking his moderatorship away moved the member his account names, and that"
						+ " column is nothing this route may write in either direction")
				.isEqualTo(runner);
		assertThat(db.sql("select count(*) from competitor where id = ?").param(runner)
						.query(Long.class).single())
				.as("taking a moderatorship away took a member's record with it, and"
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
				.as("a competitor's account was stripped through the moderators' screen")
				.isEqualTo(404);

		assertThat(stillThere(A_MEMBER))
				.as("the refusal was answered and the competitor's account went anyway")
				.isTrue();
		assertThat(roleOf(A_MEMBER))
				.as("the refused account's role was rewritten anyway - and it was rewritten to"
						+ " `visitor`, because he names no member, which is exactly the answer a"
						+ " statement that lost its condition on the role gives him")
				.isEqualTo("competitor");
		assertThat(ticksInTheTableOf(A_MEMBER))
				.as("a tick was written for an account whose role can hold none")
				.isEmpty();
	}

	/**
	 * MAKING A MODERATOR WRITES THE ACCOUNT HE WILL SIGN IN WITH, AND MAILS HIM THE ONLY
	 * WAY INTO IT.
	 *
	 * <p><b>The owner, 18.09.2026, on three offered outcomes:</b> „Nov moderator dobija
	 * pozivnicu na mejl, a lozinku postavlja sam. Superadmin upise ime, prezime i adresu
	 * elektronske poste; portal posalje link za postavljanje lozinke, istim mehanizmom koji
	 * obnova lozinke vec nosi. Nalog do tog trenutka nema lozinku i ne moze da se prijavi."
	 * Every clause of that sentence is a line below, and each is read off the ROW or off
	 * the message rather than off the answer, which is the one place a wrong write and a
	 * right one agree.
	 *
	 * <p><b>The address is typed in mixed case and the row is read in lower</b>, so „the
	 * address the row carries" and „the address the superadmin typed" are two different
	 * strings and every claim below that names one of them names it on purpose. The
	 * message is asserted to have gone to the ROW's spelling and to that mailbox ALONE -
	 * seven other accounts are in the fixture, and a message addressed to all of them
	 * satisfies „he was told" just as well.
	 *
	 * <p><b>And the token is read from the message to the row rather than the other way
	 * round</b>: what is in the message is hashed and the row it opens is looked up, which
	 * is a claim about whose account that link hands over. Another account's token is in
	 * the table throughout and is read back unspent, so „his token" was never „the only
	 * token".
	 */
	@Test
	void makingAModeratorWritesTheAccountAndMailsHimHisOnlyWayIn() throws Exception {
		assertThat(db.sql("select count(*) from account where lower(email) = lower(?)")
						.param(INVITED).query(Long.class).single())
				.as("the fixture already holds this address, so nothing below is about a write")
				.isZero();

		MockHttpServletResponse answer = make("Nova", "Moderatorka", INVITED);

		assertThat(answer.getStatus()).isEqualTo(201);

		Row made = rowOf(INVITED_AS_STORED);

		assertThat(new ObjectMapper().readTree(answer.getContentAsString()).path("id").asLong())
				.as("the answer names a different account from the one that was written, so the"
						+ " screen would select a row nobody made")
				.isEqualTo(made.id());
		assertThat(new ObjectMapper().readTree(answer.getContentAsString()).path("email").asString())
				.as("the answer hands back the address as it was TYPED, which is what an answer"
						+ " echoed off the request looks like")
				.isEqualTo(INVITED_AS_STORED);

		assertThat(made.role())
				.as("the account was written with some other role, so the superadmin filled in a"
						+ " form and made nobody a moderator")
				.isEqualTo("moderator");
		assertThat(made.firstName()).isEqualTo("Nova");
		assertThat(made.lastName()).isEqualTo("Moderatorka");
		assertThat(made.passwordHash())
				.as("the account was born with a password, and «nalog do tog trenutka nema"
						+ " lozinku» is the owner's own half of the same sentence")
				.isNull();
		assertThat(made.competitorId())
				.as("the new moderator was made to name a member, and «moderator ne mora da bude"
						+ " clan» (owner, 14.09.2026) is why there was a decision to take at all")
				.isNull();
		assertThat(ticksInTheTableOf(INVITED_AS_STORED))
				.as("the new moderator was given a tick nobody ticked for him")
				.isEmpty();

		MimeMessage sent = theOneMessage();

		assertThat(theOnlyRecipientOf(sent))
				.as("the invitation went to a mailbox that is not the one the row carries")
				.isEqualTo(INVITED_AS_STORED);
		assertThat(sent.getSubject())
				.as("the new moderator was sent the words a member who asked to reset his own"
						+ " password reads, which tell him a request arrived, that his password"
						+ " is still the one he knows, and to do nothing if he did not ask")
				.isNotEqualTo(WhatTheMessageSays
						.about(Message.SET_A_NEW_PASSWORD, new Portal(portal), "AbCd").subject())
				.isEqualTo(WhatTheMessageSays
						.about(Message.INVITED_AS_A_MODERATOR, new Portal(portal), "AbCd").subject());

		String body = sent.getContent().toString();

		assertThat(body)
				.as("the link in the invitation was not built out of the portal's own address")
				.contains(portal + Message.INVITED_AS_A_MODERATOR.path() + "?token=");
		assertThat(whatTheTokenOpens(theTokenInside(body)))
				.as("the link in the invitation opens somebody else's account")
				.isEqualTo(made.id());

		assertThat(theTokenIsStillUnspent(SOMEBODY_ELSES_TOKEN))
				.as("making a moderator spent or took a token belonging to another account, so"
						+ " the row read above was the only one there was to find")
				.isTrue();
	}

	/**
	 * A NEW MODERATOR CANNOT SIGN IN UNTIL HE HAS FOLLOWED HIS LINK, AND CAN AFTERWARDS.
	 *
	 * <p><b>ADL A53, 18.09.2026, names this as the boundary that must be MEASURED rather
	 * than assumed:</b> „Nalog bez lozinke NE SME DA MOZE DA SE PRIJAVI, ni praznom
	 * lozinkom ni bilo cime sto se poklopi sa praznim otiskom. To je tvrdnja o ponasanju i
	 * dobija svoj slucaj, jer je ovo prvi put da takav nalog postoji namerno."
	 *
	 * <p><b>The second half is what makes the first half mean anything</b>, and without it
	 * this case is satisfied by an account that can NEVER sign in - which is precisely what
	 * the route would produce if it left the address unconfirmed, because
	 * {@code SignIn.decide} asks after {@code email_confirmed_at} before it asks after the
	 * password and {@code PasswordResetApi} „asks nothing about it in either direction".
	 * So the man follows his link, sets his password, and gets in, and the cookie is read
	 * at {@code /api/me} rather than merely being present.
	 *
	 * <p><b>And what he is when he gets in is read too</b>: {@code moderator}, so the
	 * account he ends up holding is the one the superadmin meant to make rather than
	 * whatever role a sign-in happens to hand out.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", " ", "{noop}", THE_PASSWORD_HE_PICKS})
	void anAccountWithNoPasswordIsNoWayInUntilHeHasSetOne(String guessed) throws Exception {
		assertThat(make("Nova", "Moderatorka", INVITED).getStatus()).isEqualTo(201);
		assertThat(rowOf(INVITED_AS_STORED).passwordHash())
				.as("the account this case guesses at already has a password")
				.isNull();

		MockHttpServletResponse refused = signIn(INVITED_AS_STORED, guessed);

		assertThat(refused.getStatus())
				.as("«%s» signed in to an account that has no password at all", guessed)
				.isEqualTo(401);
		assertThat(refused.getCookie(SessionCookie.NAME))
				.as("a refused sign in handed out a session anyway")
				.isNull();

		String token = theTokenInside(theOneMessage().getContent().toString());

		assertThat(setThePassword(token, THE_PASSWORD_HE_PICKS).getStatus()).isEqualTo(204);
		assertThat(new StoredPassword()
						.matches(THE_PASSWORD_HE_PICKS, rowOf(INVITED_AS_STORED).passwordHash()))
				.as("following the link did not write the password he typed")
				.isTrue();

		MockHttpServletResponse welcome = signIn(INVITED_AS_STORED, THE_PASSWORD_HE_PICKS);

		assertThat(welcome.getStatus())
				.as("the new moderator set his password through his link and STILL cannot sign in,"
						+ " so the invitation is a road that ends at a wall")
				.isEqualTo(204);
		assertThat(roleIn(me(welcome.getCookie(SessionCookie.NAME).getValue())))
				.as("he got in as somebody other than the moderator he was made")
				.isEqualTo("moderator");
	}

	/**
	 * AN ADDRESS SOMEBODY ALREADY HOLDS IS REFUSED, AND NOTHING AT ALL IS WRITTEN OR SENT.
	 *
	 * <p>„Jedan nalog je tacno jedan clan" is the other sentence of 14.09.2026, and one
	 * address is one account whatever case it is typed in (owner, 08.09.2026,
	 * {@code account_email_unique} over {@code lower(email)}). So the second account cannot
	 * be written, and the refusal says which of the two things went wrong.
	 *
	 * <p><b>The address is typed back in a case the row does not carry</b>, which is the
	 * whole of the case rather than a flourish: asked as {@code email = ?} this route would
	 * answer 201 and the index would abort the transaction underneath it.
	 *
	 * <p><b>Both halves of „nothing is written" are read.</b> The refused man's role is
	 * unchanged - a competitor whose address was typed here must not become a moderator -
	 * and no message left the portal, because an invitation to an address that already
	 * belongs to somebody is a link to a stranger's account mailed on request.
	 */
	@Test
	void anAddressSomebodyAlreadyHoldsIsRefusedAndNothingIsWrittenOrSent() throws Exception {
		MockHttpServletResponse answer =
				make("Nova", "Moderatorka", A_MEMBER.toUpperCase(java.util.Locale.ROOT));

		assertThat(answer.getStatus())
				.as("an address another account already holds was taken, so either the portal now"
						+ " has two accounts at one address or the request aborted underneath")
				.isEqualTo(409);
		assertThat(reasonIn(answer)).isEqualTo(ModeratorWriteApi.THE_ADDRESS_IS_TAKEN);

		assertThat(roleOf(A_MEMBER))
				.as("the address was refused and the account behind it was made a moderator anyway")
				.isEqualTo("competitor");
		assertThat(db.sql("select count(*) from password_reset_token where account_id ="
						+ " (select id from account where email = ?)")
						.param(A_MEMBER).query(Long.class).single())
				.as("a refused invitation minted a link into a stranger's account")
				.isZero();
		assertThat(SMTP.getReceivedMessages())
				.as("a refused invitation went out, which is a link to somebody else's account"
						+ " mailed to whoever typed his address")
				.isEmpty();
	}

	/**
	 * A FORM THAT IS MISSING ANYTHING IS REFUSED, AND SO IS AN ADDRESS THAT IS NOT ONE.
	 *
	 * <p>„Superadmin upise ime, prezime i adresu elektronske poste" is three fields, and
	 * {@code account_first_name_not_blank}, {@code account_last_name_not_blank} and
	 * {@code account_email_shape} are all CHECKs - so a form judged only by the schema
	 * comes back to the superadmin as a 500 after he has filled it in, and on PostgreSQL
	 * the error aborts the transaction the 409 above would have to be answered from.
	 *
	 * <p>The row after each refusal is counted, because a refusal that had already written
	 * half of itself leaves a moderator nobody can reach.
	 */
	@ParameterizedTest
	@CsvSource(nullValues = "-", value = {
			"-, Moderatorka, nova@primer.rs",
			"Nova, -, nova@primer.rs",
			"Nova, Moderatorka, -",
			"'', Moderatorka, nova@primer.rs",
			"'   ', Moderatorka, nova@primer.rs",
			"Nova, '', nova@primer.rs",
			"Nova, Moderatorka, ''",
			"Nova, Moderatorka, nijeadresa",
			"Nova, Moderatorka, dva@znaka@primer.rs",
	})
	void aFormThatIsMissingAnythingIsRefusedAndNobodyIsMade(String first, String last, String email)
			throws Exception {

		long before = howManyAccounts();

		MockHttpServletResponse answer = make(invited(first, last, email), EVERYTHING);

		assertThat(answer.getStatus())
				.as("«%s / %s / %s» was accepted as a moderator", first, last, email)
				.isEqualTo(400);
		assertThat(reasonIn(answer)).isEqualTo(ModeratorWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(howManyAccounts())
				.as("the form was refused and an account was written anyway")
				.isEqualTo(before);
		assertThat(SMTP.getReceivedMessages())
				.as("the form was refused and a message went out anyway")
				.isEmpty();
	}

	private long howManyAccounts() {
		return db.sql("select count(*) from account").query(Long.class).single();
	}

	/**
	 * A RELAY THAT WILL NOT TAKE THE INVITATION STILL LEAVES THE MODERATOR AND HIS LINK
	 * BEHIND.
	 *
	 * <p><b>The 201 is the case and not a detail.</b> Answering anything else would tell
	 * the superadmin that nothing happened to a man for whom everything happened, and send
	 * him to type the address again at a form that would now answer 409 - which is the
	 * shape {@code RegistrationApi} measured on its own send and wrote down.
	 *
	 * <p><b>And the token is read back</b>, because it is what rescues the account: the
	 * address is written confirmed, so a password reset request at the same address mails
	 * another link, and the row here is the one that says the first link was really minted
	 * rather than lost with the message.
	 *
	 * <p>See {@code PasswordResetApiTest.aRelayThatRefusesTheMessageStillLeavesTheTokenBehind}
	 * for why this is not reproved over a real socket the way registration's own send is.
	 */
	@Test
	void aRelayThatRefusesTheInvitationStillLeavesTheModeratorAndHisLink() throws Exception {
		SMTP.getSmtp().stopService();

		MockHttpServletResponse answer = make("Nova", "Moderatorka", INVITED);

		assertThat(answer.getStatus())
				.as("a relay that would not take the message was answered as though the superadmin"
						+ " had made nobody, and he would type the address again at a form that"
						+ " now answers 409")
				.isEqualTo(201);

		Row made = rowOf(INVITED_AS_STORED);

		assertThat(made.role())
				.as("the moderator went with the message the relay refused")
				.isEqualTo("moderator");
		assertThat(db.sql("select count(*) from password_reset_token where account_id = ?")
						.param(made.id()).query(Long.class).single())
				.as("the link went with the message, so the account he holds is one nothing can"
						+ " rescue")
				.isOne();
	}

	/**
	 * AND THE TWO MEN THE OWNER NAMED ARE LEFT WITH TWO DIFFERENT THINGS.
	 *
	 * <p><b>The owner, 19.09.2026:</b> „Za coveka koji je i takmicar to znaci da se i dalje
	 * prijavljuje na portal i da mu rezultati stoje netaknuti; gubi samo moderatorstvo i
	 * sve kucice", and beside it the price he took: „moderator koji NIJE takmicar ostaje kao
	 * nalog koji nista ne moze". He then said what a case for it has to hold: „postavka mora
	 * da ima moderatora koji jeste takmicar i moderatora koji nije, i da tvrdi RAZLICIT
	 * ISHOD ZA SVAKOGA. Sa samo jednim od njih «skinuta uloga» i «obrisan nalog» daju isti
	 * ekran."
	 *
	 * <p><b>Which role each is left with is derived from {@code account.competitor_id} and
	 * the boundary is named in both directions</b>, in {@link ModeratorWriteApi}'s own
	 * comment. What makes the two answers different rather than two spellings of one is
	 * {@code isMember(role)} in the portal's own roles, false for {@code visitor} alone:
	 * so the man who races is still a member of the league and the man who never did is an
	 * account that can do nothing.
	 *
	 * <p><b>Read through the cookie each of them already holds and not only off the
	 * table</b>, because the owner's sentence is about signing in rather than about a
	 * column: neither of them signs in again, and neither has to.
	 *
	 * <p><b>And the door is read in both directions on one of them</b>, which is what says
	 * this route means anything at all: before the strip his tick opens a guarded route,
	 * after it the same cookie is refused there.
	 */
	@Test
	void theOneWhoRacesIsLeftACompetitorAndTheOneWhoDoesNotAVisitor() throws Exception {
		assertThat(rowOf(ACTED).competitorId())
				.as("the moderator this case calls a racer names no member")
				.isNotNull();
		assertThat(rowOf(ANOTHER).competitorId())
				.as("the moderator this case calls a non-racer names one, so the two sides of the"
						+ " owner's sentence are one side")
				.isNull();
		assertThat(whatTheQueueSays(ACTED))
				.as("the moderator this case strips is already refused the queue he holds the tick"
						+ " for, so the 404 below is not about losing anything")
				.isEqualTo(400);

		assertThat(remove(accountOf(ACTED)).getStatus()).isEqualTo(204);
		assertThat(remove(accountOf(ANOTHER)).getStatus()).isEqualTo(204);

		assertThat(roleOf(ACTED))
				.as("the moderator who also races was left something other than a competitor, so"
						+ " «i dalje se prijavljuje na portal» costs him his own screens")
				.isEqualTo("competitor");
		assertThat(roleOf(ANOTHER))
				.as("the moderator who never raced was left a competitor, so the portal calls a"
						+ " man a member of the league while his account names nobody")
				.isEqualTo("visitor");

		assertThat(roleIn(me(sessions.get(ACTED).secret())))
				.as("the cookie he was already holding answers with the role he lost, so what a"
						+ " session is worth is decided once rather than on every request")
				.isEqualTo("competitor");
		assertThat(roleIn(me(sessions.get(ANOTHER).secret())))
				.as("the same, for the man who never raced")
				.isEqualTo("visitor");

		assertThat(whatTheQueueSays(ACTED))
				.as("the tick was taken away and the door he went through a moment ago is still"
						+ " open to the same cookie")
				.isEqualTo(404);

		assertThat(remove(accountOf(ACTED)).getStatus())
				.as("a man who is no longer a moderator was stripped a second time, so the route"
						+ " acts on a row it has already dealt with")
				.isEqualTo(404);
		assertThat(save(accountOf(ANOTHER), List.of(GIVEN)).getStatus())
				.as("a man who is no longer a moderator was handed a tick")
				.isEqualTo(404);
	}
}

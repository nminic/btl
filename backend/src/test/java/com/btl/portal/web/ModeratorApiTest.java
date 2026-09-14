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
 * <li><b>One moderator IS a member and three are not</b>, which is the axis V23 added on
 * 14.09.2026. „Moderator ne mora da bude clan" (owner), so a fixture in which every
 * moderator had a {@code competitor} row would let this resource read the name out of the
 * register of members and pass; and a fixture in which none did would let it pass with a
 * join that answers with nothing.
 * <li><b>And the one who is both carries a DIFFERENT name on his account from the one on
 * his member record, in BOTH the first name and the surname.</b> Without that, „the name
 * on the account" and „the name on the competitor" are the same string for him and the
 * case below measures nothing at all, which is the rule of 06.09.2026 about two sources
 * of one value. A fixture that varied only the surname was tried first, and a mutation
 * found the gap it left open: a query reading the first name off {@code competitor} and
 * the surname off {@code account} served her true full name anyway, because the shared
 * first name hid the wrong source (found in review, B56, 14.09.2026).
 * <li><b>And her account id is forced away from her competitor id, for the identical
 * reason.</b> {@code id} is a third field this resource reads off {@code account} rather
 * than through {@code account.competitor_id}, and the two are bigserials out of
 * independent sequences that could otherwise coincide by chance. Until this case the
 * fixture left that to whatever the two sequences happened to be at, and {@code id} was
 * checked only for the two moderators with no competitor row at all, where a coalesce onto
 * {@code competitor} could never show - so the one row on which the two sources actually
 * differ went unmeasured (found in review, B56, 14.09.2026).
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

	/** The member record of the one moderator who also races, named here so both sides read it. */
	private static final String HER_MEMBER_NUMBER = "001000";

	/**
	 * Her competitor id, forced far above anything {@code competitor_id_seq} has handed out in
	 * this run - the device {@code CommentApiTest} already uses for {@code event_comment} ids
	 * and {@code AxisConstraintsTest} for another {@code competitor} row - so that it cannot
	 * coincide with her {@code account.id} by chance. The two are bigserials out of independent
	 * sequences that both start at one ({@code MembershipCarriedOverTest} names the identical
	 * risk for {@code payment_id}), and a query answering {@code id} with
	 * {@code coalesce(competitor.id, account.id)} instead of {@code account.id} alone would read
	 * back this number for her, not her account's.
	 */
	private static final long HER_COMPETITOR_ID = 900001;

	/** Her first name on the ACCOUNT, which is what this resource must answer with. */
	private static final String HER_FIRST_NAME_ON_THE_ACCOUNT = "Vesna";

	/** Her last name on the ACCOUNT, which is what this resource must answer with. */
	private static final String HER_LAST_NAME_ON_THE_ACCOUNT = "Vukic";

	/**
	 * Her first name in the register of members - different from
	 * {@link #HER_FIRST_NAME_ON_THE_ACCOUNT} and not only her last name, so that a source
	 * bug reading just the first name off the wrong table cannot hide behind a first name
	 * the two records happen to share (the rule of 06.09.2026 about two sources of one
	 * value). B56's own review found exactly this gap: {@code coalesce(c.first_name,
	 * a.first_name)} served her account's true last name beside the member record's first
	 * name, and a fixture where the two first names coincided could not tell the two apart.
	 */
	private static final String HER_FIRST_NAME_ON_THE_MEMBER_RECORD = "Snezana";

	/** Her last name in the register of members, which is the wrong answer that would otherwise pass. */
	private static final String HER_LAST_NAME_ON_THE_MEMBER_RECORD = "Devojacko";

	/** And what her MEMBER record says, which is the wrong answer that would otherwise pass. */
	private static final String HER_NAME_ON_THE_MEMBER_RECORD =
			HER_FIRST_NAME_ON_THE_MEMBER_RECORD + " " + HER_LAST_NAME_ON_THE_MEMBER_RECORD;

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
		account(EVERYTHING, "superadmin", "Nikola", "Minic");
		account(TWO_TICKS, "moderator", HER_FIRST_NAME_ON_THE_ACCOUNT, HER_LAST_NAME_ON_THE_ACCOUNT);
		account(NO_TICKS, "moderator", "Novak", "Novic");
		account(A_MEMBER, "competitor", "Takmicar", "Trkacki");
		account(EVERY_TICK, "moderator", "Iskusni", "Iskic");
		account(ONE_TICK, "moderator", "Bojan", "Bojic");

		/* AND ONE OF THE FOUR MODERATORS ALSO RACES, under a name that is not the one on
		   her account. Both halves are the measurement: a moderator who is NOT a member is
		   the ordinary case since 14.09.2026, and the one who is both is the only row on
		   which „the name off the account" and „the name off the member record" can be
		   told apart at all. BOTH her first name and her surname differ, because the
		   register of members and the account are two independent facts (PDL.md:4460) and
		   the Statute's book of members asks for a first name and a surname of its own
		   (PDL P32) regardless of what either says - a woman may be registered under a name
		   she does not sign in under. Only the surname used to differ until this case; a
		   coalesce that fell back to `account` solely for a first name the two rows
		   happened to share still served her true name, and the fixture now makes that
		   impossible (found in review, B56, 14.09.2026). */
		competitor(HER_COMPETITOR_ID, HER_MEMBER_NUMBER, HER_FIRST_NAME_ON_THE_MEMBER_RECORD,
				HER_LAST_NAME_ON_THE_MEMBER_RECORD);
		belongsTo(TWO_TICKS, HER_MEMBER_NUMBER);

		ticked(TWO_TICKS, FIRST_OF_TWO, SECOND_OF_TWO);
		ticked(ONE_TICK, THE_ONLY_ONE);
		ticked(EVERY_TICK, everyRightThereIs().toArray(String[]::new));
	}

	/**
	 * A member, in the shape the schema's own files already write one, under a chosen id
	 * instead of the sequence's next one - see {@link #HER_COMPETITOR_ID} for why the one
	 * caller below needs to choose.
	 */
	private void competitor(long id, String number, String first, String last) {
		db.sql("insert into competitor (id, member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, 'F', date '1984-03-03', (select id from place where rank = 1),"
						+ " null, null, 2027, false, true, 'feeExempt', ?, null, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(id, number, first, last, "00112233445566" + number.substring(4))
				.update();
	}

	/** The link V23 wrote down: this account IS that member, and at most one account may be. */
	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
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
	 * EVERY FIELD THE PORTAL READS IS ANSWERED, AND THERE IS NO LONGER AN EXCEPTION.
	 *
	 * <p><b>This case used to name two fields that were deliberately left out, and the
	 * change is the whole of B56.</b> B55 answered without {@code firstName} and
	 * {@code lastName} because the schema had nowhere to hold them: {@code account} was an
	 * id, an address, a role and the moment the address was confirmed, names lived on
	 * {@code competitor}, and nothing joined the two. It named the omission here rather
	 * than in a comment, by the rule of ADL P-javno of 13.09.2026 - „izostavljena polja se
	 * imenuju u samom slucaju sa razlogom, da izostavljanje bude odluka a ne propust" -
	 * precisely so that the day the answer changed, this case would have to change with
	 * it instead of going on quietly excusing a gap.
	 *
	 * <p><b>That day is 14.09.2026.</b> „Ime i prezime nosi sam nalog, i moderator ne mora
	 * da bude clan" ({@code PDL.md:4459}), V23 put the two columns on {@code account}, and
	 * the assertion is now the plain one: the portal reads five fields and the server
	 * answers with all five. {@code Answers} refuses both directions at once, so this also
	 * says the answer carries nothing the portal does not read.
	 *
	 * <p><b>Where the names come FROM is a separate question and has its own case</b>
	 * ({@link #theNameComesOffTheAccountAndNotOffTheMemberRecord()}), because this one
	 * would be satisfied by the wrong table just as well as by the right one.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/moderators", answer(), "moderators.json");
	}

	/**
	 * THE NAME COMES OFF THE ACCOUNT AND NEVER OFF THE MEMBER RECORD.
	 *
	 * <p>The one case this increment exists for, and the two halves below are the two ways
	 * of getting it wrong rather than one claim written twice.
	 *
	 * <p><b>First half: the moderator who does not race is served, with his own name.</b>
	 * „Moderator ne mora da bude clan" (owner, 14.09.2026) is why the name went onto the
	 * account at all. A resource reading the name through {@code account.competitor_id}
	 * with an inner join drops him out of the list entirely; with an outer join it hands
	 * back nothing where his name should be. Both are caught here, and neither would be
	 * caught by counting the rows, because three of the four moderators are in his
	 * position and a query that lost all three still answers with one record.
	 *
	 * <p><b>Second half: the moderator who DOES race is served the name on her account,
	 * which is not the name on her member record.</b> Without this the first half would be
	 * satisfied by a resource that reads {@code competitor} wherever it can and falls back
	 * to {@code account} where it cannot, which is exactly the shape somebody writes while
	 * fixing the first half. The two strings are different by construction, in BOTH the
	 * first name and the surname - the fixture gives her one first name and one surname on
	 * the account and a different first name and a different surname in the register of
	 * members - so „read the wrong table" and „read the right one" cannot produce the same
	 * answer for either field, and neither field can pass by coincidentally sharing its
	 * value with the other source.
	 *
	 * <p><b>And the wrong name is asserted against, not merely the right one asserted
	 * for.</b> Naming the value that must NOT come out is what makes this a measurement of
	 * the SOURCE rather than of the string: an assertion that only demanded „Vesna Vukic"
	 * would go on passing if somebody later made the two records agree, and the case would
	 * then be measuring the fixture.
	 */
	@Test
	void theNameComesOffTheAccountAndNotOffTheMemberRecord() throws Exception {
		assertThat(nameServedTo(NO_TICKS))
				.as("a moderator with no member record lost his name, or lost his row")
				.isEqualTo("Novak Novic");

		/* Read as two fields and not as one joined string. A single assertion over
		   "firstName + ' ' + lastName" passes whenever the two joined strings happen to
		   match even if only one of the two fields is actually right - which is exactly
		   the shape B56's review found: the first name coincided between the two sources,
		   so a coalesce onto `competitor` for the first name alone still served her true
		   full name, because `lastName` alone was read correctly. Each field is therefore
		   its own assertion, against both the right value and the wrong one. */
		JsonNode her = served(TWO_TICKS);

		assertThat(her.path("firstName").asString())
				.as("the first name was read off the member record instead of off the account")
				.isEqualTo(HER_FIRST_NAME_ON_THE_ACCOUNT)
				.isNotEqualTo(HER_FIRST_NAME_ON_THE_MEMBER_RECORD);
		assertThat(her.path("lastName").asString())
				.as("the last name was read off the member record instead of off the account")
				.isEqualTo(HER_LAST_NAME_ON_THE_ACCOUNT)
				.isNotEqualTo(HER_LAST_NAME_ON_THE_MEMBER_RECORD);

		/* And the fixture really does hold two different names for her, so the two
		   assertions above are a claim about the server and not about strings that happen
		   to be equal. */
		assertThat(db.sql("select first_name || ' ' || last_name from competitor where member_number = ?")
				.param(HER_MEMBER_NUMBER).query(String.class).single())
				.as("her member record carries the same name as her account, so nothing above is measured")
				.isEqualTo(HER_NAME_ON_THE_MEMBER_RECORD);
	}

	/** The name this resource answers with for one address, as one string. */
	private String nameServedTo(String email) throws Exception {
		JsonNode one = served(email);
		return one.path("firstName").asString() + " " + one.path("lastName").asString();
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
	 * AND THE IDENTIFIER IS THE ACCOUNT'S OWN KEY, not the slug the prototype file used, AND
	 * NOT THE COMPETITOR'S EITHER.
	 *
	 * <p>The decision {@code CalendarApi} took on 12.09.2026 and {@code AttendanceApi}
	 * repeats: the shapes are the schema's and not the file's, so this answers with
	 * {@code account.id} where {@code moderators.json} carried {@code mod-radulovic}.
	 *
	 * <p><b>Read for two of them and not for one.</b> With a single record the id and
	 * „the first id in the table" are the same number, and a resource answering with a
	 * constant or with the wrong row would pass. The two are read by ADDRESS, so the
	 * pairing is what is measured rather than the presence of a number.
	 *
	 * <p><b>And read for the moderator who is also a member, which the first two cannot
	 * measure at all.</b> {@link #ONE_TICK} and {@link #NO_TICKS} hold no {@code competitor}
	 * row, so {@code coalesce(competitor.id, account.id)} would answer {@code account.id} for
	 * them exactly as {@code account.id} alone does, and a resource reading the wrong column
	 * would pass unnoticed (found in review, B56, 14.09.2026). {@link #TWO_TICKS} is the one
	 * row on which the two sources can differ, so her account id is forced away from her
	 * competitor id in the fixture rather than left to two independent sequences that could
	 * coincide, and both numbers are read back out of the database rather than trusted from
	 * this file's own constants.
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

		assertThat(served(TWO_TICKS).path("id").asLong())
				.as("the moderator who is also a member answered with her competitor id"
						+ " instead of her account id")
				.isEqualTo(accountOf(TWO_TICKS));

		/* And the fixture really does hold two different numbers for her, so the assertion
		   above is a claim about the source and not about numbers that happen not to collide -
		   read out of the database rather than trusted from HER_COMPETITOR_ID, the same shape
		   theNameComesOffTheAccountAndNotOffTheMemberRecord closes with for the two names. */
		assertThat(db.sql("select id from competitor where member_number = ?")
						.param(HER_MEMBER_NUMBER).query(Long.class).single())
				.as("her account id and her competitor id are the same number, so nothing above"
						+ " is measured")
				.isNotEqualTo(accountOf(TWO_TICKS));
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

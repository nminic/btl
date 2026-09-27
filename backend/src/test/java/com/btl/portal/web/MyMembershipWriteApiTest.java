package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * POST /api/me/membership: A MEMBER LETTING HIMSELF IN ON HIS OWN BALANCE.
 *
 * <p><b>Owner, 26.09.2026:</b> „Balans veci ili jednak clanarini: QR koda nema, clanstvo se aktivira
 * iz balansa, a visak ostaje za sledecu godinu." And the cost he accepted with it: this is a new road
 * to something that is worth money, and „taj put mora da nosi istu proveru kao i onaj kroz uplatu".
 *
 * <p><b>The clock stands on 3 October 2027</b>, so the fee is V4's {@code early} row - 35 euro and
 * 4.200 dinars - and the season on sale is 2028. Seven members brought in is exactly one membership
 * and eight is one with change, both of which the fixture holds.
 *
 * <p><b>FIVE MEMBERS, EACH REFUSED OR ADMITTED FOR A DIFFERENT REASON, AND NO CASE ASKS ABOUT THE
 * FIRST ROW OF ANYTHING.</b> Two of them hold a covering balance and differ only in whether they
 * already carry a member number, which is what makes the two ways of saying yes distinguishable; one
 * is short; one is freed of the fee while holding a covering balance, so his refusal cannot be coming
 * out of the money; and one is already a member of the season on sale.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MyMembershipWriteApiTest {

	private static final String PATH = "/api/me/membership";

	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzz";

	private static final Instant NOW = Instant.parse("2027-10-03T09:00:00Z");

	private static final int THE_SEASON_ON_SALE = 2028;

	/* Well clear of 000001, because `member_number_seq` starts there and hands out numbers this
	   file's fixtures must never already be holding. */
	private static final String ALREADY_IN_FOR_THIS_SEASON = "007001";

	private static final String FREED_OF_THE_FEE = "007002";

	private static final String COMING_BACK = "007003";

	private static final String SHORT_BY_SIX_HUNDRED = "007004";

	/** He has never paid, so he carries no number: PDL P8's „registrovan a neplacen clan". */
	private static final String NEVER_NUMBERED = null;

	private static final String THE_MAN_WHO_BROUGHT_HIM_IN = "007005";

	/**
	 * AND ONE WHOSE BALANCE IS EXACTLY THE FEE, which is the boundary itself and had no member
	 * standing on it until a mutation said so.
	 *
	 * <p>V4 prices the early period at 4.200 dinars and a referral at 600, so SEVEN members brought
	 * in is one membership to the dinar. Everybody else here holds eight, and with eight alone
	 * „greater or equal" and „greater" answer the same thing at this route: the mutation that
	 * narrowed the owner's boundary to „greater" passed all twelve cases of this file.
	 */
	private static final String EXACTLY_ENOUGH = "007006";

	private static final Map<String, String> EMAIL = Map.of(
			ALREADY_IN_FOR_THIS_SEASON, "vec-clan@primer.rs",
			FREED_OF_THE_FEE, "oslobodjen@primer.rs",
			COMING_BACK, "vraca-se@primer.rs",
			SHORT_BY_SIX_HUNDRED, "nedostaje@primer.rs",
			EXACTLY_ENOUGH, "tacno@primer.rs",
			THE_MAN_WHO_BROUGHT_HIM_IN, "preporucilac@primer.rs");

	private static final String FIRST_TIMER = "prvi-put@primer.rs";

	private static final String A_MODERATOR_WHO_DOES_NOT_RACE = "mod@primer.rs";

	/**
	 * A MEMBERSHIP HELD FREE OF THE FEE, WITH THE TRAIL V35 ASKS FOR.
	 *
	 * <p>`membership_free_of_the_fee_says_who` and `..._says_when` (V35, owner 27.09.2026) refuse an
	 * exemption that does not say who freed him and when. They are `not valid`, which spares the one
	 * row a real database already carried and refuses every NEW one - and a fixture writes new ones.
	 *
	 * <p>The two constants split where the insert splits: the columns, and then everything from the
	 * basis rightwards, so a call site names only whose membership it is and for which season.
	 */
	private static final String MEMBERSHIP_FREE_OF_THE_FEE = "competitor_id, season, basis,"
			+ " payment_id, decided_by, decided_by_name, decided_at";

	/** The basis, no receipt to name, and who entered it and when. */
	private static final String A_TRAIL = "'feeExempt', null,"
			+ " (select id from account where email = 'mod@primer.rs'), 'Probni Probic',"
			+ " timestamptz '2026-09-20 09:00:00+00'";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	private long theFirstTimer;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockInsideTheEarlyPeriod() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}

	@BeforeEach
	void fiveMembersAndFiveReasons() {
		competitor(ALREADY_IN_FOR_THIS_SEASON, "payment");
		competitor(FREED_OF_THE_FEE, "feeExempt");
		competitor(THE_MAN_WHO_BROUGHT_HIM_IN, "payment");
		competitor(COMING_BACK, "payment");
		competitor(SHORT_BY_SIX_HUNDRED, "payment");
		competitor(EXACTLY_ENOUGH, "payment");

		/* THE ONE WITH NO NUMBER, and he is the one the referral cases are about: he was brought in
		   by somebody, so activating him has to pay that somebody. Written last, so no case about
		   him is satisfied by his being the first row of anything. */
		theFirstTimer = competitor(NEVER_NUMBERED, "payment");
		db.sql("update competitor set referred_by ="
						+ " (select id from competitor where member_number = ?) where id = ?")
				.params(THE_MAN_WHO_BROUGHT_HIM_IN, theFirstTimer).update();

		EMAIL.forEach((number, email) -> {
			account(email, "competitor");
			db.sql("update account set competitor_id ="
							+ " (select id from competitor where member_number = ?) where email = ?")
					.params(number, email).update();
		});

		account(FIRST_TIMER, "competitor");
		db.sql("update account set competitor_id = ? where email = ?").params(theFirstTimer, FIRST_TIMER)
				.update();

		account(A_MODERATOR_WHO_DOES_NOT_RACE, "moderator");

		/* EIGHT for the two who are admitted, so that what is spent (the fee) and what they hold
		   (the balance) are different numbers and „the surplus stays" can be measured at all. */
		brought(theFirstTimer, 8);
		brought(idOf(COMING_BACK), 8);
		brought(idOf(ALREADY_IN_FOR_THIS_SEASON), 8);
		brought(idOf(FREED_OF_THE_FEE), 8);
		brought(idOf(SHORT_BY_SIX_HUNDRED), 6);

		/* SEVEN, which is the fee to the dinar and the only fixture in this file that stands on
		   the boundary rather than to one side of it. */
		brought(idOf(EXACTLY_ENOUGH), 7);

		db.sql("insert into membership (" + MEMBERSHIP_FREE_OF_THE_FEE + ") values (?, ?, " + A_TRAIL + ")")
				.params(idOf(ALREADY_IN_FOR_THIS_SEASON), THE_SEASON_ON_SALE).update();
	}

	private long idOf(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	private void brought(long referrer, int howMany) {
		for (int one = 0; one < howMany; one++) {
			long newcomer = competitor("009" + String.format("%03d", ++issued), "payment");

			db.sql("insert into balance_entry (competitor_id, eur, rsd, reason,"
							+ " referred_competitor_id, occurred_at, recorded_by, recorded_by_name)"
							+ " values (?, 5, 600, 'referral', ?, ?,"
							+ " (select id from account where email = ?), 'Blagajnik Probni')")
					.params(referrer, newcomer, Timestamp.from(NOW.minus(Duration.ofDays(30))),
							A_MODERATOR_WHO_DOES_NOT_RACE)
					.update();
		}
	}

	private long competitor(String number, String basis) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, false, ?, ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, basis, String.format("%016x", ++issued))
				.query(Long.class).single();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
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

	private MockHttpServletResponse activate(String email) throws Exception {
		MockHttpServletRequestBuilder asks = post(PATH).with(csrf());

		if (email != null) {
			asks = asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
		}

		return http.perform(asks).andReturn().getResponse();
	}

	private JsonNode bodyOf(MockHttpServletResponse answer) throws Exception {
		return new ObjectMapper().readTree(answer.getContentAsString());
	}

	private JsonNode invoice(String email) throws Exception {
		return new ObjectMapper().readTree(http.perform(get(PATH)
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse().getContentAsString());
	}

	private BigDecimal bookOf(long competitor) {
		return db.sql("select coalesce(sum(rsd), 0) from balance_entry where competitor_id = ?")
				.param(competitor).query(BigDecimal.class).single();
	}

	private long entriesAgainst(long competitor) {
		return db.sql("select count(*) from balance_entry where competitor_id = ?"
				+ " and reason = 'membership'").param(competitor).query(Long.class).single();
	}

	/**
	 * The membership for the season on sale as one readable line, or the words for none.
	 *
	 * <p>Read back as a STRING with all three facts in it rather than as three separate questions:
	 * a basis asserted on its own is satisfied by a row whose evidence column names the wrong thing,
	 * and the point of V36 is that the two go together.
	 */
	private String membershipOf(long competitor) {
		return db.sql("select coalesce((select basis || ' ' || coalesce(payment_id::text, 'no receipt')"
						+ " || ' ' || coalesce(balance_entry_id::text, 'no entry') from membership"
						+ " where competitor_id = ? and season = ?), 'not a member')")
				.params(competitor, THE_SEASON_ON_SALE).query(String.class).single();
	}

	/** Already the generic floor for every route; here beside a fixture that is admitted. */
	@Test
	void aVisitorWhoIsNotSignedInIsRefused() throws Exception {
		assertThat(activate(null).getStatus()).isEqualTo(401);
		assertThat(activate(FIRST_TIMER).getStatus()).isEqualTo(201);
	}

	/** An account with no member behind it has no membership to buy. */
	@Test
	void anAccountWithNoMemberBehindItIsToldTheAddressIsNotThere() throws Exception {
		MockHttpServletResponse refused = activate(A_MODERATOR_WHO_DOES_NOT_RACE);

		assertThat(refused.getStatus()).isEqualTo(http.perform(post(NOTHING_IS_THERE).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(A_MODERATOR_WHO_DOES_NOT_RACE).secret())))
				.andReturn().getResponse().getStatus());

		assertThat(refused.getContentAsString()).isEmpty();
	}

	/**
	 * A FIRST TIME MEMBER IS LET IN, NUMBERED, AND THE BOOK SAYS WHAT PAID FOR IT.
	 *
	 * <p>Every row this writes is asserted, and the membership's evidence is asserted to be the very
	 * line the book gained rather than merely to be present: {@code membership_basis_says_whether_a_book_entry_is_named}
	 * (V36) would refuse an empty one, so „not empty" says nothing on its own.
	 *
	 * <p><b>The surplus stays</b>, which is the owner's own words: he held 4.800 and the membership
	 * cost 4.200, so 600 is left. The two numbers differ on purpose - a fixture where the balance
	 * equalled the fee could not tell „spend the fee" from „spend the balance" apart.
	 */
	@Test
	void afirstTimeMemberIsLetInNumberedAndTheBookSaysWhatPaidForIt() throws Exception {
		MockHttpServletResponse answer = activate(FIRST_TIMER);

		assertThat(answer.getStatus()).isEqualTo(201);

		JsonNode body = bodyOf(answer);
		assertThat(body.path("season").asInt()).isEqualTo(THE_SEASON_ON_SALE);
		assertThat(body.path("memberNumber").asString()).matches("^[0-9]{6}$");
		assertThat(body.path("fromTheBalance").path("rsd").asDouble()).isEqualTo(4200.0);

		assertThat(db.sql("select member_number, active from competitor where id = ?")
						.param(theFirstTimer)
						.query((row, i) -> row.getString(1) + " " + row.getBoolean(2)).single())
				.isEqualTo(body.path("memberNumber").asString() + " true");

		long entry = db.sql("select id from balance_entry where competitor_id = ? and reason ="
						+ " 'membership'").param(theFirstTimer).query(Long.class).single();

		assertThat(membershipOf(theFirstTimer)).isEqualTo("balance no receipt " + entry);

		assertThat(db.sql("select eur, rsd, season from balance_entry where id = ?").param(entry)
						.query((row, i) -> row.getBigDecimal(1) + " " + row.getBigDecimal(2) + " "
								+ row.getInt(3)).single())
				.as("the line in the book is not the fee, taken away, for this season")
				.isEqualTo("-35.00 -4200.00 " + THE_SEASON_ON_SALE);

		assertThat(bookOf(theFirstTimer))
				.as("the surplus was spent as well, so the owner's 'visak ostaje za sledecu godinu'"
						+ " is broken")
				.isEqualByComparingTo("600.00");
	}

	/**
	 * AND SOMEBODY COMING BACK KEEPS THE NUMBER HE HAS.
	 *
	 * <p>PDL P8: „vraca isti broj i isti profil, ne pravi nov". The number is asserted to be the
	 * one he already had and not merely to be six digits, because a freshly drawn one is six digits
	 * too.
	 */
	@Test
	void amemberComingBackKeepsHisOwnNumber() throws Exception {
		MockHttpServletResponse answer = activate(EMAIL.get(COMING_BACK));

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(bodyOf(answer).path("memberNumber").asString()).isEqualTo(COMING_BACK);

		assertThat(db.sql("select member_number from competitor where id = ?").param(idOf(COMING_BACK))
						.query(String.class).single())
				.isEqualTo(COMING_BACK);
	}

	/**
	 * A MEMBER OF THIS SEASON ALREADY IS REFUSED, AND NOTHING IS TAKEN OFF HIS BALANCE.
	 *
	 * <p>He holds a covering balance, so the refusal cannot be coming out of the money. Without this
	 * the second row would collide with {@code membership_pk} and he would be answered 500.
	 */
	@Test
	void amemberOfThisSeasonAlreadyIsRefusedAndKeepsHisBalance() throws Exception {
		BigDecimal before = bookOf(idOf(ALREADY_IN_FOR_THIS_SEASON));

		MockHttpServletResponse refused = activate(EMAIL.get(ALREADY_IN_FOR_THIS_SEASON));

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(bodyOf(refused).path("reason").asString())
				.isEqualTo(MyMembershipWriteApi.ALREADY_A_MEMBER);

		assertThat(bookOf(idOf(ALREADY_IN_FOR_THIS_SEASON))).isEqualByComparingTo(before);
		assertThat(entriesAgainst(idOf(ALREADY_IN_FOR_THIS_SEASON))).isZero();
	}

	/**
	 * A MEMBER FREED OF THE FEE IS REFUSED, AND HIS BALANCE IS UNTOUCHED.
	 *
	 * <p><b>Derived rather than decided, and from PDL 11.08.2026:</b> „Balans ne propada nikad i
	 * prenosi se iz sezone u sezonu." He owes nothing, so there is nothing to take it off, and it
	 * keeps until a season in which he is no longer exempt. He holds a COVERING balance, so his
	 * refusal is not the money talking.
	 */
	@Test
	void amemberFreedOfTheFeeIsRefusedAndHisBalanceIsUntouched() throws Exception {
		BigDecimal before = bookOf(idOf(FREED_OF_THE_FEE));

		MockHttpServletResponse refused = activate(EMAIL.get(FREED_OF_THE_FEE));

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(bodyOf(refused).path("reason").asString())
				.isEqualTo(MyMembershipWriteApi.HE_OWES_NOTHING);

		assertThat(bookOf(idOf(FREED_OF_THE_FEE)))
				.as("an exempt member was charged for a season he was going to get free")
				.isEqualByComparingTo(before);
		assertThat(membershipOf(idOf(FREED_OF_THE_FEE))).isEqualTo("not a member");
	}

	/**
	 * A BALANCE THAT IS EXACTLY THE FEE LETS HIM IN, WHICH IS THE BOUNDARY THE OWNER DREW.
	 *
	 * <p><b>Owner, 26.09.2026:</b> „Balans <b>veci ili jednak</b> clanarini: QR koda nema, clanstvo
	 * se aktivira iz balansa." Seven members brought in is 4.200 dinars and the early period costs
	 * 4.200, so this member owes exactly nothing - and asking him to transfer nothing is the shape
	 * the owner refused when he refused the symbolic code.
	 *
	 * <p><b>This case exists because a mutation found it missing.</b> Narrowing „greater or equal" to
	 * „greater" passed every other case in this file, because everybody else here holds EIGHT
	 * referrals and at eight the two readings agree. The boundary was measured in the domain and
	 * nowhere at the route that acts on it, which is the one place a member is let in without paying.
	 *
	 * <p>And his book ends at nothing, not below it: what the membership takes is the fee, and the
	 * fee is all he had.
	 */
	@Test
	void abalanceThatIsExactlyTheFeeLetsHimIn() throws Exception {
		MockHttpServletResponse answer = activate(EMAIL.get(EXACTLY_ENOUGH));

		assertThat(answer.getStatus())
				.as("a balance equal to the fee was treated as short, so the boundary moved")
				.isEqualTo(201);

		assertThat(bodyOf(answer).path("fromTheBalance").path("rsd").asDouble()).isEqualTo(4200.0);

		assertThat(membershipOf(idOf(EXACTLY_ENOUGH))).startsWith("balance ");

		assertThat(bookOf(idOf(EXACTLY_ENOUGH)))
				.as("the book is not empty, so either less was taken than he owed or more")
				.isEqualByComparingTo("0.00");
	}

	/** And a short balance is sent to the invoice, with nothing written. */
	@Test
	void ashortBalanceIsRefusedAndNothingIsWritten() throws Exception {
		MockHttpServletResponse refused = activate(EMAIL.get(SHORT_BY_SIX_HUNDRED));

		assertThat(refused.getStatus()).isEqualTo(409);
		assertThat(bodyOf(refused).path("reason").asString()).isEqualTo(MyMembershipWriteApi.NOT_ENOUGH);

		assertThat(bookOf(idOf(SHORT_BY_SIX_HUNDRED))).isEqualByComparingTo("3600.00");
		assertThat(membershipOf(idOf(SHORT_BY_SIX_HUNDRED))).isEqualTo("not a member");
	}

	/**
	 * BEING LET IN ON THE BALANCE LEAVES THE STANDING BASIS ALONE.
	 *
	 * <p><b>This is the behaviour that {@code MembershipConstraintsTest}'s narrowing of the basis
	 * vocabulary rests on</b>, so it is measured here rather than argued there:
	 * {@code membership.basis} gains the word {@code balance} and
	 * {@code competitor.membership_basis} does not, because that column answers a different question
	 * - „does this person pay or is he let in free" (PDL 06.09.2026, „nosi oslobodjenje od
	 * clanarine"). A man who settles a season out of his balance is paying.
	 *
	 * <p>If that word ever does have to reach the person, this case is what turns red first.
	 */
	@Test
	void beingLetInOnTheBalanceLeavesTheStandingBasisAlone() throws Exception {
		assertThat(activate(FIRST_TIMER).getStatus()).isEqualTo(201);

		assertThat(db.sql("select membership_basis from competitor where id = ?").param(theFirstTimer)
						.query(String.class).single())
				.as("the per-person column was rewritten by a fact about one season")
				.isEqualTo("payment");

		assertThat(membershipOf(theFirstTimer)).startsWith("balance ");
	}

	/**
	 * WHAT THE INVOICE SAYS IS WHAT THE ACTIVATION SPENDS.
	 *
	 * <p>{@link MembershipInvoice} exists so these two cannot be two numbers, and this is the case
	 * that holds it: the member is shown what his balance would cover, then he is let in, and the
	 * line in the book is compared with the number he was shown.
	 */
	@Test
	void whatTheInvoiceSaysIsWhatTheActivationSpends() throws Exception {
		JsonNode shown = invoice(FIRST_TIMER);

		assertThat(shown.path("coveredByTheBalance").asBoolean()).isTrue();

		assertThat(activate(FIRST_TIMER).getStatus()).isEqualTo(201);

		assertThat(db.sql("select -rsd from balance_entry where competitor_id = ? and reason ="
						+ " 'membership'").param(theFirstTimer).query(BigDecimal.class).single())
				.isEqualByComparingTo(shown.path("fromTheBalance").path("rsd").decimalValue());
	}

	/**
	 * AND IT IS HIS OWN BALANCE THAT IS SPENT AND NOBODY ELSE'S.
	 *
	 * <p>Five members hold a book here and four of them hold the same amount, which is why this case
	 * asserts the OTHER man's book is unchanged rather than only that a number came out right: a
	 * route reading the wrong row would answer 4.200 either way, and the only thing that separates
	 * the two is whose line the book gained.
	 */
	@Test
	void itIsHisOwnBookThatIsSpentAndNobodyElses() throws Exception {
		BigDecimal anotherMansBook = bookOf(idOf(COMING_BACK));

		assertThat(activate(FIRST_TIMER).getStatus()).isEqualTo(201);

		assertThat(entriesAgainst(theFirstTimer)).isOne();
		assertThat(entriesAgainst(idOf(COMING_BACK)))
				.as("somebody else's balance paid for this membership")
				.isZero();
		assertThat(bookOf(idOf(COMING_BACK))).isEqualByComparingTo(anotherMansBook);
	}

	/**
	 * AND WHOEVER BROUGHT HIM IN IS PAID, because activation is activation whichever door it came
	 * through.
	 *
	 * <p>PDL: „Iznos leže na balans automatski, u trenutku kad se novom članu aktivira članarina."
	 * Nothing in any decision makes the reward depend on how the newcomer's season was paid for, and
	 * {@link PaymentApi} pays it on the other road for the same reason.
	 */
	@Test
	void whoeverBroughtHimInIsPaidWhenHeLetsHimselfIn() throws Exception {
		long referrer = idOf(THE_MAN_WHO_BROUGHT_HIM_IN);
		BigDecimal before = bookOf(referrer);

		assertThat(activate(FIRST_TIMER).getStatus()).isEqualTo(201);

		assertThat(bookOf(referrer))
				.as("the man who brought him in was not paid for an activation out of a balance")
				.isEqualByComparingTo(before.add(new BigDecimal("600")));

		assertThat(db.sql("select count(*) from balance_entry where competitor_id = ? and reason ="
						+ " 'referral' and referred_competitor_id = ?")
						.params(referrer, theFirstTimer).query(Long.class).single())
				.isOne();
	}

	/** And a member nobody brought in earns nobody anything, which is most of them. */
	@Test
	void amemberNobodyBroughtInEarnsNobodyAnything() throws Exception {
		long entriesBefore = db.sql("select count(*) from balance_entry where reason = 'referral'")
				.query(Long.class).single();

		assertThat(activate(EMAIL.get(COMING_BACK)).getStatus()).isEqualTo(201);

		assertThat(db.sql("select count(*) from balance_entry where reason = 'referral'")
						.query(Long.class).single())
				.isEqualTo(entriesBefore);
	}
}

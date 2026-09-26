package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * GET /api/me/membership: WHAT A MEMBER OWES ONCE HIS BALANCE HAS BEEN COUNTED, and the note the
 * portal makes of what it just promised him.
 *
 * <p><b>The clock stands on 3 October 2027</b>, inside V4's {@code early} window, so the fee is 35
 * euro and 4.200 dinars and the season on sale is 2028. Both numbers are the price list's own, which
 * matters for the case at the boundary: V4 prices a referral at 5 and 600, so <b>seven</b> members
 * brought in is exactly one membership.
 *
 * <p><b>FOUR MEMBERS, EVERY ONE WITH A DIFFERENT BALANCE, AND THE ONE EACH CASE ASKS ABOUT IS NEVER
 * THE FIRST WRITTEN.</b> That is the whole design of the fixture. A route that answered off the
 * first competitor, the first account, the largest balance or a constant would agree with the case
 * it happens to match and disagree with the other three, and every case below names the member it
 * is about by a number that is his alone.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MyMembershipApiTest {

	private static final String PATH = "/api/me/membership";

	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzz";

	/** 11:00 in Belgrade on 3 October 2027: V4's `early` period, and the season on sale is 2028. */
	private static final Instant NOW = Instant.parse("2027-10-03T09:00:00Z");

	private static final int THE_SEASON_ON_SALE = 2028;

	/* Written in this order, so that nobody a case asks about is the first row of anything. Numbers
	   well clear of 000001, because `member_number_seq` starts there and a drawn number must never
	   collide with a fixture's. */
	private static final String BROUGHT_IN_EIGHT = "007001";

	private static final String BROUGHT_IN_NOBODY = "007002";

	private static final String BROUGHT_IN_SIX = "007003";

	private static final String BROUGHT_IN_SEVEN = "007004";

	private static final Map<String, String> SIGNS_IN_AS = Map.of(
			BROUGHT_IN_EIGHT, "osmoro@primer.rs",
			BROUGHT_IN_NOBODY, "nikoga@primer.rs",
			BROUGHT_IN_SIX, "sestoro@primer.rs",
			BROUGHT_IN_SEVEN, "sedmoro@primer.rs");

	private static final String A_MODERATOR_WHO_DOES_NOT_RACE = "mod@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockInsideTheEarlyPeriod() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}

	@BeforeEach
	void fourMembersWithFourDifferentBalances() {
		competitor(BROUGHT_IN_EIGHT);
		competitor(BROUGHT_IN_NOBODY);
		competitor(BROUGHT_IN_SIX);
		competitor(BROUGHT_IN_SEVEN);

		SIGNS_IN_AS.forEach((number, email) -> {
			account(email, "competitor");
			belongsTo(email, number);
		});

		account(A_MODERATOR_WHO_DOES_NOT_RACE, "moderator");

		brought(BROUGHT_IN_EIGHT, 8);
		brought(BROUGHT_IN_SIX, 6);
		brought(BROUGHT_IN_SEVEN, 7);
	}

	/**
	 * A BOOK WITH ONE LINE PER MEMBER BROUGHT IN, which is the shape V36's own backfill writes.
	 *
	 * <p>Each line names a real competitor as the one brought in, because
	 * {@code balance_entry_referral_names_the_member} demands it and
	 * {@code balance_entry_one_a_referral} demands they be different people.
	 */
	private void brought(String referrer, int howMany) {
		for (int one = 0; one < howMany; one++) {
			String newcomer = "008" + String.format("%03d", ++issued);
			competitor(newcomer);

			db.sql("insert into balance_entry (competitor_id, eur, rsd, reason,"
							+ " referred_competitor_id, occurred_at, recorded_by, recorded_by_name)"
							+ " values ((select id from competitor where member_number = ?), 5, 600,"
							+ " 'referral', (select id from competitor where member_number = ?), ?,"
							+ " (select id from account where email = ?), 'Blagajnik Probni')")
					.params(referrer, newcomer, Timestamp.from(NOW.minus(Duration.ofDays(30))),
							A_MODERATOR_WHO_DOES_NOT_RACE)
					.update();
		}
	}

	private void competitor(String number) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment', ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, String.format("%016x", ++issued))
				.update();
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

	private void belongsTo(String email, String memberNumber) {
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(memberNumber, email).update();
	}

	private MockHttpServletRequestBuilder asking(String path, String email) {
		MockHttpServletRequestBuilder asks = get(path);
		return email == null ? asks
				: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
	}

	private int statusOf(String path, String email) throws Exception {
		return http.perform(asking(path, email)).andReturn().getResponse().getStatus();
	}

	private String whole(String email) throws Exception {
		return http.perform(asking(PATH, email)).andReturn().getResponse().getContentAsString();
	}

	private JsonNode invoiceOf(String memberNumber) throws Exception {
		return new ObjectMapper().readTree(whole(SIGNS_IN_AS.get(memberNumber)));
	}

	private java.math.BigDecimal promisedEur(String memberNumber) {
		return promisedColumn("eur", memberNumber);
	}

	private java.math.BigDecimal promisedRsd(String memberNumber) {
		return promisedColumn("rsd", memberNumber);
	}

	private java.math.BigDecimal promisedColumn(String column, String memberNumber) {
		return db.sql("select " + column + " from balance_promise where competitor_id ="
						+ " (select id from competitor where member_number = ?) and season = ?")
				.params(memberNumber, THE_SEASON_ON_SALE)
				.query(java.math.BigDecimal.class).single();
	}

	private String promiseTo(String memberNumber) {
		return db.sql("select coalesce((select eur || ' ' || rsd from balance_promise"
						+ " where competitor_id = (select id from competitor where member_number = ?)"
						+ " and season = ?), 'nothing promised')")
				.params(memberNumber, THE_SEASON_ON_SALE)
				.query(String.class).single();
	}

	/** Already the generic floor for every route; here beside a fixture that is served 200. */
	@Test
	void aVisitorWhoIsNotSignedInIsRefused() throws Exception {
		assertThat(statusOf(PATH, null)).isEqualTo(401);
		assertThat(statusOf(PATH, SIGNS_IN_AS.get(BROUGHT_IN_SIX))).isEqualTo(200);
	}

	/**
	 * AN ACCOUNT WITH NO MEMBER BEHIND IT HAS NO MEMBERSHIP TO BUY.
	 *
	 * <p>The identical shape {@code /api/inbox} and {@code /api/me/notifications} have for the
	 * identical case: a moderator who does not race (V23, owner 14.09.2026, „Empty for a moderator
	 * who does not race, which is the ordinary case and not a fault").
	 */
	@Test
	void anAccountWithNoMemberBehindItIsToldTheAddressIsNotThere() throws Exception {
		assertThat(statusOf(PATH, A_MODERATOR_WHO_DOES_NOT_RACE))
				.isEqualTo(statusOf(NOTHING_IS_THERE, A_MODERATOR_WHO_DOES_NOT_RACE));

		assertThat(whole(A_MODERATOR_WHO_DOES_NOT_RACE))
				.as("the refusal carried a body, which an address that is not there would not")
				.isEmpty();
	}

	/**
	 * A MEMBER WHO HAS BROUGHT IN NOBODY IS ASKED FOR THE PRICE LIST'S OWN FIGURE.
	 *
	 * <p>Most members, and the case that says the subtraction does not happen when there is nothing
	 * to subtract. The processing fee stands, because there is a transfer to process.
	 */
	@Test
	void amemberWithAnEmptyBookIsAskedForTheWholeFee() throws Exception {
		JsonNode owed = invoiceOf(BROUGHT_IN_NOBODY);

		assertThat(owed.path("season").asInt()).isEqualTo(THE_SEASON_ON_SALE);
		assertThat(owed.path("priceKey").asString()).isEqualTo("early");

		assertThat(owed.path("fee").path("eur").asDouble()).isEqualTo(35.0);
		assertThat(owed.path("fee").path("rsd").asDouble()).isEqualTo(4200.0);

		assertThat(owed.path("balance").path("rsd").asDouble()).isZero();
		assertThat(owed.path("fromTheBalance").path("rsd").asDouble()).isZero();

		assertThat(owed.path("toTransfer").path("eur").asDouble()).isEqualTo(35.0);
		assertThat(owed.path("toTransfer").path("rsd").asDouble()).isEqualTo(4200.0);

		assertThat(owed.path("processingFeeEur").asDouble()).isEqualTo(3.0);
		assertThat(owed.path("coveredByTheBalance").asBoolean()).isFalse();
		assertThat(owed.path("alreadyAMember").asBoolean()).isFalse();
	}

	/**
	 * SIX MEMBERS BROUGHT IN COMES OFF THE SLIP, AND THE SLIP IS WHAT IS LEFT.
	 *
	 * <p>The owner, 26.09.2026: „QR se kuje na iznos minus balans." <b>Every number here is a
	 * different number</b> - 4.200 owed, 3.600 held, 600 to send - so an answer that served the fee,
	 * the balance or the difference in the wrong field fails rather than coinciding.
	 */
	@Test
	void sixMembersBroughtInComeOffTheInvoice() throws Exception {
		JsonNode owed = invoiceOf(BROUGHT_IN_SIX);

		assertThat(owed.path("balance").path("eur").asDouble()).isEqualTo(30.0);
		assertThat(owed.path("balance").path("rsd").asDouble()).isEqualTo(3600.0);

		assertThat(owed.path("fromTheBalance").path("rsd").asDouble()).isEqualTo(3600.0);

		assertThat(owed.path("toTransfer").path("eur").asDouble()).isEqualTo(5.0);
		assertThat(owed.path("toTransfer").path("rsd").asDouble()).isEqualTo(600.0);

		assertThat(owed.path("coveredByTheBalance").asBoolean()).isFalse();
		assertThat(owed.path("processingFeeEur").asDouble())
				.as("there is a transfer, so there is something to process")
				.isEqualTo(3.0);
	}

	/**
	 * SEVEN IS EXACTLY A MEMBERSHIP, AND THAT IS THE SIDE THAT NEEDS NO CODE.
	 *
	 * <p>The owner's „veci ili <b>jednak</b>". <b>This case falls the moment the boundary becomes
	 * „greater".</b> And the processing fee goes with the transfer that is no longer happening,
	 * which is reasoning rather than a written decision and is named as such in {@link Balance}.
	 */
	@Test
	void sevenMembersBroughtInLeaveNothingToTransferAndNoFeeToProcess() throws Exception {
		JsonNode owed = invoiceOf(BROUGHT_IN_SEVEN);

		assertThat(owed.path("coveredByTheBalance").asBoolean())
				.as("a balance equal to the fee was treated as short")
				.isTrue();

		assertThat(owed.path("toTransfer").path("eur").asDouble()).isZero();
		assertThat(owed.path("toTransfer").path("rsd").asDouble()).isZero();

		assertThat(owed.path("processingFeeEur").asDouble())
				.as("a fee for processing a transfer that is not happening")
				.isZero();
	}

	/**
	 * AND EIGHT LEAVES THE SURPLUS WHERE IT IS.
	 *
	 * <p>„visak ostaje za sledecu godinu": what the membership uses is the FEE, and the balance
	 * answered is still the whole 40. The two differ, which is what makes this case say anything.
	 */
	@Test
	void eightMembersBroughtInSpendOnlyTheFeeAndKeepTheRest() throws Exception {
		JsonNode owed = invoiceOf(BROUGHT_IN_EIGHT);

		assertThat(owed.path("balance").path("eur").asDouble()).isEqualTo(40.0);
		assertThat(owed.path("fromTheBalance").path("eur").asDouble())
				.as("the whole balance was put against a smaller fee, so the surplus is gone")
				.isEqualTo(35.0);
		assertThat(owed.path("coveredByTheBalance").asBoolean()).isTrue();
	}

	/**
	 * THE BALANCE SERVED IS HIS OWN, and this is the case that proves it rather than assuming it.
	 *
	 * <p>Four members hold four different balances, so a route reading anybody else's - the first
	 * row, the largest, the sum of the table - answers one of these three numbers where another
	 * belongs. All three are asserted in one place so that no single wrong reading satisfies them.
	 */
	@Test
	void eachMemberIsServedHisOwnBalanceAndNobodyElsesBalance() throws Exception {
		assertThat(invoiceOf(BROUGHT_IN_NOBODY).path("balance").path("rsd").asDouble()).isZero();
		assertThat(invoiceOf(BROUGHT_IN_SIX).path("balance").path("rsd").asDouble()).isEqualTo(3600.0);
		assertThat(invoiceOf(BROUGHT_IN_SEVEN).path("balance").path("rsd").asDouble()).isEqualTo(4200.0);
		assertThat(invoiceOf(BROUGHT_IN_EIGHT).path("balance").path("rsd").asDouble()).isEqualTo(4800.0);
	}

	/**
	 * READING THE INVOICE IS WHAT RECORDS THE PROMISE, and that is the owner's decision of
	 * 27.09.2026 rather than a side effect nobody meant.
	 *
	 * <p>„skida se ono sto je kod obecao": a booking later has to know what this answer said, and
	 * this is the only place a reduced amount is ever worked out. What is written down is exactly
	 * what was served, which is the point - the two cannot be two numbers.
	 */
	@Test
	void readingTheInvoiceWritesDownWhatItPromised() throws Exception {
		assertThat(promiseTo(BROUGHT_IN_SIX))
				.as("something was promised before anybody was shown anything")
				.isEqualTo("nothing promised");

		JsonNode owed = invoiceOf(BROUGHT_IN_SIX);

		/* Compared as NUMBERS and not as text: JSON writes 30.00 as 30.0 and `numeric(10,2)` reads
		   back as 30.00, so a string comparison would fail over the spelling of a number that is
		   the same number. What is being asserted is that the amount written down is the amount
		   served, in both currencies. */
		assertThat(promisedEur(BROUGHT_IN_SIX))
				.isEqualByComparingTo(owed.path("fromTheBalance").path("eur").decimalValue());
		assertThat(promisedRsd(BROUGHT_IN_SIX))
				.isEqualByComparingTo(owed.path("fromTheBalance").path("rsd").decimalValue());
	}

	/**
	 * AND A MEMBER WHOSE BALANCE COVERS IT IS PROMISED NOTHING, because he is shown no code at all.
	 *
	 * <p>Were a promise written for him anyway, a stray transfer arriving for a member who did not
	 * have to pay would record a payment of the full fee AND take the fee off his balance, charging
	 * him twice for one season.
	 */
	@Test
	void amemberWhoNeedsNoCodeIsPromisedNothing() throws Exception {
		invoiceOf(BROUGHT_IN_SEVEN);

		assertThat(promiseTo(BROUGHT_IN_SEVEN))
				.as("a member with no code to pay was promised his fee off the book anyway")
				.isEqualTo("0.00 0.00");
	}

	/** And looking twice leaves one note, saying the same thing. */
	@Test
	void lookingTwiceLeavesOneNote() throws Exception {
		invoiceOf(BROUGHT_IN_SIX);
		invoiceOf(BROUGHT_IN_SIX);

		assertThat(db.sql("select count(*) from balance_promise where competitor_id ="
						+ " (select id from competitor where member_number = ?)")
						.param(BROUGHT_IN_SIX).query(Long.class).single())
				.isOne();

		assertThat(promiseTo(BROUGHT_IN_SIX)).isEqualTo("30.00 3600.00");
	}

	/**
	 * A MEMBER WHO IS ALREADY IN FOR THIS SEASON IS TOLD SO.
	 *
	 * <p>The row is written for the season on sale and not for another one, because a membership of
	 * a DIFFERENT season must not answer this: „alreadyAMember" is about the one being bought.
	 */
	@Test
	void amemberWhoIsAlreadyInForThisSeasonIsToldSo() throws Exception {
		assertThat(invoiceOf(BROUGHT_IN_SIX).path("alreadyAMember").asBoolean()).isFalse();

		db.sql("insert into membership (competitor_id, season, basis, payment_id) values"
						+ " ((select id from competitor where member_number = ?), ?, 'feeExempt', null)")
				.params(BROUGHT_IN_SIX, THE_SEASON_ON_SALE).update();

		assertThat(invoiceOf(BROUGHT_IN_SIX).path("alreadyAMember").asBoolean()).isTrue();

		db.sql("delete from membership where competitor_id ="
						+ " (select id from competitor where member_number = ?) and season = ?")
				.params(BROUGHT_IN_SIX, THE_SEASON_ON_SALE).update();

		db.sql("insert into membership (competitor_id, season, basis, payment_id) values"
						+ " ((select id from competitor where member_number = ?), 2029, 'feeExempt', null)")
				.param(BROUGHT_IN_SIX).update();

		assertThat(invoiceOf(BROUGHT_IN_SIX).path("alreadyAMember").asBoolean())
				.as("a membership of another season answered for the one on sale")
				.isFalse();
	}

	/**
	 * AND NOTHING BEYOND WHAT HE OWES LEAVES HERE.
	 *
	 * <p>{@link MembershipInvoice.Invoice} carries two more facts because the route that spends the
	 * balance turns on them - whether he is exempt, and the number he already has - and neither is
	 * any part of what he owes. Both already reach him through {@code /api/me}, and a second home
	 * for either is a second place they could disagree.
	 */
	@Test
	void onlyWhatHeOwesIsAnswered() throws Exception {
		assertThat(Answers.fieldsOf(invoiceOf(BROUGHT_IN_SIX)))
				.containsExactlyInAnyOrder("season", "alreadyAMember", "priceKey", "fee", "balance",
						"fromTheBalance", "toTransfer", "processingFeeEur", "coveredByTheBalance");
	}
}

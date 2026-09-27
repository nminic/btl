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
import org.springframework.http.MediaType;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

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

	/** And one who may say the money arrived, for the single case that walks the whole road. */
	private static final String THE_PAYMENTS_QUEUE = "blagajnik@primer.rs";

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

		account(THE_PAYMENTS_QUEUE, "moderator");
		db.sql("insert into account_admin_right (account_id, right_code) values"
						+ " ((select id from account where email = ?), 'queue:payments')")
				.param(THE_PAYMENTS_QUEUE).update();

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

		db.sql("insert into membership (" + MEMBERSHIP_FREE_OF_THE_FEE + ")"
						+ " values ((select id from competitor where member_number = ?), ?, " + A_TRAIL + ")")
				.params(BROUGHT_IN_SIX, THE_SEASON_ON_SALE).update();

		assertThat(invoiceOf(BROUGHT_IN_SIX).path("alreadyAMember").asBoolean()).isTrue();

		db.sql("delete from membership where competitor_id ="
						+ " (select id from competitor where member_number = ?) and season = ?")
				.params(BROUGHT_IN_SIX, THE_SEASON_ON_SALE).update();

		db.sql("insert into membership (" + MEMBERSHIP_FREE_OF_THE_FEE + ")"
						+ " values ((select id from competitor where member_number = ?), 2029, " + A_TRAIL + ")")
				.param(BROUGHT_IN_SIX).update();

		assertThat(invoiceOf(BROUGHT_IN_SIX).path("alreadyAMember").asBoolean())
				.as("a membership of another season answered for the one on sale")
				.isFalse();
	}

	/**
	 * THE WHOLE ROAD, THROUGH BOTH DOORS: HE READS HIS INVOICE, THE MONEY LANDS, AND WHAT COMES OFF
	 * THE BOOK IS WHAT THE INVOICE SAID.
	 *
	 * <p><b>Why this case exists and why it is here rather than in either of the two files that own
	 * one half.</b> {@code MyMembershipApiTest} proves the promise is written down;
	 * {@code PaymentApiTest} proves a promise that is already there is honoured. Neither of them
	 * proves the two JOIN UP - and that was measured rather than suspected: a mutation that stopped
	 * this route recording anything at all SURVIVED the whole of {@code PaymentApiTest}, because that
	 * file writes its own promises straight into the table. The seam between the two doors had no
	 * case over it, so a portal that promised a discount and then charged in full would have been
	 * green.
	 *
	 * <p>Nothing here is arranged by hand: the number asserted is read off the ANSWER the member was
	 * served, and the number compared with it is read off the book after a moderator recognised the
	 * money. If they are ever two numbers, this is what says so.
	 */
	@Test
	void whatTheInvoiceSaidIsWhatComesOffTheBookWhenTheMoneyLands() throws Exception {
		JsonNode owed = invoiceOf(BROUGHT_IN_SIX);

		java.math.BigDecimal offTheBalance = owed.path("fromTheBalance").path("rsd").decimalValue();
		java.math.BigDecimal toTransfer = owed.path("toTransfer").path("rsd").decimalValue();

		assertThat(offTheBalance.signum())
				.as("he was offered nothing off his invoice, so this case cannot tell a discount"
						+ " from none")
				.isPositive();
		assertThat(toTransfer.signum())
				.as("his balance covers the whole fee, so there is no code to pay and this road is"
						+ " not the one he takes")
				.isPositive();

		long id = db.sql("select id from competitor where member_number = ?").param(BROUGHT_IN_SIX)
				.query(Long.class).single();

		assertThat(http.perform(post("/api/payments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(THE_PAYMENTS_QUEUE).secret()))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"competitorId\":" + id + ",\"currency\":\"RSD\",\"method\":\"slip\"}"))
				.andReturn().getResponse().getStatus())
				.isEqualTo(201);

		/* Compared with the number the MEMBER WAS SERVED, never with one written in this file: that
		   is what makes this a case about the seam rather than about arithmetic either side of it. */
		assertThat(db.sql("select -rsd from balance_entry where competitor_id = ? and reason ="
						+ " 'membership'").param(id).query(java.math.BigDecimal.class).single())
				.as("what came off the book is not what the member was told his balance would cover")
				.isEqualByComparingTo(offTheBalance);

		assertThat(db.sql("select coalesce(sum(rsd), 0) from balance_entry where competitor_id = ?")
						.param(id).query(java.math.BigDecimal.class).single())
				.as("more came off than he was promised, or less")
				.isEqualByComparingTo("0.00");
	}

	/**
	 * A MEMBER OF HIS OWN, SIGNED IN, WITH A BOOK OF EXACTLY {@code howMany} MEMBERS BROUGHT IN.
	 *
	 * <p>Written inside the cases that need him rather than into {@link #fourMembersWithFourDifferentBalances},
	 * because what these cases measure is a balance that MOVES and the shared fixture is deliberately
	 * four members whose balances stand still. His number is his own and well clear of everybody
	 * else's, so no answer about him can be an answer about one of the four.
	 *
	 * @return the email he signs in with
	 */
	private String aMemberOfHisOwn(String number, int howMany) {
		competitor(number);

		String email = "sam-" + number + "@primer.rs";
		account(email, "competitor");
		belongsTo(email, number);

		brought(number, howMany);

		return email;
	}

	private JsonNode invoiceFor(String email) throws Exception {
		return new ObjectMapper().readTree(whole(email));
	}

	private long idOf(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number)
				.query(Long.class).single();
	}

	private int bookedFor(long competitorId) throws Exception {
		return http.perform(post("/api/payments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(THE_PAYMENTS_QUEUE).secret()))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"competitorId\":" + competitorId + ",\"currency\":\"RSD\",\"method\":\"slip\"}"))
				.andReturn().getResponse().getStatus();
	}

	private java.math.BigDecimal bookAddsUpTo(long competitorId) {
		return db.sql("select coalesce(sum(rsd), 0) from balance_entry where competitor_id = ?")
				.param(competitorId).query(java.math.BigDecimal.class).single();
	}

	/**
	 * A BALANCE THAT GROWS AFTER THE CODE WAS MINTED DOES NOT MOVE WHAT THE CODE PROMISED, and this
	 * is the owner's own scenario of 27.09.2026 walked end to end.
	 *
	 * <p><b>His words, and V36 quotes them over this very table:</b> „skida se ono sto je kod obecao,
	 * ne ono sto balans stoji na dan knjizenja." The case he was shown: a code minted for 3.600
	 * against a balance of 600, a seventh referral activated before the money arrives so the balance
	 * becomes 1.200, and then the 3.600 lands. <b>600 comes off and 600 stays.</b> He refused taking
	 * today's 1.200, with the cost stated: „the association's liability would fall by 1.200 against a
	 * discount of 600, so it loses quietly on every such case."
	 *
	 * <p><b>WHAT WAS MEASURED BEFORE THIS CASE EXISTED, because it is why the case is shaped like
	 * this.</b> The write was an upsert, so a MERE REFRESH of the page between the referral landing
	 * and the money arriving moved the promise from 600 to 1.200 and the booking took 1.200. Nothing
	 * saw it: {@code lookingTwiceLeavesOneNote} looks twice at a balance that has not moved, so
	 * „rewrite it" and „leave it" wrote the same row, and
	 * {@code whatIsTakenOffTheBookIsWhatWasPromisedAndNotTodaysBalance} puts the promise into the
	 * table BY HAND and never goes through this route at all.
	 *
	 * <p><b>SO THE BALANCE MUST MOVE BETWEEN THE TWO READS AND THE SECOND READ IS THE POINT.</b>
	 * Without the second read this measures nothing at all; without the growth in between, „serve the
	 * promise" and „serve today" give the same number and it measures nothing either.
	 *
	 * <p><b>And every number asserted is read off an ANSWER or off the BOOK, never written in this
	 * file</b>, so the case is about the seam rather than about arithmetic on either side of it.
	 */
	@Test
	void abalanceThatGrowsAfterTheCodeWasMintedDoesNotMoveThePromise() throws Exception {
		String him = aMemberOfHisOwn("007101", 1);
		long id = idOf("007101");

		JsonNode firstLook = invoiceFor(him);

		java.math.BigDecimal offTheBookAsMinted = firstLook.path("fromTheBalance").path("rsd")
				.decimalValue();
		java.math.BigDecimal toTransferAsMinted = firstLook.path("toTransfer").path("rsd").decimalValue();

		assertThat(offTheBookAsMinted).isEqualByComparingTo("600.00");
		assertThat(toTransferAsMinted).isEqualByComparingTo("3600.00");

		/* THE SEVENTH REFERRAL OF THE OWNER'S SCENARIO, landing while his slip is in the post. */
		brought("007101", 1);

		assertThat(bookAddsUpTo(id))
				.as("his balance did not move, so this case cannot tell a fixed promise from a"
						+ " recomputed one")
				.isEqualByComparingTo("1200.00");

		JsonNode secondLook = invoiceFor(him);

		assertThat(secondLook.path("balance").path("rsd").decimalValue())
				.as("the second look did not see the balance grow, so nothing here is about a balance"
						+ " that grew")
				.isEqualByComparingTo("1200.00");

		assertThat(secondLook.path("fromTheBalance").path("rsd").decimalValue())
				.as("a refresh moved what the code promises, so the slip in his hand and the row in the"
						+ " book now say two different numbers")
				.isEqualByComparingTo(offTheBookAsMinted);

		assertThat(secondLook.path("toTransfer").path("rsd").decimalValue())
				.as("a refresh changed what he is asked to send, so his printed slip is no longer the"
						+ " amount the portal expects")
				.isEqualByComparingTo(toTransferAsMinted);

		assertThat(promiseTo("007101")).isEqualTo("5.00 600.00");

		/* AND THEN THE MONEY LANDS, WHICH IS WHERE THE MONEY WAS LOST. */
		assertThat(bookedFor(id)).isEqualTo(201);

		assertThat(db.sql("select -rsd from balance_entry where competitor_id = ? and reason ="
						+ " 'membership'").param(id).query(java.math.BigDecimal.class).single())
				.as("more came off his book than the code he paid ever promised")
				.isEqualByComparingTo(offTheBookAsMinted);

		assertThat(bookAddsUpTo(id))
				.as("600 came off and 600 did not stay, which is the outcome the owner refused")
				.isEqualByComparingTo("600.00");
	}

	/**
	 * AND A MEMBER WHOSE BOOK OUTGREW HIS CODE MAY STILL LET HIMSELF IN, which is the other half of
	 * the same decision and the reason {@code coveredByTheBalance} is asked of TODAY.
	 *
	 * <p>The promise fixes what the SLIP says. It does not fix what he is allowed to do:
	 * {@code POST /api/me/membership} mints no code, reads no promise and spends what is in the book
	 * at the moment it writes. Were „covered" taken off the promise instead, a member who has since
	 * brought in enough people to cover the whole fee would be held to a slip for the rest of the
	 * season.
	 *
	 * <p><b>Both halves are asserted in the one answer, because it is their combination that is the
	 * decision:</b> covered is true while the transfer is not nothing. That pair is impossible unless
	 * the two are read from two places.
	 */
	@Test
	void amemberWhoseBookOutgrewHisCodeIsCoveredAndStillHoldsASlip() throws Exception {
		String him = aMemberOfHisOwn("007102", 1);

		assertThat(invoiceFor(him).path("coveredByTheBalance").asBoolean()).isFalse();

		brought("007102", 7);

		JsonNode after = invoiceFor(him);

		assertThat(after.path("coveredByTheBalance").asBoolean())
				.as("covered was read off his code instead of off his book, so a member who owes"
						+ " nothing is told to pay")
				.isTrue();

		assertThat(after.path("toTransfer").path("rsd").decimalValue())
				.as("the slip in his hand stopped being described, so whatever he already posted is"
						+ " an amount the portal no longer expects")
				.isEqualByComparingTo("3600.00");

		/* AND THE PROCESSING FEE FOLLOWS THE TRANSFER AND NOT THE COVER, because a transfer that is
		   asked for is a transfer somebody's bank charges for (V16). */
		assertThat(after.path("processingFeeEur").asDouble()).isEqualTo(3.0);

		assertThat(http.perform(post(PATH).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(him).secret())))
				.andReturn().getResponse().getStatus())
				.as("his book covers the whole fee and the door that needs no code refused him")
				.isEqualTo(201);
	}

	/**
	 * AND A PROMISE OF NOUGHT PINS HIM JUST THE SAME, which is the half of „written once" that looks
	 * like an oversight and is the reason the whole rule holds.
	 *
	 * <p><b>Why nought has to be a ROW.</b> A member whose book was empty when he first looked was
	 * minted a code for the WHOLE fee, and that slip is live. Were nought left unwritten, his second
	 * look would write the first real promise while that slip was still in his hand - and paying it
	 * would take a discount off his book that he had already paid in cash. So the row is written, and
	 * what it says is „this season's code has been minted, at nought".
	 *
	 * <p><b>WHAT IT COSTS, and it is the cost rather than a bug:</b> his balance keeps instead of being
	 * spent here. PDL 11.08.2026, „Balans ne propada nikad i prenosi se iz sezone u sezonu", is what
	 * makes that safe - it waits for next season - and if it grows past the whole fee he can still let
	 * himself in through the door that mints no code.
	 *
	 * <p><b>The balance must GROW between the two looks</b>, or „pinned at nought" and „recomputed from
	 * an empty book" give the same answer and this measures nothing.
	 */
	@Test
	void apromiseOfNoughtPinsTheSeasonExactlyAsARealOneDoes() throws Exception {
		String him = aMemberOfHisOwn("007104", 0);
		long id = idOf("007104");

		assertThat(invoiceFor(him).path("fromTheBalance").path("rsd").asDouble()).isEqualTo(0.0);
		assertThat(promiseTo("007104"))
				.as("nothing was written down for a member with an empty book, so his next look is free"
						+ " to promise something while his first slip is still live")
				.isEqualTo("0.00 0.00");

		brought("007104", 1);

		JsonNode second = invoiceFor(him);

		assertThat(second.path("balance").path("rsd").decimalValue())
				.as("his book did not grow, so nothing here is about a book that grew")
				.isEqualByComparingTo("600.00");

		assertThat(second.path("fromTheBalance").path("rsd").asDouble())
				.as("the code he is holding was re-priced, so the slip for the whole fee and the row in"
						+ " the book now say two different numbers")
				.isEqualTo(0.0);

		assertThat(second.path("toTransfer").path("rsd").decimalValue())
				.isEqualByComparingTo(second.path("fee").path("rsd").decimalValue());

		assertThat(bookedFor(id)).isEqualTo(201);

		assertThat(bookAddsUpTo(id))
				.as("he paid the whole fee in cash and a discount was taken off his book as well")
				.isEqualByComparingTo("600.00");
	}

	/**
	 * A MEMBER THE MANAGING BOARD FREED OF THE FEE IS TOLD THERE IS NO INVOICE HERE, and until this
	 * was written he was sent a bill for the whole membership.
	 *
	 * <p><b>What was measured.</b> {@code MembershipInvoice} computes {@code exemptFromTheFee},
	 * {@code MyMembershipWriteApi} and {@code ActivatingFromBalance} both turn on it and refuse him
	 * „and HIS BALANCE IS NOT TOUCHED" - and this route did not read it at all. So one door protected
	 * him while the other served him a slip for 4.200, wrote a promise against it, and let a booking
	 * take his balance off him for a season the Board had given him. One fact, two homes that
	 * disagreed.
	 *
	 * <p><b>HIS FEE IS MONEY AND HIS BOOK IS NOT EMPTY, and both are the case rather than tidiness.</b>
	 * A fee of nothing reaches the same refusal by a different road, so an exempt member in front of a
	 * free season would leave the outcome satisfied by two things at once; and „nothing came off his
	 * book" says nothing about a book with nothing in it.
	 *
	 * <p><b>THE OPEN PART, named rather than settled:</b> what his own screen should show him instead
	 * of an invoice. His basis already reaches it through {@code /api/me}, and a field on this answer
	 * would be the cheap way to say more - deliberately not invented here.
	 */
	@Test
	void amemberFreedOfTheFeeIsToldThereIsNoInvoiceHere() throws Exception {
		String him = aMemberOfHisOwn("007103", 1);
		long id = idOf("007103");

		assertThat(statusOf(PATH, him))
				.as("he was served an invoice before the Board freed him, so this case has a before")
				.isEqualTo(200);

		/* The look above wrote a promise, as it should for a member who still owed a fee. It is
		   cleared so that the assertion below is about what the EXEMPT read does, and it is what makes
		   the assertion bite: the row is gone, so a route that stopped reading `exemptFromTheFee`
		   would insert one again rather than being saved by `on conflict do nothing`. */
		db.sql("delete from balance_promise where competitor_id = ?").param(id).update();

		db.sql("update competitor set membership_basis = 'feeExempt' where id = ?").param(id).update();

		assertThat(statusOf(PATH, him))
				.as("a member who owes nothing was still handed an invoice")
				.isEqualTo(404);

		assertThat(promiseTo("007103"))
				.as("a promise was written against a membership he does not have to buy, so a stray"
						+ " transfer would take his balance off him")
				.isEqualTo("nothing promised");

		assertThat(bookAddsUpTo(id))
				.as("his book is empty, so the assertion after the booking could not tell an untouched"
						+ " balance from no balance at all")
				.isEqualByComparingTo("600.00");

		/* AND A BOOKING FOR HIM TAKES NOTHING, which is the harm the missing read actually did. */
		assertThat(bookedFor(id)).isEqualTo(201);

		assertThat(bookAddsUpTo(id))
				.as("a season he was given was charged to his balance anyway")
				.isEqualByComparingTo("600.00");
	}

	/**
	 * AND A SEASON THE PRICE LIST SAYS IS WORTH NOTHING IS NOT BILLED, which is one edit of one row
	 * away at any time.
	 *
	 * <p>{@code price_row_eur_not_negative} (V4) lets a row be nought and {@code PUT
	 * /api/pricing/{key}} has no lower bound - it refuses a negative price and one above what a row
	 * may cost, and nothing in between. The refusal on the writing door is
	 * {@code ActivatingFromBalance}'s; here the point is only that the answer is a fee of nothing
	 * rather than an error, and that no transfer and no processing fee are asked for.
	 *
	 * <p><b>The price is set over the ZATECENI rows rather than over a row this file inserted</b>, so
	 * it is the list the portal actually ships that is being made free.
	 */
	@Test
	void aseasonThePriceListMakesFreeIsBilledAtNothing() throws Exception {
		db.sql("update price_row set eur = 0, rsd = 0 where kind = 'period'").update();

		JsonNode owed = invoiceOf(BROUGHT_IN_SIX);

		assertThat(owed.path("fee").path("rsd").asDouble()).isEqualTo(0.0);
		assertThat(owed.path("toTransfer").path("rsd").asDouble()).isEqualTo(0.0);
		assertThat(owed.path("fromTheBalance").path("rsd").asDouble()).isEqualTo(0.0);

		assertThat(owed.path("processingFeeEur").asDouble())
				.as("a bank was asked to process a transfer of nothing")
				.isEqualTo(0.0);

		assertThat(owed.path("balance").path("rsd").asDouble())
				.as("his book was emptied by a price change")
				.isEqualTo(3600.0);
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

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
 * GET /api/me/balance: WHAT THE BOOK HOLDS FOR THE ASKER, to every member, and without writing.
 *
 * <p><b>Why this route and not {@code /api/me/membership} (22.10.2026).</b> The screen „Moja
 * članarina" drew the amount of a referral times a head count and called it a balance, and the owner
 * read „0 RSD" over a book of 600. The only route that reported the book answered 404 to a member
 * freed of the season's fee, and the owner is one, and it records a promise the first time a season
 * is looked at. This route is the book alone.
 *
 * <p><b>FOUR MEMBERS WITH FOUR DIFFERENT BOOKS, AND THE ONE EACH CASE ASKS ABOUT IS NEVER THE FIRST
 * WRITTEN</b>: two referrals (1.200 RSD), nobody brought in (nought), one referral and freed of the
 * fee for the season on sale (600 RSD, the case the old route refused), and a member in Bosnia whose
 * book is in euro (5 EUR) beside a dinar line that is not his balance. A route answering off the
 * first member, the largest book or a constant agrees with one case and disagrees with the others.
 * The clock stands on 20 October 2027, so the season on sale is 2028.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MyBalanceApiTest {

	private static final String PATH = "/api/me/balance";

	private static final String NOTHING_IS_THERE = "/api/zzzzzzzzzz";

	private static final Instant NOW = Instant.parse("2027-10-20T09:00:00Z");

	private static final int THE_SEASON_ON_SALE = 2028;

	private static final String BROUGHT_IN_TWO = "006001";

	private static final String BROUGHT_IN_NOBODY = "006002";

	private static final String FREED_OF_THE_FEE = "006003";

	private static final String IN_BOSNIA = "006004";

	private static final Map<String, String> SIGNS_IN_AS = Map.of(
			BROUGHT_IN_TWO, "dvoje@primer.rs",
			BROUGHT_IN_NOBODY, "nikoga@primer.rs",
			FREED_OF_THE_FEE, "oslobodjen@primer.rs",
			IN_BOSNIA, "bosanac@primer.rs");

	private static final String A_MODERATOR_WHO_DOES_NOT_RACE = "mod@primer.rs";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String A_TOWN_IN_BOSNIA =
			"(select id from place where country_id = (select id from country where code = 'BA')"
					+ " order by rank limit 1)";

	/** The columns V35 asks a membership freed of the fee to carry, and the trail that fills them. */
	private static final String A_MEMBERSHIP_FREE_OF_THE_FEE = "competitor_id, season, basis,"
			+ " payment_id, decided_by, decided_by_name, decided_at";

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
	void fourMembersWithFourDifferentBooks() {
		account(A_MODERATOR_WHO_DOES_NOT_RACE, "moderator");

		competitor(BROUGHT_IN_TWO, A_TOWN_IN_SERBIA);
		competitor(BROUGHT_IN_NOBODY, A_TOWN_IN_SERBIA);
		competitor(FREED_OF_THE_FEE, A_TOWN_IN_SERBIA);
		competitor(IN_BOSNIA, A_TOWN_IN_BOSNIA);

		SIGNS_IN_AS.forEach((number, email) -> {
			account(email, "competitor");
			belongsTo(email, number);
		});

		referral(BROUGHT_IN_TWO, 600, "RSD");
		referral(BROUGHT_IN_TWO, 600, "RSD");
		referral(FREED_OF_THE_FEE, 600, "RSD");
		referral(IN_BOSNIA, 5, "EUR");
		/* A dinar line in the book of a member whose money is euro: his balance is the euro one. */
		referral(IN_BOSNIA, 600, "RSD");

		db.sql("insert into membership (" + A_MEMBERSHIP_FREE_OF_THE_FEE + ")"
						+ " values ((select id from competitor where member_number = ?), ?, " + A_TRAIL + ")")
				.params(FREED_OF_THE_FEE, THE_SEASON_ON_SALE).update();
	}

	private void referral(String referrer, int amount, String currency) {
		String newcomer = "009" + String.format("%03d", ++issued);
		competitor(newcomer, A_TOWN_IN_SERBIA);

		db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
						+ " referred_competitor_id, occurred_at, recorded_by, recorded_by_name)"
						+ " values ((select id from competitor where member_number = ?), ?, ?,"
						+ " 'referral', (select id from competitor where member_number = ?), ?,"
						+ " (select id from account where email = ?), 'Blagajnik Probni')")
				.params(referrer, amount, currency, newcomer,
						Timestamp.from(NOW.minus(Duration.ofDays(30))), A_MODERATOR_WHO_DOES_NOT_RACE)
				.update();
	}

	private void competitor(String number, String town) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, "
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1990-01-01',"
						+ " " + town + ", 2027, false, true, ?, '',"
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

	private JsonNode balanceOf(String memberNumber) throws Exception {
		return new ObjectMapper().readTree(http.perform(asking(PATH, SIGNS_IN_AS.get(memberNumber)))
				.andReturn().getResponse().getContentAsString());
	}

	private long rows(String table) {
		return db.sql("select count(*) from " + table).query(Long.class).single();
	}

	@Test
	void aVisitorWhoIsNotSignedInIsRefused() throws Exception {
		assertThat(statusOf(PATH, null)).isEqualTo(401);
		assertThat(statusOf(PATH, SIGNS_IN_AS.get(BROUGHT_IN_TWO))).isEqualTo(200);
	}

	/** The identical shape {@code /api/me/membership} and {@code /api/inbox} have for the same case. */
	@Test
	void anAccountWithNoMemberBehindItIsToldTheAddressIsNotThere() throws Exception {
		assertThat(statusOf(PATH, A_MODERATOR_WHO_DOES_NOT_RACE))
				.isEqualTo(statusOf(NOTHING_IS_THERE, A_MODERATOR_WHO_DOES_NOT_RACE));

		assertThat(http.perform(asking(PATH, A_MODERATOR_WHO_DOES_NOT_RACE)).andReturn().getResponse()
				.getContentAsString())
				.as("the refusal carried a body, which an address that is not there would not")
				.isEmpty();
	}

	@Test
	void aMemberIsAnsweredWhatHisBookAddsUpToInDinars() throws Exception {
		JsonNode book = balanceOf(BROUGHT_IN_TWO);

		assertThat(book.path("amount").decimalValue()).isEqualByComparingTo("1200");
		assertThat(book.path("currency").asString()).isEqualTo("RSD");
		assertThat(book.path("amount").isNumber()).as("a number, not text").isTrue();
	}

	/** Most members, and the answer is nought in his money and never an absence. */
	@Test
	void aMemberWhoBroughtInNobodyIsAnsweredNought() throws Exception {
		JsonNode book = balanceOf(BROUGHT_IN_NOBODY);

		assertThat(book.path("amount").decimalValue()).isEqualByComparingTo("0");
		assertThat(book.path("currency").asString()).isEqualTo("RSD");
	}

	/**
	 * A MEMBER THE MANAGING BOARD FREED OF THIS SEASON'S FEE IS ANSWERED HIS BOOK, which is the case
	 * {@code /api/me/membership} refuses 404 and the reason this route exists: the owner is one.
	 */
	@Test
	void aMemberFreedOfTheFeeIsAnsweredHisBookAndNotRefused() throws Exception {
		assertThat(statusOf("/api/me/membership", SIGNS_IN_AS.get(FREED_OF_THE_FEE)))
				.as("the premise: the other route turns him away")
				.isEqualTo(404);

		assertThat(statusOf(PATH, SIGNS_IN_AS.get(FREED_OF_THE_FEE))).isEqualTo(200);
		assertThat(balanceOf(FREED_OF_THE_FEE).path("amount").decimalValue()).isEqualByComparingTo("600");
	}

	/** The money is the member's own: euro for a member in Bosnia, and the dinar line is not his balance. */
	@Test
	void aMemberInBosniaIsAnsweredInEuroAndNotTheSumOfBothMoneys() throws Exception {
		JsonNode book = balanceOf(IN_BOSNIA);

		assertThat(book.path("currency").asString()).isEqualTo("EUR");
		assertThat(book.path("amount").decimalValue()).isEqualByComparingTo("5");
	}

	/**
	 * IT WRITES NOTHING, for any of the four, however often it is asked: no promise (what the first
	 * look of {@code /api/me/membership} records) and no line in the book.
	 */
	@Test
	void askingRecordsNothing() throws Exception {
		long promises = rows("balance_promise");
		long entries = rows("balance_entry");

		for (int again = 0; again < 2; again++) {
			for (String number : SIGNS_IN_AS.keySet()) {
				balanceOf(number);
			}
		}

		assertThat(rows("balance_promise")).isEqualTo(promises);
		assertThat(rows("balance_entry")).isEqualTo(entries);
	}

	/**
	 * THE TWO ROUTES CANNOT DISAGREE about what the book holds, because it is the one call: the
	 * balance of the invoice is this answer.
	 */
	@Test
	void itAgreesWithTheBalanceTheInvoiceReports() throws Exception {
		for (String number : new String[] {BROUGHT_IN_TWO, BROUGHT_IN_NOBODY, IN_BOSNIA}) {
			JsonNode invoice = new ObjectMapper().readTree(http
					.perform(asking("/api/me/membership", SIGNS_IN_AS.get(number))).andReturn()
					.getResponse().getContentAsString());

			assertThat(balanceOf(number)).as("member " + number).isEqualTo(invoice.path("balance"));
		}
	}
}

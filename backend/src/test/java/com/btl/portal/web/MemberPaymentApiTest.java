package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * {@link MemberPaymentApi}: a payment recorded from the member's row in the moderation of the members.
 *
 * <p><b>THE SETUP SEPARATES EVERY SECOND SOURCE OF ONE VALUE</b>, and each is named here so a case
 * cannot quietly stand on two of them at once:
 * <ul>
 * <li><b>the member</b> is the one the address names, never the one asking: the moderator who records
 * is himself a member ({@link #A_MODERATOR_WHO_IS_A_MEMBER}, 000003) and is not first on the list;</li>
 * <li><b>the recipient</b> is the member, never the moderator, never the whole league (an empty
 * {@code to_id}, V13) and never a third member: 000005 was brought in by 000002, who is the third
 * member a mistaken address would most naturally reach;</li>
 * <li><b>the season</b> is the clock's: the clock is moved across 15 October, the zone's own midnight
 * and into 2026, and a season sent in the body is ignored;</li>
 * <li><b>the money</b> is the member's: 000007 pays in dinars, everybody else in euro, and the
 * moderators' own countries are never read;</li>
 * <li><b>the book</b> is the member's: the moderator who is a member has a book of his own;</li>
 * <li><b>the trail</b> is the account that asked, never the member's own account.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MemberPaymentApiTest {

	/** 2028 on sale, at „15. do 31. oktobra": 35 EUR plus the fee of 3, or 4.200 RSD. */
	private static final Instant AFTER_THE_FIFTEENTH = Instant.parse("2027-11-16T09:00:00Z");




	private static final String THE_SUPERADMIN = "superadmin-uplata@primer.rs";

	private static final String OVER_THE_MEMBERS = "moderator-clanovi-uplata@primer.rs";

	private static final String A_MODERATOR_WHO_IS_A_MEMBER = "moderator-clan-uplata@primer.rs";

	private static final String OVER_THE_PAYMENTS_ONLY = "moderator-uplate-samo@primer.rs";

	private static final String AN_ACTIVE_MEMBER = "clan-uplata@primer.rs";

	private static final String A_TOWN_ABROAD = "(select id from place where rank = 1)";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String THE_SUBJECT = "Evidentirana je vaša uplata članarine";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	/** Watched and never stubbed: the decision is „bez mejla", so nothing may be handed to it. */
	@MockitoSpyBean
	private Postman postman;

	private final java.util.Map<String, String> cookies = new java.util.HashMap<>();

	private long referrer;

	private long renewing;

	private long inDinars;

	private long theModeratorHimself;

	@BeforeEach
	void membersAndTheAdministration() {
		clock.moveTo(AFTER_THE_FIFTEENTH);

		referrer = competitor("000002", "a1", A_TOWN_ABROAD, true, null);
		theModeratorHimself = competitor("000003", "a2", A_TOWN_ABROAD, true, null);
		/* LAPSED, WITH A NUMBER AND NO ACCOUNT, which is the member the owner named: „clan iz 2027.
		   godine uplati za sezonu 2028, njega nema u redu clanova". Brought in by 000002, who has
		   already been rewarded for it. */
		renewing = competitor("000005", "a3", A_TOWN_ABROAD, false, referrer);
		inDinars = competitor("000007", "a4", A_TOWN_IN_SERBIA, false, null);

		HeldOn.season(db, renewing, 2027, "payment");
		HeldOn.season(db, theModeratorHimself, 2027, "payment");

		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, referred_competitor_id,"
						+ " occurred_at, recorded_by_name) values (?, 5.00, 'EUR', 'referral', ?,"
						+ " timestamptz '2027-01-10 10:00:00+00', 'Blagajnik Probni')")
				.params(referrer, renewing).update();

		/* THE MODERATOR'S OWN BOOK, so a balance read off the one asking cannot pass for his. */
		credited(theModeratorHimself, "20.00", "EUR");

		account(THE_SUPERADMIN, "superadmin", null, "Super", "Admin");
		account(OVER_THE_MEMBERS, "moderator", null, "Mira", "Clanovic");
		ticked(OVER_THE_MEMBERS, "entity:members");
		account(A_MODERATOR_WHO_IS_A_MEMBER, "moderator", theModeratorHimself, "Pera", "Sopstveni");
		ticked(A_MODERATOR_WHO_IS_A_MEMBER, "entity:members");
		account(OVER_THE_PAYMENTS_ONLY, "moderator", null, "Kasa", "Uplatic");
		ticked(OVER_THE_PAYMENTS_ONLY, "queue:payments");
		account(AN_ACTIVE_MEMBER, "competitor", referrer, "Ana", "Clanica");
	}

	private long competitor(String number, String suffix, String town, boolean active, Long referredBy) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Clan',"
						+ " 'M', date '1990-05-15', " + town + ", null, null, 2027, ?, ?, ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, active, "0011aabbccddee" + suffix, referredBy)
				.query(Long.class).single();
	}

	private void credited(long competitor, String amount, String currency) {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
						+ " recorded_by_name) values (?, ?::numeric, ?, 'overpayment', 2027,"
						+ " timestamptz '2027-01-10 10:00:00+00', 'Blagajnik Probni')")
				.params(competitor, amount, currency).update();
	}

	private void account(String email, String role, Long competitor, String first, String last) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values (?, ?, ?, (select id from role where code = ?), ?)")
				.params(first, last, email, role, competitor).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private long accountOf(String email) {
		return db.sql("select id from account where email = ?").param(email).query(Long.class).single();
	}

	private MockHttpServletResponse paid(String number, String json, String email) throws Exception {
		var asks = post("/api/members/" + number + "/payment").with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(json);

		return http.perform(email == null ? asks : asks.cookie(new Cookie(SessionCookie.NAME, cookies.get(email))))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse paid(String number, String received, String method, String email)
			throws Exception {
		return paid(number, "{\"received\": " + received + ", \"method\": \"" + method + "\"}", email);
	}

	private JsonNode body(MockHttpServletResponse answer) throws Exception {
		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private long count(String sql, Object... params) {
		return db.sql(sql).params(params).query(Long.class).single();
	}

	/** Every message, as „to subject", so a case can see where each one went. */
	private List<String> messages() {
		return db.sql("select coalesce(to_id::text, 'everybody') || ' ' || subject from message order by id")
				.query(String.class).list();
	}

	private String paymentOf(long competitor, int season) {
		return db.sql("select amount || ' ' || fee || ' ' || currency || ' ' || received || ' ' || method"
						+ " || ' ' || coalesce(reference, '-') || ' ' || state from payment"
						+ " where competitor_id = ? and season = ?")
				.params(competitor, season).query(String.class).single();
	}

	private String bookOf(long competitor) {
		return db.sql("select coalesce(sum(amount), 0) || ' ' || coalesce(min(currency), '-')"
						+ " from balance_entry where competitor_id = ?")
				.param(competitor).query(String.class).single();
	}

	@Test
	void aVisitorIsAskedToSignInAndNothingIsWritten() throws Exception {
		assertThat(paid("000005", "38", "paypal", null).getStatus()).isEqualTo(401);
		assertThat(count("select count(*) from payment where season = 2028")).isZero();
	}

	@Test
	void anybodyWithoutTheRightOverTheMembersIsToldThereIsNothingHere() throws Exception {
		/* ADL A8: 404. The moderator who works the payments queue holds a right, and it is not the one
		   this door asks for, although he books the same payment on the other screen. */
		for (String refused : List.of(AN_ACTIVE_MEMBER, OVER_THE_PAYMENTS_ONLY)) {
			assertThat(paid("000005", "38", "paypal", refused).getStatus()).as(refused).isEqualTo(404);
		}

		assertThat(count("select count(*) from payment where season = 2028")).isZero();
		assertThat(messages()).isEmpty();
	}

	/**
	 * A ZERO IN THE NUMBER OF THE ADDRESS IS A 400 BEFORE THE HANDLER IS REACHED, for somebody who holds
	 * the right too. {@code NoTextHoldsAZeroTest} lists {@code memberNumber} among the texts the
	 * dispatcher binds outside a body with that reason, and this is the measurement for this route:
	 * the same moderator is told 404 for a number nobody has (the case below) and 400 for a zero, so
	 * the refusal is not the handler's own, and nothing is written or said.
	 */
	@Test
	void aZeroInTheNumberOfTheAddressIsRefusedBeforeTheHandlerIsReached() throws Exception {
		MockHttpServletResponse answer = http.perform(post(URI.create("/api/members/%00/payment")).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"received\": 38, \"method\": \"paypal\"}")
				.cookie(new Cookie(SessionCookie.NAME, cookies.get(THE_SUPERADMIN)))).andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(count("select count(*) from payment where season = 2028")).isZero();
		assertThat(messages()).isEmpty();
	}

	@Test
	void aNumberNobodyHasIsAnAddressThatIsNotThereWhateverTheBodySays() throws Exception {
		MockHttpServletResponse answer = paid("009999", "{\"received\": 0}", THE_SUPERADMIN);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
	}

	@Test
	void aLapsedMemberWithNoAccountIsBookedForTheSeasonOnSaleAndToldInHisInboxOnly() throws Exception {
		/* By a moderator over the members who may NOT work the payments queue. */
		long seqBefore = count("select last_value from member_number_seq");

		MockHttpServletResponse answer = paid("000005", "38", "paypal", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(body(answer).path("memberNumber").asString()).isEqualTo("000005");

		assertThat(paymentOf(renewing, 2028)).isEqualTo("35.00 3.00 EUR 38.00 paypal - recorded");
		assertThat(db.sql("select basis from membership m join payment p on p.id = m.payment_id"
						+ " where m.competitor_id = ? and m.season = 2028 and p.competitor_id = ?")
				.params(renewing, renewing).query(String.class).single())
				.isEqualTo("payment");

		/* The trail is the account that asked, by its key and by its name. */
		assertThat(db.sql("select recorded_by || ' ' || recorded_by_name from payment"
						+ " where competitor_id = ? and season = 2028")
				.param(renewing).query(String.class).single())
				.isEqualTo(accountOf(OVER_THE_MEMBERS) + " Mira Clanovic");

		/* A RENEWAL IS NOT A SECOND PERSON: the number stays and none is drawn. */
		assertThat(db.sql("select member_number || ' ' || active from competitor where id = ?")
				.param(renewing).query(String.class).single()).isEqualTo("000005 true");
		assertThat(count("select last_value from member_number_seq")).isEqualTo(seqBefore);

		/* Exact, so nothing came off his book and nothing went onto it; and the man who brought him
		   in is not rewarded a second time. */
		assertThat(bookOf(renewing)).isEqualTo("0 -");
		assertThat(count("select count(*) from balance_entry where competitor_id = ?", referrer)).isOne();

		/* ONE MESSAGE, TO HIM, FROM THE LEAGUE, IN SERBIAN, and nothing to anybody else. */
		assertThat(messages()).containsExactly(renewing + " " + THE_SUBJECT);
		assertThat(db.sql("select coalesce(from_id::text, '-') || ' | ' || from_name || ' | ' || body"
						+ " from message").query(String.class).single())
				.isEqualTo("- | Balkanska trkačka liga | Za sezonu 2028 evidentirana je vaša uplata članarine.\n"
						+ "\nZa sezonu 2028 ste član lige, a osnov vašeg članstva je uplata.\n"
						+ "\nBalkanska trkačka liga");

		verifyNoInteractions(postman);
	}

	@Test
	void theMemberIsTheOneTheAddressNamesAndNeverTheOneAsking() throws Exception {
		/* The moderator is himself a member who holds no 2028 either, and he records for 000005. */
		assertThat(paid("000005", "38", "paypal", A_MODERATOR_WHO_IS_A_MEMBER).getStatus()).isEqualTo(201);

		assertThat(count("select count(*) from payment where competitor_id = ? and season = 2028",
				theModeratorHimself)).isZero();
		assertThat(count("select count(*) from payment where competitor_id = ? and season = 2028",
				renewing)).isOne();
		assertThat(messages()).containsExactly(renewing + " " + THE_SUBJECT);
	}

	@Test
	void hisOwnRowIsHisToRecordAndTheTrailAndTheMessageNameHim() throws Exception {
		/* PDL P8, 18.10.2026, „Moderator i superadmin smeju da rade na sopstvenom redu, uz trag koji ih
		   imenuje”. And his own book of 20 EUR pays the 3 his money falls short by. */
		assertThat(paid("000003", "35", "paypal", A_MODERATOR_WHO_IS_A_MEMBER).getStatus()).isEqualTo(201);

		assertThat(db.sql("select recorded_by || ' ' || recorded_by_name from payment"
						+ " where competitor_id = ? and season = 2028")
				.param(theModeratorHimself).query(String.class).single())
				.isEqualTo(accountOf(A_MODERATOR_WHO_IS_A_MEMBER) + " Pera Sopstveni");
		assertThat(bookOf(theModeratorHimself)).isEqualTo("17.00 EUR");
		assertThat(messages()).containsExactly(theModeratorHimself + " " + THE_SUBJECT);
	}

	@Test
	void theRestComesOffHisBookAlwaysInHisOwnMoney() throws Exception {
		/* 4.000 of 4.200 dinars arrived and his book of 1.000 dinars pays the 200: case 2 of the
		   payments screen, with the box the row does not have ticked (PDL P8, „balans se uvek koristi za
		   ostatak"). The moderator's book is in euro and is not touched. */
		credited(inDinars, "1000.00", "RSD");

		assertThat(paid("000007", "4000", "ips", A_MODERATOR_WHO_IS_A_MEMBER).getStatus()).isEqualTo(201);

		assertThat(paymentOf(inDinars, 2028)).isEqualTo("4200.00 0.00 RSD 4000.00 ips - recorded");
		assertThat(bookOf(inDinars)).isEqualTo("800.00 RSD");
		assertThat(bookOf(theModeratorHimself)).isEqualTo("20.00 EUR");
	}

	@Test
	void aBookThatCannotCoverTheRestIsSpentToTheLastAndTheShortBookingNamesWhoAcceptedIt()
			throws Exception {
		/* „Prihvatam umanjen ukupan iznos? Da" on the screen sends this same body, cases 3 and 3b; the
		   trail of the forgiven 100 dinars is the payment's own (PDL, [IZVEDENO 03.10.2026]). */
		credited(inDinars, "100.00", "RSD");

		assertThat(paid("000007", "4000", "ips", OVER_THE_MEMBERS).getStatus()).isEqualTo(201);

		assertThat(bookOf(inDinars)).isEqualTo("0.00 RSD");
		assertThat(db.sql("select recorded_by from payment where competitor_id = ? and season = 2028")
				.param(inDinars).query(Long.class).single()).isEqualTo(accountOf(OVER_THE_MEMBERS));
	}

	@Test
	void moreThanExpectedGoesOntoHisBook() throws Exception {
		assertThat(paid("000005", "50", "paypal", OVER_THE_MEMBERS).getStatus()).isEqualTo(201);

		assertThat(bookOf(renewing)).isEqualTo("12.00 EUR");
	}

	@ParameterizedTest
	@CsvSource({
			"2027-10-10T09:00:00Z, 2027",
			"2027-11-10T23:30:00Z, 2028",
			"2027-11-16T09:00:00Z, 2028",
			"2028-01-01T10:00:00Z, 2028",
			"2028-01-01T16:30:00Z, 2028",
			"2026-10-18T09:00:00Z, 2027"})
	void theSeasonIsTheOneOnSaleThatDayAndNoOther(Instant when, int season) throws Exception {
		/* „do 14.10. samo tekuća, od 15.10. samo naredna” (PDL P8, 18.10.2026), read in the league's
		   zone, and a season sent in the body is ignored. From 15 October to 31 December the season on
		   sale and the season being run are two years; 1 January, before and after the tables of the
		   old year freeze, moves nothing; and in 2026, before the league, it is the first season. The
		   member is the one in dinars, who holds no season at all, and he sends more than any row
		   costs, so every day books. */
		clock.moveTo(when);

		MockHttpServletResponse answer = paid("000007",
				"{\"received\": 7000, \"method\": \"ips\", \"season\": 2030}", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(201);
		assertThat(db.sql("select season from payment where competitor_id = ?").param(inDinars)
				.query(Integer.class).single()).isEqualTo(season);
		assertThat(db.sql("select season from membership where competitor_id = ?").param(inDinars)
				.query(Integer.class).single()).isEqualTo(season);
		assertThat(db.sql("select body from message where to_id = ?").param(inDinars)
				.query(String.class).single())
				.startsWith("Za sezonu " + season + " evidentirana");
	}

	@Test
	void aSeasonHeldOnAnExemptionOrOnABalanceIsRefusedAndNothingIsWrittenOrSaid() throws Exception {
		/* Q1 of this increment: a payment over an exemption comes with the change of basis, not here. */
		HeldOn.season(db, renewing, 2028, "feeExempt");
		HeldOn.season(db, theModeratorHimself, 2028, "balance");

		for (String number : List.of("000005", "000003")) {
			MockHttpServletResponse answer = paid(number, "38", "paypal", OVER_THE_MEMBERS);

			assertThat(answer.getStatus()).as(number).isEqualTo(409);
			assertThat(body(answer).path("reason").asString()).isEqualTo(PaymentApi.THE_MEMBERSHIP_IS_ALREADY_HELD);
		}

		assertThat(count("select count(*) from payment where season = 2028")).isZero();
		assertThat(db.sql("select basis from membership where competitor_id = ? and season = 2028")
				.param(renewing).query(String.class).single()).isEqualTo("feeExempt");
		assertThat(messages()).isEmpty();
	}

	@Test
	void aSecondPressOnASeasonAlreadyPaidChangesNothingAndSaysNothing() throws Exception {
		assertThat(paid("000005", "38", "paypal", OVER_THE_MEMBERS).getStatus()).isEqualTo(201);

		MockHttpServletResponse again = paid("000005", "38", "paypal", OVER_THE_MEMBERS);

		assertThat(again.getStatus()).isEqualTo(200);
		assertThat(count("select count(*) from payment where competitor_id = ?", renewing)).isEqualTo(2L);
		assertThat(messages()).containsExactly(renewing + " " + THE_SUBJECT);
	}

	@ParameterizedTest
	@CsvSource(delimiter = '|', value = {
			"{\"received\": 38}                          | theFormIsNotComplete",
			"{\"received\": 38, \"method\": \"  \"}     | theFormIsNotComplete",
			"{\"method\": \"paypal\"}                    | theAmountIsNotMoney",
			"{\"received\": 0, \"method\": \"paypal\"}   | theAmountIsNotMoney",
			"{\"received\": -38, \"method\": \"paypal\"} | theAmountIsNotMoney",
			"{\"received\": 38.5, \"method\": \"paypal\"} | theAmountIsNotWhole",
			"{\"received\": 99999999999, \"method\": \"paypal\"} | theAmountIsNotKeptExactly",
			"{\"received\": 38, \"method\": \"card\"}    | theMethodIsNotKnown"})
	void whatCannotBeBookedIsRefusedInThePaymentsScreensOwnWords(String json, String reason) throws Exception {
		MockHttpServletResponse answer = paid("000005", json.strip(), OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(body(answer).path("reason").asString()).isEqualTo(reason);
		assertThat(count("select count(*) from payment where season = 2028")).isZero();
		assertThat(messages()).isEmpty();
	}

	@Test
	void theSuperadminRecordsWithoutATick() throws Exception {
		assertThat(paid("000005", "38", "paypal", THE_SUPERADMIN).getStatus()).isEqualTo(201);
		assertThat(db.sql("select recorded_by_name from payment where competitor_id = ? and season = 2028")
				.param(renewing).query(String.class).single()).isEqualTo("Super Admin");
	}

	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(AFTER_THE_FIFTEENTH);
		}
	}
}

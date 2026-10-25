package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.statement.ASyntheticStatement;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * TAKING A BANK STATEMENT ON THE PAYMENTS SCREEN, END TO END: what books by itself, what waits and why,
 * whom a waiting line is suggested for, and that nothing is booked twice.
 *
 * <p>The decisions are the owner's of 24.10.2026 (PDL „Učitavanje izvoda iz banke na ekranu Uplate"):
 * „Kad poziv na broj imenuje člana i sezonu (YYYYNNNNNN) i iznos je tačno očekivani, uplata se evidentira
 * sama. Sve ostalo (manji ili veći iznos, nepoznat broj) ide na ručnu potvrdu."; „Uplata bez poziva na
 * broj dobija predlog člana po imenu i prezimenu uplatioca"; „Server pamti broj izvoda i stavke (da se
 * isti izvod ne knjiži dvaput)".
 *
 * <p><b>The clock is {@code PaymentApiTest}'s</b>, 20 October 2027: the season being paid for is 2028,
 * and a member in Serbia born in 1990 is expected to send 4.200 dinars. So a reference of the season is
 * {@code 2028NNNNNN}, and 2027 is another season.
 *
 * <p><b>THE SETUP KEEPS EVERY SECOND SOURCE OF A VALUE APART:</b> every statement carries at least two
 * payments for two members with two amounts, two references and two payers, so an amount, a member or a
 * reference read off the other line books the wrong man or nobody, and the case says which.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class StatementApiTest {

	private static final Instant NOW = Instant.parse("2027-10-20T09:00:00Z");

	private static final int SEASON = 2028;

	private static final String MODERATOR = "blagajnik-izvod@primer.rs";

	private static final String NO_RIGHTS_MODERATOR = "bez-prava-izvod@primer.rs";

	private static final String EXPECTED = "4200.00";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String A_TOWN_ABROAD = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock theTwentiethOfOctober() {
			return Clock.fixed(NOW, java.time.ZoneOffset.UTC);
		}
	}

	private String moderatorCookie;

	private String noRightsCookie;

	private int issued;

	private int orders;

	@BeforeEach
	void aModeratorWhoMayWorkThePaymentsQueue() {
		moderatorCookie = account(MODERATOR, "moderator", "Blagajnik", "Izvoda");
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:payments')")
				.param(MODERATOR).update();

		noRightsCookie = account(NO_RIGHTS_MODERATOR, "moderator", "Bez", "Prava");
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'entity:events')")
				.param(NO_RIGHTS_MODERATOR).update();
	}

	/* ------------------------------------------------------------------------------------
	   WHAT BOOKS BY ITSELF
	   ------------------------------------------------------------------------------------ */

	/**
	 * A REFERENCE OF THIS SEASON AND EXACTLY THE EXPECTED AMOUNT BOOKS BY ITSELF, as the payments screen
	 * would book it: one payment of the member the reference names, {@code ips}, the reference on it,
	 * what arrived as what arrived, recorded by whoever took the statement, and his membership.
	 *
	 * <p>The second payment on the statement names another member and sends another amount, so a booking
	 * that took the amount or the member off the wrong line is a booking of the wrong man.
	 */
	@Test
	void aReferenceOfThisSeasonAndTheExpectedAmountIsBookedToTheMemberItNames() throws Exception {
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		long janko = competitor("000031", "Janko", "Jankovic", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(1)
				.credit("JANKO JANKOVIĆ, ULICA 2, BEOGRAD", "4100.00", "2028000031", order())
				.credit("MARKO MARKOVIĆ, ULICA 1, BEOGRAD", EXPECTED, "2028000027", order())
				.fee("19.50", order()));

		assertThat(taken.get("bookedNow").asInt()).isEqualTo(1);
		assertThat(states(taken)).containsExactly("waiting", "booked");
		assertThat(taken.get("lines").get(1).get("member").get("competitorId").asLong()).isEqualTo(marko);
		assertThat(taken.get("lines").get(0).get("waitsBecause").asString()).isEqualTo("notTheExpectedAmount");

		assertThat(db.sql("select competitor_id || '|' || season || '|' || reference || '|' || method || '|'"
						+ " || received || '|' || recorded_by_name from payment")
				.query(String.class).list())
				.containsExactly(marko + "|2028|2028000027|ips|4200.00|Blagajnik Izvoda");
		assertThat(db.sql("select competitor_id || '|' || season || '|' || basis from membership")
				.query(String.class).list())
				.containsExactly(marko + "|2028|payment");
		assertThat(db.sql("select count(*) from payment where competitor_id = ?").param(janko)
				.query(Long.class).single()).isZero();

		/* AND THE LINE NAMES THE PAYMENT IT BOOKED, which is what keeps it booked on every later look. */
		assertThat(db.sql("select l.payment_id = p.id from bank_statement_line l, payment p"
						+ " where l.order_number = ?")
				.param(orderOf(taken, 1)).query(Boolean.class).single()).isTrue();
	}

	/**
	 * LESS, MORE, A REFERENCE OF ANOTHER SEASON, A REFERENCE THAT NAMES NOBODY, AND A MEMBER WHO PAYS IN
	 * EURO: each waits, each with its own reason, and nothing is booked. The member the reference names is
	 * still suggested, whatever season it names.
	 */
	@Test
	void everythingElseWaitsForAPersonWithItsReason() throws Exception {
		long less = competitor("000041", "Manje", "Placa", A_TOWN_IN_SERBIA);
		long more = competitor("000042", "Vise", "Placa", A_TOWN_IN_SERBIA);
		long earlier = competitor("000043", "Ranija", "Sezona", A_TOWN_IN_SERBIA);
		long abroad = competitor("000044", "Iz", "Inostranstva", A_TOWN_ABROAD);

		JsonNode taken = taken(statement(2)
				.credit("MANJE PLACA", "4199.00", "2028000041", order())
				.credit("VISE PLACA", "4201.00", "2028000042", order())
				.credit("RANIJA SEZONA", EXPECTED, "2027000043", order())
				.credit("NEPOZNAT BROJ", EXPECTED, "2028999999", order())
				.credit("IZ INOSTRANSTVA", EXPECTED, "2028000044", order())
				.credit("KRATAK BROJ", EXPECTED, "202800004", order()));

		assertThat(taken.get("bookedNow").asInt()).isZero();
		assertThat(states(taken)).containsOnly("waiting");
		assertThat(field(taken, "waitsBecause")).containsExactly("notTheExpectedAmount", "notTheExpectedAmount",
				"anotherSeason", "unknownReference", "notInDinars", "unknownReference");
		assertThat(firstCandidates(taken)).containsExactly(less, more, earlier, null, abroad, null);
		assertThat(db.sql("select count(*) from payment").query(Long.class).single()).isZero();
		assertThat(db.sql("select count(*) from membership").query(Long.class).single()).isZero();
	}

	/* ------------------------------------------------------------------------------------
	   A PAYMENT WITHOUT A REFERENCE
	   ------------------------------------------------------------------------------------ */

	/**
	 * THE PAYER'S NAME SUGGESTS THE MEMBER, in either order of the two names and whether or not his bank
	 * kept the Serbian letters; two members of the name are both suggested; a payer who is no member
	 * suggests nobody. None of it is booked: a suggestion is for a person to confirm.
	 */
	@Test
	void aPaymentWithoutAReferenceSuggestsTheMembersOfThePayersName() throws Exception {
		long dusko = competitor("000004", "Duško", "Kunić", A_TOWN_IN_SERBIA);
		long djordje = competitor("000005", "Đorđe", "Čolić", A_TOWN_IN_SERBIA);
		long ana = competitor("000006", "Ana", "Anić", A_TOWN_IN_SERBIA);
		long anotherAna = competitor("000007", "Ana", "Anić", A_TOWN_ABROAD);
		competitor("000008", "Nikola", "Nikolić", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(3)
				.credit("DUSKO KUNIC, KRALJA PETRA 1, BEOGRAD", EXPECTED, null, order())
				.credit("ČOLIĆ ĐORĐE, ULICA 2, NIŠ", EXPECTED, null, order())
				.credit("ANA ANIĆ, ULICA 3", EXPECTED, null, order())
				.credit("SUPRUGA NIKOLIĆ, ULICA 4", EXPECTED, null, order()));

		assertThat(taken.get("bookedNow").asInt()).isZero();
		assertThat(field(taken, "waitsBecause")).containsOnly("noReference");
		assertThat(candidates(taken, 0)).containsExactly(dusko);
		assertThat(candidates(taken, 1)).containsExactly(djordje);
		assertThat(candidates(taken, 2)).containsExactlyInAnyOrder(ana, anotherAna);
		assertThat(candidates(taken, 3)).isEmpty();
		assertThat(db.sql("select count(*) from payment").query(Long.class).single()).isZero();
	}

	/**
	 * THE FIRST STATEMENT'S OWN CASE: Duško's payment was booked by hand before the statement was taken.
	 * The line is about him alone and he holds the season, so it reads „already recorded" and books
	 * nothing; and the same for a reference of his with the expected amount, which the booking answers as
	 * the harmless repeat it is.
	 *
	 * <p>And two namesakes of whom one holds the season are still a question, not an answer.
	 */
	@Test
	void aPaymentOfAMemberWhoAlreadyHoldsTheSeasonIsAlreadyRecordedAndBooksNothing() throws Exception {
		long dusko = competitor("000004", "Duško", "Kunić", A_TOWN_IN_SERBIA);
		long ana = competitor("000006", "Ana", "Anić", A_TOWN_IN_SERBIA);
		competitor("000007", "Ana", "Anić", A_TOWN_IN_SERBIA);
		bookedByHand(dusko);
		bookedByHand(ana);

		JsonNode taken = taken(statement(1)
				.credit("DUŠKO KUNIĆ, KRALJEVAČKIH ŽRTAVA 1, BEOGRAD", EXPECTED, null, order())
				.credit("DUŠKO KUNIĆ, KRALJEVAČKIH ŽRTAVA 1, BEOGRAD", EXPECTED, "2028000004", order())
				.credit("ANA ANIĆ", EXPECTED, null, order()));

		assertThat(taken.get("bookedNow").asInt()).isZero();
		assertThat(states(taken)).containsExactly("alreadyRecorded", "alreadyRecorded", "waiting");
		assertThat(taken.get("lines").get(0).get("member").get("memberNumber").asString()).isEqualTo("000004");
		assertThat(db.sql("select count(*) from payment").query(Long.class).single()).isEqualTo(2);
		assertThat(db.sql("select count(*) from balance_entry").query(Long.class).single()).isZero();
	}

	/* ------------------------------------------------------------------------------------
	   NOT TWICE
	   ------------------------------------------------------------------------------------ */

	/**
	 * THE SAME STATEMENT TAKEN TWICE BOOKS NOTHING THE SECOND TIME and is not refused: it answers the
	 * lines as they stand, the booked one still booked.
	 */
	@Test
	void theSameStatementTakenTwiceBooksNothingTheSecondTime() throws Exception {
		competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);

		ASyntheticStatement statement = statement(5)
				.credit("MARKO MARKOVIĆ", EXPECTED, "2028000027", order())
				.credit("NEKO DRUGI", "100.00", null, order());

		JsonNode first = taken(statement);
		JsonNode second = taken(statement);

		assertThat(first.get("bookedNow").asInt()).isEqualTo(1);
		assertThat(second.get("bookedNow").asInt()).isZero();
		assertThat(states(second)).containsExactly("booked", "waiting");
		assertThat(db.sql("select count(*) from payment").query(Long.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from bank_statement").query(Long.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from bank_statement_line").query(Long.class).single()).isEqualTo(2);
	}

	/**
	 * ONE PAYMENT PRINTED ON TWO STATEMENTS IS ONE LINE: the second statement is kept, its new payment is
	 * read, and the one it shares with the first is neither a second line nor a second booking.
	 */
	@Test
	void onePaymentOnTwoStatementsIsOneLineAndOneBooking() throws Exception {
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		long janko = competitor("000031", "Janko", "Jankovic", A_TOWN_IN_SERBIA);
		String shared = order();

		taken(statement(6).credit("MARKO MARKOVIĆ", EXPECTED, "2028000027", shared));

		JsonNode second = taken(statement(7)
				.credit("MARKO MARKOVIĆ", EXPECTED, "2028000027", shared)
				.credit("JANKO JANKOVIĆ", EXPECTED, "2028000031", order()));

		assertThat(second.get("bookedNow").asInt()).isEqualTo(1);
		assertThat(states(second)).containsExactly("booked", "booked");
		assertThat(db.sql("select competitor_id from payment order by competitor_id").query(Long.class).list())
				.containsExactly(marko, janko);
		assertThat(db.sql("select count(*) from bank_statement_line").query(Long.class).single()).isEqualTo(2);
		assertThat(db.sql("select count(*) from bank_statement").query(Long.class).single()).isEqualTo(2);
	}

	/** THE SEASON A LINE IS TAKEN FOR IS THE CLOCK'S, written on the line, never the reference's. */
	@Test
	void theSeasonOfALineIsTheOneBeingPaidForWhenItWasTaken() throws Exception {
		competitor("000043", "Ranija", "Sezona", A_TOWN_IN_SERBIA);

		taken(statement(8).credit("RANIJA SEZONA", EXPECTED, "2027000043", order()));

		assertThat(db.sql("select season from bank_statement_line").query(Integer.class).single())
				.isEqualTo(SEASON);
	}

	/* ------------------------------------------------------------------------------------
	   WHAT WAITS
	   ------------------------------------------------------------------------------------ */

	/**
	 * THE LINES THAT WAIT, OVER EVERY STATEMENT, OLDEST FIRST: not the booked one, not the one already
	 * recorded, and a booked one whose payment has since been cancelled waits again.
	 */
	@Test
	void theWaitingLinesAreEveryLineNotBookedAndNotAlreadyRecorded() throws Exception {
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		long dusko = competitor("000004", "Duško", "Kunić", A_TOWN_IN_SERBIA);
		competitor("000031", "Janko", "Jankovic", A_TOWN_IN_SERBIA);
		bookedByHand(dusko);

		taken(statement(10).dated("24.10.2027").credit("JANKO JANKOVIĆ", "10.00", null, order()));
		taken(statement(9).dated("23.10.2027")
				.credit("MARKO MARKOVIĆ", EXPECTED, "2028000027", order())
				.credit("DUŠKO KUNIĆ", EXPECTED, null, order())
				.credit("NEKO TREĆI", "50.00", null, order()));

		assertThat(payers(waiting())).containsExactly("NEKO TREĆI", "JANKO JANKOVIĆ");

		/* AND A CANCELLED PAYMENT, as the member's row cancels one: the row goes and the line waits. */
		db.sql("delete from membership where competitor_id = ?").param(marko).update();
		db.sql("delete from payment where competitor_id = ?").param(marko).update();

		JsonNode again = waiting();

		assertThat(payers(again)).containsExactly("MARKO MARKOVIĆ", "NEKO TREĆI", "JANKO JANKOVIĆ");
		assertThat(again.get(0).get("waitsBecause").asString()).isEqualTo("notBooked");
		assertThat(again.get(0).get("candidates").get(0).get("competitorId").asLong()).isEqualTo(marko);
	}

	/** A STATEMENT WITH NOTHING BUT THE BANK'S CHARGES ON IT is taken, and has no payment to show. */
	@Test
	void aStatementOfChargesOnlyIsTakenAndHasNoLines() throws Exception {
		JsonNode taken = taken(statement(12).fee("19.50", order()));

		assertThat(taken.get("number").asInt()).isEqualTo(12);
		assertThat(taken.get("lines")).isEmpty();
		assertThat(db.sql("select count(*) from bank_statement").query(Long.class).single()).isEqualTo(1);
		assertThat(db.sql("select count(*) from bank_statement_line").query(Long.class).single()).isZero();
	}

	@Test
	void nothingWaitsBeforeAnyStatementIsTaken() throws Exception {
		assertThat(waiting()).isEmpty();
	}

	@Test
	void aWaitingLineSaysEverythingTheStatementPrinted() throws Exception {
		taken(statement(11).dated("23.10.2027").item(new ASyntheticStatement.Item(true,
				"PETAR PETROVIĆ, ULICA 9, NOVI SAD", "160-0000000000002-22", new BigDecimal("1234.00"), "189",
				List.of("Članarina", "za Petra"), "(97) 1234", "5900000000000777 (1900000000000777-1)")));

		JsonNode line = waiting().get(0);

		assertThat(line.get("payer").asString()).isEqualTo("PETAR PETROVIĆ, ULICA 9, NOVI SAD");
		assertThat(line.get("payerAccount").asString()).isEqualTo("160-0000000000002-22");
		assertThat(line.get("amount").decimalValue()).isEqualByComparingTo("1234.00");
		assertThat(line.get("currency").asString()).isEqualTo("RSD");
		assertThat(line.get("paymentCode").asString()).isEqualTo("189");
		assertThat(line.get("purpose").asString()).isEqualTo("Članarina za Petra");
		assertThat(line.get("reference").asString()).isEqualTo("1234");
		assertThat(line.get("statement").asInt()).isEqualTo(11);
		assertThat(line.get("dated").asString()).isEqualTo("2027-10-23");
		assertThat(line.get("season").asInt()).isEqualTo(SEASON);
		assertThat(line.get("waitsBecause").asString()).isEqualTo("unknownReference");
	}

	/* ------------------------------------------------------------------------------------
	   WHAT IS REFUSED
	   ------------------------------------------------------------------------------------ */

	@Test
	void aFileThatIsNotAStatementOfTheAccountIsRefusedAndNothingIsKept() throws Exception {
		assertThat(refusalOf(sent(new MockMultipartFile("statement", "izvod.pdf", "application/pdf",
				"nije PDF".getBytes(StandardCharsets.UTF_8)), moderatorCookie)))
				.isEqualTo("theFileIsNotAStatement");
		assertThat(refusalOf(sent(file(statement(1).ofTheAccount("105-0000000009999-11")
				.credit("NEKO", EXPECTED, null, order()).bytes()), moderatorCookie)))
				.isEqualTo("theStatementIsOfAnotherAccount");
		assertThat(refusalOf(sent(new MockMultipartFile("statement", "izvod.pdf", "application/pdf",
				new byte[0]), moderatorCookie)))
				.isEqualTo("theStatementIsMissing");
		assertThat(refusalOf(sent(new MockMultipartFile("drugo", "izvod.pdf", "application/pdf",
				statement(1).bytes()), moderatorCookie)))
				.isEqualTo("theStatementIsMissing");

		assertThat(db.sql("select count(*) from bank_statement").query(Long.class).single()).isZero();
	}

	/** THE BOUND IS ON THE BYTES, asked before they are read: one over it is refused, the bound itself is not. */
	@Test
	void aFileOverTwoMegabytesIsRefusedBeforeItIsRead() throws Exception {
		byte[] over = new byte[(int) com.btl.portal.domain.statement.AikStatement.AT_MOST_BYTES + 1];
		byte[] at = new byte[(int) com.btl.portal.domain.statement.AikStatement.AT_MOST_BYTES];

		assertThat(refusalOf(sent(file(over), moderatorCookie))).isEqualTo("theStatementIsTooLarge");
		assertThat(refusalOf(sent(file(at), moderatorCookie))).isEqualTo("theFileIsNotAStatement");
	}

	@Test
	void aModeratorWithoutTheTickIsAnsweredAsThoughTheAddressDidNotExist() throws Exception {
		assertThat(sent(file(statement(1).bytes()), noRightsCookie).getStatus()).isEqualTo(404);
		assertThat(http.perform(get("/api/statements/lines").cookie(new Cookie(SessionCookie.NAME, noRightsCookie)))
				.andReturn().getResponse().getStatus()).isEqualTo(404);
		assertThat(http.perform(multipart("/api/statements").file(file(statement(1).bytes())).with(csrf()))
				.andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(http.perform(get("/api/statements/lines")).andReturn().getResponse().getStatus())
				.isEqualTo(401);
		assertThat(db.sql("select count(*) from bank_statement").query(Long.class).single()).isZero();
	}

	/* ------------------------------------------------------------------------------------
	   THE SETUP
	   ------------------------------------------------------------------------------------ */

	private ASyntheticStatement statement(int number) {
		return ASyntheticStatement.number(number).dated("20.10.2027");
	}

	/** A fresh order number of the bank, never the same twice in one case. */
	private String order() {
		orders++;

		return String.format("59%014d (19%014d-1)", orders, orders);
	}

	private String orderOf(JsonNode taken, int line) {
		return db.sql("select order_number from bank_statement_line where id = ?")
				.param(taken.get("lines").get(line).get("id").asLong()).query(String.class).single();
	}

	private JsonNode taken(ASyntheticStatement statement) throws Exception {
		MockHttpServletResponse answer = sent(file(statement.bytes()), moderatorCookie);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);

		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private JsonNode waiting() throws Exception {
		MockHttpServletResponse answer = http.perform(get("/api/statements/lines")
						.cookie(new Cookie(SessionCookie.NAME, moderatorCookie)))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(200);

		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private static MockMultipartFile file(byte[] bytes) {
		return new MockMultipartFile("statement", "izvod.pdf", "application/pdf", bytes);
	}

	private MockHttpServletResponse sent(MockMultipartFile file, String cookie) throws Exception {
		return http.perform(multipart("/api/statements").file(file).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();
	}

	private String refusalOf(MockHttpServletResponse answer) throws Exception {
		assertThat(answer.getStatus()).isEqualTo(400);

		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8)).get("reason").asString();
	}

	private static List<String> states(JsonNode taken) {
		return field(taken, "state");
	}

	private static List<String> field(JsonNode taken, String name) {
		List<String> values = new ArrayList<>();
		taken.get("lines").forEach(line -> values.add(line.get(name).asString()));

		return values;
	}

	private static List<Long> firstCandidates(JsonNode taken) {
		List<Long> values = new ArrayList<>();
		taken.get("lines").forEach(line -> values.add(line.get("candidates").isEmpty() ? null
				: line.get("candidates").get(0).get("competitorId").asLong()));

		return values;
	}

	private static List<Long> candidates(JsonNode taken, int line) {
		List<Long> values = new ArrayList<>();
		taken.get("lines").get(line).get("candidates").forEach(one -> values.add(one.get("competitorId").asLong()));

		return values;
	}

	private static List<String> payers(JsonNode lines) {
		List<String> values = new ArrayList<>();
		lines.forEach(line -> values.add(line.get("payer").asString()));

		return values;
	}

	/** A payment of this season booked on the payments screen, the way a moderator books one by hand. */
	private void bookedByHand(long competitorId) throws Exception {
		MockHttpServletResponse answer = http.perform(org.springframework.test.web.servlet.request
						.MockMvcRequestBuilders.post("/api/payments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, moderatorCookie))
						.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
						.content("{\"competitorId\": " + competitorId + ", \"received\": " + EXPECTED
								+ ", \"useTheBalance\": false, \"method\": \"ips\"}"))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(201);
	}

	private String account(String email, String role, String first, String last) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " (?, ?, ?, (select id from role where code = ?))")
				.params(first, last, email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}

	private long competitor(String memberNumber, String first, String last, String town) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, ?, ?,"
						+ " 'M', ?, " + town + ", null, null, 2027, false, false, ?, "
						+ " null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(memberNumber, first, last, java.sql.Date.valueOf(LocalDate.parse("1990-05-15")),
						String.format("00ccddeeff%06x", ++issued))
				.query(Long.class).single();
	}
}

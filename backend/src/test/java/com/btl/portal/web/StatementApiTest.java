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
 * sama. Sve ostalo (manji ili veći iznos, nepoznat broj) ide na ručnu potvrdu."; since 26.11.2026 „Uplata
 * bez poziva na broj knjiži se sama po imenu kad imenu i prezimenu uplatioca odgovara tačno jedan član"
 * and „Ime unutar teksta uplatioca daje predlog, nikad knjiženje"; „Server pamti broj izvoda i stavke (da se
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

	private static final Instant NOW = Instant.parse("2027-11-26T09:00:00Z");

	private static final int SEASON = 2028;

	private static final String MODERATOR = "blagajnik-izvod@primer.rs";

	private static final String NO_RIGHTS_MODERATOR = "bez-prava-izvod@primer.rs";

	private static final String EXPECTED = "4200.00";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String A_TOWN_ABROAD = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season,"
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

	/**
	 * A REFERENCE THAT NAMES A MEMBER IS SUGGESTED BEFORE THE PAYER'S NAME, and the payer's name is not
	 * asked at all while the reference names somebody.
	 *
	 * <p>In every other case the payer of a line with a reference is the very member the reference names, so
	 * the two ways of finding the member gave one answer and a suggestion that ignored the reference went
	 * unseen. Here the reference names {@code 000045} and the payer's name is {@code 000046}'s: the first is
	 * the suggestion, the second is not among them (the amount is not the expected one, so the line waits).
	 */
	@Test
	void aReferenceThatNamesAMemberIsSuggestedAndTheNameOfThePayerIsNotAsked() throws Exception {
		long named = competitor("000045", "Poziv", "Brojem", A_TOWN_IN_SERBIA);
		long byName = competitor("000046", "Placa", "Imenom", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(2).credit("PLACA IMENOM", "4199.00", "2028000045", order()));

		assertThat(field(taken, "waitsBecause")).containsExactly("notTheExpectedAmount");
		assertThat(candidates(taken, 0))
				.as("the member the reference names was not suggested, or the payer's name was asked too")
				.containsExactly(named)
				.doesNotContain(byName);
	}

	/* ------------------------------------------------------------------------------------
	   A PAYMENT WITHOUT A REFERENCE
	   ------------------------------------------------------------------------------------ */

	/**
	 * THE ONE MEMBER OF THE PAYER'S NAME IS BOOKED BY ITSELF (owner, 26.11.2026): „Uplata bez poziva na broj
	 * knjiži se sama po imenu kad imenu i prezimenu uplatioca odgovara tačno jedan član, iznos je tačno onaj
	 * koji se od njega očekuje, a član za tu sezonu još nije aktivan." In either order of the two names and
	 * whether or not his bank kept the Serbian letters (owner, 27.11.2026), as the suggestion compared them.
	 *
	 * <p>Booked as a reference books: {@code ips}, what arrived, by whoever took the statement, and with no
	 * reference, because none arrived. Djordje held 2027 and not 2028, so a season ago is not „already
	 * active" for the season the line is taken for.
	 *
	 * <p><b>The other sources kept apart:</b> Aca Aleksić is first in every list of members (the lowest id,
	 * the first last name) and named by no line, so a booking to the first member instead of the member of
	 * the name books him; every line is another member, so a booking off the wrong line books the wrong man.
	 */
	@Test
	void aPaymentWithoutAReferenceIsBookedToTheOneMemberOfThePayersName() throws Exception {
		long decoy = competitor("000001", "Aca", "Aleksić", A_TOWN_IN_SERBIA);
		long valentina = competitor("000043", "Valentina", "Suslov", A_TOWN_IN_SERBIA);
		long dusko = competitor("000004", "Duško", "Kunić", A_TOWN_IN_SERBIA);
		long djordje = competitor("000005", "Đorđe", "Čolić", A_TOWN_IN_SERBIA);
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, ?, 'feeExempt', 'Probni Odbor', timestamptz '2026-10-01 10:00:00+00')")
				.params(djordje, SEASON - 1).update();

		ASyntheticStatement statement = statement(3)
				.credit("Valentina Suslov, - -", EXPECTED, null, order())
				.credit("KUNIC DUSKO, KRALJA PETRA 1, BEOGRAD", EXPECTED, null, order())
				.credit("ČOLIĆ ĐORĐE", EXPECTED, null, order());
		JsonNode taken = taken(statement);

		assertThat(taken.get("bookedNow").asInt()).isEqualTo(3);
		assertThat(states(taken)).containsOnly("booked");
		assertThat(List.of(member(taken, 0), member(taken, 1), member(taken, 2)))
				.containsExactly(valentina, dusko, djordje);
		assertThat(db.sql("select competitor_id || '|' || season || '|' || coalesce(reference, '-') || '|' || method"
						+ " || '|' || received || '|' || recorded_by_name from payment order by competitor_id")
				.query(String.class).list())
				.containsExactlyInAnyOrder(valentina + "|2028|-|ips|4200.00|Blagajnik Izvoda",
						dusko + "|2028|-|ips|4200.00|Blagajnik Izvoda",
						djordje + "|2028|-|ips|4200.00|Blagajnik Izvoda");
		assertThat(db.sql("select count(*) from membership where competitor_id = ?").param(decoy)
				.query(Long.class).single()).isZero();

		/* AND TAKEN AGAIN IT BOOKS NOTHING MORE („da se isti izvod ne knjiži dvaput"). */
		assertThat(taken(statement).get("bookedNow").asInt()).isZero();
		assertThat(paymentCount()).isEqualTo(3);
	}

	/**
	 * WHAT THE NAME DOES NOT BOOK IS A SUGGESTION, and waits with the sentence that is true of it, „Uplata
	 * nema poziv na broj." (coordinator, 27.11.2026). Every line here sends exactly the expected amount to
	 * a member who is not active, so only the name keeps it from being booked:
	 * <ul>
	 * <li>two members of the name: „Sve ostalo (dva ili više imenjaka, drugi iznos) ostaje predlog na
	 * potvrdi" (owner, 26.11.2026), and both are suggested;
	 * <li>a payer who is no member's name suggests nobody;
	 * <li>a registration with no member number yet (owner, 27.11.2026): „Prijavljen koji još nema članski
	 * broj se po imenu ne knjiži sam; njegova uplata ostaje predlog sa „Potvrdi"";
	 * <li>the name only inside the payer's text, the post office's own line of statement 10 (owner,
	 * 26.11.2026): „Ime unutar teksta uplatioca daje predlog, nikad knjiženje";
	 * <li>the whole name of one member and another member's name inside the rest of the text, because „adresa
	 * ume da nosi tuđe ime" (owner, 26.11.2026): the agent's reasoning, accepted by the coordinator on
	 * 27.11.2026. The member of the whole name is suggested first.
	 * </ul>
	 */
	@Test
	void whatThePayersNameDoesNotBookWaitsAsASuggestion() throws Exception {
		long ana = competitor("000006", "Ana", "Anić", A_TOWN_IN_SERBIA);
		long anotherAna = competitor("000007", "Ana", "Anić", A_TOWN_IN_SERBIA);
		competitor("000008", "Nikola", "Nikolić", A_TOWN_IN_SERBIA);
		long mila = competitor(null, "Mila", "Milić", A_TOWN_IN_SERBIA);
		long branko = competitor("000012", "Branko", "Milević", A_TOWN_IN_SERBIA);
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		long petar = competitor("000028", "Petar", "Petrović", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(3)
				.credit("ANA ANIĆ, ULICA 3", EXPECTED, null, order())
				.credit("SUPRUGA NIKOLIĆ, ULICA 4", EXPECTED, null, order())
				.credit("MILA MILIC", EXPECTED, null, order())
				.credit("POSTA ZA MILEVIC BRANKO STEVANA OPACICA 30 BEOGRAD", EXPECTED, null, order())
				.credit("MARKO MARKOVIC, KOD PETAR PETROVIC, BEOGRAD", EXPECTED, null, order()));

		assertThat(taken.get("bookedNow").asInt()).isZero();
		assertThat(states(taken)).containsOnly("waiting");
		assertThat(field(taken, "waitsBecause")).containsOnly("noReference");
		assertThat(candidates(taken, 0)).containsExactlyInAnyOrder(ana, anotherAna);
		assertThat(candidates(taken, 1)).isEmpty();
		assertThat(candidates(taken, 2)).containsExactly(mila);
		assertThat(candidates(taken, 3)).containsExactly(branko);
		assertThat(candidates(taken, 4)).containsExactly(marko, petar);
		assertThat(paymentCount()).isZero();
	}

	/**
	 * THE PURPOSE OF A PAYMENT IS NOT A PLACE WHERE A NAME IS LOOKED FOR (PDL, 27.11.2026, measured on
	 * production: „(u bilo kom redu)" means in any order of the words, inside the payer's field). The payer
	 * here is the whole name of one member and the purpose names another member, so a name read out of the
	 * purpose too would make the line „a second name in it" and leave it waiting.
	 *
	 * <p>The other line pays under a name that is nobody's and writes a member's name only in the purpose,
	 * so it books nobody. Every line is another member, so a booking off the wrong line books the wrong man.
	 */
	@Test
	void aNameInThePurposeOfAPaymentNeitherStopsABookingNorMakesOne() throws Exception {
		long valentina = competitor("000043", "Valentina", "Suslov", A_TOWN_IN_SERBIA);
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		long petar = competitor("000028", "Petar", "Petrović", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(3)
				.credit("Valentina Suslov", EXPECTED, null, order(), "Clanarina za Marko Markovic")
				.credit("DONATOR", EXPECTED, null, order(), "Clanarina za Petar Petrovic"));

		assertThat(taken.get("bookedNow").asInt()).isEqualTo(1);
		assertThat(states(taken)).containsExactly("booked", "waiting");
		assertThat(member(taken, 0)).isEqualTo(valentina);
		assertThat(db.sql("select competitor_id from payment").query(Long.class).list())
				.containsExactly(valentina);
		assertThat(candidates(taken, 1)).isEmpty();
		assertThat(db.sql("select count(*) from payment where competitor_id in (?, ?)").params(marko, petar)
				.query(Long.class).single()).isZero();
	}

	/**
	 * THE SAME FOR A LINE THAT WAITS: the payer is the whole name of one member, the amount is not the
	 * expected one, and another member's name stands in the purpose. The suggestion is the member of the
	 * name and nobody else.
	 */
	@Test
	void aNameInThePurposeIsNotSuggestedBesideTheMemberOfThePayersName() throws Exception {
		long nikola = competitor("000008", "Nikola", "Nikolić", A_TOWN_IN_SERBIA);
		competitor("000028", "Petar", "Petrović", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(3)
				.credit("NIKOLA NIKOLIĆ", "10.00", null, order(), "Clanarina za Petar Petrovic")
				.credit("DONATOR", "10.00", null, order(), "Clanarina za Petar Petrovic"));

		assertThat(states(taken)).containsOnly("waiting");
		assertThat(candidates(taken, 0)).containsExactly(nikola);
		assertThat(candidates(taken, 1)).isEmpty();
	}

	/**
	 * ONE MEMBER OF THE NAME, AND STILL NOT BOOKED, each for the reason a reference would give: an amount
	 * that is not the expected one (less, more, and paras), a member who pays in euro, and a payment with a
	 * reference, which is never booked by the name whatever the reference is (owner, 24.10.2026: „Sve
	 * ostalo (manji ili veći iznos, nepoznat broj) ide na ručnu potvrdu"). The last three lines are each
	 * the whole name of one member who could be booked, with exactly the expected amount.
	 */
	@Test
	void theOneMemberOfTheNameIsNotBookedOnAnyOtherAmountOrWithAReference() throws Exception {
		competitor("000041", "Manje", "Placa", A_TOWN_IN_SERBIA);
		competitor("000042", "Vise", "Placa", A_TOWN_IN_SERBIA);
		competitor("000045", "Sa", "Parama", A_TOWN_IN_SERBIA);
		competitor("000044", "Iz", "Inostranstva", A_TOWN_ABROAD);
		competitor("000046", "Nepoznat", "Broj", A_TOWN_IN_SERBIA);
		competitor("000047", "Ranija", "Sezona", A_TOWN_IN_SERBIA);
		competitor("000048", "Kratak", "Broj", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(4)
				.credit("MANJE PLACA", "4199.00", null, order())
				.credit("VISE PLACA", "4201.00", null, order())
				.credit("SA PARAMA", "4200.50", null, order())
				.credit("IZ INOSTRANSTVA", EXPECTED, null, order())
				.credit("NEPOZNAT BROJ", EXPECTED, "2028999999", order())
				.credit("RANIJA SEZONA", EXPECTED, "2027000047", order())
				.credit("KRATAK BROJ", EXPECTED, "202800004", order()));

		assertThat(taken.get("bookedNow").asInt()).isZero();
		assertThat(field(taken, "waitsBecause")).containsExactly("notTheExpectedAmount", "notTheExpectedAmount",
				"notTheExpectedAmount", "notInDinars", "unknownReference", "anotherSeason", "unknownReference");
		assertThat(paymentCount()).isZero();
	}

	/**
	 * ONE MEMBER ON TWO LINES, AND LINES BY REFERENCE AND BY NAME ON ONE STATEMENT. The first line of his
	 * books him and the second finds him active and waits; a reference and a name book side by side.
	 */
	@Test
	void oneMemberOnTwoLinesIsBookedOnceBesideAReferenceBooking() throws Exception {
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		long janko = competitor("000031", "Janko", "Jankovic", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(5)
				.credit("MARKO MARKOVIĆ", EXPECTED, null, order())
				.credit("JANKO JANKOVIĆ, ULICA 2", EXPECTED, "2028000031", order())
				.credit("MARKOVIĆ MARKO", EXPECTED, null, order()));

		assertThat(taken.get("bookedNow").asInt()).isEqualTo(2);
		assertThat(states(taken)).containsExactly("booked", "booked", "alreadyRecorded");
		assertThat(member(taken, 0)).isEqualTo(marko);
		assertThat(member(taken, 1)).isEqualTo(janko);
		assertThat(paymentCount()).isEqualTo(2);
	}

	/**
	 * A MEMBER FOUND ONLY INSIDE THE PAYER'S TEXT WHO IS ACTIVE ALREADY LEAVES THE LINE WAITING, and not
	 * „already recorded" (owner, 27.11.2026): „stavka čeka i nudi „Drugi član", a ne „Već evidentirano",
	 * jer adresa ume da nosi ime aktivnog člana dok je uplatio neko drugi." The same member as the whole
	 * name reads „already recorded", as it did before.
	 */
	@Test
	void aMemberActiveAlreadyAndFoundOnlyInsideTheTextLeavesTheLineWaiting() throws Exception {
		long branko = competitor("000012", "Branko", "Milević", A_TOWN_IN_SERBIA);
		bookedByHand(branko);

		JsonNode taken = taken(statement(6)
				.credit("POSTA ZA MILEVIC BRANKO STEVANA OPACICA 30 BEOGRAD", EXPECTED, null, order())
				.credit("MILEVIC BRANKO, STEVANA OPACICA 30", EXPECTED, null, order()));

		assertThat(states(taken)).containsExactly("waiting", "alreadyRecorded");
		assertThat(candidates(taken, 0)).containsExactly(branko);
		assertThat(states(waiting())).containsExactly("waiting", "alreadyRecorded");
		assertThat(paymentCount()).isEqualTo(1);
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
	 * THE LINES THAT WAIT, OVER EVERY STATEMENT, OLDEST FIRST: not the booked one; the one already recorded
	 * stays, marked so, until it is set aside (owner, 26.10.2026); and a booked one whose payment has since
	 * been cancelled waits again.
	 */
	@Test
	void theWaitingLinesAreEveryLineNotBookedAndTheAlreadyRecordedStayMarked() throws Exception {
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		long dusko = competitor("000004", "Duško", "Kunić", A_TOWN_IN_SERBIA);
		competitor("000031", "Janko", "Jankovic", A_TOWN_IN_SERBIA);
		bookedByHand(dusko);

		taken(statement(10).dated("20.11.2027").credit("JANKO JANKOVIĆ", "10.00", null, order()));
		taken(statement(9).dated("19.11.2027")
				.credit("MARKO MARKOVIĆ", EXPECTED, "2028000027", order())
				.credit("DUŠKO KUNIĆ", EXPECTED, null, order())
				.credit("NEKO TREĆI", "50.00", null, order()));

		JsonNode first = waiting();

		assertThat(payers(first)).containsExactly("DUŠKO KUNIĆ", "NEKO TREĆI", "JANKO JANKOVIĆ");
		assertThat(states(first)).containsExactly("alreadyRecorded", "waiting", "waiting");
		assertThat(first.get(0).get("member").get("competitorId").asLong()).isEqualTo(dusko);

		/* „NIJE ČLANARINA" CLOSES IT, with who and when, and then it is gone. */
		assertThat(setAsideAs(first.get(0).get("id").asLong(), moderatorCookie).getStatus()).isEqualTo(204);
		assertThat(payers(waiting())).containsExactly("NEKO TREĆI", "JANKO JANKOVIĆ");

		/* AND A CANCELLED PAYMENT, as the member's row cancels one: the row goes and the line waits. */
		db.sql("delete from membership where competitor_id = ?").param(marko).update();
		db.sql("delete from payment where competitor_id = ?").param(marko).update();

		JsonNode again = waiting();

		assertThat(payers(again)).containsExactly("MARKO MARKOVIĆ", "NEKO TREĆI", "JANKO JANKOVIĆ");
		assertThat(again.get(0).get("waitsBecause").asString()).isEqualTo("notBooked");
		assertThat(again.get(0).get("candidates").get(0).get("competitorId").asLong()).isEqualTo(marko);
	}

	/**
	 * THE LINES OF A STATEMENT ARE WRITTEN IN THE ORDER OF THEIR ORDER NUMBERS AND NOT OF THE FILE (PENDING, PR 843,
	 * 28.11.2026). {@code bank_statement_line_one_order_once} is one number for the whole table and the insert waits
	 * for an uncommitted line of another statement with the same number, so two statements that share two numbers
	 * and print them in opposite orders were a cycle (measured: {@code deadlock detected}, one upload answered 500).
	 * Taken in one order by every statement, the second waits for the first and finds its lines kept.
	 *
	 * <p>The order the rows were inserted in is the order of their keys, and the keys are what the case reads: the
	 * statement prints the numbers largest first, so the file's order and the order of the numbers are opposite, and
	 * each line keeps the position it was printed at.
	 */
	@Test
	void theLinesOfAStatementAreWrittenInTheOrderOfTheirOrderNumbersWhateverTheFilePrintsFirst() throws Exception {
		String first = String.format("59%014d (19%014d-1)", 9003, 9003);
		String second = String.format("59%014d (19%014d-1)", 9002, 9002);
		String third = String.format("59%014d (19%014d-1)", 9001, 9001);

		taken(statement(31).credit("PRVI PLATIOC", EXPECTED, null, first).credit("DRUGI PLATIOC", EXPECTED, null, second)
				.credit("TRECI PLATIOC", EXPECTED, null, third));

		assertThat(db.sql("select order_number from bank_statement_line order by id")
				.query(String.class).list())
				.as("the lines were written in the order the file printed them")
				.containsExactly(third, second, first);
		assertThat(db.sql("select position from bank_statement_line order by id").query(Integer.class).list())
				.as("a line lost the position it was printed at")
				.containsExactly(3, 2, 1);
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
		taken(statement(11).dated("19.11.2027").item(new ASyntheticStatement.Item(true,
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
		assertThat(line.get("dated").asString()).isEqualTo("2027-11-19");
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
	   „POTVRDI": THE MEMBER'S ROW BOOKS THE LINE (owner, 25.10.2026)
	   ------------------------------------------------------------------------------------ */

	/**
	 * THE ROW OPENED FROM A LINE BOOKS THAT LINE: the payment is the member's, of what the line says
	 * arrived, through the same booking as a payment typed by hand, and the line names it and waits no more.
	 * The other line on the statement, for another member and another amount, is untouched, so a booking
	 * written onto the wrong line shows on both.
	 */
	@Test
	void aRowOpenedFromALineBooksThatLineAndNoOther() throws Exception {
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		competitor("000031", "Janko", "Jankovic", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(20)
				.credit("JANKO JANKOVIĆ", "3900.00", null, order())
				.credit("MARKO MARKOVIĆ", "4100.00", null, order()));
		long janko = lineId(taken, 0);
		long markos = lineId(taken, 1);

		MockHttpServletResponse answer = booked(marko, "4100.00", markos);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(201);
		assertThat(db.sql("select l.id || ' ' || p.competitor_id || ' ' || p.received || ' ' || coalesce(l.waits_because,"
						+ " 'nothing') from bank_statement_line l join payment p on p.id = l.payment_id")
				.query(String.class).list())
				.containsExactly(markos + " " + marko + " 4100.00 nothing");
		assertThat(payers(waiting())).containsExactly("JANKO JANKOVIĆ");
		assertThat(db.sql("select payment_id is null from bank_statement_line where id = ?").param(janko)
				.query(Boolean.class).single()).isTrue();
	}

	@Test
	void aLineThatIsSettledOrUnknownOrOfAnotherAmountBooksNothing() throws Exception {
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		long janko = competitor("000031", "Janko", "Jankovic", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(21)
				.credit("MARKO MARKOVIĆ", "4100.00", null, order())
				.credit("NEKO TREĆI", "50.00", null, order()));
		long markos = lineId(taken, 0);
		long third = lineId(taken, 1);

		assertThat(refusalOf(booked(marko, "4200.00", markos), 400)).isEqualTo("theAmountIsNotTheStatementLines");
		assertThat(refusalOf(booked(marko, "4100.00", 999999L), 400)).isEqualTo("theStatementLineIsNotKnown");
		assertThat(paymentCount()).isZero();

		assertThat(booked(marko, "4100.00", markos).getStatus()).isEqualTo(201);
		assertThat(refusalOf(booked(janko, "4100.00", markos), 409)).isEqualTo("theStatementLineIsSettled");

		assertThat(setAsideAs(third, moderatorCookie).getStatus()).isEqualTo(204);
		assertThat(refusalOf(booked(janko, "50.00", third), 409)).isEqualTo("theStatementLineIsSettled");

		assertThat(db.sql("select competitor_id from payment").query(Long.class).list()).containsExactly(marko);
	}

	/**
	 * A MEMBER WHO PAYS IN EURO IS NOT BOOKED FROM A LINE OF THE DINAR ACCOUNT: the dinars would be read as
	 * euro. And a member who does not exist is answered as the booking always answers him.
	 */
	@Test
	void aLineIsNotBookedToAMemberWhoPaysInEuroOrToNobody() throws Exception {
		long abroad = competitor("000044", "Iz", "Inostranstva", A_TOWN_ABROAD);

		long line = lineId(taken(statement(22).credit("IZ INOSTRANSTVA", "38.00", null, order())), 0);

		assertThat(refusalOf(booked(abroad, "38.00", line), 400)).isEqualTo("theMemberDoesNotPayInDinars");
		assertThat(refusalOf(booked(999999L, "38.00", line), 400)).isEqualTo("theCompetitorDoesNotExist");
		assertThat(paymentCount()).isZero();
	}

	/**
	 * A LINE WITH PARAS IS BOOKED IN WHOLE DINARS, ROUNDED DOWN (owner, 26.10.2026): 4.200,50 books as
	 * 4.200, and 4.201 or the paras themselves are refused, each with its own word. The line is the only
	 * source of the 4.200: the row is sent 4.200 and the line says 4.200,50.
	 */
	@Test
	void aLineWithParasIsBookedInWholeDinarsRoundedDown() throws Exception {
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);

		long line = lineId(taken(statement(27).credit("MARKO MARKOVIĆ", "4200.50", null, order())), 0);

		assertThat(refusalOf(booked(marko, "4201", line), 400)).isEqualTo("theAmountIsNotTheStatementLines");
		assertThat(refusalOf(booked(marko, "4200.50", line), 400)).isEqualTo("theAmountIsNotWhole");
		assertThat(booked(marko, "4200", line).getStatus()).isEqualTo(201);
		assertThat(db.sql("select received from payment").query(BigDecimal.class).single())
				.isEqualByComparingTo("4200");
	}

	/**
	 * „ALREADY RECORDED" IS ASKED OF THE SEASON THE LINE WAS TAKEN FOR, and not of the season on sale today:
	 * a member who holds the season on sale and not the line's own is not „already recorded" for that line.
	 */
	@Test
	void alreadyRecordedIsAskedOfTheLinesOwnSeason() throws Exception {
		long dusko = competitor("000004", "Duško", "Kunić", A_TOWN_IN_SERBIA);
		bookedByHand(dusko);

		long line = lineId(taken(statement(28).credit("DUŠKO KUNIĆ", EXPECTED, null, order())), 0);

		assertThat(states(waiting())).containsExactly("alreadyRecorded");

		db.sql("update bank_statement_line set season = ? where id = ?").params(SEASON - 1, line).update();

		assertThat(states(waiting())).containsExactly("waiting");
	}

	/** THE HARMLESS REPEAT IS NOT THE LINE'S: a member already booked by hand leaves the line unwritten. */
	@Test
	void aMemberAlreadyBookedLeavesTheLineUnwritten() throws Exception {
		long dusko = competitor("000004", "Duško", "Kunić", A_TOWN_IN_SERBIA);
		bookedByHand(dusko);

		long line = lineId(taken(statement(23).credit("NEKO ZA DUŠKA", EXPECTED, null, order())), 0);

		assertThat(booked(dusko, EXPECTED, line).getStatus()).isEqualTo(200);
		assertThat(db.sql("select payment_id is null from bank_statement_line where id = ?").param(line)
				.query(Boolean.class).single()).isTrue();
	}

	/**
	 * A LINE BOOKED TO A MEMBER WHO HAS SINCE BEEN DELETED STAYS BOOKED, TO NOBODY, AND WAITS FOR NOBODY.
	 *
	 * <p>Since V79 his payment outlives him without a pointer at him (PDL, 29.10.2026, „Brisanje profila
	 * više ne sme da briše uplate"), so the line still names it and the money was booked. A namesake who
	 * stays is the other source the answer could come from: read off the payment's member rather than
	 * off the line, the line would be suggested to him, or marked as his, when the statement is taken
	 * again.
	 */
	@Test
	void aLineBookedToAMemberSinceDeletedStaysBookedToNobody() throws Exception {
		long marko = competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);

		ASyntheticStatement statement = statement(24).credit("MARKO MARKOVIĆ", EXPECTED, "2028000027", order());

		assertThat(states(taken(statement))).containsExactly("booked");

		competitor("000099", "Marko", "Markovic", A_TOWN_IN_SERBIA);
		db.sql("delete from competitor where id = ?").param(marko).update();

		JsonNode again = taken(statement);

		assertThat(states(again)).as("the line his payment was booked from no longer reads as booked")
				.containsExactly("booked");
		assertThat(again.get("lines").get(0).get("member").isNull())
				.as("a booked line names a member the payment no longer has").isTrue();
		assertThat(waiting()).as("a booked line waits again").isEmpty();
	}

	/* ------------------------------------------------------------------------------------
	   „NIJE ČLANARINA" (owner, 25.10.2026)
	   ------------------------------------------------------------------------------------ */

	/**
	 * A LINE SET ASIDE IS CLOSED WITHOUT A BOOKING, NAMES WHO CLOSED IT AND WHEN, WAITS NO MORE, and reads
	 * as set aside when its statement is taken again. The other line still waits.
	 */
	@Test
	void aLineSetAsideIsClosedWithWhoAndWhenAndWaitsNoMore() throws Exception {
		ASyntheticStatement statement = statement(24)
				.credit("DONATOR PRVI", "1000.00", null, order())
				.credit("NEKO DRUGI", "50.00", null, order());
		long first = lineId(taken(statement), 0);

		assertThat(setAsideAs(first, moderatorCookie).getStatus()).isEqualTo(204);

		assertThat(db.sql("select set_aside_by_name || ' ' || (set_aside_at = ?) || ' ' || (set_aside_by ="
						+ " (select id from account where email = ?)) from bank_statement_line where id = ?")
				.params(Timestamp.from(NOW), MODERATOR, first).query(String.class).single())
				.isEqualTo("Blagajnik Izvoda true true");
		assertThat(payers(waiting())).containsExactly("NEKO DRUGI");
		assertThat(states(taken(statement))).containsExactly("setAside", "waiting");
		assertThat(paymentCount()).isZero();
	}

	@Test
	void aLineSetAsideOrBookedCannotBeSetAsideAgainAndAnUnknownOneIsNotThere() throws Exception {
		competitor("000027", "Marko", "Markovic", A_TOWN_IN_SERBIA);

		JsonNode taken = taken(statement(25)
				.credit("MARKO MARKOVIĆ", EXPECTED, "2028000027", order())
				.credit("DONATOR", "10.00", null, order()));

		assertThat(setAsideAs(lineId(taken, 1), moderatorCookie).getStatus()).isEqualTo(204);
		assertThat(refusalOf(setAsideAs(lineId(taken, 1), moderatorCookie), 409)).isEqualTo("theStatementLineIsSettled");
		assertThat(refusalOf(setAsideAs(lineId(taken, 0), moderatorCookie), 409)).isEqualTo("theStatementLineIsSettled");
		assertThat(setAsideAs(999999L, moderatorCookie).getStatus()).isEqualTo(404);
		assertThat(db.sql("select count(*) from bank_statement_line where set_aside_at is not null")
				.query(Long.class).single()).isEqualTo(1);
	}

	@Test
	void settingALineAsideTakesTheTick() throws Exception {
		long line = lineId(taken(statement(26).credit("DONATOR", "10.00", null, order())), 0);

		assertThat(setAsideAs(line, noRightsCookie).getStatus()).isEqualTo(404);
		assertThat(http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.post("/api/statements/lines/" + line + "/set-aside").with(csrf()))
				.andReturn().getResponse().getStatus()).isEqualTo(401);
		assertThat(db.sql("select count(*) from bank_statement_line where set_aside_at is not null")
				.query(Long.class).single()).isZero();
	}

	private long lineId(JsonNode taken, int line) {
		return taken.get("lines").get(line).get("id").asLong();
	}

	private long paymentCount() {
		return db.sql("select count(*) from payment").query(Long.class).single();
	}

	/** Whom a line was booked to, or who already holds its season. */
	private static long member(JsonNode taken, int line) {
		return taken.get("lines").get(line).get("member").get("competitorId").asLong();
	}

	/** The row on the Payments screen, opened from a line, pressing „Aktiviraj" with the box ticked. */
	private MockHttpServletResponse booked(long competitorId, String received, Long line) throws Exception {
		return http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.post("/api/payments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, moderatorCookie))
						.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
						.content("{\"competitorId\": " + competitorId + ", \"received\": " + received
								+ ", \"useTheBalance\": true, \"method\": \"ips\", \"statementLine\": " + line + "}"))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse setAsideAs(long line, String cookie) throws Exception {
		return http.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
						.post("/api/statements/lines/" + line + "/set-aside").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();
	}

	private String refusalOf(MockHttpServletResponse answer, int status) throws Exception {
		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(status);

		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8)).get("reason").asString();
	}

	/* ------------------------------------------------------------------------------------
	   THE SETUP
	   ------------------------------------------------------------------------------------ */

	private ASyntheticStatement statement(int number) {
		return ASyntheticStatement.number(number).dated("16.11.2027");
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
		List<String> values = new ArrayList<>();
		(taken.isArray() ? taken : taken.get("lines")).forEach(line -> values.add(line.get("state").asString()));

		return values;
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
						+ " 'M', ?, " + town + ", null, null, 2027, ?, "
						+ " null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(memberNumber, first, last, java.sql.Date.valueOf(LocalDate.parse("1990-05-15")),
						String.format("00ccddeeff%06x", ++issued))
				.query(Long.class).single();
	}
}

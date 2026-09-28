package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * CONFIRMING A PAYMENT, END TO END: the number it hands out, the membership it
 * writes and the four shapes {@link com.btl.portal.domain.payment.RecordingAPayment}
 * already names.
 *
 * <p>The clock is fixed to 3 October, inside the price list's {@code early} window
 * (V4), so an amount asserted here is an amount that cannot drift with the day the
 * suite happens to run on. Authorisation itself - a stranger, a plain competitor, a
 * moderator holding the wrong tick - is the generic floor {@code RightsAtTheDoorTest}
 * already asks of every route carrying {@link RightIsNeeded}; this file measures the
 * one thing that is this resource's own, plus a single case proving a moderator with
 * no queue right is refused here exactly as everywhere else, for defence in depth.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PaymentApiTest {

	/** 11:00 in Belgrade on 3 October, inside V4's `early` period (01 to 05 October). */
	private static final Instant NOW = Instant.parse("2027-10-03T09:00:00Z");

	private static final String MODERATOR = "blagajnik@primer.rs";

	private static final String NO_RIGHTS_MODERATOR = "bez-prava@primer.rs";

	/**
	 * {@code rank = 1} is Shanghai, so the default member of this fixture is billed in EURO.
	 *
	 * <p>Said out loud because since V42 nothing in a request names a currency: it is worked out from
	 * the member's country ({@code Currency.of}), so the town a fixture puts him in IS the currency
	 * every amount in that case is in.
	 */
	private static final String A_TOWN = "(select id from place where rank = 1)";

	/**
	 * THE FIRST SERBIAN TOWN THE CODEBOOK OFFERS, so that the currency axis has both its states.
	 *
	 * <p>Asked as a query and not as a rank number for the reason V3 gives about {@code rank}: it is „a
	 * position in a file and not a fact about a town", so the day the codebook is regenerated a written
	 * number moves to a different town while this goes on meaning what it says. The same expression
	 * {@code PaymentsDueApiTest} uses, and for the same reason it was added there: without it every
	 * member of a fixture lives abroad and the whole currency axis has ONE state.
	 */
	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	/**
	 * WHAT A EURO MEMBER BORN LONG AGO IS EXPECTED TO SEND, in the early period: 35 and 3 of fee.
	 *
	 * <p><b>Owner, 27.09.2026 (PDL 19):</b> „„Ocekivan iznos" je ono sto clan SALJE, dakle sa
	 * uracunatom taksom. Za clana iz inostranstva sa clanarinom 40 i taksom 3, labela kaze 43." The
	 * period here is `early` rather than `regular`, so the two numbers are 35 and 3.
	 *
	 * <p>It is a constant because most cases in this file are not about the amount at all, and the
	 * cheapest way for such a case to stay about its own subject is to send EXACTLY what was expected -
	 * case 1 of the grid, which writes the payment and the membership and touches no book.
	 */
	private static final BigDecimal WHAT_A_EURO_MEMBER_SENDS = new BigDecimal("38.00");

	/** And a member in Serbia sends 4.200 with no fee at all, because V4 gives the fee no dinar side. */
	private static final BigDecimal WHAT_A_SERBIAN_MEMBER_SENDS = new BigDecimal("4200.00");

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	/**
	 * FOR THE ONE QUESTION THAT CANNOT BE ASKED ON THIS CLASS'S OWN TRANSACTION.
	 *
	 * <p>{@link #numbersHandedOutSoFar} carries the whole of why: a sequence is outside the
	 * transaction, and a booking the database has refused leaves the connection it was refused on
	 * unable to answer anything else.
	 */
	@Autowired
	private javax.sql.DataSource dataSource;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockInsideTheEarlyPeriod() {
			return Clock.fixed(NOW, java.time.ZoneOffset.UTC);
		}
	}

	private String moderatorCookie;

	private String noRightsCookie;

	@BeforeEach
	void aModeratorWhoMayWorkThePaymentsQueue() {
		moderatorCookie = account(MODERATOR, "moderator");
		ticked(MODERATOR, "queue:payments");

		noRightsCookie = account(NO_RIGHTS_MODERATOR, "moderator");
		ticked(NO_RIGHTS_MODERATOR, "entity:events");
	}

	private String account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private long competitor(String referralSuffix, String memberNumber, boolean active, String birthDate) {
		return competitor(referralSuffix, memberNumber, active, birthDate, A_TOWN);
	}

	/**
	 * @param town a SQL expression for {@code place_id}, so a case can put somebody in Serbia or abroad
	 *             without the town becoming a second thing the caller has to undo. It decides his
	 *             CURRENCY and therefore every amount in the case
	 */
	private long competitor(String referralSuffix, String memberNumber, boolean active, String birthDate,
			String town) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Takmicar',"
						+ " 'M', ?, " + town + ", null, null, 2027, false, ?, 'payment',"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(memberNumber, java.sql.Date.valueOf(LocalDate.parse(birthDate)), active,
						"00112233445566" + referralSuffix)
				.query(Long.class).single();
	}

	private MockHttpServletResponse confirm(String json, String cookie) throws Exception {
		return http.perform(post("/api/payments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, cookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(json))
				.andReturn().getResponse();
	}

	private String json(PaymentApi.Confirm confirm) {
		return mapper.writeValueAsString(confirm);
	}

	private long paymentCount() {
		return db.sql("select count(*) from payment").query(Long.class).single();
	}

	private long membershipCount() {
		return db.sql("select count(*) from membership").query(Long.class).single();
	}

	/**
	 * A MEMBERSHIP THE ASSOCIATION GRANTED WITHOUT A FEE, WRITTEN THE WAY THE SCHEMA
	 * ALLOWS IT RATHER THAN THROUGH A ROUTE.
	 *
	 * <p>{@code V22} names both halves of this row: {@code membership_basis_known}
	 * allows {@code feeExempt} beside {@code payment}, and
	 * {@code membership_basis_says_whether_a_payment_is_named} requires the receipt to
	 * be absent exactly when the basis is not a payment. So this is not a contrived
	 * row: it is the only shape the table will take for somebody who does not pay.
	 *
	 * <p><b>And it carries WHO and WHEN, because since {@code V35} it has to.</b>
	 * {@code membership_free_of_the_fee_says_who} and its pair make an exemption with
	 * no trail illegal (owner, 27.09.2026), so a helper that wrote one would be
	 * writing a row the schema refuses rather than the row this route will meet.
	 */
	private void freeOfTheFee(long competitorId, int season) {
		db.sql("insert into membership (competitor_id, season, basis, payment_id,"
						+ " decided_by, decided_by_name, decided_at)"
						+ " values (?, ?, 'feeExempt', null,"
						+ " (select id from account where email = ?), 'Blagajnik Probni', ?)")
				.params(competitorId, season, MODERATOR, Timestamp.from(NOW))
				.update();
	}

	/**
	 * A FIRST TIME PAYER IS GIVEN A NUMBER, RECORDED AND ACTIVATED, ALL IN ONE
	 * ANSWER.
	 *
	 * <p>PDL, 30.07.2026: „Clanski broj se dodeljuje automatski u trenutku
	 * evidentiranja uplate." The competitor here carries none before this call, so
	 * {@link com.btl.portal.domain.payment.RecordingAPayment.Outcome#RECORD_IT_AND_NUMBER_HIM}
	 * is the only outcome this fixture can reach.
	 */
	@Test
	void aFirstTimePayerIsGivenANumberAndActivated() throws Exception {
		long id = competitor("a1", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(), PaymentApi.Confirmed.class);

		assertThat(body.memberNumber()).matches("^[0-9]{6}$");
		assertThat(body.amount()).isEqualByComparingTo("35.00");
		assertThat(body.fee()).isEqualByComparingTo("3.00");
		assertThat(body.currency()).isEqualTo("EUR");

		assertThat(db.sql("select member_number, active from competitor where id = ?").param(id)
						.query((row, i) -> row.getString(1) + " " + row.getBoolean(2)).single())
				.isEqualTo(body.memberNumber() + " true");

		assertThat(db.sql("select season, state, reference from payment where id = ?").param(body.paymentId())
						.query((row, i) -> row.getInt(1) + " " + row.getString(2) + " "
								+ row.getString(3)).single())
				.isEqualTo("2028 recorded null");

		/* THE ROW ITSELF, NOT JUST THE ANSWER: a response that echoes the right amount
		   while a different one is written is the more dangerous of the two ways this
		   could go wrong, and only a query against the table the moderator's decision
		   is billed from can tell the two apart. */
		assertThat(db.sql("select amount, fee, currency from payment where id = ?").param(body.paymentId())
						.query((row, i) -> row.getBigDecimal(1) + " " + row.getBigDecimal(2) + " "
								+ row.getString(3)).single())
				.isEqualTo("35.00 3.00 EUR");

		assertThat(db.sql("select basis, payment_id from membership where competitor_id = ? and season = 2028")
						.param(id).query((row, i) -> row.getString(1) + " " + row.getLong(2)).single())
				.isEqualTo("payment " + body.paymentId());
	}

	/**
	 * A RETURNING MEMBER KEEPS HIS OWN NUMBER.
	 *
	 * <p>PDL, 11.08.2026: „Taj clanski broj ostaje zauvek vezan za tu osobu." He is
	 * paying for a second season, so {@code RECORD_IT} is the outcome, not
	 * {@code RECORD_IT_AND_NUMBER_HIM}. A reference is given here to cover the branch
	 * a first time payer's fixture above leaves untaken.
	 */
	@Test
	void aReturningMemberKeepsHisNumber() throws Exception {
		/* AND HE LIVES IN SERBIA, WHICH IS WHAT MAKES THIS THE DINAR CASE.

		   Until V42 the request said which money it was and this case sent „RSD" while the member lived
		   in Shanghai. Since the owner's decision of 27.09.2026 (PDL 19) the currency is worked out from
		   his country, so the only way to measure the dinar side of the price list is to put him where
		   dinars are what he is billed in - which is where the fact lives, and is why this reads better
		   than it did. The assertions below are unchanged: 4.200 and no fee at all, because V4 gives the
		   processing row no dinar side. */
		long id = competitor("a2", "005005", false, "1990-05-15", A_TOWN_IN_SERBIA);

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				WHAT_A_SERBIAN_MEMBER_SENDS, false, "ips", "20280055")), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(), PaymentApi.Confirmed.class);

		assertThat(body.memberNumber()).isEqualTo("005005");
		assertThat(body.amount()).isEqualByComparingTo("4200.00");
		assertThat(body.fee()).isEqualByComparingTo("0.00");

		assertThat(db.sql("select active from competitor where id = ?").param(id)
				.query(Boolean.class).single()).isTrue();

		assertThat(db.sql("select reference from payment where id = ?").param(body.paymentId())
				.query(String.class).single()).isEqualTo("20280055");
	}

	/** THE JUNIOR PRICE OVERRIDES THE PERIOD, whatever day it is paid on (V4, `MembershipPrice`). */
	@Test
	void aJuniorPaysTheJuniorPrice() throws Exception {
		long id = competitor("a3", null, false, "2015-05-05");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(), PaymentApi.Confirmed.class);

		assertThat(body.amount()).isEqualByComparingTo("20.00");
		assertThat(body.fee()).isEqualByComparingTo("3.00");
	}

	/**
	 * RECORDING THE SAME PAYMENT TWICE IS HARMLESS.
	 *
	 * <p>{@code RecordingAPayment}'s own reason: a bank statement is reconciled in
	 * bulk and the same file can be imported twice. A moderator's second click on a
	 * row the queue no longer shows is the same case, and it must not hand out a
	 * second number or write a second row of either table.
	 */
	@Test
	void confirmingTheSamePaymentTwiceIsHarmless() throws Exception {
		long id = competitor("a4", null, false, "1990-05-15");
		PaymentApi.Confirm typed = new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null);

		MockHttpServletResponse first = confirm(json(typed), moderatorCookie);
		PaymentApi.Confirmed firstBody =
				mapper.readValue(first.getContentAsString(), PaymentApi.Confirmed.class);

		long paymentsBefore = paymentCount();
		long membershipsBefore = membershipCount();

		MockHttpServletResponse second = confirm(json(typed), moderatorCookie);

		assertThat(second.getStatus())
				.as("a second confirmation of the same payment was not answered as harmless")
				.isEqualTo(200);

		PaymentApi.Confirmed secondBody =
				mapper.readValue(second.getContentAsString(), PaymentApi.Confirmed.class);

		assertThat(secondBody.paymentId()).isEqualTo(firstBody.paymentId());
		assertThat(secondBody.memberNumber()).isEqualTo(firstBody.memberNumber());

		assertThat(paymentCount()).as("the same payment was recorded twice").isEqualTo(paymentsBefore);
		assertThat(membershipCount()).as("the same membership was written twice")
				.isEqualTo(membershipsBefore);
	}

	/**
	 * RECORDING THE SAME PAYMENT TWICE IS STILL HARMLESS WHEN IT CARRIES A
	 * REFERENCE, WHICH IS THE POPULATION A RENEWAL ACTUALLY BELONGS TO.
	 *
	 * <p>V16: a first payment's reference is always null, so the case above never
	 * exercises the „is this reference taken" check at all. A renewal's does - PDL
	 * P8, „uplata bez poziva na broj uvek trazi coveka" is why one is written on it in
	 * the first place - and this is the mutation guard for a bug the reference check
	 * used to have: run before the outcome was known, it found the payment's OWN
	 * reference already sitting on its OWN row and refused the second click with 409
	 * as though a stranger had taken it.
	 */
	@Test
	void confirmingTheSamePaymentTwiceIsHarmlessWhenItCarriesAReference() throws Exception {
		long id = competitor("b1", "005010", false, "1990-05-15", A_TOWN_IN_SERBIA);
		PaymentApi.Confirm typed = new PaymentApi.Confirm(id, WHAT_A_SERBIAN_MEMBER_SENDS, false, "ips",
				"20280051");

		MockHttpServletResponse first = confirm(json(typed), moderatorCookie);
		PaymentApi.Confirmed firstBody =
				mapper.readValue(first.getContentAsString(), PaymentApi.Confirmed.class);

		long paymentsBefore = paymentCount();
		long membershipsBefore = membershipCount();

		MockHttpServletResponse second = confirm(json(typed), moderatorCookie);

		assertThat(second.getStatus())
				.as("a second confirmation of a payment carrying a reference was refused"
						+ " as though the reference belonged to somebody else: "
						+ second.getContentAsString())
				.isEqualTo(200);

		PaymentApi.Confirmed secondBody =
				mapper.readValue(second.getContentAsString(), PaymentApi.Confirmed.class);

		assertThat(secondBody.paymentId()).isEqualTo(firstBody.paymentId());
		assertThat(secondBody.memberNumber()).isEqualTo(firstBody.memberNumber());

		assertThat(paymentCount()).as("the same payment was recorded twice").isEqualTo(paymentsBefore);
		assertThat(membershipCount()).as("the same membership was written twice")
				.isEqualTo(membershipsBefore);
	}

	/**
	 * A REVERSED PAYMENT IS NOT REVIVED BY THIS ROUTE.
	 *
	 * <p>PDL, 11.08.2026 and 14.09.2026: a reversal is its own decision, and the
	 * number it cost stays reserved for the same man rather than returning to
	 * circulation. {@code RecordingAPayment} refuses to turn it back "quietly", and
	 * this route carries that refusal out as 409 rather than resurrecting the row.
	 */
	@Test
	void aReversedPaymentIsRefusedNotRevived() throws Exception {
		long id = competitor("a5", "007007", false, "1990-05-15");

		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name, received)"
						+ " values"
						+ " (?, 2028, '20280070', (select id from price_row where key = 'early'),"
						+ " 35.00, 'EUR', 3.00, 'paypal', 'reversed', timestamptz '2027-10-02 09:00:00+00',"
						+ " null, 'Blagajnik Probni', 38.00)")
				.param(id).update();

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_PAYMENT_WAS_REVERSED);

		assertThat(db.sql("select active from competitor where id = ?").param(id)
				.query(Boolean.class).single()).as("a refused reversal changed the competitor").isFalse();
		assertThat(membershipCount()).as("a refused reversal wrote a membership anyway").isZero();
	}

	/**
	 * A SEASON ALREADY HELD WITHOUT A FEE IS REFUSED, AND THE KEY IS NEVER REACHED.
	 *
	 * <p>{@code membership_pk} is {@code (competitor_id, season)}, so the row the
	 * administration writes when it frees somebody of the fee occupies exactly the
	 * place {@code recordIt} would insert into. Before this guard the route read
	 * {@code payment} only, found nothing waiting, drew a number, wrote the payment and
	 * then met the key - a 500 with a member number already spent on it, which the
	 * sequence never gives back.
	 *
	 * <p><b>The refusal says the season is held and never on what ground, and that is
	 * asserted over the whole body rather than over the reason.</b> The tick that opens
	 * this route is {@code queue:payments}, while the basis is read under
	 * {@code entity:members} (PDL 28.07.2026), so a body mentioning the basis would be
	 * this route answering a question its caller may not ask. Reading the raw text
	 * refuses it however it might be spelt or whatever field it arrived in.
	 *
	 * <p><b>Two competitors, and the one this case is about is neither the first by id
	 * nor the only one carrying a membership.</b> The other man holds one too, for a
	 * DIFFERENT season, so „he has a membership row" and „he has one for THIS season"
	 * cannot stand in for each other - and the case below pays for that other man to
	 * prove the difference is the one the guard actually reads.
	 */
	@Test
	void aSeasonAlreadyHeldWithoutAFeeIsRefusedRatherThanMeetingTheKey() throws Exception {
		long heldElsewhere = competitor("b3", "008008", true, "1990-05-15");
		long id = competitor("b4", null, false, "1990-05-15");

		freeOfTheFee(heldElsewhere, 2029);
		freeOfTheFee(id, 2028);

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_MEMBERSHIP_IS_ALREADY_HELD);

		assertThat(answer.getContentAsString())
				.as("the refusal told a moderator holding only queue:payments HOW the membership"
						+ " is held, which is read under entity:members and not under his tick")
				.doesNotContain("feeExempt").doesNotContain("payment");

		assertThat(paymentCount()).as("a refused confirmation wrote a payment anyway").isZero();
		assertThat(membershipCount()).as("a refused confirmation touched the membership rows")
				.isEqualTo(2);

		assertThat(db.sql("select basis, payment_id from membership where competitor_id = ?"
						+ " and season = 2028").param(id)
						.query((row, i) -> row.getString(1) + " " + row.getObject(2)).single())
				.as("the membership the administration granted was written over by a fee")
				.isEqualTo("feeExempt null");

		assertThat(db.sql("select member_number, active from competitor where id = ?").param(id)
						.query((row, i) -> row.getObject(1) + " " + row.getBoolean(2)).single())
				.as("a refused confirmation numbered him or activated him")
				.isEqualTo("null false");
	}

	/**
	 * AND A MEMBERSHIP IN ANOTHER SEASON DOES NOT BLOCK THIS ONE.
	 *
	 * <p><b>This is the guard on the guard above, and it is a replacement of the SOURCE
	 * rather than a deleted assertion.</b> Written without the season - „does he hold a
	 * membership at all" - the query would refuse every renewal the portal has, because
	 * a man renewing holds last season's membership by construction. So the same
	 * fixture is used and the OTHER man is paid for: he carries a row for 2029 and none
	 * for 2028, and the day the season drops out of that query this case answers 409.
	 */
	@Test
	void aMembershipInAnotherSeasonDoesNotBlockThisOne() throws Exception {
		long heldElsewhere = competitor("b5", "008008", true, "1990-05-15");
		long other = competitor("b6", null, false, "1990-05-15");

		freeOfTheFee(other, 2029);
		freeOfTheFee(heldElsewhere, 2030);

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(other, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(), PaymentApi.Confirmed.class);

		assertThat(db.sql("select basis, payment_id from membership where competitor_id = ?"
						+ " and season = 2028").param(other)
						.query((row, i) -> row.getString(1) + " " + row.getLong(2)).single())
				.isEqualTo("payment " + body.paymentId());

		assertThat(db.sql("select basis from membership where competitor_id = ? and season = 2029")
						.param(other).query(String.class).single())
				.as("the season he was already free of was rewritten by a payment for another one")
				.isEqualTo("feeExempt");
	}

	/**
	 * AND THE QUESTION IS THE KEY AND NOT THE BASIS, WHICH ONLY THIS CASE CAN SHOW.
	 *
	 * <p><b>Why it had to be written: without it the guard has no floor at all.</b> The
	 * two cases above pass unchanged if {@code theSeasonIsAlreadyHeld} is narrowed to
	 * „{@code and basis = 'feeExempt'}", because {@code feeExempt} is the only basis
	 * either of them puts in the way. A guard whose shape no case can distinguish from
	 * a narrower one is a guard that measures its outcome and not its question, and the
	 * branch in flight adding {@code 'balance'} is exactly the mutation that would then
	 * arrive unmeasured.
	 *
	 * <p><b>The state this uses is legal and named, not contrived.</b> A {@code payment}
	 * left {@code awaited} is what {@code V16}'s own {@code default 'awaited'} leaves
	 * room for, and {@code membership_payment_fk} asks for the receipt's identity and
	 * never its state - so a membership naming a payment that has not been recognised
	 * is a row the schema takes. Reaching this route with it, the outcome is
	 * {@code RECORD_IT_AND_NUMBER_HIM}, the same as for somebody with no payment at
	 * all, so the guard is asked with a membership whose basis is {@code payment}.
	 *
	 * <p>Narrowed to the basis, this case does not merely answer 201 instead: it answers
	 * 500, because {@code recordIt} then meets {@code payment_one_a_season} on the way
	 * to the key it was going to meet anyway.
	 */
	@Test
	void aSeasonHeldOnAPaymentNotYetRecognisedIsRefusedToo() throws Exception {
		long id = competitor("b7", null, false, "1990-05-15");

		long awaited = db.sql("insert into payment (competitor_id, season, reference, price_row_id,"
						+ " amount, currency, fee, method, state) values"
						+ " (?, 2028, '20280077', (select id from price_row where key = 'early'),"
						+ " 35.00, 'EUR', 3.00, 'paypal', 'awaited') returning id")
				.param(id).query(Long.class).single();

		db.sql("insert into membership (competitor_id, season, basis, payment_id)"
						+ " values (?, 2028, 'payment', ?)")
				.params(id, awaited).update();

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus())
				.as("a season already held was recorded over, or the key was met and answered 500")
				.isEqualTo(409);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_MEMBERSHIP_IS_ALREADY_HELD);

		assertThat(db.sql("select state from payment where id = ?").param(awaited)
				.query(String.class).single()).isEqualTo("awaited");
		assertThat(paymentCount()).as("a second payment was written for a season already held")
				.isEqualTo(1);
	}

	/**
	 * AN UNCONFIRMED ACCOUNT MAY STILL BE PAID FOR.
	 *
	 * <p>The journal holds two live entries on this exact question and they
	 * disagree: PDL 31.07.2026 ties payment to a confirmed address, PDL 11.08.2026
	 * names payment by name and says it is not stopped by an unclicked link. This
	 * route follows the later, more specific entry - PaymentApi's own class comment
	 * quotes both - and this case is the mutation guard for that choice: were the
	 * earlier entry applied here instead, this case would start failing.
	 */
	@Test
	void anUnconfirmedAccountMayStillBePaidFor() throws Exception {
		long id = competitor("a6", null, false, "1990-05-15");

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Nov', 'Clan', 'nepotvrdjen@primer.rs',"
						+ " (select id from role where code = 'competitor'), ?)")
				.param(id).update();

		assertThat(db.sql("select email_confirmed_at from account where competitor_id = ?").param(id)
				.query(Timestamp.class).optional()).isEmpty();

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
	}

	@Test
	void theFormMustNameACompetitor() throws Exception {
		MockHttpServletResponse answer = confirm(
				"{\"season\":2028,\"currency\":\"EUR\",\"method\":\"paypal\"}", moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_FORM_IS_NOT_COMPLETE);
	}

	/**
	 * A SEASON SENT IN THE BODY CHANGES NOTHING, because the body has no season.
	 *
	 * <p><b>This case used to say the opposite.</b> It asserted that a form without a
	 * season is refused, which was true while the moderator chose one. The owner's
	 * decision of 13.09.2026 says the season is a function of the day a payment is
	 * booked - „prozor za placanje sezone S ide od 1. oktobra godine S-1 do 30. septembra
	 * godine S" - so the field is gone and the day decides. Written the old way this case
	 * now fails against correct code, which is how it was noticed.
	 *
	 * <p>What is worth a case is the other half: a body that still carries a season is
	 * not an error and is not obeyed either. Jackson drops a field the record does not
	 * have, so a moderator who sends 2027 on a day that buys 2028 gets 2028 - and if the
	 * field ever comes back, this goes red.
	 */
	@Test
	void aSeasonSentInTheBodyIsIgnoredAndTheDayDecides() throws Exception {
		long id = competitor("a7", null, false, "1990-05-15");

		/* AND THE CURRENCY IS SENT TOO, ALTHOUGH NOTHING READS IT, for the same reason the season is:
		   this case is about a field the form does not have, and both of them are now in that
		   position. `currency` was taken until V42 and is worked out from the member's country since
		   (owner, 27.09.2026, PDL 19), so a body naming it has to be accepted and ignored exactly as a
		   body naming a season is - and if either field ever comes back, this goes red. */
		MockHttpServletResponse answer = confirm(
				"{\"competitorId\":" + id + ",\"season\":2027,\"currency\":\"RSD\","
						+ "\"received\":38.00,\"useTheBalance\":false,\"method\":\"paypal\"}",
				moderatorCookie);

		assertThat(answer.getStatus())
				.as("a body naming a season was refused, so the field is back on the form")
				.isEqualTo(201);

		assertThat(db.sql("select season from payment where competitor_id = ?")
						.param(id).query(Integer.class).single())
				.as("the season the moderator typed was obeyed instead of the one the booking"
						+ " day gives")
				/* THE LITERAL YEAR, and not the same function the handler calls. Asked through
				   `seasonBeingPaidFor` both sides would be wrong together the day that
				   function is. The clock of this file stands on 3 October 2027, and the
				   owner's decision of 13.09.2026 says the window for season S runs from 1
				   October of S-1, so that day buys 2028. */
				.isEqualTo(2028);
	}

	/**
	 * A REQUEST THAT DOES NOT SAY WHETHER THE TICK BOX WAS LEFT TICKED IS NOT A FILLED IN FORM.
	 *
	 * <p><b>Asked for and never guessed</b>, the same refusal {@code GrantingAMembership} makes of its
	 * own prompt and for the same reason: the screen defaults the box to ticked (PDL 19), so a request
	 * that leaves it out has not said which way, and defaulting either way would spend or withhold a
	 * member's money because a field was misspelled.
	 *
	 * <p>Sent as raw JSON rather than through the record, because a record cannot express „the key is
	 * not there at all" - which is exactly the shape a screen sends when a field is renamed.
	 */
	@Test
	void arequestThatDoesNotSayWhetherTheBalanceIsIncludedIsNotAfilledInForm() throws Exception {
		long id = competitor("a8", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(
				"{\"competitorId\":" + id + ",\"received\":38.00,\"method\":\"paypal\"}",
				moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(paymentCount()).isZero();
	}

	/**
	 * THE METHOD MUST BE FILLED IN, AND „NOT THERE" AND „THERE BUT EMPTY" ARE BOTH FORMS OF NOT BEING.
	 *
	 * <p><b>Two shapes rather than one, and the second was lost on this branch before the coverage
	 * threshold found it.</b> A field a browser never sent arrives as {@code null}; a text input a
	 * moderator left untouched arrives as {@code ""}. {@code isNothing} answers true to both and that is
	 * the whole reason it exists rather than a plain {@code == null}. Until V42 the empty-string half was
	 * measured by a case about a blank CURRENCY - and the currency stopped being sent, so that case was
	 * replaced by one about a MISSING tick box, which is a {@code null}. <b>The guard survived and its
	 * case did not</b>, which is exactly the shape the rule about not deleting a guard before measuring
	 * its replacement is written for, and the threshold is what said so: one branch missed, nought lines.
	 */
	@Test
	void theMethodMustBeFilledInAndAnemptyStringIsNotFilledIn() throws Exception {
		long id = competitor("a9", null, false, "1990-05-15");

		for (String shape : new String[] {"", ",\"method\":\"\"", ",\"method\":\"   \""}) {
			MockHttpServletResponse answer = confirm(
					"{\"competitorId\":" + id + ",\"received\":38.00,\"useTheBalance\":false"
							+ shape + "}",
					moderatorCookie);

			assertThat(answer.getStatus())
					.as("a method sent as %s was taken as a filled in form", shape.isEmpty()
							? "nothing at all" : shape)
					.isEqualTo(400);
			assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
					.isEqualTo(PaymentApi.THE_FORM_IS_NOT_COMPLETE);
		}

		assertThat(paymentCount()).isZero();
	}

	/**
	 * AN AMOUNT THE COLUMN WOULD NOT KEEP IS REFUSED, IN ALL THREE OF THE WAYS IT CAN FAIL TO BE ONE.
	 *
	 * <p><b>Every one of the three reached the database before this, and two of them answered 500.</b>
	 * The route asked only whether what arrived was positive, so:
	 *
	 * <ul>
	 * <li>{@code 38.001} against an expected 38.00 left a surplus of {@code 0.001}, which
	 * {@code Balance.Money.isMoney} calls money because its sign is positive. The column then ROUNDED it
	 * to {@code 0.00} and {@code balance_entry_an_overpayment_adds} (V42) refused a credit of nothing, so
	 * the whole transaction went back: no payment, no membership, no member number, and a 500 carrying no
	 * sentence a moderator could read.
	 * <li>{@code 99999999999.00}, an ordinary mistyping, was {@code numeric field overflow} on the
	 * {@code insert} itself - the same 500 by a shorter road.
	 * <li>{@code 38.006} was the SILENT one and is in the same case because it is the same fault: nothing
	 * refused it, the surplus {@code 0.006} entered the column as {@code 0.01}, and {@code received}
	 * became {@code 38.01} - a number nobody typed, in the books, for ever.
	 * </ul>
	 *
	 * <p><b>All three carry the SAME word, and that is the precedent's own choice rather than a
	 * shortcut.</b> {@code PricingWriteApi.THE_AMOUNT_IS_NOT_KEPT_EXACTLY} covers „negative, or with more
	 * para than the column keeps, or past what it can hold" under one name, and reserves its second name
	 * for a PRODUCT ceiling the owner decided (PDL P12c). A payment has no product ceiling - case 7 lets a
	 * member send more than was expected on purpose - so a second name here would be two names for one
	 * question.
	 *
	 * <p><b>And nothing is written on any of the three</b>, which is asserted rather than assumed: a 400
	 * that had already drawn a member number would have spent it for good, because the sequence only
	 * counts up.
	 *
	 * <p><b>ONE INVOCATION PER FORM AND NOT A LOOP INSIDE ONE CASE, and that is measured rather than
	 * tidy.</b> Written as a loop, the first form THREW under the mutation that removes the guard - the
	 * refusal reaches this route as an exception and not as a 500 body - so the loop stopped there and
	 * the other two forms were never measured under that mutation at all. A case whose later assertions
	 * only run while the code is correct is a case that measures the first one. Each form now gets its
	 * own transaction and its own verdict.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"38.001", "38.006", "99999999999.00"})
	void anamountTheColumnWouldNotKeepIsRefused(String notKept) throws Exception {
		long id = competitor("cb", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal(notKept), true, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus())
				.as("an amount of %s reached the database, which is a 500 where a moderator should"
						+ " have been told something", notKept)
				.isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.as("an amount of %s was reported as something other than a number the column will"
						+ " not keep", notKept)
				.isEqualTo(PaymentApi.THE_AMOUNT_IS_NOT_KEPT_EXACTLY);

		assertThat(paymentCount()).isZero();
		assertThat(membershipCount()).isZero();
		assertThat(db.sql("select member_number from competitor where id = ?").param(id)
						.query(String.class).optional())
				.as("a member number was drawn for a request that was refused, and the sequence only"
						+ " counts up")
				.isEmpty();
	}

	/**
	 * AND WHICH REFUSAL GOES WITH WHICH CONDITION, WHICH IS THE ONE THING TWO HALVES CANNOT ASSERT ON
	 * THEIR OWN.
	 *
	 * <p><b>A negative amount fails BOTH questions and must keep the sentence it already had.</b>
	 * {@code MembershipPrice.amountIsKeptExactly} asks {@code signum() >= 0} as well as the scale and the
	 * ceiling, so had the new question been asked FIRST, three cases that have answered
	 * {@link PaymentApi#THE_AMOUNT_IS_NOT_MONEY} since this route was written would quietly have started
	 * answering something else. {@code PricingWriteApi} states the same reason for the same order: „a
	 * change that quietly restates old cases is a change nobody measured."
	 *
	 * <p><b>So this case is about the JOIN and not about either half.</b> Each half has its own cases
	 * above; what neither of them can say is which word comes out of which condition, and swapping the
	 * two words over is a mutation both halves survive. Three amounts, three pairs: nought and a
	 * negative keep the older sentence, and something the column will not keep gets the newer one.
	 *
	 * <p><b>One invocation per pair</b>, for the reason the case above gives at length: an amount that
	 * reaches the database throws rather than answering, so a loop would measure only its first row the
	 * moment anything is wrong.
	 */
	@ParameterizedTest
	@CsvSource({"0.00,theAmountIsNotMoney", "-38.00,theAmountIsNotMoney",
			"38.001,theAmountIsNotKeptExactly"})
	void eachAmountGetsItsOwnRefusalAndTheOrderIsWhatKeepsThemApart(String amount, String reason)
			throws Exception {

		/* THE TWO WORDS ARE COMPARED WITH THE CONSTANTS AND NOT ONLY WITH THE TEXT IN THE TABLE ABOVE,
		   so a constant renamed on the route cannot leave this case agreeing with a string nothing
		   answers any more. The table has to carry text because `@CsvSource` takes no expressions. */
		assertThat(reason)
				.as("the expected reason is not one of the two words this route can say")
				.isIn(PaymentApi.THE_AMOUNT_IS_NOT_MONEY, PaymentApi.THE_AMOUNT_IS_NOT_KEPT_EXACTLY);

		long id = competitor("cc", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal(amount), true, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.as("an amount of %s was answered with the wrong one of the two sentences", amount)
				.isEqualTo(reason);
	}

	/**
	 * AND WHAT THE ANSWER SAYS ARRIVED IS READ OFF THE ROW, NOT ECHOED BACK FROM THE REQUEST.
	 *
	 * <p><b>The amount is sent as {@code 38.0} on purpose, and the SCALE is what this case reads.</b>
	 * That is a number the bound accepts - {@code stripTrailingZeros().scale()} of {@code 38.0} is
	 * {@code -1} - and the column stores it as {@code 38.00}. So the two possible sources answer the same
	 * VALUE with two different spellings, and the spelling is the only thing that says which of them
	 * answered. Asserting it is therefore asserting the SOURCE, which is what the rule about two sources
	 * of one value asks for; {@code isEqualByComparingTo} would call both correct and measure nothing.
	 *
	 * <p><b>Why it matters that it is the row.</b> Before the scale was bounded the two could differ by
	 * VALUE and not only by spelling: a request carrying {@code 38.006} was answered {@code 38.006} while
	 * the row held {@code 38.01}. The bound closes that, and reading the row closes it by CONSTRUCTION
	 * rather than by argument - which is the difference between a rule that holds and one that happens
	 * to. It also makes this branch answer the way the repeat branch always has:
	 * {@code alreadyRecorded} reads {@code received} off the row.
	 *
	 * <p>The row's own value is read and compared as well, so a route that served something neither the
	 * request nor the row carries is caught by the number rather than by the scale.
	 */
	@Test
	void whatTheAnswerSaysArrivedIsTheRowsOwnValueAndNotTheRequests() throws Exception {
		long id = competitor("cd", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("38.0"), false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(),
				PaymentApi.Confirmed.class);

		BigDecimal onTheRow = db.sql("select received from payment where id = ?")
				.param(body.paymentId()).query(BigDecimal.class).single();

		assertThat(onTheRow)
				.as("the column did not keep it as the two decimals it is declared with, so this case"
						+ " cannot tell the row from the request")
				.isEqualTo(new BigDecimal("38.00"));

		assertThat(body.received())
				.as("the answer echoed the request instead of reading the row, so the two can be two"
						+ " numbers the day anything rounds")
				.isEqualTo(onTheRow);
	}

	/**
	 * AND AN EMPTY REFERENCE BOX IS NO REFERENCE AT ALL, WHICH IS THE ORDINARY THING A SCREEN SENDS.
	 *
	 * <p><b>This is the second caller of the same question and the one where getting it wrong costs
	 * something.</b> V16 says of the reference that it is „the poziv na broj, when the statement carries
	 * one; null for a first payment, which has no number yet to write on a slip" - so a moderator
	 * booking a first payment has nothing to type, and an untouched text input reaches the route as
	 * {@code ""} rather than as {@code null}. Without the blank being read as absent, {@code A_REFERENCE}
	 * meets an empty string, fails to match, and the route answers
	 * {@link PaymentApi#THE_REFERENCE_IS_NOT_SHAPED} - a refusal for the commonest booking there is.
	 *
	 * <p><b>The column is asserted and not only the status</b>, because the two say different things:
	 * a 201 would also be given by a route that stored the empty string, and
	 * {@code payment_reference_shape} (V16) reads {@code reference is null or reference ~ '^[0-9]{7,}$'},
	 * so an empty string on the row would be refused by the database rather than by anybody - a 500 one
	 * layer down instead of a clean row.
	 *
	 * <p>Whitespace is sent as well as the empty string, because {@code isBlank} is what the route asks
	 * and a box somebody typed a space into is the same box.
	 */
	@Test
	void anemptyReferenceBoxIsNoReferenceAtAll() throws Exception {
		/* TWO FREE SUFFIXES RATHER THAN ONE BUILT FROM THE LOOP INDEX: `competitor_referral_code_shape`
		   (V7) asks for sixteen HEXADECIMAL characters, and the helper appends its argument to a
		   fourteen character stem - so a three character suffix is seventeen characters and a `g` is not
		   a digit at all. Measured rather than reasoned about: both mistakes were made here and the
		   constraint named each of them. */
		String[] boxes = {"\"\"", "\"   \""};
		String[] suffixes = {"bf", "ca"};

		for (int one = 0; one < boxes.length; one++) {
			long id = competitor(suffixes[one], null, false, "1990-05-15");

			MockHttpServletResponse answer = confirm(
					"{\"competitorId\":" + id + ",\"received\":38.00,\"useTheBalance\":false,"
							+ "\"method\":\"paypal\",\"reference\":" + boxes[one] + "}",
					moderatorCookie);

			assertThat(answer.getStatus())
					.as("a moderator who left the reference box at %s was refused, and that is the"
							+ " commonest booking the portal has", boxes[one])
					.isEqualTo(201);

			PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(),
					PaymentApi.Confirmed.class);

			assertThat(db.sql("select reference from payment where id = ?").param(body.paymentId())
							.query(String.class).optional())
					.as("an empty box was stored as an empty string rather than as no reference, which"
							+ " `payment_reference_shape` refuses")
					.isEmpty();
		}
	}

	/**
	 * AN AMOUNT THAT IS NOT MONEY IS REFUSED IN ALL THREE OF ITS FORMS, AND THEY ARE ONE STATE.
	 *
	 * <p><b>Owner, 27.09.2026 (PDL 19, point 5), chosen between three outcomes:</b> a typed NOUGHT
	 * means the same as an empty field - „Prazno polje i ukucana nula vode na isti prompt, onaj o
	 * oslobodjenju od clanarine". So this route is for money arriving, and a request that says no money
	 * arrived belongs at {@code POST /api/memberships}, where cases 4, 5 and 6 are answered.
	 *
	 * <p><b>All three forms are measured because they reach the same refusal by three different
	 * roads</b> and a guard written for one of them lets the others through: absent is Jackson leaving
	 * a boxed field null, nought is a moderator typing a zero, and a negative is a field with no minimum
	 * on the screen. {@code payment_amount_positive} (V16) and {@code payment_received_positive} (V42)
	 * are the same sentence where it cannot be got around, and meeting THEM instead of this would be a
	 * 500 on a moderator's screen.
	 *
	 * <p><b>And it is NOT reported as an incomplete form</b>, which is its own assertion rather than a
	 * detail: a caller told only that his form is incomplete would fill the field in with nought and be
	 * told exactly the same thing again.
	 */
	@Test
	void anamountThatIsNotMoneyIsRefusedInAllThreeOfItsForms() throws Exception {
		long id = competitor("ab", null, false, "1990-05-15");

		for (BigDecimal notMoney : new BigDecimal[] {null, BigDecimal.ZERO, new BigDecimal("-38.00")}) {
			MockHttpServletResponse answer = confirm(json(
					new PaymentApi.Confirm(id, notMoney, false, "paypal", null)), moderatorCookie);

			assertThat(answer.getStatus())
					.as("an amount of %s was taken as a payment", notMoney)
					.isEqualTo(400);
			assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
					.as("an amount of %s was reported as something other than what it is", notMoney)
					.isEqualTo(PaymentApi.THE_AMOUNT_IS_NOT_MONEY);
		}

		assertThat(paymentCount()).isZero();
		assertThat(membershipCount()).isZero();
	}

	@Test
	void theMethodMustBeOneOfTheFour() throws Exception {
		long id = competitor("ac", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "bitcoin", null)),
				moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_METHOD_IS_NOT_KNOWN);
	}

	@Test
	void aReferenceMustBeShapedLikeOne() throws Exception {
		long id = competitor("ad", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", "2028-070")), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_REFERENCE_IS_NOT_SHAPED);
	}

	@Test
	void aReferenceAlreadyUsedIsRefused() throws Exception {
		long first = competitor("ae", "009009", false, "1990-05-15");
		long second = competitor("af", null, false, "1990-05-15");

		confirm(json(new PaymentApi.Confirm(first, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", "20280090")), moderatorCookie);

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(second, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", "20280090")), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_REFERENCE_IS_TAKEN);
	}

	@Test
	void theCompetitorMustExist() throws Exception {
		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(999999L, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_COMPETITOR_DOES_NOT_EXIST);
	}

	/**
	 * DEFENCE IN DEPTH: this specific route, asked by a moderator holding a
	 * different tick, is refused exactly the way {@code RightsAtTheDoorTest} proves
	 * every route carrying {@link RightIsNeeded} is refused. The generic floor
	 * already measures the mechanism; this measures that THIS route really wears the
	 * annotation and really names {@code queue:payments}.
	 */
	@Test
	void aModeratorWithoutThePaymentsTickIsRefused() throws Exception {
		long id = competitor("b0", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS, false, "paypal", null)), noRightsCookie);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(paymentCount()).isZero();
	}

	/* ------------------------------------------------------------------------------------------
	 * AND WHAT THE BOOK OF BALANCE DOES WHEN THE MONEY LANDS, WHICH SINCE 27.09.2026 IS DECIDED BY
	 * THE TICK BOX ON THE MODERATOR'S SCREEN AND NOT BY WHAT A QR CODE PROMISED
	 *
	 * Owner, 27.09.2026 (PDL 23a), chosen between three outcomes: "Na moderatorovom ekranu odlucuje
	 * kucica i iznos u njenoj labeli, ne ono sto je QR kod obecao. Clanovo sopstveno placanje po QR
	 * kodu se ne dira."
	 *
	 * WHAT THESE CASES REPLACED AND WHY EVERY ONE OF THEM WAS RIGHT BEFORE. Until this branch the
	 * deduction was taken from `balance_promise`, and five cases here measured that: the promise
	 * rather than today's balance, an absent promise taking nothing, a promise capped at the book,
	 * and two codes for one season taking it once. All five described the mechanism the owner asked
	 * for on 26.09.2026 and got on 27.09.2026 for the member's own door - and that door is untouched,
	 * with `MyMembershipApiTest` and `MyMembershipWriteApiTest` still measuring it. What changed is
	 * that the MODERATOR's door stopped reading a promise at all, so cases about a promise on THIS
	 * route no longer describe anything: `Balance.honouring` was deleted with the decision rather
	 * than left uncalled.
	 *
	 * AND THE TWO REASONS THE OWNER WAS SHOWN BEFORE CHOOSING ARE EACH A CASE BELOW: clearing the
	 * box would otherwise have done nothing at all, and a member nobody ever opened the membership
	 * screen for has no promise, so his balance would never have come off however plainly the label
	 * beside the tick showed it.
	 * --------------------------------------------------------------------------------------- */

	/**
	 * ONE LINE IN THE BOOK: what V4's referral row is worth, for one member brought in.
	 *
	 * @param currency the money the REFERRER is billed in, because a line is his balance and a line in
	 *                 any other money is not. The amount is read out of the matching column of the
	 *                 price list rather than written here, so the case does not have to be edited the
	 *                 day the owner changes what a referral is worth
	 */
	private void rewardFor(long referrer, long broughtIn, String currency) {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
						+ " referred_competitor_id, occurred_at, recorded_by, recorded_by_name)"
						+ " select ?, case when ? = 'RSD' then reward.rsd else reward.eur end, ?,"
						+ " 'referral', ?, ?, (select id from account where email = ?),"
						+ " 'Blagajnik Probni'"
						+ " from (select eur, rsd from price_row where key = 'referral') reward")
				.params(referrer, currency, currency, broughtIn,
						Timestamp.from(NOW.minus(Duration.ofDays(30))), MODERATOR)
				.update();
	}

	/**
	 * WHAT A CODE SHOWN TO HIM SAID HIS BALANCE WOULD COVER, which this route must now IGNORE.
	 *
	 * <p>Kept in the fixture precisely because it is ignored: a case that asserts the tick box decides
	 * says nothing unless a promise is standing beside it saying a DIFFERENT number. That is the whole
	 * of the owner's decision of 27.09.2026 and the only way to measure it.
	 */
	private void promised(long competitor, int season, String amount, String currency) {
		db.sql("insert into balance_promise (competitor_id, season, amount, currency, promised_at)"
						+ " values (?, ?, ?::numeric, ?, ?)")
				.params(competitor, season, amount, currency,
						Timestamp.from(NOW.minus(Duration.ofDays(1))))
				.update();
	}

	/**
	 * WHAT HIS BOOK ADDS UP TO IN ONE MONEY, and the money is an argument because a sum across two of
	 * them is not a number.
	 */
	private BigDecimal bookOf(long competitor, String currency) {
		return db.sql("select coalesce(sum(amount), 0) from balance_entry"
						+ " where competitor_id = ? and currency = ?")
				.params(competitor, currency).query(BigDecimal.class).single();
	}

	/**
	 * WHAT THE MEMBERSHIP TOOK, AS ONE STRING, so a case says what it means in one assertion.
	 *
	 * <p>The currency is part of the answer and not assumed, because a line written in the wrong money
	 * is exactly the mistake one amount made possible and it would otherwise read as the right number.
	 */
	private String whatTheMembershipTook(long competitor) {
		return db.sql("select coalesce((select amount || ' ' || currency || ' ' || season"
						+ " from balance_entry where competitor_id = ? and reason = 'membership'),"
						+ " 'nothing taken')")
				.param(competitor).query(String.class).single();
	}

	/** And the same for a credit, which is case 7's whole outcome. */
	private String whatWasCredited(long competitor) {
		return db.sql("select coalesce((select amount || ' ' || currency || ' ' || season"
						+ " from balance_entry where competitor_id = ? and reason = 'overpayment'),"
						+ " 'nothing credited')")
				.param(competitor).query(String.class).single();
	}

	/**
	 * CASE 1: WHAT WAS EXPECTED ARRIVED, SO NOTHING COMES OFF THE BOOK EVEN WITH THE BOX TICKED.
	 *
	 * <p>PDL 19, case 1: „jednak ocekivanom, svejedno, aktivacija prolazi, covek se rasknjizava." He
	 * owes nothing more, so there is nothing for a balance to pay - and the box being TICKED is the
	 * point of the case rather than a detail, because an implementation that took „the tick means take
	 * the fee" would empty his book here.
	 *
	 * <p><b>HE HOLDS A BALANCE AND A PROMISE, both of which say a number this case must not see.</b>
	 * Without the balance the assertion would hold for a member who had nothing to take; without the
	 * promise it would hold for a route still reading one.
	 */
	@Test
	void whatWasExpectedArrivedSoTheBoxTakesNothingOffHisBook() throws Exception {
		long id = competitor("e1", null, false, "1990-05-15");
		long oneHeBroughtIn = competitor("e2", "004101", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn, "EUR");
		promised(id, 2028, "5", "EUR");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				WHAT_A_EURO_MEMBER_SENDS, true, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(whatTheMembershipTook(id))
				.as("a balance was spent by a member who paid in full")
				.isEqualTo("nothing taken");
		assertThat(whatWasCredited(id))
				.as("a credit was written for a member who sent exactly what was expected")
				.isEqualTo("nothing credited");
		assertThat(bookOf(id, "EUR")).isEqualByComparingTo("5.00");
	}

	/**
	 * CASE 2: LESS ARRIVED AND THE BALANCE COVERS THE DIFFERENCE, SO THE DIFFERENCE COMES OFF.
	 *
	 * <p>PDL 19, case 2: „manji, balans pokriva razliku, ukljucen, aktivacija prolazi, balans se
	 * umanjuje." Measured in DINARS, where a mistake about the currency would be large: he is expected
	 * to send 4.200, he sends 3.600, and the 600 he is short is what his book pays.
	 *
	 * <p><b>HIS BOOK HOLDS MORE THAN THE SHORTFALL, AND THAT IS THE CASE.</b> Two referrals is 1.200
	 * against a shortfall of 600, so „take the difference" answers 600 and „take the whole book"
	 * answers 1.200 - and an implementation that took `min(balance, fee)` rather than
	 * `min(balance, shortfall)` would answer 1.200 as well. Built with a book that was exactly the
	 * shortfall, all three would agree and the case would measure nothing.
	 *
	 * <p><b>AND A PROMISE STANDS BESIDE IT SAYING SOMETHING ELSE.</b> It promises 600 in EURO, a number
	 * this route cannot use at all: reading it would either take 600 euro off a dinar book or throw.
	 * That is the owner's decision of 27.09.2026 made measurable rather than described.
	 */
	@Test
	void lessArrivedAndTheBalanceCoversTheDifferenceSoTheDifferenceComesOff() throws Exception {
		long id = competitor("e3", null, false, "1990-05-15", A_TOWN_IN_SERBIA);
		long oneHeBroughtIn = competitor("e4", "004102", true, "1991-05-15");
		long anotherHeBroughtIn = competitor("e5", "004103", true, "1992-05-15");

		rewardFor(id, oneHeBroughtIn, "RSD");
		rewardFor(id, anotherHeBroughtIn, "RSD");
		promised(id, 2028, "600", "EUR");

		assertThat(bookOf(id, "RSD"))
				.as("the book is not larger than the shortfall, so taking the difference and taking"
						+ " everything cannot be told apart")
				.isEqualByComparingTo("1200.00");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("3600.00"), true, "ips", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(whatTheMembershipTook(id))
				.as("what came off the book is not the 600 he was short")
				.isEqualTo("-600.00 RSD 2028");
		assertThat(bookOf(id, "RSD"))
				.as("the rest of his book did not stay his")
				.isEqualByComparingTo("600.00");
	}

	/**
	 * CASE 3: THE BALANCE IS SPENT TO THE END AND THE REST IS ACCEPTED SHORT.
	 *
	 * <p>Owner, PDL 19, case 3, in his own words: „ako je ukucan neki iznos koji je manji od
	 * predvidjenog, ukljucen balans koji kad se iskoristi <b>potpuno</b> i dalje nije ukupan zbir
	 * jednak ocekivanog... zelim prompt Prihvatam umanjen ukupan iznos? Da / Ne." So the balance is
	 * spent to the end, and then the question is asked about what is left.
	 *
	 * <p><b>THE PROMPT ITSELF IS NOT ON THIS ROUTE AND THAT IS THE OWNER'S OTHER RULE.</b> „Odluka NE
	 * ni ovde niti u ostatku opisa funkcionalnosti ne brise red iz tabele za aktivaciju, samo odlaze
	 * odluku" - a refusal writes nothing, so it is not a request at all. A request reaching this route
	 * IS the yes, which is why the activation goes through here with money still owed.
	 *
	 * <p>He sends 1.000 of 4.200 and holds 600, so 3.200 is still owed after the book is emptied. The
	 * assertion is that the WHOLE book went and not the shortfall, which is the opposite direction from
	 * case 2 and is what makes the two cases a pair rather than one case twice.
	 */
	@Test
	void theBalanceIsSpentToTheEndAndTheRestIsAcceptedShort() throws Exception {
		long id = competitor("e6", null, false, "1990-05-15", A_TOWN_IN_SERBIA);
		long oneHeBroughtIn = competitor("e7", "004104", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn, "RSD");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("1000.00"), true, "ips", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(whatTheMembershipTook(id))
				.as("the whole book was not spent although the total is still short of the fee")
				.isEqualTo("-600.00 RSD 2028");
		assertThat(bookOf(id, "RSD")).isEqualByComparingTo("0.00");
	}

	/**
	 * CASE 3b: THE BOX IS CLEARED, SO NOTHING COMES OFF HOWEVER SHORT THE MONEY IS.
	 *
	 * <p>PDL 19, case 3b: „manji, <b>iskljucen</b>, isti prompt." This is the case the owner was shown
	 * as the FIRST cost of the shape that stood before: „Bez ove odluke odstikliravanje ne bi radilo
	 * nista." He holds a balance and a promise and is 3.200 short, so every road except the tick box
	 * would take something off him.
	 */
	@Test
	void theBoxClearedTakesNothingOffHoweverShortTheMoneyIs() throws Exception {
		long id = competitor("e8", null, false, "1990-05-15", A_TOWN_IN_SERBIA);
		long oneHeBroughtIn = competitor("e9", "004105", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn, "RSD");
		promised(id, 2028, "600", "RSD");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("1000.00"), false, "ips", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(whatTheMembershipTook(id))
				.as("clearing the box did nothing, which is the outcome the owner refused on"
						+ " 27.09.2026")
				.isEqualTo("nothing taken");
		assertThat(bookOf(id, "RSD")).isEqualByComparingTo("600.00");
	}

	/**
	 * AND A MEMBER NOBODY EVER MINTED A CODE FOR HAS HIS BALANCE TAKEN, WHICH IS THE COMMONEST CASE OF
	 * ALL AND THE ONE THE OLD SHAPE GOT WRONG.
	 *
	 * <p><b>This is the second cost the owner was shown before choosing (PDL 23a):</b> „covek kome
	 * niko nije otvorio ekran clanarine <b>nema nikakvo obecanje</b>. Da odlucuje obecanje, kucica bi
	 * bila stiklirana po podrazumevanju i u labeli bi stajao stvaran balans, a upisna ruta <b>ne bi
	 * skinula nista</b>. Ekran bi pokazivao jedno a radio drugo."
	 *
	 * <p><b>There is no {@code balance_promise} row anywhere in this case, and that is its whole
	 * point.</b> Under the shape that stood until this branch the answer here was „nothing taken",
	 * because an absent promise was read as nobody having been offered a discount. On the moderator's
	 * screen there is no discount to have been offered: there is a tick box with his balance printed in
	 * the label, and he ticked it.
	 */
	@Test
	void amemberNobodyEverMintedAcodeForStillHasHisBalanceTaken() throws Exception {
		long id = competitor("f1", null, false, "1990-05-15", A_TOWN_IN_SERBIA);
		long oneHeBroughtIn = competitor("f2", "004106", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn, "RSD");

		assertThat(db.sql("select count(*) from balance_promise where competitor_id = ?").param(id)
						.query(Long.class).single())
				.as("a promise stands, so this case cannot be about a member who has none")
				.isZero();

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("3600.00"), true, "ips", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(whatTheMembershipTook(id))
				.as("his balance was not taken because nobody had promised it to him, which is the"
						+ " shape the owner refused")
				.isEqualTo("-600.00 RSD 2028");
	}

	/**
	 * CASE 7: MORE ARRIVED THAN WAS EXPECTED, SO THE SURPLUS GOES ONTO HIS BOOK AS A CREDIT.
	 *
	 * <p>Owner, 27.09.2026 (PDL 19, case 7): „veci od ocekivanog, svejedno, aktivacija prolazi, visak
	 * ulazi u balans kao kredit." PDL records the reasoning behind the choice: „balans vec postoji kao
	 * mesto gde stoji clanov novac kod nas, pa se visak ne izmislja nigde drugde i clan ne gubi ono sto
	 * je poslao."
	 *
	 * <p><b>THE BOX IS CLEARED HERE, AND THAT IS AN ASSERTION AND NOT A SETTING.</b> The tick says
	 * whether his balance may PAY; a surplus is money he actually sent, and declining to record it
	 * because a box was cleared would be the association keeping it. So the credit has to appear with
	 * the box off, which is the one arrangement that tells the two apart.
	 *
	 * <p>He sends 5.000 of 4.200, so the credit is 800 - a number that is neither the fee nor the
	 * referral nor what he sent, so a line written from the wrong source shows up as a different number
	 * rather than as a coincidence.
	 */
	@Test
	void moreArrivedThanWasExpectedSoTheSurplusIsCreditedEvenWithTheBoxCleared() throws Exception {
		long id = competitor("f3", null, false, "1990-05-15", A_TOWN_IN_SERBIA);

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("5000.00"), false, "ips", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(whatWasCredited(id))
				.as("the surplus he sent was kept by the association instead of going onto his book")
				.isEqualTo("800.00 RSD 2028");
		assertThat(bookOf(id, "RSD")).isEqualByComparingTo("800.00");

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(),
				PaymentApi.Confirmed.class);

		assertThat(body.creditedToTheBalance().amount()).isEqualByComparingTo("800.00");
		assertThat(body.received()).isEqualByComparingTo("5000.00");
	}

	/**
	 * AND THE SURPLUS IS MEASURED AGAINST THE EXPECTED TOTAL, FEE INCLUDED, WHICH IS THE OWNER'S OWN
	 * DEFINITION.
	 *
	 * <p>PDL 19, closed question 1: „„Ocekivan iznos" je ono sto clan SALJE, dakle sa uracunatom
	 * taksom. Za clana iz inostranstva sa clanarinom 40 i taksom 3, labela kaze 43." In the early
	 * period that is 35 and 3, so a euro member who sends 40 has sent 2 too much and not 5.
	 *
	 * <p><b>This is the one case that can tell the fee apart from the membership</b>, because for a
	 * member in Serbia the fee is nought and the two numbers are the same. So it is deliberately a
	 * EURO member: a route measuring the surplus against the membership alone would credit him 5.
	 */
	@Test
	void thesurplusIsMeasuredAgainstTheExpectedTotalAndThereforeAgainstTheFee() throws Exception {
		long id = competitor("f4", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("40.00"), false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(whatWasCredited(id))
				.as("the surplus was measured against the membership alone, so the processing fee was"
						+ " credited back to him as though he had not been charged it")
				.isEqualTo("2.00 EUR 2028");
	}

	/**
	 * AND THE SHORTFALL IS MEASURED AGAINST THE SAME TOTAL, which is the other half of one rule.
	 *
	 * <p>A euro member expected to send 38 who sends 35 is 3 short - the processing fee - and his
	 * balance covers it. <b>This narrows a sentence a previous author of {@code Balance} wrote as his
	 * own reasoning</b>, „the fee never comes off the balance", and it narrows it for a stated reason:
	 * that sentence was marked „REASONING RATHER THAN A DECISION", while the owner's definition of the
	 * expected amount is explicit and dated and case 2 says the balance covers „razliku" from it.
	 *
	 * <p><b>Reported here rather than left in a comment</b>, because it is the one place this branch
	 * overrides something the portal already said about money.
	 */
	@Test
	void theshortfallIsMeasuredAgainstTheSameTotalSoAbalanceMayPayAprocessingFee() throws Exception {
		long id = competitor("f5", null, false, "1990-05-15");
		long oneHeBroughtIn = competitor("f6", "004107", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn, "EUR");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("35.00"), true, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(whatTheMembershipTook(id))
				.as("the shortfall was measured against the membership alone, so a member who sent"
						+ " exactly the membership was treated as owing nothing")
				.isEqualTo("-3.00 EUR 2028");
		assertThat(bookOf(id, "EUR")).isEqualByComparingTo("2.00");
	}

	/**
	 * AND THE PAYMENT ROW CARRIES BOTH NUMBERS: WHAT WAS CHARGED AND WHAT ARRIVED.
	 *
	 * <p>V16 writes „What was ASKED and in what money" beside {@code amount}, and {@code PaymentApi}
	 * gives the whole reason the reduced figure must not go there: „the books would show a membership
	 * sold for less than the price list says it costs, and there would be nowhere to see that the
	 * association settled part of it out of what it already owed the member." V42 added
	 * {@code received} so that the owner's specification could be recorded without that becoming false.
	 *
	 * <p><b>The two are different numbers here, which is the only way this case can say anything.</b>
	 * 4.200 charged, 3.600 arrived, 600 off the book - three numbers, and each is asserted where it
	 * belongs.
	 */
	@Test
	void thepaymentRowCarriesBothWhatWasChargedAndWhatArrived() throws Exception {
		long id = competitor("f7", null, false, "1990-05-15", A_TOWN_IN_SERBIA);
		long oneHeBroughtIn = competitor("f8", "004108", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn, "RSD");

		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("3600.00"), true, "ips", null)), moderatorCookie);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(),
				PaymentApi.Confirmed.class);

		assertThat(body.amount())
				.as("the fee was reduced on the receipt, so the books no longer say what a membership"
						+ " costs")
				.isEqualByComparingTo("4200.00");
		assertThat(body.received()).isEqualByComparingTo("3600.00");
		assertThat(body.currency()).isEqualTo("RSD");
		assertThat(body.fromTheBalance().amount()).isEqualByComparingTo("600.00");

		record Row(BigDecimal amount, BigDecimal received, String currency) {
		}

		Row row = db.sql("select amount, received, currency from payment where id = ?")
				.param(body.paymentId())
				.query((one, i) -> new Row(one.getBigDecimal(1), one.getBigDecimal(2), one.getString(3)))
				.single();

		assertThat(row.amount()).isEqualByComparingTo("4200.00");
		assertThat(row.received()).isEqualByComparingTo("3600.00");
		assertThat(row.currency())
				.as("the currency on the row is not the one his country decides")
				.isEqualTo("RSD");
	}

	/**
	 * AND TWO CONFIRMATIONS OF ONE SEASON TAKE THE BALANCE ONCE, WHICH IS WHAT NARROWS THE OPEN
	 * BOUNDARY.
	 *
	 * <p>PDL 26.09.2026 leaves open that „dva koda kovana istog dana obecavaju isti novac dvaput".
	 * This case DESCRIBES what the schema already does about it rather than adding a guard: the second
	 * confirmation of the same season writes nothing at all, because {@code payment_one_a_season}
	 * allows one payment and the season comes from the day the money is booked. So the balance is taken
	 * once however many times the row is clicked, and what is left open needs two SEASONS and the
	 * 1 October turn.
	 *
	 * <p>And the second answer says what the first one did, read back out of the book rather than
	 * recomputed: today's balance is 600 because this very spend took the other 600, so a route that
	 * worked the number out again would report a different figure from the one he was actually given.
	 */
	@Test
	void twoConfirmationsOfOneSeasonTakeTheBalanceOnce() throws Exception {
		long id = competitor("ba", null, false, "1990-05-15", A_TOWN_IN_SERBIA);
		long oneHeBroughtIn = competitor("bb", "004109", true, "1991-05-15");
		long anotherHeBroughtIn = competitor("bc", "004110", true, "1992-05-15");

		rewardFor(id, oneHeBroughtIn, "RSD");
		rewardFor(id, anotherHeBroughtIn, "RSD");

		PaymentApi.Confirm typed = new PaymentApi.Confirm(id, new BigDecimal("3600.00"), true, "ips",
				null);

		assertThat(confirm(json(typed), moderatorCookie).getStatus()).isEqualTo(201);

		MockHttpServletResponse again = confirm(json(typed), moderatorCookie);

		assertThat(again.getStatus()).isEqualTo(200);

		assertThat(db.sql("select count(*) from balance_entry where competitor_id = ? and reason ="
						+ " 'membership'").param(id).query(Long.class).single())
				.as("the balance was taken twice for one season")
				.isOne();

		assertThat(bookOf(id, "RSD")).isEqualByComparingTo("600.00");

		PaymentApi.Confirmed body = mapper.readValue(again.getContentAsString(),
				PaymentApi.Confirmed.class);

		assertThat(body.fromTheBalance().amount()).isEqualByComparingTo("600.00");
		assertThat(body.fromTheBalance().currency())
				.as("the repeat answered in the money he is billed in rather than the money the line"
						+ " was written in")
				.isEqualTo(com.btl.portal.domain.pricing.Currency.RSD);
		assertThat(body.received()).isEqualByComparingTo("3600.00");
	}

	/**
	 * AND A REWARD OF NOTHING PAYS NOBODY, WITHOUT THE ROUTE FALLING OVER.
	 *
	 * <p><b>The half of the same fault that is worse than the migration's.</b> V4 lets a price row be
	 * ZERO and {@code PUT /api/pricing/{key}} has no lower bound, while
	 * {@code balance_entry_a_referral_adds} (V42) demands strictly more - so without the condition this
	 * route would answer <b>500 for every member anybody brought in</b>, from the moment an
	 * administrator sets the referral to nought through his own screen. A migration fails once and says
	 * so in a log; this fails per person and quietly.
	 *
	 * <p>The referrer is here and really did bring him in, so the case is about the AMOUNT and not
	 * about there being nobody to pay: with the reward left alone this same fixture pays him 600.
	 */
	@Test
	void arewardOfNothingPaysNobodyAndTheRouteStillAnswers() throws Exception {
		long referrer = competitor("d5", "004008", true, "1980-05-15", A_TOWN_IN_SERBIA);
		long newcomer = competitor("d6", null, false, "1990-05-15", A_TOWN_IN_SERBIA);

		db.sql("update competitor set referred_by = ? where id = ?").params(referrer, newcomer).update();
		db.sql("update price_row set eur = 0, rsd = 0 where key = 'referral'").update();

		assertThat(confirm(json(new PaymentApi.Confirm(newcomer, WHAT_A_SERBIAN_MEMBER_SENDS, false,
						"ips", null)), moderatorCookie).getStatus())
				.as("the route fell over on a reward the price list says is worth nothing")
				.isEqualTo(201);

		assertThat(bookOf(referrer, "RSD"))
				.as("a line was written for a reward worth nothing")
				.isEqualByComparingTo("0");
	}

	/**
	 * AND WHOEVER BROUGHT THE PAYER IN IS PAID, ONCE, HOWEVER MANY SEASONS HE GOES ON TO PAY FOR.
	 *
	 * <p>PDL: „Iznos leže na balans automatski, u trenutku kad se novom članu aktivira članarina, ne u
	 * trenutku registracije", and „Svaki član koji se registruje preko tog linka donosi preporučiocu
	 * 600 RSD" - one member, one reward. What holds the second half is
	 * {@code balance_entry_one_a_referral} (V38) rather than a question this route asks.
	 */
	@Test
	void whoeverBroughtThePayerInIsPaidOnce() throws Exception {
		long referrer = competitor("d3", "004007", true, "1980-05-15", A_TOWN_IN_SERBIA);
		long newcomer = competitor("d4", null, false, "1990-05-15", A_TOWN_IN_SERBIA);

		db.sql("update competitor set referred_by = ? where id = ?").params(referrer, newcomer).update();

		assertThat(confirm(json(new PaymentApi.Confirm(newcomer, WHAT_A_SERBIAN_MEMBER_SENDS, false,
				"ips", null)), moderatorCookie).getStatus()).isEqualTo(201);

		assertThat(bookOf(referrer, "RSD"))
				.as("the man who brought him in was not paid when the membership was activated")
				.isEqualByComparingTo("600");

		/* HIS SECOND SEASON EARNS NOBODY A SECOND REWARD. Confirming again for the same season is
		   ALREADY_RECORDED and writes nothing, so what he already holds is moved out of the way
		   instead: that is the only road this fixture has to a SECOND activation of one person.
		   The membership goes first, because `membership_payment_fk` names the receipt together
		   with whose it is and for which season - measured, not guessed: moving the payment first
		   is refused by that key. */
		db.sql("delete from membership where competitor_id = ?").param(newcomer).update();
		db.sql("update payment set season = 2029 where competitor_id = ?").param(newcomer).update();

		assertThat(confirm(json(new PaymentApi.Confirm(newcomer, WHAT_A_SERBIAN_MEMBER_SENDS, false,
				"ips", null)), moderatorCookie).getStatus()).isEqualTo(201);

		assertThat(bookOf(referrer, "RSD"))
				.as("one member brought in earned two rewards")
				.isEqualByComparingTo("600");
	}

	/**
	 * AND THE REWARD IS IN THE REFERRER'S MONEY, NEVER THE NEWCOMER'S.
	 *
	 * <p><b>This is the one question one amount made possible to get wrong, and under the pair it did
	 * not exist.</b> A line used to carry both numbers and whoever read it took the column he needed;
	 * now it has to choose, and the man whose balance it is is the REFERRER. A Serbian member who
	 * brings in a friend abroad earns 600 dinars and not 5 euro, because dinars are what his own
	 * membership will be paid in - a line in the newcomer's money would sit on his book where his own
	 * balance would never see it.
	 *
	 * <p><b>The two live in different countries on purpose</b>, which is the only arrangement that can
	 * tell the two sources apart: with both in Serbia the newcomer's money and the referrer's are the
	 * same and the assertion would hold either way. And the AMOUNT is asserted as well as the currency,
	 * because 5 and 600 are the two columns of one row - a line taking the right currency off the wrong
	 * column would read as 5 RSD.
	 */
	@Test
	void therewardIsInTheReferrersMoneyAndNotTheNewcomers() throws Exception {
		long referrer = competitor("bd", "004111", true, "1980-05-15", A_TOWN_IN_SERBIA);
		long newcomer = competitor("be", null, false, "1990-05-15", A_TOWN);

		db.sql("update competitor set referred_by = ? where id = ?").params(referrer, newcomer).update();

		assertThat(confirm(json(new PaymentApi.Confirm(newcomer, WHAT_A_EURO_MEMBER_SENDS, false,
				"paypal", null)), moderatorCookie).getStatus()).isEqualTo(201);

		assertThat(db.sql("select amount || ' ' || currency from balance_entry"
						+ " where competitor_id = ? and reason = 'referral'")
						.param(referrer).query(String.class).single())
				.as("the referrer was paid in the money the NEWCOMER is billed in, so the line sits on"
						+ " his book where his own balance will never see it")
				.isEqualTo("600.00 RSD");

		assertThat(bookOf(referrer, "EUR"))
				.as("a line in euro was written onto a book that is kept in dinars")
				.isEqualByComparingTo("0");
	}

	/**
	 * HOW MANY MEMBER NUMBERS HAVE EVER BEEN HANDED OUT, ASKED ON A CONNECTION OF ITS OWN.
	 *
	 * <p><b>A connection of its own is the whole point and not a detail.</b> {@code nextval} is
	 * outside the transaction by design - V16 chose a sequence exactly so that it survives a deleted
	 * row - which is also why a draw inside a transaction that goes back is spent for good. A case
	 * that wants to know whether a REFUSED booking spent one therefore has to ask from outside the
	 * transaction this class rolls back, and after a booking the database refused there is no asking
	 * on the inside at all: PostgreSQL will take nothing further on a connection whose statement has
	 * failed.
	 *
	 * <p>{@code is_called} is what tells a sequence nobody has drawn from (which reports
	 * {@code last_value = 1}) apart from one drawn from once (which reports the same number), so it
	 * is read rather than assumed.
	 */
	private long numbersHandedOutSoFar() throws Exception {
		try (java.sql.Connection outsideThisTransaction = dataSource.getConnection();
				java.sql.Statement asking = outsideThisTransaction.createStatement();
				java.sql.ResultSet answer = asking.executeQuery(
						"select last_value, is_called from member_number_seq")) {

			answer.next();

			return answer.getBoolean(2) ? answer.getLong(1) : 0L;
		}
	}

	/**
	 * A MEMBERSHIP THE PRICE LIST GIVES AWAY IS REFUSED WITH A SENTENCE, AND THE COLUMN IS NEVER
	 * REACHED.
	 *
	 * <p><b>Both halves of this are decided and the collision between them was live.</b> PDL 20b
	 * (owner, 27.09.2026) lets a row of the price list be free so long as it is free in BOTH
	 * currencies, and {@code PricingWriteApiTest} has the case that measures {@code PUT
	 * /api/pricing/{key}} answering 200 to exactly that. {@code payment_amount_positive} (V16) is
	 * {@code check (amount > 0)} and is in an applied migration, so ADL A2 leaves it where it is.
	 * Between the two, {@code recordIt} used to write {@code amount = 0.00} and come back <b>ERROR:
	 * new row for relation „payment" violates check constraint „payment_amount_positive"</b> - a 500
	 * on a moderator entering a bank statement.
	 *
	 * <p><b>THE PERIOD ROW AND THE JUNIOR ROW ARE TWO SOURCES OF ONE AMOUNT, so both are set to
	 * nought in turn and never together.</b> {@code MembershipPrice.on} replaces whichever period
	 * the day falls in with the junior row for anybody young enough, so a guard reading the PERIOD
	 * would let a free junior price through and meet the constraint anyway - and a case that made
	 * only one row free could not tell the two apart. The clock is 3 October, so {@code early} is
	 * the period either man falls in; the man born in 2015 is fifteen in the 2028 season this books
	 * and takes the junior price ({@code OLDEST_JUNIOR_IN_A_SEASON}), and the man born in 1990 does
	 * not.
	 *
	 * <p><b>And the sequence is read before and after</b>, because a refusal that had already drawn
	 * a number would have spent it for good and nothing else in this file would say so: the
	 * competitor's own {@code member_number} column is empty either way once the transaction has
	 * gone back.
	 */
	@ParameterizedTest
	@CsvSource({"early,1990-05-15", "junior,2015-05-15"})
	void amembershipThePriceListGivesAwayIsRefusedRatherThanMeetingTheColumn(String free,
			String birthDate) throws Exception {

		long drawnBefore = numbersHandedOutSoFar();

		db.sql("update price_row set eur = 0, rsd = 0 where key = ?").param(free).update();

		long id = competitor("bf", null, false, birthDate);

		/* THREE EURO IS THE PROCESSING FEE AND IS WHAT THE SCREEN WOULD BE ASKING FOR: V4 gives the
		   fee its own row, `MembershipPrice.on` reads it from there and never from the period, so a
		   free membership abroad is still a payment of 3 the moderator can plainly see arrive. The
		   amount is therefore money by every question this route asks of it, and what refuses the
		   booking is the price list alone. */
		MockHttpServletResponse answer = confirm(json(new PaymentApi.Confirm(id,
				new BigDecimal("3.00"), false, "paypal", null)), moderatorCookie);

		assertThat(answer.getStatus())
				.as("a membership priced at nought on the %s row reached the database, which is a 500"
						+ " where a moderator should have been told something", free)
				.isEqualTo(409);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_MEMBERSHIP_COSTS_NOTHING);

		assertThat(paymentCount()).isZero();
		assertThat(membershipCount()).isZero();
		assertThat(db.sql("select member_number, active from competitor where id = ?").param(id)
						.query((row, i) -> row.getString(1) + " " + row.getBoolean(2)).single())
				.as("a refused booking numbered or activated the competitor anyway")
				.isEqualTo("null false");

		assertThat(numbersHandedOutSoFar())
				.as("a member number was drawn for a booking that was refused, and the sequence only"
						+ " counts up, so that number is gone for good (PDL 31.07.2026)")
				.isEqualTo(drawnBefore);
	}

	/**
	 * AND A BOOKING THE DATABASE ITSELF REFUSES SPENDS NO MEMBER NUMBER EITHER, WHICH IS THE HALF NO
	 * SENTENCE ON THIS ROUTE CAN COVER.
	 *
	 * <p><b>The state is the one this class's own javadoc names as deliberately unguarded:</b> a
	 * {@code payment} row sitting {@code awaited} for this (competitor, season) with no
	 * {@code membership} beside it „is read exactly like no row at all and then {@code insert}ed as
	 * though it were one, which collides with {@code payment_one_a_season} and answers 500 rather
	 * than completing it". That 500 is unchanged and this case does not pretend otherwise - it
	 * asserts the booking really was refused by the DATABASE, which is what makes the question below
	 * worth asking at all.
	 *
	 * <p><b>What changed on 28.09.2026 is what it costs.</b> The number used to be drawn before the
	 * two inserts, so every one of these 500s ate one out of {@code member_number_seq}, which does
	 * not go back when a transaction does - and the owner's rule is „Clanski broj se nikad ne
	 * dodeljuje dvaput" (PDL 31.07.2026). The draw is now the last thing {@code recordIt} does.
	 *
	 * <p><b>This is the case that measures the MOVE and not the sentence, and they are two different
	 * things.</b> {@link #amembershipThePriceListGivesAwayIsRefusedRatherThanMeetingTheColumn} would
	 * go on passing with the draw put back where it was, because that refusal returns before
	 * anything is written at all. Only a booking that gets as far as the {@code insert} can say
	 * where the draw now sits, and this is the one state that reaches it without needing two
	 * requests at the same instant.
	 *
	 * <p><b>The membership row is deliberately NOT written beside the awaited payment</b>, which is
	 * what separates this from {@code aSeasonHeldOnAPaymentNotYetRecognisedIsRefusedToo}: with one
	 * there, {@code theSeasonIsAlreadyHeld} answers 409 and the {@code insert} is never reached, so
	 * the case would measure the guard instead of the sequence.
	 *
	 * <p><b>AND A BOOKING THAT SUCCEEDS COMES FIRST, WHICH IS THE ONLY THING STANDING BETWEEN THIS
	 * CASE AND A TAUTOLOGY.</b> „The counter did not move" is satisfied by a counter that never
	 * moves at all, and {@link #numbersHandedOutSoFar} reads a sequence through {@code is_called} -
	 * one wrong branch there and it answers nought for ever, leaving this case and the free-price
	 * one above both green having measured nothing. So a number is handed out on somebody else
	 * first and the counter is required to have gone up by exactly one. That is the JOIN between the
	 * two halves this case rests on, and it is asserted rather than assumed.
	 */
	@Test
	void abookingTheDatabaseRefusesSpendsNoMemberNumber() throws Exception {
		long drawnAtTheStart = numbersHandedOutSoFar();

		long paid = competitor("c1", null, false, "1990-05-15");

		assertThat(confirm(json(new PaymentApi.Confirm(paid, WHAT_A_EURO_MEMBER_SENDS, false,
				"paypal", null)), moderatorCookie).getStatus()).isEqualTo(201);

		assertThat(numbersHandedOutSoFar())
				.as("the counter this case turns on did not move for a booking that DID hand a"
						+ " number out, so it would report that nothing was spent whatever"
						+ " happened below")
				.isEqualTo(drawnAtTheStart + 1);

		long drawnBefore = numbersHandedOutSoFar();

		long id = competitor("c0", null, false, "1990-05-15");

		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount,"
						+ " currency, fee, method, state) values"
						+ " (?, 2028, '20280099', (select id from price_row where key = 'early'),"
						+ " 35.00, 'EUR', 3.00, 'paypal', 'awaited')")
				.param(id).update();

		assertThatThrownBy(() -> confirm(json(new PaymentApi.Confirm(id, WHAT_A_EURO_MEMBER_SENDS,
						false, "paypal", null)), moderatorCookie))
				.as("the booking was completed, so this case no longer reaches the insert it is about"
						+ " and says nothing about where the number is drawn")
				.rootCause()
				.hasMessageContaining("payment_one_a_season");

		assertThat(numbersHandedOutSoFar())
				.as("a member number was drawn before the insert that refused this booking, so the"
						+ " transaction went back and took nothing with it except that number, which"
						+ " the sequence never gives again (PDL 31.07.2026)")
				.isEqualTo(drawnBefore);
	}
}

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

	private static final String A_TOWN = "(select id from place where rank = 1)";

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
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Takmicar',"
						+ " 'M', ?, " + A_TOWN + ", null, null, 2027, false, ?, 'payment',"
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
				new PaymentApi.Confirm(id, "EUR", "card", null)), moderatorCookie);

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
		long id = competitor("a2", "005005", false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "RSD", "slip", "20280055")), moderatorCookie);

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
				new PaymentApi.Confirm(id, "EUR", "paypal", null)), moderatorCookie);

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
		PaymentApi.Confirm typed = new PaymentApi.Confirm(id, "EUR", "card", null);

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
		long id = competitor("b1", "005010", false, "1990-05-15");
		PaymentApi.Confirm typed = new PaymentApi.Confirm(id, "RSD", "slip", "20280051");

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
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name) values"
						+ " (?, 2028, '20280070', (select id from price_row where key = 'early'),"
						+ " 35.00, 'EUR', 3.00, 'card', 'reversed', timestamptz '2027-10-02 09:00:00+00',"
						+ " null, 'Blagajnik Probni')")
				.param(id).update();

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "EUR", "card", null)), moderatorCookie);

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
				new PaymentApi.Confirm(id, "EUR", "card", null)), moderatorCookie);

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
				new PaymentApi.Confirm(other, "EUR", "card", null)), moderatorCookie);

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
						+ " 35.00, 'EUR', 3.00, 'card', 'awaited') returning id")
				.param(id).query(Long.class).single();

		db.sql("insert into membership (competitor_id, season, basis, payment_id)"
						+ " values (?, 2028, 'payment', ?)")
				.params(id, awaited).update();

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "EUR", "card", null)), moderatorCookie);

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
				new PaymentApi.Confirm(id, "EUR", "card", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
	}

	@Test
	void theFormMustNameACompetitor() throws Exception {
		MockHttpServletResponse answer = confirm(
				"{\"season\":2028,\"currency\":\"EUR\",\"method\":\"card\"}", moderatorCookie);

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

		MockHttpServletResponse answer = confirm(
				"{\"competitorId\":" + id + ",\"season\":2027,\"currency\":\"EUR\","
						+ "\"method\":\"card\"}", moderatorCookie);

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

	/** An empty string and a missing key are the same "nothing", so this covers that branch. */
	@Test
	void aBlankCurrencyIsNotAFilledInForm() throws Exception {
		long id = competitor("a8", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(
				"{\"competitorId\":" + id + ",\"season\":2028,\"currency\":\"\",\"method\":\"card\"}",
				moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_FORM_IS_NOT_COMPLETE);
	}

	@Test
	void theMethodMustBeFilledIn() throws Exception {
		long id = competitor("a9", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(
				"{\"competitorId\":" + id + ",\"season\":2028,\"currency\":\"EUR\"}", moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_FORM_IS_NOT_COMPLETE);
	}

	@Test
	void theCurrencyMustBeOneOfTheTwo() throws Exception {
		long id = competitor("ab", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "USD", "card", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_CURRENCY_IS_NOT_KNOWN);
	}

	@Test
	void theMethodMustBeOneOfTheFour() throws Exception {
		long id = competitor("ac", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "EUR", "bitcoin", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_METHOD_IS_NOT_KNOWN);
	}

	@Test
	void aReferenceMustBeShapedLikeOne() throws Exception {
		long id = competitor("ad", null, false, "1990-05-15");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "EUR", "card", "2028-070")), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_REFERENCE_IS_NOT_SHAPED);
	}

	@Test
	void aReferenceAlreadyUsedIsRefused() throws Exception {
		long first = competitor("ae", "009009", false, "1990-05-15");
		long second = competitor("af", null, false, "1990-05-15");

		confirm(json(new PaymentApi.Confirm(first, "EUR", "card", "20280090")), moderatorCookie);

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(second, "EUR", "card", "20280090")), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(mapper.readValue(answer.getContentAsString(), PaymentApi.Refused.class).reason())
				.isEqualTo(PaymentApi.THE_REFERENCE_IS_TAKEN);
	}

	@Test
	void theCompetitorMustExist() throws Exception {
		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(999999L, "EUR", "card", null)), moderatorCookie);

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
				new PaymentApi.Confirm(id, "EUR", "card", null)), noRightsCookie);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(paymentCount()).isZero();
	}

	/* ------------------------------------------------------------------------------------------
	 * AND SINCE 26.09.2026, WHAT THE BOOK OF BALANCE DOES WHEN THE MONEY LANDS
	 * --------------------------------------------------------------------------------------- */

	/** One line in the book: what V4's referral row is worth, for one member brought in. */
	private void rewardFor(long referrer, long broughtIn) {
		db.sql("insert into balance_entry (competitor_id, eur, rsd, reason, referred_competitor_id,"
						+ " occurred_at, recorded_by, recorded_by_name)"
						+ " select ?, reward.eur, reward.rsd, 'referral', ?, ?,"
						+ " (select id from account where email = ?), 'Blagajnik Probni'"
						+ " from (select eur, rsd from price_row where key = 'referral') reward")
				.params(referrer, broughtIn, Timestamp.from(NOW.minus(Duration.ofDays(30))), MODERATOR)
				.update();
	}

	/** What a code shown to him said his balance would cover. */
	private void promised(long competitor, int season, String eur, String rsd) {
		db.sql("insert into balance_promise (competitor_id, season, eur, rsd, promised_at)"
						+ " values (?, ?, ?::numeric, ?::numeric, ?)")
				.params(competitor, season, eur, rsd, Timestamp.from(NOW.minus(Duration.ofDays(1))))
				.update();
	}

	private BigDecimal bookOf(long competitor) {
		return db.sql("select coalesce(sum(rsd), 0) from balance_entry where competitor_id = ?")
				.param(competitor).query(BigDecimal.class).single();
	}

	private String whatTheMembershipTook(long competitor) {
		return db.sql("select coalesce((select eur || ' ' || rsd || ' ' || season from balance_entry"
						+ " where competitor_id = ? and reason = 'membership'), 'nothing taken')")
				.param(competitor).query(String.class).single();
	}

	/**
	 * WHAT IS TAKEN OFF THE BOOK IS WHAT THE CODE PROMISED, NOT WHAT THE BALANCE STANDS AT TODAY.
	 *
	 * <p><b>Owner, 27.09.2026, on his own numbers:</b> a code minted for 3.600 against a balance of
	 * 600, a seventh referral activated before the money lands so the balance is 1.200, and then the
	 * 3.600 arrives. <b>600 comes off and 600 stays.</b> He refused taking today's balance, with the
	 * cost stated: the association's liability would fall by twice the discount it gave.
	 *
	 * <p><b>THE PROMISE AND THE BALANCE ARE TWO DIFFERENT NUMBERS HERE AND THAT IS THE CASE.</b>
	 * The book holds two rewards and the promise names one, so "take the promise" answers 600 and
	 * "take today's balance" answers 1.200. Built with a balance that had not moved, the two would
	 * answer alike and this would measure nothing.
	 */
	@Test
	void whatIsTakenOffTheBookIsWhatWasPromisedAndNotTodaysBalance() throws Exception {
		long id = competitor("c1", null, false, "1990-05-15");
		long oneHeBroughtIn = competitor("c2", "004001", true, "1991-05-15");
		long anotherHeBroughtIn = competitor("c3", "004002", true, "1992-05-15");

		rewardFor(id, oneHeBroughtIn);
		promised(id, 2028, "5", "600");
		rewardFor(id, anotherHeBroughtIn);

		assertThat(bookOf(id))
				.as("the fixture has no balance that grew, so the two readings agree and the case"
						+ " cannot tell them apart")
				.isEqualByComparingTo("1200");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "RSD", "slip", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);

		assertThat(whatTheMembershipTook(id))
				.as("today's balance was taken instead of the promise, so the association gave away"
						+ " twice the discount it offered")
				.isEqualTo("-5.00 -600.00 2028");

		assertThat(bookOf(id))
				.as("what was promised came off and the rest is his for next year")
				.isEqualByComparingTo("600.00");
	}

	/**
	 * AND THE PAYMENT ROW STILL CARRIES THE WHOLE FEE, because that is what he was CHARGED.
	 *
	 * <p>ADL says an amount comes off the price list. What the balance discharged is its own line in
	 * the book, and the cash that arrived is the difference between the two. Written the other way
	 * round the books would show a membership sold for less than the price list says it costs, with
	 * nowhere to see that the association settled part of it out of what it already owed him.
	 */
	@Test
	void thePaymentStillCarriesTheWholeFeeAndTheBookCarriesTheDiscount() throws Exception {
		long id = competitor("c4", null, false, "1990-05-15");
		long oneHeBroughtIn = competitor("c5", "004003", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn);
		promised(id, 2028, "5", "600");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "RSD", "slip", null)), moderatorCookie);

		PaymentApi.Confirmed body = mapper.readValue(answer.getContentAsString(),
				PaymentApi.Confirmed.class);

		assertThat(body.amount())
				.as("the fee was reduced on the receipt, so the books no longer say what a membership"
						+ " costs")
				.isEqualByComparingTo("4200.00");
		assertThat(body.fromTheBalance().rsd()).isEqualByComparingTo("600");

		assertThat(db.sql("select amount from payment where id = ?").param(body.paymentId())
						.query(BigDecimal.class).single())
				.isEqualByComparingTo("4200.00");
	}

	/**
	 * A MEMBER NOBODY EVER SHOWED A REDUCED INVOICE TO KEEPS HIS WHOLE BALANCE.
	 *
	 * <p><b>An absent promise is not a promise of nothing</b>, it is nobody having been offered a
	 * discount: he was shown the price list's own figure and paid it. He holds a balance here, which
	 * is what makes the case say something - a route reading the book instead of the promise would
	 * take 600 off a man who paid in full.
	 */
	@Test
	void amemberWhoWasNeverPromisedAnythingKeepsHisWholeBalance() throws Exception {
		long id = competitor("c6", null, false, "1990-05-15");
		long oneHeBroughtIn = competitor("c7", "004004", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn);

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "RSD", "slip", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(whatTheMembershipTook(id))
				.as("a balance was spent for a member who was never offered it off his invoice")
				.isEqualTo("nothing taken");
		assertThat(bookOf(id)).isEqualByComparingTo("600");
	}

	/**
	 * AND A PROMISE IS HONOURED ONLY AS FAR AS THERE IS MONEY, which is the boundary that needs two
	 * seasons rather than two codes.
	 *
	 * <p>Minting spends nothing, so a code for one season and a code for another can both stand and
	 * the one booked second can find the money gone. Honouring the promise regardless would drive
	 * the book below zero, which is the association recording that it paid out more than it owed.
	 */
	@Test
	void apromiseIsHonouredOnlyAsFarAsTheBookGoes() throws Exception {
		long id = competitor("c8", null, false, "1990-05-15");
		long oneHeBroughtIn = competitor("c9", "004005", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn);
		promised(id, 2028, "35", "4200");

		MockHttpServletResponse answer = confirm(json(
				new PaymentApi.Confirm(id, "RSD", "slip", null)), moderatorCookie);

		assertThat(answer.getStatus()).isEqualTo(201);
		assertThat(whatTheMembershipTook(id))
				.as("a promise larger than the book was honoured in full, so the book went negative")
				.isEqualTo("-5.00 -600.00 2028");
		assertThat(bookOf(id)).isEqualByComparingTo("0.00");
	}

	/**
	 * AND TWO CODES FOR ONE SEASON TAKE THE BALANCE ONCE, WHICH IS WHAT NARROWS THE OPEN BOUNDARY.
	 *
	 * <p>PDL 26.09.2026 leaves open that "dva koda kovana istog dana obecavaju isti novac dvaput".
	 * This case DESCRIBES what the schema already does about it rather than adding a guard: the
	 * second confirmation of the same season writes nothing at all, because
	 * {@code payment_one_a_season} allows one payment and the season comes from the day the money is
	 * booked. So the balance is taken once however many codes were minted, and what is left open
	 * needs two SEASONS and the 1 October turn.
	 */
	@Test
	void twoCodesForOneSeasonTakeTheBalanceOnce() throws Exception {
		long id = competitor("d1", null, false, "1990-05-15");
		long oneHeBroughtIn = competitor("d2", "004006", true, "1991-05-15");

		rewardFor(id, oneHeBroughtIn);
		promised(id, 2028, "5", "600");

		assertThat(confirm(json(new PaymentApi.Confirm(id, "RSD", "slip", null)), moderatorCookie)
				.getStatus()).isEqualTo(201);

		MockHttpServletResponse again = confirm(json(
				new PaymentApi.Confirm(id, "RSD", "slip", null)), moderatorCookie);

		assertThat(again.getStatus()).isEqualTo(200);

		assertThat(db.sql("select count(*) from balance_entry where competitor_id = ? and reason ="
						+ " 'membership'").param(id).query(Long.class).single())
				.as("the balance was taken twice for one season")
				.isOne();

		assertThat(bookOf(id)).isEqualByComparingTo("0.00");

		/* AND THE SECOND ANSWER SAYS WHAT THE FIRST ONE DID, read back out of the book rather than
		   recomputed: today's balance is zero because this very spend emptied it, so a route that
		   worked the number out again would report nothing where 600 was actually given. */
		assertThat(mapper.readValue(again.getContentAsString(), PaymentApi.Confirmed.class)
						.fromTheBalance().rsd())
				.isEqualByComparingTo("600.00");
	}

	/**
	 * AND A REWARD OF NOTHING PAYS NOBODY, WITHOUT THE ROUTE FALLING OVER.
	 *
	 * <p><b>The half of the same fault that is worse than the migration's.</b> V4 lets a price row be
	 * ZERO and `PUT /api/pricing/{key}` has no lower bound, while `balance_entry_a_referral_adds`
	 * (V36) demands strictly more - so without the condition this route would answer <b>500 for every
	 * member anybody brought in</b>, from the moment an administrator sets the referral to nought
	 * through his own screen. A migration fails once and says so in a log; this fails per person and
	 * quietly.
	 *
	 * <p>The referrer is here and really did bring him in, so the case is about the AMOUNT and not
	 * about there being nobody to pay: with the reward left alone this same fixture pays him 600.
	 */
	@Test
	void arewardOfNothingPaysNobodyAndTheRouteStillAnswers() throws Exception {
		long referrer = competitor("d5", "004008", true, "1980-05-15");
		long newcomer = competitor("d6", null, false, "1990-05-15");

		db.sql("update competitor set referred_by = ? where id = ?").params(referrer, newcomer).update();
		db.sql("update price_row set eur = 0, rsd = 0 where key = 'referral'").update();

		assertThat(confirm(json(new PaymentApi.Confirm(newcomer, "RSD", "slip", null)), moderatorCookie)
						.getStatus())
				.as("the route fell over on a reward the price list says is worth nothing")
				.isEqualTo(201);

		assertThat(bookOf(referrer))
				.as("a line was written for a reward worth nothing")
				.isEqualByComparingTo("0");
	}

	/**
	 * AND WHOEVER BROUGHT THE PAYER IN IS PAID, ONCE, HOWEVER MANY SEASONS HE GOES ON TO PAY FOR.	/**
	 * AND WHOEVER BROUGHT THE PAYER IN IS PAID, ONCE, HOWEVER MANY SEASONS HE GOES ON TO PAY FOR.
	 *
	 * <p>PDL: „Iznos leže na balans automatski, u trenutku kad se novom članu aktivira članarina, ne
	 * u trenutku registracije", and „Svaki član koji se registruje preko tog linka donosi
	 * preporučiocu 600 RSD" - one member, one reward. What holds the second half is
	 * {@code balance_entry_one_a_referral} (V36) rather than a question this route asks.
	 */
	@Test
	void whoeverBroughtThePayerInIsPaidOnce() throws Exception {
		long referrer = competitor("d3", "004007", true, "1980-05-15");
		long newcomer = competitor("d4", null, false, "1990-05-15");

		db.sql("update competitor set referred_by = ? where id = ?").params(referrer, newcomer).update();

		assertThat(confirm(json(new PaymentApi.Confirm(newcomer, "RSD", "slip", null)), moderatorCookie)
				.getStatus()).isEqualTo(201);

		assertThat(bookOf(referrer))
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

		assertThat(confirm(json(new PaymentApi.Confirm(newcomer, "RSD", "slip", null)), moderatorCookie)
				.getStatus()).isEqualTo(201);

		assertThat(bookOf(referrer))
				.as("one member brought in earned two rewards")
				.isEqualByComparingTo("600");
	}
}

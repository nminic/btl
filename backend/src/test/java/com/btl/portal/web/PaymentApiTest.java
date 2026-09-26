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
}

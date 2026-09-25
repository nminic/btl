package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * CHANGING A PRICE, END TO END, AGAINST A REAL DATABASE.
 *
 * <p><b>Authorisation is not this file's subject.</b> {@code RightsAtTheDoorTest} asks it of
 * EVERY route carrying {@link RightIsNeeded}, off the dispatcher, so this route was reached
 * by those cases on the day it was mapped rather than on the day somebody remembered a list.
 * Three cases below hold the same thing for defence in depth, and one of them says something
 * that sweep cannot: that a moderator holding a DIFFERENT tick is refused, which a fixture
 * made of somebody holding nothing could not tell from „he holds no tick at all".
 *
 * <p><b>THE CLOCK STANDS ON 15 MARCH 2028, AND EVERY WORD OF THAT IS CHOSEN.</b>
 *
 * <ul>
 * <li><b>March</b>, because {@link SeasonClock#referralMayBeSet} is true from January to
 * September and false from October, so the ordinary cases stand where every row of the list
 * may be written and the one case about the deadline moves the clock itself. March is also
 * inside the {@code season} period rather than the {@code regular} one, which is why the
 * case that records a payment moves to October: what a payment costs follows the DAY.
 * <li><b>2028</b>, because {@code payment_season_not_before_the_league} refuses a payment
 * before 2027 and {@link SeasonClock#seasonBeingPaidFor} answers 2028 in March of 2028, so
 * every payment in the fixture is for a season the schema will take.
 * </ul>
 *
 * <p><b>NOTHING ACTED ON IS THE ONLY ONE OF ITS KIND, AND THE AXES ARE COUNTED RATHER THAN
 * FELT.</b> The row every case writes is {@code regular}, and it is:
 *
 * <ul>
 * <li>not the first by {@code sort_order} ({@code early} is 1) and not the first by
 * {@code id} ({@code early} was inserted first), so the row asked for, the first row of the
 * list and the oldest row are three different answers;
 * <li>not the only row of its kind (four are {@code period});
 * <li><b>not the only row carrying its amounts:</b> {@code season} is 40 EUR and 4.800 RSD
 * too, so the row asked for and every row that costs forty euro are two different answers,
 * and a statement with no {@code where} is measurable;
 * <li>named by two payments and in two currencies, so this payment is never the payment on
 * that row, and neither of them is the first payment written.
 * </ul>
 *
 * <p>The two amounts a case writes are always DIFFERENT numbers on the two sides (41 and
 * 4.900), so a statement that wrote the euro price into the dinar column is two failures
 * rather than a pass.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PricingWriteApiTest {

	/** Holds {@code entity:pricing} and nothing else. */
	private static final String MAY = "cenovnik@primer.rs";

	/** Holds a tick, and it is not this one: any right and this right are two answers. */
	private static final String HOLDS_ANOTHER_TICK = "druga-prava@primer.rs";

	/** Records payments, so that who sets a price and who books one are two people. */
	private static final String BOOKS_PAYMENTS = "uplate@primer.rs";

	private static final String A_MEMBER = "takmicar@primer.rs";

	/** Noon in Belgrade on 15 March 2028. See the head of this class for every word of it. */
	private static final Instant IN_MARCH = Instant.parse("2028-03-15T11:00:00Z");

	/**
	 * Inside the {@code regular} period, 6 October to 30 November, and past 1 October.
	 *
	 * <p><b>Kept for the payment case and NOT reused for the deadline</b>, which is „nikad
	 * jedna konstanta za dve uloge": the day a payment is PRICED on and the day the referral
	 * window OPENS are two questions, and the two instants below are five days earlier - in
	 * the {@code early} period rather than in {@code regular} - so one constant serving both
	 * would have quietly renamed the row that case is about.
	 */
	private static final Instant IN_OCTOBER = Instant.parse("2028-10-20T10:00:00Z");

	/**
	 * MIDNIGHT IN BELGRADE ON 1 OCTOBER, WRITTEN AS THE INSTANT IT ACTUALLY IS.
	 *
	 * <p><b>This is the whole of PDL P16a in one number and it is measured, not read.</b>
	 * Belgrade is still on summer time on 1 October ({@code +02:00}; it leaves on the last
	 * Sunday of the month), so midnight there is 22:00 UTC of the day before. Read in UTC
	 * this instant is <b>30 September</b>, and read at a literal CET of {@code +01:00} it is
	 * <b>23:00 on 30 September</b> - in both of them the window has not opened and the
	 * referral could still be set.
	 *
	 * <p><b>Which is exactly why the old moment measured nothing.</b> Until 25.09.2026 this
	 * case stood on 20 October, where all three zones agree, and a series of mutations
	 * proved it: replacing {@code Europe/Belgrade} with {@code UTC} and with
	 * {@code ZoneOffset.ofHours(1)} left all 22 cases of this file GREEN, while
	 * {@code SeasonClockTest} failed twice each time. The route's own claim about the zone
	 * was carried by nothing.
	 */
	private static final Instant AS_THE_WINDOW_OPENS = Instant.parse("2028-09-30T22:00:00Z");

	/**
	 * One second earlier, when it is still 30 September in Belgrade.
	 *
	 * <p>The other half of the edge, and without it the case says „October" rather than
	 * „from this instant". A guard moved a month early - {@code getMonthValue() >= 9} - would
	 * satisfy every assertion about October and fail only here.
	 */
	private static final Instant A_SECOND_BEFORE_THE_WINDOW_OPENS =
			Instant.parse("2028-09-30T21:59:59Z");

	/** The row every case writes. See the head of this class for why it is this one. */
	private static final String ACTED = "regular";

	/** The row that carries the same two amounts and must never move with it. */
	private static final String THE_TWIN = "season";

	private static final String NO_SUCH_ROW = "nema-ovoga";

	private static final BigDecimal NEW_EUR = new BigDecimal("41.00");

	private static final BigDecimal NEW_RSD = new BigDecimal("4900.00");

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
	private AClockTheCaseMoves clock;

	private String mayCookie;

	private String anotherTickCookie;

	private String booksPaymentsCookie;

	private String memberCookie;

	/** On {@link #ACTED}, in euro. Written SECOND, so it is never the first payment. */
	private long paidInEuro;

	/** On {@link #ACTED} too, in dinars, so one row is never one payment. */
	private long paidInDinars;

	/** On another row entirely, so every payment and the payments on that row differ. */
	private long paidOnAnotherRow;

	/** Nobody has paid for him yet: he is the payment recorded AFTER a price moves. */
	private long whoPaysLater;

	/**
	 * A CLOCK THE CASE MOVES, so that both sides of 1 October are one fixture.
	 *
	 * <p>It reports UTC as its zone on purpose, the shape every other case in this package
	 * uses: whoever works out a moment has to re-read the instant in the league's own time,
	 * and a server that reads this zone instead answers with the wrong month on the one
	 * evening that matters.
	 */
	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		private AClockTheCaseMoves(Instant now) {
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
			return new AClockTheCaseMoves(IN_MARCH);
		}
	}

	@BeforeEach
	void fourAccountsAndThreePaymentsOnTwoRows() {
		clock.moveTo(IN_MARCH);

		mayCookie = account(MAY, "moderator");
		ticked(MAY, "entity:pricing");

		anotherTickCookie = account(HOLDS_ANOTHER_TICK, "moderator");
		ticked(HOLDS_ANOTHER_TICK, "entity:leagues");

		booksPaymentsCookie = account(BOOKS_PAYMENTS, "moderator");
		ticked(BOOKS_PAYMENTS, "queue:payments");

		memberCookie = account(A_MEMBER, "competitor");

		/* WRITTEN FIRST AND ON ANOTHER ROW, which is what makes the payments this file is
		   about neither the first payment nor the only one. */
		paidOnAnotherRow = payment(competitor("01", "000101"), "early",
				new BigDecimal("35.00"), "EUR", new BigDecimal("3.00"));
		paidInEuro = payment(competitor("02", "000102"), ACTED,
				new BigDecimal("40.00"), "EUR", new BigDecimal("3.00"));
		paidInDinars = payment(competitor("03", "000103"), ACTED,
				new BigDecimal("4800.00"), "RSD", BigDecimal.ZERO);

		whoPaysLater = competitor("04", null);
	}

	/**
	 * THE FIXTURE ITSELF, ASKED WHETHER IT MEASURES WHAT THIS FILE SAYS IT DOES.
	 *
	 * <p>Every sentence in the head of this class about never the only one of its kind is a
	 * claim about rows, and a claim about rows is the first thing to go quietly untrue when
	 * somebody tidies a fixture. Asked here rather than trusted, once, so that everything
	 * below keeps meaning what it says.
	 */
	@Test
	void nothingActedOnIsTheFirstOrTheOnlyOneOfItsKind() {
		assertThat(keysInOrder())
				.as("the row this file writes no longer stands second in the order, so the row"
						+ " asked for and the first row of the list may be one answer")
				.element(1).isEqualTo(ACTED);
		assertThat(idOf(ACTED))
				.as("the row this file writes is the oldest in the table, so an answer that read"
						+ " the lowest key instead would pass everything below")
				.isGreaterThan(db.sql("select min(id) from price_row").query(Long.class).single());
		assertThat(db.sql("select count(*) from price_row where kind = 'period'")
						.query(Long.class).single())
				.as("there is one period left, so this row and every period are one answer")
				.isEqualTo(4);

		assertThat(amountsOf(THE_TWIN))
				.as("the twin no longer carries the same two amounts as the row that is written,"
						+ " so a statement with no WHERE would not be measurable")
				.isEqualTo(amountsOf(ACTED));

		assertThat(paidInEuro)
				.as("the payment this file is about is the first payment written, so those two are"
						+ " one answer and no case can tell them apart")
				.isGreaterThan(db.sql("select min(id) from payment").query(Long.class).single());
		assertThat(db.sql("select count(distinct currency) from payment where price_row_id = ?")
						.param(idOf(ACTED)).query(Long.class).single())
				.as("the row that is written carries payments in one currency, so this payment and"
						+ " the payment on that row are one answer")
				.isEqualTo(2);
		assertThat(db.sql("select amount from payment where id = ?").param(paidInEuro)
						.query(BigDecimal.class).single())
				.as("the payment and the price it was taken from no longer agree BEFORE the"
						+ " change, so the case that requires them to disagree afterwards proves"
						+ " nothing")
				.isEqualByComparingTo(euroOf(ACTED));

		assertThat(db.sql("select count(*) from price_row where key = ?").param(NO_SUCH_ROW)
						.query(Long.class).single())
				.as("something answers to the key this file uses for a row that is not there")
				.isZero();
	}

	/**
	 * AND THE TWO KINDS THIS ROUTE TREATS DIFFERENTLY ARE KINDS OF ROWS THAT REALLY EXIST.
	 *
	 * <p>This is the floor under the only two literals {@link PricingWriteApi} holds. Both of
	 * them refuse or delay a write, and a kind misspelt would refuse nothing at all: the fee
	 * would become writable in a shape the schema then rejects as a 500, and the referral
	 * would become settable in December, which is the one thing the owner's decision of
	 * 16.08.2026 is about. Neither failure would show anywhere else, because a name that
	 * matches no row simply never matches.
	 *
	 * <p>Each is tied to a row that is already named somewhere else - the fee to
	 * {@link MembershipPrice#PROCESSING}, which the price rule itself reaches for - and
	 * required to be the only row of its kind, so the fee row is one row and not a class
	 * somebody could add to.
	 */
	@Test
	void aKindNamedInTheRouteIsTheKindOfExactlyOneKnownRow() {
		assertThat(keysOfKind(PricingWriteApi.A_FEE))
				.as("the kind the route refuses is not the kind of exactly one row, or is not the"
						+ " kind of the row the price rule calls the processing fee")
				.containsExactly(MembershipPrice.PROCESSING);

		assertThat(keysOfKind(PricingWriteApi.A_REFERRAL))
				.as("the kind the route holds to a deadline is not the kind of exactly one row")
				.hasSize(1);

		/* AND THE TWO ARE NOT THE SAME KIND, which nothing above says: were both constants
		   the same string, each assertion would pass on the same single row and the route's
		   two refusals would be one. */
		assertThat(PricingWriteApi.A_FEE)
				.as("the route refuses the fee and delays the referral by one and the same name")
				.isNotEqualTo(PricingWriteApi.A_REFERRAL);
	}

	/**
	 * A PRICE IS CHANGED, AND NOTHING ELSE ABOUT THE ROW OR THE LIST MOVES WITH IT.
	 *
	 * <p><b>What is compared is the WHOLE ROW, read twice, rather than the two columns
	 * somebody thought to look at.</b> Owner, 30.07.2026 (PDL:827): menjaju se samo cene i
	 * nazivi perioda, so a statement that also wrote the window, the kind, the right to be
	 * ranked or the order would break that decision - and a case naming the columns it checks
	 * would miss whichever one it did not name. The columns are read off the answer the
	 * database gives, so a column added to the table tomorrow is compared on the day it is
	 * added.
	 *
	 * <p><b>AND THE ANSWER IS THE ROW AND NOT THE REQUEST, which is what {@code 41.1}
	 * measures.</b> Sent with one decimal and stored in {@code numeric(10,2)}, it comes back
	 * {@code 41.10}. An answer built out of the request would say {@code 41.1}, and the two
	 * are the same number and a different text - so this is the one shape that tells them
	 * apart without a second request.
	 */
	@Test
	void aPriceIsChangedAndTheAnswerIsTheRowAsItNowStands() throws Exception {
		List<String> before = keysInOrder();
		Map<String, Object> was = rowOf(ACTED);
		Map<String, Object> theTwinWas = rowOf(THE_TWIN);

		MockHttpServletResponse answer = change(ACTED, new BigDecimal("41.1"), NEW_RSD, mayCookie);

		assertThat(answer.getStatus()).isEqualTo(200);

		JsonNode said = read(answer);

		assertThat(said.path("key").asString()).isEqualTo(ACTED);
		assertThat(said.path("eur").decimalValue().toPlainString())
				.as("the answer carries the amount that was SENT rather than the one the price"
						+ " list now holds, so an amount the column changed on the way in would be"
						+ " reported back as though it had been kept")
				.isEqualTo("41.10");
		assertThat(said.path("rsd").decimalValue().toPlainString()).isEqualTo("4900.00");

		Map<String, Object> now = rowOf(ACTED);

		assertThat(now.get("eur")).isEqualTo(new BigDecimal("41.10"));
		assertThat(now.get("rsd")).isEqualTo(NEW_RSD);

		/* EVERY OTHER COLUMN OF THE ROW, WITHOUT NAMING ONE. */
		assertThat(now.keySet())
				.as("the price list gained or lost a column, so the comparison below is over a"
						+ " different row than the one that was read")
				.isEqualTo(was.keySet());
		assertThat(whatDiffers(was, now))
				.as("something besides the two amounts moved, and PDL:827 allows only the prices")
				.containsExactly("eur", "rsd");

		assertThat(rowOf(THE_TWIN))
				.as("the row that carries the same two amounts moved as well, so the statement is"
						+ " writing every row that costs what this one did")
				.isEqualTo(theTwinWas);

		assertThat(keysInOrder())
				.as("the price list is not the seven rows it was, in the order it had, and PDL:827"
						+ " says rows are neither added nor taken away")
				.isEqualTo(before);
	}

	/**
	 * A PRICE CHANGED HERE DOES NOT MOVE A PAYMENT THAT HAS ALREADY BEEN RECORDED, AND THE
	 * NEXT PAYMENT ON THE SAME ROW IS CHARGED THE NEW ONE.
	 *
	 * <p><b>Owner, 25.09.2026 (PDL P12a):</b> izmena reda cenovnika ne dira uplate koje su vec
	 * evidentirane. In his own words beside the choice: „necu praviti izmene cenovnika u
	 * periodu placanja. Cenovnik se menja u septembru (recimo 2027) za naredni prijavni
	 * ciklus, tako da kad se otvore nove prijave, vazice."
	 *
	 * <p><b>THE SECOND HALF IS WHAT KEEPS THE FIRST FROM BEING A TAUTOLOGY.</b> The payment
	 * did not move is trivially true of a route that did nothing at all, and of a fixture in
	 * which the price did not really change. So the price and the payment are required to
	 * DISAGREE afterwards - they were equal before, which the fixture case asserts - and then
	 * a second payment is recorded on the SAME row through the route that books payments, and
	 * required to carry the new amount. Two payments, one price row, two amounts: the row is
	 * a pointer and the amount is a copy, which is the whole of what V16 provided for and
	 * what P12a decided.
	 *
	 * <p><b>The clock moves to October for this case alone</b>, because what a payment costs
	 * follows the DAY: in March the period in force is {@code season}, and a payment recorded
	 * then would name a different row and measure nothing. That the two really do name one
	 * row is asserted rather than assumed.
	 *
	 * <p><b>And the payments are compared WHOLE.</b> An assertion about {@code amount} alone
	 * would say nothing about the fee beside it, or the currency, or which row the payment
	 * names.
	 */
	@Test
	void changingAPriceLeavesEveryPaymentAlreadyRecordedExactlyWhereItWas() throws Exception {
		clock.moveTo(IN_OCTOBER);

		List<String> before = keysInOrder();
		Map<String, Object> euroWas = paymentRow(paidInEuro);
		Map<String, Object> dinarsWas = paymentRow(paidInDinars);
		Map<String, Object> anotherRowWas = paymentRow(paidOnAnotherRow);

		assertThat(change(ACTED, NEW_EUR, NEW_RSD, mayCookie).getStatus()).isEqualTo(200);

		assertThat(paymentRow(paidInEuro))
				.as("a payment already recorded moved when the price list was edited, and PDL P12a"
						+ " of 25.09.2026 says it must not")
				.isEqualTo(euroWas);
		assertThat(paymentRow(paidInDinars))
				.as("the dinar payment on the same row moved, so what was kept was the currency"
						+ " and not the payment")
				.isEqualTo(dinarsWas);
		assertThat(paymentRow(paidOnAnotherRow))
				.as("a payment on a row nobody touched moved as well")
				.isEqualTo(anotherRowWas);

		/* AND THE PRICE REALLY DID MOVE, which is what stops everything above from being a
		   sentence about a route that wrote nothing. Before the change these two were the
		   same number, which `nothingActedOnIsTheFirstOrTheOnlyOneOfItsKind` asserts. */
		assertThat(euroOf(ACTED))
				.as("the price the payment was taken from is still the amount on the payment, so"
						+ " the payment did not move and nothing moved at all are one answer")
				.isNotEqualByComparingTo(amountOf(euroWas));

		/* THE NEXT PAYMENT ON THE SAME ROW, BOOKED THROUGH THE ROUTE THAT BOOKS PAYMENTS. */
		MockHttpServletResponse booked = http.perform(post("/api/payments").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, booksPaymentsCookie))
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(
								new PaymentApi.Confirm(whoPaysLater, "EUR", "slip", null))))
				.andReturn().getResponse();

		assertThat(booked.getStatus())
				.as("the payment recorded after the change was refused, so this case measures"
						+ " nothing about what it was charged")
				.isEqualTo(201);

		Map<String, Object> later = paymentRow(db.sql("select id from payment where competitor_id = ?")
				.param(whoPaysLater).query(Long.class).single());

		assertThat(later.get("price_row_id"))
				.as("the payment recorded in October names a different row of the price list than"
						+ " the one this case edited, so the two amounts below are two rows and"
						+ " not one row before and after")
				.isEqualTo(euroWas.get("price_row_id"));
		assertThat(amountOf(later))
				.as("the payment recorded after the change was charged the old price, so a price"
						+ " set through this route reaches nobody")
				.isEqualByComparingTo(NEW_EUR);
		assertThat(amountOf(later))
				.as("two payments on one row carry the same amount, so the amount is being read"
						+ " off the price list rather than kept on the payment")
				.isNotEqualByComparingTo(amountOf(euroWas));

		assertThat(keysInOrder()).isEqualTo(before);
	}

	/**
	 * THE PROCESSING FEE IS SET WITH NO DINAR PRICE AT ALL, AND KEEPS NONE AFTERWARDS.
	 *
	 * <p><b>Owner, 25.09.2026:</b> the fee gets a button of its own with the dinar price left
	 * out. It is the one row of the seven with no dinar side, because there is no payment
	 * intermediary on that side to pay (PDL, owner 04.08.2026), and
	 * {@code price_row_only_fee_has_no_rsd} holds it in the schema.
	 *
	 * <p><b>That {@code rsd} is still null afterwards is the half a status code would not
	 * say.</b> A route that wrote a nought there would answer 200 just the same, and the fee
	 * would have acquired a dinar price nobody charges - which the constraint would refuse
	 * as a 500, or, written as a nought with the constraint loosened, would go unnoticed
	 * entirely.
	 */
	@Test
	void theProcessingFeeIsSetWithNoDinarPriceAtAll() throws Exception {
		List<String> before = keysInOrder();
		Map<String, Object> was = rowOf(MembershipPrice.PROCESSING);

		MockHttpServletResponse answer = change(MembershipPrice.PROCESSING,
				new BigDecimal("4.00"), null, mayCookie);

		assertThat(answer.getStatus())
				.as("the processing fee could not be changed at all, and the owner decided on"
						+ " 25.09.2026 that it is set like any other row")
				.isEqualTo(200);
		assertThat(read(answer).path("rsd").isNull())
				.as("the answer gave the fee a dinar price, which is a price for a payment"
						+ " nobody makes in dinars")
				.isTrue();

		Map<String, Object> now = rowOf(MembershipPrice.PROCESSING);

		assertThat(now.get("eur")).isEqualTo(new BigDecimal("4.00"));
		assertThat(now.get("rsd"))
				.as("the fee came away with a dinar price, which price_row_only_fee_has_no_rsd"
						+ " forbids and which nobody pays")
				.isNull();
		assertThat(whatDiffers(was, now))
				.as("something besides the euro price of the fee moved")
				.containsExactly("eur");
		assertThat(keysInOrder()).isEqualTo(before);
	}

	/**
	 * AND A DINAR PRICE SENT WITH THE FEE IS REFUSED, WHICH IS THE OTHER DIRECTION OF THE
	 * SAME CONSTRAINT.
	 *
	 * <p>{@code price_row_only_fee_has_no_rsd} is an equivalence, so a fee WITH a dinar price
	 * and a period WITHOUT one are two different faults; this is the first and
	 * {@code aFormMissingEitherAmountIsRefusedAndNothingIsWritten} is the second. Refused as a
	 * sentence rather than met as a 500 off the constraint.
	 *
	 * <p><b>BOUNDARY:</b> {@code admin-cena.form.json} still asks for {@code rsd} as a
	 * required field, so the fee cannot yet be reached from the SCREEN - it is this exact
	 * refusal that a form submitted today would meet. That is the order the owner chose on
	 * 25.09.2026: the route first and the form after.
	 */
	@Test
	void aDinarPriceSentWithTheFeeIsRefusedAndNothingIsWritten() throws Exception {
		List<String> before = keysInOrder();
		Map<String, Object> was = rowOf(MembershipPrice.PROCESSING);

		MockHttpServletResponse answer = change(MembershipPrice.PROCESSING,
				new BigDecimal("4.00"), new BigDecimal("480.00"), mayCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString())
				.contains(PricingWriteApi.THE_FEE_HAS_NO_DINAR_PRICE);
		assertThat(rowOf(MembershipPrice.PROCESSING))
				.as("a dinar price was refused for the fee and the euro price was written anyway")
				.isEqualTo(was);
		assertThat(keysInOrder()).isEqualTo(before);
	}

	/**
	 * THE REFERRAL IS SET UNTIL THE RENEWAL WINDOW OPENS AND SETTLED ONCE IT HAS.
	 *
	 * <p><b>Owner, 16.08.2026 (PDL P16):</b> „administrator podesava <b>do 1.10. u 00 po
	 * CET</b> za predstojecu godinu", and „posle 1. oktobra u 00:00 CET iznos za tu godinu
	 * stoji, i administrator ga menja samo za sledecu". Until this increment that was kept by
	 * a button the screen drew as settled, which is what ADL A8 of 30.07.2026 refuses in as
	 * many words: prava se sprovode na ruti, ne po ekranu.
	 *
	 * <p><b>Both sides in one case, because nothing but the clock differs between them.</b>
	 * The same request, the same row, the same account: written as two cases, a route that
	 * refused every referral would pass the second and a route that refused none would pass
	 * the first, and neither case would say that the DATE is what decides.
	 *
	 * <p><b>And the deadline is the referral's alone</b>, which the last half measures: a
	 * period is written at the same October moment and goes through. A guard that shut the
	 * whole price list in October would pass everything above.
	 *
	 * <p><b>THE MOMENT IS MIDNIGHT IN BELGRADE AND NOT A DAY IN OCTOBER, which is PDL P16a
	 * (owner, 25.09.2026) and the only reason this case says anything about the ZONE.</b>
	 * See {@link #AS_THE_WINDOW_OPENS}: it is 30 September both in UTC and at a literal CET,
	 * so a route reading the month in either of those answers „you may still set it" where
	 * this requires a refusal. Stood on 20 October, as it did until that day, the case was
	 * green under both of those replacements - measured, not supposed.
	 *
	 * <p><b>And one second earlier it is still allowed</b>, which is what makes this an edge
	 * rather than a month. Without it a deadline moved to 1 September would satisfy
	 * everything else here.
	 */
	@Test
	void theReferralIsSetUntilMidnightInBelgradeAndSettledFromIt() throws Exception {
		List<String> before = keysInOrder();

		MockHttpServletResponse inMarch = change(PricingWriteApi.A_REFERRAL,
				new BigDecimal("6.00"), new BigDecimal("720.00"), mayCookie);

		assertThat(inMarch.getStatus())
				.as("the amount a referral brings could not be set in March, although the owner"
						+ " set the deadline at 1 October")
				.isEqualTo(200);
		assertThat(euroOf(PricingWriteApi.A_REFERRAL)).isEqualByComparingTo(new BigDecimal("6.00"));

		/* STILL 30 SEPTEMBER IN BELGRADE, BY ONE SECOND. */
		clock.moveTo(A_SECOND_BEFORE_THE_WINDOW_OPENS);

		assertThat(change(PricingWriteApi.A_REFERRAL,
						new BigDecimal("6.50"), new BigDecimal("780.00"), mayCookie).getStatus())
				.as("the amount was already settled a second before midnight in Belgrade, so the"
						+ " deadline this route keeps is earlier than the one the owner set")
				.isEqualTo(200);
		assertThat(euroOf(PricingWriteApi.A_REFERRAL)).isEqualByComparingTo(new BigDecimal("6.50"));

		clock.moveTo(AS_THE_WINDOW_OPENS);
		Map<String, Object> was = rowOf(PricingWriteApi.A_REFERRAL);

		MockHttpServletResponse inOctober = change(PricingWriteApi.A_REFERRAL,
				new BigDecimal("7.00"), new BigDecimal("840.00"), mayCookie);

		assertThat(inOctober.getStatus())
				.as("the amount was changed after the renewal window had opened, when it stands"
						+ " for that season by the owner's decision of 16.08.2026")
				.isEqualTo(409);
		assertThat(inOctober.getContentAsString())
				.contains(PricingWriteApi.THE_REFERRAL_IS_SETTLED_FOR_THE_COMING_SEASON);
		assertThat(rowOf(PricingWriteApi.A_REFERRAL))
				.as("the referral was refused at midnight in Belgrade and written anyway")
				.isEqualTo(was);

		/* AND THE DEADLINE IS THE REFERRAL'S AND NOT THE WHOLE LIST'S. */
		assertThat(change(ACTED, NEW_EUR, NEW_RSD, mayCookie).getStatus())
				.as("a period could not be changed at that same instant either, so what was"
						+ " refused above was the moment and not the referral")
				.isEqualTo(200);

		assertThat(keysInOrder()).isEqualTo(before);
	}

	/**
	 * A ROW THAT IS NOT THERE IS ANSWERED WITH NOTHING AT ALL.
	 *
	 * <p>404 and an empty body, which is the same answer a moderator without the tick gets;
	 * the case below compares the two rather than asserting a number twice.
	 */
	@Test
	void aRowThatIsNotThereIsAnsweredWithNothing() throws Exception {
		List<String> before = keysInOrder();

		MockHttpServletResponse answer = change(NO_SUCH_ROW, NEW_EUR, NEW_RSD, mayCookie);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString())
				.as("a price row that is not there carried a reason, which is something only a row"
						+ " that exists could have")
				.isEmpty();
		assertThat(keysInOrder()).isEqualTo(before);
	}

	/**
	 * A MODERATOR HOLDING A DIFFERENT TICK IS ANSWERED EXACTLY WHAT A ROW THAT IS NOT THERE
	 * IS ANSWERED.
	 *
	 * <p>ADL A8, owner 13.09.2026: prijavljen kome pravo nedostaje dobija <b>404</b>, isti
	 * odgovor kao da adresa ne postoji, nikad 403. <b>The two answers are compared with each
	 * other rather than with a number</b>, so the day one of them moves the other has to move
	 * with it - the shape {@code RightsAtTheDoor} names as the case that holds this rule.
	 *
	 * <p><b>He holds a tick, and that is the whole point of him.</b> A fixture made of
	 * somebody holding nothing cannot tell he may not do THIS from he may not do anything,
	 * and a door reading whether he is a moderator at all would pass it.
	 *
	 * <p>What this file cannot measure is the two answers being the same BYTES; MockMvc does
	 * not run the container's ERROR dispatch. {@code RightsOverRealHttpTest} reads that off a
	 * socket for every guarded route.
	 */
	@Test
	void aModeratorHoldingAnotherTickIsToldNoMoreThanSomebodyAskingForNothing() throws Exception {
		List<String> before = keysInOrder();
		Map<String, Object> was = rowOf(ACTED);

		MockHttpServletResponse refused = change(ACTED, NEW_EUR, NEW_RSD, anotherTickCookie);
		MockHttpServletResponse notThere = change(NO_SUCH_ROW, NEW_EUR, NEW_RSD, mayCookie);

		assertThat(refused.getStatus())
				.as("a moderator who may not set prices was told something different from what an"
						+ " address that is not there says, so the answer tells him the action"
						+ " exists")
				.isEqualTo(notThere.getStatus());
		assertThat(refused.getContentAsString()).isEqualTo(notThere.getContentAsString());

		assertThat(rowOf(ACTED))
				.as("a moderator without the tick was refused and his price was written anyway")
				.isEqualTo(was);
		assertThat(keysInOrder()).isEqualTo(before);
	}

	/** And a plain member, who holds no tick of any kind, is refused the same way. */
	@Test
	void aPlainMemberIsRefusedAndNothingIsWritten() throws Exception {
		Map<String, Object> was = rowOf(ACTED);

		assertThat(change(ACTED, NEW_EUR, NEW_RSD, memberCookie).getStatus()).isEqualTo(404);
		assertThat(rowOf(ACTED)).isEqualTo(was);
	}

	/**
	 * AND SOMEBODY WHO IS NOT SIGNED IN IS ASKED TO SIGN IN, WHICH IS THE ONE PLACE 404 IS NOT
	 * THE ANSWER.
	 *
	 * <p>401 gives nothing away - it is the same answer for an address that exists and one
	 * that does not - and it says sign in rather than there is something here. The chain
	 * refuses him before the door is reached, because a route that needs a right is a route
	 * {@link ApiSecurity} has not opened: {@code /api/pricing} is open for {@code GET},
	 * {@code HEAD} and {@code OPTIONS} alone, and this address is not that one.
	 */
	@Test
	void nobodySignedInIsAskedToSignInAndNothingIsWritten() throws Exception {
		Map<String, Object> was = rowOf(ACTED);

		assertThat(change(ACTED, NEW_EUR, NEW_RSD, null).getStatus()).isEqualTo(401);
		assertThat(rowOf(ACTED)).isEqualTo(was);
	}

	/**
	 * A FORM MISSING EITHER AMOUNT IS REFUSED, AND BOTH SIDES ARE ASKED.
	 *
	 * <p>The row asked about is a PERIOD, which is one of the six that have a dinar price, so
	 * both amounts are required of it. Asked from one side only, a route that checked the euro
	 * price alone would pass - and a dinar price sent as nothing would arrive at
	 * {@code price_row_only_fee_has_no_rsd} as a 500 on an administrator who has just filled a
	 * form in.
	 *
	 * <p>The fee is the seventh row and the one direction this does not cover;
	 * {@code aDinarPriceSentWithTheFeeIsRefusedAndNothingIsWritten} is the other half of that
	 * same equivalence.
	 */
	@ParameterizedTest
	@CsvSource({"41.00,", ",4900.00", ","})
	void aFormMissingEitherAmountIsRefusedAndNothingIsWritten(String eur, String rsd) throws Exception {
		Map<String, Object> was = rowOf(ACTED);

		MockHttpServletResponse answer = change(ACTED, asAmount(eur), asAmount(rsd), mayCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString()).contains(PricingWriteApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(rowOf(ACTED)).isEqualTo(was);
	}

	/**
	 * AN AMOUNT THE PRICE LIST WOULD NOT KEEP AS IT WAS TYPED IS REFUSED, ON EITHER SIDE.
	 *
	 * <p><b>{@code 41.125} is the one that matters and the one no constraint could catch.</b>
	 * PostgreSQL does not refuse it, it ROUNDS it to {@code 41.13}
	 * ({@code AnAmountMatchesTheSchemaTest} asks the table itself), so without this the portal
	 * would quietly have changed a price by a para nobody typed. The other two are the
	 * constraint and the column saying the same thing as sentences instead of as a 500.
	 *
	 * <p>Both columns are asked in every shape, because a rule written over {@code eur} alone
	 * would leave the dinar price rounding in silence - and the dinar price is the one most
	 * members pay.
	 */
	@ParameterizedTest
	@CsvSource({
			"41.125, 4900.00",
			"41.00, 4900.125",
			"-1.00, 4900.00",
			"41.00, -1.00",
			"100000000, 4900.00",
			"41.00, 100000000"})
	void anAmountThePriceListWouldNotKeepIsRefusedAndNothingIsWritten(String eur, String rsd)
			throws Exception {
		List<String> before = keysInOrder();
		Map<String, Object> was = rowOf(ACTED);

		MockHttpServletResponse answer = change(ACTED, new BigDecimal(eur), new BigDecimal(rsd), mayCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString())
				.contains(PricingWriteApi.THE_AMOUNT_IS_NOT_KEPT_EXACTLY);
		assertThat(rowOf(ACTED))
				.as("an amount the price list cannot keep was refused and stored anyway, rounded"
						+ " or otherwise")
				.isEqualTo(was);
		assertThat(keysInOrder()).isEqualTo(before);
	}

	/**
	 * AN AMOUNT ABOVE WHAT A ROW MAY COST IS REFUSED, AND EACH CURRENCY AGAINST ITS OWN.
	 *
	 * <p><b>Owner, 25.09.2026 (PDL P12c):</b> the route refuses above <b>1.000 EUR</b> and
	 * <b>200.000 RSD</b>. Before this the route took a membership fee of 99.999.999,99,
	 * because the ceiling lived only in {@code admin-cena.form.json} and a request sent past
	 * the screen never met it - the same hole ADL A8 describes and the same one the referral
	 * deadline was moved onto the route to close.
	 *
	 * <p><b>THE THIRD ROW IS THE ONE THAT MEASURES WHICH CEILING IS WHICH.</b> 1.500 EUR is
	 * far under the DINAR ceiling, so a route that asked the dinar question of a euro price
	 * would write it. Every other row here would pass such a route unchanged. The other
	 * direction is measured by every case in this file that succeeds: they all write 4.900
	 * RSD, which the euro ceiling would refuse, as it would refuse {@code late} - a price the
	 * list has carried since V4.
	 *
	 * <p><b>And the fee is asked too</b>, because it is the one row that reaches the euro
	 * question with no dinar price beside it, and a ceiling written inside the branch for the
	 * six other rows would leave the seventh unbounded.
	 */
	@ParameterizedTest
	@CsvSource({
			"1000.01, 4900.00",
			"41.00, 200000.01",
			"1500.00, 4900.00",
			"1000.01, 200000.01"})
	void anAmountAboveWhatARowMayCostIsRefusedAndNothingIsWritten(String eur, String rsd)
			throws Exception {
		List<String> before = keysInOrder();
		Map<String, Object> was = rowOf(ACTED);

		MockHttpServletResponse answer = change(ACTED, new BigDecimal(eur), new BigDecimal(rsd), mayCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString())
				.as("an amount over the ceiling was refused for some other reason, so the sentence"
						+ " an administrator reads does not tell him what to change")
				.contains(PricingWriteApi.THE_AMOUNT_IS_MORE_THAN_A_ROW_MAY_COST);
		assertThat(rowOf(ACTED))
				.as("an amount above what a row may cost was refused and written anyway")
				.isEqualTo(was);
		assertThat(keysInOrder()).isEqualTo(before);
	}

	/**
	 * THE FEE'S EURO PRICE IS BOUNDED BY THE SAME CEILING, WHICH ITS OWN BRANCH COULD HAVE
	 * LOST.
	 *
	 * <p>The fee is the one row that carries no dinar price, so it travels through a
	 * different arm of every question this route asks. A ceiling applied inside the arm that
	 * handles the other six leaves the processing fee free to be set to any number at all -
	 * and the fee is shown to everybody (owner, 04.08.2026: „Taksa se prikazuje svima").
	 */
	@Test
	void theFeesEuroPriceIsBoundedByTheSameCeiling() throws Exception {
		Map<String, Object> was = rowOf(MembershipPrice.PROCESSING);

		MockHttpServletResponse answer =
				change(MembershipPrice.PROCESSING, new BigDecimal("1000.01"), null, mayCookie);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString())
				.contains(PricingWriteApi.THE_AMOUNT_IS_MORE_THAN_A_ROW_MAY_COST);
		assertThat(rowOf(MembershipPrice.PROCESSING))
				.as("the processing fee was set above the ceiling every other row is held to")
				.isEqualTo(was);
	}

	/**
	 * THE CEILING ITSELF IS A PRICE THAT MAY BE SET, AND SO IS NOUGHT.
	 *
	 * <p><b>Both edges, because a ceiling is two answers and not one.</b> Written with
	 * {@code <} instead of {@code <=} the route would refuse exactly 1.000 EUR - the number
	 * the owner named as allowed and the number {@code admin-cena.form.json} writes as
	 * {@code max}, which every form renderer reads as „at most". The case above holds the
	 * other side by one para.
	 *
	 * <p><b>And nought is asked in the same breath</b> because it is the edge a ceiling
	 * invites somebody to close by accident: {@code price_row_eur_not_negative} allows it,
	 * {@code MembershipPrice} says in as many words that a free row is a decision rather
	 * than a fault, and a range written where a ceiling was asked for would refuse it.
	 */
	@Test
	void theCeilingItselfIsWrittenAndSoIsNought() throws Exception {
		List<String> before = keysInOrder();

		assertThat(change(ACTED, MembershipPrice.mostARowMayCostInEuro(),
						MembershipPrice.mostARowMayCostInDinars(), mayCookie).getStatus())
				.as("the ceiling the owner named as allowed was refused, so the route stops one"
						+ " para below the number in the form")
				.isEqualTo(200);
		assertThat(amountsOf(ACTED))
				.containsExactly(new BigDecimal("1000.00"), new BigDecimal("200000.00"));

		assertThat(change(ACTED, BigDecimal.ZERO, BigDecimal.ZERO, mayCookie).getStatus())
				.as("a free row was refused, although nothing in the journals says a row may not"
						+ " be nought and the schema allows it")
				.isEqualTo(200);
		assertThat(amountsOf(ACTED))
				.containsExactly(new BigDecimal("0.00"), new BigDecimal("0.00"));

		assertThat(keysInOrder()).isEqualTo(before);
	}

	/**
	 * THE PRICE LIST TAKES NO POST AND NO DELETE, AT EITHER ADDRESS.
	 *
	 * <p><b>Owner, 30.07.2026 (PDL:827):</b> „Periodi su stalni: <b>redovi se ne dodaju i ne
	 * brisu</b>, menjaju se samo cene i nazivi perioda. Peti red bi morao da padne unutar
	 * nekog od cetiri, a oduzet red bi ostavio deo godine bez cene."
	 *
	 * <p><b>Asked as the moderator who MAY set prices, which is the only way this measures
	 * anything.</b> Asked as anybody else the answer would be a refusal whatever the portal
	 * mapped, and the case would be green over a {@code DELETE} that existed. He holds the
	 * tick and he carries a token, and the answer is still a refusal - which is what a path
	 * mapping only another verb comes to once {@code NothingIsHereRatherThanAlmost} has taken
	 * the dispatcher's own sentence away from it.
	 *
	 * <p>Both addresses, because they are two: the list and one row of it.
	 *
	 * <p><b>AND THE ANSWER IS COMPARED WITH A TWIN THAT MAPS NOTHING RATHER THAN WITH A
	 * NUMBER ALONE.</b> Measured 25.09.2026: {@code POST /api/pricing} comes back <b>404</b>
	 * and not the 405 a dispatcher would ordinarily give a path that maps only another verb -
	 * {@code NothingIsHereRatherThanAlmost} takes that sentence away from it, and what is
	 * left is the static handler answering as it does for an address nobody wrote. The number
	 * is asserted because it is the one this portal has decided on, and the twin is asserted
	 * beside it because that is the sentence which survives the day the number moves.
	 */
	@Test
	void thePriceListTakesNoPostAndNoDelete() throws Exception {
		List<String> before = keysInOrder();

		for (String where : List.of("/api/pricing", "/api/pricing/" + ACTED)) {
			String twin = where + "-nema-ovoga";

			assertThat(statusOfPost(where))
					.as("%s answered a POST differently from an address that maps nothing, so a"
							+ " row can be added to the price list and PDL:827 says a fifth row"
							+ " would have to fall inside one of the four", where)
					.isEqualTo(statusOfPost(twin))
					.isEqualTo(404);

			assertThat(statusOfDelete(where))
					.as("%s answered a DELETE differently from an address that maps nothing, so a"
							+ " row can be taken away and PDL:827 says that would leave a stretch"
							+ " of the year with no price", where)
					.isEqualTo(statusOfDelete(twin))
					.isEqualTo(404);
		}

		assertThat(keysInOrder())
				.as("the price list is no longer the seven rows it was")
				.isEqualTo(before);
	}

	private int statusOfPost(String where) throws Exception {
		return http.perform(post(where).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, mayCookie))
						.contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andReturn().getResponse().getStatus();
	}

	private int statusOfDelete(String where) throws Exception {
		return http.perform(delete(where).with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, mayCookie)))
				.andReturn().getResponse().getStatus();
	}

	/**
	 * AND THE PRICE LIST GOES ON BEING READABLE BY ANYBODY, WHICH THE NEW ADDRESS MUST NOT
	 * HAVE CHANGED.
	 *
	 * <p>{@code PUT /api/pricing/&#123;key&#125;} is a sub-path of an address on
	 * {@link ApiSecurity#READ_BY_ANYBODY}, and the open list holds whole addresses rather
	 * than prefixes. So the read a visitor makes is untouched and the sub-path is shut to
	 * him, and the two are asked here together because they are the pair that could have come
	 * apart.
	 */
	@Test
	void whatAVisitorMayReadIsUnchangedAndTheNewAddressIsNotPartOfIt() throws Exception {
		assertThat(http.perform(get("/api/pricing")).andReturn().getResponse().getStatus())
				.as("somebody deciding whether to join was asked to sign in before being told the"
						+ " price")
				.isEqualTo(200);

		assertThat(http.perform(get("/api/pricing/" + ACTED)).andReturn().getResponse().getStatus())
				.as("the address that writes a price answered somebody who is not signed in")
				.isEqualTo(401);
	}

	private static BigDecimal asAmount(String written) {
		return written == null ? null : new BigDecimal(written);
	}

	private static BigDecimal amountOf(Map<String, Object> payment) {
		return (BigDecimal) payment.get("amount");
	}

	/** Which columns of a row are not what they were, named by the row itself. */
	private static List<String> whatDiffers(Map<String, Object> was, Map<String, Object> now) {
		return now.entrySet().stream()
				.filter(one -> !Objects.equals(one.getValue(), was.get(one.getKey())))
				.map(Map.Entry::getKey)
				.sorted()
				.toList();
	}

	private MockHttpServletResponse change(String key, BigDecimal eur, BigDecimal rsd, String cookie)
			throws Exception {
		MockHttpServletRequestBuilder asking = put("/api/pricing/" + key).with(csrf())
				.contentType(MediaType.APPLICATION_JSON)
				.content(new ObjectMapper().writeValueAsString(new PricingWriteApi.Amounts(eur, rsd)));

		return http.perform(cookie == null ? asking
						: asking.cookie(new Cookie(SessionCookie.NAME, cookie)))
				.andReturn().getResponse();
	}

	/**
	 * The answer, with the amounts kept as decimals.
	 *
	 * <p>The default reader hands a JSON decimal back as a {@code double}, which loses the
	 * scale - and the scale is exactly what one assertion above is about.
	 * {@code PricingApiTest} builds its reader the same way and for the same reason.
	 */
	private static JsonNode read(MockHttpServletResponse answer) throws Exception {
		return JsonMapper.builder()
				.enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
				.build()
				.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	/**
	 * THE SEVEN KEYS IN THE ORDER THE LIST HAS THEM, which is what redovi se ne dodaju i ne
	 * brisu reads as when it is asked of a request rather than of a migration.
	 *
	 * <p>Every case that writes anything reads this before and after. One case of its own
	 * would say it on one path and leave every other path unmeasured, and a row that went
	 * missing on the path nobody covered is exactly what PDL:827 is about. The ORDER comes
	 * with it for nothing: a {@code sort_order} this route cannot reach is a
	 * {@code sort_order} that cannot move.
	 */
	private List<String> keysInOrder() {
		return db.sql("select key from price_row order by sort_order").query(String.class).list();
	}

	private List<String> keysOfKind(String kind) {
		return db.sql("select key from price_row where kind = ? order by sort_order")
				.param(kind).query(String.class).list();
	}

	/** One row of the price list, every column of it, read by whatever names the table has. */
	private Map<String, Object> rowOf(String key) {
		return db.sql("select * from price_row where key = ?").param(key).query().singleRow();
	}

	private Map<String, Object> paymentRow(long id) {
		return db.sql("select * from payment where id = ?").param(id).query().singleRow();
	}

	private List<BigDecimal> amountsOf(String key) {
		return db.sql("select eur, rsd from price_row where key = ?").param(key)
				.query((row, one) -> List.of(row.getBigDecimal(1), row.getBigDecimal(2)))
				.single();
	}

	private BigDecimal euroOf(String key) {
		return db.sql("select eur from price_row where key = ?").param(key)
				.query(BigDecimal.class).single();
	}

	private long idOf(String key) {
		return db.sql("select id from price_row where key = ?").param(key)
				.query(Long.class).single();
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

	/** @param memberNumber null for somebody who has never paid, which is who pays later */
	private long competitor(String referralSuffix, String memberNumber) {
		return db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni',"
						+ " 'Takmicar', 'M', ?, " + A_TOWN + ", null, null, 2027, false, ?,"
						+ " 'payment', ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(memberNumber, java.sql.Date.valueOf(LocalDate.parse("1990-05-05")),
						memberNumber != null, "00112233445566" + referralSuffix)
				.query(Long.class).single();
	}

	/**
	 * A payment already recorded, in the shape {@code PaymentApi} writes one.
	 *
	 * <p>The season is the one being paid for at the moment the fixture stands at, asked of
	 * {@link SeasonClock} rather than written down: {@code payment_one_a_season} is over the
	 * pair, and a year typed here would part company with the route the moment the fixture
	 * moved.
	 */
	private long payment(long competitor, String priceRow, BigDecimal amount, String currency,
			BigDecimal fee) {
		return db.sql("insert into payment (competitor_id, season, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by_name)"
						+ " values (?, ?, (select id from price_row where key = ?), ?, ?, ?, 'slip',"
						+ " 'recorded', ?, 'Probni Probic') returning id")
				.params(competitor, SeasonClock.seasonBeingPaidFor(IN_MARCH.atZone(SeasonClock.ZONE)),
						priceRow, amount, currency, fee, Timestamp.from(IN_MARCH))
				.query(Long.class).single();
	}
}

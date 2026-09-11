package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint the table of V16 carries, and the two things V16 changes about
 * what was already there.
 *
 * <p>The change matters more than the table. V7 made `member_number` NOT NULL and PDL
 * P8 says a number is handed out when a payment is recorded, so somebody who had
 * registered and not yet paid had nowhere to stand. The number is optional from here,
 * and the sentence that follows is the one every reader has to know: a row in
 * `competitor` is a person who REGISTERED, and a MEMBER is a row whose number is
 * there.
 *
 * <p>And the number is never handed out twice, which is a sequence rather than a
 * query: `max + 1` reads what is there, and what is there is missing exactly the
 * numbers of the people who asked to be deleted.
 */
class PaymentConstraintsTest extends DatabaseTest {

	record Violation(String constraint, String evidence, String sql) {

		static Violation of(String constraint, String sql) {
			return new Violation(constraint, constraint, sql);
		}

		static Violation notNull(String constraint, String column, String sql) {
			return new Violation(constraint, "column \"" + column + "\"", sql);
		}

		@Override
		public String toString() {
			return constraint + ": " + sql;
		}
	}

	/** The one table V16 adds. */
	static final List<String> TABLES = List.of("payment");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '001000')";
	private static final String AN_APPLICANT =
			"(select id from competitor where referral_code = '00112233445566e2')";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";
	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS = "competitor_id, season, reference, price_row_id, amount, currency,"
			+ " fee, method, state, recorded_at, recorded_by, recorded_by_name";

	private static String payment(String values) {
		return "insert into payment (" + COLUMNS + ") values (" + values + ")";
	}

	/** Waiting: no reference yet, because he has no number yet, and nobody has recognised it. */
	private static final String GOOD_AWAITED = payment(AN_APPLICANT + ", 2028, null, " + A_PRICE_ROW
			+ ", 35.00, 'EUR', 3.00, 'paypal', 'awaited', null, null, null");
	/** Recognised: it says when, and under whose name. */
	private static final String GOOD_RECORDED = payment(A_MEMBER + ", 2028, '20281000', " + A_PRICE_ROW
			+ ", 4200.00, 'RSD', 0, 'slip', 'recorded', " + AN_INSTANT + ", " + AN_ACCOUNT
			+ ", 'Blagajnik Probni'");
	/** Reversed: it happened, it says so, and the season is his no longer. */
	private static final String GOOD_REVERSED = payment(A_MEMBER + ", 2029, '20291000', " + A_PRICE_ROW
			+ ", 40.00, 'EUR', 3.00, 'card', 'reversed', " + AN_INSTANT + ", " + AN_ACCOUNT
			+ ", 'Blagajnik Probni'");

	/**
	 * A member with a number, somebody who has registered and has none, an account
	 * to recognise payments with, and one payment already waiting.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('001000', 'Probni', 'Platisa',"
				+ " 'M', date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566e1', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		/* And the row V16 makes possible: registered, no number, not a member yet. */
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (null, 'Probni', 'Prijavljeni',"
				+ " 'M', date '1993-03-03', " + A_TOWN + ", null, null, 2027, false, false, 'payment',"
				+ " '00112233445566e2', null, '', false, 'none', 'Otac', 'Ulica 2', 'L',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql("insert into account (email, role_id) values ('blagajnik@primer.rs',"
				+ " (select id from role where code = 'moderator'))").update();

		db.sql(payment(A_MEMBER + ", 2027, '20271000', " + A_PRICE_ROW + ", 35.00, 'EUR', 3.00, 'card',"
				+ " 'recorded', " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik Probni'")).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("payment_id_not_null", "id",
						"insert into payment (id, " + COLUMNS + ") values (null, " + A_MEMBER + ", 2028,"
								+ " null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card', 'awaited', null, null,"
								+ " null)"),
				Violation.of("payment_pk",
						"insert into payment (id, " + COLUMNS + ") select id, " + A_MEMBER + ", 2028,"
								+ " null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card', 'awaited', null, null,"
								+ " null from payment limit 1"),

				Violation.notNull("payment_competitor_id_not_null", "competitor_id",
						payment("null, 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card', 'awaited',"
								+ " null, null, null")),
				Violation.of("payment_competitor_fk",
						payment("999999, 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card', 'awaited',"
								+ " null, null, null")),

				Violation.notNull("payment_season_not_null", "season",
						payment(A_MEMBER + ", null, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'awaited', null, null, null")),
				Violation.of("payment_season_not_before_the_league",
						payment(A_MEMBER + ", 2026, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'awaited', null, null, null")),
				/* One payment per member per season: the probe already holds 2027 for him. */
				Violation.of("payment_one_a_season",
						payment(A_MEMBER + ", 2027, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'awaited', null, null, null")),

				/* THE REFERENCE, which a machine reads off a bank statement. */
				Violation.of("payment_reference_shape",
						payment(A_MEMBER + ", 2028, '2028-1000', " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'awaited', null, null, null")),
				Violation.of("payment_reference_unique",
						payment(A_MEMBER + ", 2028, '20271000', " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'awaited', null, null, null")),

				Violation.notNull("payment_price_row_id_not_null", "price_row_id",
						payment(A_MEMBER + ", 2028, null, null, 35, 'EUR', 0, 'card', 'awaited', null,"
								+ " null, null")),
				Violation.of("payment_price_row_fk",
						payment(A_MEMBER + ", 2028, null, 999999, 35, 'EUR', 0, 'card', 'awaited', null,"
								+ " null, null")),

				Violation.notNull("payment_amount_not_null", "amount",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", null, 'EUR', 0, 'card',"
								+ " 'awaited', null, null, null")),
				Violation.of("payment_amount_positive",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 0, 'EUR', 0, 'card',"
								+ " 'awaited', null, null, null")),

				Violation.notNull("payment_currency_not_null", "currency",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, null, 0, 'card',"
								+ " 'awaited', null, null, null")),
				Violation.of("payment_currency_known",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'USD', 0, 'card',"
								+ " 'awaited', null, null, null")),

				Violation.notNull("payment_fee_not_null", "fee",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', null, 'card',"
								+ " 'awaited', null, null, null")),
				Violation.of("payment_fee_not_negative",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', -1, 'card',"
								+ " 'awaited', null, null, null")),
				/* A fee on a dinar payment, which covers an intermediary that account does not
				   have. The owner was explicit: "dinarska uplata je nema". */
				Violation.of("payment_only_euro_carries_a_fee",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 4200, 'RSD', 3, 'slip',"
								+ " 'awaited', null, null, null")),

				Violation.notNull("payment_method_not_null", "method",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, null,"
								+ " 'awaited', null, null, null")),
				Violation.of("payment_method_known",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'bitcoin',"
								+ " 'awaited', null, null, null")),

				Violation.notNull("payment_state_not_null", "state",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card', null,"
								+ " null, null, null")),
				/* A fourth state, written as a RECOGNISED row so that the two biconditionals
				   below are satisfied and this is the only thing it breaks. */
				Violation.of("payment_state_known",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'pending', " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik Probni'")),

				/* RECOGNISED SAYS WHEN AND BY WHOM, both directions of each. */
				Violation.of("payment_recognised_says_when",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'recorded', null, " + AN_ACCOUNT + ", 'Blagajnik Probni'")),
				Violation.of("payment_recognised_says_when",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'awaited', " + AN_INSTANT + ", null, null")),
				Violation.of("payment_recognised_says_who",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'recorded', " + AN_INSTANT + ", " + AN_ACCOUNT + ", null")),
				Violation.of("payment_recognised_says_who",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'awaited', null, null, 'Blagajnik Probni'")),
				Violation.of("payment_recorded_by_name_not_blank",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'recorded', " + AN_INSTANT + ", " + AN_ACCOUNT + ", '   '")),
				Violation.of("payment_recorded_by_fk",
						payment(A_MEMBER + ", 2028, null, " + A_PRICE_ROW + ", 35, 'EUR', 0, 'card',"
								+ " 'recorded', " + AN_INSTANT + ", 999999, 'Blagajnik Probni'")));
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/** The floor under the list above, read out of the database. */
	@Test
	void everyConstraintOnThePaymentHasARowThatBreaksIt() {
		String tables = TABLES.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));
		String relations = " = any (array[" + tables + "]::regclass[])";

		List<String> declared = db
				.sql("select con.conname from pg_constraint con where con.conrelid" + relations
						+ " union all "
						+ "select index.relname from pg_index idx join pg_class index on index.oid = idx.indexrelid"
						+ " where idx.indrelid" + relations + " and idx.indisunique"
						+ " and not exists (select 1 from pg_constraint own where own.conindid = idx.indexrelid)")
				.query(String.class)
				.list();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	static List<String> legitimateRows() {
		return List.of(GOOD_AWAITED, GOOD_RECORDED, GOOD_REVERSED);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * SOMEBODY WHO HAS REGISTERED AND NOT PAID CAN EXIST, which is the whole of what
	 * V16 changes about V7.
	 *
	 * <p>The probe writes him, so this reads him back and says what he is: a row in
	 * `competitor` with no number. Before this migration that insert was refused
	 * outright, and PDL P8's "registrovan a neplacen clan nema clanski broj" had
	 * nowhere to be true.
	 */
	@Test
	void aPersonMayRegisterBeforeHeHasANumber() {
		assertThat(db.sql("select count(*) from competitor where member_number is null")
				.query(Long.class)
				.single())
				.as("somebody who registered and has not paid cannot be written at all")
				.isOne();

		assertThat(db.sql("select count(*) from competitor").query(Long.class).single()).isEqualTo(2L);
	}

	/**
	 * And two of them may exist at once, which a unique key over the number would
	 * refuse if it treated nulls as equal.
	 *
	 * <p>Registration opens on 1 October and the money arrives over days: on the
	 * morning of the second day there are many of these and not one.
	 */
	@Test
	void manyPeopleMayBeWaitingForANumberAtOnce() {
		assertThat(db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (null, 'Treci',"
				+ " 'Prijavljeni', 'F', date '1995-05-05', " + A_TOWN + ", null, null, 2027, false, false,"
				+ " 'payment', '00112233445566e3', null, '', false, 'none', 'Otac', 'Ulica 3', 'S',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update())
				.as("a second person could not wait for a number while the first was waiting")
				.isOne();
	}

	/**
	 * The number sequence only ever goes up, and deleting the member who held the
	 * highest one does not give it back.
	 *
	 * <p>PDL P8, 31.07.2026: "Sledeci broj je jedan iznad NAJVISEG IKAD dodeljenog,
	 * nikad prvi slobodan", and the reason is P23: a member may ask to be deleted,
	 * and his number stands in old results and on a printed card. This is why it is a
	 * sequence and not `max + 1`, and it is the one thing about the number that a
	 * query cannot say.
	 */
	@Test
	void theNumberSequenceNeverHandsOneOutTwice() {
		long first = db.sql("select nextval('member_number_seq')").query(Long.class).single();
		long second = db.sql("select nextval('member_number_seq')").query(Long.class).single();

		assertThat(second).as("the sequence stood still").isEqualTo(first + 1);

		db.sql("delete from competitor where member_number = '001000'").update();

		assertThat(db.sql("select nextval('member_number_seq')").query(Long.class).single())
				.as("deleting a member put a number back into circulation")
				.isEqualTo(second + 1);
	}

	/**
	 * A payment does not outlive the person it was for, and the price row it names
	 * cannot be deleted while it does.
	 */
	@Test
	void thePaymentGoesWithThePersonAndHoldsThePriceRow() {
		assertThat(db.sql("select count(*) from payment").query(Long.class).single()).isOne();

		assertThatThrownBy(() -> db.sql("delete from price_row where id = " + A_PRICE_ROW).update())
				.as("a price row left while a payment still named it")
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("payment_price_row_fk");
	}

	/**
	 * And the account that recognised a payment may go, and the payment keeps the
	 * name it was recognised under.
	 *
	 * <p>The same finding a round on 11.09.2026 returned against V9: a check that
	 * demanded the account be there for every recognised row would have made the
	 * delete fail outright, which is not what ON DELETE SET NULL says and not what
	 * PDL P23 allows. The tie is to the NAME, so the two do not disagree.
	 */
	@Test
	void theCashierMayGoAndThePaymentKeepsHisName() {
		assertThat(db.sql("delete from account where email = 'blagajnik@primer.rs'").update())
				.as("somebody who has recognised a payment can no longer have his account deleted")
				.isOne();

		assertThat(db
				.sql("select recorded_by_name || ' | ' || coalesce(recorded_by::text, 'bez naloga')"
						+ " from payment")
				.query(String.class)
				.single())
				.as("the payment lost the name it was recognised under")
				.isEqualTo("Blagajnik Probni | bez naloga");
	}
}

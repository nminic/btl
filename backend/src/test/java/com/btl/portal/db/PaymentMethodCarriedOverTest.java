package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V39 DOES TO THE PAYMENTS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists, and it is the whole reason rather than a formality.</b> V39 renames the
 * method {@code slip} to {@code ips} and then narrows the constraint to two words. After it,
 * {@code 'slip'} CANNOT BE WRITTEN AT ALL - so no case that starts from a migrated database can
 * produce the row that {@code update} acts on, and deleting the statement leaves the whole suite
 * green. The schema half is measured by {@code PaymentConstraintsTest}, which holds a row for each
 * of the three words that left; this file is the only thing in the portal that can see the data
 * half. That is the class which took QA down for 7 hours and 50 minutes on 27.09.2026, found there
 * and not here.
 *
 * <p><b>How the two halves are made.</b> V16's own constraint is put back as a fixture, the rows a
 * portal really holds are written, and then THE MIGRATION ITSELF is executed - the file Flyway
 * resolved and applied, not a copy of its statements ({@link DatabaseTest#migrationSql}). Everything
 * happens inside the test's transaction and is rolled back. The shape is
 * {@link MembershipCarriedOverTest}'s, which is where it was written.
 *
 * <p><b>WHY RESTATING V16'S FOUR WORDS HERE CANNOT GO STALE</b>, which is the question a
 * hand-written expression in a fixture has to answer. V16 is IMMUTABLE (ADL A2) and
 * {@code MigrationsAreImmutableTest} pins its checksum in both directions, so the line being put
 * back cannot change under this file. And it has to be put back rather than simply dropped: V39
 * begins by DROPPING a constraint of that name, so a fixture that left none would fail on the
 * migration's first statement and never reach the one being measured.
 *
 * <p><b>AND THE PROOF THAT THE UNDO WAS COMPLETE IS BEHAVIOUR AND NOT A QUERY OVER THE
 * CATALOGUE:</b> the fixture below writes a row whose method is {@code slip}, and the schema V39
 * leaves behind refuses exactly that. If the undo had not happened, {@link #whatThePortalHolds}
 * would fail rather than let anything here pass quietly.
 */
class PaymentMethodCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** The man whose dinar payment was recorded under the old name, and has to come out renamed. */
	private static final String PAID_ON_A_SLIP = "20271001";

	/**
	 * A SECOND ROW UNDER THE OLD NAME, so that the one above is not the only row of its kind.
	 *
	 * <p>Without it a carry that renamed exactly one row - the first it came to, the one with the
	 * lowest id - would be green, and {@code update ... where method = 'slip'} is a statement about
	 * every such row rather than about one.
	 */
	private static final String ALSO_PAID_ON_A_SLIP = "20271002";

	/** And one that was never called {@code slip}, which the migration must leave exactly as it is. */
	private static final String PAID_THROUGH_PAYPAL = "20271003";

	/**
	 * V16's constraint, put back the way V16 wrote it, so that V39 has the schema it was written
	 * against.
	 */
	private void theSchemaAsItStoodBeforeV39() {
		jdbc.execute("alter table payment drop constraint payment_method_known");
		jdbc.execute("alter table payment add constraint payment_method_known"
				+ " check (method in ('slip', 'card', 'paypal', 'sepa'))");
	}

	private void competitor(String number, String last, String code) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true,"
						+ " 'payment', ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, last, code).update();
	}

	/**
	 * One recognised payment, with the method written out rather than assumed.
	 *
	 * <p>The amount and the currency travel with the method so that no row in this fixture is the
	 * only one of its kind in more than the one way it is meant to be: the two on a slip are dinar
	 * payments with no fee, the PayPal one is a euro payment with the processing fee on it, which is
	 * what {@code payment_only_euro_carries_a_fee} allows and what the portal really holds.
	 */
	private void payment(String number, String reference, String method, String amount,
			String currency, String fee) {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name, received)"
						+ " values ("
						+ " (select id from competitor where member_number = ?), 2027, ?, " + A_PRICE_ROW
						+ ", " + amount + ", '" + currency + "', " + fee + ", ?, 'recorded',"
						+ " timestamptz '2026-10-05 09:00:00+00', " + AN_ACCOUNT + ", 'Blagajnik Probni',"
						+ " " + amount + " + " + fee + ")")
				.params(number, reference, method).update();
	}

	/**
	 * What each payment says it was, read back BY ITS REFERENCE.
	 *
	 * <p>The reference is the digits off a bank statement and belongs to one payment and to nothing
	 * else in the schema, which is why it names the row here instead of {@code id} or
	 * {@code limit 1}: an assertion that read the method off whichever row the planner returned
	 * first would be satisfied by the row the migration was never supposed to touch.
	 */
	private List<String> methodsWritten() {
		return db.sql("select reference || ' ' || method from payment order by reference")
				.query(String.class).list();
	}

	/**
	 * THREE RECOGNISED PAYMENTS OF THREE PEOPLE, TWO OF THEM UNDER THE NAME V39 RETIRES.
	 *
	 * <p>Three people rather than one man paying three times, because {@code payment_one_a_season} is
	 * over the member and the season and a season typed per row would be a second thing telling the
	 * rows apart.
	 */
	@BeforeEach
	void whatThePortalHolds() {
		theSchemaAsItStoodBeforeV39();

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
				+ " 'Probic', 'blagajnik@primer.rs', (select id from role where code = 'moderator'))")
				.update();

		competitor("001001", "Uplatnica", "00112233445566a1");
		competitor("001002", "Uplatnica Druga", "00112233445566a2");
		competitor("001003", "Pejpal", "00112233445566a3");

		payment("001001", PAID_ON_A_SLIP, "slip", "4200.00", "RSD", "0");
		payment("001002", ALSO_PAID_ON_A_SLIP, "slip", "4200.00", "RSD", "0");
		payment("001003", PAID_THROUGH_PAYPAL, "paypal", "35.00", "EUR", "3.00");
	}

	/**
	 * EVERY PAYMENT MADE ON A SLIP COMES OUT CALLED {@code ips}, AND NOTHING ELSE MOVES.
	 *
	 * <p>Both halves in one list. Deleting the {@code update} from the migration makes it stop
	 * instead - the narrowed constraint would meet two rows it refuses - and renaming one row rather
	 * than every one leaves the second slip behind. Rewriting every row's method to {@code ips}
	 * takes the PayPal payment with it.
	 *
	 * <p><b>AND IT IS THE ONLY THING THAT MEASURES WHERE THE RENAME STANDS AMONG V39'S THREE
	 * STATEMENTS, which it found on its first run rather than being written to confirm.</b> The rename
	 * has exactly one legal position, between the {@code drop} and the {@code add}, and both ways of
	 * moving it fail differently: above the {@code drop} it breaks V16's rule because {@code ips} was
	 * never one of V16's four words, and below the {@code add} it breaks V39's own rule because
	 * {@code slip} is not one of its two. On an empty table all three orders succeed, so no case
	 * starting from a migrated database can tell them apart - and the wrong one stops Flyway on the
	 * first real database it meets, which is where V35 was found on 27.09.2026.
	 */
	@Test
	void everyPaymentMadeOnASlipComesOutCalledIpsAndNothingElseMoves() {
		jdbc.execute(migrationSql("39"));

		assertThat(methodsWritten())
				.as("a payment recorded under the old name did not come out renamed, or one that was"
						+ " never called slip was renamed along with them")
				.containsExactly(PAID_ON_A_SLIP + " ips", ALSO_PAID_ON_A_SLIP + " ips",
						PAID_THROUGH_PAYPAL + " paypal");
	}

	/**
	 * A PAYMENT RECORDED AS A CARD STOPS THE MIGRATION RATHER THAN BEING GUESSED AT.
	 *
	 * <p><b>This is what makes the constraint a plain one and not {@code not valid}, and it is the
	 * decision V39 writes down.</b> There is no honest word to move a card payment to: {@code ips}
	 * would say it arrived on a dinar slip and {@code paypal} would name an intermediary that never
	 * saw it. So the migration stops and asks a person. Measured on QA on 27.09.2026 there is no such
	 * row to stop - the table is empty - and this case is what says what would happen if there were.
	 *
	 * <p>{@code sepa} is not given a case of its own: it would measure the same statement about the
	 * same constraint, and the three words that left each have their own row in
	 * {@code PaymentConstraintsTest} where that axis belongs.
	 */
	@Test
	void apaymentRecordedAsACardStopsTheMigration() {
		/* A fourth man rather than a second payment for one of the three: `payment_one_a_season` is
		   over the member and the season, so the row would have been refused by the fixture and this
		   case would have measured that instead of the migration. */
		competitor("001004", "Kartica", "00112233445566a4");
		payment("001004", "20271004", "card", "40.00", "EUR", "3.00");

		assertThatThrownBy(() -> jdbc.execute(migrationSql("39")))
				.as("a card payment was quietly given one of the two new words, or the constraint was"
						+ " written so that it does not look at the rows already there")
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("payment_method_known");
	}
}

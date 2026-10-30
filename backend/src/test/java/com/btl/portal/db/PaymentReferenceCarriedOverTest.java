package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V68 DOES TO THE PAYMENTS THAT ARE ALREADY THERE, run against a real database, and what it
 * refuses from then on.
 *
 * <p><b>Why this exists, and it is the whole reason rather than a formality.</b> V68 narrows a
 * payment's reference from "seven digits or more" to exactly ten. Every test starts from an empty
 * database, so a constraint added over the rows that stand is measured over no rows at all: a plain
 * constraint and a {@code not valid} one are the same constraint there, and a migration that stopped
 * Flyway on the first old reference it met would be green. That is the class which took QA down for
 * 7 hours and 50 minutes on 27.09.2026 (CLAUDE.md, section 11), found there and not here.
 *
 * <p><b>How the two halves are made.</b> V16's constraint is put back as a fixture, the rows a portal
 * may really hold are written, and then THE MIGRATION ITSELF is executed - the file Flyway resolved
 * and applied, not a copy of its statements ({@link DatabaseTest#migrationSql}). Everything happens
 * inside the test's transaction and is rolled back. The shape is {@link MembershipCarriedOverTest}'s
 * and {@link PaymentMethodCarriedOverTest}'s, which is where it was written.
 *
 * <p><b>WHY RESTATING V16'S RULE HERE CANNOT GO STALE.</b> V16 is IMMUTABLE (ADL A2) and
 * {@code MigrationsAreImmutableTest} pins its checksum in both directions, so the line being put back
 * cannot change under this file. It has to be put back rather than simply dropped: V68 begins by
 * DROPPING a constraint of that name, so a fixture that left none would fail on the migration's first
 * statement and never reach the one being measured.
 *
 * <p><b>AND THE PROOF THAT THE UNDO WAS COMPLETE IS BEHAVIOUR AND NOT A QUERY OVER THE CATALOGUE:</b>
 * the fixture writes rows of eight and of seven digits, which the schema V68 leaves behind refuses
 * for any NEW row. If the undo had not happened, {@link #whatThePortalMayHold} would fail on its
 * first insert rather than let anything here pass quietly.
 */
class PaymentReferenceCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** The reference of the old shape most likely to stand: the season and the number run together. */
	private static final String AN_EIGHT_DIGIT_ONE = "20271001";

	/** And the shortest V16 took, so the migration is met by the whole of what it used to allow. */
	private static final String A_SEVEN_DIGIT_ONE = "2027100";

	/** One that already has the new shape, which the migration must leave exactly as it is. */
	private static final String A_TEN_DIGIT_ONE = "2027001003";

	/**
	 * V16's constraint, put back the way V16 wrote it, so that V68 has the schema it was written
	 * against.
	 */
	private void theSchemaAsItStoodBeforeV68() {
		jdbc.execute("alter table payment drop constraint payment_reference_shape");
		jdbc.execute("alter table payment add constraint payment_reference_shape"
				+ " check (reference is null or reference ~ '^[0-9]{7,}$')");
	}

	private void competitor(String number, String last, String code) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, true,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, last, code).update();
	}

	/**
	 * One recognised payment of a member, with the reference written out as given, or no reference at
	 * all when the argument is null.
	 */
	private void payment(String number, String reference) {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name, received)"
						+ " values ("
						+ " (select id from competitor where member_number = ?), 2027, ?, " + A_PRICE_ROW
						+ ", 4200.00, 'RSD', 0, 'ips', 'recorded',"
						+ " timestamptz '2026-10-05 09:00:00+00', " + AN_ACCOUNT
						+ ", 'Blagajnik Probni', 4200.00)")
				.params(number, reference).update();
	}

	/**
	 * What each payment says its reference is, in the order of the member numbers, so the list names
	 * the rows by the people they belong to and not by whichever the planner returns first. A payment
	 * with no reference reads {@code -}.
	 */
	private List<String> referencesHeld() {
		return db.sql("select c.member_number || ' ' || coalesce(p.reference, '-') from payment p"
						+ " join competitor c on c.id = p.competitor_id order by c.member_number")
				.query(String.class).list();
	}

	/**
	 * FOUR PAYMENTS OF FOUR PEOPLE: ONE EIGHT DIGITS, ONE SEVEN, ONE TEN, AND ONE WITH NO REFERENCE.
	 *
	 * <p>Four people rather than one man paying four times, because {@code payment_one_a_season} is
	 * over the member and the season and a season typed per row would be a second thing telling the
	 * rows apart. The eight and the seven digit rows are the shapes the old rule took and the new one
	 * does not; the ten digit and the empty one are the ones the migration has nothing to say about.
	 */
	@BeforeEach
	void whatThePortalMayHold() {
		theSchemaAsItStoodBeforeV68();

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
				+ " 'Probic', 'blagajnik@primer.rs', (select id from role where code = 'moderator'))")
				.update();

		competitor("001001", "Osam", "00112233445566a1");
		competitor("001002", "Sedam", "00112233445566a2");
		competitor("001003", "Deset", "00112233445566a3");
		competitor("001004", "Nista", "00112233445566a4");

		payment("001001", AN_EIGHT_DIGIT_ONE);
		payment("001002", A_SEVEN_DIGIT_ONE);
		payment("001003", A_TEN_DIGIT_ONE);
		payment("001004", null);
	}

	/**
	 * THE MIGRATION PASSES OVER A DATABASE THAT HOLDS REFERENCES OF THE OLD SHAPE, AND LEAVES EVERY ONE
	 * OF THEM AS IT WAS.
	 *
	 * <p>Both halves in one list. A constraint added without {@code not valid} stops here with
	 * {@code payment_reference_shape} violated by some row, which is exactly what stopped Flyway on QA
	 * for V35. A migration that "fixed" the old rows (padded them to ten digits, or set them to null)
	 * would invent a reference nobody wrote, and the list below would not read the same.
	 *
	 * <p><b>The catalogue is asked as well</b>, because the header of V68 makes a claim about it: the
	 * rule was added over rows it did not check, and says so. A rule that quietly came out validated
	 * could only have done so over no old rows, so it would be a rule this test never met.
	 */
	@Test
	void theRuleArrivesOverReferencesOfTheOldShapeAndTouchesNoneOfThem() {
		jdbc.execute(migrationSql("68"));

		assertThat(referencesHeld())
				.as("a reference of the old shape was changed, padded or removed by the migration, or"
						+ " the migration stopped over it")
				.containsExactly("001001 " + AN_EIGHT_DIGIT_ONE, "001002 " + A_SEVEN_DIGIT_ONE,
						"001003 " + A_TEN_DIGIT_ONE, "001004 -");

		assertThat(db.sql("select convalidated from pg_constraint where conname = ?"
						+ " and conrelid = 'payment'::regclass")
				.param("payment_reference_shape").query(Boolean.class).single())
				.as("the rule was added over the rows already there as one that checks them, which a"
						+ " database holding an old reference cannot take")
				.isFalse();
	}

	/**
	 * A NEW PAYMENT WHOSE REFERENCE IS NOT EXACTLY TEN DIGITS IS REFUSED BY THE DATABASE, whichever
	 * way it misses.
	 *
	 * <p>This is the half that a constraint {@code not valid} can lose without anybody noticing: the
	 * word means "do not look at the rows that stand", and a migration that ended with no rule at all
	 * would pass the case above. The rows written here are NEW, written after the migration ran, and
	 * the refusal has to name {@code payment_reference_shape} and nothing else, so the case is not
	 * satisfied by a different constraint breaking.
	 *
	 * <p>One text per invocation, because a refused statement leaves a PostgreSQL transaction unable to
	 * answer anything else: nine and eleven digits are the decision itself ("devet ili jedanaest"),
	 * eight and seven are what V16 took and a new row may no longer have, a letter in ten characters is
	 * what a rule that only measured length would let in, and three thousand digits is what the rule
	 * of seven or more let through to the unique index.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"202700001", "20270000011", "20271001", "2027100", "202700000a"})
	void aNewReferenceThatIsNotExactlyTenDigitsIsRefusedAfterTheMigration(String reference) {
		jdbc.execute(migrationSql("68"));
		competitor("001005", "Novi", "00112233445566a5");

		assertThatThrownBy(() -> payment("001005", reference))
				.as("a new payment with the reference '%s' was written", reference)
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("payment_reference_shape");
	}

	@Test
	void aNewReferenceOfThreeThousandDigitsIsRefusedAfterTheMigration() {
		jdbc.execute(migrationSql("68"));
		competitor("001005", "Novi", "00112233445566a5");

		assertThatThrownBy(() -> payment("001005", "1234567890".repeat(300)))
				.as("a new payment with a reference of three thousand digits was written")
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("payment_reference_shape");
	}

	/**
	 * AND A NEW PAYMENT WITH EXACTLY TEN DIGITS, OR WITH NONE, IS WRITTEN, which is the other half of
	 * the rule and the one a rule too narrow fails: the migration must not have closed the door it was
	 * written to keep open.
	 */
	@Test
	void aNewReferenceOfExactlyTenDigitsAndNoReferenceAreBothWrittenAfterTheMigration() {
		jdbc.execute(migrationSql("68"));
		competitor("001005", "Novi", "00112233445566a5");
		competitor("001006", "Nova", "00112233445566a6");

		payment("001005", "2027000042");
		payment("001006", null);

		assertThat(referencesHeld())
				.as("a payment with a reference of exactly ten digits, or with none, was not kept")
				.contains("001005 2027000042", "001006 -");
	}
}

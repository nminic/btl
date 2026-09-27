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
 * WHAT V40 DOES TO THE PRICE LIST THAT IS ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V40 adds one {@code check} and adds no column and no row, so the schema
 * afterwards is the whole of what an ordinary case can see - and a constraint that stops Flyway on a
 * row already standing looks identical, from inside the suite, to one that applies cleanly. Every test
 * starts from a database this suite built, and the rows that could break this one are rows an
 * ADMINISTRATOR types through {@code PUT /api/pricing/{key}} months after the migration was written.
 * That is the class which took QA down for 7 hours and 50 minutes on 27.09.2026.
 *
 * <p><b>How it is made.</b> What V40 created is taken away - the one constraint - the amounts a real
 * price list could be carrying are written over the rows V4 shipped, and then THE MIGRATION ITSELF is
 * executed, the file Flyway resolved and applied rather than a copy of its statements
 * ({@link DatabaseTest#migrationSql}). Everything happens inside the test's transaction and is rolled
 * back. The shape is {@link MembershipCarriedOverTest}'s, which is where it was written.
 *
 * <p><b>AND THE ROWS ARE NOT WRITTEN FRESH HERE, WHICH IS THE POINT OF THE FILE.</b> V4 inserts seven
 * and nothing has inserted or deleted one since; {@code PUT /api/pricing/{key}} carries one statement
 * and it is an {@code update}. So the price list is a codebook whose rows do not change and whose
 * AMOUNTS do, and „a row that was already there" means exactly one thing: one of those seven with an
 * amount somebody set. That is what the cases below set.
 *
 * <p><b>The proof that the undo was complete is behaviour and not a query over the catalogue:</b>
 * {@link #arowLeftAtNoughtInOneCurrencyStopsTheMigration} writes a row the schema V40 leaves behind
 * refuses. If the constraint were still standing, the fixture would fail rather than let the case pass.
 */
class PriceRowCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/** The one thing V40 creates, taken away so it has something to create. */
	private void whatV40Creates() {
		jdbc.execute("alter table price_row drop constraint price_row_free_in_both_or_priced_in_both");
	}

	@BeforeEach
	void theSchemaAsItStoodBeforeV40() {
		whatV40Creates();
	}

	private void theMigration() {
		jdbc.execute(migrationSql("40"));
	}

	private void priced(String key, String eur, String rsd) {
		db.sql("update price_row set eur = " + eur + ", rsd = " + rsd + " where key = ?")
				.param(key).update();
	}

	/** Every row of the list, by name, so that a rule which moved an amount would be seen. */
	private List<String> thePriceList() {
		return db.sql("select key || ' ' || eur || '/' || coalesce(rsd::text, 'bez dinara')"
						+ " from price_row order by key")
				.query(String.class).list();
	}

	/**
	 * THE SEVEN ROWS THE PORTAL SHIPS SURVIVE IT, AND THE FEE SURVIVES IT TOO.
	 *
	 * <p>This is the measurement that was taken off QA before the constraint was written and is kept
	 * here so nobody has to take it again: seven rows, not one at nought, and the processing fee the
	 * only one with no dinar side. The fee is what makes this case say something rather than nothing -
	 * a rule written without its exemption, `(eur = 0) = (rsd = 0)` with the `rsd is null or` taken
	 * off, still lets that row through on a NULL, but a rule written as `rsd is not null and ...`
	 * stops the migration here and nowhere else in the suite.
	 *
	 * <p>And the amounts are read back rather than counted, so that a migration which somehow moved one
	 * would be seen as a different list instead of as the same number of rows.
	 */
	@Test
	void thesevenRowsThePortalShipsSurviveIt() {
		theMigration();

		assertThat(thePriceList())
				.as("the price list the portal ships did not come through the migration unchanged")
				.containsExactly("early 35.00/4200.00", "junior 20.00/2400.00", "late 50.00/6000.00",
						"processing 3.00/bez dinara", "referral 5.00/600.00", "regular 40.00/4800.00",
						"season 40.00/4800.00");
	}

	/**
	 * A ROW LEFT AT NOUGHT IN ONE CURRENCY STOPS THE MIGRATION.
	 *
	 * <p><b>This is what makes the constraint a plain one and not {@code not valid}</b>, and it is the
	 * half of V40 that no row written after it can state. The amount is the one that was measured:
	 * 0 EUR / 600 RSD for a membership is reachable through the pricing screen and breaks both roads to
	 * an activation, because `balance_entry_a_membership_takes` (V38) requires a spend to move both
	 * currencies strictly.
	 *
	 * <p><b>The row is `regular` and not the row this file's other case leans on</b>, and it is a
	 * PERIOD, so that what stops the migration is this constraint rather than a kind of row the list
	 * has only one of. Measured on QA on 27.09.2026 there is no such row to stop; this case is what
	 * says what would happen if somebody typed one before the migration ran.
	 */
	@Test
	void arowLeftAtNoughtInOneCurrencyStopsTheMigration() {
		priced("regular", "0", "600");

		assertThatThrownBy(this::theMigration)
				.as("a price row at nought in one currency alone was let through, so the constraint"
						+ " does not look at the rows already there")
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("price_row_free_in_both_or_priced_in_both");
	}

	/**
	 * AND THE OTHER WAY ROUND STOPS IT TOO, which is a separate row an administrator can type.
	 *
	 * <p>Nought in dinars with a euro price is the same fault seen from the other side, and it is
	 * measured separately here for the reason V40 is written as an equivalence: a rule that only asked
	 * „is the euro price nought" would pass this one.
	 */
	@Test
	void arowLeftAtNoughtInDinarsAloneStopsItAsWell() {
		priced("regular", "40", "0");

		assertThatThrownBy(this::theMigration)
				.as("a price row at nought in dinars alone was let through, so the rule asks about one"
						+ " currency rather than about the two disagreeing")
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("price_row_free_in_both_or_priced_in_both");
	}

	/**
	 * AND A ROW ALREADY FREE IN BOTH CURRENCIES COMES THROUGH, which is the decision rather than its
	 * refusal.
	 *
	 * <p>PDL 20b allows a row that costs nothing; it refuses a row that costs nothing in one currency
	 * only. Without this case the constraint could have been written to demand an amount in both, the
	 * two cases above would still be red for the right reason, and a migration that took the
	 * association's free membership away from it would be green.
	 *
	 * <p>The row read back is named, so a migration that dropped a different row's amount to nought
	 * would show up here rather than in a count.
	 */
	@Test
	void arowAlreadyFreeInBothCurrenciesComesThrough() {
		priced("regular", "0", "0");

		theMigration();

		assertThat(thePriceList())
				.as("a row free in both currencies was refused by the migration, or somebody else's"
						+ " amount moved with it")
				.contains("regular 0.00/0.00", "season 40.00/4800.00");
	}
}

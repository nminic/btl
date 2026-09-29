package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V49 DOES TO A PRICE LIST AND A SET OF PAGES THAT ARE ALREADY THERE, against a real
 * database.
 *
 * <p><b>Why this exists.</b> V49 adds no column and no constraint, so the schema afterwards is
 * the whole of what an ordinary case can see, and every other case in this suite starts from a
 * database these migrations have just built - where the rows are exactly what V4, V34, V24, V43
 * and V46 wrote. The rows that could break this migration are rows a PERSON changed months
 * after it was written. That is the class which took QA down for 7 hours and 50 minutes on
 * 27.09.2026, and it is invisible to every other tool we have.
 *
 * <p><b>WHICH ROW CAN REALLY HAVE MOVED, and it is one.</b> {@code PUT /api/pricing/{key}}
 * carries a single statement and it writes {@code label}, {@code eur} and {@code rsd} - not
 * {@code day_from} and not {@code day_to} ({@code PricingWriteApi}). No route writes
 * {@code static_page_section} at all. So „a row that was already there" means a price row whose
 * NAME an administrator has typed over, and that is what the first case below sets.
 *
 * <p><b>And it is the case the branch could not measure any other way.</b> The intention was to
 * read the four labels off the running QA database before writing the migration; QA sits behind
 * HTTP basic authentication at the edge and production's backend was answering 502 on every
 * {@code /api/*} at the time, so neither could be read. Rather than guess, the migration was
 * written to be right either way and this is what says so: a label somebody has rewritten comes
 * out naming the new period, exactly as the seeded one does. What that costs - his wording is
 * discarded - is stated in V49's own header, because it is a decision and not a detail.
 *
 * <p><b>How it is made.</b> What V49 wrote is put back to what stood before it - the days and
 * labels of V4 and V34, and the page sentences of V24, V43 and V46 - and then THE MIGRATION
 * ITSELF is executed, the file Flyway resolved rather than a copy of its statements
 * ({@link DatabaseTest#migrationSql}). Everything happens inside the test's transaction and is
 * rolled back. The shape is {@link PriceRowCarriedOverTest}'s, which is where it was written.
 *
 * <p><b>The undo is proved by behaviour rather than by a query over the catalogue:</b> every
 * case here first asserts that the OLD value is what it just wrote, so a fixture that failed to
 * put the row back fails there instead of passing on a row the migration never had to touch.
 */
class TheSellingYearCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/** The days and the names as V4 and V34 shipped them, which is what a real database has. */
	private void thePriceListAsItStoodBeforeV49() {
		jdbc.execute("update price_row set day_from = '10-01', day_to = '10-05',"
				+ " label = '1. do 5. oktobra' where key = 'early'");
		jdbc.execute("update price_row set day_from = '10-06', day_to = '11-30',"
				+ " label = '6. oktobra do 30. novembra' where key = 'regular'");
		jdbc.execute("update price_row set day_to = '09-30',"
				+ " label = '1. januara do 30. septembra' where key = 'season'");
	}

	private void theMigration() {
		jdbc.execute(migrationSql("49"));
	}

	private List<String> daysOf(String key) {
		return db.sql("select day_from, day_to, label from price_row where key = ?")
				.param(key)
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getString(3)))
				.single();
	}

	/**
	 * THE PERIOD MOVES OVER ROWS THAT WERE ALREADY THERE.
	 *
	 * <p>All three rows that have days, because the one that is easiest to forget is the third:
	 * the running season is the row the owner EXTENDED rather than moved, and it is the one
	 * that keeps the four periods tiling the year.
	 */
	@Test
	void theDaysMoveOnAPriceListThatWasAlreadyStanding() {
		thePriceListAsItStoodBeforeV49();

		assertThat(daysOf("early").subList(0, 2))
				.as("the fixture did not put the old days back, so the migration below is run"
						+ " against rows it has already moved and this case measures nothing")
				.containsExactly("10-01", "10-05");

		theMigration();

		assertThat(daysOf("early").subList(0, 2)).containsExactly("10-15", "10-31");
		assertThat(daysOf("regular").subList(0, 2)).containsExactly("11-01", "11-30");
		assertThat(daysOf("season").subList(0, 2)).containsExactly("01-01", "10-14");
	}

	/**
	 * AND THE NAME MOVES EVEN WHERE AN ADMINISTRATOR HAD TYPED HIS OWN.
	 *
	 * <p>This is the only row on the list a running portal can really have changed, and the
	 * whole reason this file exists. The name written here is deliberately nothing like the
	 * seeded one: a migration that matched on the old text - „update where label = '1. do 5.
	 * oktobra'" - would pass every other case in this suite and silently leave this row naming
	 * a period that no longer exists.
	 */
	@Test
	void theNameMovesEvenWhereSomebodyHadWrittenHisOwn() {
		thePriceListAsItStoodBeforeV49();
		jdbc.execute("update price_row set label = 'Rana uplata, popust 5 evra' where key = 'early'");

		assertThat(daysOf("early").get(2))
				.as("the fixture did not write a name of its own, so this case measures the seeded"
						+ " one and says nothing about a row an administrator has touched")
				.isEqualTo("Rana uplata, popust 5 evra");

		theMigration();

		assertThat(daysOf("early").get(2))
				.as("a name somebody had typed over survived the migration, so the price table now"
						+ " prints one period beside another period's days")
				.isEqualTo("15. do 31. oktobra");
	}

	/**
	 * AND THE PAGES MOVE OVER THE TEXT THAT WAS ALREADY THERE, in both languages.
	 *
	 * <p>Put back by the reverse of what the migration does rather than by retyping three
	 * section bodies: retyped, this fixture would be a fourth home for the very sentences it is
	 * meant to be measuring, and it would agree with whatever was typed into it.
	 */
	@Test
	void thePagesMoveOverTheTextThatWasAlreadyThere() {
		jdbc.execute("update static_page_section set body = replace(replace(body,"
				+ " 'od 15. oktobra', 'od 1. oktobra'),"
				+ " 'do 14. oktobra tekuća', 'do 30. septembra tekuća')");
		jdbc.execute("update static_page_section_translation set body = replace(replace(body,"
				+ " 'from 15 October', 'from 1 October'),"
				+ " 'to 14 October the current one is', 'to 30 September the current one is')");

		assertThat(bodiesNaming("static_page_section", "od 1. oktobra"))
				.as("the fixture did not put the old Serbian text back, so the migration below has"
						+ " nothing to change and this case measures nothing")
				.isGreaterThan(0);
		assertThat(bodiesNaming("static_page_section_translation", "from 1 October"))
				.as("the fixture did not put the old English text back")
				.isGreaterThan(0);

		theMigration();

		assertThat(bodiesNaming("static_page_section", "od 1. oktobra"))
				.as("a Serbian section still tells a member the selling year opens on the first")
				.isZero();
		assertThat(bodiesNaming("static_page_section_translation", "from 1 October"))
				.as("an English section still tells a member the selling year opens on the first")
				.isZero();
		assertThat(bodiesNaming("static_page_section", "od 15. oktobra"))
				.as("the migration emptied the sentences instead of moving them")
				.isGreaterThan(0);
		assertThat(bodiesNaming("static_page_section_translation", "from 15 October"))
				.as("the migration emptied the English sentences instead of moving them")
				.isGreaterThan(0);
	}

	private int bodiesNaming(String table, String phrase) {
		return db.sql("select count(*) from " + table + " where body like ?")
				.param("%" + phrase + "%")
				.query(Integer.class)
				.single();
	}
}

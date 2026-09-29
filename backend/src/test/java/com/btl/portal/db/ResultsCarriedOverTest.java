package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V47 DOES TO THE RESULTS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists, and it is a rule paid for on a live server.</b> Every test in this
 * suite starts from an EMPTY database and writes its own rows, and it writes them after the
 * migration, knowing what the migration wants. So a migration that cannot survive the rows a
 * real database already carries is invisible to all five of our tools at once - Testcontainers
 * starts empty, a mutation measures whether a constraint has a guard rather than whether the
 * migration runs, coverage measures executed code and the migration executes fully over
 * nothing, and the four schema floors all read a schema built from scratch. That is exactly
 * how V35 reached QA and stopped it: one row, written before the columns it needed existed,
 * and Flyway refused to go past migration 34.
 *
 * <p><b>Why a widening still needs it, when a widening cannot violate anything.</b> That is
 * true of the type and it is not the whole of what this migration does. {@code result.category}
 * is a STORED generated column over {@code distance_km}, so PostgreSQL refuses the type change
 * outright and the column has to come off and go back - and putting it back is what RECOMPUTES
 * every row. A migration that dropped it and forgot to add it again leaves a schema with a
 * column missing, which a floor would catch; one that added it back with a DIFFERENT
 * expression leaves every existing row carrying a category nobody notices is wrong, which no
 * floor reads, because nothing else in the suite has a row there to be wrong about.
 *
 * <p><b>How the two halves are made.</b> The column is narrowed back to what V7 shipped, rows
 * are written as the old database really held them, and then THE MIGRATION ITSELF is executed
 * - not a copy of its statements, but the file Flyway resolved and applied
 * ({@link DatabaseTest#migrationSql}), so a migration edited afterwards is the one that runs
 * here too. Everything is inside the test's transaction and rolled back.
 *
 * <p><b>The undoing asks the DATABASE what the generated expression is rather than carrying a
 * copy of it.</b> A fixture holding its own copy of that {@code case} would be a second home
 * for PDL P5's two literals, and the day somebody changed one the fixture would go on
 * measuring the other - which is the shape this project has written down as „pod koji i sam
 * nosi spisak nije pod". Read out of {@code information_schema}, the undoing is whatever the
 * schema really says, and it cannot drift.
 */
class ResultsCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/**
	 * A MARATHON MEASURED THE WAY THE OLD COLUMN COULD MEASURE IT.
	 *
	 * <p>42,20 is what a {@code numeric(6,2)} column holds for a race run at 42,195 km, and it
	 * is the value a real database would be carrying by the time this migration arrives. Its
	 * category under both the old expression and the new one is {@code marathon}, because the
	 * rule compares against 42.2 exactly - so this row is what says the migration did not
	 * silently change the meaning of rows it was only supposed to widen.
	 */
	private static final String AS_THE_OLD_COLUMN_HELD_IT = "42.20";

	/** A second distance, and on the other side of every literal in the rule, so „every row
	 *  kept its category" is not one row that happened to keep one. */
	private static final String A_SHORT_ONE = "10.00";

	/** And a third, above the marathon literal, so the branch that says {@code ultra} has a
	 *  row too and a migration that collapsed the rule into two answers is caught. */
	private static final String AN_ULTRA = "100.00";

	@BeforeEach
	void aDatabaseAsItStoodBeforeThisMigration() {
		theColumnAsV7ShippedIt();

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values ('000777', 'Zatecena', 'Clanica', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " '0000000000000777', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.update();

		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description,"
						+ " link) values ('zatecen-dogadjaj', 'Zatecen dogadjaj',"
						+ " date '2027-04-10', (select id from place where rank = 1), 'race',"
						+ " false, '', '')")
				.update();

		oldRace("Zatecen maraton", AS_THE_OLD_COLUMN_HELD_IT);
		oldRace("Zatecena desetka", A_SHORT_ONE);
		oldRace("Zatecen ultra", AN_ULTRA);

		oldResult("Zatecen maraton", AS_THE_OLD_COLUMN_HELD_IT, 14400, "26.50");
		oldResult("Zatecena desetka", A_SHORT_ONE, 3600, "3.73");
		oldResult("Zatecen ultra", AN_ULTRA, 50000, "41.00");
	}

	/**
	 * THE MIGRATION RUNS OVER ROWS THAT WERE ALREADY THERE, AND EVERY ONE OF THEM SURVIVES
	 * WITH ITS CATEGORY INTACT.
	 *
	 * <p>That the rows are still there at all is the floor under the fixture and not a
	 * formality: if narrowing the column back had left something of V47 standing, the rows
	 * written against the old shape would not have gone in, and this case would fail in
	 * {@code @BeforeEach} rather than here.
	 *
	 * <p>The categories are asserted against what the RACE rows say rather than against three
	 * strings written here, which is the same reason the undoing reads the expression out of
	 * the catalogue: one rule, one home. {@code race.distance_km} has been {@code numeric(8,4)}
	 * since V25 and its generated column was recomputed then, so it is the side that has
	 * already been through this.
	 */
	@Test
	void everyResultThatWasAlreadyThereSurvivesWithItsCategory() {
		assertThat(howManyResults()).as("the fixture wrote nothing, so this measures nothing")
				.isEqualTo(3);

		jdbc.execute(migrationSql("47"));

		assertThat(howManyResults()).isEqualTo(3);

		assertThat(categoriesByDistance("result"))
				.as("a result no longer agrees with the race it was run at")
				.isEqualTo(categoriesByDistance("race"));
	}

	/**
	 * AND AFTERWARDS THE COLUMN TAKES THE LENGTH IT COULD NOT TAKE BEFORE.
	 *
	 * <p>This is the half the migration exists for, asserted on BEHAVIOUR rather than on
	 * {@code information_schema}: the row goes in and comes back out with all four decimals. A
	 * migration that dropped the generated column and never widened the one underneath it
	 * leaves a schema that passes every catalogue question about {@code category} and rounds
	 * this to 42,20.
	 *
	 * <p>And the category of that exact row is asserted too, because rounding it would not only
	 * lose a digit: 42,1950 is {@code long} and 42,20 is {@code marathon}, so the lost digit
	 * moves the run into another class of race.
	 */
	@Test
	void andAfterwardsTheColumnKeepsAnExactMarathon() {
		jdbc.execute(migrationSql("47"));

		oldRace("Tacan maraton", "42.1950");
		oldResult("Tacan maraton", "42.1950", 14400, "26.50");

		assertThat(db.sql("select r.distance_km from result r join race ra on ra.id = r.race_id"
						+ " where ra.name = 'Tacan maraton'")
				.query(BigDecimal.class).single())
				.as("the exact length did not survive the widening")
				.isEqualByComparingTo("42.1950");

		assertThat(db.sql("select r.category from result r join race ra on ra.id = r.race_id"
						+ " where ra.name = 'Tacan maraton'")
				.query(String.class).single())
				.as("a rounded length puts the run in another class of race")
				.isEqualTo("long");
	}

	/**
	 * {@code result.distance_km} AND ITS GENERATED COLUMN AS V7 SHIPPED THEM, put back so the
	 * migration has something to widen.
	 *
	 * <p>The expression is asked of the catalogue and handed straight back, so this fixture
	 * carries no copy of PDL P5's literals. The order is forced by PostgreSQL rather than
	 * chosen: a stored generated column cannot stand over a column whose type is being
	 * altered, which is the same refusal V25 recorded for {@code race} and V47 for this table.
	 */
	private void theColumnAsV7ShippedIt() {
		String asItIsNow = db.sql("select generation_expression from information_schema.columns"
						+ " where table_name = 'result' and column_name = 'category'")
				.query(String.class)
				.single();

		jdbc.execute("alter table result drop column category");
		jdbc.execute("alter table result alter column distance_km type numeric(6,2)");
		jdbc.execute("alter table result add column category text generated always as ("
				+ asItIsNow + ") stored");
	}

	private void oldRace(String name, String distance) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values ((select id from btl_event"
						+ " where slug = 'zatecen-dogadjaj'), ?, false, date '2027-04-10',"
						+ " 'length', 0, cast(? as numeric), 0, 0)")
				.params(name, distance)
				.update();
	}

	private void oldResult(String raceName, String distance, int seconds, String points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) values ("
						+ " (select id from competitor where member_number = '000777'),"
						+ " (select id from race where name = ?), date '2027-04-10',"
						+ " cast(? as numeric), 0, 0, ?, cast(? as numeric))")
				.params(raceName, distance, seconds, points)
				.update();
	}

	private int howManyResults() {
		return db.sql("select count(*) from result").query(Integer.class).single();
	}

	/** What each table calls each distance, keyed by the distance itself, so the two are
	 *  compared as a whole rather than one row at a time. */
	private java.util.Map<BigDecimal, String> categoriesByDistance(String table) {
		java.util.Map<BigDecimal, String> said = new java.util.TreeMap<>();

		db.sql("select distance_km, category from " + table + " order by distance_km")
				.query((row, one) -> said.put(row.getBigDecimal(1).stripTrailingZeros(),
						row.getString(2)))
				.list();

		return said;
	}
}

package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint the three reference tables carry, with the row that breaks it.
 *
 * A constraint nobody has broken on purpose is an intention rather than a
 * constraint: a CHECK with a typo in the regular expression, a UNIQUE over the
 * wrong column, a foreign key written {@code ON DELETE SET NULL} by habit, all
 * of them sit there looking like protection and let the row through. So each one
 * below gets a row that it, and only it, must reject, and the failure has to name
 * it: an insert that trips a different constraint proves nothing about this one.
 *
 * The list is written by hand, and the floor under it is
 * {@link #everyConstraintInTheSchemaHasARowThatBreaksIt()}, which reads the
 * constraints back out of {@code pg_constraint}. The two must agree exactly, so a
 * constraint added to a migration without a row here fails the build, and a row
 * here naming a constraint that no longer exists fails it too. PostgreSQL 18
 * records NOT NULL in {@code pg_constraint} like any other constraint, so the
 * floor covers those as well and not only the CHECKs.
 *
 * <p>Which tables that floor looks at is itself read out of {@code pg_tables},
 * and until 08.09.2026 it was three names written here. That is a list whose only
 * floor is another list, in another class: a fourth table arriving made
 * {@code ConventionsTest} ask for its name, and nothing at all asked for it here,
 * so both of its constraints would have been carried with no row that breaks
 * them and the build would have been green. Measured, in that order: a constraint
 * added to an existing table failed the build, the same constraint on a new table
 * did not.
 *
 * The other direction is {@link #aLegitimateRowIsAccepted(String)}: without it,
 * a constraint that rejects everything would pass every test above.
 *
 * Every row below was run against a database with that one constraint dropped,
 * and every one of them then went in: each is rejected by the constraint it names
 * and by nothing else. Three of them, the NOT NULL on each {@code id}, needed the
 * primary key dropped first, because PostgreSQL will not take NOT NULL off a
 * column in the key. Those three are the key's and not decisions of their own,
 * and they are here because the floor reads them back like any other.
 */
class ConstraintsTest extends DatabaseTest {

	/**
	 * One row that must be rejected, and the constraint that has to be the reason.
	 *
	 * {@code evidence} is what the database says when that constraint is the one
	 * that fired. For a CHECK, a UNIQUE, a primary key or a foreign key that is
	 * the constraint's own name; PostgreSQL words a NOT NULL failure by column and
	 * relation instead, so those name the column.
	 */
	record Violation(String constraint, String evidence, String sql) {

		static Violation of(String constraint, String sql) {
			return new Violation(constraint, constraint, sql);
		}

		static Violation notNull(String constraint, String column, String sql) {
			return new Violation(constraint, "column \"" + column + "\"", sql);
		}

		@Override
		public String toString() {
			return constraint;
		}
	}

	/* A row of each table that breaks nothing: every violation below is one of
	   these with a single field spoiled, so what fails is the field and not the
	   fixture. */
	private static final String GOOD_COUNTRY =
			"insert into country (code, name, in_region, sort_order) values ('ZZ', 'Zemlja Proba', false, 9001)";
	private static final String GOOD_PLACE =
			"insert into place (name, country_id, english_name, rank) "
					+ "select 'Probno Mesto', id, 'Probe Town', 900001 from country where code = 'RS'";
	private static final String GOOD_PRICE_ROW =
			"insert into price_row (key, kind, day_from, day_to, eur, rsd, ranking, sort_order) "
					+ "values ('probe', 'period', '02-01', '02-02', 1, 120, true, 9001)";

	static List<Violation> violations() {
		return List.of(
				// ---------------------------------------------------------------- country
				Violation.of("country_pk",
						"insert into country (id, code, name, in_region, sort_order) "
								+ "select id, 'ZZ', 'Zemlja Proba', false, 9001 from country where code = 'RS'"),
				Violation.of("country_code_unique",
						"insert into country (code, name, in_region, sort_order) values ('RS', 'Zemlja Proba', false, 9001)"),
				Violation.of("country_name_unique",
						"insert into country (code, name, in_region, sort_order) values ('ZZ', 'Srbija', false, 9001)"),
				Violation.of("country_sort_order_unique",
						"insert into country (code, name, in_region, sort_order) values ('ZZ', 'Zemlja Proba', false, 1)"),
				Violation.of("country_code_shape",
						"insert into country (code, name, in_region, sort_order) values ('zz', 'Zemlja Proba', false, 9001)"),
				/* Kosovo is carried as part of Serbia and the code appears nowhere
				   (owner, 11.08.2026, ADL A16). XK is two capitals, so the shape
				   check lets it through and only this one can stop it. */
				Violation.of("country_code_not_kosovo",
						"insert into country (code, name, in_region, sort_order) values ('XK', 'Zemlja Proba', false, 9001)"),
				Violation.of("country_name_not_blank",
						"insert into country (code, name, in_region, sort_order) values ('ZZ', '   ', false, 9001)"),
				Violation.of("country_sort_order_positive",
						"insert into country (code, name, in_region, sort_order) values ('ZZ', 'Zemlja Proba', false, 0)"),
				Violation.notNull("country_id_not_null", "id",
						"insert into country (id, code, name, in_region, sort_order) "
								+ "values (null, 'ZZ', 'Zemlja Proba', false, 9001)"),
				Violation.notNull("country_code_not_null", "code",
						"insert into country (code, name, in_region, sort_order) values (null, 'Zemlja Proba', false, 9001)"),
				Violation.notNull("country_name_not_null", "name",
						"insert into country (code, name, in_region, sort_order) values ('ZZ', null, false, 9001)"),
				Violation.notNull("country_in_region_not_null", "in_region",
						"insert into country (code, name, in_region, sort_order) values ('ZZ', 'Zemlja Proba', null, 9001)"),
				Violation.notNull("country_sort_order_not_null", "sort_order",
						"insert into country (code, name, in_region, sort_order) values ('ZZ', 'Zemlja Proba', false, null)"),

				// ------------------------------------------------------------------ place
				Violation.of("place_pk",
						"insert into place (id, name, country_id, rank) "
								+ "select id, 'Probno Mesto', country_id, 900001 from place where rank = 1"),
				/* A town in a country the codebook does not list. The staging table
				   the migration loads through carries the same key on the country
				   code, so a bad code cannot even reach this table. */
				Violation.of("place_country_fk",
						"insert into place (name, country_id, rank) values ('Probno Mesto', -1, 900001)"),
				Violation.of("place_rank_unique",
						"insert into place (name, country_id, rank) select 'Probno Mesto', id, 1 from country where code = 'RS'"),
				Violation.of("place_rank_positive",
						"insert into place (name, country_id, rank) select 'Probno Mesto', id, 0 from country where code = 'RS'"),
				Violation.of("place_name_not_blank",
						"insert into place (name, country_id, rank) select '  ', id, 900001 from country where code = 'RS'"),
				Violation.of("place_english_name_not_blank",
						"insert into place (name, country_id, english_name, rank) "
								+ "select 'Probno Mesto', id, '  ', 900001 from country where code = 'RS'"),
				Violation.of("place_english_name_differs",
						"insert into place (name, country_id, english_name, rank) "
								+ "select 'Probno Mesto', id, 'Probno Mesto', 900001 from country where code = 'RS'"),
				Violation.notNull("place_id_not_null", "id",
						"insert into place (id, name, country_id, rank) "
								+ "select null, 'Probno Mesto', id, 900001 from country where code = 'RS'"),
				Violation.notNull("place_name_not_null", "name",
						"insert into place (name, country_id, rank) select null, id, 900001 from country where code = 'RS'"),
				Violation.notNull("place_country_id_not_null", "country_id",
						"insert into place (name, country_id, rank) values ('Probno Mesto', null, 900001)"),
				Violation.notNull("place_rank_not_null", "rank",
						"insert into place (name, country_id, rank) select 'Probno Mesto', id, null from country where code = 'RS'"),

				// -------------------------------------------------------------- price_row
				Violation.of("price_row_pk",
						priceRow("id, key, kind, day_from, day_to, eur, rsd, ranking, sort_order",
								"select id, 'probe', 'period', '02-01', '02-02', 1, 120, true, 9001 "
										+ "from price_row where key = 'early'")),
				Violation.of("price_row_key_unique", priceRow("'early', 'period', '02-01', '02-02', 1, 120, true, 9001")),
				Violation.of("price_row_sort_order_unique", priceRow("'probe', 'period', '02-01', '02-02', 1, 120, true, 1")),
				Violation.of("price_row_kind_known", priceRow("'probe', 'discount', null, null, 1, 120, null, 9001")),
				Violation.of("price_row_key_not_blank", priceRow("'  ', 'period', '02-01', '02-02', 1, 120, true, 9001")),
				Violation.of("price_row_sort_order_positive", priceRow("'probe', 'period', '02-01', '02-02', 1, 120, true, 0")),
				/* Both directions of each biconditional, because half of one is a
				   different fault from the other half: a level with dates on it and
				   a period without them are two separate ways to be wrong, and a
				   check written as an implication would catch only one. */
				Violation.of("price_row_period_has_days", priceRow("'probe', 'level', '02-01', '02-02', 20, 2400, null, 9001")),
				Violation.of("price_row_period_has_days", priceRow("'probe', 'period', null, null, 40, 4800, true, 9001")),
				/* Month zero. Not month thirteen: that would also put the two days
				   out of order and the failure could name either constraint. */
				Violation.of("price_row_day_from_shape", priceRow("'probe', 'period', '00-01', '12-31', 1, 120, true, 9001")),
				Violation.of("price_row_day_to_shape", priceRow("'probe', 'period', '01-01', '01-32', 1, 120, true, 9001")),
				Violation.of("price_row_days_in_order", priceRow("'probe', 'period', '03-01', '02-01', 1, 120, true, 9001")),
				Violation.of("price_row_eur_not_negative", priceRow("'probe', 'period', '02-01', '02-02', -1, 120, true, 9001")),
				Violation.of("price_row_rsd_not_negative", priceRow("'probe', 'level', null, null, 20, -1, null, 9001")),
				Violation.of("price_row_only_fee_has_no_rsd", priceRow("'probe', 'fee', null, null, 3, 360, null, 9001")),
				Violation.of("price_row_only_fee_has_no_rsd", priceRow("'probe', 'level', null, null, 20, null, null, 9001")),
				Violation.of("price_row_only_period_is_ranked", priceRow("'probe', 'level', null, null, 20, 2400, true, 9001")),
				Violation.of("price_row_only_period_is_ranked", priceRow("'probe', 'period', '02-01', '02-02', 1, 120, null, 9001")),
				Violation.notNull("price_row_id_not_null", "id",
						priceRow("id, key, kind, day_from, day_to, eur, rsd, ranking, sort_order",
								"values (null, 'probe', 'period', '02-01', '02-02', 1, 120, true, 9001)")),
				Violation.notNull("price_row_key_not_null", "key",
						priceRow("null, 'period', '02-01', '02-02', 1, 120, true, 9001")),
				Violation.notNull("price_row_kind_not_null", "kind", priceRow("'probe', null, null, null, 1, 120, null, 9001")),
				Violation.notNull("price_row_eur_not_null", "eur",
						priceRow("'probe', 'period', '02-01', '02-02', null, 120, true, 9001")),
				Violation.notNull("price_row_sort_order_not_null", "sort_order",
						priceRow("'probe', 'period', '02-01', '02-02', 1, 120, true, null")));
	}

	private static String priceRow(String values) {
		return priceRow("key, kind, day_from, day_to, eur, rsd, ranking, sort_order", "values (" + values + ")");
	}

	private static String priceRow(String columns, String source) {
		return "insert into price_row (" + columns + ") " + source;
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/**
	 * The floor under the list above, read out of the database rather than
	 * remembered.
	 *
	 * A hand written list is not the fault; a hand written list with nothing
	 * underneath it is. This asks PostgreSQL what constraints the schema actually
	 * carries, so neither side can drift: a constraint added to a migration
	 * without a row above fails here, and a row above naming a constraint that has
	 * been dropped fails here too.
	 *
	 * Which tables, in turn, comes from {@code pg_tables} and not from a list
	 * beside this one: see {@link DatabaseTest#tablesInTheSchema()} for what that
	 * cost when it was a list. {@code regclass} rather than a name compared against
	 * {@code pg_class}: the cast resolves each table the same way a query in this
	 * session resolves it, so the answer cannot come from a table of the same name
	 * in another schema.
	 */
	@Test
	void everyConstraintInTheSchemaHasARowThatBreaksIt() {
		List<String> tables = tablesInTheSchema();
		String literals = tables.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));

		List<String> declared = db
				.sql("select con.conname from pg_constraint con"
						+ " where con.conrelid = any (array[" + literals + "]::regclass[])"
						+ " order by con.conname")
				.query(String.class)
				.list();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(tables).isNotEmpty();
		assertThat(declared).isNotEmpty();
		assertThat(covered)
				.as("every constraint on %s needs a row above that breaks it", tables)
				.containsExactlyInAnyOrderElementsOf(declared);
	}

	/**
	 * And a row that breaks nothing goes in.
	 *
	 * Without this every constraint above could be replaced by one that rejects
	 * everything and the whole file would still pass. It is the mutation that
	 * would otherwise be answered by turning a check off.
	 */
	@ParameterizedTest
	@ValueSource(strings = { GOOD_COUNTRY, GOOD_PLACE, GOOD_PRICE_ROW })
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isEqualTo(1);
	}
}

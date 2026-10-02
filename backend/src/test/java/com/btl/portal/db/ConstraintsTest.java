package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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
 * {@link #everyConstraintOnTheReferenceTablesHasARowThatBreaksIt()}, which reads
 * the constraints back out of {@code pg_constraint}. The two must agree exactly,
 * so a constraint added to a migration without a row here fails the build, and a
 * row here naming a constraint that no longer exists fails it too. PostgreSQL 18
 * records NOT NULL in {@code pg_constraint} like any other constraint, so the
 * floor covers those as well and not only the CHECKs.
 *
 * <p>Which tables that floor looks at is {@link #TABLES}, three names written
 * here, and the reason a hand written list is safe now and was not on 08.09.2026
 * is the second floor: {@link #everyTableInTheSchemaIsClaimedByAConstraintTest()}
 * compares {@code pg_tables} against the same list in every class of this kind,
 * so a table nobody claims fails the build. Until 08.09.2026 there was no such
 * comparison, and then three names here were a list whose only floor was another
 * list in another class: a fourth table arriving made {@code ConventionsTest} ask
 * for its name and nothing at all asked for its constraints. Measured, in that
 * order: a constraint added to an existing table failed the build, the same
 * constraint on a new table did not.
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

	/**
	 * The tables this class answers for, and the whole of what it answers for.
	 *
	 * Package visible on purpose, and it is the one thing that makes the split
	 * below safe: {@link #everyTableInTheSchemaIsClaimedByAConstraintTest()} adds
	 * this list to the same list in every sibling class, in Java rather than by
	 * matching a name, so a class that renames or drops its list breaks the
	 * compiler instead of quietly leaving its tables unguarded.
	 */
	static final List<String> TABLES = List.of("country", "place", "price_row");

	/* A row of each table that breaks nothing: every violation below is one of
	   these with a single field spoiled, so what fails is the field and not the
	   fixture. */
	private static final String GOOD_COUNTRY =
			"insert into country (code, name, in_region, sort_order) values ('ZZ', 'Zemlja Proba', false, 9001)";
	/* 99000001 is past every mark GeoNames has issued (the largest in the codebook
	   is 13,697,165), so a probe row cannot land on a real town's mark and make a
	   failure below name place_geonames_id_unique instead of what it is about. */
	private static final String GOOD_PLACE =
			"insert into place (geonames_id, name, country_id, english_name, rank) "
					+ "select 99000001, 'Probno Mesto', id, 'Probe Town', 900001 from country where code = 'RS'";
	/**
	 * THE OTHER HALF OF THE KEY OVER A TOWN'S NAME: the name of the town at rank 1, in a country that is
	 * not its own.
	 *
	 * <p>The row in the violation list says what the key refuses; this says what it lets through, and it
	 * is the only thing that tells the right key from a wrong one. Written over the name alone it would
	 * refuse Boston in England because Boston in the United States is there, which is the mistake the
	 * owner's decision cannot mean: it says two equal names in ONE country. Every violation in the list
	 * would still pass under that key.
	 */
	private static final String A_NAMESAKE_IN_ANOTHER_COUNTRY =
			"insert into place (geonames_id, name, country_id, rank) "
					+ "select 99000001, p.name, (select min(c.id) from country c where c.id <> p.country_id), 900001 "
					+ "from place p where p.rank = 1";
	private static final String GOOD_PRICE_ROW =
			"insert into price_row (key, kind, day_from, day_to, eur, rsd, ranking, sort_order, label) "
					+ "values ('probe', 'period', '02-01', '02-02', 1, 120, true, 9001, 'Naziv probe')";
	/**
	 * AND A ROW THAT COSTS NOTHING AT ALL, which V40 allows and is the half of that decision no
	 * breaking row can state.
	 *
	 * <p>PDL 20b, owner 27.09.2026: a row is free in BOTH currencies or priced in BOTH. The two rows
	 * above in the violation list say what it refuses; without this one the constraint could be
	 * replaced by {@code eur > 0 and rsd > 0} - refusing a free row outright - and every case in this
	 * file would still pass. That is a different decision from the one he made, and this is the only
	 * thing that tells the two apart.
	 */
	private static final String A_FREE_PRICE_ROW =
			"insert into price_row (key, kind, day_from, day_to, eur, rsd, ranking, sort_order, label) "
					+ "values ('besplatno', 'level', null, null, 0, 0, null, 9002, 'Naziv probe')";

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
						"insert into place (id, geonames_id, name, country_id, rank) "
								+ "select id, 99000001, 'Probno Mesto', country_id, 900001 from place where rank = 1"),
				/* A town in a country the codebook does not list. The staging table
				   the migration loads through carries the same key on the country
				   code, so a bad code cannot even reach this table. */
				Violation.of("place_country_fk",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "values (99000001, 'Probno Mesto', -1, 900001)"),
				/* The mark, and the whole of what it is for: a second row wearing
				   one town's GeoNames identifier is two towns nothing can tell
				   apart, and a reference to either of them means both. */
				Violation.of("place_geonames_id_unique",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "select geonames_id, 'Probno Mesto', country_id, 900001 from place where rank = 1"),
				/* A town that tells nothing apart from its namesake. Owner, 02.10.2026, PDL "Odluke iz
				   ciscenja nalaza (02.10.2026, vlasnik)", the entry that begins „Istoimena mesta u istoj
				   drzavi dobijaju u zagradi": towns of one country that were called alike now carry the
				   nearest bigger town in brackets, and from then on the database refuses a second town of
				   that country under a name one already wears.

				   The probe takes the NAME AND THE COUNTRY of the town at rank 1 and nothing else of it:
				   a mark and a rank nobody holds, so this key is the only one it can break. That the key
				   covers the country as well as the name is a different fact and has a row of its own,
				   A_NAMESAKE_IN_ANOTHER_COUNTRY below: the same name in another country goes in, as
				   Boston stands in the United States and in England. */
				Violation.of("place_country_name_unique",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "select 99000001, name, country_id, 900001 from place where rank = 1"),
				Violation.of("place_geonames_id_positive",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "select 0, 'Probno Mesto', id, 900001 from country where code = 'RS'"),
				Violation.of("place_rank_unique",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "select 99000001, 'Probno Mesto', id, 1 from country where code = 'RS'"),
				Violation.of("place_rank_positive",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "select 99000001, 'Probno Mesto', id, 0 from country where code = 'RS'"),
				Violation.of("place_name_not_blank",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "select 99000001, '  ', id, 900001 from country where code = 'RS'"),
				Violation.of("place_english_name_not_blank",
						"insert into place (geonames_id, name, country_id, english_name, rank) "
								+ "select 99000001, 'Probno Mesto', id, '  ', 900001 from country where code = 'RS'"),
				Violation.of("place_english_name_differs",
						"insert into place (geonames_id, name, country_id, english_name, rank) "
								+ "select 99000001, 'Probno Mesto', id, 'Probno Mesto', 900001 from country where code = 'RS'"),
				Violation.notNull("place_id_not_null", "id",
						"insert into place (id, geonames_id, name, country_id, rank) "
								+ "select null, 99000001, 'Probno Mesto', id, 900001 from country where code = 'RS'"),
				Violation.notNull("place_geonames_id_not_null", "geonames_id",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "select null, 'Probno Mesto', id, 900001 from country where code = 'RS'"),
				Violation.notNull("place_name_not_null", "name",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "select 99000001, null, id, 900001 from country where code = 'RS'"),
				Violation.notNull("place_country_id_not_null", "country_id",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "values (99000001, 'Probno Mesto', null, 900001)"),
				Violation.notNull("place_rank_not_null", "rank",
						"insert into place (geonames_id, name, country_id, rank) "
								+ "select 99000001, 'Probno Mesto', id, null from country where code = 'RS'"),

				// -------------------------------------------------------------- price_row
				Violation.of("price_row_pk",
						priceRow("id, key, kind, day_from, day_to, eur, rsd, ranking, sort_order, label",
								"select id, 'probe', 'period', '02-01', '02-02', 1, 120, true, 9001,"
										+ " 'Naziv probe' from price_row where key = 'early'")),
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
				/* NOUGHT IN ONE CURRENCY ALONE, both ways round, because they are two different rows
				   an administrator can type and the rule is written as an equivalence in order to
				   refuse both. V40, PDL 20b, owner 27.09.2026. The euro side is the one that was
				   measured: 0 EUR / 600 RSD breaks both roads to an activation, because a spend in
				   the book has to move both currencies strictly (`balance_entry_a_membership_takes`,
				   V38). A check written as an implication would have caught one of these two.

				   A LEVEL rather than a period, so that `price_row_only_period_is_ranked` and
				   `price_row_period_has_days` are both satisfied and this is the only thing each row
				   breaks; and `rsd` is there, because a row without it is the fee's exemption and
				   would pass. */
				Violation.of("price_row_free_in_both_or_priced_in_both",
						priceRow("'probe', 'level', null, null, 0, 2400, null, 9001")),
				Violation.of("price_row_free_in_both_or_priced_in_both",
						priceRow("'probe', 'level', null, null, 20, 0, null, 9001")),
				/* A row with no name at all, and a row whose name is spaces. Both directions of
				   what V34 says a name is, and they are two different faults: NOT NULL alone
				   would take „   ", which draws as an empty cell in the table a visitor reads
				   under Clan 14 and reads as a column nobody filled in. */
				Violation.of("price_row_label_not_blank",
						named("'probe', 'period', '02-01', '02-02', 1, 120, true, 9001", "'   '")),
				Violation.notNull("price_row_label_not_null", "label",
						named("'probe', 'period', '02-01', '02-02', 1, 120, true, 9001", "null")),
				Violation.notNull("price_row_id_not_null", "id",
						priceRow("id, key, kind, day_from, day_to, eur, rsd, ranking, sort_order, label",
								"values (null, 'probe', 'period', '02-01', '02-02', 1, 120, true, 9001,"
										+ " 'Naziv probe')")),
				Violation.notNull("price_row_key_not_null", "key",
						priceRow("null, 'period', '02-01', '02-02', 1, 120, true, 9001")),
				Violation.notNull("price_row_kind_not_null", "kind", priceRow("'probe', null, null, null, 1, 120, null, 9001")),
				Violation.notNull("price_row_eur_not_null", "eur",
						priceRow("'probe', 'period', '02-01', '02-02', null, 120, true, 9001")),
				Violation.notNull("price_row_sort_order_not_null", "sort_order",
						priceRow("'probe', 'period', '02-01', '02-02', 1, 120, true, null")));
	}

	/**
	 * A probe row spoiled in one of the eight columns that are not its NAME.
	 *
	 * <p>V34 gave {@code price_row} a ninth column and it is NOT NULL, so every case above
	 * would otherwise name {@code price_row_label_not_null} instead of the constraint it is
	 * about. The name it gets here is one that breaks nothing; the two cases that ARE about the
	 * name spell it out through {@link #named}.
	 */
	private static String priceRow(String values) {
		return named(values, "'Naziv probe'");
	}

	/** The same probe row with the name said out loud, for the two cases about the name. */
	private static String named(String values, String label) {
		return priceRow("key, kind, day_from, day_to, eur, rsd, ranking, sort_order, label",
				"values (" + values + ", " + label + ")");
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
	 * Which tables it looks at is {@link #TABLES}, and until 09.09.2026 it was
	 * {@code tablesInTheSchema()}: every table the schema had, because every table
	 * the schema had was one of these three. V5 gave the schema tables that answer
	 * to their own class, so reading the whole catalogue here would ask this file
	 * for a row breaking {@code role_code_shape}. What that change would have cost,
	 * had it been made on its own, is a hand written list of three names with
	 * nothing under it, which is exactly the state 08.09.2026 measured and left:
	 * a fourth table arriving made {@code ConventionsTest} ask for its name and
	 * nothing at all asked for its constraints. That is why the split comes with
	 * {@link #everyTableInTheSchemaIsClaimedByAConstraintTest()} in the same commit
	 * and not after it.
	 *
	 * <p>{@code regclass} rather than a name compared against {@code pg_class}: the
	 * cast resolves each table the same way a query in this session resolves it, so
	 * the answer cannot come from a table of the same name in another schema.
	 */
	@Test
	void everyConstraintOnTheReferenceTablesHasARowThatBreaksIt() {
		String literals = TABLES.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));

		List<String> declared = db
				.sql("select con.conname from pg_constraint con"
						+ " where con.conrelid = any (array[" + literals + "]::regclass[])"
						+ " order by con.conname")
				.query(String.class)
				.list();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(covered)
				.as("every constraint on %s needs a row above that breaks it", TABLES)
				.containsExactlyInAnyOrderElementsOf(declared);
	}

	/**
	 * And no table in the schema is left without a class that answers for it.
	 *
	 * The floor under the split, and the reason the list above may be written by
	 * hand at all. Each class covers the constraints of the tables it names; this
	 * says the names together are the schema. A table added to a migration whose
	 * constraints nobody broke on purpose fails here, and it fails here whichever
	 * migration added it, because the left hand side is {@code pg_tables} and
	 * cannot forget a table.
	 *
	 * <p>The right hand side is the sibling classes' own constants, referenced as
	 * Java. A list of class names matched as text would be a second list with the
	 * same problem the first one had; a compiler cannot resolve a field that is not
	 * there, so a class that drops or renames its list stops the build rather than
	 * this test.
	 */
	@Test
	void everyTableInTheSchemaIsClaimedByAConstraintTest() {
		List<String> claimed = Stream
				.of(TABLES, RoleAndRightConstraintsTest.TABLES, AccountConstraintsTest.TABLES,
						AxisConstraintsTest.TABLES, RegistrationConstraintsTest.TABLES,
						VerificationConstraintsTest.TABLES, ResultSubmissionConstraintsTest.TABLES,
						TeamConstraintsTest.TABLES,
						CommentSubmissionConstraintsTest.TABLES,
						JoiningConstraintsTest.TABLES, InboxConstraintsTest.TABLES,
						LeagueConstraintsTest.TABLES, DucatConstraintsTest.TABLES,
						PaymentConstraintsTest.TABLES, MembershipConstraintsTest.TABLES,
						FrozenSeasonConstraintsTest.TABLES,
						AuthenticationConstraintsTest.TABLES, StaticPageConstraintsTest.TABLES,
						BalanceConstraintsTest.TABLES)
				.flatMap(List::stream)
				.toList();

		assertThat(tablesInTheSchema())
				.as("a table whose constraints no class breaks on purpose is a table with no test over it")
				.containsExactlyInAnyOrderElementsOf(claimed);
	}

	/**
	 * And a row that breaks nothing goes in.
	 *
	 * Without this every constraint above could be replaced by one that rejects
	 * everything and the whole file would still pass. It is the mutation that
	 * would otherwise be answered by turning a check off.
	 */
	@ParameterizedTest
	@ValueSource(strings = { GOOD_COUNTRY, GOOD_PLACE, A_NAMESAKE_IN_ANOTHER_COUNTRY, GOOD_PRICE_ROW, A_FREE_PRICE_ROW })
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isEqualTo(1);
	}

	/**
	 * TWO TOWNS OF ONE COUNTRY EXCHANGE THEIR NAMES IN ONE STATEMENT, and the key over a town's name
	 * lets them.
	 *
	 * <p>The key is DEFERRABLE INITIALLY IMMEDIATE, as {@code place_rank_unique} beside it is, and for
	 * the same reason in a different column: a name is maintained by a delta moving it, and a delta
	 * that renames two towns of one country into each other's names has to be one UPDATE
	 * ({@code generate_reference_migrations.py} writes it as one). Under a plain key the first of the
	 * two rows to be written lands on a name the second has not given up, measured on 02.10.2026 on
	 * PostgreSQL 18: {@code duplicate key value violates unique constraint "place_country_name_unique"},
	 * with the exchange the same one both ways round. The generator's own header names the keys
	 * the deferral cannot reach, so a plain key would also have to be named there and refused as
	 * the exchange of two countries' names is; deferrable, nothing else changes. The price of
	 * deferring is the one {@link KeysAndIndexesTest} measures for every deferrable key: nothing may
	 * point at it and it is no {@code ON CONFLICT} arbiter, and a town is pointed at by its mark.
	 *
	 * <p>The two towns are the first two of one country in the codebook, found by the catalogue
	 * rather than named, and the exchange is read back, so a statement that updated nothing does not
	 * pass for one that worked.
	 */
	@Test
	void twoTownsOfOneCountryExchangeNamesInOneStatement() {
		Map<String, Object> pair = twoTownsOfOneCountry();
		long first = (Long) pair.get("one");
		long second = (Long) pair.get("another");
		String firstName = nameOf(first);
		String secondName = nameOf(second);

		assertThat(firstName).as("two towns that wear one name would make this exchange mean nothing")
				.isNotEqualTo(secondName);

		assertThat(db.sql("update place p set name = other.name from place other"
						+ " where (p.id = ? and other.id = ?) or (p.id = ? and other.id = ?)")
				.params(first, second, second, first).update())
				.isEqualTo(2);

		assertThat(nameOf(first)).isEqualTo(secondName);
		assertThat(nameOf(second)).isEqualTo(firstName);
	}

	/**
	 * AND A STATEMENT THAT ENDS WITH TWO TOWNS OF ONE COUNTRY UNDER ONE NAME IS STILL REFUSED.
	 *
	 * <p>The half that says the case above is not the key switched off. Deferrable moves the check to
	 * the end of the statement and does not remove it; a key that lost its UNIQUE, or became INITIALLY
	 * DEFERRED, would let this through to a COMMIT that never comes in a rolled back test. The
	 * message has to name the key, so a failure of some other constraint does not stand in for it.
	 */
	@Test
	void aStatementThatEndsWithTwoTownsOfOneCountryUnderOneNameIsStillRefused() {
		Map<String, Object> pair = twoTownsOfOneCountry();
		long first = (Long) pair.get("one");
		long second = (Long) pair.get("another");

		assertThatThrownBy(() -> db.sql("update place set name = (select name from place where id = ?) where id = ?")
				.params(first, second).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("place_country_name_unique");
	}

	/** The first two towns, by rank, of the country that holds the town at rank 1. */
	private Map<String, Object> twoTownsOfOneCountry() {
		return db.sql("select a.id as one, b.id as another from place a"
						+ " join place b on b.country_id = a.country_id and b.rank > a.rank"
						+ " where a.rank = 1 order by b.rank limit 1")
				.query().singleRow();
	}

	private String nameOf(long town) {
		return db.sql("select name from place where id = ?").param(town).query(String.class).single();
	}
}

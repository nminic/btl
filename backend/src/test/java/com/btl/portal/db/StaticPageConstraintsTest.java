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
 * Every constraint the three tables of V24 carry, with the row that breaks it.
 *
 * <p>The same shape as {@link RoleAndRightConstraintsTest}, and for the same reason:
 * a constraint nobody has broken on purpose is an intention rather than a
 * constraint. So each one below gets a row that it, and only it, must reject, and
 * the failure has to name it.
 *
 * <p><b>Two tables of the three start with no row at all</b> (no page uses
 * {@code includes} today; see V24's header), so a violation cannot be built the way
 * {@code ConstraintsTest} builds {@code country_pk} - by selecting the id of an
 * existing row. Where that matters ({@code static_page_include_pk}, its two unique
 * keys) the violation inserts two rows of its own in one statement, a literal id or a
 * repeated pair, and lets the second collide with the first rather than with seeded
 * data.
 *
 * <p>The floor under the list is
 * {@link #everyConstraintOnTheThreeTablesHasARowThatBreaksIt()}, which reads
 * {@code pg_constraint} back for {@link #TABLES}. PostgreSQL 18 records NOT NULL
 * there like any other constraint, so the floor covers those as well and not only
 * the CHECKs, the keys and the foreign keys.
 */
class StaticPageConstraintsTest extends DatabaseTest {

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
	 * The three tables V24 adds.
	 *
	 * Package visible because
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()} adds
	 * this list to its own and compares the two against {@code pg_tables}.
	 */
	static final List<String> TABLES = List.of("static_page", "static_page_section", "static_page_include");

	/* A row of each table that breaks nothing: every violation below is one of these
	   with a single field spoiled, or a second row that collides with it on purpose,
	   so what fails is the field and not the fixture. Position 900 throughout is a
	   number no seeded section or include reaches (the rulebook, the longest page,
	   stops at 19), chosen so a fixture row cannot collide with real data by accident. */
	private static final String GOOD_PAGE =
			"insert into static_page (slug, title) values ('proba-strana', 'Proba')";
	private static final String GOOD_SECTION =
			"insert into static_page_section (page_id, position, heading, body, gallery) "
					+ "select id, 900, 'Proba', 'Tekst', 'ducats' from static_page where slug = 'pravilnik'";
	private static final String GOOD_INCLUDE =
			"insert into static_page_include (page_id, position, included_page_id) "
					+ "select a.id, 900, b.id from static_page a, static_page b "
					+ "where a.slug = 'pravilnik' and b.slug = 'politika-privatnosti'";

	static List<Violation> violations() {
		return List.of(
				// ------------------------------------------------------------- static_page
				Violation.of("static_page_pk",
						"insert into static_page (id, slug, title) "
								+ "select id, 'proba-strana', 'Proba' from static_page where slug = 'pravilnik'"),
				Violation.of("static_page_slug_unique",
						"insert into static_page (slug, title) values ('pravilnik', 'Proba')"),
				Violation.of("static_page_slug_not_blank",
						"insert into static_page (slug, title) values ('   ', 'Proba')"),
				Violation.of("static_page_title_not_blank",
						"insert into static_page (slug, title) values ('proba-strana', '   ')"),
				Violation.notNull("static_page_id_not_null", "id",
						"insert into static_page (id, slug, title) values (null, 'proba-strana', 'Proba')"),
				Violation.notNull("static_page_slug_not_null", "slug",
						"insert into static_page (slug, title) values (null, 'Proba')"),
				Violation.notNull("static_page_title_not_null", "title",
						"insert into static_page (slug, title) values ('proba-strana', null)"),

				// ----------------------------------------------------- static_page_section
				Violation.of("static_page_section_pk",
						"insert into static_page_section (id, page_id, position, heading, body) "
								+ "select id, page_id, 900, 'Proba', 'Tekst' from static_page_section "
								+ "where heading = '1. Uvodne odredbe'"),
				Violation.of("static_page_section_page_fk",
						"insert into static_page_section (page_id, position, heading, body) "
								+ "values (-1, 900, 'Proba', 'Tekst')"),
				Violation.of("static_page_section_position_unique",
						"insert into static_page_section (page_id, position, heading, body) "
								+ "select page_id, position, 'Proba', 'Tekst' from static_page_section "
								+ "where heading = '1. Uvodne odredbe'"),
				Violation.of("static_page_section_position_positive",
						"insert into static_page_section (page_id, position, heading, body) "
								+ "select id, 0, 'Proba', 'Tekst' from static_page where slug = 'pravilnik'"),
				Violation.of("static_page_section_heading_not_blank",
						"insert into static_page_section (page_id, position, heading, body) "
								+ "select id, 900, '   ', 'Tekst' from static_page where slug = 'pravilnik'"),
				/* `statute` existed for one day, 22.08.2026 (ADL.md:558), and left with its own
				   branch; it is exactly the value most likely to be typed back in by mistake. */
				Violation.of("static_page_section_gallery_known",
						"insert into static_page_section (page_id, position, heading, body, gallery) "
								+ "select id, 900, 'Proba', 'Tekst', 'statute' from static_page "
								+ "where slug = 'pravilnik'"),
				Violation.notNull("static_page_section_id_not_null", "id",
						"insert into static_page_section (id, page_id, position, heading, body) "
								+ "select null, id, 900, 'Proba', 'Tekst' from static_page where slug = 'pravilnik'"),
				Violation.notNull("static_page_section_page_id_not_null", "page_id",
						"insert into static_page_section (page_id, position, heading, body) "
								+ "values (null, 900, 'Proba', 'Tekst')"),
				Violation.notNull("static_page_section_position_not_null", "position",
						"insert into static_page_section (page_id, position, heading, body) "
								+ "select id, null, 'Proba', 'Tekst' from static_page where slug = 'pravilnik'"),
				Violation.notNull("static_page_section_heading_not_null", "heading",
						"insert into static_page_section (page_id, position, heading, body) "
								+ "select id, 900, null, 'Tekst' from static_page where slug = 'pravilnik'"),
				Violation.notNull("static_page_section_body_not_null", "body",
						"insert into static_page_section (page_id, position, heading, body) "
								+ "select id, 900, 'Proba', null from static_page where slug = 'pravilnik'"),

				// ----------------------------------------------------- static_page_include
				/* No row of this table exists before the test runs, so the PK and its two
				   unique keys are each broken by a single statement that writes two rows and
				   lets the second collide with the first, not by reaching for a seeded one. */
				Violation.of("static_page_include_pk",
						"insert into static_page_include (id, page_id, position, included_page_id) "
								+ "select 555555, a.id, 1, b.id from static_page a, static_page b "
								+ "where a.slug = 'pravilnik' and b.slug = 'politika-privatnosti' "
								+ "union all "
								+ "select 555555, a.id, 2, b.id from static_page a, static_page b "
								+ "where a.slug = 'uslovi-koriscenja' and b.slug = 'politika-privatnosti'"),
				Violation.of("static_page_include_page_fk",
						"insert into static_page_include (page_id, position, included_page_id) "
								+ "select -1, 1, id from static_page where slug = 'pravilnik'"),
				Violation.of("static_page_include_included_fk",
						"insert into static_page_include (page_id, position, included_page_id) "
								+ "select id, 1, -1 from static_page where slug = 'pravilnik'"),
				/* Same page, same position, DIFFERENT page taken in - so this trips the order
				   and nothing else. */
				Violation.of("static_page_include_position_unique",
						"insert into static_page_include (page_id, position, included_page_id) "
								+ "select a.id, 1, b.id from static_page a, static_page b "
								+ "where a.slug = 'pravilnik' and b.slug = 'politika-privatnosti' "
								+ "union all "
								+ "select a.id, 1, c.id from static_page a, static_page c "
								+ "where a.slug = 'pravilnik' and c.slug = 'uslovi-koriscenja'"),
				/* Same page, same page taken in, DIFFERENT position - so this trips "once per
				   page" and nothing else. */
				Violation.of("static_page_include_once_per_page",
						"insert into static_page_include (page_id, position, included_page_id) "
								+ "select a.id, 1, b.id from static_page a, static_page b "
								+ "where a.slug = 'pravilnik' and b.slug = 'politika-privatnosti' "
								+ "union all "
								+ "select a.id, 2, b.id from static_page a, static_page b "
								+ "where a.slug = 'pravilnik' and b.slug = 'politika-privatnosti'"),
				Violation.of("static_page_include_position_positive",
						"insert into static_page_include (page_id, position, included_page_id) "
								+ "select a.id, 0, b.id from static_page a, static_page b "
								+ "where a.slug = 'pravilnik' and b.slug = 'politika-privatnosti'"),
				Violation.of("static_page_include_not_self",
						"insert into static_page_include (page_id, position, included_page_id) "
								+ "select id, 1, id from static_page where slug = 'pravilnik'"),
				Violation.notNull("static_page_include_id_not_null", "id",
						"insert into static_page_include (id, page_id, position, included_page_id) "
								+ "select null, a.id, 1, b.id from static_page a, static_page b "
								+ "where a.slug = 'pravilnik' and b.slug = 'politika-privatnosti'"),
				Violation.notNull("static_page_include_page_id_not_null", "page_id",
						"insert into static_page_include (page_id, position, included_page_id) "
								+ "select null, 1, id from static_page where slug = 'pravilnik'"),
				Violation.notNull("static_page_include_position_not_null", "position",
						"insert into static_page_include (page_id, position, included_page_id) "
								+ "select a.id, null, b.id from static_page a, static_page b "
								+ "where a.slug = 'pravilnik' and b.slug = 'politika-privatnosti'"),
				Violation.notNull("static_page_include_included_page_id_not_null", "included_page_id",
						"insert into static_page_include (page_id, position, included_page_id) "
								+ "select id, 1, null from static_page where slug = 'pravilnik'"));
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
	 * remembered. See {@link RoleAndRightConstraintsTest#everyConstraintOnTheTwoTablesHasARowThatBreaksIt()},
	 * whose shape this repeats: {@code static_page_section_position_unique} backs
	 * itself with an ordinary unique constraint (unlike V5's partial index), so
	 * {@code pg_constraint} alone is the whole floor here and no union onto
	 * {@code pg_index} is needed.
	 */
	@Test
	void everyConstraintOnTheThreeTablesHasARowThatBreaksIt() {
		String tables = TABLES.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));

		List<String> declared = db
				.sql("select con.conname from pg_constraint con"
						+ " where con.conrelid = any (array[" + tables + "]::regclass[])"
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
	 * And a row that breaks nothing goes in.
	 *
	 * Without this every constraint above could be replaced by one that rejects
	 * everything and the whole file would still pass.
	 */
	@ParameterizedTest
	@ValueSource(strings = { GOOD_PAGE, GOOD_SECTION, GOOD_INCLUDE })
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isEqualTo(1);
	}

	/**
	 * A whole range of a page's own order moves in one statement.
	 *
	 * <p>{@code static_page_section_position_unique} covers two columns, and
	 * {@code KeysAndIndexesTest} says why its generic version of this case does not
	 * run against it: "a deferrable key over more than one column needs a shift
	 * written for it, not guessed" ({@code singleColumnOrderKeys}). This is that
	 * shift, written over the rulebook's own nineteen seeded sections rather than a
	 * fixture, because the maintenance being proven is that a whole page can be
	 * reordered - the exact operation {@code PageApiTest} needs to hold section order
	 * a functional read, and this is its floor at the schema.
	 */
	@Test
	void aRangeOfAPagesOwnSectionOrderMovesInOneStatement() {
		int shifted = db.sql("update static_page_section set position = position + 100"
						+ " where page_id = (select id from static_page where slug = 'pravilnik')")
				.update();

		assertThat(shifted).as("the shift did not touch every section of the rulebook").isEqualTo(19);
	}

	/**
	 * And two sections of the SAME page ending in one position are still refused.
	 *
	 * <p>The other half of the boundary: deferred moves the check to the end of the
	 * statement, it does not remove it. Scoped to one page on purpose - two DIFFERENT
	 * pages both have a section at position 1 by construction (every page's own
	 * sections start there), so a version of this case with no {@code page_id} in its
	 * {@code where} would collide on the wrong dimension and prove nothing about this
	 * constraint in particular.
	 */
	@Test
	void twoSectionsOfTheSamePageEndingInOnePositionAreStillRefused() {
		assertThatThrownBy(() -> db.sql("update static_page_section set position = 1"
						+ " where page_id = (select id from static_page where slug = 'pravilnik')"
						+ "   and position = 2")
				.update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("static_page_section_position_unique");
	}
}

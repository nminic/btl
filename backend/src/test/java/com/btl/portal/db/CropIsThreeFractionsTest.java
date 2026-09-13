package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE CROP IS THREE FRACTIONS BETWEEN 0 AND 1, and the database is the one asked.
 *
 * <p>ADL A17, owner's decision of 15.08.2026: "Isecak se pamti kao tri broja
 * izmedju 0 i 1, nikad kao pravougaonik u pikselima", because a pixel has to be
 * clamped against a width nobody has yet - the file is chosen in one browser,
 * cropped in another and looked at by a moderator in a third. The correction of
 * 13.09.2026 makes the shape a circle and leaves the count of numbers alone, so
 * the third of them is the DIAMETER of the circle inscribed in the old square:
 * the same number the old side was, which is why {@code crop_x} and {@code crop_y}
 * go on meaning what they meant.
 *
 * <p>V8 wrote all three as {@code integer}, which can hold no fraction at all, and
 * V21 is the correction. This is what says the correction is still there.
 *
 * <p><b>Nothing here is written from memory.</b> The column names come out of
 * {@code information_schema.columns}, each column's type out of
 * {@code format_type}, and which rules the crop carries out of
 * {@code pg_get_constraintdef}. What those rules DO is then measured by writing
 * rows, because a rule that reads correctly and is attached to the wrong column
 * reads correctly.
 *
 * <p><b>What this file does not do, said rather than left to be noticed.</b> Each
 * of the three constraints gets one row that breaks it in
 * {@link RegistrationConstraintsTest}, which is where every constraint on
 * {@code photo} answers and where the floor lives that would fail if one arrived
 * without a row. Here the same three are pushed at their ENDS, which is a
 * different question: that the bound is 0 and 1 exactly and not a bound that
 * merely rejects something.
 */
class CropIsThreeFractionsTest extends DatabaseTest {

	/* SHA-256 of nothing in particular, obvious rather than plausible, as in
	   RegistrationConstraintsTest. */
	private static final String A_DIGEST = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

	/** One of the three numbers, and a value to put in it. */
	record Probe(String column, String value) {

		@Override
		public String toString() {
			return column + " = " + value;
		}
	}

	/**
	 * The three numbers, and the whole of what this file is about.
	 *
	 * <p>Written by hand and the floor under it is
	 * {@link #theCropIsThreeColumnsAndTheThirdOfThemIsADiameter()}, which reads the
	 * table's columns out of the catalogue: a fourth crop column arriving, or one of
	 * these three being renamed again, fails there rather than quietly leaving a
	 * number here unmeasured.
	 */
	static List<String> theThreeNumbers() {
		return List.of("crop_x", "crop_y", "crop_diameter");
	}

	/**
	 * A value in one of the three, with the other two left on a legitimate crop.
	 *
	 * <p>The other two are legitimate AND different from each other on purpose: a
	 * row carrying the same number three times would let a case about one of them
	 * be answered by another, which is the fault the workspace rules call two
	 * sources for one value.
	 */
	private String photoWith(String column, String value) {
		String x = "crop_x".equals(column) ? value : "0.25";
		String y = "crop_y".equals(column) ? value : "0.75";
		String diameter = "crop_diameter".equals(column) ? value : "0.5";

		return "insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
				+ " values ('image/jpeg', 40960, '" + A_DIGEST + "', " + x + ", " + y + ", " + diameter + ")";
	}

	/** Every column the table carries, in the catalogue's own words. */
	private List<String> columnsOfPhoto() {
		return db
				.sql("select column_name from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = 'photo'"
						+ " order by column_name")
				.query(String.class)
				.list();
	}

	/** What the column's type is, asked rather than assumed. */
	private String typeOf(String column) {
		return db
				.sql("select format_type(att.atttypid, att.atttypmod) from pg_attribute att"
						+ " join pg_class rel on rel.oid = att.attrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and rel.relname = 'photo' and att.attname = ?")
				.param(column)
				.query(String.class)
				.single();
	}

	/** Whether PostgreSQL, asked in its own terms, answers yes. */
	private boolean yes(String sql) {
		return Boolean.TRUE.equals(db.sql(sql).query(Boolean.class).single());
	}

	/**
	 * The crop is these three columns and no others, read out of the catalogue.
	 *
	 * <p>The whole column list and not the ones whose name begins with {@code crop},
	 * because a prefix is a filter and a filter is a second list with the same
	 * problem the first one had: a crop column that arrived under some other name
	 * would be outside it and nothing would say so.
	 *
	 * <p>This is also what says {@code crop_side} is gone. The word said the shape
	 * was a square, and the shape is a circle (owner, 23.08.2026). V8's prose still
	 * says square and always will - a merged migration is never edited (ADL A2) -
	 * so V21's header is where the correction lives and this is what keeps it true.
	 */
	@Test
	void theCropIsThreeColumnsAndTheThirdOfThemIsADiameter() {
		assertThat(columnsOfPhoto())
				.as("the crop is three fractions and the third of them is a diameter (ADL A17, V21)")
				.containsExactly("byte_size", "crop_diameter", "crop_x", "crop_y", "digest", "id", "media_type",
						"uploaded_at");
	}

	/**
	 * A fraction survives the column's own type.
	 *
	 * <p>This is the whole of what V8 got wrong and the reason V21 exists: an
	 * {@code integer} column takes {@code 0.125} and gives back {@code 0}, so the
	 * only values it could hold between 0 and 1 were 0 and 1, and the three numbers
	 * were therefore pixels - exactly what A17 forbids.
	 *
	 * <p>Asked by casting through the type the catalogue reports rather than by
	 * comparing that type against a word written here: a test that reads
	 * {@code numeric(9,8)} and compares it to {@code numeric(9,8)} is a test about
	 * the spelling, and the spelling is not what refuses a member's crop.
	 */
	@ParameterizedTest
	@MethodSource("theThreeNumbers")
	void aFractionSurvivesTheColumnsOwnType(String column) {
		assertThat(yes("select cast(0.125 as " + typeOf(column) + ") = 0.125"))
				.as("`%s` is %s, which cannot hold a fraction, so the crop is in pixels again (ADL A17)",
						column, typeOf(column))
				.isTrue();
	}

	/**
	 * And arithmetic through it is exact, which is what decides between
	 * {@code numeric} and {@code double precision}.
	 *
	 * <p>ADL A12 settles the principle twice for this schema - amounts are "NUMERIC,
	 * nikad double", and a distance comparison must be decimal "jer bi tada 21.1
	 * umelo da promasi samo sebe" - and the crop is the same question. The rule V21
	 * adds is about the boundaries 0 and 1 EXACTLY, and under binary floating point
	 * a crop that left the browser as the decimal text "1" can come back a hair
	 * above it, so it would be taken or refused by an accident of representation
	 * rather than by the rule.
	 *
	 * <p>{@code 0.1 + 0.2 = 0.3} is false in {@code double precision} and true in
	 * {@code numeric}, and it is asked through the column's own type, so swapping
	 * the type in the migration fails here.
	 *
	 * <p><b>What is deliberately not pinned here:</b> how many decimal places the
	 * column declares. That is measured where it bites instead - the rows below are
	 * pushed one hundred millionth past each end, and a column declared coarser than
	 * that would round them onto the boundary and take them.
	 */
	@ParameterizedTest
	@MethodSource("theThreeNumbers")
	void arithmeticThroughTheColumnsOwnTypeIsExact(String column) {
		String type = typeOf(column);

		assertThat(yes("select cast(0.1 as " + type + ") + cast(0.2 as " + type + ") = cast(0.3 as " + type + ")"))
				.as("`%s` is %s, which is binary floating point, and the bounds 0 and 1 are exact ones (ADL A12)",
						column, type)
				.isTrue();
	}

	/**
	 * Every rule the schema has about the crop is one this file measures.
	 *
	 * <p>The floor under {@link #theThreeNumbers()} and under the two lists of rows
	 * below. Read out of {@code pg_constraint} and asked by what each rule SAYS
	 * rather than by what it is called, so a fourth rule about the crop added under
	 * any name at all fails here instead of standing unmeasured.
	 */
	@Test
	void everyRuleTheSchemaHasAboutTheCropIsOneThisFileMeasures() {
		List<String> rules = db
				.sql("select con.conname from pg_constraint con"
						+ " where con.conrelid = 'photo'::regclass and con.contype = 'c'"
						+ "  and pg_get_constraintdef(con.oid) like '%crop%'"
						+ " order by con.conname")
				.query(String.class)
				.list();

		assertThat(rules)
				.as("a rule about the crop that nothing below pushes at its ends")
				.containsExactly("photo_crop_diameter_in_range", "photo_crop_x_in_range", "photo_crop_y_in_range");
	}

	/**
	 * And each of the three rules is about its own number and no other.
	 *
	 * <p>Read out of {@code pg_get_constraintdef}, because this is the one question
	 * a written row cannot answer on its own: three rules that between them refuse
	 * everything the rows below hand over would pass every case in this file while
	 * being attached to the wrong columns.
	 */
	@ParameterizedTest
	@MethodSource("theThreeNumbers")
	void eachRuleIsAboutItsOwnNumber(String column) {
		String rule = db
				.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " where con.conrelid = 'photo'::regclass and con.contype = 'c'"
						+ "  and con.conname = ?")
				.param("photo_" + column + "_in_range")
				.query(String.class)
				.single();

		assertThat(rule).startsWith("CHECK").contains(column);

		for (String other : theThreeNumbers()) {
			if (!other.equals(column)) {
				assertThat(rule)
						.as("the rule named for `%s` reads `%s` as well, so one of the two is unguarded",
								column, other)
						.doesNotContain(other);
			}
		}
	}

	/**
	 * A crop past either end is refused, and by its own rule.
	 *
	 * <p>One hundred millionth past, and not a tenth: a tenth would also be refused
	 * by a column declared with two decimal places, which would have rounded a
	 * member's crop to something they did not choose long before anybody noticed.
	 * At this distance the row can only be refused by a column fine enough to see
	 * it, so the declared scale is measured here rather than read off the type.
	 *
	 * <p>{@code 0} is in this list for the diameter and not for the two positions,
	 * and that is the half of V8's {@code photo_crop_inside} that was alive and
	 * stays alive: an offset may be flush against the start, a circle of no diameter
	 * is not a crop of a photograph. The portal is stricter still and refuses a
	 * circle under 240 real pixels, which the schema cannot say because it would
	 * have to know the shape of the picture.
	 */
	@ParameterizedTest
	@MethodSource
	void aCropPastEitherEndIsRefused(Probe probe) {
		assertThatThrownBy(() -> db.sql(photoWith(probe.column(), probe.value())).update())
				.as("%s goes in, and the crop is three fractions between 0 and 1 (ADL A17)", probe)
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("photo_" + probe.column() + "_in_range");
	}

	static Stream<Probe> aCropPastEitherEndIsRefused() {
		return Stream.concat(
				theThreeNumbers().stream()
						.flatMap(column -> Stream.of(
								new Probe(column, "-0.00000001"),
								new Probe(column, "1.00000001"))),
				Stream.of(new Probe("crop_diameter", "0")));
	}

	/**
	 * And the boundary itself goes in, which is the other half and the one a rule
	 * that refuses everything would fail.
	 *
	 * <p>Without this every rule above could be replaced by {@code check (false)}
	 * and the whole file would still pass. {@code between} is inclusive on purpose:
	 * 0 and 1 are legitimate positions - flush against the start and against the end
	 * - and 1 is the largest circle the picture holds, which is what a photograph
	 * with no crop of its own means everywhere in the portal.
	 *
	 * <p>The diameter's lower end is one step above nothing rather than nothing,
	 * because that is what its rule says and the case above is what says it.
	 */
	@ParameterizedTest
	@MethodSource
	void theBoundaryItselfGoesIn(Probe probe) {
		assertThat(db.sql(photoWith(probe.column(), probe.value())).update())
				.as("%s is refused, and it is a crop a member may choose (ADL A17)", probe)
				.isOne();
	}

	static Stream<Probe> theBoundaryItselfGoesIn() {
		return Stream.of(
				new Probe("crop_x", "0"),
				new Probe("crop_x", "1"),
				new Probe("crop_y", "0"),
				new Probe("crop_y", "1"),
				new Probe("crop_diameter", "0.00000001"),
				new Probe("crop_diameter", "1"));
	}
}

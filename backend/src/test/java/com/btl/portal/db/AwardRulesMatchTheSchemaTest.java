package com.btl.portal.db;

import com.btl.portal.domain.award.DucatKind;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE BADGE RULES IN THE CODE ARE THE BADGE RULES IN THE SCHEMA, asked of the
 * database rather than remembered.
 *
 * <p>{@link DucatKind} is a list written by hand, and so is the set of length
 * bands it counts by name. Both have a source of truth that is not a second list
 * somewhere else, and this is where the two are tied.
 */
class AwardRulesMatchTheSchemaTest extends DatabaseTest {

	/**
	 * Every quantity the codebook holds is one the code can measure, and every one
	 * it can measure is in the codebook.
	 *
	 * <p>Both directions, because either alone is half a guard. A quantity in the
	 * codebook with no case here is a badge nobody can ever win, and it would be
	 * found the day a member asks why; a quantity here with no row in the codebook
	 * is dead code that looks like a rule.
	 *
	 * <p>The eleventh is the interesting one. {@code countryCount} is in the
	 * codebook and the portal answers it with nought, because the browser never
	 * loads the events a country comes from (ADL A12, 8). The server joins through
	 * to the event and can answer it, which is why it is measured here and not
	 * left out.
	 */
	@Test
	void everyQuantityTheCodebookHoldsIsOneTheCodeCanMeasure() {
		List<String> codebook = db.sql("select code from ducat_kind order by code").query(String.class).list();

		assertThat(DucatKind.codes())
				.as("the quantities the code knows are not the quantities the schema holds")
				.containsExactlyInAnyOrderElementsOf(codebook);
	}

	/** And every badge in the schema is measured in one of them, which is what
	 *  makes the list above worth keeping in step. */
	@Test
	void everyBadgeIsMeasuredInAQuantityTheCodeKnows() {
		List<String> used = db.sql("select distinct kind from ducat order by kind").query(String.class).list();

		assertThat(used).as("the schema holds no badges at all, so this measures nothing").isNotEmpty();
		assertThat(DucatKind.codes()).containsAll(used);
	}

	/**
	 * EVERY LENGTH BAND THE CODE COUNTS IS ONE POSTGRES CAN PRODUCE, and every one
	 * it produces is counted.
	 *
	 * <p>The bands are a generated column: the schema alone decides what a
	 * marathon is, at the exact boundaries PDL P5 draws. Writing those boundaries
	 * out again in Java would be one rule in two places; writing only the NAMES
	 * out, as {@link DucatKind} does, is safe exactly as long as the names agree,
	 * and that is what this asks.
	 *
	 * <p><b>It asks PostgreSQL, not the file.</b> The expression is taken out of
	 * the catalogue and evaluated over fifty thousand distances, one every ten
	 * metres from ten metres to five hundred kilometres. Reading the migration's
	 * text instead would be a guess about how the rule is written; this is the
	 * rule being run. The span is the boundary and is named here rather than left
	 * to be found: a band that only appears past five hundred kilometres would not
	 * show up, and no such band exists today.
	 */
	@Test
	void everyLengthBandTheCodeCountsIsOneTheSchemaProduces() {
		String expression = db.sql("select pg_get_expr(attrdef.adbin, attrdef.adrelid)"
						+ " from pg_attrdef attrdef"
						+ " join pg_attribute attribute on attribute.attrelid = attrdef.adrelid"
						+ "  and attribute.attnum = attrdef.adnum"
						+ " join pg_class rel on rel.oid = attrdef.adrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and rel.relname = 'result'"
						+ "  and attribute.attname = 'category'")
				.query(String.class).single();

		assertThat(expression)
				.as("the band is no longer worked out by the schema, so nothing here is measuring the rule")
				.contains("distance_km");

		Set<String> produced = Set.copyOf(db.sql("select distinct " + expression + " as band"
						+ " from generate_series(0.01, 500.00, 0.01) as distance_km")
				.query(String.class).list());

		assertThat(produced)
				.as("the bands the code counts are not the bands the schema can produce")
				.isEqualTo(DucatKind.bandsCounted());
	}
}

package com.btl.portal.db;

import com.btl.portal.domain.member.MemberNumber;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE SHAPE THE CODE PRODUCES IS THE SHAPE THE SCHEMA ACCEPTS, and PostgreSQL is
 * the one asked.
 *
 * <p>{@code MemberNumber} carries a pattern and so does
 * {@code competitor_member_number_shape}. Comparing one written pattern against
 * another would be reading, not measuring: two patterns can be spelled
 * differently and mean the same thing, or spelled the same and behave
 * differently, and neither is visible by looking. So the constraint's own
 * expression is taken out of the catalogue and PostgreSQL is asked to judge
 * every value the code produces and every value the code refuses.
 */
class MemberNumberMatchesTheSchemaTest extends DatabaseTest {

	/** What the schema itself says a member number looks like, in its own words. */
	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and con.conname = 'competitor_member_number_shape'")
				.query(String.class).single();
	}

	/** Whether PostgreSQL, applying its own rule, would take this value. */
	private boolean theSchemaTakes(String value) {
		String rule = whatTheSchemaSays();
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		return Boolean.TRUE.equals(db.sql("select " + condition.replace("member_number", "?"))
				.param(value).query(Boolean.class).single());
	}

	@Test
	void theSchemaStillHasARuleAboutTheShapeAtAll() {
		assertThat(whatTheSchemaSays())
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("member_number")
				.startsWith("CHECK");
	}

	/**
	 * Every number the code hands out is one the schema would store.
	 *
	 * <p>The ends and the places where padding begins and ends, because those are
	 * where a width goes wrong: one, the first that needs no padding at all, the
	 * first of each length, and the last there is.
	 */
	@ParameterizedTest
	@ValueSource(ints = {1, 9, 10, 99, 100, 999, 1000, 9999, 10_000, 99_999, 100_000, 123_456,
			MemberNumber.HIGHEST})
	void everyNumberTheCodeHandsOutIsOneTheSchemaWouldStore(int value) {
		assertThat(theSchemaTakes(MemberNumber.of(value).written()))
				.as("the schema would refuse %d, which the code hands out", value)
				.isTrue();
	}

	/**
	 * And everything the code refuses, the schema refuses too.
	 *
	 * <p>The other direction, and the one that is easy to leave out: a code that
	 * refused everything would pass the case above by refusing to produce anything
	 * wrong, while letting a value typed in from somewhere else straight through.
	 * These are the ways one arrives from somewhere other than the sequence.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "1", "12345", "1234567", "12345 ", " 12345", "00 0001", "m00127",
			"000001a", "-00001", "+00001", "٠٠٠٠٠١"})
	void everythingTheCodeRefusesTheSchemaRefusesToo(String written) {
		assertThat(theSchemaTakes(written))
				.as("the schema would store '%s', which the code says is not a member number", written)
				.isFalse();
	}

	/**
	 * And the COLUMN holds all six, which the rule above does not say.
	 *
	 * <p>A rule allowing six digits and a column able to hold them are two
	 * statements, and every case above measures only the first: the rule could go
	 * on saying six while the column became a {@code varchar(5)}, and a value
	 * would then be refused by the column rather than by the rule - or, in a
	 * database configured to be forgiving, quietly cut short.
	 *
	 * <p>Asked by casting to the column's OWN type, read out of the catalogue,
	 * rather than by writing a row: there is no competitor in a fresh schema to
	 * write to, and inserting one would drag in a dozen columns that have nothing
	 * to do with this. What comes back must be what went in.
	 */
	@Test
	void theColumnItselfHoldsAllSixDigits() {
		String type = db.sql("select format_type(attribute.atttypid, attribute.atttypmod)"
						+ " from pg_attribute attribute"
						+ " join pg_class rel on rel.oid = attribute.attrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and rel.relname = 'competitor'"
						+ "  and attribute.attname = 'member_number'")
				.query(String.class).single();

		String handedOut = MemberNumber.of(MemberNumber.HIGHEST).written();

		assertThat(db.sql("select cast(? as " + type + ")").param(handedOut).query(String.class).single())
				.as("the column's type (%s) does not give back the number that was handed out", type)
				.isEqualTo(handedOut);
	}
}

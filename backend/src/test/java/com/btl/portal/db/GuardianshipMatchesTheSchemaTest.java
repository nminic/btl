package com.btl.portal.db;

import com.btl.portal.domain.registration.Guardianship.Relation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE THREE WHO MAY SIGN ARE THE THREE THE SCHEMA STORES, and PostgreSQL is the
 * one asked.
 *
 * <p>{@code Guardianship.Relation} is a list written by hand and so is
 * {@code parental_consent_relation_known}. Comparing one written list against
 * another would be reading; the rule is taken out of the catalogue and the
 * database is asked to judge each code instead.
 *
 * <p>A fourth relation would be one nobody could have chosen: the form offers
 * three (mother, father, guardian) and all three legal texts name those three
 * (owner, 11.08.2026, "Zaboravio sam na ovo, može da ostane"). So the two
 * directions are both worth a case - one in the schema with no case in the code
 * is a signature nobody can read back, and one in the code with no row in the
 * schema is an option the form could offer and the database would refuse.
 */
class GuardianshipMatchesTheSchemaTest extends DatabaseTest {

	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and con.conname = 'parental_consent_relation_known'")
				.query(String.class).single();
	}

	/** Whether PostgreSQL, applying its own rule, would take this relation. */
	private boolean theSchemaTakes(String code) {
		String rule = whatTheSchemaSays();
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		return Boolean.TRUE.equals(db.sql("select " + condition.replace("relation", "cast(? as text)"))
				.param(code).query(Boolean.class).single());
	}

	@Test
	void theSchemaStillHasARuleAboutWhoMaySign() {
		assertThat(whatTheSchemaSays())
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("relation")
				.startsWith("CHECK");
	}

	@ParameterizedTest
	@EnumSource(Relation.class)
	void everyRelationTheCodeKnowsIsOneTheSchemaStores(Relation relation) {
		assertThat(theSchemaTakes(relation.code()))
				.as("the schema would refuse a consent signed by the %s", relation.code())
				.isTrue();
	}

	/**
	 * And the schema knows no relation the code cannot read back.
	 *
	 * <p>The other direction, and the one a list of three cannot do for itself:
	 * read out of the rule rather than written here, so a fourth added to the
	 * schema alone fails this rather than sitting in the database as a signature
	 * the portal cannot name.
	 */
	@Test
	void theSchemaStoresNoRelationTheCodeCannotReadBack() {
		String rule = whatTheSchemaSays();

		List<String> theirs = Arrays.stream(rule.substring(rule.indexOf("ARRAY[") + "ARRAY[".length(),
						rule.lastIndexOf(']')).split(","))
				.map(one -> one.replace("'", "").replace("::text", "").trim())
				.toList();

		assertThat(theirs).as("the rule is no longer a list of names, so nothing was read out of it")
				.isNotEmpty();
		assertThat(Arrays.stream(Relation.values()).map(Relation::code).toList())
				.as("the schema stores a relation the portal has no name for")
				.containsExactlyInAnyOrderElementsOf(theirs);
	}

	/**
	 * And a relation nobody could have chosen is refused by both.
	 *
	 * <p>The rows are the ways a wrong one arrives: another family member the form
	 * never offered, the same word in another language, and the same word in
	 * another case - which is what would slip through a rule written without
	 * regard to it.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"uncle", "majka", "Mother", "MOTHER", "", " father", "father "})
	void whatNobodyCouldHaveChosenIsRefusedByBoth(String code) {
		assertThat(theSchemaTakes(code))
				.as("the schema would store a consent signed by the '%s'", code)
				.isFalse();
	}
}

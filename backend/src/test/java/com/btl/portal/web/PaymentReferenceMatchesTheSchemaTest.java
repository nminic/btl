package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE SHAPE OF A REFERENCE THE ROUTE TAKES IS THE SHAPE THE SCHEMA ALLOWS, and PostgreSQL is the one
 * asked.
 *
 * <p>The rule "exactly ten digits" (owner, PDL P8, 20.10.2026) lives in two places, the pattern in
 * {@code PaymentApi} and the check constraint {@code payment_reference_shape} (V68), and a rule
 * written twice is only as safe as the floor under the pair. The floor is not a third copy of the
 * rule: the constraint's own expression is taken out of the catalogue and PostgreSQL is asked to
 * judge each candidate, exactly the shape {@link PaymentMethodsMatchTheSchemaTest} uses over
 * {@code payment_method_known}.
 *
 * <p><b>The candidates are generated and not listed.</b> Every length from nought to sixteen made of
 * digits, which is where a pattern of {@code {7,}}, {@code {10,}}, {@code {9,10}} or {@code {11}}
 * differs from the constraint's and the decision's "nine or eleven are refused", and then the texts
 * that are the right length and the wrong content: a letter, a space inside, a sign, ten digits of
 * another script, and ten digits followed by a line break (the case where {@code $} is read
 * differently by the two engines, so it is asked rather than assumed).
 *
 * <p><b>It holds in both directions, and they fail differently.</b> A reference the route takes and
 * the table refuses is a 500 on a moderator pressing a button, thrown after the member number has been
 * drawn. A reference the table would hold and the route refuses is a rule written twice that says two
 * things, which is how a seven-digit floor outlived the decision to make it ten for as long as it did.
 *
 * <p>This class lives here and not beside its siblings in {@code com.btl.portal.db} because the
 * pattern is package private to {@code PaymentApi}, and moving it into the domain to reach it from
 * there would be moving production logic to suit a test.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class PaymentReferenceMatchesTheSchemaTest {

	@Autowired
	JdbcClient db;

	/** What the schema itself says a payment's reference may be, in its own words. */
	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and con.conname = 'payment_reference_shape'")
				.query(String.class).single();
	}

	/** Whether PostgreSQL, applying its own rule, would take this reference. */
	private boolean theSchemaTakes(String reference) {
		String rule = whatTheSchemaSays();
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		/* The rule names the column twice (`reference is null or reference ~ ...`), so the candidate is
		   given as a one row table with a column of that name, and the expression is evaluated exactly
		   as the catalogue hands it back. */
		return Boolean.TRUE.equals(db.sql("select " + condition
						+ " from (select ?::text as reference) as probe")
				.param(1, reference).query(Boolean.class).single());
	}

	private static List<String> candidates() {
		List<String> every = new ArrayList<>();

		for (int length = 0; length <= 16; length++) {
			every.add("2".repeat(length));
		}

		every.add("202700002a");
		every.add("a027000027");
		every.add("202700 0027");
		every.add("-027000027");
		every.add("+027000027");
		every.add("２０２７０００００２");
		every.add("2027000027\n");
		every.add("\n2027000027");

		return every;
	}

	@Test
	void theSchemaStillHasARuleAboutTheReferenceAtAll() {
		assertThat(whatTheSchemaSays())
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("reference")
				.startsWith("CHECK");
	}

	/** The route and the constraint agree on every candidate, whichever way they would disagree. */
	@Test
	void theRouteAndTheConstraintTakeTheSameReferences() {
		for (String candidate : candidates()) {
			assertThat(PaymentApi.A_REFERENCE.matcher(candidate).matches())
					.as("the route and the schema disagree about the reference '%s' (length %d)",
							candidate.replace("\n", "\\n"), candidate.length())
					.isEqualTo(theSchemaTakes(candidate));
		}
	}

	/**
	 * And the pair is not agreeing on a rule that takes everything, or nothing.
	 *
	 * <p>Without this the case above would pass against two rules that both accept every text, and a
	 * floor that accepts everything holds nothing up. Ten digits of the season and a member number
	 * are taken, and nine and eleven are not: the decision itself, asked of the database.
	 */
	@Test
	void tenDigitsAreTakenAndNineAndElevenAreNot() {
		assertThat(theSchemaTakes("2027000027")).as("the schema refuses ten digits").isTrue();
		assertThat(theSchemaTakes("202700002")).as("the schema takes nine digits").isFalse();
		assertThat(theSchemaTakes("20270000271")).as("the schema takes eleven digits").isFalse();

		assertThat(PaymentApi.A_REFERENCE.matcher("2027000027").matches())
				.as("the route refuses ten digits").isTrue();
		assertThat(PaymentApi.A_REFERENCE.matcher("202700002").matches())
				.as("the route takes nine digits").isFalse();
		assertThat(PaymentApi.A_REFERENCE.matcher("20270000271").matches())
				.as("the route takes eleven digits").isFalse();
	}
}

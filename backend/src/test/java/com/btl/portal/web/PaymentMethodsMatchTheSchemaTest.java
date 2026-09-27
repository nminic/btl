package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE WAYS THE CODE KNOWS MONEY ARRIVES ARE THE WAYS THE SCHEMA ALLOWS, and PostgreSQL is the one
 * asked.
 *
 * <p>{@code PaymentApi.METHODS} is a list written by hand, and a list written by hand is only as safe
 * as the floor under it. The floor is not another written list: the constraint's own expression is
 * taken out of the catalogue and PostgreSQL is asked to judge, exactly the shape
 * {@code PaymentStatesMatchTheSchemaTest} uses over {@code payment_state_known}.
 *
 * <p><b>WHY THIS WAS WRITTEN THE DAY V39 WAS, AND IT IS A MEASUREMENT RATHER THAN TIDINESS.</b> The
 * screen has read {@code 'ips' | 'paypal'} since the card was taken out on 26.09.2026
 * ({@code frontend/src/data/paymentQr.ts}), the table read {@code slip, card, paypal, sepa} since
 * V16, and the route read a copy of the table's four. Three vocabularies, one of them already
 * different, and nothing in the portal noticed for a day. Two of the three are now the same word and
 * this is what keeps them that way; the third is a screen and lives on the other side of the wire,
 * which is said out loud here rather than pretended about.
 *
 * <p><b>It has to hold in both directions, and they fail differently.</b> A method the route accepts
 * and the table refuses is a 500 on a moderator pressing a button, thrown after the member number
 * has been drawn. A method the table would hold and the route does not know is a word nothing can
 * ever write, which is how {@code sepa} lived in this schema from V16 until V39 without one row, one
 * screen or one case ever saying it.
 *
 * <p>The annotations are the ones every other database-reading test in this package carries, and this
 * class lives here rather than beside its sibling in {@code com.btl.portal.db} for one reason:
 * {@code METHODS} is package private, and moving it into the domain to reach it from there would be
 * moving production logic to suit a test.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class PaymentMethodsMatchTheSchemaTest {

	/** Every literal in a rule, which is what an enumerated rule is made of. */
	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	@Autowired
	JdbcClient db;

	/** What the schema itself says a payment's method may be, in its own words. */
	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and con.conname = 'payment_method_known'")
				.query(String.class).single();
	}

	/** Whether PostgreSQL, applying its own rule, would take this method. */
	private boolean theSchemaTakes(String method) {
		String rule = whatTheSchemaSays();
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		return Boolean.TRUE.equals(db.sql("select " + condition.replace("method", "?::text"))
				.param(1, method).query(Boolean.class).single());
	}

	@Test
	void theSchemaStillHasARuleAboutTheMethodAtAll() {
		assertThat(whatTheSchemaSays())
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("method")
				.startsWith("CHECK");
	}

	/** Every method the route accepts is one the table would hold. */
	@Test
	void whatTheCodeKnowsTheSchemaTakes() {
		for (String method : PaymentApi.METHODS) {
			assertThat(theSchemaTakes(method))
					.as("the route accepts the method '%s' and the table refuses it", method)
					.isTrue();
		}
	}

	/**
	 * And nothing else is, which is the direction a hand written list gets wrong.
	 *
	 * <p>The two words are not typed out here a second time; they are read off the rule PostgreSQL
	 * hands back. A third word added to the schema tomorrow arrives in this set on its own and fails
	 * this the same day, instead of sitting in the table unreachable the way {@code sepa} did.
	 */
	@Test
	void andWhatTheSchemaTakesTheCodeKnows() {
		Matcher found = SPELLED_OUT.matcher(whatTheSchemaSays());
		Set<String> saidInTheRule = found.results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(saidInTheRule)
				.as("the rule names no methods at all, so this is comparing an empty set")
				.isNotEmpty();
		assertThat(saidInTheRule)
				.as("the schema and PaymentApi.METHODS no longer say the same thing")
				.isEqualTo(PaymentApi.METHODS);
	}

	/**
	 * And the rule is a rule: something outside it is refused.
	 *
	 * <p>Without this the two cases above would both pass against a constraint that takes anything at
	 * all, and a floor that accepts everything holds nothing up.
	 *
	 * <p><b>The three words asked about are the three V39 took away</b>, and they are asked here
	 * rather than invented because they are the only words that were ever legal and are not any more.
	 * A constraint written back to V16's list, or to any part of it, is refused by this and by
	 * nothing else in this file.
	 */
	@Test
	void amethodThatWasRetiredIsRefused() {
		for (String retired : Set.of("slip", "card", "sepa")) {
			assertThat(theSchemaTakes(retired))
					.as("the table would hold '%s', which the owner retired on 27.09.2026 (PDL 23b)",
							retired)
					.isFalse();
		}
	}
}

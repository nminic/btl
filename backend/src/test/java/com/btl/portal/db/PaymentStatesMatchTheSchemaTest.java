package com.btl.portal.db;

import com.btl.portal.domain.payment.RecordingAPayment;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE STATES THE CODE KNOWS ARE THE STATES THE SCHEMA ALLOWS, and PostgreSQL is
 * the one asked.
 *
 * <p>{@code RecordingAPayment.STATES} is a list written by hand, and a list
 * written by hand is only as safe as the floor under it. The floor is not another
 * written list: the constraint's own expression is taken out of the catalogue and
 * PostgreSQL is asked to judge, exactly the shape
 * {@code MemberNumberMatchesTheSchemaTest} uses two files away.
 *
 * <p><b>It has to hold in both directions, and they fail differently.</b> A state
 * the code knows and the schema refuses would let a row be built that the table
 * throws out; a state the schema allows and the code does not know would reach
 * {@code decide} and be answered as though it were waiting for money.
 */
class PaymentStatesMatchTheSchemaTest extends DatabaseTest {

	/** Every literal in a rule, which is what an enumerated rule is made of. */
	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	/** What the schema itself says a payment's state may be, in its own words. */
	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and con.conname = 'payment_state_known'")
				.query(String.class).single();
	}

	/** Whether PostgreSQL, applying its own rule, would take this state. */
	private boolean theSchemaTakes(String state) {
		String rule = whatTheSchemaSays();
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		return Boolean.TRUE.equals(db.sql("select " + condition.replace("state", "?::text"))
				.param(1, state).query(Boolean.class).single());
	}

	@Test
	void theSchemaStillHasARuleAboutTheStateAtAll() {
		assertThat(whatTheSchemaSays())
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("state")
				.startsWith("CHECK");
	}

	/** Every state the code names is one the table would hold. */
	@Test
	void whatTheCodeKnowsTheSchemaTakes() {
		for (String state : RecordingAPayment.STATES) {
			assertThat(theSchemaTakes(state))
					.as("the code knows the state '%s' and the table refuses it", state)
					.isTrue();
		}
	}

	/**
	 * And nothing else is, which is the direction a hand written list gets wrong.
	 *
	 * <p>The states are not typed out here a second time; they are read off the
	 * rule PostgreSQL hands back. A fourth state added to the schema tomorrow
	 * arrives in this set on its own and fails this the same day, instead of
	 * waiting to be answered as though somebody were still owing money.
	 */
	@Test
	void andWhatTheSchemaTakesTheCodeKnows() {
		Matcher found = SPELLED_OUT.matcher(whatTheSchemaSays());
		Set<String> saidInTheRule = found.results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(saidInTheRule)
				.as("the rule names no states at all, so this is comparing an empty set")
				.isNotEmpty();
		assertThat(saidInTheRule)
				.as("the schema and RecordingAPayment.STATES no longer say the same thing")
				.isEqualTo(RecordingAPayment.STATES);
	}

	/**
	 * And the rule is a rule: something outside it is refused.
	 *
	 * <p>Without this the two cases above would both pass against a constraint that
	 * takes anything at all, and a floor that accepts everything holds nothing up.
	 */
	@Test
	void aStateNobodyNamedIsRefused() {
		assertThat(theSchemaTakes("settled"))
				.as("the table would hold a state nothing in the portal can produce")
				.isFalse();
	}
}

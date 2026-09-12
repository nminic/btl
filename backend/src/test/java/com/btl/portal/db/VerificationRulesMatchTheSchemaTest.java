package com.btl.portal.db;

import com.btl.portal.domain.verification.DecidingOnASubmission;
import com.btl.portal.domain.verification.DecidingOnASubmission.Answer;
import com.btl.portal.domain.verification.DecidingOnASubmission.Outcome;
import com.btl.portal.domain.verification.DecidingOnASubmission.Submission;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT THE CODE DECIDES IS A ROW THE TABLE WILL HOLD, and PostgreSQL is the one
 * asked.
 *
 * <p>{@code DecidingOnASubmission} carries a list of states and a rule about
 * when a reason may be there; {@code verification_state_known} and
 * {@code verification_refusal_says_why} carry the same two things in SQL.
 * Comparing one written rule against another would be reading rather than
 * measuring, so the constraints' own expressions come out of the catalogue and
 * PostgreSQL is asked to judge - the shape
 * {@code MemberNumberMatchesTheSchemaTest} uses in this same package.
 *
 * <p><b>The reason rule is the one worth the trouble.</b> It is a biconditional,
 * so it fails in BOTH directions: a refusal without a reason and an approval
 * with one are each thrown out. A class that got either half wrong would be
 * writing rows the table refuses, and a constraint violation reaches a moderator
 * as a server fault rather than as a saved decision.
 */
class VerificationRulesMatchTheSchemaTest extends DatabaseTest {

	/** Every literal in a rule, which is what an enumerated rule is made of. */
	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	private String whatTheSchemaSays(String constraint) {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = ?")
				.param(constraint).query(String.class).single();
	}

	/** The rule's own expression, with the column names taken out of the CHECK wrapper. */
	private String conditionOf(String constraint) {
		String rule = whatTheSchemaSays(constraint);

		return rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));
	}

	/**
	 * Whether PostgreSQL, applying its own rule, would take this row.
	 *
	 * <p>Each column named in the rule is replaced by a parameter wherever it
	 * appears, in the order the expression names them, so a rule mentioning one
	 * column twice is given the same value twice. Counting the question marks left
	 * behind would not do: a pattern can hold one of its own.
	 */
	private boolean theSchemaTakes(String constraint, String state, String reason) {
		String condition = conditionOf(constraint);
		List<String> inOrder = new ArrayList<>();
		Matcher named = Pattern.compile("\\b(state|reason)\\b").matcher(condition);
		StringBuilder asked = new StringBuilder();

		while (named.find()) {
			inOrder.add(named.group(1));
			named.appendReplacement(asked, "?::text");
		}

		named.appendTail(asked);

		var query = db.sql("select " + asked);

		for (int at = 0; at < inOrder.size(); at++) {
			query = query.param(at + 1, "state".equals(inOrder.get(at)) ? state : reason);
		}

		return Boolean.TRUE.equals(query.query(Boolean.class).single());
	}

	@Test
	void theSchemaStillHasBothRules() {
		assertThat(whatTheSchemaSays("verification_state_known"))
				.as("the rule about states is gone, so nothing here is being compared")
				.startsWith("CHECK").contains("state");
		assertThat(whatTheSchemaSays("verification_refusal_says_why"))
				.as("the rule about reasons is gone, so nothing here is being compared")
				.startsWith("CHECK").contains("reason");
	}

	/** Every state the code names is one the table would hold, and nothing else is. */
	@Test
	void theStatesTheCodeKnowsAreTheStatesTheSchemaTakes() {
		for (String state : DecidingOnASubmission.STATES) {
			assertThat(theSchemaTakes("verification_state_known", state, null))
					.as("the code knows the state '%s' and the table refuses it", state)
					.isTrue();
		}

		Matcher found = SPELLED_OUT.matcher(whatTheSchemaSays("verification_state_known"));
		Set<String> saidInTheRule = found.results().map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(saidInTheRule)
				.as("the rule names no states at all, so this compares an empty set")
				.isNotEmpty();
		assertThat(saidInTheRule)
				.as("the schema and DecidingOnASubmission.STATES no longer say the same thing")
				.isEqualTo(DecidingOnASubmission.STATES);
		assertThat(theSchemaTakes("verification_state_known", "pending", null))
				.as("the table would hold a state nothing in the portal can produce")
				.isFalse();
	}

	/**
	 * AND EVERY ROW THE CODE WOULD WRITE IS ONE THE TABLE HOLDS.
	 *
	 * <p>Both answers, and both with the box full and empty, because the rule is a
	 * biconditional and each half fails differently. The third case is the one the
	 * class exists for: a note typed before a yes, which the class drops and the
	 * table would refuse.
	 */
	@Test
	void everyRowTheCodeWouldWriteTheSchemaHolds() {
		Submission waiting = new Submission(DecidingOnASubmission.WAITING);

		for (Answer answer : List.of(new Answer(true, ""), new Answer(true, "predomislio sam se"),
				new Answer(false, "trka nije u kalendaru"))) {

			Outcome outcome = DecidingOnASubmission.decide(waiting, answer);
			String state = outcome == Outcome.APPROVE_IT
					? DecidingOnASubmission.APPROVED
					: DecidingOnASubmission.REJECTED;

			assertThat(outcome)
					.as("this case is meant to be one the code records, and it is not")
					.isIn(Outcome.APPROVE_IT, Outcome.REJECT_IT);
			assertThat(theSchemaTakes("verification_refusal_says_why", state,
					DecidingOnASubmission.reasonAsItGoesIn(answer)))
					.as("the code would write %s with the reason it chose, and the table refuses it", state)
					.isTrue();
		}
	}

	/**
	 * And the rule is a rule: the two rows the class refuses to write, the table
	 * refuses to hold.
	 *
	 * <p>Without this the case above would pass against a constraint that takes
	 * anything, and a floor that accepts everything holds nothing up.
	 */
	@Test
	void theTwoRowsTheCodeNeverWritesTheSchemaRefuses() {
		assertThat(theSchemaTakes("verification_refusal_says_why",
				DecidingOnASubmission.REJECTED, null))
				.as("a refusal with no reason would be held, and the member would be told nothing")
				.isFalse();
		assertThat(theSchemaTakes("verification_refusal_says_why",
				DecidingOnASubmission.APPROVED, "predomislio sam se"))
				.as("an approval carrying a reason would be held")
				.isFalse();
	}
}

package com.btl.portal.db;

import com.btl.portal.domain.result.ProofThatTheRunHappened;
import com.btl.portal.domain.result.ProofThatTheRunHappened.Outcome;
import com.btl.portal.domain.result.ProofThatTheRunHappened.Report;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT THE CODE LETS THROUGH IS WHAT THE TABLE WILL HOLD, and PostgreSQL is the
 * one asked.
 *
 * <p>{@code ProofThatTheRunHappened} carries a pattern and so does
 * {@code result_submission_link_shape}. Comparing one written pattern against
 * another would be reading rather than measuring: two patterns can be spelled
 * differently and mean the same thing, or spelled the same and behave
 * differently, and neither is visible by looking. So the constraint's own
 * expression is taken out of the catalogue and PostgreSQL is asked to judge, the
 * shape {@code MemberNumberMatchesTheSchemaTest} uses in this same package.
 *
 * <p><b>What is compared is the link AS IT WOULD BE WRITTEN, not as it was
 * typed</b>, and that is the whole point rather than a detail. The question this
 * floor answers is "can the row be written", and what goes into the row is
 * {@link ProofThatTheRunHappened#linkAsItGoesIn}. Comparing the typed text
 * instead would have missed the one gap this floor was written for: a member who
 * types a space and proves his run with a photograph is accepted, and a space is
 * not something that column will hold.
 *
 * <p><b>The two disagree by a 500.</b> A link the code lets through and the table
 * refuses does not reach the member as "that is not a web address"; it reaches
 * him as a server fault, after he has finished filling the form in.
 */
class LinkShapeMatchesTheSchemaTest extends DatabaseTest {

	/** So that the link is the only thing in the report that can be refused. */
	private static Report reportedWith(String link) {
		return new Report(link, true, "trcao sam sa Markom");
	}

	/** What the schema itself says a link looks like, in its own words. */
	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and con.conname = 'result_submission_link_shape'")
				.query(String.class).single();
	}

	/** Whether PostgreSQL, applying its own rule, would hold this value. */
	private boolean theSchemaTakes(String stored) {
		String rule = whatTheSchemaSays();
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		/* Every mention of the column and not the first: the rule names it twice, once
		   for the empty string it allows and once for the pattern, and each mention has
		   to be given the same value.

		   Counted on the COLUMN NAME and not on the question marks left behind, because
		   the pattern itself contains one - `https?` - and counting those asked for three
		   parameters where the statement has two. */
		int mentions = condition.split("link", -1).length - 1;
		var query = db.sql("select " + condition.replace("link", "?::text"));

		for (int mention = 0; mention < mentions; mention++) {
			query = query.param(mention + 1, stored);
		}

		return Boolean.TRUE.equals(query.query(Boolean.class).single());
	}

	@Test
	void theSchemaStillHasARuleAboutTheShapeAtAll() {
		assertThat(whatTheSchemaSays())
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("link")
				.startsWith("CHECK");
	}

	/**
	 * Every report the code lets through can be written down.
	 *
	 * <p>The blanks belong in this list and are the reason it exists: a run proved
	 * by a photograph leaves the field empty, the column is {@code not null}, and
	 * what gets written is whatever {@code linkAsItGoesIn} says.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "   ", "https://runtrace.net/rezultat/1", "http://runtrace.net",
			"https://a.rs/?x=1&y=2", "https://runtrace.net/trka?id=2#vreme", "  https://a.rs/b  "})
	void whatTheCodeLetsThroughTheSchemaTakes(String typed) {
		assertThat(ProofThatTheRunHappened.decide(reportedWith(typed)))
				.as("this case is meant to be one the code lets through, and it is not")
				.isEqualTo(Outcome.GOOD);

		assertThat(theSchemaTakes(ProofThatTheRunHappened.linkAsItGoesIn(reportedWith(typed))))
				.as("the code lets '%s' through and the table will not hold what it stores,"
						+ " which reaches the member as a server fault", typed)
				.isTrue();
	}

	/**
	 * And every link the code calls not an address, the table refuses too.
	 *
	 * <p>The other direction matters less loudly and still matters: a shape the
	 * table would hold and the code turns away is a member told his address is
	 * wrong when it is not.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"runtrace.net/rezultat/1", "ftp://runtrace.net", "https://",
			"https://runtrace.net/ rezultat", "pogledaj kod mene", "https://a.rs/b\tc"})
	void whatTheCodeCallsNotAnAddressTheSchemaRefuses(String typed) {
		assertThat(ProofThatTheRunHappened.decide(reportedWith(typed)))
				.as("this case is meant to be one the code refuses, and it is not")
				.isEqualTo(Outcome.A_LINK_THAT_IS_NOT_A_LINK);

		assertThat(theSchemaTakes(typed))
				.as("the table would hold '%s', which the code calls not an address", typed)
				.isFalse();
	}
}

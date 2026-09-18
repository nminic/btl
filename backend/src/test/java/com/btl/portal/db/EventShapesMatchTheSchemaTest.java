package com.btl.portal.db;

import com.btl.portal.domain.event.WhatAnEventCarries;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT THE CODE LETS THROUGH IS WHAT {@code btl_event} WILL HOLD, and PostgreSQL is the
 * one asked.
 *
 * <p>{@link WhatAnEventCarries} carries two things written by hand - the kinds an event
 * may be and the shape of a link - and each of them is also written in V7, as
 * {@code btl_event_kind_known} and {@code btl_event_link_shape}. Comparing one written
 * text against another would be reading rather than measuring: two patterns can be spelt
 * differently and mean the same thing, and these two ARE spelt differently, since the
 * schema says {@code [^[:space:]]} where Java says {@code \S}. So the constraint's own
 * expression comes out of the catalogue and PostgreSQL judges each value, which is the
 * shape {@code PaymentStatesMatchTheSchemaTest} and {@code LinkShapeMatchesTheSchemaTest}
 * use in this same package.
 *
 * <p><b>The two disagree by a 500.</b> A value the code lets through and the table
 * refuses does not reach an administrator as "that is not a kind of event"; it reaches
 * him as a server fault, after he has filled the form in. The other direction is quieter
 * and worse: a kind the schema allows and {@code EventWriteApi} does not know is one the
 * calendar can hold and nobody can enter.
 */
class EventShapesMatchTheSchemaTest extends DatabaseTest {

	/** Every literal in a rule, which is what an enumerated rule is made of. */
	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	/** What the schema itself says, in its own words. */
	private String whatTheSchemaSays(String constraint) {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = ?")
				.param(constraint).query(String.class).single();
	}

	/**
	 * Whether PostgreSQL, applying its own rule, would hold this value in that column.
	 *
	 * <p><b>Every mention of the column and not the first.</b> {@code btl_event_link_shape}
	 * names {@code link} twice, once for the empty string it allows and once for the
	 * pattern, and each mention has to be given the same value; asked with one parameter
	 * it fails as a bad statement rather than as a disagreement, which is how this case
	 * first came back with nine errors and nothing measured.
	 *
	 * <p>Counted on the COLUMN NAME and not on the question marks left behind, which is
	 * the trap {@code LinkShapeMatchesTheSchemaTest} names: the pattern itself contains a
	 * question mark, in {@code https?}, so counting those asks for three parameters where
	 * the statement has two.
	 */
	private boolean theSchemaTakes(String constraint, String column, String value) {
		String rule = whatTheSchemaSays(constraint);
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		int mentions = condition.split(column, -1).length - 1;
		var query = db.sql("select " + condition.replace(column, "?::text"));

		for (int mention = 0; mention < mentions; mention++) {
			query = query.param(mention + 1, value);
		}

		return Boolean.TRUE.equals(query.query(Boolean.class).single());
	}

	@Test
	void theSchemaStillHasARuleAboutTheKindAtAll() {
		assertThat(whatTheSchemaSays("btl_event_kind_known"))
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("kind")
				.startsWith("CHECK");
	}

	/** Every kind the code names is one the table would hold. */
	@Test
	void whatTheCodeKnowsTheSchemaTakes() {
		for (String kind : WhatAnEventCarries.KINDS) {
			assertThat(theSchemaTakes("btl_event_kind_known", "kind", kind))
					.as("the code knows the kind '%s' and the table refuses it", kind)
					.isTrue();
		}
	}

	/**
	 * And nothing else is, which is the direction a hand written list gets wrong.
	 *
	 * <p>The kinds are not typed out here a second time; they are read off the rule
	 * PostgreSQL hands back. A fourth kind added to the schema tomorrow arrives in this
	 * set on its own and fails this the same day, instead of being a row the calendar can
	 * hold and no form can produce.
	 */
	@Test
	void andWhatTheSchemaTakesTheCodeKnows() {
		Matcher found = SPELLED_OUT.matcher(whatTheSchemaSays("btl_event_kind_known"));
		Set<String> saidInTheRule = found.results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(saidInTheRule)
				.as("the rule names no kinds at all, so this is comparing an empty set")
				.isNotEmpty();
		assertThat(saidInTheRule)
				.as("the schema and WhatAnEventCarries.KINDS no longer say the same thing")
				.isEqualTo(WhatAnEventCarries.KINDS);
	}

	/**
	 * And the rule is a rule: something outside it is refused.
	 *
	 * <p>Without this the two cases above would both pass against a constraint that takes
	 * anything at all, and a floor that accepts everything holds nothing up.
	 */
	@Test
	void aKindNobodyNamedIsRefused() {
		assertThat(theSchemaTakes("btl_event_kind_known", "kind", "marathon"))
				.as("the table would hold a kind nothing in the portal can produce")
				.isFalse();
	}

	@Test
	void theSchemaStillHasARuleAboutTheLinkAtAll() {
		assertThat(whatTheSchemaSays("btl_event_link_shape"))
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("link")
				.startsWith("CHECK");
	}

	/**
	 * EVERY LINK THE CODE ACCEPTS IS ONE THE TABLE WOULD HOLD, and every one it refuses
	 * the table would refuse too.
	 *
	 * <p>Both directions in one case and over one list, because the answer being compared
	 * is a boolean: what matters is that the two agree, and a value they disagree on fails
	 * whichever way round it is. The empty string is first because it is the one value
	 * that is neither a link nor a fault - V7 makes both {@code description} and
	 * {@code link} NOT NULL and lets them be empty, since neither is asked for.
	 */
	@ParameterizedTest
	@ValueSource(strings = {
			"",
			"https://btl.rs/trka",
			"http://btl.rs/trka",
			/* A space is the one the schema spells as [^[:space:]] and Java as \\S, which
			   is the disagreement this whole file exists to catch. */
			"https://btl.rs/a trka",
			"https://btl.rs/trka\ttab",
			/* And the shapes that are not a web address at all. */
			"btl.rs/trka",
			"ftp://btl.rs/trka",
			"javascript:alert(1)",
			"https://",
	})
	void whatTheCodeSaysAboutALinkTheSchemaSaysToo(String link) {
		assertThat(WhatAnEventCarries.linkIsShaped(link))
				.as("the code and btl_event_link_shape disagree about '%s', so an administrator"
						+ " meets it as a 500 rather than as a sentence about his form", link)
				.isEqualTo(theSchemaTakes("btl_event_link_shape", "link", link));
	}
}

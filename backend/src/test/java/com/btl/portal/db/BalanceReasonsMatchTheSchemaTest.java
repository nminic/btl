package com.btl.portal.db;

import com.btl.portal.domain.balance.BookLine.Reason;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE REASONS {@link Reason} KNOWS ARE THE REASONS {@code balance_entry_reason_known} HOLDS, both ways.
 *
 * <p>The shape is {@link PaymentStatesMatchTheSchemaTest}'s: the words are read off the rule PostgreSQL
 * hands back, never typed out a second time here. A reason added to the schema without a constant
 * fails, because reading such a line would throw on the first member whose book holds one; and a
 * constant the schema refuses fails, because a line written with it would be refused.
 */
class BalanceReasonsMatchTheSchemaTest extends DatabaseTest {

	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = 'balance_entry_reason_known'")
				.query(String.class).single();
	}

	@Test
	void theReasonsTheCodeKnowsAreTheReasonsTheSchemaHolds() {
		Set<String> saidInTheRule = SPELLED_OUT.matcher(whatTheSchemaSays()).results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(saidInTheRule).as("the rule names no reasons, so this compares an empty set").isNotEmpty();
		assertThat(saidInTheRule)
				.as("the schema and BookLine.Reason no longer say the same thing")
				.isEqualTo(Arrays.stream(Reason.values()).map(Reason::word).collect(Collectors.toSet()));
	}
}

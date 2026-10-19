package com.btl.portal.db;

import com.btl.portal.domain.membership.Basis;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE BASES {@link Basis} KNOWS ARE THE BASES THE SCHEMA HOLDS, in every rule that names them, both
 * ways.
 *
 * <p>Three rules hold the same three words: {@code membership_basis_known} on the season's row (V22,
 * widened by V38), and the two V63 puts on the trail of a change. A basis added to one of them and not
 * to {@link Basis} would be a season a member is told nothing about in words; a word {@link Basis}
 * knows and a rule refuses would be a message about a basis no row can hold. The words are read off
 * each rule as PostgreSQL hands it back, the shape of {@link PaymentStatesMatchTheSchemaTest}.
 */
class MembershipBasisMatchesTheSchemaTest extends DatabaseTest {

	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	private String whatTheRuleSays(String constraint) {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = ?")
				.param(constraint).query(String.class).single();
	}

	@ParameterizedTest
	@ValueSource(strings = { "membership_basis_known", "membership_change_basis_before_known",
			"membership_change_basis_after_known" })
	void theBasesTheCodeKnowsAreTheBasesTheRuleHolds(String constraint) {
		Set<String> saidInTheRule = SPELLED_OUT.matcher(whatTheRuleSays(constraint)).results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(saidInTheRule).as("%s names no bases, so this compares an empty set", constraint)
				.isNotEmpty();
		assertThat(saidInTheRule)
				.as("%s and Basis no longer say the same thing", constraint)
				.isEqualTo(Arrays.stream(Basis.values()).map(Basis::word).collect(Collectors.toSet()));
	}
}

package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE WAYS {@link AwardingDucats.Brought} KNOWS A RESULT COMES IN ARE THE WAYS THE SCHEMA HOLDS, both ways.
 *
 * <p>{@code result_brought_by_known} (V97) names two words and {@link AwardingDucats.Brought} reads them back
 * into the opening of the message about a ducat. A word added to the rule and not to the enum would be a
 * result whose ducat the message cannot open; a word the enum knows and the rule refuses would be an approval
 * that fails at its insert. The words are read off the rule as PostgreSQL hands it back, the shape of
 * {@code MembershipBasisMatchesTheSchemaTest}.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class BroughtMatchesTheSchemaTest {

	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	@Autowired
	private JdbcClient db;

	@Test
	void theWaysTheCodeKnowsAreTheWaysTheRuleHolds() {
		String rule = db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = 'result_brought_by_known'")
				.query(String.class).single();
		Set<String> saidInTheRule = SPELLED_OUT.matcher(rule).results().map(one -> one.group(1))
				.collect(Collectors.toSet());

		assertThat(saidInTheRule).as("the rule names no ways, so this compares an empty set").isNotEmpty();
		assertThat(saidInTheRule).isEqualTo(Arrays.stream(AwardingDucats.Brought.values())
				.map(AwardingDucats.Brought::word).collect(Collectors.toSet()));
	}

	@Test
	void aWordTheEnumDoesNotKnowIsRefusedAndNotReadAsEitherWay() {
		for (AwardingDucats.Brought one : AwardingDucats.Brought.values()) {
			assertThat(AwardingDucats.Brought.named(one.word())).isSameAs(one);
		}

		assertThatThrownBy(() -> AwardingDucats.Brought.named("import"))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("import");
	}
}

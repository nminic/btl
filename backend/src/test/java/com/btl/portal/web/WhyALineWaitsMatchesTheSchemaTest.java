package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE WORDS FOR WHY A STATEMENT'S PAYMENT WAITS, IN THEIR TWO HOMES: {@link WhyALineWaits} and V74's
 * {@code bank_statement_line_waits_for_a_known_reason}. The shape {@code PaymentMethodsMatchTheSchemaTest}
 * has for the methods of a payment, and in both directions: the rule is read out of the catalogue, and
 * the class's words are read off the class itself, so neither side is a list written here.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class WhyALineWaitsMatchesTheSchemaTest {

	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	@Autowired
	JdbcClient db;

	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and con.conname = 'bank_statement_line_waits_for_a_known_reason'")
				.query(String.class).single();
	}

	/** Every word the class declares, read off the class. */
	private static Set<String> whatTheCodeSays() {
		return Arrays.stream(WhyALineWaits.class.getDeclaredFields())
				.filter(field -> Modifier.isStatic(field.getModifiers()) && field.getType() == String.class)
				.map(WhyALineWaitsMatchesTheSchemaTest::valueOf)
				.collect(Collectors.toSet());
	}

	private static String valueOf(Field field) {
		try {
			field.setAccessible(true);

			return (String) field.get(null);
		}
		catch (IllegalAccessException unreadable) {
			throw new AssertionError(unreadable);
		}
	}

	@Test
	void theSchemaAndTheClassNameTheSameReasons() {
		Set<String> inTheRule = SPELLED_OUT.matcher(whatTheSchemaSays()).results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(whatTheCodeSays()).as("the class names no reason, so this compares nothing").hasSize(6);
		assertThat(inTheRule).isEqualTo(whatTheCodeSays());
	}

	/** And the rule is a rule: a word it does not hold is refused. */
	@Test
	void aReasonNobodyNamedIsRefused() {
		String rule = whatTheSchemaSays();
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		assertThat(db.sql("select " + condition.replace("waits_because", "?::text"))
				.param(1, "alreadyRecorded").query(Boolean.class).single()).isFalse();
		assertThat(db.sql("select " + condition.replace("waits_because", "?::text"))
				.param(1, WhyALineWaits.NOT_BOOKED).query(Boolean.class).single()).isTrue();
	}
}

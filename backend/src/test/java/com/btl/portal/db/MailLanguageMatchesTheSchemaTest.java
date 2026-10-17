package com.btl.portal.db;

import com.btl.portal.domain.mail.MailLanguage;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE LANGUAGES THE COLUMN TAKES ARE THE LANGUAGES THE PORTAL WRITES IN, IN BOTH DIRECTIONS.
 *
 * <p>{@code account_mail_language_known} (V59) and {@link MailLanguage} are two homes of one fact.
 * Apart, they fail in two ways: a language the enum knows and the column refuses is a member who
 * cannot choose it and a 500 where he tried, and a value the column takes and the enum does not know
 * is a row every letter to him throws on ({@link MailLanguage#ofTheColumn}). So both are asked, the
 * shape {@link CurrencyMatchesTheSchemaTest} gives the money: the column is asked whether it takes
 * every language of the enum, and the rule's own text is asked which values it names.
 */
class MailLanguageMatchesTheSchemaTest extends DatabaseTest {

	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = 'account_mail_language_known'")
				.query(String.class).single();
	}

	@Test
	void everyLanguageThePortalWritesInIsOneTheColumnTakes() {
		for (MailLanguage language : MailLanguage.values()) {
			db.sql("insert into account (first_name, last_name, email, role_id, mail_language)"
							+ " values ('Probni', 'Probic', ?, (select id from role where code = 'competitor'), ?)")
					.params(language.code() + "@primer.rs", language.code())
					.update();

			assertThat(db.sql("select mail_language from account where email = ?")
					.param(language.code() + "@primer.rs").query(String.class).single())
					.as("the column did not keep the language %s as it was written", language)
					.isEqualTo(language.code());
		}
	}

	@Test
	void andEveryValueTheColumnTakesIsALanguageThePortalWritesIn() {
		Set<String> saidInTheRule = SPELLED_OUT.matcher(whatTheSchemaSays()).results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(saidInTheRule)
				.as("account_mail_language_known names no language at all, so this compares nothing")
				.isNotEmpty();
		assertThat(saidInTheRule)
				.as("the column takes a language the portal does not write in, or refuses one it does")
				.isEqualTo(Arrays.stream(MailLanguage.values()).map(MailLanguage::code)
						.collect(Collectors.toSet()));
	}
}

package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V72 OVER ACCOUNTS AS A DATABASE ALREADY HOLDS THEM: the unconfirmed ones, and only those, come out
 * kept seven days from the moment it ran.
 *
 * <p>Seven days from the deployment for the accounts already standing, which is derived and not the
 * owner's words (PDL, IZVEDENO 24.10.2026). And the moment an account was written stays empty for
 * them, because nobody recorded it. The shape is
 * {@code MailLanguageCarriedOverTest}'s: the column the migration adds is taken away, accounts are
 * written the way the database holds them, and THE FILE ITSELF is run over them
 * ({@link DatabaseTest#migrationSql}), inside the case's transaction.
 */
class UnconfirmedAccountsCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	@BeforeEach
	void accountsWrittenBeforeV72() {
		jdbc.execute("alter table account drop column kept_unconfirmed_until cascade");
		jdbc.execute("alter table account drop column created_at cascade");

		for (String[] one : new String[][] {{"nepotvrdjen@primer.rs", null}, {"potvrdjen@primer.rs", "now()"},
				{"pozvan@primer.rs", null}}) {

			db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at)"
							+ " values ('Probni', 'Probic', ?, (select id from role where code = 'competitor'), "
							+ (one[1] == null ? "null" : one[1]) + ")")
					.param(one[0]).update();
		}
	}

	@Test
	void theUnconfirmedAndOnlyTheyAreKeptSevenDaysFromTheMomentItRan() {
		assertThat(db.sql("select count(*) from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = 'account'"
						+ " and column_name = 'kept_unconfirmed_until'")
				.query(Long.class).single())
				.as("the column is already standing before the migration runs")
				.isZero();

		jdbc.execute(migrationSql("72"));

		assertThat(db.sql("select email || ' ' || coalesce(extract(epoch from"
						+ " (kept_unconfirmed_until - now()))::bigint::text, 'not kept')"
						+ " from account where email like '%@primer.rs' order by email")
				.query(String.class).list())
				.containsExactly("nepotvrdjen@primer.rs 604800", "potvrdjen@primer.rs not kept",
						"pozvan@primer.rs 604800");

		assertThat(db.sql("select count(*) from account where email like '%@primer.rs' and created_at is not null")
				.query(Long.class).single())
				.as("an account that stood before V72 was given a moment of writing nobody recorded")
				.isZero();

		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', 'posle@primer.rs', (select id from role where code = 'competitor'))")
				.update();

		assertThat(db.sql("select created_at = now() from account where email = 'posle@primer.rs'")
				.query(Boolean.class).single())
				.as("an account written after V72 does not carry the moment it was written")
				.isTrue();
	}
}

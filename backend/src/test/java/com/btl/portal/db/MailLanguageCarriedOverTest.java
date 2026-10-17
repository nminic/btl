package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V59 DOES TO THE ACCOUNTS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> Every test starts from an empty database and writes its own accounts
 * after V59, so a column added NOT NULL with a check is measured over rows that already know it. A
 * database that holds accounts written before it - QA does, and production will - is the one place
 * a column that cannot be filled, or a check its own default breaks, would stop Flyway and the
 * portal with it (CLAUDE.md, odeljak 11).
 *
 * <p><b>How the two halves are made, and it is {@link MembershipCarriedOverTest}'s shape:</b> the
 * column V59 adds is dropped as a fixture, with {@code cascade} so that PostgreSQL and not a list
 * here takes its check with it; accounts are written the way a database already holds them, one of
 * each role and one that names a member; and then THE MIGRATION ITSELF is executed
 * ({@link DatabaseTest#migrationSql}). All inside the test's transaction, and rolled back.
 *
 * <p><b>That the rows come through at all is the proof the undoing was whole</b>: a check that
 * survived the drop would refuse the {@code alter table} below, and the migration would fail here
 * rather than pass quietly.
 */
class MailLanguageCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	@BeforeEach
	void accountsWrittenBeforeV59() {
		jdbc.execute("alter table account drop column mail_language cascade");

		for (String[] one : new String[][] {{"clan@primer.rs", "competitor"},
				{"moderator@primer.rs", "moderator"}, {"admin@primer.rs", "superadmin"}}) {

			db.sql("insert into account (first_name, last_name, email, role_id)"
							+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
					.params(one[0], one[1]).update();
		}
	}

	@Test
	void everyAccountStandingWhenItRunsIsGivenSerbian() {
		assertThat(db.sql("select count(*) from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = 'account'"
						+ " and column_name = 'mail_language'")
				.query(Long.class).single())
				.as("the column is already standing before the migration runs, so what comes out of"
						+ " it below need not have been written by the migration at all")
				.isZero();

		jdbc.execute(migrationSql("59"));

		assertThat(db.sql("select email || ' ' || mail_language from account order by email")
				.query(String.class).list())
				.as("an account that stood before V59 did not come out of it Serbian, which is what"
						+ " the owner's decision says an account nobody chose for is")
				.containsExactly("admin@primer.rs sr", "clan@primer.rs sr", "moderator@primer.rs sr");
	}
}

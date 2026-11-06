package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V87 DOES TO THE LINKS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V87 adds a trigger on UPDATE to {@code password_reset_token}, and the
 * production table already holds links. A migration that judged them would stop the deployment on
 * the first link that breaks the rule, so the rule has to hold from the next update on and say
 * nothing about rows nobody touches. Every other test starts from an empty table, where a trigger
 * that also swept the old rows would be indistinguishable from one that does not.
 *
 * <p><b>How.</b> The trigger and its function are taken away, three links are written the way a
 * database in use holds them (one spent twice, one given a year, one honest), and THE MIGRATION
 * ITSELF is executed: the file Flyway applied ({@link DatabaseTest#migrationSql}), inside the
 * test's transaction, as {@link MembershipCarriedOverTest} does. The rows are then read back
 * unchanged, and the offenders are refused from the next update on.
 */
class AResetLinkIsSpentOnceCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private long spent;

	private long lengthened;

	private long honest;

	private long link(long account, String digestLetter, String columns, String values) {
		return db.sql("insert into password_reset_token (account_id, token_hash" + columns + ")"
						+ " values (?, ?" + values + ") returning id")
				.params(account, digestLetter.repeat(64)).query(Long.class).single();
	}

	@BeforeEach
	void whatThePortalHeldBeforeV87() {
		jdbc.execute("drop trigger password_reset_token_is_spent_once_and_never_lengthened"
				+ " on password_reset_token");
		jdbc.execute("drop function a_reset_link_is_spent_once_and_never_lengthened()");

		long account = db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', 'prenos-linka@primer.rs',"
						+ " (select id from role where code = 'competitor')) returning id")
				.query(Long.class).single();

		spent = link(account, "a", ", used_at", ", now()");
		lengthened = link(account, "b", ", expires_at", ", now() + interval '365 days'");
		honest = link(account, "c", "", "");

		/* The rows break the rule the way a table that never had it can: spent and then spent again,
		   and given a year after it was written. Written here, with the trigger gone, so the test
		   states them and does not hope the fixture produced them. */
		jdbc.update("update password_reset_token set used_at = now() + interval '1 second'"
				+ " where id = ?", spent);
	}

	private List<Map<String, Object>> theLinks() {
		return jdbc.queryForList("select id, used_at, expires_at from password_reset_token"
				+ " order by id");
	}

	/**
	 * THE MIGRATION RUNS OVER LINKS THAT BREAK ITS RULE AND LEAVES EVERY ONE OF THEM AS IT WAS.
	 *
	 * <p>The read before and the read after are compared whole, so a migration that repaired, spent
	 * or deleted an offender to make its trigger agreeable would differ here.
	 */
	@Test
	void theMigrationDoesNotJudgeTheLinksAlreadyStanding() {
		List<Map<String, Object>> before = theLinks();

		assertThat(before).as("the fixture wrote no links").hasSize(3);

		jdbc.execute(migrationSql("87"));

		assertThat(theLinks()).isEqualTo(before);
	}

	/** And from then on the offenders are held to it, which is what the file is for. */
	@Test
	void fromTheNextUpdateOnTheOffendersAreHeldToTheRule() {
		jdbc.execute(migrationSql("87"));

		assertThatThrownBy(() -> jdbc.update("update password_reset_token set used_at = now()"
				+ " where id = ?", spent))
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("was spent");
	}

	@Test
	void aLinkGivenAYearBeforeTheMigrationCannotBeGivenAnother() {
		jdbc.execute(migrationSql("87"));

		assertThatThrownBy(() -> jdbc.update("update password_reset_token"
				+ " set expires_at = expires_at + interval '1 day' where id = ?", lengthened))
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("more time");
	}

	@Test
	void anHonestLinkIsStillSpentByTheOneStatementTheServiceWrites() {
		jdbc.execute(migrationSql("87"));

		assertThat(jdbc.update("update password_reset_token set used_at = now()"
				+ " where id = ? and used_at is null", honest)).isEqualTo(1);
	}
}

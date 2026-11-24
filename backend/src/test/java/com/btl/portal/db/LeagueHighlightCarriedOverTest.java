package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V109 DOES TO THE LEAGUES THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V109 adds a NOT NULL column to {@code league}, which both real databases hold rows
 * in. Every other test starts from an empty database, so a rule the rows already standing break is invisible to
 * all of them (CLAUDE.md, section 11).
 *
 * <p><b>What the migration is meant to do with such a row:</b> give it false and nothing else. No league
 * highlighted its events before the box existed (owner, PDL 24.11.2026: „nova kolona na ligi, podrazumevano
 * isključena"), so every league standing comes out of it not highlighting, with its other columns as they were,
 * and the rule holds on those same rows afterwards.
 *
 * <p><b>How the fixture is made</b>, the shape of {@link LeagueMarkCarriedOverTest}: what V109 adds is undone with
 * one statement ({@code drop column ... cascade} takes its not-null rule with it), the rows are written as a
 * database holds them before V109, and the migration is executed from the file Flyway resolved
 * ({@link DatabaseTest#migrationSql}), inside the test's transaction, which is rolled back.
 */
class LeagueHighlightCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/** A league as a database holds it before V109. */
	private void league(String slug, int season, String rules) {
		db.sql("insert into league (slug, name, season, rules, prizes) values (?, ?, ?, ?, '')")
				.params(slug, "Stara liga " + slug, season, rules).update();
	}

	private void beforeV109() {
		jdbc.execute("alter table league drop column highlights_events cascade");
		league("stara-2027", 2027, "Pravila koja vec stoje.");
		league("stara-2028", 2028, "");
	}

	/** Every league of the fixture as {@code slug | season | rules | highlights}, in the order of the addresses. */
	private List<String> theRows() {
		return db.sql("select slug || ' | ' || season || ' | ' || rules || ' | ' || highlights_events from league"
						+ " where slug like 'stara-%' order by slug")
				.query(String.class).list();
	}

	/**
	 * THE LEAGUES GO THROUGH WITH FALSE, AND AFTERWARDS ONE OF THEM IS TICKED AND NONE MAY BE EMPTIED.
	 *
	 * <p>Read by behaviour and not out of the catalogue: after the migration a league that stood before it takes
	 * the tick, the other keeps false, and the rule refuses a league that says neither. That the fixture really took
	 * V109 away is {@link #beforeV109ThereIsNoBoxToTick}.
	 */
	@Test
	void theLeaguesAlreadyThereDoNotHighlightAndOneTickedAfterwardsDoes() {
		beforeV109();

		jdbc.execute(migrationSql("109"));

		assertThat(theRows()).as("V109 touched a league that stood before it, or gave the box another default")
				.containsExactly("stara-2027 | 2027 | Pravila koja vec stoje. | false",
						"stara-2028 | 2028 |  | false");

		db.sql("update league set highlights_events = true where slug = 'stara-2028'").update();

		assertThat(theRows()).as("a league that stood before V109 could not be ticked")
				.containsExactly("stara-2027 | 2027 | Pravila koja vec stoje. | false",
						"stara-2028 | 2028 |  | true");
		/* LAST, because the refusal ends the transaction the case is in. */
		assertThatThrownBy(() -> db.sql("update league set highlights_events = null where slug = 'stara-2027'")
						.update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("highlights_events");
	}

	/**
	 * THE FIXTURE REALLY TAKES V109 AWAY: the column is not there to write. Without this the case above could pass
	 * on a fixture that left it in place, with whatever it held.
	 */
	@Test
	void beforeV109ThereIsNoBoxToTick() {
		beforeV109();

		assertThatThrownBy(() -> db.sql("update league set highlights_events = false").update())
				.hasMessageContaining("highlights_events");
	}
}

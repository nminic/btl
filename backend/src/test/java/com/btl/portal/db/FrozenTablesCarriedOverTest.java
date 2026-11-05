package com.btl.portal.db;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V84 OVER ROWS THAT ALREADY STAND: it refuses them by name instead of failing on a column.
 *
 * <p>V84 adds NOT NULL columns without a default to V17's three tables, which no row can survive, and
 * it can do that only because nothing has ever written those tables (the first season freezes on
 * 1.1.2028). The block at its top says so out loud. Every other case starts from a database these
 * migrations built empty, so only this one meets a row V84 did not see written (btl CLAUDE.md, „11.
 * Ogranicenje koje ne prezivljava ZATECENE podatke"): the migration is run again here, through
 * {@link DatabaseTest#migrationSql}, over a row put into the frozen standings first.
 */
class FrozenTablesCarriedOverTest extends DatabaseTest {

	@Test
	void aFrozenRowThatAlreadyStandsStopsTheMigrationByName() {
		db.sql("insert into season_team (season, position, team_id, name, points, members, races, kilometers, ascent,"
				+ " descent, seconds) values (2027, 1, null, 'Zatecen tim', 10, 1, 1, 10, 0, 0, 3000)").update();

		assertThatThrownBy(() -> db.sql(migrationSql("84")).update())
				.rootCause().hasMessageContaining("V84 found rows in the frozen tables of V17");
	}

	@Test
	void andWithNoneItGoesOnPastTheBlock() {
		/* The next statement is the first `alter table`, and over a schema that already has its columns it
		   is that statement that refuses: the block let an empty database through. */
		assertThatThrownBy(() -> db.sql(migrationSql("84")).update())
				.rootCause().hasMessageContaining("column \"kilometers\" of relation \"season_competitor\" already exists");
	}
}

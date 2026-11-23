package com.btl.portal.db;

import com.btl.portal.TheEndOfTheTransaction;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V108 DOES TO THE LEAGUES THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V108 adds a column and a foreign key to {@code league}, which both real
 * databases hold rows in. Every other test starts from an empty database, so a rule the rows already
 * standing break is invisible to all of them (CLAUDE.md, section 11).
 *
 * <p><b>What the migration is meant to do with such a row:</b> nothing. No league has a mark before the
 * column exists, so every league comes out of it NULL, which the key accepts whatever else the row holds,
 * and that every one of them passes untouched IS the measurement. The second half is that the rule V108
 * teaches V54's trigger works on those same rows afterwards: a mark set on a league that stood before the
 * migration, and then replaced, takes the replaced picture's row away.
 *
 * <p><b>How the fixture is made</b>, the shape of {@link ViberCommunityCarriedOverTest}: what V108 adds is
 * undone with one statement ({@code drop column ... cascade} takes its key, its index and its trigger, which
 * listens to the column, with it; the two functions V108 replaces are replaced again by the file itself),
 * the rows are written as a database holds them before V108, and the migration is executed from the file
 * Flyway resolved ({@link DatabaseTest#migrationSql}), inside the test's transaction, which is rolled back.
 */
class LeagueMarkCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/** A league as a database holds it before V108. */
	private void league(String slug, int season, String rules) {
		db.sql("insert into league (slug, name, season, rules, prizes) values (?, ?, ?, ?, '')")
				.params(slug, "Stara liga " + slug, season, rules).update();
	}

	private void beforeV108() {
		jdbc.execute("alter table league drop column logo_id cascade");
		league("stara-2027", 2027, "Pravila koja vec stoje.");
		league("stara-2028", 2028, "");
	}

	/** Every league of the fixture as {@code slug | season | mark}, in the order of the addresses. */
	private List<String> theRows() {
		return db.sql("select slug || ' | ' || season || ' | ' || coalesce(logo_id::text, '-') from league"
						+ " where slug like 'stara-%' order by slug")
				.query(String.class).list();
	}

	private long aPhoto(String twice) {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/png', 4096, ?, 0.5, 0.5, 1) returning id")
				.param(twice.repeat(32)).query(Long.class).single();
	}

	private boolean stands(long photo) {
		return db.sql("select exists (select 1 from photo where id = ?)").param(photo).query(Boolean.class).single();
	}

	/**
	 * THE LEAGUES GO THROUGH UNTOUCHED, AND AFTERWARDS ONE OF THEM TAKES A MARK AND LETS GO OF IT.
	 *
	 * <p>Read by behaviour and not out of the catalogue: after the migration a league that stood before it
	 * holds a picture, and when the picture is replaced the replaced one's row goes at the end of the
	 * transaction while the new one stays. That the fixture really took V108 away is
	 * {@link #beforeV108ThereIsNoMarkToWrite}.
	 */
	@Test
	void theLeaguesAlreadyThereHaveNoMarkAndOneTakenAfterwardsGoesWithItsLastHolder() {
		beforeV108();

		jdbc.execute(migrationSql("108"));

		assertThat(theRows()).as("V108 touched a league that stood before it, or gave the mark a default")
				.containsExactly("stara-2027 | 2027 | -", "stara-2028 | 2028 | -");

		long first = aPhoto("d1");
		long second = aPhoto("d2");

		db.sql("update league set logo_id = ? where slug = 'stara-2027'").param(first).update();
		db.sql("update league set logo_id = ? where slug = 'stara-2027'").param(second).update();
		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(first)).as("the replaced mark of a league that stood before V108 is still there").isFalse();
		assertThat(stands(second)).as("the mark that stands on the league was taken away").isTrue();
		assertThat(theRows()).containsExactly("stara-2027 | 2027 | " + second, "stara-2028 | 2028 | -");
	}

	/**
	 * THE FIXTURE REALLY TAKES V108 AWAY: the column is not there to write. Without this the case above could
	 * pass on a fixture that left it in place, with whatever it held.
	 */
	@Test
	void beforeV108ThereIsNoMarkToWrite() {
		beforeV108();

		assertThatThrownBy(() -> db.sql("update league set logo_id = null").update())
				.hasMessageContaining("logo_id");
	}
}

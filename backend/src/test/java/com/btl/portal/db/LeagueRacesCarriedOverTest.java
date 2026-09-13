package com.btl.portal.db;

import org.flywaydb.core.api.Location;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V20 DOES TO THE ROWS THAT ARE THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V20 carries every race of every event in a league
 * into {@code league_race} and then drops {@code league_event}. Every test starts
 * from an empty database, so by the time the suite can look, that table has been
 * dropped and never held a row: a correct carry and a missing one leave
 * {@code league_race} equally empty, and deleting the whole statement is green.
 * A migration whose only measurement is "the schema afterwards" is a migration
 * whose data half nobody has run.
 *
 * <p><b>How the two halves are made.</b> The table is put back as a fixture -
 * two columns and the two keys, which is all of it the migration names - filled
 * with the rows a league really holds, and then THE MIGRATION ITSELF is executed.
 * Not a copy of its statements: the file is the one Flyway resolved and applied,
 * found through Flyway's own configuration and the script name Flyway recorded,
 * so a migration edited or renamed is the one that runs here too. Everything
 * happens inside the test's transaction and is rolled back, the dropped table
 * with it.
 *
 * <p><b>And the decision the migration was written to record is measured from
 * both sides.</b> {@code league_event} carries no season, so a league of one year
 * may hold an event of another; {@code league_race} refuses that through its
 * composite keys. The decision is that such a row is neither skipped nor put
 * aside: the migration fails and the deployment stops. One case says the carry
 * writes what it should, the other says the row that cannot be written stops
 * everything rather than going quietly missing.
 */
class LeagueRacesCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	/**
	 * The SQL of one migration, asked of Flyway rather than written down here.
	 *
	 * <p>Flyway says where its migrations live and what the script of the version
	 * that was applied is called, so nothing here is a second copy of a setting: a
	 * file renamed, moved, or given a different location in the configuration is
	 * still the file this reads. Only the VERSION is named, and that is the fact the
	 * case is about.
	 */
	private String migration(String version) {
		MigrationInfo applied = Arrays.stream(flyway.info().applied())
				.filter(one -> one.getVersion() != null
						&& version.equals(one.getVersion().getVersion()))
				.findFirst()
				.orElseThrow(() -> new AssertionError("no migration " + version + " was applied"));

		String folder = Arrays.stream(flyway.getConfiguration().getLocations())
				.map(Location::getPath)
				.findFirst()
				.orElseThrow(() -> new AssertionError("Flyway is configured with no location"));

		try (InputStream sql = getClass().getClassLoader()
				.getResourceAsStream(folder + "/" + applied.getScript())) {
			assertThat(sql)
					.as("%s is not under %s, where Flyway says its migrations are",
							applied.getScript(), folder)
					.isNotNull();
			return new String(sql.readAllBytes(), StandardCharsets.UTF_8);
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	/**
	 * {@code league_event} as V14 left it, put back so the migration has something to
	 * carry. Two columns and the two keys: that is everything of it V20 names, and a
	 * fixture that got the shape wrong would fail the migration rather than let it
	 * pass quietly.
	 */
	private void theTableV20Drops() {
		jdbc.execute("create table league_event ("
				+ " league_id bigint not null,"
				+ " event_id bigint not null,"
				+ " constraint league_event_pk primary key (league_id, event_id),"
				+ " constraint league_event_league_fk foreign key (league_id)"
				+ "   references league (id) on delete cascade,"
				+ " constraint league_event_event_fk foreign key (event_id)"
				+ "   references btl_event (id) on delete cascade)");
	}

	private void league(String slug, int season) {
		db.sql("insert into league (slug, name, season, rules, prizes)"
						+ " values (?, ?, ?, '', '')")
				.params(slug, "Liga " + slug, season).update();
	}

	private void event(String slug, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description,"
						+ " link) values (?, ?, date '" + day + "', " + A_TOWN
						+ ", 'race', false, '', '')")
				.params(slug, "Dogadjaj " + slug).update();
	}

	private void race(String eventSlug, String name, String day) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values ((select id from btl_event where slug = ?),"
						+ " ?, false, date '" + day + "', 'length', 0, 10.00, 0, 0)")
				.params(eventSlug, name).update();
	}

	private void inTheLeague(String leagueSlug, String eventSlug) {
		db.sql("insert into league_event (league_id, event_id) values ("
						+ " (select id from league where slug = ?),"
						+ " (select id from btl_event where slug = ?))")
				.params(leagueSlug, eventSlug).update();
	}

	private List<String> countedBy(String leagueSlug) {
		return db.sql("select r.name from league_race lr"
						+ " join race r on r.id = lr.race_id"
						+ " join league l on l.id = lr.league_id"
						+ " where l.slug = ? order by r.name").param(leagueSlug)
				.query(String.class).list();
	}

	/**
	 * A DAY OF THREE RACES INSIDE A LEAGUE, ONE OF THEM ALREADY COUNTED, and a
	 * second league and a second day that are outside it.
	 *
	 * <p>The league that is not in {@code league_event} is what says the carry reads
	 * the old table rather than writing every league it finds; the event that is not
	 * in it says the same about days. And one of the three races is ALREADY in
	 * {@code league_race}, because the screen has been writing that table since V19:
	 * without it the clause that lets the carry meet a row it already agrees with
	 * would never be reached.
	 */
	@BeforeEach
	void aLeagueHoldingOneDayOfThree() {
		theTableV20Drops();

		league("prenos-2027", 2027);
		league("mimo-2027", 2027);

		event("dan-sa-tri-trke", "2027-04-04");
		event("dan-van-lige", "2027-05-05");

		race("dan-sa-tri-trke", "Prva deonica", "2027-04-04");
		race("dan-sa-tri-trke", "Druga deonica", "2027-04-05");
		race("dan-sa-tri-trke", "Treca deonica", "2027-04-06");
		race("dan-van-lige", "Trka van lige", "2027-05-05");

		inTheLeague("prenos-2027", "dan-sa-tri-trke");

		db.sql("insert into league_race (league_id, season, race_id) values ("
				+ " (select id from league where slug = 'prenos-2027'), 2027,"
				+ " (select id from race where name = 'Druga deonica'))").update();
	}

	/**
	 * THE MIGRATION CARRIES EVERY RACE OF EVERY EVENT THAT WAS IN A LEAGUE, and
	 * nothing else.
	 *
	 * <p>Choosing an event always meant "every race of that day" (V19), so the three
	 * races of the day come over together and the race of the day that was never in
	 * the league does not. The one that was already counted is counted once: the
	 * pair is the key and writing it twice is not a second fact.
	 *
	 * <p>And the league that held nothing still holds nothing, which is what says
	 * the carry reads {@code league_event} rather than writing whatever it can find.
	 */
	@Test
	void everyRaceOfEveryEventInALeagueIsCarriedOverExactlyOnce() {
		assertThat(countedBy("prenos-2027"))
				.as("the league counts nothing before the migration runs, so a carry meeting a"
						+ " row that is already exactly what it wants to write is not measured here")
				.isNotEmpty();

		jdbc.execute(migration("20"));

		assertThat(countedBy("prenos-2027"))
				.as("the league did not come out of the migration counting the three races of"
						+ " the day it held, and only those")
				.containsExactly("Druga deonica", "Prva deonica", "Treca deonica");

		assertThat(countedBy("mimo-2027"))
				.as("a league that was in no row of league_event came out counting something")
				.isEmpty();
	}

	/**
	 * AND EVERY CARRIED ROW CARRIES A SEASON THE COMPOSITE KEYS ADMIT.
	 *
	 * <p><b>It does not say whose season that is, and it cannot.</b> A row that gets
	 * through has satisfied both composite keys at once, so on it the league's season
	 * and the race's season are the same number by construction; writing `r.season`
	 * instead of `l.season` here leaves this case green, which was measured rather
	 * than assumed. The two are told apart only by the row that DOES NOT get through,
	 * and that is the case below, {@code aRaceOfAnotherYearStopsTheMigration}. The
	 * boundary is written here so that nobody loosens that one believing this one
	 * still holds the season.
	 */
	@Test
	void everyCarriedRowCarriesASeasonTheKeysAdmit() {
		jdbc.execute(migration("20"));

		assertThat(db.sql("select distinct lr.season from league_race lr"
						+ " join league l on l.id = lr.league_id where l.slug = 'prenos-2027'")
				.query(Integer.class).list())
				.as("the carried rows do not all carry the league's own season")
				.containsExactly(2027);
	}

	/** And the table it read is gone, which is the other half of the migration. */
	@Test
	void theOldTableIsGoneAfterwards() {
		jdbc.execute(migration("20"));

		assertThat(tablesInTheSchema())
				.as("the migration carried the rows over and left the table it read behind")
				.doesNotContain("league_event");
	}

	/**
	 * A RACE OF ANOTHER YEAR STOPS THE MIGRATION INSTEAD OF LEAVING THE LEAGUE
	 * QUIETLY SMALLER.
	 *
	 * <p>This is the decision V20 was written to record. {@code league_event} has no
	 * season in it at all - its only key is against {@code league (id)} - so a league
	 * of 2027 may hold a day of 2028 today, and {@code league_race} refuses exactly
	 * that through {@code league_race_race_fk}. The migration adds no filter, so the
	 * row reaches the key: Flyway runs a migration in one transaction, the insert
	 * rolls back, the drop never happens and the server does not start.
	 *
	 * <p>The alternative that this case exists to refuse is one word,
	 * {@code where r.season = l.season}, under which the league silently loses a day
	 * and the standings change with nothing anywhere saying why.
	 *
	 * <p><b>WHICH key refuses it is the claim, and it is read off the server's own
	 * error rather than off the exception's message.</b> Measured on 13.09.2026: the
	 * message of the translated exception carries the SQL that failed, and the SQL
	 * that failed here is the whole migration file - comments included - so
	 * "the message mentions {@code league_race_race_fk}" was satisfied by the
	 * migration's own prose. It passed a mutation writing {@code r.season} instead of
	 * {@code l.season}, which stops the migration on the OTHER key and means something
	 * different: the season on the row would then be the race's, and the league of
	 * 2027 would be the one refused rather than the race of 2028. The root cause is
	 * PostgreSQL's error and carries no SQL, so it names one key and only one.
	 */
	@Test
	void aRaceOfAnotherYearStopsTheMigration() {
		event("dan-druge-godine", "2028-08-08");
		race("dan-druge-godine", "Trka druge godine", "2028-08-08");
		inTheLeague("prenos-2027", "dan-druge-godine");

		assertThatThrownBy(() -> jdbc.execute(migration("20")))
				.as("a league of 2027 holding a day of 2028 was carried over quietly")
				.isInstanceOf(DataIntegrityViolationException.class)
				.rootCause()
				.as("the migration stopped on the key that refuses a race of the wrong year,"
						+ " which is the season written on the row being the league's own")
				.hasMessageContaining("league_race_race_fk")
				.hasMessageNotContaining("league_race_league_fk");
	}
}

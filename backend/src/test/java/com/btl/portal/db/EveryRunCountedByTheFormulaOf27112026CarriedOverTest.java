package com.btl.portal.db;

import com.btl.portal.web.V117__Every_run_is_counted_by_the_formula_of_27_11_2026;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.api.migration.Context;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.datasource.DataSourceUtils;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V117 RUN OVER A DATABASE THAT ALREADY HOLDS RUNS COUNTED BY THE FORMULA OF 26.11.2026: EVERY ONE OF THEM
 * IS COUNTED AGAIN BY THE FORMULA OF 27.11.2026 (V3c), AND NOTHING ELSE MOVES.
 *
 * <p>Owner, PDL P4, 27.11.2026, „Izabrana varijanta V3c”, chosen among the outcomes offered, and then
 * „Napisi i podigni”. Every case of this suite begins at an empty {@code result}, where V117 has nothing to
 * count, so the data half of it is measured only here, over rows written as production holds them: the
 * shape is {@code UnscoredKindCarriedOverTest}'s, with the migration run over the fixture inside the
 * case's own transaction. (It was V116's, one formula earlier; V116 is not run here, it stands as it ran.)
 *
 * <p><b>The points expected are written out, worked independently in Python</b> (the owner's reference
 * calculation, {@code dorada-formule-glatka2.py}, the same working as {@code BtlScoreCalculatorTest}), and
 * not asked of the calculator, so a migration that counted by any other formula fails here. Every row's
 * points in the fixture differ from what it is due, so a row the migration skipped fails too. The axes: a
 * free race, a race of a fixed length, TWO timed races (whose time is the limit of the race, PDL P4, and
 * which are counted by the formula of a race to a limit, so a migration that read the kind of no race
 * would count them as the others), a race before 2027, a race of a season that has frozen, and a run at an
 * unscored event, which keeps nought.
 */
class EveryRunCountedByTheFormulaOf27112026CarriedOverTest extends DatabaseTest {

	private static final String A_TOWN = "(select id from place where rank = 1)";

	@Autowired
	V117__Every_run_is_counted_by_the_formula_of_27_11_2026 migration;

	@Autowired
	DataSource dataSource;

	private void aMember() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id, city,"
				+ " country_id, first_season, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
				+ " father_name, address, shirt_size, health_statement_at) values ('000997', 'Stari', 'Trkac', 'M',"
				+ " date '1984-04-04', " + A_TOWN + ", null, null, 2027, '00112233445566f7', null, '', false,"
				+ " 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();
	}

	/** One event of its kind, one race of its kind, and one run at it with the points of the old formula. */
	private void aRun(String slug, String eventKind, String day, String raceKind, String raceKm, int limit,
			String km, int ascent, int descent, int seconds, String oldPoints) {
		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
				+ " values (?, 'Zatecena trka', date '" + day + "', " + A_TOWN + ", ?, false, '', '')")
				.params(slug, eventKind).update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
				+ " descent_m) select id, 'Zatecena trka', false, date, ?, ?, " + raceKm + ", 0, 0 from btl_event"
				+ " where slug = ?").params(raceKind, limit, slug).update();
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
				+ " seconds, points) select c.id, r.id, r.date, " + km + ", ?, ?, ?, " + oldPoints
				+ " from competitor c, race r join btl_event e on e.id = r.event_id"
				+ " where c.member_number = '000997' and e.slug = ?")
				.params(ascent, descent, seconds, slug).update();
	}

	private Map<String, BigDecimal> pointsBySlug() {
		Map<String, BigDecimal> points = new LinkedHashMap<>();
		db.sql("select e.slug, r.points from result r join race ra on ra.id = r.race_id"
				+ " join btl_event e on e.id = ra.event_id order by r.id")
				.query((row, one) -> points.put(row.getString(1), row.getBigDecimal(2))).list();
		return points;
	}

	private List<String> rowsOf(String query) {
		return db.sql(query).query(String.class).list();
	}

	private void runTheMigration() throws Exception {
		Connection connection = DataSourceUtils.getConnection(dataSource);
		migration.migrate(new Context() {
			@Override
			public Configuration getConfiguration() {
				return flyway.getConfiguration();
			}

			@Override
			public Connection getConnection() {
				return connection;
			}
		});
	}

	@Test
	void everyRunIsCountedAgainAndOnlyItsPointsMove() throws Exception {
		aMember();
		aRun("free", "race", "2027-05-02", "free", "0", 0, "21.1", 250, 250, 6300, "21.40");
		aRun("marathon", "race", "2027-06-06", "length", "42.195", 0, "42.195", 300, 280, 12600, "31.00");
		aRun("twenty-four-hours", "race", "2027-07-04", "time", "0", 86400, "60", 2000, 500, 86400, "0.20");
		aRun("twelve-hours", "race", "2027-07-18", "time", "0", 43200, "80", 1500, 1500, 43200, "14.26");
		aRun("before-2027", "race", "2019-04-14", "free", "0", 0, "10", 0, 0, 3000, "6.61");
		aRun("frozen-season", "race", "2027-04-12", "free", "0", 0, "10", 0, 0, 3000, "6.61");
		aRun("unscored", "unscored", "2027-08-01", "free", "0", 0, "10", 0, 0, 3000, "7.77");

		db.sql("insert into season_frozen (season, frozen_at) values (2027, timestamptz '2027-11-01 00:00:00+00')")
				.update();
		db.sql("insert into season_points_at_freeze (season, competitor_id, points)"
				+ " select 2027, id, 7.13 from competitor where member_number = '000997'").update();

		String figures = "select r.id || ' ' || r.distance_km || ' ' || r.ascent_m || ' ' || r.descent_m || ' '"
				+ " || r.seconds || ' ' || r.race_id || ' ' || r.race_date || ' ' || r.competitor_id"
				+ " from result r order by r.id";
		List<String> figuresBefore = rowsOf(figures);
		List<String> frozenBefore = rowsOf("select t::text from season_points_at_freeze t order by t.competitor_id");

		runTheMigration();

		Map<String, BigDecimal> due = new LinkedHashMap<>();
		due.put("free", new BigDecimal("18.59"));
		due.put("marathon", new BigDecimal("29.07"));
		due.put("twenty-four-hours", new BigDecimal("2.36"));
		due.put("twelve-hours", new BigDecimal("22.86"));
		due.put("before-2027", new BigDecimal("8.86"));
		due.put("frozen-season", new BigDecimal("8.86"));
		due.put("unscored", new BigDecimal("0.00"));

		assertThat(pointsBySlug()).as("each run counted by the formula of 27.11.2026, worked in Python")
				.containsExactlyEntriesOf(due);
		assertThat(rowsOf(figures)).as("the figures of a run are the run's, and only its points move")
				.isEqualTo(figuresBefore);
		assertThat(rowsOf("select t::text from season_points_at_freeze t order by t.competitor_id"))
				.as("the points of a frozen season at its freeze are a constant")
				.isEqualTo(frozenBefore)
				.isNotEmpty();
	}

	@Test
	void theMigrationIsTheOneFlywayRanAsV117() {
		assertThat(migration.getVersion().getVersion()).isEqualTo("117");
		assertThat(db.sql("select count(*) from " + flywayTable() + " where version = '117' and success")
				.query(Long.class).single()).as("Flyway was handed the bean and ran it").isEqualTo(1L);
	}
}

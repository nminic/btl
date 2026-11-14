package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V99 RUN OVER A DATABASE THAT ALREADY HOLDS EVENTS OF ALL THREE EARLIER KINDS AND RESULTS UNDER THEM, AND
 * NOTHING ALREADY THERE MOVES.
 *
 * <p>PDL, 14.11.2026: „Uz korak 1 ide provera na produkciji: odgovori svih javnih ruta sa obračunima pre i
 * posle podizanja moraju biti isti, jer nebodovanih rezultata još nema." That is measured on production; this
 * is the half of it a migration can be held to here: the rows of {@code btl_event} and {@code result} are
 * byte for byte what they were, the sum of {@code result.points} is the same, and every result already
 * standing is a scored one.
 *
 * <p>The shape is {@code LeagueRacesCarriedOverTest}'s: what V99 made is taken away, rows are written as a
 * database before V99 holds them, and then V99 itself is run, read off Flyway ({@link #migrationSql}). The
 * constraint V99 widens is put back as V7 wrote it, so a row of a fourth kind could not be in the fixture.
 */
class UnscoredKindCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private void aDatabaseAsItStoodBeforeV99() {
		jdbc.execute("drop view unscored_race");
		jdbc.execute("drop view scored_race");
		jdbc.execute("alter table btl_event drop constraint btl_event_kind_known");
		jdbc.execute("alter table btl_event add constraint btl_event_kind_known"
				+ " check (kind in ('race', 'training', 'gathering'))");

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id, city,"
				+ " country_id, first_season, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
				+ " father_name, address, shirt_size, health_statement_at) values ('000998', 'Stari', 'Trkac', 'M',"
				+ " date '1984-04-04', " + A_TOWN + ", null, null, 2027, '00112233445566f8', null, '', false,"
				+ " 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();

		for (String kind : List.of("race", "training", "gathering")) {
			db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
					+ " values ('zatecen-" + kind + "', 'Zatecen " + kind + "', date '2027-05-02', " + A_TOWN + ", '"
					+ kind + "', false, '', '')").update();
		}

		for (String day : List.of("2019-04-14", "2027-05-02")) {
			db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
					+ " values ('zatecena-trka-" + day + "', 'Zatecena trka', date '" + day + "', " + A_TOWN
					+ ", 'race', false, '', '')").update();
			db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
					+ " descent_m) select id, 'Zatecena trka', false, date, 'free', 0, 0, 0, 0 from btl_event"
					+ " where slug = 'zatecena-trka-" + day + "'").update();
			db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
					+ " seconds, points) select c.id, r.id, r.date, 21.1, 100, 100, 6000, 31.25 from competitor c,"
					+ " race r join btl_event e on e.id = r.event_id where c.member_number = '000998'"
					+ " and e.slug = 'zatecena-trka-" + day + "'").update();
		}
	}

	private List<String> rowsOf(String table) {
		return db.sql("select t::text from " + table + " t order by t.id").query(String.class).list();
	}

	private BigDecimal pointsOfEveryResult() {
		return db.sql("select coalesce(sum(points), 0) from result").query(BigDecimal.class).single();
	}

	@Test
	void theEventsAndTheResultsAlreadyThereStayAsTheyWereAndEveryResultIsScored() {
		aDatabaseAsItStoodBeforeV99();

		List<String> events = rowsOf("btl_event");
		List<String> results = rowsOf("result");
		BigDecimal points = pointsOfEveryResult();

		assertThat(points).as("the fixture holds no points, so the sum compares nothing").isPositive();

		jdbc.execute(migrationSql("99"));

		assertThat(rowsOf("btl_event")).as("an event already there was changed").isEqualTo(events);
		assertThat(rowsOf("result")).as("a result already there was changed").isEqualTo(results);
		assertThat(pointsOfEveryResult()).as("the sum of every result's points moved").isEqualTo(points);
		assertThat(db.sql("select count(*) from result r where r.race_id not in (select id from scored_race)")
				.query(Long.class).single())
				.as("a result already there stopped being scored")
				.isZero();
		assertThat(db.sql("select count(*) from unscored_race").query(Long.class).single())
				.as("a race already there became unscored")
				.isZero();
	}
}

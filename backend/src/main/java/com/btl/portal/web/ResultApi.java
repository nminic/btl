package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * WHAT WAS RUN, BY WHOM, AND WHAT IT WAS WORTH.
 *
 * <p>This is the portal's record and the thing the league exists to keep. It is
 * public and says so in its own words: Article 73 of the rulebook lists the name,
 * the member number and every verified result with its length, climb, descent,
 * time and day among the things that are public, and the privacy policy repeats
 * it. Nothing here is anybody's to hide, and a result nobody can read is a league
 * nobody can check.
 *
 * <p><b>The names are joined and not stored, and that is the whole point of the
 * shape.</b> What the portal serves today carries the name of the race, the name
 * of the event and the address of the event beside every result, because a screen
 * with no database has to. Measured on that data those copies had drifted in two
 * hundred and twenty three places out of seventeen thousand six hundred and forty
 * compared values (V7, NESLAGANJA-MOCK). Here they come off the race and the event
 * every time they are asked for, so the class of drift is gone rather than
 * watched. The names the portal reads by do not change: they are the same fields.
 *
 * <p><b>The day is the result's own column and not the race's, and they cannot
 * differ.</b> A12 point 2c says the day of the race decides, never the day
 * somebody typed the result in, and V7 wrote the foreign key over
 * {@code (race_id, race_date)} so the database refuses a result whose day is not
 * its race's day. Reading either is reading the same fact; this reads the one the
 * rule names.
 *
 * <p><b>In the order they were run.</b> The file the portal serves today is in
 * the order the rows were written, which for an imported history is no order at
 * all; a history is read by its days.
 */
@RestController
class ResultApi {

	private final JdbcClient db;

	ResultApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param category the length category worked out by the database from the
	 *                 distance, never by this server: one rule, one home (V7)
	 */
	record Result(long id, String memberNumber, long raceId, String raceName, String eventName,
			String eventSlug, LocalDate date, BigDecimal distanceKm, int ascentM, int descentM,
			int seconds, BigDecimal points, String category) {
	}

	@GetMapping("/api/results")
	List<Result> results() {
		return db.sql("select r.id, c.member_number, r.race_id, ra.name as race_name,"
						+ " e.name as event_name, e.slug as event_slug, r.race_date,"
						+ " r.distance_km, r.ascent_m, r.descent_m, r.seconds, r.points, r.category"
						+ " from result r"
						+ " join competitor c on c.id = r.competitor_id"
						+ " join race ra on ra.id = r.race_id"
						+ " join btl_event e on e.id = ra.event_id"
						+ " order by r.race_date, r.id")
				.query((row, one) -> new Result(row.getLong(1), row.getString(2), row.getLong(3),
						row.getString(4), row.getString(5), row.getString(6),
						row.getDate(7).toLocalDate(), row.getBigDecimal(8), row.getInt(9),
						row.getInt(10), row.getInt(11), row.getBigDecimal(12), row.getString(13)))
				.list();
	}
}

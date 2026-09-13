package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Clock;
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
 *
 * <p><b>AND THE SEASON THAT IS RUNNING IS NOT SERVED FOR SOMEBODY WHOSE FEE HAS
 * LAPSED.</b> Owner, 13.09.2026, in as many words: „Clanarina istice svake Nove
 * godine. Sto znaci da svi podaci o clanu kojem je clanarina istekla treba da
 * ostanu vidljivi u starim / zamrznutim sezonama kad je clanarina bila aktivna, a
 * da se u godini koja je upravo pocela ne prikazuje ni u listi clanova, niti
 * logicno u rezultatima."
 *
 * <p><b>Why that is one condition and not a table of who was a member when.</b>
 * A fee runs for exactly one calendar year, so „is he a member now" and „was he a
 * member this season" are not two questions. The flag on the member answers both,
 * and only the season that is running is affected by it; every season before it
 * is history and reads the same as it always did.
 *
 * <p><b>The boundary in both directions, written here rather than left to be
 * found.</b> One way: the running season's result of a member whose fee has
 * lapsed goes to nobody, because {@code /api/competitors} already leaves him off
 * the list of members (PDL P11), and the difference between two public answers
 * would then be the exact list of who has not paid - which is „sve u vezi sa
 * clanarinom" and Article 74 puts it beside the date of birth. The other way: his
 * result from a season he WAS a member in is served as it always was, and the
 * fact that a reader can tell from his absence today that he has not renewed is
 * not a leak but this same decision's own consequence.
 *
 * <p><b>The year comes from a clock that can be replaced, never from
 * {@code current_date}.</b> Written in SQL it would be a rule that cannot be
 * measured at the one boundary it is about until a New Year actually happens.
 * Here the bean is swapped for a clock fixed to a chosen night and both sides of
 * that boundary are one fixture ({@code WhatTimeItIs}).
 */
@RestController
class ResultApi {

	private final JdbcClient db;

	private final Clock clock;

	ResultApi(JdbcClient db, Clock clock) {
		this.db = db;
		this.clock = clock;
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
						/* EVERYTHING, EXCEPT THE RUNNING SEASON OF SOMEBODY WHOSE FEE HAS
						   LAPSED. Owner, 13.09.2026: „u godini koja je upravo pocela ne
						   prikazuje ni u listi clanova, niti logicno u rezultatima", and the
						   seasons before it stay „vidljivi u starim / zamrznutim sezonama kad
						   je clanarina bila aktivna". The year is a parameter and not
						   `current_date` so the boundary can be measured on a chosen night
						   rather than once a year. */
						+ " where c.active or extract(year from r.race_date) <> :theSeasonRunning"
						+ " order by r.race_date, r.id")
				.param("theSeasonRunning", theSeasonRunning())
				.query((row, one) -> new Result(row.getLong(1), row.getString(2), row.getLong(3),
						row.getString(4), row.getString(5), row.getString(6),
						row.getDate(7).toLocalDate(), row.getBigDecimal(8), row.getInt(9),
						row.getInt(10), row.getInt(11), row.getBigDecimal(12), row.getString(13)))
				.list();
	}

	/**
	 * THE CALENDAR YEAR THE LEAGUE IS IN, read in the league's own time.
	 *
	 * <p>The machine's zone decides nothing: a server kept in UTC would still be
	 * calling it last year for the first hour of every New Year in Belgrade, and that
	 * hour is the one this whole rule is about. {@code SeasonClock} says the same
	 * sentence about freezing a season and owns the zone; this reads it.
	 *
	 * <p><b>And it is the plain calendar year, never lifted to the first season there
	 * is.</b> {@code SeasonClock.seasonBeingPaidFor} answers a different question and
	 * lifts its answer to 2027, which is right for somebody renewing in 2026 and wrong
	 * here: through 2026 no season is running, so nobody's result is the running
	 * season's, and lifting it would start hiding 2027 before 2027 had begun.
	 */
	private int theSeasonRunning() {
		return LocalDate.now(clock.withZone(SeasonClock.ZONE)).getYear();
	}
}

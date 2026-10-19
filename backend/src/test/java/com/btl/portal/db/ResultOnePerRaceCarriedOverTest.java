package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V65 DOES TO THE RESULTS THAT ARE THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V65 adds a unique key over {@code (competitor_id, race_id)}, and a key
 * that refuses a second row refuses the migration too if two such rows already stand. Every other test
 * starts from an empty {@code result}, so none of them can see that. That is the class of fault
 * {@code btl/CLAUDE.md} names after V35 failed on QA, and the shape that measures it is
 * {@link OnePictureWaitsCarriedOverTest}'s and {@link MembershipCarriedOverTest}'s: take away what the
 * migration adds, write the rows a portal really holds, and run THE MIGRATION ITSELF over them
 * ({@link DatabaseTest#migrationSql}). Everything happens inside the test's transaction and is rolled
 * back.
 *
 * <p><b>WHAT THE REAL TABLE HELD, measured rather than guessed:</b> a read-only count on QA on
 * 18.10.2026, with the owner's permission, answered 276 results and no member with two on one race
 * (PDL P6, „[IZMERENO 18.10.2026, QA, uz dozvolu vlasnika]"). So the rows below are the shapes the
 * table CAN hold beside the rule, each of which the key must let stand.
 *
 * <p><b>The undo is one statement and it is proved by behaviour, not by a list.</b> {@link #whatV65Adds}
 * drops the one constraint V65 adds and nothing else. That it was the whole undo is shown by the
 * second case: a second result of one member on one race goes in only because nothing refuses it any
 * more.
 */
class ResultOnePerRaceCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String THE_KEY = "result_one_per_member_on_a_race";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** The morning both races of the one event are run on. */
	private static final String THE_MORNING = "date '2026-04-12'";

	/** Everything V65 adds, taken away so it has something to add. */
	private void whatV65Adds() {
		jdbc.execute("alter table result drop constraint " + THE_KEY);
	}

	private void competitor(String number, String code) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Zateceni',"
						+ " 'M', date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, code).update();
	}

	private void race(String name, String distance) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values ((select id from btl_event where slug ="
						+ " 'zatecen-jutarnji-dogadjaj'), ?, false, " + THE_MORNING + ", 'length', 0,"
						+ " cast(? as numeric), 0, 0)")
				.params(name, distance).update();
	}

	private void result(String number, String raceName, int seconds) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) select c.id, r.id, r.date, r.distance_km, 0, 0, ?,"
						+ " 10.00 from competitor c, race r where c.member_number = ? and r.name = ?")
				.params(seconds, number, raceName).update();
	}

	/**
	 * EVERY SHAPE THE TABLE HOLDS BESIDE THE RULE, and one member for each.
	 *
	 * <ul>
	 * <li>{@code 001301}: a marathon and a half marathon of ONE event on ONE morning, which is the
	 * owner's own reason for the rule (PDL P6, 09.09.2026: „maraton i polumaraton istog jutra daju dva
	 * rezultata istom članu"). Same member, same event, same day, two races, so a key over the day or
	 * over the event instead of over the race stops the migration here;
	 * <li>{@code 001302}: the same half marathon as {@code 001301}, so one race holds two members;
	 * <li>{@code 001303}: the marathon alone.
	 * </ul>
	 */
	@BeforeEach
	void theResultsAsTheyStoodBeforeV65() {
		whatV65Adds();

		competitor("001301", "00112233445599a1");
		competitor("001302", "00112233445599a2");
		competitor("001303", "00112233445599a3");

		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values ('zatecen-jutarnji-dogadjaj', 'Zatecen jutarnji dogadjaj', "
						+ THE_MORNING + ", " + A_TOWN + ", 'race', false, '', '')")
				.update();

		race("Zatecen maraton istog jutra", "42.1950");
		race("Zatecen polumaraton istog jutra", "21.0975");

		result("001301", "Zatecen maraton istog jutra", 14400);
		result("001301", "Zatecen polumaraton istog jutra", 6600);
		result("001302", "Zatecen polumaraton istog jutra", 7000);
		result("001303", "Zatecen maraton istog jutra", 15000);
	}

	private boolean theKeyStands() {
		return db.sql("select exists(select 1 from pg_constraint where conname = ?"
						+ " and conrelid = 'result'::regclass)")
				.param(THE_KEY).query(Boolean.class).single();
	}

	/**
	 * EVERY SHAPE ABOVE STANDS, AND THE KEY GOES ON OVER THEM.
	 *
	 * <p>The key is asked for before the migration as well as after, so „it was there already" and „the
	 * migration made it" are two different answers. That the member of the one morning really has two
	 * results of one event on one day is asserted first: without it the case would not measure the axis
	 * it is written for.
	 */
	@Test
	void theResultsAPortalHoldsTakeTheKey() {
		assertThat(theKeyStands())
				.as("the key is already standing before the migration runs, so what comes out of it"
						+ " below need not have been made by V65")
				.isFalse();
		assertThat(db.sql("select count(distinct ra.event_id) || ' ' || count(distinct r.race_date)"
						+ " || ' ' || count(distinct r.race_id) from result r join race ra on ra.id = r.race_id"
						+ " join competitor c on c.id = r.competitor_id where c.member_number = '001301'")
				.query(String.class).single())
				.as("the member of the one morning does not hold two races of one event on one day,"
						+ " so this measures nothing about the race against the day")
				.isEqualTo("1 1 2");

		jdbc.execute(migrationSql("65"));

		assertThat(theKeyStands()).isTrue();
		assertThat(db.sql("select count(*) from result").query(Long.class).single())
				.as("the migration took a result away instead of refusing to stand over it")
				.isEqualTo(4L);
	}

	/**
	 * AND A MEMBER WITH TWO RESULTS ON ONE RACE STOPS IT, rather than losing one of them.
	 *
	 * <p>That is the precondition QA was measured for: V65 does not choose which of two results
	 * survives, because deleting a result is not its to do and nobody has approved it, so a table
	 * holding two refuses the key and Flyway stops. The second result goes in only because the undo
	 * above was complete.
	 */
	@Test
	void aMemberWithTwoResultsOnOneRaceStopsTheMigrationRatherThanLosingOne() {
		result("001303", "Zatecen maraton istog jutra", 15500);

		assertThatThrownBy(() -> jdbc.execute(migrationSql("65")))
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(THE_KEY);
	}
}

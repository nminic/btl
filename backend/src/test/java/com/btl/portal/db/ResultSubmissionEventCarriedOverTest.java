package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V66 DOES TO THE RUNS THAT ARE ALREADY WAITING, run against a real database.
 *
 * <p><b>Why this exists.</b> V66 adds two columns to {@code result_submission} and four rules over
 * them, and a rule added over rows that are already there is the class of fault {@code btl/CLAUDE.md}
 * names after V35 failed on QA: every other test starts from an empty table, so none of them can see
 * it. The shape is {@link ResultOnePerRaceCarriedOverTest}'s: take away what the migration adds, write
 * the rows a portal really holds, and run THE MIGRATION ITSELF over them ({@link DatabaseTest#migrationSql}).
 * Everything happens inside the test's transaction and is rolled back.
 *
 * <p><b>Why no row can stop it, and why that is measured anyway.</b> Both columns arrive empty, and
 * every rule V66 adds is satisfied by a row whose two columns are empty, whatever else it holds - so
 * the answer is known before it is asked. It is asked because the argument is mine and the migration
 * is what runs on QA: a rule written as {@code (race_id is null) = (event_name is not null)}, which
 * would make the event required of a described run, reads almost the same and stops on every
 * described run already waiting. The case below holds the file to the shape that lets them stand.
 *
 * <p><b>The undo is one statement and it is proved by behaviour, not by a list.</b>
 * {@link #whatV66Adds} drops the two columns, and with them every rule and the index over them. That
 * it was the whole undo is asked of the catalogue before the migration runs: neither column is there.
 */
class ResultSubmissionEventCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_COUNTRY = "(select id from country where code = 'RS')";

	private static final String THE_MEMBER = "(select id from competitor where member_number = '001401')";

	private static final String THE_RACE = "(select id from race where name = 'Zatecena trka iz kalendara')";

	private static final String THE_DAY = "date '2027-04-12'";

	private static final String COLUMNS = "competitor_id, race_id, race_date, race_name, race_kind,"
			+ " place_id, city, country_id, distance_km, ascent_m, descent_m, seconds, link, comment,"
			+ " amends_result_id";

	/** Everything V66 adds, taken away so it has something to add. */
	private void whatV66Adds() {
		jdbc.execute("alter table result_submission drop column event_id cascade,"
				+ " drop column event_name cascade");
	}

	private void waiting(String values) {
		db.sql("insert into result_submission (" + COLUMNS + ") values (" + values + ")").update();
	}

	/**
	 * EVERY SHAPE A WAITING RUN HAS, one of each: a run from the calendar, a described run with a town
	 * of the codebook, a described run with a town typed by hand, and a correction of a counted result.
	 */
	@BeforeEach
	void theRunsAsTheyWaitedBeforeV66() {
		whatV66Adds();

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at) values ('001401',"
						+ " 'Probni', 'Zateceni', 'M', date '1982-02-02', " + A_TOWN + ", null, null,"
						+ " 2027, false, true, '00112233445599b1', null, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.update();
		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values ('zatecen-dogadjaj-v66', 'Zatecen dogadjaj', " + THE_DAY + ", "
						+ A_TOWN + ", 'race', false, '', '')")
				.update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values ((select id from btl_event where slug ="
						+ " 'zatecen-dogadjaj-v66'), 'Zatecena trka iz kalendara', false, " + THE_DAY
						+ ", 'length', 0, 10.00, 0, 0)")
				.update();
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) values (" + THE_MEMBER + ", " + THE_RACE + ", "
						+ THE_DAY + ", 10.00, 0, 0, 3000, 10.00)")
				.update();

		waiting(THE_MEMBER + ", " + THE_RACE + ", " + THE_DAY + ", null, null, null, null, null,"
				+ " 10.00, 0, 0, 3100, '', '', null");
		waiting(THE_MEMBER + ", null, date '2027-05-05', 'Zatecena opisana trka', 'free', " + A_TOWN
				+ ", null, null, 21.50, 300, 280, 7200, '', '', null");
		waiting(THE_MEMBER + ", null, date '2027-05-06', 'Zatecena trka u zaseoku', 'time', null,"
				+ " 'Zaselak', " + A_COUNTRY + ", 15.00, 0, 0, 3600, '', '', null");
		waiting(THE_MEMBER + ", " + THE_RACE + ", " + THE_DAY + ", null, null, null, null, null,"
				+ " 10.00, 0, 0, 2950, '', 'Ispravka', (select id from result where competitor_id = "
				+ THE_MEMBER + ")");
	}

	private long columnsOfV66() {
		return db.sql("select count(*) from information_schema.columns where table_name ="
						+ " 'result_submission' and column_name in ('event_id', 'event_name')")
				.query(Long.class).single();
	}

	/**
	 * EVERY SHAPE ABOVE STANDS, NAMES NO EVENT, AND THE RULES GO ON OVER THEM, VALIDATED.
	 *
	 * <p>The columns are asked for before the migration as well as after, so „it was there already"
	 * and „the migration made it" are two different answers; and the four rules are asked as
	 * validated ({@code convalidated}), which is what says they were checked against these rows and
	 * not merely written down beside them.
	 */
	@Test
	void theRunsThatWaitTakeTheEventColumnsAndTheirRules() {
		assertThat(columnsOfV66())
				.as("a column V66 adds is still there after the undo, so the migration below need not"
						+ " have made it")
				.isZero();
		assertThat(db.sql("select count(*) || ' ' || count(*) filter (where race_id is null) || ' '"
						+ " || count(*) filter (where amends_result_id is not null) from result_submission")
				.query(String.class).single())
				.as("the four shapes are not all waiting, so this measures less than it says")
				.isEqualTo("4 2 1");

		jdbc.execute(migrationSql("66"));

		assertThat(columnsOfV66()).isEqualTo(2L);
		assertThat(db.sql("select count(*) from result_submission where event_id is null"
						+ " and event_name is null")
				.query(Long.class).single())
				.as("the migration took a waiting run away, or gave one an event nobody chose")
				.isEqualTo(4L);
		assertThat(db.sql("select conname from pg_constraint where conrelid ="
						+ " 'result_submission'::regclass and convalidated and conname in"
						+ " ('result_submission_event_fk',"
						+ " 'result_submission_only_a_described_run_names_its_event',"
						+ " 'result_submission_event_is_chosen_or_typed',"
						+ " 'result_submission_event_name_not_blank')")
				.query(String.class).list())
				.as("a rule of V66 is missing, or stands without having been checked against the rows")
				.hasSize(4);
	}
}

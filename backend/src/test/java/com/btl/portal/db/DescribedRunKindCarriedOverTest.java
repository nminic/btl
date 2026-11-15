package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V101 DOES TO THE RUNS THAT ARE ALREADY WAITING, run against a real database.
 *
 * <p><b>Why this exists.</b> V101 adds a column to {@code result_submission} and a rule that a described
 * run carries it, and a rule added over rows that are already there is the class of fault
 * {@code btl/CLAUDE.md} names after V35 failed on QA: every other test starts from an empty table. Unlike
 * V66, whose columns arrived empty and whose rules an empty row met, this rule is NOT met by a row that
 * stood before it (a described run with no kind), so the migration has to give every such row its kind
 * before the rule is added, and this measures that it does.
 *
 * <p>The shape is {@link ResultSubmissionEventCarriedOverTest}'s: take away what the migration adds, write
 * the rows a portal really holds (every shape: a run from the calendar, a described run with a town of the
 * codebook, one with an event typed, one with an event chosen, one with a town typed and no event, and a
 * correction), and run THE MIGRATION ITSELF over them ({@link DatabaseTest#migrationSql}). Everything is
 * rolled back. The undo is one statement, {@code drop column ... cascade}, which takes the rules with the
 * column; that it was the whole undo is asked of the catalogue before the migration runs.
 */
class DescribedRunKindCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_COUNTRY = "(select id from country where code = 'RS')";

	private static final String THE_MEMBER = "(select id from competitor where member_number = '001402')";

	private static final String THE_RACE = "(select id from race where name = 'Zatecena trka V101')";

	private static final String THE_EVENT = "(select id from btl_event where slug = 'zatecen-dogadjaj-v101')";

	private static final String THE_DAY = "date '2027-04-12'";

	private static final String COLUMNS = "competitor_id, race_id, race_date, race_name, race_kind,"
			+ " place_id, city, country_id, distance_km, ascent_m, descent_m, seconds, link, comment,"
			+ " amends_result_id, event_id, event_name";

	private void waiting(String values) {
		db.sql("insert into result_submission (" + COLUMNS + ") values (" + values + ")").update();
	}

	@BeforeEach
	void theRunsAsTheyWaitedBeforeV101() {
		jdbc.execute("alter table result_submission drop column event_kind cascade");

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at) values ('001402',"
						+ " 'Probni', 'Zateceni', 'M', date '1982-02-02', " + A_TOWN + ", null, null,"
						+ " 2027, '00112233445599b2', null, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.update();
		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values ('zatecen-dogadjaj-v101', 'Zatecen dogadjaj V101', " + THE_DAY + ", "
						+ A_TOWN + ", 'race', false, '', '')")
				.update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values (" + THE_EVENT + ", 'Zatecena trka V101', false, "
						+ THE_DAY + ", 'length', 0, 10.00, 0, 0)")
				.update();
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) values (" + THE_MEMBER + ", " + THE_RACE + ", "
						+ THE_DAY + ", 10.00, 0, 0, 3000, 10.00)")
				.update();

		/* From the calendar, and a correction: both name a race, so neither is described. */
		waiting(THE_MEMBER + ", " + THE_RACE + ", " + THE_DAY + ", null, null, null, null, null,"
				+ " 10.00, 0, 0, 3100, '', '', null, null, null");
		waiting(THE_MEMBER + ", " + THE_RACE + ", " + THE_DAY + ", null, null, null, null, null,"
				+ " 10.00, 0, 0, 2950, '', 'Ispravka', (select id from result where competitor_id = "
				+ THE_MEMBER + "), null, null");
		/* Described: in a town of the codebook and no event, on an event typed, on an event chosen
		   (whose town is the event's, V67), and in a town typed by hand. */
		waiting(THE_MEMBER + ", null, date '2027-05-05', 'Zatecena opisana', 'free', " + A_TOWN
				+ ", null, null, 21.50, 300, 280, 7200, '', '', null, null, null");
		waiting(THE_MEMBER + ", null, date '2027-05-06', 'Zatecena na otkucanom', 'length', " + A_TOWN
				+ ", null, null, 10.00, 30, 30, 3000, '', '', null, null, 'Otkucan dogadjaj'");
		waiting(THE_MEMBER + ", null, date '2027-05-07', 'Zatecena na izabranom', 'free', null, null,"
				+ " null, 8.00, 20, 20, 2400, '', '', null, " + THE_EVENT + ", null");
		waiting(THE_MEMBER + ", null, date '2027-05-08', 'Zatecena u zaseoku', 'time', null, 'Zaselak', "
				+ A_COUNTRY + ", 15.00, 0, 0, 3600, '', '', null, null, null");
	}

	private long theColumn() {
		return db.sql("select count(*) from information_schema.columns where table_name ="
						+ " 'result_submission' and column_name = 'event_kind'")
				.query(Long.class).single();
	}

	/**
	 * EVERY DESCRIBED RUN STANDING IS GIVEN THE KIND IT WAS SENT UNDER, A SCORED RACE, AND NO RUN ON A RACE OF
	 * THE CALENDAR IS GIVEN ONE; AND BOTH RULES GO ON OVER THEM, VALIDATED.
	 *
	 * <p>Counted by shape and not by total, so a migration that gave the kind to every row, or to none, is
	 * told apart from the right one: four described rows carry {@code race}, two rows with a race carry
	 * nothing. And the rules are asked as validated ({@code convalidated}), which is what says they were
	 * checked against these rows and not written down beside them.
	 */
	@Test
	void everyDescribedRunIsAScoredOneAndTheRulesHoldOverThem() {
		assertThat(theColumn())
				.as("the column V101 adds is still there after the undo, so the migration need not have made it")
				.isZero();
		assertThat(db.sql("select count(*) || ' ' || count(*) filter (where race_id is null)"
						+ " from result_submission where competitor_id = " + THE_MEMBER)
				.query(String.class).single())
				.as("the six shapes are not all waiting, so this measures less than it says")
				.isEqualTo("6 4");

		jdbc.execute(migrationSql("101"));

		assertThat(theColumn()).isOne();
		assertThat(db.sql("select coalesce(event_kind, '-') from result_submission where competitor_id = "
						+ THE_MEMBER + " order by race_id is null, race_date, id")
				.query(String.class).list())
				.as("a run from the calendar was given a kind, or a described run was not given the scored one")
				.containsExactly("-", "-", "race", "race", "race", "race");
		assertThat(db.sql("select conname from pg_constraint where conrelid = 'result_submission'::regclass"
						+ " and convalidated and conname in ('result_submission_event_kind_known',"
						+ " 'result_submission_a_described_run_carries_its_kind') order by conname")
				.query(String.class).list())
				.as("a rule of V101 is missing, or stands without having been checked against the rows")
				.isEqualTo(List.of("result_submission_a_described_run_carries_its_kind",
						"result_submission_event_kind_known"));
	}
}

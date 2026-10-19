package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V67 DOES TO THE RUNS THAT ARE ALREADY WAITING, run against a real database.
 *
 * <p><b>Why this exists.</b> V67 adds two rules to {@code result_submission}, takes one of V10's away, and
 * changes rows before it adds them, and every other test starts from an empty table. The shape is
 * {@link ResultSubmissionEventCarriedOverTest}'s: take away what the migration adds (and put back what it
 * takes away), write the rows a portal can hold, and run THE MIGRATION ITSELF over them
 * ({@link DatabaseTest#migrationSql}). Everything is rolled back.
 *
 * <p><b>The one shape the new rule refuses is a run on a chosen event that carries a town</b>, which the
 * route of V66 required. The portal's form never sent a chosen event, so no such row is expected on QA,
 * but the shape is real and V67 settles it rather than stopping on it: its town goes, because the event
 * it names has one. That row is written here beside every shape V67 must leave as it is.
 *
 * <p><b>The undo is proved by behaviour where it can be</b>: the run on a chosen event WITH a town goes in
 * only because the rule that refuses it is gone. That V10's rule is back is asked of the catalogue
 * ({@link #theUndoIsTheSchemaAsItStoodBeforeV67}), since every row above satisfies it.
 */
class ARunOnAChosenEventCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_COUNTRY = "(select id from country where code = 'RS')";

	private static final String THE_MEMBER = "(select id from competitor where member_number = '001501')";

	private static final String THE_RACE = "(select id from race where name = 'Zatecena trka V67')";

	private static final String THE_EVENT = "(select id from btl_event where slug = 'zatecen-dogadjaj-v67')";

	private static final String THE_DAY = "date '2027-04-12'";

	private static final String COLUMNS = "competitor_id, race_id, race_date, race_name, race_kind,"
			+ " place_id, city, country_id, distance_km, ascent_m, descent_m, seconds, link, comment,"
			+ " amends_result_id, event_id, event_name";

	/** Everything V67 adds taken away, and the one rule of V10 it drops put back, as V10 wrote it. */
	private void whatV67Changes() {
		jdbc.execute("alter table result_submission"
				+ " drop constraint result_submission_a_calendar_run_names_no_town,"
				+ " drop constraint result_submission_a_chosen_event_brings_its_town,"
				+ " add constraint result_submission_described_race_names_its_town"
				+ " check ((race_name is not null) = ((place_id is not null) or (city is not null)))");
	}

	private void waiting(String values) {
		db.sql("insert into result_submission (" + COLUMNS + ") values (" + values + ")").update();
	}

	/**
	 * EVERY SHAPE A WAITING RUN CAN HAVE AFTER V66: from the calendar; described with a town of the
	 * codebook and no event; described with a typed town on a typed event; described on a CHOSEN event
	 * with the town V66's route asked for; and a correction.
	 */
	@BeforeEach
	void theRunsAsTheyWaitedBeforeV67() {
		whatV67Changes();

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, first_season_2027, active,"
						+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at) values ('001501',"
						+ " 'Probni', 'Zateceni', 'M', date '1982-02-02', " + A_TOWN + ", null, null,"
						+ " 2027, false, true, '00112233445599c1', null, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.update();
		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values ('zatecen-dogadjaj-v67', 'Zatecen dogadjaj', " + THE_DAY + ", "
						+ A_TOWN + ", 'race', false, '', '')")
				.update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values (" + THE_EVENT + ", 'Zatecena trka V67', false, "
						+ THE_DAY + ", 'length', 0, 10.00, 0, 0)")
				.update();
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) values (" + THE_MEMBER + ", " + THE_RACE + ", "
						+ THE_DAY + ", 10.00, 0, 0, 3000, 10.00)")
				.update();

		waiting(THE_MEMBER + ", " + THE_RACE + ", " + THE_DAY + ", null, null, null, null, null,"
				+ " 10.00, 0, 0, 3100, '', 'iz kalendara', null, null, null");
		waiting(THE_MEMBER + ", null, date '2027-05-05', 'Opisana bez dogadjaja', 'free', " + A_TOWN
				+ ", null, null, 21.50, 300, 280, 7200, '', 'bez dogadjaja', null, null, null");
		waiting(THE_MEMBER + ", null, date '2027-05-06', 'Opisana na kucanom', 'time', null,"
				+ " 'Zaselak', " + A_COUNTRY + ", 15.00, 0, 0, 3600, '', 'na kucanom', null, null,"
				+ " 'Kucani dogadjaj'");
		waiting(THE_MEMBER + ", null, date '2027-05-07', 'Opisana na izabranom', 'free', null,"
				+ " 'Zaselak', " + A_COUNTRY + ", 12.00, 0, 0, 3300, '', 'na izabranom', null, "
				+ THE_EVENT + ", null");
		waiting(THE_MEMBER + ", " + THE_RACE + ", " + THE_DAY + ", null, null, null, null, null,"
				+ " 10.00, 0, 0, 2950, '', 'ispravka', (select id from result where competitor_id = "
				+ THE_MEMBER + "), null, null");
	}

	/** Each waiting run by its comment, and the town it carries as „place city country". */
	private String townOf(String comment) {
		return db.sql("select coalesce(place_id::text, '-') || ' ' || coalesce(city, '-') || ' '"
						+ " || coalesce(country_id::text, '-') from result_submission where comment = ?")
				.param(comment).query(String.class).single();
	}

	private String placeKey() {
		return db.sql("select id::text from place where rank = 1").query(String.class).single();
	}

	private String countryKey() {
		return db.sql("select id::text from country where code = 'RS'").query(String.class).single();
	}

	/**
	 * EVERY RUN STANDS, THE ONE ON A CHOSEN EVENT LOSES ITS COPY OF THE TOWN AND NOTHING ELSE, AND THE TWO
	 * RULES GO ON VALIDATED WHILE V10'S IS GONE.
	 */
	@Test
	void theRunsThatWaitTakeTheRulesAndOnlyTheChosenOneLosesItsTown() {
		assertThat(townOf("na izabranom"))
				.as("the run on a chosen event carries no town before the migration, so what comes out"
						+ " of it below says nothing")
				.isEqualTo("- Zaselak " + countryKey());

		jdbc.execute(migrationSql("67"));

		assertThat(db.sql("select count(*) from result_submission").query(Long.class).single())
				.as("the migration took a waiting run away").isEqualTo(5L);
		assertThat(townOf("na izabranom")).isEqualTo("- - -");
		assertThat(db.sql("select event_id from result_submission where comment = 'na izabranom'")
				.query(Long.class).single())
				.as("the run lost the event it was chosen on along with its town")
				.isEqualTo(db.sql("select id from btl_event where slug = 'zatecen-dogadjaj-v67'")
						.query(Long.class).single());
		assertThat(townOf("bez dogadjaja")).isEqualTo(placeKey() + " - -");
		assertThat(townOf("na kucanom")).as("a run on a typed event lost its own town")
				.isEqualTo("- Zaselak " + countryKey());
		assertThat(townOf("iz kalendara")).isEqualTo("- - -");
		assertThat(townOf("ispravka")).isEqualTo("- - -");

		assertThat(db.sql("select conname from pg_constraint where conrelid ="
						+ " 'result_submission'::regclass and convalidated and conname in"
						+ " ('result_submission_a_calendar_run_names_no_town',"
						+ " 'result_submission_a_chosen_event_brings_its_town')")
				.query(String.class).list())
				.as("a rule of V67 is missing, or stands without having been checked against the rows")
				.hasSize(2);
		assertThat(db.sql("select count(*) from pg_constraint where conname ="
						+ " 'result_submission_described_race_names_its_town'")
				.query(Long.class).single())
				.as("V10's rule that every described run names a town still stands")
				.isZero();
	}

	/** AND THE UNDO WAS V10 AS IT STOOD: a described run with neither a town nor an event is refused. */
	@Test
	void theUndoIsTheSchemaAsItStoodBeforeV67() {
		assertThat(db.sql("select count(*) from pg_constraint where conname ="
						+ " 'result_submission_described_race_names_its_town'")
				.query(Long.class).single()).isOne();
	}
}

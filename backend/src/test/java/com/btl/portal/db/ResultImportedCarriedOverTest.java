package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V105 DOES TO THE RESULTS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V105 writes {@code result_brought_by_known} again, on a table both real databases hold
 * thousands of rows in: the history with no moment and no way (2176 of them imported on production by
 * 16.11.2026), and every result approved or entered since V97. Every other test starts from an empty database,
 * so a rule the rows already standing break is invisible to all of them (CLAUDE.md, section 11).
 *
 * <p><b>What the migration is meant to do with such a row:</b> nothing. The history keeps its empty pair, because
 * nobody recorded when it came in and no moment is made up (PDL, owner, 16.11.2026, and V97 for the same rows);
 * an approval and an entry keep their word and their moment. That every one of them passes untouched IS the
 * measurement.
 *
 * <p><b>How the fixture is made</b>, the shape of {@link ResultBroughtInCarriedOverTest}: what V105 changes is
 * undone (its rule is written back as V97 wrote it, with two words), the rows are written as a database holds
 * them before V105, and the migration is executed from the file Flyway resolved ({@link DatabaseTest#migrationSql}),
 * inside the test's transaction, which is rolled back.
 */
class ResultImportedCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, referral_code, referred_by, bio,"
			+ " profile_hidden, birthday_shown, father_name, address, shirt_size, health_statement_at";

	/** His rows as {@code way | moment in UTC}, the history's as {@code - | -}, in the order of the races. */
	private List<String> hisRows() {
		return db.sql("select coalesce(r.brought_by, '-') || ' | '"
						+ " || coalesce(to_char(r.brought_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI'), '-')"
						+ " from result r join competitor c on c.id = r.competitor_id where c.member_number = '000996'"
						+ " order by r.race_date")
				.query(String.class).list();
	}

	private long hisId() {
		return db.sql("select id from competitor where member_number = '000996'").query(Long.class).single();
	}

	private long race(String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
				+ " values ('uvezen-rezultat-" + day + "', 'Uvezen " + day + "', date '" + day + "', " + A_TOWN
				+ ", 'race', false, '', '')").update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
				+ " descent_m) select id, 'Uvezena trka', false, date, 'free', 0, 0, 0, 0 from btl_event"
				+ " where slug = 'uvezen-rezultat-" + day + "'").update();

		return db.sql("select r.id from race r join btl_event e on e.id = r.event_id where e.slug = ?")
				.param("uvezen-rezultat-" + day).query(Long.class).single();
	}

	/** A result of his on a race of its own, with the moment and the way given as SQL. */
	private void result(String day, String broughtAt, String broughtBy) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
						+ " points, brought_at, brought_by) values (?, ?, date '" + day + "', 21.1, 0, 0, 6000, 30, "
						+ broughtAt + ", " + broughtBy + ")")
				.params(hisId(), race(day)).update();
	}

	/** The rule as V97 wrote it, with two words, and the member whose rows these are. */
	private void theRuleAsV97WroteIt() {
		jdbc.execute("alter table result drop constraint result_brought_by_known,"
				+ " add constraint result_brought_by_known check (brought_by in ('approval', 'league'))");
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000996', 'Stari', 'Uvoz', 'M',"
				+ " date '1984-04-04', " + A_TOWN + ", null, null, 2027, '00112233445566f6', null, '', false,"
				+ " 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();
	}

	/**
	 * THE ROWS GO THROUGH UNTOUCHED, AND THE RULE COMES OUT WITH THE THIRD WORD AND ONLY IT.
	 *
	 * <p>Read by behaviour and not out of the catalogue: after the migration an imported row goes in and a word
	 * nobody gave is still refused, and a result written without either column stays the empty pair, so neither
	 * column was given a default. That the fixture really took V105 away is {@link #beforeV105AnImportIsRefused}.
	 */
	@Test
	void theResultsAlreadyThereStayAsTheyWereAndAnImportIsTakenAfterwards() {
		theRuleAsV97WroteIt();
		result("2019-04-14", "null", "null");
		result("2026-11-13", "timestamptz '2026-11-13 10:00:00+00'", "'approval'");
		result("2026-11-14", "timestamptz '2026-11-14 10:00:00+00'", "'league'");

		List<String> before = hisRows();

		assertThat(before).as("the fixture wrote other rows than the three a database holds")
				.containsExactly("- | -", "approval | 2026-11-13 10:00", "league | 2026-11-14 10:00");

		jdbc.execute(migrationSql("105"));

		assertThat(hisRows()).as("V105 touched a row that stood before it").isEqualTo(before);

		result("2026-11-15", "timestamptz '2026-11-16 10:00:00+00'", "'import'");
		result("2026-11-17", "null", "null");

		assertThat(hisRows()).as("an import goes in with its word and its moment, and a row written without either"
						+ " is still the empty pair")
				.endsWith("import | 2026-11-16 10:00", "- | -");
		/* LAST, because the refusal ends the transaction the case is in. */
		assertThatThrownBy(() -> result("2026-11-18", "timestamptz '2026-11-16 10:00:00+00'", "'guess'"))
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("result_brought_by_known");
	}

	/**
	 * THE FIXTURE REALLY TAKES V105 AWAY: with the rule written back as V97 wrote it, an imported row is refused.
	 * Without this the case above could pass on a fixture that left the third word in place.
	 */
	@Test
	void beforeV105AnImportIsRefused() {
		theRuleAsV97WroteIt();

		assertThatThrownBy(() -> result("2026-11-15", "timestamptz '2026-11-16 10:00:00+00'", "'import'"))
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("result_brought_by_known");
	}
}

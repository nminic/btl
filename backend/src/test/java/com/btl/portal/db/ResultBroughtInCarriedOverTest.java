package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V97 DOES TO THE RESULTS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V97 adds two columns and two rules to {@code result}, a table both real databases
 * hold thousands of rows in (the history imported from the old portal, and every run approved or entered since).
 * Every other test starts from an empty database and writes its own rows to suit the rules it was written after,
 * so a rule the rows already standing break is invisible to all of them; CLAUDE.md, section 11, is the day that
 * cost the QA server.
 *
 * <p><b>What the migration is meant to do with such a row:</b> nothing. A result written before V97 has no
 * recorded moment of its approval, and none is made up, so it keeps an empty {@code brought_at} and an empty
 * {@code brought_by}, which is the history, whose ducats are written in silence (PDL, owner, 12.11.2026). Both
 * rules accept the empty pair. That the row passes IS the measurement: a rule that refused it would stop the
 * migration here, as V35's stopped QA.
 *
 * <p><b>How the fixture is made</b>, the shape of {@link DucatAwardCarriedOverTest} and
 * {@link MembershipCarriedOverTest}: what V97 adds is taken away with one {@code drop column ... cascade}, so the
 * two rules go with their columns and PostgreSQL works the dependencies out; rows are written as a database
 * holds them before V97; and the migration is executed from the file Flyway resolved
 * ({@link DatabaseTest#migrationSql}), inside the test's transaction, which is rolled back.
 */
class ResultBroughtInCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, referral_code, referred_by, bio,"
			+ " profile_hidden, birthday_shown, father_name, address, shirt_size, health_statement_at";

	private static final List<String> WHAT_V97_ADDS = List.of("brought_at", "brought_by");

	private List<String> columnsOfResult() {
		return db.sql("select column_name from information_schema.columns where table_schema = current_schema()"
				+ " and table_name = 'result' order by ordinal_position").query(String.class).list();
	}

	/** The table as it stood before V97, with two results of the history in it, one of them of 2019. */
	private void resultsAsTheyStoodBeforeV97() {
		jdbc.execute("alter table result drop column brought_at cascade, drop column brought_by cascade");
		assertThat(columnsOfResult())
				.as("the fixture left part of what V97 adds in place, so the migration below would fail on the"
						+ " fixture and not on itself")
				.doesNotContainAnyElementsOf(WHAT_V97_ADDS);

		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000997', 'Stari', 'Rezultat', 'M',"
				+ " date '1984-04-04', " + A_TOWN + ", null, null, 2027, '00112233445566f7', null, '', false,"
				+ " 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();

		for (String day : List.of("2019-04-14", "2027-05-02")) {
			db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
					+ " values ('zatecen-rezultat-" + day + "', 'Zatecen " + day + "', date '" + day + "', " + A_TOWN
					+ ", 'race', false, '', '')").update();
			db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
					+ " descent_m) select id, 'Zatecena trka', false, date, 'free', 0, 0, 0, 0 from btl_event"
					+ " where slug = 'zatecen-rezultat-" + day + "'").update();
			db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
					+ " seconds, points) select c.id, r.id, r.date, 21.1, 0, 0, 6000, 30 from competitor c, race r"
					+ " join btl_event e on e.id = r.event_id where c.member_number = '000997'"
					+ " and e.slug = 'zatecen-rezultat-" + day + "'").update();
		}
	}

	/**
	 * THE ROWS GO THROUGH, KEEP AN EMPTY MOMENT AND AN EMPTY WAY, AND THE TABLE COMES OUT WITH BOTH RULES.
	 *
	 * <p>The rules are read back by behaviour and not out of the catalogue: a row with a word and no moment is
	 * refused afterwards, so a migration that left either rule out, or wrote one that the empty pair breaks,
	 * leaves this red.
	 */
	@Test
	void theResultsAlreadyThereStayTheHistoryAndTheRulesStand() {
		resultsAsTheyStoodBeforeV97();

		jdbc.execute(migrationSql("97"));

		assertThat(columnsOfResult()).containsAll(WHAT_V97_ADDS);
		assertThat(db.sql("select count(*) from result r join competitor c on c.id = r.competitor_id"
				+ " where c.member_number = '000997' and r.brought_at is null and r.brought_by is null")
				.query(Integer.class).single())
				.as("a result of the history was given a moment or a way nobody recorded")
				.isEqualTo(2);
		/* LAST, because the refusal ends the transaction the case is in. */
		assertThatThrownBy(() -> db.sql("update result set brought_by = 'approval' where competitor_id ="
				+ " (select id from competitor where member_number = '000997')").update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("result_brought_at_and_by_together");
	}
}

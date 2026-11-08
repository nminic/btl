package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V91 DOES TO THE DUCAT AWARDS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V91 adds two NOT NULL columns, {@code tier} and {@code won_on}, to a table a
 * database in use may hold rows in. Every other test starts from an empty database, so the migration is
 * always measured over no rows and "the schema afterwards" is the only thing anybody has looked at.
 * Both real databases hold none today (0 rows on QA and on production, 08.11.2026), and that is exactly
 * the situation in which the rows-already-there half is forgotten until the day a row exists.
 *
 * <p><b>What the migration is meant to do with such a row, and why it is a stop.</b> A row written before
 * V91 has no true value for either column: the race day cannot be read off {@code awarded_at}, which is
 * when the row was written, and a tier worked out from today's definition would record a decision nobody
 * took. So the migration makes nothing up and stops with a sentence that says what is wrong. Both halves
 * are measured below: the empty table goes through and ends up with the columns, the table with a row is
 * refused with that sentence and not with PostgreSQL's "contains null values".
 *
 * <p><b>How the fixture is made.</b> What V91 adds is taken away with one {@code drop column ... cascade},
 * so the constraints, the key and the index that hang on the columns go with them and PostgreSQL works
 * the dependencies out; the fixture names no constraint. The migration is then executed from the file
 * Flyway resolved ({@link DatabaseTest#migrationSql}), inside the test's transaction, which is rolled
 * back. The shape is {@link MembershipCarriedOverTest}'s.
 */
class DucatAwardCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, referral_code, referred_by, bio,"
			+ " profile_hidden, birthday_shown, father_name, address, shirt_size, health_statement_at";

	private static final List<String> WHAT_V91_ADDS = List.of("tier", "won_on", "result_id");

	/** The table as it stood before V91: the three columns gone, and what hangs on them with them. */
	private void ducatAwardBeforeV91() {
		jdbc.execute("alter table ducat_award drop column tier, drop column won_on, drop column result_id cascade");
		assertThat(columnsOfDucatAward())
				.as("the fixture left part of what V91 adds in place, so the migration below would fail on"
						+ " the fixture and not on itself")
				.doesNotContainAnyElementsOf(WHAT_V91_ADDS);
	}

	private List<String> columnsOfDucatAward() {
		return db.sql("select column_name from information_schema.columns where table_schema = current_schema()"
				+ " and table_name = 'ducat_award' order by ordinal_position").query(String.class).list();
	}

	/** One badge as a database holds it before V91: no tier, no race day, no result. */
	private void anAwardV91DoesNotKnowAbout() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000991', 'Stari', 'Dukatas', 'M',"
				+ " date '1984-04-04', " + A_TOWN + ", null, null, 2027, '00112233445566e1', null, '', false,"
				+ " 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into ducat_award (competitor_id, ducat_id, kind, threshold, reached, period, season, month)"
				+ " select c.id, d.id, 'totalKm', 1000, 1042.50, 'season', 2027, null from competitor c, ducat d"
				+ " where c.member_number = '000991' and d.code = 'duk-sezonski-km'").update();
	}

	/**
	 * AN EMPTY TABLE GOES THROUGH, AND COMES OUT WITH THE THREE COLUMNS AND A RULE THAT HOLDS.
	 *
	 * <p>This is the state of both real databases. The columns are read back by name, the tier is refused
	 * outside one to five, and a row that names every column is accepted, so deleting any one of the three
	 * additions from the file leaves this red.
	 */
	@Test
	void anEmptyTableGainsTheThreeColumns() {
		ducatAwardBeforeV91();

		jdbc.execute(migrationSql("91"));

		assertThat(columnsOfDucatAward())
				.as("the migration did not leave the three columns on ducat_award")
				.containsAll(WHAT_V91_ADDS);
		assertThat(db.sql("select is_nullable from information_schema.columns where table_schema = current_schema()"
				+ " and table_name = 'ducat_award' and column_name in ('tier', 'won_on') order by column_name")
				.query(String.class).list())
				.as("tier and won_on must be NOT NULL, as the migration says")
				.containsExactly("NO", "NO");
		assertThat(db.sql("select is_nullable from information_schema.columns where table_schema = current_schema()"
				+ " and table_name = 'ducat_award' and column_name = 'result_id'").query(String.class).single())
				.as("result_id must stay empty-able: it is what SET NULL empties")
				.isEqualTo("YES");
	}

	/**
	 * A TABLE THAT HOLDS A ROW IS REFUSED WITH THE SENTENCE THAT SAYS WHY, and nothing is made up for it.
	 *
	 * <p>The message is asserted word for word where it matters: it must be the guard's own, which names
	 * V91 and the two missing facts, and not PostgreSQL's "contains null values", which is what the same
	 * file would say with the guard deleted. A migration that invented a tier and a day to get past this
	 * would not be refused at all, and the first assertion would be red.
	 */
	@Test
	void aTableThatHoldsARowIsRefusedWithTheGuardsOwnSentence() {
		ducatAwardBeforeV91();
		anAwardV91DoesNotKnowAbout();
		assertThat(db.sql("select count(*) from ducat_award").query(Long.class).single())
				.as("the fixture wrote no row, so the refusal below would be about an empty table")
				.isOne();

		String migration = migrationSql("91");

		assertThatThrownBy(() -> jdbc.execute(migration))
				.as("the migration went through over a row it has no true tier and no race day for")
				.isInstanceOf(DataAccessException.class)
				.rootCause()
				.hasMessageContaining("V91: ducat_award already holds rows")
				.hasMessageContaining("no true tier and no race day")
				.hasMessageNotContaining("contains null values");
	}
}

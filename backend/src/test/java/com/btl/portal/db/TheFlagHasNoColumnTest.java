package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V86 TAKES AWAY AND WHAT IT LEAVES, against a real database, and THE COLUMN IS NOT THERE.
 *
 * <p>V86 drops {@code competitor.active}, the one boolean with no season in it, so that whether a member is
 * active is read off the rows of {@code membership} and nowhere else (PDL, „Članstvo je činjenica po sezoni",
 * 13.09.2026: „Zastavica „aktivan" prestaje da bude podatak i postaje izvedena"). It is the shape of
 * {@link TheBasisHasOneHomeTest}, which keeps the same promise for the per-person basis V62 dropped. Four
 * questions are asked, and none is answered by the schema afterwards alone:
 *
 * <ul>
 * <li><b>Does it leave the rows a real database already holds?</b> Every test starts from an empty database,
 * so a drop that took a member's row or a season with it and one that did not leave the same nothing behind.
 * What the migration took away is put back as V7 wrote it, the rows a portal really holds are written, and the
 * migration ITSELF is executed through {@link DatabaseTest#migrationSql}, inside the test's transaction.</li>
 * <li><b>Is the column gone from the schema the portal ships?</b> Asked of the catalog, so that a migration
 * without its {@code drop} is red here and not only in the statements that stop being written.</li>
 * <li><b>Does anything still name it?</b> A view, a rule or an index that stood on it would have stopped the
 * drop, which is why V86 is written without {@code cascade}; the body of a function is text PostgreSQL does not
 * track, so that is asked of the catalog, and the question is shown to see a function that names the column.</li>
 * <li><b>Does a statement that names it stop?</b> This is what took the place of the list of writers the
 * source was swept for while the column was still written: a statement of {@code src/main} that writes or reads
 * the flag again fails the day it runs, because there is nothing to write or read.</li>
 * </ul>
 *
 * <p><b>The rows are the disagreement AF-1 measured, and its mirror.</b> One member whose flag says active
 * while his only season is not the one on sale, one whose flag says inactive while he holds the next one, and
 * one with no season at all, written first so that he is not the last row of anything. A migration that rewrote a
 * season from the flag, or that took the rows of whoever the flag named, comes out different on each.
 */
class TheFlagHasNoColumnTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	/** The column as V7 wrote it, which is everything V86 takes away. */
	private void whatV86TakesAway() {
		jdbc.execute("alter table competitor add column active boolean not null default false");
		jdbc.execute("alter table competitor alter column active drop default");
	}

	private long competitor(String number, String code, boolean active) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, city, country_id, first_season,"
						+ " active, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1982-02-02', " + A_TOWN + ", null,"
						+ " null, 2027, ?, ?, null, 'Biografija.', true, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, active, code).query(Long.class).single();
	}

	private List<String> memberships() {
		return db.sql("select c.member_number || ' ' || m.season || ' ' || m.basis || ' '"
						+ " || coalesce(m.decided_by_name, 'no trail')"
						+ " from membership m join competitor c on c.id = m.competitor_id"
						+ " order by c.member_number, m.season")
				.query(String.class).list();
	}

	/** Every column the migration does not own, so that a drop that rewrote another one is seen. */
	private List<String> whatElseTheMembersCarry() {
		return db.sql("select coalesce(member_number, 'none') || ' ' || first_name || ' ' || last_name || ' '"
						+ " || referral_code || ' ' || bio || ' ' || profile_hidden || ' ' || first_season"
						+ " from competitor order by referral_code")
				.query(String.class).list();
	}

	private boolean theColumnStands() {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = 'competitor'"
						+ " and column_name = 'active')")
				.query(Boolean.class).single());
	}

	@Test
	void theDropLeavesEverySeasonAndEveryOtherColumnAsItFoundThem() {
		whatV86TakesAway();

		competitor("001002", "00112233445566d3", false);
		long flagUpOtherSeason = competitor("001000", "00112233445566d1", true);
		long flagDownNextSeason = competitor("001001", "00112233445566d2", false);

		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2027, 'feeExempt', 'Vlasnik Probni', timestamptz '2026-10-01 10:00:00+00')")
				.param(flagUpOtherSeason).update();
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2028, 'feeExempt', 'Vlasnik Probni', timestamptz '2026-10-02 10:00:00+00')")
				.param(flagDownNextSeason).update();

		List<String> seasons = memberships();
		List<String> rest = whatElseTheMembersCarry();
		assertThat(seasons)
				.as("the fixture holds fewer seasons than it writes, so the comparison below is empty")
				.containsExactly("001000 2027 feeExempt Vlasnik Probni", "001001 2028 feeExempt Vlasnik Probni");
		assertThat(rest).as("the fixture holds fewer members than it writes").hasSize(3);
		assertThat(theColumnStands())
				.as("the column is not there before the migration, so its going says nothing")
				.isTrue();

		jdbc.execute(migrationSql("86"));

		assertThat(theColumnStands()).as("the flag is still on the member").isFalse();
		assertThat(memberships())
				.as("dropping the flag moved, rewrote or took a season it does not own")
				.containsExactlyElementsOf(seasons);
		assertThat(whatElseTheMembersCarry())
				.as("dropping the flag moved or rewrote another column of a member")
				.containsExactlyElementsOf(rest);
	}

	@Test
	void theColumnIsNotInTheSchemaThePortalShips() {
		assertThat(theColumnStands())
				.as("competitor.active is still in the schema: V86 does not drop it")
				.isFalse();
	}

	/**
	 * A STATEMENT THAT NAMES THE COLUMN STOPS, which is the place of the sweep of {@code src/main} for the
	 * word: there is nothing left to write or to read, so the writer that comes back or the reader that is
	 * added fails the first time it is run, and it is the SQL error that says so.
	 */
	@Test
	void aStatementThatNamesTheColumnStopsOnTheDayItRuns() {
		assertThatThrownBy(() -> jdbc.queryForList("select active from competitor"))
				.as("a read of the flag ran")
				.isInstanceOf(BadSqlGrammarException.class)
				.rootCause()
				.hasMessageContaining("column \"active\" does not exist");
	}

	private static final String A_FUNCTION_NAMING_IT = "select p.proname from pg_proc p"
			+ " join pg_namespace ns on ns.oid = p.pronamespace"
			+ " where ns.nspname = current_schema() and p.prosrc ~ '\\mactive\\M' order by 1";

	/**
	 * AND NO BODY OF CODE IN THE SCHEMA STILL NAMES IT, which is the half PostgreSQL does not track: function
	 * bodies (a trigger is a function) and view definitions are the two places a name can stand as text; a
	 * constraint or an index on the column would have gone with it or stopped it.
	 */
	@Test
	void nothingInTheSchemaStillNamesTheColumn() {
		assertThat(db.sql(A_FUNCTION_NAMING_IT).query(String.class).list())
				.as("a function in the schema names competitor.active")
				.isEmpty();
		assertThat(db.sql("select viewname from pg_views where schemaname = current_schema()"
						+ " and definition ~ '\\mactive\\M' order by 1").query(String.class).list())
				.as("a view in the schema reads competitor.active")
				.isEmpty();
	}

	/**
	 * AND THE WORD QUESTION ABOVE CAN SEE ONE, which is the only way to know it is a floor and not a question
	 * that happens to answer nothing. A function naming the column is written inside the case and rolled back
	 * with it.
	 */
	@Test
	void aFunctionThatStillNamesTheColumnIsSeen() {
		jdbc.execute("create function still_reads_the_flag() returns boolean language sql"
				+ " as 'select true as active'");

		assertThat(db.sql(A_FUNCTION_NAMING_IT).query(String.class).list()).containsExactly("still_reads_the_flag");
	}
}

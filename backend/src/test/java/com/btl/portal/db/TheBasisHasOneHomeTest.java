package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V62 TAKES AWAY AND WHAT IT LEAVES, against a real database.
 *
 * <p>V62 drops {@code competitor.membership_basis}, the per-person home of the basis, so that the
 * {@code membership} row of a season is the only one (owner, 18.10.2026, PDL P8, „Osnov clanstva
 * ima jedan dom, zapis po sezoni; stara kolona po coveku se brise"). Two questions are asked of it,
 * and neither is answered by the schema afterwards alone:
 *
 * <ul>
 * <li><b>Does it leave the rows a real database already holds?</b> Every test starts from an empty
 * database, so a drop that took the memberships with it and one that did not leave the same nothing
 * behind. The shape is {@link MembershipCarriedOverTest}'s: what the migration took away is put
 * back as V7 wrote it, the rows a portal really holds are written, and the migration ITSELF is
 * executed through {@link DatabaseTest#migrationSql}, inside the test's transaction.</li>
 * <li><b>Does anything still name the column?</b> A view, a rule or an index that stood on it would
 * have stopped the drop, which is why V62 is written without {@code cascade}; but the body of a
 * function is text PostgreSQL does not track, so a trigger that still wrote the column would apply
 * cleanly and break on the first row it touched. That is asked of the catalogue.</li>
 * </ul>
 *
 * <p><b>The rows are the disagreement the owner found on QA, and its mirror.</b> One member whose
 * column says {@code payment} while his season says {@code feeExempt}, which is the state that made
 * „Moja clanarina" ask him to pay; one whose column says {@code feeExempt} while his season stands on
 * a balance; and one with no season at all, written first so that he is not the last row of
 * anything. A migration that rewrote a basis from the column, or that took the rows of whoever the
 * column named, comes out different on each.
 */
class TheBasisHasOneHomeTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	/** The column as V7 wrote it, with its one rule, which is everything V62 takes away. */
	private void whatV62TakesAway() {
		jdbc.execute("alter table competitor add column membership_basis text not null default 'payment'"
				+ " constraint competitor_membership_basis_known"
				+ " check (membership_basis in ('payment', 'feeExempt'))");
		jdbc.execute("alter table competitor alter column membership_basis drop default");
	}

	private long competitor(String number, String code, String basis) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, city, country_id, first_season, first_season_2027,"
						+ " active, membership_basis, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1982-02-02', " + A_TOWN + ", null,"
						+ " null, 2027, false, true, ?, ?, null, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, basis, code).query(Long.class).single();
	}

	private List<String> memberships() {
		return db.sql("select c.member_number || ' ' || m.season || ' ' || m.basis || ' '"
						+ " || coalesce(m.decided_by_name, 'no trail') || ' '"
						+ " || coalesce(m.balance_entry_id::text, 'no entry')"
						+ " from membership m join competitor c on c.id = m.competitor_id"
						+ " order by c.member_number, m.season")
				.query(String.class).list();
	}

	private boolean theColumnStands() {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = 'competitor'"
						+ " and column_name = 'membership_basis')")
				.query(Boolean.class).single());
	}

	@Test
	void theDropLeavesEverySeasonAsItFoundIt() {
		whatV62TakesAway();

		competitor("001002", "00112233445566c3", "payment");
		long freedThisSeason = competitor("001000", "00112233445566c1", "payment");
		long onHisBalance = competitor("001001", "00112233445566c2", "feeExempt");

		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2027, 'feeExempt', 'Vlasnik Probni', timestamptz '2026-10-01 10:00:00+00')")
				.param(freedThisSeason).update();
		long entry = db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season,"
						+ " occurred_at, recorded_by_name) values (?, -30.00, 'EUR', 'membership', 2027,"
						+ " timestamptz '2026-10-02 10:00:00+00', 'Blagajnik Probni') returning id")
				.param(onHisBalance).query(Long.class).single();
		db.sql("insert into membership (competitor_id, season, basis, balance_entry_id)"
						+ " values (?, 2027, 'balance', ?)")
				.params(onHisBalance, entry).update();

		List<String> before = memberships();
		assertThat(before)
				.as("the fixture holds fewer seasons than it writes, so the comparison below is empty")
				.hasSize(2);
		assertThat(theColumnStands())
				.as("the column is not there before the migration, so its going says nothing")
				.isTrue();

		jdbc.execute(migrationSql("62"));

		assertThat(theColumnStands()).as("the per-person basis is still on the member").isFalse();
		assertThat(memberships())
				.as("dropping the per-person column moved, rewrote or took a season it does not own")
				.containsExactlyElementsOf(before)
				.containsExactly("001000 2027 feeExempt Vlasnik Probni no entry",
						"001001 2027 balance no trail " + entry);
		assertThat(db.sql("select count(*) from competitor").query(Integer.class).single())
				.as("a member went with the column")
				.isEqualTo(3);
	}

	/**
	 * AND NO BODY OF CODE IN THE SCHEMA STILL NAMES IT, which is the half PostgreSQL does not track.
	 *
	 * <p>Asked as a word, so that the names that carry it as a prefix and are about the per-season
	 * table - {@code membership_basis_known}, {@code membership_basis_says_whether_...} - are not it.
	 * Function bodies (a trigger is a function) and view definitions are the two places a name can
	 * stand as text; a constraint or an index on the column would have gone with it or stopped it.
	 */
	@Test
	void nothingInTheSchemaStillNamesTheColumn() {
		assertThat(db.sql("select p.proname from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace"
						+ " where ns.nspname = current_schema() and p.prosrc ~ 'membership_basis\\M'"
						+ " order by 1").query(String.class).list())
				.as("a function still reads or writes the per-person basis V62 dropped")
				.isEmpty();
		assertThat(db.sql("select viewname from pg_views where schemaname = current_schema()"
						+ " and definition ~ 'membership_basis\\M' order by 1").query(String.class).list())
				.as("a view still reads the per-person basis V62 dropped")
				.isEmpty();
	}

	/**
	 * AND THE WORD QUESTION ABOVE CAN SEE ONE, which is the only way to know it is a floor and not a
	 * question that happens to answer nothing. A function naming the column is written inside the
	 * case and rolled back with it.
	 */
	@Test
	void aFunctionThatStillNamesTheColumnIsSeen() {
		jdbc.execute("create function still_reads_the_basis() returns text language sql"
				+ " as 'select ''membership_basis'''");

		assertThat(db.sql("select p.proname from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace"
						+ " where ns.nspname = current_schema() and p.prosrc ~ 'membership_basis\\M'")
				.query(String.class).list())
				.containsExactly("still_reads_the_basis");
	}
}

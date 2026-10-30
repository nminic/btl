package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V81 DOES TO THE ROWS A REAL DATABASE ALREADY HOLDS, against a real database.
 *
 * <p>V81 moves the wish for a category from {@code competitor.first_season_2027}, one boolean per member,
 * to {@code category_wish}, one row per member and season, and drops the column (PDL, owner, 30.10.2026:
 * „Hocu strukturalno ovo da resim, zasto se kategorije ne cuvaju po sezoni vec sad?"). Every other test
 * starts from an empty database, so a migration that lost a wish on the way and one that did not leave the
 * same nothing behind. The shape is {@link TheBasisHasOneHomeTest}'s: what the migration made is undone in
 * one statement, the rows a portal really holds are written, and the migration ITSELF is executed through
 * {@link DatabaseTest#migrationSql}, inside the test's transaction.
 *
 * <p><b>The rows are chosen so that every wrong carrying-over comes out different.</b> A beginner with a
 * membership of 2027, a member of the age category with a membership of 2028 alone (the one who proves the
 * row is written for 2027 whatever seasons he holds, which the inheritance then reads for 2028), a
 * beginner who holds no season at all, and an age-category member written first so that he is not the
 * last row of anything. Writing the row for the season of a membership, writing only the beginners, or
 * writing for 2028 each fail on one of them.
 */
class TheCategoryWishCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	/** The column as V7 wrote it, and nothing of what V81 made: one statement, PostgreSQL drops the rest. */
	private void whatV81Changes() {
		jdbc.execute("drop table category_wish cascade");
		jdbc.execute("alter table competitor add column first_season_2027 boolean not null default false");
		jdbc.execute("alter table competitor alter column first_season_2027 drop default");
	}

	private long competitor(String number, String code, boolean beginner) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, city, country_id, first_season, first_season_2027,"
						+ " active, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1982-02-02', " + A_TOWN + ", null,"
						+ " null, 2027, ?, true, ?, null, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, beginner, code).query(Long.class).single();
	}

	private void heldFree(long member, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, ?, 'feeExempt', 'Vlasnik Probni', timestamptz '2026-10-01 10:00:00+00')")
				.params(member, season).update();
	}

	private List<String> wishes() {
		return db.sql("select c.member_number || ' ' || w.season || ' ' || w.beginner"
						+ " from category_wish w join competitor c on c.id = w.competitor_id"
						+ " order by c.member_number, w.season")
				.query(String.class).list();
	}

	private boolean theColumnStands() {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = 'competitor'"
						+ " and column_name = 'first_season_2027')")
				.query(Boolean.class).single());
	}

	@Test
	void everyMembersWishBecomesHisWishFor2027AndTheColumnGoes() {
		whatV81Changes();

		competitor("001100", "00112233445566b0", false);
		long beginnerOf2027 = competitor("001101", "00112233445566b1", true);
		long onlyOf2028 = competitor("001102", "00112233445566b2", false);
		competitor("001103", "00112233445566b3", true);

		heldFree(beginnerOf2027, 2027);
		heldFree(onlyOf2028, 2028);

		assertThat(theColumnStands())
				.as("the column is not there before the migration, so its going says nothing")
				.isTrue();

		jdbc.execute(migrationSql("81"));

		assertThat(theColumnStands()).as("the wish is still on the member").isFalse();
		assertThat(wishes())
				.as("every member's wish is his wish for 2027, the only season the column ever meant,"
						+ " whatever memberships he holds and whichever way he chose")
				.containsExactly("001100 2027 false", "001101 2027 true", "001102 2027 false",
						"001103 2027 true");
		assertThat(db.sql("select count(*) from membership").query(Integer.class).single())
				.as("a membership went with the column")
				.isEqualTo(2);
	}

	/**
	 * AND NO BODY OF CODE IN THE SCHEMA STILL NAMES IT, the half PostgreSQL does not track: a function
	 * body or a view naming the column would apply cleanly and break on the first row it touched.
	 */
	@Test
	void nothingInTheSchemaStillNamesTheColumn() {
		assertThat(db.sql("select p.proname from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace"
						+ " where ns.nspname = current_schema() and p.prosrc ~ 'first_season_2027'"
						+ " order by 1").query(String.class).list())
				.as("a function still reads or writes the column V81 dropped")
				.isEmpty();
		assertThat(db.sql("select viewname from pg_views where schemaname = current_schema()"
						+ " and definition ~ 'first_season_2027' order by 1").query(String.class).list())
				.as("a view still reads the column V81 dropped")
				.isEmpty();
	}

	/** And the question above can see one, so it is a floor and not a question that answers nothing. */
	@Test
	void aFunctionThatStillNamesTheColumnIsSeen() {
		jdbc.execute("create function still_reads_the_wish() returns text language sql"
				+ " as 'select ''first_season_2027'''");

		assertThat(db.sql("select p.proname from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace"
						+ " where ns.nspname = current_schema() and p.prosrc ~ 'first_season_2027'")
				.query(String.class).list())
				.containsExactly("still_reads_the_wish");
	}
}

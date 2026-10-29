package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V79 DOES TO THE ROWS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists</b> ({@code CLAUDE.md}, section 11): every other case starts from an empty
 * database, so a migration that fails only on rows it did not write is invisible to all of them.
 * Production holds payments, memberships, lines of the book and a trail, and V79 gives every
 * membership a new key as it arrives.
 *
 * <p><b>How the two halves are made</b>, in {@link MembershipCarriedOverTest}'s shape: what V79 made is
 * undone, the rows a portal really holds are written, and then THE MIGRATION ITSELF is executed
 * ({@link DatabaseTest#migrationSql}), all inside the test's transaction.
 *
 * <p><b>Two members, two seasons each, on two different grounds</b>, so a key handed out twice, a row
 * carried for the wrong man or a season dropped is a different answer.
 */
class TheMoneyOutlivesADeletedMemberCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";
	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/**
	 * Everything V79 made, taken away so the migration has it to make again.
	 *
	 * <p>The new column by one statement with {@code cascade}, which takes the surrogate key standing
	 * on it; the two functions it added with {@code cascade}, which takes their five triggers; V33's
	 * trigger body back by V33's own file; and the four keys and NOT NULLs as V16, V22, V38 and V63 left
	 * them, with the pair as the membership's key again.
	 */
	private void whatV79Did() {
		jdbc.execute("alter table membership drop column id cascade");
		jdbc.execute("alter table membership drop constraint membership_one_a_season,"
				+ " drop constraint membership_payment_id_fk");
		jdbc.execute("drop function a_new_row_names_its_member(), a_deleted_account_forgets_his_own_lines()"
				+ " cascade");
		jdbc.execute(migrationSql("33"));

		for (String table : List.of("payment", "membership", "balance_entry", "membership_change")) {
			jdbc.execute("alter table " + table + " alter column competitor_id set not null,"
					+ " drop constraint " + table + "_competitor_fk,"
					+ " add constraint " + table + "_competitor_fk foreign key (competitor_id)"
					+ " references competitor (id) on delete cascade");
		}

		jdbc.execute("alter table membership add constraint membership_pk primary key (competitor_id, season)");
	}

	private void competitor(String number, String code) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Clan', 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true, ?,"
						+ " null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, code).update();
	}

	private static String member(String number) {
		return "(select id from competitor where member_number = '" + number + "')";
	}

	private void paid(String number, int season, String amount) {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency, fee,"
				+ " method, state, recorded_at, recorded_by, recorded_by_name, received) values ("
				+ member(number) + ", " + season + ", '" + season + number + "', " + A_PRICE_ROW + ", "
				+ amount + ", 'RSD', 0, 'ips', 'recorded', " + AN_INSTANT + ", " + AN_ACCOUNT
				+ ", 'Blagajnik Probni', " + amount + ")").update();
		db.sql("insert into membership (competitor_id, season, basis, payment_id) values (" + member(number)
				+ ", " + season + ", 'payment', (select id from payment where reference = '" + season + number
				+ "'))").update();
	}

	private void freed(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by, decided_by_name, decided_at)"
				+ " values (" + member(number) + ", " + season + ", 'feeExempt', " + AN_ACCOUNT
				+ ", 'Blagajnik Probni', " + AN_INSTANT + ")").update();
	}

	/** Every row of the four tables, every column but the one V79 adds, in an order that is not the id's. */
	private List<String> theMoney() {
		return db.sql("select 'payment ' || (to_jsonb(p) - 'id')::text from payment p"
						+ " union all select 'membership ' || (to_jsonb(m) - 'id')::text from membership m"
						+ " union all select 'book ' || (to_jsonb(b) - 'id')::text from balance_entry b"
						+ " union all select 'trail ' || (to_jsonb(t) - 'id')::text from membership_change t"
						+ " order by 1")
				.query(String.class).list();
	}

	@BeforeEach
	void whatThePortalHoldsBeforeV79() {
		whatV79Did();

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Blagajnik', 'Probni',"
				+ " 'blagajnik@primer.rs', (select id from role where code = 'moderator'))").update();

		competitor("009000", "00112233445566d1");
		competitor("009001", "00112233445566d2");

		paid("009000", 2027, "4200.00");
		freed("009000", 2028);
		freed("009001", 2027);
		paid("009001", 2028, "3600.00");

		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
				+ " recorded_by, recorded_by_name) values (" + member("009001") + ", 5, 'EUR', 'overpayment',"
				+ " 2028, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik Probni')").update();
		db.sql("insert into membership_change (competitor_id, season, action, basis_before, basis_after,"
				+ " decided_by, decided_by_name, decided_at) values (" + member("009000") + ", 2029,"
				+ " 'cancelled', 'feeExempt', null, " + AN_ACCOUNT + ", 'Blagajnik Probni', " + AN_INSTANT + ")")
				.update();
	}

	/**
	 * EVERY ROW COMES OUT AS IT WENT IN, AND EVERY MEMBERSHIP HAS A KEY OF ITS OWN.
	 *
	 * <p>A migration whose new key cannot be given to a row already there stops here, on the rows and
	 * not on an empty table; and one that carried a row wrongly changes a line of the list.
	 */
	@Test
	void everyRowStaysAsItWasAndEveryMembershipGetsAKeyOfItsOwn() {
		assertThat(columnsOf("membership"))
				.as("the column is already there before the migration runs, so the undo undid nothing")
				.doesNotContain("id");

		List<String> before = theMoney();

		jdbc.execute(migrationSql("79"));

		assertThat(theMoney()).as("a row changed on the way through the migration").isEqualTo(before);
		assertThat(db.sql("select count(distinct id) || ' of ' || count(*) from membership")
				.query(String.class).single())
				.as("a membership already there has no key, or shares one")
				.isEqualTo("4 of 4");
	}

	/**
	 * AND A MEMBER WHO WAS THERE BEFORE V79 IS DELETED THE NEW WAY: his rows stay, without him, and the
	 * other man's do not move.
	 */
	@Test
	void aMemberFromBeforeTheMigrationLeavesHisMoneyBehindWithoutHim() {
		jdbc.execute(migrationSql("79"));

		db.sql("delete from competitor where member_number = '009000'").update();

		assertThat(db.sql("select 'payment ' || season || ' ' || amount || ' ' || coalesce(reference, '-')"
						+ " from payment where competitor_id is null"
						+ " union all select 'membership ' || season || ' ' || basis from membership"
						+ " where competitor_id is null"
						+ " union all select 'trail ' || season from membership_change where competitor_id is null"
						+ " order by 1").query(String.class).list())
				.containsExactly("membership 2027 payment", "membership 2028 feeExempt",
						"payment 2027 4200.00 -", "trail 2029");
		assertThat(db.sql("select count(*) from membership m join competitor c on c.id = m.competitor_id"
						+ " where c.member_number = '009001'").query(Long.class).single())
				.isEqualTo(2L);
	}

	private List<String> columnsOf(String table) {
		return db.sql("select column_name from information_schema.columns where table_name = ?")
				.param(table).query(String.class).list();
	}
}

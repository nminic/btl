package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
 *
 * <p><b>And a third member whose fee exemption was entered before V35</b>, so it names neither who
 * freed him nor when. Such a row is on QA today (member 1, the owner, whose account administers the
 * portal and so is never deleted through the door), and production has none (measured 30.10.2026).
 * It is written the way history wrote it: V35's pair of checks taken off, the row written, the pair
 * put back {@code not valid}, which is how V35 left every database that already held one.
 *
 * <p><b>THE BOUNDARY THAT ROW SETS, written here because only a migration can move it and this
 * change may not write one.</b> V79 turned the deletion of a member from a cascade into an UPDATE of
 * his membership ({@code competitor_id} set to null), and V35 says in as many words that a
 * {@code not valid} check is still enforced on every update of a row. So deleting such a member now
 * fails on {@code membership_free_of_the_fee_says_when} and nothing of his goes, where before V79 his
 * exemption went with him; through the door that is a 500 for the administrator.
 * {@link #aMemberFreedBeforeV35CannotBeDeletedAndNothingOfHisMoves} holds what the deletion does
 * today, and whoever writes the migration that lets it through turns that case around.
 */
class TheMoneyOutlivesADeletedMemberCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";
	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, active,"
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
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, true, ?,"
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

	/**
	 * A fee exemption as V35 found it: no name and no moment. V35's pair of checks refuses that on any
	 * row written since, so the pair is taken off and put back the way V35 put it.
	 */
	private void freedBeforeV35(String number, int season) {
		jdbc.execute("alter table membership drop constraint membership_free_of_the_fee_says_who,"
				+ " drop constraint membership_free_of_the_fee_says_when");
		db.sql("insert into membership (competitor_id, season, basis) values (" + member(number) + ", "
				+ season + ", 'feeExempt')").update();
		jdbc.execute("alter table membership add constraint membership_free_of_the_fee_says_who"
				+ " check (basis <> 'feeExempt' or decided_by_name is not null) not valid");
		jdbc.execute("alter table membership add constraint membership_free_of_the_fee_says_when"
				+ " check (basis <> 'feeExempt' or decided_at is not null) not valid");
	}

	@BeforeEach
	void whatThePortalHoldsBeforeV79() {
		whatV79Did();

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Blagajnik', 'Probni',"
				+ " 'blagajnik@primer.rs', (select id from role where code = 'moderator'))").update();

		competitor("009000", "00112233445566d1");
		competitor("009001", "00112233445566d2");
		competitor("009002", "00112233445566d3");

		paid("009000", 2027, "4200.00");
		freed("009000", 2028);
		freed("009001", 2027);
		paid("009001", 2028, "3600.00");
		freedBeforeV35("009002", 2027);

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
				.isEqualTo("5 of 5");
	}

	/**
	 * A MEMBER FREED BEFORE V35 CANNOT BE DELETED, AND NOTHING OF HIS MOVES. The class note says why and
	 * what would change it. The other two members stand as they were beside him, so a deletion that took
	 * his exemption anyway, or emptied it, is a different answer.
	 */
	@Test
	void aMemberFreedBeforeV35CannotBeDeletedAndNothingOfHisMoves() {
		jdbc.execute(migrationSql("79"));

		assertThat(db.sql("select count(*) from membership where basis = 'feeExempt' and decided_at is null"
						+ " and competitor_id = " + member("009002")).query(Long.class).single())
				.as("there is no exemption from before V35 to delete, so this measures nothing")
				.isOne();

		List<String> before = theMoney();

		/* The refusal aborts the transaction of the test, so what it left is asked after a rollback to
		   the point taken here. */
		jdbc.execute("savepoint before_the_refusal");
		assertThatThrownBy(() -> db.sql("delete from competitor where member_number = '009002'").update())
				.hasMessageContaining("membership_free_of_the_fee_says_when");
		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(theMoney()).as("a refused deletion moved a row").isEqualTo(before);
		assertThat(db.sql("select count(*) from competitor where member_number = '009002'")
				.query(Long.class).single()).isOne();
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

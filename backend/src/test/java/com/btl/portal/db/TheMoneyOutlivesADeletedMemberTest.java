package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V79 SAYS ABOUT A ROW WITHOUT ITS MEMBER, asked of the schema directly.
 *
 * <p>The owner, 29.10.2026 (PDL): „Brisanje profila više ne sme da briše uplate, članstva ni balans:
 * ostaju bez imena". What a deletion through the door leaves behind is measured in
 * {@code CompetitorWriteApiTest}; this class measures the rules that make that possible and the ones
 * that keep it from being more than that:
 *
 * <ul>
 * <li>a row is never WRITTEN without a member, though one may now be LEFT without one;
 * <li>a written line may forget its member, and never be pointed at somebody else;
 * <li>its name may change only to the owner's word for a deleted member, and only as the account
 * that wrote it is forgotten;
 * <li>an account that goes takes its name off the lines about ITS OWN member, and leaves it on the
 * lines it wrote about somebody else, which is the exception the Privacy Policy names;
 * <li>and a membership left without its member still goes with its receipt.
 * </ul>
 *
 * <p><b>WHAT THE NOT NULL HELD AND NOTHING HOLDS NOW, a boundary rather than an oversight.</b> Before
 * V79 the column refused a null on any statement, an UPDATE included; V79's triggers
 * ({@code a_new_row_names_its_member}) refuse it on INSERT alone, because a deletion arrives at these
 * rows as an UPDATE that empties the key and that one has to go through. So an
 * {@code update payment set competitor_id = null} written by hand on a living member's row is taken
 * today, on {@code payment} and {@code membership}; on {@code balance_entry} and
 * {@code membership_change} the written-once triggers let a key be forgotten by design. Nothing under
 * {@code backend/src/main} writes such an UPDATE (searched 30.10.2026: the only statements that set
 * {@code competitor_id = null} on these four tables are V79's deletion trigger). Holding it would take
 * a trigger that tells the deletion's UPDATE from any other, which is a migration, and this class
 * changes none.
 */
class TheMoneyOutlivesADeletedMemberTest extends DatabaseTest {

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	private static final String HE = "(select id from competitor where member_number = '008000')";
	private static final String SOMEBODY_ELSE = "(select id from competitor where member_number = '008001')";

	private static final String HIS_ACCOUNT = "(select id from account where email = 'clan@primer.rs')";
	private static final String THE_ADMINISTRATION = "(select id from account where email = 'blagajnik@primer.rs')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String ENTRY_COLUMNS = "competitor_id, amount, currency, reason,"
			+ " referred_competitor_id, season, occurred_at, recorded_by, recorded_by_name";

	private static String entry(String values) {
		return "insert into balance_entry (" + ENTRY_COLUMNS + ") values (" + values + ")";
	}

	/**
	 * Two members and two accounts: his, and the administration's, which is nobody's member.
	 *
	 * <p>Three lines in the book and each answers a different question when his account goes: HIS spend
	 * of his own balance, signed with his name; a line on SOMEBODY ELSE's book that his account wrote,
	 * also signed with his name, which is him acting as the administration; and a line on his own book
	 * the administration wrote, signed with ITS name.
	 */
	@BeforeEach
	void twoMembersAndTwoAccounts() {
		competitor("008000", "Clan", "00112233445566c1");
		competitor("008001", "Drugi", "00112233445566c2");

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
				+ " ('Clan', 'Probni', 'clan@primer.rs', (select id from role where code = 'competitor'), "
				+ HE + ")").update();
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Blagajnik', 'Probni',"
				+ " 'blagajnik@primer.rs', (select id from role where code = 'moderator'))").update();

		db.sql(entry(HE + ", -35, 'EUR', 'membership', null, 2028, " + AN_INSTANT + ", " + HIS_ACCOUNT
				+ ", 'Clan Probni'")).update();
		db.sql(entry(SOMEBODY_ELSE + ", 5, 'EUR', 'overpayment', null, 2028, " + AN_INSTANT + ", "
				+ HIS_ACCOUNT + ", 'Clan Probni'")).update();
		db.sql(entry(HE + ", 7, 'EUR', 'overpayment', null, 2029, " + AN_INSTANT + ", "
				+ THE_ADMINISTRATION + ", 'Blagajnik Probni'")).update();

		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency, fee,"
				+ " method, state, recorded_at, recorded_by, recorded_by_name, received) values (" + HE
				+ ", 2027, '2027008000', " + A_PRICE_ROW + ", 4200.00, 'RSD', 0, 'ips', 'recorded', "
				+ AN_INSTANT + ", " + THE_ADMINISTRATION + ", 'Blagajnik Probni', 4200.00)").update();
		db.sql("insert into membership (competitor_id, season, basis, payment_id) values (" + HE
				+ ", 2027, 'payment', (select id from payment where reference = '2027008000'))").update();

		db.sql("insert into membership_change (competitor_id, season, action, basis_before, basis_after,"
				+ " decided_by, decided_by_name, decided_at) values (" + HE + ", 2029, 'cancelled',"
				+ " 'feeExempt', null, " + THE_ADMINISTRATION + ", 'Blagajnik Probni', " + AN_INSTANT + ")")
				.update();
	}

	private void competitor(String number, String first, String code) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, ?, 'Probni', 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true, ?,"
						+ " null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, code).update();
	}

	/** One row of each of the four tables, about nobody, each otherwise a row the table takes. */
	static List<String> rowsAboutNobody() {
		return List.of(
				"insert into payment (competitor_id, season, reference, price_row_id, amount, currency, fee,"
						+ " method, state) values (null, 2028, null, " + A_PRICE_ROW
						+ ", 35, 'EUR', 0, 'paypal', 'awaited')",
				"insert into membership (competitor_id, season, basis, payment_id, decided_by,"
						+ " decided_by_name, decided_at) values (null, 2030, 'feeExempt', null, "
						+ THE_ADMINISTRATION + ", 'Blagajnik Probni', " + AN_INSTANT + ")",
				entry("null, -35, 'EUR', 'membership', null, 2030, " + AN_INSTANT + ", " + THE_ADMINISTRATION
						+ ", 'Blagajnik Probni'"),
				"insert into membership_change (competitor_id, season, action, basis_before, basis_after,"
						+ " decided_by, decided_by_name, decided_at) values (null, 2030, 'cancelled',"
						+ " 'feeExempt', null, " + THE_ADMINISTRATION + ", 'Blagajnik Probni', "
						+ AN_INSTANT + ")");
	}

	/**
	 * A ROW IS NEVER WRITTEN ABOUT NOBODY, which is the half of the NOT NULL V79 took away that is
	 * still true. Each refusal has to name its own table's trigger, so one trigger left off a table is
	 * a case that fails rather than one answered by a neighbour.
	 */
	@ParameterizedTest
	@MethodSource("rowsAboutNobody")
	void aRowAboutNobodyIsRefusedWhenItIsWritten(String insert) {
		String table = insert.substring("insert into ".length(), insert.indexOf(' ', "insert into ".length()));

		assertThatThrownBy(() -> db.sql(insert).update())
				.hasMessageContaining(table + "_names_its_member_when_written");
	}

	/** And the same rows about somebody go in, so the refusal above is about the member and nothing else. */
	@ParameterizedTest
	@MethodSource("rowsAboutNobody")
	void theSameRowAboutSomebodyIsTaken(String insert) {
		assertThat(db.sql(insert.replace("values (null,", "values (" + SOMEBODY_ELSE + ",")).update()).isOne();
	}

	/**
	 * A LINE THAT FORGOT ITS MEMBER IS NOT POINTED AT ANOTHER, in the book and in the trail alike: going
	 * to null is the member being deleted, going to somebody else is his money given to a stranger.
	 */
	@Test
	void aLineInTheBookIsNotPointedAtSomebodyElse() {
		assertThatThrownBy(() -> db.sql("update balance_entry set competitor_id = " + SOMEBODY_ELSE
						+ " where competitor_id = " + HE).update())
				.hasMessageContaining("cannot be made to name somebody else");
	}

	@Test
	void aLineOfTheTrailIsNotPointedAtSomebodyElse() {
		assertThatThrownBy(() -> db.sql("update membership_change set competitor_id = " + SOMEBODY_ELSE)
				.update())
				.hasMessageContaining("cannot be made to name somebody else");
	}

	/**
	 * THE NAME ON A LINE MOVES TO THE OWNER'S WORD ONLY AS ITS ACCOUNT IS FORGOTTEN, and to nothing else.
	 * Three cases rather than three assertions, because the first refusal aborts the transaction.
	 */
	@Test
	void theWordAloneWithoutForgettingTheAccountIsRefused() {
		assertThatThrownBy(() -> db.sql("update balance_entry set recorded_by_name = '<Obrisani član>'"
						+ " where recorded_by = " + HIS_ACCOUNT + " and competitor_id = " + HE).update())
				.hasMessageContaining("cannot be signed by somebody else");
	}

	@Test
	void forgettingTheAccountUnderAnotherNameIsRefused() {
		assertThatThrownBy(() -> db.sql("update balance_entry set recorded_by = null, recorded_by_name = 'Neko'"
						+ " where recorded_by = " + HIS_ACCOUNT + " and competitor_id = " + HE).update())
				.hasMessageContaining("cannot be signed by somebody else");
	}

	@Test
	void forgettingTheAccountUnderTheWordIsTaken() {
		assertThat(db.sql("update balance_entry set recorded_by = null, recorded_by_name = '<Obrisana članica>'"
						+ " where recorded_by = " + HIS_ACCOUNT + " and competitor_id = " + HE).update())
				.isOne();
	}

	/**
	 * WHEN HIS ACCOUNT GOES, ONLY THE LINE ABOUT HIMSELF LOSES HIS NAME. The line he wrote on somebody
	 * else's book is him acting as the administration and keeps his name, which is the exception the
	 * Privacy Policy makes („vaše ime ostaje uz tu odluku"); the administration's line on his book keeps
	 * the administration's name.
	 */
	@Test
	void hisAccountGoingTakesHisNameOffTheLinesAboutHimAndNoOthers() {
		db.sql("delete from account where email = 'clan@primer.rs'").update();

		assertThat(db.sql("select c.member_number || ' ' || e.reason || ' ' || e.recorded_by_name"
						+ " from balance_entry e join competitor c on c.id = e.competitor_id"
						+ " order by c.member_number, e.season").query(String.class).list())
				.containsExactly("008000 membership <Obrisani član>",
						"008000 overpayment Blagajnik Probni",
						"008001 overpayment Clan Probni");
	}

	/**
	 * AND WHEN HE GOES AS WELL, everything of his stays without him and nothing of anybody else's moves.
	 * Done in the order {@code CompetitorWriteApi.takeAway} does it: the account first, because
	 * {@code account_competitor_fk} refuses the other order.
	 */
	@Test
	void hisRowsStayWithoutHimAndWithoutHisNumber() {
		db.sql("delete from account where email = 'clan@primer.rs'").update();
		db.sql("delete from competitor where member_number = '008000'").update();

		assertThat(db.sql("select season || ' ' || amount || ' ' || coalesce(reference, 'no reference')"
						+ " from payment where competitor_id is null").query(String.class).list())
				.containsExactly("2027 4200.00 no reference");
		assertThat(db.sql("select season || ' ' || basis from membership where competitor_id is null")
				.query(String.class).list())
				.containsExactly("2027 payment");
		assertThat(db.sql("select reason || ' ' || amount || ' ' || recorded_by_name from balance_entry"
						+ " where competitor_id is null order by season").query(String.class).list())
				.containsExactly("membership -35.00 <Obrisani član>", "overpayment 7.00 Blagajnik Probni");
		assertThat(db.sql("select decided_by_name from membership_change where competitor_id is null")
				.query(String.class).list())
				.containsExactly("Blagajnik Probni");
		assertThat(db.sql("select amount || ' ' || recorded_by_name from balance_entry where competitor_id = "
						+ SOMEBODY_ELSE).query(String.class).list())
				.containsExactly("5.00 Clan Probni");
	}

	/**
	 * A MEMBERSHIP LEFT WITHOUT ITS MEMBER STILL GOES WITH ITS RECEIPT. The triple key of V22 is not
	 * checked once the member is null, so this is {@code membership_payment_id_fk}'s alone; without it
	 * the row would stay naming a payment that is gone.
	 */
	@Test
	void theMembershipOfADeletedMemberGoesWithItsReceipt() {
		db.sql("delete from account where email = 'clan@primer.rs'").update();
		db.sql("delete from competitor where member_number = '008000'").update();

		assertThat(db.sql("select count(*) from membership where competitor_id is null").query(Long.class)
				.single()).as("there is no membership left without its member to measure").isOne();

		db.sql("delete from payment where competitor_id is null").update();

		assertThat(db.sql("select count(*) from membership where competitor_id is null").query(Long.class)
				.single()).isZero();
	}

	/**
	 * A WOMAN'S ACCOUNT GOING TAKES HER NAME OFF HER OWN LINES WITH THE WORD FOR A WOMAN. The rest of
	 * this class deletes a man, so the word V79 picks by gender was measured on one side only; she is a
	 * member of her own, with an account and a spend of her own balance, and he stays beside her so the
	 * word cannot be read off the wrong row.
	 */
	@Test
	void herAccountGoingSignsHerOwnLineWithTheWordForAWoman() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('008002', 'Clanica', 'Probna',"
				+ " 'F', date '1984-04-04', " + A_TOWN + ", null, null, 2027, false, true, '00112233445566c3',"
				+ " null, '', false, 'none', 'Otac', 'Ulica 2', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.update();
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
				+ " ('Clanica', 'Probna', 'clanica@primer.rs', (select id from role where code = 'competitor'),"
				+ " (select id from competitor where member_number = '008002'))").update();
		db.sql(entry("(select id from competitor where member_number = '008002'), -35, 'EUR', 'membership',"
				+ " null, 2028, " + AN_INSTANT + ", (select id from account where email = 'clanica@primer.rs'),"
				+ " 'Clanica Probna'")).update();

		db.sql("delete from account where email = 'clanica@primer.rs'").update();
		db.sql("delete from account where email = 'clan@primer.rs'").update();

		assertThat(db.sql("select c.member_number || ' ' || e.recorded_by_name"
						+ " from balance_entry e join competitor c on c.id = e.competitor_id"
						+ " where e.reason = 'membership' order by c.member_number").query(String.class).list())
				.containsExactly("008000 <Obrisani član>", "008002 <Obrisana članica>");
	}

	/**
	 * THE WORD IS NOT WRITTEN ON A LINE WHOSE ACCOUNT WAS ALREADY FORGOTTEN. The guard lets the name
	 * change only in the update that takes {@code recorded_by} from somebody to nobody; a line whose
	 * author's account went long ago carries the author's name and a null key, and an update that
	 * writes the word over that name leaves the key null on both sides. Without the half that asks
	 * what the key WAS, that update would be the one rewrite the guard exists to refuse.
	 */
	@Test
	void theWordOverALineWhoseAccountIsAlreadyForgottenIsRefused() {
		db.sql(entry(HE + ", 9, 'EUR', 'overpayment', null, 2030, " + AN_INSTANT + ", null,"
				+ " 'Bivsi Blagajnik'")).update();

		assertThatThrownBy(() -> db.sql("update balance_entry set recorded_by_name = '<Obrisani član>'"
						+ " where recorded_by_name = 'Bivsi Blagajnik'").update())
				.hasMessageContaining("cannot be signed by somebody else");
	}
}

package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V42 DOES TO THE ROWS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V42 turns a PAIR into one amount and one currency, and it has to decide
 * for every line already in the book which of the two halves survives. Every test starts from an empty
 * database, so by the time the suite can look there is nothing to convert: a correct backfill and one
 * that did nothing at all leave the tables equally empty, and deleting both {@code update} statements
 * is green. A migration whose only measurement is „the schema afterwards" is a migration whose data
 * half nobody has run.
 *
 * <p><b>WHAT THE REAL DATABASE HOLDS TODAY, and why the case exists anyway.</b> Measured on QA on
 * 28.09.2026: {@code balance_entry} 0 rows, {@code balance_promise} 0, {@code payment} 0, and the
 * owner said the same from the other side - „Niko nema nikakav balans, jer postojim samo ja u
 * sistemu". So the statements this file measures will run over nothing when the migration lands. They
 * are measured all the same, because „empty today" is not „empty wherever this is ever applied": a
 * developer's database holds whatever his tests last committed, and the rule written on 27.09.2026
 * asks that a migration be measured over rows its own tests did not make.
 *
 * <p><b>How the two halves are made.</b> Everything V42 changed is put back the way it was, the rows a
 * portal really held are written in the OLD shape, and then THE MIGRATION ITSELF is executed - the
 * file Flyway resolved and applied, never a copy of its statements ({@link DatabaseTest#migrationSql}).
 * It all happens inside the test's transaction and is rolled back. The shape is
 * {@link BalanceCarriedOverTest}'s, which is where it was written, and the undoing is ONE
 * {@code drop column ... cascade} rather than a hand-written list of what depends on what.
 *
 * <p><b>AND THE FIXTURE IS BUILT SO THAT EVERY WAY OF GETTING THE BACKFILL WRONG SHOWS UP AS A
 * DIFFERENT NUMBER:</b>
 *
 * <ul>
 * <li>a member in SERBIA and a member ABROAD, because the whole decision is which column his country
 * picks - with one of them the case would pass for a backfill that hard-coded either;
 * <li>the two halves of every row in a ratio of 120, which is what the price list really publishes, so
 * a row that kept the wrong column lands on a number that is out by exactly that;
 * <li>the Serbian member's town taken from the CODEBOOK and the foreign member's TYPED BY HAND,
 * because V7 lets a country arrive by either road and a backfill reading only {@code country_id}
 * would give every codebook member the euro column - which is most of them, and all of the Serbian
 * ones;
 * <li>a {@code balance_promise} row as well as book lines, because it is a second table with the same
 * decision to make and V38 gave it its own pair;
 * <li>and a {@code payment} whose {@code received} nothing recorded, because V42 has to fill that in
 * too and the only honest answer is what the row already meant.
 * </ul>
 */
class BalanceBecameOneAmountTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN_ABROAD = "(select id from place where rank = 1)";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";

	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";

	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** He lives in Serbia, by a town out of the codebook, so his money is dinars. */
	private static final String BILLED_IN_DINARS = "006001";

	/** He lives abroad, by a town he typed by hand, so his money is euro AND his country is typed. */
	private static final String BILLED_IN_EURO = "006002";

	/** Somebody for the dinar member to have brought in, so a referral row has a subject. */
	private static final String BROUGHT_IN_BY_THE_FIRST = "006003";

	private static final String BROUGHT_IN_BY_THE_SECOND = "006004";

	/**
	 * EVERYTHING V42 CHANGED, PUT BACK THE WAY V38 AND V16 HAD IT.
	 *
	 * <p>The columns go in one statement each, which is what makes this safe to leave alone as the
	 * migration grows: PostgreSQL drops the constraints that name a dropped column together with it,
	 * so nothing here has to keep a list of what those are. What DOES have to be named is the
	 * constraints V42 replaced over columns that survive - the vocabulary of reasons and the rule about
	 * which reason names a season - because dropping a column does not touch those.
	 *
	 * <p><b>And the pair comes back with the constraints V38 wrote over it</b>, not as two bare
	 * columns: a fixture whose rows could not have existed under the old schema is a fixture that
	 * measures a state the portal never held.
	 */
	private void whatTheMigrationChanged() {
		jdbc.execute("alter table balance_entry drop column amount cascade,"
				+ " drop column currency cascade");
		jdbc.execute("alter table balance_promise drop column amount cascade,"
				+ " drop column currency cascade");
		jdbc.execute("alter table payment drop column received cascade");

		jdbc.execute("alter table balance_entry drop constraint balance_entry_reason_known");
		jdbc.execute("alter table balance_entry drop constraint balance_entry_what_names_the_season");

		/* WITHOUT A DEFAULT, because V38 gave them none: a column added with one is a column a
		   fixture can forget to write and still pass, which is a weaker table than the portal had. It
		   works because every table here is empty at this point - each case starts from a fresh
		   database and this runs first. */
		jdbc.execute("alter table balance_entry add column eur numeric(10,2) not null,"
				+ " add column rsd numeric(10,2) not null");
		jdbc.execute("alter table balance_promise add column eur numeric(10,2) not null,"
				+ " add column rsd numeric(10,2) not null");

		jdbc.execute("alter table balance_entry"
				+ " add constraint balance_entry_reason_known"
				+ "   check (reason in ('referral', 'membership')),"
				+ " add constraint balance_entry_membership_names_the_season"
				+ "   check ((reason = 'membership') = (season is not null)),"
				+ " add constraint balance_entry_a_referral_adds"
				+ "   check (reason <> 'referral' or (eur > 0 and rsd > 0)),"
				+ " add constraint balance_entry_a_membership_takes"
				+ "   check (reason <> 'membership' or (eur < 0 and rsd < 0))");

		jdbc.execute("alter table balance_promise add constraint balance_promise_not_negative"
				+ " check (eur >= 0 and rsd >= 0)");
	}

	private void competitor(String number, String town, String city, String country,
			String referredBy) {

		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', 'Takmicar',"
						+ " 'M', date '1982-02-02', " + town + ", " + city + ", " + country + ", 2027,"
						+ " false, true, 'payment', ?, " + referredBy + ", '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, "00112233445599" + number.substring(4))
				.update();
	}

	private static String whoIs(String memberNumber) {
		return "(select id from competitor where member_number = '" + memberNumber + "')";
	}

	private void referralOf(String referrer, String broughtIn, String eur, String rsd) {
		db.sql("insert into balance_entry (competitor_id, eur, rsd, reason, referred_competitor_id,"
						+ " occurred_at, recorded_by, recorded_by_name) values (" + whoIs(referrer)
						+ ", ?::numeric, ?::numeric, 'referral', " + whoIs(broughtIn) + ", " + AN_INSTANT
						+ ", " + AN_ACCOUNT + ", 'Prvi Blagajnik')")
				.params(eur, rsd).update();
	}

	private void spendOf(String member, int season, String eur, String rsd) {
		db.sql("insert into balance_entry (competitor_id, eur, rsd, reason, season, occurred_at,"
						+ " recorded_by, recorded_by_name) values (" + whoIs(member)
						+ ", (0 - ?::numeric), (0 - ?::numeric), 'membership', ?, " + AN_INSTANT + ", "
						+ AN_ACCOUNT + ", 'Prvi Blagajnik')")
				.params(eur, rsd, season).update();
	}

	private void promiseTo(String member, int season, String eur, String rsd) {
		db.sql("insert into balance_promise (competitor_id, season, eur, rsd, promised_at) values ("
						+ whoIs(member) + ", ?, ?::numeric, ?::numeric, " + AN_INSTANT + ")")
				.params(season, eur, rsd).update();
	}

	private void recordedPayment(String member, int season, String amount, String fee,
			String currency) {

		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name) values ("
						+ whoIs(member) + ", ?, null, " + A_PRICE_ROW + ", ?::numeric, ?, ?::numeric,"
						+ " 'ips', 'recorded', " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Prvi Blagajnik')")
				.params(season, amount, currency, fee).update();
	}

	/**
	 * FOUR PEOPLE, TWO OF THEM WITH BOOKS, AND THE TWO BOOKS ARE IN TWO DIFFERENT MONIES.
	 *
	 * <p>The amounts are the price list's own, at the rate V4 really publishes: a referral is 5 and
	 * 600, the early period 35 and 4.200. So a backfill that kept the wrong column lands on a number
	 * out by a factor of a hundred and twenty, which is a different number rather than a near miss.
	 */
	@BeforeEach
	void whatThePortalHeldBeforeTheMigration() {
		whatTheMigrationChanged();

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Prvi',"
				+ " 'Blagajnik', 'blagajnik@primer.rs', (select id from role where code = 'moderator'))")
				.update();

		/* HIS TOWN IS OUT OF THE CODEBOOK, so his country arrives through `place_id`. */
		competitor(BILLED_IN_DINARS, A_TOWN_IN_SERBIA, "null", "null", "null");
		competitor(BROUGHT_IN_BY_THE_FIRST, A_TOWN_IN_SERBIA, "null", "null",
				whoIs(BILLED_IN_DINARS));

		/* AND HIS IS TYPED BY HAND, so his country arrives through `country_id` instead - the second
		   of the two roads V7 allows, and the one a backfill reading only that column would get right
		   while getting every codebook member wrong. */
		competitor(BILLED_IN_EURO, "null", "'Zurich'",
				"(select id from country where code <> 'RS' order by code limit 1)", "null");
		competitor(BROUGHT_IN_BY_THE_SECOND, A_TOWN_ABROAD, "null", "null", whoIs(BILLED_IN_EURO));

		referralOf(BILLED_IN_DINARS, BROUGHT_IN_BY_THE_FIRST, "5", "600");
		referralOf(BILLED_IN_EURO, BROUGHT_IN_BY_THE_SECOND, "5", "600");

		/* AND ONE SPEND, so a book is a NET and not a total of what was earned: without it „sum every
		   line" and „sum the referrals" answer alike for everybody here. */
		spendOf(BILLED_IN_DINARS, 2028, "1", "120");

		promiseTo(BILLED_IN_DINARS, 2029, "5", "600");
		promiseTo(BILLED_IN_EURO, 2029, "5", "600");

		recordedPayment(BILLED_IN_DINARS, 2027, "4200", "0", "RSD");
		recordedPayment(BILLED_IN_EURO, 2027, "35", "3", "EUR");
	}

	private void theMigration() {
		jdbc.execute(migrationSql("42"));
	}

	private List<String> linesOf(String memberNumber) {
		return db.sql("select reason || ' ' || amount || ' ' || currency from balance_entry"
						+ " where competitor_id = " + whoIs(memberNumber) + " order by reason")
				.query(String.class).list();
	}

	/**
	 * THE HALF THAT SURVIVES IS THE ONE HIS COUNTRY PICKS, AND THE OTHER IS GONE.
	 *
	 * <p>The dinar member keeps 600 and -120 and the euro member keeps 5, out of rows that held both
	 * numbers. Read as text with the currency on it, so a line that kept the right number in the wrong
	 * money fails by the money rather than passing on the number.
	 */
	@Test
	void everyLineKeepsTheHalfTheMembersCountryPicks() {
		theMigration();

		assertThat(linesOf(BILLED_IN_DINARS))
				.as("a member billed in dinars did not keep his dinar column")
				.containsExactly("membership -120.00 RSD", "referral 600.00 RSD");

		assertThat(linesOf(BILLED_IN_EURO))
				.as("a member billed in euro did not keep his euro column, which is what a backfill"
						+ " reading only `country_id` would get right while getting the other wrong")
				.containsExactly("referral 5.00 EUR");
	}

	/**
	 * AND THE BALANCE THAT COMES OUT OF IT IS A NET IN ONE MONEY.
	 *
	 * <p>Read as the sum filtered by his currency, which is the only way a balance is ever read after
	 * V42, and 480 rather than 600 because of the spend. A backfill that kept both halves would make
	 * this sum meaningless rather than wrong, which is why the case reads it the way the portal does.
	 */
	@Test
	void thebalanceThatComesOutOfItIsAnetInOneMoney() {
		theMigration();

		assertThat(db.sql("select coalesce(sum(amount), 0) from balance_entry"
						+ " where competitor_id = " + whoIs(BILLED_IN_DINARS) + " and currency = 'RSD'")
						.query(java.math.BigDecimal.class).single())
				.isEqualByComparingTo("480.00");

		assertThat(db.sql("select coalesce(sum(amount), 0) from balance_entry"
						+ " where competitor_id = " + whoIs(BILLED_IN_DINARS) + " and currency = 'EUR'")
						.query(java.math.BigDecimal.class).single())
				.as("a line in the money he is not billed in survived the backfill")
				.isEqualByComparingTo("0");
	}

	/**
	 * AND A PROMISE GOES THE SAME WAY, because it is a second table with the same decision to make.
	 *
	 * <p>Both members hold one, so a backfill that converted the book and forgot the promise is caught
	 * here rather than by a route failing months later. Both rows held 5 and 600, so the two answers
	 * differ only by which column was kept.
	 */
	@Test
	void apromiseIsRestatedInTheSameMoneyAsTheBook() {
		theMigration();

		assertThat(db.sql("select amount || ' ' || currency from balance_promise"
						+ " where competitor_id = " + whoIs(BILLED_IN_DINARS)).query(String.class).single())
				.isEqualTo("600.00 RSD");

		assertThat(db.sql("select amount || ' ' || currency from balance_promise"
						+ " where competitor_id = " + whoIs(BILLED_IN_EURO)).query(String.class).single())
				.isEqualTo("5.00 EUR");
	}

	/**
	 * AND A PAYMENT THAT NEVER RECORDED WHAT ARRIVED IS FILLED IN WITH WHAT THE ROW ALREADY MEANT.
	 *
	 * <p>A row written before V42 was written under the rule that the member sends exactly what he was
	 * asked for, and {@code PaymentsDueApi} computes that expectation as {@code amount + fee}. So
	 * {@code amount + fee} is not a guess about such a row, it IS what the row meant - and the fee is
	 * what makes the two members' answers differ: 4.200 and nought in dinars, 35 and 3 in euro, so a
	 * backfill that wrote {@code amount} alone would be right for one of them and wrong for the other.
	 */
	@Test
	void apaymentIsFilledInWithWhatTheRowAlreadyMeant() {
		theMigration();

		assertThat(db.sql("select received || ' ' || currency from payment where competitor_id = "
						+ whoIs(BILLED_IN_DINARS)).query(String.class).single())
				.isEqualTo("4200.00 RSD");

		assertThat(db.sql("select received || ' ' || currency from payment where competitor_id = "
						+ whoIs(BILLED_IN_EURO))
						.query(String.class).single())
				.as("the processing fee was left out of what he was taken to have sent")
				.isEqualTo("38.00 EUR");
	}

	/**
	 * AND THE CONSTRAINTS V42 WRITES REALLY BIND THE ROWS IT CONVERTED, which is the half a backfill
	 * alone would not prove.
	 *
	 * <p>The rows were written under V38's rules and are alive under V42's, so the fact that they
	 * PASSED is already a statement - but only that they do not break anything. This asks the other
	 * direction: a line in a money the portal does not bill in, and a line of nought written under the
	 * new reason, are both refused ON THE CONVERTED TABLE. A migration that added the columns and
	 * forgot the constraints would pass every case above and fail this one.
	 */
	@Test
	void theconstraintsBindTheTableThatWasConverted() {
		theMigration();

		assertThatThrownBy(() -> db.sql("insert into balance_entry (competitor_id, amount, currency,"
						+ " reason, referred_competitor_id, occurred_at, recorded_by_name) values ("
						+ whoIs(BILLED_IN_EURO) + ", 5, 'USD', 'referral', " + whoIs(BILLED_IN_DINARS)
						+ ", " + AN_INSTANT + ", 'Prvi Blagajnik')").update())
				.hasMessageContaining("balance_entry_currency_known");

		assertThatThrownBy(() -> db.sql("insert into balance_entry (competitor_id, amount, currency,"
						+ " reason, occurred_at, recorded_by_name) values ("
						+ whoIs(BILLED_IN_EURO) + ", 0, 'EUR', 'conversion', " + AN_INSTANT
						+ ", 'Prvi Blagajnik')").update())
				.hasMessageContaining("balance_entry_a_conversion_moves_something");
	}
}

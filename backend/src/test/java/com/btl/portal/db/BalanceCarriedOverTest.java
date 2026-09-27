package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V36 DOES TO THE REFERRALS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V36 opens the book of balance with one line for every referral that has
 * already earned its reward. Every test starts from an empty database, so by the time the suite can
 * look there is no referral and no line: a correct carry and a missing one leave {@code balance_entry}
 * equally empty, and deleting the whole {@code insert} is green. A migration whose only measurement
 * is "the schema afterwards" is a migration whose data half nobody has run.
 *
 * <p><b>How the two halves are made.</b> Everything V36 creates is taken away as a fixture, the rows
 * a portal really holds are written, and then THE MIGRATION ITSELF is executed - the file Flyway
 * resolved and applied, never a copy of its statements ({@link DatabaseTest#migrationSql}). It all
 * happens inside the test's transaction and is rolled back. The shape is
 * {@link MembershipCarriedOverTest}'s, which is where it was written.
 *
 * <p><b>AND EVERY VALUE THE CARRY WRITES COMES FROM A SOURCE NOTHING ELSE IN THE FIXTURE
 * DUPLICATES</b>, which is the whole design of the rows below:
 *
 * <ul>
 * <li>the AMOUNT is the referral row of the price list, and it is neither the membership fee
 * (4.200 against 600) nor the amount on any payment in the fixture;
 * <li>the MEMBER CREDITED is the referrer and never the person brought in, and the two are told
 * apart by the referrer having brought in THREE people while nobody brought HIM in;
 * <li>ONE LINE PER PERSON BROUGHT IN and not one per season he stayed, which one of them makes
 * measurable by holding memberships for two seasons;
 * <li>the MOMENT is the payment's, and the EARLIEST of his payments, which the same man makes
 * measurable by his two payments being recognised on two different days;
 * <li>and a referral that has NOT earned is left out, in both of the ways that happens: somebody
 * who registered through a link and never paid, and somebody the association let in free, whom the
 * migration deliberately leaves to the screen that grants the honour.
 * </ul>
 */
class BalanceCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";
	private static final String ANOTHER_ACCOUNT = "(select id from account where email = 'drugi@primer.rs')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/** The man who brought people in, and nobody brought him in. */
	private static final String THE_REFERRER = "003001";

	/** He paid, twice, for two seasons: one line and not two, off the earlier payment. */
	private static final String PAID_FOR_TWO_SEASONS = "003002";

	/** He registered through the link and never paid, so he has earned nobody anything. */
	private static final String NEVER_PAID = "003003";

	/** The association let him in free, which V36 says out loud that it leaves alone. */
	private static final String LET_IN_FREE = "003004";

	/** A second referrer, so that "the referrer" is not the only row that can be credited. */
	private static final String ANOTHER_REFERRER = "003005";

	private static final String BROUGHT_IN_BY_THE_OTHER = "003006";

	/**
	 * Everything V36 creates, taken away so it has something to create and fill.
	 *
	 * <p>The order is forced and a fixture that got it wrong would fail the migration rather than let
	 * it pass quietly, which is the same property {@link MembershipCarriedOverTest} relies on: the
	 * column on {@code membership} names {@code balance_entry}, so it goes before the table does.
	 *
	 * <p>And {@code membership_basis_known} is put back the way V22 wrote it, because V36 drops it and
	 * writes a wider one; left widened, the migration would be running against a schema that already
	 * had half of it.
	 */
	private void whatV36Creates() {
		jdbc.execute("alter table membership drop constraint membership_basis_says_whether_a_book_entry_is_named");
		jdbc.execute("alter table membership drop constraint membership_balance_entry_fk");
		jdbc.execute("alter table membership drop column balance_entry_id");
		jdbc.execute("alter table membership drop constraint membership_basis_known");
		jdbc.execute("alter table membership add constraint membership_basis_known"
				+ " check (basis in ('payment', 'feeExempt'))");
		jdbc.execute("drop table balance_promise");
		jdbc.execute("drop trigger balance_entry_is_written_once on balance_entry");
		jdbc.execute("drop trigger balance_entry_says_who_earned_it on balance_entry");
		jdbc.execute("drop table balance_entry");
		jdbc.execute("drop function a_balance_entry_is_written_once()");
		jdbc.execute("drop function a_reward_says_who_earned_it()");
	}

	private void competitor(String number, String last, String code, String basis, String referredBy) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true, ?, ?,"
						+ " " + referredBy + ", '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, last, basis, code).update();
	}

	private static String broughtBy(String memberNumber) {
		return "(select id from competitor where member_number = '" + memberNumber + "')";
	}

	private void payment(String number, int season, String reference, String recognisedOn,
			String account, String name) {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name) values ("
						+ " (select id from competitor where member_number = ?), ?, ?, " + A_PRICE_ROW
						+ ", 4200.00, 'RSD', 0, 'slip', 'recorded', timestamptz '" + recognisedOn
						+ "', " + account + ", ?)")
				.params(number, season, reference, name).update();
	}

	/**
	 * AND THE SAME ROW WITH THE TRAIL V35 ASKS FOR, for the one basis that owes one.
	 *
	 * <p>`membership_free_of_the_fee_says_who` and `..._says_when` refuse an exemption written
	 * without saying who freed him and when (owner, 27.09.2026). They are `not valid`, which spares
	 * the row a real database already carried and refuses every NEW one - and a fixture writes new
	 * ones. A second method rather than three more parameters on the first, so the rows that have
	 * nothing to do with a trail stay the shape they were.
	 */
	private void membershipFreeOfTheFee(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, payment_id, decided_by,"
						+ " decided_by_name, decided_at) values ("
						+ " (select id from competitor where member_number = ?), ?, 'feeExempt', null, "
						+ AN_ACCOUNT + ", 'Prvi Blagajnik', timestamptz '2026-09-20 09:00:00+00')")
				.params(number, season).update();
	}

	private void membership(String number, int season, String basis, String reference) {
		db.sql("insert into membership (competitor_id, season, basis, payment_id) values ("
						+ " (select id from competitor where member_number = ?), ?, ?, "
						+ (reference == null ? "null" : "(select id from payment where reference = '"
								+ reference + "')") + ")")
				.params(number, season, basis).update();
	}

	/**
	 * What the carry writes, read back by the names people use rather than by row ids.
	 *
	 * <p>Both people on a line are named by their member number and the amount by both its columns,
	 * so a carry that credited the wrong man, wrote the fee instead of the reward or lost a currency
	 * shows up as a different line rather than as a missing one.
	 */
	private List<String> linesWritten() {
		return db.sql("select credited.member_number || ' <- ' || brought.member_number || ' '"
						+ " || e.eur || '/' || e.rsd || ' ' || e.reason || ' '"
						+ " || to_char(e.occurred_at at time zone 'UTC', 'YYYY-MM-DD') || ' '"
						+ " || e.recorded_by_name || ' ' || coalesce(e.season::text, 'no season')"
						+ " from balance_entry e"
						+ " join competitor credited on credited.id = e.competitor_id"
						+ " join competitor brought on brought.id = e.referred_competitor_id"
						+ " order by credited.member_number, brought.member_number")
				.query(String.class).list();
	}

	/**
	 * SIX PEOPLE, TWO OF THEM REFERRERS, AND ONLY THREE REFERRALS HAVE EARNED ANYTHING.
	 *
	 * <p>Two moderators recognise the payments, with different names, so the name the carry freezes
	 * is a value that belongs to one payment and not to the fixture as a whole.
	 */
	@BeforeEach
	void whatThePortalHoldsBeforeV36() {
		whatV36Creates();

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Prvi', 'Blagajnik',"
				+ " 'blagajnik@primer.rs', (select id from role where code = 'moderator'))").update();
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Drugi', 'Blagajnik',"
				+ " 'drugi@primer.rs', (select id from role where code = 'moderator'))").update();

		competitor(THE_REFERRER, "Preporucilac", "00112233445566a1", "payment", "null");
		competitor(ANOTHER_REFERRER, "Drugi Preporucilac", "00112233445566a5", "payment", "null");

		competitor(PAID_FOR_TWO_SEASONS, "Platio Dvaput", "00112233445566a2", "payment",
				broughtBy(THE_REFERRER));
		competitor(NEVER_PAID, "Nikad Platio", "00112233445566a3", "payment", broughtBy(THE_REFERRER));
		competitor(LET_IN_FREE, "Oslobodjen", "00112233445566a4", "feeExempt", broughtBy(THE_REFERRER));
		competitor(BROUGHT_IN_BY_THE_OTHER, "Doveden", "00112233445566a6", "payment",
				broughtBy(ANOTHER_REFERRER));

		/* TWO PAYMENTS FOR ONE MAN, recognised on two different days by two different people, so
		   „one line off the EARLIER payment" is a thing this fixture can tell from „one line off
		   whichever row the planner returned first". */
		payment(PAID_FOR_TWO_SEASONS, 2027, "20271001", "2026-10-02 09:00:00+00", AN_ACCOUNT,
				"Prvi Blagajnik");
		payment(PAID_FOR_TWO_SEASONS, 2028, "20281001", "2027-10-02 09:00:00+00", ANOTHER_ACCOUNT,
				"Drugi Blagajnik");
		membership(PAID_FOR_TWO_SEASONS, 2027, "payment", "20271001");
		membership(PAID_FOR_TWO_SEASONS, 2028, "payment", "20281001");

		payment(BROUGHT_IN_BY_THE_OTHER, 2027, "20271002", "2026-11-05 09:00:00+00", ANOTHER_ACCOUNT,
				"Drugi Blagajnik");
		membership(BROUGHT_IN_BY_THE_OTHER, 2027, "payment", "20271002");

		/* HE IS A MEMBER AND THERE IS NO PAYMENT ANYWHERE, which is what being let in free MEANS. */
		membershipFreeOfTheFee(LET_IN_FREE, 2027);
	}

	private void v36() {
		jdbc.execute(migrationSql("36"));
	}

	/**
	 * ONE LINE PER REFERRAL THAT HAS EARNED, AND EVERY FIELD ON IT IS THE RIGHT SOURCE.
	 *
	 * <p>Two lines and not four: the man who paid twice earns his referrer ONE reward, and the two
	 * who earned nothing earn nothing. The moment on the first line is 2 October 2026 and not 2027,
	 * which is the earlier of his two payments; the name beside it is that payment's moderator and not
	 * the other one.
	 */
	@Test
	void everyReferralThatHasEarnedGetsOneLineAndOnlyOne() {
		v36();

		assertThat(linesWritten()).containsExactly(
				THE_REFERRER + " <- " + PAID_FOR_TWO_SEASONS
						+ " 5.00/600.00 referral 2026-10-02 Prvi Blagajnik no season",
				ANOTHER_REFERRER + " <- " + BROUGHT_IN_BY_THE_OTHER
						+ " 5.00/600.00 referral 2026-11-05 Drugi Blagajnik no season");
	}

	/**
	 * AND WHAT HAS NOT EARNED IS LEFT OUT, in both of the ways that happens.
	 *
	 * <p>PDL, 13.08.2026: „Ko se registrovao preko linka a clanarina mu nikad nije aktivirana, ne
	 * donosi nista." And the one freed of the fee is V36's own named boundary: he has a membership
	 * and no
	 * payment, so there is no account that ever recognised anything for him, and inventing one would
	 * put a name in an immutable book that never did the thing.
	 */
	@Test
	void areferralThatHasNotEarnedIsLeftOut() {
		v36();

		assertThat(db.sql("select count(*) from balance_entry e join competitor c"
						+ " on c.id = e.referred_competitor_id where c.member_number = ?")
						.param(NEVER_PAID).query(Long.class).single())
				.as("somebody who never paid earned his referrer a reward")
				.isZero();

		assertThat(db.sql("select count(*) from balance_entry e join competitor c"
						+ " on c.id = e.referred_competitor_id where c.member_number = ?")
						.param(LET_IN_FREE).query(Long.class).single())
				.as("a membership held free of the fee was carried, which V36 says it leaves to"
						+ " whatever route records that exemption")
				.isZero();
	}

	/**
	 * AND THE BALANCE THAT COMES OUT OF IT IS ONE REWARD PER MAN, not one per season he stayed.
	 *
	 * <p>Read as the sum, which is the only way the balance is ever read: the referrer's man holds
	 * memberships for two seasons, so a carry without {@code distinct on} answers 1.200 here.
	 */
	@Test
	void thebalanceThatComesOutOfTheCarryIsOneRewardPerManBroughtIn() {
		v36();

		assertThat(db.sql("select coalesce(sum(rsd), 0) from balance_entry where competitor_id ="
						+ " (select id from competitor where member_number = ?)")
						.param(THE_REFERRER).query(java.math.BigDecimal.class).single())
				.as("a man who stayed two seasons paid his referrer twice")
				.isEqualByComparingTo("600.00");
	}

	/**
	 * AND THE AMOUNT IS THE PRICE LIST'S, asked of the price list rather than written here.
	 *
	 * <p>So the case does not have to be edited the day the owner changes what a referral is worth,
	 * and so that a carry which read the membership fee instead - 4.200 against 600, both in the
	 * fixture - is caught by the number rather than by a comment.
	 */
	@Test
	void theAmountIsTheReferralRowOfThePriceListAndNotTheFee() {
		v36();

		assertThat(db.sql("select count(*) from balance_entry e, price_row r"
						+ " where r.key = 'referral' and e.eur = r.eur and e.rsd = r.rsd")
						.query(Long.class).single())
				.as("a line was written with an amount that is not what a referral is worth")
				.isEqualTo(db.sql("select count(*) from balance_entry").query(Long.class).single());
	}

	/**
	 * AND WHAT THE BOOK SAYS AFTER THE CARRY CANNOT BE EDITED, which is ADL's „nepromenljive stavke"
	 * and is measured here because the carry is the only thing that has ever written a row this early.
	 */
	@Test
	void whatTheCarryWroteCannotBeEdited() {
		v36();

		assertThat(org.assertj.core.api.Assertions.catchThrowable(() -> db.sql(
						"update balance_entry set rsd = -1").update()))
				.as("a line in the book was rewritten, so ADL's immutable entries are a comment")
				.isNotNull();
	}
}

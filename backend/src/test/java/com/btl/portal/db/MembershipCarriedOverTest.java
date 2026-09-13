package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V22 DOES TO THE ROWS THAT ARE THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V22 turns every recognised payment into a membership of the season it
 * was for. Every test starts from an empty database, so by the time the suite can look there is no
 * payment and no membership: a correct carry and a missing one leave {@code membership} equally
 * empty, and deleting the whole {@code insert} is green. A migration whose only measurement is
 * "the schema afterwards" is a migration whose data half nobody has run.
 *
 * <p><b>How the two halves are made.</b> The table V22 creates is dropped as a fixture, the
 * payments a portal really holds are written, and then THE MIGRATION ITSELF is executed - the file
 * Flyway resolved and applied, not a copy of its statements ({@link DatabaseTest#migrationSql}).
 * Everything happens inside the test's transaction and is rolled back. The shape is
 * {@link LeagueRacesCarriedOverTest}'s, which is where it was written.
 *
 * <p><b>AND EVERY VALUE THE CARRY WRITES COMES FROM A SOURCE NOTHING ELSE IN THE FIXTURE
 * DUPLICATES.</b> That is the whole design of the rows below, because a carry that reads the wrong
 * column is exactly what a green empty table hides:
 *
 * <ul>
 * <li>the SEASON is the season paid FOR, and it is never the year the money arrived in: the man
 * pays on 1 October 2027 for 2028, which is the owner's own example of 13.09.2026, and pays for
 * 2027 in October 2026. Reading {@code recorded_at} gives a different number for both rows;
 * <li>nor is it his {@code first_season}, which is 2014;
 * <li>the BASIS is the word {@code payment} and not {@code competitor.membership_basis}, which for
 * the one man who is carried says {@code feeExempt}. That is not a contrived row: it is the
 * disagreement the whole table exists to end, a per-person column that cannot describe somebody
 * who is let in free one year and pays the next;
 * <li>and the MEMBER is not the first competitor written, nor the only one with a payment.
 * </ul>
 */
class MembershipCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	/**
	 * Everything V22 creates, taken away so it has something to create and fill.
	 *
	 * <p>The table and, after it, the key on {@code payment} that V22 adds purely so the table can
	 * name a receipt together with whose it is. The order is forced: the key cannot go while the
	 * foreign key naming it is still there. A fixture that got this wrong would fail the migration
	 * rather than let it pass quietly, which is the same property {@link LeagueRacesCarriedOverTest}
	 * relies on.
	 */
	private void whatV22Creates() {
		jdbc.execute("drop table membership");
		jdbc.execute("alter table payment drop constraint payment_competitor_season_unique");
	}

	private void competitor(String number, String last, String code, String basis, int firstSeason) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, ?, false, true, ?, ?, null,"
						+ " '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, last, firstSeason, basis, code).update();
	}

	private void payment(String number, int season, String state, String recognisedOn, String reference) {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state, recorded_at, recorded_by, recorded_by_name) values ("
						+ " (select id from competitor where member_number = ?), ?, ?, " + A_PRICE_ROW
						+ ", 4200.00, 'RSD', 0, 'slip', ?, "
						+ (recognisedOn == null ? "null, null, null" : "timestamptz '" + recognisedOn
								+ "', " + AN_ACCOUNT + ", 'Blagajnik Probni'") + ")")
				.params(number, season, reference, state).update();
	}

	/**
	 * What the carry writes, read back by the names people use rather than by row ids.
	 *
	 * <p>The receipt is named by its REFERENCE, the digits off a bank statement, and not by
	 * {@code payment_id}: two sequences that both start at one hand out the same numbers, so an
	 * assertion about the id would be green against a carry that wrote the competitor's id into
	 * that column. The reference belongs to one payment and to nothing else in the schema.
	 */
	private List<String> membershipsWritten() {
		return db.sql("select c.member_number || ' ' || m.season || ' ' || m.basis || ' '"
						+ " || coalesce(p.reference, 'bez uplate') from membership m"
						+ " join competitor c on c.id = m.competitor_id"
						+ " left join payment p on p.id = m.payment_id"
						+ " order by c.member_number, m.season")
				.query(String.class).list();
	}

	/**
	 * FOUR PEOPLE, AND ONLY ONE OF THEM IS A MEMBER OF ANYTHING.
	 *
	 * <p>One is still waiting for his payment to be recognised, one has had his reversed, and one
	 * has no payment at all because the association let him in free. The man who is carried is
	 * written THIRD, holds TWO recognised payments for two different seasons, and carries
	 * {@code feeExempt} in the per-person column of V7 while both his payments make him a payer.
	 */
	@BeforeEach
	void whatThePortalHoldsBeforeV22() {
		whatV22Creates();

		db.sql("insert into account (email, role_id) values ('blagajnik@primer.rs',"
				+ " (select id from role where code = 'moderator'))").update();

		competitor("001001", "Ceka", "00112233445566a1", "payment", 2027);
		competitor("001002", "Storniran", "00112233445566a2", "payment", 2027);
		competitor("001000", "Platisa", "00112233445566a3", "feeExempt", 2014);
		competitor("001003", "Pocascen", "00112233445566a4", "feeExempt", 2027);

		/* Paid in October 2026 for 2027, and in October 2027 for 2028. Neither season is the year
		   the money arrived in, which is what the transfer window means and what makes the two
		   sources tellable apart. */
		payment("001000", 2027, "recorded", "2026-10-05 09:00:00+00", "20271000");
		payment("001000", 2028, "recorded", "2027-10-01 09:00:00+00", "20281000");

		payment("001001", 2028, "awaited", null, null);
		payment("001002", 2028, "reversed", "2027-10-02 09:00:00+00", "20281002");
	}

	/**
	 * EVERY RECOGNISED PAYMENT BECOMES A MEMBERSHIP OF THE SEASON IT WAS PAID FOR, and nothing
	 * else does.
	 *
	 * <p>Both halves in one list. Deleting the {@code insert} from the migration leaves it empty;
	 * widening the carry to every payment brings the man who is waiting and the man whose payment
	 * was reversed in with it; reading the year out of {@code recorded_at} moves both seasons back
	 * one; reading the basis off the member turns both rows into {@code feeExempt}.
	 *
	 * <p><b>And the receipt is carried with it</b>, which is ADL A12: a membership held on a
	 * payment names the payment. Leaving {@code payment_id} out of the carry does not merely lose a
	 * column - {@code membership_basis_says_whether_a_payment_is_named} refuses every row of it and
	 * the migration stops, which is the right way for that to fail.
	 */
	@Test
	void everyRecognisedPaymentBecomesAMembershipOfTheSeasonItWasPaidFor() {
		assertThat(tablesInTheSchema())
				.as("the table is already standing before the migration runs, so what comes out of"
						+ " it below need not have been written by the carry at all")
				.doesNotContain("membership");

		jdbc.execute(migrationSql("22"));

		assertThat(membershipsWritten())
				.as("the recognised payments did not come out of the migration as memberships of"
						+ " the seasons they were paid for, each naming the receipt it came from")
				.containsExactly("001000 2027 payment 20271000", "001000 2028 payment 20281000");
	}

	/**
	 * AND THE THREE PEOPLE WHO ARE NOT MEMBERS OF ANY SEASON, each left out for its own reason.
	 *
	 * <p>Read as a question about people rather than about rows, because that is the question the
	 * table exists to answer and the list above cannot ask it: it names who IS there, and a carry
	 * that wrote a fourth man for a season nobody paid for would still contain those two lines.
	 *
	 * <ul>
	 * <li><b>Waiting.</b> Nobody has recognised it, so there is no member number and no membership:
	 * PDL P8 ties both to the moment the payment is recognised.
	 * <li><b>Reversed.</b> The owner, 11.08.2026: "propada clanski broj, a korisnik postaje
	 * inaktivan za tu sezonu". Carrying it would write down the opposite of what happened.
	 * <li><b>Let in free.</b> He has no payment, and the column that says he is {@code feeExempt}
	 * carries no season, so there is no year to write him down for. The owner decided on
	 * 13.09.2026 that an honorary membership is granted for each season separately, which is a
	 * decision for a screen and not for a migration to guess.
	 * </ul>
	 */
	@Test
	void nobodyElseBecomesAMemberOfAnySeason() {
		jdbc.execute(migrationSql("22"));

		assertThat(db.sql("select c.member_number from competitor c where not exists"
						+ " (select 1 from membership m where m.competitor_id = c.id)"
						+ " order by c.member_number").query(String.class).list())
				.as("somebody who is waiting, somebody whose payment was reversed, or somebody the"
						+ " association let in free came out of the migration a member")
				.containsExactly("001001", "001002", "001003");
	}
}

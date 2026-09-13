package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint the one table of V22 carries, and the three sentences it is made of.
 *
 * <p>Membership is a fact about a SEASON. Until V22 the schema had no way to answer "in which
 * seasons was this person a member": {@code competitor.active} is one boolean with no season in
 * it, and {@code payment} exists only for the people who pay, because
 * {@code payment_amount_positive} refuses a row of nought.
 *
 * <p><b>One answer per person per season</b>, which is the primary key and not a unique constraint
 * beside a surrogate.
 *
 * <p><b>The basis is one of exactly two words</b>, and that is not a list written down here: both
 * rules are taken out of the catalogue and PostgreSQL is asked to judge each word against the
 * other rule, which is the shape {@link PaymentStatesMatchTheSchemaTest} uses. Comparing two
 * written expressions instead was measured to have a hole: a value with any character that is not
 * a letter appeared on neither side of the comparison, so {@code 'fee-waived'} added to one of the
 * two rules alone passed the whole suite.
 *
 * <p><b>And a membership names the receipt behind it</b> (ADL A12, 03.08.2026): "aktivacija nosi
 * polje osnova i vezu ka uplati koja sme biti prazna samo kad je osnov pocasni". Both directions
 * of that are one constraint, and the receipt it names has to be HIS, for THAT season, which the
 * composite key says instead of a service remembering to check.
 */
class MembershipConstraintsTest extends DatabaseTest {

	record Violation(String constraint, String evidence, String sql) {

		static Violation of(String constraint, String sql) {
			return new Violation(constraint, constraint, sql);
		}

		static Violation notNull(String constraint, String column, String sql) {
			return new Violation(constraint, "column \"" + column + "\"", sql);
		}

		@Override
		public String toString() {
			return constraint + ": " + sql;
		}
	}

	/** The one table V22 adds. */
	static final List<String> TABLES = List.of("membership");

	/** Every literal in a rule, which is what an enumerated rule is made of. */
	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";
	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	private static final String A_MEMBER = "(select id from competitor where member_number = '001000')";
	private static final String ANOTHER_MEMBER =
			"(select id from competitor where member_number = '001001')";

	/* The receipts, named by the reference a bank statement carries rather than by a row number:
	   which payment a case means has to be readable off the case. */
	private static final String HIS_2027 = "(select id from payment where reference = '20271000')";
	private static final String HIS_2029 = "(select id from payment where reference = '20291000')";
	private static final String ANOTHER_MEMBERS_2027 =
			"(select id from payment where reference = '20271001')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS = "competitor_id, season, basis, payment_id";

	private static String membership(String values) {
		return "insert into membership (" + COLUMNS + ") values (" + values + ")";
	}

	/** His own receipt, for the year it was paid for. */
	private static final String GOOD_ON_HIS_OWN_RECEIPT =
			membership(A_MEMBER + ", 2027, 'payment', " + HIS_2027);

	/**
	 * Let in free, another season, and no receipt to name.
	 *
	 * <p>A different season from the one the probe holds for him, so accepting it says something:
	 * the key refuses a second row for ONE season and not a second season.
	 */
	private static final String GOOD_LET_IN_FREE = membership(A_MEMBER + ", 2028, 'feeExempt', null");

	/** And somebody else, on his own receipt, for the season the first man is let in free. */
	private static final String GOOD_ANOTHER_MEMBER =
			membership(ANOTHER_MEMBER + ", 2027, 'payment', " + ANOTHER_MEMBERS_2027);

	/**
	 * Two members, three recognised receipts, and one membership standing on one of them.
	 *
	 * <p>Two members rather than one on purpose: every case below that reads the table back would
	 * be satisfied by a cascade that emptied it if his were the only row in it. Three receipts
	 * because the composite key has two ways to be wrong - another member's receipt and another
	 * season's - and a fixture with one receipt can express neither.
	 *
	 * <p>The member who holds the membership carries {@code feeExempt} in the per-person column of
	 * V7 while his membership stands on a payment. That is the disagreement the table exists to
	 * end, and here it keeps the two columns from being two sources of one value.
	 */
	@BeforeEach
	void probe() {
		competitor("001000", "Probni", "Clan", "00112233445566f1", "feeExempt");
		competitor("001001", "Drugi", "Clan", "00112233445566f2", "payment");

		db.sql("insert into account (email, role_id) values ('blagajnik@primer.rs',"
				+ " (select id from role where code = 'moderator'))").update();

		payment("001000", 2027, "20271000");
		payment("001000", 2029, "20291000");
		payment("001001", 2027, "20271001");

		db.sql(membership(A_MEMBER + ", 2029, 'payment', " + HIS_2029)).update();
	}

	private void competitor(String number, String first, String last, String code, String basis) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, ?, ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true, ?, ?,"
						+ " null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, basis, code).update();
	}

	/** A recognised payment, because an awaited one is not a membership of anything. */
	private void payment(String number, int season, String reference) {
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount,"
						+ " currency, fee, method, state, recorded_at, recorded_by, recorded_by_name)"
						+ " values ((select id from competitor where member_number = ?), ?, ?, "
						+ A_PRICE_ROW + ", 4200.00, 'RSD', 0, 'slip', 'recorded', " + AN_INSTANT
						+ ", " + AN_ACCOUNT + ", 'Blagajnik Probni')")
				.params(number, season, reference).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("membership_competitor_id_not_null", "competitor_id",
						membership("null, 2027, 'feeExempt', null")),
				/* A membership for somebody who is not there. */
				Violation.of("membership_competitor_fk",
						membership("999999, 2027, 'feeExempt', null")),

				Violation.notNull("membership_season_not_null", "season",
						membership(A_MEMBER + ", null, 'feeExempt', null")),
				/* The league begins in 2027 and there is no season before it. */
				Violation.of("membership_season_not_before_the_league",
						membership(A_MEMBER + ", 2026, 'feeExempt', null")),

				Violation.notNull("membership_basis_not_null", "basis",
						membership(A_MEMBER + ", 2027, null, null")),
				Violation.of("membership_basis_known",
						membership(A_MEMBER + ", 2027, 'honorary', null")),

				/* ONE ANSWER PER PERSON PER SEASON, and the row here differs from the one already
				   standing in BOTH of the other columns. That is the whole strength of the case: a
				   key widened to take the basis or the receipt in - which is the shape somebody
				   reaches for the moment he wants to record a change of basis - would still refuse
				   an identical row and let this one through, so an identical row would measure
				   nothing. */
				Violation.of("membership_pk", membership(A_MEMBER + ", 2029, 'feeExempt', null")),

				/* BOTH HALVES OF A12, and they fail differently. Held on a payment and naming
				   none is the member who appears in the report of takings with nothing behind
				   him; held on a decision and naming one is a receipt counted for a membership
				   nobody paid for. The receipt in the second row is his own and for that season,
				   so the composite key is satisfied and this is the only thing it breaks. */
				Violation.of("membership_basis_says_whether_a_payment_is_named",
						membership(A_MEMBER + ", 2027, 'payment', null")),
				Violation.of("membership_basis_says_whether_a_payment_is_named",
						membership(A_MEMBER + ", 2027, 'feeExempt', " + HIS_2027)),

				/* AND THE RECEIPT IS HIS, FOR THAT SEASON. Three ways to be wrong and all three
				   are the same key: a receipt that is not there at all, another member's receipt,
				   and his own receipt for another year. */
				Violation.of("membership_payment_fk",
						membership(A_MEMBER + ", 2027, 'payment', 999999")),
				Violation.of("membership_payment_fk",
						membership(A_MEMBER + ", 2027, 'payment', " + ANOTHER_MEMBERS_2027)),
				Violation.of("membership_payment_fk",
						membership(A_MEMBER + ", 2027, 'payment', " + HIS_2029)));
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/** The floor under the list above, read out of the database. */
	@Test
	void everyConstraintOnTheMembershipHasARowThatBreaksIt() {
		String tables = TABLES.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));
		String relations = " = any (array[" + tables + "]::regclass[])";

		List<String> declared = db
				.sql("select con.conname from pg_constraint con where con.conrelid" + relations
						+ " union all "
						+ "select index.relname from pg_index idx join pg_class index on index.oid = idx.indexrelid"
						+ " where idx.indrelid" + relations + " and idx.indisunique"
						+ " and not exists (select 1 from pg_constraint own where own.conindid = idx.indexrelid)")
				.query(String.class)
				.list();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	static List<String> legitimateRows() {
		return List.of(GOOD_ON_HIS_OWN_RECEIPT, GOOD_LET_IN_FREE, GOOD_ANOTHER_MEMBER);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/** What the schema itself says about a basis, in its own words. */
	private String ruleFor(String constraint) {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = ?")
				.param(constraint).query(String.class).single();
	}

	/** Whether PostgreSQL, applying that rule to that column, would take this word. */
	private boolean ruleTakes(String constraint, String column, String basis) {
		String rule = ruleFor(constraint);
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		return Boolean.TRUE.equals(db.sql("select " + condition.replace(column, "?::text"))
				.param(1, basis).query(Boolean.class).single());
	}

	private Set<String> basesNamedIn(String constraint) {
		return SPELLED_OUT.matcher(ruleFor(constraint)).results()
				.map(one -> one.group(1)).collect(Collectors.toSet());
	}

	@Test
	void bothRulesAboutABasisAreStillThere() {
		assertThat(ruleFor("membership_basis_known"))
				.as("the membership has no rule about the basis, so nothing below compares anything")
				.startsWith("CHECK").contains("basis");
		assertThat(ruleFor("competitor_membership_basis_known"))
				.as("V7 has no rule about the basis, so nothing below compares anything")
				.startsWith("CHECK").contains("membership_basis");
		assertThat(basesNamedIn("competitor_membership_basis_known"))
				.as("V7 names fewer than two bases, so the loops below assert almost nothing")
				.hasSize(2);
	}

	/**
	 * EVERY BASIS V7 NAMES, THIS TABLE TAKES, and PostgreSQL is the one asked.
	 *
	 * <p>The words are read off the rule the catalogue hands back and each is put to the OTHER
	 * rule, rather than two written expressions being compared to each other. Measured on
	 * 13.09.2026, which is why it is written this way: a comparison of the words alone went
	 * through {@code '([a-zA-Z]+)'}, so {@code 'fee-waived'} added to one of the two rules matched
	 * on neither side and the suite stayed green while the same fact had two vocabularies.
	 */
	@Test
	void everyBasisTheCompetitorNamesTheMembershipTakes() {
		for (String basis : basesNamedIn("competitor_membership_basis_known")) {
			assertThat(ruleTakes("membership_basis_known", "basis", basis))
					.as("V7 lets a member be held on the basis '%s' and this table refuses it", basis)
					.isTrue();
		}
	}

	/** And the other direction, which is the one a rule widened here alone gets wrong. */
	@Test
	void everyBasisTheMembershipNamesTheCompetitorTakes() {
		for (String basis : basesNamedIn("membership_basis_known")) {
			assertThat(ruleTakes("competitor_membership_basis_known", "membership_basis", basis))
					.as("this table takes the basis '%s' and V7 refuses it, so the same fact has"
							+ " two vocabularies", basis)
					.isTrue();
		}
	}

	/**
	 * And the rules are rules: a word nobody named is refused by both.
	 *
	 * <p>Without it the two cases above would pass against a rule that takes anything at all, and
	 * a floor that accepts everything holds nothing up. The word is the one the hole was measured
	 * with, so it is also the case that fails first if the comparison ever goes back to matching
	 * letters only.
	 */
	@Test
	void aBasisNobodyNamedIsRefusedByBoth() {
		assertThat(ruleTakes("membership_basis_known", "basis", "fee-waived"))
				.as("this table would hold a basis nothing in the portal can produce")
				.isFalse();
		assertThat(ruleTakes("competitor_membership_basis_known", "membership_basis", "fee-waived"))
				.as("V7 would hold a basis nothing in the portal can produce")
				.isFalse();
	}

	/**
	 * AND THE SEASON BOUNDARY IS THE ONE THE PAYMENT ALREADY CARRIES, word for word.
	 *
	 * <p>The league starts in 2027 (PDL P8) and V16 says so about a payment in exactly these
	 * characters. Both sides are what the catalogue renders rather than what a file says, and
	 * comparing them whole means a boundary lowered on either, to any year at all, fails here.
	 */
	@Test
	void theSeasonBoundaryIsTheOneThePaymentAlreadyCarries() {
		assertThat(ruleFor("membership_season_not_before_the_league"))
				.as("the season a membership may name and the season a payment may name are the"
						+ " same boundary, and they have stopped agreeing")
				.isEqualTo(ruleFor("payment_season_not_before_the_league"));
	}

	/**
	 * ONE MAN MAY BE A PAYER ONE SEASON AND LET IN FREE THE NEXT, which is the sentence the owner
	 * gave on 13.09.2026 as the reason {@code competitor.membership_basis} is the wrong shape:
	 * it stands per person, so it cannot say this at all.
	 */
	@Test
	void oneManMayHoldTwoSeasonsOnDifferentBases() {
		db.sql(GOOD_LET_IN_FREE).update();

		assertThat(db.sql("select m.season || ' ' || m.basis || ' ' || coalesce(p.reference, 'bez uplate')"
						+ " from membership m"
						+ " join competitor c on c.id = m.competitor_id"
						+ " left join payment p on p.id = m.payment_id"
						+ " where c.member_number = '001000' order by m.season")
				.query(String.class).list())
				.as("the same man could not hold two seasons on two bases, each with the evidence"
						+ " A12 asks for")
				.containsExactly("2028 feeExempt bez uplate", "2029 payment 20291000");
	}

	/**
	 * A MEMBERSHIP GOES WITH THE PERSON, and the two cascades out of him do not fight each other.
	 *
	 * <p>This is the case the deletion rule towards {@code payment} was chosen against. Deleting a
	 * member cascades into {@code payment} and into {@code membership} in the same statement, and
	 * the membership standing here names one of those payments: a RESTRICT towards the receipt
	 * would make this delete succeed or fail depending on which cascade PostgreSQL walked first.
	 *
	 * <p>Written as a deletion that SUCCEEDS and leaves the other man's row standing. Both halves
	 * are the claim: without the cascade the delete is refused outright, and an assertion that the
	 * table is empty afterwards would be satisfied by a cascade that took everybody.
	 */
	@Test
	void theMembershipGoesWithTheMember() {
		db.sql(GOOD_ANOTHER_MEMBER).update();

		assertThat(db.sql("select count(*) from membership").query(Long.class).single())
				.as("there are not two memberships standing on two different members, so what the"
						+ " deletion below leaves behind says nothing about whose rows it took")
				.isEqualTo(2L);

		assertThat(db.sql("delete from competitor where member_number = '001000'").update())
				.as("a member who holds a membership naming one of his own receipts can no longer"
						+ " be deleted at all")
				.isOne();

		assertThat(db.sql("select c.member_number from membership m"
						+ " join competitor c on c.id = m.competitor_id").query(String.class).list())
				.as("the deletion took the wrong memberships with it")
				.containsExactly("001001");
	}

	/**
	 * AND IT GOES WITH THE RECEIPT IT STANDS ON, which is the other end of the same rule.
	 *
	 * <p>A payment is never deleted on its own in the portal - a reversal is a state and not a
	 * deletion (V16) - so this is what the rule means rather than what anybody will do: evidence
	 * and the membership it evidences go together. A {@code set null} here would leave a row held
	 * on a payment naming none, which is exactly what A12 forbids and what
	 * {@code membership_basis_says_whether_a_payment_is_named} would then refuse, turning the
	 * deletion into a failure with a confusing name on it.
	 */
	@Test
	void theMembershipGoesWithTheReceipt() {
		db.sql(GOOD_ANOTHER_MEMBER).update();

		assertThat(db.sql("delete from payment where reference = '20291000'").update())
				.as("the receipt the probe's membership stands on was not there to delete")
				.isOne();

		assertThat(db.sql("select c.member_number || ' ' || m.season from membership m"
						+ " join competitor c on c.id = m.competitor_id").query(String.class).list())
				.as("deleting one receipt did not take its membership, or took somebody else's")
				.containsExactly("001001 2027");

		assertThat(db.sql("select count(*) from competitor where member_number = '001000'")
				.query(Long.class).single())
				.as("deleting a receipt took the member himself")
				.isOne();
	}
}

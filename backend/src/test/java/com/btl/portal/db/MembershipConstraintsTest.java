package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashSet;
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

	@Autowired
	JdbcTemplate jdbc;

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

	/** V38's fifth column, used only by the rows that are about it. */
	private static final String COLUMNS_WITH_THE_BOOK = COLUMNS + ", balance_entry_id";

	/** A line in the book of balance that really is his, for a season he is not yet a member of. */
	private static final String HIS_BOOK_ENTRY =
			"(select id from balance_entry where competitor_id = " + A_MEMBER + " and season = 2030)";

	private static String membership(String values) {
		return "insert into membership (" + COLUMNS + ") values (" + values + ")";
	}

	/**
	 * THE SAME ROW WITH THE TRAIL V35 ASKS FOR, and a second helper rather than four more
	 * columns on the first one.
	 *
	 * <p>Every case above this line measures something that has nothing to do with the trail -
	 * the key, the receipt, the season, the word the basis is spelt with - and rewriting all of
	 * them to carry three more values would have changed what they are made of in order to add
	 * a column they never ask about. So the cases that must name a trail name one, and the rest
	 * are untouched.
	 *
	 * <p><b>What this helper being NECESSARY says about V35, which is worth writing down:</b>
	 * `membership_free_of_the_fee_says_who` makes every row that frees somebody of the fee
	 * without saying who did it ILLEGAL, and that included several fixtures here which had been
	 * legal since V22. They were not wrong then and they are not wrong now; the rule they break
	 * is new, and it is the owner's of 27.09.2026. A fixture that could still write an exemption
	 * with no trail would mean the schema was not carrying his decision at all.
	 *
	 * @param values the four columns {@link #COLUMNS} names, and then who and when
	 */
	private static String withATrail(String values) {
		return "insert into membership (" + COLUMNS + ", decided_by, decided_by_name, decided_at)"
				+ " values (" + values + ")";
	}

	/** Who entered it and when, the shape V35 takes: an account that is there and an instant. */
	private static final String A_TRAIL = AN_ACCOUNT + ", 'Blagajnik Probni', " + AN_INSTANT;

	/**
	 * AND THE SAME ROW NAMING THE LINE IN THE BOOK THAT PAID FOR IT (V38), which is the third basis.
	 *
	 * <p><b>It carries the trail of {@link #withATrail} as well, and that is not tidiness.</b> One of
	 * the rows below holds {@code feeExempt} while naming a book entry - it has to, because what it
	 * measures is that a basis which is NOT {@code balance} may not name one - and since V35 an
	 * exemption written without a trail is refused. Without these three columns here that row would
	 * break three constraints and PostgreSQL would report one of them, so the case would name a thing
	 * it is not about.
	 *
	 * @param values the four columns {@link #COLUMNS} names, then the book entry, then who and when
	 */
	private static String membershipNaming(String values) {
		return "insert into membership (" + COLUMNS_WITH_THE_BOOK
				+ ", decided_by, decided_by_name, decided_at) values (" + values + ")";
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
	private static final String GOOD_LET_IN_FREE =
			withATrail(A_MEMBER + ", 2028, 'feeExempt', null, " + A_TRAIL);

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

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', 'blagajnik@primer.rs',"
				+ " (select id from role where code = 'moderator'))").update();

		payment("001000", 2027, "20271000");
		payment("001000", 2029, "20291000");
		payment("001001", 2027, "20271001");

		db.sql(membership(A_MEMBER + ", 2029, 'payment', " + HIS_2029)).update();

		/* ONE LINE IN THE BOOK OF BALANCE, HIS, naming a season he holds no membership for. The
		   season matters: a row that named 2029 would let the legitimate case below be satisfied by
		   the membership already standing there instead of by the one it inserts. */
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season, occurred_at,"
						+ " recorded_by, recorded_by_name) values (" + A_MEMBER + ", -5, 'EUR',"
						+ " 'membership', 2030, " + AN_INSTANT + ", " + AN_ACCOUNT + ","
						+ " 'Blagajnik Probni')")
				.update();
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
						+ A_PRICE_ROW + ", 4200.00, 'RSD', 0, 'ips', 'recorded', " + AN_INSTANT
						+ ", " + AN_ACCOUNT + ", 'Blagajnik Probni')")
				.params(number, season, reference).update();
	}

	/**
	 * HELD ON AN EXEMPTION AND NAMING A LINE IN THE BOOK, which only `balance` may do.
	 *
	 * <p><b>A constant rather than the same row written twice, and a mutation is why.</b> It is used
	 * by the violations list AND by the case that claims it breaks exactly one constraint. Written out
	 * in both places, taking the trail off the list left the case untouched and the whole file green,
	 * so the claim could not see the thing it is about.
	 *
	 * <p>The trail is what makes it break ONE constraint: since V35 an exemption without one breaks
	 * three, and PostgreSQL names whichever it reaches first.
	 */
	private static final String NAMES_A_BOOK_ENTRY_ON_THE_WRONG_BASIS =
			membershipNaming(A_MEMBER + ", 2030, 'feeExempt', null, " + HIS_BOOK_ENTRY + ", " + A_TRAIL);

	static List<Violation> violations() {
		return List.of(
				/* THESE FOUR CARRY A TRAIL, and not for tidiness: without one they would break
				   `membership_free_of_the_fee_says_who` as well as the constraint each is about,
				   and a row that breaks two says nothing about either - PostgreSQL reports one of
				   them and the case would be measuring whichever it happened to report. */
				Violation.notNull("membership_competitor_id_not_null", "competitor_id",
						withATrail("null, 2027, 'feeExempt', null, " + A_TRAIL)),
				/* A membership for somebody who is not there. */
				Violation.of("membership_competitor_fk",
						withATrail("999999, 2027, 'feeExempt', null, " + A_TRAIL)),

				Violation.notNull("membership_season_not_null", "season",
						withATrail(A_MEMBER + ", null, 'feeExempt', null, " + A_TRAIL)),
				/* The league begins in 2027 and there is no season before it. */
				Violation.of("membership_season_not_before_the_league",
						withATrail(A_MEMBER + ", 2026, 'feeExempt', null, " + A_TRAIL)),

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
				Violation.of("membership_pk",
						withATrail(A_MEMBER + ", 2029, 'feeExempt', null, " + A_TRAIL)),

				/* BOTH HALVES OF A12, and they fail differently. Held on a payment and naming
				   none is the member who appears in the report of takings with nothing behind
				   him; held on a decision and naming one is a receipt counted for a membership
				   nobody paid for. The receipt in the second row is his own and for that season,
				   so the composite key is satisfied and this is the only thing it breaks. */
				Violation.of("membership_basis_says_whether_a_payment_is_named",
						membership(A_MEMBER + ", 2027, 'payment', null")),
				Violation.of("membership_basis_says_whether_a_payment_is_named",
						withATrail(A_MEMBER + ", 2027, 'feeExempt', " + HIS_2027 + ", " + A_TRAIL)),

				/* AND THE RECEIPT IS HIS, FOR THAT SEASON. Three ways to be wrong and all three
				   are the same key: a receipt that is not there at all, another member's receipt,
				   and his own receipt for another year. */
				Violation.of("membership_payment_fk",
						membership(A_MEMBER + ", 2027, 'payment', 999999")),
				Violation.of("membership_payment_fk",
						membership(A_MEMBER + ", 2027, 'payment', " + ANOTHER_MEMBERS_2027)),
				Violation.of("membership_payment_fk",
						membership(A_MEMBER + ", 2027, 'payment', " + HIS_2029)),

				/* V35, AND THE FOUR BREAK IN FOUR DIFFERENT DIRECTIONS.
				   Each row below breaks exactly ONE of them: the first names the moment and not
				   the person, the second the person and not the moment, so neither can be
				   satisfied by the other's half. That matters here more than usual, because a
				   single row missing both would break two constraints and prove nothing about
				   which. */
				Violation.of("membership_free_of_the_fee_says_who",
						withATrail(A_MEMBER + ", 2028, 'feeExempt', null, null, null, " + AN_INSTANT)),
				Violation.of("membership_free_of_the_fee_says_when",
						withATrail(A_MEMBER + ", 2028, 'feeExempt', null, " + AN_ACCOUNT
								+ ", 'Blagajnik Probni', null")),

				/* A blank name is a trail that looks like one and names nobody. `says_who` is
				   satisfied by it - a blank string is not null - so this row breaks the other
				   constraint alone, which is the whole reason both exist. */
				Violation.of("membership_decided_by_name_not_blank",
						withATrail(A_MEMBER + ", 2028, 'feeExempt', null, " + AN_ACCOUNT + ", '   ', "
								+ AN_INSTANT)),

				/* AND THE OTHER DIRECTION, which is what stops these columns becoming a second
				   home for what `payment` already says. The receipt is HIS and for THAT season, so
				   the composite key and `membership_basis_says_whether_a_payment_is_named` are
				   both satisfied and the trail beside it is the only thing wrong. */
				Violation.of("membership_on_a_payment_names_no_decision",
						withATrail(ANOTHER_MEMBER + ", 2027, 'payment', " + ANOTHER_MEMBERS_2027
								+ ", " + A_TRAIL)),

				/* AND THE ACCOUNT IN THE TRAIL HAS TO BE AN ACCOUNT. The name and the moment are
				   both there, so the two `free_of_the_fee` constraints are satisfied and this is
				   the only thing the row breaks - which is what makes it a case about the key
				   rather than about the trail being filled in.

				   THIS ROW WAS NOT WRITTEN FROM MEMORY. It was written because
				   `everyConstraintOnTheMembershipHasARowThatBreaksIt` refused the commit without
				   it: V35 adds four checks and a KEY, and the floor named the fifth one back. It
				   is worth recording that the floor found it rather than the author, because that
				   is the whole reason the floor compares in both directions. */
				Violation.of("membership_decided_by_fk",
						withATrail(A_MEMBER + ", 2028, 'feeExempt', null, 999999,"
								+ " 'Blagajnik Probni', " + AN_INSTANT)),

				/* AND BOTH HALVES OF THE SAME SENTENCE ABOUT THE BOOK (V38), which arrived with the
				   third basis. Held on the balance and naming no line is the member let in with nothing
				   anywhere to say what paid for him, which is what ADL's „aktivacija nosi dokaz" refuses;
				   held on something else and naming a line is a withdrawal counted against a season it
				   did not buy.

				   EACH OF THE THREE BREAKS EXACTLY ONE CONSTRAINT, and since V35 that costs more than
				   it did. For 'balance' with no receipt, V22's (basis = 'payment') and (payment_id is
				   not null) are both false and agree, and no trail is owed because the basis is not an
				   exemption. The middle row is the one V35 changed: 'feeExempt' naming a line owes a
				   trail, so it carries one - without it the row would break `..._says_who`,
				   `..._says_when` AND the sentence it is actually about, and PostgreSQL would name
				   whichever it reached first. */
				Violation.of("membership_basis_says_whether_a_book_entry_is_named",
						membershipNaming(A_MEMBER + ", 2030, 'balance', null, null, null, null, null")),
				Violation.of("membership_basis_says_whether_a_book_entry_is_named",
						NAMES_A_BOOK_ENTRY_ON_THE_WRONG_BASIS),

				/* And the line it names has to be there. */
				Violation.of("membership_balance_entry_fk",
						membershipNaming(A_MEMBER + ", 2030, 'balance', null, 999999, null, null, null")));
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/**
	 * AND THE ROW THAT NAMES A BOOK ENTRY ON THE WRONG BASIS BREAKS THAT AND NOTHING ELSE.
	 *
	 * <p><b>This case exists because a mutation SURVIVED without it.</b> The row above holds
	 * {@code feeExempt} while naming a book entry, and since V35 an exemption owes a trail - so
	 * without one it breaks THREE constraints. Taking its trail away left the whole file green,
	 * because {@code theConstraintRejectsTheRowThatBreaksIt} asks only that the refusal MENTIONS the
	 * constraint it is about, and PostgreSQL happened to reach that one first. The comment beside the
	 * row claimed „each of the three breaks exactly one constraint" and nothing measured it.
	 *
	 * <p>So the claim is measured here, in the one direction that can fail: the refusal must NOT name
	 * either of the two V35 puts on an exemption. Which constraint PostgreSQL reports when a row
	 * breaks several is its business and not something to assert; that it breaks only one is this
	 * branch's business and is what this asks.
	 */
	@Test
	void theRowThatNamesABookEntryOnTheWrongBasisBreaksThatAloneSinceV35() {
		/* TAKE THE ONE CONSTRAINT AWAY AND THE ROW MUST GO IN. That is what „breaks exactly one"
		   MEANS, and it is the only form of the question that can fail: asking the refusal which
		   constraint it names cannot tell, because PostgreSQL reports the first one it reaches and it
		   reaches this one - measured, the mutation that took the trail off this row passed an
		   assertion written that way. Dropped inside the case and rolled back with it, so no other
		   case here ever sees a schema this one took apart. */
		jdbc.execute("alter table membership drop constraint"
				+ " membership_basis_says_whether_a_book_entry_is_named");

		assertThat(db.sql(NAMES_A_BOOK_ENTRY_ON_THE_WRONG_BASIS).update())
				.as("with the one constraint gone the row is still refused, so it was breaking"
						+ " something else as well and the case above names a thing it is not about")
				.isOne();
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

	/**
	 * Let in on his own balance, naming the line that paid for it (V38, owner 26.09.2026).
	 *
	 * <p>A season of its own, and no receipt: this is the shape that had no way to be written down
	 * before V38, because every membership had to name a payment or be a gift.
	 */
	private static final String GOOD_OUT_OF_THE_BOOK =
			membershipNaming(A_MEMBER + ", 2030, 'balance', null, " + HIS_BOOK_ENTRY + ", null, null, null");

	static List<String> legitimateRows() {
		return List.of(GOOD_ON_HIS_OWN_RECEIPT, GOOD_LET_IN_FREE, GOOD_ANOTHER_MEMBER,
				GOOD_OUT_OF_THE_BOOK);
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

	/**
	 * THE WORDS THE TWO COLUMNS DO NOT SHARE, and there is exactly one.
	 *
	 * <p><b>This list is the narrowing of 27.09.2026 and it has a floor under it rather than a
	 * promise</b>, which is {@link #theOnlyWordTheTwoColumnsDoNotShareIsThePerSeasonOne}: the
	 * difference between the two rules is read out of the catalogue and compared with this, so a
	 * FOURTH word added to one column alone turns that case red and asks for a decision instead of
	 * being waved through by this one.
	 */
	private static final Set<String> ONLY_A_SEASON_CAN_STAND_ON = Set.of("balance");

	/**
	 * And the other direction, which is the one a rule widened here alone gets wrong - <b>less the
	 * one word that belongs to a SEASON and not to a PERSON.</b>
	 *
	 * <p><b>Why this direction stopped being total, and it is a decision rather than a workaround.</b>
	 * The owner, 26.09.2026: „Balans veci ili jednak clanarini: clanstvo se aktivira iz balansa." So
	 * a season can stand on a balance. {@code competitor.membership_basis} is not that fact: PDL
	 * 06.09.2026 says it „nosi oslobodjenje od clanarine", and the owner on 20.09.2026 gave the
	 * reason a member is shown his own - „inace ne razume zasto mu portal ne trazi uplatu". It
	 * answers <b>does this person pay or is he let in free</b>, which is a standing property, and a
	 * man who settles a season out of his balance is <b>paying</b>; he is not exempt from anything.
	 *
	 * <p><b>And the alternative was measured to be worse.</b> Widening V7 to take 'balance' would put
	 * a word in the per-person column that nothing could ever mean by it: that column says whether a
	 * person is charged at all, and a man who settles ONE SEASON out of his balance is charged and
	 * pays. The word would describe no person, only a season, which is the column beside it. It would
	 * also turn two other floors red for a reason that is not theirs:
	 * {@code MeApiTest.aMemberIsHandedHisOwnBasisAndTheOtherWordIsNotIt} asserts V7 names exactly
	 * two words so that a third demands a third caller, and {@link #bothRulesAboutABasisAreStillThere}
	 * counts them.
	 *
	 * <p><b>What holds the half of this case that is still live</b> is
	 * {@link #everyBasisTheCompetitorNamesTheMembershipTakes} in the other direction, the floor
	 * under it, and - for the sentence this narrowing rests on - the behaviour itself:
	 * {@code MyMembershipWriteApiTest.beingLetInOnTheBalanceLeavesTheStandingBasisAlone} activates a
	 * membership out of the book and demands that {@code competitor.membership_basis} still says
	 * 'payment' afterwards. If that word ever does have to reach the person, that case turns red
	 * first.
	 */
	@Test
	void everyBasisTheMembershipNamesTheCompetitorTakes() {
		for (String basis : basesNamedIn("membership_basis_known")) {
			if (ONLY_A_SEASON_CAN_STAND_ON.contains(basis)) {
				continue;
			}
			assertThat(ruleTakes("competitor_membership_basis_known", "membership_basis", basis))
					.as("this table takes the basis '%s' and V7 refuses it, so the same fact has"
							+ " two vocabularies", basis)
					.isTrue();
		}
	}

	/**
	 * THE FLOOR UNDER THE EXEMPTION ABOVE, and it is the catalogue that answers rather than a
	 * sentence.
	 *
	 * <p>Whatever {@code membership_basis_known} names and {@code competitor_membership_basis_known}
	 * does not must be exactly the one word a decision was made about. A fourth basis added to the
	 * season alone lands here, red, on the day it is added.
	 */
	@Test
	void theOnlyWordTheTwoColumnsDoNotShareIsThePerSeasonOne() {
		Set<String> theSeasonAlone = new HashSet<>(basesNamedIn("membership_basis_known"));
		theSeasonAlone.removeAll(basesNamedIn("competitor_membership_basis_known"));

		assertThat(theSeasonAlone)
				.as("a basis a season can stand on that a person cannot, which is either a decision"
						+ " or a mistake and has to be one of them on purpose")
				.containsExactlyInAnyOrderElementsOf(ONLY_A_SEASON_CAN_STAND_ON);
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

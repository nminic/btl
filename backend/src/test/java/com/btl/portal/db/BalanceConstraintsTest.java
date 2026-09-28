package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * EVERY CONSTRAINT V38'S TWO TABLES CARRY, and the sentences they are made of.
 *
 * <p><b>The book of balance</b> ({@code balance_entry}) is what ADL asks for in those words:
 * „obaveza udruzenja, ne broj u koloni: trazi knjigu promena (ko, kada, koliko, iz kog razloga),
 * nepromenljive stavke, i saldo koji se uvek izvodi iz knjige". So the constraints below are that
 * sentence taken apart: every line says who, when, how much and why, each reason carries exactly its
 * own half of the row, and a reason may only move the balance the way it is allowed to.
 *
 * <p><b>The promise</b> ({@code balance_promise}) is not money moving, which is why it is a second
 * table and why it has no immutability trigger: the book records what HAPPENED and may never be
 * edited, this records what the code currently shown to a member SAYS and is meant to be overwritten.
 *
 * <p><b>ONE REWARD PER PERSON BROUGHT IN</b> is the one rule here that is not obvious from the
 * columns, and it is the schema that says it rather than the service that writes it:
 * {@code balance_entry_one_a_referral} is a unique key over the person brought in, so a member who
 * pays for a second season cannot earn his referrer a second reward whatever any future caller
 * forgets.
 */
class BalanceConstraintsTest extends DatabaseTest {

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

	/** The two tables V38 adds. */
	static final List<String> TABLES = List.of("balance_entry", "balance_promise");

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String AN_ACCOUNT = "(select id from account where email = 'blagajnik@primer.rs')";
	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	private static final String A_MEMBER = "(select id from competitor where member_number = '005000')";
	private static final String SOMEBODY_HE_BROUGHT_IN =
			"(select id from competitor where member_number = '005001')";
	private static final String NOBODY_HAS_CLAIMED_HIM =
			"(select id from competitor where member_number = '005002')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String ENTRY_COLUMNS = "competitor_id, amount, currency, reason,"
			+ " referred_competitor_id, season, occurred_at, recorded_by, recorded_by_name";

	private static String entry(String values) {
		return "insert into balance_entry (" + ENTRY_COLUMNS + ") values (" + values + ")";
	}

	/** The same row with its key written by hand, which the two cases about the key need. */
	private static String entryWithId(String id, String values) {
		return "insert into balance_entry (id, " + ENTRY_COLUMNS + ") values (" + id + ", " + values + ")";
	}

	private static final String THE_KEY_ALREADY_THERE =
			"(select id from balance_entry order by id limit 1)";

	private static final String A_GOOD_ROW_AFTER_THE_KEY = "5, 'EUR', 'referral', "
			+ NOBODY_HAS_CLAIMED_HIM + ", null, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'";

	private static String promise(String values) {
		return "insert into balance_promise (competitor_id, season, amount, currency, promised_at)"
				+ " values (" + values + ")";
	}

	/** A referral that is already in the book, so the unique key has something to collide with. */
	private static final String THE_LINE_ALREADY_THERE = entry(A_MEMBER + ", 5, 'EUR', 'referral', "
			+ SOMEBODY_HE_BROUGHT_IN + ", null, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'");

	/** A reward earned, for a man nobody has claimed yet. */
	private static final String GOOD_A_REFERRAL = entry(A_MEMBER + ", 5, 'EUR', 'referral', "
			+ NOBODY_HAS_CLAIMED_HIM + ", null, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'");

	/** And a membership taking its part out, which moves the other way and names a season. */
	private static final String GOOD_A_MEMBERSHIP = entry(A_MEMBER + ", -35, 'EUR', 'membership',"
			+ " null, 2028, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'");

	/** A code shown to him for a season nothing else in this fixture promises. */
	private static final String GOOD_A_PROMISE = promise(A_MEMBER + ", 2029, 5, 'EUR', " + AN_INSTANT);

	static List<Violation> violations() {
		return List.of(
				/* THE KEY, both ways it can be wrong. A line with no key is a line nothing can name,
				   and the membership that stands on a balance names one by it (V38). The duplicate
				   row differs from the one already standing in the member CREDITED as well, so a key
				   widened to take anything else in would still refuse it. */
				Violation.notNull("balance_entry_id_not_null", "id",
						entryWithId("null", A_MEMBER + ", " + A_GOOD_ROW_AFTER_THE_KEY)),
				Violation.of("balance_entry_pk",
						entryWithId(THE_KEY_ALREADY_THERE,
								SOMEBODY_HE_BROUGHT_IN + ", " + A_GOOD_ROW_AFTER_THE_KEY)),

				Violation.notNull("balance_entry_competitor_id_not_null", "competitor_id",
						entry("null, 5, 'EUR', 'referral', " + NOBODY_HAS_CLAIMED_HIM + ", null, "
								+ AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")),
				Violation.of("balance_entry_competitor_fk",
						entry("999999, 5, 'EUR', 'referral', " + NOBODY_HAS_CLAIMED_HIM + ", null, "
								+ AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")),

				/* THE AMOUNT AND THE MONEY IT IS IN, and since V42 they are two columns where there
				   used to be two AMOUNTS. A line with no currency is a number nobody can add to
				   anything, which is worse than a line with no number. */
				Violation.notNull("balance_entry_amount_not_null", "amount",
						entry(A_MEMBER + ", null, 'EUR', 'referral', " + NOBODY_HAS_CLAIMED_HIM
								+ ", null, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")),
				Violation.notNull("balance_entry_currency_not_null", "currency",
						entry(A_MEMBER + ", 5, null, 'referral', " + NOBODY_HAS_CLAIMED_HIM
								+ ", null, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")),
				/* AND IT IS ONE OF THE TWO THE PORTAL BILLS IN, the same vocabulary
				   `payment_currency_known` (V16) holds and the one `domain.pricing.Currency` names.
				   A third currency is a decision the owner has not made („evri za sada"), so a row
				   carrying one is a row nothing could have written. */
				Violation.of("balance_entry_currency_known",
						entry(A_MEMBER + ", 5, 'USD', 'referral', " + NOBODY_HAS_CLAIMED_HIM
								+ ", null, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")),

				Violation.notNull("balance_entry_reason_not_null", "reason",
						entry(A_MEMBER + ", 5, 'EUR', null, " + NOBODY_HAS_CLAIMED_HIM + ", null, "
								+ AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")),
				/* Money moved for a reason the portal has no way to produce, and naming neither a
				   member brought in nor a season - so this row breaks the vocabulary and nothing
				   else. Naming either would trip the rule about which reason may carry which half
				   first, and the case would be measuring that instead. */
				Violation.of("balance_entry_reason_known",
						entry(A_MEMBER + ", 5, 'EUR', 'goodwill', null, null, "
								+ AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")),

				/* ONLY A REFERRAL NAMES A MEMBER BROUGHT IN: a spend that named one would be a
				   withdrawal dressed up as a reward. The other direction - a reward that names
				   nobody - is a rule about WRITING a line and is held by a trigger instead, for the
				   reason the migration gives: `on delete set null` makes it stop being true the day
				   the newcomer is deleted, and a check would then refuse his deletion. */
				Violation.of("balance_entry_only_a_referral_names_a_member",
						entry(A_MEMBER + ", -35, 'EUR', 'membership', " + NOBODY_HAS_CLAIMED_HIM
								+ ", 2028, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")),
				/* WHICH REASONS BELONG TO A SEASON, and since V42 that is TWO of the four and the
				   rule is measured in both directions. A spend and a credit both arise while one
				   season is being settled; a referral is about a person and a conversion about a
				   country, and neither has a season to name. Three rows, because a biconditional
				   widened on one side can be broken from either. */
				Violation.of("balance_entry_what_names_the_season",
						entry(A_MEMBER + ", -35, 'EUR', 'membership', null, null, " + AN_INSTANT + ", "
								+ AN_ACCOUNT + ", 'Blagajnik'")),
				Violation.of("balance_entry_what_names_the_season",
						entry(A_MEMBER + ", 5, 'EUR', 'overpayment', null, null, " + AN_INSTANT + ", "
								+ AN_ACCOUNT + ", 'Blagajnik'")),
				Violation.of("balance_entry_what_names_the_season",
						entry(A_MEMBER + ", 5, 'EUR', 'conversion', null, 2028, " + AN_INSTANT + ", "
								+ AN_ACCOUNT + ", 'Blagajnik'")),

				/* AND WHICH WAY EACH ONE MAY MOVE THE BALANCE. A referral written negative robs the
				   member who earned it, and a spend written positive pays him for being charged. */
				Violation.of("balance_entry_a_referral_adds",
						entry(A_MEMBER + ", -5, 'EUR', 'referral', " + NOBODY_HAS_CLAIMED_HIM
								+ ", null, " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")),
				Violation.of("balance_entry_a_membership_takes",
						entry(A_MEMBER + ", 35, 'EUR', 'membership', null, 2028, " + AN_INSTANT + ", "
								+ AN_ACCOUNT + ", 'Blagajnik'")),

				/* AND A SPEND OF NOTHING IS REFUSED TOO, which is the half of that constraint a
				   positive row does not reach: `amount < 0` is strict, so nought fails it exactly as a
				   positive number does. This row is the FLOOR under `ActivatingFromBalance`'s refusal
				   of a fee of nothing - V4 lets a price row be nought and `PUT /api/pricing/{key}` has
				   no lower bound, so without that refusal the balance covers the fee by `0 >= 0`, the
				   route reaches the book, and every member on the portal is answered 500. If this
				   constraint is ever loosened to take nought, the guard in the domain is no longer
				   holding anything and this case is what says so.

				   It breaks THIS constraint and no other: the season is named, so
				   `balance_entry_what_names_the_season` is satisfied, and no member is named, so
				   `balance_entry_only_a_referral_names_a_member` is too. A row that broke two would
				   say nothing about either. */
				Violation.of("balance_entry_a_membership_takes",
						entry(A_MEMBER + ", 0, 'EUR', 'membership', null, 2028, " + AN_INSTANT + ", "
								+ AN_ACCOUNT + ", 'Blagajnik'")),

				/* A ROW FOR A SPEND THAT MOVED ONE CURRENCY ONLY STOOD HERE, and it went with the
				   pair rather than being weakened. `0, -4200` was a shape the old constraint refused
				   because it read `eur < 0 and rsd < 0`, BOTH strictly, and it named a real boundary:
				   a period priced at nought euro and six hundred dinars was reachable through `PUT
				   /api/pricing/{key}`, and such a fee covered by a dinar balance made both activation
				   doors answer 500. That boundary was closed from the other end by the owner on
				   27.09.2026 (PDL 20b, V40: a price row is free in both currencies or priced in
				   both), and then the pair itself went (PDL 25, V42). There is no one-sided amount
				   left to write.

				   AND WHERE THAT LEAVES THE THREE NEW REASONS, each with a row of its own. */

				/* A CREDIT MOVES THE BALANCE UP AND ONLY UP. Owner, 27.09.2026 (PDL 19, case 7): a
				   surplus „ulazi u balans kao kredit", so a credit written negative would take money
				   off a man for having sent too much. */
				Violation.of("balance_entry_an_overpayment_adds",
						entry(A_MEMBER + ", -5, 'EUR', 'overpayment', null, 2028, " + AN_INSTANT + ", "
								+ AN_ACCOUNT + ", 'Blagajnik'")),

				/* AND A CONVERSION MAY MOVE IT EITHER WAY BUT NEVER NOWHERE. It is the one reason
				   whose sign cannot be fixed in advance - out of the old money it is negative and
				   into the new one positive - so what is refused is nought: a member whose book is
				   empty when he changes country has nothing to restate, and a pair of lines saying so
				   would be two facts about money that never moved. */
				Violation.of("balance_entry_a_conversion_moves_something",
						entry(A_MEMBER + ", 0, 'EUR', 'conversion', null, null, " + AN_INSTANT + ", "
								+ AN_ACCOUNT + ", 'Blagajnik'")),

				/* ONE REWARD PER PERSON BROUGHT IN, however many seasons he goes on to pay for. The
				   row differs from the one already standing in the MEMBER CREDITED as well, so a key
				   widened to take the referrer in - the shape somebody reaches for the moment two
				   people both claim to have brought somebody - would still refuse this. */
				Violation.of("balance_entry_one_a_referral",
						entry(NOBODY_HAS_CLAIMED_HIM + ", 5, 'EUR', 'referral', "
								+ SOMEBODY_HE_BROUGHT_IN + ", null, " + AN_INSTANT + ", " + AN_ACCOUNT
								+ ", 'Blagajnik'")),

				/* Nobody is his own reason. */
				Violation.of("balance_entry_not_referred_by_itself",
						entry(A_MEMBER + ", 5, 'EUR', 'referral', " + A_MEMBER + ", null, " + AN_INSTANT
								+ ", " + AN_ACCOUNT + ", 'Blagajnik'")),

				Violation.of("balance_entry_referred_fk",
						entry(A_MEMBER + ", 5, 'EUR', 'referral', 999999, null, " + AN_INSTANT + ", "
								+ AN_ACCOUNT + ", 'Blagajnik'")),

				Violation.notNull("balance_entry_occurred_at_not_null", "occurred_at",
						entry(A_MEMBER + ", 5, 'EUR', 'referral', " + NOBODY_HAS_CLAIMED_HIM
								+ ", null, null, " + AN_ACCOUNT + ", 'Blagajnik'")),

				Violation.of("balance_entry_recorded_by_fk",
						entry(A_MEMBER + ", 5, 'EUR', 'referral', " + NOBODY_HAS_CLAIMED_HIM + ", null, "
								+ AN_INSTANT + ", 999999, 'Blagajnik'")),

				/* ADL asks for „ko" and a blank answers it no better than nothing. */
				Violation.notNull("balance_entry_recorded_by_name_not_null", "recorded_by_name",
						entry(A_MEMBER + ", 5, 'EUR', 'referral', " + NOBODY_HAS_CLAIMED_HIM + ", null, "
								+ AN_INSTANT + ", " + AN_ACCOUNT + ", null")),
				Violation.of("balance_entry_recorded_by_name_not_blank",
						entry(A_MEMBER + ", 5, 'EUR', 'referral', " + NOBODY_HAS_CLAIMED_HIM + ", null, "
								+ AN_INSTANT + ", " + AN_ACCOUNT + ", '   '")),

				/* The league begins in 2027 and no season before it can be spent on. */
				Violation.of("balance_entry_season_not_before_the_league",
						entry(A_MEMBER + ", -35, 'EUR', 'membership', null, 2026, " + AN_INSTANT + ", "
								+ AN_ACCOUNT + ", 'Blagajnik'")),

				/* ------------------------------------------------------------------ the promise */

				Violation.notNull("balance_promise_competitor_id_not_null", "competitor_id",
						promise("null, 2029, 5, 'EUR', " + AN_INSTANT)),
				Violation.of("balance_promise_competitor_fk",
						promise("999999, 2029, 5, 'EUR', " + AN_INSTANT)),

				Violation.notNull("balance_promise_season_not_null", "season",
						promise(A_MEMBER + ", null, 5, 'EUR', " + AN_INSTANT)),
				Violation.of("balance_promise_season_not_before_the_league",
						promise(A_MEMBER + ", 2026, 5, 'EUR', " + AN_INSTANT)),

				Violation.notNull("balance_promise_amount_not_null", "amount",
						promise(A_MEMBER + ", 2029, null, 'EUR', " + AN_INSTANT)),
				Violation.notNull("balance_promise_currency_not_null", "currency",
						promise(A_MEMBER + ", 2029, 5, null, " + AN_INSTANT)),
				/* AND A CODE MINTED IN A MONEY THE PORTAL DOES NOT BILL IN. */
				Violation.of("balance_promise_currency_known",
						promise(A_MEMBER + ", 2029, 5, 'USD', " + AN_INSTANT)),

				/* A code promising a member LESS than nothing. */
				Violation.of("balance_promise_not_negative",
						promise(A_MEMBER + ", 2029, -5, 'EUR', " + AN_INSTANT)),

				Violation.notNull("balance_promise_promised_at_not_null", "promised_at",
						promise(A_MEMBER + ", 2029, 5, 'EUR', null")),

				/* ONE LIVE CODE PER SEASON: the second one REPLACES the first through an upsert, and
				   a plain insert of it is refused, which is what makes the upsert the only road. */
				Violation.of("balance_promise_pk",
						promise(A_MEMBER + ", 2028, 5, 'EUR', " + AN_INSTANT)));
	}

	@BeforeEach
	void aMemberWhoHasBroughtSomebodyInAndOneNobodyHasClaimed() {
		competitor("005000", "Preporucilac", "00112233445566b1", "null");
		competitor("005001", "Doveden", "00112233445566b2", A_MEMBER);
		competitor("005002", "Neprisvojen", "00112233445566b3", "null");

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni',"
				+ " 'Blagajnik', 'blagajnik@primer.rs', (select id from role where code = 'moderator'))")
				.update();

		db.sql(THE_LINE_ALREADY_THERE).update();

		/* A promise for the season on sale, so the key above has something to collide with while the
		   legitimate promise below names a DIFFERENT season. */
		db.sql(promise(A_MEMBER + ", 2028, 5, 'EUR', " + AN_INSTANT)).update();
	}

	private void competitor(String number, String last, String code, String referredBy) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni', ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
						+ " ?, " + referredBy + ", '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, last, code).update();
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
	void everyConstraintOnTheseTablesHasARowThatBreaksIt() {
		String literals = TABLES.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));
		String relations = " = any (array[" + literals + "]::regclass[])";

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
		assertThat(covered)
				.as("every constraint on %s needs a row above that breaks it", TABLES)
				.containsExactlyInAnyOrderElementsOf(declared);
	}

	static List<String> legitimateRows() {
		return List.of(GOOD_A_REFERRAL, GOOD_A_MEMBERSHIP, GOOD_A_PROMISE);
	}

	/**
	 * And a row that breaks nothing goes in.
	 *
	 * <p>Without this every constraint above could be replaced by one that rejects everything and the
	 * whole file would still pass.
	 */
	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * AND A LINE IN THE BOOK IS WRITTEN ONCE, which is ADL's „nepromenljive stavke" and is a trigger
	 * rather than a hope because there is no {@code no update} in SQL.
	 *
	 * <p>Asked over the AMOUNT, which is the field an amendment would be made to, and over the whole
	 * table, so a trigger written {@code for each statement} on one column would not satisfy it.
	 */
	@Test
	void theAmountOnALineCannotBeRewritten() {
		assertThatThrownBy(() -> db.sql("update balance_entry set amount = 1200").update())
				.hasMessageContaining("cannot be changed once written");
	}

	/**
	 * AND NEITHER CAN WHO WROTE IT, which is a second case rather than a second assertion: the first
	 * refusal aborts the transaction, so anything after it in one method is answered „current
	 * transaction is aborted" and measures the abort instead of the trigger.
	 */
	@Test
	void whoWroteALineCannotBeRewrittenEither() {
		assertThatThrownBy(() -> db.sql("update balance_entry set recorded_by_name = 'Neko Drugi'")
				.update())
				.hasMessageContaining("cannot be changed once written");
	}

	/**
	 * AND A FORGETTABLE KEY MAY NOT BE POINTED AT SOMEBODY ELSE, which is the other half of the
	 * exception the trigger makes for a cascade.
	 *
	 * <p>Going to null is a row being forgotten; going to a different person is the reward being
	 * given to somebody who did not earn it, and the whole reason the exception could not simply be
	 * „leave those two columns alone".
	 */
	@Test
	void aforgettableKeyMayBeForgottenButNotRePointed() {
		assertThatThrownBy(() -> db.sql("update balance_entry set referred_competitor_id = "
						+ NOBODY_HAS_CLAIMED_HIM).update())
				.hasMessageContaining("cannot be made to name somebody else");
	}

	/**
	 * BUT THE PROMISE TABLE CARRIES NO SUCH TRIGGER, and that is the difference between the two
	 * tables rather than an oversight in one of them.
	 *
	 * <p><b>This is a case about the TABLE and not about what the portal does to it, and the
	 * difference was measured.</b> The book records what HAPPENED to money, so „immutable" is a word
	 * a trigger has to make true. This table records what a code SAYS, which is not money moving, so
	 * the schema leaves it writable - and the day a decision does call for re-minting a code, that
	 * is a change to a screen rather than a migration.
	 *
	 * <p><b>WHAT THE PORTAL ITSELF DOES IS THE OPPOSITE, AND THAT IS NOT THIS CASE'S BUSINESS.</b>
	 * {@code BalanceBook.promise} writes {@code on conflict do nothing}: the first look of a season
	 * fixes what that season's code promises. An earlier draft of this branch made it an upsert and
	 * this case said so in its own name, which made a case about a table read as a case about a
	 * rule - and the rule was wrong. The rule is held by
	 * {@code MyMembershipApiTest.aBalanceThatGrowsAfterTheCodeWasMintedDoesNotMoveThePromise}, which
	 * goes through the route; this one only proves nothing in the schema stands in its way.
	 */
	@Test
	void aPromiseMayBeRewrittenByTheSchemaEvenThoughThePortalNeverRewritesOne() {
		assertThat(db.sql("insert into balance_promise (competitor_id, season, amount, currency,"
						+ " promised_at) values (" + A_MEMBER + ", 2028, 10, 'EUR', " + AN_INSTANT + ")"
						+ " on conflict (competitor_id, season) do update set amount = excluded.amount,"
						+ " currency = excluded.currency").update())
				.isOne();

		assertThat(db.sql("select amount || ' ' || currency from balance_promise where competitor_id = "
						+ A_MEMBER + " and season = 2028").query(String.class).single())
				.isEqualTo("10.00 EUR");
	}

	/**
	 * AND DELETING A MEMBER TAKES HIS BOOK WITH HIM, which the immutability trigger deliberately does
	 * not stand in the way of.
	 *
	 * <p>Were DELETE refused as well, deleting a member would fail outright and the promise PDL P23
	 * makes about a member who asks to be gone would be the thing that broke. „Immutable" is about
	 * nobody rewriting what a line says.
	 */
	@Test
	void deletingAMemberTakesHisBookAndHisPromisesWithHim() {
		db.sql("delete from competitor where member_number = '005000'").update();

		assertThat(db.sql("select count(*) from balance_entry").query(Long.class).single()).isZero();
		assertThat(db.sql("select count(*) from balance_promise").query(Long.class).single()).isZero();
	}

	/**
	 * A REWARD HAS TO NAME THE PERSON IT WAS EARNED FOR, AT THE MOMENT IT IS WRITTEN.
	 *
	 * <p>The half of the old two-way check that survived, moved onto a trigger over INSERT because
	 * that is the only shape which says „when a line is written" rather than „for ever".
	 *
	 * <p><b>It is what makes {@code balance_entry_one_a_referral} mean anything:</b> a caller able to
	 * write rewards naming nobody could pay one referrer any number of times and the unique key over
	 * a nullable column would refuse none of them, because PostgreSQL lets any number of nulls
	 * through.
	 */
	@Test
	void arewardHasToNameTheMemberBroughtIn() {
		assertThatThrownBy(() -> db.sql(entry(A_MEMBER + ", 5, 'EUR', 'referral', null, null, "
						+ AN_INSTANT + ", " + AN_ACCOUNT + ", 'Blagajnik'")).update())
				.hasMessageContaining("a reward has to name the member brought in");
	}

	/**
	 * AND THE CREDIT SURVIVES THE PERSON IT WAS EARNED FOR.
	 *
	 * <p>Somebody who brought in a member who later left keeps what he earned; he did the thing he was
	 * paid for. <b>Two rules had to give way for this to be possible and both are named where they
	 * live:</b> a blanket refusal of every {@code update} made the cascade itself fail, and a check
	 * demanding that a reward always name somebody made it fail one layer further down. Both were
	 * found here rather than in production.
	 */
	@Test
	void theCreditSurvivesThePersonItWasEarnedFor() {
		db.sql("delete from competitor where member_number = '005001'").update();

		assertThat(db.sql("select count(*) from balance_entry where referred_competitor_id is null")
						.query(Long.class).single())
				.as("the line went with the man who was brought in, so a reward that was earned was"
						+ " taken back")
				.isOne();
	}
}

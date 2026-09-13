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
 * Every constraint the one table of V22 carries, and the two sentences it is made of.
 *
 * <p>Membership is a fact about a SEASON. Until V22 the schema had no way to answer "in which
 * seasons was this person a member": {@code competitor.active} is one boolean with no season in
 * it, and {@code payment} exists only for the people who pay, because
 * {@code payment_amount_positive} refuses a row of nought.
 *
 * <p>The two sentences held here are the ones the table was shaped by. One answer per person per
 * season, which is the primary key and not a unique constraint beside a surrogate. And the basis
 * is one of exactly two words, which is not a list written down here: it is read out of
 * {@code competitor_membership_basis_known}, the constraint V7 already carries, so the day a
 * third basis is added to either of them the other one fails.
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

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '001000')";
	private static final String ANOTHER_MEMBER =
			"(select id from competitor where member_number = '001001')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS = "competitor_id, season, basis";

	private static String membership(String values) {
		return "insert into membership (" + COLUMNS + ") values (" + values + ")";
	}

	/**
	 * He paid for 2028, which is the season the transfer window sells.
	 *
	 * <p>A different season from the one the probe already holds for him, so accepting it says
	 * something: the key refuses a second row for ONE season and not a second season.
	 */
	private static final String GOOD_A_SECOND_SEASON = membership(A_MEMBER + ", 2028, 'feeExempt'");

	/** And somebody else, for the season the first man already has. */
	private static final String GOOD_ANOTHER_MEMBER = membership(ANOTHER_MEMBER + ", 2027, 'payment'");

	/**
	 * Two members, and one membership for the first of them.
	 *
	 * <p>Two rather than one on purpose: every case below that reads the table back would be
	 * satisfied by a cascade that emptied it if his were the only row in it.
	 */
	@BeforeEach
	void probe() {
		competitor("001000", "Probni", "Clan", "00112233445566f1", "feeExempt");
		competitor("001001", "Drugi", "Clan", "00112233445566f2", "payment");

		db.sql(membership(A_MEMBER + ", 2027, 'payment'")).update();
	}

	private void competitor(String number, String first, String last, String code, String basis) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, ?, ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true, ?, ?,"
						+ " null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, basis, code).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("membership_competitor_id_not_null", "competitor_id",
						membership("null, 2028, 'payment'")),
				/* A membership for somebody who is not there. */
				Violation.of("membership_competitor_fk", membership("999999, 2028, 'payment'")),

				Violation.notNull("membership_season_not_null", "season",
						membership(A_MEMBER + ", null, 'payment'")),
				/* The league begins in 2027 and there is no season before it. */
				Violation.of("membership_season_not_before_the_league",
						membership(A_MEMBER + ", 2026, 'payment'")),

				Violation.notNull("membership_basis_not_null", "basis",
						membership(A_MEMBER + ", 2028, null")),
				Violation.of("membership_basis_known", membership(A_MEMBER + ", 2028, 'honorary'")),

				/* ONE ANSWER PER PERSON PER SEASON, and the basis here is DIFFERENT from the one
				   the probe wrote for that season. That is the whole strength of the case: a key
				   widened to (competitor_id, season, basis) - which is the shape somebody reaches
				   for the moment he wants to record a change of basis - would still refuse an
				   identical row and let this one through, so an identical row would measure
				   nothing. */
				Violation.of("membership_pk", membership(A_MEMBER + ", 2027, 'feeExempt'")));
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
		return List.of(GOOD_A_SECOND_SEASON, GOOD_ANOTHER_MEMBER);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * THE TWO BASES ARE THE TWO V7 ALREADY NAMES, and neither list is written here.
	 *
	 * <p>Both sides are read out of {@code pg_get_constraintdef}, so a third word added to either
	 * constraint fails this whatever the word is. A case that simply refused {@code 'honorary'}
	 * would be green the day somebody added {@code 'sponsored'} to one of the two and not the
	 * other, and then the same fact would have two vocabularies.
	 *
	 * <p>The pair is asserted non-trivially as well: two words and not one, because a rule that
	 * named a single basis would make this pass by agreeing with itself.
	 */
	@Test
	void theBasisIsTheSameTwoWordsTheCompetitorAlreadyCarries() {
		List<String> here = wordsIn("membership_basis_known");
		List<String> there = wordsIn("competitor_membership_basis_known");

		assertThat(there).as("V7 names no two bases, so the comparison below asserts nothing")
				.hasSize(2);
		assertThat(here)
				.as("the basis a membership stands on and the basis a member carries are the same"
						+ " fact, and they have stopped naming the same words")
				.containsExactlyInAnyOrderElementsOf(there);
	}

	/**
	 * AND THE SEASON BOUNDARY IS THE ONE THE PAYMENT ALREADY CARRIES, word for word.
	 *
	 * <p>The league starts in 2027 (PDL P8) and V16 says so about a payment in exactly these
	 * characters. Comparing the two definitions rather than looking for the number means a
	 * boundary lowered on one of them, to any year at all, fails here.
	 */
	@Test
	void theSeasonBoundaryIsTheOneThePaymentAlreadyCarries() {
		assertThat(definitionOf("membership_season_not_before_the_league"))
				.as("the season a membership may name and the season a payment may name are the"
						+ " same boundary, and they have stopped agreeing")
				.isEqualTo(definitionOf("payment_season_not_before_the_league"));
	}

	private String definitionOf(String constraint) {
		return db.sql("select pg_get_constraintdef(oid) from pg_constraint where conname = ?")
				.param(constraint).query(String.class).single();
	}

	private List<String> wordsIn(String constraint) {
		return Pattern.compile("'([a-zA-Z]+)'").matcher(definitionOf(constraint)).results()
				.map(one -> one.group(1)).toList();
	}

	/**
	 * ONE MAN MAY BE A PAYER ONE SEASON AND LET IN FREE THE NEXT, which is the sentence the owner
	 * gave on 13.09.2026 as the reason {@code competitor.membership_basis} is the wrong shape:
	 * it stands per person, so it cannot say this at all.
	 */
	@Test
	void oneManMayHoldTwoSeasonsOnDifferentBases() {
		db.sql(GOOD_A_SECOND_SEASON).update();

		assertThat(db.sql("select m.season || ' ' || m.basis from membership m"
						+ " join competitor c on c.id = m.competitor_id"
						+ " where c.member_number = '001000' order by m.season")
				.query(String.class).list())
				.as("the same man could not hold two seasons on two bases")
				.containsExactly("2027 payment", "2028 feeExempt");
	}

	/**
	 * A MEMBERSHIP GOES WITH THE PERSON, which is what {@code payment_competitor_fk} (V16) and
	 * {@code team_membership_competitor_fk} (V11) both say about a row hanging off a member.
	 *
	 * <p>Written as a deletion that SUCCEEDS and leaves the other man's row standing. Both halves
	 * are the claim: without the cascade the delete is refused outright, and an assertion that the
	 * table is empty afterwards would be satisfied by a cascade that took everybody with it.
	 */
	@Test
	void theMembershipGoesWithTheMember() {
		db.sql(GOOD_ANOTHER_MEMBER).update();

		assertThat(db.sql("select count(*) from membership").query(Long.class).single())
				.as("there are not two memberships standing on two different members, so what the"
						+ " deletion below leaves behind says nothing about whose rows it took")
				.isEqualTo(2L);

		assertThat(db.sql("delete from competitor where member_number = '001000'").update())
				.as("a member who holds a membership can no longer be deleted at all")
				.isOne();

		assertThat(db.sql("select c.member_number from membership m"
						+ " join competitor c on c.id = m.competitor_id").query(String.class).list())
				.as("the deletion took the wrong memberships with it")
				.containsExactly("001001");
	}
}

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
 * Every constraint of the wish for a category (V81), with the row that breaks it, and what a deleted
 * member takes with him.
 *
 * <p>The shape is {@link FrozenSeasonConstraintsTest}'s: a list of violations, a floor read out of the
 * database that says the list names every constraint the table has, and a row that breaks nothing.
 */
class CategoryWishConstraintsTest extends DatabaseTest {

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

	/** The one table V81 adds. */
	static final List<String> TABLES = List.of("category_wish");

	private static final String A_MEMBER = "(select id from competitor where member_number = '001110')";

	private static String wish(String values) {
		return "insert into category_wish (competitor_id, season, beginner) values (" + values + ")";
	}

	/** A second season of the same member, which is not the same row. */
	private static final String GOOD_WISH = wish(A_MEMBER + ", 2028, false");

	/** One member with a wish for 2027. */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
				+ " first_season, active, referral_code, bio, profile_hidden, birthday_shown, father_name,"
				+ " address, shirt_size, health_statement_at) values ('001110', 'Probni', 'Zeljko', 'M',"
				+ " date '1990-01-01', (select id from place where rank = 1), 2027, true, '00112233445566e1',"
				+ " '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql(wish(A_MEMBER + ", 2027, true")).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.of("category_wish_pk", wish(A_MEMBER + ", 2027, false")),
				Violation.of("category_wish_competitor_fk", wish("999999, 2028, true")),
				Violation.of("category_wish_season_not_before_the_league", wish(A_MEMBER + ", 2026, true")),
				Violation.notNull("category_wish_competitor_id_not_null", "competitor_id", wish("null, 2028, true")),
				Violation.notNull("category_wish_season_not_null", "season", wish(A_MEMBER + ", null, true")),
				Violation.notNull("category_wish_beginner_not_null", "beginner", wish(A_MEMBER + ", 2028, null")));
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
	void everyConstraintOnTheTableHasARowThatBreaksIt() {
		List<String> declared = db
				.sql("select con.conname from pg_constraint con where con.conrelid = 'category_wish'::regclass"
						+ " union all "
						+ "select index.relname from pg_index idx join pg_class index on index.oid = idx.indexrelid"
						+ " where idx.indrelid = 'category_wish'::regclass and idx.indisunique"
						+ " and not exists (select 1 from pg_constraint own where own.conindid = idx.indexrelid)")
				.query(String.class)
				.list();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	@Test
	void aSecondSeasonOfTheSameMemberIsAnotherRow() {
		assertThat(db.sql(GOOD_WISH).update()).isOne();
	}

	/**
	 * A DELETED MEMBER TAKES HIS WISHES WITH HIM, AND HIS MEMBERSHIP STAYS WITHOUT HIM.
	 *
	 * <p>V79 keeps the rows of money a deleted member leaves behind and lets „the profile" go as before;
	 * a wish for a category is the profile. Both halves are asked of one deletion, so a key that kept
	 * the wish (SET NULL would be refused by the NOT NULL, NO ACTION would refuse the deletion) and a
	 * key that took the membership too both fail here.
	 */
	@Test
	void aDeletedMemberTakesHisWishesAndLeavesHisMembership() {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
				+ " values (" + A_MEMBER + ", 2027, 'feeExempt', 'Probni Odbor', timestamptz '2026-10-01 10:00:00+00')")
				.update();
		long member = db.sql("select id from competitor where member_number = '001110'")
				.query(Long.class).single();

		db.sql("delete from competitor where id = ?").param(member).update();

		assertThat(db.sql("select count(*) from category_wish where competitor_id = ?").param(member)
				.query(Integer.class).single())
				.as("the wish outlived the member it belongs to").isZero();
		assertThat(db.sql("select count(*) from membership where season = 2027 and competitor_id is null")
				.query(Integer.class).single())
				.as("the membership went with the member, which V79 forbids").isOne();
	}
}

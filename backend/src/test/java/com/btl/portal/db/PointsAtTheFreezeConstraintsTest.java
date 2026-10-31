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
 * Every constraint of the freeze of a season and of what each member held at it (V83), with the row that
 * breaks it, and what a deleted member takes with him.
 *
 * <p>The shape is {@link CategoryWishConstraintsTest}'s: a list of violations, a floor read out of the
 * database that says the list names every constraint the two tables have, and a row that breaks nothing.
 */
class PointsAtTheFreezeConstraintsTest extends DatabaseTest {

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

	/** The two tables V83 adds. */
	static final List<String> TABLES = List.of("season_frozen", "season_points_at_freeze");

	private static final String A_MEMBER = "(select id from competitor where member_number = '001120')";

	private static String frozen(String values) {
		return "insert into season_frozen (season, frozen_at) values (" + values + ")";
	}

	private static String points(String values) {
		return "insert into season_points_at_freeze (season, competitor_id, points) values (" + values + ")";
	}

	/** One member, 2027 frozen, and what he held in it. */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
				+ " first_season, active, referral_code, bio, profile_hidden, birthday_shown, father_name,"
				+ " address, shirt_size, health_statement_at) values ('001120', 'Probni', 'Zamrznuti', 'M',"
				+ " date '1990-01-01', (select id from place where rank = 1), 2027, true, '00112233445566e2',"
				+ " '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql(frozen("2027, timestamptz '2028-01-01 15:00:00+00'")).update();
		db.sql(points("2027, " + A_MEMBER + ", 10.00")).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.of("season_frozen_pk", frozen("2027, timestamptz '2028-01-01 16:00:00+00'")),
				Violation.of("season_frozen_season_not_before_the_league",
						frozen("2026, timestamptz '2027-01-01 15:00:00+00'")),
				Violation.notNull("season_frozen_season_not_null", "season",
						frozen("null, timestamptz '2028-01-01 15:00:00+00'")),
				Violation.notNull("season_frozen_frozen_at_not_null", "frozen_at", frozen("2028, null")),

				Violation.of("season_points_at_freeze_pk", points("2027, " + A_MEMBER + ", 11.00")),
				Violation.of("season_points_at_freeze_season_fk", points("2028, " + A_MEMBER + ", 11.00")),
				Violation.of("season_points_at_freeze_competitor_fk", points("2027, 999999, 11.00")),
				Violation.of("season_points_at_freeze_points_not_negative", points("2027, " + A_MEMBER + ", -0.01")),
				Violation.notNull("season_points_at_freeze_season_not_null", "season",
						points("null, " + A_MEMBER + ", 11.00")),
				Violation.notNull("season_points_at_freeze_competitor_id_not_null", "competitor_id",
						points("2027, null, 11.00")),
				Violation.notNull("season_points_at_freeze_points_not_null", "points",
						points("2027, " + A_MEMBER + ", null")));
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/** The floor under the list above, read out of the database, over both tables. */
	@Test
	void everyConstraintOnTheTablesHasARowThatBreaksIt() {
		List<String> declared = TABLES.stream()
				.flatMap(table -> db
						.sql("select con.conname from pg_constraint con where con.conrelid = cast(? as regclass)"
								+ " union all "
								+ "select index.relname from pg_index idx join pg_class index on index.oid = idx.indexrelid"
								+ " where idx.indrelid = cast(? as regclass) and idx.indisunique"
								+ " and not exists (select 1 from pg_constraint own where own.conindid = idx.indexrelid)")
						.params(table, table)
						.query(String.class)
						.list()
						.stream())
				.toList();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	/** A member with no points beside the frozen one, and zero itself, are rows like any other. */
	@Test
	void zeroPointsAndASecondMemberAreRows() {
		db.sql(frozen("2028, timestamptz '2029-01-01 15:00:00+00'")).update();

		assertThat(db.sql(points("2028, " + A_MEMBER + ", 0")).update()).isOne();
	}

	/** A SEASON WITH POINTS STANDING IN IT CANNOT BE UNFROZEN. */
	@Test
	void aSeasonWithPointsStandingInItCannotBeUnfrozen() {
		assertThatThrownBy(() -> db.sql("delete from season_frozen where season = 2027").update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("season_points_at_freeze_season_fk");
	}

	/** A DELETED MEMBER TAKES WHAT HE HELD WITH HIM, AND THE FREEZE OF THE SEASON STAYS. */
	@Test
	void aDeletedMemberTakesHisPointsAndTheFreezeStays() {
		long member = db.sql("select id from competitor where member_number = '001120'")
				.query(Long.class).single();

		db.sql("delete from competitor where id = ?").param(member).update();

		assertThat(db.sql("select count(*) from season_points_at_freeze where competitor_id = ?").param(member)
				.query(Integer.class).single())
				.as("the points outlived the member they belong to").isZero();
		assertThat(db.sql("select count(*) from season_frozen where season = 2027").query(Integer.class).single())
				.as("the freeze of the season went with a member").isOne();
	}
}

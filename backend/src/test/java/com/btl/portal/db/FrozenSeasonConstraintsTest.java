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
 * Every constraint the three tables of V17 carry, and the trigger that reconciles
 * two decisions which pull against each other.
 *
 * <p>A frozen season is a record and not a calculation (A37): the page reads one
 * table by season and draws it, with no join and no sum. That is why the name and
 * the gender are columns here rather than something read off `competitor`.
 *
 * <p>And that is exactly what collides with PDL P23. A member may have himself
 * deleted, and then his name has to go - but a foreign key can only empty the
 * pointer, not a second column. The trigger is where the two are reconciled, and
 * half of this file is about measuring that it actually happens.
 */
class FrozenSeasonConstraintsTest extends DatabaseTest {

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

	/** The three tables V17 adds. */
	static final List<String> TABLES =
			List.of("season_competitor", "season_team", "season_league_standing");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '001010')";
	private static final String A_WOMAN = "(select id from competitor where member_number = '001011')";
	private static final String A_TEAM = "(select id from team where slug = 'zamrznut-tim')";
	private static final String A_LEAGUE = "(select id from league where slug = 'zamrznuta-liga')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String RANK_COLUMNS =
			"season, position, competitor_id, who, gender, category, points, races";
	private static final String TEAM_COLUMNS = "season, position, team_id, name, points, members";
	private static final String LEAGUE_COLUMNS =
			"season, league_id, league_name, position, competitor_id, who, gender, points";

	private static String rank(String values) {
		return "insert into season_competitor (" + RANK_COLUMNS + ") values (" + values + ")";
	}

	private static String team(String values) {
		return "insert into season_team (" + TEAM_COLUMNS + ") values (" + values + ")";
	}

	private static String standing(String values) {
		return "insert into season_league_standing (" + LEAGUE_COLUMNS + ") values (" + values + ")";
	}

	/** Second place among the women, which is a different place from second among the men. */
	private static final String GOOD_RANK =
			rank("2027, 2, " + A_WOMAN + ", 'Prva Zamrznuta', 'F', 'senior', 812.40, 14");
	private static final String GOOD_TEAM = team("2027, 2, " + A_TEAM + ", 'Zamrznut tim', 2410.00, 7");
	private static final String GOOD_STANDING = standing("2027, " + A_LEAGUE + ", 'Zamrznuta liga', 2, "
			+ A_WOMAN + ", 'Prva Zamrznuta', 'F', 612.10");

	/**
	 * Two members of two genders, a team, a league, and one row of each frozen
	 * table already written.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('001010', 'Prvi', 'Zamrznuti',"
				+ " 'M', date '1981-01-01', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566f1', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('001011', 'Prva', 'Zamrznuta',"
				+ " 'F', date '1992-02-02', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566f2', null, '', false, 'none', 'Otac', 'Ulica 2', 'S',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('zamrznut-tim', 'Zamrznut tim', '', '', " + A_TOWN
				+ ", null, null, null, 2027, null)").update();
		db.sql("insert into league (slug, name, season, rules, prizes, admin_id) values ('zamrznuta-liga',"
				+ " 'Zamrznuta liga', 2027, '', '', null)").update();

		db.sql(rank("2027, 1, " + A_MEMBER + ", 'Prvi Zamrznuti', 'M', 'senior', 1240.55, 22")).update();
		db.sql(team("2027, 1, " + A_TEAM + ", 'Zamrznut tim', 4820.10, 12")).update();
		db.sql(standing("2027, " + A_LEAGUE + ", 'Zamrznuta liga', 1, " + A_MEMBER + ", 'Prvi Zamrznuti',"
				+ " 'M', 980.25")).update();
	}

	static List<Violation> violations() {
		return List.of(
				/* THE STANDINGS. */
				Violation.notNull("season_competitor_id_not_null", "id",
						"insert into season_competitor (id, " + RANK_COLUMNS + ") values (null, 2028, 1, "
								+ A_MEMBER + ", 'Neko', 'M', 'senior', 10, 1)"),
				Violation.of("season_competitor_pk",
						"insert into season_competitor (id, " + RANK_COLUMNS + ") select id, 2028, 1, "
								+ A_MEMBER + ", 'Neko', 'M', 'senior', 10, 1 from season_competitor limit 1"),
				Violation.notNull("season_competitor_season_not_null", "season",
						rank("null, 1, " + A_MEMBER + ", 'Neko', 'M', 'senior', 10, 1")),
				Violation.of("season_competitor_season_not_before_the_league",
						rank("2026, 1, " + A_MEMBER + ", 'Neko', 'M', 'senior', 10, 1")),
				Violation.notNull("season_competitor_position_not_null", "position",
						rank("2028, null, " + A_MEMBER + ", 'Neko', 'M', 'senior', 10, 1")),
				Violation.of("season_competitor_position_positive",
						rank("2028, 0, " + A_MEMBER + ", 'Neko', 'M', 'senior', 10, 1")),
				Violation.of("season_competitor_fk",
						rank("2028, 1, 999999, 'Neko', 'M', 'senior', 10, 1")),
				Violation.of("season_competitor_who_not_blank",
						rank("2028, 1, " + A_MEMBER + ", '   ', 'M', 'senior', 10, 1")),
				Violation.notNull("season_competitor_gender_not_null", "gender",
						rank("2028, 1, " + A_MEMBER + ", 'Neko', null, 'senior', 10, 1")),
				Violation.of("season_competitor_gender_known",
						rank("2028, 1, " + A_MEMBER + ", 'Neko', 'X', 'senior', 10, 1")),
				Violation.notNull("season_competitor_category_not_null", "category",
						rank("2028, 1, " + A_MEMBER + ", 'Neko', 'M', null, 10, 1")),
				Violation.of("season_competitor_category_not_blank",
						rank("2028, 1, " + A_MEMBER + ", 'Neko', 'M', '   ', 10, 1")),
				Violation.notNull("season_competitor_points_not_null", "points",
						rank("2028, 1, " + A_MEMBER + ", 'Neko', 'M', 'senior', null, 1")),
				Violation.of("season_competitor_points_not_negative",
						rank("2028, 1, " + A_MEMBER + ", 'Neko', 'M', 'senior', -1, 1")),
				Violation.notNull("season_competitor_races_not_null", "races",
						rank("2028, 1, " + A_MEMBER + ", 'Neko', 'M', 'senior', 10, null")),
				Violation.of("season_competitor_races_not_negative",
						rank("2028, 1, " + A_MEMBER + ", 'Neko', 'M', 'senior', 10, -1")),
				/* Two people in the same place among the same gender in the same season. */
				Violation.of("season_competitor_one_per_place",
						rank("2027, 1, " + A_WOMAN + ", 'Neko', 'M', 'senior', 10, 1")),

				/* THE TEAM STANDINGS. */
				Violation.notNull("season_team_id_not_null", "id",
						"insert into season_team (id, " + TEAM_COLUMNS + ") values (null, 2028, 1, "
								+ A_TEAM + ", 'Tim', 10, 1)"),
				Violation.of("season_team_pk",
						"insert into season_team (id, " + TEAM_COLUMNS + ") select id, 2028, 1, " + A_TEAM
								+ ", 'Tim', 10, 1 from season_team limit 1"),
				Violation.notNull("season_team_season_not_null", "season",
						team("null, 1, " + A_TEAM + ", 'Tim', 10, 1")),
				Violation.of("season_team_season_not_before_the_league",
						team("2026, 1, " + A_TEAM + ", 'Tim', 10, 1")),
				Violation.notNull("season_team_position_not_null", "position",
						team("2028, null, " + A_TEAM + ", 'Tim', 10, 1")),
				Violation.of("season_team_position_positive",
						team("2028, 0, " + A_TEAM + ", 'Tim', 10, 1")),
				Violation.of("season_team_fk", team("2028, 1, 999999, 'Tim', 10, 1")),
				Violation.notNull("season_team_name_not_null", "name",
						team("2028, 1, " + A_TEAM + ", null, 10, 1")),
				Violation.of("season_team_name_not_blank",
						team("2028, 1, " + A_TEAM + ", '   ', 10, 1")),
				Violation.notNull("season_team_points_not_null", "points",
						team("2028, 1, " + A_TEAM + ", 'Tim', null, 1")),
				Violation.of("season_team_points_not_negative",
						team("2028, 1, " + A_TEAM + ", 'Tim', -1, 1")),
				Violation.notNull("season_team_members_not_null", "members",
						team("2028, 1, " + A_TEAM + ", 'Tim', 10, null")),
				/* A team in the standings with nobody in it, which is not a team that ran. */
				Violation.of("season_team_members_positive",
						team("2028, 1, " + A_TEAM + ", 'Tim', 10, 0")),
				Violation.of("season_team_one_per_place",
						team("2027, 1, " + A_TEAM + ", 'Tim', 10, 1")),

				/* AND THE LEAGUE STANDINGS. */
				Violation.notNull("season_league_standing_id_not_null", "id",
						"insert into season_league_standing (id, " + LEAGUE_COLUMNS + ") values (null, 2028, "
								+ A_LEAGUE + ", 'Liga', 1, " + A_MEMBER + ", 'Neko', 'M', 10)"),
				Violation.of("season_league_standing_pk",
						"insert into season_league_standing (id, " + LEAGUE_COLUMNS + ") select id, 2028, "
								+ A_LEAGUE + ", 'Liga', 1, " + A_MEMBER + ", 'Neko', 'M', 10"
								+ " from season_league_standing limit 1"),
				Violation.notNull("season_league_standing_season_not_null", "season",
						standing("null, " + A_LEAGUE + ", 'Liga', 1, " + A_MEMBER + ", 'Neko', 'M', 10")),
				Violation.of("season_league_standing_season_not_before_the_league",
						standing("2026, " + A_LEAGUE + ", 'Liga', 1, " + A_MEMBER + ", 'Neko', 'M', 10")),
				Violation.of("season_league_standing_league_fk",
						standing("2028, 999999, 'Liga', 1, " + A_MEMBER + ", 'Neko', 'M', 10")),
				Violation.notNull("season_league_standing_league_name_not_null", "league_name",
						standing("2028, " + A_LEAGUE + ", null, 1, " + A_MEMBER + ", 'Neko', 'M', 10")),
				Violation.of("season_league_standing_league_name_not_blank",
						standing("2028, " + A_LEAGUE + ", '   ', 1, " + A_MEMBER + ", 'Neko', 'M', 10")),
				Violation.notNull("season_league_standing_position_not_null", "position",
						standing("2028, " + A_LEAGUE + ", 'Liga', null, " + A_MEMBER + ", 'Neko', 'M', 10")),
				Violation.of("season_league_standing_position_positive",
						standing("2028, " + A_LEAGUE + ", 'Liga', 0, " + A_MEMBER + ", 'Neko', 'M', 10")),
				Violation.of("season_league_standing_competitor_fk",
						standing("2028, " + A_LEAGUE + ", 'Liga', 1, 999999, 'Neko', 'M', 10")),
				Violation.of("season_league_standing_who_not_blank",
						standing("2028, " + A_LEAGUE + ", 'Liga', 1, " + A_MEMBER + ", '   ', 'M', 10")),
				Violation.notNull("season_league_standing_gender_not_null", "gender",
						standing("2028, " + A_LEAGUE + ", 'Liga', 1, " + A_MEMBER + ", 'Neko', null, 10")),
				Violation.of("season_league_standing_gender_known",
						standing("2028, " + A_LEAGUE + ", 'Liga', 1, " + A_MEMBER + ", 'Neko', 'X', 10")),
				Violation.notNull("season_league_standing_points_not_null", "points",
						standing("2028, " + A_LEAGUE + ", 'Liga', 1, " + A_MEMBER + ", 'Neko', 'M', null")),
				Violation.of("season_league_standing_points_not_negative",
						standing("2028, " + A_LEAGUE + ", 'Liga', 1, " + A_MEMBER + ", 'Neko', 'M', -1")));
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
	void everyConstraintOnTheThreeTablesHasARowThatBreaksIt() {
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
		return List.of(GOOD_RANK, GOOD_TEAM, GOOD_STANDING);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * First among the men and first among the women are two different places.
	 *
	 * <p>The standings are drawn by gender and nothing else (31.08.2026), so the
	 * unique key is over the season, the gender and the place. A key that forgot the
	 * gender would let one of the two firsts in and refuse the other.
	 */
	@Test
	void thereIsAFirstAmongTheMenAndAFirstAmongTheWomen() {
		assertThat(db.sql(rank("2027, 1, " + A_WOMAN + ", 'Prva Zamrznuta', 'F', 'senior', 1100, 18"))
				.update())
				.as("there could not be a first place among the women while there was one among the men")
				.isOne();
	}

	/**
	 * THE NAME GOES WHEN THE PERSON DOES, in both frozen tables at once.
	 *
	 * <p>This is what the trigger is for and the only thing that proves it. PDL P23
	 * gives every member the right to be deleted and A12 says his name then has to
	 * go; A37 says the frozen page joins nothing, so the name is a column here. A
	 * foreign key empties the pointer and cannot touch a second column, so without
	 * the trigger the row would go on saying his name for ever.
	 */
	@Test
	void deletingTheMemberForgetsHisNameInEveryFrozenTable() {
		assertThat(db.sql("select who || ' | ' || who from (select who from season_competitor where"
				+ " competitor_id = " + A_MEMBER + ") one").query(String.class).single())
				.as("the probe did not write the name, so what follows would say nothing")
				.isEqualTo("Prvi Zamrznuti | Prvi Zamrznuti");

		assertThat(db.sql("delete from competitor where member_number = '001010'").update()).isOne();

		assertThat(db.sql("select count(*) from season_competitor where who is not null or competitor_id"
				+ " is not null").query(Long.class).single())
				.as("the standings kept the name or the pointer of a member who asked to be deleted")
				.isZero();
		assertThat(db.sql("select count(*) from season_league_standing where who is not null or"
				+ " competitor_id is not null").query(Long.class).single())
				.as("the league standings kept the name or the pointer of a member who asked to be deleted")
				.isZero();
	}

	/**
	 * And the row itself stays, with its place and its numbers.
	 *
	 * <p>Which is the other half: forgetting the name must not take the season with
	 * it. "Ne brisu se nikad istorijski podaci, oni su zamrznuti" (P13), and the
	 * gender stays too, because that is what the replacement text is composed out of
	 * - <Obrisani clan> or <Obrisana clanica>.
	 */
	@Test
	void forgettingTheNameLeavesThePlaceTheNumbersAndTheGender() {
		db.sql("delete from competitor where member_number = '001010'").update();

		assertThat(db.sql("select position || '/' || gender || '/' || points || '/' || races"
				+ " from season_competitor").query(String.class).single())
				.as("forgetting the name took the place, the gender or the numbers with it")
				.isEqualTo("1/M/1240.55/22");
	}

	/**
	 * Deactivating a member changes nothing here, which is the state between the
	 * other two.
	 *
	 * <p>A37 names three: active, deactivated, deleted. The first two differ only in
	 * whether the reader draws a link, and that is read off `competitor.active`
	 * rather than out of this table - so this measures that the snapshot does NOT
	 * react to it. A trigger written on the wrong event would.
	 */
	@Test
	void deactivatingTheMemberLeavesTheFrozenRowAlone() {
		db.sql("update competitor set active = false where member_number = '001010'").update();

		assertThat(db.sql("select who from season_competitor").query(String.class).single())
				.as("deactivating a member forgot his name, which only deletion may do")
				.isEqualTo("Prvi Zamrznuti");
	}

	/**
	 * The team and the league may go, and their standings stay with their names on
	 * them.
	 *
	 * <p>Neither is a person and neither has a right to be forgotten, so nothing is
	 * cleared: the pointer empties and the name stays, which is what lets a season of
	 * 2027 go on naming a team that was disbanded in 2029.
	 */
	@Test
	void theTeamAndTheLeagueMayGoAndTheirStandingsKeepTheirNames() {
		db.sql("delete from team where slug = 'zamrznut-tim'").update();
		db.sql("delete from league where slug = 'zamrznuta-liga'").update();

		assertThat(db.sql("select name || ' | ' || coalesce(team_id::text, 'bez tima') from season_team")
				.query(String.class)
				.single())
				.isEqualTo("Zamrznut tim | bez tima");
		assertThat(db.sql("select league_name || ' | ' || coalesce(league_id::text, 'bez lige')"
				+ " from season_league_standing").query(String.class).single())
				.isEqualTo("Zamrznuta liga | bez lige");
	}
}

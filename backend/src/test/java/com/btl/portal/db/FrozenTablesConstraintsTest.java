package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint of the tables V84 adds to the frozen season, each broken on purpose by a row that
 * breaks it and nothing else (the shape {@link FrozenSeasonConstraintsTest} has for V17's three).
 *
 * <p>A row is written as the good row of its table with one or two columns replaced, so every row
 * below differs from one the table accepts by exactly what it names, and {@link #aLegitimateRowIsAccepted}
 * holds that the good rows are good.
 */
class FrozenTablesConstraintsTest extends DatabaseTest {

	static final List<String> TABLES = List.of("season_team_member", "season_board", "season_pair",
			"season_pair_half", "season_league_column", "season_league_cell", "season_award");

	record Violation(String constraint, String evidence, String sql) {

		@Override
		public String toString() {
			return constraint + ": " + sql;
		}
	}

	private static final String A_MEMBER = "(select id from competitor where member_number = '001020')";
	private static final String A_WOMAN = "(select id from competitor where member_number = '001021')";
	private static final String THE_TEAM = "(select id from season_team where season = 2027 and position = 1)";
	private static final String THE_PAIR = "(select id from season_pair where season = 2027 and position = 1)";
	private static final String THE_RACE = "(select id from race where name = 'Zamrznuta trka')";
	private static final String THE_EVENT = "(select id from btl_event where slug = 'zamrznut-dogadjaj')";
	private static final String THE_LEAGUE = "(select id from league where slug = 'zamrznuta-liga-v84')";
	private static final String THE_STANDING =
			"(select id from season_league_standing where season = 2027 and position = 1)";
	private static final String THE_COLUMN =
			"(select id from season_league_column where season = 2027 and position = 1)";

	/** The good row of every table, column by column, as SQL. */
	private static Map<String, Map<String, String>> good() {
		Map<String, Map<String, String>> good = new LinkedHashMap<>();

		good.put("season_team_member", values("season_team_id", THE_TEAM, "position", "2", "competitor_id", A_WOMAN,
				"who", "'Prva Zamrznuta'", "gender", "'F'", "points", "8", "races", "1", "kilometers", "10",
				"ascent", "0", "descent", "0", "seconds", "3000"));
		good.put("season_board", values("season", "2027", "board", "'kilometers'", "length", "null", "position",
				"2", "competitor_id", A_WOMAN, "who", "'Prva Zamrznuta'", "gender", "'F'", "points", "8", "races",
				"1", "kilometers", "10", "ascent", "0", "descent", "0", "seconds", "3000", "previous_points", "null",
				"race_id", "null", "race_name", "null"));
		good.put("season_pair", values("season", "2027", "position", "2", "pair_id", "null", "points", "8", "races",
				"1", "kilometers", "10", "ascent", "0", "descent", "0", "seconds", "3000"));
		good.put("season_pair_half", values("season_pair_id", THE_PAIR, "half", "2", "competitor_id", A_WOMAN, "who",
				"'Prva Zamrznuta'", "gender", "'F'"));
		good.put("season_league_column", values("season", "2027", "league_id", THE_LEAGUE, "position", "2",
				"event_id", "null", "date", "date '2027-06-06'", "name", "'Drugi dogadjaj'"));
		good.put("season_league_cell", values("season_league_standing_id",
				"(select id from season_league_standing where season = 2027 and position = 2)",
				"season_league_column_id", THE_COLUMN, "points", "8"));
		good.put("season_award", values("season", "2027", "kind", "'overall'", "category", "null", "position", "2",
				"competitor_id", A_WOMAN, "who", "'Prva Zamrznuta'", "gender", "'F'", "points", "8", "team_name",
				"null"));

		return good;
	}

	private static Map<String, String> values(String... pairs) {
		Map<String, String> values = new LinkedHashMap<>();

		for (int index = 0; index < pairs.length; index += 2) {
			values.put(pairs[index], pairs[index + 1]);
		}

		return values;
	}

	/** The good row of {@code table} with {@code changes} written over it. */
	private static String row(String table, String... changes) {
		Map<String, String> row = new LinkedHashMap<>(good().get(table));
		Map<String, String> changed = values(changes);

		row.putAll(changed);

		return "insert into " + table + " (" + String.join(", ", row.keySet()) + ") values ("
				+ String.join(", ", row.values()) + ")";
	}

	private static Violation of(String constraint, String table, String... changes) {
		return new Violation(constraint, constraint, row(table, changes));
	}

	/** Every NOT NULL of a table, broken by writing a null into that column alone. */
	private static List<Violation> notNulls(String table, String... columns) {
		List<Violation> violations = new ArrayList<>();

		for (String column : columns) {
			violations.add(new Violation(table + "_" + column + "_not_null", "column \"" + column + "\"",
					row(table, column, "null")));
		}

		return violations;
	}

	private static Violation duplicateId(String table) {
		return new Violation(table + "_pk", table + "_pk", row(table, "id", "(select id from " + table + " limit 1)"));
	}

	@BeforeEach
	void probe() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id, city,"
				+ " country_id, first_season, active, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
				+ " father_name, address, shirt_size, health_statement_at) values ('001020', 'Prvi', 'Zamrznuti',"
				+ " 'M', date '1981-01-01', (select id from place where rank = 1), null, null, 2027, true,"
				+ " '00112233445566e1', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id, city,"
				+ " country_id, first_season, active, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
				+ " father_name, address, shirt_size, health_statement_at) values ('001021', 'Prva', 'Zamrznuta',"
				+ " 'F', date '1992-02-02', (select id from place where rank = 1), null, null, 2027, true,"
				+ " '00112233445566e2', null, '', false, 'none', 'Otac', 'Ulica 2', 'S',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season, admin_id)"
				+ " values ('zamrznut-tim-v84', 'Zamrznut tim', '', '', (select id from place where rank = 1), null,"
				+ " null, null, 2027, null)").update();
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured, description,"
				+ " link) values ('zamrznut-dogadjaj', 'Zamrznut dogadjaj', date '2027-05-05', null, 'Kraljevo',"
				+ " (select id from country where code = 'RS'), 'race', false, '', '')").update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
				+ " descent_m) values (" + THE_EVENT + ", 'Zamrznuta trka', false, date '2027-05-05', 'length', 0,"
				+ " 10, 0, 0)").update();
		db.sql("insert into league (slug, name, season, rules, prizes) values ('zamrznuta-liga-v84',"
				+ " 'Zamrznuta liga', 2027, '', '')").update();
		db.sql("insert into racing_pair (season, man_id, woman_id) values (2027, " + A_MEMBER + ", " + A_WOMAN + ")")
				.update();

		db.sql("insert into season_team (season, position, team_id, name, points, members, races, kilometers,"
				+ " ascent, descent, seconds) values (2027, 1, (select id from team where slug = 'zamrznut-tim-v84'),"
				+ " 'Zamrznut tim', 18, 2, 2, 20, 0, 0, 6000)").update();
		db.sql("insert into season_team_member (season_team_id, position, competitor_id, who, gender, points,"
				+ " races, kilometers, ascent, descent, seconds) values (" + THE_TEAM + ", 1, " + A_MEMBER
				+ ", 'Prvi Zamrznuti', 'M', 10, 1, 10, 0, 0, 3000)").update();
		db.sql("insert into season_board (season, board, length, position, competitor_id, who, gender, points,"
				+ " races, kilometers, ascent, descent, seconds) values (2027, 'kilometers', null, 1, " + A_MEMBER
				+ ", 'Prvi Zamrznuti', 'M', 10, 1, 10, 0, 0, 3000)").update();
		db.sql("insert into season_pair (season, position, pair_id, points, races, kilometers, ascent, descent,"
				+ " seconds) values (2027, 1, (select id from racing_pair where season = 2027), 18, 1, 20, 0, 0,"
				+ " 6000)").update();
		db.sql("insert into season_pair_half (season_pair_id, half, competitor_id, who, gender) values ("
				+ THE_PAIR + ", 1, " + A_MEMBER + ", 'Prvi Zamrznuti', 'M')").update();
		db.sql("insert into season_league_column (season, league_id, position, event_id, date, name) values (2027, "
				+ THE_LEAGUE + ", 1, " + THE_EVENT + ", date '2027-05-05', 'Zamrznut dogadjaj')").update();
		db.sql("insert into season_league_standing (season, league_id, league_name, position, competitor_id, who,"
				+ " gender, points) values (2027, " + THE_LEAGUE + ", 'Zamrznuta liga', 1, " + A_MEMBER
				+ ", 'Prvi Zamrznuti', 'M', 10)").update();
		db.sql("insert into season_league_standing (season, league_id, league_name, position, competitor_id, who,"
				+ " gender, points) values (2027, " + THE_LEAGUE + ", 'Zamrznuta liga', 2, " + A_WOMAN
				+ ", 'Prva Zamrznuta', 'M', 8)").update();
		db.sql("insert into season_league_cell (season_league_standing_id, season_league_column_id, points) values ("
				+ THE_STANDING + ", " + THE_COLUMN + ", 10)").update();
		db.sql("insert into season_award (season, kind, category, position, competitor_id, who, gender, points,"
				+ " team_name) values (2027, 'overall', null, 1, " + A_MEMBER + ", 'Prvi Zamrznuti', 'M', 10, null)")
				.update();
	}

	static List<Violation> violations() {
		List<Violation> all = new ArrayList<>();

		/* THE ROSTER OF A TEAM. */
		all.addAll(notNulls("season_team_member", "id", "season_team_id", "position", "gender", "points", "races",
				"kilometers", "ascent", "descent", "seconds"));
		all.add(duplicateId("season_team_member"));
		all.add(of("season_team_member_team_fk", "season_team_member", "season_team_id", "999999"));
		all.add(of("season_team_member_competitor_fk", "season_team_member", "competitor_id", "999999"));
		all.add(of("season_team_member_position_positive", "season_team_member", "position", "0"));
		all.add(of("season_team_member_gender_known", "season_team_member", "gender", "'X'"));
		all.add(of("season_team_member_who_not_blank", "season_team_member", "who", "'   '"));
		all.add(of("season_team_member_totals_not_negative", "season_team_member", "seconds", "-1"));
		all.add(of("season_team_member_one_per_place", "season_team_member", "position", "1"));
		all.add(of("season_team_member_one_place_each", "season_team_member", "competitor_id", A_MEMBER));

		/* EVERY TOP LIST. */
		all.addAll(notNulls("season_board", "id", "season", "board", "position", "gender", "points", "races",
				"kilometers", "ascent", "descent", "seconds"));
		all.add(duplicateId("season_board"));
		all.add(of("season_board_competitor_fk", "season_board", "competitor_id", "999999"));
		all.add(of("season_board_race_fk", "season_board", "board", "'bestRace'", "race_id", "999999", "race_name",
				"'Trka'"));
		all.add(of("season_board_season_not_before_the_league", "season_board", "season", "2026"));
		all.add(of("season_board_known", "season_board", "board", "'mostLaughs'"));
		/* Both directions of „only the lists by length name a length". */
		all.add(of("season_board_length_only_by_length", "season_board", "length", "'short'"));
		all.add(of("season_board_length_known", "season_board", "board", "'byLength'", "length", "'sprint'"));
		all.add(of("season_board_previous_only_on_progress", "season_board", "board", "'progress'"));
		all.add(of("season_board_race_only_on_best_race", "season_board", "race_name", "'Trka'"));
		all.add(of("season_board_race_id_only_on_best_race", "season_board", "race_id", THE_RACE));
		all.add(of("season_board_race_name_not_blank", "season_board", "board", "'bestRace'", "race_name", "'   '"));
		all.add(of("season_board_position_positive", "season_board", "position", "0"));
		all.add(of("season_board_gender_known", "season_board", "gender", "'X'"));
		all.add(of("season_board_who_not_blank", "season_board", "who", "'   '"));
		all.add(of("season_board_totals_not_negative", "season_board", "kilometers", "-1"));
		all.add(of("season_board_one_per_place", "season_board", "position", "1"));
		all.add(of("season_board_one_place_each", "season_board", "competitor_id", A_MEMBER));

		/* THE BOARD OF PAIRS. */
		all.addAll(notNulls("season_pair", "id", "season", "position", "points", "races", "kilometers", "ascent",
				"descent", "seconds"));
		all.add(duplicateId("season_pair"));
		all.add(of("season_pair_fk", "season_pair", "pair_id", "999999"));
		all.add(of("season_pair_season_not_before_the_league", "season_pair", "season", "2026"));
		all.add(of("season_pair_position_positive", "season_pair", "position", "0"));
		all.add(of("season_pair_totals_not_negative", "season_pair", "points", "-1"));
		all.add(of("season_pair_one_per_place", "season_pair", "position", "1"));
		all.add(of("season_pair_one_place_each", "season_pair", "pair_id",
				"(select id from racing_pair where season = 2027)"));

		all.addAll(notNulls("season_pair_half", "id", "season_pair_id", "half", "gender"));
		all.add(duplicateId("season_pair_half"));
		all.add(of("season_pair_half_pair_fk", "season_pair_half", "season_pair_id", "999999"));
		all.add(of("season_pair_half_competitor_fk", "season_pair_half", "competitor_id", "999999"));
		all.add(of("season_pair_half_one_or_two", "season_pair_half", "half", "3"));
		all.add(of("season_pair_half_gender_known", "season_pair_half", "gender", "'X'"));
		all.add(of("season_pair_half_who_not_blank", "season_pair_half", "who", "'   '"));
		all.add(of("season_pair_half_once", "season_pair_half", "half", "1"));
		all.add(of("season_pair_half_one_place_each", "season_pair_half", "competitor_id", A_MEMBER));

		/* THE GRID OF A LEAGUE. */
		all.addAll(notNulls("season_league_column", "id", "season", "position", "date", "name"));
		all.add(duplicateId("season_league_column"));
		all.add(of("season_league_column_league_fk", "season_league_column", "league_id", "999999"));
		all.add(of("season_league_column_event_fk", "season_league_column", "event_id", "999999"));
		all.add(of("season_league_column_season_not_before_the_league", "season_league_column", "season", "2026"));
		all.add(of("season_league_column_position_positive", "season_league_column", "position", "0"));
		all.add(of("season_league_column_name_not_blank", "season_league_column", "name", "'   '"));
		all.add(of("season_league_column_one_per_place", "season_league_column", "position", "1"));
		all.add(of("season_league_column_once", "season_league_column", "event_id", THE_EVENT));

		all.addAll(notNulls("season_league_cell", "season_league_standing_id", "season_league_column_id", "points"));
		all.add(of("season_league_cell_pk", "season_league_cell", "season_league_standing_id", THE_STANDING));
		all.add(of("season_league_cell_standing_fk", "season_league_cell", "season_league_standing_id", "999999"));
		all.add(of("season_league_cell_column_fk", "season_league_cell", "season_league_column_id", "999999"));
		all.add(of("season_league_cell_points_not_negative", "season_league_cell", "points", "-1"));

		/* THE AWARDS. */
		all.addAll(notNulls("season_award", "id", "season", "kind", "position", "gender", "points"));
		all.add(duplicateId("season_award"));
		all.add(of("season_award_competitor_fk", "season_award", "competitor_id", "999999"));
		all.add(of("season_award_season_not_before_the_league", "season_award", "season", "2026"));
		all.add(of("season_award_kind_known", "season_award", "kind", "'participation'"));
		/* Both directions: a category on what is not one, and none on what is. */
		all.add(of("season_award_category_only_in_a_category", "season_award", "category", "'M40-54'"));
		all.add(of("season_award_category_not_blank", "season_award", "kind", "'category'", "category", "'   '"));
		all.add(of("season_award_team_name_only_on_a_team", "season_award", "kind", "'team'", "position", "1"));
		all.add(of("season_award_team_name_not_blank", "season_award", "kind", "'team'", "position", "1",
				"team_name", "'   '"));
		/* Fourth place, and second place of a team. */
		all.add(of("season_award_position_rewarded", "season_award", "position", "4"));
		all.add(of("season_award_gender_known", "season_award", "gender", "'X'"));
		all.add(of("season_award_who_not_blank", "season_award", "who", "'   '"));
		all.add(of("season_award_points_not_negative", "season_award", "points", "-1"));
		all.add(of("season_award_one_each", "season_award", "competitor_id", A_MEMBER, "position", "3"));

		return all;
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/**
	 * The other half of four of the checks above, which a check written one way only would let through:
	 * the kind that needs the column, without it.
	 */
	static List<Violation> theOtherDirection() {
		return List.of(of("season_board_length_only_by_length", "season_board", "board", "'byLength'"),
				of("season_board_race_only_on_best_race", "season_board", "board", "'bestRace'"),
				of("season_award_category_only_in_a_category", "season_award", "kind", "'category'"),
				of("season_award_position_rewarded", "season_award", "kind", "'pair'"));
	}

	@ParameterizedTest
	@MethodSource("theOtherDirection")
	void theKindThatNeedsAColumnIsRefusedWithoutIt(Violation violation) {
		theConstraintRejectsTheRowThatBreaksIt(violation);
	}

	@Test
	void everyConstraintOnTheseTablesHasARowThatBreaksIt() {
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
		return good().keySet().stream().map(FrozenTablesConstraintsTest::row).toList();
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	@Test
	void aPlaceOnTheListOfBestRacesMayBeHeldTwiceByOneMember() {
		db.sql(row("season_board", "board", "'bestRace'", "position", "1", "competitor_id", A_MEMBER, "race_name",
				"'Prva'")).update();

		assertThat(db.sql(row("season_board", "board", "'bestRace'", "position", "2", "competitor_id", A_MEMBER,
				"race_name", "'Druga'")).update()).isOne();
	}

	@Test
	void theCellsOfAStandingGoWithItAndTheRosterWithItsTeam() {
		db.sql("delete from season_league_standing where position = 1").update();
		db.sql("delete from season_team").update();
		db.sql("delete from season_pair").update();

		assertThat(db.sql("select count(*) from season_league_cell").query(Long.class).single()).isZero();
		assertThat(db.sql("select count(*) from season_team_member").query(Long.class).single()).isZero();
		assertThat(db.sql("select count(*) from season_pair_half").query(Long.class).single()).isZero();
	}

	@Test
	void theTeamTheLeagueTheEventTheRaceAndThePairMayGoAndTheFrozenRowsStay() {
		db.sql("delete from racing_pair").update();
		db.sql("delete from league where slug = 'zamrznuta-liga-v84'").update();
		db.sql("delete from btl_event where slug = 'zamrznut-dogadjaj'").update();

		assertThat(db.sql("select count(*) from season_pair where pair_id is null").query(Long.class).single()).isOne();
		assertThat(db.sql("select name || ' ' || coalesce(event_id::text, '-') || ' ' || coalesce(league_id::text, '-')"
				+ " from season_league_column").query(String.class).single()).isEqualTo("Zamrznut dogadjaj - -");
	}
}

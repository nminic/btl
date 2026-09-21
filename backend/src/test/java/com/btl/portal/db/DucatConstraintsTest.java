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
 * Every constraint the three tables of V15 carry, and the seven columns V27 added to
 * one of them, with the row that breaks each.
 *
 * <p>A badge is a recognition and carries no points (PDL), so nothing here touches
 * scoring. What it does carry is a CONDITION, and the condition is data rather than
 * code (ADL A12): this much of this quantity, within this period.
 *
 * <p>Two of the fifteen are not one threshold but a run of them - countries every ten
 * to a hundred, races every hundred to a thousand - and the tier rises part way
 * through, which is the owner's own correction of 10.08.2026. Half of this file is
 * about that run being a whole run rather than half of one.
 *
 * <p><b>And since V27 the row also carries the coin it is struck on</b> - the two
 * legends, which arc the period takes, the mark, the artwork and what a piece of a run
 * is counted in. V15 refused those a column and V27 says at length why that was wrong;
 * what they bring here is four rules that tie one column to another, and every one of
 * them is refused from both sides below rather than once.
 */
class DucatConstraintsTest extends DatabaseTest {

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

	/** The three tables V15 adds. */
	static final List<String> TABLES = List.of("ducat_kind", "ducat", "ducat_award");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000990')";
	private static final String A_RUN_DUCAT = "(select id from ducat where code = 'duk-sve-trke')";
	private static final String A_SEASON_DUCAT = "(select id from ducat where code = 'duk-sezonski-km')";
	private static final String A_MONTH_DUCAT = "(select id from ducat where code = 'duk-mesecni-km')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String CONDITION_COLUMNS =
			"code, name, kind, threshold, period, tier, step, last, tier_up_from";
	/** And the coin it is struck on, which V27 added. */
	private static final String DRAWING_COLUMNS = "top, top_female, bottom, period_at, mark, art,"
			+ " counted";
	private static final String DUCAT_COLUMNS = CONDITION_COLUMNS + ", " + DRAWING_COLUMNS;
	private static final String AWARD_COLUMNS =
			"competitor_id, ducat_id, kind, threshold, reached, period, season, month";

	/**
	 * A COIN THAT BREAKS NOTHING ABOUT ITS DRAWING, for every row here whose fault is
	 * somewhere else.
	 *
	 * <p>Both arcs written, the period on neither, no artwork, and no unit - which is
	 * what a family that is one ducat looks like. Kept as one constant rather than
	 * repeated down the list for the reason the list itself is built that way: a row
	 * must break exactly the constraint it names, and seven more literals on every line
	 * is seven more chances for one of them to break something else quietly.
	 */
	private static final String A_DRAWING = "'GORE', '', 'DOLE', 'none', 'points', 'none', ''";

	/** And the same for a row that IS a run, because a run has to say what it counts. */
	private static final String A_RUNS_DRAWING = "'GORE', '', 'DOLE', 'none', 'points', 'none',"
			+ " 'komada'";

	private static String drawnAs(String values, String drawing) {
		return "insert into ducat (" + DUCAT_COLUMNS + ") values (" + values + ", " + drawing + ")";
	}

	/** A ducat that is one threshold, so it counts no pieces and carries no unit. */
	private static String ducat(String values) {
		return drawnAs(values, A_DRAWING);
	}

	/** And one whose `step` is anything but nought, which the unit has to follow. */
	private static String runDucat(String values) {
		return drawnAs(values, A_RUNS_DRAWING);
	}

	private static String award(String values) {
		return "insert into ducat_award (" + AWARD_COLUMNS + ") values (" + values + ")";
	}

	/** A condition nothing is wrong with, for the rows whose fault is in the drawing. */
	private static final String A_PLAIN_CONDITION =
			"'duk-nov', 'Nov', 'points', 500, 'season', 2, 0, 0, 0";

	/** One threshold and nothing after it, which is thirteen of the fifteen. */
	private static final String GOOD_DUCAT =
			ducat("'duk-probni', 'Probni dukat', 'points', 500, 'season', 2, 0, 0, 0");
	/** And a run, with the tier rising in the middle of it. */
	private static final String GOOD_RUN =
			runDucat("'duk-probna-serija', 'Probna serija', 'raceCount', 25, 'always', 3, 25, 250, 125");

	/** Won for a season. */
	private static final String GOOD_AWARD =
			award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1042.50, 'season', 2027, null");
	/** Won for a month, which is the only kind that says which month. */
	private static final String GOOD_MONTH_AWARD =
			award(A_MEMBER + ", " + A_MONTH_DUCAT + ", 'totalKm', 125, 130, 'month', 2027, 4");

	/**
	 * A member, and one badge he has already won.
	 *
	 * The fifteen definitions and the eleven kinds are written by the migration
	 * itself, so they are here before anything in this class runs. The award is what
	 * the "won once" case collides with.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000990', 'Probni', 'Dukatas',"
				+ " 'M', date '1983-03-03', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566d1', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql(award(A_MEMBER + ", " + A_RUN_DUCAT + ", 'raceCount', 100, 118, 'always', null, null"))
				.update();
	}

	static List<Violation> violations() {
		return List.of(
				/* THE ELEVEN QUANTITIES. A codebook and not a list in a CHECK, so this is a
				   primary key and a shape, and nothing else. */
				Violation.notNull("ducat_kind_code_not_null", "code",
						"insert into ducat_kind (code) values (null)"),
				Violation.of("ducat_kind_pk", "insert into ducat_kind (code) values ('totalKm')"),
				Violation.of("ducat_kind_code_shape", "insert into ducat_kind (code) values ('total_km')"),

				/* THE BADGE ITSELF. */
				Violation.notNull("ducat_id_not_null", "id",
						"insert into ducat (id, " + DUCAT_COLUMNS + ") values (null, 'duk-nov', 'Nov',"
								+ " 'points', 500, 'season', 2, 0, 0, 0, " + A_DRAWING + ")"),
				Violation.of("ducat_pk",
						"insert into ducat (id, " + DUCAT_COLUMNS + ") select id, 'duk-nov', 'Nov',"
								+ " 'points', 500, 'season', 2, 0, 0, 0, " + A_DRAWING
								+ " from ducat limit 1"),

				Violation.notNull("ducat_code_not_null", "code",
						ducat("null, 'Nov', 'points', 500, 'season', 2, 0, 0, 0")),
				Violation.of("ducat_code_unique",
						ducat("'duk-maratoni', 'Nov', 'points', 500, 'season', 2, 0, 0, 0")),
				Violation.of("ducat_code_shape",
						ducat("'Duk Nov', 'Nov', 'points', 500, 'season', 2, 0, 0, 0")),
				Violation.notNull("ducat_name_not_null", "name",
						ducat("'duk-nov', null, 'points', 500, 'season', 2, 0, 0, 0")),
				Violation.of("ducat_name_not_blank",
						ducat("'duk-nov', '   ', 'points', 500, 'season', 2, 0, 0, 0")),

				/* A quantity nobody computes, which is the whole reason the kinds are a table. */
				Violation.notNull("ducat_kind_not_null", "kind",
						ducat("'duk-nov', 'Nov', null, 500, 'season', 2, 0, 0, 0")),
				Violation.of("ducat_kind_fk",
						ducat("'duk-nov', 'Nov', 'brojCipela', 500, 'season', 2, 0, 0, 0")),

				Violation.notNull("ducat_threshold_not_null", "threshold",
						ducat("'duk-nov', 'Nov', 'points', null, 'season', 2, 0, 0, 0")),
				Violation.of("ducat_threshold_positive",
						ducat("'duk-nov', 'Nov', 'points', 0, 'season', 2, 0, 0, 0")),

				Violation.notNull("ducat_period_not_null", "period",
						ducat("'duk-nov', 'Nov', 'points', 500, null, 2, 0, 0, 0")),
				Violation.of("ducat_period_known",
						ducat("'duk-nov', 'Nov', 'points', 500, 'week', 2, 0, 0, 0")),

				Violation.notNull("ducat_tier_not_null", "tier",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', null, 0, 0, 0")),
				Violation.of("ducat_tier_in_range",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 6, 0, 0, 0")),

				/* THE RUN, AND EVERY WAY IT CAN BE HALF OF ONE. */
				Violation.notNull("ducat_step_not_null", "step",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, null, 0, 0")),
				/* A step going backwards, written as a WHOLE run - an end above the start and
				   a tier rise inside it - so that this is the only thing the row breaks. Written
				   the short way first, with no end, it broke `a_run_has_an_end` instead and named
				   the wrong constraint. */
				Violation.of("ducat_step_not_negative",
						runDucat("'duk-nov', 'Nov', 'points', 500, 'season', 2, -10, 1000, 600")),
				Violation.notNull("ducat_last_not_null", "last",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 0, null, 0")),
				/* An end with no step, written with `tier_up_from` at nought so that the tier
				   check is satisfied and this is the only thing the row breaks. */
				Violation.of("ducat_a_run_has_an_end",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 0, 1000, 0")),
				/* And a step with no end, which is the other half of the same biconditional. */
				Violation.of("ducat_a_run_has_an_end",
						runDucat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 100, 0, 600")),
				/* A run that does not land on its own end: 25 to 250 in steps of 40. */
				Violation.of("ducat_a_run_is_a_whole_number_of_steps",
						runDucat("'duk-nov', 'Nov', 'raceCount', 25, 'always', 3, 40, 250, 125")),

				Violation.notNull("ducat_tier_up_from_not_null", "tier_up_from",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 0, 0, null")),
				/* The tier rising before the run starts, and after it ends. */
				Violation.of("ducat_tier_rises_inside_the_run",
						runDucat("'duk-nov', 'Nov', 'raceCount', 100, 'always', 3, 100, 1000, 50")),
				Violation.of("ducat_tier_rises_inside_the_run",
						runDucat("'duk-nov', 'Nov', 'raceCount', 100, 'always', 3, 100, 1000, 1100")),
				/* And a badge that is not a run at all, claiming a tier rise. */
				Violation.of("ducat_tier_rises_inside_the_run",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 0, 0, 250")),
				/* And a tier that rises BETWEEN two pieces of the run: a hundred races every
				   hundred to a thousand, with the tier rising at a hundred and thirty-seven,
				   which is not a threshold anybody can reach. Found by a round on 11.09.2026. */
				Violation.of("ducat_tier_rises_inside_the_run",
						runDucat("'duk-nov', 'Nov', 'raceCount', 100, 'always', 3, 100, 1000, 137")),

				/* THE COIN IT IS STRUCK ON, which V27 added.

				   Each row below is a legitimate condition - `points`, 500, one threshold - with
				   exactly one thing wrong about the drawing, so the constraint it names is the
				   only thing it can break. The order of the seven values is the order of
				   DRAWING_COLUMNS, and A_DRAWING is what they say when nothing is wrong. */
				Violation.notNull("ducat_top_not_null", "top",
						drawnAs(A_PLAIN_CONDITION, "null, '', 'DOLE', 'none', 'points', 'none', ''")),
				Violation.notNull("ducat_top_female_not_null", "top_female",
						drawnAs(A_PLAIN_CONDITION, "'GORE', null, 'DOLE', 'none', 'points', 'none', ''")),
				Violation.notNull("ducat_bottom_not_null", "bottom",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', null, 'none', 'points', 'none', ''")),
				Violation.notNull("ducat_period_at_not_null", "period_at",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', 'DOLE', null, 'points', 'none', ''")),
				Violation.notNull("ducat_mark_not_null", "mark",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', 'DOLE', 'none', null, 'none', ''")),
				Violation.notNull("ducat_art_not_null", "art",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', 'DOLE', 'none', 'points', null, ''")),
				Violation.notNull("ducat_counted_not_null", "counted",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', 'DOLE', 'none', 'points', 'none', null")),

				/* A fourth place for the period, which is a lay-out and not a value. */
				Violation.of("ducat_period_at_known",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', 'DOLE', 'middle', 'points', 'none', ''")),
				/* AN EIGHTH MARK, and it is refused although no ducat uses the seventh either:
				   what the check names is the seven paths `DucatArt.tsx` can draw, so an eighth
				   is a drawing somebody has to make rather than a word somebody adds. Widening
				   the list to let this row in is what this case exists to go red for. */
				Violation.of("ducat_mark_known",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', 'DOLE', 'none', 'medal', 'none', ''")),
				/* And a fourth artwork, for the same reason. */
				Violation.of("ducat_art_known",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', 'DOLE', 'none', 'points', 'medal', ''")),

				/* THE ARC THE PERIOD TAKES IS THE ARC THAT IS EMPTY, and each arc is refused
				   from BOTH sides: a legend written where the period stands, and an arc left
				   blank with the period somewhere else. One direction alone would let half of
				   each rule be dropped without a word. */
				Violation.of("ducat_top_is_empty_exactly_when_the_period_is_there",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', 'DOLE', 'top', 'points', 'none', ''")),
				Violation.of("ducat_top_is_empty_exactly_when_the_period_is_there",
						drawnAs(A_PLAIN_CONDITION, "'', '', 'DOLE', 'none', 'points', 'none', ''")),
				Violation.of("ducat_bottom_is_empty_exactly_when_the_period_is_there",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', 'DOLE', 'bottom', 'points', 'none', ''")),
				Violation.of("ducat_bottom_is_empty_exactly_when_the_period_is_there",
						drawnAs(A_PLAIN_CONDITION, "'GORE', '', '', 'none', 'points', 'none', ''")),

				/* A UNIT WITHOUT A RUN, and a run without a unit. Both halves again, and this
				   is the one rule of the seven that a new column cannot satisfy on its own:
				   `step` is V15's and decides which half applies. */
				Violation.of("ducat_a_run_says_what_it_counts",
						drawnAs(A_PLAIN_CONDITION, A_RUNS_DRAWING)),
				Violation.of("ducat_a_run_says_what_it_counts",
						drawnAs("'duk-nov', 'Nov', 'points', 500, 'season', 2, 100, 1000, 600",
								A_DRAWING)),

				/* And a woman's legend that says exactly what the man's says, which is a coin
				   drawn twice rather than a wording anybody decided. */
				Violation.of("ducat_a_womans_legend_says_something_else",
						drawnAs(A_PLAIN_CONDITION, "'GORE', 'GORE', 'DOLE', 'none', 'points', 'none',"
								+ " ''")),

				/* WHO HAS WON WHICH. */
				Violation.notNull("ducat_award_id_not_null", "id",
						"insert into ducat_award (id, " + AWARD_COLUMNS + ") values (null, " + A_MEMBER
								+ ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, 'season', 2027, null)"),
				Violation.of("ducat_award_pk",
						"insert into ducat_award (id, " + AWARD_COLUMNS + ") select id, " + A_MEMBER
								+ ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, 'season', 2028, null"
								+ " from ducat_award limit 1"),

				Violation.notNull("ducat_award_competitor_id_not_null", "competitor_id",
						award("null, " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, 'season', 2027, null")),
				Violation.of("ducat_award_competitor_fk",
						award("999999, " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, 'season', 2027, null")),
				Violation.notNull("ducat_award_ducat_id_not_null", "ducat_id",
						award(A_MEMBER + ", null, 'totalKm', 1000, 1200, 'season', 2027, null")),
				Violation.of("ducat_award_ducat_fk",
						award(A_MEMBER + ", 999999, 'totalKm', 1000, 1200, 'season', 2027, null")),
				Violation.notNull("ducat_award_awarded_at_not_null", "awarded_at",
						"insert into ducat_award (" + AWARD_COLUMNS + ", awarded_at) values (" + A_MEMBER
								+ ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, 'season', 2027, null,"
								+ " null)"),

				Violation.notNull("ducat_award_kind_not_null", "kind",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", null, 1000, 1200, 'season', 2027, null")),
				Violation.of("ducat_award_kind_fk",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'brojCipela', 1000, 1200, 'season',"
								+ " 2027, null")),
				Violation.notNull("ducat_award_threshold_not_null", "threshold",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', null, 1200, 'season', 2027,"
								+ " null")),
				Violation.of("ducat_award_threshold_positive",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 0, 1200, 'season', 2027,"
								+ " null")),
				Violation.notNull("ducat_award_reached_not_null", "reached",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, null, 'season', 2027,"
								+ " null")),
				/* Won without reaching it, which is the one thing an award must never say. */
				Violation.of("ducat_award_reached_meets_the_threshold",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 999, 'season', 2027,"
								+ " null")),

				Violation.notNull("ducat_award_period_not_null", "period",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, null, 2027,"
								+ " null")),
				Violation.of("ducat_award_period_known",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, 'week', 2027,"
								+ " null")),

				/* WHICH PERIOD IT WAS WON IN, in both directions. A badge that stands for ever
				   belongs to no season, and one that does not, does. */
				Violation.of("ducat_award_a_period_says_its_season",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, 'season', null,"
								+ " null")),
				Violation.of("ducat_award_a_period_says_its_season",
						award(A_MEMBER + ", " + A_RUN_DUCAT + ", 'raceCount', 200, 210, 'always', 2027,"
								+ " null")),
				Violation.of("ducat_award_only_a_month_says_its_month",
						award(A_MEMBER + ", " + A_MONTH_DUCAT + ", 'totalKm', 125, 130, 'month', 2027,"
								+ " null")),
				Violation.of("ducat_award_only_a_month_says_its_month",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, 'season', 2027,"
								+ " 4")),
				Violation.of("ducat_award_season_not_before_the_league",
						award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1200, 'season', 2026,"
								+ " null")),
				Violation.of("ducat_award_month_in_the_year",
						award(A_MEMBER + ", " + A_MONTH_DUCAT + ", 'totalKm', 125, 130, 'month', 2027, 13")),

				/* AND WON ONCE. The probe holds "Sve trke, 100" with no season at all, which is
				   the case NULLS NOT DISTINCT is for: without it two rows with a null season do
				   not collide and the badge is won twice. */
				Violation.of("ducat_award_won_once",
						award(A_MEMBER + ", " + A_RUN_DUCAT + ", 'raceCount', 100, 150, 'always', null,"
								+ " null")));
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
		return List.of(GOOD_DUCAT, GOOD_RUN, GOOD_AWARD, GOOD_MONTH_AWARD);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * The fifteen the migration writes are the fifteen the portal draws, and every
	 * one of them goes in under its own constraints.
	 *
	 * <p>Which is not the same as the file having fifteen INSERT lines: a row that
	 * broke a check would have stopped the migration, so this is really a count read
	 * back. Two of them are runs, thirteen are not, and the tiers run one to five -
	 * all three are facts somebody could quietly break while editing the list.
	 */
	@Test
	void theFifteenAreThereAndTwoOfThemAreRuns() {
		assertThat(db.sql("select count(*) from ducat").query(Long.class).single()).isEqualTo(15L);
		assertThat(db.sql("select count(*) from ducat where step > 0").query(Long.class).single())
				.as("a run was flattened into a single threshold, or one was invented")
				.isEqualTo(2L);
		assertThat(db.sql("select min(tier) || '-' || max(tier) from ducat").query(String.class).single())
				.as("the tiers no longer run one to five")
				.isEqualTo("1-5");
		assertThat(db.sql("select count(*) from ducat_kind").query(Long.class).single()).isEqualTo(11L);
	}

	/**
	 * THE FIFTEEN ARE THE FIFTEEN THE PORTAL DRAWS, read out of the portal rather than
	 * remembered.
	 *
	 * <p>The migration invites exactly this check - "fifteen rows fit on a screen and a
	 * reader can check them against what he sees on the portal" - and until a round on
	 * 11.09.2026 nothing did it. The only thing that noticed a changed name was the
	 * migration's checksum, and a checksum says the file was touched, never that a
	 * value in it is right. It had already drifted once: the migration called
	 * `duk-uspon` "Uspon" while the portal calls it "Karmanov uspon".
	 *
	 * <p>The portal's copy is read off the working tree rather than the classpath,
	 * because it belongs to the other half of the repository and this build has no
	 * other way to reach it. That is the boundary: this ties the two while they live
	 * side by side, and would have to be rewritten the day they do not.
	 */
	@Test
	void theFifteenAreTheFifteenThePortalDraws() throws Exception {
		java.nio.file.Path drawn = java.nio.file.Path.of("..", "frontend", "public", "mock", "ducats.json");

		assertThat(drawn)
				.as("the portal's own copy is not where this expects it, so the two are no longer tied")
				.exists();

		/* THE JSON IS PARSED BY POSTGRES, not by a library added for this one case. Spring Boot
		   4 does not bring jackson-databind with the web starter, and a dependency taken on for a
		   test is a dependency the whole application then carries. The database is already here
		   and already parses JSON, so the comparison is done where both sides can be named. */
		String drawnText = java.nio.file.Files.readString(drawn, java.nio.charset.StandardCharsets.UTF_8);

		java.util.Map<String, String> theirs = new java.util.TreeMap<>();
		db.sql("select one ->> 'id' as code, concat_ws('|', one ->> 'name', one ->> 'kind',"
				+ " one ->> 'value', one ->> 'top', one ->> 'topFemale', one ->> 'bottom',"
				+ " one ->> 'periodAt', one ->> 'mark', one ->> 'art', one ->> 'counted') as says"
				+ " from jsonb_array_elements(cast(? as jsonb)) as one")
				.param(drawnText)
				.query((rs, one) -> java.util.Map.entry(rs.getString("code"), rs.getString("says")))
				.list()
				.forEach(entry -> theirs.put(entry.getKey(), entry.getValue()));

		java.util.Map<String, String> ours = new java.util.TreeMap<>();
		db.sql("select code, name, kind, threshold, top, top_female, bottom, period_at, mark, art,"
				+ " counted from ducat")
				.query((rs, one) -> java.util.Map.entry(rs.getString("code"),
						String.join("|", rs.getString("name"), rs.getString("kind"),
								rs.getBigDecimal("threshold").stripTrailingZeros().toPlainString(),
								rs.getString("top"), rs.getString("top_female"), rs.getString("bottom"),
								rs.getString("period_at"), rs.getString("mark"), rs.getString("art"),
								rs.getString("counted"))))
				.list()
				.forEach(entry -> ours.put(entry.getKey(), entry.getValue()));

		assertThat(ours)
				.as("a badge in the schema is not the badge the portal draws under the same code")
				.isEqualTo(theirs);
	}

	/** The codes of the rows a sentence about the fifteen is true of, in catalogue order. */
	private List<String> codesWhere(String condition) {
		return db.sql("select code from ducat where " + condition + " order by id")
				.query(String.class)
				.list();
	}

	/**
	 * THE FOUR THINGS THE DRAWING SAYS, EACH IN BOTH OF ITS STATES, AND THE ROWS IN
	 * EACH STATE NAMED.
	 *
	 * <p><b>Why this is not the comparison above said twice.</b> That one holds the
	 * schema against {@code ducats.json}, so it is right about every value and silent
	 * about every state: an edit that moved a ducat from one state to the other in BOTH
	 * copies passes it without a word. Here the states are written out, and each is
	 * written out as the owner decided it rather than as the file happens to be today.
	 *
	 * <ul>
	 * <li><b>Which arc the period takes.</b> PDL, 10.08.2026, the owner's own words:
	 * „kod 1 i 3 period je dole, kod 2, 4, 5 i 6 gore". Two below, four above, nine
	 * neither - and those nine are the families that do not repeat.</li>
	 * <li><b>Whether the legend changes for a woman.</b> PDL, 11.08.2026: „Rod ima osam
	 * porodica, ne tri. Uz 7, 14 i 15, i pet klubova od sto trka." Eight, and this is
	 * the case that says WHICH eight, because a count of eight is true of any eight.</li>
	 * <li><b>Whether the family is a run.</b> V15's `step` decides, and the unit follows
	 * it: two runs with a unit, thirteen without.</li>
	 * <li><b>Whether a drawing takes the middle instead of the number.</b> PDL,
	 * 10.08.2026: „Dve porodice, 7 i 15, u sredini nose crtež umesto broja."</li>
	 * </ul>
	 *
	 * <p><b>Where the floor under these lists is.</b> Not in the lists: in the count of
	 * fifteen at the top, in {@code containsExactly}, which refuses a row that joined a
	 * state as loudly as one that left it, and in the CHECK constraints, which make the
	 * three states of the period and the three artworks exhaustive. A sixteenth ducat
	 * would have to appear in one of the lists below and cannot appear in none.
	 */
	@Test
	void everyStateOfTheDrawingIsHeldByTheRowsNamedHere() {
		assertThat(db.sql("select count(*) from ducat").query(Long.class).single())
				.as("the fifteen are not fifteen, so the lists below are about another catalogue")
				.isEqualTo(15L);

		assertThat(codesWhere("period_at = 'bottom'"))
				.as("the families whose period stands on the bottom arc")
				.containsExactly("duk-mesecni-km", "duk-sezonski-km");
		assertThat(codesWhere("period_at = 'top'"))
				.as("the families whose period stands on the top arc")
				.containsExactly("duk-mesecni-sati", "duk-sezonski-bodovi", "duk-sezonski-sati",
						"duk-sezonske-trke");
		assertThat(codesWhere("period_at = 'none'"))
				.as("the families that do not repeat, so their period stands on neither arc")
				.containsExactly("duk-drzave", "duk-sve-trke", "duk-krace-trke", "duk-polumaratoni",
						"duk-duze-trke", "duk-maratoni", "duk-uspon", "duk-ultramaratoni",
						"duk-obim-planete");

		assertThat(codesWhere("top_female <> ''"))
				.as("the eight families whose top legend is worded differently for a woman")
				.containsExactly("duk-drzave", "duk-krace-trke", "duk-polumaratoni", "duk-duze-trke",
						"duk-maratoni", "duk-uspon", "duk-ultramaratoni", "duk-obim-planete");
		assertThat(codesWhere("top_female = ''"))
				.as("and the seven that read the same to everybody")
				.hasSize(7);

		assertThat(db.sql("select code || '=' || counted from ducat where step > 0 order by id")
				.query(String.class).list())
				.as("the two runs, and what a piece of each is counted in")
				.containsExactly("duk-drzave=država", "duk-sve-trke=trka");
		assertThat(codesWhere("step = 0 and counted = ''"))
				.as("and the thirteen that are one ducat, which count no pieces")
				.hasSize(13);

		assertThat(db.sql("select code || '=' || art from ducat where art <> 'none' order by id")
				.query(String.class).list())
				.as("the two families that carry a drawing in the middle instead of a number")
				.containsExactly("duk-uspon=galaxy", "duk-obim-planete=globe");
		assertThat(codesWhere("art = 'none'"))
				.as("and the thirteen whose middle is the threshold, written out")
				.hasSize(13);

		assertThat(db.sql("select distinct mark from ducat order by mark").query(String.class).list())
				.as("the fifteen no longer use every one of the seven marks the check allows, so the"
						+ " check has a word in it nothing draws, or the portal draws a mark the"
						+ " catalogue does not use")
				.containsExactly("club", "countries", "distance", "points", "races", "time",
						"vertical");
	}

	/**
	 * Every kind a badge names is a kind that exists, and every kind that exists is
	 * named by a badge.
	 *
	 * <p>The first half is the foreign key and needs no test. The second is not, and
	 * it is what says the codebook is the eleven the portal computes rather than a
	 * place where a twelfth can be left lying: a kind nothing uses is either a badge
	 * somebody forgot to write or a word that should not be there.
	 */
	@Test
	void everyKindIsUsedByAtLeastOneBadge() {
		assertThat(db.sql("select code from ducat_kind where not exists"
				+ " (select 1 from ducat where ducat.kind = ducat_kind.code) order by code")
				.query(String.class)
				.list())
				.as("a quantity nothing is awarded for")
				.isEmpty();
	}

	/**
	 * A run can be won at every one of its thresholds, and only once at each.
	 *
	 * <p>This is what the badge is FOR: a hundred races and then two hundred are two
	 * recognitions, not one. The unique key is over the threshold as well as the
	 * badge, and a key that forgot the threshold would refuse the second.
	 */
	@Test
	void aRunIsWonAgainAtEveryThreshold() {
		assertThat(db.sql(award(A_MEMBER + ", " + A_RUN_DUCAT + ", 'raceCount', 200, 214, 'always', null,"
				+ " null")).update())
				.as("the second threshold of a run could not be won")
				.isOne();
		assertThat(db.sql(award(A_MEMBER + ", " + A_RUN_DUCAT + ", 'raceCount', 300, 301, 'always', null,"
				+ " null")).update()).isOne();
	}

	/**
	 * A period badge is won again in the next period, and the same one twice is
	 * refused.
	 */
	@Test
	void aPeriodBadgeIsWonAgainInTheNextPeriod() {
		db.sql(GOOD_AWARD).update();

		assertThat(db.sql(award(A_MEMBER + ", " + A_SEASON_DUCAT + ", 'totalKm', 1000, 1100, 'season',"
				+ " 2028, null")).update())
				.as("the same badge could not be won in the next season")
				.isOne();

		assertThatThrownBy(() -> db.sql(GOOD_AWARD).update())
				.as("the same badge was won twice in the same season")
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("ducat_award_won_once");
	}

	/**
	 * A badge nobody has won may be deleted, and one somebody has won may not.
	 *
	 * <p>What was won stays won. The key is RESTRICT rather than CASCADE on purpose:
	 * rewriting the list of badges must not quietly take away recognitions, and
	 * somebody has to decide what happens to them instead.
	 */
	@Test
	void aBadgeSomebodyHasWonCannotBeDeleted() {
		assertThat(db.sql("delete from ducat where code = 'duk-maratoni'").update())
				.as("a badge nobody has won could not be deleted")
				.isOne();

		assertThatThrownBy(() -> db.sql("delete from ducat where code = 'duk-sve-trke'").update())
				.as("deleting a badge took somebody's recognition with it")
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("ducat_award_ducat_fk");
	}

	/**
	 * And the member may go, and his recognitions go with him.
	 *
	 * <p>PDL P23 again. A badge is his data as much as a result is.
	 */
	@Test
	void deletingTheMemberTakesHisBadgesWithHim() {
		assertThat(db.sql("select count(*) from ducat_award").query(Long.class).single()).isOne();

		assertThat(db.sql("delete from competitor where member_number = '000990'").update()).isOne();

		assertThat(db.sql("select count(*) from ducat_award").query(Long.class).single())
				.as("a recognition outlived the member who won it")
				.isZero();
	}
}

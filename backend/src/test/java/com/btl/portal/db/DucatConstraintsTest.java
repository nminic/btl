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
 * Every constraint the three tables of V15 carry, with the row that breaks it.
 *
 * <p>A badge is a recognition and carries no points (PDL), so nothing here touches
 * scoring. What it does carry is a CONDITION, and the condition is data rather than
 * code (ADL A12): this much of this quantity, within this period.
 *
 * <p>Two of the fifteen are not one threshold but a run of them - countries every ten
 * to a hundred, races every hundred to a thousand - and the tier rises part way
 * through, which is the owner's own correction of 10.08.2026. Half of this file is
 * about that run being a whole run rather than half of one.
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

	private static final String DUCAT_COLUMNS =
			"code, name, kind, threshold, period, tier, step, last, tier_up_from";
	private static final String AWARD_COLUMNS =
			"competitor_id, ducat_id, kind, threshold, reached, period, season, month";

	private static String ducat(String values) {
		return "insert into ducat (" + DUCAT_COLUMNS + ") values (" + values + ")";
	}

	private static String award(String values) {
		return "insert into ducat_award (" + AWARD_COLUMNS + ") values (" + values + ")";
	}

	/** One threshold and nothing after it, which is thirteen of the fifteen. */
	private static final String GOOD_DUCAT =
			ducat("'duk-probni', 'Probni dukat', 'points', 500, 'season', 2, 0, 0, 0");
	/** And a run, with the tier rising in the middle of it. */
	private static final String GOOD_RUN =
			ducat("'duk-probna-serija', 'Probna serija', 'raceCount', 25, 'always', 3, 25, 250, 125");

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
								+ " 'points', 500, 'season', 2, 0, 0, 0)"),
				Violation.of("ducat_pk",
						"insert into ducat (id, " + DUCAT_COLUMNS + ") select id, 'duk-nov', 'Nov',"
								+ " 'points', 500, 'season', 2, 0, 0, 0 from ducat limit 1"),

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
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, -10, 1000, 600")),
				Violation.notNull("ducat_last_not_null", "last",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 0, null, 0")),
				/* An end with no step, written with `tier_up_from` at nought so that the tier
				   check is satisfied and this is the only thing the row breaks. */
				Violation.of("ducat_a_run_has_an_end",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 0, 1000, 0")),
				/* And a step with no end, which is the other half of the same biconditional. */
				Violation.of("ducat_a_run_has_an_end",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 100, 0, 600")),
				/* A run that does not land on its own end: 25 to 250 in steps of 40. */
				Violation.of("ducat_a_run_is_a_whole_number_of_steps",
						ducat("'duk-nov', 'Nov', 'raceCount', 25, 'always', 3, 40, 250, 125")),

				Violation.notNull("ducat_tier_up_from_not_null", "tier_up_from",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 0, 0, null")),
				/* The tier rising before the run starts, and after it ends. */
				Violation.of("ducat_tier_rises_inside_the_run",
						ducat("'duk-nov', 'Nov', 'raceCount', 100, 'always', 3, 100, 1000, 50")),
				Violation.of("ducat_tier_rises_inside_the_run",
						ducat("'duk-nov', 'Nov', 'raceCount', 100, 'always', 3, 100, 1000, 1100")),
				/* And a badge that is not a run at all, claiming a tier rise. */
				Violation.of("ducat_tier_rises_inside_the_run",
						ducat("'duk-nov', 'Nov', 'points', 500, 'season', 2, 0, 0, 250")),
				/* And a tier that rises BETWEEN two pieces of the run: a hundred races every
				   hundred to a thousand, with the tier rising at a hundred and thirty-seven,
				   which is not a threshold anybody can reach. Found by a round on 11.09.2026. */
				Violation.of("ducat_tier_rises_inside_the_run",
						ducat("'duk-nov', 'Nov', 'raceCount', 100, 'always', 3, 100, 1000, 137")),

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
		db.sql("select one ->> 'id' as code, (one ->> 'name') || '|' || (one ->> 'kind') || '|'"
				+ " || (one ->> 'value') as says from jsonb_array_elements(cast(? as jsonb)) as one")
				.param(drawnText)
				.query((rs, one) -> java.util.Map.entry(rs.getString("code"), rs.getString("says")))
				.list()
				.forEach(entry -> theirs.put(entry.getKey(), entry.getValue()));

		java.util.Map<String, String> ours = new java.util.TreeMap<>();
		db.sql("select code, name, kind, threshold from ducat")
				.query((rs, one) -> java.util.Map.entry(rs.getString("code"),
						rs.getString("name") + "|" + rs.getString("kind") + "|"
								+ rs.getBigDecimal("threshold").stripTrailingZeros().toPlainString()))
				.list()
				.forEach(entry -> ours.put(entry.getKey(), entry.getValue()));

		assertThat(ours)
				.as("a badge in the schema is not the badge the portal draws under the same code")
				.isEqualTo(theirs);
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

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
 * Every constraint the three tables of V11 carry, with the row that breaks it.
 *
 * <p>Three tables and one sentence each. `team` is a group with a standing, and
 * it is not a club: a club is one optional line on a member's profile with no
 * page and no rights, so it is not here at all. `team_membership` is O3 word for
 * word - member, team, season from, season to, reason for leaving - and it
 * carries the one rule the whole file turns on, that a member is in one team at a
 * time. `team_proposal` is what somebody sent to moderation, and it is a new team
 * or an edit of an existing one told apart by whether `team_id` is there.
 *
 * <p>Seasons and not dates, because every rule written about a team is written in
 * seasons: membership takes effect on 1 January, and a team founded during a
 * season collects from the next one.
 */
class TeamConstraintsTest extends DatabaseTest {

	/**
	 * One row that must be rejected, and the constraint that has to be the reason.
	 *
	 * {@code evidence} is what the database says when that constraint is the one
	 * that fired: its own name for a CHECK, a key or an exclusion, and the column
	 * for a NOT NULL.
	 */
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

	/**
	 * The three tables V11 adds.
	 *
	 * Package visible because
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()}
	 * adds this list to the same list in every sibling and compares them against
	 * {@code pg_tables}. The column V11 adds to `verification` is not this file's:
	 * it is guarded in {@link VerificationConstraintsTest}, where that table's own
	 * floor reads it.
	 */
	static final List<String> TABLES = List.of("team", "team_membership", "team_proposal");

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_COUNTRY = "(select id from country where code = 'RS')";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000950')";
	private static final String ANOTHER_MEMBER = "(select id from competitor where member_number = '000951')";
	private static final String A_TEAM = "(select id from team where slug = 'probni-tim')";
	private static final String ANOTHER_TEAM = "(select id from team where slug = 'drugi-probni-tim')";
	private static final String A_LOGO = "(select id from photo where digest ="
			+ " 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String TEAM_COLUMNS =
			"slug, name, bio, link, place_id, city, country_id, logo_id, first_season, admin_id";
	private static final String MEMBERSHIP_COLUMNS =
			"competitor_id, team_id, season_from, season_to, left_reason";
	private static final String PROPOSAL_COLUMNS =
			"competitor_id, team_id, name, bio, link, place_id, city, country_id, logo_id";

	private static String team(String values) {
		return "insert into team (" + TEAM_COLUMNS + ") values (" + values + ")";
	}

	private static String membership(String values) {
		return "insert into team_membership (" + MEMBERSHIP_COLUMNS + ") values (" + values + ")";
	}

	private static String proposal(String values) {
		return "insert into team_proposal (" + PROPOSAL_COLUMNS + ") values (" + values + ")";
	}

	/** A team with a town out of the codebook, a mark, and an administrator. */
	private static final String GOOD_TEAM = team("'treci-probni-tim', 'Treci probni tim', 'Trcimo sredom.',"
			+ " 'https://tim.rs', " + A_TOWN + ", null, null, " + A_LOGO + ", 2027, " + A_MEMBER);
	/** And one with a town typed by hand, no mark, no link and nobody named to administer it. */
	private static final String GOOD_TEAM_TYPED_TOWN = team("'cetvrti-probni-tim', 'Cetvrti probni tim', '',"
			+ " '', null, 'Zaselak', " + A_COUNTRY + ", null, 2028, null");

	/** Still in the team, so it says neither when he left nor why. */
	private static final String GOOD_MEMBERSHIP = membership(ANOTHER_MEMBER + ", " + A_TEAM + ", 2029, null, null");
	/** And one that ended, which says both. */
	private static final String GOOD_MEMBERSHIP_ENDED =
			membership(ANOTHER_MEMBER + ", " + ANOTHER_TEAM + ", 2027, 2028, 'Presao u drugi tim'");

	/** A new team: no `team_id`. */
	private static final String GOOD_PROPOSAL = proposal(A_MEMBER + ", null, 'Predlozen tim',"
			+ " 'Okupljamo se nedeljom.', 'https://predlog.rs', " + A_TOWN + ", null, null, null");
	/** An edit of one that exists: `team_id` filled, and that is the whole of the mark. */
	private static final String GOOD_PROPOSAL_EDIT = proposal(A_MEMBER + ", " + A_TEAM + ", 'Probni tim',"
			+ " 'Nov opis.', '', null, 'Zaselak', " + A_COUNTRY + ", " + A_LOGO);

	/**
	 * Two members, a mark, two teams, one membership and one proposal.
	 *
	 * The class is transactional and rolled back, so this is written afresh for
	 * every case. Two of everything that a key or an exclusion can collide with:
	 * a primary key cannot be broken against an empty table, and "one team at a
	 * time" cannot be broken without a membership already standing there.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000950', 'Probni', 'Osnivac', 'M',"
				+ " date '1987-07-07', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '0011223344556680', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000951', 'Druga', 'Clanica', 'F',"
				+ " date '1993-03-03', null, 'Zaselak', " + A_COUNTRY + ", 2027, false, true, 'feeExempt',"
				+ " '0011223344556681', null, '', false, 'none', 'Otac', 'Ulica 2', 'S',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter) values"
				+ " ('image/png', 20480, 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',"
				+ " 0.2, 0.8, 0.6)").update();

		db.sql(team("'probni-tim', 'Probni tim', 'Opis.', '', " + A_TOWN + ", null, null, null, 2027, "
				+ A_MEMBER)).update();
		db.sql(team("'drugi-probni-tim', 'Drugi probni tim', '', '', null, 'Zaselak', " + A_COUNTRY
				+ ", null, 2027, null")).update();

		/* The founder, in his own team from the season it starts collecting. This is what the
		   exclusion case collides with, and what says the probe is not empty. */
		db.sql(membership(A_MEMBER + ", " + A_TEAM + ", 2027, null, null")).update();

		db.sql(proposal(A_MEMBER + ", null, 'Zatecen predlog', '', '', " + A_TOWN + ", null, null, null"))
				.update();
	}

	static List<Violation> teamViolations() {
		return List.of(
				Violation.notNull("team_id_not_null", "id",
						"insert into team (id, " + TEAM_COLUMNS + ") values (null, 'nov-tim', 'Nov tim', '', '', "
								+ A_TOWN + ", null, null, null, 2027, null)"),
				Violation.of("team_pk",
						"insert into team (id, " + TEAM_COLUMNS + ") select id, 'nov-tim', 'Nov tim', '', '', "
								+ A_TOWN + ", null, null, null, 2027, null from team limit 1"),

				/* The address, which is how a team is looked up. */
				Violation.notNull("team_slug_not_null", "slug",
						team("null, 'Nov tim', '', '', " + A_TOWN + ", null, null, null, 2027, null")),
				Violation.of("team_slug_unique",
						team("'probni-tim', 'Nov tim', '', '', " + A_TOWN + ", null, null, null, 2027, null")),
				Violation.of("team_slug_shape",
						team("'Nije Slug', 'Nov tim', '', '', " + A_TOWN + ", null, null, null, 2027, null")),

				Violation.notNull("team_name_not_null", "name",
						team("'nov-tim', null, '', '', " + A_TOWN + ", null, null, null, 2027, null")),
				Violation.of("team_name_not_blank",
						team("'nov-tim', '   ', '', '', " + A_TOWN + ", null, null, null, 2027, null")),
				Violation.notNull("team_bio_not_null", "bio",
						team("'nov-tim', 'Nov tim', null, '', " + A_TOWN + ", null, null, null, 2027, null")),
				Violation.notNull("team_link_not_null", "link",
						team("'nov-tim', 'Nov tim', '', null, " + A_TOWN + ", null, null, null, 2027, null")),
				Violation.of("team_link_shape",
						team("'nov-tim', 'Nov tim', '', 'tim.rs', " + A_TOWN + ", null, null, null, 2027, null")),

				/* THE TOWN, IN BOTH DIRECTIONS AND IN THREE PARTS, the same three every town in
				   this schema carries since V7. A team with none cannot be placed, and a team with
				   both has two answers to one question. */
				Violation.of("team_town_is_from_the_codebook_or_typed",
						team("'nov-tim', 'Nov tim', '', '', null, null, null, null, 2027, null")),
				Violation.of("team_town_is_from_the_codebook_or_typed",
						team("'nov-tim', 'Nov tim', '', '', " + A_TOWN + ", 'Zaselak', " + A_COUNTRY
								+ ", null, 2027, null")),
				Violation.of("team_typed_town_names_its_country",
						team("'nov-tim', 'Nov tim', '', '', null, 'Zaselak', null, null, 2027, null")),
				Violation.of("team_typed_town_names_its_country",
						team("'nov-tim', 'Nov tim', '', '', " + A_TOWN + ", null, " + A_COUNTRY
								+ ", null, 2027, null")),
				Violation.of("team_city_not_blank",
						team("'nov-tim', 'Nov tim', '', '', null, '   ', " + A_COUNTRY + ", null, 2027, null")),
				Violation.of("team_place_fk",
						team("'nov-tim', 'Nov tim', '', '', 999999, null, null, null, 2027, null")),
				Violation.of("team_country_fk",
						team("'nov-tim', 'Nov tim', '', '', null, 'Zaselak', 999999, null, 2027, null")),

				Violation.of("team_logo_fk",
						team("'nov-tim', 'Nov tim', '', '', " + A_TOWN + ", null, null, 999999, 2027, null")),
				Violation.of("team_admin_fk",
						team("'nov-tim', 'Nov tim', '', '', " + A_TOWN + ", null, null, null, 2027, 999999")),

				/* The season it starts collecting in, which is never before the league exists. */
				Violation.notNull("team_first_season_not_null", "first_season",
						team("'nov-tim', 'Nov tim', '', '', " + A_TOWN + ", null, null, null, null, null")),
				Violation.of("team_first_season_not_before_the_league",
						team("'nov-tim', 'Nov tim', '', '', " + A_TOWN + ", null, null, null, 2026, null")));
	}

	static List<Violation> membershipViolations() {
		return List.of(
				Violation.notNull("team_membership_id_not_null", "id",
						"insert into team_membership (id, " + MEMBERSHIP_COLUMNS + ") values (null, "
								+ ANOTHER_MEMBER + ", " + A_TEAM + ", 2030, null, null)"),
				Violation.of("team_membership_pk",
						"insert into team_membership (id, " + MEMBERSHIP_COLUMNS + ") select id, "
								+ ANOTHER_MEMBER + ", " + A_TEAM + ", 2030, null, null from team_membership limit 1"),

				Violation.notNull("team_membership_competitor_id_not_null", "competitor_id",
						membership("null, " + A_TEAM + ", 2030, null, null")),
				Violation.of("team_membership_competitor_fk",
						membership("999999, " + A_TEAM + ", 2030, null, null")),
				Violation.notNull("team_membership_team_id_not_null", "team_id",
						membership(ANOTHER_MEMBER + ", null, 2030, null, null")),
				Violation.of("team_membership_team_fk",
						membership(ANOTHER_MEMBER + ", 999999, 2030, null, null")),

				Violation.notNull("team_membership_season_from_not_null", "season_from",
						membership(ANOTHER_MEMBER + ", " + A_TEAM + ", null, null, null")),
				Violation.of("team_membership_season_from_not_before_the_league",
						membership(ANOTHER_MEMBER + ", " + A_TEAM + ", 2026, null, null")),

				/* Leaving before joining, written with a reason so that the biconditional below is
				   satisfied and this is the only thing the row breaks. */
				Violation.of("team_membership_did_not_leave_before_joining",
						membership(ANOTHER_MEMBER + ", " + A_TEAM + ", 2031, 2030, 'Presao'")),

				/* And the two halves of "leaving is a season and a reason together". */
				Violation.of("team_membership_leaving_says_why",
						membership(ANOTHER_MEMBER + ", " + A_TEAM + ", 2030, 2031, null")),
				Violation.of("team_membership_leaving_says_why",
						membership(ANOTHER_MEMBER + ", " + A_TEAM + ", 2030, null, 'Presao'")),
				Violation.of("team_membership_left_reason_not_blank",
						membership(ANOTHER_MEMBER + ", " + A_TEAM + ", 2030, 2031, '   '")),

				/* THE SENTENCE THE WHOLE TABLE IS FOR. The probe already has the founder in one
				   team from 2027 with no end, so every one of these overlaps it. The first joins a
				   second team in the same season; the second joins one that started earlier and has
				   not ended; the third ends in 2027, which is the one season they share. A unique
				   key over the member could say none of this, and a partial one over open rows
				   would let the third through. */
				Violation.of("team_membership_one_team_at_a_time",
						membership(A_MEMBER + ", " + ANOTHER_TEAM + ", 2027, null, null")),
				Violation.of("team_membership_one_team_at_a_time",
						membership(A_MEMBER + ", " + ANOTHER_TEAM + ", 2035, null, null")),
				Violation.of("team_membership_one_team_at_a_time",
						membership(A_MEMBER + ", " + ANOTHER_TEAM + ", 2025 + 2, 2027, 'Presao'")));
	}

	static List<Violation> proposalViolations() {
		return List.of(
				Violation.notNull("team_proposal_id_not_null", "id",
						"insert into team_proposal (id, " + PROPOSAL_COLUMNS + ") values (null, " + A_MEMBER
								+ ", null, 'Predlog', '', '', " + A_TOWN + ", null, null, null)"),
				Violation.of("team_proposal_pk",
						"insert into team_proposal (id, " + PROPOSAL_COLUMNS + ") select id, " + A_MEMBER
								+ ", null, 'Predlog', '', '', " + A_TOWN
								+ ", null, null, null from team_proposal limit 1"),

				Violation.notNull("team_proposal_competitor_id_not_null", "competitor_id",
						proposal("null, null, 'Predlog', '', '', " + A_TOWN + ", null, null, null")),
				Violation.of("team_proposal_competitor_fk",
						proposal("999999, null, 'Predlog', '', '', " + A_TOWN + ", null, null, null")),
				/* An edit of a team that does not exist. */
				Violation.of("team_proposal_team_fk",
						proposal(A_MEMBER + ", 999999, 'Predlog', '', '', " + A_TOWN + ", null, null, null")),

				Violation.notNull("team_proposal_name_not_null", "name",
						proposal(A_MEMBER + ", null, null, '', '', " + A_TOWN + ", null, null, null")),
				Violation.of("team_proposal_name_not_blank",
						proposal(A_MEMBER + ", null, '   ', '', '', " + A_TOWN + ", null, null, null")),
				Violation.notNull("team_proposal_bio_not_null", "bio",
						proposal(A_MEMBER + ", null, 'Predlog', null, '', " + A_TOWN + ", null, null, null")),
				Violation.notNull("team_proposal_link_not_null", "link",
						proposal(A_MEMBER + ", null, 'Predlog', '', null, " + A_TOWN + ", null, null, null")),
				Violation.of("team_proposal_link_shape",
						proposal(A_MEMBER + ", null, 'Predlog', '', 'tim.rs', " + A_TOWN + ", null, null, null")),

				Violation.of("team_proposal_town_is_from_the_codebook_or_typed",
						proposal(A_MEMBER + ", null, 'Predlog', '', '', null, null, null, null")),
				Violation.of("team_proposal_town_is_from_the_codebook_or_typed",
						proposal(A_MEMBER + ", null, 'Predlog', '', '', " + A_TOWN + ", 'Zaselak', "
								+ A_COUNTRY + ", null")),
				Violation.of("team_proposal_typed_town_names_its_country",
						proposal(A_MEMBER + ", null, 'Predlog', '', '', null, 'Zaselak', null, null")),
				Violation.of("team_proposal_typed_town_names_its_country",
						proposal(A_MEMBER + ", null, 'Predlog', '', '', " + A_TOWN + ", null, " + A_COUNTRY
								+ ", null")),
				Violation.of("team_proposal_city_not_blank",
						proposal(A_MEMBER + ", null, 'Predlog', '', '', null, '   ', " + A_COUNTRY + ", null")),
				Violation.of("team_proposal_place_fk",
						proposal(A_MEMBER + ", null, 'Predlog', '', '', 999999, null, null, null")),
				Violation.of("team_proposal_country_fk",
						proposal(A_MEMBER + ", null, 'Predlog', '', '', null, 'Zaselak', 999999, null")),
				Violation.of("team_proposal_logo_fk",
						proposal(A_MEMBER + ", null, 'Predlog', '', '', " + A_TOWN + ", null, null, 999999")));
	}

	static List<Violation> violations() {
		return List.of(teamViolations(), membershipViolations(), proposalViolations()).stream()
				.flatMap(List::stream)
				.toList();
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/**
	 * The floor under the lists above, read out of the database rather than
	 * remembered.
	 *
	 * A constraint added to the migration without a row above fails here, and a row
	 * above naming one that has been dropped fails here too.
	 */
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

	/**
	 * And every shape the portal can actually produce goes in.
	 *
	 * Without this every constraint above could be replaced by one that rejects
	 * everything and the file would still be green. Six rows, two per table,
	 * because each table has exactly one thing that may be present or absent: the
	 * town of a team, whether a membership has ended, and whether a proposal is a
	 * new team or an edit.
	 */
	static List<String> legitimateRows() {
		return List.of(GOOD_TEAM, GOOD_TEAM_TYPED_TOWN, GOOD_MEMBERSHIP, GOOD_MEMBERSHIP_ENDED,
				GOOD_PROPOSAL, GOOD_PROPOSAL_EDIT);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * The same member may be in two teams one after the other, which is the half
	 * the exclusion must NOT refuse.
	 *
	 * <p>Every case above proves it refuses an overlap. If the range arithmetic were
	 * off by one - `season_to` read as exclusive rather than as the last season he
	 * is in - this is what would fail: leaving at the end of 2030 and joining
	 * another team in 2031 touches nothing, and the portal does exactly that every
	 * 1 January.
	 */
	@Test
	void leavingOneTeamAndJoiningAnotherTheNextSeasonIsNotAnOverlap() {
		assertThat(db.sql("update team_membership set season_to = 2030, left_reason = 'Presao'"
				+ " where competitor_id = " + A_MEMBER).update()).isOne();

		assertThat(db.sql(membership(A_MEMBER + ", " + ANOTHER_TEAM + ", 2031, null, null")).update())
				.as("joining another team the season after leaving was refused as an overlap")
				.isOne();
	}

	/**
	 * And two members may be in the same team in the same season, which is the
	 * other half.
	 *
	 * <p>An exclusion written without {@code competitor_id with =} would be a rule
	 * about seasons alone and would let one member into a team and nobody else.
	 */
	@Test
	void twoMembersMayBeInTheSameTeamInTheSameSeason() {
		assertThat(db.sql(membership(ANOTHER_MEMBER + ", " + A_TEAM + ", 2027, null, null")).update())
				.as("a second member could not join a team somebody is already in")
				.isOne();
	}

	/**
	 * A team goes and takes its membership rows with it, and leaves the members.
	 *
	 * <p>P13: "Brisanje tima ne dira istoriju." What survives a deleted team is the
	 * frozen season, which is its own tables of hardcoded values (A37), so these
	 * rows are not that history and go with the team. The members themselves are
	 * untouched: deleting a team is not deleting anybody.
	 */
	@Test
	void deletingTheTeamTakesItsMembershipsAndLeavesItsMembers() {
		assertThat(db.sql("select count(*) from team_membership where team_id = " + A_TEAM)
				.query(Long.class)
				.single())
				.as("nobody was in the team before the delete, so an empty table afterwards says nothing")
				.isOne();

		assertThat(db.sql("delete from team where slug = 'probni-tim'").update()).isOne();

		assertThat(db.sql("select count(*) from team_membership").query(Long.class).single())
				.as("a membership outlived the team it was in")
				.isZero();
		assertThat(db.sql("select count(*) from competitor").query(Long.class).single())
				.as("deleting a team deleted people")
				.isEqualTo(2L);
	}

	/**
	 * The named administrator may have his account deleted, and the team stays
	 * without one.
	 *
	 * <p>PDL P23 gives every member the right to be deleted, and a team
	 * administrator is a member. The seat empties rather than the delete failing,
	 * and who administers the team is then read off the memberships - which is a
	 * query and not a column, and therefore not this file's to prove.
	 *
	 * <p>This is the same finding a round on 11.09.2026 returned against V9, where a
	 * check demanded that a decided row name an account and the key emptied it.
	 * Here nothing demands it, and this measures that.
	 */
	@Test
	void theAdministratorMayGoAndTheTeamStays() {
		db.sql("delete from team_membership").update();

		assertThat(db.sql("delete from competitor where member_number = '000950'").update())
				.as("a member who administers a team can no longer have his account deleted")
				.isOne();

		assertThat(db.sql("select count(*) from team where admin_id is null").query(Long.class).single())
				.as("the team went with its administrator, or kept pointing at a member who is gone")
				.isEqualTo(2L);
	}

	/**
	 * A proposal is a new team or an edit, and the only thing that says which is
	 * whether `team_id` is there.
	 *
	 * <p>Owner, 04.09.2026: an edit goes into the same queue as a new team, "uz
	 * oznaku sta je sta". This measures that the mark is the column and not a word
	 * beside it: both rows go in, and they differ in exactly one value.
	 */
	@Test
	void theSameTableHoldsANewTeamAndAnEditOfOne() {
		db.sql(GOOD_PROPOSAL).update();
		db.sql(GOOD_PROPOSAL_EDIT).update();

		assertThat(db.sql("select count(*) from team_proposal where team_id is null").query(Long.class).single())
				.as("a new team is not the row with no team on it")
				.isEqualTo(2L);
		assertThat(db.sql("select count(*) from team_proposal where team_id is not null")
				.query(Long.class)
				.single())
				.as("an edit is not the row that names the team it edits")
				.isOne();
	}
}

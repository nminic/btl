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
 * Every constraint the four tables of V12 carry, with the row that breaks it.
 *
 * <p>Two ways into a team and two people into a pair. The applications and the
 * invitations are two tables rather than one with a direction, because they are
 * not the same fact: an application is a member offering himself and is answered
 * by the team, an invitation is the team offering itself and is answered by the
 * member.
 *
 * <p>The one thing worth reading twice is how the racing pair is kept mixed. A
 * CHECK cannot read another table, so "one man and one woman" looks like a rule
 * the schema cannot hold. It can: the two gender columns are generated constants,
 * and the foreign keys point at {@code competitor (id, gender)}. A member whose
 * gender is not 'M' simply has no row with that id and that gender, so the key
 * refuses him.
 */
class JoiningConstraintsTest extends DatabaseTest {

	/**
	 * One row that must be rejected, and the constraint that has to be the reason.
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
	 * The four tables V12 adds.
	 *
	 * The key it adds to `competitor` is not this file's: `competitor` belongs to
	 * {@link AxisConstraintsTest}, whose own floor reads it.
	 */
	static final List<String> TABLES =
			List.of("team_application", "team_invitation", "racing_pair", "pair_invite");

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_COUNTRY = "(select id from country where code = 'RS')";

	private static final String A_MAN = "(select id from competitor where member_number = '000960')";
	private static final String ANOTHER_MAN = "(select id from competitor where member_number = '000961')";
	private static final String A_WOMAN = "(select id from competitor where member_number = '000962')";
	private static final String ANOTHER_WOMAN =
			"(select id from competitor where member_number = '000963')";
	private static final String A_TEAM = "(select id from team where slug = 'tim-za-uclanjenje')";
	private static final String ANOTHER_TEAM = "(select id from team where slug = 'drugi-tim-za-uclanjenje')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static String application(String values) {
		return "insert into team_application (competitor_id, team_id, season) values (" + values + ")";
	}

	private static String invitation(String values) {
		return "insert into team_invitation (team_id, competitor_id, season) values (" + values + ")";
	}

	private static String pair(String values) {
		return "insert into racing_pair (season, man_id, woman_id) values (" + values + ")";
	}

	private static String invite(String values) {
		return "insert into pair_invite (from_id, to_id) values (" + values + ")";
	}

	private static final String GOOD_APPLICATION = application(ANOTHER_MAN + ", " + A_TEAM + ", 2028");
	private static final String GOOD_INVITATION = invitation(ANOTHER_TEAM + ", " + ANOTHER_MAN + ", 2028");
	private static final String GOOD_PAIR = pair("2028, " + ANOTHER_MAN + ", " + A_WOMAN);
	private static final String GOOD_INVITE = invite(A_WOMAN + ", " + ANOTHER_MAN);

	/**
	 * Three members of two genders, two teams, and one of each row already there.
	 *
	 * Two men and one woman, because a pair needs one of each and a second man is
	 * what lets a case say "another man" without using the one the standing pair
	 * already holds. Every unique key below collides with a row written here, and
	 * against an empty table none of them could.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000960', 'Prvi', 'Trkac', 'M',"
				+ " date '1986-06-06', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '0011223344556690', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000961', 'Drugi', 'Trkac', 'M',"
				+ " date '1991-01-01', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '0011223344556691', null, '', false, 'none', 'Otac', 'Ulica 2', 'L',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000962', 'Prva', 'Trkacica', 'F',"
				+ " date '1994-04-04', null, 'Zaselak', " + A_COUNTRY + ", 2027, false, true, 'payment',"
				+ " '0011223344556692', null, '', false, 'none', 'Otac', 'Ulica 3', 'S',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		/* A SECOND WOMAN, and she is here for one case only. Without her, "the same man again
		   in the same season" can only be written with the same woman too - so the row breaks
		   BOTH unique keys and PostgreSQL reports whichever it checks first, which means the
		   case for the man's key could pass while naming the woman's. Found by a round on
		   11.09.2026, and it is the class this file spends most of its length guarding. */
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000963', 'Druga', 'Trkacica',"
				+ " 'F', date '1996-06-06', null, 'Zaselak', " + A_COUNTRY + ", 2027, false, true,"
				+ " 'payment', '0011223344556693', null, '', false, 'none', 'Otac', 'Ulica 4', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('tim-za-uclanjenje', 'Tim za uclanjenje', '', '', " + A_TOWN
				+ ", null, null, null, 2027, null)").update();
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('drugi-tim-za-uclanjenje', 'Drugi tim', '', '', " + A_TOWN
				+ ", null, null, null, 2027, null)").update();

		db.sql(application(A_MAN + ", " + A_TEAM + ", 2027")).update();
		db.sql(invitation(A_TEAM + ", " + A_MAN + ", 2027")).update();
		db.sql(pair("2027, " + A_MAN + ", " + A_WOMAN)).update();
		db.sql(invite(A_MAN + ", " + A_WOMAN)).update();
	}

	static List<Violation> violations() {
		return List.of(
				/* THE APPLICATION: a member offering himself to a team. */
				Violation.notNull("team_application_id_not_null", "id",
						"insert into team_application (id, competitor_id, team_id, season) values (null, "
								+ ANOTHER_MAN + ", " + A_TEAM + ", 2028)"),
				Violation.of("team_application_pk",
						"insert into team_application (id, competitor_id, team_id, season) select id, "
								+ ANOTHER_MAN + ", " + A_TEAM + ", 2028 from team_application limit 1"),
				Violation.notNull("team_application_competitor_id_not_null", "competitor_id",
						application("null, " + A_TEAM + ", 2028")),
				Violation.of("team_application_competitor_fk", application("999999, " + A_TEAM + ", 2028")),
				Violation.notNull("team_application_team_id_not_null", "team_id",
						application(ANOTHER_MAN + ", null, 2028")),
				Violation.of("team_application_team_fk", application(ANOTHER_MAN + ", 999999, 2028")),
				Violation.notNull("team_application_season_not_null", "season",
						application(ANOTHER_MAN + ", " + A_TEAM + ", null")),
				Violation.of("team_application_season_not_before_the_league",
						application(ANOTHER_MAN + ", " + A_TEAM + ", 2026")),
				Violation.notNull("team_application_asked_at_not_null", "asked_at",
						"insert into team_application (competitor_id, team_id, season, asked_at) values ("
								+ ANOTHER_MAN + ", " + A_TEAM + ", 2028, null)"),
				/* Asking the same team for the same season twice is the same question. */
				Violation.of("team_application_asked_once", application(A_MAN + ", " + A_TEAM + ", 2027")),

				/* THE INVITATION: the team offering itself to a member. */
				Violation.notNull("team_invitation_id_not_null", "id",
						"insert into team_invitation (id, team_id, competitor_id, season) values (null, "
								+ A_TEAM + ", " + ANOTHER_MAN + ", 2028)"),
				Violation.of("team_invitation_pk",
						"insert into team_invitation (id, team_id, competitor_id, season) select id, "
								+ A_TEAM + ", " + ANOTHER_MAN + ", 2028 from team_invitation limit 1"),
				Violation.notNull("team_invitation_team_id_not_null", "team_id",
						invitation("null, " + ANOTHER_MAN + ", 2028")),
				Violation.of("team_invitation_team_fk", invitation("999999, " + ANOTHER_MAN + ", 2028")),
				Violation.notNull("team_invitation_competitor_id_not_null", "competitor_id",
						invitation(A_TEAM + ", null, 2028")),
				Violation.of("team_invitation_competitor_fk", invitation(A_TEAM + ", 999999, 2028")),
				Violation.notNull("team_invitation_season_not_null", "season",
						invitation(A_TEAM + ", " + ANOTHER_MAN + ", null")),
				Violation.of("team_invitation_season_not_before_the_league",
						invitation(A_TEAM + ", " + ANOTHER_MAN + ", 2026")),
				Violation.notNull("team_invitation_sent_at_not_null", "sent_at",
						"insert into team_invitation (team_id, competitor_id, season, sent_at) values ("
								+ A_TEAM + ", " + ANOTHER_MAN + ", 2028, null)"),
				Violation.of("team_invitation_sent_once", invitation(A_TEAM + ", " + A_MAN + ", 2027")),

				/* THE PAIR, AND WHAT MAKES IT MIXED. The first two rows put the wrong gender
				   in each column: a woman where the key demands 'M' and a man where it demands
				   'F'. Neither is refused by a CHECK - there is none - but by the key finding
				   no row in `competitor` with that id and that gender. */
				Violation.notNull("racing_pair_id_not_null", "id",
						"insert into racing_pair (id, season, man_id, woman_id) values (null, 2028, "
								+ ANOTHER_MAN + ", " + A_WOMAN + ")"),
				Violation.of("racing_pair_pk",
						"insert into racing_pair (id, season, man_id, woman_id) select id, 2028, "
								+ ANOTHER_MAN + ", " + A_WOMAN + " from racing_pair limit 1"),
				Violation.notNull("racing_pair_season_not_null", "season",
						pair("null, " + ANOTHER_MAN + ", " + A_WOMAN)),
				Violation.notNull("racing_pair_man_id_not_null", "man_id",
						pair("2028, null, " + A_WOMAN)),
				Violation.notNull("racing_pair_woman_id_not_null", "woman_id",
						pair("2028, " + ANOTHER_MAN + ", null")),
				Violation.of("racing_pair_man_fk", pair("2028, " + A_WOMAN + ", " + A_WOMAN)),
				Violation.of("racing_pair_man_fk", pair("2028, 999999, " + A_WOMAN)),
				Violation.of("racing_pair_woman_fk", pair("2028, " + ANOTHER_MAN + ", " + A_MAN)),
				Violation.of("racing_pair_woman_fk", pair("2028, " + ANOTHER_MAN + ", 999999")),
				/* The same man, a DIFFERENT woman, the same season: this breaks his key and only his.
				   Written with the same woman it broke both, and named whichever PostgreSQL happened
				   to check first. */
				Violation.of("racing_pair_one_man_a_season", pair("2027, " + A_MAN + ", " + ANOTHER_WOMAN)),
				Violation.of("racing_pair_one_woman_a_season", pair("2027, " + ANOTHER_MAN + ", " + A_WOMAN)),
				Violation.of("racing_pair_season_not_before_the_league",
						pair("2026, " + ANOTHER_MAN + ", " + A_WOMAN)),
				Violation.notNull("racing_pair_made_at_not_null", "made_at",
						"insert into racing_pair (season, man_id, woman_id, made_at) values (2028, "
								+ ANOTHER_MAN + ", " + A_WOMAN + ", null)"),

				/* THE ASKING, which carries no season and no gender: the rule is about the
				   pair, and a question that turns out to be impossible is answered "no" rather
				   than refused by the database. */
				Violation.notNull("pair_invite_id_not_null", "id",
						"insert into pair_invite (id, from_id, to_id) values (null, " + A_WOMAN + ", "
								+ ANOTHER_MAN + ")"),
				Violation.of("pair_invite_pk",
						"insert into pair_invite (id, from_id, to_id) select id, " + A_WOMAN + ", "
								+ ANOTHER_MAN + " from pair_invite limit 1"),
				Violation.notNull("pair_invite_from_id_not_null", "from_id",
						invite("null, " + ANOTHER_MAN)),
				Violation.of("pair_invite_from_fk", invite("999999, " + ANOTHER_MAN)),
				Violation.notNull("pair_invite_to_id_not_null", "to_id", invite(A_WOMAN + ", null")),
				Violation.of("pair_invite_to_fk", invite(A_WOMAN + ", 999999")),
				Violation.of("pair_invite_two_people", invite(A_WOMAN + ", " + A_WOMAN)),
				Violation.of("pair_invite_asked_once", invite(A_MAN + ", " + A_WOMAN)),
				Violation.notNull("pair_invite_sent_at_not_null", "sent_at",
						"insert into pair_invite (from_id, to_id, sent_at) values (" + A_WOMAN + ", "
								+ ANOTHER_MAN + ", null)"));
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/**
	 * The floor under the list above, read out of the database rather than
	 * remembered.
	 */
	@Test
	void everyConstraintOnTheFourTablesHasARowThatBreaksIt() {
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

	/** And one row of each kind goes in. */
	static List<String> legitimateRows() {
		return List.of(GOOD_APPLICATION, GOOD_INVITATION, GOOD_PAIR, GOOD_INVITE);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * The pair is mixed because the database says so, and this is what that
	 * actually buys.
	 *
	 * <p>Two rows above prove it refuses a woman in {@code man_id} and a man in
	 * {@code woman_id}. This proves the generated columns really carry the
	 * constants rather than something a writer could set: they are read back, and
	 * no INSERT above ever mentioned them.
	 */
	@Test
	void theGenderColumnsAreConstantsNobodyWrote() {
		assertThat(db.sql("select man_gender || woman_gender from racing_pair").query(String.class).single())
				.as("the gender columns are not the constants the keys are built on")
				.isEqualTo("MF");

		assertThatThrownBy(() -> db.sql("update racing_pair set man_gender = 'F'").update())
				.as("a generated column accepted a value, so the keys guard nothing")
				.isInstanceOf(Exception.class);
	}

	/**
	 * A member who is in a pair cannot change his gender, and that is the
	 * database's rule rather than a choice.
	 *
	 * <p>A foreign key containing a generated column may not cascade an update,
	 * because cascading would write into a generated column. What is left refuses.
	 * The answer is right anyway: a pair that is no longer mixed is not a pair, and
	 * somebody has to decide which of the two it stops being.
	 */
	@Test
	void aMemberInAPairCannotChangeHisGender() {
		assertThatThrownBy(() -> db.sql("update competitor set gender = 'F' where member_number = '000960'")
				.update())
				.as("gender changed under a pair, which would leave a pair that is not mixed")
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("racing_pair_man_fk");
	}

	/**
	 * And once the pair is gone he can, which is the half that says the refusal
	 * above is about the pair and not about gender being immutable.
	 *
	 * <p>Its own case and not two lines under the one above, because the class is
	 * transactional: after a statement the database refuses, every next statement in
	 * that transaction comes back with "current transaction is aborted" rather than
	 * with what it would really have done, so an assertion written after an expected
	 * failure measures nothing. Found by writing it the wrong way first.
	 */
	@Test
	void andOnceThePairIsGoneHeCan() {
		db.sql("delete from racing_pair").update();

		assertThat(db.sql("update competitor set gender = 'F' where member_number = '000960'").update())
				.as("gender could not be changed even with no pair standing")
				.isOne();
	}

	/**
	 * The same two people may pair again in another season, and the same member may
	 * pair with somebody else.
	 *
	 * <p>Which is what says the two unique keys are over the season and the member
	 * together, not over the member alone. A key over `man_id` by itself would let
	 * somebody have one pair ever.
	 */
	@Test
	void oneMemberMayHaveAPairInEverySeasonAndADifferentPartnerInEachOne() {
		assertThat(db.sql(pair("2028, " + A_MAN + ", " + A_WOMAN)).update())
				.as("the same two could not pair again the next season")
				.isOne();
		assertThat(db.sql(pair("2029, " + A_MAN + ", " + A_WOMAN)).update()).isOne();
	}

	/**
	 * Deleting a member takes everything he asked for, was asked, and paired into.
	 *
	 * <p>PDL P23 again, and it is measured over all four tables at once because all
	 * four hang off the same person.
	 */
	@Test
	void deletingTheMemberTakesEveryAskingWithHim() {
		assertThat(db.sql("select count(*) from team_application").query(Long.class).single()).isOne();

		assertThat(db.sql("delete from competitor where member_number = '000960'").update()).isOne();

		assertThat(db.sql("select (select count(*) from team_application) + (select count(*) from"
				+ " team_invitation) + (select count(*) from racing_pair) + (select count(*) from"
				+ " pair_invite)").query(Long.class).single())
				.as("something he asked for, was asked, or paired into outlived him")
				.isZero();
	}

	/**
	 * And the OTHER side of every one of those goes too.
	 *
	 * <p>The case above deletes the man, who is the `from` of the invite and the
	 * `man_id` of the pair. This deletes the woman, who is the `to` and the
	 * `woman_id` - and until a round on 11.09.2026 found it, no test in this file
	 * ever ran a DELETE from that side at all. The catalogue test in
	 * CompetitorEventRaceAndResultTest would have caught the rule being changed, but
	 * not here, and not by actually deleting anybody.
	 */
	@Test
	void andDeletingTheOtherSideTakesThemToo() {
		assertThat(db.sql("select (select count(*) from racing_pair) + (select count(*) from"
				+ " pair_invite)").query(Long.class).single())
				.as("nothing was standing on her before the delete, so an empty table says nothing")
				.isEqualTo(2L);

		assertThat(db.sql("delete from competitor where member_number = '000962'").update()).isOne();

		assertThat(db.sql("select (select count(*) from racing_pair) + (select count(*) from"
				+ " pair_invite)").query(Long.class).single())
				.as("a pair or a request outlived the woman in it")
				.isZero();
	}

	/**
	 * Deleting a team takes the asking with it, and leaves the members.
	 */
	@Test
	void deletingTheTeamTakesTheAskingAndLeavesThePeople() {
		assertThat(db.sql("delete from team where slug = 'tim-za-uclanjenje'").update()).isOne();

		assertThat(db.sql("select (select count(*) from team_application) + (select count(*) from"
				+ " team_invitation)").query(Long.class).single())
				.as("an application or an invitation outlived the team it was about")
				.isZero();
		assertThat(db.sql("select count(*) from competitor").query(Long.class).single()).isEqualTo(4L);
	}
}

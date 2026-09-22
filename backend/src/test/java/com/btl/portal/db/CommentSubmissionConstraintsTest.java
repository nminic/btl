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
 * Every constraint on the table a waiting comment sits in, with the row that breaks it.
 *
 * <p>The doslovni presedan V10 set for a waiting result and V11 for a waiting team
 * proposal, moved one queue over (ADL A64 A1, 22.09.2026): a table for the thing before it
 * becomes the thing, in the shape {@code event_comment} takes, so an approval can copy the
 * row across without deciding anything on the way. Two other readings were measured and
 * refused - a pointer straight to {@code event_comment} (it has no filter for a comment
 * still waiting, so it would be public the moment it was written) and three rating columns
 * on {@code verification} itself (V9 says that table does not model what a tab is about,
 * and three columns for one tab of six is exactly that).
 */
class CommentSubmissionConstraintsTest extends DatabaseTest {

	/**
	 * One row that must be rejected, and the constraint that has to be the reason.
	 *
	 * {@code evidence} is what the database says when that constraint is the one that
	 * fired: its own name for a CHECK or a key, and the column for a NOT NULL.
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
	 * The one table V30 adds for a waiting comment.
	 *
	 * Package visible for the same reason every sibling's is:
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()} adds this
	 * list to the same list in every sibling and compares them against {@code pg_tables}.
	 * The column V30 adds to {@code verification} is not this file's: it is guarded in
	 * {@link VerificationConstraintsTest}, where that table's own floor reads it.
	 */
	static final List<String> TABLES = List.of("comment_submission");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000950')";

	private static final String AN_EVENT = "(select id from btl_event where slug = 'probni-dogadjaj-cs')";

	private static final String ANOTHER_EVENT =
			"(select id from btl_event where slug = 'drugi-dogadjaj-cs')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS =
			"event_id, competitor_id, rating_organisation, rating_value, rating_ambience, body";

	/** Rated, with a member behind it. */
	private static final String GOOD_RATED =
			row(AN_EVENT + ", " + A_MEMBER + ", 4, 5, 3, 'Odlicna staza'");
	/** Unrated - a comment nobody has marked yet, nought on all three, which V7 already
	 *  allows on {@code event_comment} and this table has to allow too, since an approval
	 *  copies it straight across. */
	private static final String GOOD_UNRATED =
			row(ANOTHER_EVENT + ", " + A_MEMBER + ", 0, 0, 0, ''");

	private static String row(String values) {
		return "insert into comment_submission (" + COLUMNS + ") values (" + values + ")";
	}

	/**
	 * A member and two events to point at.
	 *
	 * The class is transactional and rolled back, so this is written afresh for every case.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000950', 'Probni', 'Clan', 'M',"
				+ " date '1990-05-05', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566e0', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
				+ " values ('probni-dogadjaj-cs', 'Probni dogadjaj', date '2027-04-04', " + A_TOWN
				+ ", 'race', false, '', '')").update();
		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
				+ " values ('drugi-dogadjaj-cs', 'Drugi dogadjaj', date '2027-05-05', " + A_TOWN
				+ ", 'race', false, '', '')").update();

		db.sql(GOOD_RATED).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("comment_submission_id_not_null", "id",
						"insert into comment_submission (id, " + COLUMNS + ") values (null, " + AN_EVENT
								+ ", " + A_MEMBER + ", 0, 0, 0, '')"),
				Violation.of("comment_submission_pk",
						"insert into comment_submission (id, " + COLUMNS + ") select id, " + AN_EVENT + ", "
								+ A_MEMBER + ", 0, 0, 0, '' from comment_submission limit 1"),

				Violation.notNull("comment_submission_event_id_not_null", "event_id",
						row("null, " + A_MEMBER + ", 0, 0, 0, ''")),
				Violation.of("comment_submission_event_fk",
						row("999999, " + A_MEMBER + ", 0, 0, 0, ''")),

				/* NOT NULL as of ADL A64 A6, 22.09.2026: a comment can only be about a
				   member who wrote it, never about nobody - PDL P6, „Komentare vide samo
				   prijavljeni clanovi" (3320 and 3252 make the same point), the
				   opposite of the reading `schedule_proposal.competitor_id` gets (PDL 1582),
				   which stays nullable. The FK below catches the other half of the same
				   column: a member who is not there, as opposed to one left out. */
				Violation.notNull("comment_submission_competitor_id_not_null", "competitor_id",
						row(AN_EVENT + ", null, 0, 0, 0, ''")),
				Violation.of("comment_submission_competitor_fk",
						row(AN_EVENT + ", 999999, 0, 0, 0, ''")),

				Violation.notNull("comment_submission_rating_organisation_not_null", "rating_organisation",
						row(AN_EVENT + ", " + A_MEMBER + ", null, 0, 0, ''")),
				Violation.of("comment_submission_organisation_in_scale",
						row(AN_EVENT + ", " + A_MEMBER + ", 6, 0, 0, ''")),
				Violation.of("comment_submission_organisation_in_scale",
						row(AN_EVENT + ", " + A_MEMBER + ", -1, 0, 0, ''")),

				Violation.notNull("comment_submission_rating_value_not_null", "rating_value",
						row(AN_EVENT + ", " + A_MEMBER + ", 0, null, 0, ''")),
				Violation.of("comment_submission_value_in_scale",
						row(AN_EVENT + ", " + A_MEMBER + ", 0, 6, 0, ''")),
				Violation.of("comment_submission_value_in_scale",
						row(AN_EVENT + ", " + A_MEMBER + ", 0, -1, 0, ''")),

				Violation.notNull("comment_submission_rating_ambience_not_null", "rating_ambience",
						row(AN_EVENT + ", " + A_MEMBER + ", 0, 0, null, ''")),
				Violation.of("comment_submission_ambience_in_scale",
						row(AN_EVENT + ", " + A_MEMBER + ", 0, 0, 6, ''")),
				Violation.of("comment_submission_ambience_in_scale",
						row(AN_EVENT + ", " + A_MEMBER + ", 0, 0, -1, ''")),

				Violation.notNull("comment_submission_body_not_null", "body",
						row(AN_EVENT + ", " + A_MEMBER + ", 0, 0, 0, null")));
	}

	@ParameterizedTest
	@MethodSource("violations")
	void theConstraintRejectsTheRowThatBreaksIt(Violation violation) {
		assertThatThrownBy(() -> db.sql(violation.sql()).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining(violation.evidence());
	}

	/**
	 * The floor under the list above, read out of the database rather than remembered.
	 *
	 * A constraint added to the migration without a row above fails here, and a row above
	 * naming one that has been dropped fails here too.
	 */
	@Test
	void everyConstraintOnTheSubmissionHasARowThatBreaksIt() {
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
	 * Rated and unrated both go in - the two shapes an approval has to copy across without
	 * deciding anything. About nobody used to be a third; ADL A64 A6 made
	 * {@code competitor_id} not null, and {@code comment_submission_competitor_id_not_null}
	 * above now proves that shape is rejected, not accepted.
	 *
	 * Without this every constraint above could be replaced by one that rejects everything
	 * and the file would still be green.
	 */
	static List<String> legitimateRows() {
		return List.of(GOOD_RATED, GOOD_UNRATED);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * The event goes, and the submission goes with it - „a verification row whose subject
	 * is gone is a decision about nothing" (V10), applied one table earlier.
	 */
	@Test
	void deletingTheEventTakesTheSubmissionWithIt() {
		assertThat(db.sql("select count(*) from comment_submission").query(Long.class).single())
				.as("nothing was waiting before the delete, so an empty table afterwards says nothing")
				.isOne();

		assertThat(db.sql("delete from btl_event where slug = 'probni-dogadjaj-cs'").update()).isOne();

		assertThat(db.sql("select count(*) from comment_submission").query(Long.class).single())
				.as("the submission outlived the event it was written about")
				.isZero();
	}

	/**
	 * The member goes, and every comment he was waiting to have published goes with him - a
	 * waiting comment does not outlive its member, the same as a waiting result (V10) and
	 * unlike a PUBLISHED one, which V7 tombstones instead.
	 */
	@Test
	void deletingTheMemberTakesTheSubmissionWithHim() {
		assertThat(db.sql("select count(*) from comment_submission").query(Long.class).single())
				.as("nothing was waiting before the delete, so an empty table afterwards says nothing")
				.isOne();

		assertThat(db.sql("delete from competitor where member_number = '000950'").update()).isOne();

		assertThat(db.sql("select count(*) from comment_submission").query(Long.class).single())
				.as("a deleted member left a comment waiting in the queue")
				.isZero();
	}
}

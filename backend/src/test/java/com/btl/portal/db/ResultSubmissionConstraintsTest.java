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
 * Every constraint on the table a waiting result sits in, with the row that
 * breaks it.
 *
 * <p>The table exists because O11 leaves a run nowhere to wait: a refused report
 * never becomes a result, so `result` carries no state and cannot hold one that is
 * still being judged. What the whole file is really about is the one column that
 * may be absent, `race_id`. The portal asks for a run in two ways - from a race
 * that is in the calendar, and from one the member describes because it is not -
 * and this is one table for both, held apart by a biconditional in the shape
 * `competitor` and `btl_event` already hold a town in.
 *
 * <p>Which is why most of the rows below come in pairs. Half a biconditional lets
 * a submission name a race twice or not at all, and neither half fails on its own.
 */
class ResultSubmissionConstraintsTest extends DatabaseTest {

	/**
	 * One row that must be rejected, and the constraint that has to be the reason.
	 *
	 * {@code evidence} is what the database says when that constraint is the one
	 * that fired: its own name for a CHECK or a key, and the column for a NOT NULL.
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
	 * The one table V10 adds.
	 *
	 * Package visible because
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()}
	 * adds this list to the same list in every sibling and compares them against
	 * {@code pg_tables}: that is the floor that lets each of these files name its
	 * tables by hand. The column V10 adds to `verification` is not this file's: it
	 * is guarded in {@link VerificationConstraintsTest}, where that table's own
	 * floor reads it.
	 */
	static final List<String> TABLES = List.of("result_submission");

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String A_COUNTRY = "(select id from country where code = 'RS')";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000940')";
	private static final String A_RACE = "(select id from race where name = 'Probna trka')";
	private static final String RACE_DAY = "date '2027-04-04'";
	private static final String ANOTHER_DAY = "date '2027-05-05'";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS = "competitor_id, race_id, race_date, race_name, race_kind,"
			+ " place_id, city, country_id, distance_km, ascent_m, descent_m, seconds, link, comment";

	/** From the calendar: the race says its name, its kind and its town, so none of those are here. */
	private static final String GOOD_FROM_THE_CALENDAR = row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY
			+ ", null, null, null, null, null, 10.00, 100, 100, 3600, 'https://rezultati.rs/trka/1', ''");
	/** Described, with a town out of the codebook. */
	private static final String GOOD_DESCRIBED = row(A_MEMBER + ", null, " + ANOTHER_DAY
			+ ", 'Trka kroz sumu', 'free', " + A_TOWN + ", null, null, 21.50, 300, 280, 7200,"
			+ " 'https://rezultati.rs/trka/2', 'Bilo je blatnjavo.'");
	/** Described, with a town typed by hand, and no link at all because a photograph stands in for it. */
	private static final String GOOD_DESCRIBED_TYPED_TOWN = row(A_MEMBER + ", null, " + ANOTHER_DAY
			+ ", 'Trka na Zlatiboru', 'time', null, 'Zaselak', " + A_COUNTRY + ", 15.00, 0, 0, 3600, '', ''");

	private static String row(String values) {
		return "insert into result_submission (" + COLUMNS + ") values (" + values + ")";
	}

	/**
	 * A member, a race in the calendar to report from, and one submission already
	 * waiting.
	 *
	 * The class is transactional and rolled back, so this is written afresh for
	 * every case. The submission that is already there is what the primary key case
	 * collides with: against an empty table that case inserts nothing and proves
	 * nothing.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000940', 'Probni', 'Trkac', 'M',"
				+ " date '1988-08-08', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '0011223344556670', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
				+ " description, link, copied_from) values ('probni-dogadjaj-v10', 'Probni dogadjaj', "
				+ RACE_DAY + ", " + A_TOWN + ", null, null, 'race', false, '', '', null)").update();

		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km, ascent_m,"
				+ " descent_m) values ((select id from btl_event where slug = 'probni-dogadjaj-v10'),"
				+ " 'Probna trka', false, " + RACE_DAY + ", 'length', 0, 10.00, 100, 100)").update();

		db.sql(GOOD_FROM_THE_CALENDAR).update();
	}

	static List<Violation> violations() {
		return List.of(
				/* The key and the id under it, neither of which the helper above can
				   reach: it lets the sequence issue the id. */
				Violation.notNull("result_submission_id_not_null", "id",
						"insert into result_submission (id, " + COLUMNS + ") values (null, " + A_MEMBER + ", "
								+ A_RACE + ", " + RACE_DAY + ", null, null, null, null, null, 10.00, 100, 100,"
								+ " 3600, '', '')"),
				Violation.of("result_submission_pk",
						"insert into result_submission (id, " + COLUMNS + ") select id, " + A_MEMBER + ", "
								+ A_RACE + ", " + RACE_DAY + ", null, null, null, null, null, 12.00, 100, 100,"
								+ " 3600, '', '' from result_submission limit 1"),

				/* Whose run it is, and it is never nobody's. */
				Violation.notNull("result_submission_competitor_id_not_null", "competitor_id",
						row("null, " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_competitor_fk",
						row("999999, " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, 3600, '', ''")),

				/* THE RACE FROM THE CALENDAR, AND THE COMPOSITE KEY. The first row names
				   a race that does not exist. The second names one that does, on a day it
				   was not run - which is the half a key on `race_id` alone would let
				   through, and the reason the key is the composite one `result` uses. */
				Violation.of("result_submission_race_fk",
						row(A_MEMBER + ", 999999, " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_race_fk",
						row(A_MEMBER + ", " + A_RACE + ", " + ANOTHER_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, 3600, '', ''")),
				/* The day is asked for on both forms, so it is here in both cases. */
				Violation.notNull("result_submission_race_date_not_null", "race_date",
						row(A_MEMBER + ", " + A_RACE + ", null, null, null, null, null, null,"
								+ " 10.00, 100, 100, 3600, '', ''")),

				/* ONE WAY OR THE OTHER, AND BOTH DIRECTIONS OF IT. The first row is a
				   submission that names a race in the calendar AND describes one: fully
				   described, so that nothing else can be what fires. The second names
				   neither, which is a run nobody can place. */
				Violation.of("result_submission_race_is_from_the_calendar_or_described",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", 'Trka kroz sumu', 'free', "
								+ A_TOWN + ", null, null, 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_race_is_from_the_calendar_or_described",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, 3600, '', ''")),

				/* A described race says what kind it is, and a race from the calendar says
				   nothing about it because the calendar already does. */
				Violation.of("result_submission_described_race_says_its_kind",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", 'Trka kroz sumu', null, " + A_TOWN
								+ ", null, null, 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_described_race_says_its_kind",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, 'free', null, null, null,"
								+ " 10.00, 100, 100, 3600, '', ''")),
				/* A fourth kind, which the select on the form cannot produce: it offers
				   length, time and free and nothing else. */
				Violation.of("result_submission_race_kind_known",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", 'Trka kroz sumu', 'sprint', " + A_TOWN
								+ ", null, null, 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_race_name_not_blank",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", '   ', 'free', " + A_TOWN
								+ ", null, null, 10.00, 100, 100, 3600, '', ''")),

				/* THE TOWN, IN BOTH DIRECTIONS AND IN BOTH FORMS. A described race with no
				   town cannot be put in the calendar on approval, and a race from the
				   calendar that carries one is a second answer to a question the calendar
				   has already answered. */
				Violation.of("result_submission_described_race_names_its_town",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", 'Trka kroz sumu', 'free', null, null,"
								+ " null, 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_described_race_names_its_town",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, " + A_TOWN
								+ ", null, null, 10.00, 100, 100, 3600, '', ''")),
				/* From the codebook or typed, never both. */
				Violation.of("result_submission_town_is_from_the_codebook_or_typed",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", 'Trka kroz sumu', 'free', " + A_TOWN
								+ ", 'Zaselak', " + A_COUNTRY + ", 10.00, 100, 100, 3600, '', ''")),
				/* And a typed town names its country, both ways round: without one nobody
				   knows where it is, and with one beside a codebook town there are two
				   countries for one place. */
				Violation.of("result_submission_typed_town_names_its_country",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", 'Trka kroz sumu', 'free', null,"
								+ " 'Zaselak', null, 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_typed_town_names_its_country",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", 'Trka kroz sumu', 'free', " + A_TOWN
								+ ", null, " + A_COUNTRY + ", 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_city_not_blank",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", 'Trka kroz sumu', 'free', null, '   ', "
								+ A_COUNTRY + ", 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_place_fk",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", 'Trka kroz sumu', 'free', 999999, null,"
								+ " null, 10.00, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_country_fk",
						row(A_MEMBER + ", null, " + ANOTHER_DAY + ", 'Trka kroz sumu', 'free', null,"
								+ " 'Zaselak', 999999, 10.00, 100, 100, 3600, '', ''")),

				/* THE FOUR NUMBERS THE FORMULA IS FED. Each is NOT NULL because a result
				   cannot be scored without it, and each is guarded the way `result` guards
				   the same column. */
				Violation.notNull("result_submission_distance_km_not_null", "distance_km",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " null, 100, 100, 3600, '', ''")),
				Violation.of("result_submission_distance_positive",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 0, 100, 100, 3600, '', ''")),
				Violation.notNull("result_submission_ascent_m_not_null", "ascent_m",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, null, 100, 3600, '', ''")),
				Violation.of("result_submission_ascent_not_negative",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, -1, 100, 3600, '', ''")),
				Violation.notNull("result_submission_descent_m_not_null", "descent_m",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, null, 3600, '', ''")),
				Violation.of("result_submission_descent_not_negative",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, -1, 3600, '', ''")),
				Violation.notNull("result_submission_seconds_not_null", "seconds",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, null, '', ''")),
				/* Zero and not minus one: a run of no time at all is the value a form that
				   forgets to add the three fields up would send. */
				Violation.of("result_submission_seconds_positive",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, 0, '', ''")),

				/* The proof and the note. Both are always there and both may be empty, so
				   the only thing to break is the shape of a link that is not empty. */
				Violation.notNull("result_submission_link_not_null", "link",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, 3600, null, ''")),
				Violation.of("result_submission_link_shape",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, 3600, 'rezultati.rs/trka/1', ''")),
				Violation.notNull("result_submission_comment_not_null", "comment",
						row(A_MEMBER + ", " + A_RACE + ", " + RACE_DAY + ", null, null, null, null, null,"
								+ " 10.00, 100, 100, 3600, '', null")));
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
	 *
	 * A constraint added to the migration without a row above fails here, and a row
	 * above naming one that has been dropped fails here too.
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
	 * And all three shapes the two forms can produce go in.
	 *
	 * Without this every constraint above could be replaced by one that rejects
	 * everything and the file would still be green. Three and not one, because the
	 * three are what the biconditionals are about: from the calendar, described with
	 * a town out of the codebook, and described with one typed by hand.
	 */
	static List<String> legitimateRows() {
		return List.of(GOOD_FROM_THE_CALENDAR, GOOD_DESCRIBED, GOOD_DESCRIBED_TYPED_TOWN);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * The same member may report the same race twice, and that is on purpose.
	 *
	 * <p>The owner decided on 30.08.2026 that duplicates in the calendar are not
	 * prevented - "Nista, ti pazis" - and an approved report of a race that is not in
	 * the calendar puts that race there (11.09.2026). A unique key over the member
	 * and the race would quietly contradict both, and it would also refuse the one
	 * case that is ordinary: a report that was refused and sent again, corrected.
	 */
	@Test
	void theSameRunMayBeReportedTwiceBecauseNobodyDecidedOtherwise() {
		assertThat(db.sql(GOOD_FROM_THE_CALENDAR).update())
				.as("a second report of the same race by the same member was refused,"
						+ " which no decision asks for")
				.isOne();
	}

	/**
	 * The calendar race goes, and the submission goes with it.
	 *
	 * <p>The same rule `result` carries, and for the same reason: a run that points
	 * at a race nobody can look up is not a run anybody can judge. Measured here
	 * rather than read off the migration, because ON DELETE is the one thing about a
	 * key that a row-that-fails cannot show.
	 */
	@Test
	void deletingTheRaceTakesTheSubmissionWithIt() {
		assertThat(db.sql("select count(*) from result_submission").query(Long.class).single())
				.as("nothing was waiting before the delete, so an empty table afterwards says nothing")
				.isOne();

		assertThat(db.sql("delete from btl_event where slug = 'probni-dogadjaj-v10'").update()).isOne();

		assertThat(db.sql("select count(*) from result_submission").query(Long.class).single())
				.as("the submission outlived the race it reports from")
				.isZero();
	}

	/**
	 * And a described one does not, because there is no race to take it.
	 *
	 * <p>This is the half the case above cannot show: with `race_id` null the
	 * composite key is not checked at all, which is what MATCH SIMPLE means. If it
	 * were ever written as MATCH FULL, a described submission could not be inserted
	 * in the first place and this would fail on the insert.
	 */
	@Test
	void aDescribedRaceIsNotCheckedAgainstTheCalendarAtAll() {
		assertThat(db.sql(GOOD_DESCRIBED).update()).isOne();

		assertThat(db.sql("delete from btl_event where slug = 'probni-dogadjaj-v10'").update()).isOne();

		assertThat(db.sql("select race_name from result_submission").query(String.class).single())
				.as("emptying the calendar took a submission that never named a race in it")
				.isEqualTo("Trka kroz sumu");
	}

	/**
	 * The member goes, and every run he ever reported goes with him.
	 *
	 * <p>PDL P21, the same sentence `result` and `verification` already obey.
	 */
	@Test
	void deletingTheMemberTakesTheSubmissionWithHim() {
		assertThat(db.sql("select count(*) from result_submission").query(Long.class).single())
				.as("nothing was waiting before the delete, so an empty table afterwards says nothing")
				.isOne();

		assertThat(db.sql("delete from competitor where member_number = '000940'").update()).isOne();

		assertThat(db.sql("select count(*) from result_submission").query(Long.class).single())
				.as("a deleted member left a run waiting in the queue")
				.isZero();
	}
}

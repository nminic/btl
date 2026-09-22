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
 * Every constraint on the table a reported change of term sits in, with the row that
 * breaks it.
 *
 * <p>Named {@code schedule_proposal} rather than {@code date_report}, following
 * {@code team_proposal} rather than {@code result_submission}: what this row produces is a
 * PROPOSAL over a record that already exists - the event - and not a thing that does not
 * yet exist the way a run or a comment is (ADL A64 A2, 22.09.2026; PDL 1576, „ono sto red
 * proizvodi je predlog datuma, ne stanje").
 *
 * <p><b>{@code event_date} IS DELIBERATELY UNPINNED.</b> V10's {@code race_date} is pinned
 * to the calendar by a composite foreign key, „so a submission can never disagree with the
 * calendar". That shape does NOT cross here: this table's whole reason to exist is that its
 * {@code event_date} and {@code btl_event.date} may disagree, because a report exists
 * precisely when the reporter's day and the calendar's day have come apart.
 */
class ScheduleProposalConstraintsTest extends DatabaseTest {

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
	 * The one table V30 adds for a reported change of term.
	 *
	 * Package visible for the same reason every sibling's is:
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()} adds this
	 * list to the same list in every sibling and compares them against {@code pg_tables}.
	 * The column V30 adds to {@code verification} is guarded in
	 * {@link VerificationConstraintsTest}, not here.
	 */
	static final List<String> TABLES = List.of("schedule_proposal");

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000960')";

	private static final String AN_EVENT = "(select id from btl_event where slug = 'probni-dogadjaj-sp')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS = "competitor_id, event_id, event_date, proposed_date";

	/** A member reports a change, forwards. */
	private static final String GOOD_BY_A_MEMBER =
			row(A_MEMBER + ", " + AN_EVENT + ", date '2027-04-04', date '2027-04-11'");
	/** Nobody in the record reports one - PDL 1582, „otvoreno i za neregistrovane" - and
	 *  this is the one axis where neither V10's nor V11's shape carries over: both make the
	 *  matching column NOT NULL. */
	private static final String GOOD_BY_NOBODY_IN_PARTICULAR =
			row("null, " + AN_EVENT + ", date '2027-04-04', date '2027-04-11'");
	/** Backwards (PDL 1056, „kalendar sme da se menja unazad"), which is ordinary and not a
	 *  fourth shape the check below may refuse. */
	private static final String GOOD_BACKWARDS =
			row(A_MEMBER + ", " + AN_EVENT + ", date '2027-04-04', date '2027-03-28'");

	private static String row(String values) {
		return "insert into schedule_proposal (" + COLUMNS + ") values (" + values + ")";
	}

	/**
	 * A member and an event to report a change about.
	 *
	 * The class is transactional and rolled back, so this is written afresh for every case.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000960', 'Probni', 'Clan', 'M',"
				+ " date '1990-05-05', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566f0', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();

		db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
				+ " values ('probni-dogadjaj-sp', 'Probni dogadjaj', date '2027-04-04', " + A_TOWN
				+ ", 'race', false, '', '')").update();

		db.sql(GOOD_BY_A_MEMBER).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("schedule_proposal_id_not_null", "id",
						"insert into schedule_proposal (id, " + COLUMNS + ") values (null, " + A_MEMBER + ", "
								+ AN_EVENT + ", date '2027-04-04', date '2027-04-11')"),
				Violation.of("schedule_proposal_pk",
						"insert into schedule_proposal (id, " + COLUMNS + ") select id, " + A_MEMBER + ", "
								+ AN_EVENT + ", date '2027-04-04', date '2027-04-11' from schedule_proposal limit 1"),

				/* NULLABLE (PDL 1582), so the fault this key catches is a member who is not
				   there, never the absence of one - `GOOD_BY_NOBODY_IN_PARTICULAR` is what
				   proves the absence is accepted. */
				Violation.of("schedule_proposal_competitor_fk",
						row("999999, " + AN_EVENT + ", date '2027-04-04', date '2027-04-11'")),

				Violation.notNull("schedule_proposal_event_id_not_null", "event_id",
						row(A_MEMBER + ", null, date '2027-04-04', date '2027-04-11'")),
				Violation.of("schedule_proposal_event_fk",
						row(A_MEMBER + ", 999999, date '2027-04-04', date '2027-04-11'")),

				Violation.notNull("schedule_proposal_event_date_not_null", "event_date",
						row(A_MEMBER + ", " + AN_EVENT + ", null, date '2027-04-11'")),
				Violation.notNull("schedule_proposal_proposed_date_not_null", "proposed_date",
						row(A_MEMBER + ", " + AN_EVENT + ", date '2027-04-04', null")),

				/* A REPORT PROPOSING THE DAY THE EVENT ALREADY STANDS ON IS A REPORT ABOUT
				   NOTHING, the same sentence `btl_event_not_copied_from_itself` (V7) makes
				   about a copy. */
				Violation.of("schedule_proposal_proposes_another_day",
						row(A_MEMBER + ", " + AN_EVENT + ", date '2027-04-04', date '2027-04-04'")));
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
	 */
	@Test
	void everyConstraintOnTheProposalHasARowThatBreaksIt() {
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
	 * By a member, by nobody in particular, and backwards all go in.
	 *
	 * Without this every constraint above could be replaced by one that rejects everything
	 * and the file would still be green. The three are what the two axes this table carries
	 * are about: whether anybody sent it in (PDL 1582), and which way the calendar moves
	 * (PDL 1056).
	 */
	static List<String> legitimateRows() {
		return List.of(GOOD_BY_A_MEMBER, GOOD_BY_NOBODY_IN_PARTICULAR, GOOD_BACKWARDS);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/** The event goes, and the proposal goes with it: an edit of an event that is gone is
	 *  an edit of nothing (V11's own sentence about a team proposal, applied here). */
	@Test
	void deletingTheEventTakesTheProposalWithIt() {
		assertThat(db.sql("select count(*) from schedule_proposal").query(Long.class).single())
				.as("nothing was waiting before the delete, so an empty table afterwards says nothing")
				.isOne();

		assertThat(db.sql("delete from btl_event where slug = 'probni-dogadjaj-sp'").update()).isOne();

		assertThat(db.sql("select count(*) from schedule_proposal").query(Long.class).single())
				.as("the proposal outlived the event it asked to move")
				.isZero();
	}

	/** The member goes, and the report he sent goes with him (ADL A64, B6: cascade, the
	 *  same as both precedents and ADL A42's „clanovi redovi idu sa njim"). */
	@Test
	void deletingTheMemberTakesTheProposalWithHim() {
		assertThat(db.sql("select count(*) from schedule_proposal").query(Long.class).single())
				.as("nothing was waiting before the delete, so an empty table afterwards says nothing")
				.isOne();

		assertThat(db.sql("delete from competitor where member_number = '000960'").update()).isOne();

		assertThat(db.sql("select count(*) from schedule_proposal").query(Long.class).single())
				.as("a deleted member left a reported change waiting in the queue")
				.isZero();
	}
}

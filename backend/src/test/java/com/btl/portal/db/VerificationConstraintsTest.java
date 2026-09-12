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
 * Every constraint the queue of V9 carries, with the row that breaks it.
 *
 * <p>The queue is one table for six tabs, and the six are not a list written
 * anywhere here: the table generates the right's code out of the tab and points a
 * foreign key at {@code admin_right}, so a tab exists exactly as long as somebody
 * has the right to moderate it.
 *
 * <p>What the rest of the constraints are for is one decision taken apart. ADL A36
 * O11: a refused row STAYS, with its state and its reason. From that follow the
 * three biconditionals below - a decided row says when and by whom, a refusal says
 * why and an approval does not - and from PDL P9 together with O11 follows the
 * last one, that a decided row holds no photograph at all.
 */
class VerificationConstraintsTest extends DatabaseTest {

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
	 * The one table V9 adds.
	 *
	 * Package visible because
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()}
	 * adds this list to the same list in every sibling and compares them against
	 * {@code pg_tables}: that is the floor that lets each of these files name its
	 * tables by hand.
	 */
	static final List<String> TABLES = List.of("verification");

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String AN_INSTANT = "timestamptz '2027-02-02 12:00:00+00'";

	private static final String A_MEMBER = "(select id from competitor where member_number = '000930')";
	private static final String AN_ACCOUNT = "(select id from account where email = 'moderator@primer.rs')";
	private static final String A_PHOTO = "(select id from photo where digest ="
			+ " '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String COLUMNS =
			"queue, competitor_id, subject, body, photo_id, state, decided_at, decided_by,"
			+ " decided_by_name, reason";

	/** Waiting, which is the state everything is written in. */
	private static final String GOOD_WAITING = row("'comments', " + A_MEMBER + ", 'Probni komentar', 'Tekst',"
			+ " null, 'waiting', null, null, null, null");
	/** Approved: it says when and by whom, carries no reason and no photograph. */
	private static final String GOOD_APPROVED = row("'profiles', " + A_MEMBER + ", 'Probni profil', '',"
			+ " null, 'approved', " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Moderator Probni', null");
	/** Refused: the same, and it says why. */
	private static final String GOOD_REJECTED = row("'results', " + A_MEMBER + ", 'Probni rezultat', '',"
			+ " null, 'rejected', " + AN_INSTANT + ", " + AN_ACCOUNT + ", 'Moderator Probni', 'Slika ne pokazuje vreme'");

	private static String row(String values) {
		return "insert into verification (" + COLUMNS + ") values (" + values + ")";
	}

	/** The run V10 gave the results tab to point at, which no other tab has. */
	private static final String A_SUBMISSION =
			"(select id from result_submission where race_name = 'Probna prijava')";

	/** A row of a named tab carrying a named submission, which `row` above cannot write:
	 *  its column list is V9's and this column is V10's. */
	/** The team V11 gave the teams tab to point at. */
	private static final String A_PROPOSAL =
			"(select id from team_proposal where name = 'Probni predlog')";

	/** The same, for the other subject. */
	private static String pointingAtProposal(String queue, String proposal) {
		return "insert into verification (queue, competitor_id, subject, body, state,"
				+ " team_proposal_id) values ('" + queue + "', " + A_MEMBER + ", 'Naslov', '',"
				+ " 'waiting', " + proposal + ")";
	}

	private static String pointingAt(String queue, String submission) {
		return "insert into verification (queue, competitor_id, subject, body, state,"
				+ " result_submission_id) values ('" + queue + "', " + A_MEMBER + ", 'Naslov', '',"
				+ " 'waiting', " + submission + ")";
	}

	/**
	 * A member, an account to decide with, and a photograph to attach.
	 *
	 * The class is transactional and rolled back, so this is written afresh for
	 * every case.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('000930', 'Probni', 'Clan', 'M',"
				+ " date '1990-05-05', " + A_TOWN + ", null, null, 2027, false, true, 'payment',"
				+ " '00112233445566d0', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into account (email, role_id) values ('moderator@primer.rs',"
				+ " (select id from role where code = 'moderator'))").update();
		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_side) values"
				+ " ('image/jpeg', 40960, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',"
				+ " 0, 0, 512)").update();
		/* And one run waiting to be judged, for the three constraints V10 adds. Described rather
		   than from the calendar, because this probe has no event and no race in it and does not
		   need one: what is being measured here is the pointer, not the run. */
		db.sql("insert into result_submission (competitor_id, race_date, race_name, race_kind,"
				+ " place_id, distance_km, ascent_m, descent_m, seconds, link, comment) values ("
				+ A_MEMBER + ", date '2027-04-04', 'Probna prijava', 'free', " + A_TOWN
				+ ", 10.00, 100, 100, 3600, '', '')").update();

		/* And one row already waiting, because a primary key can only be broken by a row that
		   collides with one that is there: against an empty table that case inserts nothing. */
		/* And one team somebody proposed, for the three constraints V11 adds. */
		db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link, place_id, city,"
				+ " country_id, logo_id) values (" + A_MEMBER + ", null, 'Probni predlog', '', '', "
				+ A_TOWN + ", null, null, null)").update();

		db.sql(row("'teams', " + A_MEMBER + ", 'Zatecen red', '', null, 'waiting', null, null, null, null")).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("verification_queue_not_null", "queue",
						row("null, " + A_MEMBER + ", 'Naslov', '', null, 'waiting', null, null, null, null")),
				/* A seventh tab, which nobody has the right to moderate. This is the
				   whole of what makes the six a floor rather than a list: it is not
				   refused because a CHECK names six words, it is refused because
				   `queue:results` and its five siblings are rows in the rights matrix
				   and `queue:sponsors` is not. */
				Violation.of("verification_queue_fk",
						row("'sponsors', " + A_MEMBER + ", 'Naslov', '', null, 'waiting', null, null, null, null")),
				Violation.of("verification_competitor_fk",
						row("'comments', (select max(id) + 1 from competitor), 'Naslov', '', null, 'waiting',"
								+ " null, null, null, null")),
				Violation.of("verification_photo_fk",
						row("'profiles', " + A_MEMBER + ", 'Naslov', '', 999999, 'waiting', null, null, null, null")),
				Violation.of("verification_decided_by_fk",
						row("'comments', " + A_MEMBER + ", 'Naslov', '', null, 'approved', " + AN_INSTANT
								+ ", (select max(id) + 1 from account), 'Moderator Probni', null")),

				Violation.notNull("verification_subject_not_null", "subject",
						row("'comments', " + A_MEMBER + ", null, '', null, 'waiting', null, null, null, null")),
				Violation.of("verification_subject_not_blank",
						row("'comments', " + A_MEMBER + ", '   ', '', null, 'waiting', null, null, null, null")),
				Violation.notNull("verification_body_not_null", "body",
						row("'comments', " + A_MEMBER + ", 'Naslov', null, null, 'waiting', null, null, null, null")),
				Violation.notNull("verification_raised_at_not_null", "raised_at",
						"insert into verification (queue, subject, body, state, raised_at) values"
								+ " ('comments', 'Naslov', '', 'waiting', null)"),
				Violation.notNull("verification_state_not_null", "state",
						row("'comments', " + A_MEMBER + ", 'Naslov', '', null, null, null, null, null, null")),
				/* A fourth state, which no screen can produce. Written as a DECIDED row -
				   with a moment and a moderator - and not as a waiting one, because a
				   state that is not `waiting` and carries neither also breaks the
				   biconditional below, and PostgreSQL would report that one instead.
				   A row must break the constraint it names and no other, or it proves
				   nothing about the one it names. Measured: written the other way, the
				   failure said `verification_decided_says_when`. */
				Violation.of("verification_state_known",
						row("'comments', " + A_MEMBER + ", 'Naslov', '', null, 'pending', " + AN_INSTANT
								+ ", " + AN_ACCOUNT + ", 'Moderator Probni', null")),

				/* The key and the id under it. Both are here because the floor asks for
				   them by name and neither is reachable through the helper above, which
				   lets the sequence issue the id. */
				Violation.notNull("verification_id_not_null", "id",
						"insert into verification (id, " + COLUMNS + ") values (null, 'comments', " + A_MEMBER
								+ ", 'Naslov', '', null, 'waiting', null, null, null, null)"),
				Violation.of("verification_pk",
						"insert into verification (id, " + COLUMNS + ") select id, 'comments', " + A_MEMBER
								+ ", 'Drugi naslov', '', null, 'waiting', null, null, null, null from verification"
								+ " limit 1"),

				/* THE DECISION, AND BOTH DIRECTIONS OF EACH HALF. Half a
				   biconditional lets a decision exist with nobody's name on it, or a
				   waiting row carry a decision nobody made. */
				Violation.of("verification_decided_says_when",
						row("'comments', " + A_MEMBER + ", 'Naslov', '', null, 'approved', null, " + AN_ACCOUNT
								+ ", 'Moderator Probni', null")),
				Violation.of("verification_decided_says_when",
						row("'comments', " + A_MEMBER + ", 'Naslov', '', null, 'waiting', " + AN_INSTANT
								+ ", null, null, null")),
				Violation.of("verification_decided_says_who",
						row("'comments', " + A_MEMBER + ", 'Naslov', '', null, 'approved', " + AN_INSTANT
								+ ", " + AN_ACCOUNT + ", null, null")),
				Violation.of("verification_decided_says_who",
						row("'comments', " + A_MEMBER + ", 'Naslov', '', null, 'waiting', null, null, 'Moderator Probni', null")),
				/* And the name may not be blank, which is the second way a decision could
				   end up with nobody on it. */
				Violation.of("verification_decided_by_name_not_blank",
						row("'comments', " + A_MEMBER + ", 'Naslov', '', null, 'approved', " + AN_INSTANT
								+ ", " + AN_ACCOUNT + ", '   ', null")),

				/* A refusal with no reason, a refusal whose reason is blank, and an
				   approval carrying one. */
				Violation.of("verification_refusal_says_why",
						row("'results', " + A_MEMBER + ", 'Naslov', '', null, 'rejected', " + AN_INSTANT
								+ ", " + AN_ACCOUNT + ", 'Moderator Probni', null")),
				Violation.of("verification_refusal_says_why",
						row("'results', " + A_MEMBER + ", 'Naslov', '', null, 'rejected', " + AN_INSTANT
								+ ", " + AN_ACCOUNT + ", 'Moderator Probni', '   '")),
				Violation.of("verification_refusal_says_why",
						row("'results', " + A_MEMBER + ", 'Naslov', '', null, 'approved', " + AN_INSTANT
								+ ", " + AN_ACCOUNT + ", 'Moderator Probni', 'Nema sta da se objasni'")),

				/* And the picture, both ways a decided row could still be holding one. */
				Violation.of("verification_decided_keeps_no_photo",
						row("'profiles', " + A_MEMBER + ", 'Naslov', '', " + A_PHOTO + ", 'approved', "
								+ AN_INSTANT + ", " + AN_ACCOUNT + ", 'Moderator Probni', null")),
				Violation.of("verification_decided_keeps_no_photo",
						row("'profiles', " + A_MEMBER + ", 'Naslov', '', " + A_PHOTO + ", 'rejected', "
								+ AN_INSTANT + ", " + AN_ACCOUNT + ", 'Moderator Probni', 'Slika je mutna'")),

				/* AND THE RUN THE RESULTS TAB POINTS AT, WHICH V10 ADDS. A run that is not
				   there; the same run waiting twice, which would let one result be approved
				   into `result` twice with nothing to say which was meant; and a run hanging
				   off a tab that does not judge runs. */
				Violation.of("verification_result_submission_fk", pointingAt("results", "999999")),
				Violation.of("verification_result_submission_unique",
						"insert into verification (queue, competitor_id, subject, body, state,"
								+ " result_submission_id) select 'results', " + A_MEMBER + ", 'Naslov', '',"
								+ " 'waiting', " + A_SUBMISSION + " from generate_series(1, 2)"),
				Violation.of("verification_only_the_results_queue_carries_a_submission",
						pointingAt("comments", A_SUBMISSION)),

				/* AND THE TEAM V11 ADDS, in the same three shapes. A row about a queue is about ONE
				   thing, and that is not a fourth constraint: a row carrying a run must be on the
				   `results` tab and a row carrying a proposal on `teams`, and a row has one tab, so
				   these two already say it. */
				Violation.of("verification_team_proposal_fk", pointingAtProposal("teams", "999999")),
				Violation.of("verification_team_proposal_unique",
						"insert into verification (queue, competitor_id, subject, body, state,"
								+ " team_proposal_id) select 'teams', " + A_MEMBER + ", 'Naslov', '',"
								+ " 'waiting', " + A_PROPOSAL + " from generate_series(1, 2)"),
				Violation.of("verification_only_the_teams_queue_carries_a_proposal",
						pointingAtProposal("comments", A_PROPOSAL)));
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
	void everyConstraintOnTheQueueHasARowThatBreaksIt() {
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
	 * And a row in each of the three states goes in.
	 *
	 * Without this the constraints above could all be replaced by ones that reject
	 * everything and the file would still pass. Three rows and not one, because the
	 * three states are what the biconditionals are about: a check that refuses every
	 * decided row would be caught by nothing else here.
	 */
	/** Read through a method rather than an annotation: the three are built by a
	 *  helper, and an annotation takes a constant. */
	static List<String> legitimateRows() {
		return List.of(GOOD_WAITING, GOOD_APPROVED, GOOD_REJECTED);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * A moderator's account may go, and the decision he made stays with his name on
	 * it.
	 *
	 * <p>This is the case a round on 11.09.2026 asked for and the schema could not
	 * answer. `decided_by` pointed at the account and the check demanded it be there
	 * for every decided row, so deleting the account made PostgreSQL try to write
	 * NULL into a column that refused NULL, and the delete failed outright - which
	 * is not what ON DELETE SET NULL says and not what PDL P23 allows, since a
	 * moderator has the same right as anybody to have his account deleted.
	 *
	 * <p>The shape is V7's, not a new idea: `event_comment` keeps `who` as text
	 * beside a `competitor_id` that may go, so a comment outlives its author. A
	 * decision is the same kind of fact.
	 */
	@Test
	void theAccountMayGoAndTheDecisionKeepsTheNameItWasMadeUnder() {
		db.sql(GOOD_APPROVED).update();

		assertThat(db.sql("delete from account where email = 'moderator@primer.rs'").update())
				.as("a moderator who has decided something can no longer have his account deleted")
				.isOne();

		assertThat(db
				.sql("select decided_by_name || ' | ' || coalesce(decided_by::text, 'bez naloga')"
						+ " from verification where state = 'approved'")
				.query(String.class)
				.single())
				.as("the decision lost its name, or kept a pointer at an account that is gone")
				.isEqualTo("Moderator Probni | bez naloga");
	}

	/**
	 * And the results tab does carry the run it is about.
	 *
	 * <p>The three cases above all refuse something, so together they are satisfied by a
	 * column nothing may ever be written into. This is the row that has to go in: the
	 * whole point of V10 is that this tab finally has something to point at, and until
	 * now it had only `subject` and `body`, two pieces of prose that no result can be
	 * computed out of.
	 */
	/**
	 * And the teams tab carries the team it is about, for the same reason.
	 */
	@Test
	void theTeamsTabCarriesTheProposalItIsAbout() {
		assertThat(db.sql(pointingAtProposal("teams", A_PROPOSAL)).update()).isOne();

		assertThat(db.sql("select count(*) from verification where team_proposal_id is not null")
				.query(Long.class)
				.single())
				.as("the row went in with an empty pointer, so nothing here is about V11 at all")
				.isOne();
	}

	@Test
	void theResultsTabCarriesTheRunItIsAbout() {
		assertThat(db.sql(pointingAt("results", A_SUBMISSION)).update()).isOne();

		/* And it points at something. A_SUBMISSION is a subselect, and a subselect that finds
		   nothing is NULL - which the key accepts, which the check accepts, and which would let
		   the line above pass while pointing at nothing at all. */
		assertThat(db.sql("select count(*) from verification where result_submission_id is not null")
				.query(Long.class)
				.single())
				.as("the row went in with an empty pointer, so nothing here is about V10 at all")
				.isOne();
	}

	/**
	 * The six tabs are the six rights, and neither list is written here.
	 *
	 * <p>This is the half the foreign key cannot say by itself: the key refuses a
	 * seventh tab, but it would go on refusing it if the rights matrix had shrunk to
	 * one. So both sides are read - the queue rights out of {@code admin_right}, and
	 * the tabs the queue will accept out of what actually goes in - and they have to
	 * be the same set.
	 */
	@Test
	void theTabsOfTheQueueAreExactlyTheQueueRights() {
		List<String> rights = db
				.sql("select target from admin_right where scope = 'queue' order by target")
				.query(String.class)
				.list();

		assertThat(rights).as("the rights matrix carries no queue at all").isNotEmpty();

		for (String tab : rights) {
			assertThat(db.sql(row("'" + tab + "', " + A_MEMBER + ", 'Naslov', '', null, 'waiting', null,"
					+ " null, null, null")).update())
					.as("the queue refuses the tab %s, which somebody has the right to moderate", tab)
					.isOne();
		}
	}
}

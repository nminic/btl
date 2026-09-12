package com.btl.portal.db;

import com.btl.portal.domain.account.SessionLife;
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
 * Everything V18 adds about PROVING somebody is who he says he is.
 *
 * <p>A36 O9 always said this would be a migration of its own: "Nalozi i uloge idu u
 * prvu migraciju, autentikacija u drugu." V6 built the account and left this out.
 *
 * <p>Three tables and three columns, and one thing runs through all of them: the
 * database never holds a secret. Not the password, not the session cookie, not the
 * reset link - only what each of them hashes to. A stolen copy of this database
 * lets nobody sign in as anybody.
 */
class AuthenticationConstraintsTest extends DatabaseTest {

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
	 * The three tables V18 adds. The columns it adds to `account` are not this file's
	 * list, but their constraints are measured here, because `account` belongs to
	 * {@link AccountConstraintsTest} and its floor reads them.
	 */
	static final List<String> TABLES =
			List.of("account_session", "password_reset_token", "account_admin_right");

	private static final String AN_ACCOUNT = "(select id from account where email = 'prijava@primer.rs')";
	private static final String A_HASH = "'{bcrypt}$2a$10$abcdefghijklmnopqrstuv'";
	private static final String A_TOKEN = "'" + "a".repeat(64) + "'";
	private static final String ANOTHER_TOKEN = "'" + "b".repeat(64) + "'";
	private static final String A_RIGHT = "'entity:members'";

	private static String session(String values) {
		return "insert into account_session (account_id, token_hash) values (" + values + ")";
	}

	private static String reset(String values) {
		return "insert into password_reset_token (account_id, token_hash) values (" + values + ")";
	}

	private static String granted(String values) {
		return "insert into account_admin_right (account_id, right_code) values (" + values + ")";
	}

	private static final String GOOD_SESSION = session(AN_ACCOUNT + ", " + ANOTHER_TOKEN);
	private static final String GOOD_RESET = reset(AN_ACCOUNT + ", " + ANOTHER_TOKEN);
	private static final String GOOD_RIGHT = granted(AN_ACCOUNT + ", 'queue:results'");

	/**
	 * One account with a password, one session, one reset link and one right already
	 * granted.
	 */
	@BeforeEach
	void probe() {
		db.sql("insert into account (email, role_id, password_hash) values ('prijava@primer.rs',"
				+ " (select id from role where code = 'moderator'), " + A_HASH + ")").update();

		db.sql(session(AN_ACCOUNT + ", " + A_TOKEN)).update();
		db.sql(reset(AN_ACCOUNT + ", " + A_TOKEN)).update();
		db.sql(granted(AN_ACCOUNT + ", " + A_RIGHT)).update();
	}

	static List<Violation> violations() {
		return List.of(
				/* THE SESSION. */
				Violation.notNull("account_session_id_not_null", "id",
						"insert into account_session (id, account_id, token_hash) values (null, "
								+ AN_ACCOUNT + ", " + ANOTHER_TOKEN + ")"),
				Violation.of("account_session_pk",
						"insert into account_session (id, account_id, token_hash) select id, "
								+ AN_ACCOUNT + ", " + ANOTHER_TOKEN + " from account_session limit 1"),
				Violation.notNull("account_session_account_id_not_null", "account_id",
						session("null, " + ANOTHER_TOKEN)),
				Violation.of("account_session_account_fk", session("999999, " + ANOTHER_TOKEN)),
				Violation.notNull("account_session_token_hash_not_null", "token_hash",
						session(AN_ACCOUNT + ", null")),
				Violation.of("account_session_token_hash_unique", session(AN_ACCOUNT + ", " + A_TOKEN)),
				/* Not the hash of anything: the wrong length, and the wrong alphabet. */
				Violation.of("account_session_token_hash_shape", session(AN_ACCOUNT + ", 'abc'")),
				Violation.of("account_session_token_hash_shape",
						session(AN_ACCOUNT + ", '" + "A".repeat(64) + "'")),
				Violation.notNull("account_session_created_at_not_null", "created_at",
						"insert into account_session (account_id, token_hash, created_at) values ("
								+ AN_ACCOUNT + ", " + ANOTHER_TOKEN + ", null)"),
				Violation.notNull("account_session_last_used_at_not_null", "last_used_at",
						"insert into account_session (account_id, token_hash, last_used_at) values ("
								+ AN_ACCOUNT + ", " + ANOTHER_TOKEN + ", null)"),
				Violation.notNull("account_session_expires_at_not_null", "expires_at",
						"insert into account_session (account_id, token_hash, expires_at) values ("
								+ AN_ACCOUNT + ", " + ANOTHER_TOKEN + ", null)"),
				/* Used before it began, and ending before it began. */
				/* `expires_at` is given too, and that is not tidiness: left to its default it is
				   `now() + 30 days`, which is BEFORE a `created_at` written in 2027 - so the row
				   broke "ends after it began" first and named the wrong constraint. */
				Violation.of("account_session_used_after_it_began",
						"insert into account_session (account_id, token_hash, created_at, last_used_at,"
								+ " expires_at) values (" + AN_ACCOUNT + ", " + ANOTHER_TOKEN
								+ ", timestamptz '2027-01-02 10:00:00+00',"
								+ " timestamptz '2027-01-01 10:00:00+00',"
								+ " timestamptz '2027-02-01 10:00:00+00')"),
				Violation.of("account_session_ends_after_it_began",
						"insert into account_session (account_id, token_hash, created_at, last_used_at,"
								+ " expires_at) values (" + AN_ACCOUNT + ", " + ANOTHER_TOKEN
								+ ", timestamptz '2027-01-02 10:00:00+00',"
								+ " timestamptz '2027-01-02 10:00:00+00',"
								+ " timestamptz '2027-01-01 10:00:00+00')"),

				/* THE RESET LINK. */
				Violation.notNull("password_reset_token_id_not_null", "id",
						"insert into password_reset_token (id, account_id, token_hash) values (null, "
								+ AN_ACCOUNT + ", " + ANOTHER_TOKEN + ")"),
				Violation.of("password_reset_token_pk",
						"insert into password_reset_token (id, account_id, token_hash) select id, "
								+ AN_ACCOUNT + ", " + ANOTHER_TOKEN + " from password_reset_token limit 1"),
				Violation.notNull("password_reset_token_account_id_not_null", "account_id",
						reset("null, " + ANOTHER_TOKEN)),
				Violation.of("password_reset_token_account_fk", reset("999999, " + ANOTHER_TOKEN)),
				Violation.notNull("password_reset_token_token_hash_not_null", "token_hash",
						reset(AN_ACCOUNT + ", null")),
				Violation.of("password_reset_token_hash_unique", reset(AN_ACCOUNT + ", " + A_TOKEN)),
				Violation.of("password_reset_token_hash_shape", reset(AN_ACCOUNT + ", 'abc'")),
				Violation.notNull("password_reset_token_created_at_not_null", "created_at",
						"insert into password_reset_token (account_id, token_hash, created_at) values ("
								+ AN_ACCOUNT + ", " + ANOTHER_TOKEN + ", null)"),
				Violation.notNull("password_reset_token_expires_at_not_null", "expires_at",
						"insert into password_reset_token (account_id, token_hash, expires_at) values ("
								+ AN_ACCOUNT + ", " + ANOTHER_TOKEN + ", null)"),
				Violation.of("password_reset_token_ends_after_it_began",
						"insert into password_reset_token (account_id, token_hash, created_at, expires_at)"
								+ " values (" + AN_ACCOUNT + ", " + ANOTHER_TOKEN
								+ ", timestamptz '2027-01-02 10:00:00+00',"
								+ " timestamptz '2027-01-01 10:00:00+00')"),
				Violation.of("password_reset_token_used_after_it_began",
						"insert into password_reset_token (account_id, token_hash, created_at, expires_at,"
								+ " used_at) values (" + AN_ACCOUNT + ", " + ANOTHER_TOKEN
								+ ", timestamptz '2027-01-02 10:00:00+00',"
								+ " timestamptz '2027-01-02 11:00:00+00',"
								+ " timestamptz '2027-01-01 10:00:00+00')"),

				/* WHICH RIGHTS A MODERATOR HAS BEEN GIVEN. */
				Violation.notNull("account_admin_right_account_id_not_null", "account_id",
						granted("null, " + A_RIGHT)),
				Violation.of("account_admin_right_account_fk", granted("999999, " + A_RIGHT)),
				Violation.notNull("account_admin_right_right_code_not_null", "right_code",
						granted(AN_ACCOUNT + ", null")),
				/* A right nobody has decided to have, which is what the key is for. */
				Violation.of("account_admin_right_right_fk", granted(AN_ACCOUNT + ", 'entity:sponsors'")),
				/* Ticking a box that is already ticked is not a second fact. */
				Violation.of("account_admin_right_pk", granted(AN_ACCOUNT + ", " + A_RIGHT)),
				Violation.notNull("account_admin_right_granted_at_not_null", "granted_at",
						"insert into account_admin_right (account_id, right_code, granted_at) values ("
								+ AN_ACCOUNT + ", 'queue:results', null)"));
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
		return List.of(GOOD_SESSION, GOOD_RESET, GOOD_RIGHT);
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/**
	 * THE NUMBERS THE OWNER CHOSE ARE IN THE SCHEMA, read back out of it, AND THE
	 * CODE AGREES WITH THEM.
	 *
	 * <p>Thirty days for a session and one hour for a reset link are written as column
	 * defaults rather than kept in a service, so that the next reader learns how long a
	 * token lives without finding the class that writes it. This is what says they are
	 * still what he chose.
	 *
	 * <p><b>And the second half is why this is not two assertions about one number.</b>
	 * {@code SessionLife.LASTS} carries thirty days a second time, for the session it
	 * RENEWS, and until a round on 12.09.2026 nothing joined the two: putting
	 * {@code interval '45 days'} in the schema left every case about session life green,
	 * and a renewed session and a fresh one would have quietly lived different lengths.
	 * The schema is asked first and the class is measured against the answer, so moving
	 * either one alone fails here.
	 */
	@Test
	void aSessionLastsThirtyDaysAndAResetLinkOneHour() {
		int howLongASessionLasts = db.sql("select extract(day from expires_at - created_at)::integer"
				+ " from account_session where token_hash = " + A_TOKEN).query(Integer.class).single();

		assertThat(howLongASessionLasts)
				.as("a session no longer lasts the thirty days the owner chose")
				.isEqualTo(30);
		assertThat(SessionLife.LASTS.toDays())
				.as("the schema hands out a session for %d days and the code renews it for another number",
						howLongASessionLasts)
				.isEqualTo(howLongASessionLasts);

		assertThat(db.sql("select extract(hour from expires_at - created_at)::integer"
				+ " from password_reset_token where token_hash = " + A_TOKEN).query(Integer.class).single())
				.as("a reset link no longer lasts the one hour the owner chose")
				.isOne();
	}

	/**
	 * An account is locked only with enough failures behind it.
	 *
	 * <p>Ten is the owner's number. A lock written with fewer is somebody locking an
	 * account by hand, which is not what the column is for and is not a thing the
	 * portal has.
	 */
	@Test
	void anAccountIsLockedOnlyWithEnoughFailuresBehindIt() {
		assertThatThrownBy(() -> db.sql("update account set locked_until = now() + interval '15 minutes'"
				+ " where email = 'prijava@primer.rs'").update())
				.as("an account was locked without a single failed sign in behind it")
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("account_locked_only_after_enough_failures");
	}

	/**
	 * And after ten failures it can be, which is what locking is for.
	 *
	 * <p>Its own case rather than two lines under the one above: the class is
	 * transactional, so after a statement the database refuses every next statement in
	 * that transaction comes back with "current transaction is aborted" rather than
	 * with what it would really have done.
	 */
	@Test
	void andAfterTenFailuresItCanBe() {
		assertThat(db.sql("update account set failed_sign_ins = 10,"
				+ " locked_until = now() + interval '15 minutes' where email = 'prijava@primer.rs'")
				.update())
				.as("an account could not be locked after ten failures, which is what locking is for")
				.isOne();
	}

	/**
	 * AN ACCOUNT WITH NO PASSWORD IS A STATE, not a row the schema refuses.
	 *
	 * <p>The owner opens accounts himself for members the board has exempted from the
	 * fee, and for the profiles of
	 * earlier years he fills in before launch: nobody ever typed a password for those
	 * people, and they set one through the reset link. So the column is nullable, and
	 * this is what says so on purpose rather than by omission.
	 *
	 * <p>What the schema cannot say, and the service must: an empty password is never
	 * compared. It is not "no match", it is nothing to match against.
	 */
	@Test
	void anAccountWithNoPasswordIsAStateAndNotARowTheSchemaRefuses() {
		assertThat(db.sql("insert into account (email, role_id) values ('bezclanarine@primer.rs',"
				+ " (select id from role where code = 'competitor'))").update())
				.as("the owner could not open an account for somebody who has never typed a password")
				.isOne();

		assertThat(db.sql("select count(*) from account where password_hash is null")
				.query(Long.class).single()).isOne();
	}

	/**
	 * A password without an algorithm in front of it is refused.
	 *
	 * <p>The whole point of the delegating encoder is that the algorithm can be
	 * replaced later, and a row that lost its prefix would be unreadable by every
	 * algorithm at once. This is what stops one being written.
	 */
	@Test
	void aPasswordWithoutAnAlgorithmInFrontOfItIsRefused() {
		assertThatThrownBy(() -> db.sql("insert into account (email, role_id, password_hash) values"
				+ " ('bez@primer.rs', (select id from role where code = 'competitor'),"
				+ " '$2a$10$abcdefghijklmnopqrstuv')").update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("account_password_hash_shape");
	}

	/**
	 * Everything about an account goes with it, which is what deleting an account has
	 * to mean.
	 *
	 * <p>PDL P23. A session left behind would be somebody still signed in as a member
	 * who has asked to be forgotten.
	 */
	@Test
	void deletingTheAccountTakesItsSessionsLinksAndRightsWithIt() {
		assertThat(db.sql("select (select count(*) from account_session) + (select count(*) from"
				+ " password_reset_token) + (select count(*) from account_admin_right)")
				.query(Long.class).single())
				.as("nothing was hanging off the account, so an empty table afterwards says nothing")
				.isEqualTo(3L);

		assertThat(db.sql("delete from account where email = 'prijava@primer.rs'").update()).isOne();

		assertThat(db.sql("select (select count(*) from account_session) + (select count(*) from"
				+ " password_reset_token) + (select count(*) from account_admin_right)")
				.query(Long.class).single())
				.as("a session, a reset link or a right outlived the account it belonged to")
				.isZero();
	}

	/**
	 * And a right cannot be taken out of the matrix while somebody has been given it.
	 *
	 * <p>The same RESTRICT the queue uses on the same table, and for the same reason: a
	 * tick pointing at a right that no longer exists is a permission nobody can reason
	 * about.
	 */
	@Test
	void aRightSomebodyHasBeenGivenCannotLeaveTheMatrix() {
		assertThatThrownBy(() -> db.sql("delete from admin_right where code = 'entity:members'").update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("account_admin_right_right_fk");
	}

	/** And one nobody has been given can, which is what says the key is about the tick. */
	@Test
	void aRightNobodyHasBeenGivenCanLeaveIt() {
		assertThat(db.sql("delete from admin_right where code = 'entity:pages'").update()).isOne();
	}

	/**
	 * The moderator whose rights these are is the one the rights model reads.
	 *
	 * <p>This is the table {@code AdminRights} was written without, because it did not
	 * exist: the model could answer for a superadmin (everything) and for a member
	 * (nothing), and for the one role the whole matrix exists for it had to be handed a
	 * set that came from nowhere. Now the set has a home, and this is the shape the
	 * service will read it in.
	 */
	@Test
	void whatAModeratorHasBeenGivenCanNowBeReadBack() {
		db.sql(GOOD_RIGHT).update();

		List<String> his = db.sql("select right_code from account_admin_right where account_id = "
				+ AN_ACCOUNT + " order by right_code").query(String.class).list();

		assertThat(his).containsExactly("entity:members", "queue:results");

		com.btl.portal.domain.rights.AdminRights rights = new com.btl.portal.domain.rights.AdminRights(
				com.btl.portal.domain.rights.AdminRights.Mode.of(
						db.sql("select rights_mode from role where code = 'moderator'")
								.query(String.class).single()),
				Set.copyOf(his));

		assertThat(rights.may("entity:members")).isTrue();
		assertThat(rights.may("entity:pricing"))
				.as("a moderator could do something nobody ticked for him")
				.isFalse();
	}
}

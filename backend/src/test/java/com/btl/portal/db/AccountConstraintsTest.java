package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint the two tables of V6 carry, with the row that breaks it.
 *
 * The same shape as ConstraintsTest and RoleAndRightConstraintsTest, and for the
 * same reason: a constraint nobody has broken on purpose is an intention rather
 * than a constraint, and a CHECK with a typo in the regular expression sits
 * there looking like protection and lets the row through. So each one gets a row
 * that it, and only it, must reject, and the failure has to name it.
 *
 * The floor under the hand written list is
 * {@link #everyConstraintOnTheTwoTablesHasARowThatBreaksIt()}, and it reads two
 * catalogues rather than one, because one of the rules of this migration is a
 * unique INDEX and not a constraint: one address is one account whatever case it
 * is typed in, which is an expression, and PostgreSQL will not take an
 * expression on a unique constraint. A floor reading only {@code pg_constraint}
 * would have let that one be dropped without a word, and dropping it is exactly
 * the mutation that makes the owner's sentence false while every test still
 * passes.
 *
 * Two constraints carry more than one row, and in both cases the extra rows are
 * the design rather than repetition: the shape of an address is what keeps one
 * address from being stored two ways, and the unique is asked once about the
 * same address and once about the same address in different case.
 *
 * The rows on the shape of an address have a floor of their own,
 * {@link #anAddressMayCarryEveryVisibleAsciiCharacterExceptTheAtSignAndNothingElse()},
 * because half of them are invisible characters and a list of those is a list
 * that cannot be finished by thinking about it.
 */
class AccountConstraintsTest extends DatabaseTest {

	/**
	 * One row that must be rejected, and the constraint that has to be the reason.
	 *
	 * {@code evidence} is what the database says when that constraint is the one
	 * that fired: its own name for a check, a unique, a key or an index, and the
	 * column for a NOT NULL, which PostgreSQL words by column and relation.
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
	 * The two tables V6 adds. The others answer to their own files, scoped the
	 * same way.
	 *
	 * Package visible because
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()}
	 * adds this list to the same list in every sibling and compares them against
	 * {@code pg_tables}: that is the floor that lets each of these files name its
	 * tables by hand, and it reads the field rather than a name, so dropping it
	 * stops the compiler.
	 */
	static final List<String> TABLES = List.of("account", "email_verification_token");

	/** The account every token below hangs off, written by {@link #probe()}. */
	private static final String PROBE_EMAIL = "proba@primer.rs";
	private static final String PROBE_ACCOUNT = "(select id from account where email = '" + PROBE_EMAIL + "')";

	/* A role that exists, looked up by its code rather than by a number: V5 hands
	   the four ids out of a sequence and nothing here may depend on which. */
	private static final String COMPETITOR = "(select id from role where code = 'competitor')";

	/* Sixty four lowercase hexadecimal characters, which is the shape of a
	   SHA-256 and the only shape the column takes. Obvious patterns rather than
	   plausible digests, because a digest that looks real invites the next reader
	   to wonder what it is a digest of, and it is a digest of nothing. */
	private static final String PROBE_HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
	private static final String OTHER_HASH = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
	private static final String THIRD_HASH = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

	/* The instant a link stops working, named by the caller rather than left to
	   the column, so that every row below breaks the one thing it is here to
	   break and not the clock as well. Deliberately nowhere near the twenty four
	   hours the column would have chosen ([ODLUKA 08.09.2026, vlasnik], ADL A38):
	   a fixture that agreed with the default would leave nothing here able to say
	   which of the two wrote the row. What the default does is behaviour and is
	   AccountAndVerificationTest's. */
	private static final String AN_INSTANT = "timestamptz '2027-01-01 00:00:00+00'";

	/* V23 put the owner's name on the account itself and both columns are NOT NULL, so
	   every row below has to carry one. They are written INTO the prefix rather than
	   passed by each caller because not one of the rows below is about a name: each
	   spoils a single field and the name has to be the same uninteresting pair in all of
	   them, so that what fails is the field and not the fixture. The two rows that ARE
	   about a name write their own. */
	private static final String ACCOUNT_INSERT =
			"insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', ";
	private static final String TOKEN_INSERT =
			"insert into email_verification_token (account_id, token_hash, expires_at) values (";

	/* A row of each table that breaks nothing: every violation below is one of
	   these with a single field spoiled, so what fails is the field and not the
	   fixture. Written out rather than built by the helpers below, because the
	   annotation that uses them takes a constant and a method call is not one. */
	private static final String GOOD_ACCOUNT = ACCOUNT_INSERT + "'probni@primer.rs', " + COMPETITOR + ")";
	private static final String GOOD_TOKEN = TOKEN_INSERT + PROBE_ACCOUNT + ", '" + THIRD_HASH + "', " + AN_INSTANT
			+ ")";

	/* The member the probe account belongs to since V23, looked up by the number the
	   helper below writes rather than by an id out of the sequence. */
	private static final String PROBE_MEMBER = "(select id from competitor where member_number = '001000')";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, first_season_2027, active,"
			+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String A_TOWN = "(select id from place where rank = 1)";

	/**
	 * One account and one link on it, so the rows below have something to collide
	 * with.
	 *
	 * The class is transactional and rolled back, so this is written afresh for
	 * every case and leaves nothing behind.
	 *
	 * <p><b>Since V23 the probe account also NAMES a member</b>, which is what the row
	 * breaking {@code account_competitor_unique} has to collide with. The member is
	 * written first because the account points at him and not the other way round, and he
	 * carries a different name from the account on purpose: this file never reads a name
	 * back, but the fixture it hands to a reader should not be the one shape in which the
	 * two could be confused.
	 */
	@BeforeEach
	void probe() {
		competitor("001000", "Clanski", "Zapis");

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Probni', 'Probic', '" + PROBE_EMAIL + "', " + COMPETITOR + ", "
						+ PROBE_MEMBER + ")")
				.update();
		db.sql(TOKEN_INSERT + PROBE_ACCOUNT + ", '" + PROBE_HASH + "', " + AN_INSTANT + ")").update();
	}

	/** A member, in the shape MembershipConstraintsTest already writes one. */
	private void competitor(String number, String first, String last) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, ?, ?, 'M',"
						+ " date '1982-02-02', " + A_TOWN + ", null, null, 2027, false, true,"
						+ " 'feeExempt', ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, "00112233445566" + number.substring(4)).update();
	}

	static List<Violation> violations() {
		return List.of(
				// ---------------------------------------------------------------- account
				Violation.of("account_pk",
						"insert into account (id, first_name, last_name, email, role_id) "
								+ "select id, first_name, last_name, 'drugi@primer.rs', role_id from account"
								+ " where email = '" + PROBE_EMAIL + "'"),
				/* A role that is not there. The four are loaded by V5 and nothing
				   deletes one, so the id one past the highest is the only way to ask
				   this without inventing a number. */
				Violation.of("account_role_fk", account("'drugi@primer.rs', (select max(id) + 1 from role)")),

				/* The same address twice, which is the plain half of "one address is
				   one account". */
				Violation.of("account_email_unique", account("'" + PROBE_EMAIL + "', " + COMPETITOR)),
				/* And the same address in different case, which is the half the owner
				   said out loud on 08.09.2026: one address is one account, without
				   exception. This is the row that fails the moment the unique index
				   is written over email rather than over lower(email), and nothing
				   else in the suite would notice that change. */
				Violation.of("account_email_unique", account("'Proba@Primer.RS', " + COMPETITOR)),

				/* Shapes, and none of them is an attempt at validating an address.
				   Each one is a way the same address could be written twice and
				   stored twice, or a string that is not an address at all. */
				/* V18. Cetiri koja stizu sa autentikacijom, i sva cetiri stoje ovde jer `account`
				   pripada ovom fajlu a njegov pod cita katalog. */
				Violation.of("account_password_hash_shape",
						"insert into account (first_name, last_name, email, role_id, password_hash)"
								+ " values ('Probni', 'Probic', 'oblik@primer.rs', "
								+ COMPETITOR + ", '$2a$10$bez-prefiksa')"),
				/* `noop` is a real id of the same delegating encoder, and ITS encoder hands the
				   input straight back - so this row is not a badly shaped hash, it is the password
				   itself. Found by a security round on 11.09.2026, which wrote `{noop}hunter2` and
				   read it back word for word. */
				Violation.of("account_password_hash_shape",
						"insert into account (first_name, last_name, email, role_id, password_hash)"
								+ " values ('Probni', 'Probic', 'noop@primer.rs', "
								+ COMPETITOR + ", '{noop}hunter2')"),
				/* And an algorithm that is well formed but broken. It happened to be refused before
				   as well, but only because the old pattern wanted lowercase; `{sha256}` would have
				   gone through. */
				Violation.of("account_password_hash_shape",
						"insert into account (first_name, last_name, email, role_id, password_hash)"
								+ " values ('Probni', 'Probic', 'sha@primer.rs', "
								+ COMPETITOR + ", '{sha256}5f4dcc3b5aa765d61d8327deb882cf99')"),
				Violation.notNull("account_failed_sign_ins_not_null", "failed_sign_ins",
						"insert into account (first_name, last_name, email, role_id, failed_sign_ins)"
								+ " values ('Probni', 'Probic', 'prazno@primer.rs', "
								+ COMPETITOR + ", null)"),
				Violation.of("account_failed_sign_ins_not_negative",
						"insert into account (first_name, last_name, email, role_id, failed_sign_ins)"
								+ " values ('Probni', 'Probic', 'minus@primer.rs', "
								+ COMPETITOR + ", -1)"),
				/* Zakljucan bez ijednog promasaja iza sebe. */
				Violation.of("account_locked_only_after_enough_failures",
						"insert into account (first_name, last_name, email, role_id, locked_until)"
								+ " values ('Probni', 'Probic', 'kljuc@primer.rs', "
								+ COMPETITOR + ", timestamptz '2027-01-01 10:00:00+00')"),
				Violation.of("account_email_shape", account("'probaprimer.rs', " + COMPETITOR)),
				Violation.of("account_email_shape", account("' proba@primer.rs', " + COMPETITOR)),
				Violation.of("account_email_shape", account("'proba@pri@mer.rs', " + COMPETITOR)),
				Violation.of("account_email_shape", account("'@primer.rs', " + COMPETITOR)),

				/* And four the eye cannot see, which is the reason the check is a
				   range of what is allowed rather than an exclusion of whitespace.
				   Every one of these reads to a moderator as proba@primer.rs, the
				   address probe() has already taken, and every one of them went in
				   beside it while the check excluded [:space:]: under the
				   en_US.utf8 ctype of the postgres:18 image that class is the ASCII
				   whitespace and nothing more, and lower() folds none of these
				   either, so the unique index did not fire.

				   Written as chr() and not as the character itself, so that the name
				   of the failing case names the code point instead of showing a gap
				   nobody can read. */
				// U+00A0, the no break space Word and Outlook put in front of a
				// pasted address
				Violation.of("account_email_shape", account("'proba@primer.rs' || chr(160), " + COMPETITOR)),
				// U+200B, zero width space: nothing at all is drawn for it
				Violation.of("account_email_shape",
						account("'proba@pri' || chr(8203) || 'mer.rs', " + COMPETITOR)),
				// U+00AD, the soft hyphen, which draws a hyphen only if the line
				// happens to break there and otherwise nothing
				Violation.of("account_email_shape",
						account("'proba@pri' || chr(173) || 'mer.rs', " + COMPETITOR)),
				// U+0430, a Cyrillic a. Not invisible but identical, and the reason
				// the boundary is ASCII and not "printable": this is the same
				// picture as the Latin a in proba
				Violation.of("account_email_shape",
						account("'prob' || chr(1072) || '@primer.rs', " + COMPETITOR)),

				/* V23, and the same reason the four above stand here: `account` is this
				   file's table whichever migration wrote the column.

				   THE NAME OF WHOEVER OWNS THE ACCOUNT. NOT NULL is one rule and „not
				   only spaces" is another, and the second is the one a reviewer skips:
				   NOT NULL takes a single blank happily, and a blank name draws as
				   nothing on the moderator screen and makes the initials „ ." for the
				   role switcher, which is the one thing the owner's decision of
				   14.09.2026 named the column for. */
				Violation.notNull("account_first_name_not_null", "first_name",
						"insert into account (first_name, last_name, email, role_id)"
								+ " values (null, 'Probic', 'bezimena@primer.rs', " + COMPETITOR + ")"),
				Violation.notNull("account_last_name_not_null", "last_name",
						"insert into account (first_name, last_name, email, role_id)"
								+ " values ('Probni', null, 'bezprezimena@primer.rs', " + COMPETITOR + ")"),
				Violation.of("account_first_name_not_blank",
						"insert into account (first_name, last_name, email, role_id)"
								+ " values ('   ', 'Probic', 'prazna@primer.rs', " + COMPETITOR + ")"),
				Violation.of("account_last_name_not_blank",
						"insert into account (first_name, last_name, email, role_id)"
								+ " values ('Probni', '   ', 'prazno@primer.rs', " + COMPETITOR + ")"),

				/* AND THE MEMBER THE ACCOUNT NAMES. A member who is not there: the id one
				   past the highest, the same way the role above is asked for, so that
				   nothing here depends on which numbers the sequence handed out. */
				Violation.of("account_competitor_fk",
						"insert into account (first_name, last_name, email, role_id, competitor_id)"
								+ " values ('Probni', 'Probic', 'nepostoji@primer.rs', " + COMPETITOR
								+ ", (select max(id) + 1 from competitor))"),
				/* And a SECOND account on the member the probe already names, which is the
				   half of „jedan nalog je tacno jedan clan" that looks at the member's
				   side. Without the unique key one man could hang off two logins, and
				   which of them is his would be a question with two answers. The other
				   half - that an account may name NOBODY - is behaviour rather than a
				   refusal and is AccountAndVerificationTest's. */
				Violation.of("account_competitor_unique",
						"insert into account (first_name, last_name, email, role_id, competitor_id)"
								+ " values ('Drugi', 'Nalog', 'dvostruki@primer.rs', " + COMPETITOR + ", "
								+ PROBE_MEMBER + ")"),

				Violation.notNull("account_id_not_null", "id",
						"insert into account (id, first_name, last_name, email, role_id)"
								+ " values (null, 'Probni', 'Probic', 'drugi@primer.rs', " + COMPETITOR
								+ ")"),
				Violation.notNull("account_email_not_null", "email", account("null, " + COMPETITOR)),
				Violation.notNull("account_role_id_not_null", "role_id", account("'drugi@primer.rs', null")),

				// ----------------------------------------------- email_verification_token
				Violation.of("email_verification_token_pk",
						"insert into email_verification_token (id, account_id, token_hash, expires_at) "
								+ "select id, account_id, '" + OTHER_HASH
								+ "', expires_at from email_verification_token where token_hash = '" + PROBE_HASH
								+ "'"),
				/* A link pointing at no account. The other direction of the same key,
				   that deleting the account takes the link with it, is behaviour and
				   is measured in AccountAndVerificationTest. */
				Violation.of("email_verification_token_account_fk",
						token("(select max(id) + 1 from account), '" + OTHER_HASH + "', " + AN_INSTANT)),
				/* Two links whose stored value is the same would be one link opening
				   either account, and a collision out of a CSPRNG does not happen
				   (ADL A8). */
				Violation.of("email_verification_token_hash_unique",
						token(PROBE_ACCOUNT + ", '" + PROBE_HASH + "', " + AN_INSTANT)),

				/* The four rows that carry the security statement of this migration:
				   what goes in the column is a digest and not the token that travels
				   in the link. Each is what a link token really looks like. */
				// base64url, forty three characters, as a token of thirty two bytes is
				// usually written into an address
				Violation.of("email_verification_token_hash_shape",
						token(PROBE_ACCOUNT + ", 'kJ8sQw3nR7tYvB1xZ0aC5dE9fG2hI4jK6lM8nO0pQ-_', " + AN_INSTANT)),
				// a UUID, dashes and all
				Violation.of("email_verification_token_hash_shape",
						token(PROBE_ACCOUNT + ", '3f2504e0-4f89-11d3-9a0c-0305e82c3301', " + AN_INSTANT)),
				// the right length and the right alphabet in capitals, because a digest
				// written two ways is a digest that can be stored twice
				Violation.of("email_verification_token_hash_shape",
						token(PROBE_ACCOUNT + ", '" + OTHER_HASH.toUpperCase() + "', " + AN_INSTANT)),
				// thirty two hexadecimal characters, which is an MD5 and not what this
				// column holds
				Violation.of("email_verification_token_hash_shape",
						token(PROBE_ACCOUNT + ", '" + OTHER_HASH.substring(0, 32) + "', " + AN_INSTANT)),

				Violation.notNull("email_verification_token_id_not_null", "id",
						"insert into email_verification_token (id, account_id, token_hash, expires_at) values (null, "
								+ PROBE_ACCOUNT + ", '" + OTHER_HASH + "', " + AN_INSTANT + ")"),
				Violation.notNull("email_verification_token_account_id_not_null", "account_id",
						token("null, '" + OTHER_HASH + "', " + AN_INSTANT)),
				Violation.notNull("email_verification_token_token_hash_not_null", "token_hash",
						token(PROBE_ACCOUNT + ", null, " + AN_INSTANT)),
				/* No link without an end, and this is the half the default does not
				   cover: a default speaks for a column that was left out of the
				   statement, and this row puts null in it out loud. Without the NOT
				   NULL the row would go in and the link would never expire. */
				Violation.notNull("email_verification_token_expires_at_not_null", "expires_at",
						token(PROBE_ACCOUNT + ", '" + OTHER_HASH + "', null")));
	}

	private static String account(String values) {
		return ACCOUNT_INSERT + values + ")";
	}

	private static String token(String values) {
		return TOKEN_INSERT + values + ")";
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
	 * A hand written list is not the fault; a hand written list with nothing
	 * underneath it is. This asks PostgreSQL what the two tables actually carry,
	 * so neither side can drift: a constraint added to the migration without a
	 * row above fails here, and a row above naming one that has been dropped
	 * fails here too.
	 *
	 * Unique indexes that back a constraint are left out and not listed twice:
	 * every primary key and every unique constraint owns one, and it answers
	 * under the constraint's name. What is left is the index that is a rule of
	 * its own, which here is the one over lower(email).
	 *
	 * {@code regclass} rather than a name compared against {@code pg_class}: the
	 * cast resolves the tables the same way a query in this session resolves
	 * them, so the answer cannot come from a table of the same name in another
	 * schema.
	 */
	/**
	 * AND WHAT THE PORTAL ITSELF WRITES GOES IN.
	 *
	 * <p>The floor under the four algorithm names in the migration. The rows above say
	 * which strings the column refuses, and a list of refusals can be complete and
	 * still be wrong in the other direction: a pattern that refuses everything refuses
	 * `{noop}` too. This asks the one question those rows cannot, and it asks it of the
	 * encoder rather than of a string written out here, so it keeps answering the day
	 * {@link com.btl.portal.domain.account.StoredPassword} moves to another algorithm - at which point it fails and
	 * asks for a migration, which is the decision being made out loud.
	 */
	@Test
	void theHashThePortalItselfWritesIsAHashTheColumnTakes() {
		String written = new com.btl.portal.domain.account.StoredPassword().of("dvanaest1234sasvim");

		assertThat(db.sql("insert into account (first_name, last_name, email, role_id, password_hash)"
				+ " values ('Probni', 'Probic', 'koder@primer.rs', " + COMPETITOR + ", ?)").param(written).update())
				.as("the column refuses the very hash the portal writes, so nobody could sign in")
				.isOne();
	}

	/**
	 * AN ACCOUNT WITH NO PASSWORD IS A REAL STATE, and nothing measured it.
	 *
	 * <p>{@code password_hash} is nullable on purpose and V18 writes out why: the
	 * owner opens accounts for honorary members and for profiles that exist before
	 * the portal launches, and those people set a password through the reset link
	 * rather than at the moment the row is written. A NOT NULL would force every one
	 * of them through a placeholder hash, which is a password nobody chose and
	 * everybody could guess the shape of.
	 *
	 * <p>That was a decision with no guard at all: every case in this file either
	 * writes a hash or writes a bad one, and not one wrote none. Found on
	 * 12.09.2026 while re-running a mutation list that had been reporting nonsense -
	 * the runner had never started the build, and a non-zero exit from a command
	 * that does not exist reads exactly like a mutation being caught.
	 *
	 * <p><b>And a thing worth knowing about the constraint itself, measured on the
	 * way.</b> Removing {@code password_hash is null or} from
	 * {@code account_password_hash_shape} changes NOTHING: in SQL a comparison with
	 * NULL is NULL, and a CHECK refuses only what is FALSE, so an absent hash goes
	 * through either way. That clause is explanation, not enforcement, and nothing
	 * can be measured against it. What CAN be measured is the column itself, and
	 * both of the mutations that really move it fail here: the column made NOT NULL,
	 * and the condition changed to demand that a hash be there.
	 */
	@Test
	void anAccountWithNoPasswordIsARealState() {
		assertThat(db.sql("insert into account (first_name, last_name, email, role_id)"
				+ " values ('Probni', 'Probic', 'bezlozinke@primer.rs', "
				+ COMPETITOR + ")").update())
				.as("an account could not be opened without a password, and that is how the owner opens them")
				.isOne();

		assertThat(db.sql("select password_hash from account where email = 'bezlozinke@primer.rs'")
				.query(String.class).optional())
				.as("something was written into the column that nobody put there")
				.isEmpty();
	}

	@Test
	void everyConstraintOnTheTwoTablesHasARowThatBreaksIt() {
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
	 * And a row that breaks nothing goes in.
	 *
	 * Without this every constraint above could be replaced by one that rejects
	 * everything and the whole file would still pass. It is the mutation that
	 * would otherwise be answered by turning a check off.
	 */
	@ParameterizedTest
	@ValueSource(strings = { GOOD_ACCOUNT, GOOD_TOKEN })
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isEqualTo(1);
	}

	/**
	 * The floor under the four invisible characters above, so that they are four
	 * stories and not four entries on a list nobody can finish.
	 *
	 * A list of characters an address may not carry cannot be completed by
	 * thinking about it: U+00A0 was found, then U+200B, then U+00AD, and the next
	 * one is found by whoever pastes it into the registration form. So the check
	 * names what an address MAY carry instead, and this asks the database which
	 * characters that turns out to be - every code point there is, in the local
	 * part and in the domain, against the constraint's own expression.
	 *
	 * The expression is READ OUT OF THE CATALOGUE and never written here. A test
	 * carrying its own copy of the pattern would agree with itself no matter what
	 * the table was actually built with, which is the one thing this has to rule
	 * out; {@code pg_get_expr} hands back the expression PostgreSQL is really
	 * enforcing, referring to {@code email}, and the lateral below gives it an
	 * {@code email} to refer to.
	 *
	 * Both positions, and joined with UNION rather than INTERSECT: a character let
	 * in on one side alone is still a character an address can carry, and union is
	 * the direction that shows it. Surrogates are left out because they are not
	 * characters in UTF-8 at all and {@code chr()} refuses them by name.
	 *
	 * What it costs: no address outside ASCII, ever, and that is the boundary the
	 * migration writes down rather than a corner it forgot.
	 */
	@Test
	void anAddressMayCarryEveryVisibleAsciiCharacterExceptTheAtSignAndNothingElse() {
		String shape = db
				.sql("select pg_get_expr(con.conbin, con.conrelid) from pg_constraint con"
						+ " where con.conrelid = 'account'::regclass and con.conname = 'account_email_shape'")
				.query(String.class)
				.single();

		List<Integer> accepted = db
				.sql(sweep("'proba' || chr(code_point) || '@primer.rs'", shape) + " union "
						+ sweep("'proba@pri' || chr(code_point) || 'mer.rs'", shape) + " order by 1")
				.query(Integer.class)
				.list();

		List<Integer> visibleAscii = IntStream.rangeClosed('!', '~').filter(point -> point != '@').boxed().toList();

		assertThat(accepted)
				.as("an address is ! through ~ without @, and the day that changes it is a decision and not a regular "
						+ "expression somebody widened")
				.containsExactlyElementsOf(visibleAscii);
	}

	/** Every code point in turn, dropped into an address that is otherwise good. */
	private static String sweep(String address, String shape) {
		return "select code_point from generate_series(1, 1114111) code_point,"
				+ " lateral (select " + address + " as email) probe"
				+ " where code_point not between 55296 and 57343 and " + shape;
	}
}

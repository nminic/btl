package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint the two tables of V5 carry, with the row that breaks it.
 *
 * The same shape as ConstraintsTest, and for the same reason: a constraint
 * nobody has broken on purpose is an intention rather than a constraint, and a
 * CHECK with a typo in the regular expression sits there looking like protection
 * and lets the row through. So each one gets a row that it, and only it, must
 * reject, and the failure has to name it.
 *
 * The floor under the hand written list is
 * {@link #everyConstraintOnTheTwoTablesHasARowThatBreaksIt()}, and it reads two
 * catalogues rather than one. {@code pg_constraint} carries the keys, the
 * uniques and the checks, and on PostgreSQL 18 the NOT NULLs as well. It does
 * not carry a unique INDEX, and one of the two rules of this migration is an
 * index because it has to be: PostgreSQL will not take a WHERE clause on a
 * unique constraint, and "at most one role holds everything" is exactly a rule
 * about some of the rows. A floor reading only the first catalogue would have
 * let that one be dropped without a word.
 */
class RoleAndRightConstraintsTest extends DatabaseTest {

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
			return constraint;
		}
	}

	/**
	 * The two tables V5 adds. The three of the first increment answer to
	 * ConstraintsTest, which is scoped to them the same way.
	 *
	 * Package visible because
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()}
	 * adds this list to its own and compares the two against {@code pg_tables}:
	 * that is what keeps a hand written list of table names honest here and there,
	 * and it reads the field rather than a name, so dropping it stops the compiler.
	 */
	static final List<String> TABLES = List.of("role", "admin_right");

	private static final String ROLE_INSERT = "insert into role (code, rights_mode, in_use) values (";
	private static final String RIGHT_INSERT = "insert into admin_right (scope, target) values (";

	/* A row of each table that breaks nothing: every violation below is one of
	   these with a single field spoiled, so what fails is the field and not the
	   fixture. Written out rather than built by the two helpers below, because
	   the annotation that uses them takes a constant and a method call is not
	   one. */
	private static final String GOOD_ROLE = ROLE_INSERT + "'probna_uloga', 'none', false)";
	private static final String GOOD_RIGHT = RIGHT_INSERT + "'entity', 'probno')";

	static List<Violation> violations() {
		return List.of(
				// ------------------------------------------------------------------- role
				Violation.of("role_pk",
						"insert into role (id, code, rights_mode, in_use) "
								+ "select id, 'probna_uloga', 'none', false from role where code = 'moderator'"),
				Violation.of("role_code_unique", role("'moderator', 'none', false")),
				/* A capital letter, which is also the case the dictionary and the
				   front end never use. It cannot trip the unique instead: the
				   default collation is deterministic, so Probna and probna are two
				   codes. */
				Violation.of("role_code_shape", role("'Probna', 'none', false")),
				Violation.of("role_rights_mode_known", role("'probna_uloga', 'some', false")),
				/* The security rule of this migration, and the one that is an index
				   rather than a constraint. A second role holding everything would be
				   a way to hold every right that nobody ticked and no screen would
				   name (rights.ts useMay, PDL P28a). */
				Violation.of("role_only_one_holds_every_right", role("'probna_uloga', 'all', false")),
				Violation.notNull("role_id_not_null", "id",
						"insert into role (id, code, rights_mode, in_use) values (null, 'probna_uloga', 'none', false)"),
				Violation.notNull("role_code_not_null", "code", role("null, 'none', false")),
				Violation.notNull("role_rights_mode_not_null", "rights_mode", role("'probna_uloga', null, false")),
				Violation.notNull("role_in_use_not_null", "in_use", role("'probna_uloga', 'none', null")),

				// ------------------------------------------------------------ admin_right
				Violation.of("admin_right_pk",
						"insert into admin_right (id, scope, target) "
								+ "select id, 'entity', 'probno' from admin_right where code = 'entity:members'"),
				/* The pair repeated, refused through the key composed from it. */
				Violation.of("admin_right_code_unique", right("'entity', 'members'")),
				Violation.of("admin_right_scope_known", right("'page', 'probno'")),
				Violation.of("admin_right_target_shape", right("'entity', 'Probno'")),
				/* A colon in the target, and this is the row that carries the
				   design rather than tidiness. The key is composed as scope, colon,
				   target, so a target allowed to hold one would let two different
				   pairs compose the same key and the unique above would be a
				   sentence about nothing. */
				Violation.of("admin_right_target_shape", right("'entity', 'probno:jos'")),
				Violation.notNull("admin_right_id_not_null", "id",
						"insert into admin_right (id, scope, target) values (null, 'entity', 'probno')"),
				Violation.notNull("admin_right_scope_not_null", "scope", right("null, 'probno'")),
				Violation.notNull("admin_right_target_not_null", "target", right("'entity', null")));
	}

	private static String role(String values) {
		return ROLE_INSERT + values + ")";
	}

	private static String right(String values) {
		return RIGHT_INSERT + values + ")";
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
	 * its own.
	 *
	 * {@code regclass} rather than a name compared against {@code pg_class}: the
	 * cast resolves the tables the same way a query in this session resolves
	 * them, so the answer cannot come from a table of the same name in another
	 * schema.
	 */
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
	@ValueSource(strings = { GOOD_ROLE, GOOD_RIGHT })
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isEqualTo(1);
	}
}

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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Every constraint the three tables of V8 carry, with the row that breaks it.
 *
 * A constraint nobody has broken on purpose is an intention rather than a
 * constraint, so each one below gets a row that it, and only it, must reject,
 * and the failure has to name it: an insert that trips a different constraint
 * proves nothing about this one. The shape is AccountConstraintsTest's, and the
 * floor under the hand written list is the same one -
 * {@link #everyConstraintOnTheThreeTablesHasARowThatBreaksIt()} reads the
 * constraints back out of {@code pg_constraint}.
 *
 * <p>What these three tables are, and why they are three and not columns on the
 * member: the document number leaves the table the portal's screens read because
 * ADL A12 calls it the most sensitive item in the register and A41 settled it as
 * the same database in a table of its own; the consent is four things that
 * together are the evidence a parent gave it; and the photograph is a row whose
 * id is the name of the file on the server's disk (ADL A36 O8).
 */
class RegistrationConstraintsTest extends DatabaseTest {

	/**
	 * One row that must be rejected, and the constraint that has to be the reason.
	 *
	 * {@code evidence} is what the database says when that constraint is the one
	 * that fired: its own name for a CHECK, a UNIQUE or a key, and the column for
	 * a NOT NULL, which PostgreSQL words by column and relation instead.
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
	 * The three tables V8 adds. The others answer to their own files, scoped the
	 * same way.
	 *
	 * Package visible because
	 * {@link ConstraintsTest#everyTableInTheSchemaIsClaimedByAConstraintTest()}
	 * adds this list to the same list in every sibling and compares them against
	 * {@code pg_tables}: that is the floor that lets each of these files name its
	 * tables by hand, and it reads the field rather than a name, so removing it
	 * stops the compiler rather than quietly narrowing the comparison.
	 */
	static final List<String> TABLES = List.of("competitor_document", "parental_consent", "photo");

	private static final String PROBE_MEMBER = "000920";
	private static final String PROBE_COMPETITOR =
			"(select id from competitor where member_number = '" + PROBE_MEMBER + "')";
	private static final String OTHER_COMPETITOR =
			"(select id from competitor where member_number = '000921')";

	private static final String A_TOWN = "(select id from place where rank = 1)";
	private static final String AN_INSTANT = "timestamptz '2027-01-01 00:00:00+00'";

	/* SHA-256 of nothing in particular, and obvious rather than plausible so
	   nobody reads it as the digest of a real file. */
	private static final String A_DIGEST = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender, birth_date,"
			+ " place_id, city, country_id, first_season, first_season_2027, active, membership_basis,"
			+ " referral_code, referred_by, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	private static final String DOCUMENT_INSERT = "insert into competitor_document"
			+ " (competitor_id, document_number) values (";
	private static final String CONSENT_INSERT = "insert into parental_consent"
			+ " (competitor_id, guardian_name, relation, given_at, given_from) values (";
	private static final String PHOTO_INSERT = "insert into photo"
			+ " (media_type, byte_size, digest, crop_x, crop_y, crop_side) values (";

	private static final String GOOD_DOCUMENT = DOCUMENT_INSERT + OTHER_COMPETITOR + ", 'AB1234567')";
	private static final String GOOD_CONSENT = CONSENT_INSERT + OTHER_COMPETITOR + ", 'Marija Probna', 'mother', "
			+ AN_INSTANT + ", inet '192.0.2.10')";
	private static final String GOOD_PHOTO = PHOTO_INSERT + "'image/jpeg', 40960, '" + A_DIGEST + "', 0, 0, 512)";

	/**
	 * Two members, and two rather than one for the reason the workspace rules
	 * write down: a case whose value could have come from the only row of its kind
	 * measures nothing. The first carries a document, a consent and a photograph,
	 * so the keys above have something to collide with; the second carries none,
	 * so a legitimate row has somewhere to go.
	 *
	 * The class is transactional and rolled back, so this is written afresh for
	 * every case.
	 */
	@BeforeEach
	void probe() {
		db.sql(member(PROBE_MEMBER, "'00112233445566c0'")).update();
		db.sql(member("000921", "'00112233445566c1'")).update();

		db.sql(DOCUMENT_INSERT + PROBE_COMPETITOR + ", 'CD7654321')").update();
		db.sql(CONSENT_INSERT + PROBE_COMPETITOR + ", 'Petar Probni', 'father', " + AN_INSTANT
				+ ", inet '198.51.100.7')").update();
		/* And one photograph, because the key over its id can only be broken by a row that collides
		   with one that is there: against an empty table the case below inserts nothing and proves
		   nothing. */
		db.sql(PHOTO_INSERT + "'image/png', 2048, '" + A_DIGEST + "', 4, 4, 256)").update();
	}

	private static String member(String number, String referralCode) {
		return "insert into competitor (" + COMPETITOR_COLUMNS + ") values ('" + number + "', 'Probni', 'Clan',"
				+ " 'M', date '1990-05-05', " + A_TOWN + ", null, null, 2027, false, true, 'payment', "
				+ referralCode + ", null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')";
	}

	static List<Violation> violations() {
		return List.of(
				/* THE DOCUMENT NUMBER. One member, one number: a second row for the
				   same member would be a register that says two things about him. */
				Violation.of("competitor_document_pk", DOCUMENT_INSERT + PROBE_COMPETITOR + ", 'EF1112223')"),
				Violation.of("competitor_document_competitor_fk",
						DOCUMENT_INSERT + "(select max(id) + 1 from competitor), 'GH1112223')"),
				Violation.notNull("competitor_document_competitor_id_not_null", "competitor_id",
						DOCUMENT_INSERT + "null, 'IJ1112223')"),
				Violation.notNull("competitor_document_document_number_not_null", "document_number",
						DOCUMENT_INSERT + OTHER_COMPETITOR + ", null)"),
				Violation.of("competitor_document_number_not_blank",
						DOCUMENT_INSERT + OTHER_COMPETITOR + ", '   ')"),
				/* A dash is not a letter and not a digit. The shape is deliberately
				   not one country's card, because the league runs across the Balkans,
				   but it is not everything either. */
				Violation.of("competitor_document_number_shape",
						DOCUMENT_INSERT + OTHER_COMPETITOR + ", 'AB-123')"),
				Violation.of("competitor_document_number_shape",
						DOCUMENT_INSERT + OTHER_COMPETITOR + ", 'ABCDEFGHIJ1234567890X')"),

				/* THE PARENT'S CONSENT, and every one of its four parts is required,
				   because together they are the evidence and separately they are
				   nothing. */
				Violation.of("parental_consent_pk", CONSENT_INSERT + PROBE_COMPETITOR + ", 'Ana Probna', 'mother', "
						+ AN_INSTANT + ", inet '192.0.2.11')"),
				Violation.of("parental_consent_competitor_fk",
						CONSENT_INSERT + "(select max(id) + 1 from competitor), 'Ana Probna', 'mother', "
								+ AN_INSTANT + ", inet '192.0.2.11')"),
				Violation.notNull("parental_consent_competitor_id_not_null", "competitor_id",
						CONSENT_INSERT + "null, 'Ana Probna', 'mother', " + AN_INSTANT + ", inet '192.0.2.11')"),
				Violation.notNull("parental_consent_guardian_name_not_null", "guardian_name",
						CONSENT_INSERT + OTHER_COMPETITOR + ", null, 'mother', " + AN_INSTANT
								+ ", inet '192.0.2.11')"),
				Violation.of("parental_consent_guardian_name_not_blank",
						CONSENT_INSERT + OTHER_COMPETITOR + ", '   ', 'mother', " + AN_INSTANT
								+ ", inet '192.0.2.11')"),
				Violation.notNull("parental_consent_relation_not_null", "relation",
						CONSENT_INSERT + OTHER_COMPETITOR + ", 'Ana Probna', null, " + AN_INSTANT
								+ ", inet '192.0.2.11')"),
				/* A fourth relation, which the form cannot offer. */
				Violation.of("parental_consent_relation_known",
						CONSENT_INSERT + OTHER_COMPETITOR + ", 'Ana Probna', 'aunt', " + AN_INSTANT
								+ ", inet '192.0.2.11')"),
				Violation.notNull("parental_consent_given_at_not_null", "given_at",
						CONSENT_INSERT + OTHER_COMPETITOR + ", 'Ana Probna', 'mother', null,"
								+ " inet '192.0.2.11')"),
				Violation.notNull("parental_consent_given_from_not_null", "given_from",
						CONSENT_INSERT + OTHER_COMPETITOR + ", 'Ana Probna', 'mother', " + AN_INSTANT + ", null)"),

				/* THE PHOTOGRAPH. Its id is the name of the file, so nothing here may
				   be missing: a row without a type or a digest describes a file the
				   server could not verify. */
				Violation.notNull("photo_media_type_not_null", "media_type",
						PHOTO_INSERT + "null, 40960, '" + A_DIGEST + "', 0, 0, 512)"),
				/* A type the server cannot recognise by content, and one nobody may
				   store by trusting the name a browser sent (ADL A12a, 1). */
				Violation.of("photo_media_type_known",
						PHOTO_INSERT + "'image/gif', 40960, '" + A_DIGEST + "', 0, 0, 512)"),
				Violation.notNull("photo_byte_size_not_null", "byte_size",
						PHOTO_INSERT + "'image/jpeg', null, '" + A_DIGEST + "', 0, 0, 512)"),
				/* A file of no bytes is not a file. */
				Violation.of("photo_byte_size_positive",
						PHOTO_INSERT + "'image/jpeg', 0, '" + A_DIGEST + "', 0, 0, 512)"),
				Violation.notNull("photo_digest_not_null", "digest",
						PHOTO_INSERT + "'image/jpeg', 40960, null, 0, 0, 512)"),
				/* Uppercase is not what a digest is written in here, and sixty three
				   characters are not sixty four. Both are rows somebody would write
				   by hand and neither is a digest this schema means. */
				Violation.of("photo_digest_shape",
						PHOTO_INSERT + "'image/jpeg', 40960, '" + A_DIGEST.toUpperCase() + "', 0, 0, 512)"),
				Violation.of("photo_digest_shape",
						PHOTO_INSERT + "'image/jpeg', 40960, '" + A_DIGEST.substring(1) + "', 0, 0, 512)"),
				Violation.notNull("photo_crop_x_not_null", "crop_x",
						PHOTO_INSERT + "'image/jpeg', 40960, '" + A_DIGEST + "', null, 0, 512)"),
				Violation.notNull("photo_crop_y_not_null", "crop_y",
						PHOTO_INSERT + "'image/jpeg', 40960, '" + A_DIGEST + "', 0, null, 512)"),
				Violation.notNull("photo_crop_side_not_null", "crop_side",
						PHOTO_INSERT + "'image/jpeg', 40960, '" + A_DIGEST + "', 0, 0, null)"),
				/* All three corners of the same rule, because one of them passing is
				   not the other two passing: an offset may be zero but never negative,
				   and a side is never nothing. */
				Violation.of("photo_crop_inside",
						PHOTO_INSERT + "'image/jpeg', 40960, '" + A_DIGEST + "', -1, 0, 512)"),
				Violation.of("photo_crop_inside",
						PHOTO_INSERT + "'image/jpeg', 40960, '" + A_DIGEST + "', 0, -1, 512)"),
				Violation.of("photo_crop_inside",
						PHOTO_INSERT + "'image/jpeg', 40960, '" + A_DIGEST + "', 0, 0, 0)"),
				Violation.notNull("photo_id_not_null", "id",
						"insert into photo (id, media_type, byte_size, digest, crop_x, crop_y, crop_side)"
								+ " values (null, 'image/jpeg', 40960, '" + A_DIGEST + "', 0, 0, 512)"),
				Violation.of("photo_pk",
						"insert into photo (id, media_type, byte_size, digest, crop_x, crop_y, crop_side)"
								+ " select id, 'image/png', 1024, '" + A_DIGEST + "', 0, 0, 256 from photo"
								+ " limit 1"),
				Violation.notNull("photo_uploaded_at_not_null", "uploaded_at",
						"insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_side, uploaded_at)"
								+ " values ('image/jpeg', 40960, '" + A_DIGEST + "', 0, 0, 512, null)"),
				Violation.notNull("competitor_document_written_at_not_null", "written_at",
						"insert into competitor_document (competitor_id, document_number, written_at) values ("
								+ OTHER_COMPETITOR + ", 'KL1112223', null)"));
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
	 * underneath it is. This asks PostgreSQL what the three tables actually carry,
	 * so neither side can drift: a constraint added to the migration without a row
	 * above fails here, and a row above naming one that has been dropped fails
	 * here too.
	 *
	 * Unique indexes that back a constraint are left out and not listed twice:
	 * every primary key owns one and it answers under the constraint's name.
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
	 * And a row that breaks nothing goes in.
	 *
	 * Without this every constraint above could be replaced by one that rejects
	 * everything and the whole file would still pass. It is the mutation that
	 * would otherwise be answered by turning a check off.
	 */
	@ParameterizedTest
	@ValueSource(strings = { GOOD_DOCUMENT, GOOD_CONSENT, GOOD_PHOTO })
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}
}

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
 * V74: A BANK STATEMENT THE PAYMENTS SCREEN TOOK, AND EACH PAYMENT IT SAID ARRIVED. Every constraint on
 * the two tables has a row here that breaks it, the floor under that list is read out of the catalogue,
 * and the rows a statement really writes go in.
 */
class BankStatementConstraintsTest extends DatabaseTest {

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

	static final List<String> TABLES = List.of("bank_statement", "bank_statement_line");

	private static final String THE_MODERATOR = "(select id from account where email = 'izvod@primer.rs')";

	private static final String THE_STATEMENT = "(select id from bank_statement where number = 1)";

	private static final String A_PAYMENT = "(select id from payment order by id limit 1)";

	private static final String STATEMENT_COLUMNS = "account, number, dated, loaded_at, loaded_by, loaded_by_name";

	private static final String A_GOOD_STATEMENT = "'105-0000000003284-71', 2, date '2026-10-24',"
			+ " timestamptz '2026-10-25 09:00:00+00', " + THE_MODERATOR + ", 'Blagajnik Probni'";

	private static final String LINE_COLUMNS = "statement_id, position, order_number, payer, payer_account,"
			+ " amount, payment_code, purpose, reference, season, payment_id, waits_because";

	private static String statement(String values) {
		return "insert into bank_statement (" + STATEMENT_COLUMNS + ") values (" + values + ")";
	}

	private static String statementWithId(String id, String values) {
		return "insert into bank_statement (id, " + STATEMENT_COLUMNS + ") values (" + id + ", " + values + ")";
	}

	private static String line(String values) {
		return "insert into bank_statement_line (" + LINE_COLUMNS + ") values (" + values + ")";
	}

	/** A line set aside, the three columns of „Nije članarina" given. */
	private static String setAside(String paymentAndWhy, String at, String by, String name) {
		return "insert into bank_statement_line (statement_id, position, order_number, payer, amount, purpose,"
				+ " season, payment_id, waits_because, set_aside_at, set_aside_by, set_aside_by_name) values ("
				+ THE_STATEMENT + ", 5, 'E', 'P', 1.00, '', 2028, " + paymentAndWhy + ", " + at + ", " + by + ", "
				+ name + ")";
	}

	private static String lineWithId(String id, String values) {
		return "insert into bank_statement_line (id, " + LINE_COLUMNS + ") values (" + id + ", " + values + ")";
	}

	/** A line that breaks nothing, with its position and its order number free to be set. */
	private static String aLine(int position, String order) {
		return THE_STATEMENT + ", " + position + ", '" + order + "', 'PROBNI PLATILAC', '200-0000000000001-11',"
				+ " 4200.00, '289', 'Članarina', null, 2028, null, 'noReference'";
	}

	static List<Violation> violations() {
		return List.of(
				Violation.notNull("bank_statement_id_not_null", "id", statementWithId("null", A_GOOD_STATEMENT)),
				Violation.of("bank_statement_pk", statementWithId(THE_STATEMENT, A_GOOD_STATEMENT)),
				Violation.notNull("bank_statement_account_not_null", "account",
						statement("null, 2, date '2026-10-24', now(), null, 'Blagajnik Probni'")),
				Violation.of("bank_statement_account_shape",
						statement("'105-3284-71', 2, date '2026-10-24', now(), null, 'Blagajnik Probni'")),
				Violation.notNull("bank_statement_number_not_null", "number",
						statement("'105-0000000003284-71', null, date '2026-10-24', now(), null, 'Blagajnik Probni'")),
				Violation.of("bank_statement_number_positive",
						statement("'105-0000000003284-71', 0, date '2026-10-24', now(), null, 'Blagajnik Probni'")),
				Violation.notNull("bank_statement_dated_not_null", "dated",
						statement("'105-0000000003284-71', 2, null, now(), null, 'Blagajnik Probni'")),
				Violation.notNull("bank_statement_loaded_at_not_null", "loaded_at",
						statement("'105-0000000003284-71', 2, date '2026-10-24', null, null, 'Blagajnik Probni'")),
				Violation.of("bank_statement_loaded_by_fk",
						statement("'105-0000000003284-71', 2, date '2026-10-24', now(), 999999, 'Blagajnik Probni'")),
				Violation.notNull("bank_statement_loaded_by_name_not_null", "loaded_by_name",
						statement("'105-0000000003284-71', 2, date '2026-10-24', now(), null, null")),
				Violation.of("bank_statement_loaded_by_name_not_blank",
						statement("'105-0000000003284-71', 2, date '2026-10-24', now(), null, '  '")),
				/* THE SAME STATEMENT TWICE: its account, its number and its day. */
				Violation.of("bank_statement_one_of_a_kind",
						statement("'105-0000000003284-71', 1, date '2026-10-23', now(), null, 'Blagajnik Probni'")),

				Violation.notNull("bank_statement_line_id_not_null", "id", lineWithId("null", aLine(2, "B"))),
				Violation.of("bank_statement_line_pk",
						lineWithId("(select id from bank_statement_line limit 1)", aLine(2, "B"))),
				Violation.notNull("bank_statement_line_statement_id_not_null", "statement_id",
						line(aLine(2, "B").replaceFirst("^\\(select id from bank_statement where number = 1\\)", "null"))),
				Violation.of("bank_statement_line_statement_fk",
						line(aLine(2, "B").replaceFirst("^\\(select id from bank_statement where number = 1\\)", "999999"))),
				Violation.notNull("bank_statement_line_position_not_null", "position",
						line(THE_STATEMENT + ", null, 'B', 'P', null, 1.00, null, '', null, 2028, null, 'noReference'")),
				Violation.of("bank_statement_line_position_positive",
						line(THE_STATEMENT + ", 0, 'B', 'P', null, 1.00, null, '', null, 2028, null, 'noReference'")),
				Violation.notNull("bank_statement_line_order_number_not_null", "order_number",
						line(THE_STATEMENT + ", 2, null, 'P', null, 1.00, null, '', null, 2028, null, 'noReference'")),
				Violation.of("bank_statement_line_order_not_blank",
						line(THE_STATEMENT + ", 2, ' ', 'P', null, 1.00, null, '', null, 2028, null, 'noReference'")),
				Violation.notNull("bank_statement_line_payer_not_null", "payer",
						line(THE_STATEMENT + ", 2, 'B', null, null, 1.00, null, '', null, 2028, null, 'noReference'")),
				Violation.notNull("bank_statement_line_amount_not_null", "amount",
						line(THE_STATEMENT + ", 2, 'B', 'P', null, null, null, '', null, 2028, null, 'noReference'")),
				Violation.of("bank_statement_line_amount_positive",
						line(THE_STATEMENT + ", 2, 'B', 'P', null, 0.00, null, '', null, 2028, null, 'noReference'")),
				Violation.notNull("bank_statement_line_purpose_not_null", "purpose",
						line(THE_STATEMENT + ", 2, 'B', 'P', null, 1.00, null, null, null, 2028, null, 'noReference'")),
				Violation.notNull("bank_statement_line_season_not_null", "season",
						line(THE_STATEMENT + ", 2, 'B', 'P', null, 1.00, null, '', null, null, null, 'noReference'")),
				Violation.of("bank_statement_line_season_not_before_the_league",
						line(THE_STATEMENT + ", 2, 'B', 'P', null, 1.00, null, '', null, 2026, null, 'noReference'")),
				Violation.of("bank_statement_line_payment_fk",
						line(THE_STATEMENT + ", 2, 'B', 'P', null, 1.00, null, '', null, 2028, 999999, null")),
				Violation.of("bank_statement_line_waits_for_a_known_reason",
						line(THE_STATEMENT + ", 2, 'B', 'P', null, 1.00, null, '', null, 2028, null, 'alreadyRecorded'")),
				/* BOOKED AND WAITING AT ONCE. */
				Violation.of("bank_statement_line_booked_or_waiting",
						line(THE_STATEMENT + ", 2, 'B', 'P', null, 1.00, null, '', null, 2028, " + A_PAYMENT
								+ ", 'notBooked'")),
				/* ONE PAYMENT OF THE BANK ONCE, on whatever statement it is printed. */
				Violation.of("bank_statement_line_one_order_once",
						line("(select id from bank_statement where number = 7), 1, 'A', 'P', null, 1.00, null, '',"
								+ " null, 2028, null, 'noReference'")),
				Violation.of("bank_statement_line_one_position_once", line(aLine(1, "C"))),

				/* SET ASIDE: by an account that exists, with who and when together, with a name that says
				   something, and never over a booked line. */
				Violation.of("bank_statement_line_set_aside_by_fk",
						setAside("null, null", "now()", "999999", "'Blagajnik Probni'")),
				Violation.of("bank_statement_line_set_aside_says_who",
						setAside("null, null", "now()", THE_MODERATOR, "null")),
				Violation.of("bank_statement_line_set_aside_says_who",
						setAside("null, null", "null", THE_MODERATOR, "'Blagajnik Probni'")),
				Violation.of("bank_statement_line_set_aside_by_name_not_blank",
						setAside("null, null", "now()", THE_MODERATOR, "'  '")),
				Violation.of("bank_statement_line_set_aside_is_not_booked",
						setAside(A_PAYMENT + ", null", "now()", THE_MODERATOR, "'Blagajnik Probni'")));
	}

	@BeforeEach
	void aModeratorAStatementWithOneLineAndAPayment() {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Blagajnik',"
				+ " 'Probni', 'izvod@primer.rs', (select id from role where code = 'moderator'))").update();
		db.sql(statement("'105-0000000003284-71', 1, date '2026-10-23', now(), " + THE_MODERATOR
				+ ", 'Blagajnik Probni'")).update();
		db.sql(statement("'105-0000000003284-71', 7, date '2026-10-30', now(), null, 'Blagajnik Probni'")).update();
		db.sql(line(aLine(1, "A"))).update();

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
				+ " first_season, active, referral_code, bio, profile_hidden, birthday_shown,"
				+ " father_name, address, shirt_size, health_statement_at) values ('007000', 'Probni', 'Clan',"
				+ " 'M', date '1990-05-15', (select id from place where rank = 1), 2027, true,"
				+ " '00112233445566e1', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into payment (competitor_id, season, price_row_id, amount, currency, fee, method, state,"
				+ " recorded_at, recorded_by_name, received) values ((select id from competitor where member_number"
				+ " = '007000'), 2028, (select id from price_row order by id limit 1), 38.00, 'EUR', 3.00, 'paypal',"
				+ " 'recorded', now(), 'Blagajnik Probni', 38.00)").update();
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
	void everyConstraintOnTheseTablesHasARowThatBreaksIt() {
		String literals = TABLES.stream().map(name -> "'" + name + "'").collect(Collectors.joining(", "));
		String relations = " = any (array[" + literals + "]::regclass[])";

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
		assertThat(covered)
				.as("every constraint on %s needs a row above that breaks it", TABLES)
				.containsExactlyInAnyOrderElementsOf(declared);
	}

	static List<String> legitimateRows() {
		return List.of(
				/* A line the statement booked: the payment named, no reason to wait. */
				line(THE_STATEMENT + ", 2, 'B', 'P', null, 38.00, null, '', '2028007000', 2028, " + A_PAYMENT
						+ ", null"),
				/* A line whose payment was booked and then cancelled: neither. */
				line(THE_STATEMENT + ", 3, 'C', 'P', null, 38.00, null, '', null, 2028, null, null"),
				/* Every field the statement may leave out, left out. */
				line(THE_STATEMENT + ", 4, 'D', 'P', null, 0.01, null, '', null, 2027, null, 'notInDinars'"),
				/* Set aside as no membership fee, and by an account already gone. */
				setAside("null, null", "now()", THE_MODERATOR, "'Blagajnik Probni'"),
				setAside("null, null", "now()", "null", "'Blagajnik Probni'"),
				/* The statement of another day with the same number, which a new year starts again. */
				statement("'105-0000000003284-71', 1, date '2027-01-05', now(), null, 'Blagajnik Probni'"));
	}

	@ParameterizedTest
	@MethodSource("legitimateRows")
	void aLegitimateRowIsAccepted(String insert) {
		assertThat(db.sql(insert).update()).isOne();
	}

	/** The file itself is kept nowhere: no column of either table holds bytes. */
	@Test
	void noColumnHoldsTheFile() {
		assertThat(db.sql("select count(*) from information_schema.columns where table_schema = current_schema()"
						+ " and table_name in ('bank_statement', 'bank_statement_line') and data_type = 'bytea'")
				.query(Long.class).single()).isZero();
	}

	/** A cancelled payment leaves its line standing, and waiting again. */
	@Test
	void deletingThePaymentEmptiesTheLinesKeyAndKeepsTheLine() {
		db.sql(line(THE_STATEMENT + ", 2, 'B', 'P', null, 38.00, null, '', null, 2028, " + A_PAYMENT + ", null"))
				.update();

		db.sql("delete from payment").update();

		assertThat(db.sql("select count(*) from bank_statement_line where payment_id is null")
				.query(Long.class).single()).isEqualTo(2);
	}

	/** The account that took a statement may go, and the name stays. */
	@Test
	void deletingTheAccountEmptiesThePointerAndKeepsTheName() {
		db.sql("delete from account where email = 'izvod@primer.rs'").update();

		assertThat(db.sql("select coalesce(loaded_by::text, 'gone') || ' ' || loaded_by_name from bank_statement"
						+ " where number = 1").query(String.class).single())
				.isEqualTo("gone Blagajnik Probni");
	}
}

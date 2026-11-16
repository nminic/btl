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
 * Every constraint of what Facebook holds at the addresses its crawler read (V103), with the row that breaks it, and
 * what a deleted member takes with him.
 *
 * <p>The shape is {@link PointsAtTheFreezeConstraintsTest}'s: a list of violations, a floor read out of the database
 * that says the list names every constraint the table has, and a row that breaks nothing.
 */
class SharedCardConstraintsTest extends DatabaseTest {

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

	/** The one table V103 adds. */
	static final List<String> TABLES = List.of("shared_card");

	private static final String CARD = "'/api/cards/competitor/001130-sr1-0f3a9c2b7d4e6a18.jpg'";

	private static String row(String values) {
		return "insert into shared_card (member_number, address, card) values (" + values + ")";
	}

	/** One member, and one address of his Serbian page as Facebook holds it. */
	@BeforeEach
	void probe() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
				+ " first_season, referral_code, bio, profile_hidden, birthday_shown, father_name,"
				+ " address, shirt_size, health_statement_at) values ('001130', 'Probni', 'Podeljeni', 'M',"
				+ " date '1990-01-01', (select id from place where rank = 1), 2027, '00112233445566f3',"
				+ " '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql(row("'001130', '/sr/takmicar/001130-probni-podeljeni', " + CARD)).update();
	}

	static List<Violation> violations() {
		return List.of(
				Violation.of("shared_card_pk", row("'001130', '/sr/takmicar/001130-probni-podeljeni', null")),
				Violation.of("shared_card_member_fk", row("'009999', '/sr/takmicar/009999', " + CARD)),
				Violation.of("shared_card_card_is_a_card", row("'001130', '/en/takmicar/001130-probni', '/api/photos/1'")),
				Violation.of("shared_card_address_is_a_profile", row("'001130', '/de/takmicar/001130', " + CARD)),
				Violation.notNull("shared_card_member_number_not_null", "member_number",
						row("null, '/en/takmicar/001130', " + CARD)),
				Violation.notNull("shared_card_address_not_null", "address", row("'001130', null, " + CARD)));
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
	void everyConstraintOnTheTableHasARowThatBreaksIt() {
		List<String> declared = TABLES.stream()
				.flatMap(table -> db
						.sql("select con.conname from pg_constraint con where con.conrelid = cast(? as regclass)"
								+ " union all "
								+ "select index.relname from pg_index idx join pg_class index on index.oid = idx.indexrelid"
								+ " where idx.indrelid = cast(? as regclass) and idx.indisunique"
								+ " and not exists (select 1 from pg_constraint own where own.conindid = idx.indexrelid)")
						.params(table, table)
						.query(String.class)
						.list()
						.stream())
				.toList();

		Set<String> covered = violations().stream().map(Violation::constraint).collect(Collectors.toSet());

		assertThat(declared).isNotEmpty();
		assertThat(covered).containsExactlyInAnyOrderElementsOf(declared);
	}

	/**
	 * THE ADDRESS IS THE SHAPE THE PREVIEW WRITES AND NOTHING ELSE: the language, six digits, and the name after a
	 * dash or nothing. Each of these is one way of spelling it otherwise.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"/sr/takmicar/01130-probni", "/sr/takmicar/0011300", "/sr/takmicar/001130-",
			"/sr/takmicar/001130-probni/priznanja", "/sr/takmicar/001130/", "sr/takmicar/001130",
			"/sr/takmicar/001130-probni?k=1a2b", "/sr/takmicar/001130-Probni", "/sr/takmicar/001130-probni--x"})
	void anAddressSpeltOtherwiseIsRefused(String address) {
		assertThatThrownBy(() -> db.sql(row("'001130', ?, " + CARD)).param(address).update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("shared_card_address_is_a_profile");
	}

	/**
	 * A ROW WITHOUT A CARD is an address where Facebook holds the front page's preview (V103): a profile it read that
	 * is no longer shown, and that stays written down so that it is asked again when it is shown again.
	 */
	@Test
	void anAddressWhereFacebookHoldsTheFrontPageHasNoCard() {
		assertThat(db.sql(row("'001130', '/en/takmicar/001130-probni-podeljeni', null")).update()).isOne();
	}

	/**
	 * ANOTHER ADDRESS OF THE SAME MEMBER IS A ROW OF ITS OWN: the other language, a name he had before, the number
	 * alone. Nothing makes a member's addresses one row, so nothing can lose one to another.
	 */
	@Test
	void everyAddressOfAMemberIsARowOfItsOwn() {
		db.sql(row("'001130', '/en/takmicar/001130-probni-podeljeni', " + CARD)).update();
		db.sql(row("'001130', '/sr/takmicar/001130-stari-podeljeni', " + CARD)).update();
		db.sql(row("'001130', '/sr/takmicar/001130', null")).update();

		assertThat(db.sql("select count(*) from shared_card where member_number = '001130'").query(Integer.class)
				.single()).isEqualTo(4);
	}

	/**
	 * A DELETED MEMBER TAKES HIS ROWS WITH HIM, every one of them, in the statement that deletes him: the address
	 * carries his name, and the Privacy Policy says that it goes (V103).
	 */
	@Test
	void aDeletedMemberTakesHisRowsWithHim() {
		db.sql(row("'001130', '/sr/takmicar/001130-stari-podeljeni', null")).update();
		db.sql("delete from competitor where member_number = '001130'").update();

		assertThat(db.sql("select count(*) from shared_card").query(Integer.class).single())
				.as("a row outlived the member whose name it carries").isZero();
	}

	/** A member number that changes takes the row with it, and the address keeps the number Facebook read. */
	@Test
	void aMemberNumberThatChangesTakesTheRowWithIt() {
		db.sql("update competitor set member_number = '001131' where member_number = '001130'").update();

		assertThat(db.sql("select member_number || ' ' || address from shared_card").query(String.class).single())
				.isEqualTo("001131 /sr/takmicar/001130-probni-podeljeni");
	}
}

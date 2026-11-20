package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V106 DOES TO THE MEMBERS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V106 adds a column and a rule to {@code competitor}, which both real databases hold
 * rows in, with a telephone and without one. Every other test starts from an empty database, so a rule the rows
 * already standing break is invisible to all of them (CLAUDE.md, section 11).
 *
 * <p><b>What the migration is meant to do with such a row:</b> nothing. Nobody has asked to join the community
 * before the box exists, so every member comes out of it NULL, whatever his telephone, and that every one of them
 * passes untouched IS the measurement.
 *
 * <p><b>How the fixture is made</b>, the shape of {@link ResultImportedCarriedOverTest}: what V106 adds is undone
 * with one statement ({@code drop column ... cascade} takes its rule with it), the rows are written as a database
 * holds them before V106, and the migration is executed from the file Flyway resolved
 * ({@link DatabaseTest#migrationSql}), inside the test's transaction, which is rolled back.
 */
class ViberCommunityCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, city, country_id, first_season, referral_code, referred_by, bio,"
			+ " profile_hidden, birthday_shown, father_name, address, shirt_size, health_statement_at, phone";

	/** A member as a database holds him before V106, with the telephone given as SQL. */
	private void member(String number, String code, String phone) {
		db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values ('" + number + "', 'Stari', 'Clan', 'M',"
				+ " date '1984-04-04', " + A_TOWN + ", null, null, 2027, '" + code + "', null, '', false,"
				+ " 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00', " + phone + ")").update();
	}

	/** Every member of the fixture as {@code number | phone | wish}, in the order of the numbers. */
	private List<String> theRows() {
		return db.sql("select member_number || ' | ' || coalesce(phone, '-') || ' | '"
						+ " || coalesce(to_char(viber_community_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI'), '-')"
						+ " from competitor where member_number in ('000994', '000995') order by member_number")
				.query(String.class).list();
	}

	private void beforeV106() {
		jdbc.execute("alter table competitor drop column viber_community_at cascade");
		member("000994", "00112233445566f4", "'+381 64 111 2222'");
		member("000995", "00112233445566f5", "null");
	}

	/**
	 * THE MEMBERS GO THROUGH UNTOUCHED, AND THE RULE STANDS AFTERWARDS.
	 *
	 * <p>Read by behaviour and not out of the catalogue: after the migration the member with a telephone may ask,
	 * and the member with none is refused by the rule's own name. That the fixture really took V106 away is
	 * {@link #beforeV106ThereIsNoWishToWrite}.
	 */
	@Test
	void theMembersAlreadyThereHaveNotAskedAndAWishAfterwardsNeedsATelephone() {
		beforeV106();

		jdbc.execute(migrationSql("106"));

		assertThat(theRows()).as("V106 touched a member that stood before it, or gave the wish a default")
				.containsExactly("000994 | +381 64 111 2222 | -", "000995 | - | -");

		db.sql("update competitor set viber_community_at = timestamptz '2026-11-20 10:00:00+00'"
				+ " where member_number = '000994'").update();

		assertThat(theRows()).as("a member with a telephone could not ask")
				.containsExactly("000994 | +381 64 111 2222 | 2026-11-20 10:00", "000995 | - | -");
		/* LAST, because the refusal ends the transaction the case is in. */
		assertThatThrownBy(() -> db.sql("update competitor set viber_community_at = now()"
						+ " where member_number = '000995'").update())
				.isInstanceOf(DataIntegrityViolationException.class)
				.hasMessageContaining("competitor_viber_community_needs_a_phone");
	}

	/**
	 * THE FIXTURE REALLY TAKES V106 AWAY: the column is not there to write. Without this the case above could pass
	 * on a fixture that left it in place, with whatever it held.
	 */
	@Test
	void beforeV106ThereIsNoWishToWrite() {
		beforeV106();

		assertThatThrownBy(() -> db.sql("update competitor set viber_community_at = now()").update())
				.hasMessageContaining("viber_community_at");
	}
}

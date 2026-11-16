package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V104 DOES TO THE ROWS OF {@code shared_card} THAT ARE ALREADY THERE, run against a real database.
 *
 * <p><b>Why this exists.</b> V104 adds a column to a table production already holds rows in (every address Facebook's
 * crawler has read since PR 744). Every other test starts from an empty database and writes its own rows, so what the
 * migration does to a row standing before it is invisible to all of them; CLAUDE.md, section 11, is the day that cost
 * the QA server.
 *
 * <p><b>What the migration is meant to do with such a row:</b> nothing but give it an empty {@code asked_at}, because
 * nobody knows when it was last asked about, so it comes first in the next run, before any row the job has asked about
 * since; its card stays what Facebook holds. That the rows go through and keep their cards IS the measurement.
 *
 * <p><b>How the fixture is made</b>, the shape of {@link ResultBroughtInCarriedOverTest}: what V104 adds is taken away
 * with one {@code drop column ... cascade}, rows are written as a database holds them before V104 (one with a card and
 * one where Facebook holds the front page), and the migration is executed from the file Flyway resolved
 * ({@link DatabaseTest#migrationSql}), inside the test's transaction, which is rolled back.
 */
class SharedCardAskedAtCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String CARD = "/api/cards/competitor/001131-sr1-0f3a9c2b7d4e6a18.jpg";

	private List<String> columnsOfSharedCard() {
		return db.sql("select column_name from information_schema.columns where table_schema = current_schema()"
				+ " and table_name = 'shared_card' order by ordinal_position").query(String.class).list();
	}

	/** The table as it stood before V104, with two rows of one member in it. */
	private void rowsAsTheyStoodBeforeV104() {
		jdbc.execute("alter table shared_card drop column asked_at cascade");
		assertThat(columnsOfSharedCard())
				.as("the fixture left what V104 adds in place, so the migration below would fail on the fixture and"
						+ " not on itself")
				.containsExactly("member_number", "address", "card");

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
				+ " first_season, referral_code, bio, profile_hidden, birthday_shown, father_name,"
				+ " address, shirt_size, health_statement_at) values ('001131', 'Zateceni', 'Podeljeni', 'M',"
				+ " date '1990-01-01', (select id from place where rank = 1), 2027, '00112233445566f4',"
				+ " '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into shared_card (member_number, address, card) values ('001131',"
				+ " '/sr/takmicar/001131-zateceni-podeljeni', ?), ('001131', '/en/takmicar/001131-zateceni-podeljeni',"
				+ " null)").param(CARD).update();
	}

	@Test
	void theRowsAlreadyThereKeepTheirCardsAndWereNeverAskedAbout() {
		rowsAsTheyStoodBeforeV104();

		jdbc.execute(migrationSql("104"));

		assertThat(columnsOfSharedCard()).containsExactly("member_number", "address", "card", "asked_at");
		assertThat(db.sql("select address || ' ' || coalesce(card, 'null') || ' ' || coalesce(asked_at::text, 'never')"
						+ " from shared_card where member_number = '001131' order by address")
				.query(String.class).list())
				.containsExactly("/en/takmicar/001131-zateceni-podeljeni null never",
						"/sr/takmicar/001131-zateceni-podeljeni " + CARD + " never");
	}
}

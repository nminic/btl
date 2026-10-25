package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V74 OVER A DATABASE THAT ALREADY HOLDS WHAT A REAL ONE HOLDS (`btl/CLAUDE.md`, section 11).
 *
 * <p>V74 creates its two tables, so no row of them stands before it runs and none of their constraints
 * can meet one. What it does touch that already stands is the two tables it points at: an account and
 * a payment. So the case takes away what V74 made, writes an account, a member and a recorded payment
 * the way a database holds them, runs the migration itself over them, and asks that it ran, that it
 * touched none of them, and that a line naming that payment and that account goes in.
 */
class BankStatementCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	@BeforeEach
	void anAccountAMemberAndAPaymentWrittenBeforeV74() {
		jdbc.execute("drop table bank_statement_line, bank_statement cascade");

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Blagajnik', 'Zatecen',"
				+ " 'zatecen@primer.rs', (select id from role where code = 'moderator'))").update();
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date, place_id,"
				+ " first_season, first_season_2027, active, referral_code, bio, profile_hidden, birthday_shown,"
				+ " father_name, address, shirt_size, health_statement_at) values ('008000', 'Zatecen', 'Clan',"
				+ " 'M', date '1990-05-15', (select id from place where rank = 1), 2027, false, true,"
				+ " '00112233445566f1', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into payment (competitor_id, season, price_row_id, amount, currency, fee, method, state,"
				+ " recorded_at, recorded_by_name, received) values ((select id from competitor where member_number"
				+ " = '008000'), 2027, (select id from price_row order by id limit 1), 38.00, 'EUR', 3.00, 'paypal',"
				+ " 'recorded', now(), 'Blagajnik Zatecen', 38.00)").update();
	}

	@Test
	void itRunsOverThemTouchesNoneOfThemAndALineMayNameThem() {
		String before = db.sql("select p.id || ' ' || p.amount || ' ' || a.email from payment p, account a"
				+ " where a.email = 'zatecen@primer.rs'").query(String.class).single();

		jdbc.execute(migrationSql("74"));

		assertThat(db.sql("select p.id || ' ' || p.amount || ' ' || a.email from payment p, account a"
				+ " where a.email = 'zatecen@primer.rs'").query(String.class).single()).isEqualTo(before);

		db.sql("insert into bank_statement (account, number, dated, loaded_at, loaded_by, loaded_by_name) values"
				+ " ('105-0000000003284-71', 1, date '2026-10-23', now(),"
				+ " (select id from account where email = 'zatecen@primer.rs'), 'Blagajnik Zatecen')").update();
		db.sql("insert into bank_statement_line (statement_id, position, order_number, payer, amount, purpose, season,"
				+ " payment_id) values ((select id from bank_statement), 1, 'N1', 'ZATECEN CLAN', 38.00, '', 2027,"
				+ " (select id from payment))").update();

		assertThat(db.sql("select count(*) from bank_statement_line where payment_id is not null")
				.query(Long.class).single()).isEqualTo(1);
	}
}

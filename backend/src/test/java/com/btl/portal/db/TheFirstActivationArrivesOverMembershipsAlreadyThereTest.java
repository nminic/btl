package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT V82 DOES TO THE MEMBERSHIPS THAT ARE ALREADY THERE, run against a real database.
 *
 * <p>Every other case starts from an empty database and writes its rows after V82, so a migration
 * that refused or rewrote a row it found would be green everywhere else. The two columns V82 adds are
 * taken away here, one membership of every shape the server holds is written, and then the file
 * Flyway applied is run over them ({@link DatabaseTest#migrationSql}), the shape of
 * {@link MembershipCarriedOverTest}. Everything is rolled back with the case.
 *
 * <p><b>Every shape, the one with no moment included</b>: the exemption written before V35 gave
 * exemptions their trail, with V35's two checks dropped inside this case, which is the shape that row
 * has on the server and nothing else can write (btl/CLAUDE.md, section 11: one such row, season 2027).
 * Each row must come out carrying nothing, with the evidence its moment is read from untouched, so
 * `WhenASeasonWasActivated` reads every one of them as it did before.
 */
class TheFirstActivationArrivesOverMembershipsAlreadyThereTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private void whatV82Adds() {
		jdbc.execute("alter table membership drop column first_activated_at cascade,"
				+ " drop column first_activation_carried cascade");
		jdbc.execute("alter table membership drop constraint membership_free_of_the_fee_says_who");
		jdbc.execute("alter table membership drop constraint membership_free_of_the_fee_says_when");
	}

	private long competitor(String number, String code) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, city, country_id, first_season,"
						+ " active, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1982-02-02', " + A_TOWN + ", null,"
						+ " null, 2027, true, ?, null, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, code).query(Long.class).single();
	}

	private boolean theColumnsStand() {
		return Boolean.TRUE.equals(db.sql("select count(*) = 2 from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = 'membership'"
						+ " and column_name in ('first_activated_at', 'first_activation_carried')")
				.query(Boolean.class).single());
	}

	/** A moment as text in UTC, whatever zone the session reads in. */
	private static String utc(String column) {
		return "to_char(" + column + " at time zone 'UTC', 'YYYY-MM-DD HH24:MI')";
	}

	/** Each row by its member, its basis, what it carries, and the evidence its moment is read from. */
	private List<String> memberships() {
		return db.sql("select c.member_number || ' ' || m.season || ' ' || m.basis || ' '"
						+ " || m.first_activation_carried || ' ' || coalesce(" + utc("m.first_activated_at") + ", '-')"
						+ " || ' ' || coalesce(" + utc("p.recorded_at") + ", " + utc("be.occurred_at") + ", "
						+ utc("m.decided_at") + ", '-')"
						+ " from membership m join competitor c on c.id = m.competitor_id"
						+ " left join payment p on p.id = m.payment_id"
						+ " left join balance_entry be on be.id = m.balance_entry_id"
						+ " order by c.member_number, m.season")
				.query(String.class).list();
	}

	@Test
	void everyMembershipThereCarriesNothingAndKeepsItsOwnMoment() {
		whatV82Adds();

		long paid = competitor("001200", "00112233445566c0");
		long fromTheBalance = competitor("001201", "00112233445566c1");
		long freed = competitor("001202", "00112233445566c2");
		long freedBeforeTheTrail = competitor("001203", "00112233445566c3");

		long payment = db.sql("insert into payment (competitor_id, season, price_row_id, amount, currency, fee,"
						+ " method, state, recorded_at, recorded_by_name, received) values (?, 2027,"
						+ " (select id from price_row order by sort_order limit 1), 30.00, 'EUR', 3.00, 'ips',"
						+ " 'recorded', timestamptz '2026-11-12 10:00:00+00', 'Blagajnik Probni', 33.00)"
						+ " returning id")
				.param(paid).query(Long.class).single();
		db.sql("insert into membership (competitor_id, season, basis, payment_id) values (?, 2027, 'payment', ?)")
				.params(paid, payment).update();

		long line = db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season,"
						+ " occurred_at, recorded_by_name) values (?, -30.00, 'EUR', 'membership', 2027,"
						+ " timestamptz '2026-11-13 10:00:00+00', 'Blagajnik Probni') returning id")
				.param(fromTheBalance).query(Long.class).single();
		db.sql("insert into membership (competitor_id, season, basis, balance_entry_id)"
						+ " values (?, 2027, 'balance', ?)")
				.params(fromTheBalance, line).update();

		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2027, 'feeExempt', 'Vlasnik Probni', timestamptz '2026-11-14 10:00:00+00')")
				.param(freed).update();

		db.sql("insert into membership (competitor_id, season, basis) values (?, 2027, 'feeExempt')")
				.param(freedBeforeTheTrail).update();

		assertThat(theColumnsStand())
				.as("the columns are there before the migration, so their arriving says nothing")
				.isFalse();

		jdbc.execute(migrationSql("82"));

		assertThat(theColumnsStand()).isTrue();
		assertThat(memberships())
				.as("every row is still there, carries nothing, and keeps the evidence of its own moment")
				.containsExactly(
						"001200 2027 payment false - 2026-11-12 10:00",
						"001201 2027 balance false - 2026-11-13 10:00",
						"001202 2027 feeExempt false - 2026-11-14 10:00",
						"001203 2027 feeExempt false - -");
		assertThat(db.sql("select convalidated from pg_constraint where conname = 'membership_a_first_day_is_carried'")
				.query(Boolean.class).single())
				.as("the rule over the two columns holds of every row there, so it is added valid")
				.isTrue();
	}
}

package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V63 OVER A BOOK THAT ALREADY HOLDS LINES IT DID NOT WRITE.
 *
 * <p>Every test begins at an empty database, so a migration that rewrote, refused or dropped a line
 * that stood before it and one that did not leave the same nothing behind. The rule of 27.09.2026
 * (the root {@code CLAUDE.md}, section 11) asks that every migration adding a {@code check} be
 * measured over rows its own tests did not make, and the shape is {@link TheBasisHasOneHomeTest}'s:
 * what V63 did is undone, the lines a real book holds are written, and V63 ITSELF is executed through
 * {@link DatabaseTest#migrationSql}, inside the test's transaction.
 *
 * <p><b>The lines are one of every reason that exists before V63</b>: a reward whose newcomer has since
 * been deleted (its key forgotten, the shape V38 says survives), a spend with the membership on the
 * balance that names it, a credit of another season, and the two lines of a change of country, one each
 * way. The member who owns the most lines is written last, so he is not the first row of anything.
 */
class ReversalArrivesOverTheBookAlreadyThereTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	/** Everything V63 did, taken back to the rules V42 wrote. */
	private void whatV63Did() {
		jdbc.execute("drop table membership_change");
		jdbc.execute("drop function a_membership_change_is_written_once()");

		/* AND WHAT V79 WROTE OVER THE TABLE THIS TAKES AWAY: the trigger that forgets a deleted member
		   names `membership_change` since V79, so it goes back to the form V33 gave it, which is the
		   form that stood when V63 ran. V33's own file is what restores it, not a copy of its body. */
		jdbc.execute(migrationSql("33"));
		jdbc.execute("alter table balance_entry"
				+ " drop constraint balance_entry_a_reversal_moves_something,"
				+ " drop constraint balance_entry_reason_known,"
				+ " drop constraint balance_entry_what_names_the_season");
		jdbc.execute("alter table balance_entry"
				+ " add constraint balance_entry_reason_known"
				+ " check (reason in ('referral', 'membership', 'overpayment', 'conversion')),"
				+ " add constraint balance_entry_what_names_the_season"
				+ " check ((reason in ('membership', 'overpayment')) = (season is not null))");
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

	private long line(long competitor, String amount, String currency, String reason, Long referred,
			Integer season) {
		return db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
						+ " referred_competitor_id, season, occurred_at, recorded_by_name)"
						+ " values (?, cast(? as numeric), ?, ?, ?, ?, " + AN_INSTANT + ", 'Blagajnik Probni')"
						+ " returning id")
				.params(competitor, amount, currency, reason, referred, season)
				.query(Long.class).single();
	}

	private List<String> theBook() {
		return db.sql("select to_jsonb(e)::text from balance_entry e order by e.id").query(String.class).list();
	}

	private List<String> theSeasons() {
		return db.sql("select to_jsonb(m)::text from membership m order by m.competitor_id, m.season")
				.query(String.class).list();
	}

	private boolean theTrailStands() {
		return Boolean.TRUE.equals(db.sql("select to_regclass('membership_change') is not null")
				.query(Boolean.class).single());
	}

	@Test
	void everyLineComesOutAsItWentInAndEveryRuleIsValidated() {
		whatV63Did();

		long somebodyElse = competitor("007000", "00112233445566e1");
		long newcomer = competitor("007001", "00112233445566e2");
		long member = competitor("007002", "00112233445566e3");

		line(somebodyElse, "-20.00", "EUR", "membership", null, 2027);
		line(member, "5.00", "EUR", "referral", newcomer, null);
		long spend = line(member, "-35.00", "EUR", "membership", null, 2027);
		db.sql("insert into membership (competitor_id, season, basis, balance_entry_id) values (?, 2027, 'balance', ?)")
				.params(member, spend).update();
		line(member, "5.00", "EUR", "overpayment", null, 2028);
		line(member, "-5.00", "EUR", "conversion", null, null);
		line(member, "600.00", "RSD", "conversion", null, null);

		/* The newcomer goes, and the reward keeps standing with its key forgotten. */
		db.sql("delete from competitor where id = ?").param(newcomer).update();

		List<String> book = theBook();
		List<String> seasons = theSeasons();

		assertThat(book).as("the fixture holds fewer lines than it writes").hasSize(6);
		assertThat(seasons).hasSize(1);
		assertThat(theTrailStands()).as("the trail is still there, so the undo above undid nothing").isFalse();

		jdbc.execute(migrationSql("63"));

		assertThat(theTrailStands()).as("V63 did not create the trail").isTrue();
		assertThat(theBook()).as("V63 rewrote, added or took a line of a book it does not own")
				.containsExactlyElementsOf(book);
		assertThat(theSeasons()).as("V63 touched a season").containsExactlyElementsOf(seasons);
		assertThat(db.sql("select conname from pg_constraint where conrelid = 'balance_entry'::regclass"
						+ " and not convalidated").query(String.class).list())
				.as("a rule of the book came out not valid, which no row here should need")
				.isEmpty();
		assertThat(db.sql("select count(*) from pg_constraint where conrelid = 'balance_entry'::regclass"
						+ " and conname in ('balance_entry_reason_known', 'balance_entry_what_names_the_season',"
						+ " 'balance_entry_a_reversal_moves_something')").query(Integer.class).single())
				.as("V63 did not put back the three rules it writes")
				.isEqualTo(3);
	}
}

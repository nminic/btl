package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * V64 OVER PAYMENTS IT DID NOT WRITE.
 *
 * <p>V64 narrows {@code payment_state_known} to {@code awaited} and {@code recorded}, because the
 * owner decided on 18.10.2026 that a cancelled payment is deleted rather than marked (PDL P8, „Kad se
 * osnov promeni iz „uplata” ili se uplata stornira, zapis o uplati se BRIŠE.”). Every test begins at
 * an empty database, so a migration that deleted or rewrote the payments standing before it and one
 * that did not leave the same nothing behind. The rule of 27.09.2026 (the root {@code CLAUDE.md},
 * section 11) asks that a migration adding a {@code check} be measured over rows its own tests did
 * not make, and the shape is {@link ReversalArrivesOverTheBookAlreadyThereTest}'s: what V64 did is
 * undone, the rows are written, and V64 ITSELF is executed through {@link DatabaseTest#migrationSql},
 * inside the test's transaction.
 *
 * <p><b>Two questions, one case each.</b> The payments of the two states that remain come out as they
 * went in, with the rule validated. And a payment reading {@code reversed} STOPS the migration with
 * the rule's own name, rather than being deleted or rewritten to let it pass: QA held no payment at
 * all on 18.10.2026 (measured with the owner's permission), and removing a record of money is the
 * owner's to decide, not a migration's. A V64 that cleared such rows first, or added the rule
 * {@code not valid}, would pass the first case and fail this one.
 */
class TheReversedStateGoesOverThePaymentsAlreadyThereTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String A_PRICE_ROW = "(select id from price_row order by sort_order limit 1)";

	/** The rule as V16 wrote it, which is everything V64 takes away. */
	private void whatV64Did() {
		jdbc.execute("alter table payment drop constraint payment_state_known");
		jdbc.execute("alter table payment add constraint payment_state_known"
				+ " check (state in ('awaited', 'recorded', 'reversed'))");
	}

	private long competitor(String number, String code) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, city, country_id, first_season, first_season_2027,"
						+ " active, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1982-02-02', " + A_TOWN + ", null,"
						+ " null, 2027, false, ?, ?, null, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, number != null, code).query(Long.class).single();
	}

	/** A payment in the given state; the three columns of recognition are present exactly when it is recognised. */
	private long payment(long competitor, int season, String reference, String state) {
		boolean recognised = !"awaited".equals(state);

		return db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount,"
						+ " currency, fee, method, state, recorded_at, recorded_by, recorded_by_name,"
						+ " received) values (?, ?, ?, " + A_PRICE_ROW + ", 4200.00, 'RSD', 0, 'ips', ?, "
						+ (recognised ? "timestamptz '2026-10-02 09:00:00+00', null, 'Blagajnik Probni', 4200.00"
								: "null, null, null, null")
						+ ") returning id")
				.params(competitor, season, reference, state).query(Long.class).single();
	}

	private List<String> thePayments() {
		return db.sql("select to_jsonb(p)::text from payment p order by p.id").query(String.class).list();
	}

	private List<String> theSeasons() {
		return db.sql("select to_jsonb(m)::text from membership m order by m.competitor_id, m.season")
				.query(String.class).list();
	}

	private boolean theRuleTakesReversed() {
		return db.sql("select pg_get_constraintdef(oid) from pg_constraint"
						+ " where conrelid = 'payment'::regclass and conname = 'payment_state_known'")
				.query(String.class).single().contains("'reversed'");
	}

	@Test
	void everyPaymentThatRemainsComesOutAsItWentInAndTheRuleIsValidated() {
		whatV64Did();

		long waiting = competitor(null, "00112233445566f1");
		long member = competitor("008001", "00112233445566f2");

		payment(waiting, 2027, null, "awaited");
		long recorded = payment(member, 2027, "2027008001", "recorded");
		db.sql("insert into membership (competitor_id, season, basis, payment_id) values (?, 2027, 'payment', ?)")
				.params(member, recorded).update();

		List<String> payments = thePayments();
		List<String> seasons = theSeasons();

		assertThat(payments).as("the fixture holds fewer payments than it writes").hasSize(2);
		assertThat(seasons).hasSize(1);
		assertThat(theRuleTakesReversed()).as("the undo above undid nothing").isTrue();

		jdbc.execute(migrationSql("64"));

		assertThat(theRuleTakesReversed()).as("V64 left the word in the rule").isFalse();
		assertThat(thePayments()).as("V64 rewrote, added or took a payment").containsExactlyElementsOf(payments);
		assertThat(theSeasons()).as("V64 touched a season").containsExactlyElementsOf(seasons);
		assertThat(db.sql("select convalidated from pg_constraint"
						+ " where conrelid = 'payment'::regclass and conname = 'payment_state_known'")
				.query(Boolean.class).single())
				.as("the rule came out not valid, which no remaining row needs")
				.isTrue();
	}

	@Test
	void aPaymentReadingReversedStopsTheMigrationAndIsNotClearedAway() {
		whatV64Did();

		long somebody = competitor("008002", "00112233445566f3");
		long member = competitor("008003", "00112233445566f4");

		payment(somebody, 2027, "2027008002", "recorded");
		payment(member, 2027, "2027008003", "reversed");

		/* THE ROOT CAUSE AND NOT THE MESSAGE, because the message Spring builds quotes the whole script,
		   and the script names the rule: a message test would pass over a migration that never ran into
		   it. PostgreSQL's own sentence is the one only a refused row produces. */
		assertThatThrownBy(() -> jdbc.execute(migrationSql("64")))
				.rootCause()
				.hasMessageContaining("\"payment_state_known\"")
				.hasMessageContaining("is violated by some row");
	}
}

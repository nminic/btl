package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Timestamp;
import java.time.Instant;

/**
 * A MEMBERSHIP OF ONE SEASON ON ONE OF THE THREE BASES, written the way the schema takes each.
 *
 * <p>Since V62 the basis of a membership has one home, the {@code membership} row of a season
 * (PDL P8, 18.10.2026, „Osnov clanstva ima jedan dom"). A case that used to give a member a basis
 * by writing the per-person column now gives him a ROW, and a row on each basis carries the
 * evidence the schema asks of it: a recognised payment of his for that season
 * ({@code membership_basis_says_whether_a_payment_is_named}, V22), a line in his book
 * ({@code membership_basis_says_whether_a_book_entry_is_named}, V38), or who freed him and when
 * ({@code membership_free_of_the_fee_says_who} and {@code ..._says_when}, V35). Written once here so
 * that every case asks for a basis in one call and none of them writes a row the schema would refuse
 * for a reason that is not the case's own.
 */
final class HeldOn {

	private HeldOn() {
	}

	/**
	 * @param basis one of the three words of {@code membership_basis_known}; anything else is refused
	 *              here rather than by the database, so a misspelt fixture says so in its own words
	 */
	static void season(JdbcClient db, long competitor, int season, String basis) {
		season(db, competitor, season, basis, AUTUMN_OF_THE_FIRST_SALE);
	}

	/** The moment every membership written without one was activated: before any 31 March. */
	static final Instant AUTUMN_OF_THE_FIRST_SALE = Instant.parse("2026-10-20T10:00:00Z");

	/**
	 * The same row, activated at a moment the case names: the payment booked, the balance spent or
	 * the exemption decided then, which is what the right to rank is read off
	 * ({@code WhenASeasonWasActivated}).
	 *
	 * @return the payment or the line of the book the row names, or nothing for an exemption
	 */
	static Long season(JdbcClient db, long competitor, int season, String basis, Instant activated) {
		Timestamp at = Timestamp.from(activated);

		switch (basis) {
			case "payment" -> {
				long payment = db.sql("insert into payment (competitor_id, season, price_row_id, amount,"
								+ " currency, fee, method, state, recorded_at, recorded_by_name, received)"
								+ " values (?, ?, (select id from price_row order by sort_order limit 1),"
								+ " 30.00, 'EUR', 3.00, 'ips', 'recorded', ?,"
								+ " 'Blagajnik Probni', 33.00) returning id")
						.params(competitor, season, at).query(Long.class).single();
				db.sql("insert into membership (competitor_id, season, basis, payment_id)"
								+ " values (?, ?, 'payment', ?)")
						.params(competitor, season, payment).update();

				return payment;
			}
			case "feeExempt" -> {
				db.sql("insert into membership (competitor_id, season, basis,"
								+ " decided_by_name, decided_at) values (?, ?, 'feeExempt', 'Moderator Probni', ?)")
						.params(competitor, season, at).update();

				return null;
			}
			case "balance" -> {
				long entry = db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
								+ " season, occurred_at, recorded_by_name) values (?, -30.00, 'EUR',"
								+ " 'membership', ?, ?, 'Blagajnik Probni')"
								+ " returning id")
						.params(competitor, season, at).query(Long.class).single();
				db.sql("insert into membership (competitor_id, season, basis, balance_entry_id)"
								+ " values (?, ?, 'balance', ?)")
						.params(competitor, season, entry).update();

				return entry;
			}
			default -> throw new IllegalArgumentException("no basis is called " + basis);
		}
	}
}

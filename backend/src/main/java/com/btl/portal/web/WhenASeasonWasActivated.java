package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;

import java.sql.Timestamp;

/**
 * THE MOMENT THE LEAGUE ACTIVATED A MEMBERSHIP, AND WHETHER THAT MOMENT GIVES THE RIGHT TO RANK.
 *
 * <p><b>The owner, 28.10.2026</b> (PDL, „Sprovođenje „bez prava rangiranja": odgovori od 28.10.2026",
 * chosen with the recommendation): „Odlučuje dan aktivacije, za svaki osnov isto: uplata proknjižena
 * posle 31.3., aktivacija iz balansa preporuke posle 31.3. i oslobođenje Upravnog odbora doneto posle
 * 31.3. ne daju pravo rangiranja za tu sezonu." And, 30.10.2026: „Storno pa ponovna aktivacija:
 * odlučuje dan aktivacije članstva koje sada stoji".
 *
 * <p><b>ONE HOME FOR THE RIGHT, AND IT IS NOT A COLUMN.</b> The moment each basis is activated is
 * already written, once, by the statement that activates it, and this reads it there rather than
 * copying it onto {@code membership}:
 *
 * <ul>
 * <li>a payment: {@code payment.recorded_at}, the moment the league BOOKED it
 * ({@link BookingAPayment}), which is the rulebook's „dan kada je liga uplatu proknjižila" and never
 * the day the money was sent (a statement's {@code bank_statement.dated});</li>
 * <li>a balance: {@code balance_entry.occurred_at} of the line THIS membership names
 * ({@code membership.balance_entry_id}), never a line found by the member and the season: a
 * cancelled activation leaves its line standing in the book beside the reversal, so a line looked
 * up by season would be the FIRST activation and not the one that stands;</li>
 * <li>an exemption: {@code membership.decided_at} (V35).</li>
 * </ul>
 *
 * Nothing is stored, so nothing can disagree with these three, and a membership cancelled and
 * written again is a new row whose activation is its own: the cancellation deletes the payment or
 * the row ({@link MemberMembershipApi}), so the row that stands is the only one there is to read.
 *
 * <p><b>THE RULE ITSELF IS NOT HERE</b>: which day ranks is {@link SeasonClock#anActivationRanks},
 * in the league's zone. This class only finds the moment and hands it over.
 *
 * <p><b>A MEMBERSHIP WITH NO MOMENT RANKS, and that is a derivation written down rather than left to
 * be found.</b> Exactly one shape has none: an exemption written before V35 gave exemptions their
 * trail (V35 adds its check {@code not valid} for that one row). It was written in the autumn of
 * 2026, before the first 31 March there is, so whatever its real day was, it ranks; answering „no
 * right" for it would take the owner's own membership of 2027 off every table.
 */
final class WhenASeasonWasActivated {

	private WhenASeasonWasActivated() {
	}

	/**
	 * The moment, as an SQL expression over a row of {@code membership} under the given alias. Each
	 * of the three is a probe of a primary key, and at most one of them is there for any row (V22,
	 * V35, V38: the basis names exactly one kind of evidence).
	 */
	static String of(String membership) {
		return "coalesce((select p.recorded_at from payment p where p.id = " + membership + ".payment_id),"
				+ " (select be.occurred_at from balance_entry be where be.id = " + membership
				+ ".balance_entry_id),"
				+ " " + membership + ".decided_at)";
	}

	/**
	 * Whether a membership of that season, activated at that moment, ranks.
	 *
	 * @param activated what {@link #of} read, or NULL for the one row the note on this class names
	 */
	static boolean ranks(int season, Timestamp activated) {
		return activated == null || SeasonClock.anActivationRanks(season, activated.toInstant());
	}
}

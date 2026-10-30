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
 * A membership cancelled and written again is a new row whose activation is its own: the cancellation
 * deletes the payment or the row ({@link MemberMembershipApi}), so the row that stands is the only one
 * there is to read.
 *
 * <p><b>EXCEPT A ROW A CHANGE OF BASIS WROTE, WHICH CARRIES THE FIRST DAY (V82).</b> The owner,
 * 30.10.2026, chosen with the recommendation: „Promena osnova članstva (uplata u oslobođenje i obrnuto)
 * zadržava dan prve aktivacije te sezone, pa sezona ne gubi pravo rangiranja samo zato što je članstvo
 * ponovo upisano. Promena osnova nije storno". A change deletes the evidence above and writes a row
 * whose own evidence is the day of the change, so the change route reads {@link #of} on the row it
 * deletes and writes it onto the new one ({@code membership.first_activated_at}, with
 * {@code first_activation_carried} saying that it did). A carried row answers that, and only that: its
 * own payment or decision is the day of the change, never of the activation. Read through {@link #of},
 * a second change carries the first day again, and a cancellation, which deletes the row, carries
 * nothing.
 *
 * <p><b>THE RULE ITSELF IS NOT HERE</b>: which day ranks is {@link SeasonClock#anActivationRanks},
 * in the league's zone. This class only finds the moment and hands it over.
 *
 * <p><b>A MEMBERSHIP WITH NO MOMENT RANKS, and that is a derivation written down rather than left to
 * be found.</b> Exactly one shape has none: an exemption written before V35 gave exemptions their
 * trail (V35 adds its check {@code not valid} for that one row). It was written in the autumn of
 * 2026, before the first 31 March there is, so whatever its real day was, it ranks; answering „no
 * right" for it would take the owner's own membership of 2027 off every table. A change of basis
 * over that row carries its missing moment as it carries any other (V82, the flag with no day), so
 * the row that replaces it ranks as well, rather than answering the day of the change.
 */
final class WhenASeasonWasActivated {

	private WhenASeasonWasActivated() {
	}

	/**
	 * The moment, as an SQL expression over a row of {@code membership} under the given alias: the
	 * carried first day of a row a change of basis wrote, which may be NULL (V82: the change carried a
	 * row that had no moment), or else the row's own evidence. Each of the three is a probe of a
	 * primary key, and at most one of them is there for any row (V22, V35, V38: the basis names exactly
	 * one kind of evidence).
	 */
	static String of(String membership) {
		return "(case when " + membership + ".first_activation_carried then " + membership
				+ ".first_activated_at else"
				+ " coalesce((select p.recorded_at from payment p where p.id = " + membership + ".payment_id),"
				+ " (select be.occurred_at from balance_entry be where be.id = " + membership
				+ ".balance_entry_id),"
				+ " " + membership + ".decided_at) end)";
	}

	/**
	 * Whether a membership of that season, activated at that moment, ranks.
	 *
	 * @param activated what {@link #of} read, or NULL for the one row the note on this class names
	 *                  and for a row a change of basis carried it onto
	 */
	static boolean ranks(int season, Timestamp activated) {
		return activated == null || SeasonClock.anActivationRanks(season, activated.toInstant());
	}
}

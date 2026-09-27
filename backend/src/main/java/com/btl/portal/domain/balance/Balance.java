package com.btl.portal.domain.balance;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * WHAT A MEMBER'S BALANCE DOES TO WHAT HE OWES, and the one boundary the owner drew through it.
 *
 * <p><b>Owner, 26.09.2026, the two decisions this class holds:</b> „QR se kuje na iznos minus
 * balans, ali se balans skida tek kad uplata bude proknjizena", and „Balans veci ili jednak
 * clanarini: QR koda nema, clanstvo se aktivira iz balansa, a visak ostaje za sledecu godinu."
 * Two sentences, one arithmetic: what he transfers is the fee less his balance, and when that
 * comes out at nothing there is nothing to transfer at all.
 *
 * <p><b>THE BOUNDARY IS „GREATER OR EQUAL" AND EQUAL IS THE SIDE THAT ACTIVATES.</b> A member
 * whose balance is exactly the fee owes exactly nothing, and asking him to transfer nothing is
 * the shape the owner refused when he refused the symbolic QR („clan placa ono sto ne duguje, a
 * banci trosak premasuje iznos"). So {@link Settlement#coveredByTheBalance()} is true at
 * equality, and equality is a case of its own in the tests rather than a point nobody stands on.
 *
 * <p><b>NOTHING HERE CONVERTS BETWEEN THE TWO CURRENCIES, and that is ADL's rule rather than a
 * simplification:</b> „Dve valute su dva zasebna cenovnika, ne jedan sa konverzijom." Both
 * numbers always arrive as a pair off one row of the price list (V4 publishes the referral as 5
 * and 600, the early period as 35 and 4200), so every answer below is two independent sums and
 * no rate is applied anywhere. That the seeded list satisfies 120 to the euro is true today and
 * relied on nowhere: {@code PUT /api/pricing/{key}} can move one column without the other.
 *
 * <p><b>WHICH IS WHY BEING COVERED ASKS BOTH CURRENCIES AND NOT ONE.</b> There is no such thing
 * as this member's currency: {@code MembershipPrice} is asked which one it is by the bank
 * statement a moderator is reading, and a member activating out of his own balance is reading no
 * statement. So the question „is he covered" has no single currency to be asked in, and this
 * class answers it only when the balance covers the fee in BOTH. <b>This is reasoning and not a
 * decision anybody wrote down</b>, so its cost is said out loud: if the price list is ever
 * edited so that one currency of a row no longer matches the other, a member covered in dinars
 * and short in euro is asked to pay rather than activated. That direction is deliberate - the
 * portal declines to give away a membership it is not certain is paid for - and it is the
 * direction that is cheap to reverse if the owner wants the other one.
 *
 * <p><b>THE PROCESSING FEE IS NOT HERE, AND THAT IS ALSO REASONING RATHER THAN A DECISION.</b>
 * V16 says of it, in its own words, that it is „the processing fee, which is NOT membership and
 * is shown as its own line", and the balance is a reward for bringing in a MEMBER, so it pays
 * membership. What follows is that the fee never comes off the balance, and that a member whose
 * balance covers his membership pays no fee at all - not because he is forgiven one, but because
 * a fee for processing a transfer has nothing to process. The fee is therefore added by the route
 * that knows whether anything is being transferred, and this class never sees it.
 */
public final class Balance {

	private Balance() {
	}

	/**
	 * An amount as the price list publishes it: the same money said in both currencies, never
	 * one computed from the other.
	 *
	 * @param eur euro, as {@code price_row.eur} gives it
	 * @param rsd dinars, as {@code price_row.rsd} gives it
	 */
	public record Money(BigDecimal eur, BigDecimal rsd) {

		public Money {
			Objects.requireNonNull(eur, "eur");
			Objects.requireNonNull(rsd, "rsd");

			if (eur.signum() < 0 || rsd.signum() < 0) {
				throw new IllegalArgumentException("money here is never negative: " + eur + " / " + rsd);
			}
		}

		/** Nothing, in both currencies. */
		public static final Money NOTHING = new Money(BigDecimal.ZERO, BigDecimal.ZERO);

		/** Whether both halves are nothing, asked by value so that 0 and 0.00 answer alike. */
		public boolean isNothing() {
			return eur.signum() == 0 && rsd.signum() == 0;
		}

		/**
		 * Whether EVERY half is strictly positive: money in both currencies, and not merely
		 * somewhere.
		 *
		 * <p><b>Not the negation of {@link #isNothing()} by accident, but by the constraint this
		 * answers for.</b> {@code balance_entry_a_membership_takes} (V38) reads {@code eur < 0 and
		 * rsd < 0} for a spend - both strictly - so a spend with ONE half at nothing and the other
		 * positive fails it exactly as a spend of nothing at all does. The two questions therefore
		 * differ on exactly that one-sided state: {@code isNothing} is true only when both halves
		 * are nothing, this is true only when both are something, and a pair like 15.00/0.00
		 * answers false to both.
		 *
		 * <p>Found on review ({@code GrantingAMembership.decide}, PR 403): a guard written as
		 * {@code !isNothing()} let such a pair through and the route met the constraint instead of
		 * answering it, in {@code NOTHING_WOULD_COME_OFF_THE_BOOK}'s own words „500". This is the
		 * question that guard needed.
		 */
		public boolean isMoneyInBothCurrencies() {
			return eur.signum() > 0 && rsd.signum() > 0;
		}
	}

	/**
	 * What one member owes for one season once his balance has been counted.
	 *
	 * @param fee                 the membership itself, off the row of the price list that
	 *                            applies to him - never the processing fee, which is not
	 *                            membership
	 * @param balance             what the book says he has, both currencies
	 * @param fromTheBalance      how much of it this membership uses, which is all of it when it
	 *                            is short and exactly the fee when it is not
	 * @param toTransfer          what is left for him to actually send, which is nothing exactly
	 *                            when {@code coveredByTheBalance} is true
	 * @param coveredByTheBalance whether the balance settles the whole membership, in BOTH
	 *                            currencies - the owner's „veci ili jednak"
	 */
	public record Settlement(Money fee, Money balance, Money fromTheBalance, Money toTransfer,
			boolean coveredByTheBalance) {
	}

	/**
	 * THE ONE PLACE THE SUBTRACTION HAPPENS, so that the number on the invoice and the number
	 * taken out of the book cannot be two numbers.
	 *
	 * <p>Each currency is settled on its own, which is what „ne jedan sa konverzijom" leaves as
	 * the only possibility: the euro half of the balance pays the euro fee and the dinar half
	 * pays the dinar fee, and neither knows the other's rate.
	 *
	 * @param fee     the membership fee that applies to him
	 * @param balance what his book adds up to
	 */
	public static Settlement against(Money fee, Money balance) {
		Objects.requireNonNull(fee, "fee");
		Objects.requireNonNull(balance, "balance");

		Money used = new Money(atMost(balance.eur(), fee.eur()), atMost(balance.rsd(), fee.rsd()));

		Money left = new Money(fee.eur().subtract(used.eur()), fee.rsd().subtract(used.rsd()));

		/* BOTH, for the reason the class note gives: there is no currency this member is being
		   charged in, so there is no single one in which to ask. */
		boolean covered = balance.eur().compareTo(fee.eur()) >= 0
				&& balance.rsd().compareTo(fee.rsd()) >= 0;

		return new Settlement(fee, balance, used, left, covered);
	}

	/**
	 * THE SETTLEMENT AS THE CODE HE IS ALREADY HOLDING STATES IT, which is not the settlement
	 * today's book would produce.
	 *
	 * <p><b>Why a second reading of one invoice may not recompute the discount.</b> A code is a slip
	 * of paper with a number on it, and once it leaves the screen the portal cannot take it back.
	 * If a second look recomputed the reduction, a member whose balance moved in between would be
	 * holding TWO slips saying two different numbers while only one promise could be recorded - and
	 * whichever slip he then paid, the amount coming off his book would be the other one's. Measured
	 * on this branch before it was fixed: a code minted on 3.600 against a balance of 600, a seventh
	 * referral landing, a mere refresh of the page, and then 1.200 off the book for a discount of
	 * 600. That is the outcome the owner refused on 27.09.2026 in as many words, with the cost
	 * stated to him: „the association's liability would fall by 1.200 against a discount of 600".
	 *
	 * <p><b>SO THE FIRST LOOK OF A SEASON FIXES WHAT THAT SEASON'S CODE PROMISES, and this is the
	 * method that serves it afterwards.</b> Every slip the member can be holding for that season
	 * then carries the same number, so there is no slip whose payment would take off something he
	 * was not told about.
	 *
	 * <p><b>WHAT IS TAKEN FROM TODAY AND WHAT FROM THE PROMISE, because the two answer different
	 * questions.</b> The reduction and the transfer come from the promise, because they are what the
	 * slip says. The balance and {@link Settlement#coveredByTheBalance()} come from today, because
	 * they are facts about his book right now: the second of them is read by the screen as „{@code
	 * POST /api/me/membership} is the way in", and that route mints no code and therefore consults
	 * no promise - it spends what is in the book at the moment it writes, inside one transaction. A
	 * member whose balance grew past the whole fee after minting can therefore still let himself in,
	 * rather than being held to a slip for the rest of the season.
	 *
	 * <p><b>The promise is settled against the fee exactly as a balance would be</b>, by handing it
	 * to {@link #against}, so a promise larger than the fee cannot drive the transfer below nothing
	 * and {@link Money}'s own refusal of negative amounts is never reached. That is not decoration:
	 * it is the one road by which a promise can exceed the fee, namely the price list being edited
	 * downwards between two looks, and <b>that case is a boundary this branch names rather than
	 * settles.</b> What happens today is that the older slip and the newer one say different
	 * numbers while the promise matches the older, so a member paying the newer one transfers less
	 * than the season now costs. Naming it: the promise is per season and carries no price, so
	 * nothing here can tell which price list a slip was minted from.
	 *
	 * @param today    the settlement his fee and his book would produce right now
	 * @param promised what the code said, from {@code balance_promise}
	 */
	public static Settlement asThePromiseStands(Settlement today, Money promised) {
		Objects.requireNonNull(today, "today");
		Objects.requireNonNull(promised, "promised");

		Settlement onThePromise = against(today.fee(), promised);

		return new Settlement(today.fee(), today.balance(), onThePromise.fromTheBalance(),
				onThePromise.toTransfer(), today.coveredByTheBalance());
	}

	/**
	 * WHAT A BOOKED PAYMENT TAKES OUT OF THE BOOK, which is what the code PROMISED and not what the
	 * balance happens to be on the day the money lands.
	 *
	 * <p><b>Owner, 27.09.2026</b>, on exactly this: „skida se ono sto je kod obecao, ne ono sto
	 * balans stoji na dan knjizenja." The case he was shown: a code minted for 3.600 against a
	 * balance of 600, a seventh referral activated before the money arrives so the balance becomes
	 * 1.200, and then the 3.600 lands. <b>600 comes off and 600 stays.</b> He refused taking
	 * today's 1.200 - the association's liability would fall by twice the discount it actually gave
	 * - and refused rejecting the booking, which would punish a member for what a third person did.
	 *
	 * <p><b>SO WHY IS THERE A CAP AT ALL, when the promise is the answer.</b> Because a balance can
	 * fall between minting and booking, by exactly one route: a payment for a DIFFERENT season
	 * being booked in between. Minting spends nothing, so two seasons' codes can both stand, and
	 * the one booked second can find the money gone. Taking the promise regardless would drive the
	 * book negative, which is to say the association would record having paid out more than it ever
	 * owed. So the promise is honoured up to what is actually there. <b>This is the boundary PDL
	 * leaves open, narrowed to its true shape:</b> it needs two seasons and the 1 October turn, not
	 * two codes on one day - within a season {@code payment_one_a_season} allows one payment at all.
	 *
	 * @param promised what the code said, from {@code balance_promise}
	 * @param balance  what the book adds up to right now
	 */
	public static Money honouring(Money promised, Money balance) {
		Objects.requireNonNull(promised, "promised");
		Objects.requireNonNull(balance, "balance");

		return new Money(atMost(balance.eur(), promised.eur()), atMost(balance.rsd(), promised.rsd()));
	}

	private static BigDecimal atMost(BigDecimal have, BigDecimal owed) {
		return have.compareTo(owed) <= 0 ? have : owed;
	}
}

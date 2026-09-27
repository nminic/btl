package com.btl.portal.domain.balance;

import com.btl.portal.domain.member.MemberNumber;

import java.util.Objects;

/**
 * WHAT HAPPENS WHEN A MEMBER ASKS TO BE LET IN ON HIS OWN BALANCE, which is the third way onto
 * this portal and the first one nobody else has to agree to.
 *
 * <p><b>Owner, 26.09.2026:</b> „Balans veci ili jednak clanarini: QR koda nema, clanstvo se
 * aktivira iz balansa, a visak ostaje za sledecu godinu." And the cost he was shown before
 * choosing it, in the same entry: it „trazi rutu koja aktivira clanstvo bez uplate, dakle nov put
 * do aktivacije, i <b>taj put mora da nosi istu proveru kao i onaj kroz uplatu</b>."
 *
 * <p><b>THE OTHER WAY IN IS A MODERATOR SAYING THE MONEY ARRIVED</b> ({@link
 * com.btl.portal.domain.payment.RecordingAPayment}, behind {@code queue:payments}), and it
 * answers to somebody who is not the person being let in. This one answers to the member himself,
 * so every question that route asks of the world has to be asked here too, of the same world, or
 * the cheaper door becomes the way around the dearer one.
 *
 * <p><b>THE FACTS IT TURNS ON, and it turns on nothing else.</b> Each is a fact about the
 * database at the moment of asking, read by the route and handed in:
 *
 * <ul>
 * <li><b>Is he already a member of this season.</b> Refused, and said out loud rather than left
 * to collide with {@code membership_pk} (V22) and answer 500. This is the exact shape
 * {@code PaymentApi} lists as deliberately unguarded because nothing could reach it - „a
 * competitor already holding a {@code membership} row for this season ... has no code path to
 * reach today" - and this class is the code path, so the guard is owed here.
 * <li><b>Is he exempt from the fee.</b> Refused, and HIS BALANCE IS NOT TOUCHED. He owes nothing,
 * so there is nothing to take it off, and spending it on a season he was going to get free would
 * be the portal charging him for a gift. <b>DERIVED rather than decided</b>, and from PDL
 * 11.08.2026: „Balans ne propada nikad i prenosi se iz sezone u sezonu" - it keeps, so it waits
 * for a season in which he is no longer exempt. Were the balance perishable the derivation would
 * not hold and this would have to be asked instead.
 * <li><b>Does the balance cover the fee.</b> {@link Balance#against} owns that arithmetic and the
 * „greater or equal" boundary in it; this class only reads the answer. Short is refused, because
 * a short balance is what the QR is for: „QR se kuje na iznos minus balans" is the other half of
 * the same day's decision and it goes through the payments route, not this one.
 * <li><b>And whether the fee is money at all</b>, which is the same {@link Balance.Settlement} read for a
 * different thing: a fee of nothing is covered by an empty balance and there is no membership for
 * the book to buy. Refused for the reason a member freed of the fee is refused, and the road to it
 * is an administrator editing the price list rather than anything about the member.
 * <li><b>Does he already carry a member number.</b> Which decides between the two ways of saying
 * yes, and not whether to say it.
 * </ul>
 *
 * <p><b>THE NUMBER RULE IS NOT DECIDED HERE, IT IS THE ONE {@code RecordingAPayment} STATES.</b>
 * „A number is handed out once and then never again to the same person", and PDL P8 says
 * re-activation „vraca isti broj i isti profil, ne pravi nov". Writing it out a second time would
 * give one rule two homes, so what keeps them one is not this paragraph but
 * {@code ActivatingFromBalanceTest.theNumberRuleIsTheSameRuleThePaymentRouteUses}, which asks
 * both classes the same question for both states of „has a number" and fails the day they answer
 * differently.
 */
public final class ActivatingFromBalance {

	private ActivatingFromBalance() {
	}

	/**
	 * The world as the route found it, reduced to the four things this decision turns on.
	 *
	 * @param alreadyAMember     a {@code membership} row already stands for him and this season,
	 *                           on any basis
	 * @param exemptFromTheFee   that row stands on {@code feeExempt}, which is the Managing Board
	 *                           freeing him of THIS season's fee. Never a fact about the person:
	 *                           the owner, 27.09.2026, „BESPLATNI CLANOVI NISU BESPLATNI
	 *                           DOZIVOTNO"
	 * @param balance            what {@link Balance#against} made of his book and his fee
	 * @param numberHeAlreadyHas his member number, or {@code null} if he has never had one
	 */
	public record Asking(boolean alreadyAMember, boolean exemptFromTheFee, Balance.Settlement balance,
			MemberNumber numberHeAlreadyHas) {

		public Asking {
			Objects.requireNonNull(balance, "balance");
		}
	}

	/** What the server does next, and the five are five different things. */
	public enum Outcome {

		/** Let him in, and give him the number he has never had. */
		ACTIVATE_AND_NUMBER_HIM,

		/** Let him in. He has been a member before and keeps the number he has. */
		ACTIVATE,

		/** Nothing. He is already a member of this season. */
		ALREADY_A_MEMBER,

		/**
		 * Nothing, and nothing taken off his balance. He owes no fee to begin with, by either of
		 * two roads: the Managing Board freed him of it, or the price list says this season is
		 * worth nothing.
		 */
		HE_OWES_NOTHING,

		/** Nothing. His balance does not cover the fee, so the invoice is the way in. */
		THE_BALANCE_IS_NOT_ENOUGH
	}

	/**
	 * Judged in this order, and the order is the reason each refusal says what it says.
	 *
	 * <p><b>THE REASON BEFORE THE BARE FACT, then the money.</b> Being freed of the fee and being
	 * a member already are both about THIS SEASON and the first implies the second - an exemption
	 * IS a membership, granted one year at a time (the owner, 27.09.2026: „red u {@code membership}
	 * postoji za svaku sezonu posebno, a {@code feeExempt} je osnov TOG reda, ne svojstvo
	 * coveka"). So the exemption is asked first, because it is the one that names WHY the season is
	 * already settled, and a refusal that names the reason is worth more to the man reading it than
	 * one that names only the fact. Then the money, last, for the reason the clause below gives.
	 *
	 * <p><b>THIS ORDER IS WHAT KEEPS BOTH REFUSALS ALIVE, and that is measured rather than
	 * preferred.</b> The other way round, {@code alreadyAMember} would answer for every exempt
	 * member and {@link Outcome#HE_OWES_NOTHING} would be reachable from this door by one road
	 * only - a fee of nothing - so the branch below would be a branch production cannot enter,
	 * which no test in this portal can see and no mutation can find. <b>And nothing any member is
	 * told changes:</b> until the season's own row became the source, an exempt member was already
	 * answered {@code HE_OWES_NOTHING} here, off {@code competitor.membership_basis}. This order is
	 * what preserves his answer while the fact underneath it is corrected.
	 */
	public static Outcome decide(Asking asking) {
		Objects.requireNonNull(asking, "asking");

		if (asking.exemptFromTheFee()) {
			return Outcome.HE_OWES_NOTHING;
		}

		if (asking.alreadyAMember()) {
			return Outcome.ALREADY_A_MEMBER;
		}

		/* A MEMBERSHIP THE PRICE LIST SAYS IS WORTH NOTHING IS THE SAME REFUSAL, and it is a second
		   road to one state rather than a second state. `price_row_eur_not_negative` (V4) lets a row
		   be nought and `PUT /api/pricing/{key}` has no lower bound - it refuses a negative price and
		   a price above what a row may cost, and nothing below - so an administrator editing the
		   period to nought through his own screen is the road. Without this the balance covers the
		   fee by `0 >= 0`, the route reaches the book, and
		   `balance_entry_a_membership_takes` (V38) refuses an entry that moves nothing: every member
		   on the portal would be answered 500.

		   LAST OF THE THREE, and the order is measured rather than tidy: a member whose season is
		   already settled - freed of the fee or in on a payment - must be refused for THAT reason and
		   not told the price list happens to be free today, because a price list is edited and a
		   settled season is not. Both roads end in this outcome, so the two are told apart only by a
		   case that puts a NON-exempt member in front of a fee of nothing and an exempt one in front
		   of a fee that is money. */
		if (asking.balance().fee().isNothing()) {
			return Outcome.HE_OWES_NOTHING;
		}

		if (!asking.balance().coveredByTheBalance()) {
			return Outcome.THE_BALANCE_IS_NOT_ENOUGH;
		}

		return asking.numberHeAlreadyHas() == null
				? Outcome.ACTIVATE_AND_NUMBER_HIM
				: Outcome.ACTIVATE;
	}
}

package com.btl.portal.domain.membership;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.member.MemberNumber;

import java.util.Objects;

/**
 * THE ADMINISTRATION ACTIVATING SOMEBODY ELSE'S MEMBERSHIP WITHOUT A FEE ARRIVING, which is
 * the moderator's half of the screen the owner specified on 27.09.2026 and is NOT the member's
 * own door.
 *
 * <p><b>Owner, 27.09.2026 (PDL, section 19), the three cases this class is the decision
 * behind.</b> With no amount typed into the row, the moderator is offered a prompt and what he
 * chooses is a GROUND:
 *
 * <ul>
 * <li>Case 4, the balance covers the fee: „Odobri oslobodjenje od clanarine" / „Odobri iz
 * balansa".
 * <li>Case 5, the balance does not cover it: „Odobri oslobodjenje od clanarine" / „Odobri
 * <b>umanjen iznos</b> iz balansa".
 * <li>Case 6, the balance is switched off: „Odobri oslobodjenje od clanarine? Da / Ne".
 * </ul>
 *
 * <p><b>WHY THIS IS NOT {@link com.btl.portal.domain.balance.ActivatingFromBalance}, and the
 * reason is measured rather than a preference.</b> That class exists to REFUSE a balance that
 * is short of the fee ({@code THE_BALANCE_IS_NOT_ENOUGH}), because it answers to the member
 * himself and a member may not hand himself a discount - „QR se kuje na iznos minus balans" is
 * the road a short balance takes, through the paying door. Case 5 is the exact opposite: a
 * moderator MAY approve a reduced amount, because he is the person the owner's own sentence
 * puts in charge of saying what arrived. One class cannot both refuse and allow the same state,
 * so there are two, and each says whose door it is.
 *
 * <p><b>THE GROUND IS ASKED FOR AND NEVER GUESSED, which is a refusal rather than a
 * validation.</b> A prompt with two buttons on it means the caller has to say which one was
 * pressed; a route defaulting to one of them would hand out a season free of the fee because a
 * field was misspelled, and the owner's rule over the whole of section 19 is that an exemption
 * is a deliberate act - „BESPLATNI CLANOVI NISU BESPLATNI DOZIVOTNO. Admin moze da odobri
 * (jednu po jednu) godinu clanarine". <b>This is my reasoning and not his sentence</b>, and its
 * cost is one refusal a caller can meet.
 *
 * <p><b>AND „NO" IS NOT A GROUND, WHICH IS WHY IT HAS NO OUTCOME HERE.</b> The owner, over all
 * seven cases: „Odluka NE ni ovde niti u ostatku opisa funkcionalnosti ne brise red iz tabele
 * za aktivaciju, samo odlaze odluku dok se stvari ne rese van portala." A refusal of the prompt
 * is therefore not a request at all - nothing is written, no balance is touched, and the row
 * stays where it was because the row is DERIVED from the absence of a membership
 * ({@code PaymentsDueApi}) rather than from anybody recording a decision. So the shape that
 * holds his sentence is that there is no call to make, and the cases that hold it assert three
 * tables are untouched.
 */
public final class GrantingAMembership {

	private GrantingAMembership() {
	}

	/**
	 * Which of the two prompts was pressed.
	 *
	 * <p><b>An enum here and the schema's own words in the route, deliberately.</b> The words
	 * {@code membership_basis_known} knows are literals of the database (V22, widened by V38)
	 * and {@code MembershipConstraintsTest} reads them out of {@code pg_constraint} rather
	 * than believing a copy of them. Carrying those strings into the domain would give one
	 * word a second home for no gain: this class decides between two BUTTONS, and which word
	 * each button writes is the schema's business.
	 */
	public enum Ground {

		/** The Managing Board freeing him of this season's fee, and nothing comes off his book. */
		FREE_OF_THE_FEE,

		/** His own balance paying for the season, whether or not it covers the whole fee. */
		THE_BALANCE
	}

	/**
	 * The world as the route found it, reduced to the five things this decision turns on.
	 *
	 * @param ground             which prompt was pressed
	 * @param heldOn             the basis of the {@code membership} row already standing for
	 *                           this person and this season, or {@code null} when none does.
	 *                           The schema's own word, because the question „is it the ground
	 *                           that was asked for" is asked of the column itself
	 * @param aPaymentWasReversed a payment for this season went back, which is its own refusal
	 * @param offTheBook         what this activation would take out of his book, which is
	 *                           {@link Balance.Money#NOTHING} for {@link Ground#FREE_OF_THE_FEE}
	 *                           because a man who owes nothing has nothing for a balance to pay.
	 *                           See {@link #whatComesOffTheBook} for how it is worked out and
	 *                           why it is not the obvious subtraction
	 * @param numberHeAlreadyHas his member number, or {@code null} if he has never had one
	 */
	public record Asking(Ground ground, String heldOn, boolean aPaymentWasReversed,
			Balance.Money offTheBook, MemberNumber numberHeAlreadyHas) {

		public Asking {
			Objects.requireNonNull(ground, "ground");
			Objects.requireNonNull(offTheBook, "offTheBook");
		}
	}

	/** What the server does next, and the six are six different things. */
	public enum Outcome {

		/** Write it, and give him the number he has never had. */
		GRANT_AND_NUMBER_HIM,

		/** Write it. He has been a member before and keeps the number he has. */
		GRANT,

		/**
		 * Nothing, and 200: the season is already held on the very ground that was asked for.
		 *
		 * <p>The reason {@code RecordingAPayment} gives about its own repeat - „Recording the
		 * same payment twice must be harmless" - and here it is load-bearing rather than
		 * polite: a moderator working a list somebody is reading to him clicks the same row
		 * twice, and a second write would draw a second member number. The sequence only
		 * counts up, so the first would be gone for good.
		 */
		ALREADY_GRANTED_ON_THIS_GROUND,

		/**
		 * Nothing. A fee for this season is recorded, and forgiving money that has arrived is
		 * not something this route does quietly.
		 *
		 * <p><b>This one names the ground and is allowed to, which the next one is not.</b>
		 * The tick that opens this route is {@code queue:payments}, and through the sister
		 * route ({@code PaymentApi}) its holder is already handed the whole payment row on a
		 * repeat - so „money arrived for this season" is a fact he can read anyway, and he
		 * needs it, because his job is not to book it twice.
		 */
		THE_FEE_IS_ALREADY_RECORDED,

		/**
		 * Nothing. The season is held on some other ground, and the refusal says NO MORE THAN
		 * THAT.
		 *
		 * <p><b>It is silent about which ground, and that is a privacy rule rather than
		 * brevity.</b> PDL, 28.07.2026: „Osnov clanstva se nikad ne prikazuje javno... Vide ga
		 * samo Superadmin i moderatori sa pravom nad clanovima", widened on 20.09.2026 to the
		 * member's own. That right is {@code entity:members} and it is NOT the one that opens
		 * this route, so telling this caller apart „free of the fee" from „in on his own
		 * balance" would be handing over a fact he may not read. Neither of those two is
		 * visible to him anywhere else, which is exactly the difference from
		 * {@link #THE_FEE_IS_ALREADY_RECORDED}.
		 *
		 * <p>The same word {@code PaymentApi.THE_MEMBERSHIP_IS_ALREADY_HELD} uses, because it
		 * is the same fact being reported from the other door.
		 */
		THE_SEASON_IS_ALREADY_HELD,

		/**
		 * Nothing. A payment for this season was reversed.
		 *
		 * <p>PDL 11.08.2026: „Stornirana uplata: clanski broj propada, clan postaje neaktivan
		 * za tu sezonu." Activating over that on any ground would make the reversal stop
		 * having happened, in one click and with nothing left saying so.
		 */
		THE_PAYMENT_WAS_REVERSED,

		/**
		 * Nothing. What would come off the book is nothing at all, so there is no line to
		 * write.
		 *
		 * <p><b>Reachable only for {@link Ground#THE_BALANCE}, by two roads that end in one
		 * state, and it is guarded here rather than met in the database.</b>
		 * {@code balance_entry_a_membership_takes} (V38) refuses an entry that moves nothing,
		 * in either currency - „an entry that moves nothing is not a fact about money" - so
		 * without this the route answers 500. The two roads: a member whose book is EMPTY,
		 * which is most members, and a price list edited so that the row that applies to him
		 * is worth nothing, which {@code price_row_eur_not_negative} (V4) allows and
		 * {@code PUT /api/pricing/{key}} has no lower bound against.
		 *
		 * <p>One outcome and not two, because the question the schema asks is one question:
		 * would this entry move money. Two outcomes would be two names for one refusal and
		 * would invite a caller to tell the member which of the two it was, when the second
		 * road is about the price list and not about him.
		 */
		NOTHING_WOULD_COME_OFF_THE_BOOK
	}

	/**
	 * WHAT AN ACTIVATION ON A BALANCE TAKES OUT OF THE BOOK, and it is NOT
	 * {@link Balance.Settlement#fromTheBalance()}.
	 *
	 * <p><b>The difference shows up in exactly one state and is invisible in every other, which
	 * is why it is a method with a reason on it rather than a line at the call site.</b>
	 * {@code fromTheBalance} is {@code min(balance, fee)} taken in each currency on its own. That
	 * is the right answer for the member's own door, where a short balance is refused outright, so
	 * the only case it ever runs in is one where the balance covers the fee in BOTH currencies.
	 * The moderator's door is the opposite: case 5 exists precisely to let a SHORT balance through.
	 *
	 * <p><b>So take a balance of 50 EUR / 600 RSD against a fee of 40 / 4.800.</b> It covers in
	 * euro and is short in dinars, which {@link Balance.Settlement#coveredByTheBalance()} calls
	 * not covered - it asks both currencies, for the reason {@link Balance} gives at length: there
	 * is no such thing as this member's currency when nobody is reading a bank statement. Case 5
	 * therefore applies and „umanjen iznos iz balansa" means his balance is spent. But
	 * {@code min} per currency answers <b>40 EUR and 600 RSD</b>, which leaves 10 EUR of his book
	 * standing while taking every dinar of it - and 40 against 600 is a rate of fifteen to one,
	 * a conversion the portal is forbidden to perform („Dve valute su dva zasebna cenovnika, ne
	 * jedan sa konverzijom").
	 *
	 * <p><b>The rule that has no such state is binary and it is what this returns:</b> covered in
	 * both, take exactly the fee; otherwise take the WHOLE balance. Both answers are pairs that
	 * already stood together - one is a row of the price list, the other is the sum of a book
	 * whose every entry copied a pair off such a row - so no rate is applied in either.
	 *
	 * <p><b>How that state is reached, because a rule guarding an unreachable state is
	 * decoration.</b> Every entry in the book copies both numbers off one row of the price list
	 * (V38, {@code balance_entry_a_referral_adds} demanding both are money), so a book built out of
	 * referrals alone keeps whatever ratio the referral row had. {@code PUT /api/pricing/{key}}
	 * moves one column without the other - {@link Balance} says so in as many words, „can edit one
	 * column without the other" - so two referrals earned either side of such an edit leave a book
	 * whose two halves stand in no single ratio, and the fee they are measured against is a third.
	 *
	 * @param fee     the membership fee that applies to him, both currencies, off the row of the
	 *                price list
	 * @param balance what his book adds up to right now
	 */
	public static Balance.Money whatComesOffTheBook(Balance.Money fee, Balance.Money balance) {
		Objects.requireNonNull(fee, "fee");
		Objects.requireNonNull(balance, "balance");

		return Balance.against(fee, balance).coveredByTheBalance() ? fee : balance;
	}

	/**
	 * Judged in this order, and the order is the reason each refusal says what it says.
	 *
	 * <p><b>THE SEASON BEING TAKEN COMES FIRST, because it is the fact that would end in a
	 * 500.</b> {@code membership_pk} is {@code (competitor_id, season)} (V22), so a row standing
	 * for this pair is a row the {@code insert} cannot add whatever ground it carries. Asked last,
	 * the refusals below it would be reported for a season that is already settled and the write
	 * would then meet the key anyway.
	 *
	 * <p><b>AND THE GROUND THAT WAS ASKED FOR IS ASKED BEFORE THE ONES THAT WERE NOT, which is
	 * what keeps the harmless repeat from becoming a refusal.</b> The other way round, a second
	 * click on „Odobri iz balansa" for a man already in on his balance would answer
	 * {@link Outcome#THE_SEASON_IS_ALREADY_HELD} - a refusal - instead of the 200 that writes
	 * nothing, and the moderator reading a list aloud would be told the row he just did is broken.
	 *
	 * <p><b>A REVERSED PAYMENT IS ASKED AFTER THE MEMBERSHIP AND NOT BEFORE, the same order
	 * {@code MembershipWriteApi} already had and for its reason:</b> a row standing beside a
	 * reversed payment is reported as the membership it is, and a reversal with NO row beside it is
	 * reported as the reversal it is, which is the only case where nothing else has settled the
	 * season.
	 *
	 * <p><b>The book comes last of all, because it is the only one of the five that is about
	 * MONEY rather than about the season.</b> A man whose season is already held must be told that
	 * and not that his book happens to be empty: a book fills again and a settled season does not.
	 */
	public static Outcome decide(Asking asking) {
		Objects.requireNonNull(asking, "asking");

		if (asking.heldOn() != null) {
			if (asking.heldOn().equals(groundIsWrittenAs(asking))) {
				return Outcome.ALREADY_GRANTED_ON_THIS_GROUND;
			}

			return ON_A_FEE.equals(asking.heldOn())
					? Outcome.THE_FEE_IS_ALREADY_RECORDED
					: Outcome.THE_SEASON_IS_ALREADY_HELD;
		}

		if (asking.aPaymentWasReversed()) {
			return Outcome.THE_PAYMENT_WAS_REVERSED;
		}

		if (asking.ground() == Ground.THE_BALANCE && asking.offTheBook().isNothing()) {
			return Outcome.NOTHING_WOULD_COME_OFF_THE_BOOK;
		}

		return asking.numberHeAlreadyHas() == null
				? Outcome.GRANT_AND_NUMBER_HIM
				: Outcome.GRANT;
	}

	/**
	 * THE THREE WORDS OF {@code membership_basis_known}, AND THIS CLASS HOLDS THEM ONLY TO
	 * COMPARE, never to write.
	 *
	 * <p>The route owns the writing, so the schema's word appears there as well; what makes the
	 * two one fact rather than two is {@code MembershipConstraintsTest}, which asks PostgreSQL
	 * what that constraint actually says instead of comparing one written copy against another.
	 * The alternative - handing this class a translated enum - would mean the route deciding, for
	 * every ground, whether the row it found is „the same" as the one asked for, which is this
	 * method.
	 */
	private static final String ON_A_FEE = "payment";

	private static final String FREE_OF_THE_FEE = "feeExempt";

	private static final String ON_A_BALANCE = "balance";

	/** What {@code membership.basis} says for the button that was pressed. */
	public static String groundIsWrittenAs(Asking asking) {
		Objects.requireNonNull(asking, "asking");

		return asking.ground() == Ground.FREE_OF_THE_FEE ? FREE_OF_THE_FEE : ON_A_BALANCE;
	}
}

package com.btl.portal.domain.balance;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT A BALANCE DOES TO A FEE, and the boundary the owner drew through the middle of it.
 *
 * <p><b>The numbers are the portal's own and not invented ones</b>, so that the case that matters
 * most is the case that really happens: V4 prices the early period at 35 euro and 4.200 dinars and
 * a referral at 5 and 600, so <b>seven</b> members brought in is EXACTLY one membership. Six is
 * short and eight is over. That is where „veci ili jednak" lives, and it is measured at all three
 * points rather than at a comfortable one.
 *
 * <p><b>WHERE A FEE AND A BALANCE ARE DELIBERATELY UNEQUAL.</b> Every case that asserts WHICH of
 * the two an answer came from uses two different numbers, because at the boundary they are equal by
 * definition and an assertion about an amount there cannot tell them apart. At the boundary only
 * the BOOLEAN is asserted, which is the one thing that is about the boundary itself.
 */
class BalanceTest {

	/** V4's early period: 35 euro, 4.200 dinars. */
	private static final Balance.Money A_MEMBERSHIP = money("35.00", "4200.00");

	/** V4's referral row: 5 euro, 600 dinars, per member brought in. */
	private static Balance.Money broughtIn(int howMany) {
		return money(String.valueOf(5 * howMany), String.valueOf(600 * howMany));
	}

	private static Balance.Money money(String eur, String rsd) {
		return new Balance.Money(new BigDecimal(eur), new BigDecimal(rsd));
	}

	/**
	 * MONEY SOMEBODY HAS IS NEVER NEGATIVE, AND BOTH HALVES ARE ASKED SEPARATELY.
	 *
	 * <p>One check over the pair would be satisfied by whichever half happened to be positive, so
	 * a sign lost in the dinar column alone would pass. The book holds negative numbers - a spend
	 * moves down - and {@code BalanceBook} is what turns an amount into one; this type is the amount
	 * itself and the two are kept apart on purpose.
	 */
	@Test
	void neitherHalfOfAnAmountMayBeNegative() {
		assertThatThrownBy(() -> money("-5.00", "600.00"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("-5.00");

		assertThatThrownBy(() -> money("5.00", "-600.00"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("-600.00");

		assertThat(money("0", "0").isNothing()).isTrue();
	}

	/** Nothing is nothing however it is written, which is what a balance read as {@code 0.00} is. */
	@Test
	void nothingIsAskedByValueAndNotBySpelling() {
		assertThat(Balance.Money.NOTHING.isNothing()).isTrue();
		assertThat(money("0.00", "0.00").isNothing()).isTrue();

		assertThat(money("0.00", "600.00").isNothing())
				.as("an empty euro half made the whole amount nothing, and the dinars were lost")
				.isFalse();
		assertThat(money("5.00", "0.00").isNothing()).isFalse();
	}

	/**
	 * AN EMPTY BOOK CHANGES NOTHING, and the invoice is the price list's own figure.
	 *
	 * <p>This is most members: nobody has brought anybody in, so there is no balance and the slip
	 * asks for the whole fee. The case exists because the arithmetic has to answer it without a
	 * branch of its own.
	 */
	@Test
	void amemberWithAnEmptyBookOwesTheWholeFee() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, Balance.Money.NOTHING);

		assertThat(settled.fromTheBalance().isNothing()).isTrue();
		assertThat(settled.toTransfer().eur()).isEqualByComparingTo("35.00");
		assertThat(settled.toTransfer().rsd()).isEqualByComparingTo("4200.00");
		assertThat(settled.coveredByTheBalance()).isFalse();
	}

	/**
	 * SIX MEMBERS BROUGHT IN IS SHORT, so the whole balance goes on and the difference is
	 * transferred.
	 *
	 * <p>The owner, 26.09.2026: „QR se kuje na iznos minus balans." 4.200 less 3.600 is 600, and
	 * <b>each of the three amounts here is a different number from the other two</b> - 3.600 used,
	 * 600 left, 4.200 owed - so an answer that returned the fee, the balance or the difference where
	 * it should have returned one of the others fails rather than coinciding.
	 */
	@Test
	void sixMembersBroughtInIsShortAndTheRestIsTransferred() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, broughtIn(6));

		assertThat(settled.fromTheBalance().eur()).isEqualByComparingTo("30");
		assertThat(settled.fromTheBalance().rsd()).isEqualByComparingTo("3600");

		assertThat(settled.toTransfer().eur()).isEqualByComparingTo("5.00");
		assertThat(settled.toTransfer().rsd()).isEqualByComparingTo("600.00");

		assertThat(settled.coveredByTheBalance()).isFalse();
	}

	/**
	 * SEVEN IS THE BOUNDARY AND IT IS ON THE SIDE THAT ACTIVATES.
	 *
	 * <p>The owner, 26.09.2026: „Balans <b>veci ili jednak</b> clanarini: QR koda nema, clanstvo se
	 * aktivira iz balansa." Exactly equal, and it activates. What is asserted here is the boolean
	 * and that nothing is left to transfer: at equality the fee and the balance are the same pair of
	 * numbers, so no assertion about an AMOUNT could tell which of the two produced it.
	 *
	 * <p><b>This is the case that falls the moment „greater or equal" becomes „greater".</b>
	 */
	@Test
	void sevenMembersBroughtInIsExactlyAMembershipAndThatCovers() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, broughtIn(7));

		assertThat(settled.coveredByTheBalance())
				.as("a balance equal to the fee was treated as short, which is the boundary itself")
				.isTrue();

		assertThat(settled.toTransfer().isNothing()).isTrue();
	}

	/**
	 * EIGHT IS OVER, AND THE SURPLUS STAYS.
	 *
	 * <p>The owner, 26.09.2026: „visak ostaje za sledecu godinu." So the membership takes the FEE
	 * and not the balance, and the difference between the two is what makes this case say anything:
	 * 40 held against 35 owed, so an answer that spent the whole balance shows up as 40.
	 */
	@Test
	void eightMembersBroughtInCoversItAndTheSurplusIsNotSpent() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, broughtIn(8));

		assertThat(settled.coveredByTheBalance()).isTrue();
		assertThat(settled.toTransfer().isNothing()).isTrue();

		assertThat(settled.fromTheBalance().eur())
				.as("the whole balance was spent on a fee smaller than it, so the surplus is gone")
				.isEqualByComparingTo("35.00");
		assertThat(settled.fromTheBalance().rsd()).isEqualByComparingTo("4200.00");

		assertThat(settled.balance().eur())
				.as("the balance answered is no longer the balance that was handed in")
				.isEqualByComparingTo("40");
	}

	/**
	 * BEING COVERED ASKS BOTH CURRENCIES, AND EITHER ONE FALLING SHORT IS SHORT.
	 *
	 * <p>Unreachable while the price list holds 120 dinars to the euro everywhere, and reachable the
	 * moment {@code PUT /api/pricing/{key}} moves one column without the other - which is why it is
	 * measured rather than argued about. The direction is deliberate and {@link Balance} says so:
	 * the portal would rather ask a covered member to pay than give away a membership it is not
	 * certain of.
	 */
	@Test
	void shortInEitherCurrencyAloneIsNotCovered() {
		assertThat(Balance.against(A_MEMBERSHIP, money("35.00", "4199.00")).coveredByTheBalance())
				.as("covered on the euro alone")
				.isFalse();

		assertThat(Balance.against(A_MEMBERSHIP, money("34.00", "4200.00")).coveredByTheBalance())
				.as("covered on the dinar alone")
				.isFalse();

		assertThat(Balance.against(A_MEMBERSHIP, money("35.00", "4200.00")).coveredByTheBalance()).isTrue();
	}

	/** And each currency is settled on its own, with two different shortfalls to prove it. */
	@Test
	void eachCurrencyIsSettledAgainstItsOwnColumn() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, money("30.00", "1200.00"));

		assertThat(settled.toTransfer().eur()).isEqualByComparingTo("5.00");
		assertThat(settled.toTransfer().rsd())
				.as("the dinar shortfall was worked out from the euro column")
				.isEqualByComparingTo("3000.00");
	}

	/**
	 * A BOOKED PAYMENT TAKES WHAT THE CODE PROMISED, EVEN WHEN THE BALANCE HAS GROWN SINCE.
	 *
	 * <p><b>Owner, 27.09.2026</b>, on his own numbers: a code minted for 3.600 against a balance of
	 * 600, a seventh referral activated before the money lands so the balance is 1.200, and then the
	 * 3.600 arrives. <b>600 comes off and 600 stays.</b>
	 *
	 * <p><b>The promise and the balance are deliberately different numbers here</b>, which is the
	 * whole case: were the fixture built with a balance that had not moved, „take the promise" and
	 * „take today's balance" would answer alike and this would measure nothing.
	 */
	@Test
	void whatIsTakenIsWhatWasPromisedAndNotTodaysBalance() {
		Balance.Money promised = broughtIn(1);
		Balance.Money grownSince = broughtIn(2);

		Balance.Money taken = Balance.honouring(promised, grownSince);

		assertThat(taken.eur()).isEqualByComparingTo("5");
		assertThat(taken.rsd())
				.as("today's balance was taken instead of the promise, so the association gave away"
						+ " twice the discount it offered")
				.isEqualByComparingTo("600");
	}

	/**
	 * AND IT IS CAPPED AT WHAT IS ACTUALLY THERE, which is the boundary that needs two seasons.
	 *
	 * <p>A promise is not a reservation - the owner refused deducting at minting - so a code for
	 * season S and a code for S+1 can both stand and the one booked second can find the money gone.
	 * Honouring the promise regardless would drive the book below zero, which is the association
	 * recording that it paid out more than it ever owed.
	 */
	@Test
	void aPromiseIsHonouredOnlyAsFarAsThereIsMoneyLeft() {
		Balance.Money taken = Balance.honouring(broughtIn(7), broughtIn(2));

		assertThat(taken.eur()).isEqualByComparingTo("10");
		assertThat(taken.rsd()).isEqualByComparingTo("1200");

		assertThat(Balance.honouring(broughtIn(7), Balance.Money.NOTHING).isNothing())
				.as("a promise was honoured out of an empty book")
				.isTrue();
	}

	/** The cap is per currency too, with a different answer in each to prove it. */
	@Test
	void theCapIsAskedOfEachCurrencyOnItsOwn() {
		Balance.Money taken = Balance.honouring(money("35.00", "4200.00"), money("30.00", "5000.00"));

		assertThat(taken.eur()).as("capped by the book").isEqualByComparingTo("30.00");
		assertThat(taken.rsd()).as("capped by the promise").isEqualByComparingTo("4200.00");
	}

	/**
	 * AND A SECOND LOOK AT AN INVOICE IS SERVED THE CODE HE IS HOLDING, not the sum his book has
	 * grown to since.
	 *
	 * <p><b>Why the reduction may not be recomputed.</b> A slip already printed is not on the screen.
	 * Recompute it and a member whose balance moved holds two slips saying two numbers while only one
	 * promise can be recorded, so whichever he pays, the book takes off the other one's amount. That
	 * is the outcome the owner refused on 27.09.2026 with the cost stated to him.
	 *
	 * <p><b>THE TWO HALVES COME FROM DIFFERENT DAYS AND EACH IS ASSERTED, because that split is the
	 * decision.</b> The reduction and the transfer are the code's; the balance and „covered" are
	 * today's, because the second of them is read as „{@code POST /api/me/membership} is a way in"
	 * and that route mints no code and reads no promise.
	 *
	 * <p><b>The promise and today's balance are deliberately different numbers</b>, or „serve the
	 * promise" and „serve today" would answer alike and this would measure nothing.
	 */
	@Test
	void asecondLookIsServedThePromiseWhileTheBalanceAndCoverAreTodays() {
		Balance.Settlement today = Balance.against(A_MEMBERSHIP, broughtIn(2));

		Balance.Settlement served = Balance.asThePromiseStands(today, broughtIn(1));

		assertThat(served.fromTheBalance().rsd())
				.as("today's book was served instead of what the code promised, so a booking would take"
						+ " twice the discount that was offered")
				.isEqualByComparingTo("600");

		assertThat(served.toTransfer().rsd())
				.as("the transfer and the reduction no longer add back up to the fee, so whatever the"
						+ " member sends leaves the association short")
				.isEqualByComparingTo("3600");

		assertThat(served.fromTheBalance().rsd().add(served.toTransfer().rsd()))
				.isEqualByComparingTo(served.fee().rsd());

		assertThat(served.balance().rsd())
				.as("the balance shown is the promise rather than what he actually has today")
				.isEqualByComparingTo("1200");

		assertThat(served.fee()).isEqualTo(today.fee());
		assertThat(served.coveredByTheBalance()).isFalse();
	}

	/**
	 * AND „COVERED" STAYS TODAY'S ANSWER EVEN WHILE THE TRANSFER IS THE CODE'S, which is the one
	 * combination that proves the two halves are read from two places.
	 *
	 * <p>A member short of the fee at his first look, whose book has since grown past it: the slip in
	 * his hand still asks for a transfer, AND he may now let himself in for nothing. Both roads are
	 * open and both come out right - activating spends today's book and kills the slip, because a man
	 * already holding the season is refused at the paying door. Were „covered" taken off the promise
	 * instead, he would be held to his slip for the rest of the season with a book that covers the
	 * whole fee.
	 */
	@Test
	void amemberWhoseBalanceOutgrewHisCodeIsBothCoveredAndStillAskedToTransfer() {
		Balance.Settlement served = Balance.asThePromiseStands(
				Balance.against(A_MEMBERSHIP, broughtIn(8)), broughtIn(1));

		assertThat(served.coveredByTheBalance())
				.as("covered was read off the promise, so a member whose book covers the whole fee is"
						+ " told it does not")
				.isTrue();

		assertThat(served.toTransfer().isNothing())
				.as("the transfer was recomputed from today, so the slip in his hand is not what this"
						+ " answer describes")
				.isFalse();

		assertThat(served.fromTheBalance().rsd()).isEqualByComparingTo("600");
	}

	/**
	 * A PROMISE LARGER THAN THE FEE IS CAPPED AT IT, and that is what stops a 500 rather than a
	 * nicety: {@link Balance.Money} refuses a negative amount, so an uncapped subtraction would
	 * throw.
	 *
	 * <p><b>The road to it is the price list being edited DOWNWARDS between two looks</b>, and that
	 * case is a boundary this branch names rather than settles: the promise carries no price, so
	 * nothing can tell which price list a slip was minted from, and a member paying the newer slip
	 * transfers less than the season now costs.
	 */
	@Test
	void apromiseBiggerThanTheFeeLeavesNothingToTransferInsteadOfThrowing() {
		Balance.Settlement served = Balance.asThePromiseStands(
				Balance.against(money("5.00", "600.00"), broughtIn(1)), broughtIn(7));

		assertThat(served.fromTheBalance().rsd()).isEqualByComparingTo("600.00");
		assertThat(served.toTransfer().isNothing()).isTrue();
	}

	/** And neither half of it may be missing, because a settlement of nothing is not one. */
	@Test
	void servingAPromiseNeedsBothTheSettlementAndThePromise() {
		Balance.Settlement today = Balance.against(A_MEMBERSHIP, broughtIn(1));

		assertThatThrownBy(() -> Balance.asThePromiseStands(null, broughtIn(1)))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("today");

		assertThatThrownBy(() -> Balance.asThePromiseStands(today, null))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("promised");
	}
}

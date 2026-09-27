package com.btl.portal.domain.balance;

import com.btl.portal.domain.pricing.Currency;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT A BALANCE DOES TO A FEE, and the boundaries the owner drew through the middle of it.
 *
 * <p><b>The numbers are the portal's own and not invented ones</b>, so that the case that matters most
 * is the case that really happens: V4 prices the early period at 35 euro and 4.200 dinars and a
 * referral at 5 and 600, so <b>seven</b> members brought in is EXACTLY one membership in either money.
 * Six is short and eight is over. That is where „veci ili jednak" lives, and it is measured at all
 * three points rather than at a comfortable one.
 *
 * <p><b>EVERY CASE NAMES ITS CURRENCY AND MOST OF THEM ARE IN DINARS, which is deliberate rather than
 * arbitrary.</b> Since V42 a {@link Balance.Money} is one amount and one money, and the cheapest
 * mistake anybody can now make is to read a euro figure against a dinar one - at the seeded rate that
 * is wrong by a factor of a hundred and twenty and still perfectly ordinary arithmetic. So the cases
 * below are written in dinars where a mistake would be LARGE, and every operation has a case that
 * hands it two different currencies and requires it to refuse rather than to pick one.
 *
 * <p><b>WHERE A FEE AND A BALANCE ARE DELIBERATELY UNEQUAL.</b> Every case that asserts WHICH of the
 * two an answer came from uses two different numbers, because at the boundary they are equal by
 * definition and an assertion about an amount there cannot tell them apart. At the boundary only the
 * BOOLEAN is asserted, which is the one thing that is about the boundary itself.
 */
class BalanceTest {

	/** V4's early period in dinars: 4.200. */
	private static final Balance.Money A_MEMBERSHIP = dinars("4200.00");

	/** The same membership in euro: 35. */
	private static final Balance.Money A_MEMBERSHIP_IN_EURO = euro("35.00");

	/** V4's referral row, in dinars: 600 per member brought in. */
	/**
	 * <p><b>Written to two decimals, which is not cosmetic.</b> A {@code Money} is a record, so
	 * {@code equals} compares its {@code BigDecimal} by {@code equals} too - and that is scale
	 * sensitive, so {@code 4200} and {@code 4200.00} are two different values to it while being one
	 * number. Every amount the portal ever holds comes out of a {@code numeric(10,2)} column and
	 * therefore carries two decimals; a fixture writing fewer would be asserting about a shape the
	 * database cannot produce, and {@link Balance.Money#atMost} answering „the other one" would read as
	 * a wrong answer rather than as the same number differently spelled.
	 */
	private static Balance.Money broughtIn(int howMany) {
		return dinars(String.format("%d.00", 600 * howMany));
	}

	private static Balance.Money dinars(String amount) {
		return new Balance.Money(new BigDecimal(amount), Currency.RSD);
	}

	private static Balance.Money euro(String amount) {
		return new Balance.Money(new BigDecimal(amount), Currency.EUR);
	}

	/**
	 * MONEY SOMEBODY HAS IS NEVER NEGATIVE.
	 *
	 * <p>The book holds negative numbers - a spend moves down - and {@code BalanceBook} is what turns an
	 * amount into one; this type is the amount itself and the two are kept apart on purpose. The four
	 * sign constraints of V42 are the same rule where it cannot be got around.
	 */
	@Test
	void anamountOfMoneyIsNeverNegative() {
		assertThatThrownBy(() -> dinars("-600.00"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("-600.00");

		assertThatThrownBy(() -> euro("-5.00"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("-5.00");
	}

	/** And neither half of it may be absent, because „an amount" without a money is not one. */
	@Test
	void anamountCarriesBothAnumberAndAmoney() {
		assertThatThrownBy(() -> new Balance.Money(null, Currency.RSD))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("amount");

		assertThatThrownBy(() -> new Balance.Money(new BigDecimal("600.00"), null))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("currency");
	}

	/**
	 * NOTHING IS ASKED BY VALUE AND NOT BY SPELLING, and „is it money" is its exact opposite.
	 *
	 * <p>{@code BigDecimal.ZERO} and {@code 0.00} are different objects with different scales and the
	 * same value; a question asked with {@code equals} would answer differently for the two, and the
	 * book writes {@code numeric(10,2)} so what comes back out of it is always scaled.
	 *
	 * <p><b>THE TWO QUESTIONS ARE EXACT OPPOSITES NOW AND WERE NOT BEFORE V42, which is the one thing
	 * this case is really about.</b> Under the pair, {@code isMoneyInBothCurrencies} and
	 * {@code !isNothing} differed on a state a pair could reach and a single amount cannot: 15.00/0.00
	 * answered false to both. That state is gone with the pair, so the two are complementary by
	 * construction and are measured to be so at nought and on both sides of it.
	 */
	@Test
	void nothingAndMoneyAreAskedByValueAndAreExactOpposites() {
		assertThat(dinars("0").isNothing()).isTrue();
		assertThat(dinars("0.00").isNothing()).isTrue();
		assertThat(Balance.Money.nothingIn(Currency.EUR).isNothing()).isTrue();
		assertThat(dinars("0.01").isNothing()).isFalse();

		assertThat(dinars("0").isMoney()).isFalse();
		assertThat(dinars("0.00").isMoney()).isFalse();
		assertThat(dinars("0.01").isMoney()).isTrue();
		assertThat(A_MEMBERSHIP.isMoney()).isTrue();
	}

	/** And nothing still has a money, because „nothing" has to be said in one. */
	@Test
	void nothingIsStillSaidInAmoney() {
		assertThat(Balance.Money.nothingIn(Currency.RSD).currency()).isEqualTo(Currency.RSD);
		assertThat(Balance.Money.nothingIn(Currency.EUR).currency()).isEqualTo(Currency.EUR);
	}

	/**
	 * THE SMALLER OF TWO AMOUNTS, AND EQUAL ANSWERS ONE OF THEM RATHER THAN THROWING.
	 *
	 * <p>Both sides are asserted and not only one, because a „min" written the wrong way round is right
	 * exactly half the time and the half it is right in is whichever one the case happened to pick.
	 */
	@Test
	void theSmallerOfTwoAmountsIsAnsweredFromEitherSide() {
		assertThat(broughtIn(6).atMost(A_MEMBERSHIP)).isEqualTo(broughtIn(6));
		assertThat(broughtIn(8).atMost(A_MEMBERSHIP)).isEqualTo(A_MEMBERSHIP);
		assertThat(broughtIn(7).atMost(A_MEMBERSHIP)).isEqualTo(A_MEMBERSHIP);
	}

	/**
	 * AND NOTHING IN THIS CLASS EVER TAKES TWO CURRENCIES, which is the guard that replaces a whole
	 * shape of mistake the pair made impossible.
	 *
	 * <p>Every operation is asked, and each is asked in the direction it would be asked in for real: a
	 * dinar balance against a euro fee is what happens when a route reads the price list in the wrong
	 * column. The refusal names both monies, so the message says which two were crossed rather than
	 * only that something was.
	 */
	@Test
	void everyOperationRefusesTwoCurrenciesRatherThanPickingOne() {
		assertThatThrownBy(() -> broughtIn(6).atMost(A_MEMBERSHIP_IN_EURO))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("RSD")
				.hasMessageContaining("EUR");

		assertThatThrownBy(() -> Balance.against(A_MEMBERSHIP_IN_EURO, broughtIn(6)))
				.isInstanceOf(IllegalArgumentException.class);

		assertThatThrownBy(() -> Balance.whatIsStillOwed(A_MEMBERSHIP_IN_EURO, broughtIn(6)))
				.isInstanceOf(IllegalArgumentException.class);

		assertThatThrownBy(() -> Balance.whatArrivedInExcess(A_MEMBERSHIP_IN_EURO, broughtIn(6)))
				.isInstanceOf(IllegalArgumentException.class);
	}

	/** And an absent amount is refused before its currency is ever looked at. */
	@Test
	void anoperationOverAmissingAmountIsRefusedRatherThanAnsweredAsNothing() {
		assertThatThrownBy(() -> Balance.against(null, broughtIn(6)))
				.isInstanceOf(NullPointerException.class);

		assertThatThrownBy(() -> Balance.against(A_MEMBERSHIP, null))
				.isInstanceOf(NullPointerException.class);
	}

	/** A member who has brought in nobody owes the whole fee and his book pays none of it. */
	@Test
	void amemberWithAnEmptyBookOwesTheWholeFee() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, Balance.Money.nothingIn(Currency.RSD));

		assertThat(settled.fromTheBalance().isNothing()).isTrue();
		assertThat(settled.toTransfer()).isEqualTo(A_MEMBERSHIP);
		assertThat(settled.coveredByTheBalance()).isFalse();
	}

	/**
	 * SIX MEMBERS BROUGHT IN IS SHORT, so the whole book goes and the rest is transferred.
	 *
	 * <p>3.600 of 4.200, which the owner's own worked example of 27.09.2026 uses. The transfer is 600
	 * and not the fee, and the two are different numbers here on purpose.
	 */
	@Test
	void sixMembersBroughtInIsShortAndTheRestIsTransferred() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, broughtIn(6));

		assertThat(settled.fromTheBalance()).isEqualTo(broughtIn(6));
		assertThat(settled.toTransfer()).isEqualTo(dinars("600.00"));
		assertThat(settled.coveredByTheBalance()).isFalse();
	}

	/**
	 * SEVEN IS EXACTLY A MEMBERSHIP, AND EXACTLY IS THE SIDE THAT COVERS.
	 *
	 * <p>The owner's „veci ili jednak", and the reason equality is a case of its own: asking a member
	 * whose balance is exactly the fee to transfer nothing is the shape he refused when he refused the
	 * symbolic QR („clan placa ono sto ne duguje, a banci trosak premasuje iznos"). Only the boolean and
	 * the transfer are asserted here, because the fee and the balance are equal at this point and no
	 * assertion about an amount could say which one it came from.
	 */
	@Test
	void sevenMembersBroughtInIsExactlyAmembershipAndThatCovers() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, broughtIn(7));

		assertThat(settled.coveredByTheBalance()).isTrue();
		assertThat(settled.toTransfer().isNothing()).isTrue();
	}

	/** Eight covers it, and the surplus stays in the book rather than being spent. */
	@Test
	void eightMembersBroughtInCoversItAndTheSurplusIsNotSpent() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, broughtIn(8));

		assertThat(settled.coveredByTheBalance()).isTrue();
		assertThat(settled.fromTheBalance()).isEqualTo(A_MEMBERSHIP);
		assertThat(settled.balance()).isEqualTo(broughtIn(8));
		assertThat(settled.toTransfer().isNothing()).isTrue();
	}

	/**
	 * AND THE SETTLEMENT CARRIES THE FEE AND THE BALANCE IT WAS ASKED ABOUT, not a copy of one of them.
	 *
	 * <p>Two different numbers, so a record that handed the same value to both fields would show up as
	 * a wrong one rather than as a coincidence.
	 */
	@Test
	void thesettlementSaysWhatItWasAskedAbout() {
		Balance.Settlement settled = Balance.against(A_MEMBERSHIP, broughtIn(6));

		assertThat(settled.fee()).isEqualTo(A_MEMBERSHIP);
		assertThat(settled.balance()).isEqualTo(broughtIn(6));
	}

	/**
	 * WHAT IS STILL OWED AFTER MONEY HAS ARRIVED, and nothing rather than a negative when enough has.
	 *
	 * <p>This is the moderator's door: PDL section 19, case 2 („manji, balans pokriva razliku") and case
	 * 3 („balans se trosi do kraja, pa se pita o ostatku"). Three states and the two boundaries are
	 * separate cases, because „less" and „exactly" and „more" are the three the owner's grid turns on.
	 */
	@Test
	void whatIsStillOwedIsTheShortfallAndNeverAnegative() {
		assertThat(Balance.whatIsStillOwed(A_MEMBERSHIP, dinars("3600.00")))
				.isEqualTo(dinars("600.00"));

		assertThat(Balance.whatIsStillOwed(A_MEMBERSHIP, A_MEMBERSHIP).isNothing()).isTrue();

		assertThat(Balance.whatIsStillOwed(A_MEMBERSHIP, dinars("5000.00")).isNothing()).isTrue();
	}

	/**
	 * AND WHAT ARRIVED OVER AND ABOVE IT, which is case 7 („visak ulazi u balans kao kredit").
	 *
	 * <p>The two questions are asked of the same three states, because a member who sent too much owes
	 * nothing more AND has a credit, and one who sent too little owes the difference AND has no credit.
	 * One number cannot be both, which is why they are two methods.
	 */
	@Test
	void whatArrivedInExcessIsTheSurplusAndNothingWhenThereIsNone() {
		assertThat(Balance.whatArrivedInExcess(A_MEMBERSHIP, dinars("5000.00")))
				.isEqualTo(dinars("800.00"));

		assertThat(Balance.whatArrivedInExcess(A_MEMBERSHIP, A_MEMBERSHIP).isNothing()).isTrue();

		assertThat(Balance.whatArrivedInExcess(A_MEMBERSHIP, dinars("3600.00")).isNothing()).isTrue();
	}

	/**
	 * ONE EURO IS ONE HUNDRED AND TWENTY DINARS, IN BOTH DIRECTIONS.
	 *
	 * <p>Owner, 27.09.2026 (PDL 26): „Dvojka, 120 je kurs i tako ostaje do daljnjeg." The numbers here
	 * are the portal's own, so the case reads as the thing that really happens: a referral is 600 dinars
	 * and 5 euro, and a membership 4.200 and 35, so a book of one referral translates to exactly the
	 * euro figure the price list publishes for the same thing. <b>That is the strongest form this case
	 * can take</b>: a rate that was wrong would not land on the price list's own number.
	 */
	@Test
	void abalanceIsTranslatedAtAhundredAndTwentyInBothDirections() {
		assertThat(Balance.translated(broughtIn(1), Currency.EUR)).isEqualTo(euro("5.00"));
		assertThat(Balance.translated(A_MEMBERSHIP, Currency.EUR)).isEqualTo(euro("35.00"));

		assertThat(Balance.translated(euro("5.00"), Currency.RSD)).isEqualTo(dinars("600.00"));
		assertThat(Balance.translated(euro("35.00"), Currency.RSD)).isEqualTo(dinars("4200.00"));
	}

	/**
	 * AND A REMAINDER IS ROUNDED HALF UP TO TWO DECIMALS, which is the portal's rule and not a choice
	 * made for this branch.
	 *
	 * <p>{@code BtlScoreCalculator} rounds its points that way and {@code WhatAResultChangeSays} its
	 * printed numbers, and every money column in the schema is {@code numeric(10,2)}. 650 dinars is
	 * 5.41666... euro, which rounds up to 5.42; 649 is 5.40833..., which rounds down to 5.41. <b>Both
	 * sides of the half are measured</b>, because a rounding mode asserted only where it rounds up is
	 * indistinguishable from {@code CEILING}, and one asserted only where it rounds down from
	 * {@code FLOOR}.
	 */
	@Test
	void aremainderIsRoundedHalfUpAndBothSidesOfTheHalfAreMeasured() {
		assertThat(Balance.translated(dinars("650.00"), Currency.EUR)).isEqualTo(euro("5.42"));
		assertThat(Balance.translated(dinars("649.00"), Currency.EUR)).isEqualTo(euro("5.41"));

		/* Exactly on the half: 654 dinars is 5.45 exactly, 655 is 5.458333... and rounds to 5.46. */
		assertThat(Balance.translated(dinars("654.00"), Currency.EUR)).isEqualTo(euro("5.45"));
		assertThat(Balance.translated(dinars("655.00"), Currency.EUR)).isEqualTo(euro("5.46"));
	}

	/**
	 * AND ASKING FOR THE MONEY IT IS ALREADY IN GIVES IT BACK UNCHANGED.
	 *
	 * <p>That is the state a member changing from Germany to France is in - his country moved and his
	 * money did not - and the route is the one that has to notice and write no line. This answers it
	 * rather than throwing, so the arithmetic stays total and no caller has to guard it, and the case
	 * asserts the SCALE as well as the value because a translation that went through the rate and back
	 * would arrive at the same number by a different road.
	 */
	@Test
	void translatingIntoTheMoneyItIsAlreadyInChangesNothing() {
		assertThat(Balance.translated(A_MEMBERSHIP, Currency.RSD)).isEqualTo(A_MEMBERSHIP);
		assertThat(Balance.translated(euro("35.00"), Currency.EUR)).isEqualTo(euro("35.00"));
		assertThat(Balance.translated(dinars("0.00"), Currency.RSD).isNothing()).isTrue();
	}

	/** And neither half of the question may be absent. */
	@Test
	void translatingNeedsBothAnamountAndAmoneyToTranslateInto() {
		assertThatThrownBy(() -> Balance.translated(null, Currency.EUR))
				.isInstanceOf(NullPointerException.class);

		assertThatThrownBy(() -> Balance.translated(A_MEMBERSHIP, null))
				.isInstanceOf(NullPointerException.class);
	}

	/**
	 * WHAT A SECOND LOOK AT ONE INVOICE SERVES: THE PROMISE'S REDUCTION AND TODAY'S BALANCE.
	 *
	 * <p>Owner, 27.09.2026: „skida se ono sto je kod obecao, ne ono sto balans stoji na dan
	 * knjizenja." The case he was shown: a code minted for 3.600 against a balance of 600, a seventh
	 * referral landing so the balance becomes 1.200, and then a mere refresh of the page.
	 *
	 * <p><b>THE FOUR FIELDS COME FROM THREE DIFFERENT PLACES AND EVERY ONE OF THEM IS A DIFFERENT
	 * NUMBER HERE.</b> That is what makes this case measure the SOURCE and not only the outcome: the
	 * promise is 600, today's book is 1.200, the fee is 4.200 and the transfer is 3.600, so an
	 * implementation that took the reduction from today would answer 1.200 and one that took the balance
	 * from the promise would answer 600, and both would be visible.
	 */
	@Test
	void asecondLookIsServedThePromiseWhileTheBalanceIsTodays() {
		Balance.Settlement today = Balance.against(A_MEMBERSHIP, broughtIn(2));

		Balance.Settlement served = Balance.asThePromiseStands(today, broughtIn(1));

		assertThat(served.fee()).isEqualTo(A_MEMBERSHIP);
		assertThat(served.balance()).isEqualTo(broughtIn(2));
		assertThat(served.fromTheBalance()).isEqualTo(broughtIn(1));
		assertThat(served.toTransfer()).isEqualTo(dinars("3600.00"));
		assertThat(served.coveredByTheBalance()).isFalse();
	}

	/**
	 * AND A MEMBER WHOSE BOOK OUTGREW HIS CODE IS BOTH COVERED AND STILL ASKED TO TRANSFER.
	 *
	 * <p>Two things that look contradictory and are not, which is why the field they drive is documented
	 * on the record: {@code coveredByTheBalance} means „{@code POST /api/me/membership} is a way in",
	 * and that route mints no code and consults no promise. The transfer is what the slip in his hand
	 * says. Both roads are open to him and both come out right.
	 */
	@Test
	void amemberWhoseBalanceOutgrewHisCodeIsBothCoveredAndStillAskedToTransfer() {
		Balance.Settlement today = Balance.against(A_MEMBERSHIP, broughtIn(8));

		Balance.Settlement served = Balance.asThePromiseStands(today, broughtIn(1));

		assertThat(served.coveredByTheBalance()).isTrue();
		assertThat(served.toTransfer()).isEqualTo(dinars("3600.00"));
		assertThat(served.fromTheBalance()).isEqualTo(broughtIn(1));
	}

	/**
	 * A PROMISE BIGGER THAN THE FEE LEAVES NOTHING TO TRANSFER INSTEAD OF THROWING.
	 *
	 * <p>The road to it is the price list being edited downwards between two looks, which {@link Balance}
	 * names as a boundary rather than settling. What matters is that it cannot drive the transfer below
	 * nothing, because {@code Money} refuses a negative and the answer would be a 500 on a member's own
	 * screen.
	 */
	@Test
	void apromiseBiggerThanTheFeeLeavesNothingToTransferInsteadOfThrowing() {
		Balance.Settlement today = Balance.against(dinars("2400.00"), broughtIn(1));

		Balance.Settlement served = Balance.asThePromiseStands(today, broughtIn(8));

		assertThat(served.toTransfer().isNothing()).isTrue();
		assertThat(served.fromTheBalance()).isEqualTo(dinars("2400.00"));
	}

	/**
	 * AND A PROMISE IN A MONEY THAT IS NOT THE FEE'S IS REFUSED RATHER THAN CONVERTED.
	 *
	 * <p>That state is the one a member changing country would be in, and the portal makes it
	 * UNREACHABLE rather than handling it: {@code MeWriteApi} deletes every promise he holds the moment
	 * the money he is billed in changes. It is measured here all the same, because a refusal is the only
	 * thing that stays loud if that deletion is ever lost - and the alternative, a branch that coped,
	 * would be a branch nothing in production can enter.
	 */
	@Test
	void apromiseInAnotherMoneyIsRefusedRatherThanConverted() {
		Balance.Settlement today = Balance.against(A_MEMBERSHIP, broughtIn(2));

		assertThatThrownBy(() -> Balance.asThePromiseStands(today, euro("5.00")))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("RSD")
				.hasMessageContaining("EUR");
	}

	/** And serving a promise needs a settlement to serve it against. */
	@Test
	void servingApromiseNeedsBothTheSettlementAndThePromise() {
		Balance.Settlement today = Balance.against(A_MEMBERSHIP, broughtIn(2));

		assertThatThrownBy(() -> Balance.asThePromiseStands(null, broughtIn(1)))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("today");

		assertThatThrownBy(() -> Balance.asThePromiseStands(today, null))
				.isInstanceOf(NullPointerException.class);
	}
}

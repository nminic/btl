package com.btl.portal.domain.balance;

import com.btl.portal.domain.balance.BookLine.Reason;
import com.btl.portal.domain.balance.ReversingAMembership.Reversal;
import com.btl.portal.domain.pricing.Currency;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT ONE SEASON HOLDS AGAINST THE BALANCE, AND THE LINE THAT REVERSES IT, over every state a
 * season's membership can leave in the book.
 *
 * <p>Every book here holds the season under test among OTHER lines that a wrong reading would take:
 * another season of the same member, his own reward and a conversion (no season), and an earlier pass
 * of the same season already reversed. The season under test is never the only thing in the book and
 * never its last line, so a reading that took „the last line" or „every line" gives a different number.
 */
class ReversingAMembershipTest {

	private static final int SEASON = 2028;

	private static final int ANOTHER_SEASON = 2029;

	private static BookLine line(long id, Reason reason, Integer season, String amount, Currency currency) {
		return new BookLine(id, reason, season, new BigDecimal(amount), currency);
	}

	/** What does not belong to the season: his own reward, a conversion, and the next season. */
	private static List<BookLine> withTheRestOfHisBook(BookLine... ofTheSeason) {
		List<BookLine> rest = List.of(
				line(1, Reason.REFERRAL, null, "5.00", Currency.EUR),
				line(90, Reason.MEMBERSHIP, ANOTHER_SEASON, "-30.00", Currency.EUR),
				line(91, Reason.CONVERSION, null, "-1.00", Currency.EUR),
				line(92, Reason.CONVERSION, null, "120.00", Currency.RSD));

		return Stream.concat(rest.stream(), Arrays.stream(ofTheSeason)).toList();
	}

	private static Optional<Reversal> reversalOf(List<BookLine> book) {
		return ReversingAMembership.reversal(book, SEASON, Currency.EUR);
	}

	private static Reversal reversal(String amount) {
		return new Reversal(new BigDecimal(amount), Currency.EUR);
	}

	@Test
	void aPaymentThatTookNothingAndCreditedNothingLeavesNothingToReverse() {
		assertThat(reversalOf(withTheRestOfHisBook())).isEmpty();
	}

	@Test
	void aPaymentThatTookPartOfTheBalanceGetsThatPartBack() {
		assertThat(reversalOf(withTheRestOfHisBook(line(10, Reason.MEMBERSHIP, SEASON, "-10.00", Currency.EUR))))
				.contains(reversal("10.00"));
	}

	@Test
	void aPaymentThatTookTheBalanceToTheEndGetsAllOfItBack() {
		assertThat(reversalOf(withTheRestOfHisBook(line(10, Reason.MEMBERSHIP, SEASON, "-25.50", Currency.EUR))))
				.contains(reversal("25.50"));
	}

	@Test
	void aPaymentLargerThanExpectedHasItsCreditTakenBack() {
		assertThat(reversalOf(withTheRestOfHisBook(line(10, Reason.OVERPAYMENT, SEASON, "7.00", Currency.EUR))))
				.contains(reversal("-7.00"));
	}

	@Test
	void aMembershipOnTheBalanceGetsTheWholeFeeBack() {
		assertThat(reversalOf(withTheRestOfHisBook(line(10, Reason.MEMBERSHIP, SEASON, "-35.00", Currency.EUR))))
				.contains(reversal("35.00"));
	}

	/** An exemption writes nothing in the book, so this is the same book as the first case, said for
	 *  the basis it stands for. */
	@Test
	void anExemptionLeavesNothingToReverse() {
		assertThat(reversalOf(withTheRestOfHisBook())).isEmpty();
	}

	/**
	 * THE OTHER SEASON IS NOT THIS ONE, in both directions: each season is answered with its own
	 * line, and the one under test sits between his reward and the other season's spend.
	 */
	@Test
	void anotherSeasonOfTheSameMemberIsItsOwn() {
		List<BookLine> book = withTheRestOfHisBook(line(10, Reason.MEMBERSHIP, SEASON, "-10.00", Currency.EUR));

		assertThat(ReversingAMembership.reversal(book, SEASON, Currency.EUR)).contains(reversal("10.00"));
		assertThat(ReversingAMembership.reversal(book, ANOTHER_SEASON, Currency.EUR)).contains(reversal("30.00"));
		assertThat(ReversingAMembership.reversal(book, 2027, Currency.EUR)).isEmpty();
	}

	/**
	 * A SEASON CANCELLED, PAID FOR AGAIN AND CANCELLED AGAIN: only the pass that stands now. The first
	 * pass took 30 and was reversed, the second took 20, so the answer is 20 and not 50 and not 0.
	 */
	@Test
	void aSeasonCancelledAndPaidForAgainReversesOnlyThePassThatStands() {
		List<BookLine> book = withTheRestOfHisBook(
				line(10, Reason.MEMBERSHIP, SEASON, "-30.00", Currency.EUR),
				line(11, Reason.REVERSAL, SEASON, "30.00", Currency.EUR),
				line(12, Reason.MEMBERSHIP, SEASON, "-20.00", Currency.EUR));

		assertThat(reversalOf(book)).contains(reversal("20.00"));
		assertThat(ReversingAMembership.whatItTook(book, SEASON, Currency.EUR))
				.isEqualTo(new Balance.Money(new BigDecimal("20.00"), Currency.EUR));
	}

	/**
	 * CANCELLED TWICE AND PAID FOR A THIRD TIME: the pass that stands starts after the LAST reversal and
	 * not after the first. The season's spend is 30, 20 and 10, each of the first two reversed, so what
	 * it took is 10; read from the first reversal it would be 20 + 10 = 30.
	 *
	 * <p>The second source this separates is WHICH reversal the reading starts from: the first or the
	 * last. The reversal itself cannot tell them apart (the middle pass nets out either way, +10), which
	 * is why {@code whatItTook} is asserted beside it.
	 */
	@Test
	void aSeasonCancelledTwiceAndPaidForAThirdTimeStartsFromTheLastReversalAndNotTheFirst() {
		List<BookLine> book = withTheRestOfHisBook(
				line(10, Reason.MEMBERSHIP, SEASON, "-30.00", Currency.EUR),
				line(11, Reason.REVERSAL, SEASON, "30.00", Currency.EUR),
				line(12, Reason.MEMBERSHIP, SEASON, "-20.00", Currency.EUR),
				line(13, Reason.REVERSAL, SEASON, "20.00", Currency.EUR),
				line(14, Reason.MEMBERSHIP, SEASON, "-10.00", Currency.EUR));

		assertThat(reversalOf(book)).contains(reversal("10.00"));
		assertThat(ReversingAMembership.whatItTook(book, SEASON, Currency.EUR))
				.isEqualTo(new Balance.Money(new BigDecimal("10.00"), Currency.EUR));
	}

	/** And a credit reversed earlier is not the spend of the pass that stands. */
	@Test
	void aCreditReversedEarlierIsNotPartOfThePassThatStands() {
		List<BookLine> book = withTheRestOfHisBook(
				line(10, Reason.OVERPAYMENT, SEASON, "5.00", Currency.EUR),
				line(11, Reason.REVERSAL, SEASON, "-5.00", Currency.EUR),
				line(12, Reason.MEMBERSHIP, SEASON, "-20.00", Currency.EUR));

		assertThat(reversalOf(book)).contains(reversal("20.00"));
		assertThat(ReversingAMembership.whatItTook(book, SEASON, Currency.EUR))
				.isEqualTo(new Balance.Money(new BigDecimal("20.00"), Currency.EUR));
	}

	@Test
	void aSeasonAlreadyReversedHoldsNothing() {
		assertThat(reversalOf(withTheRestOfHisBook(
				line(10, Reason.MEMBERSHIP, SEASON, "-30.00", Currency.EUR),
				line(11, Reason.REVERSAL, SEASON, "30.00", Currency.EUR)))).isEmpty();
	}

	/**
	 * THE ORDER IS THE KEY, NOT THE ORDER THE LIST ARRIVED IN. The same three lines as the cycle above,
	 * handed over newest first: the reversal is still not the last line written.
	 */
	@Test
	void theOrderIsTheOrderTheLinesWereWritten() {
		List<BookLine> book = List.of(
				line(12, Reason.MEMBERSHIP, SEASON, "-20.00", Currency.EUR),
				line(11, Reason.REVERSAL, SEASON, "30.00", Currency.EUR),
				line(10, Reason.MEMBERSHIP, SEASON, "-30.00", Currency.EUR));

		assertThat(reversalOf(book)).contains(reversal("20.00"));
	}

	/**
	 * PAID IN DINARS PARTLY FROM THE BALANCE, MOVED ABROAD, THEN CANCELLED. The reversal is in his
	 * money of today, translated as a change of country translates (my derivation from PDL 26, the one
	 * rule for moving a balance between currencies; not a decision of the owner's).
	 */
	@Test
	void paidInDinarsPartlyFromTheBalanceMovedAbroadThenCancelled() {
		List<BookLine> book = List.of(
				line(1, Reason.REFERRAL, null, "1200.00", Currency.RSD),
				line(2, Reason.MEMBERSHIP, SEASON, "-600.00", Currency.RSD),
				line(3, Reason.CONVERSION, null, "-600.00", Currency.RSD),
				line(4, Reason.CONVERSION, null, "5.00", Currency.EUR));

		assertThat(reversalOf(book)).contains(reversal("5.00"));
		assertThat(ReversingAMembership.reversal(book, SEASON, Currency.RSD))
				.contains(new Reversal(new BigDecimal("600.00"), Currency.RSD));
	}

	/** And with the rounding a change of country uses: 500 dinars are 4.17 euro, both ways. */
	@Test
	void theRoundingIsTheRoundingOfAChangeOfCountry() {
		assertThat(reversalOf(List.of(line(2, Reason.MEMBERSHIP, SEASON, "-500.00", Currency.RSD))))
				.contains(reversal("4.17"));
		assertThat(reversalOf(List.of(line(2, Reason.OVERPAYMENT, SEASON, "500.00", Currency.RSD))))
				.contains(reversal("-4.17"));
	}

	/** What a membership took is said in the money it was written in, never restated. */
	@Test
	void whatItTookIsInTheMoneyTheSpendWasWrittenIn() {
		List<BookLine> book = withTheRestOfHisBook(line(10, Reason.MEMBERSHIP, SEASON, "-600.00", Currency.RSD));

		assertThat(ReversingAMembership.whatItTook(book, SEASON, Currency.EUR))
				.isEqualTo(new Balance.Money(new BigDecimal("600.00"), Currency.RSD));
	}

	@Test
	void whatItTookIsNothingInHisMoneyWhenItTookNothing() {
		List<BookLine> book = withTheRestOfHisBook(line(10, Reason.OVERPAYMENT, SEASON, "7.00", Currency.EUR));

		assertThat(ReversingAMembership.whatItTook(book, SEASON, Currency.RSD))
				.isEqualTo(Balance.Money.nothingIn(Currency.RSD));
	}

	@Test
	void twoMoneysInOnePassIsABookThePortalCannotWrite() {
		List<BookLine> book = List.of(
				line(10, Reason.MEMBERSHIP, SEASON, "-10.00", Currency.EUR),
				line(11, Reason.MEMBERSHIP, SEASON, "-600.00", Currency.RSD));

		assertThatThrownBy(() -> ReversingAMembership.whatItTook(book, SEASON, Currency.EUR))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("EUR and in RSD");
	}

	@Test
	void whatTheSeasonHoldsIsItsLinesAfterItsLastReversal() {
		BookLine standing = line(12, Reason.MEMBERSHIP, SEASON, "-20.00", Currency.EUR);

		assertThat(ReversingAMembership.whatTheSeasonHolds(withTheRestOfHisBook(
				line(10, Reason.MEMBERSHIP, SEASON, "-30.00", Currency.EUR),
				line(11, Reason.REVERSAL, SEASON, "30.00", Currency.EUR),
				standing), SEASON)).containsExactly(standing);
	}

	@Test
	void aReversalOfNothingIsNotALine() {
		assertThatThrownBy(() -> new Reversal(BigDecimal.ZERO, Currency.EUR))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> new Reversal(null, Currency.EUR)).isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Reversal(BigDecimal.ONE, null)).isInstanceOf(NullPointerException.class);
	}

	@Test
	void nothingIsAskedOfNothing() {
		assertThatThrownBy(() -> ReversingAMembership.whatTheSeasonHolds(null, SEASON))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> ReversingAMembership.reversal(List.of(), SEASON, null))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> ReversingAMembership.whatItTook(List.of(), SEASON, null))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new BookLine(1, null, null, BigDecimal.ONE, Currency.EUR))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new BookLine(1, Reason.REFERRAL, null, null, Currency.EUR))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new BookLine(1, Reason.REFERRAL, null, BigDecimal.ONE, null))
				.isInstanceOf(NullPointerException.class);
	}

	@ParameterizedTest
	@EnumSource(Reason.class)
	void everyReasonIsReadBackFromItsWord(Reason reason) {
		assertThat(Reason.of(reason.word())).isEqualTo(reason);
	}

	@Test
	void aWordNoReasonHasIsRefused() {
		assertThatThrownBy(() -> Reason.of("goodwill")).isInstanceOf(IllegalArgumentException.class);
	}
}

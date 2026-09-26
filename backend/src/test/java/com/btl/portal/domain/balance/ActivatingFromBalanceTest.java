package com.btl.portal.domain.balance;

import com.btl.portal.domain.member.MemberNumber;
import com.btl.portal.domain.payment.RecordingAPayment;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE FIVE ANSWERS TO A MEMBER ASKING TO BE LET IN ON HIS OWN BALANCE.
 *
 * <p>Each of the five is reached by a fixture that differs from the others in ONE fact, so an
 * outcome returned for the wrong reason shows up as the wrong outcome rather than coinciding with
 * the right one.
 */
class ActivatingFromBalanceTest {

	private static final MemberNumber HE_HAS_ONE = new MemberNumber("001234");

	private static Balance.Settlement covered() {
		return Balance.against(fee(), new Balance.Money(new BigDecimal("40"), new BigDecimal("4800")));
	}

	private static Balance.Settlement short_() {
		return Balance.against(fee(), new Balance.Money(new BigDecimal("30"), new BigDecimal("3600")));
	}

	private static Balance.Money fee() {
		return new Balance.Money(new BigDecimal("35.00"), new BigDecimal("4200.00"));
	}

	private static ActivatingFromBalance.Asking asking(boolean alreadyAMember, boolean exempt,
			Balance.Settlement balance, MemberNumber number) {
		return new ActivatingFromBalance.Asking(alreadyAMember, exempt, balance, number);
	}

	/**
	 * A FIRST TIME MEMBER WHOSE BALANCE COVERS IT IS LET IN AND NUMBERED.
	 *
	 * <p>The owner, 26.09.2026: „clanstvo se aktivira iz balansa". He carries no number, which is
	 * what PDL P8 says about somebody who has never paid, so this is the only outcome this fixture
	 * can reach.
	 */
	@Test
	void aFirstTimeMemberWhoseBalanceCoversItIsLetInAndNumbered() {
		assertThat(ActivatingFromBalance.decide(asking(false, false, covered(), null)))
				.isEqualTo(ActivatingFromBalance.Outcome.ACTIVATE_AND_NUMBER_HIM);
	}

	/**
	 * AND SOMEBODY COMING BACK KEEPS THE NUMBER HE HAS.
	 *
	 * <p>PDL P8: re-activation „vraca isti broj i isti profil, ne pravi nov". The ONLY difference
	 * from the case above is the number, so the two together say that the number is what decides
	 * between them and nothing else is.
	 */
	@Test
	void aReturningMemberIsLetInWithoutANewNumber() {
		assertThat(ActivatingFromBalance.decide(asking(false, false, covered(), HE_HAS_ONE)))
				.isEqualTo(ActivatingFromBalance.Outcome.ACTIVATE);
	}

	/**
	 * A SHORT BALANCE IS REFUSED, BECAUSE THE INVOICE IS THE WAY IN FOR HIM.
	 *
	 * <p>„QR se kuje na iznos minus balans" is the other half of the same day's decision and it goes
	 * through the payments route. The only difference from the two cases above is the balance.
	 */
	@Test
	void aShortBalanceIsRefusedAndSentToTheInvoice() {
		assertThat(ActivatingFromBalance.decide(asking(false, false, short_(), null)))
				.isEqualTo(ActivatingFromBalance.Outcome.THE_BALANCE_IS_NOT_ENOUGH);

		assertThat(ActivatingFromBalance.decide(asking(false, false, short_(), HE_HAS_ONE)))
				.as("the number decided this instead of the balance")
				.isEqualTo(ActivatingFromBalance.Outcome.THE_BALANCE_IS_NOT_ENOUGH);
	}

	/**
	 * A MEMBER FREED OF THE FEE IS REFUSED, AND HIS BALANCE IS NOT THE REASON.
	 *
	 * <p>He owes nothing, so there is nothing to take a balance off, and PDL 11.08.2026 - „Balans ne
	 * propada nikad i prenosi se iz sezone u sezonu" - is what makes refusing him safe: it waits for
	 * a season in which he is not exempt.
	 *
	 * <p><b>Asked with a balance that COVERS the fee</b>, on purpose. Asked with a short one, the
	 * same answer would come out of the balance clause and this case would be measuring that instead.
	 */
	@Test
	void aMemberFreedOfTheFeeIsRefusedEvenWhenHisBalanceWouldCoverIt() {
		assertThat(ActivatingFromBalance.decide(asking(false, true, covered(), null)))
				.isEqualTo(ActivatingFromBalance.Outcome.HE_OWES_NOTHING);
	}

	/**
	 * AND A MEMBER OF THIS SEASON ALREADY IS TOLD THAT, NOT SOMETHING ELSE.
	 *
	 * <p>Without this the row would collide with {@code membership_pk} (V22) and the member would be
	 * answered 500. {@code PaymentApi} lists this state as one it leaves unguarded because nothing
	 * could reach it; this class is what reaches it.
	 *
	 * <p><b>Asked with every other fact pointing at a different answer</b> - exempt AND short - so
	 * that the season is proved to be judged first rather than by luck of ordering.
	 */
	@Test
	void amemberOfThisSeasonAlreadyIsToldThatAndNotWhyElseHeMightBeRefused() {
		assertThat(ActivatingFromBalance.decide(asking(true, true, short_(), HE_HAS_ONE)))
				.isEqualTo(ActivatingFromBalance.Outcome.ALREADY_A_MEMBER);

		assertThat(ActivatingFromBalance.decide(asking(true, false, covered(), null)))
				.isEqualTo(ActivatingFromBalance.Outcome.ALREADY_A_MEMBER);
	}

	/**
	 * THE NUMBER RULE IS THE ONE THE PAYMENTS ROUTE USES, AND THIS IS WHAT KEEPS THEM ONE.
	 *
	 * <p>„A number is handed out once and then never again to the same person" is
	 * {@link RecordingAPayment}'s sentence and this class deliberately does not restate it. What
	 * stops the two drifting is not a paragraph but this case: both classes are asked the same
	 * question for BOTH states of „has a number", and the day one of them changes its mind this
	 * fails.
	 *
	 * <p>{@link RecordingAPayment} is asked with a payment that is merely awaited, which is its own
	 * „nothing has been recorded yet" - the same position a member activating out of his balance is
	 * in.
	 */
	@Test
	void theNumberRuleIsTheSameRuleThePaymentRouteUses() {
		for (MemberNumber number : new MemberNumber[] {null, HE_HAS_ONE}) {
			boolean theBookNumbersHim = ActivatingFromBalance.decide(asking(false, false, covered(), number))
					== ActivatingFromBalance.Outcome.ACTIVATE_AND_NUMBER_HIM;

			boolean thePaymentNumbersHim = RecordingAPayment.decide(
					new RecordingAPayment.Payment(RecordingAPayment.AWAITED, number))
					== RecordingAPayment.Outcome.RECORD_IT_AND_NUMBER_HIM;

			assertThat(theBookNumbersHim)
					.as("the two doors onto this portal disagree about handing out a member number,"
							+ " for somebody whose number is %s", number)
					.isEqualTo(thePaymentNumbersHim);
		}
	}

	/** Neither half of the question may be missing, because a decision on nothing is not one. */
	@Test
	void aDecisionIsRefusedWithoutTheFactsItTurnsOn() {
		assertThatThrownBy(() -> ActivatingFromBalance.decide(null))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("asking");

		assertThatThrownBy(() -> asking(false, false, null, null))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("balance");
	}
}

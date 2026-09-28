package com.btl.portal.domain.balance;

import com.btl.portal.domain.member.MemberNumber;
import com.btl.portal.domain.pricing.Currency;
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
		return Balance.against(fee(), dinars("4800"));
	}

	private static Balance.Settlement short_() {
		return Balance.against(fee(), dinars("3600"));
	}

	private static Balance.Money fee() {
		return dinars("4200.00");
	}

	/**
	 * EVERY AMOUNT IN THIS FILE IS IN DINARS, and that is deliberate rather than arbitrary.
	 *
	 * <p>Since V42 a {@link Balance.Money} is one amount and one money (owner, 27.09.2026, PDL 25), so
	 * the cheapest mistake anybody can make is to read one money against another - at the seeded rate of
	 * 120 that is wrong by two orders of magnitude and still perfectly ordinary arithmetic. Dinars are
	 * the side where such a mistake is LARGE, so it is the side these cases are written on.
	 */
	private static Balance.Money dinars(String amount) {
		return new Balance.Money(new BigDecimal(amount), Currency.RSD);
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
	 * AND A MEMBERSHIP THE PRICE LIST SAYS IS WORTH NOTHING IS REFUSED FOR THE SAME REASON, which is
	 * a second ROAD to one answer rather than a second answer.
	 *
	 * <p><b>The road is an administrator and not the member.</b> {@code price_row_eur_not_negative}
	 * (V4) lets a row be nought and {@code PUT /api/pricing/{key}} has no lower bound - it refuses a
	 * negative price and one above what a row may cost, and nothing in between - so one edit of the
	 * period row through his own screen is all it takes. Without this the balance covers the fee by
	 * {@code 0 >= 0}, the route reaches the book, and
	 * {@code balance_entry_a_membership_takes} (V38) refuses an entry that moves nothing: EVERY member
	 * on the portal is answered 500. The floor under that constraint's half of it is
	 * {@code BalanceConstraintsTest}, which writes the nought row and watches PostgreSQL refuse it.
	 *
	 * <p><b>HE IS NOT EXEMPT AND HIS BOOK IS NOT EMPTY, and both halves of that are the case rather
	 * than the fixture being tidy.</b> Exempt reaches this same outcome one clause earlier, so an
	 * exempt member here would be measuring that clause; and a fee of nought is covered by an EMPTY
	 * book just as well as by a full one, so a member with nothing would leave „covered" satisfied by
	 * two things at once. He is therefore an ordinary member with money in his book, and the only
	 * thing odd about him is the price of the season.
	 */
	@Test
	void afeeOfNothingIsRefusedForTheSameReasonAndHeIsNeitherExemptNorEmpty() {
		Balance.Settlement nothingToPay = Balance.against(Balance.Money.nothingIn(Currency.RSD),
				dinars("4800"));

		assertThat(nothingToPay.coveredByTheBalance())
				.as("a fee of nothing is not covered, so this case cannot be about a fee of nothing")
				.isTrue();

		assertThat(ActivatingFromBalance.decide(asking(false, false, nothingToPay, HE_HAS_ONE)))
				.isEqualTo(ActivatingFromBalance.Outcome.HE_OWES_NOTHING);

		assertThat(ActivatingFromBalance.decide(asking(false, false, nothingToPay, null)))
				.as("having never been numbered is not a way past a fee of nothing")
				.isEqualTo(ActivatingFromBalance.Outcome.HE_OWES_NOTHING);

		/* AND THE FEE IS WHAT DECIDES IT, NOT THE BALANCE THAT MET IT. The same empty fee against an
		   empty book answers the same, which is the one substitution that would pass if the guard had
		   been written over the balance instead. */
		assertThat(ActivatingFromBalance.decide(asking(false, false,
				Balance.against(Balance.Money.nothingIn(Currency.RSD),
						Balance.Money.nothingIn(Currency.RSD)), HE_HAS_ONE)))
				.isEqualTo(ActivatingFromBalance.Outcome.HE_OWES_NOTHING);

		/* And a fee that IS money is untouched by this clause, so it refuses a price and not a
		   member. */
		assertThat(ActivatingFromBalance.decide(asking(false, false, covered(), HE_HAS_ONE)))
				.isEqualTo(ActivatingFromBalance.Outcome.ACTIVATE);
	}

	/**
	 * AND A MEMBER OF THIS SEASON ALREADY IS TOLD THAT, NOT SOMETHING ELSE.
	 *
	 * <p>Without this the row would collide with {@code membership_pk} (V22) and the member would be
	 * answered 500. {@code PaymentApi} lists this state as one it leaves unguarded because nothing
	 * could reach it; this class is what reaches it.
	 *
	 * <p><b>Asked with the MONEY pointing at a different answer, in both directions</b> - once short and
	 * once covering - so that the season is proved to be judged ahead of the balance rather than by
	 * luck of ordering.
	 *
	 * <p><b>And asked of a member who is NOT exempt, which is the one fact that may not be added
	 * here.</b> Since 27.09.2026 an exemption is a {@code membership} row for one season (the owner:
	 * „red u {@code membership} postoji za svaku sezonu posebno"), so „exempt" and „already a member"
	 * are no longer independent - the first implies the second, and the first is judged first. A member
	 * carrying both therefore belongs to {@code anexemptionIsJudgedAheadOfTheBareMembershipItImplies}
	 * and asserting {@code ALREADY_A_MEMBER} of him is what this case used to do.
	 */
	@Test
	void amemberOfThisSeasonAlreadyIsToldThatAndNotWhyElseHeMightBeRefused() {
		assertThat(ActivatingFromBalance.decide(asking(true, false, short_(), HE_HAS_ONE)))
				.isEqualTo(ActivatingFromBalance.Outcome.ALREADY_A_MEMBER);

		assertThat(ActivatingFromBalance.decide(asking(true, false, covered(), null)))
				.isEqualTo(ActivatingFromBalance.Outcome.ALREADY_A_MEMBER);
	}

	/**
	 * AND WHEN BOTH ARE TRUE THE ANSWER NAMES THE REASON, NOT THE BARE FACT.
	 *
	 * <p><b>This is the one case that pins the ORDER, and the order carries weight it did not carry
	 * before.</b> Until 27.09.2026 being freed of the fee was read off {@code
	 * competitor.membership_basis}, a column standing per PERSON, so the two facts were independent and
	 * either could be true without the other. The owner then settled that an exemption is granted „jednu
	 * po jednu godinu" and lives in {@code membership.basis} - which makes every exempt member a member
	 * of that season by construction. From that day the two clauses overlap completely in one direction.
	 *
	 * <p><b>Two things follow and both are measured here.</b> A member who owes nothing is told so,
	 * which is more use to him than „that season is taken"; and {@link
	 * ActivatingFromBalance.Outcome#HE_OWES_NOTHING} keeps a road from the exemption at all. Asked the
	 * other way round, {@code alreadyAMember} would answer for every exempt member and this outcome
	 * would be reachable from the route by ONE road only, a fee of nothing - a branch production cannot
	 * enter, which no coverage threshold in this portal can see because this very file enters it
	 * directly.
	 *
	 * <p><b>Asked with the balance in both states</b>, so the answer is proved to come from the
	 * exemption and not from the money.
	 */
	@Test
	void anexemptionIsJudgedAheadOfTheBareMembershipItImplies() {
		assertThat(ActivatingFromBalance.decide(asking(true, true, short_(), HE_HAS_ONE)))
				.as("he was told the season is taken, which says nothing about a fee he does not owe")
				.isEqualTo(ActivatingFromBalance.Outcome.HE_OWES_NOTHING);

		assertThat(ActivatingFromBalance.decide(asking(true, true, covered(), null)))
				.isEqualTo(ActivatingFromBalance.Outcome.HE_OWES_NOTHING);
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

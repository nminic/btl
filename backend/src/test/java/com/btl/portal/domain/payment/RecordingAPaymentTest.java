package com.btl.portal.domain.payment;

import com.btl.portal.domain.member.MemberNumber;
import com.btl.portal.domain.payment.RecordingAPayment.Outcome;
import com.btl.portal.domain.payment.RecordingAPayment.Payment;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** What recording a payment does, and the one thing it hands out. */
class RecordingAPaymentTest {

	private static final MemberNumber ALREADY_A_MEMBER = MemberNumber.of(1000);

	/**
	 * SOMEBODY WHO HAS NEVER PAID GETS A NUMBER, and somebody who has does not.
	 *
	 * <p>The two differ in NOTHING but the number, same state and same everything
	 * else, so the outcome cannot be coming from anywhere but the number. Written
	 * the other way round, both cases would still pass with the state deciding.
	 */
	@Test
	void aNumberIsHandedOutWhenAndOnlyWhenThereIsNone() {
		assertThat(RecordingAPayment.decide(new Payment(RecordingAPayment.AWAITED, null)))
				.isEqualTo(Outcome.RECORD_IT_AND_NUMBER_HIM);

		assertThat(RecordingAPayment.decide(new Payment(RecordingAPayment.AWAITED, ALREADY_A_MEMBER)))
				.as("a member paying for his second season was handed a second number")
				.isEqualTo(Outcome.RECORD_IT);
	}

	/**
	 * THE SAME MONEY IS NOT RECORDED TWICE.
	 *
	 * <p>A bank statement is reconciled in bulk and the same file can be imported
	 * again. The case with no number is the one that matters: were the state not
	 * looked at first, a second pass would read "no number" and hand out another,
	 * and since the sequence only counts up the first would be gone for good.
	 */
	@Test
	void moneySomebodyHasAlreadyRecordedIsNotRecordedAgain() {
		assertThat(RecordingAPayment.decide(new Payment(RecordingAPayment.RECORDED, ALREADY_A_MEMBER)))
				.isEqualTo(Outcome.ALREADY_RECORDED);

		assertThat(RecordingAPayment.decide(new Payment(RecordingAPayment.RECORDED, null)))
				.as("a second pass over the same statement handed out a second number")
				.isEqualTo(Outcome.ALREADY_RECORDED);
	}

	/**
	 * A REVERSAL IS NOT TURNED BACK BY AN IMPORT.
	 *
	 * <p>Both ways round, because the number is not what decides it: a reversal
	 * stands whether the person has a number or not.
	 */
	@Test
	void aReversalWaitsForAPerson() {
		assertThat(RecordingAPayment.decide(new Payment(RecordingAPayment.REVERSED, ALREADY_A_MEMBER)))
				.isEqualTo(Outcome.A_REVERSAL_IS_NOT_UNDONE_HERE);

		assertThat(RecordingAPayment.decide(new Payment(RecordingAPayment.REVERSED, null)))
				.as("a reversal was quietly turned back into a payment")
				.isEqualTo(Outcome.A_REVERSAL_IS_NOT_UNDONE_HERE);
	}

	/** Every state the class knows leads somewhere, and to somewhere different. */
	@Test
	void eachOfTheThreeStatesHasItsOwnAnswer() {
		assertThat(RecordingAPayment.STATES.stream()
				.map(state -> RecordingAPayment.decide(new Payment(state, null)))
				.collect(Collectors.toSet()))
				.as("two states were answered the same way, so one of them is not being looked at")
				.hasSize(RecordingAPayment.STATES.size());
	}

	/** And every outcome the class offers is reachable, or it is a word and not a state. */
	@Test
	void everyOutcomeCanActuallyHappen() {
		assertThat(RecordingAPayment.STATES.stream()
				.flatMap(state -> java.util.stream.Stream.of(
						RecordingAPayment.decide(new Payment(state, null)),
						RecordingAPayment.decide(new Payment(state, ALREADY_A_MEMBER))))
				.collect(Collectors.toSet()))
				.as("an outcome is named that nothing can produce")
				.containsExactlyInAnyOrderElementsOf(Arrays.asList(Outcome.values()));
	}

	/**
	 * A STATE THE TABLE CANNOT HOLD IS REFUSED WHERE IT IS READ, not carried
	 * further.
	 *
	 * <p>The schema says the same thing in {@code payment_state_known}. Reaching
	 * here with anything else means a row was read from somewhere that is not this
	 * table, and answering it with a default would be answering a question nobody
	 * asked.
	 */
	@Test
	void aStateNoPaymentCanBeInIsRefused() {
		assertThatThrownBy(() -> new Payment("settled", null))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("settled");

		assertThatThrownBy(() -> new Payment(null, null))
				.isInstanceOf(NullPointerException.class)
				.hasMessage("state");

		assertThatThrownBy(() -> RecordingAPayment.decide(null))
				.isInstanceOf(NullPointerException.class)
				.hasMessage("payment");
	}
}

package com.btl.portal.domain.payment;

import com.btl.portal.domain.member.MemberNumber;

import java.util.Objects;
import java.util.Set;

/**
 * What happens the moment somebody says the money arrived.
 *
 * <p><b>This decides WHETHER a payment hands a member number out, which is not the
 * same as being the only thing that ever hands one out.</b> It read „and nowhere
 * else" until 27.09.2026, and that was true for as long as a fee was the only way to
 * become a member. PDL P8, 31.07.2026: „Clanski broj se dodeljuje automatski u
 * trenutku EVIDENTIRANJA UPLATE", and the consequence it draws itself, „registrovan a
 * neplacen clan nema clanski broj". So a person who registered and has not paid is a
 * row in {@code competitor} with no number, which is why V16 made that column
 * nullable, and all of that still holds of the payment path - a man in the queue has
 * no number until somebody says the money came.
 *
 * <p><b>What changed is the other ground.</b> PDL:760 makes the number a consequence
 * of the ACTIVATION rather than of the fee („evidentirana uplata ili [oslobodjenje],
 * cime clan dobija clanski broj"), and PDL:808 says of a member the association has
 * freed of the fee that he „ima clanski broj i pravo rangiranja". So the
 * administration freeing somebody of the fee hands one out too, without any payment
 * for this class to judge. The statement both grounds share is
 * {@code MemberNumbers}.
 *
 * <p><b>A number is handed out once and then never again to the same person.</b>
 * Somebody paying for his second season already has one and keeps it; so does
 * somebody coming back after years away, because PDL P8 says re-activation
 * „vraca isti broj i isti profil, ne pravi nov". The two cases are one rule and
 * this class states it as one: a number is handed out when, and only when, there
 * is none.
 *
 * <p><b>Recording the same payment twice must be harmless.</b> A bank statement
 * is reconciled in bulk and the same file can be imported twice; were a second
 * pass to take the first pass's work as fresh it would hand out a second number
 * to somebody who has one, and the sequence only counts up, so the first one
 * would be gone for good.
 *
 * <p><b>THERE IS NO THIRD STATE, AND THERE WAS ONE UNTIL 18.10.2026.</b> A payment used to
 * be able to stand as {@code reversed}, and this class refused to book over it, because
 * „Stornirana uplata: clanski broj propada, clan postaje neaktivan za tu sezonu" (PDL P8,
 * 11.08.2026) was taken to be a thing that HAPPENED and had to stay said on the row. The
 * owner overturned that on 18.10.2026 (PDL P8, the section „Osnov clanstva ima jedan dom"),
 * choosing between the outcomes put to him and against the recommendation: „Kad se osnov
 * promeni iz „uplata” ili se uplata stornira, zapis o uplati se BRISE." And with it, with the
 * recommendation: the refusal „Storno vraca covek, van ovog ekrana." is deleted „zajedno sa
 * stanjem „stornirana uplata” koje je pisalo". So a cancelled payment leaves no row behind,
 * the trail of a cancellation has a table of its own ({@code membership_change}, V63), V64 takes the word
 * out of {@code payment_state_known}, and the outcome that refused it went with it. The
 * member number is not touched by any of that: it stays his (PDL P8, 14.09.2026, „Posle
 * storna clanski broj ostaje rezervisan za istog coveka i vraca mu se kad ponovo plati"),
 * which is the {@link Outcome#RECORD_IT} a renewal already takes.
 */
public final class RecordingAPayment {

	/** Waiting for somebody to say the money arrived. */
	public static final String AWAITED = "awaited";

	/** Somebody said it, and said who and when. */
	public static final String RECORDED = "recorded";

	/**
	 * The two, and the schema knows the same two.
	 *
	 * <p>{@code payment_state_known} is where they are enforced, and
	 * {@code PaymentStatesMatchTheSchemaTest} is what keeps this list and that
	 * constraint from drifting apart: it asks PostgreSQL what the constraint
	 * actually says rather than comparing one written pattern against another.
	 */
	public static final Set<String> STATES = Set.of(AWAITED, RECORDED);

	private RecordingAPayment() {
	}

	/**
	 * A payment as the table holds it, reduced to the two things this decision
	 * turns on.
	 *
	 * @param state              one of {@link #STATES}
	 * @param numberHeAlreadyHas his member number, or {@code null} if he has never
	 *                           had one
	 */
	public record Payment(String state, MemberNumber numberHeAlreadyHas) {

		public Payment {
			Objects.requireNonNull(state, "state");

			if (!STATES.contains(state)) {
				throw new IllegalArgumentException("'" + state + "' is not a state a payment can be in");
			}
		}
	}

	/** What the server does next, and the three are three different things. */
	public enum Outcome {

		/** Write it down, and give him the number he has never had. */
		RECORD_IT_AND_NUMBER_HIM,

		/** Write it down. He is a member already and keeps the number he has. */
		RECORD_IT,

		/** Nothing. Somebody already said this money arrived. */
		ALREADY_RECORDED
	}

	/**
	 * Judged on the state first and the number second, because a payment that is
	 * not waiting is not recorded whatever number the person has.
	 */
	public static Outcome decide(Payment payment) {
		Objects.requireNonNull(payment, "payment");

		return switch (payment.state()) {
			case RECORDED -> Outcome.ALREADY_RECORDED;
			default -> payment.numberHeAlreadyHas() == null
					? Outcome.RECORD_IT_AND_NUMBER_HIM
					: Outcome.RECORD_IT;
		};
	}
}

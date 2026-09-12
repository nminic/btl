package com.btl.portal.domain.payment;

import com.btl.portal.domain.member.MemberNumber;

import java.util.Objects;
import java.util.Set;

/**
 * What happens the moment somebody says the money arrived.
 *
 * <p><b>This is where a member number comes from, and nowhere else.</b> PDL P8,
 * 31.07.2026: „Clanski broj se dodeljuje automatski u trenutku EVIDENTIRANJA
 * UPLATE", and the consequence it draws itself, „registrovan a neplacen clan nema
 * clanski broj". So a person who registered and has not paid is a row in
 * {@code competitor} with no number, which is why V16 made that column nullable.
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
 * <p><b>A reversal is not undone here, and that is a decision with a cost.</b>
 * „Stornirana uplata: clanski broj propada, clan postaje neaktivan za tu sezonu"
 * (PDL P8, 11.08.2026) leaves that person, for that season, in the position of
 * somebody who never paid - and somebody who never paid may pay. But the schema
 * allows one payment per member per season ({@code payment_one_a_season}), so
 * paying again would have to be written over the reversed row, and the reversal
 * would stop having happened. A reversal is the one thing on this table that the
 * portal has to be able to say out loud. So this class refuses to do it quietly
 * and hands the case to a person, which is what P8 already asks for wherever
 * money does not line up: „uplata bez poziva na broj uvek trazi coveka".
 */
public final class RecordingAPayment {

	/** Waiting for somebody to say the money arrived. */
	public static final String AWAITED = "awaited";

	/** Somebody said it, and said who and when. */
	public static final String RECORDED = "recorded";

	/** It arrived and then went back. Its own state, because it HAPPENED. */
	public static final String REVERSED = "reversed";

	/**
	 * The three, and the schema knows the same three.
	 *
	 * <p>{@code payment_state_known} is where they are enforced, and
	 * {@code PaymentStatesMatchTheSchemaTest} is what keeps this list and that
	 * constraint from drifting apart: it asks PostgreSQL what the constraint
	 * actually says rather than comparing one written pattern against another.
	 */
	public static final Set<String> STATES = Set.of(AWAITED, RECORDED, REVERSED);

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

	/** What the server does next, and the four are four different things. */
	public enum Outcome {

		/** Write it down, and give him the number he has never had. */
		RECORD_IT_AND_NUMBER_HIM,

		/** Write it down. He is a member already and keeps the number he has. */
		RECORD_IT,

		/** Nothing. Somebody already said this money arrived. */
		ALREADY_RECORDED,

		/** Nothing automatic. A reversal is turned back by a person, not by an import. */
		A_REVERSAL_IS_NOT_UNDONE_HERE
	}

	/**
	 * Judged on the state first and the number second, because a payment that is
	 * not waiting is not recorded whatever number the person has.
	 */
	public static Outcome decide(Payment payment) {
		Objects.requireNonNull(payment, "payment");

		return switch (payment.state()) {
			case RECORDED -> Outcome.ALREADY_RECORDED;
			case REVERSED -> Outcome.A_REVERSAL_IS_NOT_UNDONE_HERE;
			default -> payment.numberHeAlreadyHas() == null
					? Outcome.RECORD_IT_AND_NUMBER_HIM
					: Outcome.RECORD_IT;
		};
	}
}

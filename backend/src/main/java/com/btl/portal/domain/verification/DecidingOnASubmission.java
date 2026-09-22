package com.btl.portal.domain.verification;

import java.util.Objects;
import java.util.Set;

/**
 * WHAT HAPPENS WHEN A MODERATOR ANSWERS SOMETHING IN A QUEUE.
 *
 * <p>Every queue on the portal is the same table and the same three states, and
 * this is the one place that says how a row moves between them. A result, a
 * comment, a photograph and a proposed team all arrive here, and the differences
 * between them are what the queue is called, not what a decision does - WITH ONE
 * NAMED EXCEPTION, below, and it is the only fact a {@link Submission} carries
 * beside its state.
 *
 * <p><b>A refusal carries its reason and an approval carries none, on five of the
 * six queues.</b> PDL P21, under „Razlog odbijanja": „obavezan razlog stoji na
 * svakom odbijanju, jer se sve odbijeno vraca clanu", and the moderator is asked
 * for a precise instruction rather than „ne valja". A refusal nobody can answer
 * is a decision nobody can appeal. There is nothing to explain about a yes, and a
 * reason beside one is a note nobody reads - which is why the schema does not
 * merely allow the absence but requires it.
 *
 * <p><b>THE SIXTH IS COMMENTS, AND ITS REFUSAL CARRIES NO OBLIGATION AT ALL</b>
 * (owner, ADL A64, 22.09.2026). PDL 3267 and 4255, the same sentence twice: „Jedini
 * red bez njega je red komentara, gde se ne odbija nego brise, a napomena je
 * neobavezna i namenjena moderatorima" - a note where there is one is a trace for
 * a moderator, never a reason the member is owed, so nothing here may refuse a
 * comments answer for want of one. {@link Submission#reasonIsOptional} is that
 * one fact, and the caller says it rather than this class guessing it from a
 * queue name this class has never otherwise needed to know.
 *
 * <p>Cited by section and by its own words rather than by a line number: PDL
 * says of itself that a copied number is one more place that drifts from the
 * truth, and this sentence had already moved two hundred and seventy four lines
 * away from the number first written here.
 *
 * <p><b>Deciding twice is not deciding.</b> A queue is a list two moderators can
 * have open at once, and a second answer arriving after the first must not
 * overwrite who decided or when. It is refused here rather than at the row,
 * because the row would refuse it with a constraint violation, and that reaches
 * a moderator as a server fault instead of "somebody got there first".
 *
 * <p><b>What is NOT here is what an approval means.</b> An approved result of a
 * race nobody had entered puts that race in the calendar (V10); an approved
 * comment appears under an event. Those are the caller's, and they differ per
 * queue; this says only whether the answer may be recorded and what the row
 * becomes.
 */
public final class DecidingOnASubmission {

	/** Nobody has answered it yet. */
	public static final String WAITING = "waiting";

	/** Somebody said yes. */
	public static final String APPROVED = "approved";

	/** Somebody said no, and said why. */
	public static final String REJECTED = "rejected";

	/**
	 * The three, and the schema knows the same three.
	 *
	 * <p>{@code verification_state_known} is where they are enforced and
	 * {@code VerificationStatesMatchTheSchemaTest} is what keeps this list and that
	 * constraint from drifting: it asks PostgreSQL what the rule actually says
	 * rather than comparing one written pattern with another.
	 */
	public static final Set<String> STATES = Set.of(WAITING, APPROVED, REJECTED);

	private DecidingOnASubmission() {
	}

	/**
	 * A row in a queue, reduced to the two things this decision turns on.
	 *
	 * @param reasonIsOptional whether a refusal of THIS row may go without a reason - true for
	 *                         the comments queue and false for the other five (ADL A64). The
	 *                         caller says which, because that is a fact about the QUEUE and
	 *                         this class has never otherwise had to know one.
	 */
	public record Submission(String state, boolean reasonIsOptional) {

		public Submission {
			Objects.requireNonNull(state, "state");

			if (!STATES.contains(state)) {
				throw new IllegalArgumentException("'" + state + "' is not a state a submission can be in");
			}
		}

		/** The five queues where a refusal is never optional. */
		public Submission(String state) {
			this(state, false);
		}
	}

	/**
	 * What the moderator said.
	 *
	 * @param yes    whether he approved it
	 * @param reason what he typed in the box, which only a refusal uses
	 */
	public record Answer(boolean yes, String reason) {
	}

	/** What the server does next. */
	public enum Outcome {

		/** Write it down as approved, and the reason box is not kept. */
		APPROVE_IT,

		/** Write it down as refused, with the reason the member will read. */
		REJECT_IT,

		/** Nothing. A refusal with nothing in the box is one nobody can answer. */
		A_REFUSAL_NEEDS_A_REASON,

		/** Nothing. Somebody answered this before him. */
		ALREADY_DECIDED
	}

	/**
	 * Judged on the state first, because an answer to something already answered
	 * is not an answer whatever it says.
	 */
	public static Outcome decide(Submission submission, Answer answer) {
		Objects.requireNonNull(submission, "submission");
		Objects.requireNonNull(answer, "answer");

		if (!WAITING.equals(submission.state())) {
			return Outcome.ALREADY_DECIDED;
		}

		if (answer.yes()) {
			return Outcome.APPROVE_IT;
		}

		return submission.reasonIsOptional() || !blank(answer.reason())
				? Outcome.REJECT_IT : Outcome.A_REFUSAL_NEEDS_A_REASON;
	}

	/**
	 * THE REASON AS IT GOES INTO THE ROW, which is not always the reason that was
	 * typed.
	 *
	 * <p>{@code verification_refusal_says_why} is a biconditional on five of the six queues:
	 * a refusal must carry a reason and an approval must carry none. A moderator who types
	 * something in the box, changes his mind and presses yes would otherwise have
	 * his note written beside an approval, and the row would be thrown out. So the
	 * class that judges the answer also says what to store, and nothing between
	 * the two is left to whoever writes the insert.
	 *
	 * <p><b>The sixth queue needs nothing extra here.</b> A blank box already comes back
	 * {@code null} whatever {@link Submission#reasonIsOptional} says - this method never reads
	 * that flag - and {@code verification_refusal_says_why}'s own exception for
	 * {@code queue = 'comments'} (ADL A64) accepts a rejected row with no reason exactly as
	 * readily as it accepts one with a moderator's trace on it. What changed is only whether
	 * {@link #decide} lets the answer through at all with the box empty.
	 *
	 * @return the reason for a refusal, and {@code null} for an approval
	 */
	public static String reasonAsItGoesIn(Answer answer) {
		Objects.requireNonNull(answer, "answer");

		return answer.yes() || blank(answer.reason()) ? null : answer.reason().strip();
	}

	/** Absent and whitespace are one thing here: both are a box nobody filled in. */
	private static boolean blank(String typed) {
		return typed == null || typed.isBlank();
	}
}

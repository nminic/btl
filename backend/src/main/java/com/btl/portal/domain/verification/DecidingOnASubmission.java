package com.btl.portal.domain.verification;

import java.util.Objects;
import java.util.Set;

/**
 * WHAT HAPPENS WHEN A MODERATOR ANSWERS SOMETHING IN A QUEUE.
 *
 * <p>Every queue on the portal is the same table and the same three states, and
 * this is the one place that says how a row moves between them. A result, a
 * comment, a photograph and a proposed team all arrive here, and the differences
 * between them are what the queue is called, not what a decision does.
 *
 * <p><b>A refusal carries its reason and an approval carries none.</b> PDL P21,
 * under „Razlog odbijanja": „obavezan razlog stoji na svakom odbijanju, jer se
 * sve odbijeno vraca clanu", and the moderator is asked for a precise
 * instruction rather than „ne valja". A refusal nobody can answer is a decision
 * nobody can appeal. There is nothing to explain about a yes, and a reason
 * beside one is a note nobody reads - which is why the schema does not merely
 * allow the absence but requires it.
 *
 * <p><b>And the one queue PDL exempts never reaches here.</b> The same sentence
 * goes on: „Jedini red bez njega je red komentara, gde se ne odbija nego brise,
 * a napomena je neobavezna i namenjena moderatorima." A comment is not refused,
 * it is removed, so it never becomes a row in the state this class would have to
 * put a reason on. Written down because it reads like a contradiction until
 * somebody notices that the exception is about a queue that does not produce
 * this outcome at all.
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

	/** A row in a queue, reduced to the one thing this decision turns on. */
	public record Submission(String state) {

		public Submission {
			Objects.requireNonNull(state, "state");

			if (!STATES.contains(state)) {
				throw new IllegalArgumentException("'" + state + "' is not a state a submission can be in");
			}
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

		return blank(answer.reason()) ? Outcome.A_REFUSAL_NEEDS_A_REASON : Outcome.REJECT_IT;
	}

	/**
	 * THE REASON AS IT GOES INTO THE ROW, which is not always the reason that was
	 * typed.
	 *
	 * <p>{@code verification_refusal_says_why} is a biconditional: a refusal must
	 * carry a reason and an approval must carry none. A moderator who types
	 * something in the box, changes his mind and presses yes would otherwise have
	 * his note written beside an approval, and the row would be thrown out. So the
	 * class that judges the answer also says what to store, and nothing between
	 * the two is left to whoever writes the insert.
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

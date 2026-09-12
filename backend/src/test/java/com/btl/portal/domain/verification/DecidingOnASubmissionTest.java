package com.btl.portal.domain.verification;

import com.btl.portal.domain.verification.DecidingOnASubmission.Answer;
import com.btl.portal.domain.verification.DecidingOnASubmission.Outcome;
import com.btl.portal.domain.verification.DecidingOnASubmission.Submission;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Arrays;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** What a moderator's answer does to a row in a queue. */
class DecidingOnASubmissionTest {

	private static final Submission WAITING = new Submission(DecidingOnASubmission.WAITING);

	private static final Answer YES = new Answer(true, "");

	private static final Answer NO = new Answer(false, "trka nije u kalendaru");

	/**
	 * A YES AND A NO, and the no carries what the member will read.
	 *
	 * <p>The two are here beside each other because the difference between them is
	 * the whole class: one answer is recorded with a reason and the other must not
	 * be.
	 */
	@Test
	void bothAnswersAreRecorded() {
		assertThat(DecidingOnASubmission.decide(WAITING, YES)).isEqualTo(Outcome.APPROVE_IT);
		assertThat(DecidingOnASubmission.decide(WAITING, NO)).isEqualTo(Outcome.REJECT_IT);
	}

	/**
	 * A REFUSAL WITH AN EMPTY BOX IS NOT A REFUSAL.
	 *
	 * <p>Blank and absent both, because a form posts an empty string where a script
	 * posts nothing, and because a moderator who deletes what he typed leaves
	 * spaces behind. The member has to be told why, and „because" is a decision
	 * nobody can answer.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "   ", "\n\t"})
	void aRefusalWithNothingInTheBoxIsRefused(String nothing) {
		assertThat(DecidingOnASubmission.decide(WAITING, new Answer(false, nothing)))
				.as("'%s' was accepted as a reason", nothing)
				.isEqualTo(Outcome.A_REFUSAL_NEEDS_A_REASON);

		assertThat(DecidingOnASubmission.decide(WAITING, new Answer(false, null)))
				.isEqualTo(Outcome.A_REFUSAL_NEEDS_A_REASON);
	}

	/**
	 * AND WHAT SOMEBODY ELSE ALREADY ANSWERED IS NOT ANSWERED AGAIN.
	 *
	 * <p>Both ways round, and both ways of answering, because a queue is a list two
	 * moderators can have open at once. The state is judged before the answer: a
	 * yes arriving after a no must not overwrite who decided or when, and neither
	 * must a no arriving after a yes.
	 */
	@Test
	void whatSomebodyAlreadyAnsweredIsLeftAlone() {
		for (String decided : new String[] {DecidingOnASubmission.APPROVED, DecidingOnASubmission.REJECTED}) {
			assertThat(DecidingOnASubmission.decide(new Submission(decided), YES))
					.as("a second yes overwrote a row already %s", decided)
					.isEqualTo(Outcome.ALREADY_DECIDED);
			assertThat(DecidingOnASubmission.decide(new Submission(decided), NO))
					.as("a second no overwrote a row already %s", decided)
					.isEqualTo(Outcome.ALREADY_DECIDED);
		}
	}

	/**
	 * WHAT GOES INTO THE ROW IS SAID HERE, not left to whoever writes the insert.
	 *
	 * <p>The middle case is the one this exists for: a moderator types something in
	 * the box, changes his mind and presses yes. Stored, his note would sit beside
	 * an approval and {@code verification_refusal_says_why} would throw the row
	 * out, which reaches him as a server fault rather than as a saved decision.
	 */
	@Test
	void theReasonThatGoesInIsNotAlwaysTheReasonThatWasTyped() {
		assertThat(DecidingOnASubmission.reasonAsItGoesIn(NO))
				.as("a refusal was stored without the reason the member has to read")
				.isEqualTo("trka nije u kalendaru");

		assertThat(DecidingOnASubmission.reasonAsItGoesIn(new Answer(true, "predomislio sam se")))
				.as("a note typed before a yes was stored beside the approval")
				.isNull();

		assertThat(DecidingOnASubmission.reasonAsItGoesIn(new Answer(false, "  razlog  ")))
				.as("the reason was stored with the space around it")
				.isEqualTo("razlog");

		assertThat(DecidingOnASubmission.reasonAsItGoesIn(new Answer(false, "   "))).isNull();
	}

	/** Every outcome the class offers is reachable, or it is a word and not a state. */
	@Test
	void everyOutcomeCanActuallyHappen() {
		assertThat(DecidingOnASubmission.STATES.stream()
				.flatMap(state -> Stream.of(YES, NO, new Answer(false, ""))
						.map(answer -> DecidingOnASubmission.decide(new Submission(state), answer)))
				.collect(Collectors.toSet()))
				.as("an outcome is named that nothing can produce")
				.containsExactlyInAnyOrderElementsOf(Arrays.asList(Outcome.values()));
	}

	/**
	 * A STATE THE TABLE CANNOT HOLD IS REFUSED WHERE IT IS READ.
	 *
	 * <p>Reaching here with anything else means a row was read from somewhere that
	 * is not this table, and answering it would be answering a question nobody
	 * asked.
	 */
	@Test
	void nothingMissingOrMadeUpIsQuietlyAccepted() {
		assertThatThrownBy(() -> new Submission("pending"))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("pending");
		assertThatThrownBy(() -> new Submission(null))
				.isInstanceOf(NullPointerException.class).hasMessage("state");
		assertThatThrownBy(() -> DecidingOnASubmission.decide(null, YES))
				.isInstanceOf(NullPointerException.class).hasMessage("submission");
		assertThatThrownBy(() -> DecidingOnASubmission.decide(WAITING, null))
				.isInstanceOf(NullPointerException.class).hasMessage("answer");
		assertThatThrownBy(() -> DecidingOnASubmission.reasonAsItGoesIn(null))
				.isInstanceOf(NullPointerException.class).hasMessage("answer");
	}
}

package com.btl.portal.domain.attempts;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The count itself, with the clock in the case's hand: below, at and above the allowance, before and
 * after the hour, one key and another, and the ceiling on how many keys are kept.
 */
class AttemptsPerHourTest {

	/** Not a round hour, so that a window counted from the clock's hour rather than the attempt fails. */
	private static final Instant T0 = Instant.parse("2026-11-21T10:17:23.456Z");

	@Test
	void theAllowanceIsLetInAndTheNextIsRefused() {
		AttemptsPerHour five = new AttemptsPerHour(5, 100);

		for (int one = 0; one < 5; one++) {
			assertThat(five.knock("a", T0.plusSeconds(one))).as("attempt %d", one + 1).isEmpty();
		}

		assertThat(five.knock("a", T0.plusSeconds(5))).isPresent();
	}

	@Test
	void anotherKeyHasItsOwnAllowance() {
		AttemptsPerHour three = new AttemptsPerHour(3, 100);

		for (int one = 0; one < 3; one++) {
			three.knock("a", T0);
		}

		assertThat(three.knock("a", T0)).isPresent();
		assertThat(three.knock("b", T0)).isEmpty();
	}

	@Test
	void anAttemptCountsForExactlyAnHourFromWhenItWasLetIn() {
		AttemptsPerHour three = new AttemptsPerHour(3, 100);

		three.knock("a", T0);
		three.knock("a", T0.plus(Duration.ofMinutes(10)));
		three.knock("a", T0.plus(Duration.ofMinutes(20)));

		Instant aMomentBefore = T0.plus(Duration.ofHours(1)).minusNanos(1);

		assertThat(three.knock("a", aMomentBefore)).contains(Duration.ofNanos(1));
		/* THE FIRST ONE RUNS OUT AND ONLY THE FIRST: a sliding hour, not a clock hour. */
		assertThat(three.knock("a", T0.plus(Duration.ofHours(1)))).isEmpty();
		assertThat(three.knock("a", T0.plus(Duration.ofHours(1)))).as("the second and third still count")
				.contains(Duration.ofMinutes(10));
	}

	@Test
	void theWaitIsUntilTheOldestStillCountingRunsOut() {
		AttemptsPerHour one = new AttemptsPerHour(1, 100);

		one.knock("a", T0);

		assertThat(one.knock("a", T0.plus(Duration.ofMinutes(15)))).contains(Duration.ofMinutes(45));
	}

	@Test
	void aRefusedAttemptIsNotCountedSoPressingAgainDoesNotPushTheWaitOut() {
		AttemptsPerHour one = new AttemptsPerHour(1, 100);

		one.knock("a", T0);

		for (int again = 1; again <= 50; again++) {
			assertThat(one.knock("a", T0.plus(Duration.ofMinutes(again)))).isPresent();
		}

		assertThat(one.knock("a", T0.plus(Duration.ofHours(1)))).isEmpty();
	}

	@Test
	void theKeyTouchedLongestAgoIsTheOneForgottenAtTheCeiling() {
		AttemptsPerHour one = new AttemptsPerHour(1, 2);

		one.knock("a", T0);
		one.knock("b", T0);
		/* TOUCHED AGAIN, so "b" and not "a" is now the one touched longest ago. */
		assertThat(one.knock("a", T0)).isPresent();

		one.knock("c", T0);

		assertThat(one.knock("a", T0)).as("a was touched last and is kept").isPresent();
		assertThat(one.knock("b", T0)).as("b was pushed out, so it starts again").isEmpty();
	}

	@Test
	void anAllowanceOfNothingOrAMemoryOfNothingIsRefusedAtStartUp() {
		assertThatThrownBy(() -> new AttemptsPerHour(0, 100)).isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> new AttemptsPerHour(1, 0)).isInstanceOf(IllegalArgumentException.class);
		assertThat(new AttemptsPerHour(1, 1).knock("a", T0)).isEqualTo(Optional.empty());
	}

}

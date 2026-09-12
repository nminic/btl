package com.btl.portal.domain.ranking;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** What a season adds up to, and what it refuses to add up from. */
class TotalsTest {

	private static Totals race(String kilometers, int ascent, int descent, long seconds, String points) {
		return new Totals(1, new BigDecimal(kilometers), ascent, descent, seconds, new BigDecimal(points));
	}

	@Test
	void nobodyHasRacedYetIsARowAndNotAMissingOne() {
		assertThat(Totals.EMPTY.races()).isZero();
		assertThat(Totals.EMPTY.seconds()).isZero();
		assertThat(Totals.EMPTY.vertical()).isZero();
		assertThat(Totals.EMPTY.kilometers()).isEqualByComparingTo("0");
		assertThat(Totals.EMPTY.points()).isEqualByComparingTo("0");
	}

	@Test
	void twoSeasonsAddedTogetherAddEveryNumberTheyHold() {
		Totals sum = race("21.10", 400, 380, 7200L, "35.40")
				.plus(race("42.20", 900, 910, 15000L, "64.60"));

		assertThat(sum.races()).isEqualTo(2);
		assertThat(sum.kilometers()).isEqualByComparingTo("63.30");
		assertThat(sum.ascent()).isEqualTo(1300);
		assertThat(sum.descent()).isEqualTo(1290);
		assertThat(sum.seconds()).isEqualTo(22200L);
		assertThat(sum.points()).isEqualByComparingTo("100.00");
	}

	/**
	 * One more race counts as exactly one race.
	 *
	 * <p>The count goes up inside rather than being handed in, so "how many races
	 * is one race" is not a question two callers can answer differently. The case
	 * starts from a row that already holds three, because starting from
	 * {@link Totals#EMPTY} would let a version that SET the count to one pass.
	 */
	@Test
	void oneMoreRaceIsOneMoreRace() {
		Totals three = new Totals(3, new BigDecimal("30.00"), 100, 100, 1000L, new BigDecimal("12.00"));

		Totals four = three.plusRace(new BigDecimal("10.00"), 50, 60, 500L, new BigDecimal("4.00"));

		assertThat(four.races()).as("the count was set rather than raised").isEqualTo(4);
		assertThat(four.kilometers()).isEqualByComparingTo("40.00");
		assertThat(four.ascent()).isEqualTo(150);
		assertThat(four.descent()).isEqualTo(160);
		assertThat(four.seconds()).isEqualTo(1500L);
		assertThat(four.points()).isEqualByComparingTo("16.00");
	}

	/**
	 * Vertical is the two together, and it is a {@code long}.
	 *
	 * <p>Both halves near the top of what an {@code int} holds: summed as
	 * {@code int} this wraps to a negative number, and a rung that wraps seats the
	 * biggest climber last. The numbers are absurd for a season of running and
	 * that is the point - the type is what makes the answer right, not the
	 * expectation that nobody climbs that far.
	 */
	@Test
	void verticalIsBothHalvesAndDoesNotWrap() {
		Totals huge = new Totals(1, BigDecimal.ONE, 2_000_000_000, 2_000_000_000, 1L, BigDecimal.ONE);

		assertThat(huge.vertical()).isEqualTo(4_000_000_000L);
	}

	@Test
	void aNumberWithAThirdDecimalDidNotComeFromARaceAndIsRefused() {
		assertThatThrownBy(() -> new Totals(1, new BigDecimal("21.105"), 0, 0, 1L, BigDecimal.ZERO))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("kilometers")
				.hasMessageContaining("more than 2 decimals");

		assertThatThrownBy(() -> new Totals(1, BigDecimal.ONE, 0, 0, 1L, new BigDecimal("35.401")))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("points");
	}

	/**
	 * And a whole number is not a third decimal.
	 *
	 * <p>Scaling up is exact, so this must pass; a version that refused anything
	 * not already written with two decimals would refuse
	 * {@link BigDecimal#ZERO}, which is what an empty season is made of.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"0", "12", "12.5", "12.50"})
	void aNumberWrittenWithFewerDecimalsIsTheSameNumber(String written) {
		Totals totals = new Totals(1, new BigDecimal(written), 0, 0, 1L, new BigDecimal(written));

		assertThat(totals.kilometers().scale()).as("the stored scale is not the schema's").isEqualTo(2);
		assertThat(totals.kilometers()).isEqualByComparingTo(written);
	}

	/**
	 * Two rows that hold the same numbers are the same row, however they were
	 * written.
	 *
	 * <p>{@link BigDecimal#equals} compares the scale as well as the value, so
	 * {@code 35} and {@code 35.00} are different to it while being the same
	 * number. A record's own {@code equals} is built out of its fields', so
	 * without the scale being settled in the constructor two identical seasons
	 * would be unequal depending on how somebody typed them.
	 */
	@Test
	void theSameSeasonWrittenTwoWaysIsOneSeason() {
		assertThat(new Totals(1, new BigDecimal("35"), 1, 1, 1L, new BigDecimal("40")))
				.isEqualTo(new Totals(1, new BigDecimal("35.00"), 1, 1, 1L, new BigDecimal("40.0")));
	}

	static Stream<Arguments> negatives() {
		return Stream.of(
				Arguments.of("races", (Runnable) () ->
						new Totals(-1, BigDecimal.ONE, 0, 0, 0L, BigDecimal.ONE)),
				Arguments.of("kilometers", (Runnable) () ->
						new Totals(0, new BigDecimal("-1.00"), 0, 0, 0L, BigDecimal.ONE)),
				Arguments.of("ascent", (Runnable) () ->
						new Totals(0, BigDecimal.ONE, -1, 0, 0L, BigDecimal.ONE)),
				Arguments.of("descent", (Runnable) () ->
						new Totals(0, BigDecimal.ONE, 0, -1, 0L, BigDecimal.ONE)),
				Arguments.of("seconds", (Runnable) () ->
						new Totals(0, BigDecimal.ONE, 0, 0, -1L, BigDecimal.ONE)),
				Arguments.of("points", (Runnable) () ->
						new Totals(0, BigDecimal.ONE, 0, 0, 0L, new BigDecimal("-0.01"))));
	}

	/**
	 * Every one of the six refuses its OWN bad value, and says which it was.
	 *
	 * <p>One case per field rather than one for the lot, because the branches are
	 * covered by any two of them while the thing that goes wrong here is a
	 * copy-paste: a constructor that checks points twice and kilometres never
	 * passes a case that only counts how many refusals there are.
	 */
	@ParameterizedTest(name = "{0}")
	@MethodSource("negatives")
	void everyNumberRefusesItsOwnNegative(String named, Runnable building) {
		assertThatThrownBy(building::run)
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining(named)
				.hasMessageContaining("cannot be negative");
	}

	@Test
	void aNumberThatIsNotThereAtAllIsRefusedByName() {
		assertThatThrownBy(() -> new Totals(0, null, 0, 0, 0L, BigDecimal.ONE))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("kilometers");

		assertThatThrownBy(() -> new Totals(0, BigDecimal.ONE, 0, 0, 0L, null))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("points");

		assertThatThrownBy(() -> Totals.EMPTY.plus(null))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("other");
	}
}

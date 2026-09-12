package com.btl.portal.domain.award;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** One race as the badge rules see it, and the period it falls inside. */
class RaceDoneTest {

	private static RaceDone on(String day) {
		return new RaceDone(LocalDate.parse(day), "short", "RS", BigDecimal.ONE, 0, 60L, BigDecimal.ONE);
	}

	/**
	 * Both ends of a period belong to it.
	 *
	 * <p>A month badge is "125 km in July", and a race on the first or the
	 * thirty-first of July is a race in July. The two boundary rows are the ones
	 * that would fail the day somebody writes the comparison the other way round,
	 * and they are the only rows in this table that can.
	 */
	@ParameterizedTest(name = "{0} in {1}..{2} = {3}")
	@CsvSource({
			"2027-06-30, 2027-07-01, 2027-07-31, false",
			"2027-07-01, 2027-07-01, 2027-07-31, true",
			"2027-07-15, 2027-07-01, 2027-07-31, true",
			"2027-07-31, 2027-07-01, 2027-07-31, true",
			"2027-08-01, 2027-07-01, 2027-07-31, false",
	})
	void aRaceOnEitherEndOfThePeriodIsInsideIt(String day, String from, String to, boolean inside) {
		assertThat(on(day).inside(LocalDate.parse(from), LocalDate.parse(to))).isEqualTo(inside);
	}

	/**
	 * An open end lets everything through on that side and nothing through on the
	 * other.
	 *
	 * <p>Which is what a badge with no period is: "a hundred races ever" has both
	 * ends open. Each half is measured on its own, because a version ignoring the
	 * closed end too would pass a case that only opened one.
	 */
	@Test
	void anOpenEndIsNotAClosedOne() {
		RaceDone summer = on("2027-07-15");

		assertThat(summer.inside(null, LocalDate.parse("2027-12-31"))).isTrue();
		assertThat(summer.inside(null, LocalDate.parse("2027-07-14")))
				.as("an open beginning opened the end as well")
				.isFalse();

		assertThat(summer.inside(LocalDate.parse("2027-01-01"), null)).isTrue();
		assertThat(summer.inside(LocalDate.parse("2027-07-16"), null))
				.as("an open end opened the beginning as well")
				.isFalse();

		assertThat(summer.inside(null, null)).as("a badge with no period took in nobody").isTrue();
	}

	@Test
	void aRaceWithoutALengthBandCountsTowardsNoBadge() {
		assertThatThrownBy(() -> new RaceDone(LocalDate.parse("2027-07-15"), "  ", "RS", BigDecimal.ONE, 0,
				60L, BigDecimal.ONE))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("length band");
	}

	/**
	 * A race refuses every number the schema refuses.
	 *
	 * <p>This type does not have to come from the database, and a round on
	 * 11.09.2026 built one with every number negative: it went through, and a race
	 * then SUBTRACTED five kilometres from somebody's total. One case per number,
	 * because the thing that goes wrong here is a copy-paste and a case counting
	 * refusals would not see it.
	 */
	@Test
	void aRaceRefusesEveryNumberTheSchemaRefuses() {
		assertThatThrownBy(() -> new RaceDone(LocalDate.parse("2027-07-15"), "short", "RS",
				new BigDecimal("-5.00"), 0, 60L, BigDecimal.ONE))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("kilometers");
		assertThatThrownBy(() -> new RaceDone(LocalDate.parse("2027-07-15"), "short", "RS",
				BigDecimal.ZERO, 0, 60L, BigDecimal.ONE))
				.as("a race of no length at all was counted")
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("kilometers");
		assertThatThrownBy(() -> new RaceDone(LocalDate.parse("2027-07-15"), "short", "RS",
				BigDecimal.ONE, -1, 60L, BigDecimal.ONE))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("climbed less than nothing");
		assertThatThrownBy(() -> new RaceDone(LocalDate.parse("2027-07-15"), "short", "RS",
				BigDecimal.ONE, 0, 0L, BigDecimal.ONE))
				.as("a race that took no time at all was counted")
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("seconds");
		assertThatThrownBy(() -> new RaceDone(LocalDate.parse("2027-07-15"), "short", "RS",
				BigDecimal.ONE, 0, 60L, new BigDecimal("-0.01")))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("points");
	}

	/** And nought points IS a race: a result is worth what it is worth, and
	 *  `result_points_not_negative` permits nought where it refuses less. */
	@Test
	void aRaceWorthNoPointsIsStillARace() {
		assertThat(new RaceDone(LocalDate.parse("2027-07-15"), "short", "RS", BigDecimal.ONE, 0, 60L,
				BigDecimal.ZERO).points()).isEqualByComparingTo("0");
	}

	/**
	 * And the smallest race there can be IS a race.
	 *
	 * <p>The other side of the two boundaries that are STRICTLY positive, and the
	 * side a round on 11.09.2026 found unmeasured: every legal race in these cases
	 * is far from nought, so a version refusing anything below one kilometre, or
	 * under a second, passed them all. A hundredth of a kilometre is the smallest
	 * `result.distance_km` can hold, being numeric(6,2), and a second is the
	 * smallest `result.seconds` can hold at all.
	 */
	@Test
	void theSmallestRaceTheSchemaCanHoldIsARace() {
		RaceDone smallest = new RaceDone(LocalDate.parse("2027-07-15"), "short", "RS",
				new BigDecimal("0.01"), 0, 1L, BigDecimal.ZERO);

		assertThat(smallest.kilometers()).isEqualByComparingTo("0.01");
		assertThat(smallest.seconds()).isOne();
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> new RaceDone(null, "short", "RS", BigDecimal.ONE, 0, 60L, BigDecimal.ONE))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("on");
		assertThatThrownBy(() -> new RaceDone(LocalDate.parse("2027-07-15"), null, "RS", BigDecimal.ONE, 0,
				60L, BigDecimal.ONE))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("category");
		assertThatThrownBy(() -> new RaceDone(LocalDate.parse("2027-07-15"), "short", "RS", null, 0, 60L,
				BigDecimal.ONE))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("kilometers");
		assertThatThrownBy(() -> new RaceDone(LocalDate.parse("2027-07-15"), "short", "RS", BigDecimal.ONE, 0,
				60L, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("points");
	}

	/** A country nobody knows is a state a race may be in, which is why it is the
	 *  one of the eight that may be absent. */
	@Test
	void aRaceMayNotKnowItsCountry() {
		assertThat(new RaceDone(LocalDate.parse("2027-07-15"), "short", null, BigDecimal.ONE, 0, 60L,
				BigDecimal.ONE).country()).isNull();
	}
}

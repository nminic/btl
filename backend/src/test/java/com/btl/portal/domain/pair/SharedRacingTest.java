package com.btl.portal.domain.pair;

import com.btl.portal.domain.ranking.Totals;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** What a pair did together, and what they only did on the same day. */
class SharedRacingTest {

	private static RanRace race(long raceId, String kilometers, int ascent, long seconds, String points) {
		return new RanRace(raceId, new Totals(1, new BigDecimal(kilometers), ascent, 0, seconds,
				new BigDecimal(points)));
	}

	/**
	 * Two people at the same meeting, in different races, ran nothing together.
	 *
	 * <p>The owner's own example: "Ako on trči maraton a ona polumaraton na istoj
	 * manifestaciji, to nije zajednička trka i ne ulazi u poredak parova." Here
	 * that is races 10 and 11, and a version keyed on the meeting rather than the
	 * race would pair them.
	 */
	@Test
	void thesameMeetingIsNotTheSameRace() {
		List<RanRace> his = List.of(race(10, "42.20", 900, 15000L, "31.40"));
		List<RanRace> hers = List.of(race(11, "21.10", 450, 9000L, "18.20"));

		assertThat(SharedRacing.racesBothRan(his, hers)).isEmpty();
		assertThat(SharedRacing.together(his, hers)).isEqualTo(Totals.EMPTY);
	}

	/**
	 * ONE SHARED RACE IS ONE RACE, and the rest of the numbers are both of them.
	 *
	 * <p>The line this measures is the one put back by hand: adding his race to her
	 * race counts two races, and the pair ran one. Every other number here is
	 * deliberately different between the two, so a version taking one runner's
	 * numbers instead of the sum answers wrong on all four.
	 */
	@Test
	void oneSharedRaceIsOneRaceAndTheNumbersAreBoth() {
		Totals together = SharedRacing.together(
				List.of(race(10, "42.20", 900, 15000L, "31.40")),
				List.of(race(10, "42.20", 880, 17000L, "27.60")));

		assertThat(together.races())
				.as("the pair was credited with a race for each of them, and they ran one")
				.isOne();
		assertThat(together.kilometers()).isEqualByComparingTo("84.40");
		assertThat(together.ascent()).isEqualTo(1780);
		assertThat(together.seconds()).isEqualTo(32000L);
		assertThat(together.points()).isEqualByComparingTo("59.00");
	}

	/**
	 * And only the shared ones count, not everything either of them ran.
	 *
	 * <p>He ran three and she ran three, and they shared two. The two they did not
	 * share carry numbers big enough that a version adding everything answers
	 * plainly differently, rather than by a rounding.
	 */
	@Test
	void whatEitherRanAloneIsNotThePairs() {
		List<RanRace> his = List.of(
				race(10, "10.00", 100, 3000L, "5.00"),
				race(20, "80.00", 2000, 40000L, "55.00"),
				race(30, "21.10", 200, 7000L, "12.00"));
		List<RanRace> hers = List.of(
				race(10, "10.00", 110, 3300L, "4.50"),
				race(30, "21.10", 210, 7700L, "11.00"),
				race(40, "42.20", 900, 16000L, "30.00"));

		assertThat(SharedRacing.racesBothRan(his, hers)).containsExactly(10L, 30L);

		Totals together = SharedRacing.together(his, hers);

		assertThat(together.races()).isEqualTo(2);
		assertThat(together.kilometers())
				.as("a race only one of them ran was counted towards the pair")
				.isEqualByComparingTo("62.20");
		assertThat(together.points()).isEqualByComparingTo("32.50");
		assertThat(together.ascent()).isEqualTo(620);
		assertThat(together.seconds()).isEqualTo(21000L);
	}

	/**
	 * The shared races come back in HIS order, and the same order tomorrow.
	 *
	 * <p>His list is given latest first and hers earliest first, so a version
	 * reading either the other list's order or no order at all comes out
	 * differently. The totals would be the same whichever way, which is exactly why
	 * this has a case of its own.
	 */
	@Test
	void theSharedRacesComeBackInHisOrder() {
		List<RanRace> his = List.of(
				race(30, "21.10", 200, 7000L, "12.00"),
				race(20, "80.00", 2000, 40000L, "55.00"),
				race(10, "10.00", 100, 3000L, "5.00"));
		List<RanRace> hers = List.of(
				race(10, "10.00", 110, 3300L, "4.50"),
				race(20, "80.00", 2100, 41000L, "50.00"),
				race(30, "21.10", 210, 7700L, "11.00"));

		assertThat(SharedRacing.racesBothRan(his, hers)).containsExactly(30L, 20L, 10L);
	}

	/** Nobody has raced is a pair at nought, not a fall over: a pair exists before
	 *  it has run anything together. */
	@Test
	void aPairThatHasRunNothingTogetherIsAPairAtNought() {
		assertThat(SharedRacing.together(List.of(), List.of())).isEqualTo(Totals.EMPTY);
		assertThat(SharedRacing.racesBothRan(List.of(), List.of())).isEmpty();
	}

	/** A race is one race, whatever totals somebody hands in beside it. */
	@Test
	void oneRaceIsOneRace() {
		assertThatThrownBy(() -> new RanRace(10, new Totals(2, BigDecimal.ONE, 0, 0, 1L, BigDecimal.ONE)))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("one race is one race");

		assertThatThrownBy(() -> new RanRace(10, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("totals");
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> SharedRacing.racesBothRan(null, List.of()))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("his");
		assertThatThrownBy(() -> SharedRacing.racesBothRan(List.of(), null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("hers");
	}
}

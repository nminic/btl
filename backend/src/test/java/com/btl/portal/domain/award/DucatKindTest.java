package com.btl.portal.domain.award;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The eleven quantities a badge can be measured in. */
class DucatKindTest {

	private static RaceDone race(String on, String band, String country, String kilometers, int ascent,
			long seconds, String points) {
		return new RaceDone(LocalDate.parse(on), band, country, new BigDecimal(kilometers), ascent, seconds,
				new BigDecimal(points));
	}

	/**
	 * A field of races that differs along every axis at once.
	 *
	 * <p>Deliberately never level: five races, five bands, four countries with one
	 * repeated and one unknown, and no two of them sharing a distance, a climb, a
	 * time or a score. A fixture where two races carried the same number would let
	 * a measure reading the wrong column give the right answer.
	 */
	private static List<RaceDone> theField() {
		return List.of(
				race("2027-03-01", "short", "RS", "10.00", 100, 3000L, "5.10"),
				race("2027-04-02", "half", "RS", "21.10", 250, 7200L, "12.20"),
				race("2027-05-03", "long", "ME", "30.00", 400, 11000L, "18.30"),
				race("2027-06-04", "marathon", null, "42.20", 900, 15000L, "31.40"),
				race("2027-07-05", "ultra", "HR", "80.00", 2000, 43200L, "55.50"));
	}

	@ParameterizedTest(name = "{0} = {1}")
	@CsvSource({
			"raceCount,      5",
			"shortCount,     1",
			"halfCount,      1",
			"longCount,      1",
			"marathonCount,  1",
			"ultraCount,     1",
			"totalKm,        183.30",
			"totalAscent,    3650",
			"points,         122.50",
			"countryCount,   3",
	})
	void everyQuantityMeasuresItsOwnThing(String code, String expected) {
		assertThat(DucatKind.named(code).over(theField()))
				.as("%s is measured off the wrong column", code)
				.isEqualByComparingTo(expected);
	}

	/**
	 * Time comes back in hours and is rounded DOWN.
	 *
	 * <p>The field is 79400 seconds, which is 22 hours and 3800 seconds: not a
	 * whole number of hours, and that is the point. Rounded up or to nearest, a
	 * runner one second short of a threshold would be handed a badge nothing can
	 * take back (ADL A12, 4).
	 */
	@Test
	void timeIsHoursAndTheLastFractionIsNotARoundingUp() {
		assertThat(DucatKind.TOTAL_TIME.over(theField()))
				.isEqualByComparingTo("22.055555");

		List<RaceDone> oneSecondShort = List.of(race("2027-03-01", "short", "RS", "1.00", 0, 359_999L, "1.00"));

		assertThat(DucatKind.TOTAL_TIME.reached(oneSecondShort, new BigDecimal("100.00")))
				.as("a hundred hours was awarded to somebody one second short of it")
				.isFalse();
		assertThat(DucatKind.TOTAL_TIME.reached(
				List.of(race("2027-03-01", "short", "RS", "1.00", 0, 360_000L, "1.00")),
				new BigDecimal("100.00")))
				.as("a hundred hours was refused to somebody who ran exactly that")
				.isTrue();
	}

	/**
	 * A race whose country nobody knows counts towards no country.
	 *
	 * <p>Not towards a country of its own, which is what a version counting
	 * distinct values including the empty one would do: the field above holds one
	 * such race, and three countries is the answer with it left out.
	 */
	@Test
	void anUnknownCountryIsNotACountry() {
		List<RaceDone> unknowns = List.of(
				race("2027-03-01", "short", null, "1.00", 0, 60L, "1.00"),
				race("2027-03-02", "short", "  ", "1.00", 0, 60L, "1.00"),
				race("2027-03-03", "short", "RS", "1.00", 0, 60L, "1.00"));

		assertThat(DucatKind.COUNTRY_COUNT.over(unknowns))
				.as("a race with no country counted as a country of its own")
				.isEqualByComparingTo("1");
	}

	/** The same country twice is one country. */
	@Test
	void theSameCountryTwiceIsOneCountry() {
		assertThat(DucatKind.COUNTRY_COUNT.over(List.of(
				race("2027-03-01", "short", "RS", "1.00", 0, 60L, "1.00"),
				race("2027-03-02", "short", "RS", "1.00", 0, 60L, "1.00"))))
				.isEqualByComparingTo("1");
	}

	/**
	 * The boundary belongs to whoever reached it: at least, never more than.
	 *
	 * <p>Three cases because two of them are the same answer for opposite reasons,
	 * and a comparison written the wrong way round passes either alone.
	 */
	@Test
	void aBadgeAsksForAtLeastThatMuchAndTheBoundaryCounts() {
		List<RaceDone> five = theField();

		assertThat(DucatKind.RACE_COUNT.reached(five, new BigDecimal("4"))).isTrue();
		assertThat(DucatKind.RACE_COUNT.reached(five, new BigDecimal("5")))
				.as("whoever reached the threshold exactly was refused the badge")
				.isTrue();
		assertThat(DucatKind.RACE_COUNT.reached(five, new BigDecimal("6"))).isFalse();
	}

	/**
	 * A threshold written with decimals is compared as a number, not as text.
	 *
	 * <p>The schema writes thresholds as {@code numeric(12,2)}, so `5` comes back
	 * as `5.00`. Compared with {@link BigDecimal#equals} those are different
	 * values while being the same number, and the one place that matters is the
	 * boundary, which is the only place a badge is decided.
	 */
	@Test
	void aThresholdWithDecimalsIsTheSameNumber() {
		assertThat(DucatKind.RACE_COUNT.reached(theField(), new BigDecimal("5.00"))).isTrue();
		assertThat(DucatKind.RACE_COUNT.reached(theField(), new BigDecimal("5.01"))).isFalse();
	}

	@Test
	void nobodyHasRacedIsNoughtOfEveryQuantityAndNotAFallOver() {
		for (DucatKind kind : DucatKind.values()) {
			assertThat(kind.over(List.of()))
					.as("%s cannot be measured over somebody who has not raced", kind.code())
					.isEqualByComparingTo("0");
		}
	}

	@Test
	void aQuantityNoBadgeIsMeasuredInIsRefusedByName() {
		assertThatThrownBy(() -> DucatKind.named("totalDescent"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("totalDescent");
	}

	@Test
	void theCodesAreTheElevenAndEachIsWrittenOnce() {
		assertThat(DucatKind.codes()).hasSize(DucatKind.values().length);
		assertThat(DucatKind.values()).hasSize(11);
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> DucatKind.RACE_COUNT.over(null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("races");
		assertThatThrownBy(() -> DucatKind.RACE_COUNT.reached(List.of(), null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("threshold");
	}
}

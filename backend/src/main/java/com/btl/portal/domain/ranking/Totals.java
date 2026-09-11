package com.btl.portal.domain.ranking;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/**
 * What a season adds up to for one competitor: the six numbers every standing on
 * the portal is ordered by.
 *
 * <p>The general standing is computed from EVERY race of the season and never
 * from a chosen best few (Pravilnik, Član 46), so this is a running sum with
 * nothing thrown away. It is the same six numbers the main table draws as its
 * columns, in the same meaning: races, kilometres, ascent, descent, time on
 * course, points.
 *
 * <p><b>Time is a total and not a rung.</b> {@code seconds} is added up and
 * shown, but the general standing does not order by it, and that is the whole
 * principle of Član 49 written into one field: volume is rewarded, efficiency
 * never. Ordering a standing by time would hand a place to whoever was slower
 * over the same course. It becomes a rung only on the board that is ABOUT time,
 * "najduže na stazi", and there more of it is better as well.
 *
 * <p><b>Two decimals, and a third one throws.</b> The schema stores distance as
 * {@code numeric(6,2)} and points as {@code numeric(8,2)}, and
 * {@link com.btl.portal.domain.scoring.BtlScoreCalculator} hands back exactly
 * that. A number arriving here with a third decimal did not come from either, so
 * it is refused rather than rounded: rounding it would move somebody up or down
 * a table without a word. Scaling UP is exact and silent, so
 * {@link BigDecimal#ZERO} and a whole number are both fine.
 */
public record Totals(int races, BigDecimal kilometers, int ascent, int descent, long seconds, BigDecimal points) {

	/** What the schema stores and what the calculator hands back. */
	static final int DECIMALS = 2;

	/** Nobody has raced yet, which is a real row: a member of a team who has not
	 *  started is on the team page with zeros, not missing from it. */
	public static final Totals EMPTY =
			new Totals(0, BigDecimal.ZERO, 0, 0, 0L, BigDecimal.ZERO);

	public Totals {
		kilometers = exactlyTwoDecimals(kilometers, "kilometers");
		points = exactlyTwoDecimals(points, "points");
		notNegative(races, "races");
		notNegative(ascent, "ascent");
		notNegative(descent, "descent");
		notNegative(seconds, "seconds");
	}

	/**
	 * Ascent and descent together, which is what Član 49 calls "vertikala".
	 *
	 * <p>A {@code long} rather than an {@code int} because the two are summed: a
	 * season of climbing fits an {@code int} comfortably and the sum of two of
	 * them fits it less comfortably, and a rung that silently wraps to a negative
	 * number would seat the biggest climber last.
	 */
	public long vertical() {
		return (long) ascent + descent;
	}

	/** This season and another added together, which is what a sum over results is. */
	public Totals plus(Totals other) {
		Objects.requireNonNull(other, "other");

		return new Totals(races + other.races, kilometers.add(other.kilometers), ascent + other.ascent,
				descent + other.descent, seconds + other.seconds, points.add(other.points));
	}

	/**
	 * One more race on top of what is already counted.
	 *
	 * <p>The count goes up by one here rather than being passed in, because "how
	 * many races is one race" is not a question a caller should be able to answer
	 * differently.
	 */
	public Totals plusRace(BigDecimal raceKilometers, int raceAscent, int raceDescent, long raceSeconds,
			BigDecimal racePoints) {
		return plus(new Totals(1, raceKilometers, raceAscent, raceDescent, raceSeconds, racePoints));
	}

	private static BigDecimal exactlyTwoDecimals(BigDecimal value, String named) {
		Objects.requireNonNull(value, named);

		if (value.signum() < 0) {
			throw new IllegalArgumentException(named + " cannot be negative: " + value);
		}

		try {
			return value.setScale(DECIMALS, RoundingMode.UNNECESSARY);
		} catch (ArithmeticException moreThanTwo) {
			throw new IllegalArgumentException(
					named + " carries more than " + DECIMALS + " decimals, so it did not come from a race: " + value,
					moreThanTwo);
		}
	}

	private static void notNegative(long value, String named) {
		if (value < 0) {
			throw new IllegalArgumentException(named + " cannot be negative: " + value);
		}
	}
}

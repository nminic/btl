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
 * <p><b>A number wider than its own column throws, and the two columns are not
 * the same width.</b> A number arriving here with more decimals than the schema
 * can store did not come out of the schema, so it is refused rather than
 * rounded: rounding it would move somebody up or down a table without a word.
 * Scaling UP is exact and silent, so {@link BigDecimal#ZERO} and a whole number
 * are both fine on either.
 *
 * <p><b>Distance carries FOUR decimals and points carry TWO, and that split is
 * the schema's rather than this class's.</b> Until V44 both were two, and the
 * reason written here was {@code result.distance_km numeric(6,2)}. The owner
 * decided on 19.09.2026 that a race is measured exactly - „Hocu da mogu da
 * unosim tacnu duzinu, ali se prikazuje zaokruzeno" - and the schema moved under
 * that decision in three steps: V25 widened {@code race.distance_km} to
 * {@code numeric(8,4)}, V32 widened {@code result_submission.distance_km} to
 * match, and V44 widened {@code result.distance_km} in the commit that first
 * lets an approval write one. So a season that adds up the kilometres of a
 * 42,195 km race reaches this class with four decimals, and a guard still
 * demanding two would refuse the one number the portal now takes trouble to keep
 * exact. Both V25 and V32 name this class by name as the half of that work that
 * is not SQL.
 *
 * <p><b>Points did NOT move with it, and that is a decision and not an
 * oversight.</b> {@code result.points} is {@code numeric(8,2)} and
 * {@link com.btl.portal.domain.scoring.BtlScoreCalculator} rounds its answer to
 * two decimals before handing it back, so a third decimal on points still did
 * not come from the formula. The owner's decision of the same day says so in as
 * many words (PDL): „Zlatni test set bodovanja je na dve decimale i ostaje
 * netaknut, ali se bodovi od tada racunaju na precizniju" length. A more exact
 * length reaches the formula; the points it hands back are the same two decimals
 * they always were.
 */
public record Totals(int races, BigDecimal kilometers, int ascent, int descent, long seconds, BigDecimal points) {

	/** What {@code result.distance_km} stores, since V44 and V25 before it. */
	static final int DISTANCE_DECIMALS = 4;

	/** What {@code result.points} stores and what the calculator hands back. */
	static final int POINTS_DECIMALS = 2;

	/** Nobody has raced yet, which is a real row: a member of a team who has not
	 *  started is on the team page with zeros, not missing from it. */
	public static final Totals EMPTY =
			new Totals(0, BigDecimal.ZERO, 0, 0, 0L, BigDecimal.ZERO);

	public Totals {
		kilometers = noWiderThan(DISTANCE_DECIMALS, kilometers, "kilometers");
		points = noWiderThan(POINTS_DECIMALS, points, "points");
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

	/**
	 * @param decimals what the column this number comes out of can store, which is
	 *                 four for a distance and two for points: see the note on this
	 *                 class for why they differ and which migration moved which
	 */
	private static BigDecimal noWiderThan(int decimals, BigDecimal value, String named) {
		Objects.requireNonNull(value, named);

		if (value.signum() < 0) {
			throw new IllegalArgumentException(named + " cannot be negative: " + value);
		}

		try {
			return value.setScale(decimals, RoundingMode.UNNECESSARY);
		} catch (ArithmeticException tooWide) {
			throw new IllegalArgumentException(
					named + " carries more than " + decimals + " decimals, so it did not come from a race: " + value,
					tooWide);
		}
	}

	private static void notNegative(long value, String named) {
		if (value < 0) {
			throw new IllegalArgumentException(named + " cannot be negative: " + value);
		}
	}
}

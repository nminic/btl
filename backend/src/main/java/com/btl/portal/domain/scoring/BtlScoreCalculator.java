package com.btl.portal.domain.scoring;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * BTL points calculation, per the league formula decided by the owner on 27.11.2026 (PDL P4, „Izabrana
 * varijanta V3c”, chosen among the outcomes offered, with the coordinator's recommendation):
 *
 * <pre>
 *   a race of a length:  BTL = 55.75 × (Tref(Le) / Tsec)^2.75 × (Le / 10)^0.39
 *   a race to a limit:   BTL = 58.71 × (Le / Lref(Tsec))^2.86 × (Le / 10)^0.39
 *   Le  = L + (5 × AP + 2 × AN) / 1000
 * </pre>
 *
 * Units: L in kilometres, AP and AN in metres (both non-negative, AN entered as a positive number, and
 * a descent ADDS to the length as an ascent does, only less), Tsec in seconds. Results are displayed
 * with 2 decimal places.
 *
 * <p>{@code Tref} is ONE SMOOTH CURVE of the reference time for the length {@code Le}, with no break
 * anywhere: the owner's objection was that a marathon had one reckoning and a race of 42.1 km another, so
 * the table of records that stood here until 27.11.2026 (log-log between its points) is no longer read
 * point by point. Above 5 km, {@code ln Tref = 0.04766 x² + 0.82303 x + 5.18994} with {@code x = ln Le},
 * a least-squares curve through the six records (5, 10, 21.0975, 42.195, 50 and 100 km), and it holds
 * above 100 km too. Below 5 km it keeps the slope of that curve AT 5 km and bends away from it:
 * {@code ln Tref = ln Tref(5) + S5 (x − ln 5) − 0.14 (x − ln 5)²}, where {@code S5} is that slope,
 * {@code 2 × 0.04766 × ln 5 + 0.82303}, worked out and not the rounded 0.976 the decision prints, so the
 * two pieces meet without a corner.
 *
 * <p>{@code Lref(Tsec)} is the length whose {@code Tref} is {@code Tsec}: the same curve read the other
 * way, found by bisection on the logarithm (the curve rises with the length everywhere, so it is one
 * answer). The scales 55.75 and 58.71 are the ones that keep the control the owner published (21.1 km,
 * +250 m, −250 m, 1:45:00) at 18.59 („Kontrola sa FB ostaje ista”) and centre the runs of 12 hours and
 * longer around what the old formula gave them.
 *
 * <p>This class is told the four figures a run is COUNTED at and whether the race runs to a limit.
 * On such a race the time it is handed is the limit of the race and the length the distance covered (PDL
 * P4, „Na vremenskoj trci {@code Tsec} je ograničenje same trke”); which figure is the race's and which
 * the runner's is {@code WhatARaceCarries.figuresOf}'s to say, and which of the two formulas answers is
 * the kind of the race's, asked by {@code PointsOfARun}.
 */
public final class BtlScoreCalculator {

    private static final double LENGTH_SCALE = 55.75;
    private static final double LIMIT_SCALE = 58.71;
    private static final double TIME_EXPONENT = 2.75;
    private static final double LIMIT_EXPONENT = 2.86;
    private static final double LENGTH_EXPONENT = 0.39;
    private static final double LENGTH_UNIT_KM = 10.0;
    private static final double ASCENT_WEIGHT = 5.0;
    private static final double DESCENT_WEIGHT = 2.0;
    private static final double ELEVATION_PER_KM = 1000.0;
    private static final int DISPLAY_SCALE = 2;

    /** The curve above 5 km: {@code ln Tref = A x² + B x + C}, {@code x = ln(Le in km)}. */
    private static final double A = 0.04766;
    private static final double B = 0.82303;
    private static final double C = 5.18994;

    /** Where the curve is cut over: {@code x = ln 5}, the value of the curve there and its slope there. */
    private static final double X_AT_FIVE = Math.log(5);
    private static final double LN_TREF_AT_FIVE = A * X_AT_FIVE * X_AT_FIVE + B * X_AT_FIVE + C;
    private static final double SLOPE_AT_FIVE = 2 * A * X_AT_FIVE + B;

    /** How the curve bends below 5 km, away from its tangent at 5 km. */
    private static final double BELOW_FIVE_BEND = -0.14;

    /** The bounds and the rounds of the bisection that turns the curve around ({@link #referenceKm}). */
    private static final double SEARCH_FROM_KM = 1e-4;
    private static final double SEARCH_TO_KM = 1e5;
    private static final int SEARCH_ROUNDS = 200;

    private BtlScoreCalculator() {
    }

    /**
     * The points of a run at a race OF A LENGTH (and at a free one, where the runner's own time is the
     * time).
     *
     * @param lengthKm      course length in kilometers, must be &gt; 0
     * @param ascentMeters  positive elevation change in meters, must be &ge; 0
     * @param descentMeters negative elevation change in meters, expressed as a
     *                      positive number, must be &ge; 0
     * @param timeSeconds   finish time in seconds, must be &gt; 0
     * @return BTL points rounded to 2 decimal places (HALF_UP)
     */
    public static BigDecimal calculate(double lengthKm, double ascentMeters, double descentMeters, long timeSeconds) {
        double effectiveKm = effectiveLengthKm(lengthKm, ascentMeters, descentMeters);
        requirePositive(timeSeconds, "Time (Tsec)");
        double points = LENGTH_SCALE * Math.pow(referenceSeconds(effectiveKm) / timeSeconds, TIME_EXPONENT)
                * Math.pow(effectiveKm / LENGTH_UNIT_KM, LENGTH_EXPONENT);
        return BigDecimal.valueOf(points).setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * The points of a run at a race TO A LIMIT, where the time is the race's own limit and the length is
     * how far the runner got: the length he covered against the length a runner of reference covers in
     * that time.
     *
     * @param lengthKm      distance covered in kilometers, must be &gt; 0
     * @param ascentMeters  positive elevation change in meters, must be &ge; 0
     * @param descentMeters negative elevation change in meters, expressed as a
     *                      positive number, must be &ge; 0
     * @param limitSeconds  the limit of the race in seconds, must be &gt; 0
     * @return BTL points rounded to 2 decimal places (HALF_UP)
     */
    public static BigDecimal calculateAtALimit(double lengthKm, double ascentMeters, double descentMeters,
            long limitSeconds) {
        double effectiveKm = effectiveLengthKm(lengthKm, ascentMeters, descentMeters);
        requirePositive(limitSeconds, "Time (Tsec)");
        double points = LIMIT_SCALE * Math.pow(effectiveKm / referenceKm(limitSeconds), LIMIT_EXPONENT)
                * Math.pow(effectiveKm / LENGTH_UNIT_KM, LENGTH_EXPONENT);
        return BigDecimal.valueOf(points).setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * The reference time for an effective length, in seconds: the quadratic curve in the logarithm at or
     * above 5 km, and below it the curve that leaves 5 km along the same tangent and bends away.
     */
    static double referenceSeconds(double effectiveKm) {
        double x = Math.log(effectiveKm);

        if (x >= X_AT_FIVE) {
            return Math.exp(A * x * x + B * x + C);
        }

        double below = x - X_AT_FIVE;

        return Math.exp(LN_TREF_AT_FIVE + SLOPE_AT_FIVE * below + BELOW_FIVE_BEND * below * below);
    }

    /**
     * The reference length for a time, in kilometres: the length whose {@link #referenceSeconds} is the
     * time, by bisection on the logarithm of the length.
     */
    static double referenceKm(double seconds) {
        double low = SEARCH_FROM_KM;
        double high = SEARCH_TO_KM;

        for (int round = 0; round < SEARCH_ROUNDS; round++) {
            double middle = Math.sqrt(low * high);

            if (referenceSeconds(middle) < seconds) {
                low = middle;
            } else {
                high = middle;
            }
        }

        return Math.sqrt(low * high);
    }

    /**
     * Effective course length: actual length increased by the weighted
     * contribution of ascent and descent.
     */
    public static double effectiveLengthKm(double lengthKm, double ascentMeters, double descentMeters) {
        requirePositive(lengthKm, "Course length (L)");
        requireNonNegative(ascentMeters, "Positive elevation change (AP)");
        requireNonNegative(descentMeters, "Negative elevation change (AN)");
        return lengthKm + (ASCENT_WEIGHT * ascentMeters + DESCENT_WEIGHT * descentMeters) / ELEVATION_PER_KM;
    }

    private static void requirePositive(double value, String name) {
        if (!(value > 0)) {
            throw new IllegalArgumentException(name + " must be greater than zero, got: " + value);
        }
    }

    private static void requireNonNegative(double value, String name) {
        if (!(value >= 0)) {
            throw new IllegalArgumentException(name + " must not be negative, got: " + value);
        }
    }
}

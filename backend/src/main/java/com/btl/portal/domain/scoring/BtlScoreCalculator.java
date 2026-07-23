package com.btl.portal.domain.scoring;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * BTL points calculation, per the official league formula:
 *
 * <pre>
 *   BTL = (40 × Le)^3.257 / (2 × Tsec^2.137)
 *   Le  = L + (1.25 × AP + 0.75 × AN) / 200
 * </pre>
 *
 * Units: L in kilometers, AP and AN in meters (both non-negative),
 * Tsec in seconds. The 2.137 exponent applies to Tsec ONLY; the factor
 * of 2 is a plain multiplier outside the power. Results are displayed
 * with 2 decimal places.
 */
public final class BtlScoreCalculator {

    private static final double DISTANCE_COEFFICIENT = 40.0;
    private static final double DISTANCE_EXPONENT = 3.257;
    private static final double TIME_EXPONENT = 2.137;
    private static final double ASCENT_WEIGHT = 1.25;
    private static final double DESCENT_WEIGHT = 0.75;
    private static final double ELEVATION_PER_KM = 200.0;
    private static final int DISPLAY_SCALE = 2;

    private BtlScoreCalculator() {
    }

    /**
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
        double numerator = Math.pow(DISTANCE_COEFFICIENT * effectiveKm, DISTANCE_EXPONENT);
        double denominator = 2.0 * Math.pow(timeSeconds, TIME_EXPONENT);
        return BigDecimal.valueOf(numerator / denominator).setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
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

package com.btl.portal.domain.scoring;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * BTL points calculation. ON THIS BRANCH ONLY (b-formula-b-qa, never merged): the formula proposed to
 * the owner on 25.11.2026 and put on QA for comparison, not decided:
 *
 * <pre>
 *   BTL  = 94.80 × (Tref / Tsec)^4 × (Le / 10)^0.35
 *   Le   = L + (1.25 × AP + 0.75 × AN) / 200
 * </pre>
 *
 * Tref is a reference time for the length Le, read from a table by kilometres and interpolated
 * linearly in log-log between its points; below 5 km it is 755 × (Le/5)^1.06, above 100 km it is
 * 21935 × (Le/100)^k with k = ln(21935/9613)/ln(2). There is no cap on the length bonus: it takes the
 * whole of Le. Results are displayed with 2 decimal places.
 */
public final class BtlScoreCalculator {

    private static final double SCALE = 94.80;
    private static final double QUALITY_EXPONENT = 4.0;
    private static final double LENGTH_EXPONENT = 0.35;
    private static final double LENGTH_UNIT_KM = 10.0;
    private static final double ASCENT_WEIGHT = 1.25;
    private static final double DESCENT_WEIGHT = 0.75;
    private static final double ELEVATION_PER_KM = 200.0;
    private static final int DISPLAY_SCALE = 2;

    /** The reference table: kilometres and the reference time in seconds at each of them. */
    private static final double[] REFERENCE_KM = {5, 10, 21.0975, 42.195, 50, 100};
    private static final double[] REFERENCE_SECONDS = {755, 1571, 3450, 7235, 9613, 21935};
    private static final double BELOW_THE_TABLE_EXPONENT = 1.06;

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
        double points = SCALE * Math.pow(referenceSeconds(effectiveKm) / timeSeconds, QUALITY_EXPONENT)
                * Math.pow(effectiveKm / LENGTH_UNIT_KM, LENGTH_EXPONENT);
        return BigDecimal.valueOf(points).setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * The reference time for an effective length, in seconds: log-log between two points of the table,
     * a power of 1.06 below its first point, and the slope of its last two points above its last.
     */
    static double referenceSeconds(double effectiveKm) {
        int last = REFERENCE_KM.length - 1;
        if (effectiveKm <= REFERENCE_KM[0]) {
            return REFERENCE_SECONDS[0] * Math.pow(effectiveKm / REFERENCE_KM[0], BELOW_THE_TABLE_EXPONENT);
        }
        for (int i = 1; i <= last; i++) {
            if (effectiveKm <= REFERENCE_KM[i]) {
                return logLog(i - 1, i, effectiveKm);
            }
        }
        return logLog(last - 1, last, effectiveKm);
    }

    private static double logLog(int a, int b, double km) {
        double share = Math.log(km / REFERENCE_KM[a]) / Math.log(REFERENCE_KM[b] / REFERENCE_KM[a]);
        return Math.exp(Math.log(REFERENCE_SECONDS[a]) + share * Math.log(REFERENCE_SECONDS[b] / REFERENCE_SECONDS[a]));
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

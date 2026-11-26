package com.btl.portal.domain.scoring;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * BTL points calculation, per the league formula decided by the owner on 26.11.2026 (PDL P4, „Nova
 * formula bodova, na produkciju”: „Uradi 0.39 i 4.25 i podigni sve i na produkciju”):
 *
 * <pre>
 *   BTL = 103.34 × (Tref / Tsec)^4.25 × (Le / 10)^0.39
 *   Le  = L + (9 × AP + 1 × AN) / 1000
 * </pre>
 *
 * Units: L in kilometres, AP and AN in metres (both non-negative, AN entered as a positive number, and
 * a descent ADDS to the length as an ascent does, only less), Tsec in seconds. Results are displayed
 * with 2 decimal places.
 *
 * <p>{@code Tref} is a reference time for the length {@code Le}, read from a table by kilometres (5 km
 * 755 s, 10 km 1571 s, 21.0975 km 3450 s, 42.195 km 7235 s, 50 km 9613 s, 100 km 21935 s) and
 * interpolated linearly in log-log between two of its points. Below its first point it is
 * {@code 755 × (Le/5)^1.06}; above its last it is the last stretch of the table carried on, the same
 * log-log line through 50 km and 100 km. The scale 103.34 is the one that keeps the control the owner
 * published (21.1 km, +250 m, −250 m, 1:45:00) at 18.59 („Kontrola sa FB ostaje ista”).
 *
 * <p>This class is told the four figures a run is COUNTED at and nothing about the race. On a timed race
 * the time it is handed is the limit of the race and the length the distance covered (PDL P4, „Na
 * vremenskoj trci {@code Tsec} je ograničenje same trke”); which figure is the race's and which the
 * runner's is {@code WhatARaceCarries.figuresOf}'s to say, and the formula is the same for both.
 */
public final class BtlScoreCalculator {

    private static final double SCALE = 103.34;
    private static final double TIME_EXPONENT = 4.25;
    private static final double LENGTH_EXPONENT = 0.39;
    private static final double LENGTH_UNIT_KM = 10.0;
    private static final double ASCENT_WEIGHT = 9.0;
    private static final double DESCENT_WEIGHT = 1.0;
    private static final double ELEVATION_PER_KM = 1000.0;
    private static final int DISPLAY_SCALE = 2;

    /** The reference table: kilometres, and the reference time in seconds at each of them. */
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
        double points = SCALE * Math.pow(referenceSeconds(effectiveKm) / timeSeconds, TIME_EXPONENT)
                * Math.pow(effectiveKm / LENGTH_UNIT_KM, LENGTH_EXPONENT);
        return BigDecimal.valueOf(points).setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * The reference time for an effective length, in seconds: a power of 1.06 at or below the first
     * point of the table, log-log between the two points around it, and the line through the last two
     * points beyond the last one.
     */
    static double referenceSeconds(double effectiveKm) {
        if (effectiveKm <= REFERENCE_KM[0]) {
            return REFERENCE_SECONDS[0] * Math.pow(effectiveKm / REFERENCE_KM[0], BELOW_THE_TABLE_EXPONENT);
        }
        int higher = 1;
        while (higher < REFERENCE_KM.length - 1 && effectiveKm > REFERENCE_KM[higher]) {
            higher++;
        }
        return logLog(higher - 1, higher, effectiveKm);
    }

    private static double logLog(int lower, int higher, double km) {
        double share = Math.log(km / REFERENCE_KM[lower]) / Math.log(REFERENCE_KM[higher] / REFERENCE_KM[lower]);
        return Math.exp(Math.log(REFERENCE_SECONDS[lower])
                + share * Math.log(REFERENCE_SECONDS[higher] / REFERENCE_SECONDS[lower]));
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

package com.btl.portal.domain.scoring;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Obračun BTL bodova po zvaničnoj formuli lige:
 *
 * <pre>
 *   BTL = (40 × Le)^3.257 / (2 × Tsec^2.137)
 *   Le  = L + (1.25 × AP + 0.75 × AN) / 200
 * </pre>
 *
 * Jedinice: L u kilometrima, AP i AN u metrima (oba nenegativna),
 * Tsec u sekundama. Eksponent 2.137 se primenjuje isključivo na Tsec;
 * dvojka je množilac izvan stepena. Rezultat se prikazuje na 2 decimale.
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
     * @param lengthKm      dužina staze u kilometrima, mora biti &gt; 0
     * @param ascentMeters  pozitivna promena nadmorske visine u metrima, mora biti &ge; 0
     * @param descentMeters negativna promena nadmorske visine u metrima, izražena
     *                      kao pozitivan broj, mora biti &ge; 0
     * @param timeSeconds   vreme prelaska staze u sekundama, mora biti &gt; 0
     * @return BTL bodovi zaokruženi na 2 decimale (HALF_UP)
     */
    public static BigDecimal calculate(double lengthKm, double ascentMeters, double descentMeters, long timeSeconds) {
        double effectiveKm = effectiveLengthKm(lengthKm, ascentMeters, descentMeters);
        requirePositive(timeSeconds, "Vreme (Tsec)");
        double numerator = Math.pow(DISTANCE_COEFFICIENT * effectiveKm, DISTANCE_EXPONENT);
        double denominator = 2.0 * Math.pow(timeSeconds, TIME_EXPONENT);
        return BigDecimal.valueOf(numerator / denominator).setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * Efektivna dužina staze: stvarna dužina uvećana za doprinos uspona i spusta.
     */
    public static double effectiveLengthKm(double lengthKm, double ascentMeters, double descentMeters) {
        requirePositive(lengthKm, "Dužina staze (L)");
        requireNonNegative(ascentMeters, "Pozitivna promena visine (AP)");
        requireNonNegative(descentMeters, "Negativna promena visine (AN)");
        return lengthKm + (ASCENT_WEIGHT * ascentMeters + DESCENT_WEIGHT * descentMeters) / ELEVATION_PER_KM;
    }

    private static void requirePositive(double value, String name) {
        if (!(value > 0)) {
            throw new IllegalArgumentException(name + " mora biti veće od nule, dobijeno: " + value);
        }
    }

    private static void requireNonNegative(double value, String name) {
        if (!(value >= 0)) {
            throw new IllegalArgumentException(name + " ne sme biti negativno, dobijeno: " + value);
        }
    }
}

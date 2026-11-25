package com.btl.portal.domain.scoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BtlScoreCalculatorTest {

    // THIS BRANCH (b-formula-b-qa) IS NEVER MERGED. It carries the formula proposed to the owner on
    // 25.11.2026 (scale 94.80, length exponent 0.35, no cap, ascent 9 and descent 1 per 1000) for a comparison on QA only. The golden
    // set on main stays the official one (79.03, 46.78, 38.94, 38.94, 38.21, 38.13); the values here
    // are the same race worked out by the proposal, computed independently in Python.
    @ParameterizedTest(name = "time {0}s -> {1} points")
    @CsvSource({
            "26911, 77.29", // Todevski,     7:28:31
            "34395, 28.96", // Zeljkovic,    9:33:15
            "37476, 20.55", // Avramovic,   10:24:36
            "37476, 20.55", // Tabandzelic, 10:24:36 (same time, same points)
            "37813, 19.83", // Lakatos,     10:30:13
            "37850, 19.75", // Tasic,       10:30:50
    })
    void goldenResultsFromOfficialRace(long timeSeconds, String expectedPoints) {
        BigDecimal points = BtlScoreCalculator.calculate(62.07, 3456, 3133, timeSeconds);
        assertThat(points).isEqualByComparingTo(expectedPoints);
    }

    // The control the owner was given: 21.1 km, +250 m, -250 m, 1:45:00 is 18.59 under both formulas.
    // Below the table, on a point of it, between points and above it, each against Python.
    @ParameterizedTest(name = "L={0}, AP={1}, AN={2}, Tsec={3} -> {4}")
    @CsvSource({
            "21.1, 250, 250,  6300, 18.59",
            "3,      0,   0,   900,  3.53",
            "5,      0,   0,   755, 74.38",
            "10,     0,   0,  1571, 94.80",
            "75,     0,   0, 30000, 13.94",
            "150,    0,   0, 86400,  7.00",
            "300,    0,   0, 86400, 241.95",
            "10, 1000,   0,  5400, 12.72",
            "10,    0, 800,  2400, 24.73",
            "3,  1000,   0,  1920, 97.67",
            "5,     0,   0,  1200, 11.65",
    })
    void theProposalAgreesWithItsIndependentWorking(double lengthKm, double ascent, double descent,
            long timeSeconds, String expectedPoints) {
        assertThat(BtlScoreCalculator.calculate(lengthKm, ascent, descent, timeSeconds))
                .isEqualByComparingTo(expectedPoints);
    }

    @Test
    void effectiveLengthWeighsAscentMoreThanDescent() {
        // 20 km with 1000 m ascent and 1000 m descent: 20 + (9000 + 1000) / 1000 = 30 km
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 1000, 1000)).isEqualTo(30.0);
        // ascent (9/1000) contributes more than descent (1/1000)
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 1000, 0))
                .isGreaterThan(BtlScoreCalculator.effectiveLengthKm(20, 0, 1000));
    }

    @Test
    void effectiveLengthOfGoldenRace() {
        assertThat(BtlScoreCalculator.effectiveLengthKm(62.07, 3456, 3133)).isEqualTo(96.307);
    }

    @Test
    void flatRaceUsesPlainLength() {
        assertThat(BtlScoreCalculator.effectiveLengthKm(21.1, 0, 0)).isEqualTo(21.1);
    }

    @Test
    void fasterTimeYieldsMorePoints() {
        BigDecimal faster = BtlScoreCalculator.calculate(42.2, 0, 0, 12600); // 3:30
        BigDecimal slower = BtlScoreCalculator.calculate(42.2, 0, 0, 14400); // 4:00
        assertThat(faster).isGreaterThan(slower);
    }

    @Test
    void longerRaceYieldsMorePointsAtSamePace() {
        // same pace (6:00 min/km): the longer race must yield more points
        BigDecimal half = BtlScoreCalculator.calculate(21.1, 0, 0, (long) (21.1 * 360));
        BigDecimal marathon = BtlScoreCalculator.calculate(42.2, 0, 0, (long) (42.2 * 360));
        assertThat(marathon).isGreaterThan(half);
    }

    @Test
    void resultHasTwoDecimalPlaces() {
        assertThat(BtlScoreCalculator.calculate(21.1, 0, 0, 7200).scale()).isEqualTo(2);
    }

    @ParameterizedTest(name = "L={0}, AP={1}, AN={2}, Tsec={3} -> IllegalArgumentException")
    @CsvSource({
            "0,     0,    0,    7200", // zero length
            "-5,    0,    0,    7200", // negative length
            "21.1, -1,    0,    7200", // negative ascent
            "21.1,  0,   -1,    7200", // negative descent (AN is entered as a positive number)
            "21.1,  0,    0,    0",    // zero time
            "21.1,  0,    0,   -60",   // negative time
    })
    void rejectsInvalidInput(double lengthKm, double ascent, double descent, long timeSeconds) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> BtlScoreCalculator.calculate(lengthKm, ascent, descent, timeSeconds));
    }
}

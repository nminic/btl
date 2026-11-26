package com.btl.portal.domain.scoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BtlScoreCalculatorTest {

    // Golden test set: the race of the league organizer (L=62.07 km, AP=3456 m, AN=3133 m), whose
    // official results under the formula of 2017 were 79.03, 46.78, 38.94, 38.94, 38.21 and 38.13.
    // Under the formula the owner decided on 26.11.2026 (PDL P4, „Nova formula bodova, na
    // produkciju”, with the owner's confirmation that the golden set moves with it, ADL A2) the same
    // six rows are worth what follows, computed independently in Python and not taken from this class.
    // NEVER change the expected values without the owner saying so.
    @ParameterizedTest(name = "time {0}s -> {1} points")
    @CsvSource({
            "26911, 86.67", // Todevski,     7:28:31
            "34395, 30.55", // Zeljkovic,    9:33:15
            "37476, 21.21", // Avramovic,   10:24:36
            "37476, 21.21", // Tabandzelic, 10:24:36 (same time, same points)
            "37813, 20.42", // Lakatos,     10:30:13
            "37850, 20.34", // Tasic,       10:30:50
    })
    void goldenResultsFromOfficialRace(long timeSeconds, String expectedPoints) {
        BigDecimal points = BtlScoreCalculator.calculate(62.07, 3456, 3133, timeSeconds);
        assertThat(points).isEqualByComparingTo(expectedPoints);
    }

    // The control the owner published: 21.1 km, +250 m, -250 m, 1:45:00 is 18.59 („Kontrola sa FB ostaje
    // ista”), and the scale 103.34 is chosen for it. Then each road through the reference table: below
    // its first point, on each of its points, between points and beyond its last, with a climb alone and
    // a fall alone. Each against the same independent Python working as the golden set.
    @ParameterizedTest(name = "L={0}, AP={1}, AN={2}, Tsec={3} -> {4}")
    @CsvSource({
            "21.1,     250, 250,  6300,  18.59",
            "3,          0,   0,   900,   3.07",
            "5,          0,   0,   755,  78.86",
            "5,          0,   0,  1200,  11.01",
            "7,          0,   0,  2100,   5.28",
            "10,         0,   0,  1571, 103.34",
            "10,         0,   0,  3000,   6.61",
            "21.0975,    0,   0,  3450, 138.27",
            "42.195,     0,   0,  7235, 181.18",
            "46,         0,   0,  8400, 183.66",
            "50,         0,   0,  9613, 193.58",
            "75,         0,   0, 30000,  13.98",
            "100,        0,   0, 21935, 253.67",
            "150,        0,   0, 86400,   6.81",
            "300,        0,   0, 86400, 297.44",
            "10,      1000,   0,  5400,  12.37",
            "10,         0, 800,  2400,  24.82",
            "3,       1000,   0,  1920, 107.02",
    })
    void theFormulaAgreesWithItsIndependentWorking(double lengthKm, double ascent, double descent,
            long timeSeconds, String expectedPoints) {
        assertThat(BtlScoreCalculator.calculate(lengthKm, ascent, descent, timeSeconds))
                .isEqualByComparingTo(expectedPoints);
    }

    @Test
    void effectiveLengthWeighsAscentMoreThanDescent() {
        // 20 km with 1000 m ascent and 1000 m descent: 20 + (9000 + 1000) / 1000 = 30 km
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 1000, 1000)).isEqualTo(30.0);
        // ascent (9/1000) contributes more than descent (1/1000), and a descent still adds (owner,
        // 25.11.2026: „nizbrdica mora da donosi pozitivne bodove inace je ljudi nece unositi")
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 1000, 0)).isEqualTo(29.0);
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 0, 1000)).isEqualTo(21.0);
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

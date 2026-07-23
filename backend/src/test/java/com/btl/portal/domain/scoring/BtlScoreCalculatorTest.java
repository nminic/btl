package com.btl.portal.domain.scoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BtlScoreCalculatorTest {

    // Golden test set: official results of a race with L=62.07 km, AP=3456 m,
    // AN=3133 m, confirmed by the league organizer. The implementation must
    // reproduce all 6 rows exactly. NEVER change the expected values.
    @ParameterizedTest(name = "time {0}s -> {1} points")
    @CsvSource({
            "26911, 79.03", // Todevski,     7:28:31
            "34395, 46.78", // Zeljkovic,    9:33:15
            "37476, 38.94", // Avramovic,   10:24:36
            "37476, 38.94", // Tabandzelic, 10:24:36 (same time, same points)
            "37813, 38.21", // Lakatos,     10:30:13
            "37850, 38.13", // Tasic,       10:30:50
    })
    void goldenResultsFromOfficialRace(long timeSeconds, String expectedPoints) {
        BigDecimal points = BtlScoreCalculator.calculate(62.07, 3456, 3133, timeSeconds);
        assertThat(points).isEqualByComparingTo(expectedPoints);
    }

    @Test
    void effectiveLengthWeighsAscentMoreThanDescent() {
        // 20 km with 1000 m ascent and 1000 m descent: 20 + (1250 + 750) / 200 = 30 km
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 1000, 1000)).isEqualTo(30.0);
        // ascent (1.25/200) contributes more than descent (0.75/200)
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 1000, 0))
                .isGreaterThan(BtlScoreCalculator.effectiveLengthKm(20, 0, 1000));
    }

    @Test
    void effectiveLengthOfGoldenRace() {
        assertThat(BtlScoreCalculator.effectiveLengthKm(62.07, 3456, 3133)).isEqualTo(95.41875);
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

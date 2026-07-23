package com.btl.portal.domain.scoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BtlScoreCalculatorTest {

    // Zlatni test set: zvanični rezultati trke L=62.07 km, AP=3456 m, AN=3133 m,
    // koje je potvrdio organizator lige. Implementacija mora pogoditi svih 6 redova.
    @ParameterizedTest(name = "vreme {0}s -> {1} bodova")
    @CsvSource({
            "26911, 79.03", // Todevski,     7:28:31
            "34395, 46.78", // Zeljković,    9:33:15
            "37476, 38.94", // Avramović,   10:24:36
            "37476, 38.94", // Tabandželić, 10:24:36 (identično vreme, identični bodovi)
            "37813, 38.21", // Lakatoš,     10:30:13
            "37850, 38.13", // Tasić,       10:30:50
    })
    void goldenResultsFromOfficialRace(long timeSeconds, String expectedPoints) {
        BigDecimal points = BtlScoreCalculator.calculate(62.07, 3456, 3133, timeSeconds);
        assertThat(points).isEqualByComparingTo(expectedPoints);
    }

    @Test
    void effectiveLengthWeighsAscentMoreThanDescent() {
        // 20 km sa 1000 m uspona i 1000 m spusta: 20 + (1250 + 750) / 200 = 30 km
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 1000, 1000)).isEqualTo(30.0);
        // uspon (1.25/200) doprinosi više nego spust (0.75/200)
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
        // isti tempo (6:00 min/km): duža trka mora nositi više bodova
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
            "0,     0,    0,    7200", // dužina nula
            "-5,    0,    0,    7200", // negativna dužina
            "21.1, -1,    0,    7200", // negativan uspon
            "21.1,  0,   -1,    7200", // negativan spust (AN se unosi kao pozitivan broj)
            "21.1,  0,    0,    0",    // vreme nula
            "21.1,  0,    0,   -60",   // negativno vreme
    })
    void rejectsInvalidInput(double lengthKm, double ascent, double descent, long timeSeconds) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> BtlScoreCalculator.calculate(lengthKm, ascent, descent, timeSeconds));
    }
}

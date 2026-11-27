package com.btl.portal.domain.scoring;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BtlScoreCalculatorTest {

    // Golden test set: the race of the league organizer (L=62.07 km, AP=3456 m, AN=3133 m), whose
    // official results under the formula of 2017 were 79.03, 46.78, 38.94, 38.94, 38.21 and 38.13.
    // Under the formula the owner chose on 27.11.2026 (PDL P4, „Izabrana varijanta V3c”, and his word
    // „Napisi i podigni”; ADL A2: the golden set moves with the formula on his confirmation) the same
    // six rows are worth what follows, computed independently in Python by the reference calculation
    // (dorada-formule-glatka2.py) and not taken from this class.
    // NEVER change the expected values without the owner saying so.
    @ParameterizedTest(name = "time {0}s -> {1} points")
    @CsvSource({
            "26911, 42.38", // Todevski,     7:28:31
            "34395, 21.58", // Zeljkovic,    9:33:15
            "37476, 17.05", // Avramovic,   10:24:36
            "37476, 17.05", // Tabandzelic, 10:24:36 (same time, same points)
            "37813, 16.63", // Lakatos,     10:30:13
            "37850, 16.59", // Tasic,       10:30:50
    })
    void goldenResultsFromOfficialRace(long timeSeconds, String expectedPoints) {
        BigDecimal points = BtlScoreCalculator.calculate(62.07, 3456, 3133, timeSeconds);
        assertThat(points).isEqualByComparingTo(expectedPoints);
    }

    // The control the owner published: 21.1 km, +250 m, -250 m, 1:45:00 is 18.59 („Kontrola sa FB ostaje
    // ista”), and the scale 55.75 is chosen for it. Then each road through the curve: below 5 km, on 5
    // km, between the records, beyond the last, with a climb alone and a fall alone, and the rows the
    // owner printed as examples (10 km in 40:00 16.37, in 50:00 8.86, the marathon in 3:30 24.44, Red
    // Bull 400 5.69) and the walk at 5:00 per kilometre that showed him the curve has no corner
    // (40 km 23.03, 42.1 km 24.09, 45 km 25.56), and the two the decision of 27.11.2026 prints that the rows
    // above did not carry (42.195 km 24.14 and 50 km 28.15, PENDING, PR 841): flat, at 5:00 per kilometre, so
    // 15000 s for 50 km, and 12658 s for 42.195 km. The decision gives the pace and not the seconds, and 5:00 per
    // kilometre over 42.195 km is 12658.5 s, which a whole number of seconds cannot be: the printed 24.14 is what the
    // formula gives at 12658 s (24.1357), which is 12658.5 rounded half to even as Python's round does, and at 12659
    // s it is 24.13 (24.1305). That reading of the printed number is MINE, not the decision's. Each against the same
    // independent Python working.
    @ParameterizedTest(name = "L={0}, AP={1}, AN={2}, Tsec={3} -> {4}")
    @CsvSource({
            "21.1,     250, 250,  6300,  18.59",
            "3,          0,   0,   900,   5.09",
            "1,          0,   0,   200,   4.43",
            "5,          0,   0,   755,  43.89",
            "5,          0,   0,  1200,  12.27",
            "7,          0,   0,  2100,   7.52",
            "10,         0,   0,  1571,  52.51",
            "10,         0,   0,  2400,  16.37",
            "10,         0,   0,  3000,   8.86",
            "21.0975,    0,   0,  3450,  73.87",
            "42.195,     0,   0,  7235, 112.39",
            "42.195,     0,   0, 12600,  24.44",
            "46,         0,   0,  8400, 102.12",
            "50,         0,   0,  9613,  95.68",
            "75,         0,   0, 30000,  19.00",
            "100,        0,   0, 21935, 135.00",
            "150,        0,   0, 86400,  15.21",
            "300,        0,   0, 86400, 253.32",
            "10,      1000,   0,  5400,   6.74",
            "10,         0, 800,  2400,  26.63",
            "3,       1000,   0,  1920,  14.72",
            "0.27,     140,   0,   174,   5.69",
            "40,         0,   0, 12000,  23.03",
            "42.1,       0,   0, 12630,  24.09",
            "45,         0,   0, 13500,  25.56",
            "42.195,     0,   0, 12658,  24.14",
            "50,         0,   0, 15000,  28.15",
    })
    void theFormulaAgreesWithItsIndependentWorking(double lengthKm, double ascent, double descent,
            long timeSeconds, String expectedPoints) {
        assertThat(BtlScoreCalculator.calculate(lengthKm, ascent, descent, timeSeconds))
                .isEqualByComparingTo(expectedPoints);
    }

    // A race TO A LIMIT is counted by its own formula, the length covered against the length a runner of
    // reference covers in the limit (PDL P4, „Izabrana varijanta V3c”): the 24 hours of 115.64 km is
    // 11.51 as the owner printed it. The same four figures read as a race of a length give another
    // number, which is the whole point of asking the kind (the length rows above).
    @ParameterizedTest(name = "L={0}, AP={1}, AN={2}, limit={3}s -> {4}")
    @CsvSource({
            "115.64,    0,   0, 86400,  11.51",
            "60,     2000, 500, 86400,   2.36",
            "44,        0,   0, 21600,  10.24",
            "50.82,    55,  55, 43200,   3.59",
            "30,        0,   0, 21600,   2.95",
            "5,         0,   0,   600,  88.68",
            "150,       0,   0, 86400,  26.82",
            "300,       0,   0, 86400, 255.15",
    })
    void aRaceToALimitAgreesWithItsIndependentWorking(double lengthKm, double ascent, double descent,
            long limitSeconds, String expectedPoints) {
        assertThat(BtlScoreCalculator.calculateAtALimit(lengthKm, ascent, descent, limitSeconds))
                .isEqualByComparingTo(expectedPoints);
    }

    @Test
    void aRaceToALimitIsNotCountedAsARaceOfALength() {
        assertThat(BtlScoreCalculator.calculateAtALimit(115.64, 0, 0, 86400))
                .isNotEqualByComparingTo(BtlScoreCalculator.calculate(115.64, 0, 0, 86400));
    }

    // The curve in itself, at points the Python working gives to the last digit, so a constant that
    // moved in the fifth decimal is seen where two decimals of points would hide it.
    @ParameterizedTest(name = "Tref({0} km) = {1} s")
    @CsvSource({
            "0.5,   38.37488722783535",
            "1,    110.37085502655415",
            "5,    763.5731472534575",
            "42.195, 7611.658936952741",
            "200, 53558.70480809211",
    })
    void theReferenceTimeIsTheCurve(double km, double seconds) {
        assertThat(BtlScoreCalculator.referenceSeconds(km)).isCloseTo(seconds, within(seconds * 1e-12));
    }

    @ParameterizedTest(name = "Lref({0} s) = {1} km")
    @CsvSource({
            "600,   3.9381584026960272",
            "3450,  21.164515986492706",
            "86400, 285.3910908710657",
    })
    void theReferenceLengthIsTheCurveReadTheOtherWay(double seconds, double km) {
        assertThat(BtlScoreCalculator.referenceKm(seconds)).isCloseTo(km, within(km * 1e-12));
        assertThat(BtlScoreCalculator.referenceSeconds(BtlScoreCalculator.referenceKm(seconds)))
                .isCloseTo(seconds, within(seconds * 1e-9));
    }

    @Test
    void theCurveBendsAt5KmWithNoCorner() {
        // The slope of ln Tref against ln Le just below 5 km and just above it are the same number:
        // the decision prints 0.976 for it, rounded, and a curve that used the printed figure would
        // meet itself at an angle of about 0.0004 here, which this tolerance is a hundred times under.
        double h = 1e-7;
        double five = Math.log(BtlScoreCalculator.referenceSeconds(5));
        double below = (five - Math.log(BtlScoreCalculator.referenceSeconds(5 * Math.exp(-h)))) / h;
        double above = (Math.log(BtlScoreCalculator.referenceSeconds(5 * Math.exp(h))) - five) / h;

        assertThat(below).isCloseTo(above, within(1e-5));
        assertThat(above).isCloseTo(2 * 0.04766 * Math.log(5) + 0.82303, within(1e-5));
    }

    @Test
    void effectiveLengthWeighsAscentMoreThanDescent() {
        // 20 km with 1000 m ascent and 1000 m descent: 20 + (5000 + 2000) / 1000 = 27 km
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 1000, 1000)).isEqualTo(27.0);
        // ascent (5/1000) contributes more than descent (2/1000), and a descent still adds (owner,
        // 25.11.2026: „nizbrdica mora da donosi pozitivne bodove inace je ljudi nece unositi")
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 1000, 0)).isEqualTo(25.0);
        assertThat(BtlScoreCalculator.effectiveLengthKm(20, 0, 1000)).isEqualTo(22.0);
    }

    @Test
    void effectiveLengthOfGoldenRace() {
        assertThat(BtlScoreCalculator.effectiveLengthKm(62.07, 3456, 3133)).isEqualTo(85.616);
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
        assertThat(BtlScoreCalculator.calculateAtALimit(60, 0, 0, 43200).scale()).isEqualTo(2);
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
        assertThatIllegalArgumentException()
                .isThrownBy(() -> BtlScoreCalculator.calculateAtALimit(lengthKm, ascent, descent, timeSeconds));
    }
}

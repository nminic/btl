package com.btl.portal.domain.award;

import com.btl.portal.domain.award.DucatInstances.Instance;
import com.btl.portal.domain.award.DucatInstances.Period;
import com.btl.portal.domain.award.DucatReconciliation.Crossing;
import com.btl.portal.domain.award.DucatReconciliation.Run;
import com.btl.portal.domain.award.WhetherADucatIsTold.Arrival;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHETHER A DUCAT IS TOLD: the owner, 16.11.2026, „Dukat se javlja samo ako je prag preveo odobren rezultat i
 * nijedan uvezen rezultat među prebrojanim nije stigao posle njega.”, and 12.11.2026, „Tiho ostaje samo ono što
 * dolazi iz rezultata odobrenih pre početka dodele.”
 *
 * <p>Every case puts the result that carried him over in the MIDDLE of the month and never first by key, so the
 * arrival of the crossing and the arrival of another counted result are never the same row by accident; and each
 * axis is measured on both of its sides.
 */
class WhetherADucatIsToldTest {

	private static final Instant BEGAN = Instant.parse("2026-11-11T23:00:00Z");

	private static final Instant APPROVED = BEGAN.plusSeconds(3600);

	private static final Instant LATER = APPROVED.plusSeconds(60);

	private static final Instant EARLIER = APPROVED.minusSeconds(60);

	/** 125 km in February 2028. */
	private static final Instance FEBRUARY_KM = new Instance(3, "duk-mesecni-km", DucatKind.TOTAL_KM,
			new BigDecimal("125"), Period.MONTH, 2028, 2, 1);

	/** Two marathons, for ever. */
	private static final Instance TWO_MARATHONS = new Instance(12, "duk-maratoni", DucatKind.MARATHON_COUNT,
			new BigDecimal("2"), Period.ALWAYS, null, null, 1);

	private static Run run(long id, String on, String kilometers, String category) {
		return new Run(id, new RaceDone(LocalDate.parse(on), category, "RS", new BigDecimal(kilometers), 0, 3600L,
				BigDecimal.ONE));
	}

	private static Run run(long id, String on, String kilometers) {
		return run(id, on, kilometers, "long");
	}

	private static Arrival approved(Instant at) {
		return new Arrival(false, at);
	}

	private static Arrival imported(Instant at) {
		return new Arrival(true, at);
	}

	private static final Arrival HISTORY = new Arrival(false, null);

	/**
	 * February of three runs: 60 km on the 3rd (key 40), 70 km on the 10th (key 25, the one that reaches 130), 80
	 * km on the 20th (key 12). The 10th is approved since the start; the other two arrive as given.
	 */
	private static boolean february(Arrival third, Arrival twentieth) {
		List<Run> runs = List.of(run(12, "2028-02-20", "80"), run(40, "2028-02-03", "60"),
				run(25, "2028-02-10", "70"));
		Crossing crossing = DucatReconciliation.crossing(FEBRUARY_KM, Set.of(2028), runs).orElseThrow();

		assertThat(crossing.resultId()).as("the fixture's crossing moved").isEqualTo(25);

		Map<Long, Arrival> arrivals = new HashMap<>();
		arrivals.put(40L, third);
		arrivals.put(25L, approved(APPROVED));
		arrivals.put(12L, twentieth);

		return WhetherADucatIsTold.told(FEBRUARY_KM, crossing, runs, arrivals, BEGAN);
	}

	@Test
	void anApprovalThatCarriedHimOverOverTheHistoryIsTold() {
		assertThat(february(HISTORY, HISTORY)).isTrue();
	}

	@Test
	void anApprovalThatCarriedHimOverOnlyBecauseAnOlderRaceWasImportedAfterItIsSilent() {
		assertThat(february(imported(LATER), HISTORY)).isFalse();
	}

	/**
	 * ONLY AN IMPORT SILENCES: an older race APPROVED strictly after the result that carried him over is counted
	 * and came in later, and it is no import, so the ducat is told. The two moments are two different values.
	 */
	@Test
	void anOlderRaceApprovedAfterTheCrossingIsCountedAndCameLaterAndIsNoImportSoTheDucatIsTold() {
		assertThat(LATER).isAfter(APPROVED);
		assertThat(february(approved(LATER), HISTORY)).isTrue();
	}

	@Test
	void anImportOfAnOlderRaceThatCameBeforeTheApprovalDidNotCarryHimOverSoTheApprovalIsTold() {
		assertThat(february(imported(EARLIER), HISTORY)).isTrue();
	}

	@Test
	void anImportAtTheVeryMomentOfTheApprovalIsNotAfterItSoTheApprovalIsTold() {
		assertThat(february(imported(APPROVED), HISTORY)).isTrue();
	}

	@Test
	void anImportAfterTheApprovalOfARaceRunAfterTheCrossingIsNotCountedSoTheApprovalIsTold() {
		assertThat(february(HISTORY, imported(LATER))).isTrue();
	}

	@Test
	void anImportAfterTheApprovalInAnotherMonthIsNotCounted() {
		List<Run> runs = List.of(run(12, "2028-01-31", "80"), run(40, "2028-02-03", "60"),
				run(25, "2028-02-10", "70"));
		Crossing crossing = DucatReconciliation.crossing(FEBRUARY_KM, Set.of(2028), runs).orElseThrow();

		assertThat(WhetherADucatIsTold.told(FEBRUARY_KM, crossing, runs,
				Map.of(12L, imported(LATER), 40L, HISTORY, 25L, approved(APPROVED)), BEGAN)).isTrue();
		assertThat(WhetherADucatIsTold.told(FEBRUARY_KM, crossing, runs,
				Map.of(12L, HISTORY, 40L, imported(LATER), 25L, approved(APPROVED)), BEGAN))
				.as("the other side: the same import inside February").isFalse();
	}

	/**
	 * „PREBROJANI” IS WHAT THE QUANTITY COUNTS: a ten kilometre race imported after the approval is inside
	 * „Maratoni”'s period (all time) and before the crossing, and it is no marathon, so it is not counted; an
	 * imported marathon in its place is.
	 */
	@Test
	void anImportedRaceOfAnotherLengthIsNotCountedTowardsADucatOfMarathons() {
		List<Run> runs = List.of(run(12, "2027-06-01", "42.2", "marathon"), run(40, "2027-07-01", "10", "short"),
				run(25, "2027-08-01", "42.2", "marathon"));
		Crossing crossing = DucatReconciliation.crossing(TWO_MARATHONS, Set.of(), runs).orElseThrow();

		assertThat(crossing.resultId()).isEqualTo(25);
		assertThat(WhetherADucatIsTold.told(TWO_MARATHONS, crossing, runs,
				Map.of(12L, HISTORY, 40L, imported(LATER), 25L, approved(APPROVED)), BEGAN)).isTrue();
		assertThat(WhetherADucatIsTold.told(TWO_MARATHONS, crossing, runs,
				Map.of(12L, imported(LATER), 40L, HISTORY, 25L, approved(APPROVED)), BEGAN))
				.as("the other side: the imported race is a marathon").isFalse();
	}

	@Test
	void anImportThatCarriedHimOverIsSilentEvenWithEverythingElseApproved() {
		List<Run> runs = List.of(run(40, "2028-02-03", "60"), run(25, "2028-02-10", "70"));
		Crossing crossing = DucatReconciliation.crossing(FEBRUARY_KM, Set.of(2028), runs).orElseThrow();

		assertThat(WhetherADucatIsTold.told(FEBRUARY_KM, crossing, runs,
				Map.of(40L, approved(LATER), 25L, imported(APPROVED)), BEGAN)).isFalse();
	}

	@Test
	void theHistoryThatCarriedHimOverIsSilent() {
		List<Run> runs = List.of(run(40, "2028-02-03", "60"), run(25, "2028-02-10", "70"));
		Crossing crossing = DucatReconciliation.crossing(FEBRUARY_KM, Set.of(2028), runs).orElseThrow();

		assertThat(WhetherADucatIsTold.told(FEBRUARY_KM, crossing, runs,
				Map.of(40L, approved(LATER), 25L, HISTORY), BEGAN)).isFalse();
	}

	@Test
	void anApprovalBeforeTheStartIsSilentAndOneAtTheStartIsTold() {
		List<Run> runs = List.of(run(40, "2028-02-03", "60"), run(25, "2028-02-10", "70"));
		Crossing crossing = DucatReconciliation.crossing(FEBRUARY_KM, Set.of(2028), runs).orElseThrow();

		assertThat(WhetherADucatIsTold.told(FEBRUARY_KM, crossing, runs,
				Map.of(40L, HISTORY, 25L, approved(BEGAN.minusMillis(1))), BEGAN)).isFalse();
		assertThat(WhetherADucatIsTold.told(FEBRUARY_KM, crossing, runs,
				Map.of(40L, HISTORY, 25L, approved(BEGAN)), BEGAN)).isTrue();
	}

	@Test
	void anImportWithoutItsMomentIsNotAnArrivalThereCanBe() {
		assertThatThrownBy(() -> new Arrival(true, null)).isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("imported");
	}

	@Test
	void aResultWhoseArrivalIsNotKnownIsRefusedAndNotReadAsTheHistory() {
		List<Run> runs = List.of(run(40, "2028-02-03", "60"), run(25, "2028-02-10", "70"));
		Crossing crossing = DucatReconciliation.crossing(FEBRUARY_KM, Set.of(2028), runs).orElseThrow();

		assertThatThrownBy(() -> WhetherADucatIsTold.told(FEBRUARY_KM, crossing, runs,
				Map.of(25L, approved(APPROVED)), BEGAN))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("result 40");
	}

	@Test
	void theCountedAreTheRunsUpToTheCrossingInTheOrderTheyWereRunThatMoveTheQuantity() {
		List<Run> runs = List.of(run(12, "2027-08-01", "42.2", "marathon"), run(40, "2027-07-01", "10", "short"),
				run(25, "2027-06-01", "42.2", "marathon"), run(7, "2027-09-01", "42.2", "marathon"));
		Crossing crossing = DucatReconciliation.crossing(TWO_MARATHONS, Set.of(), runs).orElseThrow();

		assertThat(DucatReconciliation.counted(TWO_MARATHONS, crossing, runs)).extracting(Run::resultId)
				.containsExactly(25L, 12L);
	}

	@Test
	void aCrossingThatIsNotARunOfThePeriodIsRefused() {
		List<Run> runs = List.of(run(40, "2028-02-03", "60"));

		assertThatThrownBy(() -> DucatReconciliation.counted(FEBRUARY_KM,
				new Crossing(99, LocalDate.of(2028, 2, 10), new BigDecimal("125.00")), runs))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("result 99");
	}
}

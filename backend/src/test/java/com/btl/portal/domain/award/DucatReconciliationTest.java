package com.btl.portal.domain.award;

import com.btl.portal.domain.award.DucatInstances.Family;
import com.btl.portal.domain.award.DucatInstances.Instance;
import com.btl.portal.domain.award.DucatInstances.Period;
import com.btl.portal.domain.award.DucatReconciliation.Crossing;
import com.btl.portal.domain.award.DucatReconciliation.Held;
import com.btl.portal.domain.award.DucatReconciliation.Plan;
import com.btl.portal.domain.award.DucatReconciliation.Run;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** What one member should hold, measured by the condition and never by a single result. */
class DucatReconciliationTest {

	private static final LocalDate TODAY = LocalDate.of(2028, 3, 15);

	private static final Set<Integer> A_MEMBER_IN_2028 = Set.of(2028);

	private static Run run(long id, String on, String kilometers) {
		return new Run(id, new RaceDone(LocalDate.parse(on), "long", "RS", new BigDecimal(kilometers), 0, 3600L,
				BigDecimal.ONE));
	}

	private static Run timed(long id, String on, long seconds) {
		return new Run(id, new RaceDone(LocalDate.parse(on), "long", "RS", BigDecimal.TEN, 0, seconds,
				BigDecimal.ONE));
	}

	private static Instance februaryKm(String threshold) {
		return new Instance(3, "duk-mesecni-km", DucatKind.TOTAL_KM, new BigDecimal(threshold), Period.MONTH, 2028,
				2, 1);
	}

	private static Family monthlyKm(String threshold) {
		return new Family(3, "duk-mesecni-km", DucatKind.TOTAL_KM, new BigDecimal(threshold), Period.MONTH, 1,
				BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
	}

	private static Held heldFebruary(long id, String threshold, Long resultId, String wonOn, String reached) {
		return new Held(id, 3, DucatKind.TOTAL_KM, new BigDecimal(threshold), Period.MONTH, 2028, 2, resultId,
				LocalDate.parse(wonOn), new BigDecimal(reached));
	}

	@Test
	void theRaceThatCarriedHimOverIsTheFirstAndNotTheLast() {
		List<Run> runs = List.of(run(31, "2028-02-20", "80"), run(12, "2028-02-03", "60"),
				run(25, "2028-02-10", "70"));

		assertThat(DucatReconciliation.crossing(februaryKm("125"), A_MEMBER_IN_2028, runs))
				.contains(new Crossing(25, LocalDate.of(2028, 2, 10), new BigDecimal("130.00")));
	}

	@Test
	void theDayOfTheRaceOrdersThemAndTheKeyOfTheResultOnlyBreaksATie() {
		Instance twoRaces = new Instance(4, "duk-trke", DucatKind.RACE_COUNT, new BigDecimal("2"), Period.SEASON,
				2028, null, 2);
		List<Run> runs = List.of(run(9, "2028-01-05", "10"), run(5, "2028-01-06", "10"), run(3, "2028-01-06", "10"));

		assertThat(DucatReconciliation.crossing(twoRaces, A_MEMBER_IN_2028, runs))
				.contains(new Crossing(3, LocalDate.of(2028, 1, 6), new BigDecimal("2.00")));
	}

	@Test
	void theThresholdBelongsToWhoeverReachedItAndNotToWhoeverFellShort() {
		assertThat(DucatReconciliation.crossing(februaryKm("125"), A_MEMBER_IN_2028,
				List.of(run(1, "2028-02-03", "60"), run(2, "2028-02-10", "65"))))
				.contains(new Crossing(2, LocalDate.of(2028, 2, 10), new BigDecimal("125.00")));
		assertThat(DucatReconciliation.crossing(februaryKm("125"), A_MEMBER_IN_2028,
				List.of(run(1, "2028-02-03", "60"), run(2, "2028-02-10", "64.99"))))
				.isEmpty();
	}

	@Test
	void aRaceOutsideThePeriodCountsTowardsNothingInIt() {
		assertThat(DucatReconciliation.crossing(februaryKm("125"), A_MEMBER_IN_2028,
				List.of(run(1, "2028-01-31", "60"), run(2, "2028-02-10", "65"), run(3, "2028-03-01", "65"))))
				.isEmpty();
	}

	@Test
	void aMonthOrASeasonOfAYearHeWasNoMemberInIsNotMetAndAllTimeStillIs() {
		List<Run> runs = List.of(run(1, "2028-02-03", "60"), run(2, "2028-02-10", "70"));
		Instance always = new Instance(5, "duk-obim", DucatKind.TOTAL_KM, new BigDecimal("100"), Period.ALWAYS,
				null, null, 5);

		assertThat(DucatReconciliation.crossing(februaryKm("125"), Set.of(2027, 2029), runs)).isEmpty();
		assertThat(DucatReconciliation.crossing(always, Set.of(), runs)).isPresent();
	}

	@Test
	void whatIsReachedIsKeptInTwoDecimalsRoundedDownSoNeverBelowTheThreshold() {
		Instance twentyHours = new Instance(6, "duk-mesecni-sati", DucatKind.TOTAL_TIME, new BigDecimal("20"),
				Period.MONTH, 2028, 2, 1);

		assertThat(DucatReconciliation.crossing(twentyHours, A_MEMBER_IN_2028,
				List.of(timed(1, "2028-02-03", 36_000), timed(2, "2028-02-10", 36_035))))
				.as("20.009722 hours is written as 20.00, not as 20.01")
				.contains(new Crossing(2, LocalDate.of(2028, 2, 10), new BigDecimal("20.00")));
	}

	@Test
	void aDucatHeMeetsAndDoesNotHoldIsWrittenAndOneHeHoldsIsNot() {
		List<Run> runs = List.of(run(1, "2028-02-03", "60"), run(2, "2028-02-10", "70"), run(3, "2028-03-02", "130"));

		Plan nothingHeld = DucatReconciliation.of(List.of(monthlyKm("125.00")), List.of(), runs, A_MEMBER_IN_2028,
				TODAY);

		assertThat(nothingHeld.toWrite()).extracting(one -> one.instance().month())
				.as("February and March, both met; January was not")
				.containsExactly(2, 3);
		assertThat(nothingHeld.toTakeAway()).isEmpty();
		assertThat(nothingHeld.toRewrite()).isEmpty();

		Plan februaryHeld = DucatReconciliation.of(List.of(monthlyKm("125.00")),
				List.of(heldFebruary(40, "125", 2L, "2028-02-10", "130.00")), runs, A_MEMBER_IN_2028, TODAY);

		assertThat(februaryHeld.toWrite()).extracting(one -> one.instance().month()).containsExactly(3);
		assertThat(februaryHeld.toTakeAway()).isEmpty();
		assertThat(februaryHeld.toRewrite()).as("a row that says what the races say is left alone").isEmpty();
	}

	@Test
	void aRowWhoseRaceIsGoneButWhoseConditionHoldsIsToldTheRaceThatHoldsItNow() {
		List<Run> runs = List.of(run(1, "2028-02-03", "60"), run(3, "2028-02-20", "80"));

		Plan plan = DucatReconciliation.of(List.of(monthlyKm("125.00")),
				List.of(heldFebruary(40, "125.00", null, "2028-02-10", "130.00")), runs, A_MEMBER_IN_2028, TODAY);

		assertThat(plan.toTakeAway()).isEmpty();
		assertThat(plan.toWrite()).isEmpty();
		assertThat(plan.toRewrite()).singleElement().satisfies(one -> {
			assertThat(one.id()).isEqualTo(40);
			assertThat(one.crossing()).isEqualTo(new Crossing(3, LocalDate.of(2028, 2, 20), new BigDecimal("140.00")));
		});
	}

	@Test
	void aRowIsRewrittenWhenOnlyItsDayOrOnlyWhatItReachedWouldChange() {
		List<Run> runs = List.of(run(1, "2028-02-03", "60"), run(2, "2028-02-10", "70"));

		assertThat(DucatReconciliation.of(List.of(monthlyKm("125.00")),
				List.of(heldFebruary(40, "125.00", 2L, "2028-02-11", "130.00")), runs, A_MEMBER_IN_2028, TODAY)
				.toRewrite()).hasSize(1);
		assertThat(DucatReconciliation.of(List.of(monthlyKm("125.00")),
				List.of(heldFebruary(40, "125.00", 2L, "2028-02-10", "131.00")), runs, A_MEMBER_IN_2028, TODAY)
				.toRewrite()).hasSize(1);
	}

	@Test
	void aRowWhoseConditionNoLongerHoldsIsTakenAway() {
		Plan plan = DucatReconciliation.of(List.of(monthlyKm("125.00")),
				List.of(heldFebruary(40, "125.00", 2L, "2028-02-10", "130.00")), List.of(run(1, "2028-02-03", "60")),
				A_MEMBER_IN_2028, TODAY);

		assertThat(plan.toTakeAway()).containsExactly(40L);
		assertThat(plan.toRewrite()).isEmpty();
		assertThat(plan.toWrite()).isEmpty();
	}

	@Test
	void aRowIsMeasuredByTheThresholdItWasWonAtAndNotByTodaysDefinition() {
		List<Run> runs = List.of(run(1, "2028-02-03", "60"), run(2, "2028-02-10", "70"));

		Plan raised = DucatReconciliation.of(List.of(monthlyKm("150.00")),
				List.of(heldFebruary(40, "125.00", 2L, "2028-02-10", "130.00")), runs, A_MEMBER_IN_2028, TODAY);

		assertThat(raised.toTakeAway()).as("the definition rose to 150 and took the ducat won at 125").isEmpty();
		assertThat(raised.toWrite()).as("150 is not met").isEmpty();

		Plan lowered = DucatReconciliation.of(List.of(monthlyKm("100.00")),
				List.of(heldFebruary(40, "125.00", 2L, "2028-02-10", "130.00")), List.of(run(1, "2028-02-03", "110")),
				A_MEMBER_IN_2028, TODAY);

		assertThat(lowered.toTakeAway()).as("110 meets today's 100 but not the 125 it was won at")
				.containsExactly(40L);
		assertThat(lowered.toWrite()).extracting(one -> one.instance().threshold().intValue())
				.as("and the instance of today's definition, which he meets, is written beside it")
				.containsExactly(100);
	}
}

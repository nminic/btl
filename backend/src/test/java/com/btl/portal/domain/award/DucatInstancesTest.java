package com.btl.portal.domain.award;

import com.btl.portal.domain.award.DucatInstances.Family;
import com.btl.portal.domain.award.DucatInstances.Instance;
import com.btl.portal.domain.award.DucatInstances.Period;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Which ducats of a family exist by a day, as {@code frontend/src/data/ducatRule.ts} works them out. */
class DucatInstancesTest {

	private static Family family(Period period, int tier, String threshold, String step, String last,
			String tierUpFrom) {
		return new Family(7, "duk-proba", DucatKind.TOTAL_KM, new BigDecimal(threshold), period, tier,
				new BigDecimal(step), new BigDecimal(last), new BigDecimal(tierUpFrom));
	}

	private static Family once(Period period) {
		return family(period, 1, "125.00", "0.00", "0.00", "0.00");
	}

	@Test
	void aMonthlyFamilyBeginsInJanuaryOfTheFirstSeasonAndEndsInTheMonthTheDayFallsIn() {
		List<Instance> instances = DucatInstances.existingBy(once(Period.MONTH), LocalDate.of(2028, 3, 15));

		assertThat(instances).extracting(one -> one.season() + "-" + one.month())
				.as("twelve months of 2027, then January to March of 2028 and not one month more")
				.containsExactly("2027-1", "2027-2", "2027-3", "2027-4", "2027-5", "2027-6", "2027-7", "2027-8",
						"2027-9", "2027-10", "2027-11", "2027-12", "2028-1", "2028-2", "2028-3");
		assertThat(instances).allSatisfy(one -> {
			assertThat(one.ducatId()).isEqualTo(7);
			assertThat(one.code()).isEqualTo("duk-proba");
			assertThat(one.kind()).isEqualTo(DucatKind.TOTAL_KM);
			assertThat(one.threshold()).isEqualByComparingTo("125");
			assertThat(one.period()).isEqualTo(Period.MONTH);
			assertThat(one.tier()).isEqualTo(1);
		});
	}

	@Test
	void noDucatOfAMonthOrASeasonExistsBeforeTheLeagueAndOneOfAllTimeAlwaysDoes() {
		LocalDate beforeTheLeague = LocalDate.of(2026, 11, 8);

		assertThat(DucatInstances.existingBy(once(Period.MONTH), beforeTheLeague)).isEmpty();
		assertThat(DucatInstances.existingBy(once(Period.SEASON), beforeTheLeague)).isEmpty();
		assertThat(DucatInstances.existingBy(once(Period.ALWAYS), beforeTheLeague))
				.singleElement()
				.satisfies(one -> {
					assertThat(one.season()).isNull();
					assertThat(one.month()).isNull();
				});
	}

	@Test
	void theFirstSeasonIsTheLeaguesAndNotTheYearBeforeIt() {
		assertThat(DucatInstances.existingBy(once(Period.SEASON), LocalDate.of(2027, 1, 1)))
				.extracting(Instance::season)
				.containsExactly(2027);
		assertThat(DucatInstances.existingBy(once(Period.MONTH), LocalDate.of(2027, 1, 1)))
				.extracting(Instance::season, Instance::month)
				.containsExactly(org.assertj.core.groups.Tuple.tuple(2027, 1));
	}

	@Test
	void aSeasonalFamilyHasOneDucatASeasonUpToTheOneTheDayFallsIn() {
		assertThat(DucatInstances.existingBy(once(Period.SEASON), LocalDate.of(2029, 12, 31)))
				.extracting(Instance::season)
				.containsExactly(2027, 2028, 2029);
	}

	@Test
	void aRunOfThresholdsIsOneDucatAStepAndRisesOneTierFromWhereItSays() {
		List<Instance> run = DucatInstances.existingBy(family(Period.ALWAYS, 3, "100.00", "100.00", "1000.00",
				"500.00"), LocalDate.of(2028, 3, 15));

		assertThat(run).extracting(one -> one.threshold().intValue())
				.containsExactly(100, 200, 300, 400, 500, 600, 700, 800, 900, 1000);
		assertThat(run).extracting(Instance::tier).containsExactly(3, 3, 3, 3, 4, 4, 4, 4, 4, 4);
	}

	@Test
	void theFifthTierIsTheTop() {
		Family gold = family(Period.ALWAYS, 5, "10.00", "10.00", "30.00", "20.00");

		assertThat(DucatInstances.tierOf(gold, new BigDecimal("30"))).isEqualTo(5);
		assertThat(DucatInstances.tierOf(gold, new BigDecimal("10"))).isEqualTo(5);
	}

	@Test
	void aPeriodRunsFromItsFirstDayToItsLastBothIncluded() {
		Instance february = new Instance(1, "c", DucatKind.TOTAL_KM, BigDecimal.ONE, Period.MONTH, 2028, 2, 1);
		Instance season = new Instance(1, "c", DucatKind.TOTAL_KM, BigDecimal.ONE, Period.SEASON, 2027, null, 1);
		Instance always = new Instance(1, "c", DucatKind.TOTAL_KM, BigDecimal.ONE, Period.ALWAYS, null, null, 1);

		assertThat(february.from()).isEqualTo(LocalDate.of(2028, 2, 1));
		assertThat(february.to()).as("2028 is a leap year").isEqualTo(LocalDate.of(2028, 2, 29));
		assertThat(season.from()).isEqualTo(LocalDate.of(2027, 1, 1));
		assertThat(season.to()).isEqualTo(LocalDate.of(2027, 12, 31));
		assertThat(always.from()).isNull();
		assertThat(always.to()).isNull();
	}

	@Test
	void aPeriodIsKnownByTheCodeTheSchemaGivesIt() {
		assertThat(Period.named("month")).isEqualTo(Period.MONTH);
		assertThat(Period.named("season")).isEqualTo(Period.SEASON);
		assertThat(Period.named("always")).isEqualTo(Period.ALWAYS);
		assertThat(Period.ALWAYS.code()).isEqualTo("always");
		assertThatThrownBy(() -> Period.named("week")).isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("week");
	}
}

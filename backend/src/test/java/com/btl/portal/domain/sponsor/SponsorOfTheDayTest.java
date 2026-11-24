package com.btl.portal.domain.sponsor;

import com.btl.portal.domain.sponsor.SponsorOfTheDay.InRotation;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * „„Sponzor dana” se smenjuje po danu, a glavni sponzor ide duplo češće od bilo kog drugog.” (owner, PDL
 * 24.11.2026), with „da ne oznacim nikom”: the rule {@link SponsorOfTheDay} writes, asked over runs of days and
 * not over one day, because a share is a property of many days and one day can be right by luck.
 *
 * <p>The main sponsor is handed in FIRST in every list here, as the route hands it in, and it is never the
 * sponsor with the smallest identity: a rule that picked by the identity would then not find it by accident.
 */
class SponsorOfTheDayTest {

	private static final LocalDate A_DAY = LocalDate.of(2027, 3, 14);

	private static final InRotation MAIN = new InRotation(40, true);

	private static final InRotation A = new InRotation(11, false);

	private static final InRotation B = new InRotation(7, false);

	private static final InRotation C = new InRotation(25, false);

	/** How many days of a run each sponsor gets. */
	private static Map<Long, Long> shareOver(List<InRotation> inRotation, int days) {
		return IntStream.range(0, days).mapToObj(one -> SponsorOfTheDay.on(inRotation, A_DAY.plusDays(one)).orElseThrow())
				.collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
	}

	@Test
	void nobodyInTheRotationIsNoSponsorOfTheDay() {
		assertThat(SponsorOfTheDay.on(List.of(), A_DAY)).isEmpty();
		assertThat(SponsorOfTheDay.cycleOf(List.of())).isEmpty();
	}

	@Test
	void oneSponsorStandsEveryDay() {
		assertThat(shareOver(List.of(A), 30)).containsExactly(Map.entry(11L, 30L));
		assertThat(shareOver(List.of(MAIN), 30)).containsExactly(Map.entry(40L, 30L));
	}

	@Test
	void withNobodyMarkedMainEachComesUpAsOftenAsAnyOther() {
		assertThat(shareOver(List.of(A, B, C), 3 * 20))
				.containsExactlyInAnyOrderEntriesOf(Map.of(11L, 20L, 7L, 20L, 25L, 20L));
		assertThat(SponsorOfTheDay.cycleOf(List.of(A, B, C))).containsExactly(11L, 7L, 25L);
	}

	@Test
	void theMainOneComesUpTwiceForEveryTimeAnyOtherComesUpOnce() {
		/* Three others: a cycle of five days, the main one on two of them. */
		assertThat(shareOver(List.of(MAIN, A, B, C), 5 * 20))
				.containsExactlyInAnyOrderEntriesOf(Map.of(40L, 40L, 11L, 20L, 7L, 20L, 25L, 20L));
		/* One other: a cycle of three, two to one. */
		assertThat(shareOver(List.of(MAIN, B), 3 * 20)).containsExactlyInAnyOrderEntriesOf(Map.of(40L, 40L, 7L, 20L));
		/* Two others, so the halves are even. */
		assertThat(shareOver(List.of(MAIN, A, B), 4 * 20))
				.containsExactlyInAnyOrderEntriesOf(Map.of(40L, 40L, 11L, 20L, 7L, 20L));
	}

	@Test
	void theMainOnesTwoDaysAreSpreadAndTheOthersKeepTheirOrder() {
		assertThat(SponsorOfTheDay.cycleOf(List.of(MAIN, A, B, C))).containsExactly(40L, 11L, 7L, 40L, 25L);
		assertThat(SponsorOfTheDay.cycleOf(List.of(MAIN, A, B))).containsExactly(40L, 11L, 40L, 7L);
		assertThat(SponsorOfTheDay.cycleOf(List.of(MAIN, B))).containsExactly(40L, 7L, 40L);
		assertThat(SponsorOfTheDay.cycleOf(List.of(MAIN))).containsExactly(40L, 40L);
	}

	@Test
	void theMainOneIsFoundWhereverItIsHandedIn() {
		assertThat(SponsorOfTheDay.cycleOf(List.of(A, B, MAIN, C))).containsExactly(40L, 11L, 7L, 40L, 25L);
	}

	@Test
	void theDayIsTheNumberOfDaysSince1970RoundTheCycle() {
		List<InRotation> three = List.of(A, B, C);
		LocalDate start = LocalDate.ofEpochDay(0);

		assertThat(SponsorOfTheDay.on(three, start)).contains(11L);
		assertThat(SponsorOfTheDay.on(three, start.plusDays(1))).contains(7L);
		assertThat(SponsorOfTheDay.on(three, start.plusDays(2))).contains(25L);
		assertThat(SponsorOfTheDay.on(three, start.plusDays(3))).contains(11L);
		/* And before 1970, which `%` would answer with a negative place. */
		assertThat(SponsorOfTheDay.on(three, start.minusDays(1))).contains(25L);
	}

	@Test
	void theSameSponsorsOnTheSameDayAreTheSameSponsor() {
		assertThat(SponsorOfTheDay.on(List.of(MAIN, A, B, C), A_DAY))
				.isEqualTo(SponsorOfTheDay.on(List.of(MAIN, A, B, C), A_DAY));
		/* And consecutive days differ, so the box changes once a day. */
		assertThat(SponsorOfTheDay.on(List.of(A, B, C), A_DAY))
				.isNotEqualTo(SponsorOfTheDay.on(List.of(A, B, C), A_DAY.plusDays(1)));
	}
}

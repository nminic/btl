package com.btl.portal.web;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link TheDayOfAnEvent#pullsAnEventStillAheadIntoTheYearJustEnded}: THE MORNING OF 1 JANUARY, AN EVENT STILL
 * AHEAD, AND A RACE OF THE YEAR JUST ENDED (PDL P9, owner, 06.11.2026, „U prozoru 1. januara od 00:00 do 10:00
 * server odbija trku iz stare godine na događaju koji još predstoji”).
 *
 * <p>No database and no route: the question is a function of three values, and each of its three halves is
 * given a case that turns only it. The moments are written in UTC and the league lives in Belgrade (UTC+1 in
 * winter), so a predicate that read the day or the year in UTC would answer the wrong one for the first hour
 * of the year, which is the hour this decision is about.
 */
class TheDayOfAnEventTest {

	private static final LocalDate THE_NEW_YEARS_EVE = LocalDate.of(2027, 12, 31);

	private static final LocalDate NEW_YEARS_DAY = LocalDate.of(2028, 1, 1);

	private static final LocalDate TOMORROW = LocalDate.of(2028, 1, 2);

	private static TheDayOfAnEvent.Standing anEventOn(LocalDate day) {
		return new TheDayOfAnEvent.Standing(1, "noc-2028", "Noc", day, "race");
	}

	private static boolean pulled(LocalDate eventDay, LocalDate beginning, String atUtc) {
		return TheDayOfAnEvent.pullsAnEventStillAheadIntoTheYearJustEnded(anEventOn(eventDay), beginning,
				ZonedDateTime.parse(atUtc));
	}

	/** The one case that is refused, so each case below turns exactly one of its halves from it. */
	@Test
	void anEventThatIsAheadIsPulledIntoTheYearJustEndedByARaceOfNewYearsEveBeforeTen() {
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2028-01-01T08:59:59Z")).isTrue();
	}

	/** The window is the ten hours of 1 January in Belgrade: 09:59:59 inside it, 10:00:00 outside. */
	@Test
	void theWindowClosesAtTenOClockInBelgradeAndNotAtTenInUtc() {
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2028-01-01T09:00:00Z")).as("10:00:00 in Belgrade")
				.isFalse();
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2028-01-01T08:00:00Z")).as("09:00:00 in Belgrade")
				.isTrue();
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2028-01-01T10:00:00Z")).as("11:00:00 in Belgrade")
				.isFalse();
	}

	/** The window opens at midnight in Belgrade, an hour before it does in UTC. */
	@Test
	void theWindowOpensAtMidnightInBelgradeAndNotInUtc() {
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2027-12-31T23:00:00Z")).as("00:00:00 in Belgrade")
				.isTrue();
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2027-12-31T22:59:59Z")).as("23:59:59 on the 31st")
				.isFalse();
	}

	/** Outside 1 January, whatever the other two halves say. */
	@Test
	void onNoOtherDayOfTheYearIsAnythingPulled() {
		assertThat(pulled(LocalDate.of(2028, 6, 2), LocalDate.of(2027, 12, 31), "2028-06-01T08:00:00Z"))
				.isFalse();
		assertThat(pulled(LocalDate.of(2029, 1, 2), LocalDate.of(2028, 12, 31), "2028-12-31T08:00:00Z"))
				.as("the 31st is the last day of the year that was running, not the first of the one that ended")
				.isFalse();
	}

	/**
	 * Still ahead is strictly after today, in the league's day: an event dated today is not ahead, and one
	 * dated tomorrow is. Asked at 00:30 in Belgrade, which is still the 31st in UTC, so the day read in UTC
	 * makes today's event look like tomorrow's.
	 */
	@Test
	void anEventDatedTodayIsNotAheadAndOneDatedTomorrowIs() {
		assertThat(pulled(NEW_YEARS_DAY, THE_NEW_YEARS_EVE, "2027-12-31T23:30:00Z")).isFalse();
		assertThat(pulled(NEW_YEARS_DAY, THE_NEW_YEARS_EVE, "2028-01-01T08:00:00Z")).isFalse();
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2027-12-31T23:30:00Z")).isTrue();
		assertThat(pulled(LocalDate.of(2028, 1, 5), THE_NEW_YEARS_EVE, "2028-01-01T08:00:00Z"))
				.as("the owner's own example: the event of the 5th")
				.isTrue();
	}

	/**
	 * A race of the year just ended, and nothing older or newer: the day the event WOULD BEGIN ON is asked,
	 * and an event that begins in the new year is not pulled back. A race of the year before the year just
	 * ended is written down as outside the owner's sentence (it says „iz stare godine”, the year that has
	 * just ended), which is a reading of mine and one line to change.
	 */
	@Test
	void onlyTheYearJustEndedIsTheYearItIsPulledInto() {
		assertThat(pulled(TOMORROW, NEW_YEARS_DAY, "2028-01-01T08:00:00Z")).as("a race of the new year")
				.isFalse();
		assertThat(pulled(TOMORROW, LocalDate.of(2026, 12, 31), "2028-01-01T08:00:00Z"))
				.as("a race of the year before the one that ended").isFalse();
	}
}

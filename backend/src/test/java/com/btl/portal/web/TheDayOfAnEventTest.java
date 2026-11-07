package com.btl.portal.web;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link TheDayOfAnEvent#pullsAnEventStillAheadIntoTheYearJustEnded}: AN EVENT STILL AHEAD AND A RACE OF THE YEAR
 * JUST ENDED, AT ANY TIME OF THE YEAR (PDL P9, owner, 07.11.2026, „Trka koja bi događaj koji još predstoji
 * povukla u prošlu godinu odbija se uvek, na svim putevima ... ne samo u prozoru 1.1."; before that, 06.11.2026,
 * „U prozoru 1. januara od 00:00 do 10:00 server odbija trku iz stare godine na događaju koji još predstoji").
 *
 * <p>No database and no route: the question is a function of three values, and each of its halves is given a case
 * that turns only it. The moments are written in UTC and the league lives in Belgrade (UTC+1 in winter), so a
 * predicate that read the day or the year in UTC would answer the wrong one for the first hour of the year.
 */
class TheDayOfAnEventTest {

	private static final LocalDate THE_NEW_YEARS_EVE = LocalDate.of(2027, 12, 31);

	private static final LocalDate NEW_YEARS_DAY = LocalDate.of(2028, 1, 1);

	private static final LocalDate TOMORROW = LocalDate.of(2028, 1, 2);

	private static final String THE_MORNING_OF_THE_FIRST = "2028-01-01T08:00:00Z";

	private static final String MIDDLE_OF_JUNE = "2028-06-15T10:00:00Z";

	private static TheDayOfAnEvent.Standing anEventOn(LocalDate day) {
		return new TheDayOfAnEvent.Standing(1, "noc-2028", "Noc", day, "race");
	}

	private static boolean pulled(LocalDate eventDay, LocalDate beginning, String atUtc) {
		return TheDayOfAnEvent.pullsAnEventStillAheadIntoTheYearJustEnded(anEventOn(eventDay), beginning,
				ZonedDateTime.parse(atUtc));
	}

	/** The one case that is refused, so each case below turns exactly one of its halves from it. */
	@Test
	void anEventThatIsAheadIsPulledIntoTheYearJustEndedByARaceOfNewYearsEve() {
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2028-01-01T08:59:59Z")).isTrue();
	}

	/**
	 * THE MOMENT DOES NOT MATTER (07.11.2026): the second before the old window closed, the second it closed, the
	 * middle of June and the last day of the year all answer the same for an event that is ahead, and so does the
	 * first hour of the year, which is still 31 December in UTC.
	 */
	@Test
	void theMomentOfTheYearDoesNotChangeTheAnswer() {
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2028-01-01T09:00:00Z")).as("10:00:00 in Belgrade")
				.isTrue();
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2028-01-01T10:00:00Z")).as("11:00:00 in Belgrade")
				.isTrue();
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2027-12-31T23:00:00Z")).as("00:00:00 in Belgrade")
				.isTrue();
		assertThat(pulled(LocalDate.of(2028, 9, 1), THE_NEW_YEARS_EVE, MIDDLE_OF_JUNE)).as("15 June").isTrue();
		assertThat(pulled(LocalDate.of(2028, 12, 31), THE_NEW_YEARS_EVE, "2028-12-30T10:00:00Z"))
				.as("the day before the last of the year").isTrue();
	}

	/**
	 * THE YEAR IS THE LEAGUE'S, NOT UTC'S: at 23:59:59 in Belgrade on the 31st the year that is running is 2027, the
	 * race of the 31st is of that year and not of the one before it, and nothing is pulled; a second later the year
	 * is 2028 and the same race is of the year just ended.
	 */
	@Test
	void theYearIsReadInTheLeaguesZoneAtTheTurnOfTheYear() {
		assertThat(pulled(LocalDate.of(2028, 1, 2), THE_NEW_YEARS_EVE, "2027-12-31T22:59:59Z"))
				.as("23:59:59 on the 31st in Belgrade, the running year is 2027").isFalse();
		assertThat(pulled(LocalDate.of(2028, 1, 2), THE_NEW_YEARS_EVE, "2027-12-31T23:00:00Z"))
				.as("00:00:00 on the 1st in Belgrade, the running year is 2028").isTrue();
	}

	/**
	 * STILL AHEAD IS TODAY OR LATER, in the league's day (07.11.2026): an event dated today is ahead, one dated
	 * yesterday is not, one dated tomorrow is. Asked at 00:30 in Belgrade, which is still the 31st in UTC, so the
	 * day read in UTC makes today's event look like tomorrow's, and again in June, where nothing of the window is
	 * left to say it.
	 */
	@Test
	void anEventDatedTodayIsAheadAndOneDatedYesterdayIsNot() {
		assertThat(pulled(NEW_YEARS_DAY, THE_NEW_YEARS_EVE, "2027-12-31T23:30:00Z")).as("today, 00:30 Belgrade")
				.isTrue();
		assertThat(pulled(NEW_YEARS_DAY, THE_NEW_YEARS_EVE, THE_MORNING_OF_THE_FIRST)).as("today").isTrue();
		assertThat(pulled(TOMORROW, THE_NEW_YEARS_EVE, "2027-12-31T23:30:00Z")).as("tomorrow").isTrue();
		assertThat(pulled(LocalDate.of(2028, 1, 5), THE_NEW_YEARS_EVE, THE_MORNING_OF_THE_FIRST))
				.as("the owner's example: the event of the 5th").isTrue();
		assertThat(pulled(LocalDate.of(2028, 6, 15), THE_NEW_YEARS_EVE, MIDDLE_OF_JUNE)).as("today in June")
				.isTrue();
		assertThat(pulled(LocalDate.of(2028, 6, 14), THE_NEW_YEARS_EVE, MIDDLE_OF_JUNE))
				.as("yesterday in June: the event is over").isFalse();
		assertThat(pulled(THE_NEW_YEARS_EVE, LocalDate.of(2027, 12, 20), THE_MORNING_OF_THE_FIRST))
				.as("an event of the year just ended is not ahead on the 1st").isFalse();
	}

	/**
	 * A RACE OF THE YEAR JUST ENDED, and nothing older or newer: the day the event WOULD BEGIN ON is asked, and an
	 * event that begins in the running year is not pulled back. The year before the year just ended is written
	 * down as outside the owner's sentence (it says „u prošlu godinu"), which is a reading of mine and one
	 * comparison to change; so is the event of NEXT year given a race of this one, which is not pulled into a year
	 * that has ended.
	 */
	@Test
	void onlyTheYearJustEndedIsTheYearItIsPulledInto() {
		assertThat(pulled(TOMORROW, NEW_YEARS_DAY, THE_MORNING_OF_THE_FIRST)).as("a race of the new year")
				.isFalse();
		assertThat(pulled(TOMORROW, LocalDate.of(2026, 12, 31), THE_MORNING_OF_THE_FIRST))
				.as("a race of the year before the one that ended").isFalse();
		assertThat(pulled(LocalDate.of(2029, 3, 1), LocalDate.of(2028, 12, 30), MIDDLE_OF_JUNE))
				.as("an event of next year, a race of this one").isFalse();
		assertThat(pulled(LocalDate.of(2028, 9, 1), LocalDate.of(2028, 3, 1), MIDDLE_OF_JUNE))
				.as("a race of the running year").isFalse();
	}
}

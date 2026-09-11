package com.btl.portal.domain.season;

import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The three moments a season turns on, and the window a team is founded in.
 *
 * <p>Most of this file is about the zone. The three moments are trivial arithmetic
 * and the zone is the thing that is wrong on somebody else's machine and right on
 * yours - so every case names an instant in a zone that is NOT the league's, and
 * asks whether the answer is still the league's.
 */
class SeasonClockTest {

	private static final ZoneId UTC = ZoneId.of("UTC");
	private static final ZoneId TOKYO = ZoneId.of("Asia/Tokyo");

	/** The three moments of closing 2027, in order and six hours apart at the end. */
	@Test
	void theThreeMomentsOfClosingASeasonAreWhereTheyShouldBe() {
		assertThat(SeasonClock.racesEnd(2027))
				.isEqualTo(ZonedDateTime.of(2028, 1, 1, 0, 0, 0, 0, SeasonClock.ZONE));
		assertThat(SeasonClock.reportingEnds(2027))
				.isEqualTo(ZonedDateTime.of(2028, 1, 1, 10, 0, 0, 0, SeasonClock.ZONE));
		assertThat(SeasonClock.tablesFreeze(2027))
				.isEqualTo(ZonedDateTime.of(2028, 1, 1, 16, 0, 0, 0, SeasonClock.ZONE));

		assertThat(java.time.Duration.between(SeasonClock.reportingEnds(2027), SeasonClock.tablesFreeze(2027)))
				.as("the six hours a moderator has to get through the last reports are gone")
				.isEqualTo(java.time.Duration.ofHours(6));
	}

	/**
	 * The last second of the year belongs to the season.
	 *
	 * <p>Written as the start of 1 January rather than as 23:59:59 on 31 December,
	 * because "24:00" is not a time a clock has and the second form quietly loses a
	 * second - on the one night of the year when somebody is running a race that ends
	 * at midnight.
	 */
	@Test
	void theLastSecondOfTheYearStillBelongsToTheSeason() {
		ZonedDateTime aSecondBeforeMidnight =
				ZonedDateTime.of(2027, 12, 31, 23, 59, 59, 0, SeasonClock.ZONE);

		assertThat(aSecondBeforeMidnight.isBefore(SeasonClock.racesEnd(2027)))
				.as("a race finishing in the last second of the year fell outside the season")
				.isTrue();
	}

	/**
	 * THE ZONE IS THE LEAGUE'S, WHATEVER THE SERVER'S IS.
	 *
	 * <p>This is what the whole class exists for. Sixteen o'clock in Belgrade is
	 * fifteen in UTC in winter, so a season that froze "at 16:00" on a UTC server
	 * would freeze an hour early - and an hour early, on the one day of the year when
	 * everything is being reported at once, is not a rounding error.
	 */
	@Test
	void theZoneIsTheLeaguesWhateverTheServersIs() {
		ZonedDateTime freeze = SeasonClock.tablesFreeze(2027);

		assertThat(freeze.withZoneSameInstant(UTC).getHour())
				.as("sixteen in Belgrade is no longer fifteen in UTC, so the case measures nothing")
				.isEqualTo(15);

		/* A moment that is 16:00 by the clock in UTC is 17:00 in Belgrade, so the season
		   is already frozen - and a version that read the hour off the server would say
		   it was exactly then. */
		ZonedDateTime sixteenInUtc = ZonedDateTime.of(2028, 1, 1, 16, 0, 0, 0, UTC);

		assertThat(SeasonClock.isFrozen(2027, sixteenInUtc)).isTrue();
		assertThat(SeasonClock.isFrozen(2027, ZonedDateTime.of(2028, 1, 1, 14, 59, 0, 0, UTC)))
				.as("the season froze an hour early, which is what a server in UTC would do")
				.isFalse();
	}

	/** Frozen from the moment itself, and not a second before. */
	@Test
	void theSeasonIsFrozenFromThatMomentAndNotASecondBefore() {
		assertThat(SeasonClock.isFrozen(2027, SeasonClock.tablesFreeze(2027))).isTrue();
		assertThat(SeasonClock.isFrozen(2027, SeasonClock.tablesFreeze(2027).minusSeconds(1))).isFalse();
		assertThat(SeasonClock.isFrozen(2027, SeasonClock.tablesFreeze(2027).plusYears(5))).isTrue();
	}

	/**
	 * The transfer window is October to December, read in the league's zone.
	 *
	 * <p>The Tokyo case is the one that matters: the last hours of 30 September in
	 * Belgrade are already 1 October in Tokyo, and a member there must not be able to
	 * found a team before the window opens for everybody else.
	 */
	@Test
	void theTransferWindowIsOctoberToDecemberInTheLeaguesZone() {
		assertThat(SeasonClock.transferWindowOpen(ZonedDateTime.of(2027, 9, 30, 23, 59, 0, 0, SeasonClock.ZONE)))
				.as("the window opened before October")
				.isFalse();
		assertThat(SeasonClock.transferWindowOpen(ZonedDateTime.of(2027, 10, 1, 0, 0, 0, 0, SeasonClock.ZONE)))
				.isTrue();
		assertThat(SeasonClock.transferWindowOpen(ZonedDateTime.of(2027, 12, 31, 23, 59, 0, 0, SeasonClock.ZONE)))
				.isTrue();
		assertThat(SeasonClock.transferWindowOpen(ZonedDateTime.of(2028, 1, 1, 0, 0, 0, 0, SeasonClock.ZONE)))
				.as("the window stayed open into January")
				.isFalse();

		/* Midday on 1 October in Tokyo is five in the morning in Belgrade - the window is
		   open for both. An hour earlier in Belgrade it is still September, and this is
		   the shape that catches a version reading the month off the caller's zone. */
		ZonedDateTime lateSeptemberInBelgrade = ZonedDateTime.of(2027, 9, 30, 23, 0, 0, 0, SeasonClock.ZONE);

		assertThat(lateSeptemberInBelgrade.withZoneSameInstant(TOKYO).getMonthValue())
				.as("it is no longer already October in Tokyo, so the case measures nothing")
				.isEqualTo(10);
		assertThat(SeasonClock.transferWindowOpen(lateSeptemberInBelgrade.withZoneSameInstant(TOKYO)))
				.as("somebody in Tokyo could found a team before the window opened for anybody else")
				.isFalse();
	}

	/**
	 * Which season somebody is paying for, which is next year inside the window and
	 * this year outside it.
	 *
	 * <p>Owner, 31.07.2026: "ko 25. oktobra plati narednu sezonu, istog dana je
	 * vidljiv u pregledu clanova". What he paid for is 2028 while everybody else is
	 * still running 2027.
	 */
	@Test
	void insideTheWindowSomebodyPaysForNextYearAndOutsideItForThisOne() {
		assertThat(SeasonClock.seasonBeingPaidFor(
				ZonedDateTime.of(2027, 10, 25, 12, 0, 0, 0, SeasonClock.ZONE))).isEqualTo(2028);
		assertThat(SeasonClock.seasonBeingPaidFor(
				ZonedDateTime.of(2027, 9, 30, 12, 0, 0, 0, SeasonClock.ZONE))).isEqualTo(2027);
		assertThat(SeasonClock.seasonBeingPaidFor(
				ZonedDateTime.of(2027, 3, 15, 12, 0, 0, 0, SeasonClock.ZONE))).isEqualTo(2027);

		assertThat(SeasonClock.seasonBeingPaidFor(
				ZonedDateTime.of(2027, 9, 30, 23, 0, 0, 0, SeasonClock.ZONE).withZoneSameInstant(TOKYO)))
				.as("a member in Tokyo was sold next season while it was still September here")
				.isEqualTo(2027);
	}

	/**
	 * And the YEAR is the league's too, not the caller's.
	 *
	 * <p>Its own case because the one above measures the zone only through the MONTH,
	 * and a round on 11.09.2026 measured what that misses: a version reading the month
	 * off the league but the year off the caller passed every case in this file. The
	 * two answers can only differ where the year differs between the zones, so the
	 * moment has to be New Year's Eve and nothing else.
	 *
	 * <p>Half past eleven on 31 December in Belgrade is already half past seven on 1
	 * January in Tokyo. The league is inside the window and in 2027, so the answer is
	 * 2028; read off Tokyo it would be 2028 plus one, and somebody would be sold a
	 * season that is two years out.
	 */
	@Test
	void andTheYearIsTheLeaguesTooWhereverTheCallerIs() {
		ZonedDateTime newYearsEveHere = ZonedDateTime.of(2027, 12, 31, 23, 30, 0, 0, SeasonClock.ZONE);

		assertThat(newYearsEveHere.withZoneSameInstant(TOKYO).getYear())
				.as("it is not already next year in Tokyo, so this case measures nothing")
				.isEqualTo(2028);

		assertThat(SeasonClock.seasonBeingPaidFor(newYearsEveHere.withZoneSameInstant(TOKYO)))
				.as("a member in Tokyo was sold a season two years out because the year came from his clock")
				.isEqualTo(2028);
	}

	/**
	 * NOTHING BEFORE THE FIRST SEASON IS EVER OFFERED, whatever the calendar says.
	 *
	 * <p>PDL P8 names this case in as many words: "Sezona u ponudi ne moze biti pre
	 * prve. Kalendarski odgovor kroz leto 2026. je 2026, a sezone 2026. nema (P2), pa
	 * je odgovor 2027." A round on 11.09.2026 measured it live rather than in theory:
	 * asked about that same day, the answer was 2026, a season nothing on the portal
	 * has - no table, no standing, no price row.
	 *
	 * <p>Both sides of the clamp are here. Below the first season the answer is the
	 * first season; at and above it the calendar decides, so a version that simply
	 * always answered {@link SeasonClock#FIRST_SEASON} fails on the second half.
	 */
	@Test
	void aSeasonBeforeTheFirstOneIsNeverOffered() {
		assertThat(SeasonClock.seasonBeingPaidFor(
				ZonedDateTime.of(2026, 7, 15, 12, 0, 0, 0, SeasonClock.ZONE)))
				.as("a member was sold season 2026, which the portal has no table for")
				.isEqualTo(SeasonClock.FIRST_SEASON);

		/* January 2026, which is outside the window: the calendar answer is 2026 by the
		   other branch as well, so both branches are held down. */
		assertThat(SeasonClock.seasonBeingPaidFor(
				ZonedDateTime.of(2026, 1, 5, 12, 0, 0, 0, SeasonClock.ZONE)))
				.isEqualTo(SeasonClock.FIRST_SEASON);

		/* October 2026 IS inside the window, and there the calendar already answers 2027
		   on its own. The clamp must not be what makes this one right, or the case above
		   would be the only thing measuring it. */
		assertThat(SeasonClock.seasonBeingPaidFor(
				ZonedDateTime.of(2026, 10, 25, 12, 0, 0, 0, SeasonClock.ZONE)))
				.isEqualTo(2027);

		/* And the clamp does not flatten everything that comes after it. */
		assertThat(SeasonClock.seasonBeingPaidFor(
				ZonedDateTime.of(2031, 3, 15, 12, 0, 0, 0, SeasonClock.ZONE)))
				.as("every season answered as the first one, which is the other way to be wrong")
				.isEqualTo(2031);
	}
}

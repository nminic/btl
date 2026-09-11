package com.btl.portal.domain.season;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * The moments a season turns on, all of them in Central European time.
 *
 * <p>PDL P9 replaced a single "everything locks on 31 December at 23:59" with three
 * moments, and the six hours between the last two are the whole point of the shape:
 *
 * <ol>
 *   <li><strong>31 December, 24:00</strong> - the season ends. A race has to have
 *       been run by then to be scored in it.
 *   <li><strong>1 January, 10:00</strong> - the last moment a member may report a
 *       result from the season that has just ended. It exists because of races run
 *       on 31 December.
 *   <li><strong>1 January, 16:00</strong> - the tables freeze and the snapshot
 *       becomes the official result of the season. The six hours are room for a
 *       moderator to get through the last reports.
 * </ol>
 *
 * <p><strong>Why the zone is written here and not left to the machine.</strong> The
 * server may be anywhere and its clock may be set to anything; the league is not.
 * A season that froze at 16:00 UTC would freeze an hour early in Belgrade in
 * winter, and "an hour early" on the one day of the year when everything is being
 * reported at once is not a rounding error. Owner, 11.08.2026: "Zamrzavanje okida
 * sat, ne covek", so the sat has to be the right one.
 */
public final class SeasonClock {

	/** The league's own time, which is not the server's. */
	public static final ZoneId ZONE = ZoneId.of("Europe/Belgrade");

	/** The first season the portal has, and nothing before it is a season at all. */
	public static final int FIRST_SEASON = 2027;

	private SeasonClock() {
	}

	/**
	 * The moment a season stops taking races.
	 *
	 * <p>Midnight at the end of 31 December, which is the same instant as the start of
	 * 1 January - written as the latter, because "24:00" is not a time a clock has and
	 * writing it as 23:59:59 would quietly lose the last second of the year.
	 */
	public static ZonedDateTime racesEnd(int season) {
		return LocalDate.of(season + 1, 1, 1).atStartOfDay(ZONE);
	}

	/** The last moment a member may report a result from the season just ended. */
	public static ZonedDateTime reportingEnds(int season) {
		return LocalDate.of(season + 1, 1, 1).atStartOfDay(ZONE).plusHours(10);
	}

	/** The moment the tables freeze and the snapshot becomes the official result. */
	public static ZonedDateTime tablesFreeze(int season) {
		return LocalDate.of(season + 1, 1, 1).atStartOfDay(ZONE).plusHours(16);
	}

	/**
	 * Whether a season is frozen at a given moment.
	 *
	 * <p>After this the season's tables are read rather than computed, and a result
	 * corrected afterwards shows on its member's profile and nowhere else (owner,
	 * 31.07.2026). That is deliberate and it is the price of history being history.
	 */
	public static boolean isFrozen(int season, ZonedDateTime at) {
		return !at.isBefore(tablesFreeze(season));
	}

	/**
	 * The transfer window: 1 October to 31 December, the same window membership is
	 * renewed in.
	 *
	 * <p>Owner, 05.09.2026: a team is founded only inside it, and a change of team
	 * takes effect on 1 January - so everything that moves who is in which team
	 * happens in one window rather than under two rules. Outside it the portal does
	 * not draw the button at all; it says when the window opens.
	 *
	 * @param at the moment being asked about, in any zone: it is read in the league's
	 */
	public static boolean transferWindowOpen(ZonedDateTime at) {
		int month = at.withZoneSameInstant(ZONE).getMonthValue();
		return month >= 10;
	}

	/**
	 * Which season somebody is joining or renewing for, at a given moment.
	 *
	 * <p>Inside the transfer window it is the next year; outside it, it is the year
	 * that is running. This is the sentence behind "ko 25. oktobra plati narednu
	 * sezonu, istog dana je vidljiv u pregledu clanova" (owner, 31.07.2026): what he
	 * paid for is 2028 while everybody else is still running 2027.
	 */
	public static int seasonBeingPaidFor(ZonedDateTime at) {
		ZonedDateTime here = at.withZoneSameInstant(ZONE);
		return transferWindowOpen(here) ? here.getYear() + 1 : here.getYear();
	}
}

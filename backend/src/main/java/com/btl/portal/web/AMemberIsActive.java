package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;

import java.time.ZonedDateTime;

/**
 * WHETHER A MEMBER IS ACTIVE AT A MOMENT, AS THE ONE SQL CONDITION EVERY STATEMENT THAT ASKS IT
 * IS BUILT WITH.
 *
 * <p>PDL, „Članstvo je činjenica po sezoni" (13.09.2026): „Zastavica „aktivan" prestaje da bude
 * podatak i postaje izvedena: aktivan je onaj ko ima zapis za tekuću sezonu, a u prelaznom roku i
 * onaj ko ga ima za narednu." So the answer is read off {@code membership}, a row of which names a
 * season, and never off {@code competitor.active}, which names none. Which seasons count at a moment
 * is {@link SeasonClock#seasonsAMemberIsActiveIn}, decided in the domain and nowhere else.
 *
 * <p><b>{@code competitor.active} is still WRITTEN, and on purpose.</b> The writers keep it as they
 * did, so that a step back to the column is a revert and not a repair; the column goes in a migration
 * of its own once this is on QA. Nothing in {@code src/main} reads it, which
 * {@code NothingReadsTheFlagTest} holds.
 *
 * <p><b>The clock is Java's and never the database's</b>, and it is read once by the caller: the two
 * seasons are written into the statement as whole numbers, which is the shape
 * {@link WhenASeasonWasActivated#of} and {@link AMembershipOfTheSeasonHeWouldJoin#heHoldsIt} keep. A
 * statement that asked {@code current_date} would answer by the database's zone and by a second
 * reading of the moment, free to disagree with the one the request took.
 *
 * <p>Numbers made here and not typed by anybody, so writing them into the text of the statement opens
 * nothing a parameter would keep shut.
 */
final class AMemberIsActive {

	private AMemberIsActive() {
	}

	/**
	 * The condition, true exactly when the competitor named by {@code competitorColumn} holds a season
	 * that makes him active at {@code at}.
	 *
	 * @param competitorColumn an SQL expression naming a {@code competitor.id}, such as {@code c.id} or
	 *                         {@code ?}
	 * @param at               the moment the request reads the clock at, once
	 */
	static String of(String competitorColumn, ZonedDateTime at) {
		SeasonClock.ActiveSeasons seasons = SeasonClock.seasonsAMemberIsActiveIn(at);

		return "exists(select 1 from membership active_in where active_in.competitor_id = " + competitorColumn
				+ " and active_in.season between " + seasons.first() + " and " + seasons.last() + ")";
	}
}

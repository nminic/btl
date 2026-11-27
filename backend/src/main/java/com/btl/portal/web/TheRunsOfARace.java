package com.btl.portal.web;

import com.btl.portal.domain.event.WhatARaceCarries;
import com.btl.portal.domain.event.WhatARaceCarries.ARace;
import com.btl.portal.domain.event.WhatARaceCarries.Figures;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * THE RUNS AT A RACE AND THE ONE WAY THEY ARE COUNTED AGAIN AT IT.
 *
 * <p>PDL P4, owner, 15.11.2026: „Rezultat na trci zadate dužine uvek nosi dužinu, uspon i spust svoje
 * trke i bodove izračunate iz njih". Every change of a race that moves what the race fixes counts its
 * runs again ({@link RaceWriteApi}, which tells each member whose run moved), and what a run is
 * counted at, and whether it needs writing at all, is answered here once.
 *
 * <p><b>Nothing here asks the season, the inbox or the ducats.</b> A frozen season is not asked
 * about either, on purpose: the rule is the same before 2027, in a season that has frozen and in
 * the one being run, and the tables of a frozen season are a snapshot this class never reads or
 * writes. The points come out of {@link PointsOfARun}, that is {@code BtlScoreCalculator}, and never
 * out of a statement of SQL.
 */
final class TheRunsOfARace {

	private static final String THE_COLUMNS = "id, competitor_id, distance_km, ascent_m, descent_m,"
			+ " seconds, points";

	private TheRunsOfARace() {
	}

	/** One row of {@code result} at a race: whose it is, the four figures it was counted at, and the
	 *  points they were worth. */
	record Counted(long id, long member, Figures figures, BigDecimal points) {
	}

	/** A run that was written over: as it stood, and the four figures and the points it now carries. */
	record Rewritten(Counted was, Figures figures, BigDecimal points) {
	}

	/** Every row of {@code result} at this race and no other, whoever's it is, in the order they were
	 *  written. The index V7 gave {@code (race_id, race_date)} leads with the race. */
	static List<Counted> at(JdbcClient db, long race) {
		return db.sql("select " + THE_COLUMNS + " from result where race_id = ? order by id")
				.param(race)
				.query((row, one) -> counted(row.getLong(1), row.getLong(2), row.getBigDecimal(3),
						row.getInt(4), row.getInt(5), row.getInt(6), row.getBigDecimal(7)))
				.list();
	}

	private static Counted counted(long id, long member, BigDecimal km, int ascent, int descent,
			int seconds, BigDecimal points) {
		return new Counted(id, member, new Figures(km, ascent, descent, seconds), points);
	}

	/**
	 * WHAT A RUN IS COUNTED AT NOW: what the race fixes comes off the race as written and what it
	 * leaves to the runner stays the runner's, the one function every other road asks
	 * ({@link WhatARaceCarries#figuresOf}), so a run counted again is counted exactly as an approval
	 * of it today would count it.
	 */
	private static Figures countedAt(ARace race, Counted run) {
		return WhatARaceCarries.figuresOf(race, run.figures());
	}

	/**
	 * EVERY RUN THE RACE GIVES OTHER FIGURES TO IS WRITTEN OVER, AND THE ONES IT LEAVES ALONE ARE NOT
	 * TOUCHED. Answers what it wrote, in the order of the runs, and writes no line of any inbox.
	 *
	 * @param id   {@code race.id}, as it stands in this transaction
	 * @param race the race as it is now written
	 * @param runs the runs at it, read before anything else moves ({@link #at})
	 */
	static List<Rewritten> countAgain(JdbcClient db, long id, ARace race, List<Counted> runs) {
		List<Rewritten> rewritten = new ArrayList<>();

		for (Counted run : runs) {
			Figures counted = countedAt(race, run);

			/* A RUN THE CORRECTION LEFT EXACTLY AS IT WAS IS NOT A RUN IT CHANGED, so nothing is
			   written over it and its member is not told about it. */
			if (isAsItWas(run, counted)) {
				continue;
			}

			/* AND NOTHING AT AN UNSCORED RACE (PointsOfARun, PDL 14.11.2026). */
			BigDecimal points = PointsOfARun.at(db, id, race.kind(), counted);

			db.sql("update result set distance_km = ?, ascent_m = ?, descent_m = ?, seconds = ?, points = ? where id = ?")
					.params(counted.distanceKm(), counted.ascentM(), counted.descentM(), counted.seconds(), points, run.id())
					.update();

			rewritten.add(new Rewritten(run, counted, points));
		}

		return rewritten;
	}

	/**
	 * WHETHER COUNTING THE RUNS AGAIN AT THE RACE AS IT IS ABOUT TO BE WRITTEN WOULD MAKE ONE OF THEM WORTH
	 * MORE THAN ANY RUN CAN BE ({@link PointsOfARun#impossible}), asked before the race is written
	 * ({@code RaceWriteApi.THE_RACE_WOULD_MAKE_A_RUN_IMPOSSIBLE}). Each run is counted exactly as
	 * {@link #countAgain} would count it, by the one function that says what the race fixes.
	 *
	 * @param id   {@code race.id}, whose being scored is asked of {@code scored_race} as every write asks it
	 * @param race the race as it is about to be written
	 * @param runs the runs at it, as they stand ({@link #at})
	 */
	static boolean wouldMakeOneImpossible(JdbcClient db, long id, ARace race, List<Counted> runs) {
		boolean scored = PointsOfARun.scored(db, id);

		return runs.stream().anyMatch(run -> PointsOfARun.impossible(scored, race.kind(), countedAt(race, run)));
	}

	/**
	 * WHETHER A RUN ALREADY CARRIES THE FOUR FIGURES IT WOULD BE COUNTED AT NOW, a length being
	 * compared as a number: it is one number whatever scale it was written at.
	 *
	 * <p><b>THE POINTS ARE NOT ASKED, and that is a measurement and not a shortcut.</b> They are a
	 * function of the four figures and of the kind of the race ({@link PointsOfARun#of}: a race to a
	 * limit is counted by a formula of its own from 27.11.2026), and a race that carries a counted run
	 * cannot change its kind ({@code RaceWriteApi}, the refusal beside {@code carriesACountedRun}), so
	 * they are a function of the four figures and of nothing else that moves. The only statements that write a figure
	 * of {@code result} are three: the approval ({@code VerificationWriteApi}, an insert and an update
	 * of the row), the league's own entry and change from the event page ({@code
	 * ResultsByTheLeagueApi}, an insert and an update) and the recount ({@link #countAgain}). All three
	 * work the points out from the very figures they store, no migration inserts into the table or
	 * updates it, and {@code ResultWriteApi} only deletes from it. Every length that reaches any of
	 * them is one the column keeps exactly ({@link WhatARaceCarries#distanceIsKeptExactly}, asked for
	 * the race, for the member's report and for the moderator's own figures), so the number the
	 * formula is handed is the number the row holds. A row whose four figures are the counted ones
	 * therefore already carries the points that would be written over it.
	 *
	 * <p><b>A comparison of the points stood here until 10.10.2026 and its false branch had no
	 * case.</b> The coverage threshold found it on the head of PR 504 (the branch ratio read
	 * 0.99), and the second round of review of that PR gave the reason: no road writes a row whose
	 * figures agree with the course and whose points do not, so the only case that could reach the
	 * branch is one that writes {@code result} by hand with points the formula does not give, and
	 * that measures the fixture and not the portal. A branch no road reaches is removed, and is not
	 * covered by a detour.
	 */
	private static boolean isAsItWas(Counted run, Figures counted) {
		return run.figures().distanceKm().compareTo(counted.distanceKm()) == 0
				&& run.figures().ascentM().equals(counted.ascentM())
				&& run.figures().descentM().equals(counted.descentM())
				&& run.figures().seconds().equals(counted.seconds());
	}
}

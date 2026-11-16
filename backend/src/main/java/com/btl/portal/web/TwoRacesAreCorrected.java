package com.btl.portal.web;

import com.btl.portal.domain.event.WhatARaceCarries.ARace;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * A ONE-OFF JOB, AND IT IS DELETED IN THE PR AFTER THE FIRST START OF THE SERVER THAT CARRIES IT ON
 * PRODUCTION: IT CORRECTS THE FIGURES OF TWO RACES AND COUNTS THEIR RUNS AGAIN, SILENTLY.
 *
 * <p><b>Why it exists.</b> PDL P4, owner, 16.11.2026, in the record of the import of the half marathons
 * of member 000004: the Bokeški polumaraton of 12.12.2021 (race 2334 on production) is corrected from
 * a climb of 78 and a fall of 0 to 71 and 71, and the race of 26.04.2026 at the event 1804 (race 2446)
 * from 0 and 0 to 382 and 382 and from the name „DU Motion Dubrovnik" to „Dubrovački polumaraton"
 * (the owner's change of the same day: the race is named so and the event stays as it is). Every run counted
 * at either is counted again, and two runs of other members are the ones that move: 000018 at the first
 * (9,88 to 10,22) and 000027 at the second (5,57 to 9,58), measured on production the same day, neither
 * in a frozen season.
 *
 * <p><b>Why it is a job and not the route.</b> The route that corrects a race ({@code PUT
 * /api/races/{id}}, {@link RaceWriteApi}) needs a signed-in administrator, and the owner chose that it
 * be done through code, in a small PR, and not by hand in the administration (PDL P4, 16.11.2026: he
 * chose between the options offered). <b>It is silent, and that is his choice against the
 * recommendation</b> that it tell the two members the usual way (PDL P4, 16.11.2026, the same record):
 * no line is written into any inbox here and none about a category.
 *
 * <p><b>What it does with the runs is the route's recount and no second answer</b>:
 * {@link TheRunsOfARace#countAgain}, the function {@link RaceWriteApi} asks too, which counts a run at
 * what the race fixes through {@code WhatARaceCarries.figuresOf} and takes its points from
 * {@link PointsOfARun}, that is {@code BtlScoreCalculator}. No points are ever written by a statement
 * of SQL of this class. The snapshot of a frozen season is never read or written: only {@code race}
 * and {@code result} are.
 *
 * <p><b>A RACE IS FOUND BY WHAT IT IS AND NOT BY A NUMBER THAT EXISTS ONLY ON PRODUCTION.</b> The key
 * of a race is the sequence of one database, so 2334 on another one is some other race. A race is
 * therefore the one on the day, under the name and with the climb and the fall that the correction
 * starts from ({@link Correction}), all four at once. On any other database, and on this one after the
 * first start, nothing matches and nothing is written. The length is not asked, because the correction
 * does not move it and a race of that day, name and course is the one.
 *
 * <p><b>{@code race.renamed} is not touched.</b> The correction names the race, and the flag says
 * whether the name was given by hand, which is a fact about how it got that name and not about this
 * one.
 *
 * <p><b>THEIR DUCATS FOLLOW, AFTER THE COMMIT</b> ({@link DucatsFollowTheResults}), for exactly the
 * members whose run was written over, the way the route does it. What a ducat announces is
 * {@link AwardingDucats}' and not this job's.
 *
 * <p><b>Idempotent, and a failure never stops the server.</b> Each correction is one transaction (the
 * race rows it finds are locked, written and their runs written over together), so a failure of one is
 * logged and the other is still made. It runs synchronously at start, before the first request.
 */
@Component
class TwoRacesAreCorrected implements ApplicationRunner {

	private static final Logger LOG = LoggerFactory.getLogger(TwoRacesAreCorrected.class);

	/**
	 * A race as it is found and as it is left: the day, the name and the climb and the fall it starts
	 * from, and the name, the climb and the fall it ends at.
	 */
	record Correction(LocalDate day, String name, int ascentM, int descentM, String correctedName,
			int correctedAscentM, int correctedDescentM) {
	}

	static final List<Correction> THE_CORRECTIONS = List.of(
			new Correction(LocalDate.of(2021, 12, 12), "Bokeški polumaraton", 78, 0,
					"Bokeški polumaraton", 71, 71),
			new Correction(LocalDate.of(2026, 4, 26), "DU Motion Dubrovnik", 0, 0,
					"Dubrovački polumaraton", 382, 382));

	private final JdbcClient db;

	private final TransactionTemplate inOneTransaction;

	private final DucatsFollowTheResults ducats;

	TwoRacesAreCorrected(JdbcClient db, TransactionTemplate inOneTransaction,
			DucatsFollowTheResults ducats) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
		this.ducats = ducats;
	}

	@Override
	public void run(ApplicationArguments arguments) {
		correct();
	}

	/**
	 * EVERY CORRECTION MADE, and then the ducats of the members written over.
	 *
	 * @return how many runs were written over
	 */
	int correct() {
		Set<Long> members = new TreeSet<>();
		int written = 0;

		for (Correction correction : THE_CORRECTIONS) {
			try {
				List<TheRunsOfARace.Rewritten> rewritten = inOneTransaction.execute(writing -> alignOne(correction));

				rewritten.forEach(run -> members.add(run.was().member()));
				written += rewritten.size();
			}
			catch (RuntimeException failed) {
				LOG.warn("the race of {} named {} was not corrected; the next start tries again",
						correction.day(), correction.name(), failed);
			}
		}

		ducats.follow(members);

		if (written > 0) {
			LOG.info("{} runs were counted again at the two corrected races", written);
		}

		return written;
	}

	/** One correction: the races it finds, locked, written, and their runs counted again. */
	List<TheRunsOfARace.Rewritten> alignOne(Correction correction) {
		List<Long> races = db.sql("select id from race where date = ? and name = ? and ascent_m = ?"
						+ " and descent_m = ? order by id for update")
				.params(correction.day(), correction.name(), correction.ascentM(), correction.descentM())
				.query(Long.class)
				.list();

		LOG.info("the race of {} named {} was found {} times", correction.day(), correction.name(),
				races.size());

		return races.stream().flatMap(race -> correctOne(race, correction).stream()).toList();
	}

	private List<TheRunsOfARace.Rewritten> correctOne(long race, Correction correction) {
		db.sql("update race set name = ?, ascent_m = ?, descent_m = ? where id = ?")
				.params(correction.correctedName(), correction.correctedAscentM(),
						correction.correctedDescentM(), race)
				.update();

		/* THE RACE AS IT NOW STANDS, read back and not built from the correction: a length the
		   correction does not move is the race's own. */
		ARace after = db.sql("select kind, distance_km, ascent_m, descent_m, limit_seconds from race"
						+ " where id = ?")
				.param(race)
				.query((row, one) -> new ARace(row.getString(1), row.getBigDecimal(2), row.getInt(3),
						row.getInt(4), row.getInt(5)))
				.single();

		return TheRunsOfARace.countAgain(db, race, after, TheRunsOfARace.at(db, race));
	}
}

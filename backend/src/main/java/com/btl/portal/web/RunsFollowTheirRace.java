package com.btl.portal.web;

import com.btl.portal.domain.event.WhatARaceCarries.ARace;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * A ONE-OFF JOB, AND IT IS DELETED IN THE PR AFTER THE FIRST RUN OF IT ON PRODUCTION: IT BRINGS EVERY
 * RESULT THAT DOES NOT CARRY THE FIGURES OF ITS RACE INTO LINE WITH THE RACE, SILENTLY.
 *
 * <p><b>Why it exists.</b> PDL P4, owner, 15.11.2026: „Rezultat na trci zadate dužine uvek nosi dužinu,
 * uspon i spust svoje trke i bodove izračunate iz njih, i u istoriji pre 2027 i u zamrznutoj sezoni".
 * Measured the same day, three results on production did not: 331 (Fruškogorski maraton 2015, the race
 * 42,2020 km, the result 42,2000), 1430 (Srebrno jezero 5k 2026, the race 5/5, the result 50/50) and 2986
 * (Larnaka marathon 2026-11-15, the race 72/72, the result 66/66). The owner decided that they are
 * corrected to the figures of their race with new points (PDL P4, „ODLUKE 15.11.2026, vlasnik, na
 * pitanja autora PR-a 739", (a)): <b>„TIHO, bez reda u sandučetu"</b> is the journal's gloss of his
 * answer, and so no line is written into any inbox here and none about a category.
 *
 * <p><b>It is not a standing net, and the owner said so</b> (the same record, (b), his words: „Hocu da se
 * ovo vise ne desava, nego da svaka promena automatski uredi i rezultate. Ako to mozes da mi
 * zagarantujes, ne treba da ostaje, zar ne?”). Every change of a race already counts its runs again
 * ({@link RaceWriteApi}, through {@link TheRunsOfARace}), so this runs once for the three and goes. The
 * PR that deletes it is the one after the first start of the server that carries it.
 *
 * <p><b>What it does is {@link RaceWriteApi}'s recount and no second answer.</b> A run is looked at
 * with the one function every road asks ({@code WhatARaceCarries.figuresOf}), written over by
 * {@link TheRunsOfARace#countAgain} with points from {@link PointsOfARun} (the calculator, never SQL),
 * and a run that already carries its race's figures is not touched. A race of a time or of nothing fixed
 * keeps what the runner brought, because that is what {@code figuresOf} says it fixes.
 *
 * <p><b>THE SEASON IS NOT ASKED, AND THE SNAPSHOT OF A FROZEN ONE IS NEVER READ OR WRITTEN.</b> The
 * tables of a season that has frozen are rows of {@code season_*}; this writes {@code result} and
 * nothing else ({@code RaceWriteApi} says the same of its own recount and holds it byte for byte).
 * Which season the three are in is therefore no condition, and the job guarantees it for any.
 *
 * <p><b>THEIR DUCATS FOLLOW, AFTER THE COMMITS</b> ({@link DucatsFollowTheResults}), for exactly the
 * members whose run was written over: 331 turns a marathon into an ultramarathon, and the permanent
 * ducats count categories. What a ducat announces is {@link AwardingDucats}' and not this job's.
 *
 * <p><b>Idempotent, so a second start finds nothing and writes nothing.</b> A race is looked at read
 * only, first; only a race with a run that disagrees is locked ({@code for update}, the race row, as
 * the route does) and written, one transaction each, so a failure of one is logged and the others are
 * still brought into line. It runs synchronously at start, before the first request, and a failure
 * never stops the server.
 */
@Component
class RunsFollowTheirRace implements ApplicationRunner {

	private static final Logger LOG = LoggerFactory.getLogger(RunsFollowTheirRace.class);

	private final JdbcClient db;

	private final TransactionTemplate inOneTransaction;

	private final DucatsFollowTheResults ducats;

	RunsFollowTheirRace(JdbcClient db, TransactionTemplate inOneTransaction, DucatsFollowTheResults ducats) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
		this.ducats = ducats;
	}

	@Override
	public void run(ApplicationArguments arguments) {
		align();
	}

	/**
	 * EVERY RACE WITH A RUN THAT DISAGREES WITH IT, and then the ducats of the members written over.
	 *
	 * @return how many runs were written over
	 */
	int align() {
		Set<Long> members = new TreeSet<>();
		int written = 0;
		Map<Long, List<TheRunsOfARace.Counted>> runs = TheRunsOfARace.byRace(db);

		for (Map.Entry<Long, List<TheRunsOfARace.Counted>> atTheRace : runs.entrySet()) {
			long race = atTheRace.getKey();

			try {
				if (!TheRunsOfARace.anyDisagrees(theRace(race, ""), atTheRace.getValue())) {
					continue;
				}

				List<TheRunsOfARace.Rewritten> rewritten = inOneTransaction.execute(writing -> alignOne(race));

				rewritten.forEach(run -> members.add(run.was().member()));
				written += rewritten.size();
			}
			catch (RuntimeException failed) {
				LOG.warn("the runs at race {} were not brought into line with it; the next start tries again",
						race, failed);
			}
		}

		ducats.follow(members);

		if (written > 0) {
			LOG.info("{} runs now carry the figures of their race", written);
		}

		return written;
	}

	/** One race, locked and read again inside the transaction that writes it. */
	List<TheRunsOfARace.Rewritten> alignOne(long race) {
		return TheRunsOfARace.countAgain(db, race, theRace(race, " for update"), TheRunsOfARace.at(db, race));
	}

	/** The race as it stands, with the lock the caller asks for: none for the question of whether it
	 *  needs a transaction at all, and its own row for the transaction that writes over its runs. */
	private ARace theRace(long race, String lock) {
		return db.sql("select kind, distance_km, ascent_m, descent_m, limit_seconds from race where id = ?"
						+ lock)
				.param(race)
				.query((row, one) -> new ARace(row.getString(1), row.getBigDecimal(2), row.getInt(3),
						row.getInt(4), row.getInt(5)))
				.single();
	}
}

package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * THE FREEZE OF A SEASON, AS FAR AS THE THRESHOLD OF TWELVE NEEDS IT: WHAT EVERY MEMBER HAD IN IT AT
 * 16:00 ON 1 JANUARY, WRITTEN DOWN ONCE.
 *
 * <p><b>PDL, owner, 30.10.2026</b>, „Prag od 12 bodova koji zatvara početničku broji bodove sezone u
 * trenutku njenog zamrzavanja": „Dakle mora u trenutku zamrzavanja sezone da ima 12 bodova da bi presla u
 * starosnu trajno (odnosno izgubila izbor da bude Pocetnik)." And PDL, 31.07.2026, „Zamrznuta sezona je
 * materijalizovan zapis, ne izračun": „Ista portalova radnja u 16:00 dodeljuje i kategorije za narednu
 * sezonu (P7)." So the points are written by the freeze and read by {@link BestOfficialSeason} from then
 * on; nothing written into the season afterwards reaches the right.
 *
 * <p><b>THIS IS THE FIRST PIECE OF THE 1 JANUARY JOB, AND THE REST OF IT JOINS THIS TRIGGER.</b> The
 * snapshot of the tables (V17, ADL A37) and the rest of what the journal gives 1 January (PDL P13) are not
 * written yet; when they are, they are written into {@link #freeze(int)}, under the same row of
 * {@code season_frozen}, and do not get a second trigger.
 *
 * <p><b>WHEN IT RUNS.</b> At 16:00 on 1 January by the league's clock ({@link SeasonClock#tablesFreeze}),
 * and every hour after the process starts, the first an hour after it. The hourly run follows the decision
 * of 19.09.2026 about the 1 January job („Ispadanje se upisuje, poslom koji se pokrene 1. januara u 16h po
 * CET"), whose accepted cost reads „dogovoreno je da je posao idempotentan i da se pokušava pri svakom
 * dizanju dok ne prođe". The hour before the first run is mine, copied from
 * {@link ThePicturesFolderIsSwept}'s reason: a run at start would run in every Spring context every test
 * class builds, against one database they all share, at whatever moment that context's clock says, and a
 * season frozen there would stay frozen for every class after it.
 *
 * <p><b>THE BOUNDARY, NAMED.</b> The snapshot is of the moment the job ran, not of 16:00 itself: a result
 * written between 16:00 and the run is in it. At 16:00 the cron runs within the second; it is wider only
 * where the server did not run at 16:00, and then nothing was written into the season either until it came
 * up, and at most the hour after that.
 *
 * <p><b>IDEMPOTENT, AND NEVER A SECOND SNAPSHOT.</b> The row of {@code season_frozen} is taken first and
 * {@code on conflict do nothing}; a season already frozen writes nothing more, so a run after a correction
 * cannot rewrite what the freeze found, which is the „trajno" of the decision.
 */
@Component
class ASeasonFreezes {

	private static final Logger LOG = LoggerFactory.getLogger(ASeasonFreezes.class);

	private final JdbcClient db;

	private final Clock clock;

	private final TransactionTemplate inOneTransaction;

	private final BestOfficialSeason bestOfficialSeason;

	ASeasonFreezes(JdbcClient db, Clock clock, TransactionTemplate inOneTransaction,
			BestOfficialSeason bestOfficialSeason) {
		this.db = db;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
		this.bestOfficialSeason = bestOfficialSeason;
	}

	/**
	 * EVERY SEASON THAT HAS FROZEN BY NOW AND HAS NO SNAPSHOT, given one. Each in a transaction of its own,
	 * so one that fails leaves the others written and is tried again on the next run.
	 */
	@Scheduled(cron = "0 0 16 1 1 *", zone = "Europe/Belgrade")
	@Scheduled(fixedDelay = 1, initialDelay = 1, timeUnit = TimeUnit.HOURS)
	void freeze() {
		ZonedDateTime now = clock.instant().atZone(SeasonClock.ZONE);

		for (int season = SeasonClock.FIRST_SEASON; SeasonClock.isFrozen(season, now); season++) {
			int frozen = season;

			if (Boolean.TRUE.equals(inOneTransaction.execute(writing -> freeze(frozen, now)))) {
				LOG.info("season {} is frozen: the points every member held in it are written down", frozen);
			}
		}
	}

	/**
	 * One season: its row of {@code season_frozen}, and the total each member held in it at this moment.
	 *
	 * @return whether this run froze it, false where it was frozen already
	 */
	private boolean freeze(int season, ZonedDateTime now) {
		int taken = db.sql("insert into season_frozen (season, frozen_at) values (?, ?) on conflict do nothing")
				.params(season, Timestamp.from(now.toInstant()))
				.update();

		if (taken == 0) {
			return false;
		}

		for (Map.Entry<Long, Map<Integer, BigDecimal>> member : bestOfficialSeason.live(null).entrySet()) {
			BigDecimal points = member.getValue().get(season);

			if (points != null) {
				db.sql("insert into season_points_at_freeze (season, competitor_id, points) values (?, ?, ?)")
						.params(season, member.getKey(), points)
						.update();
			}
		}

		return true;
	}
}

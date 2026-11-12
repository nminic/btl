package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.TransactionDefinition;
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
 * <p><b>AND EVERY TABLE OF THE SEASON IS WRITTEN UNDER THE SAME ROW</b> ({@link TheTablesOfASeason}, V84):
 * the standings, the teams, the top lists, the pairs, the leagues and the awards, so the freeze is one
 * act and not two (PDL, 26.09.2026, „Zamrzavanje je jedna portalova radnja u 16:00").
 *
 * <p><b>AND WHAT FOLLOWS THE FREEZE RUNS AFTER IT, IN THE SAME TRANSACTION</b> ({@link WhatFollowsTheFreeze};
 * ADL, 05.11.2026, „Posao od 1. januara: tri toka i jedan redosled"). Nothing else gets a trigger of its
 * own: two jobs at one second have no order, and the journal's is „zamrzavanje pa ispadanje, i ne bira
 * se" (PDL, derived 19.09.2026).
 *
 * <p><b>REPEATABLE READ, AND THAT IS WHAT „ONE READING" MEANS HERE.</b> The points at the freeze and the
 * tables are read by separate statements, and under the database's default each statement sees whatever
 * was committed when it began: an approval landing between two of them would give the threshold one sum
 * and the table another (PDL, 26.09.2026: „nad istim skupom odobrenog"). One picture for the whole act.
 * The transaction is its own and not the shared template's, so nothing else in the server is read this
 * way.
 *
 * <p><b>WHEN IT RUNS.</b> At 16:00 on 1 January by the league's clock ({@link SeasonClock#tablesFreeze}),
 * and once the process starts and every hour after that. The hourly run follows the decision of
 * 19.09.2026 about the 1 January job („Ispadanje se upisuje, poslom koji se pokrene 1. januara u 16h po
 * CET"), whose accepted cost reads „dogovoreno je da je posao idempotentan i da se pokušava pri svakom
 * dizanju dok ne prođe". <b>The first run is AT START and not an hour after it (PDL, owner, 05.11.2026,
 * „Potvrđeno: posao zamrzavanja proba odmah pri dizanju servera"):</b> a server that was down at 16:00
 * freezes the season the moment it is up, and not an hour later. The cost is that every Spring context
 * a test class builds runs it once, against the one database they all share, at whatever moment that
 * context's clock says. That is harmless before 1.1.2028 16:00, when {@link SeasonClock#isFrozen} is false
 * for the system clock and the run does nothing; a case that moves the clock past it freezes the seasons
 * behind it and must leave the rows it wrote as it found them.
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

	private final TheTablesOfASeason tables;

	private final ObjectProvider<WhatFollowsTheFreeze> followers;

	ASeasonFreezes(JdbcClient db, Clock clock, TransactionTemplate inOneTransaction,
			BestOfficialSeason bestOfficialSeason, TheTablesOfASeason tables, ObjectProvider<WhatFollowsTheFreeze> followers) {
		this.db = db;
		this.clock = clock;
		this.inOneTransaction = new TransactionTemplate(inOneTransaction.getTransactionManager());
		this.inOneTransaction.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
		this.bestOfficialSeason = bestOfficialSeason;
		this.tables = tables;
		this.followers = followers;
	}

	/**
	 * EVERY SEASON THAT HAS FROZEN BY NOW AND HAS NO SNAPSHOT, given one. Each in a transaction of its own,
	 * so one that fails leaves the others written and is tried again on the next run.
	 */
	@Scheduled(cron = "0 0 16 1 1 *", zone = "Europe/Belgrade")
	@Scheduled(fixedDelay = 1, initialDelay = 0, timeUnit = TimeUnit.HOURS)
	void freeze() {
		ZonedDateTime now = clock.instant().atZone(SeasonClock.ZONE);

		for (int season = SeasonClock.FIRST_SEASON; SeasonClock.isFrozen(season, now); season++) {
			int frozen = season;

			if (frozenAlready(frozen)) {
				continue;
			}

			if (Boolean.TRUE.equals(inOneTransaction.execute(writing -> freeze(frozen, now)))) {
				LOG.info("season {} is frozen: its points and every table of it are written down", frozen);
			}
		}
	}

	/**
	 * WHETHER THE SEASON HAS ITS ROW ALREADY, ASKED WITHOUT ANY LOCK AND OUTSIDE THE TRANSACTION OF THE FREEZE,
	 * so that an hourly run after 1 January 2028 costs the roads nothing for the seasons that are done.
	 *
	 * <p><b>Why the question is not free to ask inside.</b> This is a plain statement of its own, in no
	 * transaction. Asked inside the REPEATABLE READ one it would be the first SELECT, and the snapshot would be
	 * fixed before the lock below is taken, which is what {@link #freeze(int, ZonedDateTime)} says it must not
	 * be.
	 *
	 * <p><b>What it saves, measured 08.11.2026</b> (PENDING, review of PR 701, „cena brave"). The lock below is
	 * {@code SHARE ROW EXCLUSIVE}, and it was taken for every season that had frozen, every hour, before
	 * {@code on conflict do nothing} could say there was nothing to do. While a road holds {@code SHARE}
	 * ({@link ASeasonBegins#holdTheFreezeStill}) that request waits, and every {@code SHARE} that arrives
	 * after it queues behind it: the reviewer measured 3227 ms for a road behind a job that had nothing to
	 * write, against 339 ms without the job. A season that has its row needs no lock, because the row is the
	 * only thing the lock protects and nothing deletes it.
	 *
	 * <p><b>The answer can be out of date by the time the lock is held, and that is safe.</b> „No row" read
	 * here may be false a moment later, when another run froze the season in between. The statement that
	 * writes the row is {@code on conflict do nothing}, taken after the lock, and it is the second question:
	 * it answers 0 and the run writes nothing (see {@link #freeze(int, ZonedDateTime)}). „Row" read here is
	 * never out of date, since a row of {@code season_frozen} is never removed outside a test.
	 */
	private boolean frozenAlready(int season) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from season_frozen where season = ?)")
				.param(season)
				.query(Boolean.class)
				.single());
	}

	/**
	 * One season: its row of {@code season_frozen}, the total each member held in it at this moment, every
	 * table of it, and then whatever follows the freeze.
	 *
	 * @return whether this run froze it, false where it was frozen already
	 */
	private boolean freeze(int season, ZonedDateTime now) {
		/* THE LOCK THAT PUTS THIS RUN AND A CANCELLATION IN ORDER IS TAKEN BEFORE ANY SNAPSHOT: this transaction
		   reads at REPEATABLE READ, and its view is fixed when its first SELECT or data modification begins,
		   but LOCK TABLE is neither (PostgreSQL manual, „Explicit Locking"). Taken first, it makes a request that
		   holds the lock ({@link ASeasonBegins#holdingTheFreezeStill}) finish before this run reads anything,
		   so the run sees what the request committed; taken after the insert below, the run would already
		   hold the snapshot that does not. */
		db.sql("lock table season_frozen in share row exclusive mode").update();

		/* THE SECOND QUESTION: the row may have been written between {@link #frozenAlready} and the lock, by a
		   run of another process or by a case that holds the lock, and the lock was waited for. Nothing is
		   written then, and no second snapshot: that is the „trajno" of the decision. */
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

		tables.write(season);

		followers.orderedStream().forEach(follower -> follower.followTheFreezeOf(season));

		return true;
	}
}

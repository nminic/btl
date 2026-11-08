package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE JOB OF THE FREEZE TAKES ITS LOCK ONLY FOR A SEASON THAT HAS NO ROW YET, and takes nothing from the roads
 * for the seasons that are done (PENDING, review of PR 701, 07.11.2026, „cena brave").
 *
 * <p><b>The cost this closes.</b> The job runs once an hour for ever after 1 January 2028, and it asked for
 * {@code SHARE ROW EXCLUSIVE} on {@code season_frozen} for every season that had frozen, before
 * {@code on conflict do nothing} could say there was nothing to write. {@code SHARE ROW EXCLUSIVE} conflicts
 * with the {@code SHARE} that every road writing a membership holds ({@link ASeasonBegins#holdTheFreezeStill}),
 * so while one such road was in flight the request of the job waited, and every {@code SHARE} that arrived
 * after it queued behind the job, not behind the road: the reviewer measured 3227 ms for a second road against
 * 339 ms without the job, on a clean {@code postgres:18}, with nothing for the job to write.
 *
 * <p><b>The three things that have to stay true together.</b>
 * <ul>
 * <li>{@link #aSeasonThatFrozeAlreadyIsNotWaitedFor}: with a road in flight, the job for a frozen season
 * finishes and a second road is granted its lock at once. The second road is the measurement the reviewer
 * took, so it is the one that fails if the job queues.</li>
 * <li>{@link #aSeasonWithoutItsRowStillWaitsForTheRoadsInFlight}: the lock is NOT removed, only moved behind the
 * question. A season with no row waits for the road, which is what keeps a membership stamped before 16:00 in
 * the snapshot (PDL 05.11.2026), and then freezes.</li>
 * <li>{@link #aRowWrittenWhileTheJobWaitedIsNotWrittenAgain}: the answer „no row" is out of date once the lock
 * is held, so it is asked again, and the second answer decides. The row is the one that was written first and
 * no second snapshot is taken.</li>
 * </ul>
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AFrozenSeasonCostsTheRoadsNothingTest {

	private static final Instant THE_JOB_RUNS_AT = LocalDateTime.of(2028, 1, 1, 16, 0, 0)
			.atZone(SeasonClock.ZONE).toInstant();

	/** A road that wrote the row first: an hour earlier than the run that waited, so the two cannot be mixed up. */
	private static final Instant THE_ROW_WAS_WRITTEN_AT = THE_JOB_RUNS_AT.minus(Duration.ofHours(1));

	@Autowired
	private JdbcClient db;

	@Autowired
	private DataSource pool;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private TheTablesOfASeason tables;

	@AfterEach
	void theSeasonIsNotLeftFrozen() {
		inOneTransaction.executeWithoutResult(any -> {
			for (String table : List.of("season_award", "season_board", "season_pair", "season_league_standing",
					"season_league_column", "season_team", "season_competitor", "season_points_at_freeze",
					"season_frozen")) {
				db.sql("delete from " + table + " where season = 2027").update();
			}
		});
	}

	@Test
	void aSeasonThatFrozeAlreadyIsNotWaitedFor() throws Exception {
		theJob().freeze();

		assertThat(frozen()).as("the first run froze 2027").isOne();

		ExecutorService jobs = Executors.newSingleThreadExecutor();

		try (AHeldTransaction aRoadInFlight = new AHeldTransaction(pool)) {
			aRoadInFlight.db().sql("lock table season_frozen in share mode").update();

			Future<?> theHourlyRun = jobs.submit(() -> theJob().freeze());

			/* Polled and not slept: the run either ends by itself (nothing to wait for) or stands behind the
			   road, and a fixed wait would call the second answer the first on a machine that is slow. */
			Instant deadline = Instant.now().plusSeconds(10);

			while (!theHourlyRun.isDone() && aRoadInFlight.behind() < 1 && Instant.now().isBefore(deadline)) {
				Thread.sleep(20);
			}

			assertThat(theHourlyRun.isDone())
					.as("the run for a season that is frozen already ended while a road held SHARE").isTrue();
			theHourlyRun.get();

			assertThat(aRoadInFlight.behind()).as("and nothing stands behind the road").isZero();

			long waitedMillis = aSecondRoadAsksForItsLock();

			assertThat(waitedMillis).as("a second road was granted its lock at once, not queued behind the job")
					.isLessThan(1_000);
		} finally {
			jobs.shutdownNow();
		}
	}

	@Test
	void aSeasonWithoutItsRowStillWaitsForTheRoadsInFlight() throws Exception {
		ExecutorService jobs = Executors.newSingleThreadExecutor();

		try (AHeldTransaction aRoadInFlight = new AHeldTransaction(pool)) {
			aRoadInFlight.db().sql("lock table season_frozen in share mode").update();

			Future<?> theRun = jobs.submit(() -> theJob().freeze());

			aRoadInFlight.untilBehind(1, List.of(theRun));

			assertThat(theRun.isDone()).as("the run stands behind the road and has frozen nothing").isFalse();
			assertThat(frozen()).as("no row yet").isZero();

			aRoadInFlight.commit();
			theRun.get(60, TimeUnit.SECONDS);
		} finally {
			jobs.shutdownNow();
		}

		assertThat(frozen()).as("once the road ended the run froze 2027").isOne();
	}

	@Test
	void aRowWrittenWhileTheJobWaitedIsNotWrittenAgain() throws Exception {
		ExecutorService jobs = Executors.newSingleThreadExecutor();

		try (AHeldTransaction anotherRun = new AHeldTransaction(pool)) {
			anotherRun.db().sql("lock table season_frozen in share mode").update();

			Future<?> theRun = jobs.submit(() -> theJob().freeze());

			anotherRun.untilBehind(1, List.of(theRun));

			/* The row appears between the question the run asked and the lock it waits for. */
			anotherRun.db().sql("insert into season_frozen (season, frozen_at) values (2027, ?)")
					.param(Timestamp.from(THE_ROW_WAS_WRITTEN_AT)).update();
			anotherRun.commit();

			theRun.get(60, TimeUnit.SECONDS);
		} finally {
			jobs.shutdownNow();
		}

		assertThat(frozen()).as("one row").isOne();
		assertThat(db.sql("select frozen_at from season_frozen where season = 2027").query(Timestamp.class).single()
				.toInstant()).as("and it is the first one, not rewritten by the run that waited")
				.isEqualTo(THE_ROW_WAS_WRITTEN_AT);
		assertThat(db.sql("select count(*) from season_competitor where season = 2027").query(Long.class).single())
				.as("and the run that waited took no second snapshot (the tables of the season are as empty as the"
						+ " other run left them)")
				.isZero();
	}

	/** How long a second road waits for its {@code SHARE}, which fails the case after two seconds of queueing. */
	private long aSecondRoadAsksForItsLock() throws Exception {
		try (Connection road = pool.getConnection()) {
			road.setAutoCommit(false);

			try (Statement statement = road.createStatement()) {
				statement.execute("set local lock_timeout = '2s'");

				long started = System.nanoTime();

				statement.execute("lock table season_frozen in share mode");

				long waited = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);

				road.rollback();

				return waited;
			}
		}
	}

	private long frozen() {
		return db.sql("select count(*) from season_frozen where season = 2027").query(Long.class).single();
	}

	private ASeasonFreezes theJob() {
		return new ASeasonFreezes(db, Clock.fixed(THE_JOB_RUNS_AT, ZoneOffset.UTC), inOneTransaction, best, tables,
				new ObjectProvider<>() {
					@Override
					public Stream<WhatFollowsTheFreeze> orderedStream() {
						return Stream.empty();
					}
				});
	}
}

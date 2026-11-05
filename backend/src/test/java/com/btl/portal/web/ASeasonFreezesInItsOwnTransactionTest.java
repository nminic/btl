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

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE ACT IN THE TRANSACTION IT REALLY RUNS IN, which no case inside a test's own transaction can see:
 * there the act joins the test's transaction and takes its isolation and its rollback with it.
 *
 * <p>NOT TRANSACTIONAL, so what it writes is committed into the one database every test class shares,
 * and a frozen 2027 left behind would freeze 2027 for every class after this one. Each case therefore
 * takes the season apart again in {@link #theSeasonIsTakenApartAgain}, whatever happened.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ASeasonFreezesInItsOwnTransactionTest {

	@Autowired
	private JdbcClient db;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private TheTablesOfASeason tables;

	@AfterEach
	void theSeasonIsTakenApartAgain() {
		inOneTransaction.executeWithoutResult(any -> {
			for (String table : List.of("season_award", "season_board", "season_pair", "season_league_standing",
					"season_league_column", "season_team", "season_competitor", "season_points_at_freeze",
					"season_frozen")) {
				db.sql("delete from " + table + " where season = 2027").update();
			}
		});
	}

	/**
	 * PDL, 26.09.2026, „nad istim skupom odobrenog": the points at the freeze and the tables are read off
	 * one picture of the database, and what follows the freeze sees the row it follows.
	 */
	@Test
	void theActRunsInOneRepeatableReadAndWhatFollowsItSeesItsRow() {
		List<String> seen = new ArrayList<>();

		freezeWith(season -> seen.add(db.sql("select current_setting('transaction_isolation')").query(String.class)
				.single() + " / " + db.sql("select count(*) from season_frozen where season = ?").param(season)
						.query(Long.class).single()));

		assertThat(seen).containsExactly("repeatable read / 1");
	}

	@Test
	void aFollowerThatFailsLeavesTheSeasonUnfrozenForTheNextRun() {
		assertThatThrownBy(() -> freezeWith(season -> {
			throw new IllegalStateException("the pairs could not be broken");
		})).hasMessage("the pairs could not be broken");

		assertThat(db.sql("select count(*) from season_frozen where season = 2027").query(Long.class).single())
				.as("the row was kept without the act that follows it, and no later run would follow it again")
				.isZero();
	}

	private void freezeWith(WhatFollowsTheFreeze follower) {
		Instant at = LocalDateTime.of(2028, 1, 1, 16, 0).atZone(SeasonClock.ZONE).toInstant();

		new ASeasonFreezes(db, Clock.fixed(at, ZoneOffset.UTC), inOneTransaction, best, tables,
				new ObjectProvider<>() {
					@Override
					public Stream<WhatFollowsTheFreeze> orderedStream() {
						return Stream.of(follower);
					}
				}).freeze();
	}
}

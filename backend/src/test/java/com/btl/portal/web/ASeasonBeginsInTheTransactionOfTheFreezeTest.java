package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A BEGINNING THAT FAILS TAKES THE SNAPSHOT AND ITS ROW WITH IT, because it runs in the transaction of the
 * freeze ({@link WhatFollowsTheFreeze}) and not in one of its own.
 *
 * <p>NOT TRANSACTIONAL, for the reason {@link ASeasonFreezesInItsOwnTransactionTest} is not: inside a test's
 * transaction the act joins it and its rollback is the test's. What this writes is committed into the one
 * database every class shares, so {@link #theLeagueIsTakenApart} deletes it again, whatever happened.
 *
 * <p>The real {@link ASeasonBegins} is built over a team remover that throws at the very last step, after the
 * lapsed member has already been ended in his team: so what must be undone is a snapshot, a row of
 * {@code season_frozen} AND what the beginning itself wrote before it failed.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ASeasonBeginsInTheTransactionOfTheFreezeTest {

	@Autowired
	private JdbcClient db;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private TheTablesOfASeason tables;

	@Value("${btl.photos.folder}")
	private String photos;

	@BeforeEach
	void aLoneMemberWhoDidNotRenewInATeamOfHisOwn() {
		long aca = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, active,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values ('000951', 'Aca', 'Acic', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027, true,"
						+ " '0011223344000951', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.query(Long.class).single();

		HeldOn.season(db, aca, 2027, "feeExempt");

		long team = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values ('rollback-tim', 'Rollback tim', '', '',"
						+ " (select id from place where rank = 1), null, null, null, 2027, ?) returning id")
				.param(aca).query(Long.class).single();

		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
				+ " values (?, ?, 2027, null, null)").params(aca, team).update();
	}

	@AfterEach
	void theLeagueIsTakenApart() {
		inOneTransaction.executeWithoutResult(any -> {
			for (String table : List.of("season_award", "season_board", "season_pair", "season_league_standing",
					"season_league_column", "season_team", "season_competitor", "season_points_at_freeze",
					"season_frozen")) {
				db.sql("delete from " + table + " where season = 2027").update();
			}

			db.sql("delete from team where slug = 'rollback-tim'").update();
			db.sql("delete from membership where competitor_id in"
					+ " (select id from competitor where member_number = '000951')").update();
			db.sql("delete from competitor where member_number = '000951'").update();
		});
	}

	@Test
	void aBeginningThatFailsLeavesTheSeasonUnfrozenAndTheMemberInHisTeam() {
		ASeasonBegins failing = new ASeasonBegins(db, new ATeamGoesWithItsLastMember(db, photos) {
			@Override
			void takeAway(long team) {
				throw new IllegalStateException("the team could not be taken away");
			}
		});

		assertThatThrownBy(() -> freezeWith(failing)).hasMessage("the team could not be taken away");

		assertThat(db.sql("select count(*) from season_frozen where season = 2027").query(Long.class).single())
				.as("the row was kept, and no later run would drop anybody for the season it froze")
				.isZero();
		assertThat(db.sql("select count(*) from season_team where season = 2027").query(Long.class).single())
				.as("the snapshot was kept without the beginning that follows it").isZero();
		assertThat(db.sql("select count(*) from team_membership m join competitor c on c.id = m.competitor_id"
				+ " where c.member_number = '000951' and m.season_to is null").query(Long.class).single())
				.as("the member was ended in his team before the failure and must be in it again")
				.isOne();
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

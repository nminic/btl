package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT THE FREEZE WRITES DOWN AT 16:00 ON 1 JANUARY, AND THAT NOTHING AFTER IT MOVES IT.
 *
 * <p>The ladders are held to the screen's by {@link SeasonTablesTest}; this holds what goes INTO them
 * and what comes out on the rows: who stands in a frozen season, which runs it counts, who a team
 * counted, which pairs are on the board, what a league's grid holds, who holds an award, and that a
 * run entered, corrected or deleted afterwards changes none of it (PDL, 31.07.2026, „Rezultat se i
 * posle zamrzavanja sme uneti i ispraviti, ali se vidi samo na profilu tog člana").
 *
 * <p>Every fact here has a second place it could come from if the code were wrong, and the postavka
 * keeps the two apart: a member whose fee lapsed beside one whose fee stands, a member who left the
 * team in the window beside one who joined it for the next season, a pair with a lapsed half beside
 * one without, a run before the freeze beside one after.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class TheTablesOfASeasonTest {

	@Autowired
	private JdbcClient db;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private TheTablesOfASeason tables;

	@Autowired
	private ObjectProvider<WhatFollowsTheFreeze> followers;

	@BeforeEach
	void theSeasonOf2027() {
		/* Two men and two women who hold 2027 with the right to rank, one man who holds it WITHOUT
		   (activated after 31 March), and one man who holds no 2027 at all. */
		member("000301", "Ana", "Prva", "F", "1990-05-05");
		member("000302", "Bojan", "Drugi", "M", "1985-05-05");
		member("000303", "Vera", "Treca", "F", "1960-05-05");
		member("000304", "Goran", "Cetvrti", "M", "1985-05-05");
		member("000305", "Dejan", "Peti", "M", "1985-05-05");
		member("000306", "Djordje", "Sesti", "M", "1985-05-05");

		for (String number : List.of("000301", "000302", "000303", "000304")) {
			memberOf(number, 2027, "2026-09-01 10:00:00+00");
		}

		memberOf("000305", 2027, "2027-04-15 10:00:00+00");

		/* And a woman who holds 2027 with the right to rank and ran nothing in it. */
		member("000310", "Mila", "Deseta", "F", "1990-05-05");
		memberOf("000310", 2027, "2026-09-01 10:00:00+00");

		event("Prolece", "2027-04-04");
		race("Prolece", "Krug", 10, "2027-04-04");
		race("Prolece", "Polu", 21.1, "2027-04-04");
		event("Jesen", "2027-10-10");
		race("Jesen", "Jesenji krug", 10, "2027-10-10");

		run("000301", "Krug", 30.00);
		run("000302", "Krug", 25.00);
		run("000302", "Polu", 20.00);
		run("000303", "Jesenji krug", 12.00);
		run("000304", "Jesenji krug", 40.00);
		run("000305", "Krug", 99.00);
		run("000306", "Krug", 77.00);
	}

	@Test
	void theStandingsAreWrittenWithTheirPlacesNamesCategoriesAndTotals() {
		freezeAt(2028, 1, 1, 16, 0);

		assertThat(db.sql("select gender || position || ' ' || who || ' ' || category || '/' || category_position"
						+ " || ' ' || points || ' ' || races || ' ' || kilometers from season_competitor"
						+ " where season = 2027 order by gender, position").query(String.class).list())
				.containsExactly(
						"F1 Ana Prva Ž25-39/1 30.00 1 10.0000",
						"F2 Vera Treca Ž55+/1 12.00 1 10.0000",
						"M1 Bojan Drugi M40-54/1 45.00 2 31.1000",
						"M2 Goran Cetvrti M40-54/2 40.00 1 10.0000");
	}

	@Test
	void aMemberWithoutTheRightToRankIsInNoTableAndStillInThePointsAtTheFreeze() {
		freezeAt(2028, 1, 1, 16, 0);

		long dejan = idOf("000305");

		assertThat(db.sql("select count(*) from season_competitor where competitor_id = ?").param(dejan)
				.query(Long.class).single()).isZero();
		assertThat(db.sql("select count(*) from season_board where competitor_id = ?").param(dejan)
				.query(Long.class).single()).isZero();
		assertThat(db.sql("select points from season_points_at_freeze where competitor_id = ?").param(dejan)
				.query(String.class).single()).isEqualTo("99.00");
		assertThat(db.sql("select count(*) from season_competitor where competitor_id = ?").param(idOf("000306"))
				.query(Long.class).single()).as("a member with no 2027 at all stood in its table").isZero();
	}

	@Test
	void everyRankedMemberStandsOnThePointsTheThresholdReads() {
		freezeAt(2028, 1, 1, 16, 0);

		/* The two homes of „what he held at the freeze": V83's for the threshold, V17's for the table. */
		assertThat(db.sql("select count(*) from season_competitor c join season_points_at_freeze p"
						+ " on p.season = c.season and p.competitor_id = c.competitor_id"
						+ " where c.season = 2027 and p.points = c.points").query(Long.class).single())
				.isEqualTo(db.sql("select count(*) from season_competitor where season = 2027").query(Long.class)
						.single())
				.isEqualTo(4);
	}

	@Test
	void aMemberWhoseFeeLapsedStillStandsInTheSeasonHeHeld() {
		freezeAt(2028, 1, 1, 16, 0);

		assertThat(db.sql("select who from season_competitor where season = 2027 and gender = 'M' order by position")
				.query(String.class).list()).containsExactly("Bojan Drugi", "Goran Cetvrti");
	}

	@Test
	void nothingWrittenIntoTheSeasonAfterTheFreezeReachesItsTables() {
		freezeAt(2028, 1, 1, 16, 0);

		run("000303", "Krug", 50.00);
		db.sql("update result set points = 1 where competitor_id = ?").param(idOf("000304")).update();
		db.sql("delete from result where competitor_id = ?").param(idOf("000301")).update();

		freezeAt(2028, 1, 1, 17, 0);

		assertThat(db.sql("select who || ' ' || points from season_competitor where season = 2027"
						+ " order by gender, position").query(String.class).list())
				.containsExactly("Ana Prva 30.00", "Vera Treca 12.00", "Bojan Drugi 45.00", "Goran Cetvrti 40.00");
		assertThat(db.sql("select count(*) from season_board where season = 2027 and board = 'bestRace'")
				.query(Long.class).single()).isEqualTo(5);
	}

	@Test
	void aRunApprovedBeforeTheRunIsInAndTheSeasonStillRunningIsNotFrozen() {
		run("000303", "Krug", 50.00);

		freezeAt(2028, 1, 1, 15, 59);

		assertThat(db.sql("select count(*) from season_competitor").query(Long.class).single()).isZero();

		freezeAt(2028, 1, 1, 16, 0);

		assertThat(db.sql("select points from season_competitor where who = 'Vera Treca'").query(String.class)
				.single()).isEqualTo("62.00");
	}

	@Test
	void everyTopListIsWrittenWholeWithWhatItsKindCarries() {
		freezeAt(2028, 1, 1, 16, 0);

		assertThat(db.sql("select board || ':' || coalesce(length, '-') || ':' || position || ':' || who"
						+ " from season_board where season = 2027 and board <> 'bestRace'"
						+ " order by board, length, position").query(String.class).list())
				.containsExactly(
						"byLength:half:1:Bojan Drugi",
						"byLength:short:1:Goran Cetvrti",
						"byLength:short:2:Ana Prva",
						"byLength:short:3:Bojan Drugi",
						"byLength:short:4:Vera Treca",
						"kilometers:-:1:Bojan Drugi",
						"kilometers:-:2:Goran Cetvrti",
						"kilometers:-:3:Ana Prva",
						"kilometers:-:4:Vera Treca",
						"timeOnCourse:-:1:Bojan Drugi",
						"timeOnCourse:-:2:Goran Cetvrti",
						"timeOnCourse:-:3:Ana Prva",
						"timeOnCourse:-:4:Vera Treca");
		assertThat(db.sql("select position || ' ' || race_name || ' ' || points || ' ' || races from season_board"
						+ " where season = 2027 and board = 'bestRace' order by position").query(String.class).list())
				.containsExactly("1 Jesenji krug 40.00 1", "2 Krug 30.00 1", "3 Krug 25.00 1", "4 Polu 20.00 1",
						"5 Jesenji krug 12.00 1");
	}

	@Test
	void theListOfProgressReadsTheSeasonBeforeAtItsFreezeAndNotAsItStandsLater() {
		memberOf("000301", 2028, "2027-11-20 10:00:00+00");
		memberOf("000302", 2028, "2027-11-20 10:00:00+00");
		event("Leto", "2028-07-07");
		race("Leto", "Letnji krug", 10, "2028-07-07");

		freezeAt(2028, 1, 1, 16, 0);

		/* After 2027 froze, a correction would have taken Ana's 2027 from 30 to 5 points and Bojan's from
		   45 to 100: read live, she would gain and he would not. */
		db.sql("update result set points = 5 where competitor_id = ?").param(idOf("000301")).update();
		db.sql("update result set points = 50 where competitor_id = ?").param(idOf("000302")).update();

		run("000301", "Letnji krug", 31.00);
		run("000302", "Letnji krug", 50.00);

		freezeAt(2029, 1, 1, 16, 0);

		assertThat(db.sql("select who || ' ' || points || ' ' || previous_points from season_board"
						+ " where season = 2028 and board = 'progress' order by position").query(String.class).list())
				.containsExactly("Bojan Drugi 50.00 45.00", "Ana Prva 31.00 30.00");
	}

	@Test
	void aTeamCountsWhoLeftItInTheWindowAndNotWhoJoinedItForTheNextSeason() {
		team("tim-a", "Tim A");
		team("tim-b", "Tim B");
		team("tim-prazan", "Tim bez ikoga");
		inTeam("000302", "tim-a", 2027, 2027);
		inTeam("000304", "tim-a", 2027, null);
		inTeam("000305", "tim-a", 2027, null);
		inTeam("000301", "tim-b", 2027, null);
		inTeam("000303", "tim-b", 2028, null);

		freezeAt(2028, 1, 1, 16, 0);

		assertThat(db.sql("select position || ' ' || name || ' ' || points || ' ' || members || ' ' || races"
						+ " from season_team where season = 2027 order by position").query(String.class).list())
				.as("Bojan left Tim A in the window and counts for 2027; Vera joined Tim B for 2028 and does"
						+ " not; Dejan counts as a member and brings nothing; the empty team did not run")
				.containsExactly("1 Tim A 85.00 3 3", "2 Tim B 30.00 1 1");
		assertThat(db.sql("select t.name || ' ' || m.position || ' ' || m.who from season_team_member m"
						+ " join season_team t on t.id = m.season_team_id order by t.position, m.position")
				.query(String.class).list())
				.containsExactly("Tim A 1 Bojan Drugi", "Tim A 2 Goran Cetvrti", "Tim B 1 Ana Prva");
	}

	/**
	 * THE RING OF A FROZEN TEAM'S PAGE (PDL, owner, 06.11.2026, „posao zamrzavanja u 16:00 upisuje i broj trka
	 * tima po vrsti, pa trka upisana posle zamrzavanja ne menja krug te sezone"): per team, the runs its row adds
	 * up, each under the length it was run at.
	 *
	 * <p>Every count here has a second source kept apart from it: a member without the right to rank (Dejan,
	 * a short race) and one who joined for the next season (Vera, a short race) are in the teams and bring
	 * nothing; the second team runs a length the first does not; a marathon of 2027 is entered for the first
	 * team after the freeze; the season after is frozen with a marathon of its own for the same team; and the
	 * team is deleted at the end.
	 */
	@Test
	void aFrozenTeamKeepsHowManyRacesOfEachLengthItsRowAddsUpAndNothingEnteredAfterTheFreeze() {
		team("tim-a", "Tim A");
		team("tim-b", "Tim B");
		inTeam("000302", "tim-a", 2027, null);
		inTeam("000304", "tim-a", 2027, null);
		inTeam("000305", "tim-a", 2027, null);
		inTeam("000301", "tim-b", 2027, null);
		inTeam("000303", "tim-b", 2028, null);
		race("Jesen", "Maraton", 42.2, "2027-10-10");
		run("000301", "Maraton", 60.00);
		memberOf("000302", 2028, "2027-11-20 10:00:00+00");
		event("Leto", "2028-07-07");
		race("Leto", "Letnji maraton", 42.2, "2028-07-07");

		freezeAt(2028, 1, 1, 16, 0);

		run("000302", "Maraton", 50.00);
		run("000302", "Letnji maraton", 50.00);

		freezeAt(2029, 1, 1, 16, 0);
		db.sql("delete from team where slug = 'tim-a'").update();

		assertThat(db.sql("select t.season || ' ' || t.name || ' ' || l.length || ' ' || l.races"
						+ " from season_team_length l join season_team t on t.id = l.season_team_id"
						+ " order by t.season, t.name, l.length").query(String.class).list())
				.as("Tim A ran no marathon in 2027 until after its freeze, and Tim B ran the one of 2027; Dejan and"
						+ " Vera ran a short race each for their teams and bring none; 2028 is its own")
				.containsExactly("2027 Tim A half 1", "2027 Tim A short 2", "2027 Tim B marathon 1",
						"2027 Tim B short 1", "2028 Tim A marathon 1");
		assertThat(db.sql("select count(*) from season_team t where t.races <> (select coalesce(sum(l.races), 0)"
						+ " from season_team_length l where l.season_team_id = t.id)").query(Long.class).single())
				.as("the ring of a team adds up to the races its row counts").isZero();
	}

	@Test
	void aPairWithALapsedHalfStaysOnTheBoardOfTheSeasonItRan() {
		member("000309", "Jelena", "Deveta", "F", "1990-05-05");
		memberOf("000309", 2027, "2026-09-01 10:00:00+00");
		run("000309", "Krug", 9.00);
		pair(2027, "000302", "000301");
		pair(2027, "000304", "000303");
		pair(2027, "000305", "000309");
		run("000301", "Polu", 8.00);

		freezeAt(2028, 1, 1, 16, 0);

		/* `/api/pairs` answers only `man.active and woman.active`, so live the first pair is gone; the
		   third has a half without the right to rank and ran nothing that counts together. */
		assertThat(db.sql("select p.position || ' ' || h.half || ' ' || h.who || ' ' || p.points || ' ' || p.races"
						+ " from season_pair p join season_pair_half h on h.season_pair_id = p.id"
						+ " where p.season = 2027 order by p.position, h.half").query(String.class).list())
				.containsExactly("1 1 Bojan Drugi 83.00 2", "1 2 Ana Prva 83.00 2",
						"2 1 Goran Cetvrti 52.00 1", "2 2 Vera Treca 52.00 1");
	}

	@Test
	void aLeaguesGridStaysAsItWasWhenARaceLeavesItOrItsEventIsRenamed() {
		league("liga", "Liga 2027", 2027, "Krug", "Jesenji krug");

		freezeAt(2028, 1, 1, 16, 0);

		db.sql("delete from league_race where race_id = (select id from race where name = 'Jesenji krug')").update();
		db.sql("update btl_event set name = 'Preimenovana' where name = 'Prolece'").update();

		assertThat(db.sql("select position || ' ' || name || ' ' || date from season_league_column"
				+ " order by position").query(String.class).list())
				.containsExactly("1 Prolece 2027-04-04", "2 Jesen 2027-10-10");
		assertThat(db.sql("select s.gender || s.position || ' ' || s.who || ' ' || s.points || ' ['"
						+ " || string_agg(k.name || '=' || c.points, ', ' order by k.position) || ']'"
						+ " from season_league_standing s"
						+ " join season_league_cell c on c.season_league_standing_id = s.id"
						+ " join season_league_column k on k.id = c.season_league_column_id"
						+ " group by s.id order by s.gender, s.position").query(String.class).list())
				.containsExactly("F1 Ana Prva 30.00 [Prolece=30.00]", "F2 Vera Treca 12.00 [Jesen=12.00]",
						"M1 Goran Cetvrti 40.00 [Jesen=40.00]", "M2 Bojan Drugi 25.00 [Prolece=25.00]");
	}

	@Test
	void aLeagueOneGenderDidNotRunHasNoRowsOfThatGender() {
		league("liga-polu", "Liga polu", 2027, "Polu");

		freezeAt(2028, 1, 1, 16, 0);

		assertThat(db.sql("select gender || position || ' ' || who || ' ' || points from season_league_standing")
				.query(String.class).list()).containsExactly("M1 Bojan Drugi 20.00");
	}

	@Test
	void theAwardsArePersonalTeamAndPairAndOnlyForWhatRan() {
		team("tim-a", "Tim A");
		inTeam("000302", "tim-a", 2027, null);
		inTeam("000304", "tim-a", 2027, null);
		inTeam("000305", "tim-a", 2027, null);
		inTeam("000310", "tim-a", 2027, null);
		pair(2027, "000302", "000301");

		freezeAt(2028, 1, 1, 16, 0);

		assertThat(db.sql("select who from season_team_member order by position").query(String.class).list())
				.as("Mila stands on the team's page, at nought, so the trophy below is decided by what she ran")
				.containsExactly("Bojan Drugi", "Goran Cetvrti", "Mila Deseta");
		assertThat(db.sql("select kind || ':' || coalesce(category, '-') || ':' || position || ':' || who || ':'"
						+ " || points || ':' || coalesce(team_name, '-') from season_award where season = 2027"
						+ " order by kind, category, gender, position, who").query(String.class).list())
				.as("Dejan is on the team without the right to rank and Mila ran nothing: neither brought it points")
				.containsExactly(
						"category:M40-54:1:Bojan Drugi:45.00:-",
						"category:M40-54:2:Goran Cetvrti:40.00:-",
						"category:Ž25-39:1:Ana Prva:30.00:-",
						"category:Ž55+:1:Vera Treca:12.00:-",
						"overall:-:1:Ana Prva:30.00:-",
						"overall:-:2:Vera Treca:12.00:-",
						"overall:-:1:Bojan Drugi:45.00:-",
						"overall:-:2:Goran Cetvrti:40.00:-",
						"pair:-:1:Ana Prva:55.00:-",
						"pair:-:1:Bojan Drugi:55.00:-",
						"team:-:1:Bojan Drugi:85.00:Tim A",
						"team:-:1:Goran Cetvrti:85.00:Tim A");
	}

	@Test
	void onlyThreePlacesOfAStandingAreRewarded() {
		member("000307", "Zoran", "Sedmi", "M", "1985-05-05");
		memberOf("000307", 2027, "2026-09-01 10:00:00+00");
		run("000307", "Polu", 5.00);
		member("000308", "Ilija", "Osmi", "M", "1985-05-05");
		memberOf("000308", 2027, "2026-09-01 10:00:00+00");
		run("000308", "Polu", 3.00);

		freezeAt(2028, 1, 1, 16, 0);

		assertThat(db.sql("select who from season_award where kind = 'overall' and gender = 'M' order by position")
				.query(String.class).list()).containsExactly("Bojan Drugi", "Goran Cetvrti", "Zoran Sedmi");
		assertThat(db.sql("select count(*) from season_award where who = 'Ilija Osmi'").query(Long.class).single())
				.isZero();
	}

	@Test
	void aTeamThatRanNothingHoldsNoTrophyAndNeitherDoesASeasonWithoutPairs() {
		team("tim-nula", "Tim nula");
		inTeam("000305", "tim-nula", 2027, null);

		freezeAt(2028, 1, 1, 16, 0);

		assertThat(db.sql("select position || ' ' || points from season_team").query(String.class).list())
				.containsExactly("1 0.00");
		assertThat(db.sql("select count(*) from season_award where kind in ('team', 'pair')").query(Long.class)
				.single()).isZero();
	}

	@Test
	void aSeasonNobodyHeldWritesItsRowAndNoTable() {
		freezeAt(2029, 1, 1, 16, 0);

		assertThat(db.sql("select season from season_frozen order by season").query(Integer.class).list())
				.containsExactly(2027, 2028);
		assertThat(db.sql("select count(*) from season_competitor where season = 2028").query(Long.class).single())
				.isZero();
	}

	@Test
	void aMemberWhoAsksToGoTakesHisNameOutOfEveryTableAndLeavesThePlaces() {
		team("tim-a", "Tim A");
		inTeam("000302", "tim-a", 2027, null);
		pair(2027, "000302", "000301");

		freezeAt(2028, 1, 1, 16, 0);

		long bojan = idOf("000302");

		for (String table : List.of("season_competitor", "season_team_member", "season_board", "season_pair_half",
				"season_award")) {
			assertThat(db.sql("select count(*) from " + table + " where who = 'Bojan Drugi' and competitor_id = ?")
					.param(bojan).query(Long.class).single())
					.as("the postavka did not put him in %s, so the deletion below would measure nothing there", table)
					.isPositive();
		}

		forgetTheAccountOf(bojan);
		db.sql("delete from competitor where id = ?").param(bojan).update();

		for (String table : List.of("season_competitor", "season_team_member", "season_board", "season_pair_half",
				"season_award")) {
			assertThat(db.sql("select count(*) from " + table + " where who = 'Bojan Drugi'").query(Long.class)
					.single()).as("%s kept the name of a member who asked to go", table).isZero();
		}

		assertThat(db.sql("select position || ' ' || coalesce(who, '<nema>') || ' ' || points from season_competitor"
				+ " where gender = 'M' order by position").query(String.class).list())
				.containsExactly("1 <nema> 45.00", "2 Goran Cetvrti 40.00");
	}

	@Test
	void whatFollowsTheFreezeRunsOnceAfterTheTablesInsideTheAct() {
		List<String> seen = new ArrayList<>();
		WhatFollowsTheFreeze follower = season -> seen.add(season + " "
				+ db.sql("select count(*) from season_competitor where season = ?").param(season).query(Long.class)
						.single());
		Instant at = LocalDateTime.of(2028, 1, 1, 16, 0).atZone(SeasonClock.ZONE).toInstant();
		ASeasonFreezes freezes = new ASeasonFreezes(db, Clock.fixed(at, ZoneOffset.UTC), inOneTransaction, best,
				tables, providing(follower));

		freezes.freeze();
		freezes.freeze();

		assertThat(seen).as("called before the tables, or twice for one season").containsExactly("2027 4");
	}

	@Test
	void aFollowerThatFailsFailsTheRunRatherThanBeingSkipped() {
		WhatFollowsTheFreeze failing = season -> {
			throw new IllegalStateException("the pairs could not be broken");
		};
		Instant at = LocalDateTime.of(2028, 1, 1, 16, 0).atZone(SeasonClock.ZONE).toInstant();
		ASeasonFreezes freezes = new ASeasonFreezes(db, Clock.fixed(at, ZoneOffset.UTC), inOneTransaction, best,
				tables, providing(failing));

		assertThatThrownBy(freezes::freeze).hasMessage("the pairs could not be broken");
	}

	private ObjectProvider<WhatFollowsTheFreeze> providing(WhatFollowsTheFreeze follower) {
		return new ObjectProvider<>() {
			@Override
			public java.util.stream.Stream<WhatFollowsTheFreeze> orderedStream() {
				return java.util.stream.Stream.of(follower);
			}
		};
	}

	private void freezeAt(int year, int month, int day, int hour, int minute) {
		Instant at = LocalDateTime.of(year, month, day, hour, minute).atZone(SeasonClock.ZONE).toInstant();

		new ASeasonFreezes(db, Clock.fixed(at, ZoneOffset.UTC), inOneTransaction, best, tables, followers).freeze();
	}

	private long idOf(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number).query(Long.class).single();
	}

	private void member(String number, String first, String last, String gender, String born) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, cast(? as date),"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, born, "0011223344" + number).update();
	}

	private void memberOf(String number, int season, String decided) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', cast(? as timestamptz))")
				.params(number, season, decided).update();
	}

	private void event(String name, String day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, cast(? as date), null, 'Kraljevo',"
						+ " (select id from country where code = 'RS'), 'race', false, '', '')")
				.params("dogadjaj-" + name.toLowerCase(), name, day).update();
	}

	private void race(String event, String name, double kilometers, String day) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " cast(? as date), 'length', 0, ?, 0, 0)")
				.params("dogadjaj-" + event.toLowerCase(), name, day, kilometers).update();
	}

	private void run(String member, String raceName, double points) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " select (select id from competitor where member_number = ?), ra.id, ra.date, ra.distance_km,"
						+ " 0, 0, 3000, ? from race ra where ra.name = ?")
				.params(member, points, raceName).update();
	}

	private void team(String slug, String name) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values (?, ?, '', '', (select id from place where rank = 1), null, null, null, 2027,"
				+ " null)").params(slug, name).update();
	}

	private void inTeam(String member, String team, int from, Integer to) {
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), ?, ?, ?)")
				.params(member, team, from, to, to == null ? null : "left").update();
	}

	private void pair(int season, String man, String woman) {
		db.sql("insert into racing_pair (season, man_id, woman_id) values (?,"
						+ " (select id from competitor where member_number = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(season, man, woman).update();
	}

	private void league(String slug, String name, int season, String... races) {
		db.sql("insert into league (slug, name, season, rules, prizes) values (?, ?, ?, '', '')")
				.params(slug, name, season).update();

		for (String race : races) {
			db.sql("insert into league_race (league_id, season, race_id) values ((select id from league where slug = ?),"
					+ " ?, (select id from race where name = ?))").params(slug, season, race).update();
		}
	}

	/** The account goes first or the database refuses the member (PDL, 14.09.2026). */
	private void forgetTheAccountOf(long member) {
		db.sql("delete from account where competitor_id = ?").param(member).update();
	}
}

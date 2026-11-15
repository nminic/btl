package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * THE ONE-OFF JOB THAT BRINGS A RESULT THAT DOES NOT CARRY THE FIGURES OF ITS RACE INTO LINE WITH IT
 * ({@link RunsFollowTheirRace}; PDL P4, owner, 15.11.2026, the answers on PR 739).
 *
 * <p><b>The cases of production, not an invention.</b> The three results the owner named are rebuilt
 * with the figures measured on 15.11.2026: 331 at the Fruškogorski maraton (the race 42,2020 km, the
 * result 42,2000 km, so it turns from a marathon into an ultra), 1430 at the Srebrno jezero 5k (the race
 * 5/5, the result 50/50) and 2986 at the Larnaka marathon (the race 72/72, the result 66/66). The rows
 * are written the way the table already held them, which is what part 11 of the project's rules asks of
 * a change of what rows must satisfy: the job meets rows that stood before it, not rows it was written
 * for.
 *
 * <p><b>THE AXES.</b>
 * <ul>
 * <li><b>A run that disagrees, and one that does not, at the same race.</b> The Fruškogorski maraton
 * carries a second member's run that already stands at its 42,2020 km: a job that wrote over every run
 * of a race it touched rewrites it ({@code ctid} moves) and follows the member.
 * <li><b>The kind of the race.</b> A race of a length fixes the three figures of the course; a race to a
 * limit fixes the time and leaves the course to the runner; a free race fixes nothing. A run at the
 * six-hour race that already stands at the limit keeps a climb that is not the race's, one that does not
 * stands at the limit and keeps its own length, and a run at the free race is not touched at all.
 * <li><b>Whom it follows.</b> Exactly the members whose run was written over. A member whose run was not
 * moved, and who runs at the very same race as one who was, is not among them.
 * <li><b>Who is told.</b> Nobody: no row of {@code message} is written, by anybody, for anything.
 * <li><b>The second start.</b> Nothing is written ({@code ctid} of every row is the same) and nobody is
 * followed.
 * <li><b>A season that has frozen.</b> A result of a race of 2027, with the snapshot of 2027 written by
 * the freeze itself, is brought into line and every row of every table of the snapshot stays as it
 * froze; the points the live season holds move, so the comparison compares something.
 * <li><b>One race that cannot be written.</b> It is logged, the others are brought into line, and the
 * members of the others are followed.
 * </ul>
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class RunsFollowTheirRaceTest {

	private static final LocalDate THE_FRUSKA_DAY = LocalDate.parse("2015-04-19");

	private static final LocalDate THE_LAKE_DAY = LocalDate.parse("2026-05-03");

	private static final LocalDate THE_LARNACA_DAY = LocalDate.parse("2026-11-15");

	private static final LocalDate THE_SIX_HOURS_DAY = LocalDate.parse("2026-06-12");

	private static final LocalDate THE_FREE_ONES_DAY = LocalDate.parse("2026-07-03");

	private static final LocalDate A_DAY_OF_2027 = LocalDate.parse("2027-09-05");

	@Autowired
	private JdbcClient db;

	/** The job as the server has it, wrapped so that one race can be made to fail. */
	@MockitoSpyBean
	private RunsFollowTheirRace job;

	@MockitoBean
	private DucatsFollowTheResults ducats;

	@Autowired
	private BestOfficialSeason best;

	@Autowired
	private TheTablesOfASeason tables;

	@Autowired
	private TransactionTemplate transactions;

	private long fruska;

	private long lake;

	private long larnaca;

	private long sixHours;

	private long free;

	private long first;

	private long second;

	private long third;

	private long fourth;

	private long firstAtFruska;

	private long thirdAtFruska;

	private long secondAtTheLake;

	private long firstAtLarnaca;

	private long thirdAtTheSixHours;

	private long fourthAtTheSixHours;

	private long thirdAtTheFreeOne;

	private long theLastLine;

	@BeforeEach
	void threeResultsThatDoNotFollowTheirRaceAndFourThatDo() {
		clearInvocations(ducats);

		event("fruska-2015", "Fruskogorski maraton", THE_FRUSKA_DAY);
		event("jezero-2026", "Srebrno jezero 5k", THE_LAKE_DAY);
		event("larnaka-2026", "Larnaka marathon", THE_LARNACA_DAY);
		event("sest-sati-2026", "Sest sati", THE_SIX_HOURS_DAY);
		event("slobodna-2026", "Slobodna", THE_FREE_ONES_DAY);

		fruska = race("fruska-2015", "Maraton", THE_FRUSKA_DAY, "length", 0, "42.2020", 300, 280);
		lake = race("jezero-2026", "5k", THE_LAKE_DAY, "length", 0, "5", 5, 5);
		larnaca = race("larnaka-2026", "Maraton", THE_LARNACA_DAY, "length", 0, "42.2", 72, 72);
		sixHours = race("sest-sati-2026", "Sest sati", THE_SIX_HOURS_DAY, "time", 21600, "0", 350, 410);
		free = race("slobodna-2026", "Slobodna", THE_FREE_ONES_DAY, "free", 0, "0", 200, 210);

		first = competitor("000931", "0011223344557701");
		second = competitor("000932", "0011223344557702");
		third = competitor("000933", "0011223344557703");
		fourth = competitor("000934", "0011223344557704");

		/* 331, 1430 and 2986, in the figures measured on 15.11.2026. */
		firstAtFruska = result(first, fruska, "42.2", 300, 280, 14400, counted("42.2", 300, 280, 14400));
		secondAtTheLake = result(second, lake, "5", 50, 50, 1500, counted("5", 50, 50, 1500));
		firstAtLarnaca = result(first, larnaca, "42.2", 66, 66, 15000, counted("42.2", 66, 66, 15000));

		/* THE RUNS THAT ARE NOT TO MOVE: one at a race the job writes over, one at the limit with a
		   course of his own, one at a free race. */
		thirdAtFruska = result(third, fruska, "42.202", 300, 280, 15000, counted("42.202", 300, 280, 15000));
		thirdAtTheSixHours = result(third, sixHours, "61.3", 120, 130, 21600, counted("61.3", 120, 130, 21600));
		thirdAtTheFreeOne = result(third, free, "8.5", 60, 70, 3100, counted("8.5", 60, 70, 3100));

		/* AND ONE AT THE LIMIT THAT STANDS SHORT OF IT. */
		fourthAtTheSixHours = result(fourth, sixHours, "55", 90, 80, 20000, counted("55", 90, 80, 20000));

		theLastLine = db.sql("select coalesce(max(id), 0) from message").query(Long.class).single();
	}

	/**
	 * THE THREE RESULTS OF THE OWNER AND THE ONE AT THE LIMIT ARE WRITTEN OVER, each with the figures its
	 * race fixes and the points the calculator gives for them.
	 */
	@Test
	void everyRunThatDisagreesWithItsRaceCarriesItsFiguresAndPointsOfThemAfterwards() {
		assertThat(rowOf(firstAtFruska).category()).isEqualTo("marathon");

		assertThat(job.align()).as("the four runs the job is written for, and no other").isGreaterThanOrEqualTo(4);

		assertThat(rowOf(firstAtFruska)).as("331: a marathon turns into an ultra with its race")
				.isEqualTo(countedAt("42.202", 300, 280, 14400, "ultra"));
		assertThat(rowOf(secondAtTheLake)).as("1430: the climb and the fall of the race, with their points")
				.isEqualTo(countedAt("5", 5, 5, 1500, "short"));
		assertThat(rowOf(firstAtLarnaca)).as("2986")
				.isEqualTo(countedAt("42.2", 72, 72, 15000, "marathon"));
		assertThat(rowOf(fourthAtTheSixHours)).as("a race to a limit fixes the time and nothing else")
				.isEqualTo(countedAt("55", 90, 80, 21600, "ultra"));
	}

	/**
	 * A RUN THE RACE DOES NOT GIVE OTHER FIGURES TO IS NOT TOUCHED, even when it stands at a race the job
	 * has written over, and even when its climb is not the race's because the race does not fix it.
	 *
	 * <p>The comparison is {@code ctid}, the place of the row's current version, and not the figures: a
	 * job that wrote the same figures over a row would pass a comparison of them.
	 */
	@Test
	void aRunThatAlreadyCarriesWhatItsRaceFixesIsNotWrittenAtAll() {
		Map<Long, String> before = rowsAsWritten(thirdAtFruska, thirdAtTheSixHours, thirdAtTheFreeOne);

		job.align();

		assertThat(rowsAsWritten(thirdAtFruska, thirdAtTheSixHours, thirdAtTheFreeOne))
				.as("a row of a run that was already as its race has it was written over")
				.isEqualTo(before);
	}

	/**
	 * NOBODY IS TOLD, and the ducats follow exactly the members whose run was written over.
	 *
	 * <p>The third member has three runs and none moved, and one of them is at the race where the first
	 * member's moved: he is not followed. The second, the fourth and the first are.
	 */
	@Test
	void nothingIsWrittenIntoAnInboxAndTheDucatsOfExactlyTheMembersWrittenOverFollow() {
		job.align();

		assertThat(db.sql("select count(*) from message where id > ?").param(theLastLine).query(Long.class).single())
				.as("a line in an inbox: the owner decided it is silent").isZero();

		ArgumentCaptor<Collection<Long>> followed = ArgumentCaptor.captor();
		verify(ducats).follow(followed.capture());

		assertThat(followed.getValue()).contains(first, second, fourth).doesNotContain(third);
	}

	/** THE SECOND START FINDS NOTHING: not a row is written and nobody is followed. */
	@Test
	void aSecondRunWritesNothingAndFollowsNobody() {
		job.align();
		Map<Long, String> after = rowsAsWritten(firstAtFruska, secondAtTheLake, firstAtLarnaca,
				fourthAtTheSixHours, thirdAtFruska, thirdAtTheSixHours, thirdAtTheFreeOne);
		clearInvocations(ducats);

		assertThat(job.align()).isZero();

		assertThat(rowsAsWritten(firstAtFruska, secondAtTheLake, firstAtLarnaca, fourthAtTheSixHours,
				thirdAtFruska, thirdAtTheSixHours, thirdAtTheFreeOne))
				.as("a second start wrote over a row").isEqualTo(after);

		ArgumentCaptor<Collection<Long>> followed = ArgumentCaptor.captor();
		verify(ducats).follow(followed.capture());

		assertThat(followed.getValue()).as("a second start followed somebody").isEmpty();
	}

	/** THE START OF THE SERVER IS THE WAY IT RUNS, and it writes what {@code align} writes. */
	@Test
	void theStartOfTheServerBringsTheRunsIntoLine() {
		job.run(null);

		assertThat(rowOf(firstAtFruska).distanceKm()).isEqualByComparingTo("42.202");
	}

	/**
	 * A SEASON THAT HAS FROZEN KEEPS EVERY TABLE OF ITS SNAPSHOT AS IT FROZE, while its run is brought
	 * into line.
	 *
	 * <p>PDL P4, owner, 15.11.2026: „Zamrznuta tabela i rang lista ostaju konstante kakve su zamrznute".
	 * The freeze is the job itself ({@link ASeasonFreezes}), run at 16:00 on 1 January 2028, over a run of
	 * 2027 that does not carry its race: a ten of 12 km and 120/110 against a run of 9,9 km and 100/100.
	 * Every row of every table whose name begins with {@code season_} is read off the catalogue before and
	 * after. The live season of the member moves with the run, so the comparison compares something.
	 */
	@Test
	void aRunOfAFrozenSeasonIsBroughtIntoLineAndNoTableOfTheSnapshotMoves() {
		event("desetka-2027", "Jesenja desetka", A_DAY_OF_2027);
		long ten = race("desetka-2027", "Desetka", A_DAY_OF_2027, "length", 0, "12", 120, 110);
		long fifth = competitor("000935", "0011223344557705");
		long hisRun = result(fifth, ten, "9.9", 100, 100, 2700, counted("9.9", 100, 100, 2700));

		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2027, 'feeExempt', 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.param(fifth).update();

		BigDecimal hisSeasonAtTheFreeze = best.live(fifth).get(fifth).get(2027);
		Instant at = LocalDateTime.of(2028, 1, 1, 16, 0).atZone(SeasonClock.ZONE).toInstant();

		new ASeasonFreezes(db, Clock.fixed(at, ZoneOffset.UTC), transactions, best, tables, nobodyFollows()).freeze();

		List<String> frozen = frozenTables();

		assertThat(db.sql("select points from season_competitor where season = 2027 and competitor_id = ?")
				.param(fifth).query(BigDecimal.class).single())
				.as("the snapshot does not hold his season, so it compares nothing about him")
				.isEqualByComparingTo(hisSeasonAtTheFreeze);

		job.align();

		assertThat(rowOf(hisRun)).as("the run of the frozen season").isEqualTo(countedAt("12", 120, 110, 2700, "short"));
		assertThat(best.live(fifth).get(fifth).get(2027))
				.as("nothing the freeze would write moved, so the comparison below says nothing")
				.isNotEqualByComparingTo(hisSeasonAtTheFreeze);
		assertThat(frozenTables()).as("a table of the frozen season moved").isEqualTo(frozen);
	}

	/**
	 * ONE RACE THAT CANNOT BE WRITTEN IS LOGGED, AND THE OTHERS ARE STILL BROUGHT INTO LINE.
	 *
	 * <p>The failure is put where a failure of a race would be, in the transaction of that race, and it
	 * comes before a statement is sent, so what the case measures is that the loop goes on: a job that
	 * let it out stops with the Fruškogorski maraton, the first race of the three, unwritten and the
	 * rest too.
	 */
	@Test
	void aRaceThatFailsLeavesTheOthersBroughtIntoLineAndTheirMembersFollowed() {
		doThrow(new IllegalStateException("on purpose")).when(job).alignOne(fruska);
		Map<Long, String> unwritten = rowsAsWritten(firstAtFruska);

		job.align();

		assertThat(rowsAsWritten(firstAtFruska)).as("the race that failed was written").isEqualTo(unwritten);
		assertThat(rowOf(secondAtTheLake)).isEqualTo(countedAt("5", 5, 5, 1500, "short"));
		assertThat(rowOf(firstAtLarnaca)).isEqualTo(countedAt("42.2", 72, 72, 15000, "marathon"));

		ArgumentCaptor<Collection<Long>> followed = ArgumentCaptor.captor();
		verify(ducats).follow(followed.capture());

		assertThat(followed.getValue()).contains(second, first, fourth);
	}

	/** A run as the table holds it, in the four figures, the points and the category. */
	private record Run(BigDecimal distanceKm, int ascentM, int descentM, int seconds, BigDecimal points,
			String category) {
	}

	private static Run countedAt(String km, int ascent, int descent, int seconds, String category) {
		return new Run(new BigDecimal(km).setScale(4), ascent, descent, seconds,
				counted(km, ascent, descent, seconds), category);
	}

	private static BigDecimal counted(String km, int ascent, int descent, int seconds) {
		return BtlScoreCalculator.calculate(new BigDecimal(km).doubleValue(), ascent, descent, seconds);
	}

	private Run rowOf(long result) {
		return db.sql("select distance_km, ascent_m, descent_m, seconds, points, category from result where id = ?")
				.param(result)
				.query((row, one) -> new Run(row.getBigDecimal(1), row.getInt(2), row.getInt(3), row.getInt(4),
						row.getBigDecimal(5), row.getString(6)))
				.single();
	}

	/** Each row as the table holds it together with {@code ctid}, where this version of it is kept: a case
	 *  runs in one transaction, so {@code xmin} would be the same before and after a write, and a write
	 *  of a row always puts a new version of it somewhere else. */
	private Map<Long, String> rowsAsWritten(long... results) {
		Map<Long, String> rows = new java.util.LinkedHashMap<>();

		for (long result : results) {
			rows.put(result, db.sql("select ctid::text || ' ' || to_jsonb(r)::text from result r where id = ?")
					.param(result).query(String.class).single());
		}

		return rows;
	}

	/** Every row of every table a freeze writes, as text, read off the catalogue and not listed here. */
	private List<String> frozenTables() {
		List<String> rows = new ArrayList<>();

		for (String table : db.sql("select tablename from pg_tables where schemaname = current_schema()"
				+ " and tablename like 'season\\_%' order by tablename").query(String.class).list()) {
			db.sql("select to_jsonb(t)::text from " + table + " t order by 1")
					.query(String.class)
					.list()
					.forEach(row -> rows.add(table + " " + row));
		}

		assertThat(rows).as("the freeze wrote nothing, so the tables compare nothing").isNotEmpty();

		return rows;
	}

	private static ObjectProvider<WhatFollowsTheFreeze> nobodyFollows() {
		return new ObjectProvider<>() {
			@Override
			public Stream<WhatFollowsTheFreeze> orderedStream() {
				return Stream.empty();
			}
		};
	}

	private void event(String slug, String name, LocalDate day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, ?,"
						+ " (select id from place where rank = 1), null, null, 'race', false, '', '')")
				.params(slug, name, day).update();
	}

	private long race(String eventSlug, String name, LocalDate day, String kind, int limit, String km,
			int ascent, int descent) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false, ?, ?, ?,"
						+ " cast(? as numeric), ?, ?) returning id")
				.params(eventSlug, name, day, kind, limit, km, ascent, descent)
				.query(Long.class).single();
	}

	/** The statement {@code ARaceCorrectedRecountsItsRunsTest} writes a member with, column for column. */
	private long competitor(String number, String referral) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season,"
						+ " referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Trkac', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.params(number, referral).query(Long.class).single();
	}

	/** The day comes off the race, which is what the composite key demands. */
	private long result(long competitor, long race, String km, int ascent, int descent, int seconds,
			BigDecimal points) {
		return db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " select ?, id, date, cast(? as numeric), ?, ?, ?, ? from race where id = ?"
						+ " returning id")
				.params(competitor, km, ascent, descent, seconds, points, race)
				.query(Long.class).single();
	}
}

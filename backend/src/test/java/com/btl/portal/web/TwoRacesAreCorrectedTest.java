package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * THE ONE-OFF JOB THAT CORRECTS THE FIGURES OF TWO RACES AND COUNTS THEIR RUNS AGAIN, SILENTLY
 * ({@link TwoRacesAreCorrected}; PDL P4, 16.11.2026, the record of the import of the half marathons of
 * member 000004).
 *
 * <p><b>THE AXES.</b>
 * <ul>
 * <li><b>What a race is found by.</b> The day, the name, the climb and the fall, all four. Four decoys
 * each differ from the Bokeški polumaraton in exactly one of them (the climb and the fall already
 * corrected, the day, the name) and the same for the Dubrovnik race, and each carries a run whose
 * points the formula would not give, so a decoy that was touched shows in its row, in the place of the
 * row ({@code ctid}) and in the points.
 * <li><b>Two different sources of a figure.</b> The run of a member at a corrected race carries the
 * figures of the race as they are after the correction, and its points come out of the calculator for
 * exactly those: a recount against the race as it was writes nothing, one that wrote the old figures
 * back answers the old points.
 * <li><b>A run that already carries the corrected figures</b> stands at the first race and is not
 * written, and its member is not followed, although he runs at the very race where another member's
 * run moved.
 * <li><b>The name.</b> The Dubrovnik race changes its name and the other keeps it; the flag
 * {@code renamed} of both is as it was.
 * <li><b>Who is told.</b> Nobody: no row of {@code message} is written, by anybody, for anything.
 * <li><b>The second start.</b> Nothing is written (every {@code ctid} is the same) and nobody is
 * followed.
 * <li><b>One correction that cannot be written.</b> It is logged and the other is still made.
 * </ul>
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class TwoRacesAreCorrectedTest {

	private static final LocalDate THE_BOKA_DAY = LocalDate.parse("2021-12-12");

	private static final LocalDate THE_DUBROVNIK_DAY = LocalDate.parse("2026-04-26");

	private static final String THE_HALF = "21.0975";

	@Autowired
	private JdbcClient db;

	/** The job as the server has it, wrapped so that one correction can be made to fail. */
	@MockitoSpyBean
	private TwoRacesAreCorrected job;

	@MockitoBean
	private DucatsFollowTheResults ducats;

	private long boka;

	private long dubrovnik;

	private long bokaAlreadyRight;

	private long bokaOtherDay;

	private long bokaOtherName;

	private long dubrovnikOtherCourse;

	private long dubrovnikOtherDay;

	private long dubrovnikOtherName;

	private long milica;

	private long dejan;

	private long third;

	private long fourth;

	private long milicaAtBoka;

	private long thirdAtBoka;

	private long dejanAtDubrovnik;

	private long fourthAtADecoy;

	private long theLastLine;

	private Map<Long, String> decoyRows;

	@BeforeEach
	void twoRacesThatAreWrongAndSixThatLookLikeThem() {
		clearInvocations(ducats);

		event("bokeski-2021", "Bokeski maraton", THE_BOKA_DAY);
		event("du-2026", "DU Motion Dubrovnik", THE_DUBROVNIK_DAY);
		event("lukavi-2021", "Lukavi", THE_BOKA_DAY);
		event("lukavi-2026", "Lukavi 2026", THE_DUBROVNIK_DAY);
		event("lukavi-2022", "Lukavi 2022", THE_BOKA_DAY.plusYears(1));
		event("lukavi-2025", "Lukavi 2025", THE_DUBROVNIK_DAY.minusYears(1));

		boka = race("bokeski-2021", "Bokeški polumaraton", THE_BOKA_DAY, 78, 0);
		dubrovnik = race("du-2026", "DU Motion Dubrovnik", THE_DUBROVNIK_DAY, 0, 0);

		/* each differs from a corrected race in one thing only */
		bokaAlreadyRight = race("lukavi-2021", "Bokeški polumaraton", THE_BOKA_DAY, 71, 71);
		bokaOtherDay = race("lukavi-2022", "Bokeški polumaraton", THE_BOKA_DAY.plusYears(1), 78, 0);
		bokaOtherName = race("lukavi-2021", "Neki polumaraton", THE_BOKA_DAY, 78, 0);
		dubrovnikOtherCourse = race("lukavi-2026", "DU Motion Dubrovnik", THE_DUBROVNIK_DAY, 5, 5);
		dubrovnikOtherDay = race("lukavi-2025", "DU Motion Dubrovnik", THE_DUBROVNIK_DAY.minusYears(1), 0, 0);
		dubrovnikOtherName = race("lukavi-2026", "Dubrovnik 21", THE_DUBROVNIK_DAY, 0, 0);

		milica = competitor("000941", "0011223344557741");
		dejan = competitor("000942", "0011223344557742");
		third = competitor("000943", "0011223344557743");
		fourth = competitor("000944", "0011223344557744");

		milicaAtBoka = result(milica, boka, 78, 0, 7391);
		dejanAtDubrovnik = result(dejan, dubrovnik, 0, 0, 9336);

		/* a run that already stands at the corrected figures, at the race that is corrected */
		thirdAtBoka = result(third, boka, 71, 71, 7500);

		/* one run at every decoy, each with points no formula gives */
		fourthAtADecoy = result(fourth, bokaAlreadyRight, 71, 71, 7000);
		result(fourth, bokaOtherDay, 78, 0, 7001);
		result(fourth, bokaOtherName, 78, 0, 7002);
		result(fourth, dubrovnikOtherCourse, 5, 5, 7003);
		result(fourth, dubrovnikOtherDay, 0, 0, 7004);
		result(fourth, dubrovnikOtherName, 0, 0, 7005);
		db.sql("update result set points = 1.23 where competitor_id = ?").param(fourth).update();

		decoyRows = rowsAsWritten("select ctid::text || ' ' || to_jsonb(r)::text from race r where id = ?",
				bokaAlreadyRight, bokaOtherDay, bokaOtherName, dubrovnikOtherCourse, dubrovnikOtherDay,
				dubrovnikOtherName);
		decoyRows.putAll(rowsAsWritten("select string_agg(ctid::text || ' ' || to_jsonb(r)::text, ',' order by id) from result r where competitor_id = ?",
				fourth));

		theLastLine = db.sql("select coalesce(max(id), 0) from message").query(Long.class).single();
	}

	/**
	 * THE TWO RACES CARRY THEIR CORRECTED FIGURES AND NAMES, and the runs at them are counted at those
	 * figures with the points the calculator gives for them.
	 */
	@Test
	void bothRacesAreCorrectedAndEveryRunAtThemIsCountedAtTheCorrectedFigures() {
		BigDecimal milicaWas = rowOf(milicaAtBoka).points();
		BigDecimal dejanWas = rowOf(dejanAtDubrovnik).points();

		assertThat(job.correct()).as("the two runs that move, and not the one that already stands there")
				.isEqualTo(2);

		assertThat(raceOf(boka)).isEqualTo(new RaceRow("Bokeški polumaraton", 71, 71, false));
		assertThat(raceOf(dubrovnik)).isEqualTo(new RaceRow("Dubrovački polumaraton", 382, 382, false));

		assertThat(rowOf(milicaAtBoka)).isEqualTo(countedAt(71, 71, 7391));
		assertThat(rowOf(dejanAtDubrovnik)).isEqualTo(countedAt(382, 382, 9336));
		assertThat(rowOf(milicaAtBoka).points()).isNotEqualByComparingTo(milicaWas);
		assertThat(rowOf(dejanAtDubrovnik).points()).isNotEqualByComparingTo(dejanWas);
	}

	/**
	 * A RACE THAT DIFFERS IN ONE OF THE FOUR THINGS IT IS FOUND BY, AND A RUN THAT ALREADY STANDS AT THE
	 * CORRECTED FIGURES, ARE NOT WRITTEN AT ALL. The comparison is {@code ctid}, the place of the version
	 * of the row, and not the values: a job that wrote the same values over a row would pass those.
	 */
	@Test
	void aRaceThatIsNotTheOneAndARunThatIsAlreadyRightAreNotWrittenAtAll() {
		Map<Long, String> before = rowsAsWritten("select ctid::text || ' ' || to_jsonb(r)::text from result r where id = ?",
				thirdAtBoka);

		job.correct();

		assertThat(rowsAsWritten("select ctid::text || ' ' || to_jsonb(r)::text from result r where id = ?",
				thirdAtBoka)).as("a run that was right was written over").isEqualTo(before);

		Map<Long, String> after = rowsAsWritten("select ctid::text || ' ' || to_jsonb(r)::text from race r where id = ?",
				bokaAlreadyRight, bokaOtherDay, bokaOtherName, dubrovnikOtherCourse, dubrovnikOtherDay,
				dubrovnikOtherName);
		after.putAll(rowsAsWritten("select string_agg(ctid::text || ' ' || to_jsonb(r)::text, ',' order by id) from result r where competitor_id = ?",
				fourth));

		assertThat(after).as("a race that is not the one was written, or a run at it").isEqualTo(decoyRows);
	}

	/**
	 * NOBODY IS TOLD, and the ducats follow exactly the members whose run was written over: the third
	 * member runs at the first race and his run did not move, the fourth only at races that are not
	 * touched.
	 */
	@Test
	void nothingIsWrittenIntoAnInboxAndTheDucatsOfExactlyTheMembersWrittenOverFollow() {
		job.correct();

		assertThat(db.sql("select count(*) from message where id > ?").param(theLastLine).query(Long.class).single())
				.as("a line in an inbox: the owner decided it is silent").isZero();

		ArgumentCaptor<Collection<Long>> followed = ArgumentCaptor.captor();
		verify(ducats).follow(followed.capture());

		assertThat(followed.getValue()).containsExactlyInAnyOrder(milica, dejan);
	}

	/** THE SECOND START FINDS NOTHING: not a row is written and nobody is followed. */
	@Test
	void aSecondStartWritesNothingAndFollowsNobody() {
		job.correct();
		Map<Long, String> after = everythingTheJobCouldWrite();
		clearInvocations(ducats);

		assertThat(job.correct()).isZero();

		assertThat(everythingTheJobCouldWrite()).as("a second start wrote over a row").isEqualTo(after);

		ArgumentCaptor<Collection<Long>> followed = ArgumentCaptor.captor();
		verify(ducats).follow(followed.capture());

		assertThat(followed.getValue()).as("a second start followed somebody").isEmpty();
	}

	/** THE START OF THE SERVER IS THE WAY IT RUNS, and it writes what {@code correct} writes. */
	@Test
	void theStartOfTheServerCorrectsTheRaces() {
		job.run(null);

		assertThat(raceOf(boka).ascentM()).isEqualTo(71);
		assertThat(raceOf(dubrovnik).name()).isEqualTo("Dubrovački polumaraton");
	}

	/**
	 * ONE CORRECTION THAT CANNOT BE WRITTEN IS LOGGED, AND THE OTHER IS STILL MADE, with its member
	 * followed. The failure comes before a statement is sent, so what is measured is that the loop goes
	 * on: a job that let it out would leave the second race as it was.
	 */
	@Test
	void aCorrectionThatFailsLeavesTheOtherMade() {
		doThrow(new IllegalStateException("on purpose")).when(job).alignOne(TwoRacesAreCorrected.THE_CORRECTIONS.get(0));
		Map<Long, String> unwritten = rowsAsWritten("select ctid::text || ' ' || to_jsonb(r)::text from race r where id = ?",
				boka);

		job.correct();

		assertThat(rowsAsWritten("select ctid::text || ' ' || to_jsonb(r)::text from race r where id = ?", boka))
				.as("the race that failed was written").isEqualTo(unwritten);
		assertThat(raceOf(dubrovnik).ascentM()).isEqualTo(382);

		ArgumentCaptor<Collection<Long>> followed = ArgumentCaptor.captor();
		verify(ducats).follow(followed.capture());

		assertThat(followed.getValue()).containsExactly(dejan);
	}

	private Map<Long, String> everythingTheJobCouldWrite() {
		Map<Long, String> rows = rowsAsWritten("select ctid::text || ' ' || to_jsonb(r)::text from race r where id = ?",
				boka, dubrovnik);
		rows.putAll(rowsAsWritten("select ctid::text || ' ' || to_jsonb(r)::text from result r where id = ?",
				milicaAtBoka, dejanAtDubrovnik, thirdAtBoka));

		return rows;
	}

	/** A race as the table holds it, in what the job moves and the flag it must leave. */
	private record RaceRow(String name, int ascentM, int descentM, boolean renamed) {
	}

	/** A run as the table holds it. */
	private record Run(BigDecimal distanceKm, int ascentM, int descentM, int seconds, BigDecimal points) {
	}

	private static Run countedAt(int ascent, int descent, int seconds) {
		return new Run(new BigDecimal(THE_HALF), ascent, descent, seconds,
				BtlScoreCalculator.calculate(new BigDecimal(THE_HALF).doubleValue(), ascent, descent, seconds));
	}

	private RaceRow raceOf(long race) {
		return db.sql("select name, ascent_m, descent_m, renamed from race where id = ?").param(race)
				.query((row, one) -> new RaceRow(row.getString(1), row.getInt(2), row.getInt(3), row.getBoolean(4)))
				.single();
	}

	private Run rowOf(long result) {
		return db.sql("select distance_km, ascent_m, descent_m, seconds, points from result where id = ?")
				.param(result)
				.query((row, one) -> new Run(row.getBigDecimal(1), row.getInt(2), row.getInt(3), row.getInt(4),
						row.getBigDecimal(5)))
				.single();
	}

	/** Each row as the table holds it together with {@code ctid}: a case runs in one transaction, so
	 *  {@code xmin} would be the same before and after a write, and a write of a row always puts a new
	 *  version of it somewhere else. */
	private Map<Long, String> rowsAsWritten(String statement, long... keys) {
		Map<Long, String> rows = new LinkedHashMap<>();

		for (long key : keys) {
			rows.put(key, db.sql(statement).param(key).query(String.class).single());
		}

		return rows;
	}

	private void event(String slug, String name, LocalDate day) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, ?,"
						+ " (select id from place where rank = 1), null, null, 'race', false, '', '')")
				.params(slug, name, day).update();
	}

	private long race(String eventSlug, String name, LocalDate day, int ascent, int descent) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false, ?, 'length', 0,"
						+ " cast(? as numeric), ?, ?) returning id")
				.params(eventSlug, name, day, THE_HALF, ascent, descent)
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

	/** The run is written at the figures of the race it is at, with the points those figures give. */
	private long result(long competitor, long race, int ascent, int descent, int seconds) {
		return db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " select ?, id, date, cast(? as numeric), ?, ?, ?, ? from race where id = ?"
						+ " returning id")
				.params(competitor, THE_HALF, ascent, descent, seconds,
						BtlScoreCalculator.calculate(new BigDecimal(THE_HALF).doubleValue(), ascent, descent, seconds), race)
				.query(Long.class).single();
	}
}

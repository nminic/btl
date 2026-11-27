package com.btl.portal.web;

import com.btl.portal.domain.event.WhatARaceCarries.Figures;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * V117. EVERY RUN ALREADY STANDING IS COUNTED AGAIN BY THE FORMULA OF 27.11.2026 (V3c), IN JAVA AND BY THE
 * ONE HOME OF THE FORMULA, AS V116 DID FOR THE FORMULA OF THE DAY BEFORE.
 *
 * <p>Owner, PDL P4, 27.11.2026, „Izabrana varijanta V3c”, chosen among the outcomes offered (with the
 * coordinator's recommendation) and then „Napisi i podigni”; the recount of the runs already standing is the
 * one derived on 26.11.2026 beside the first formula (the coordinator's reasoning, marked as such in PDL):
 * „Preračunavaju se bodovi svih postojećih rezultata”. {@code result.points} is the only column that keeps
 * the points of a run; {@code result_submission} keeps none (V10), and the tables of a frozen season (V17,
 * V83, V84, {@code season_points_at_freeze} among them) are a snapshot this never reads or writes:
 * „zamrznuta tabela ostaje konstanta”. The ducats already awarded ({@code ducat_award}) are not touched.
 *
 * <p><b>V116 is not rewritten, because it ran on production</b> (it only reads the kind of the race now, which the function it asks takes). It counted every run by the formula of
 * 26.11.2026 and its record in Flyway's own history table stands; this migration is the next recount, not
 * a correction of it. (V116 asks {@link PointsOfARun#of} as this does, so on a database that has never run
 * either, the two recounts agree and the second changes nothing.)
 *
 * <p><b>A migration in Java and not in SQL, on purpose, for V116's reason.</b> A statement of SQL that worked
 * the points out would be a second home of the formula, free to disagree with
 * {@link com.btl.portal.domain.scoring.BtlScoreCalculator} on the day one of them is edited. So each run is
 * counted by {@link PointsOfARun#of}, the very function every write of {@code result.points} asks: the
 * calculator at a scored race, nought at an unscored one, whether the race is scored asked of
 * {@code scored_race} (V99) as every write asks it.
 *
 * <p><b>THE KIND OF THE RACE IS READ WITH THE ROW, which V116 had no use for.</b> From this formula a race to
 * a limit is counted by its own formula and a race of a length (and a free one) by the other, and the
 * calculator is told only four figures, so {@code race.kind} (V7) goes with them. A run keeps no kind of its
 * own: it is at one race, and a race whose kind a correction would change carries no counted run
 * ({@code RaceWriteApi}, the refusal beside {@code carriesACountedRun}), so the kind read here is the one
 * every run at the race has always been counted under.
 *
 * <p><b>The four figures are not touched, only the points.</b> A row of {@code result} already carries the
 * figures it is counted at (a timed race keeps its limit as the time, PDL P4, „Na vremenskoj trci
 * {@code Tsec} je ograničenje same trke”, written by {@code WhatARaceCarries.figuresOf} on every road), so
 * the points are a function of the row and of its race's kind and of nothing else, and that is what
 * {@code TheRunsOfARace.isAsItWas} relies on.
 *
 * <p><b>A migration rather than a job run by hand after the deploy</b>, because Flyway runs it before the
 * backend serves its first request, in the same transaction as its record in the history: there is no
 * moment in which the code counts by one formula and the rows by another.
 *
 * <p><b>A bean</b>, which Spring Boot hands Flyway beside the SQL under {@code db/migration}, because the
 * function it asks is package-private to this package. Flyway has no content to checksum for a Java
 * migration, so its history records none, and that is what {@code MigrationsAreImmutableTest} pins.
 */
@Component
public class V117__Every_run_is_counted_by_the_formula_of_27_11_2026 extends BaseJavaMigration {

	private static final String EVERY_RUN = "select r.id, r.distance_km, r.ascent_m, r.descent_m, r.seconds,"
			+ " exists(select 1 from scored_race s where s.id = r.race_id),"
			+ " (select ra.kind from race ra where ra.id = r.race_id) from result r order by r.id";

	private static final String ITS_POINTS = "update result set points = ? where id = ?";

	@Override
	public void migrate(Context context) throws SQLException {
		Connection connection = context.getConnection();

		try (PreparedStatement read = connection.prepareStatement(EVERY_RUN);
				PreparedStatement write = connection.prepareStatement(ITS_POINTS);
				ResultSet runs = read.executeQuery()) {
			while (runs.next()) {
				Figures figures = new Figures(runs.getBigDecimal(2), runs.getInt(3), runs.getInt(4), runs.getInt(5));

				write.setBigDecimal(1, PointsOfARun.of(runs.getBoolean(6), runs.getString(7), figures));
				write.setLong(2, runs.getLong(1));
				write.addBatch();
			}

			write.executeBatch();
		}
	}
}

package com.btl.portal.web;

import com.btl.portal.domain.event.WhatARaceCarries.Figures;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.math.BigDecimal;

/**
 * WHAT A RUN AT THIS RACE IS WORTH: what {@link BtlScoreCalculator} makes of its four figures at a scored
 * race, and nothing at an unscored one.
 *
 * <p>PDL, 14.11.2026, derived in the record from the decision that the running leg of a triathlon is no
 * longer scored: „Rezultat ostale discipline nema bodove i ne ulazi ni u šta što liga računa", and the
 * technique written beside it (my reasoning, in PDL): „rezultat nebodovane trke čuva 0 bodova i prikazuje
 * „–”". The column is NOT NULL (V7), so the run keeps a number, and the number is zero.
 *
 * <p><b>Whether the race is scored is asked of {@code scored_race} (V99)</b>, the one place every count on
 * this server reads, and never worked out here from the kind of its event: a second answer to the same
 * question in Java would be free to disagree with the view the day one of them is edited.
 *
 * <p><b>Every write of {@code result.points} comes through here</b>: the league's entry and its change
 * ({@link ResultsByTheLeagueApi}), an approval and an approved correction ({@link VerificationWriteApi}),
 * and a race counted again ({@link RaceWriteApi}). The formula and its golden set are not touched.
 */
final class PointsOfARun {

	/** What a run at an unscored race keeps: zero, at the scale of the column ({@code numeric(8,2)}). */
	static final BigDecimal AT_AN_UNSCORED_RACE = new BigDecimal("0.00");

	private PointsOfARun() {
	}

	/**
	 * @param race    {@code race.id} of the race the run is counted at, as it stands in this transaction
	 * @param figures the four figures as they are counted, never as they were typed
	 */
	static BigDecimal at(JdbcClient db, long race, Figures figures) {
		boolean scored = Boolean.TRUE.equals(db.sql("select exists(select 1 from scored_race where id = ?)")
				.param(race).query(Boolean.class).single());

		return scored ? BtlScoreCalculator.calculate(figures.distanceKm().doubleValue(), figures.ascentM(),
				figures.descentM(), figures.seconds()) : AT_AN_UNSCORED_RACE;
	}
}

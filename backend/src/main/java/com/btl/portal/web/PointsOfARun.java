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

	/**
	 * THE MOST A RUN CAN BE WORTH, and a run the formula makes worth more is refused as one nobody ran.
	 *
	 * <p>Owner, PDL P4, 10.10.2026: „Nikad broj bodova nece biti veci nego trocifren uz jos dve decimale.
	 * Uradi najekonomicnije prema tome". The economy derived beside it in PDL (my reasoning of that day):
	 * the column is not touched ({@code numeric(8,2)} holds every real run), and a run that would be worth
	 * more than 999,99 is refused when it is sent and when it is approved, with a short sentence instead
	 * of the 500 the column answered with (PENDING, „{@code result.points} je {@code numeric(8,2)}"). The
	 * decision „Ne postoji gornja granica bodova po jednoj trci" stands: this is not a rule of scoring but
	 * a refusal of figures that cannot be real. Compared with the points as the column would keep them,
	 * rounded to two decimals, so 999,99 is taken and 1000,00 is not.
	 */
	static final BigDecimal THE_MOST_A_RUN_IS_WORTH = new BigDecimal("999.99");

	private PointsOfARun() {
	}

	/**
	 * WHETHER A RUN OF THESE FIGURES WOULD BE WORTH MORE THAN ANY RUN CAN BE ({@link #THE_MOST_A_RUN_IS_WORTH}),
	 * asked of the same answer every write keeps ({@link #of}), so a run at an unscored race, which keeps
	 * nought, is never refused for it.
	 *
	 * @param figures the four figures as they are counted, never as they were typed
	 */
	static boolean impossible(boolean scored, Figures figures) {
		return beyondAnyRun(of(scored, figures));
	}

	/** Whether these points are more than a run can be worth ({@link #THE_MOST_A_RUN_IS_WORTH}). */
	static boolean beyondAnyRun(BigDecimal points) {
		return points.compareTo(THE_MOST_A_RUN_IS_WORTH) > 0;
	}

	/**
	 * @param race    {@code race.id} of the race the run is counted at, as it stands in this transaction
	 * @param figures the four figures as they are counted, never as they were typed
	 */
	static BigDecimal at(JdbcClient db, long race, Figures figures) {
		return of(scored(db, race), figures);
	}

	/**
	 * What a run is worth where the caller already knows whether its race is scored: on the roads where
	 * the race does not exist yet (a run the member describes, {@code ResultWriteApi}), the kind of its
	 * event is the member's choice ({@code result_submission.event_kind}, V101) and no row of
	 * {@code scored_race} can answer for it.
	 */
	static BigDecimal of(boolean scored, Figures figures) {
		return scored ? BtlScoreCalculator.calculate(figures.distanceKm().doubleValue(), figures.ascentM(),
				figures.descentM(), figures.seconds()) : AT_AN_UNSCORED_RACE;
	}

	/** Whether the race is a scored one, asked of {@code scored_race} (V99) and of nothing else. */
	static boolean scored(JdbcClient db, long race) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from scored_race where id = ?)")
				.param(race).query(Boolean.class).single());
	}

	/**
	 * THE POINTS A MESSAGE ABOUT THE RUN NAMES: the run's own at a scored race, and none at an unscored one,
	 * where {@code WhatAResultChangeSays.Run} leaves them out of the line (PDL, 15.11.2026, „Poruka članu
	 * posle prijave ili izmene rezultata nebodovane trke ne nosi bodove”). The column keeps nought either
	 * way ({@link #AT_AN_UNSCORED_RACE}); this is what is said, and it is said in one place.
	 */
	static BigDecimal toTell(boolean scored, BigDecimal points) {
		return scored ? points : null;
	}

	/**
	 * THE CLIMB AND THE FALL OF A RUN AT AN UNSCORED RACE MAY BE LEFT OUT, AND THEN THEY ARE NOUGHT.
	 *
	 * <p>Owner, PDL, 14.11.2026, third addition: „(1) Uspon i spust na netrkačkoj trci su neobavezni (prazno
	 * znači 0)”, and the plan measured why that is a rule of writing and not of the schema: both columns
	 * are NOT NULL, so „optional" means the field may stay empty and nought is written. A scored race is
	 * handed back as it came, so a figure missing there is still refused as a form not filled in. Asked
	 * after {@code WhatARaceCarries.figuresOf}, so a figure the race fixes is the race's whatever this says.
	 *
	 * @param scored  whether the race the run is at is scored
	 * @param figures the four figures as the race and the runner give them
	 */
	static Figures withTheClimbOptional(boolean scored, Figures figures) {
		if (scored) {
			return figures;
		}

		return new Figures(figures.distanceKm(), figures.ascentM() == null ? Integer.valueOf(0) : figures.ascentM(),
				figures.descentM() == null ? Integer.valueOf(0) : figures.descentM(), figures.seconds());
	}
}

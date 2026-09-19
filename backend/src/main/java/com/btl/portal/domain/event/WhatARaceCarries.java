package com.btl.portal.domain.event;

import java.math.BigDecimal;
import java.util.Set;

/**
 * THE TWO THINGS A RACE CARRIES THAT ARE SPELT OUT RATHER THAN MEASURED: which kinds
 * there are, and how exactly a distance is kept.
 *
 * <p>The sibling of {@link WhatAnEventCarries}, written in its shape and for its reason.
 * Both are lists written by hand, and what stands under them is
 * {@code RaceShapesMatchTheSchemaTest}: the rule's own expression is taken out of
 * PostgreSQL's catalogue and PostgreSQL is asked to judge each value. Comparing one
 * written text against another would be reading rather than measuring.
 *
 * <p><b>The two disagree by a 500.</b> A value this class lets through and the table
 * refuses does not reach an administrator as "that is not a kind of race"; it reaches him
 * as a server fault, after he has finished filling the form in. The other direction is
 * quieter and worse: a kind the schema allows and {@code RaceWriteApi} does not know is
 * one the calendar can hold and nobody can enter.
 */
public final class WhatARaceCarries {

	/**
	 * <b>Owner, PDL:</b> „Tri tipa trke: vremenske (ogranicenje vremena, npr. ultramaraton
	 * na 6 sati), duzinske (fiksna duzina, najcesce), slobodne (trci se koliko se moze dok
	 * se ispunjava cilj)." {@code race_kind_known}, V7, holds the same three.
	 *
	 * <p><b>The word „distanca" is deliberately not one of them</b> (PDL, owner: „Rec
	 * „distanca" se ne koristi kao naziv zapisa, jer trka ne mora imati fiksnu duzinu"),
	 * which is the same sentence read from the other end: two of the three kinds fix no
	 * length at all.
	 */
	public static final Set<String> KINDS = Set.of("length", "time", "free");

	/**
	 * What a race is unless somebody says otherwise.
	 *
	 * <p>The portal's own answer, and it is taken from the screen that enters races rather
	 * than invented here: {@code frontend/src/pages/admin/raceRows.ts}, {@code newRaceRow},
	 * „A race entered by hand is a race of a length, because a length is the only thing
	 * this table asks for". {@code data/raceKind.ts} reads an unknown word as the same
	 * thing and gives the same reason.
	 */
	public static final String OF_A_LENGTH = "length";

	/** The kind that runs to a clock rather than to a finish line. */
	public static final String TO_A_LIMIT = "time";

	/**
	 * The most a distance can be, and the last place it may be cut.
	 *
	 * <p>{@code distance_km numeric(6,2)}, V7: four digits before the point and two after
	 * it. Both are held against the catalogue rather than trusted, in
	 * {@code RaceShapesMatchTheSchemaTest}, which reads {@code numeric_precision} and
	 * {@code numeric_scale} off {@code information_schema} and rebuilds this number from
	 * them.
	 */
	private static final BigDecimal MOST_A_DISTANCE_CAN_BE = new BigDecimal("9999.99");

	/** The digits after the point the column keeps, and the rest is not kept at all. */
	private static final int DIGITS_KEPT_AFTER_THE_POINT = 2;

	private WhatARaceCarries() {
	}

	/**
	 * WHETHER THE TABLE WOULD HOLD THIS DISTANCE <b>AS IT WAS TYPED</b>, which is a
	 * stronger question than whether it would hold it at all.
	 *
	 * <p><b>Owner, PDL: „Nema tolerancije. Svrstavanje ide po tacnoj unetoj vrednosti:
	 * maraton je trka uneta kao {@code 42.2}, polumaraton kao {@code 21.1}", and the
	 * posledica he called deliberate: „uneto {@code 42.195} nije maraton nego „duze trke",
	 * a {@code 21.0975} nije polumaraton nego „krace trke"."</b>
	 *
	 * <p>That sentence and {@code numeric(6,2)} cannot both be obeyed by accepting the
	 * value: PostgreSQL does not refuse {@code 42.195}, it ROUNDS it to {@code 42.20}, and
	 * {@code race.category} is generated as {@code marathon} the moment it does. So a
	 * distance the owner decided is "duze trke" would be stored as a marathon, silently,
	 * and no constraint anywhere would have been broken. A third decimal is therefore
	 * refused rather than kept, because a value that is changed on the way in is not the
	 * value that was entered.
	 *
	 * <p>And the ceiling for the other reason: {@code 99999} is not rounded but overflows,
	 * which reaches an administrator as a 500 rather than as a sentence about his form.
	 *
	 * <p>Negative is refused here too, so that {@code race_distance_not_negative} is a
	 * sentence as well. Zero is a real answer and is not judged here: it is what a race
	 * that fixes no length carries, and which kinds those are is
	 * {@code RaceWriteApi}'s question rather than this one.
	 */
	public static boolean distanceIsKeptExactly(BigDecimal distance) {
		return distance.signum() >= 0
				&& distance.stripTrailingZeros().scale() <= DIGITS_KEPT_AFTER_THE_POINT
				&& distance.compareTo(MOST_A_DISTANCE_CAN_BE) <= 0;
	}

	/** The ceiling itself, for the floor that rebuilds it out of the catalogue. */
	public static BigDecimal mostADistanceCanBe() {
		return MOST_A_DISTANCE_CAN_BE;
	}

	/** And the scale, for the same floor. */
	public static int digitsKeptAfterThePoint() {
		return DIGITS_KEPT_AFTER_THE_POINT;
	}
}

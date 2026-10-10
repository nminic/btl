package com.btl.portal.domain.event;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.Set;

/**
 * THE TWO THINGS A RACE CARRIES THAT ARE SPELT OUT RATHER THAN MEASURED: which kinds
 * there are, and how exactly a distance is kept - and the one answer to which of a run's
 * figures a race of each kind fixes ({@link #figuresOf}).
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
	 * <p>{@code distance_km numeric(8,4)}, V25: four digits before the point and four
	 * after it. Both are held against the catalogue rather than trusted, in
	 * {@code RaceShapesMatchTheSchemaTest}, which reads {@code numeric_precision} and
	 * {@code numeric_scale} off {@code information_schema} and rebuilds this number from
	 * them.
	 *
	 * <p>The digits BEFORE the point are the ones V7 had; V25 widened the column without
	 * moving the ceiling's order of magnitude, so a distance that fitted before fits now.
	 */
	private static final BigDecimal MOST_A_DISTANCE_CAN_BE = new BigDecimal("9999.9999");

	/** The digits after the point the column keeps, and the rest is not kept at all. */
	private static final int DIGITS_KEPT_AFTER_THE_POINT = 4;

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
	 * <p><b>Whatever the column would silently CHANGE on the way in is refused, and the
	 * line moved on 19.09.2026 because the column did.</b> Until V25 the column was
	 * {@code numeric(6,2)} and a third decimal was refused: PostgreSQL does not reject
	 * {@code 42.195}, it ROUNDS it to {@code 42.20}, and {@code race.category} is
	 * generated as {@code marathon} the moment it does - a distance the owner decided is
	 * "duze trke", stored as a marathon, silently, with no constraint anywhere broken.
	 * Refusing it kept the portal honest and left an administrator unable to write down a
	 * length he had really measured, so the owner settled it the other way: „Hocu da mogu
	 * da unosim tacnu duzinu, ali se prikazuje zaokruzeno na dve ili manje decimala. Dakle
	 * 42.203 treba da zaokruzi na 42.2, ali da vodi kao ultramaraton." V25 widened the
	 * column to {@code numeric(8,4)} and {@code 42.195} is now kept exactly and
	 * categorised {@code long}, which is what P5 asked for all along.
	 *
	 * <p><b>The QUESTION did not change, only the answer.</b> This still asks whether the
	 * column would keep the value AS IT WAS TYPED, and a FIFTH decimal is refused today
	 * for precisely the reason a third was refused yesterday. That is why the scale is a
	 * constant held against {@code information_schema} rather than a number chosen here:
	 * the day a migration widens the column again, the floor moves this with it instead of
	 * leaving the two to disagree.
	 *
	 * <p>And the ceiling for the other reason: {@code 99999} is not rounded but overflows,
	 * which reaches an administrator as a 500 rather than as a sentence about his form.
	 * That half is untouched by V25, which added digits after the point and none before
	 * it.
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

	/**
	 * THE FOUR FIGURES A RUN IS SCORED ON, in the types a request carries them in: a figure
	 * may be absent, which is exactly what a form that did not ask for it sends.
	 */
	public record Figures(BigDecimal distanceKm, Integer ascentM, Integer descentM,
			Integer seconds) {
	}

	/**
	 * WHAT A RACE IN THE CALENDAR ANSWERS FOR ITSELF, AS IT STANDS AT THE MOMENT IT IS ASKED.
	 *
	 * @param kind         one of {@link #KINDS}
	 * @param limitSeconds what a race to a limit runs to, and nought on the other two kinds
	 *                     ({@code race_only_a_timed_race_has_a_limit}, V7)
	 */
	public record ARace(String kind, BigDecimal distanceKm, int ascentM, int descentM,
			int limitSeconds) {
	}

	/**
	 * Whether a race of this kind answers for the distance, the climb and the fall itself.
	 *
	 * <p>PDL P9, the record of the owner's decision of 03.08.2026, in the journal's wording and
	 * not in a sentence of his: the three are taken off the race chosen, „to su zvanični podaci
	 * i moderator ih ispravlja na trci, gde ispravka stiže svima koji su je istrčali, a ne na
	 * jednoj prijavi". True of a race of a length, and of no other kind.
	 */
	public static boolean fixesTheCourse(String kind) {
		return OF_A_LENGTH.equals(kind);
	}

	/**
	 * Whether a race of this kind answers for the time itself.
	 *
	 * <p>PDL P9, the owner's decision of 29.08.2026 among the outcomes offered, in the
	 * journal's wording: „Na vremenskoj trci vreme ne unosi, jer je zadato trkom" - the race's
	 * own limit, the same for everyone who finished it.
	 */
	public static boolean fixesTheTime(String kind) {
		return TO_A_LIMIT.equals(kind);
	}

	/**
	 * WHICH FOUR FIGURES A RUN CARRIES, ASKED OF THE RACE IN ONE PLACE FOR EVERY ROAD A RUN
	 * TAKES.
	 *
	 * <p>A race of a length gives the three it measured; a race to a limit gives the time,
	 * because on such a race the time is the same for everyone who finished and it is what the
	 * formula scores it against; a free race gives neither, so every figure is the runner's own
	 * (owner, 29.08.2026). Whatever the request carries for a figure the race fixes is not read.
	 *
	 * <p><b>Five roads ask it, and that is why it is here and not in any one of them.</b> A
	 * member reporting a run and a member correcting a counted one
	 * ({@code ResultWriteApi}); a moderator approving a run, with or without figures of his own
	 * put in place of the runner's ({@code VerificationWriteApi}); the queue showing the
	 * moderator what that approval would count ({@code VerificationApi}); and an administrator
	 * correcting the race itself, after which every run already counted at it is counted again
	 * ({@code RaceWriteApi}, through {@link #whatItFixesMoved}). Answered five ways it would
	 * come to answer „whose figure is this" differently on the screen and in the standings, so
	 * the moderator would approve numbers he was never shown.
	 *
	 * <p><b>The race is asked as it stands NOW, never as it stood when the run was sent.</b>
	 * The record of 03.08.2026 above has a figure the race fixes corrected on the race, where
	 * the correction reaches everyone who ran it; a run still waiting is one of those, so a
	 * figure copied off the race on the day it was sent is not the figure it is counted at.
	 * That reading is mine, carried from the record to the moment of approval, and not a
	 * sentence of the owner's about approvals.
	 *
	 * <p><b>THE RACE'S SIDE IS BOXED BY HAND, AND THAT IS NOT STYLE - IT WAS A 500.</b> Written
	 * {@code course ? race.ascentM() : typed.ascentM()}, with an {@code int} on one side and
	 * an {@code Integer} on the other, Java promotes: the conditional UNBOXES the typed value
	 * before anything looks at it, so a form with no climb in it threw a NullPointerException
	 * here, before the guard after this call could answer 400. Measured on three of the four
	 * figures at once ({@code ResultWriteApiTest.everyWayARunOnAFreeRaceCanFailToHoldTogether});
	 * the length was safe only because both of its sides are already {@code BigDecimal}.
	 */
	public static Figures figuresOf(ARace race, Figures typed) {
		boolean course = fixesTheCourse(race.kind());
		boolean time = fixesTheTime(race.kind());

		return new Figures(
				course ? race.distanceKm() : typed.distanceKm(),
				course ? Integer.valueOf(race.ascentM()) : typed.ascentM(),
				course ? Integer.valueOf(race.descentM()) : typed.descentM(),
				time ? Integer.valueOf(race.limitSeconds()) : typed.seconds());
	}

	/** A run carrying no figure of its own, which is what makes {@link #figuresOf} answer with
	 *  the race's side and nothing else. */
	private static final Figures NOTHING_OF_THE_RUNNERS = new Figures(null, null, null, null);

	/**
	 * WHAT A RACE OF ITS KIND FIXES FOR EVERY RUN AT IT, AND AN EMPTY PLACE FOR WHAT IT LEAVES
	 * TO THE RUNNER.
	 *
	 * <p>{@link #figuresOf} asked with a run that carries nothing: a figure the race fixes comes
	 * back as the race has it, and a figure it leaves to the runner comes back empty. So this is
	 * not a second answer to „whose figure is this" but the first one read from the race's side,
	 * and a kind that tomorrow fixes something else changes both at once.
	 */
	public static Figures whatItFixes(ARace race) {
		return figuresOf(race, NOTHING_OF_THE_RUNNERS);
	}

	/**
	 * WHETHER AN EDIT OF A RACE MOVED ANYTHING IT FIXES, which is the question that decides
	 * whether the runs already counted at it are counted again.
	 *
	 * <p><b>PDL P4, the owner's decision of 20.09.2026, in his own words:</b> „Upisao bih nule, a
	 * onda kad jednog dana promenim, portal treba da preracuna i bodove osim ako je sezona
	 * zamrznuta." The journal names the climb and the fall, and adds in its own wording that the
	 * recount „mora da proveri da li je sezona zamrznuta pre nego što išta promeni".
	 *
	 * <p><b>That every OTHER figure a race fixes recounts too is derived and not his
	 * sentence</b> - the length on a race of a length and the limit on a race to a limit. It is
	 * derived from the two records that say why those figures are the race's at all, both in the
	 * journal's wording: 03.08.2026, the course „to su zvanični podaci i moderator ih ispravlja na
	 * trci, gde ispravka stiže svima koji su je istrčali", and 29.08.2026, on a race to a limit
	 * {@code Tsec} is the race's own limit, the same for everyone who finished it. It was put to
	 * him as derived on 09.10.2026.
	 *
	 * <p><b>Asked of the race as it stood against the race as it is written, never of the runs.</b>
	 * The owner's sentence ties the recount to an EDIT of the value, and the screen that edits a
	 * race sends every race of the event on every save ({@code AdminEvents.tsx},
	 * {@code writeTheRaces}), so a save that moved nothing a race fixes must recount nothing - that
	 * half is also derived, and was put to him the same day. A figure the kind leaves to the runner
	 * moves nothing either: the climb of a race to a limit is on the race and in no run's score.
	 *
	 * <p><b>The length is compared as a number and not as text.</b> {@code race.distance_km} is
	 * {@code numeric(8,4)}, so a length read back is {@code 42.2000} while the form sends what was
	 * typed, {@code 42.2} or {@code 42.20}. Those are one length, and {@link BigDecimal#equals}
	 * would call them three.
	 *
	 * <p><b>A change of kind always moves something</b>, unless neither kind fixes anything: the
	 * figures one kind fixes are empty under the other. Whether the runs follow a change of kind
	 * is NOT this method's question and it does not answer it; the route that edits races does,
	 * and says why.
	 */
	public static boolean whatItFixesMoved(ARace before, ARace after) {
		Figures was = whatItFixes(before);
		Figures is = whatItFixes(after);

		return !(sameLength(was.distanceKm(), is.distanceKm())
				&& Objects.equals(was.ascentM(), is.ascentM())
				&& Objects.equals(was.descentM(), is.descentM())
				&& Objects.equals(was.seconds(), is.seconds()));
	}

	/** Two lengths that are the same number, and two absent lengths, are the same length. */
	private static boolean sameLength(BigDecimal one, BigDecimal other) {
		return one == null || other == null ? one == other : one.compareTo(other) == 0;
	}
}

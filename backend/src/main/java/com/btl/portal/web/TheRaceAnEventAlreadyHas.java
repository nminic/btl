package com.btl.portal.web;

import com.btl.portal.domain.event.WhatARaceCarries;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

/**
 * THE RACE OF AN EVENT THAT A NEW RACE TYPED HERE WOULD BE A SECOND OF, or nothing: the race of the
 * same name, on the same day and of the same measure.
 *
 * <p><b>One home for the key, asked by the two writers that make a race out of a typed name.</b> The
 * save of results ({@link ResultsByTheLeagueApi}, PDL, owner, 23.10.2026, „Unos rezultata ne sme da
 * napravi duplu trku") and the approval of a run on a race the calendar does not hold
 * ({@link VerificationWriteApi}, PDL, owner, 23.10.2026, „„Bez duple trke” važi i kod ODOBRAVANJA
 * prijavljenog rezultata ... isti ključ kao PR 637"). The owner named the key as the same for both, so
 * it is written once: a second copy would be a second home of one rule (ADL A31), and a mutation of
 * the name, the day or the measure is then measured on both roads by the cases of both.
 *
 * <p>The owner's sentence names the NAME and no more (PDL, 23.10.2026: „traži trku istog imena u
 * izdanju koje je našao”). The rest is mine, derived from two entries and measured by the cases of
 * {@code ResultsByTheLeagueApiTest} and {@code VerificationWriteApiTest}, and each part of it is there
 * because the name alone would put a run on a race it was not run on:
 * <ul>
 * <li><b>The name, in any case and with the spaces at its ends taken off</b>: the comparison the
 * screen makes of a name typed exactly (owner, 19.10.2026, „bez obzira na velika i mala slova”,
 * {@code forms/exactName.ts}), and the server stores a name stripped.
 * <li><b>The day</b>: an event of several days is one event of races on several days
 * (PDL P28a, 10.08.2026), and a race of the same name on another day is another race: the member
 * ran on the day typed, and a result moved to another day would be counted under a day he did not run.
 * The entry itself, in the account of what happened (the coordinator's text, not the owner's words),
 * calls the fault a second race „istog imena istog dana”.
 * <li><b>The measure</b>: two races of one name are the ordinary case, not a fault
 * (PDL, owner, 23.08.2026, „ja mogu da u okviru Beogradskog maratona imam dve trke, od 42.2 i 21.1, i
 * obe će dobiti default naziv Beogradski maraton”), and the portal tells such races apart by their
 * measure, which it writes in brackets after the name wherever it names a race (PDL, „Trka se svuda
 * zove „ime, godina, mera u zagradi””): the length of a race of a length, the limit of a race to a
 * limit. A half-marathon time put on the marathon would be counted at the marathon's course. A race
 * that fixes no measure (a free one) has none to compare, and the columns hold nought for it, which
 * is what a new one is written with, so the same comparison answers.
 * </ul>
 *
 * <p><b>The kind is not asked, and that is not an omission.</b> The schema ties it to the measure
 * both ways ({@code race_only_a_timed_race_has_a_limit} and
 * {@code race_only_a_length_race_fixes_a_distance}, V7): a limit above nought is a race to a limit, a
 * length above nought is a race of a length, and nought of both is a free race, so two races that agree
 * on the limit and the length agree on the kind. A condition on it was written first and a mutation
 * that took it out left every case green, which is how it was found to answer nothing.
 *
 * <p><b>The climb is not part of it, and that is my reading, not a decision.</b> The measure the
 * portal names a race by has no climb in it, so a race of that name, day, kind and length is the same
 * race whatever climb was typed, and the rows are counted at the climb the race has (a figure the race
 * fixes is the race's, {@link WhatARaceCarries#figuresOf}). Read the other way, a climb that differs
 * would make a second race of one name, one day and one length, which is the fault the owner named.
 * The owner may object.
 *
 * <p>The lowest key where more than one answers, because races of one name that were made before this
 * was asked are there already and the choice must not depend on the order a table happens to be read.
 * The name is compared by the database ({@code lower}, in the column's own collation), so a letter
 * the collation lowercases is lowercased the way the column is, and a name that differs by a letter
 * (a diacritic included) is another name.
 *
 * <p>Static over a {@link JdbcClient} the caller hands in, the shape {@link TheDayOfAnEvent} has:
 * every caller is inside a transaction of its own, and it asks this AFTER it holds the event
 * ({@code for no key update}), so a writer that waited for another writer meets the race that one made.
 */
final class TheRaceAnEventAlreadyHas {

	private TheRaceAnEventAlreadyHas() {
	}

	/**
	 * @param kind         the kind the race would be made as, which says which of the two measures it has
	 * @param distanceKm   the length it would carry, read only where the kind fixes one
	 * @param limitSeconds the limit it would carry, read only where the kind fixes one
	 * @return the key of the lowest race of the event with that name, day and measure
	 */
	static Optional<Long> keyOf(JdbcClient db, long event, String name, LocalDate day, String kind,
			BigDecimal distanceKm, Integer limitSeconds) {
		boolean course = WhatARaceCarries.fixesTheCourse(kind);
		boolean time = WhatARaceCarries.fixesTheTime(kind);

		return db.sql("select id from race where event_id = ? and lower(name) = lower(?) and date = ?"
						+ " and limit_seconds = ? and distance_km = ? order by id limit 1")
				.params(event, name.strip(), day, time ? limitSeconds : 0,
						course ? distanceKm : BigDecimal.ZERO)
				.query(Long.class).optional();
	}
}

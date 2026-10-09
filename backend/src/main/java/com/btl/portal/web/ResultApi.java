package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * WHAT WAS RUN, BY WHOM, AND WHAT IT WAS WORTH.
 *
 * <p>This is the portal's record and the thing the league exists to keep. It is
 * public and says so in its own words: Article 73 of the rulebook lists the name,
 * the member number and every verified result with its length, climb, descent,
 * time and day among the things that are public, and the privacy policy repeats
 * it. Nothing here is anybody's to hide, and a result nobody can read is a league
 * nobody can check.
 *
 * <p><b>The names are joined and not stored, and that is the whole point of the
 * shape.</b> What the portal serves carries the name of the race, the name
 * of the event and the address of the event beside every result, because a screen
 * with no database has to. Measured on that data those copies had drifted in two
 * hundred and twenty three places out of seventeen thousand six hundred and forty
 * compared values (V7, NESLAGANJA-MOCK). Here they come off the race and the event
 * every time they are asked for, so the class of drift is gone rather than
 * watched. The names the portal reads by do not change: they are the same fields.
 *
 * <p><b>The day is the result's own column and not the race's, and they cannot
 * differ.</b> A12 point 2c says the day of the race decides, never the day
 * somebody typed the result in, and V7 wrote the foreign key over
 * {@code (race_id, race_date)} so the database refuses a result whose day is not
 * its race's day. Reading either is reading the same fact; this reads the one the
 * rule names.
 *
 * <p><b>In the order they were run.</b> The file the portal serves is in
 * the order the rows were written, which for an imported history is no order at
 * all; a history is read by its days.
 *
 * <p><b>AND THE SEASON THAT IS RUNNING IS NOT SERVED FOR SOMEBODY WHOSE FEE HAS
 * LAPSED.</b> Owner, 13.09.2026, in as many words: „Clanarina istice svake Nove
 * godine. Sto znaci da svi podaci o clanu kojem je clanarina istekla treba da
 * ostanu vidljivi u starim / zamrznutim sezonama kad je clanarina bila aktivna, a
 * da se u godini koja je upravo pocela ne prikazuje ni u listi clanova, niti
 * logicno u rezultatima."
 *
 * <p><b>Why that is one condition and not a table of who was a member when.</b>
 * A fee runs for exactly one calendar year, so „is he a member now" and „was he a
 * member this season" are not two questions. The flag on the member answers both,
 * and only the season that is running is affected by it; every season before it
 * is history and reads the same as it always did.
 *
 * <p><b>The boundary in both directions, written here rather than left to be
 * found.</b> One way: the running season's result of a member whose fee has
 * lapsed goes to nobody, because {@code /api/competitors} already leaves him off
 * the list of members (PDL P11), and the difference between two public answers
 * would then be the exact list of who has not paid - which is „sve u vezi sa
 * clanarinom" and Article 74 puts it beside the date of birth. The other way: his
 * result from a season he WAS a member in is served WITH HIS NAME (below), and the
 * fact that a reader can tell from his absence today that he has not renewed is
 * not a leak but this same decision's own consequence.
 *
 * <p><b>AND EVERY RESULT OF A MEMBER SAYS WHO RAN IT, in {@code runner}</b>, so that the
 * name of somebody whose fee has lapsed does not vanish from the tables of the seasons he
 * was a member in. Owner, 13.09.2026: „treba da ostanu vidljivi u starim / zamrznutim
 * sezonama kad je članarina bila aktivna". Owner, 03.10.2026 (PDL P11), chosen between
 * offered outcomes: the result of a season he was a member in carries the name as plain
 * text, with no link to the profile, and the list of current competitors stays as it is
 * (those words are the journal's and not his). What made it a decision and not a reading is
 * the paragraph above: the name is read off the member's record, a result carries only a
 * number, and a member whose fee has lapsed is not on {@code /api/competitors}, so a table
 * of an earlier season had nowhere to read his name from. The row was missing from the
 * table, and under its event it stood with a number where a name should be. The list is not
 * touched, and {@code CompetitorApiTest} did not change for it; the name travels with the
 * result instead.
 *
 * <p><b>FIVE NAMES AND NOTHING ELSE: the first name, the last name, the sex, the age band and
 * whether he runs as a beginner.</b> That is what a table of an earlier season needs to
 * place a row - the tables are by sex and by category, and the screen builds the category out
 * of exactly these three ({@code categoryCodeFor}, {@code frontend/src/data/categories.ts}) -
 * and Article 73 lists the name and the category among what is public. They are the names
 * {@code /api/competitors} answers, under the same keys, so one member is the same member on
 * both doors; {@code aRunnersBandIsTheBandTheListGivesHim} holds the two to each other.
 * Left out on purpose, each for its own decision: the year of birth (Article 74: „Datum
 * rođenja se nikada ne prikazuje, ni u punom ni u skraćenom obliku"); whether his fee
 * stands (PDL P34, 21.09.2026 took {@code active} off the public list for being „činjenica o
 * tuđem plaćanju", and a field here would put it back through the side door); and the
 * portrait, the biography and the link to his team, which belong to a profile and leave it
 * only to a reader who may read a hidden one (PDL P23, 26.09.2026 and 27.09.2026).
 * {@code theRunnerIsFiveNamesAndNothingElse} holds the number, since a sixth would be a fact
 * about a member answered to everybody because nobody was asked.
 *
 * <p><b>THE BAND IS TODAY'S AND NEVER THE BAND OF THE SEASON THE RESULT WAS RUN IN.</b> It is
 * the cost the list already carries (a screen drawing a category for an earlier season draws
 * today's band) and it has the same measured reason: a result carries its season in its day,
 * so a band of its season would be the map of band by season that gives back the exact year
 * of birth (see {@link SeasonClock#seasonTheBandIsWorkedOutFor}). It is worked out for the
 * season that method names, which is the one {@code /api/competitors} asks, and it is read
 * ONCE for the whole answer: a clock read per row can cross midnight on 1 January between two
 * rows of one list, which is the one night of the year the band moves on.
 * {@code theClockIsNotAskedAgainForEachRowOfTheAnswer} holds it.
 *
 * <p><b>IT DOES NOT DEPEND ON THE FEE, and the one place the fee is asked is the condition
 * above.</b> A row is served with its {@code runner} or it is not served at all: a member
 * whose fee has lapsed is named on his old results exactly as one whose fee stands is, and the
 * answer is the same to every reader, visitor, member or administration alike - this route
 * takes no caller, and {@code everyNameThatDependsOnTheReader.test.ts} reads that off this
 * source. The condition above is written against the flag {@code competitor.active}, which is
 * on its way out: PDL 13.09.2026, „Zastavica „aktivan" prestaje da bude podatak i postaje
 * izvedena". <b>The increment that does it rewrites that {@code where}, and it must leave
 * {@code runner} exactly as it is</b> - the name does not become something that needs the
 * flag or a membership row, because the decision names the member and not his membership.
 *
 * <p><b>A member who hides his profile is named like any other.</b> Hiding is about the
 * profile PAGE and not about the place in a table: PDL P23, 06.09.2026, derived from the
 * policy and not asked, „Ime ostaje u javnim tabelama" - „skriva se profilna strana, ne mesto
 * u poretku".
 *
 * <p><b>WHAT IS NOT DECIDED, written down rather than left to be found.</b> The decision says
 * the result of a season he WAS a member in. This server does not read {@code membership}, so
 * it names the runner on EVERY result it serves of a member who has a number, whichever season
 * the result belongs to: a result from a season in which he held no membership of his own (a
 * retroactive 2027 for somebody who paid only for 2028, or the history before 2027) is named
 * too. The other reading, the name only where a membership of the result's season exists, is
 * one join and one condition away, and which of the two the owner means is an open question to
 * him that this class does not answer.
 *
 * <p><b>A result whose competitor has no member number carries {@code "runner": null}</b> -
 * the key there and the value null, the shape the portal already uses for a fact that is
 * withheld (the portrait, PDL P28f) - and nothing else about him. Article 73 makes the name
 * and the number of a MEMBER public, and a registration without a number is not one (V16: a
 * member is a row whose number is there); PDL 13.09.2026, „Kad je sporno, polje se izostavlja i
 * izostavljanje se imenuje sa razlogom, pa se vlasniku javi; nikad se ne servira „za svaki
 * slucaj"". This is that naming, and the owner is told.
 *
 * <p><b>A deleted member takes his results with him</b> (PDL, 06.09.2026: „brisanjem odlaze
 * profil i svi rezultati člana"; {@code result_competitor_fk} is {@code on delete cascade},
 * V7), so there is no result left to name, and what a FROZEN season shows in his place is that
 * season's snapshot and not this answer (ADL A37).
 *
 * <p><b>The year comes from a clock that can be replaced, never from
 * {@code current_date}.</b> Written in SQL it would be a rule that cannot be
 * measured at the one boundary it is about until a New Year actually happens.
 * Here the bean is swapped for a clock fixed to a chosen night and both sides of
 * that boundary are one fixture ({@code WhatTimeItIs}).
 */
@RestController
class ResultApi {

	private final JdbcClient db;

	private final Clock clock;

	ResultApi(JdbcClient db, Clock clock) {
		this.db = db;
		this.clock = clock;
	}

	/**
	 * WHO RAN IT: as much of him as a table of an earlier season needs, and no more. The note on
	 * this class gives the decision behind every line.
	 *
	 * @param firstName       the name on his record as a competitor, and never the one on his
	 *                        account: V23 holds them as two facts about two things
	 * @param lastName        likewise
	 * @param gender          {@code M} or {@code F}, as the schema holds it
	 * @param ageBand         the band alone and never the finished code, so that the sex is not
	 *                        written twice (PDL, 13.09.2026). TODAY'S band, the one
	 *                        {@code /api/competitors} answers for the same member, and not the
	 *                        band of the season the result was run in
	 * @param firstSeason2027 whether he runs in the beginners' category rather than in the one for
	 *                        his age (PDL P7)
	 */
	record Runner(String firstName, String lastName, String gender, String ageBand,
			boolean firstSeason2027) {
	}

	/**
	 * @param category the length category worked out by the database from the
	 *                 distance, never by this server: one rule, one home (V7)
	 * @param runner   who ran it, or NULL when the competitor has no member number. Null and
	 *                 never an absent key; the note on this class gives both reasons
	 */
	record Result(long id, String memberNumber, long raceId, String raceName, String eventName,
			String eventSlug, LocalDate date, BigDecimal distanceKm, int ascentM, int descentM,
			int seconds, BigDecimal points, String category, Runner runner) {
	}

	@GetMapping("/api/results")
	List<Result> results() {
		/* THE SEASON THE BANDS BELOW ARE WORKED OUT FOR, read ONCE for the whole answer rather
		   than per row. Two results of one member must come back with the same band, and a
		   clock read inside the mapper can cross midnight on 1 January between two rows of one
		   list - the one night of the year this field moves on.
		   `SeasonClock.seasonTheBandIsWorkedOutFor` says which season it is and why.

		   IT IS NOT `theSeasonRunning` BELOW and the two are not read from each other: that one
		   is the plain calendar year and is asked what to withhold, this one is lifted to the
		   first season there is and is asked what to answer. Through 2026 they differ by exactly
		   that lift. */
		int season = SeasonClock.seasonTheBandIsWorkedOutFor(ZonedDateTime.now(clock));

		return db.sql("select r.id, c.member_number, r.race_id, ra.name as race_name,"
						+ " e.name as event_name, e.slug as event_slug, r.race_date,"
						+ " r.distance_km, r.ascent_m, r.descent_m, r.seconds, r.points, r.category,"
						/* WHO RAN IT, off the member's own record and from nowhere else: not the
						   account, whose name is a fact about the login (V23), and not another
						   member's. Joined every time and never stored, like the names above.
						   NOTHING HERE ASKS WHETHER HE IS ACTIVE OR WHETHER HE HIDES HIS PROFILE,
						   on purpose, and the note on this class says why. */
						+ " c.first_name, c.last_name, c.gender, c.first_season_2027,"
						/* AND THE YEAR, WHICH IS READ HERE AND LEAVES NOWHERE. It is the input the
						   band is worked out from and the one field of this table the privacy
						   policy is written about, so it reaches the mapper below and goes
						   straight into a band: it is never a component of `Runner`.
						   `theRunnerIsFiveNamesAndNothingElse` and `noYearOfBirthLeavesTheServer`
						   refuse it, the first by its names and the second by the text of the
						   whole answer. */
						+ " c.birth_year"
						+ " from result r"
						+ " join competitor c on c.id = r.competitor_id"
						+ " join race ra on ra.id = r.race_id"
						+ " join btl_event e on e.id = ra.event_id"
						/* EVERYTHING, EXCEPT THE RUNNING SEASON OF SOMEBODY WHOSE FEE HAS
						   LAPSED. Owner, 13.09.2026: „u godini koja je upravo pocela ne
						   prikazuje ni u listi clanova, niti logicno u rezultatima", and the
						   seasons before it stay „vidljivi u starim / zamrznutim sezonama kad
						   je clanarina bila aktivna". The year is a parameter and not
						   `current_date` so the boundary can be measured on a chosen night
						   rather than once a year. */
						+ " where c.active or extract(year from r.race_date) <> :theSeasonRunning"
						+ " order by r.race_date, r.id")
				.param("theSeasonRunning", theSeasonRunning())
				.query((row, one) -> {
					String memberNumber = row.getString(2);

					return new Result(row.getLong(1), memberNumber, row.getLong(3),
							row.getString(4), row.getString(5), row.getString(6),
							row.getDate(7).toLocalDate(), row.getBigDecimal(8), row.getInt(9),
							row.getInt(10), row.getInt(11), row.getBigDecimal(12), row.getString(13),
							/* NULL WHEN HE HAS NO MEMBER NUMBER, the key still there. The note on
							   this class says why a registration without one is not named. */
							memberNumber == null ? null
									: new Runner(row.getString(14), row.getString(15),
											row.getString(16),
											/* THE RULE IS ASKED FOR, NEVER REPEATED HERE: `Category`
											   is where the league's bands live, and `season` is
											   the one for the whole answer. */
											Category.ageBandFor(row.getInt(18), season).code(),
											row.getBoolean(17)));
				})
				.list();
	}

	/**
	 * THE CALENDAR YEAR THE LEAGUE IS IN, read in the league's own time.
	 *
	 * <p>The machine's zone decides nothing: a server kept in UTC would still be
	 * calling it last year for the first hour of every New Year in Belgrade, and that
	 * hour is the one this whole rule is about. {@code SeasonClock} says the same
	 * sentence about freezing a season and owns the zone; this reads it.
	 *
	 * <p><b>And it is the plain calendar year, never
	 * {@code SeasonClock.seasonBeingPaidFor}.</b> That one answers the question a
	 * renewal screen asks, and it differs from this one in two ways: it lifts its
	 * answer to 2027 (right for somebody renewing in 2026, wrong here, because through
	 * 2026 no season is running and lifting it would hide 2027 before 2027 began), and
	 * from 15 October it answers with NEXT year, which for three months of every year
	 * would stop withholding the season that is still being run.
	 *
	 * <p><b>That second half was found by review on 13.09.2026 and it was found because
	 * nothing measured it:</b> both clocks in the cases stood outside the transfer
	 * window, where the two functions agree, so the swap passed all 1540 of them. The
	 * case that holds it now is
	 * {@code ResultApiTest.andTheRunningSeasonStaysWithheldWhileTheNextOneIsAlreadyBeingPaidFor},
	 * and its own floor asks {@code SeasonClock} whether the moment it uses still lies
	 * where the two disagree.
	 *
	 * <p><b>The band on a runner is NOT this year, and the two parted company on purpose:</b>
	 * what to withhold is asked of the plain calendar year, and which season a band is worked
	 * out for is asked of {@link SeasonClock#seasonTheBandIsWorkedOutFor}, which is lifted to the
	 * first season there is. The case that holds them apart stands in the autumn of 2026:
	 * {@code ResultApiTest.aBandIsNeverWorkedOutForASeasonTheLeagueDoesNotHave}.
	 */
	private int theSeasonRunning() {
		return LocalDate.now(clock.withZone(SeasonClock.ZONE)).getYear();
	}
}

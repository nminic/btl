package com.btl.portal.domain.season;

import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * The moments a season turns on, all of them in Central European time.
 *
 * <p>PDL P9 replaced a single "everything locks on 31 December at 23:59" with three
 * moments, and the six hours between the last two are the whole point of the shape:
 *
 * <ol>
 *   <li><strong>31 December, 24:00</strong> - the season ends. A race has to have
 *       been run by then to be scored in it.
 *   <li><strong>1 January, 10:00</strong> - the last moment a member may report a
 *       result from the season that has just ended. It exists because of races run
 *       on 31 December.
 *   <li><strong>1 January, 16:00</strong> - the tables freeze and the snapshot
 *       becomes the official result of the season. The six hours are room for a
 *       moderator to get through the last reports.
 * </ol>
 *
 * <p><strong>Why the zone is written here and not left to the machine.</strong> The
 * server may be anywhere and its clock may be set to anything; the league is not.
 * A season that froze at 16:00 UTC would freeze an hour early in Belgrade in
 * winter, and "an hour early" on the one day of the year when everything is being
 * reported at once is not a rounding error. Owner, 11.08.2026: "Zamrzavanje okida
 * sat, ne covek", so the sat has to be the right one.
 */
public final class SeasonClock {

	/** The league's own time, which is not the server's. */
	public static final ZoneId ZONE = ZoneId.of("Europe/Belgrade");

	/** The first season the portal has, and nothing before it is a season at all. */
	public static final int FIRST_SEASON = 2027;

	private SeasonClock() {
	}

	/**
	 * The moment a season stops taking races.
	 *
	 * <p>Midnight at the end of 31 December, which is the same instant as the start of
	 * 1 January - written as the latter, because "24:00" is not a time a clock has and
	 * writing it as 23:59:59 would quietly lose the last second of the year.
	 */
	public static ZonedDateTime racesEnd(int season) {
		return LocalDate.of(season + 1, 1, 1).atStartOfDay(ZONE);
	}

	/** The last moment a member may report a result from the season just ended. */
	public static ZonedDateTime reportingEnds(int season) {
		return LocalDate.of(season + 1, 1, 1).atStartOfDay(ZONE).plusHours(10);
	}

	/** The moment the tables freeze and the snapshot becomes the official result. */
	public static ZonedDateTime tablesFreeze(int season) {
		return LocalDate.of(season + 1, 1, 1).atStartOfDay(ZONE).plusHours(16);
	}

	/**
	 * Whether a season is frozen at a given moment.
	 *
	 * <p>After this the season's tables are read rather than computed, and a result
	 * corrected afterwards shows on its member's profile and nowhere else (owner,
	 * 31.07.2026). That is deliberate and it is the price of history being history.
	 */
	public static boolean isFrozen(int season, ZonedDateTime at) {
		return !at.isBefore(tablesFreeze(season));
	}

	/**
	 * WHETHER A MEMBER MAY STILL SAY WHICH CATEGORY HE WANTS TO RUN A SEASON IN.
	 *
	 * <p><b>Owner, 26.09.2026 (PDL P7, §9):</b> „Clan moze da stiklira dakle od ove dve
	 * opcije sta god hoce sve do zamrzavanja sezone 1.1. u 10 ujutru", and, asked why ten
	 * and not four in the afternoon: „Do 10h ujutru 1.1. stizu svi inputi clanova. To mogu
	 * biti rezultati, a moze biti i odabir kategorije. Od 10 do 16 superadmin odobrava samo
	 * sta jos treba da se odobri i ima 6h za to."
	 *
	 * <p><b>So this is NOT a new moment, and it delegates for exactly that reason.</b> The
	 * instant the owner named is the one {@link #reportingEnds} already is - he named it as
	 * the moment every member INPUT stops, and a category is an input beside a result rather
	 * than a deadline of its own. A second {@code plusHours(10)} written here would be a
	 * second home for one boundary, which is the fault {@link #referralMayBeSet}'s own note
	 * describes in as many words, and the day one of them moved nothing would say which was
	 * right.
	 *
	 * <p><b>The word „zamrzavanje" in that quotation is the owner's for the deadline and is
	 * NOT {@link #tablesFreeze}, which is six hours later.</b> This is written down because
	 * the two were read as one while this increment was being scoped: the brief for it said
	 * ten in the morning was the freeze and was a moment this class did not have, and both
	 * halves were false. The freeze is 16:00 and it is the PORTAL's act (§9: „stikliranje je
	 * unos i zavrsava se u 10:00; primena je portalova radnja i desava se u 16:00"), so
	 * nothing here asks about it.
	 *
	 * <p><b>Why {@code season - 1} and not a year read off the clock.</b> The choice for a
	 * season closes on 1 January OF that season, which is the end of reporting for the
	 * season BEFORE it - one sentence with two ends, exactly as {@link #seasonBeingRun} is
	 * {@link #transfersTakeEffect} minus one rather than a second reading of the same
	 * moment. Spelt as its own date arithmetic it would be free to disagree the day either
	 * the hour or the zone moved.
	 *
	 * <p><b>AND IT CAN NAME A YEAR THAT IS NOT A SEASON, which is said here rather than
	 * clamped away.</b> Asked about {@link #FIRST_SEASON} it reads
	 * {@code reportingEnds(2026)}, and there is no season 2026 (PDL P2). The arithmetic is
	 * sound - it is a date and a date has no opinion about leagues - and clamping it would
	 * be worse than leaving it: clamped to the first season it would answer that the choice
	 * for 2027 closes on 1 January 2028, ten hours after the season it is about has already
	 * frozen. {@link #seasonBeingRun} keeps the identical boundary in the identical way and
	 * for the identical reason.
	 *
	 * <p><b>The mutation that proves it is a replacement and never a deleted assertion:</b>
	 * put {@link #tablesFreeze} in the line below, or drop the {@code - 1}, and
	 * {@code SeasonClockTest} fails on the instant each one moves.
	 *
	 * @param season the season the choice is FOR, which is the one the screen names
	 * @param at     the moment being asked about, in any zone: it is read in the league's,
	 *               which is ADL A36 O2 („sezona se racuna u zoni Europe/Belgrade")
	 */
	public static boolean categoryMayBeChosenFor(int season, ZonedDateTime at) {
		return at.isBefore(reportingEnds(season - 1));
	}

	/**
	 * The day the transfer window opens, which is the day the price list starts selling a
	 * season that has not begun.
	 *
	 * <p><b>It was 1 October until 29.09.2026, when the owner moved it:</b> „Zelim da prvi
	 * period postane 15-31. oktobar, drugi 1-30. novembar a ostalo ostaje isto. S tim na umu
	 * zelim i da se prelazni rok i sve ostalo otvara 15.10. ubuduce, a ne 1.10." Asked
	 * whether only the OPENING moves, he answered „Tacno", so the window still shuts at the
	 * end of 31 December and is fourteen days shorter rather than shifted.
	 *
	 * <p><b>A day of the year and not a date, because it repeats.</b> Written as a date it
	 * would be one autumn's window and the portal would quietly stop opening it on a morning
	 * nobody was watching, which is the same reason the price list's own days are
	 * {@code mm-dd} (owner, 30.07.2026).
	 *
	 * <p><b>NOT public, and that is the point of it.</b> The one other place this number
	 * lives is {@code price_row}, where it is the first day of the selling year, and
	 * {@code TheSellingYearAndTheTransferWindowOpenOnOneDayTest} holds the two to each other
	 * by asking the TABLE for the day and this class for the behaviour. A second reader here
	 * would be a third home for one boundary with nothing holding it to either.
	 */
	private static final MonthDay WINDOW_OPENS = MonthDay.of(10, 15);

	/**
	 * The transfer window: 15 October to 31 December, the same window membership is
	 * renewed in.
	 *
	 * <p>Owner, 05.09.2026: a team is founded only inside it, and a change of team
	 * takes effect on 1 January - so everything that moves who is in which team
	 * happens in one window rather than under two rules. Outside it the portal does
	 * not draw the button at all; it says when the window opens.
	 *
	 * <p><b>The far end is the end of the year and is not written down here</b>, exactly as
	 * it was not when this read {@code month >= 10}: a day of the year is never after 31
	 * December, so „and it shuts then" is a property of the calendar rather than a second
	 * boundary to keep right. {@code SeasonClockTest} measures both ends anyway, because the
	 * end staying put is itself what the owner decided on 29.09.2026.
	 *
	 * <p><b>Read as a day and no longer as a month, and the day is why.</b> This was
	 * {@code getMonthValue() >= 10} while the window began with October; from 15 October the
	 * month is no longer the question, and the first fourteen days of October are now OUTSIDE
	 * a window they used to open. That stretch is the only thing that tells the two shapes
	 * apart, which is why the cases about it carry every file that measures this one.
	 *
	 * @param at the moment being asked about, in any zone: it is read in the league's
	 */
	public static boolean transferWindowOpen(ZonedDateTime at) {
		return !MonthDay.from(at.withZoneSameInstant(ZONE)).isBefore(WINDOW_OPENS);
	}

	/**
	 * WHETHER THE AMOUNT ONE REFERRAL BRINGS MAY STILL BE SET.
	 *
	 * <p><b>Owner, 16.08.2026 (PDL P16):</b> „Bice i ostaje da ce biti obracun od 5 eur /
	 * 600 din za svaku preporuku, i da to isto administrator <b>podesava do 1.10. u 00 po
	 * CET za predstojecu godinu</b>", and the sentence the journal draws out of it in the
	 * same entry: „posle 1. oktobra u 00:00 CET iznos za tu godinu stoji, i administrator
	 * ga menja samo za sledecu".
	 *
	 * <p><b>It is NOT a second date, and that is the whole reason it delegates.</b> The
	 * instant the owner named is the instant the renewal window opens, which is the one
	 * {@link #transferWindowOpen} already answers - so the amount is settled before anybody
	 * can begin earning it. The portal's own front end reads it exactly this way:
	 * {@code data/season.ts} has {@code referralMayBeSet(today) = !inYearlyWindow(today)}
	 * and builds the transfer window out of that same predicate, off one pair of constants.
	 * A second day of the year written here would be a second home for a boundary, and the
	 * day one of them moved nothing would say which was right.
	 *
	 * <p><b>AND THAT IS NOT A CLAIM ANY MORE, IT IS A MEASUREMENT: the day moved and this
	 * sentence did not have to.</b> The owner moved the renewal window from 1 to 15 October
	 * on 29.09.2026. His quotation above still names 1 October and is left exactly as he said
	 * it, because the rule in it was never „on the first" but „until renewals open" - so
	 * delegating carried it across without anybody editing a word. Had this spelled a day of
	 * its own, the amount would now settle a fortnight before renewals opened and the two
	 * sentences would each look right.
	 *
	 * <p><b>The one thing the move DOES change here is the length, and it grows.</b> This is
	 * the complement of the window, so a window that opens fourteen days later leaves fourteen
	 * days MORE in which the amount may be set: 1 January to 30 September became 1 January to
	 * 14 October. Written down because it reads like the opposite, and the journal itself
	 * stated the direction backwards on the day of the decision.
	 *
	 * <p><b>Which also names what would break it, before anybody has to find it.</b> If the
	 * two windows are ever parted - renewals opening on a day transfers do not - this stops
	 * delegating and gets a window of its own, and this sentence is where that is decided
	 * rather than in whichever of the two somebody edited first.
	 *
	 * <p><b>Two things it deliberately does NOT do.</b> It does not say which season the
	 * amount belongs to; that is {@link #transfersTakeEffect}, and it is the season the
	 * screen names. And it does not keep what an amount WAS: the price list is one row with
	 * one number and no history, so „it stands for that season" is held by refusing the
	 * change rather than by remembering the old value. An amount per season is a table and
	 * arrives with its own increment.
	 *
	 * <p><b>AND THE HOUR, WHICH IS NOT WHAT THIS PARAGRAPH USED TO SAY.</b> It read: „The
	 * decision names 00:00 CET. This reads the instant in {@link #ZONE}, so the day turns
	 * over exactly there, <b>which is the same moment</b>." <b>The last four words are
	 * false</b>, and a review found it by working both instants out instead of reading the
	 * sentence.
	 *
	 * <p><b>Measured on Java 21, for the only day the rule is about.</b> Belgrade is still
	 * on summer time on 15 October - it does not leave it until the last Sunday of the month
	 * - so midnight there is at {@code +02:00}:
	 *
	 * <pre>
	 * 15 Oct 2027  midnight in Belgrade = 2027-10-14T22:00:00Z   (offset +02:00, CEST)
	 *              midnight at CET, +01:00 = 2027-10-14T23:00:00Z
	 * </pre>
	 *
	 * <b>One hour apart, and the same hour in 2028, 2029 and 2030.</b> Re-measured on the
	 * same runtime when the day moved on 29.09.2026, rather than assumed to carry over: the
	 * last Sunday of October falls after the fifteenth in every one of those years, so the
	 * offset is the one above in all four. It is not a rounding difference either: in the
	 * hour between them the two answers to „may the amount still be set" are opposite.
	 *
	 * <p><b>What the owner decided, once the hour was shown to him (25.09.2026, PDL P16a):
	 * midnight in BELGRADE, as the clock on the wall there reads it, summer or winter.</b>
	 * So {@link #ZONE} is the answer and „CET" in the decision of 16.08.2026 is how he named
	 * the league's own time rather than a fixed offset. The portal's front end has carried it
	 * honestly all along ({@code data/season.ts}, where the hour is „written down rather than
	 * pretended away"); this side had it right in the code and wrong in the sentence.
	 *
	 * <p><b>Which is measured and not asserted.</b> {@code SeasonClockTest} stands on the
	 * diverging instant, and so does {@code PricingWriteApiTest} - the route was green under
	 * both replacements until 25.09.2026, when its October moment was moved onto the edge.
	 * The mutation that proves it is a replacement of the ZONE and never a deleted assertion:
	 * put {@code UTC} or {@code ZoneOffset.ofHours(1)} in the line below and both files fail.
	 *
	 * @param at the moment being asked about, in any zone: it is read in the league's
	 */
	public static boolean referralMayBeSet(ZonedDateTime at) {
		return !transferWindowOpen(at);
	}

	/**
	 * Which season somebody is joining or renewing for, at a given moment.
	 *
	 * <p>Inside the transfer window it is the next year; outside it, it is the year
	 * that is running. This is the sentence behind "ko 25. oktobra plati narednu
	 * sezonu, istog dana je vidljiv u pregledu clanova" (owner, 31.07.2026): what he
	 * paid for is 2028 while everybody else is still running 2027.
	 *
	 * <p><b>Never before the first season there is.</b> The calendar answer through
	 * 2026 is 2026, and there is no season 2026 (PDL P2), so the answer is
	 * {@link #FIRST_SEASON}. PDL P8 names this case in as many words: "Sezona u
	 * ponudi ne moze biti pre prve. Kalendarski odgovor kroz leto 2026. je 2026, a
	 * sezone 2026. nema (P2), pa je odgovor 2027."
	 *
	 * <p>A round on 11.09.2026 measured it live rather than in theory: asked about
	 * that same day, this handed back 2026, a season nothing on the portal has. The
	 * constant was already here and this was the one place that did not read it.
	 */
	public static int seasonBeingPaidFor(ZonedDateTime at) {
		ZonedDateTime here = at.withZoneSameInstant(ZONE);
		int calendar = transferWindowOpen(here) ? here.getYear() + 1 : here.getYear();

		return Math.max(calendar, FIRST_SEASON);
	}

	/**
	 * THE SEASON A CHANGE OF SIDE AGREED AT THIS MOMENT TAKES EFFECT IN, which is next
	 * year on every day of this one.
	 *
	 * <p>PDL P13: „Promena se sme zatraziti bilo kad tokom godine, ali stupa na snagu tek
	 * 1. januara naredne sezone", and „Sve rotacije moraju biti zavrsene do 31. decembra
	 * da bi vazile u novoj sezoni". A racing pair is one of those rotations, and the owner
	 * settled on 07.09.2026 which day the question is asked ON: „Rok od 31. decembra visi
	 * o POTVRDI, ne o pozivu... Poziv poslat 31.12.2026 i prihvacen 02.01.2027 pravi par
	 * za 2028, ne za 2027, jer 2027 tada vec tece."
	 *
	 * <p><b>THIS IS NOT {@link #seasonBeingPaidFor} AND THE DIFFERENCE IS NINE MONTHS OF
	 * THE YEAR.</b> The two look alike and are two questions: what is on sale in September
	 * is the season that is RUNNING, because that is the membership somebody is buying,
	 * while a side agreed in September cannot be joined until the next one. The portal
	 * measured exactly that confusion on its own side on 06.09.2026 - a team proposal sent
	 * in December and approved on 5 January wrote the RUNNING season, and the team counted
	 * that member's results from the middle of it - and split the two answers apart. This
	 * is the backend's half of that split, under the same name the frontend gives it
	 * ({@code data/season.ts}, {@code transfersTakeEffect}), so the two cannot drift into
	 * different answers about one act.
	 *
	 * <p><b>And the clamp is a measured fault rather than tidiness.</b> Before the league
	 * has a season there is nothing to join, so the answer is never earlier than
	 * {@link #FIRST_SEASON}; without it a clock set to 2025 wrote a membership starting in
	 * 2026, a season the league does not have (review, 06.09.2026). On this side the
	 * database would refuse such a row outright - {@code racing_pair_season_not_before_the
	 * _league} - so the member would meet a server fault instead of an answer.
	 *
	 * @param at the moment being asked about, in any zone: it is read in the league's,
	 *           which is ADL A36 O2 („sezona se racuna u zoni Europe/Belgrade")
	 */
	public static int transfersTakeEffect(ZonedDateTime at) {
		return Math.max(at.withZoneSameInstant(ZONE).getYear() + 1, FIRST_SEASON);
	}

	/**
	 * THE SEASON BEING RUN AT THIS MOMENT, which is the LAST one a side agreed now is still
	 * part of.
	 *
	 * <p>It exists for leaving rather than for joining, and the owner's decision of
	 * 24.09.2026 is why: „Iz tima se izlazi u istom prozoru u kom se i ulazi (1.10-31.12)",
	 * with his reason - „tim nosi bodove kroz sezonu, pa bi izlazak usred nje znacio da
	 * tabela u januaru i tabela u junu govore razlicito o istoj sezoni." A member who leaves
	 * inside the window is therefore in his team for the whole of THIS season and out of it
	 * from the next, and {@code team_membership.season_to} is „the last season he is in it"
	 * (V11), so this is the number that goes in that column.
	 *
	 * <p><b>The days in that quotation are the ones he said and the window has since moved:
	 * it is 15.10 to 31.12 from 29.09.2026.</b> His sentence is kept word for word because it
	 * is a quotation, and what it decides - that leaving happens in the SAME window as
	 * joining - is what carried across; the dates in it were how the window read that day.
	 * {@link #transferWindowOpen} is the only place the days are, here as everywhere.
	 *
	 * <p><b>Written as {@link #transfersTakeEffect} minus one and not as the calendar year,
	 * and that is the whole point of it.</b> Leaving and joining are two ends of one
	 * sentence - the season a change takes effect IN, and the season it is the end OF - so
	 * one of them derived from the other cannot drift from it. Spelt {@code getYear()} here
	 * it would be a second reading of the same moment, free to disagree the day either the
	 * zone or the clamp moves, which is exactly the fault {@link #transfersTakeEffect}'s own
	 * note describes between itself and {@link #seasonBeingPaidFor}.
	 *
	 * <p><b>AND IT CAN NAME A YEAR THAT IS NOT A SEASON, which is said here rather than
	 * clamped away.</b> Through 2026 the answer is 2026, and there is no season 2026 (PDL
	 * P2). Clamping it to {@link #FIRST_SEASON} would be worse than leaving it: it would say
	 * that the season being run in October 2026 is 2027, and a membership ended with
	 * {@code season_to = 2027} is a member who WAS in his team for a season that has not
	 * started. The callers guard it instead, and they can: every membership the schema
	 * allows begins at 2027 or later ({@code team_membership_season_from_not_before_the_
	 * league}), so on any day of 2026 every one of them is a membership that has not BEGUN,
	 * which {@code TeamWriteApi} answers by removing the row rather than by ending it.
	 *
	 * @param at the moment being asked about, in any zone: it is read in the league's,
	 *           which is ADL A36 O2 („sezona se racuna u zoni Europe/Belgrade")
	 */
	public static int seasonBeingRun(ZonedDateTime at) {
		return transfersTakeEffect(at) - 1;
	}

	/**
	 * THE SEASON A MEMBER'S AGE BAND IS WORKED OUT FOR, which is the one that is RUNNING and
	 * never earlier than the first the league has.
	 *
	 * <p><b>It is written here and not in the resource that answers a band today, because a
	 * band is not one resource's fact.</b> The same member has to come back in the same band
	 * from every resource that names one, and a second resource spelling this season out for
	 * itself would be a second home of one boundary: ADL A31 (28.08.2026), „Činjenica koja ima
	 * više oblika dobija jedan dom, i taj dom se prebroji a ne oseti". It was a private method
	 * of {@code CompetitorApi} until 10.10.2026, and what follows is its note, kept whole.
	 *
	 * <p><b>The LIST answers one season and never a band per season, and that is a measurement
	 * rather than a simplification.</b> PDL, 13.09.2026 (now in
	 * {@code btl-produkt/arhiva/PDL-2026-10-03.md}, the entry on {@code birthYear}): a map of band
	 * by season „vraća tačna godina rođenja" for 25 of the 32 members, because a member who
	 * crosses a boundary narrows the candidate years to one. „Iz jednog pojasa za tekuću sezonu ne
	 * vraća se ni za jednog, jer je najuži skup kandidata širok petnaest godina." So ONE ANSWER of
	 * the list gives away no year of birth, and an answer that carried more than one season would
	 * hand back the very field the band was made to withhold. <b>That holds for an answer and not
	 * for a reader:</b> a reader who reads the list before and after a New Year holds the bands of
	 * two seasons, and the season in which a member's band changes fixes his year exactly; the
	 * frozen tables, which carry the category of their season, give the same (PDL P23, 10.10.2026,
	 * the correction of the cost). The list cannot stop a reader from keeping two answers; what it
	 * does not do is hand him the map in one. For the list that cost is written down in the same
	 * place and accepted: a screen drawing a category for an earlier season out of the list draws
	 * today's band. PDL P34 (21.09.2026) says what the band is for: it „je napravljen tako da ne
	 * odaje godinu rođenja".
	 *
	 * <p><b>One other door answers more than one season since 10.10.2026, and this method is not
	 * its home:</b> the runner of a result carries the band its member had in the season the result
	 * was run in ({@link #seasonTheBandOfAResultIsWorkedOutFor}). The owner chose that between
	 * offered outcomes, against my recommendation, and kept it, with my recommendation, once the
	 * cost had been measured to be the exact year of birth and not an approximate one. The cost: the
	 * history of one member's results shows the season he crossed a band, and a band is the season
	 * minus the year of birth, so a member who crossed 25, 40 or 55 between two seasons he ran in
	 * gives away his EXACT year of birth (25-39 in 2027 and 40-54 in 2028 means 1988). The same is
	 * had without this door, from the list read before and after a New Year and from the frozen
	 * tables, and the published text (Article 74 of the rulebook and the privacy policy) is to say
	 * so before 1 January 2028; that is item BR, a job of its own. This method is still the list's,
	 * and still one season.
	 *
	 * <p><b>Read in the league's own zone, whatever zone the moment arrives in</b>, for the
	 * reason {@code ResultApi} writes beside its own year: a server kept in UTC, as containers
	 * are, would still be calling it last year for the first hour of every New Year in
	 * Belgrade, and that hour is a boundary this field moves on.
	 *
	 * <p><b>And it is NOT {@link #seasonBeingPaidFor}.</b> That one answers from 15 October
	 * with NEXT year, which would move every member's band forward a season in the autumn
	 * without a single birthday - and the band moves once, on 1 January, which is the whole of
	 * PDL P7 („Uzrast se u ligi utvrđuje jednom, na 1. januar sezone"). Two cases refuse the
	 * swap, one here and one through the route:
	 * {@code SeasonClockTest.theSeasonTheBandIsWorkedOutForDoesNotMoveWhenTheNextOneGoesOnSale}
	 * and {@code CompetitorApiTest.aBandDoesNotMoveWhenTheNextSeasonGoesOnSale}.
	 *
	 * <p><b>The floor under the plain calendar year is the league's first season</b>, the same
	 * {@code Math.max} shape {@code frontend/src/data/season.ts} has in
	 * {@code transfersTakeEffect}: through 2026 the calendar answers 2026 and there is no season
	 * 2026 (PDL P2), so a band worked out for it is a band for a season that does not exist.
	 * <b>That floor is what tells it apart from {@link #seasonBeingRun}</b>, which names 2026
	 * on purpose and says why in its own note; from 2027 on the two are the same number.
	 *
	 * <p><b>WHAT IS NOT DECIDED HERE, written down rather than left to be found.</b> From 1
	 * January 2028 this answer and the served file part company: the generator that wrote
	 * {@code competitors.json} holds {@code SEZONA = 2027} as a literal
	 * ({@code btl-produkt/istorijski-podaci/napravi-mock.py}), so it answers 2027 for ever while
	 * this follows the running season. This is the reading PDL P7 gives - the age is settled on
	 * 1 January OF THE SEASON, so a new season settles it again - and the file's constant is an
	 * artefact of a mock built for a 2027 demo rather than a decision. It is named here because
	 * the two agree until then and a disagreement that starts on a date nobody is watching is
	 * the kind that gets found by a member.
	 *
	 * @param at the moment being asked about, in any zone: it is read in the league's, which is
	 *           ADL A36 O2 („sezona se racuna u zoni Europe/Belgrade")
	 */
	public static int seasonTheBandIsWorkedOutFor(ZonedDateTime at) {
		return Math.max(FIRST_SEASON, at.withZoneSameInstant(ZONE).getYear());
	}

	/**
	 * THE SEASON THE AGE BAND ON A RESULT IS WORKED OUT FOR: the one the day it was run is in, and
	 * never earlier than the first the league has.
	 *
	 * <p><b>Owner, 10.10.2026 (PDL P23), chosen between offered outcomes:</b> the band beside an
	 * old result is the band its member had in the season that result was run in, the same as in
	 * the frozen table of that season, for every served result of a member with a number, whether
	 * his fee stands or has lapsed. He chose it against my recommendation, and kept it, with my
	 * recommendation, once the cost had been measured to be the exact year of birth and not an
	 * approximate one. The outcome he did not choose was today's band, which
	 * {@link #seasonTheBandIsWorkedOutFor} still answers for the list; its cost was that, for a
	 * member who crossed a band, the result and the frozen table of the same season would show two
	 * categories. The cost of the one he chose is on the note of that method: a member who crosses
	 * a band between two seasons he ran in gives away his EXACT year of birth.
	 *
	 * <p><b>The season of a result is the calendar year of its day, and nothing else.</b> The
	 * league scores a race in the year it is run in, and V7 holds a result's day equal to its
	 * race's. A day has no zone, so unlike the moment {@link #seasonTheBandIsWorkedOutFor} is asked
	 * about there is nothing here for a zone to move: the day is read as the start of itself in the
	 * league's own zone, and that method is asked, so that the floor under both bands has one home.
	 * The zone is spelt out so that nobody has to ask which one a day is in, and it is NOT what the
	 * answer rests on: any zone within hours of Belgrade starts a day on the same date and reads
	 * the same year, so the only zone that would change the answer is one far to the east (the
	 * start of 1 January in Tokyo is still 31 December here), and that is the mistake
	 * {@code SeasonClockTest} catches on the first day of 2028.
	 *
	 * <p><b>A DERIVATION AND NOT A DECISION, written down rather than left to be found.</b> A
	 * result run before the league's first season (the history imported from before 2027) belongs
	 * to no season of the league (PDL P2), so there is no band its member had in it. This answers
	 * the first season for it, which is the floor the list already stands on. That is the author's
	 * derivation from the rule that a band is never worked out for a season the league does not
	 * have, and the owner has since decided, on his own reasoning and with the screens measured,
	 * that no band is drawn beside such a result, so what the answer carries there is shown
	 * nowhere. <b>The floor does not turn the exact year of birth into an approximate one.</b> It
	 * only delays the leak and narrows the circle it reaches: the year the result was run in would
	 * have put every imported year of every member's history into the map that 13.09.2026
	 * measurement found the exact year of birth in, for 25 of 32 members, at once, while with the
	 * floor a member's year is given away only by seasons the league has, and only if he crosses
	 * a band between two of them.
	 *
	 * @param day the day the result was run, which is its race's day
	 */
	public static int seasonTheBandOfAResultIsWorkedOutFor(LocalDate day) {
		return seasonTheBandIsWorkedOutFor(day.atStartOfDay(ZONE));
	}

	/**
	 * THE SEASON A LEAGUE MAY BE MADE FOR: THIS ONE OR THE NEXT, AND NOTHING ELSE
	 * (PDL P15a, owner 22.09.2026).
	 *
	 * <p>Owner, carrying out his own sentence of 23.08.2026 to the letter: a league is
	 * made "za tekucu ili narednu" year. He was shown what that costs and took it: "liga
	 * za 2029 se ne moze pripremiti unapred, a istorijske lige koje portal pominje
	 * (Gradska 2017, Brdska 2019) ne mogu da se unesu kroz portal uopste."
	 *
	 * <p><b>WHY THE RUNNING YEAR IS CLAMPED AND NOT TAKEN AS IT COMES.</b> PDL P2 and
	 * the owner's sentence of 31.07.2026, "Nigde na portalu nema sezone pre 2027", mean
	 * the calendar answer through 2026 is a year that is not a season at all - and
	 * {@code league_season_not_before_the_league} refuses it outright, so an unclamped
	 * answer would offer a season the database will not take. {@link #seasonBeingPaidFor}
	 * clamps the same way and for the same sentence.
	 *
	 * <p><b>The clamp is applied to the RUNNING year and the next one is counted off the
	 * result</b>, so today, in 2026, the pair is 2027 and 2028 rather than 2027 twice.
	 * That is read off the cost the owner accepted rather than guessed at: the league he
	 * named as the one that cannot be prepared yet is <b>2029</b>, which is true of this
	 * shape and not of the other.
	 *
	 * <p><b>THIS IS NOT {@link #seasonBeingPaidFor} AND MUST NOT BE WRITTEN AS IT.</b>
	 * That one answers what is on SALE and steps into next year on 15 October, so from the
	 * middle of October to December it would refuse a league for the year that is still
	 * running - and PDL P15a's fourth decision says races enter a league "i tokom godine te
	 * lige", which is that very stretch of it. Two questions about a season are two methods
	 * here, which is the split {@link #transfersTakeEffect} was already made for.
	 *
	 * <p><b>Nothing here asks whether the season is frozen, and it does not have to.</b>
	 * A season freezes on 1 January at 16:00 of the year AFTER it (see
	 * {@link #tablesFreeze}), by which time the running year has already moved on, so a
	 * frozen season is never the current one nor the next. That is a property of the two
	 * moments rather than a second rule, and {@code SeasonClockTest} measures it.
	 *
	 * @param at the moment being asked about, in any zone: it is read in the league's,
	 *           which is ADL A36 O2
	 */
	public static boolean aLeagueMayBeMadeFor(int season, ZonedDateTime at) {
		int running = Math.max(at.withZoneSameInstant(ZONE).getYear(), FIRST_SEASON);

		return season == running || season == running + 1;
	}
}

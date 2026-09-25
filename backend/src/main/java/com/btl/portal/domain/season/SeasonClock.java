package com.btl.portal.domain.season;

import java.time.LocalDate;
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
	 * The transfer window: 1 October to 31 December, the same window membership is
	 * renewed in.
	 *
	 * <p>Owner, 05.09.2026: a team is founded only inside it, and a change of team
	 * takes effect on 1 January - so everything that moves who is in which team
	 * happens in one window rather than under two rules. Outside it the portal does
	 * not draw the button at all; it says when the window opens.
	 *
	 * @param at the moment being asked about, in any zone: it is read in the league's
	 */
	public static boolean transferWindowOpen(ZonedDateTime at) {
		int month = at.withZoneSameInstant(ZONE).getMonthValue();
		return month >= 10;
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
	 * A second {@code getMonthValue() >= 10} written here would be a second home for a
	 * boundary, and the day one of them moved nothing would say which was right.
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
	 * on summer time on 1 October - it does not leave it until the last Sunday of the month
	 * - so midnight there is at {@code +02:00}:
	 *
	 * <pre>
	 * 1 Oct 2027  midnight in Belgrade = 2027-09-30T22:00:00Z   (offset +02:00, CEST)
	 *             midnight at CET, +01:00 = 2027-09-30T23:00:00Z
	 * </pre>
	 *
	 * <b>One hour apart, and the same hour in 2028, 2029 and 2030.</b> It is not a rounding
	 * difference either: in the hour between them the two answers to „may the amount still
	 * be set" are opposite.
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
	 * That one answers what is on SALE and steps into next year on 1 October, so from
	 * October to December it would refuse a league for the year that is still running -
	 * and PDL P15a's fourth decision says races enter a league "i tokom godine te lige",
	 * which is that very stretch of it. Two questions about a season are two methods
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

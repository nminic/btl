/* Dates that repeat every year, and the two windows they open.
 *
 * Renewal and transfers run on the same calendar on purpose: a member decides
 * once a year, in the same stretch of weeks, which category they run in and
 * which team they run for. Both windows shut at the end of the year, so a
 * season starts with everything already settled.
 */

/**
 * The first season the league actually runs.
 *
 * Everything before it is the history imported so a profile is not empty on the
 * day the league starts (PDL P26), and no rule about what somebody has done in
 * the league counts any of it: not the ducats, and not the threshold that closes
 * the beginners' category (P7, owner 11.08.2026).
 *
 * Here rather than beside either of those, because it is a fact about the league
 * and not about ducats or about categories. It lived in `ducatRule.ts`, where its
 * own comment called it „the first season anything is counted for, for the
 * families that go by month or by season"; read from there by a second rule, a
 * change made for the ducats would have moved the boundary of a competition
 * category without anybody meaning to.
 */
export const FIRST_SEASON = 2027

/** Renewal and the transfer window both open on this day.
 *
 * **It was `10-01` until 29.09.2026**, when the owner moved it: „Zelim da prvi
 * period postane 15-31. oktobar, drugi 1-30. novembar a ostalo ostaje isto. S tim
 * na umu zelim i da se prelazni rok i sve ostalo otvara 15.10. ubuduce, a ne
 * 1.10." Asked whether only the OPENING moves, he answered „Tacno", so
 * `WINDOW_CLOSES` stays where it is and the window is fourteen days shorter rather
 * than shifted.
 *
 * **The same day `PRICES` starts selling next season, and nothing here says so.**
 * The two are one fact in the owner's sentence and two constants in this
 * repository, so `data/theWindowAndThePriceList.test.ts` holds them to each other
 * by asking this file for the behaviour and `data/pricing.ts` for the day. The
 * backend carries the identical pair and the identical floor
 * (`SeasonClock.transferWindowOpen`, `TheSellingYearAndTheTransferWindowOpenOnOneDayTest`). */
export const WINDOW_OPENS = '10-15'

/** And both shut at the end of this day. Nothing is decided in January. */
export const WINDOW_CLOSES = '12-31'

/**
 * Whether the amount one referral brings may still be set for the coming season.
 *
 * Owner, 16.08.2026: „administrator podešava do 1.10. u 00 po CET za predstojeću
 * godinu." That instant is the one the renewal window opens on, so this is not a
 * second date to keep right but the same one read the other way round: the amount
 * is settled before anybody can start earning it, and once renewals are open it
 * stands for that season.
 *
 * **What is deliberately not enforced, and cannot be here.** „It stands for that
 * season" is a promise about the past, and nothing in this portal remembers what
 * an amount was: the price list is a record of the current visit. So this refuses
 * the change and says until when it was possible, which is the half a screen can
 * do; keeping what each season was worth is a table, and that arrives with the
 * database (PENDING).
 *
 * **And the hour.** The decision names 00:00 CET. The portal reads whole days off
 * one clock with no notion of an hour (src/clock), so „the day 15 October has begun"
 * is what it can answer. Since 20.10.2026 that day is Belgrade's, the same one the
 * server counts, so it turns over at Belgrade midnight and not an hour or two later.
 * Written down rather than pretended away.
 */
export function referralMayBeSet(today: string): boolean {
  return !inYearlyWindow(today)
}

/**
 * The season that is running on a given day, or nothing before the first one.
 *
 * A season is the calendar year, so this is that year, once the league has one.
 * The league's first is 2027, so for the whole of 2026 the answer is that no
 * season is running, and anything a screen says about „the season now running" is
 * a sentence about nothing. The price list said exactly that, and a review
 * measured it on 30 September 2026.
 *
 * **Whole days, as everywhere in this file.** On 1 January two seasons stand over
 * one another until 16:00: a result entered that morning belongs to the season that
 * has closed, while the front page already counts the new one (PDL P9 and P14).
 * This answers with the new one from midnight, because the portal reads whole days
 * off one clock with no notion of an hour (src/clock). Written down rather than
 * pretended away, as with the hour in `referralMayBeSet` above.
 */
export function seasonRunning(today: string): number | null {
  const year = Number(today.slice(0, 4))

  return year < FIRST_SEASON ? null : year
}

/**
 * The season every seasonal view of the league is drawn for: the running one, and
 * before the league has one, its first.
 *
 * Owner, 16.10.2026: „Nema šta probni ili ne probni podaci. Prva sezona je 2027, pa
 * su samim tim svi brojači na nuli, a i sve su statistike prazne jer nema trka u
 * 2027. godini. Ovo se odnosi na rang liste, Tabelu, naslovnu stranu i sl." Chosen
 * with it, between the options put to him: a seasonal view is always this season,
 * and an empty one shows noughts rather than falling back to an earlier one.
 *
 * **So this never looks at a result.** Until 16.10.2026 the front page, the table
 * and the top boards opened on „the fullest season there is" until the running one
 * had three people in it (`defaultSeason` in `data/derive.ts`, gone), which drew
 * 2019 under the words „probni podaci" in 2026 and would have gone on drawing it in
 * January 2027. That rule was a choice made in code and never the owner's.
 *
 * Not `seasonRunning`, which answers nothing before 2027 and is right to: a
 * sentence about „the season now running" is about nothing in 2026. A screen still
 * has to show some season, and the one it shows is the first the league runs.
 */
export function seasonShown(today: string): number {
  return Math.max(FIRST_SEASON, Number(today.slice(0, 4)))
}

/**
 * The day on which the boards of the front page stop holding places for members who
 * have not scored, and the first day of the league's first season.
 *
 * Owner, 17.10.2026, against the recommendation put to him: „Top 10 na naslovnoj se od
 * 1.1.2027 popunjava samo članovima sa bodovima. Do 1.1.2027 važi odluka P24 (registrovani
 * članovi po datumu učlanjenja)." Refused by him: filling the boards only while 2027 has
 * no results.
 *
 * **It is a day of reading and it is not read off any result.** The first board that
 * stops being filled is the one read on this day, and it stops whether or not anybody has
 * raced yet, so a result's own date is the wrong thing to ask. The two are different
 * facts that sometimes share a value: a board read on 1 January with no result in 2027 is
 * empty, and a board read on 31 December whose clock was set back over results of 2027 is
 * still filled.
 *
 * Written as a day and not as `FIRST_SEASON`, because it is the owner's date for these
 * boards and merely coincides with the start of the first season.
 *
 * **Whole days, as everywhere in this file.** The owner's decision does not name an hour;
 * the portal reads the Belgrade day off its one clock (`clock/context.ts`, since
 * 20.10.2026), so the boards stop being filled at Belgrade midnight on 1 January, the
 * instant the server's day turns. The server's `SeasonClock` is not asked from here: no
 * route hands this side a season.
 */
export const BOARDS_ARE_FILLED_BEFORE = '2027-01-01'

/** Whether a board of the front page, read on this day, is topped up with members who have not scored. */
export function boardsAreToppedUp(today: string): boolean {
  return today < BOARDS_ARE_FILLED_BEFORE
}

export function inYearlyWindow(today: string): boolean {
  const dayInYear = today.slice(5)

  return dayInYear >= WINDOW_OPENS && dayInYear <= WINDOW_CLOSES
}

/**
 * The season a member starts running for a club from.
 *
 * A transfer agreed today takes effect at the start of the next season and never
 * during a running one (PDL P13), and a club founded during the year scores
 * nothing until 1 January (PDL, 05.09.2026). Both say the same thing: the first
 * season that has not begun, which is next year on every day of this one.
 *
 * **It delegated to `seasonOnSale` until 06.09.2026, and that was wrong outside
 * the transfer window.** The two questions look alike and are not: what is on
 * sale in September is the season that is running, because that is the membership
 * somebody is buying, while a squad agreed in September cannot be joined until
 * the next one. Every screen that writes this is shut outside the window, so the
 * difference never showed, until the moderator's queue started deciding proposals
 * on days of its own: a proposal sent in December and approved on 5 January wrote
 * the running season, `inTeamIn` then said yes, and the club counted that
 * member's results from the middle of a season (review, 06.09.2026).
 *
 * Written as its own answer rather than as a call to `seasonOnSale`, because that
 * shared body was the whole of the fault. **But it is not a third answer either:**
 * `seasonBeingRenewed` in `data/pricing.ts` had been saying the same thing since
 * 29.08.2026, in its own words („A transfer is the same question with the same
 * answer"), so leaving both would be one fact with two homes and one floor. It
 * reads this one now, and the floor lives here: before the league has a season
 * there is nothing to join, so the answer is never earlier than the first
 * (`FIRST_SEASON`). Without it a clock set to 2025 wrote a club membership
 * starting in 2026, a season the league does not have (review, 06.09.2026).
 */
export function transfersTakeEffect(today: string): number {
  return Math.max(FIRST_SEASON, Number(today.slice(0, 4)) + 1)
}

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

/** Renewal and the transfer window both open on this day. */
export const WINDOW_OPENS = '10-01'

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
 * one clock with no notion of a zone (src/clock), so „the day 1 October has begun"
 * is what it can answer, and that is the same instant as long as the day it reads
 * turns over in CET. Written down rather than pretended away.
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
 */
export function seasonRunning(today: string): number | null {
  const year = Number(today.slice(0, 4))

  return year < FIRST_SEASON ? null : year
}

export function inYearlyWindow(today: string): boolean {
  const dayInYear = today.slice(5)

  return dayInYear >= WINDOW_OPENS && dayInYear <= WINDOW_CLOSES
}

/** The season being sold on a given day: next year once the window is open. */
export function seasonOnSale(today: string): number {
  const year = Number(today.slice(0, 4))

  return inYearlyWindow(today) ? year + 1 : year
}

/**
 * A transfer asked for now takes effect at the start of the next season, never
 * during a running one (PDL P13). If the window closes with nothing agreed, the
 * member stays where they were.
 */
export function transfersTakeEffect(today: string): number {
  return seasonOnSale(today)
}

/* The price list as data with periods of validity, not as numbers written into
 * a screen (ADL A12). The front page reads it to say what membership costs
 * today and when that changes; the membership page and the price list read the
 * same rows.
 *
 * Two currencies are two price lists, not one with a conversion. The dinar
 * price is fixed for the season and does not follow the exchange rate.
 */

import { seasonOnSale } from './season'

export type PriceRow = {
  key: string
  /**
   * The day of the year the period opens and the day it closes, both mm-dd.
   *
   * A day of the year rather than a date, because the list repeats (owner,
   * 30.07.2026): membership for 2027 is sold until 30 September 2027, and on 1
   * October the same four periods open again for 2028, and so on every year.
   * Written as dates the list would have been four rows that expire, and the
   * portal would quietly stop having a price on a morning nobody was watching.
   */
  from: string
  to: string
  eur: number
  rsd: number
  /** False for the in-season price, which buys a profile but no place in the
   *  standing. */
  ranking: boolean
}

/** The season the portal was built for: the first one, and what the competition
 *  screens are dated by. What membership is being sold for is a different
 *  question and moves with the calendar (seasonOnSale in data/season.ts). */
export const SEASON = 2027

/** Before this date nobody can even begin to register: the portal is open for
 *  looking only (PDL P8). A launch happens once, so this is a real date and not
 *  a day of the year. */
export const REGISTRATION_OPENS = '2026-10-01'

/**
 * From the new year to the end of September: the season already running.
 *
 * Named, because it is where the year wraps round to. It closes on 30 September
 * rather than on 31 December (owner, 30.07.2026): from 1 October what is on sale
 * is the next season, so a member paying in October is not paying late for this
 * year, they are paying early for the next.
 */
const IN_SEASON: PriceRow = {
  key: 'season',
  from: '01-01',
  to: '09-30',
  eur: 40,
  rsd: 4800,
  ranking: false,
}

/* In the order a member reads them, which is the order the selling year runs
 * in: it opens on 1 October and the last of the four is the one that follows
 * the new year. */
export const PRICES: PriceRow[] = [
  { key: 'early', from: '10-01', to: '10-05', eur: 35, rsd: 4200, ranking: true },
  { key: 'regular', from: '10-06', to: '11-30', eur: 40, rsd: 4800, ranking: true },
  { key: 'late', from: '12-01', to: '12-31', eur: 50, rsd: 6000, ranking: true },
  IN_SEASON,
]

/** The same four in calendar order, which is what deciding what is in force and
 *  what comes next both walk. */
const BY_START = [...PRICES].sort((left, right) => left.from.localeCompare(right.from))

export const JUNIOR = { key: 'junior', eur: 20, rsd: 2400 }

/**
 * What membership costs on a given day, and there is always an answer.
 *
 * The four periods tile the year with no gap and no overlap, and a test holds
 * them to it. It used to be able to answer nothing, and the screens carried a
 * "membership is not on sale yet" for the day the list ran out; a list that
 * repeats every year cannot run out, so that day never comes.
 *
 * The last period whose first day has passed, rather than the one whose window
 * contains today. The two are the same answer, and this one cannot fail to have
 * one: the year begins inside a period.
 */
export function priceOn(today: string): PriceRow {
  const day = today.slice(5)

  return BY_START.reduce((inForce, row) => (row.from <= day ? row : inForce))
}

/** What it will cost next, which after the last period of the year is the first
 *  period of the next one. */
export function nextPrice(today: string): PriceRow {
  return BY_START.find((row) => row.from > today.slice(5)) ?? IN_SEASON
}

/** And the day that happens, as a real date: next year where the year has run
 *  out of periods. */
export function nextPriceStart(today: string): string {
  const next = nextPrice(today)
  const wraps = next.from <= today.slice(5)

  return `${Number(today.slice(0, 4)) + (wraps ? 1 : 0)}-${next.from}`
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)

  return Math.round((end - start) / 86_400_000)
}

export function registrationOpen(today: string): boolean {
  return today >= REGISTRATION_OPENS
}

/**
 * The season somebody joining today would be joining.
 *
 * The calendar answer, except that it can never be a season before the first
 * one. 2026 is the year the portal is built in and there is no 2026 season
 * (PDL P2), so through the whole of that summer the answer is 2027: the first
 * season anybody can join, and the one the price list is quoting for. From then
 * on the two are the same and this simply hands the calendar's answer on.
 */
export function seasonOnOffer(today: string): number {
  return Math.max(SEASON, seasonOnSale(today))
}

/**
 * The season a renewal now is a renewal for.
 *
 * Always one that has not begun. The season on offer and the season being
 * renewed are the same thing from October to December and different for the nine
 * months before it: in August 2027 somebody joining is joining 2027, but the
 * renewal that opens in October is for 2028, and the screen read "Obnova
 * članarine za 2027" directly above "renewal opens on 1 October".
 *
 * A transfer is the same question with the same answer: asked for now, it takes
 * effect at the start of the next season and never during a running one
 * (PDL P13).
 */
export function seasonBeingRenewed(today: string): number {
  return Math.max(SEASON, Number(today.slice(0, 4)) + 1)
}

/** The league the portal exists for. It is implied everywhere and is never
 *  listed among the competitions that run alongside it. */
export const MAIN_LEAGUE_SLUG = `btl-${SEASON}`

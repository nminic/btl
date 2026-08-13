import { intlTag } from './intlTag'

/* Formatting of the numbers this portal is made of: race times, distances,
 * elevation and BTL points. Kept apart from translation because these follow
 * the locale, not the dictionary.
 */

/* An Intl formatter is expensive to build and free to use again, and this portal
 * formats per row: a ranking table formats six numbers on every row it draws,
 * and the list of events a race can belong to formats twelve hundred dates every
 * time that screen draws. Building one per value made drawing those screens cost
 * more than everything else on them put together.
 *
 * There are as many formatters as there are shapes, which is a handful, so they
 * are kept for the life of the page rather than counted or evicted. Nothing here
 * depends on the values, so the same formatter always gives the same answer.
 */
const numbers = new Map<string, Intl.NumberFormat>()
const dates = new Map<string, Intl.DateTimeFormat>()

function kept<T>(cache: Map<string, T>, key: string, build: () => T): T {
  const found = cache.get(key)

  if (found !== undefined) {
    return found
  }

  const made = build()
  cache.set(key, made)

  return made
}

/** The four shapes of date this portal shows, named rather than repeated. A
 *  name and not a string, so a fifth one cannot be asked for by typo. */
type DateShape = 'long' | 'short' | 'monthYear' | 'year'

const DATE_SHAPES: Record<DateShape, Intl.DateTimeFormatOptions> = {
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  short: { day: 'numeric', month: 'numeric', year: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' },
  /* A year on its own is still a date rather than a number: Serbian writes
     "2027." with the full stop that makes it an ordinal, English writes "2027".
     Formatted rather than printed, so neither language has to be special. */
  year: { year: 'numeric' },
}

function numberFormat(locale: string, fractionDigits: number): Intl.NumberFormat {
  const tag = intlTag(locale)

  return kept(
    numbers,
    `${tag}|${fractionDigits}`,
    () =>
      new Intl.NumberFormat(tag, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
  )
}

function dateFormat(locale: string, shape: DateShape): Intl.DateTimeFormat {
  const tag = intlTag(locale)

  return kept(dates, `${tag}|${shape}`, () => new Intl.DateTimeFormat(tag, DATE_SHAPES[shape]))
}

export function formatNumber(value: number, locale: string, fractionDigits = 0): string {
  return numberFormat(locale, fractionDigits).format(value)
}

/**
 * An amount of money as it stands, whole or not.
 *
 * `formatNumber` rounds to whole numbers unless told otherwise, and the price
 * list takes any number: an administrator who set 5,5 saw the price list say 5,5
 * and the membership screen promise „6 EUR", which is a different promise from
 * the one the terms point at. Two decimals where there are any, none where there
 * are not, so the common case stays „600 RSD" rather than „600,00 RSD".
 *
 * Here rather than beside one of the screens that needs it, because both of them
 * do: the price list writes the amounts an administrator sets and the membership
 * screen writes the same amounts back to the member. The euro figure used to go
 * out raw beside a formatted dinar one, so a Serbian sentence read „35.5 EUR, a
 * iz Srbije 4.200 RSD" with the decimal point of another language in it.
 */
export function money(amount: number, locale: string): string {
  return formatNumber(amount, locale, Number.isInteger(amount) ? 0 : 2)
}

/** BTL points are always shown with two decimals (see CLAUDE.md, domain). */
export function formatPoints(value: number, locale: string): string {
  return formatNumber(value, locale, 2)
}

export function formatDistance(kilometers: number, locale: string): string {
  return `${formatNumber(kilometers, locale, 1)} km`
}

export function formatElevation(meters: number, locale: string): string {
  return `${formatNumber(meters, locale)} m`
}

/**
 * Seconds to race time. Hours appear only when the race lasted that long, so a
 * 21 minute result reads 21:04 and an ultra reads 14:02:37. Minutes and
 * seconds are always two digits, which keeps the column aligned.
 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const padded = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`

  return hours > 0 ? `${hours}:${padded}` : padded
}

/* Time on the course, in the shape the owner asked for: 299 h 49' 43''. Not the
 * same as a race time, which is a clock reading and stays hh:mm:ss; this is a
 * quantity of time, and the marks say so. */
export function formatCourseTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60

  return `${hours} h ${String(minutes).padStart(2, '0')}' ${String(rest).padStart(2, '0')}''`
}

export function formatDate(isoDate: string, locale: string): string {
  return dateFormat(locale, 'long').format(new Date(isoDate))
}

export function formatShortDate(isoDate: string, locale: string): string {
  return dateFormat(locale, 'short').format(new Date(isoDate))
}

/**
 * "12.09." from "2027-09-12": the day and the month and nothing else, which is
 * the shape the owner asked for by name, twice (31.07.2026).
 *
 * No year, at any time of year. It was written out for a while, on the reasoning
 * that the next six events in the calendar are in the season after the one being
 * read; the owner asked for the plain form back, and the full date is on the
 * element anyway, in `datetime`, for anything that needs to know.
 *
 * Cut from the string rather than formatted through Intl, because this is a
 * fixed numeric shape. Intl is still what writes a date anywhere the words
 * matter.
 */
export function formatDayMonth(isoDate: string): string {
  return `${isoDate.slice(8, 10)}.${isoDate.slice(5, 7)}.`
}

/** "maj 2027." from "2027-05", for a calendar heading. */
export function formatMonth(month: string, locale: string): string {
  return dateFormat(locale, 'monthYear').format(new Date(`${month}-01T00:00:00Z`))
}

/** How many days a month has, which is the only thing that says whether a range
 *  ends on the last of it. Day nought of the next month is the last of this one. */
function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * A range of dates written as the whole period it covers, or null where it
 * covers no whole period and has to be read out from one date to the other
 * (PDL P28a, 30.07.2026, "Ispis vremenskog opsega").
 *
 * A range that describes a period is not spelled out as one. "od 1. jula do 31.
 * jula 2027" is a sentence a reader has to decode into "jul"; the ducats screen
 * was worse than that and put the two ISO strings on a public page.
 *
 * Three shapes, and the order they are tried in is part of the rule rather than
 * an implementation detail:
 *
 *   1. The same date at both ends, which is one day and is written as that day.
 *      First, because the first to the first of February is one day and would
 *      otherwise be read as an attempt at a month and come back as "februar".
 *   2. The first to the last of one month, which is that month.
 *   3. The first of January to the last of December, which is that year.
 *
 * Everything else is null, and the caller says "from X to Y" in its own words
 * with the two dates written for the reader.
 *
 * General rather than the ducats' own, because a range is a range wherever one
 * is shown. Both dates are given: a half-open range describes no period.
 */
export function wholePeriod(from: string, to: string, locale: string): string | null {
  if (from === to) {
    return formatShortDate(from, locale)
  }

  const year = to.slice(0, 4)
  const month = to.slice(0, 7)

  if (from === `${month}-01` && Number(to.slice(8)) === lastDayOf(Number(year), Number(to.slice(5, 7)))) {
    return formatMonth(month, locale)
  }

  if (from === `${year}-01-01` && to === `${year}-12-31`) {
    return dateFormat(locale, 'year').format(new Date(`${year}-01-01T00:00:00Z`))
  }

  return null
}

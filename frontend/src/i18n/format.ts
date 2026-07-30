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

/** The three shapes of date this portal shows, named rather than repeated. A
 *  name and not a string, so a fourth one cannot be asked for by typo. */
type DateShape = 'long' | 'short' | 'monthYear'

const DATE_SHAPES: Record<DateShape, Intl.DateTimeFormatOptions> = {
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  short: { day: 'numeric', month: 'numeric', year: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' },
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

/** "maj 2027." from "2027-05", for a calendar heading. */
export function formatMonth(month: string, locale: string): string {
  return dateFormat(locale, 'monthYear').format(new Date(`${month}-01T00:00:00Z`))
}

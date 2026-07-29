import { intlTag } from './intlTag'

/* Formatting of the numbers this portal is made of: race times, distances,
 * elevation and BTL points. Kept apart from translation because these follow
 * the locale, not the dictionary.
 */

export function formatNumber(value: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(intlTag(locale), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
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
  return new Intl.DateTimeFormat(intlTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoDate))
}

export function formatShortDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(isoDate))
}

/** "maj 2027." from "2027-05", for a calendar heading. */
export function formatMonth(month: string, locale: string): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T00:00:00Z`))
}

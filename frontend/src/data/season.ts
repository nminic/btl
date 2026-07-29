/* Dates that repeat every year, and the two windows they open.
 *
 * Renewal and transfers run on the same calendar on purpose: a member decides
 * once a year, in the same stretch of weeks, which category they run in and
 * which team they run for. Both windows shut at the end of the year, so a
 * season starts with everything already settled.
 */

/** Renewal and the transfer window both open on this day. */
export const WINDOW_OPENS = '10-01'

/** And both shut at the end of this day. Nothing is decided in January. */
export const WINDOW_CLOSES = '12-31'

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

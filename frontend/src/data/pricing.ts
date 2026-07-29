/* The price list as data with periods of validity, not as numbers written into
 * a screen (ADL A12). The front page reads it to say what membership costs
 * today and when that changes; the membership page reads the same rows.
 *
 * Two currencies are two price lists, not one with a conversion. The dinar
 * price is fixed for the season and does not follow the exchange rate.
 */

export type PriceRow = {
  key: string
  from: string
  to: string
  eur: number
  rsd: number
  /** False for the in-season price, which buys a profile but no place in the standing. */
  ranking: boolean
}

export const SEASON = 2027
export const SEASON_STARTS = '2027-01-01'
/** Before this date nobody can even begin to register: the portal is open for
 *  looking only (PDL P8). */
export const REGISTRATION_OPENS = '2026-10-01'

export const PRICES: PriceRow[] = [
  { key: 'early', from: '2026-10-01', to: '2026-10-05', eur: 35, rsd: 4200, ranking: true },
  { key: 'regular', from: '2026-10-06', to: '2026-11-30', eur: 40, rsd: 4800, ranking: true },
  { key: 'late', from: '2026-12-01', to: '2026-12-31', eur: 50, rsd: 6000, ranking: true },
  { key: 'season', from: '2027-01-01', to: '2027-12-31', eur: 40, rsd: 4800, ranking: false },
]

export const JUNIOR = { key: 'junior', eur: 20, rsd: 2400 }

export function priceOn(today: string): PriceRow | null {
  return PRICES.find((row) => row.from <= today && today <= row.to) ?? null
}

/** The row that follows the one in force, or null when this is the last one. */
export function priceAfter(row: PriceRow): PriceRow | null {
  return PRICES[PRICES.indexOf(row) + 1] ?? null
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)

  return Math.round((end - start) / 86_400_000)
}

export function registrationOpen(today: string): boolean {
  return today >= REGISTRATION_OPENS
}

/** The league the portal exists for. It is implied everywhere and is never
 *  listed among the competitions that run alongside it. */
export const MAIN_LEAGUE_SLUG = `btl-${SEASON}`

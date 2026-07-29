import type { RaceCategory } from './types'

/** The five length categories, recognised by the exact value with no tolerance
 *  (PDL P5): 42.2 is a marathon, 42.19 is a long race. */
export function categoryOf(distanceKm: number): RaceCategory {
  if (distanceKm === 42.2) {
    return 'marathon'
  }

  if (distanceKm === 21.1) {
    return 'half'
  }

  if (distanceKm > 42.2) {
    return 'ultra'
  }

  return distanceKm > 21.1 ? 'long' : 'short'
}


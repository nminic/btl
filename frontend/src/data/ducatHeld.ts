import { useCallback } from 'react'
import { useHeldRead } from '../pages/member/useHeldRead'
import { instanceAt, type Ducat, type DucatFamily, type DucatTier } from './ducatRule'
import type { Gender } from './types'
import type { ResourceState } from './useResource'

/**
 * THE DUCATS ONE MEMBER HOLDS, AS THE SERVER HAS AWARDED THEM: `GET /api/ducat-awards/{memberNumber}`
 * (`DucatAwardApi`, step five of seven of „Dukate dodeljuje verifikacija rezultata").
 *
 * Until 13.11.2026 the page of awards worked them out again from `/api/results` on every draw
 * (`data/ducatEarned.ts`). Now the server writes them when a result is verified, corrected or deleted and
 * at night (`AwardingDucats`), and this side reads what was written.
 *
 * **Newest first is the server's order and nothing here sorts.** The owner, PDL P11, 11.08.2026: „Dukati
 * na profilu idu hronološki, od najnovijeg ka najstarijem". The day that orders them is the day of the
 * race that won each one, and it never reaches this side: PDL, 08.11.2026, „taj datum ne prikazuje nigde
 * na portalu dok vlasnik ne odluči drugačije".
 */
export type HeldDucat = {
  /** The code of the family, which `/api/ducats` answers as `id`. */
  ducat: string
  /** The threshold he crossed, as it was written when he won it. */
  value: number
  /** What it was worth when he won it. */
  tier: DucatTier
  /** The season of a ducat of a month or of a season, null for one of all time. */
  season: number | null
  /** The month, 1 to 12, of a ducat of a month, null for any other. */
  month: number | null
}

const TIERS: readonly DucatTier[] = [1, 2, 3, 4, 5]

function aWhole(value: unknown, from: number, to: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= from && value <= to ? value : null
}

/** One record of the answer, or null where it is not the shape the server gives. */
function heldIn(one: unknown): HeldDucat | null {
  const ducat: unknown = Reflect.get(Object(one), 'ducat')
  const value: unknown = Reflect.get(Object(one), 'value')
  const tier = TIERS.find((each) => each === Reflect.get(Object(one), 'tier'))
  const season: unknown = Reflect.get(Object(one), 'season')
  const month: unknown = Reflect.get(Object(one), 'month')
  const inSeason = season === null ? null : aWhole(season, 1000, 9999)
  const inMonth = month === null ? null : aWhole(month, 1, 12)

  if (
    typeof ducat !== 'string' ||
    typeof value !== 'number' ||
    tier === undefined ||
    (season !== null && inSeason === null) ||
    (month !== null && (inMonth === null || inSeason === null))
  ) {
    return null
  }

  return { ducat, value, tier, season: inSeason, month: inMonth }
}

/** The answer of `GET /api/ducat-awards/{memberNumber}`, or null where it is not the shape the server gives. */
export function heldDucatsIn(body: unknown): HeldDucat[] | null {
  if (!Array.isArray(body)) {
    return null
  }

  const held: HeldDucat[] = []

  for (const one of body) {
    const read = heldIn(one)

    if (read === null) {
      return null
    }

    held.push(read)
  }

  return held
}

/**
 * Every ducat he holds, drawn from its family and in the order the server answered them.
 *
 * A ducat whose family is not among the ones `/api/ducats` serves is left off rather than drawn half: both
 * answers come from one server and one codebook, so it is a state of a deploy caught between two versions
 * and not one a member can bring about.
 */
export function heldDucats(held: HeldDucat[], families: DucatFamily[], gender: Gender): Ducat[] {
  return held.flatMap((one) => {
    const family = families.find((each) => each.id === one.ducat)

    return family === undefined ? [] : [instanceAt(family, gender, one)]
  })
}

async function heldBy(memberNumber: string): Promise<HeldDucat[] | null> {
  let answer: Response

  try {
    answer = await fetch(`/api/ducat-awards/${encodeURIComponent(memberNumber)}`)
  } catch {
    return null
  }

  if (!answer.ok) {
    return null
  }

  try {
    return heldDucatsIn(await answer.json())
  } catch {
    return null
  }
}

/**
 * The ducats of the member whose page this is, read once per member. Not a name of `RESOURCE_NAMES`: the
 * address carries the member (`/api/ducat-awards/000001`), the shape `data/useFrozenTables.ts` reads a
 * season by. An address with no member on it holds nothing, and is answered so without asking.
 */
export function useHeldDucats(memberNumber: string | undefined): ResourceState<HeldDucat[]> {
  const asked = memberNumber ?? ''
  const read = useCallback(async () => (asked === '' ? [] : heldBy(asked)), [asked])

  return useHeldRead(read, asked, 'The ducats of a member could not be read')
}

import { useCallback } from 'react'
import { useHeldRead } from '../pages/member/useHeldRead'
import { frozenTablesIn, type FrozenTables } from './frozen'
import { useFrozenSeasons, type ResourceState } from './useResource'

/**
 * EVERY TABLE OF ONE FROZEN SEASON, read once per season the screen asks about.
 *
 * Not a name of `RESOURCE_NAMES`: the address carries the season (`/api/frozen-tables/2027`), and a name
 * there is the whole address. Read the way the other addresses with a value in them are read
 * (`profile/TheMembersData.tsx`, `useHeldRead`), and only for a season `GET /api/frozen-seasons` lists:
 * a season that is not frozen has no snapshot, and its tables are the live answers.
 */
async function theTablesOf(season: number): Promise<FrozenTables | null> {
  let answer: Response

  try {
    answer = await fetch(`/api/frozen-tables/${season}`)
  } catch {
    return null
  }

  if (!answer.ok) {
    return null
  }

  try {
    return frozenTablesIn(await answer.json())
  } catch {
    return null
  }
}

export function useFrozenTables(season: number): ResourceState<FrozenTables> {
  const read = useCallback(() => theTablesOf(season), [season])

  return useHeldRead(read, season, 'The tables of a frozen season could not be read')
}

/**
 * EVERY TABLE OF EVERY FROZEN SEASON, for a screen that reads across seasons (a member's awards, PDL,
 * owner, 05.11.2026: „Strana „Priznanja i nagrade" za zamrznutu sezonu crta lične, timske i pehare para
 * ... Crta se iz snimka"). One read per frozen season, and none until the list of them has come back.
 */
export function useEveryFrozenTable(): ResourceState<FrozenTables[]> {
  const frozen = useFrozenSeasons()
  const asked = frozen.status === 'ready' ? frozen.data.map((one) => one.season).join(',') : ''
  const read = useCallback(async () => {
    const tables: FrozenTables[] = []

    for (const season of asked === '' ? [] : asked.split(',')) {
      const one = await theTablesOf(Number(season))

      if (one === null) {
        return null
      }

      tables.push(one)
    }

    return tables
  }, [asked])
  const held = useHeldRead(read, asked, 'The tables of the frozen seasons could not be read')

  /* Until the list of frozen seasons is in, its own state, which carries no data of either kind. */
  return frozen.status === 'ready' ? held : frozen.status === 'loading' ? { status: 'loading' } : frozen
}

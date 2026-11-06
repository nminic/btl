import { useCallback } from 'react'
import { useHeldRead } from '../pages/member/useHeldRead'
import { frozenTablesIn, type FrozenTables } from './frozen'
import type { ResourceState } from './useResource'

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

import { useEffect, useMemo, useState } from 'react'
import type { Badge } from './badgeRule'
import { useSession } from '../session/useSession'
import { loadResource, type ResourceName } from './client'
import type {
  BtlEvent,
  Competitor,
  League,
  Moderator,
  Race,
  Result,
  StaticPage,
  Team,
} from './types'

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: Error }

export function useResource<T>(name: ResourceName): ResourceState<T> {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })

    loadResource<T>(name).then(
      (data) => {
        if (active) {
          setState({ status: 'ready', data })
        }
      },
      (error: Error) => {
        if (active) {
          setState({ status: 'error', error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [name])

  return state
}

/**
 * What a resource holds, or a stand-in until it does.
 *
 * For the places that must not wait and must not turn into an error message: the
 * count beside Verification in the header sits above every screen on the portal,
 * and the list of queues has eight rows of which any one file feeds two at most.
 * A number one short is better than a header that holds up the page, or a whole
 * screen refusing to draw over a file none of its rows come from. Everywhere
 * else <Resource> is the answer, because a screen showing half its data as if it
 * were all of it is worse than a screen saying it is broken.
 */
export function dataOr<T>(state: ResourceState<T>, fallback: T): T {
  return state.status === 'ready' ? state.data : fallback
}

/** Whether a resource failed, for the screens that carry on without it and have
 *  to say so rather than quietly counting it as empty. */
export function failed(...states: ResourceState<unknown>[]): boolean {
  return states.some((state) => state.status === 'error')
}

/* One screen usually needs several resources at once, and it has to show one
 * loading state and one error, not three. Error wins over loading, because a
 * screen that is partly broken is broken. */
export function combineResources<A, B, C>(
  first: ResourceState<A>,
  second: ResourceState<B>,
  third: ResourceState<C>,
): ResourceState<[A, B, C]> {
  const all = [first, second, third]
  const failed = all.find((state) => state.status === 'error')

  if (failed !== undefined) {
    return failed as ResourceState<[A, B, C]>
  }

  if (first.status !== 'ready' || second.status !== 'ready' || third.status !== 'ready') {
    return { status: 'loading' }
  }

  return { status: 'ready', data: [first.data, second.data, third.data] }
}

/** Four of them, for the front page, which reads competitors, events, results
 *  and races. */
export function combineFour<A, B, C, D>(
  first: ResourceState<A>,
  second: ResourceState<B>,
  third: ResourceState<C>,
  fourth: ResourceState<D>,
): ResourceState<[A, B, C, D]> {
  const all = [first, second, third, fourth]
  const failed = all.find((state) => state.status === 'error')

  if (failed !== undefined) {
    return failed as ResourceState<[A, B, C, D]>
  }

  if (
    first.status !== 'ready' ||
    second.status !== 'ready' ||
    third.status !== 'ready' ||
    fourth.status !== 'ready'
  ) {
    return { status: 'loading' }
  }

  return { status: 'ready', data: [first.data, second.data, third.data, fourth.data] }
}

/** The same idea for the common case of exactly two resources. */
export function combinePair<A, B>(
  first: ResourceState<A>,
  second: ResourceState<B>,
): ResourceState<[A, B]> {
  const failed = [first, second].find((state) => state.status === 'error')

  if (failed !== undefined) {
    return failed as ResourceState<[A, B]>
  }

  if (first.status !== 'ready' || second.status !== 'ready') {
    return { status: 'loading' }
  }

  return { status: 'ready', data: [first.data, second.data] }
}

/**
 * A list read from the disc with what this visit deleted taken out of it.
 *
 * The prototype has no database, so a deletion is remembered in the session and
 * every screen has to read past it. The administration's own lists always did,
 * through `recordsOf`; the public screens read the file straight and did not,
 * which nobody noticed while deleting was something only the administration
 * could do to a record only the administration showed.
 *
 * Deleting an event is not that. The owner asked for a button on the event's own
 * page that removes the event and its races (03.08.2026), and the first thing
 * anybody does after pressing it is look at the calendar. An event that is still
 * there reads as a portal that did not do what it said.
 *
 * Three of them are read this way today: the events, their races, and the
 * results, because deleting an event takes all three. Teams, leagues and the
 * rest still read the file straight on their public screens, which is the same
 * hole and is older than this; closing it properly means the whole of
 * `recordsOf` moving down here, together with what an entity is, and that is a
 * change of its own rather than a line in this one.
 */
function useLive<T>(state: ResourceState<T[]>, entity: string, idField: keyof T): ResourceState<T[]> {
  const { deletions } = useSession()
  const gone = deletions[entity]

  return useMemo(() => {
    if (state.status !== 'ready' || gone === undefined || gone.length === 0) {
      return state
    }

    return {
      status: 'ready',
      data: state.data.filter((one) => !gone.includes(String(one[idField]))),
    }
  }, [state, gone, idField])
}

export const useBadges = () => useResource<Badge[]>('badges')
export const useCompetitors = () => useResource<Competitor[]>('competitors')
export const useEvents = () => useLive(useResource<BtlEvent[]>('events'), 'events', 'id')
export const useLeagues = () => useResource<League[]>('leagues')
export const useModerators = () => useResource<Moderator[]>('moderators')
export const usePages = () => useResource<Record<string, StaticPage>>('pages')
export const useRaces = () => useLive(useResource<Race[]>('races'), 'races', 'id')
export const useResults = () => useLive(useResource<Result[]>('results'), 'results', 'id')
export const useTeams = () => useResource<Team[]>('teams')

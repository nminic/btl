import { useEffect, useMemo, useState } from 'react'
import type { Badge } from './badgeRule'
import { useSession } from '../session/useSession'
import { arrivedResource, loadResource, type ResourceName } from './client'
import type {
  BtlEvent,
  Competitor,
  EventComment,
  League,
  Moderator,
  PendingItem,
  Race,
  Result,
  StaticPage,
  Team,
} from './types'

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: Error }

/**
 * A resource, ready from the first render once this visit has already read it.
 *
 * The wait is real only the first time. Everything after it was a wait for
 * nothing: the value was in hand, and the screen still drew a loading box for a
 * render because the only way to reach the value was through a promise. What
 * that cost was not a flash but the scroll: the router puts a reader back where
 * they were as soon as the screen commits, and a screen that is one loading box
 * tall at that moment has nowhere to be put back to (owner, 04.08.2026).
 */
export function useResource<T>(name: ResourceName): ResourceState<T> {
  /* Read once, as this mounts, and never again while it is mounted.
   *
   * Once is all that is wanted: what the first render of a screen holds is what
   * decides whether the router has a page to put a scroll position back into.
   * Reading it on every render would be reading a value nothing here is
   * subscribed to.
   *
   * Which means this is written for a name that does not change, and every
   * caller passes a literal one: the nine wrappers at the foot of this file, and
   * `usePending`, which reads the queue. Handed a name that changes, the first render under the new one
   * would draw the old resource's data as though it were ready, and only the
   * effect would put it right. Making that correct is not a line in the effect,
   * which runs after that render: it is the state being adjusted during the
   * render itself. Worth writing on the day a caller needs it, and not before. */
  const [state, setState] = useState<ResourceState<T>>(() => atHand<T>(name))

  useEffect(() => {
    /* Asked for even when the value is already in hand, and that is what closes
       the window: a value landing between the render and this effect is seen by
       neither, and a version of this that returned early here left the screen
       waiting for ever with nothing scheduled to take it off (there is a test for
       that, in useResource.test.tsx). `loadResource` answers from the promise it
       is already holding, so what it costs is a render nobody sees. */
    let active = true

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

/** What this visit already holds for a resource, as a state a screen can draw. */
function atHand<T>(name: ResourceName): ResourceState<T> {
  const known = arrivedResource<T>(name)

  return known === undefined ? { status: 'loading' } : { status: 'ready', data: known }
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
/**
 * What is published under an event: what the file carries, and what a moderator
 * has let out during this visit.
 *
 * Merged here rather than at the screen, for the reason `usePending` gives about
 * proposals: one place decides what "published" means, so the event page cannot
 * disagree with the queue that published it. Without this a moderator approved a
 * comment and nothing appeared anywhere, which is the whole of what approving one
 * is for (owner, 06.08.2026).
 */
export function useComments(): ResourceState<EventComment[]> {
  const state = useResource<EventComment[]>('comments')
  /* The queue read here rather than through `usePending`, which lives with the
     administration and reads this module: importing it back would be a circle.
     What that hook adds is the proposals of this visit, which is what the second
     half of this is. */
  const queue = useResource<PendingItem[]>('verification')
  const { decisions, proposals } = useSession()

  return useMemo(() => {
    if (state.status !== 'ready' || queue.status !== 'ready') {
      return state
    }

    const letOut = [...queue.data, ...proposals]
      .filter((one) => one.queue === 'comments' && decisions[one.id]?.status === 'approved')
      .map(published)

    return { status: 'ready', data: [...state.data, ...letOut] }
  }, [state, queue, proposals, decisions])
}

/** A queue item as the record it becomes. The queue keeps the name the member
 *  had on the day, which is what a comment carries after they leave (PDL P11). */
function published(item: PendingItem): EventComment {
  return {
    id: item.id,
    eventId: item.subjectId,
    memberNumber: item.memberNumber,
    who: item.who,
    date: item.date,
    rating: item.rating,
    body: item.body,
  }
}
export const useCompetitors = () => useResource<Competitor[]>('competitors')
export const useEvents = () => useLive(useResource<BtlEvent[]>('events'), 'events', 'id')
export const useLeagues = () => useResource<League[]>('leagues')
export const useModerators = () => useResource<Moderator[]>('moderators')
export const usePages = () => useResource<Record<string, StaticPage>>('pages')
export const useRaces = () => useLive(useResource<Race[]>('races'), 'races', 'id')
/** What a deletion of results is filed under. Named here, where the results
 *  are read, rather than spelled out at the screen that deletes them. */
export const RESULTS = 'results'

export const useResults = () => useLive(useResource<Result[]>('results'), RESULTS, 'id')
export const useTeams = () => useResource<Team[]>('teams')

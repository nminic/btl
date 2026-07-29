import { useEffect, useState } from 'react'
import { loadResource, type ResourceName } from './client'
import type { BtlEvent, Competitor, League, Race, Result, StaticPage, Team } from './types'

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

export const useCompetitors = () => useResource<Competitor[]>('competitors')
export const useEvents = () => useResource<BtlEvent[]>('events')
export const useLeagues = () => useResource<League[]>('leagues')
export const usePages = () => useResource<Record<string, StaticPage>>('pages')
export const useRaces = () => useResource<Race[]>('races')
export const useResults = () => useResource<Result[]>('results')
export const useTeams = () => useResource<Team[]>('teams')

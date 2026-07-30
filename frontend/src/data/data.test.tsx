import { render, screen, waitFor } from '@testing-library/react'
import { loadResource, type ResourceName } from './client'
import type { Competitor } from './types'
import {
  combinePair,
  combineResources,
  dataOr,
  failed,
  useCompetitors,
  useEvents,
  useLeagues,
  useRaces,
  useResults,
  useTeams,
  useResource,
  type ResourceState,
} from './useResource'

function Probe({ name }: { name: ResourceName }) {
  const state = useResource<unknown[]>(name)

  if (state.status === 'loading') {
    return <span>ucitavanje</span>
  }

  if (state.status === 'error') {
    return <span>greska: {state.error.message}</span>
  }

  return <span>stavki: {state.data.length}</span>
}

function Wrappers() {
  const all = [
    useCompetitors(),
    useEvents(),
    useLeagues(),
    useRaces(),
    useResults(),
    useTeams(),
  ]

  return <span>spremno: {all.filter((state) => state.status === 'ready').length}</span>
}

describe('loadResource', () => {
  it('resolves a known resource', async () => {
    const competitors = await loadResource<Competitor[]>('competitors')

    expect(competitors.length).toBeGreaterThan(0)
    expect(competitors[0].memberNumber).toMatch(/^\d{6}$/)
  })

  it('rejects when the resource is not served', async () => {
    await expect(loadResource('nepostoji' as ResourceName)).rejects.toThrow('Cannot load')
  })
})

describe('useResource', () => {
  it('goes from loading to ready', async () => {
    render(<Probe name="events" />)

    expect(screen.getByText('ucitavanje')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/stavki:/)).toBeInTheDocument())
  })

  it('reports an error', async () => {
    render(<Probe name={'nepostoji' as ResourceName} />)

    await waitFor(() => expect(screen.getByText(/greska:/)).toBeInTheDocument())
  })

  it('keeps the answer to the question it is asking now', async () => {
    // The race the cleanup exists for: the name changes while the first
    // request is still open. If the stale answer wins, the screen shows the
    // wrong resource with no error anywhere.
    const { rerender } = render(<Probe name="competitors" />)
    rerender(<Probe name="teams" />)

    await waitFor(() => expect(screen.getByText(/stavki:/)).toBeInTheDocument())

    const teams = await loadResource<unknown[]>('teams')
    expect(screen.getByText(`stavki: ${teams.length}`)).toBeInTheDocument()
  })

  it('drops a failure that arrives after unmount', async () => {
    const onError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<Probe name={'nepostoji' as ResourceName} />)
    unmount()

    await Promise.resolve()
    await Promise.resolve()

    // Nothing was rendered and nothing complained: the guard swallowed the
    // late rejection instead of setting state on a dead component.
    expect(screen.queryByText(/greska:/)).not.toBeInTheDocument()
    expect(onError).not.toHaveBeenCalled()
    onError.mockRestore()
  })

  it('exposes one hook per resource', async () => {
    render(<Wrappers />)

    await waitFor(() => expect(screen.getByText('spremno: 6')).toBeInTheDocument())
  })
})

describe('combineResources', () => {
  const ready = <T,>(data: T): ResourceState<T> => ({ status: 'ready', data })
  const loading: ResourceState<never> = { status: 'loading' }
  const failed: ResourceState<never> = { status: 'error', error: new Error('pukla veza') }

  it('is ready only when all three are ready', () => {
    expect(combineResources(ready(1), ready('dva'), ready(true))).toEqual({
      status: 'ready',
      data: [1, 'dva', true],
    })
  })

  it('is loading while any is loading', () => {
    expect(combineResources(loading, ready(1), ready(1)).status).toBe('loading')
    expect(combineResources(ready(1), loading, ready(1)).status).toBe('loading')
    expect(combineResources(ready(1), ready(1), loading).status).toBe('loading')
  })

  it('lets an error win over loading', () => {
    expect(combineResources(loading, failed, ready(1))).toBe(failed)
  })
})

describe('combinePair', () => {
  const ready = <T,>(data: T): ResourceState<T> => ({ status: 'ready', data })
  const loading: ResourceState<never> = { status: 'loading' }
  const failed: ResourceState<never> = { status: 'error', error: new Error('pukla veza') }

  it('is ready only when both are ready', () => {
    expect(combinePair(ready(1), ready('dva'))).toEqual({ status: 'ready', data: [1, 'dva'] })
  })

  it('is loading while either is loading', () => {
    expect(combinePair(loading, ready(1)).status).toBe('loading')
    expect(combinePair(ready(1), loading).status).toBe('loading')
  })

  it('lets an error win over loading, because half a screen is a broken screen', () => {
    expect(combinePair(loading, failed)).toBe(failed)
    expect(combinePair(failed, ready(1))).toBe(failed)
  })
})

describe('dataOr and failed', () => {
  /* For the two places that must not wait and must not become an error message:
     the count in the header, which sits above every screen there is, and the list
     of queues, where one file feeds two rows at most. */
  const failure: ResourceState<number[]> = { status: 'error', error: new Error('pukla veza') }

  it('hands over what a resource holds, and a stand-in until it does', () => {
    expect(dataOr({ status: 'ready', data: [1, 2] }, [])).toEqual([1, 2])
    expect(dataOr({ status: 'loading' }, [])).toEqual([])
    expect(dataOr(failure, [])).toEqual([])
  })

  it('says when one of them failed, so nothing counts a failure as empty in silence', () => {
    expect(failed({ status: 'ready', data: [1] })).toBe(false)
    expect(failed({ status: 'loading' }, { status: 'ready', data: [1] })).toBe(false)
    expect(failed({ status: 'ready', data: [1] }, failure)).toBe(true)
  })
})

describe('the generated data', () => {
  it('carries no event in a state the portal does not have', async () => {
    /* A race has no state "announced" and none "postponed" (PDL P10). The
       generator wrote thirty of them, which is a state no screen and no decision
       knows what to do with. It lives outside the repo, so this is the only place
       that can notice. */
    const events = await loadResource<{ status: string }[]>('events')

    expect(events.length).toBeGreaterThan(0)
    expect([...new Set(events.map((one) => one.status))].sort()).toEqual(['confirmed'])
  })
})

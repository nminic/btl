import { render, screen, waitFor } from '@testing-library/react'
import { loadResource, type ResourceName } from './client'
import type { Competitor } from './types'
import {
  combineResources,
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
    expect(competitors[0].memberNumber).toMatch(/^[MF]\d{4}$/)
  })

  it('rejects an unknown resource', async () => {
    await expect(loadResource('nepostoji' as ResourceName)).rejects.toThrow('Unknown resource')
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

  it('ignores a result that arrives after unmount', async () => {
    const { unmount } = render(<Probe name="events" />)
    unmount()

    // Lets the pending promise settle against an unmounted component. React
    // would warn on a state update here, and the guard is what prevents it.
    await Promise.resolve()
    await Promise.resolve()
  })

  it('ignores a failure that arrives after unmount', async () => {
    const { unmount } = render(<Probe name={'nepostoji' as ResourceName} />)
    unmount()

    await Promise.resolve()
    await Promise.resolve()
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

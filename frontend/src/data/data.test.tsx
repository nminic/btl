import { render, screen, waitFor } from '@testing-library/react'
import { SessionProvider } from '../session/SessionProvider'
import { useSession } from '../session/useSession'
import { setupUser } from '../test/user'
import { first } from '../test/at'
import { eventSlug } from '../pages/admin/entityForms'
import { loadResource, type ResourceName } from './client'
import { commentFrom } from './comment'
import type { BtlEvent, Competitor, EventComment, PendingItem, Result } from './types'
import {
  combinePair,
  combineFour,
  combineResources,
  dataOr,
  failed,
  useComments,
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

/**
 * The address of every event, against the rule that builds one.
 *
 * The two came apart and nothing said so: the file held addresses carrying a
 * month, which the rule cannot build, and the administration rewrote one of
 * them on any save at all. Fifteen pairs of events share a name inside one year
 * in the history, so those addresses are the file's business and are allowed to
 * carry more; what is not allowed is an address the rule would build differently
 * out of the same name and year.
 */
describe('the address of an event', () => {
  it('is the one the rule builds, or that one with more on it', async () => {
    const events = await loadResource<BtlEvent[]>('events')
    /* The rule's answer, or the rule's answer and more after a dash: "more"
       must not run into the next address, so gradska-liga-usce-2017-05 counts
       and gradska-liga-usce-201705 does not. */
    const wrong = events.filter((one) => {
      const rule = eventSlug(one.name, one.date)

      return one.slug !== rule && !one.slug.startsWith(`${rule}-`)
    })

    expect(events.length).toBeGreaterThan(1000)
    expect(wrong.map((one) => `${one.slug} (${one.name}, ${one.date})`)).toEqual([])
  })

  it('answers for one event only', async () => {
    const events = await loadResource<BtlEvent[]>('events')
    const twice = events
      .map((one) => one.slug)
      .filter((slug, at, all) => all.indexOf(slug) !== at)

    expect(twice).toEqual([])
  })

  it('is what every result of it is joined by', async () => {
    /* A result names its event by address (EventDetail), so an address in the
       results that no event answers at is a race whose results are on nobody's
       page. */
    const events = await loadResource<BtlEvent[]>('events')
    const results = await loadResource<Result[]>('results')
    const addresses = new Set(events.map((one) => one.slug))

    expect(results.length).toBeGreaterThan(1000)
    expect([...new Set(results.map((one) => one.eventSlug))].filter((slug) => !addresses.has(slug))).toEqual([])
  })
})

describe('loadResource', () => {
  it('resolves a known resource', async () => {
    const competitors = await loadResource<Competitor[]>('competitors')

    expect(competitors.length).toBeGreaterThan(0)
    expect(first(competitors).memberNumber).toMatch(/^\d{6}$/)
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
    /* Inside a session, because two of the six read past what this visit has
       deleted and a deletion is remembered there (useResource.ts). */
    render(
      <SessionProvider>
        <Wrappers />
      </SessionProvider>,
    )

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

/* Four of them, for the front page, which reads competitors, events, results
 * and races. The same three rules as the three-way one, held separately,
 * because a copy that drifts is a screen that shows half its data. */
describe('combineFour', () => {
  const ready = <T,>(data: T): ResourceState<T> => ({ status: 'ready', data })
  const loading: ResourceState<never> = { status: 'loading' }
  const failed: ResourceState<never> = { status: 'error', error: new Error('pukla veza') }

  it('is ready only when all four are ready', () => {
    expect(combineFour(ready(1), ready('dva'), ready(true), ready('četiri'))).toEqual({
      status: 'ready',
      data: [1, 'dva', true, 'četiri'],
    })
  })

  it('is loading while any of the four is loading', () => {
    expect(combineFour(loading, ready(1), ready(1), ready(1)).status).toBe('loading')
    expect(combineFour(ready(1), loading, ready(1), ready(1)).status).toBe('loading')
    expect(combineFour(ready(1), ready(1), loading, ready(1)).status).toBe('loading')
    expect(combineFour(ready(1), ready(1), ready(1), loading).status).toBe('loading')
  })

  it('lets an error win over loading', () => {
    expect(combineFour(loading, failed, ready(1), ready(1))).toBe(failed)
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
  it('gives every member in the list a member number, and nobody else one', async () => {
    /* The list of members is keyed by the number and read by every public screen
       there is, whole. A member number is handed out at the moment the fee is
       recorded (PDL P8, 30.07.2026), so anybody in this list has one and anybody
       waiting to pay is not in this list at all. Three of them used to be, holding
       000032 to 000034, which put them on the front page among the newest members
       with numbers nobody had given them. The generator lives outside the repo, so
       this is the only place that can notice it happening again. */
    const competitors = await loadResource<Competitor[]>('competitors')
    const waiting = await loadResource<{ queue: string; memberNumber: string; email: string }[]>(
      'verification',
    )
    const memberships = waiting.filter((one) => one.queue === 'payments')

    expect(competitors.filter((one) => !/^\d{6}$/.test(one.memberNumber))).toEqual([])

    /* An inactive member is a different thing and does belong here: their fee
       ran out, they keep their number (PDL P8) and their name stays in the
       historic tables, while their profile is hidden (PDL P11). This used to
       assert there were none, which conflated "has not paid yet" with "no longer
       a member" and left the portal with nobody to check the hiding against. */
    expect(competitors.filter((one) => !one.active).length).toBe(1)

    expect(memberships.length).toBeGreaterThan(0)
    expect(memberships.filter((one) => one.memberNumber !== '')).toEqual([])
    expect(memberships.filter((one) => one.email === '')).toEqual([])
  })

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

/* A comment that has been let out and then taken down again.
 *
 * Not reachable from the queue today: a settled item leaves the list of waiting
 * ones, so no screen offers a second decision on it. The rule is written where
 * the reading is, because a list of "what is out" that ignored the decisions
 * would be a second answer to a question `decisions` already answers, and the
 * two would go out of step the day the queue is rebuilt around exactly this
 * (owner, 06.08.2026, no section of settled items).
 */
function LetOut() {
  const state = useComments()
  const { publish, settle } = useSession()
  const one: EventComment = {
    id: 'ver-kom-1',
    eventId: 'evt-fruskogorski-maraton-2010-05-08',
    memberNumber: '000007',
    who: 'Ime Prezime',
    date: '2026-08-06',
    rating: { organisation: 5, value: 4, ambience: 5 },
    body: 'Reci koje su izasle.',
  }
  const said = (status: 'approved' | 'rejected') => () => {
    publish(one)
    settle(one.id, { status, note: '', basis: '', memberNumber: '' })
  }

  /* The id of a comment the file already carries. What the queue hands over
     keeps the id it was queued under (commentFrom), so the day a backend
     answers with an approved comment under that id both sides name the one
     comment. */
  const twice: EventComment = { ...one, id: 'kom-1' }

  return (
    <>
      <span data-testid="mine">
        {state.status !== 'ready'
          ? state.status
          : state.data.filter((each) => each.id === one.id).length}
      </span>
      <span data-testid="twice">
        {state.status !== 'ready'
          ? state.status
          : state.data.filter((each) => each.id === twice.id).length}
      </span>
      <button type="button" onClick={said('approved')}>
        pusti
      </button>
      <button type="button" onClick={said('rejected')}>
        skini
      </button>
      <button
        type="button"
        onClick={() => {
          publish(twice)
          settle(twice.id, { status: 'approved', note: '', basis: '', memberNumber: '' })
        }}
      >
        pusti isti
      </button>
    </>
  )
}

describe('useComments', () => {
  it('drops a comment whose approval is changed to a deletion', async () => {
    const user = setupUser()

    render(
      <SessionProvider>
        <LetOut />
      </SessionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('mine')).toHaveTextContent('0'))

    await user.click(screen.getByRole('button', { name: 'pusti' }))
    expect(screen.getByTestId('mine')).toHaveTextContent('1')

    await user.click(screen.getByRole('button', { name: 'skini' }))
    expect(screen.getByTestId('mine')).toHaveTextContent('0')
  })

  it('draws a comment once when both sides name it', async () => {
    const user = setupUser()

    render(
      <SessionProvider>
        <LetOut />
      </SessionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('twice')).toHaveTextContent('1'))

    await user.click(screen.getByRole('button', { name: 'pusti isti' }))

    expect(screen.getByTestId('twice')).toHaveTextContent('1')
  })
})

/* What an approval turns a waiting comment into.
 *
 * Held field by field, and as a unit, because the screens cannot hold all of
 * it: the name is drawn off the member's record while they are still in the
 * league, so a name dropped here is invisible everywhere until the day that
 * member leaves, and then the card is blank with nothing to say why (PDL P11).
 */
describe('commentFrom', () => {
  it('carries every field of the waiting comment, and nothing of its own', () => {
    const waiting: PendingItem = {
      id: 'ver-kom-9',
      queue: 'comments',
      kind: '',
      date: '2026-08-06',
      memberNumber: '000007',
      who: 'Ime Prezime',
      subject: 'Fruškogorski maraton',
      subjectId: 'evt-fruskogorski-maraton-2010-05-08',
      body: 'Reci koje je clan napisao.',
      currentDate: '',
      proposedDate: '',
      email: '',
      city: '',
      country: '',
      rating: { organisation: 5, value: 4, ambience: 3 },
    }

    expect(commentFrom(waiting)).toEqual({
      id: 'ver-kom-9',
      eventId: 'evt-fruskogorski-maraton-2010-05-08',
      memberNumber: '000007',
      who: 'Ime Prezime',
      date: '2026-08-06',
      rating: { organisation: 5, value: 4, ambience: 3 },
      body: 'Reci koje je clan napisao.',
    })
  })
})

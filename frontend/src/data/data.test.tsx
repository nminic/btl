import { render, screen, waitFor } from '@testing-library/react'
import { SessionProvider } from '../session/SessionProvider'
import { useSession } from '../session/useSession'
import { setupUser } from '../test/user'
import { first, must } from '../test/at'
import { eventSlug } from '../pages/admin/entityForms'
import { loadResource, type ResourceName } from './client'
import { commentFrom } from './comment'
import countries from './countries.json'
import { plainly } from './places'
import { EVENT_KINDS, FEATURED, ITEM_KINDS, RACE_KINDS } from './types'
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
describe('what a waiting item says it is', () => {
  it('carries a kind the queue that draws it knows', async () => {
    /* `kind` is a closed list (types.ts) and the file is read as one without
       being checked, so a value outside it would be drawn under the literal
       `verification.body.` and a biography would be offered the button that
       hands it back to the member. */
    const items = await loadResource<PendingItem[]>('verification')
    const strange = items.filter((one) => !ITEM_KINDS.some((kind) => kind === one.kind))

    expect(items.length).toBeGreaterThan(10)
    expect(strange.map((one) => `${one.id}: ${one.kind}`)).toEqual([])
  })

  it('says which sort it is on the one queue that holds two, and on no other', async () => {
    const items = await loadResource<PendingItem[]>('verification')
    const named = items.filter((one) => one.kind !== '')

    expect(named.length).toBeGreaterThan(0)
    expect(named.filter((one) => one.queue !== 'profiles')).toEqual([])
    expect(items.filter((one) => one.queue === 'profiles' && one.kind === '')).toEqual([])
  })
})

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

/**
 * Serves every resource off disk as usual, except the one named, whose file is
 * not there.
 *
 * What "not there" used to be was the name `nepostoji`, which is not a
 * `ResourceName` and so had to be called one (ADL A14 bans that). A real name
 * whose file does not answer walks the very same line of `client.ts` and needs
 * nothing claimed about it.
 */
function unserved(name: ResourceName) {
  const real = globalThis.fetch

  globalThis.fetch = async (input: RequestInfo | URL) =>
    String(input).endsWith(`/${name}.json`) ? new Response('nema', { status: 404 }) : real(input)

  return () => {
    globalThis.fetch = real
  }
}

describe('loadResource', () => {
  it('resolves a known resource', async () => {
    const competitors = await loadResource<Competitor[]>('competitors')

    expect(competitors.length).toBeGreaterThan(0)
    expect(first(competitors).memberNumber).toMatch(/^\d{6}$/)
  })

  it('rejects when the resource is not served', async () => {
    const restore = unserved('moderators')

    try {
      await expect(loadResource('moderators')).rejects.toThrow('Cannot load')
    } finally {
      restore()
    }
  })
})

describe('useResource', () => {
  it('goes from loading to ready', async () => {
    render(<Probe name="events" />)

    expect(screen.getByText('ucitavanje')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/stavki:/)).toBeInTheDocument())
  })

  it('reports an error', async () => {
    const restore = unserved('moderators')

    try {
      render(<Probe name="moderators" />)

      await waitFor(() => expect(screen.getByText(/greska:/)).toBeInTheDocument())
    } finally {
      restore()
    }
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
    const restore = unserved('moderators')

    try {
      const { unmount } = render(<Probe name="moderators" />)
      unmount()

      await Promise.resolve()
      await Promise.resolve()

      // Nothing was rendered and nothing complained: the guard swallowed the
      // late rejection instead of setting state on a dead component.
      expect(screen.queryByText(/greska:/)).not.toBeInTheDocument()
      expect(onError).not.toHaveBeenCalled()
    } finally {
      restore()
      onError.mockRestore()
    }
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

  it('carries a codebook of towns every one of which can be typed', async () => {
    /* Nine hundred kilobytes nobody in this repository wrote, read by a search
       that folds a letter with a mark above it onto the letter (`plainly`). A
       letter that fold does not know is a town that is in the codebook and
       cannot be reached: seventy eight towns in Poland were, Wrocław among
       them, because ł is a single letter and not an l with a stroke added, so
       there was nothing for the fold to take off.

       This is the guard that was missing when that went in. It reads the
       shipped file rather than a fixture, because the fault is a disagreement
       between this side and the generator, and a fixture agrees with whoever
       wrote it. */
    const places = await loadResource<[string, string, string?][]>('places')

    expect(places.length).toBeGreaterThan(40000)

    /* Both names, not only the first. The English one is what the English
       portal writes and what a person typing "belgrade" is matched against, and
       twelve towns in Macedonia shipped it in Cyrillic: the generator filtered
       the local name and appended the English one raw, and a Cyrillic main-list
       name is exactly what made the two differ. */
    const unreachable = places
      .flatMap(([name, country, english]) =>
        [name, english ?? name].map((written) => ({ written, country })),
      )
      .filter(({ written }) => /[^a-z0-9 '&.,()/-]/.test(plainly(written)))
      .map(({ written, country }) => `${written} (${country})`)

    expect(unreachable).toEqual([])
  })

  it('carries a codebook whose towns each say which country they are in', async () => {
    /* The country is the whole reason the field was allowed to swallow the one
       beside it, so a row without one is a town that files an event nowhere. */
    const places = await loadResource<[string, string, string?][]>('places')
    const nameless = places.filter(([name, country]) => name === '' || !/^[A-Z]{2}$/.test(country))

    expect(nameless).toEqual([])
  })

  it('names every country its towns stand in, and puts Kosovo in Serbia', async () => {
    /* Two things one guard can say, because they are the same failure. A select
       handed a country it has no option for draws an empty box, so a town whose
       country the list cannot name files a race nowhere.
     *
       Kosovo is one such: GeoNames writes it XK and holds twenty one towns
       there. The owner reads it as part of Serbia (11.08.2026): „ukoliko je
       mesto sa Kosova, automatski podrazumevana država postaje Srbija. Kosovo ne
       sme uopšte postojati u listi država." So the codebook writes those towns
       RS, and XK appears nowhere. */
    const places = await loadResource<[string, string, string?][]>('places')
    const named = new Set([...countries.region, ...countries.rest].map((one) => one.code))
    const strangers = [...new Set(places.map(([, country]) => country))].filter(
      (country) => !named.has(country),
    )

    expect(strangers).toEqual([])
    expect(places.filter(([, country]) => country === 'XK')).toEqual([])
    expect(named.has('XK')).toBe(false)
    /* And Priština is in Serbia, under its own name: the codebook of the world
       writes those towns in Albanian, and they are the only towns of Serbia that
       would then stand on a Serbian portal in another language (ADL A16 asks for
       the local name everywhere in the region). The foreign form stays as the
       English one, which is what the third place in a row is for. */
    expect(places.filter(([name]) => name === 'Priština')).toEqual([['Priština', 'RS', 'Pristina']])
    expect(places.filter(([name]) => name === 'Peć')).toEqual([['Peć', 'RS', 'Pejë']])
  })

  it('carries no event of a kind the portal does not have, and no state at all', async () => {
    /* An event has a kind and no state (owner, 10.08.2026): what is on the
       portal is on. The generator lives outside the repo, so this is the only
       place that can notice it writing a word no screen knows.

       Two of the three kinds are in the data, and that is the state as of
       24.08.2026 rather than a weakening: seven events used to be trainings because
       the generator read the kind out of the name, „BTL trening trek" among them,
       and every one of them had races and results that people really ran. Once a
       gathering and a training stopped having races, such an event contradicted
       itself, and the owner chose to let them be what they were rather than delete
       seventeen races and forty-four results. No training is left in the archive.

       Written out rather than counted, and both halves asked: no word the portal
       does not know, and the gathering still there. A count taken off the data would
       be satisfied by the data itself, and „every kind is known" alone would pass on
       a file of nothing but races. */
    const events = await loadResource<{ kind: string; status?: string }[]>('events')
    const kinds = [...new Set(events.map((one) => one.kind))].sort()

    expect(events.length).toBeGreaterThan(0)
    expect(kinds.every((one) => EVENT_KINDS.some((known) => known === one))).toBe(true)
    expect(kinds).toContain('gathering')
    expect(kinds).toContain('race')
    expect(events.filter((one) => one.status !== undefined)).toEqual([])
  })

  it('writes on every race which of the three kinds it is, and a limit that agrees', async () => {
    /* The same guard the events have over their own kind, and for the same reason:
       nothing between the generator and the screen checks this, and a word the
       portal does not know reaches `raceLabel` as a race of no kind at all.

       Every race in the file is a race of a length and was before the field
       existed, so what this measures today is that the field is on all of them and
       says the one thing that is true. It goes on measuring something the day the
       first timed race is entered, which is what the second half is for: a limit
       belongs to a timed race and to no other kind, so a length race carrying one
       and a timed race carrying none are both caught here rather than in the name
       the race is drawn under. */
    const races = await loadResource<{ kind: string; limitSeconds: number }[]>('races')
    const kinds = [...new Set(races.map((one) => one.kind))].sort()

    expect(races.length).toBeGreaterThan(0)
    expect(kinds.every((one) => RACE_KINDS.some((known) => known === one))).toBe(true)
    expect(races.filter((one) => one.kind === undefined)).toEqual([])
    expect(
      races.filter((one) => (one.kind === 'time') !== (one.limitSeconds > 0)),
    ).toEqual([])
  })

  it('writes whether an event is featured as one of the two words the form offers', async () => {
    /* The same guard the kind has, and for the same reason: the generator lives
       outside the repo and writes this field by hand in three places. „Yes"
       instead of „yes" reaches the form as a value with no option behind it, and
       a select handed a value it has no option for draws an empty box
       (forms/PlaceField.tsx carries the rest of that story). Nothing else on the
       portal would notice. */
    const events = await loadResource<{ featured: string }[]>('events')
    const featured = events.map((one) => one.featured)

    expect(featured.filter((one) => !FEATURED.some((word) => word === one))).toEqual([])
    /* And both words stand in the fixture, so neither goes untried on a screen. */
    expect([...new Set(featured)].sort()).toEqual(['no', 'yes'])
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
      picture: '',
      crop: { x: 0.5, y: 0.5, size: 1 },
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

describe('the credit the codebook of towns asks for', () => {
  it('names GeoNames, links the source and links the licence, in the terms and nowhere else', async () => {
    /* CC BY 4.0 is a condition, not a courtesy: the source has to be named
       wherever the material is shared. The owner asked on 11.08.2026 for it to
       be as quiet as it can be while still being that, so it left the footer for
       the last paragraph of the last section of the terms of use, and the terms
       are linked from the footer of every screen.

       Held here because it is one sentence in a file of content and nothing else
       would notice it going: all three parts have to survive, and it has to
       survive in exactly one place.

       It moved once more on 22.08.2026, out of the sign-off and into the section
       on technical partners the owner added above it, which is where a credit
       belongs. Found by the sentence rather than by counting to the last
       section, so the next section added under it does not break this. */
    const pages = await loadResource<Record<string, { sections: { body: string }[] }>>('pages')
    const carrying = Object.entries(pages).filter(([, page]) =>
      page.sections.some((section) => section.body.includes('GeoNames')),
    )

    expect(carrying.map(([name]) => name)).toEqual(['uslovi-koriscenja'])

    const terms = must(pages['uslovi-koriscenja'], 'the terms of use').sections
    const credit = must(
      terms.find((section) => section.body.includes('GeoNames')),
      'the section of the terms that names GeoNames',
    ).body

    expect(credit).toContain('GeoNames')
    expect(credit).toContain('https://www.geonames.org/')
    expect(credit).toContain('https://creativecommons.org/licenses/by/4.0/')
  })
})

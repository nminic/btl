import { render, screen, within } from '@testing-library/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ClockProvider } from '../../clock/ClockProvider'
import { I18nProvider } from '../../i18n/I18nProvider'
import { SessionProvider } from '../../session/SessionProvider'
import type { SessionValue } from '../../session/context'
import { useSession } from '../../session/useSession'
import { loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import { must } from '../../test/at'
import { formatDistance } from '../../i18n/format'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { raceFor } from './raceFor'
import { ReportResult } from './ReportResult'

/** Somebody signed in, since the form is only for members. */
const ME = '000007'

/* A result reported from the event it was run at (owner, 03.08.2026).
 *
 * The portal already had a form for this and it began by asking which event,
 * then the date, then the distance, the climb and the descent, all of which the
 * portal knows: they are on the race.
 */

const EVENT = 'maraton-maratona-2015'
const REPORT = `/sr/kalendar/${EVENT}/prijava`

describe('the way to report a result', () => {
  it('asks whoever is not signed in to sign in', async () => {
    renderAt(REPORT)

    expect(await screen.findByRole('heading', { name: /prijav/i })).toBeVisible()
    expect(screen.queryByLabelText(/^Trka/)).toBeNull()
  })

  it('opens on a race of that event and asks for nothing the portal knows', async () => {
    renderAt(REPORT, 'competitor', '000007')

    const race = await screen.findByLabelText(/^Trka/)

    /* Preselected, so an event of one race is a time and nothing else. */
    expect((race as HTMLSelectElement).value).not.toBe('')

    for (const asked of [/Sati/, /Minuta/, /Sekundi/, /Komentar/]) {
      expect(screen.getByLabelText(asked)).toBeVisible()
    }

    /* And none of the five the race already carries. */
    for (const known of [/Naziv događaja/, /Datum/, /Dužina/, /Uspon/, /Spust/]) {
      expect(screen.queryByLabelText(known)).toBeNull()
    }
  })

  it('offers only the races of the event it was opened from', async () => {
    renderAt(REPORT, 'competitor', '000007')

    const race = await screen.findByLabelText(/^Trka/)
    const offered = Array.from((race as HTMLSelectElement).options).length

    expect(offered).toBeGreaterThan(1)
    expect(offered).toBeLessThan(10)
  })
})

describe('an address that names no event', () => {
  it('says so rather than drawing a form against nothing', async () => {
    renderAt('/sr/kalendar/nepostoji/prijava', 'competitor', '000007')

    expect(await screen.findByRole('heading', { name: 'Ovog događaja nema.' })).toBeVisible()
  })
})

/**
 * Puts the session into a state before the screen under it is looked at.
 *
 * In an effect and not in the body. Calling it while rendering sets state on the
 * provider above during a child's render, which React reports as an error and
 * which happens to work; the screen under it waits for its data anyway, so an
 * effect is early enough.
 */
function Given({ act, children }: { act: (session: SessionValue) => void; children: ReactNode }) {
  const session = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      act(session)
    }
  }, [act, session])

  return <>{children}</>
}

describe('an event with no races on it', () => {
  it('says there is nothing to report rather than offering an empty choice', async () => {
    /* A form whose one choice is empty is a form that cannot be submitted and
       does not say why.
     *
       It is a real state and not a defensive one: an event exists before its
       races do. During the fortnight before registration opens the owner enters
       a weekend, opens it to check, and adds the distances after. Every event in
       the generated data already has a race, so the state is reached here by
       taking the one race away, which is the same thing from the other end and
       is what an organiser dropping a distance does. */
    /* Read as the day after that race, because a form on an event nobody has run
       yet says so before it gets as far as the distances (NotRunYet). */
    render(
      <ClockProvider simulatedDay="2027-12-28">
        <I18nProvider locale="sr">
          <MemoryRouter initialEntries={['/sr/kalendar/resolution-run-2027/prijava']}>
            <SessionProvider initialMemberNumber="000007">
              <Given act={(session) => session.remove('races', 'evt-resolution-run-2027-12-27-550')}>
                <Routes>
                  <Route path="/sr/kalendar/:slug/prijava" element={<ReportResult />} />
                </Routes>
              </Given>
            </SessionProvider>
          </MemoryRouter>
        </I18nProvider>
      </ClockProvider>,
    )

    expect(await screen.findByText(/nema nijednu trku/)).toBeVisible()
    expect(screen.queryByLabelText(/^Trka/)).toBeNull()
    /* And the way back is the event it came from. */
    expect(screen.getByRole('link', { name: 'Nazad na događaj' })).toBeVisible()
  })
})

describe('a result reported this way', () => {
  it('says how many points it earned and that it is waiting', async () => {
    const user = setupUser()
    renderAt(REPORT, 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Sati/), '3')
    await user.type(screen.getByLabelText(/Minuta/), '41')
    await user.type(screen.getByLabelText(/Sekundi/), '12')
    await user.type(screen.getByLabelText(/Komentar/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()
    /* The one thing the member came to find out (PDL P9). */
    expect(screen.getByText(/BTL poena/)).toBeVisible()
    expect(screen.getByText(/Moderator je proverava/)).toBeVisible()
  })

  it('reaches the queue the moderator decides in, with the points already worked out', async () => {
    const user = setupUser()
    const { router } = renderAt(REPORT, 'superadmin', '000007')

    await user.type(await screen.findByLabelText(/Sati/), '3')
    await user.type(screen.getByLabelText(/Minuta/), '41')
    await user.type(screen.getByLabelText(/Sekundi/), '12')
    await user.type(screen.getByLabelText(/Komentar/), 'Startni broj 412')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))
    await screen.findByRole('heading', { level: 1 })

    await router.navigate('/sr/administracija/verifikacija/rezultati')

    const table = await screen.findByRole('table', { name: 'Čeka proveru' })

    expect(table).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Odobri' }).length).toBeGreaterThan(0)

    /* What the member wrote, as words. The name of the event is not a link
       here, because this form asks for words and there is no address: an
       unchecked sentence in an `href` is an address made of that sentence. */
    expect(within(table).getByText('Startni broj 412')).toBeVisible()
    expect(within(table).queryByRole('link', { name: /Maraton maratona/ })).toBeNull()
  })

  it('scores a time of nothing at nothing, rather than falling over', async () => {
    /* The three boxes take a nought each, so a member can send in 0:00:00 by
       mistyping or by pressing through. The formula has no answer for a time of
       nothing and says so by returning nothing; the screen then has to say
       something, and nought points is the truthful thing to say. */
    const user = setupUser()
    renderAt(REPORT, 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Sati/), '0')
    await user.type(screen.getByLabelText(/Minuta/), '0')
    await user.type(screen.getByLabelText(/Sekundi/), '0')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()
    expect(screen.getByText(/0,00 BTL poena/)).toBeVisible()
  })

  it('refuses a time that was never typed', async () => {
    const user = setupUser()
    renderAt(REPORT, 'competitor', '000007')

    await screen.findByLabelText(/^Trka/)
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(screen.getAllByText('Ovo polje je obavezno.')).toHaveLength(3)
  })
})

describe('which race a reported result is scored against', () => {
  /* The choice is drawn from the event's own races and the field is required, so
     in the portal the second half never runs. It is here because a lookup that
     can miss has to say what it does when it does, and scoring against whichever
     race the form opened on is a decision rather than a shrug: the one thing
     worse than the wrong distance is a page that throws while somebody is
     sending in a result they have just run. */
  const race = (id: string): Race => ({
    id,
    eventId: 'e1',
    date: '2027-04-03',
    name: id,
    distanceKm: 10,
    ascentM: 0,
    descentM: 0,
    category: 'short',
  })

  const opened = race('a')
  const other = race('b')

  it('is the one that was chosen', () => {
    expect(raceFor([opened, other], 'b', opened)).toBe(other)
  })

  it('is the one the form opened on when the choice names no race it holds', () => {
    expect(raceFor([opened, other], 'nepostoji', opened)).toBe(opened)
    expect(raceFor([], 'a', opened)).toBe(opened)
  })
})

describe('an event that runs over two mornings', () => {
  /* A race carries its own day, and the form offers what has been run rather
     than what belongs to an event that has begun (owner, 11.08.2026): on the
     Saturday of a weekend the two Saturday races, on the Sunday all three.

     Read off the record rather than named here, so the day this fixture changes
     the test says what the screen says. */
  const WEEKEND = 'balkansko-prvenstvo-veterana-2021'

  async function racesOffered(): Promise<string[]> {
    const chooser = await screen.findByLabelText(/^Trka/)

    return [...(chooser as HTMLSelectElement).options].map((one) => one.textContent ?? '')
  }

  it('offers only the races of the first morning, on the first morning', async () => {
    const events = await loadResource<BtlEvent[]>('events')
    const races = await loadResource<Race[]>('races')
    const event = must(
      events.find((one) => one.slug === WEEKEND),
      'the event of that weekend',
    )
    const mine = races.filter((one) => one.eventId === event.id)
    const days = [...new Set(mine.map((one) => one.date))].sort()
    const first = must(days[0], 'its first morning')

    expect(days.length).toBeGreaterThan(1)

    renderAt(`/sr/kalendar/${WEEKEND}/prijava`, 'competitor', ME, undefined, first)

    expect(await racesOffered()).toHaveLength(mine.filter((one) => one.date === first).length)
  })

  it('offers all of them once the last morning has come', async () => {
    const events = await loadResource<BtlEvent[]>('events')
    const races = await loadResource<Race[]>('races')
    const event = must(
      events.find((one) => one.slug === WEEKEND),
      'the event of that weekend',
    )
    const mine = races.filter((one) => one.eventId === event.id)
    const last = must([...new Set(mine.map((one) => one.date))].sort().at(-1), 'its last morning')

    renderAt(`/sr/kalendar/${WEEKEND}/prijava`, 'competitor', ME, undefined, last)

    expect(await racesOffered()).toHaveLength(mine.length)
  })

  it('says there is nothing to report before the first morning', async () => {
    /* The event has begun in the calendar sense on its own date, so the older
       guard lets the form through; what stops it is that no race has been run. */
    const events = await loadResource<BtlEvent[]>('events')
    const event = must(
      events.find((one) => one.slug === WEEKEND),
      'the event of that weekend',
    )

    renderAt(`/sr/kalendar/${WEEKEND}/prijava`, 'competitor', ME, undefined, event.date)

    expect(await screen.findByLabelText(/^Trka/)).toBeVisible()
  })
})

describe('a race with no name of its own', () => {
  /* The name became optional on 11.08.2026 (owner), and what names such a race
     is its length: „tada je trka poznata po svojoj dužini". An empty cell would
     be a race nobody can tell from the one beside it, which is the whole reason
     PDL P10 says the name is what a person recognises a race by. */
  async function nameless() {
    const races = await loadResource<Race[]>('races')
    const events = await loadResource<BtlEvent[]>('events')
    const race = must(
      races.find((one) => one.name.trim() === ''),
      'a race entered without a name',
    )

    return {
      race,
      event: must(
        events.find((one) => one.id === race.eventId),
        'the event it belongs to',
      ),
    }
  }

  it('is listed under the event by its length', async () => {
    const { race, event } = await nameless()

    renderAt(`/sr/kalendar/${event.slug}`)

    const table = await screen.findByRole('table')

    expect(within(table).getAllByText(formatDistance(race.distanceKm, 'sr-Latn')).length)
      .toBeGreaterThan(0)
  })

  it('is offered by its length on the form that reports a result', async () => {
    const { race, event } = await nameless()

    renderAt(`/sr/kalendar/${event.slug}/prijava`, 'competitor', ME)

    const chooser = await screen.findByLabelText(/^Trka/)
    const said = [...(chooser as HTMLSelectElement).options].map((one) => one.textContent ?? '')

    /* By the length alone, with nothing dangling in front of it: written as
       name and length, a race with no name read " · 3,3 km". */
    expect(said).toContain(formatDistance(race.distanceKm, 'sr-Latn'))
  })
})

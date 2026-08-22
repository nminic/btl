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
import { first, must } from '../../test/at'
import { formatDistance, formatNumber } from '../../i18n/format'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { ReportResult } from './ReportResult'

/** Somebody signed in, since the form is only for members. */
const ME = '000007'

/* A result reported from the race it was run at (owner, 03.08.2026, and
 * 23.08.2026 for the race).
 *
 * The portal already had a form for this and it began by asking which event,
 * then the date, then the distance, the climb and the descent, all of which the
 * portal knows: they are on the race.
 *
 * Which race was the last thing it still asked, in a field at the top, and that
 * went too: the way in is a button in the row of the race on the event, so the
 * address carries the race and the form opens knowing (owner: „ne treba onda ni
 * dropdown na vrhu za izbor trke nego to zavisi od reda iz kog je kliknuto").
 */

const EVENT = 'maraton-maratona-2015'

/** The event and its races, off the disc, so a fixture that changes changes what
 *  these tests say rather than what they assume. */
async function racesOf(slug: string) {
  const events = await loadResource<BtlEvent[]>('events')
  const races = await loadResource<Race[]>('races')
  const event = must(
    events.find((one) => one.slug === slug),
    `the event ${slug}`,
  )

  return { event, races: races.filter((one) => one.eventId === event.id) }
}

/** The address the button in a race's row writes (EventDetail.tsx). */
function reportAddress(slug: string, race: Race): string {
  return `/sr/kalendar/${slug}/prijava?trka=${race.id}`
}

describe('the way to report a result', () => {
  it('asks whoever is not signed in to sign in', async () => {
    const { races } = await racesOf(EVENT)

    renderAt(reportAddress(EVENT, first(races)))

    expect(await screen.findByRole('heading', { name: /prijav/i })).toBeVisible()
    expect(screen.queryByLabelText(/Sati/)).toBeNull()
  })

  it('opens on the race the address names and asks for nothing the portal knows', async () => {
    const { races } = await racesOf(EVENT)

    renderAt(reportAddress(EVENT, first(races)), 'competitor', ME)

    for (const asked of [/Sati/, /Minuta/, /Sekundi/, /Komentar/, /Link ka zvaničnim/]) {
      expect(await screen.findByLabelText(asked)).toBeVisible()
    }

    /* And none of the five the race already carries, nor the sixth it used to
       ask for itself. */
    for (const known of [/Naziv događaja/, /Datum/, /Dužina/, /Uspon/, /Spust/, /^Trka/]) {
      expect(screen.queryByLabelText(known)).toBeNull()
    }
  })

  it('says which race it is reporting, by its length, in this language', async () => {
    /* A race is told from the one beside it by its length and by nothing else
       (data/types.ts): the event is the page this form was opened from. It stood
       in a list of choices until 23.08.2026 and stands in the sentence over the
       form now, said by the same helper, so the two never drifted apart.

       Written raw it read „5.0 km" with a full stop, which is not how a number
       is written in Serbian. */
    const { races } = await racesOf(EVENT)
    const race = first(races)

    renderAt(reportAddress(EVENT, race), 'competitor', ME)

    const note = await screen.findByText(/Prijavljuješ rezultat/)

    expect(note).toHaveTextContent(formatDistance(race.distanceKm, 'sr-Latn'))
    expect(note).toHaveTextContent('Maraton maratona')
  })

  it('refuses a race that belongs to another event', async () => {
    /* The address is written by the row that leads here, so an address naming a
       race this event has not run was typed by hand. Nothing is guessed: a form
       that quietly fell back to some race of this event would file somebody's
       time against a distance they never ran, and the points are worked out from
       that distance. */
    const other = await racesOf('fruskogorski-maraton-2010')

    renderAt(reportAddress(EVENT, first(other.races)), 'competitor', ME)

    expect(await screen.findByText(/Rezultat se unosi sa reda trke/)).toBeVisible()
    expect(screen.queryByLabelText(/Sati/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Nazad na događaj' })).toBeVisible()
  })

  it('refuses an address that names no race at all', async () => {
    renderAt(`/sr/kalendar/${EVENT}/prijava`, 'competitor', ME)

    expect(await screen.findByText(/Rezultat se unosi sa reda trke/)).toBeVisible()
    expect(screen.queryByLabelText(/Sati/)).toBeNull()
  })
})

describe('an address that names no event', () => {
  it('says so rather than drawing a form against nothing', async () => {
    renderAt('/sr/kalendar/nepostoji/prijava?trka=bilo-sta', 'competitor', ME)

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
  it('says there is nothing to report rather than saying the race is unknown', async () => {
    /* Two different silences, and the screen tells them apart: an event that has
       no race to report on says so, and an event that has one says where the way
       in is. Said differently because they are answered differently, one by an
       organiser entering a distance and one by the reader pressing the button in
       the row.
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
    expect(screen.queryByLabelText(/Sati/)).toBeNull()
    /* And the way back is the event it came from. */
    expect(screen.getByRole('link', { name: 'Nazad na događaj' })).toBeVisible()
  })
})

describe('a result reported this way', () => {
  /** The three boxes of the time, and the address of the official results. */
  async function fillIn(user: ReturnType<typeof setupUser>, said = 'https://primer.rs/rezultati') {
    await user.type(await screen.findByLabelText(/Sati/), '3')
    await user.type(screen.getByLabelText(/Minuta/), '41')
    await user.type(screen.getByLabelText(/Sekundi/), '12')
    await user.type(screen.getByLabelText(/Link ka zvaničnim/), said)
  }

  it('says how many points it earned and that it is waiting', async () => {
    const { races } = await racesOf(EVENT)
    const user = setupUser()

    renderAt(reportAddress(EVENT, first(races)), 'competitor', ME)
    await fillIn(user)
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()
    /* The one thing the member came to find out (PDL P9). */
    expect(screen.getByText(/BTL poena/)).toBeVisible()
    expect(screen.getByText(/Moderator je proverava/)).toBeVisible()
  })

  it('reaches the queue the moderator decides in, with the points already worked out', async () => {
    const { races } = await racesOf(EVENT)
    const user = setupUser()
    const { router } = renderAt(reportAddress(EVENT, first(races)), 'superadmin', ME)

    await fillIn(user)
    await user.type(screen.getByLabelText(/Komentar/), 'Startni broj 412')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))
    await screen.findByRole('heading', { level: 1 })

    await router.navigate('/sr/administracija/verifikacija/rezultati')

    const table = await screen.findByRole('table', { name: 'Čeka proveru' })

    expect(table).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Odobri' }).length).toBeGreaterThan(0)

    /* Both halves of what the member sent: the words as words, and the address
       as an address. The address used to be written into the field for words,
       because this form asked for no address at all; since 23.08.2026 it asks
       for one, so the queue can draw it as a link and the moderator can follow
       it. */
    expect(within(table).getByText('Startni broj 412')).toBeVisible()
    expect(within(table).getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('scores a time of nothing at nothing, rather than falling over', async () => {
    /* The three boxes take a nought each, so a member can send in 0:00:00 by
       mistyping or by pressing through. The formula has no answer for a time of
       nothing and says so by returning nothing; the screen then has to say
       something, and nought points is the truthful thing to say. */
    const { races } = await racesOf(EVENT)
    const user = setupUser()

    renderAt(reportAddress(EVENT, first(races)), 'competitor', ME)

    await user.type(await screen.findByLabelText(/Sati/), '0')
    await user.type(screen.getByLabelText(/Minuta/), '0')
    await user.type(screen.getByLabelText(/Sekundi/), '0')
    await user.type(screen.getByLabelText(/Link ka zvaničnim/), 'https://primer.rs/r')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()
    expect(screen.getByText(/0,00 BTL poena/)).toBeVisible()
  })

  it('refuses a form that was never filled in', async () => {
    /* Four boxes and not three since 23.08.2026: the address of the official
       results is asked for here exactly as it is asked for on the form outside
       the calendar, and it is obligatory unless a picture stands in its place
       (Član 37, forms/validate.ts). */
    const { races } = await racesOf(EVENT)
    const user = setupUser()

    renderAt(reportAddress(EVENT, first(races)), 'competitor', ME)

    await screen.findByLabelText(/Sati/)
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(screen.getAllByText('Ovo polje je obavezno.')).toHaveLength(4)
  })
})

describe('an event that runs over two mornings', () => {
  /* A race carries its own day, and a result can be reported on the day of that
     race or later (owner, 11.08.2026): on the Saturday of a weekend the two
     Saturday races, on the Sunday all three.

     The rule used to be kept by the list of choices, which offered what had been
     run. With the list gone it is kept by the same test the address goes
     through, which is stricter: the Sunday race is refused on the Saturday even
     though its address can be typed.

     Read off the record rather than named here, so the day this fixture changes
     the test says what the screen says. */
  const WEEKEND = 'balkansko-prvenstvo-veterana-2021'

  async function mornings() {
    const { event, races } = await racesOf(WEEKEND)
    const days = [...new Set(races.map((one) => one.date))].sort()

    expect(days.length).toBeGreaterThan(1)

    return {
      event,
      races,
      firstDay: must(days[0], 'its first morning'),
      lastDay: must(days.at(-1), 'its last morning'),
    }
  }

  it('takes a race of the first morning on the first morning', async () => {
    const { races, firstDay } = await mornings()
    const race = must(
      races.find((one) => one.date === firstDay),
      'a race of the first morning',
    )

    renderAt(reportAddress(WEEKEND, race), 'competitor', ME, undefined, firstDay)

    expect(await screen.findByLabelText(/Sati/)).toBeVisible()
  })

  it('refuses a race of the last morning until that morning has come', async () => {
    const { races, firstDay, lastDay } = await mornings()
    const race = must(
      races.find((one) => one.date === lastDay),
      'a race of the last morning',
    )

    renderAt(reportAddress(WEEKEND, race), 'competitor', ME, undefined, firstDay)

    expect(await screen.findByText(/Rezultat se unosi sa reda trke/)).toBeVisible()
    expect(screen.queryByLabelText(/Sati/)).toBeNull()
  })

  it('takes that same race once the last morning has come', async () => {
    const { races, lastDay } = await mornings()
    const race = must(
      races.find((one) => one.date === lastDay),
      'a race of the last morning',
    )

    renderAt(reportAddress(WEEKEND, race), 'competitor', ME, undefined, lastDay)

    expect(await screen.findByLabelText(/Sati/)).toBeVisible()
  })

  it('takes a first-morning race on the day of the event itself', async () => {
    /* The day of an event is the day of its first race (PDL P10), so on that day
       there is something to report. */
    const { event, races } = await mornings()
    const race = must(
      races.find((one) => one.date === event.date),
      'a race of the day the event is dated',
    )

    renderAt(reportAddress(WEEKEND, race), 'competitor', ME, undefined, event.date)

    expect(await screen.findByLabelText(/Sati/)).toBeVisible()
  })
})

describe('a race, which has no name of its own', () => {
  /* There is no such field any more (owner, 11.08.2026): what a runner is shown
     is the event and the measurements of the race they ran, „Beogradski maraton,
     21,1 km". So every screen that writes a race writes its length, and a race
     is told from the one beside it by that. */
  async function anyRace() {
    const races = await loadResource<Race[]>('races')
    const events = await loadResource<BtlEvent[]>('events')
    const race = first(races)

    return {
      race,
      event: must(
        events.find((one) => one.id === race.eventId),
        'the event it belongs to',
      ),
    }
  }

  it('is listed under the event by its measurements', async () => {
    /* And by no name, because there is none: the table of races under an event
       carries the day, the category and the numbers. */
    const { race, event } = await anyRace()

    renderAt(`/sr/kalendar/${event.slug}`)

    const table = await screen.findByRole('table', { name: 'Trke' })

    expect(within(table).getAllByText(formatNumber(race.distanceKm, 'sr-Latn', 2)).length)
      .toBeGreaterThan(0)
  })

  it('is named by its length on the form that reports a result', async () => {
    const { race, event } = await anyRace()

    renderAt(reportAddress(event.slug, race), 'competitor', ME)

    /* By the length alone, which is the whole of what tells two races of one
       event apart. */
    expect(await screen.findByText(/Prijavljuješ rezultat/)).toHaveTextContent(
      formatDistance(race.distanceKm, 'sr-Latn'),
    )
  })
})

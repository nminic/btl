import { render, screen, within } from '@testing-library/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ClockProvider } from '../../clock/ClockProvider'
import { I18nProvider } from '../../i18n/I18nProvider'
import { SessionProvider } from '../../session/SessionProvider'
import type { SessionValue } from '../../session/context'
import { useSession } from '../../session/useSession'

/** Everything the session is holding, one line each, so a case can read what was
 *  really sent rather than what the screen says about it. The same shape
 *  `pages/member/ownResult.test.tsx` uses. */
function Sent() {
  const { submissions } = useSession()

  return (
    <ul aria-label="store">
      {submissions.map((one) => (
        <li key={one.id}>{`${one.id} | ${one.raceName} | ${one.date}`}</li>
      ))}
    </ul>
  )
}

import { loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import { first, must } from '../../test/at'
import { formatDistance, formatNumber, formatShortDate, formatYear } from '../../i18n/format'
import { raceLabel } from '../../data/raceLabel'
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
    for (const known of [/^Naziv trke/, /Datum/, /Dužina/, /Uspon/, /Spust/, /^Trka/]) {
      expect(screen.queryByLabelText(known)).toBeNull()
    }
  })

  it('says which race it is reporting, by its name and length, in this language', async () => {
    /* A race is told from the one beside it by its name and its length, and by
       its day where two of them share both (`data/raceLabel.ts`, since
       28.08.2026): the event is the page this form was opened from. It stood
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

  it('sends the name of the race, not the name of the event it is run at', async () => {
    /* Owner, 23.08.2026: the result carries the race's name, and that is what the
       queue and „Moji rezultati" show. The field was renamed and the value was left
       behind for a day: a race the administrator had called „Mrazijada,
       polumaraton" reached the moderator as „Mrazijada".

       Measured on the one race in the data that carries a name of its own, because
       every other one is named after its event and the fault is invisible against
       them. */
    const { races } = await racesOf('mrazijada-2020')
    const own = must(
      races.find((race) => race.name.includes('polumaraton')),
      'the race with a name of its own',
    )
    const user = setupUser()
    const { router } = renderAt(reportAddress('mrazijada-2020', own), 'superadmin', ME)

    await fillIn(user)
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))
    await screen.findByRole('heading', { level: 1 })

    await router.navigate('/sr/administracija/verifikacija/rezultati')

    const table = await screen.findByRole('table', { name: 'Čeka proveru' })

    expect(within(table).getByText(own.name), 'the queue was sent the event name').toBeVisible()
  })

  it('names the column of the queue after the race, not after the event', async () => {
    /* The third of the three screens the owner named (23.08.2026). The cell was put
       right in the first round and the heading above it was left saying „Događaj";
       a round measured that nothing sees it, so the heading is asked for here. */
    const { races } = await racesOf('mrazijada-2020')
    const own = must(
      races.find((race) => race.name.includes('polumaraton')),
      'the race with a name of its own',
    )
    const user = setupUser()
    const { router } = renderAt(reportAddress('mrazijada-2020', own), 'superadmin', ME)

    await fillIn(user)
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))
    await screen.findByRole('heading', { level: 1 })

    await router.navigate('/sr/administracija/verifikacija/rezultati')

    const table = within(await screen.findByRole('table', { name: 'Čeka proveru' }))

    expect(
      table.getAllByRole('columnheader').map((one) => one.textContent),
      'the heading says the column holds events',
    ).toContain('Trka')
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

  it('sends no address at all where a picture stands in for one', async () => {
    /* Član 37, and the rule the form keeps on both ways in since 23.08.2026: a
       picture makes the link optional and the comment obligatory. What reaches
       the moderator then has no address, and the queue draws the name of the
       event as a name rather than as a link, because a sentence in an `href` is
       an address made of somebody's sentence (admin/ReviewQueue.tsx).

       Held from this side and not from the queue's, because it is the form that
       decides whether an address is sent at all. */
    const { races } = await racesOf(EVENT)
    const user = setupUser()
    const { router } = renderAt(reportAddress(EVENT, first(races)), 'superadmin', ME)

    await user.type(await screen.findByLabelText(/Sati/), '3')
    await user.type(screen.getByLabelText(/Minuta/), '41')
    await user.type(screen.getByLabelText(/Sekundi/), '12')
    await user.upload(
      screen.getByLabelText(/Slika kao dokaz/),
      new File(['proba'], 'sat.jpg', { type: 'image/jpeg' }),
    )
    await user.type(screen.getByLabelText(/Komentar/), 'Snimak sa sata, bez zvanicne liste')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))
    await screen.findByRole('heading', { level: 1 })

    await router.navigate('/sr/administracija/verifikacija/rezultati')

    const table = await screen.findByRole('table', { name: 'Čeka proveru' })

    expect(within(table).getByText('Snimak sa sata, bez zvanicne liste')).toBeVisible()
    expect(within(table).queryByRole('link', { name: /Maraton maratona/ })).toBeNull()
    expect(within(table).getAllByText(/Maraton maratona/).length).toBeGreaterThan(0)
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

describe('a race, which has a name of its own since 23.08.2026', () => {
  /* It had none until 23.08.2026, when the owner gave it one, and a runner was
     shown the event and the measurements instead: „Beogradski maraton, 21,1 km".
     Since then every screen that writes a race writes its name and its length, and
     the two together are what tells it from the one beside it
     (`data/raceLabel.ts`). */
  /** The one race in the file whose name is not its event's, which is the only
   *  kind that can tell a name apart from a length. Every other race carries the
   *  event's name, so a case built on one of those passes whether the label is the
   *  name or the length: the sentence it is read out of names the event as well.
   *  Measured on 28.08.2026, which is how this helper came to exist. */
  async function renamedRace() {
    const races = await loadResource<Race[]>('races')
    const events = await loadResource<BtlEvent[]>('events')
    const named = must(
      races
        .map((race) => ({ race, event: events.find((one) => one.id === race.eventId) }))
        .find(({ race, event }) => event !== undefined && event.name !== race.name),
      'a race called something other than its event',
    )

    return { race: named.race, event: must(named.event, 'the event it belongs to') }
  }

  /** And one run on a morning its event did not begin on, for the same reason: a
   *  race that carries its event's day cannot tell the two apart. Thirty of them
   *  in the file, counted the same day. */
  async function secondMorning() {
    const races = await loadResource<Race[]>('races')
    const events = await loadResource<BtlEvent[]>('events')
    const later = must(
      races
        .map((race) => ({ race, event: events.find((one) => one.id === race.eventId) }))
        .find(({ race, event }) => event !== undefined && event.date !== race.date),
      'a race run on a later morning than its event began',
    )

    return { race: later.race, event: must(later.event, 'the event it belongs to') }
  }

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
    /* The table of races under an event carries the name, the day and the
       numbers. It carried no name until 23.08.2026, when the owner gave a race
       one; the row has said it since, and this case is about the numbers beside
       it. */
    const { race, event } = await anyRace()

    renderAt(`/sr/kalendar/${event.slug}`)

    const table = await screen.findByRole('table', { name: 'Trke' })

    expect(within(table).getAllByText(formatNumber(race.distanceKm, 'sr-Latn', 2)).length)
      .toBeGreaterThan(0)
  })

  it('is named by its own name on the form that reports a result', async () => {
    const { race, event } = await renamedRace()

    renderAt(reportAddress(event.slug, race), 'competitor', ME)

    /* By its name, since 23.08.2026, when the owner gave a race one: „ja mogu da u
       okviru Beogradskog maratona imam dve trke, od 42.2 i 21.1, i obe će dobiti
       default naziv Beogradski maraton. Ali onda mogu izmeniti ovu drugu da se
       zove Beogradski polumaraton." Until 28.08.2026 this sentence said the
       length, so a race the administrator had renamed read „21,10 km" here and on
       the event's own page. */
    expect(await screen.findByText(/Prijavljuješ rezultat/)).toHaveTextContent(race.name)
    /* And its length beside it, which the name does not replace. A race's name
       starts out as its event's, and 886 of the 1163 events in the file hold
       exactly one race, so on three quarters of them the name alone says nothing
       the screen has not already said and the one thing that told the race apart
       is gone. Measured by a review on 28.08.2026 in Chrome: „sa trke Mala Sveta
       gora na događaju „Mala Sveta gora"", against „21,1 km" the day before. */
    expect(await screen.findByText(/Prijavljuješ rezultat/)).toHaveTextContent(
      formatDistance(race.distanceKm, 'sr-Latn'),
    )
  })

  it('names the race and nothing else, whatever the event is called', async () => {
    /* Owner, 29.08.2026, asked which of three forms this sentence should take:
       „Nikad događaj, uvek trka." One form everywhere, whether the two names differ
       or not.

       Asked as the **whole sentence** and not as the absence of a word, because the
       absence cannot be asked for here: a race's name starts out as its event's, so
       on most events the event's name is inside the race's and „does not contain it"
       is false while the sentence is right. Measured the day the event was taken
       out: with the clause gone and no case written this way, the whole suite stayed
       green, and the only thing that had ever held the sentence's shape was a case
       asking that the race's own label is somewhere inside it.

       On a race called something other than its event, so the two names really
       differ. Found by the helper that asks exactly that (`renamedRace`) and not by
       the `renamed` flag beside it: that flag says somebody typed the name by hand,
       which `pages/admin/EventRaces.tsx` writes on every keystroke, so a name typed
       back to the event's own would carry it and part the two facts. */
    const { race, event } = await renamedRace()
    const races = await loadResource<Race[]>('races')

    renderAt(reportAddress(event.slug, race), 'competitor', ME)

    const said = await screen.findByText(/Prijavljuješ rezultat/)
    const here = races.filter((one) => one.eventId === race.eventId)

    /* `textContent` and not `toHaveTextContent`, which asks whether the string is
       **somewhere inside** the element. A review on 30.08.2026 put the clause back
       as a sentence of its own at the end — „Trka je na događaju „X"." — and the
       whole suite stayed green, which is the decision broken and the guard that
       claims to hold it silent. */
    expect(said.textContent).toBe(
      `Prijavljuješ rezultat sa trke ${raceLabel(race, here, 'sr-Latn')}. Dužinu, uspon i spust portal već zna sa same trke.`,
    )
  })

  it('says its length even where its name is its event’s, which is most of them', async () => {
    /* The case the name alone got wrong, on the ordinary event rather than on the
       one renamed race in the file: 886 of the 1163 events that hold any race at
       all hold exactly one, and there the name is the event's name.

       The two are asked for **together**, as the one string the label builds, and
       not one at a time. Measured by a review on 28.08.2026: asking for the name on
       its own passes on such an event whatever the label returns, because the
       sentence names the event beside it. */
    const { race, event } = await anyRace()

    renderAt(reportAddress(event.slug, race), 'competitor', ME)

    expect(await screen.findByText(/Prijavljuješ rezultat/)).toHaveTextContent(
      `${race.name} ${formatYear(race.date, 'sr-Latn')} (${formatDistance(race.distanceKm, 'sr-Latn')})`,
    )
  })

  it('tells two races apart even where the day cannot, which is where it gave up', async () => {
    /* `formatDistance` writes one decimal, so 8,68 km and 8,74 km are two races and
       one label. BTL dezorijentiring 2018 runs twelve races of one name on one
       morning and holds both of those and 9,06 and 9,07 besides, so neither the
       name, nor the length as it is written, nor the day parts them: that page drew
       twelve links under ten different names, which is two pairs of links that
       sound the same and lead somewhere different (WCAG 2.2 SC 2.4.4).

       Two rounds of review were spent on this before it was closed. The first
       comparison used the stored number, so a pair that merely rounded together was
       counted as different and never offered the day at all; the second compared
       the written length, which offered them the day they already shared and made
       the labels fifteen characters longer without making them differ. What
       closes it is writing the length out exactly, and only there.

       Asked of the function rather than of a screen, because the pair that shows it
       is in one event of 1163 and the rule is about every event. */
    const races = await loadResource<Race[]>('races')
    const together = races.filter((one) => one.eventId === 'evt-btl-dezorijentiring-2018-12-23')

    expect(together.length, 'the file no longer holds the event this is about').toBeGreaterThan(1)

    const said = together.map((one) => raceLabel(one, together, 'sr-Latn'))

    expect(new Set(said).size, `two races read the same: ${said.join(' / ')}`).toBe(said.length)
    /* And the exact length is what does it, written the way the table of races on
       the same page already writes it. */
    /* The whole label and not a piece of it: „8,680 km" contains „8,68", so asking
       for the piece would let a finer number through, and the row of the table
       beside it writes two decimals. Measured by a review on 28.08.2026: with the
       label written to three decimals the suite stayed green.

       The row's own two decimals are guarded where the row is drawn („is listed
       under the event by its measurements"), and the two are written down here as
       one fact with two homes rather than joined into one: the row is a number in a
       column and the label is a sentence, and a helper shared between them would be
       a third home for a coincidence. What holds them together is that both are
       measured, each where it lives. */
    const eight = must(
      together.find((one) => one.distanceKm === 8.68),
      'the race this is about',
    )

    expect(raceLabel(eight, together, 'sr-Latn')).toBe(
      `${eight.name} ${formatYear(eight.date, 'sr-Latn')} (${formatNumber(8.68, 'sr-Latn', 2)} km)`,
    )
  })

  it('asks for no more than it needs, so an ordinary event reads as its lengths', async () => {
    /* Each step only where the one before it left two races reading the same. Three
       different lengths on one morning under one name need neither the day nor the
       second decimal, and a label that carries them anyway is a label nobody can
       scan. Measured over the whole file on 28.08.2026: of 1612 races, 24 labels
       reach the second step and 4 the third, and no two races of one event read the
       same.

       Measured by a review the same day: with the first step deciding on the name
       alone rather than on the whole label, the labels carrying a day went from 24
       to 722 and the whole suite stayed green. So this asks for the label itself,
       not for the absence of one part of it. */
    const races = await loadResource<Race[]>('races')
    const plain = races.filter((one) => one.eventId === 'evt-baja-sombor-2019-12-01')

    expect(plain.length, 'the file no longer holds the event this is about').toBe(3)

    const said = plain.map((one) => raceLabel(one, plain, 'sr-Latn'))

    expect(said).toEqual(
      plain.map((one) => `${one.name} ${formatYear(one.date, 'sr-Latn')} (${formatDistance(one.distanceKm, 'sr-Latn')})`),
    )
  })

  it('reaches for the exact length only where the day has already failed', async () => {
    /* The rule by which the third step is chosen over the second, which is the one
       thing the events in the file cannot measure: a review on 28.08.2026 replaced
       that rule with an unrelated one and **not one of the 1612 labels changed**,
       so the whole suite stayed green over a portal that would draw two links of
       one name.

       So the set is built here rather than found. Three races of one name: two that
       write the same length on one morning, and one on another morning. The day
       parts the third from the other two, so it must keep the day; it does not part
       the first two from each other, so they must go on to the exact length. */
    const one: Race = {
      id: 'a',
      eventId: 'e',
      name: 'Probna trka',
      renamed: 'no',
      kind: 'length',
      limitSeconds: 0,
      date: '2020-01-01',
      distanceKm: 8.68,
      ascentM: 0,
      descentM: 0,
      category: 'short',
    }
    const two: Race = { ...one, id: 'b', distanceKm: 8.74 }
    /* The same written length as the other two, so all three collide at the first
       step and the day is what has to part them. */
    const three: Race = { ...one, id: 'c', date: '2020-01-02', distanceKm: 8.7 }
    const among = [one, two, three]

    expect(raceLabel(one, among, 'sr-Latn')).toBe('Probna trka 2020. (8,68 km)')
    expect(raceLabel(two, among, 'sr-Latn')).toBe('Probna trka 2020. (8,74 km)')
    /* And the one the day does part keeps the day, rather than being written out to
       the hundredth along with them. */
    expect(raceLabel(three, among, 'sr-Latn')).toBe(
      `Probna trka ${formatShortDate(three.date, 'sr-Latn')} (${formatDistance(8.7, 'sr-Latn')})`,
    )
  })

  it('puts the day back where the exact length repeats across two mornings', async () => {
    /* The fault a review found on 29.08.2026, and the reason there is a fourth step
       at all. An event that runs the same two courses on two mornings collides at
       every one of the first three: both mornings hold 8,68 km and 8,74 km, so the
       name and the written length are one label for all four, the day is one label
       for each pair, and the exact length is one label for each pair again, because
       it repeats across the mornings. Ended at the third step, four races came out
       under two names.

       Not in `races.json` (0 collisions over 1612 races on 28.08.2026), and the
       administration takes it: a day and a length are typed by hand
       (`pages/admin/raceRows.ts`) and a race's name comes from its event. So the set
       is built here, as the set for the third step is.

       Where it is seen: `pages/EventDetail.tsx` draws one „Unesi rezultat" link per
       race, named by this, and four links two of which sound the same and lead
       somewhere different is WCAG 2.2 SC 2.4.4. */
    const morning: Race = {
      id: 'a',
      eventId: 'e',
      name: 'Probna trka',
      renamed: 'no',
      kind: 'length',
      limitSeconds: 0,
      date: '2020-01-01',
      distanceKm: 8.68,
      ascentM: 0,
      descentM: 0,
      category: 'short',
    }
    const among: Race[] = [
      morning,
      { ...morning, id: 'b', distanceKm: 8.74 },
      { ...morning, id: 'c', date: '2020-01-02' },
      { ...morning, id: 'd', date: '2020-01-02', distanceKm: 8.74 },
    ]

    const said = among.map((one) => raceLabel(one, among, 'sr-Latn'))

    expect(new Set(said).size, `two races read the same: ${said.join(' / ')}`).toBe(4)
    /* And they read as the exact length **and** the day, rather than as one or the
       other: the whole label is written out here so that a fourth step which said
       less could not pass by making the four differ some other way. */
    expect(said).toEqual(
      among.map(
        (one) =>
          `Probna trka ${formatShortDate(one.date, 'sr-Latn')} (${formatNumber(one.distanceKm, 'sr-Latn', 2)} km)`,
      ),
    )
  })

  it('says the fullest thing it has where nothing at all tells two races apart', async () => {
    /* The limit named in the note on the function, asked for rather than left to be
       inferred: one name, one morning and two lengths that agree to the hundredth
       cannot be parted by any label, and 8,681 km and 8,684 km are such a pair. What
       is being measured is that the function still answers, and answers with its
       last step rather than with its first: a reader gets everything there is and
       the two are then as close as the portal can bring them. */
    const one: Race = {
      id: 'a',
      eventId: 'e',
      name: 'Probna trka',
      renamed: 'no',
      kind: 'length',
      limitSeconds: 0,
      date: '2020-01-01',
      distanceKm: 8.681,
      ascentM: 0,
      descentM: 0,
      category: 'short',
    }
    const among: Race[] = [one, { ...one, id: 'b', distanceKm: 8.684 }]

    expect(raceLabel(one, among, 'sr-Latn')).toBe(
      `Probna trka ${formatShortDate(one.date, 'sr-Latn')} (${formatNumber(8.681, 'sr-Latn', 2)} km)`,
    )
  })

  it('lets two names of one length stand on the first rung', async () => {
    /* The names of the **other** races have to count, and a review on 29.08.2026
       found that nothing asked them to: with the comparison blind to them, every
       race read as though it shared its neighbours' name, so two races that their
       names already part were pushed down to the day and the hundredth. „Beogradski
       maraton 2020. (42,2 km)" became „Beogradski maraton 1. 1. 2020. (42,20 km)",
       which is a date and two decimals spent on a difference the first rung had
       already made.

       Both are asked, and by the whole label, because a rung is chosen once for the
       race and not once for the pair. */
    const one: Race = {
      id: 'a',
      eventId: 'e',
      name: 'Beogradski maraton',
      renamed: 'no',
      kind: 'length',
      limitSeconds: 0,
      date: '2020-01-01',
      distanceKm: 42.2,
      ascentM: 0,
      descentM: 0,
      category: 'long',
    }
    const among: Race[] = [one, { ...one, id: 'b', name: 'Beogradski polumaraton' }]
    const said = among.map((race) => raceLabel(race, among, 'sr-Latn'))

    expect(said).toEqual([
      `Beogradski maraton ${formatYear(one.date, 'sr-Latn')} (${formatDistance(42.2, 'sr-Latn')})`,
      `Beogradski polumaraton ${formatYear(one.date, 'sr-Latn')} (${formatDistance(42.2, 'sr-Latn')})`,
    ])
  })

  it('adds the day where the lengths repeat, and stops there', async () => {
    /* The second step, on the event the note names: four races of 42,2 km on four
       consecutive mornings. It needs the day and must not need the second decimal.
     */
    const races = await loadResource<Race[]>('races')
    const many = races.filter((one) => one.eventId === 'evt-danube-maraton-2022-03-14')

    expect(many.length, 'the file no longer holds the event this is about').toBe(4)

    const said = many.map((one) => raceLabel(one, many, 'sr-Latn'))

    expect(said).toEqual(
      many.map(
        (one) =>
          `${one.name} ${formatShortDate(one.date, 'sr-Latn')} (${formatDistance(one.distanceKm, 'sr-Latn')})`,
      ),
    )
  })

  it('files the result on the day the race was run, not the day the event began', async () => {
    /* An event may run over several mornings (PDL P10) and its own day is the
       first of them, so a result reported from the second morning of a two day
       event was filed on the first. The race carries the day it is run on, and
       that is the day somebody ran.

       On a race whose day really differs from its event's, because thirty of the
       file's races do and the rest cannot tell the two apart. */
    const { race, event } = await secondMorning()

    expect(race.date, 'the walk is built on a race that begins its event').not.toBe(event.date)

    const user = setupUser()

    renderAt(reportAddress(event.slug, race), 'competitor', ME, undefined, null, <Sent />)

    await screen.findByText(/Prijavljuješ rezultat/)
    await user.type(await screen.findByLabelText(/Sati/), '3')
    await user.type(screen.getByLabelText(/Minuta/), '30')
    await user.type(screen.getByLabelText(/Sekundi/), '0')
    await user.type(screen.getByLabelText(/Link ka zvaničnim/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))

    const stored = within(await screen.findByRole('list', { name: 'store' })).getAllByRole('listitem')

    expect(stored[0]?.textContent).toContain(race.date)
    expect(stored[0]?.textContent).not.toContain(event.date)
  })
})

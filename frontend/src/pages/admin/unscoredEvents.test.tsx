import { configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import { renderAt } from '../../test/render'
import { refused, serverThat } from '../../test/serverAnswers'
import { whatWasSent, whereItWrote } from '../../test/sent'
import { SLOW } from '../../test/slow'
import { setupUser, type Pressing } from '../../test/user'

/**
 * THE KIND „NEBODOVANA TRKA" ON THE EVENT FORM, AND WHAT IT HOLDS (owner, 14.11.2026, PDL „Ostale discipline kao
 * lična evidencija", fourth supplement and the second round of questions on the plan).
 *
 * <p>Five parts, and every case names the one it holds:
 * <ul>
 * <li>(a) four kinds, a scored race first: „Bodovana trka, Nebodovana trka, Trening, Skup. Default Bodovana
 * trka";</li>
 * <li>(b) an unscored race has races, filed, changed, refused and held exactly as those of a scored one;</li>
 * <li>(c) „Vrsta događaja koji ima ijedan rezultat ne može da se promeni između Bodovane i Nebodovane trke dok
 * rezultati stoje", on the screen;</li>
 * <li>(d) and the same sentence from the server where the screen did not stop him;</li>
 * <li>(e) the kind is shown in the list.</li>
 * </ul>
 *
 * <p><b>THE EVENTS, taken from the sample and asserted below so a change of the sample says so.</b> „Bešnjaja trek"
 * is a scored race with two races and four results (`adminEventKind.test.tsx`), and „Palićki triatlon" is the one
 * event of the sample that is an unscored race: one race, 51,5 km, and no result, since a result of an unscored
 * race is not in `/api/results` at all.
 */

/* Every wait of this file is given a quarter of the time a case has (the precedent is `adminEventKind.test.tsx`), so a
   wait that never succeeds ends the case with the assertion's own words and not with the case's clock: a case that
   fails by its clock cannot be told from a case that was never measured. */
configure({ asyncUtilTimeout: SLOW / 4 })

const THE_TRIATHLON = 'Palićki triatlon'
const THE_TREK = 'Bešnjaja trek'

describe('an event of the kind that is not scored', () => {
  let watching: ReturnType<typeof serverThat>
  let answering: (
    path: string,
    init: RequestInit | undefined,
  ) => Response | Promise<Response> | null

  /** What answers the portal's own reads, taken before the server of the case is put in front of it. */
  const real = globalThis.fetch

  beforeEach(() => {
    answering = () => null
    watching = serverThat((path, init) => answering(path, init))
  })

  afterEach(() => {
    watching.stop()
  })

  /** Opens the event of this name from the list, the way an administrator does, and waits for its races. */
  async function open(user: Pressing, name: string): Promise<void> {
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), name)
    await user.click(await screen.findByRole('button', { name: `Otvori: ${name}` }))
    await screen.findByRole('heading', { name: /^Trke na događaju/ })
  }

  /** What the select of the kind offers, in the order it offers it. */
  const kinds = (): string[] =>
    within(screen.getByLabelText(/^Vrsta događaja/))
      .getAllByRole('option')
      .map((one) => one.textContent)

  /** A new event with its two races, each named by hand, of the kind given. */
  async function aNewEventOfKind(user: Pressing, kind: string): Promise<void> {
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(screen.getByLabelText(/^Naziv događaja/), 'Nebodovani proba')
    await user.type(screen.getByLabelText(/^Datum/), '10012027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')
    await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), kind)

    for (const [at, race] of [
      { name: 'Plivanje', km: '1,5' },
      { name: 'Bicikl', km: '40' },
    ].entries()) {
      await user.click(screen.getByRole('button', { name: 'Nova trka' }))

      const called = screen.getByLabelText(`Trka, ${String(at + 1)}. trka`)

      await user.clear(called)
      await user.type(called, race.name)
      await user.type(screen.getAllByLabelText(/^Dužina/).at(-1) ?? called, race.km)
    }
  }

  it('offers four kinds, a scored race first, and opens a new event on it (a)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))

    expect(kinds()).toEqual(['Bodovana trka', 'Nebodovana trka', 'Trening', 'Skup'])
    expect(screen.getByLabelText(/^Vrsta događaja/)).toHaveValue('race')
    expect(screen.getByRole('option', { name: 'Bodovana trka' })).toHaveProperty('selected', true)
  }, SLOW)

  it('draws the table of races for it, and takes it away for a training, as for a scored race (b)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'unscored')

    expect(screen.getByRole('heading', { name: /^Trke na događaju/ })).toBeVisible()

    await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'training')

    expect(screen.queryByRole('heading', { name: /^Trke na događaju/ })).toBeNull()
  }, SLOW)

  it('saves a new one with its kind, and every race of it (b)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await aNewEventOfKind(user, 'unscored')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(whereItWrote(watching.asked)).toEqual([
      'POST /api/events',
      'POST /api/races',
      'POST /api/races',
    ])
    /* The kind went over as the word the route knows, and not as the scored race the form used to carry. */
    expect(whatWasSent(watching.asked).filter((one) => one.startsWith('POST /api/events'))).toEqual([
      expect.stringContaining('kind=unscored'),
    ])
  }, SLOW)

  it('saves an event of it that nobody touched the races of, and deletes none of them (b)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TRIATHLON)
    await user.type(screen.getByLabelText(/^Opis događaja/), 'jedna rečenica')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    /* No question over the save, no deletion, and no race written: it is the event alone that goes. */
    expect(whereItWrote(watching.asked)).toEqual(['PUT /api/events/1168'])
    expect(whatWasSent(watching.asked)).toEqual([expect.stringContaining('kind=unscored')])
  }, SLOW)

  it('sends the race of it that somebody changed, and only that one (b)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TRIATHLON)

    const called = screen.getByLabelText('Trka, 1. trka')

    await user.clear(called)
    await user.type(called, 'Triatlon na Paliću')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(whereItWrote(watching.asked)).toEqual(['PUT /api/events/1168', 'PUT /api/races/1613'])
  }, SLOW)

  it('says the event is saved and the race is not, in the words of a form that has races (b)', async () => {
    answering = (path, init) =>
      path === '/api/races/1613' && init?.method === 'PUT'
        ? refused('theDistanceIsNotKeptExactly')
        : null

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TRIATHLON)

    const called = screen.getByLabelText('Trka, 1. trka')

    await user.clear(called)
    await user.type(called, 'Triatlon na Paliću')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* The one sentence that says the refused races are to be corrected and pressed again, and not the one of a
       form whose races were meant to go and were kept. */
    expect(await screen.findByText(sr.admin.eventSavedRacesRefused)).toHaveAttribute('role', 'alert')
    expect(screen.queryByText(sr.admin.eventSavedRacesKept)).toBeNull()
  }, SLOW)

  it('does not save while a row of it is unfinished (b)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TRIATHLON)
    await user.clear(screen.getByLabelText('Trka, 1. trka'))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText(sr.admin.form.racesRefused)).toBeVisible()
    expect(whereItWrote(watching.asked)).toEqual([])
  }, SLOW)

  it('lets the day of the event follow its first race, as a scored race does (b)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TRIATHLON)

    const day = screen.getByLabelText('Datum, 1. trka')

    await user.clear(day)
    await user.type(day, '25072027')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    /* The event is saved on the day of its earliest race (owner, 10.08.2026), not on the day it was opened on. */
    expect(whatWasSent(watching.asked).find((one) => one.startsWith('PUT /api/events'))).toContain(
      'date=2027-07-25',
    )
  }, SLOW)

  it('asks before it takes the races of it away, with the number of results that go (b)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TRIATHLON)
    await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'gathering')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* Changing to a training or a gathering is not what the rule of the kind refuses (owner, 14.11.2026): it
       still takes the races away, and asks first (owner, 07.11.2026, PR 724). */
    expect(await screen.findByText('Ovim čuvanjem brišeš 1 trku i 0 rezultata.')).toBeVisible()
    expect(whereItWrote(watching.asked)).toEqual([])
  }, SLOW)

  it('is shown in the list under its own name (e)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await user.type(await screen.findByPlaceholderText('Naziv ili mesto'), THE_TRIATHLON)

    const row = within(await screen.findByRole('table', { name: 'Događaji' })).getAllByRole('row')[1]

    expect(within(row ?? document.body).getByText('Nebodovana trka')).toBeVisible()
  }, SLOW)

  it('holds an event that has a result to the kind it has, between a scored and an unscored race (c)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TREK)

    /* The unscored race is not offered, and what is still allowed stays: a training and a gathering. */
    expect(kinds()).toEqual(['Bodovana trka', 'Trening', 'Skup'])
    expect(screen.getByLabelText(/^Vrsta događaja/)).toHaveValue('race')
    /* And the reason is said on the screen, in words, beside the form: a list that lost an entry with no word
       about it would read as a fault. */
    expect(screen.getByText(sr.admin.kindHeldNote)).toBeVisible()
  }, SLOW)

  it('holds an unscored event that has a result to the kind it has, which the file of results cannot say today (c)', async () => {
    /* A result of an unscored race is not in `/api/results` (PDL, 14.11.2026: the route serves the scored ones
       and the unscored have a route of their own), so the sample has none and the case gives the screen one: the
       first result of the file, moved to the race of the unscored event. What is asked is that the kind the event
       HAS decides which of the two is taken out, and not a constant. */
    const answer = (path: string) =>
      real(path)
        .then((served) => served.json())
        .then((all: { raceId: number }[]) => {
          const [one] = all

          return new Response(JSON.stringify([...all, { ...one, id: 9999991, raceId: 1613 }]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        })

    answering = (path, init) =>
      path.startsWith('/api/results') && (init?.method ?? 'GET') === 'GET' ? answer(path) : null

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TRIATHLON)

    await waitFor(() => {
      expect(kinds()).toEqual(['Nebodovana trka', 'Trening', 'Skup'])
    })
    expect(screen.getByLabelText(/^Vrsta događaja/)).toHaveValue('unscored')
    expect(screen.getByText(sr.admin.kindHeldNote)).toBeVisible()
  }, SLOW)

  it('holds nothing of an event that has no result, which may change to either (c)', async () => {
    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TRIATHLON)

    expect(kinds()).toEqual(['Bodovana trka', 'Nebodovana trka', 'Trening', 'Skup'])
    expect(screen.getByLabelText(/^Vrsta događaja/)).toHaveValue('unscored')
    expect(screen.queryByText(sr.admin.kindHeldNote)).toBeNull()
  }, SLOW)

  it('holds nothing while the results are not here, and leaves it to the route (c)', async () => {
    /* A file that never comes is not a fact about the event. The sheet over a deletion says the number is not
       known in the same state; here it only decides whether a kind is held, and the route holds it all the same
       (case (d)). */
    answering = (path, init) =>
      path.startsWith('/api/results') && (init?.method ?? 'GET') === 'GET'
        ? new Promise<Response>(() => undefined)
        : null

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TREK)

    expect(kinds()).toEqual(['Bodovana trka', 'Nebodovana trka', 'Trening', 'Skup'])
  }, SLOW)

  it('says what the route says where it refuses the change the screen did not stop (d)', async () => {
    answering = (path, init) =>
      path === '/api/events/1168' && init?.method === 'PUT'
        ? refused('aKindWithResultsDoesNotChange', 409)
        : null

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await open(user, THE_TRIATHLON)
    await user.selectOptions(screen.getByLabelText(/^Vrsta događaja/), 'race')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText(sr.admin.eventSaveRefused.aKindWithResultsDoesNotChange)).toHaveAttribute(
      'role',
      'alert',
    )
    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
  }, SLOW)
})

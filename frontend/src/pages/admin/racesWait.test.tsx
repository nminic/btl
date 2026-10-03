import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, refused, serverThat } from '../../test/serverAnswers'
import { whereItWrote } from '../../test/sent'
import { SLOW } from '../../test/slow'
import { setupUser, type Pressing } from '../../test/user'

/**
 * „DOGAĐAJ OSTAJE, TRKE ČEKAJU", AND EVERYTHING THAT SENTENCE IS MADE OF.
 *
 * <p><b>Owner, 03.10.2026, chosen between offered outcomes</b> (PDL, „Izmene posle testiranja",
 * item 6): „kad čuvanje trka ne uspe, događaj ostaje sačuvan, a obrazac ostaje otvoren sa trkama i
 * jasnom porukom šta nije prošlo; ponovni pokušaj šalje samo trke, nikad drugi događaj." It came
 * out of QA: he entered an event with its races, the event was saved and not one race was, and
 * the screen said one of them had not been.
 *
 * <p>Five parts, and every case below names the ones it holds:
 * <ul>
 * <li>(a) the event stays saved: nothing takes it back, and the list shows it;</li>
 * <li>(b) the form stays open with every row;</li>
 * <li>(c) a clear message of what did not go through: every refused race, beside its row, with
 * the route's reason;</li>
 * <li>(d) a second press sends the races and nothing else;</li>
 * <li>(e) never a second event.</li>
 * </ul>
 *
 * <p><b>Two decisions of the coordinator's, reasoned from that sentence and not the owner's
 * words,</b> are held here as well: the event's own fields cannot be changed while its races wait,
 * since no press would send the change; and a refused race does not stop the press, so every race
 * is sent and every refusal is named.
 *
 * <p><b>The setups keep apart what a wrong answer would otherwise share.</b> The refused race is
 * the SECOND of three and not the first, so „the row refused" and „the first row" are two answers;
 * one of three is refused and not all, so „the rows refused" and „the rows" are two answers; and
 * every race has a name of its own, so a sentence put beside the wrong row says the wrong name.
 */

describe('an event whose races wait', () => {
  let watching: ReturnType<typeof serverThat>
  let answering: (
    path: string,
    init: RequestInit | undefined,
  ) => Response | Promise<Response> | null

  beforeEach(() => {
    answering = () => null
    watching = serverThat((path, init) => answering(path, init))
  })

  afterEach(() => {
    watching.stop()
  })

  const NOT_SAVED = 'Trke koje nisu sačuvane'

  /** What the list under the table says, item by item. */
  const notSaved = () =>
    within(screen.getByRole('list', { name: NOT_SAVED }))
      .getAllByRole('listitem')
      .map((one) => one.textContent)

  /** The writes of a press, from the moment it was pressed. */
  const writtenSince = (from: number) => whereItWrote(watching.asked.slice(from))

  /** A new event of a race, with a row of its own for every race given, each named by hand. */
  async function aNewEventWith(
    user: Pressing,
    name: string,
    races: { name: string; km: string }[],
  ): Promise<void> {
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.type(screen.getByLabelText(/^Naziv događaja/), name)
    await user.type(screen.getByLabelText(/^Datum/), '10012027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')

    for (const [at, race] of races.entries()) {
      await user.click(screen.getByRole('button', { name: 'Nova trka' }))

      const called = screen.getByLabelText(`Trka, ${String(at + 1)}. trka`)

      await user.clear(called)
      await user.type(called, race.name)
      await user.type(
        must(screen.getAllByLabelText(/^Dužina/).at(-1), `the length of ${race.name}`),
        race.km,
      )
    }
  }

  /** How many rows of the list of events carry this name. */
  async function rowsCalled(user: Pressing, name: string): Promise<number> {
    const search = await screen.findByPlaceholderText('Naziv ili mesto')

    await user.clear(search)
    await user.type(search, name)

    return within(await screen.findByRole('table', { name: 'Događaji' }))
      .getAllByRole('row')
      .slice(1)
      .filter((row) => (row.textContent ?? '').includes(name)).length
  }

  /** A served event of a race with two races or more, and its races in the order the table
   *  draws them: by the day, and by the distance inside one day (`raceRows.rowsOf`). */
  async function aServedEventWithRaces(): Promise<{ event: BtlEvent; races: Race[] }> {
    const events = await loadResource<BtlEvent[]>('events')
    const races = await loadResource<Race[]>('races')
    const event = must(
      events
        .filter(
          (one) =>
            one.kind === 'race' && races.filter((race) => race.eventId === one.id).length >= 2,
        )
        .at(-1),
      'a served event with two races or more',
    )

    return {
      event,
      races: races
        .filter((race) => race.eventId === event.id)
        .sort(
          (left, right) =>
            left.date.localeCompare(right.date) || left.distanceKm - right.distanceKm,
        ),
    }
  }

  it('saves the event once, sends every race, names the one refused, holds the event, and sends only races again', async () => {
    /* (a) to (e) on a NEW event, with the second of three refused. */
    let racePosts = 0

    answering = (path, init) => {
      if (path !== '/api/races' || init?.method !== 'POST') {
        return null
      }

      racePosts += 1

      return racePosts === 2 ? refused('theDistanceIsNotKeptExactly') : null
    }

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await aNewEventWith(user, 'BBKT proba', [
      { name: 'Prva trka', km: '10' },
      { name: 'Druga trka', km: '15' },
      { name: 'Treća trka', km: '21,1' },
    ])
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText(sr.admin.eventSavedRacesRefused)).toHaveAttribute('role', 'alert')

    const first = writtenSince(0)

    expect(first.filter((one) => one.includes('/api/events'))).toEqual(['POST /api/events'])
    /* Every race was sent, the one after the refused one too. */
    expect(first.filter((one) => one.includes('/api/races'))).toEqual([
      'POST /api/races',
      'POST /api/races',
      'POST /api/races',
    ])
    /* (c): exactly the refused race, by its place and its own name, with the route's reason. */
    expect(notSaved()).toEqual([
      `2. trka (Druga trka): ${sr.admin.raceSaveRefused.theDistanceIsNotKeptExactly}`,
    ])
    expect(screen.getByLabelText('Trka, 2. trka')).toHaveAccessibleDescription(
      sr.admin.raceSaveRefused.theDistanceIsNotKeptExactly,
    )
    expect(screen.getByLabelText('Trka, 1. trka')).not.toHaveAccessibleDescription(
      sr.admin.raceSaveRefused.theDistanceIsNotKeptExactly,
    )
    /* (b): nothing says the races are filed, and the rows are all still there. */
    expect(screen.queryByRole('status', { name: 'Sačuvano' })).toBeNull()
    expect(screen.getAllByLabelText(/^Dužina/)).toHaveLength(3)

    /* The event's own fields are held where they were saved. */
    const name = screen.getByLabelText(/^Naziv događaja/)

    expect(name).toHaveAttribute('aria-disabled', 'true')
    await user.type(name, 'x')
    expect(name).toHaveValue('BBKT proba')

    /* (d): the second press sends the races and nothing else. */
    const before = watching.asked.length

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    const second = writtenSince(before)

    expect(second.filter((one) => one.includes('/api/events'))).toEqual([])
    /* The two races the first press made are written over by their own address, and the one it
       did not make is made now. */
    expect(
      second
        .filter((one) => one.includes('/api/races'))
        .map((one) => one.replace(/\d+$/, 'N'))
        .sort(),
    ).toEqual(['POST /api/races', 'PUT /api/races/N', 'PUT /api/races/N'])

    /* (e) and (a), over both presses. */
    expect(writtenSince(0).filter((one) => one === 'POST /api/events')).toHaveLength(1)
    expect(writtenSince(0).some((one) => one.startsWith('DELETE /api/events'))).toBe(false)

    /* And the list shows the event once, not once for each press. */
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))
    expect(await rowsCalled(user, 'BBKT proba')).toBe(1)
  }, SLOW)

  it('names every race of an event that stands, a server fault as well as a refusal, and keeps them waiting while they are refused', async () => {
    /* Every race refused, through `PUT`, and one of them by a number with no reason in it. The
       event is opened from its address and its table is never touched, which is the table drawn
       afresh at every drawing until a press holds it. */
    const { event, races } = await aServedEventWithRaces()
    const firstRace = must(races[0], 'the first race')

    answering = (path, init) => {
      if (init?.method !== 'PUT' || !path.startsWith('/api/races/')) {
        return null
      }

      return path === `/api/races/${String(firstRace.id)}`
        ? answeredWith(500)
        : refused('theAddressIsTaken', 409)
    }

    const expected = races.map(
      (race, at) =>
        `${String(at + 1)}. trka (${race.name}): ${
          at === 0
            ? sr.server.wrong.replace('{status}', '500')
            : sr.admin.raceSaveRefused.theAddressIsTaken
        }`,
    )
    const user = setupUser()

    renderAt(`/sr/administracija/dogadjaji?izmena=${String(event.id)}`, 'superadmin')
    await user.type(await screen.findByLabelText(/^Opis događaja/), ' i još')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByText(sr.admin.eventSavedRacesRefused)

    expect(notSaved()).toEqual(expected)

    /* Pressed again over the same refusals: still only races, still waiting, still named. */
    const before = watching.asked.length

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await waitFor(() => {
      expect(writtenSince(before).filter((one) => one.includes('/api/races'))).toHaveLength(
        races.length,
      )
    })
    await screen.findByText(sr.admin.eventSavedRacesRefused)

    expect(writtenSince(before).filter((one) => one.includes('/api/events'))).toEqual([])
    expect(notSaved()).toEqual(expected)
    expect(screen.getByLabelText(/^Opis događaja/)).toHaveAttribute('aria-disabled', 'true')
  }, SLOW)

  it('names the races of a copy when not one of them was taken, and sends only races again', async () => {
    /* A copy opens on rows nobody has touched, so the table is not held by anything until a
       press holds it; with every race refused, nothing else would. Trka za dečji osmeh (event
       32) carries two races of a length. */
    answering = (path, init) =>
      path === '/api/races' && init?.method === 'POST'
        ? refused('theDistanceIsNotKeptExactly')
        : null

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji?kopija=32', 'superadmin')
    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByText(sr.admin.eventSavedRacesRefused)

    expect(notSaved()).toHaveLength(2)

    const before = watching.asked.length

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await waitFor(() => {
      expect(writtenSince(before).filter((one) => one.includes('/api/races'))).toHaveLength(2)
    })

    expect(writtenSince(before).filter((one) => one.includes('/api/events'))).toEqual([])
    expect(writtenSince(0).filter((one) => one === 'POST /api/events')).toHaveLength(1)
  }, SLOW)

  it('sends no race and holds no field when the event itself is refused', async () => {
    /* The first write is the one that failed, so there is no saved event for anything to wait
       under: no race goes, nothing is held, and no list of refused races is drawn. */
    answering = (path, init) =>
      path === '/api/events' && init?.method === 'POST' ? refused('theAddressIsTaken', 409) : null

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await aNewEventWith(user, 'BBKT odbijen', [{ name: 'Prva trka', km: '10' }])
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByText(sr.admin.eventSaveRefused.theAddressIsTaken)

    expect(writtenSince(0).filter((one) => one.includes('/api/races'))).toEqual([])
    expect(screen.queryByRole('list', { name: NOT_SAVED })).toBeNull()

    const name = screen.getByLabelText(/^Naziv događaja/)

    expect(name).not.toHaveAttribute('aria-disabled')
    await user.type(name, 'x')
    expect(name).toHaveValue('BBKT odbijenx')
  }, SLOW)

  it('leaves the saved event in the list when the reader goes back while its races wait', async () => {
    /* (a) seen from the list: the event is on the server, so the list must not hide it, or the
       reader enters it again and is told its address is taken by itself. */
    answering = (path, init) =>
      path === '/api/races' && init?.method === 'POST'
        ? refused('theDistanceIsNotKeptExactly')
        : null

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await aNewEventWith(user, 'BBKT ostaje', [{ name: 'Prva trka', km: '10' }])
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByText(sr.admin.eventSavedRacesRefused)
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    expect(await rowsCalled(user, 'BBKT ostaje')).toBe(1)
  }, SLOW)

  /**
   * A FORM OPENED FROM THE ADDRESS GOES AWAY WITH THE ADDRESS, and leaving it that way is not
   * the button that forgets what was waiting. What waited must not be inherited by the next
   * form, new or opened, or that form's first press would send only races under an event it
   * is not about and write nothing of its own.
   */
  async function leftWhileWaiting(user: Pressing): Promise<void> {
    const { event } = await aServedEventWithRaces()

    answering = (path, init) =>
      path.startsWith('/api/races/') && init?.method === 'PUT'
        ? refused('theAddressIsTaken', 409)
        : null

    const { router } = renderAt(
      `/sr/administracija/dogadjaji?izmena=${String(event.id)}`,
      'superadmin',
    )

    await user.type(await screen.findByLabelText(/^Opis događaja/), ' i još')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByText(sr.admin.eventSavedRacesRefused)
    await act(async () => {
      await router.navigate('/sr/administracija/dogadjaji')
    })
    answering = () => null
  }

  it('makes a new event after a form whose races waited went away with its address', async () => {
    const user = setupUser()

    await leftWhileWaiting(user)
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))

    /* Nothing of the form that went away is held over this one: its fields are open and no
       list of refused races is drawn. Asked before anything is typed, so a field left held
       is said here as what it is, rather than as a save that never comes. */
    expect(screen.getByLabelText(/^Naziv događaja/)).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByRole('list', { name: NOT_SAVED })).toBeNull()

    await user.type(screen.getByLabelText(/^Naziv događaja/), 'BBKT posle')
    await user.type(screen.getByLabelText(/^Datum/), '11012027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')

    const before = watching.asked.length

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(writtenSince(before).filter((one) => one.includes('/api/events'))).toEqual([
      'POST /api/events',
    ])
  }, SLOW)

  it('changes the event opened after a form whose races waited went away with its address', async () => {
    const user = setupUser()
    const events = await loadResource<BtlEvent[]>('events')
    const other = must(
      events.find((one) => one.kind !== 'race'),
      'an event with no races, so one press is one request',
    )

    await leftWhileWaiting(user)

    const search = await screen.findByPlaceholderText('Naziv ili mesto')

    await user.type(search, other.name)
    await user.click(await screen.findByRole('button', { name: `Otvori: ${other.name}` }))

    /* Open, as the new form above is, and for the same reason. */
    expect(await screen.findByLabelText(/^Opis događaja/)).not.toHaveAttribute('aria-disabled')

    await user.type(screen.getByLabelText(/^Opis događaja/), ' i još')

    const before = watching.asked.length

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    expect(writtenSince(before).filter((one) => one.includes('/api/events'))).toEqual([
      `PUT /api/events/${String(other.id)}`,
    ])
  }, SLOW)

  it('drops what was read before a press that sends only races, so the next read asks the server', async () => {
    /* A race moves its event's day, so a press that writes races leaves all three names stale,
       and something may have read them again since the press that saved the event. */
    let racePosts = 0

    answering = (path, init) => {
      if (path !== '/api/races' || init?.method !== 'POST') {
        return null
      }

      racePosts += 1

      return racePosts === 1 ? refused('theDistanceIsNotKeptExactly') : null
    }

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await aNewEventWith(user, 'BBKT kes', [{ name: 'Prva trka', km: '10' }])
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByText(sr.admin.eventSavedRacesRefused)

    /* Read again between the two presses, which puts the races back into the cache. */
    await loadResource<Race[]>('races')

    const reads = () =>
      watching.asked.filter(
        (one) => one.path === '/api/races' && (one.init?.method ?? 'GET') === 'GET',
      ).length
    const before = reads()

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await loadResource<Race[]>('races')

    expect(reads(), 'the races read before the press were handed out again after it').toBeGreaterThan(
      before,
    )
  }, SLOW)
})

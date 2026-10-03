import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadResource } from '../../data/client'
import type { BtlEvent, Race } from '../../data/types'
import { RESULTS } from '../../data/useResource'
import { dogadjaj } from '../../forms/definitions'
import { formatShortDate } from '../../i18n/format'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, refused, serverThat } from '../../test/serverAnswers'
import { whatWasSent, whereItWrote } from '../../test/sent'
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

  /** A race the route took, under an identity the case chose, so the writes that follow can be
   *  told apart by their address. */
  const takenAs = (id: number): Response =>
    new Response(JSON.stringify({ id, eventDate: '', eventSlug: '' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })

  /** A new event of a race, with a row of its own for every race given, each named by hand and,
   *  where `day` is given (digits only, as typed into the box), run on a day of its own. */
  async function aNewEventWith(
    user: Pressing,
    name: string,
    races: { name: string; km: string; day?: string }[],
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

      if (race.day !== undefined) {
        const day = screen.getByLabelText(`Datum, ${String(at + 1)}. trka`)

        await user.clear(day)
        await user.type(day, race.day)
      }
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

  /**
   * AN EVENT THAT HAS NO RACES CAN STILL BE HOLDING SOME THE ROUTE WOULD NOT TAKE AWAY (review of
   * PR 483, round 1, finding V1).
   *
   * <p>A gathering and a training have no table (owner, 23.08.2026), and „u to čuvanje spada i
   * brisanje svih trka koje su bile povezane": saving an event of a race as a gathering takes every
   * race it had away. The list of what the press did not save was drawn under the table, so where
   * there is no table a refused deletion was named nowhere, and the sentence over the form still
   * sent the reader to „ispod tabele". On `main` the reason was said, by the alert of the first
   * refusal; so this was a loss of what the reader was told, not only a missing list.
   *
   * <p>The first race is refused by a number with no reason in it and every other by a reason, so
   * the reason beside each race is the reason it was refused for. The kind is changed on the open
   * event, which is the one way a press has races to take away and a form that draws no table.
   */
  it('names every race the route would not take away from an event that has no races, and does not send the reader to a table that is not there', async () => {
    const { event } = await aServedEventWithRaces()
    const served = (await loadResource<Race[]>('races')).filter((one) => one.eventId === event.id)
    const firstServed = must(served[0], 'the first race of the event')

    /* The largest file the portal has, read before the press: a save that takes races away waits
       for it (`alsoRefuses`), and this case is about what comes after the wait. */
    await loadResource(RESULTS)
    answering = (path, init) => {
      if (!path.startsWith('/api/races/') || init?.method !== 'DELETE') {
        return null
      }

      return path === `/api/races/${String(firstServed.id)}`
        ? answeredWith(500)
        : refused('theRaceCountsInALeagueOfItsSeason', 409)
    }

    const user = setupUser()

    renderAt(`/sr/administracija/dogadjaji?izmena=${String(event.id)}`, 'superadmin')
    await user.selectOptions(
      await screen.findByLabelText(/^Vrsta događaja/),
      sr.event.kind.gathering,
    )
    expect(
      screen.queryByRole('region', { name: /^Trke na događaju/ }),
      'a gathering draws a table of races',
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* The sentence says the event is saved and what to do, and points at no table. Waited for as
       the alert and compared as text, so a press that said the other sentence fails on what it
       said and not by running out of time for the one it never will. */
    expect((await screen.findByRole('alert')).textContent).toBe(sr.admin.eventSavedRacesKept)
    expect(sr.admin.eventSavedRacesKept).not.toContain('tabel')

    /* Every race is named, beside its own reason, in the order they were sent. */
    expect(notSaved()).toEqual(
      served.map(
        (race) =>
          `Trka ${race.name} (${formatShortDate(race.date, 'sr-Latn')}) nije obrisana: ${
            race.id === firstServed.id
              ? sr.server.wrong.replace('{status}', '500')
              : sr.admin.raceSaveRefused.theRaceCountsInALeagueOfItsSeason
          }`,
      ),
    )

    /* And the press that follows sends the races and nothing else: the same deletions, again. */
    const before = watching.asked.length

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('alert')

    expect(writtenSince(before).sort()).toEqual(
      served.map((race) => `DELETE /api/races/${String(race.id)}`).sort(),
    )
  }, SLOW)

  /**
   * A NEW FORM OPENED AFTER A COPY WHOSE RACES WAITED WENT AWAY WITH ITS ADDRESS holds nothing of
   * the copy (review of PR 483, round 1, finding V2).
   *
   * <p>The way out that calls nothing - the browser's Back, a link to this list - leaves the table
   * the copy held where it was, and a copy and a new event are both the table „nov", so the next
   * new form was handed the copy's rows. Saved, it wrote them under the NEW event, and the event
   * followed the day of the first of them: the owner would have found an event entered for 2027 on
   * the day of a race of 2015, and the screen said „Sačuvano".
   *
   * <p>Two copies of the same exit, because the table is held at two different moments: before
   * anything is accepted, and when the first race of the press has been (the second is the one
   * the reviewer found older than this PR). What the new form is asked is what it must NOT have
   * and what it must send: no row, open fields, the event on the day that was typed, and no race.
   */
  async function leftACopyWhileWaiting(user: Pressing, firstTaken: boolean): Promise<void> {
    let racePosts = 0

    answering = (path, init) => {
      if (path !== '/api/races' || init?.method !== 'POST') {
        return null
      }

      racePosts += 1

      return firstTaken && racePosts === 1
        ? takenAs(9201)
        : refused('theDistanceIsNotKeptExactly')
    }

    const { router } = renderAt('/sr/administracija/dogadjaji?kopija=32', 'superadmin')

    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByText(sr.admin.eventSavedRacesRefused)
    await act(async () => {
      await router.navigate('/sr/administracija/dogadjaji')
    })
    answering = () => null
  }

  async function aNewFormHoldsNothingOfThatCopy(firstTaken: boolean): Promise<void> {
    const user = setupUser()

    await leftACopyWhileWaiting(user, firstTaken)
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))

    expect(
      screen.queryAllByLabelText(/^Dužina/),
      'the new form opened holding rows of the copy',
    ).toHaveLength(0)
    expect(screen.getByLabelText(/^Naziv događaja/)).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByRole('list', { name: NOT_SAVED })).toBeNull()

    await user.type(screen.getByLabelText(/^Naziv događaja/), 'BBKT posle kopije')
    await user.type(screen.getByLabelText(/^Datum/), '11012027')
    await user.type(screen.getByLabelText(/^Mesto/), 'Niš')

    const before = watching.asked.length

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })

    /* One event and not one race, on the day that was typed: a row inherited from the copy is
       written under this event, and the event follows the earliest race it has. */
    expect(writtenSince(before)).toEqual(['POST /api/events'])
    expect(whatWasSent(watching.asked.slice(before)).join('\n')).toContain('date=2027-01-11')
  }

  it('opens a new form empty after a copy whose races waited went away with its address', async () => {
    await aNewFormHoldsNothingOfThatCopy(false)
  }, SLOW)

  it('opens a new form empty after a copy whose first race was taken and whose second waited went away with its address', async () => {
    await aNewFormHoldsNothingOfThatCopy(true)
  }, SLOW)

  it('marks no row of a new form after a form whose last press was refused over a row went away with its address', async () => {
    /* The fifth thing a form holds, beside the table (`forgetTheForm`): whether its last press was
       refused over a row, which is when the rows start saying what is missing. Handed to the next
       form it marks a row nobody has touched, and the first thing a reader of a new form would
       see is a list of what is wrong with a race he has not yet begun to enter. */
    const { event } = await aServedEventWithRaces()
    const user = setupUser()
    const { router } = renderAt(
      `/sr/administracija/dogadjaji?izmena=${String(event.id)}`,
      'superadmin',
    )

    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    /* Refused over the row that has no length, so nothing is sent and the rows are marked. */
    await screen.findByText(sr.admin.form.racesRefused)
    expect(screen.getByRole('list', { name: sr.admin.race.wrong.list })).toBeVisible()
    expect(writtenSince(0)).toEqual([])
    await act(async () => {
      await router.navigate('/sr/administracija/dogadjaji')
    })

    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))
    await user.click(screen.getByRole('button', { name: 'Nova trka' }))

    /* The row is merely unfinished, which is the ordinary state of one somebody is typing into. */
    expect(screen.getByLabelText(/^Dužina/)).toHaveAttribute('aria-invalid', 'false')
    expect(screen.queryByRole('list', { name: sr.admin.race.wrong.list })).toBeNull()
  }, SLOW)

  it('opens a new form, and not the form of the event a copy has just made, after that copy was saved and went away with its address', async () => {
    /* The first of the five things a form holds (`forgetTheForm`): the event it has just made,
       which a form that makes an event is drawn UNDER while it stands. Measured before the change,
       with nothing refused anywhere: a copy that went through, left by a link to this list, and
       „Novi događaj" opened the copy's own form, titled „Izmena događaja", so the first thing
       typed into it would have been written over the event the copy had made. */
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/dogadjaji?kopija=32', 'superadmin')

    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await act(async () => {
      await router.navigate('/sr/administracija/dogadjaji')
    })
    await user.click(await screen.findByRole('button', { name: 'Novi događaj' }))

    expect(screen.getByRole('form', { name: sr.admin.form.new.events })).toBeVisible()
    expect(screen.queryByRole('form', { name: sr.admin.form.edit.events })).toBeNull()
  }, SLOW)

  /**
   * A REFUSED DELETION THAT IS NOT THE FIRST, AND EVERYTHING THE PRESS STILL HAS TO SEND AFTER IT
   * (review of PR 483, round 1).
   *
   * <p>The loop that takes races away and the loop that writes the rows both used to stop at the
   * first refusal (`return answer`). Since 03.10.2026 each goes on, and the one case that held the
   * deletions refused a single deletion, the FIRST, and read no request after it, so the branch
   * could be put back to the old stop with every case green.
   *
   * <p><b>The setup keeps apart what a wrong answer would share.</b> Three races are taken away
   * and the route refuses the SECOND of them, so the refused race is neither the first nor the
   * last of the three (the name could otherwise be read off either end); a row is kept, so there
   * is a write that must still go after the refusal; and every race has a name and a day of its
   * own, so a sentence about the wrong race says the wrong name and the wrong day.
   *
   * <p>The races are made by the first press, which refuses the fourth, so that the form is
   * already waiting when the reader takes three of them off the table.
   */
  it('goes on past a refused deletion that is not the first: the rest are taken away, the rows are written, and the race the route kept is the one named', async () => {
    const made = { first: 9101, second: 9102, third: 9103, fourth: 9104 }
    const firstThree = [made.first, made.second, made.third]
    let racePosts = 0

    answering = (path, init) => {
      if (path === '/api/races' && init?.method === 'POST') {
        racePosts += 1

        /* The first three races of the first press are taken under identities chosen here, so the
           deletions of the next press can be told apart by name; the fourth is refused; and the
           one written again at the next press is taken. */
        const id = firstThree[racePosts - 1]

        if (id !== undefined) {
          return takenAs(id)
        }

        return racePosts === 4 ? refused('theDistanceIsNotKeptExactly') : takenAs(made.fourth)
      }

      return path === `/api/races/${String(made.second)}` && init?.method === 'DELETE'
        ? refused('theRaceCountsInALeagueOfItsSeason', 409)
        : null
    }

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await aNewEventWith(user, 'BBKT brisanje', [
      { name: 'Prva trka', km: '10', day: '11012027' },
      { name: 'Druga trka', km: '15', day: '12012027' },
      { name: 'Treća trka', km: '21,1', day: '13012027' },
      { name: 'Četvrta trka', km: '5', day: '14012027' },
    ])
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    /* Waited for as the alert and compared as text, so a press that said the sentence of an event
       with no table fails on what it said and not by running out of time for the other. */
    expect((await screen.findByRole('alert')).textContent).toBe(sr.admin.eventSavedRacesRefused)

    /* The fourth is the only one the first press did not make. */
    expect(notSaved()).toEqual([
      `4. trka (Četvrta trka): ${sr.admin.raceSaveRefused.theDistanceIsNotKeptExactly}`,
    ])

    /* The three the press made are taken off the table, which is three deletions at the next
       press, and the fourth stays, which is the one row it has to write. */
    for (let removed = 0; removed < 3; removed += 1) {
      await user.click(screen.getByRole('button', { name: 'Obriši 1. trku' }))
    }

    const before = watching.asked.length

    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    /* The press is over when the list names the race the route kept, which is said only at its
       end: the list stood before it with the refused row alone. Waited for by that and not by the
       number of requests, so a press that stops early fails on what it wrote and not by running
       out of time for requests it was never going to send. */
    await screen.findByText(/nije obrisana/)

    /* The refusal of the second deletion stopped nothing: the third was taken away after it and
       the row was written after both, in the order the press sends them. */
    expect(writtenSince(before)).toEqual([
      `DELETE /api/races/${String(made.first)}`,
      `DELETE /api/races/${String(made.second)}`,
      `DELETE /api/races/${String(made.third)}`,
      'POST /api/races',
    ])
    /* And the race the route kept is named by its own name and day: not the first of the three
       taken away, not the last, and not the row that stayed. */
    expect(notSaved()).toEqual([
      `Trka Druga trka (${formatShortDate('2027-01-12', 'sr-Latn')}) nije obrisana: ${sr.admin.raceSaveRefused.theRaceCountsInALeagueOfItsSeason}`,
    ])
    /* And the sentence over the form is the one that points at the table, which is drawn here. */
    expect(screen.getByRole('alert').textContent).toBe(sr.admin.eventSavedRacesRefused)
  }, SLOW)

  /**
   * THE FIELDS OF THE EVENT ARE HELD, ALL OF THEM AND NOTHING BUT THEM (review of PR 483, round 1).
   *
   * <p>Held where they were saved while the event's races wait, because a press then sends the
   * races and nothing else (owner, 03.10.2026): a field left open takes a change no press sends.
   * The two cases that held it asked about two fields, the name and the description, and four
   * mutations went through them: the kind out of the held set, the town, the day, and the one
   * token that draws the held set from the copy's narrower form for every event. Left open, the
   * kind turns the retry into one that takes every race away from an event that stays a race.
   *
   * <p><b>The question is put to the form and not to a list.</b> What the form draws is asked of
   * the form (`elements`, which is the platform's own answer, so a field added tomorrow or a
   * control a field draws beside itself is in it without anybody remembering it), and what is held
   * is asked of the controls (`aria-disabled`). A list of names written here would be a second
   * answer to a question the form already has, and the day it fell short, this would be as short
   * as the code.
   *
   * <p>Three things are held against each other: that the wait is what holds them (some control is
   * open before anything waits, so a form that held everything always would not pass), that the
   * same controls are drawn while it does (so the held set cannot match the drawn set by the form
   * drawing less), and that every one of them is held and no control of the table of races is,
   * because the rows are what the retry sends. And, where the form is the whole definition, that
   * it draws a control for every field the definition has, so a set that is empty or short does
   * not pass for a set that is whole.
   *
   * <p>Not that NOTHING is held before: the country beside a town the portal knows is held by a
   * rule of its own (`forms/PlaceField.tsx`, the town carries it), wait or no wait.
   */
  function controlsOf(title: string): { event: HTMLElement[]; races: HTMLElement[] } {
    const named = screen.getByRole('form', { name: title })
    /* Looked at and not asserted into a shape (ADL A14): a `form` role on anything but a form
       would answer no controls here, and that is a failure this says out loud. */
    const form = must(named instanceof HTMLFormElement ? named : null, `a form called ${title}`)
    const table = screen.getByRole('region', { name: /^Trke na događaju/ })
    const every = Array.from(form.elements).filter(
      (one): one is HTMLElement => one instanceof HTMLElement,
    )

    return {
      event: every.filter(
        (one) =>
          !table.contains(one) && !(one instanceof HTMLButtonElement && one.type === 'submit'),
      ),
      races: every.filter((one) => table.contains(one)),
    }
  }

  const describing = (control: HTMLElement): string =>
    `${control.tagName.toLowerCase()} ${control.getAttribute('name') ?? control.getAttribute('aria-label') ?? control.id}`

  const isHeld = (control: HTMLElement): boolean => control.getAttribute('aria-disabled') === 'true'

  async function holdsExactlyWhatTheEventDraws(
    title: string,
    makeRacesWait: () => Promise<void>,
    fields: readonly string[],
  ): Promise<void> {
    const open = controlsOf(title)
    const drawn = open.event.map(describing)

    expect(drawn.length, 'the form draws no control, so nothing below measures anything').toBeGreaterThan(0)
    expect(
      open.event.map((one) => one.getAttribute('name')),
      'the form does not draw a control for every field of its definition',
    ).toEqual(expect.arrayContaining([...fields]))
    expect(
      open.event.filter((one) => !isHeld(one)).length,
      'every control is held before anything waits, so the wait is not what holds them',
    ).toBeGreaterThan(0)

    await makeRacesWait()

    const waiting = controlsOf(title)

    expect(
      waiting.event.map(describing),
      'the form draws other controls while races wait, so the held set could match it by drawing less',
    ).toEqual(drawn)
    expect(
      waiting.event.filter(isHeld).map(describing),
      'the controls held while races wait are not the controls the form draws',
    ).toEqual(drawn)
    expect(waiting.races.length, 'the table of races has no control').toBeGreaterThan(0)
    expect(
      waiting.races.filter(isHeld).map(describing),
      'a control of the races is held, and the rows are what the next press sends',
    ).toEqual([])
  }

  it('holds every control of a new event while its races wait, and no control of its races', async () => {
    answering = (path, init) =>
      path === '/api/races' && init?.method === 'POST'
        ? refused('theDistanceIsNotKeptExactly')
        : null

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji', 'superadmin')
    await aNewEventWith(user, 'BBKT zakljucan', [{ name: 'Prva trka', km: '10' }])
    await holdsExactlyWhatTheEventDraws(
      sr.admin.form.new.events,
      async () => {
        await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
        await screen.findByText(sr.admin.eventSavedRacesRefused)
      },
      dogadjaj.fields.map((one) => one.name),
    )
  }, SLOW)

  it('holds every control of an event that stands while its races wait, and no control of its races', async () => {
    const { event } = await aServedEventWithRaces()

    answering = (path, init) =>
      path.startsWith('/api/races/') && init?.method === 'PUT'
        ? refused('theAddressIsTaken', 409)
        : null

    const user = setupUser()

    renderAt(`/sr/administracija/dogadjaji?izmena=${String(event.id)}`, 'superadmin')
    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await holdsExactlyWhatTheEventDraws(
      sr.admin.form.edit.events,
      async () => {
        await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
        await screen.findByText(sr.admin.eventSavedRacesRefused)
      },
      dogadjaj.fields.map((one) => one.name),
    )
  }, SLOW)

  it('holds every control of a copy while its races wait, and no control of its races', async () => {
    /* The copy's form is narrower (no town, no country, no kind: owner, 23.08.2026), so it has
       no definition of its own to be asked for fields; what it draws is what it holds. */
    answering = (path, init) =>
      path === '/api/races' && init?.method === 'POST'
        ? refused('theDistanceIsNotKeptExactly')
        : null

    const user = setupUser()

    renderAt('/sr/administracija/dogadjaji?kopija=32', 'superadmin')
    await screen.findByRole('heading', { name: /^Trke na događaju/ })
    await holdsExactlyWhatTheEventDraws(
      sr.admin.form.copying,
      async () => {
        await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
        await screen.findByText(sr.admin.eventSavedRacesRefused)
      },
      [],
    )
  }, SLOW)
})

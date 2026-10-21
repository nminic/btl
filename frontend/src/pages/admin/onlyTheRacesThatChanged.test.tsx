import { configure, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearResourceCache, loadResource } from '../../data/client'
import { inEventOrder } from '../../data/raceOrder'
import type { BtlEvent, Race } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { whereItWrote } from '../../test/sent'
import { SLOW } from '../../test/slow'
import { setupUser, type Pressing } from '../../test/user'

/* Every wait is given half of what a case is given, for the reason `rowMembership.test.tsx` gives: a
   mutation then fails on its assertion and not on the clock of the case. */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * SAVING AN EVENT SENDS ONLY THE RACES SOMEBODY CHANGED (owner, 20.10.2026, ADL „Čuvanje događaja šalje
 * samo trke koje su promenjene": „Trka koju niko nije dirao ne šalje se, pa joj se ništa ne može
 * obrisati", cause PENDING 29091: „trkama na vreme se brisao uspon i spust").
 *
 * <p>Every row of the table used to be written back over its race, and a race on time does not draw its
 * climb and its fall, so the write put nought where the server had them. A race nobody touched is not
 * sent at all now, which is what leaves its climb alone. <b>The event is served with one race on time
 * that HAS a climb and a fall, and one of a length</b> (the files carry no race on time): the first is
 * the one the fault cut, the second tells „nothing is sent" from „the timed one is skipped".
 *
 * <p>What is changed is a field the reader can edit that differs from what was served; a race that is
 * new is always sent; a race taken off the table is deleted as it always was.
 */

const THE_LIST = '/sr/administracija/dogadjaji'

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('the races a save of an event sends', () => {
  let server: ReturnType<typeof serverThat>
  let event: BtlEvent
  let timed: Race
  let length: Race
  /** Which row of the table each race is, counted from one: the table opens in the owner's order. */
  let rowOf: (race: Race) => number

  beforeEach(async () => {
    clearResourceCache()

    const events = await loadResource<BtlEvent[]>('events')
    const real: Race[] = JSON.parse(
      readFileSync(join(process.cwd(), 'src/test/mock/races.json'), 'utf-8'),
    )

    /* An event of the files with two or more races, the later of them, so the first race is not the one
       the screen opens on by chance. */
    event = must(
      events
        .filter(
          (one) => one.kind === 'race' && real.filter((race) => race.eventId === one.id).length >= 2,
        )
        .at(-1),
      'an event with two races or more',
    )

    const its = real.filter((one) => one.eventId === event.id)

    /* The first of them made a race on time with a climb and a fall, which is the shape the fault cut. */
    timed = {
      ...must(its[0], 'its first race'),
      kind: 'time',
      limitSeconds: 6 * 3600,
      distanceKm: 0,
      ascentM: 500,
      descentM: 400,
    }
    length = must(its[1], 'its second race')

    const served = real.map((one) => (one.id === timed.id ? timed : one))
    const inTheTable = inEventOrder(served.filter((one) => one.eventId === event.id))

    rowOf = (race) => inTheTable.findIndex((one) => one.id === race.id) + 1

    server = serverThat((path, init) => {
      if (path === '/api/races' && (init?.method ?? 'GET') === 'GET') {
        return json(200, served)
      }

      if (path.startsWith('/api/events/') && init?.method === 'PUT') {
        return json(200, { id: event.id, slug: event.slug })
      }

      return null
    })
  })

  afterEach(() => {
    server.stop()
    clearResourceCache()
  })

  async function open(): Promise<Pressing> {
    const user = setupUser()

    renderAt(`${THE_LIST}?izmena=${String(event.id)}`, 'superadmin', '000001')
    await screen.findByRole('heading', { name: /^Trke na događaju/ })

    return user
  }

  async function save(user: Pressing): Promise<void> {
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
  }

  it('sends the event and no race at all when nobody touched one, so a race on time keeps its climb', async () => {
    const user = await open()

    await save(user)

    expect(whereItWrote(server.asked)).toEqual([`PUT /api/events/${String(event.id)}`])
  }, SLOW)

  it('sends the one race that was changed, and not the race on time beside it', async () => {
    const user = await open()

    await user.type(screen.getByLabelText(`Trka, ${String(rowOf(length))}. trka`), '!')
    await save(user)

    expect(whereItWrote(server.asked).sort()).toEqual(
      [`PUT /api/events/${String(event.id)}`, `PUT /api/races/${String(length.id)}`].sort(),
    )
  }, SLOW)

  it('sends the race on time when it is the one that was changed', async () => {
    const user = await open()

    await user.type(screen.getByLabelText(`Trka, ${String(rowOf(timed))}. trka`), '!')
    await save(user)

    expect(whereItWrote(server.asked).sort()).toEqual(
      [`PUT /api/events/${String(event.id)}`, `PUT /api/races/${String(timed.id)}`].sort(),
    )
  }, SLOW)

  it('sends a race that is new, always, and nothing for the ones that stand', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: 'Nova trka' }))
    await user.type(
      must(screen.getAllByLabelText(/^Dužina/).at(-1), 'the length of the new race'),
      '10',
    )
    await save(user)

    expect(whereItWrote(server.asked).sort()).toEqual(
      [`PUT /api/events/${String(event.id)}`, 'POST /api/races'].sort(),
    )
  }, SLOW)

  it('deletes a race that was taken off the table, as it always did, and sends none of the others', async () => {
    const user = await open()

    await user.click(screen.getByRole('button', { name: `Obriši ${String(rowOf(length))}. trku` }))
    await save(user)

    expect(whereItWrote(server.asked).sort()).toEqual(
      [`PUT /api/events/${String(event.id)}`, `DELETE /api/races/${String(length.id)}`].sort(),
    )
  }, SLOW)
})

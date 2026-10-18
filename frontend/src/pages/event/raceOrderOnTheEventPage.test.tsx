import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getNodeText, screen, within } from '@testing-library/react'
import type { Race } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'

/**
 * The races of one event on its own page, in the owner's order (PDL P6, „Redosled trka jednog
 * događaja", 18.10.2026): the races of a length longest first, then the timed ones by how long
 * they last, then the free ones.
 *
 * **Its own file, and it serves its own races**, for the reason `pages/timedRace.test.tsx` gives:
 * every race in the served file is a race of a length, and the portal keeps a file it has read,
 * so a reshaped list poisons every case after it in the same file.
 *
 * **Why the page and not only `data/raceOrder.ts`:** the function is measured key by key in its
 * own file, and what this asks is that the page asks it. The four races are reshaped so that the
 * order the page used until 18.10.2026 (the day, then the length rising), a list by the length
 * falling, and the order the file holds them in are three different answers, and all three differ
 * from the owner's.
 */

const EVENT = 'maraton-maratona-2015'

const mock = (name: string) => JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock', `${name}.json`), 'utf-8'))

/** The races of that event, in the order the file holds them, read off the file and not written
 *  here: a number written here is a second home for a fixture. */
const OWN = (() => {
  const events: { id: number; slug: string }[] = mock('events')
  const id = must(events.find((one) => one.slug === EVENT)?.id, 'the event this case is written around')
  const all: Race[] = mock('races')

  return all.filter((one) => one.eventId === id).map((one) => one.id)
})()

/** The first a timed race of 6 h, the second a free one, the third a timed race of 24 h, and the
 *  fourth left a race of a length. */
function reshaped(race: Race): Race {
  const at = OWN.indexOf(race.id)

  if (at === 0) {
    return { ...race, kind: 'time', limitSeconds: 6 * 3600, distanceKm: 0 }
  }

  if (at === 1) {
    return { ...race, kind: 'free', limitSeconds: 0, distanceKm: 0 }
  }

  if (at === 2) {
    return { ...race, kind: 'time', limitSeconds: 24 * 3600, distanceKm: 0 }
  }

  return race
}

/** The races read, and only the read dressed up, with `init` handed on whatever happens
 *  (`pages/timedRace.test.tsx` says why both halves matter). */
function servingRaces(real: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).endsWith('/api/races') || (init?.method ?? 'GET') !== 'GET') {
      return real(input, init)
    }

    const all: Race[] = await (await real(input)).json()

    return new Response(JSON.stringify(all.map(reshaped)), { status: 200 })
  }
}

describe('the races of one event on its page', () => {
  const real = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = real
  })

  it("stand in the owner's order: the race of a length, the timed ones longest first, the free one last", async () => {
    expect(OWN, 'the event this case is written around has four races').toHaveLength(4)

    globalThis.fetch = servingRaces(real)
    renderAt(`/sr/kalendar/${EVENT}`, 'visitor', null)

    const table = await screen.findByRole('table', { name: /^Trke/ })
    const heads = within(table)
      .getAllByRole('columnheader')
      .map((one) => one.textContent)
    const measure = heads.indexOf('Dužina / trajanje')

    expect(measure, 'the table of an event of more than one kind has no column of measures').toBeGreaterThan(-1)

    /* What each row is measured by, which is the one thing that tells the four apart: they share
       the event's name and its morning. The figure is the cell's own text; the word over it is
       for a telephone (`pages/EventDetail.tsx`). */
    const said = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => getNodeText(must(within(row).getAllByRole('cell')[measure], 'a measure')))

    expect(said).toEqual(['84,00 km', '24 h', '6 h', ''])
  }, SLOW)
})

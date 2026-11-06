import { configure, getConfig, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearResourceCache } from '../data/client'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'

/**
 * THE SCREENS OF A FROZEN SEASON DRAW THE SNAPSHOT, AND ONLY FOR A SEASON THE RECORD SAYS IS FROZEN.
 *
 * PDL, owner, 31.07.2026, „Zamrznuta sezona je materijalizovan zapis, ne izračun": a table of a frozen
 * season is what the freeze wrote (`GET /api/frozen-tables/{season}`, answered off
 * `mock/frozen-tables.json` by `test/setup.ts`), never the ladder run again over the results. Which
 * season is frozen is the record's (`GET /api/frozen-seasons`), never the clock's: the suite reads 2027
 * on a day in 2026, so a screen that judged by the date would draw 2027 live here, and the cases below
 * would fail.
 *
 * The snapshot names, in 2027, the states a member of a frozen row can be in (ADL A37, PDL 05.11.2026):
 * 000001 and 000003 still members the portal serves (a link), 000005 the same, Relja Momčilović deleted
 * after five years (his name, no number, no link), and a woman deleted on request (the word for her).
 * Every one of those names is also somewhere the live answers would put a DIFFERENT member or number, so
 * a screen reading the live ladder instead of the snapshot cannot pass.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, as in `admin/saveWhileSaving.test.tsx`: a
   case that ends by its own clock says nothing about what it was asked. The global wait is `SLOW`
   (`test/setup.ts`) and a case is given five seconds, so a wait that never succeeded ended by the clock of
   the case, and a series of mutations over these screens (06.11.2026) counted thirteen such as caught. Set
   here, and so for this file alone. */
vi.setConfig({ testTimeout: SLOW })
configure({ asyncUtilTimeout: SLOW / 2 })

const FROZEN_2027 = () =>
  new Response(JSON.stringify([{ season: 2027 }]), { status: 200, headers: { 'content-type': 'application/json' } })

let server: ReturnType<typeof serverThat>

beforeEach(() => {
  clearResourceCache()
  server = serverThat((path) => (path === '/api/frozen-seasons' ? FROZEN_2027() : null))
})

afterEach(() => {
  server.stop()
})

/** Each row of a table as its cells' words, the place first. */
function rowsOf(table: HTMLElement): string[][] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell').map((cell) => (cell.textContent ?? '').trim()))
}

describe('the table of a frozen season', () => {
  it('is the standing the freeze wrote, with the name it wrote and the link the reader is given', async () => {
    renderAt('/sr/tabela?sezona=2027')

    const table = await screen.findByRole('table')

    expect(rowsOf(table).map(([place, name, category, , , , , , points]) => [place, name, category, points])).toEqual([
      ['1', 'Vladan Đurišić000001', 'M 40-54', '412,50'],
      ['2', 'BNBogoljub Nikolajević000005', 'M 25-39', '388,20'],
      ['3', 'RMRelja Momčilović', 'M 25-39', '210,00'],
    ])
    expect(within(table).getByRole('link', { name: 'Vladan Đurišić' })).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Relja Momčilović' })).toBeNull()
    expect(server.asked.map((one) => one.path)).toContain('/api/frozen-tables/2027')
  })

  it('draws the word for a woman who asked to be deleted, and her category of that season', async () => {
    renderAt('/sr/tabela?sezona=2027&pol=z')

    const table = await screen.findByRole('table')

    const [, name, category] = rowsOf(table)[1] ?? []

    expect(name).toContain('<Obrisana članica>')
    expect(within(table).queryByRole('link', { name: '<Obrisana članica>' })).toBeNull()
    expect(category).toBe('Početnice')
  })

  it('narrows to a category the snapshot holds and places by the place inside it', async () => {
    renderAt('/sr/tabela?sezona=2027&kategorija=M25-39')

    const table = await screen.findByRole('table')

    expect(rowsOf(table).map(([place, name]) => [place, name])).toEqual([
      ['1', 'BNBogoljub Nikolajević000005'],
      ['2', 'RMRelja Momčilović'],
    ])
    expect(screen.getAllByRole('button', { pressed: false }).map((one) => one.textContent)).toEqual(
      expect.arrayContaining(['M 40-54']),
    )
  })

  it('is read live where the record does not say the season is frozen', async () => {
    server.stop()
    server = serverThat(() => null)

    renderAt('/sr/tabela?sezona=2027')

    await screen.findByRole('heading', { level: 1 })
    expect(server.asked.map((one) => one.path)).not.toContain('/api/frozen-tables/2027')
  })
})

describe('the clocks of this file', () => {
  it('wait half of the time a case has, so that a wait that fails fails by its own words', () => {
    expect(getConfig().asyncUtilTimeout * 2).toBe(SLOW)
  })
})

import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearResourceCache } from '../data/client'
import type { Result } from '../data/types'
import sr from '../i18n/sr.json'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'

/**
 * WHERE A FROZEN SEASON AND THE LIVE ANSWERS WOULD SAY THE SAME THING, THEY ARE MADE TO SAY DIFFERENT ONES,
 * so that a screen reading the wrong one of the two cannot pass.
 *
 * - A reader who MAY read a hidden profile: the record a member who is no longer one is drawn with hides
 *   its profile, so to a visitor it has no link either way, and only this reader tells „no profile" from
 *   „a profile he may not read".
 * - A run of 2027 in the live results beside the snapshot of 2027: the trophies of a frozen season are the
 *   snapshot's alone, and the run would give a second set if they were worked out as well.
 * - A run of 2028 by a member whose 2027 the live results do not hold: the list of progress of 2028
 *   measures him against what 2027 held at its freeze, which only the snapshot says.
 * - A marathon of 2027 entered after the freeze, by a member of a team whose snapshot holds no marathon: the
 *   ring of races on the team's page is what the freeze counted for THAT team, and another team of the same
 *   season holds lengths of its own.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, as in `admin/saveWhileSaving.test.tsx`: a
   case that ends by its own clock says nothing about what it was asked. The global wait is `SLOW`
   (`test/setup.ts`) and a case is given five seconds, so a wait that never succeeded ended by the clock of
   the case, and a series of mutations over these screens (06.11.2026) counted thirteen such as caught. Set
   here, and so for this file alone. */
vi.setConfig({ testTimeout: SLOW })
configure({ asyncUtilTimeout: SLOW / 2 })

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

let server: ReturnType<typeof serverThat>

function run(memberNumber: string, date: string, points: number, id: number): Result {
  return {
    id,
    memberNumber,
    raceId: 900_000 + id,
    raceName: 'Probna trka',
    eventName: 'Probna trka',
    eventSlug: 'probna-trka',
    date,
    distanceKm: 10,
    ascentM: 0,
    descentM: 0,
    seconds: 3000,
    points,
    category: 'short',
    inItsSeason: true,
    inItsStanding: true,
  }
}

function servingResults(extra: Result[], frozen: { season: number }[] = [{ season: 2027 }]) {
  server.stop()
  server = serverThat((path) => {
    if (path === '/api/frozen-seasons') {
      return json(frozen)
    }

    return path === '/api/results' ? json(extra) : null
  })
}

beforeEach(() => {
  clearResourceCache()
  server = serverThat((path) => (path === '/api/frozen-seasons' ? json([{ season: 2027 }]) : null))
})

afterEach(() => {
  server.stop()
})

describe('a member who is no longer one', () => {
  it('is a name that leads nowhere even to a reader who may read a hidden profile', async () => {
    renderAt('/sr/tabela?sezona=2027', 'competitor', '000003')

    const table = await screen.findByRole('table')

    expect(within(table).getByText('Relja Momčilović')).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: 'Relja Momčilović' })).toBeNull()
    expect(within(table).getByRole('link', { name: 'Vladan Đurišić' })).toBeInTheDocument()
  })
})

describe('the trophies of a frozen season', () => {
  it('are the snapshot’s alone, whatever the live results of that season would give', async () => {
    servingResults([run('000001', '2027-05-05', 999, 1), run('000003', '2027-05-05', 1, 2)])

    renderAt('/sr/takmicar/000001/priznanja?sezona=sve')

    const table = await screen.findByRole('table', { name: sr.awards.trophies })

    expect(within(table).getAllByRole('row').slice(1).map((row) => row.textContent)).toHaveLength(4)
    expect(within(table).queryByText('999,00')).toBeNull()
  })
})

describe('the list of progress of the season after a frozen one', () => {
  it('measures a member against what the frozen season held at its freeze', async () => {
    /* 000006 holds 55 at the freeze of 2027 and no run of 2027 at all in the live results: read live, he
       has no season before and is not on the list. */
    servingResults([run('000006', '2028-05-05', 60, 3)])

    renderAt('/sr/top-liste', 'visitor', null, undefined, '2028-03-01')

    const progress = await screen.findByRole('heading', { name: sr.topBoards.progress }, { timeout: 15_000 })

    await waitFor(() => expect(progress.closest('section')?.textContent).toContain('Stamenkovska'))
  }, 2 * SLOW)
})

describe('the list of competitions', () => {
  it('counts a frozen competition by its snapshot', async () => {
    renderAt('/sr/lige?sezona=2027')

    const card = (await screen.findByRole('heading', { name: /RunTrace liga 2027/ })).closest('section, article, li')

    await waitFor(() => expect(card?.textContent).toContain(`${sr.leagues.entrants}: 2`))

    /* And a competition the snapshot wrote no standing for is none, not the count of another one
       (mutation S18, 06.11.2026). */
    const other = screen.getByRole('heading', { name: /Planinska liga 2027/ }).closest('section, article, li')

    expect(other?.textContent).toContain(`${sr.leagues.entrants}: 0`)
  })
})

describe('the ring of races on the page of a team in a frozen season', () => {
  /* Each length of the ring and how many races it holds, as the ring's own table says them to a reader who
     cannot see the drawing, and the total under them. */
  async function theRing(): Promise<string[][]> {
    await screen.findByRole('table', { name: sr.teams.members })

    const ring = screen.getByRole('table', { name: sr.profile.byCategory })

    return within(ring)
      .getAllByRole('row')
      .map((row) => [
        within(row).getByRole('rowheader').textContent ?? '',
        within(row).getAllByRole('cell')[0]?.textContent ?? '',
      ])
  }

  /* Two runs of 2027 by a member of Dunavski trkači, one of them a marathon, entered after the freeze. The
     snapshot holds 18 short and 8 half for this team and long races for Vardarski krug, so neither the live
     results nor the row of another team gives what the freeze wrote (V1 of the review of PR 676). */
  const afterTheFreeze = [run('000001', '2027-05-05', 10, 1), { ...run('000001', '2027-06-06', 50, 2), distanceKm: 42.2, category: 'marathon' as const }]

  it('is what the freeze counted for that team, whatever was entered for the season after it', async () => {
    servingResults(afterTheFreeze)

    renderAt('/sr/tim/dunavski-trkaci?sezona=2027')

    expect(await theRing()).toEqual([
      [sr.category.short, '18'],
      [sr.category.half, '8'],
      [sr.profile.totals, `26 ${sr.profile.racesWord.other}`],
    ])
  })

  it('is counted from the live results while the season is not frozen', async () => {
    servingResults(afterTheFreeze, [])

    renderAt('/sr/tim/dunavski-trkaci?sezona=2027')

    expect(await theRing()).toEqual([
      [sr.category.short, '1'],
      [sr.category.marathon, '1'],
      [sr.profile.totals, `2 ${sr.profile.racesWord.few}`],
    ])
  })
})

describe('the clocks of this file', () => {
  it('wait half of the time a case has, so that a wait that fails fails by its own words', () => {
    expect(getConfig().asyncUtilTimeout * 2).toBe(SLOW)
  })
})

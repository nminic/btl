import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
 */

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

function servingResults(extra: Result[]) {
  server.stop()
  server = serverThat((path) => {
    if (path === '/api/frozen-seasons') {
      return json([{ season: 2027 }])
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
  }, SLOW)
})

describe('the list of competitions', () => {
  it('counts a frozen competition by its snapshot', async () => {
    renderAt('/sr/lige?sezona=2027')

    const card = (await screen.findByRole('heading', { name: /RunTrace liga 2027/ })).closest('section, article, li')

    await waitFor(() => expect(card?.textContent).toContain(`${sr.leagues.entrants}: 2`))
  })
})

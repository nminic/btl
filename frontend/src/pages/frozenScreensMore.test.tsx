import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearResourceCache } from '../data/client'
import sr from '../i18n/sr.json'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'

/**
 * THE OTHER SCREENS OF A FROZEN SEASON: the top lists, the teams, a team's page, a competition, the list of
 * competitions and a member's trophies, each drawn from the snapshot of 2027 (`mock/frozen-tables.json`) on
 * the record that 2027 is frozen, and never from the ladders run again (`frozenScreens.test.tsx` says how
 * the suite stands; the table of the season is there).
 */

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

const FROZEN_2027 = () => json([{ season: 2027 }])

let server: ReturnType<typeof serverThat>

function serving(tables: (path: string) => Response | null) {
  server.stop()
  server = serverThat((path) => (path === '/api/frozen-seasons' ? FROZEN_2027() : tables(path)))
}

beforeEach(() => {
  clearResourceCache()
  server = serverThat((path) => (path === '/api/frozen-seasons' ? FROZEN_2027() : null))
})

afterEach(() => {
  server.stop()
})

function rowsOf(table: HTMLElement): string[][] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).queryAllByRole('cell').map((cell) => (cell.textContent ?? '').trim()))
}

/** The served tables of 2027 with one change, answered in their place. */
function tablesWith(change: (tables: { teams: { roster: { memberNumber: string | null }[] }[] }) => void): Response {
  const tables: { teams: { roster: { memberNumber: string | null }[] }[] } = JSON.parse(
    readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'frozen-tables.json'), 'utf-8'),
  )

  change(tables)

  return json(tables)
}

describe('a frozen table the server cannot hand over', () => {
  it.each([
    ['refused', () => new Response(null, { status: 500 })],
    ['not the shape', () => json({ season: '2027' })],
    ['not JSON at all', () => new Response('<html>', { status: 200 })],
  ])('is said to be unreadable when it is %s, and never drawn as the live one', async (_how, answer) => {
    serving((path) => (path === '/api/frozen-tables/2027' ? answer() : null))

    renderAt('/sr/tabela?sezona=2027')

    expect(await screen.findByText(sr.data.error)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('is said to be unreadable when the network does not answer', async () => {
    serving((path) => {
      if (path === '/api/frozen-tables/2027') {
        throw new TypeError('offline')
      }

      return null
    })

    renderAt('/sr/tabela?sezona=2027')

    expect(await screen.findByText(sr.data.error)).toBeInTheDocument()
  })
})

describe('the top lists of a frozen season', () => {
  it('are the places the freeze wrote, every list, with the race and the pair it wrote', async () => {
    renderAt('/sr/top-liste?sezona=2027')

    const kilometers = await screen.findByRole('table', { name: sr.topBoards.kilometers })

    expect(rowsOf(kilometers).map(([place, name, km]) => [place, name, km])).toEqual([
      ['1', 'Vladan Đurišić', '198,40'],
      ['2', 'Anđelija Vukotić', '180,20'],
    ])
    expect(within(kilometers).getAllByRole('link').length).toBeGreaterThan(0)

    expect(rowsOf(screen.getByRole('table', { name: sr.topBoards.pairs }))[0]?.[1]).toContain('Anđelija Vukotić')
    expect(rowsOf(screen.getByRole('table', { name: sr.topBoards.bestRaces }))[0]?.[2]).toBe('Beogradski maraton')
    expect(rowsOf(screen.getByRole('table', { name: sr.topBoards.onCourse })).map(([place]) => place)).toEqual(['1'])
  })

  it('measure the season that follows against the frozen one, and read no snapshot of their own', async () => {
    renderAt('/sr/top-liste', 'visitor', null, undefined, '2028-03-01')

    expect(await screen.findByRole('heading', { name: sr.topBoards.kilometers }, { timeout: 15_000 })).toBeInTheDocument()
    expect(server.asked.map((one) => one.path)).toContain('/api/frozen-tables/2027')
    expect(server.asked.map((one) => one.path)).not.toContain('/api/frozen-tables/2028')
  }, SLOW)
})

describe('the team standings of a frozen season', () => {
  it('are the teams the freeze wrote, a team deleted since a name that leads nowhere', async () => {
    renderAt('/sr/timovi?sezona=2027')

    const table = await screen.findByRole('table', { name: sr.teams.title })

    expect(rowsOf(table).map(([place, name, , members, points]) => [place, name, members, points])).toEqual([
      ['1', 'Dunavski trkači', '2', '800,70'],
      ['2', 'VKVardarski krug', '1', '401,75'],
      ['3', 'TKTim koji je obrisan', '1', '210,00'],
    ])
    expect(within(table).getByRole('link', { name: /Dunavski trkači/ })).toBeInTheDocument()
    expect(within(table).queryByRole('link', { name: /Tim koji je obrisan/ })).toBeNull()
  })
})

describe("a team's page in a frozen season", () => {
  it('is its members as the freeze wrote them, with the category of that season', async () => {
    renderAt('/sr/tim/dunavski-trkaci?sezona=2027')

    const table = await screen.findByRole('table', { name: sr.teams.members })

    expect(rowsOf(table).map(([place, name, category, , points]) => [place, name, category, points])).toEqual([
      ['1', 'Vladan Đurišić 000001', 'M 40-54', '412,50'],
      ['2', 'Bogoljub Nikolajević 000005', 'M 25-39', '388,20'],
    ])
  })

  it('names a member who is no longer one without a number, and without a category it cannot find', async () => {
    serving((path) =>
      path === '/api/frozen-tables/2027'
        ? tablesWith((tables) => {
            const first = tables.teams[0]?.roster[0]

            if (first !== undefined) {
              first.memberNumber = null
            }
          })
        : null,
    )

    renderAt('/sr/tim/dunavski-trkaci?sezona=2027')

    const table = await screen.findByRole('table', { name: sr.teams.members })

    expect(rowsOf(table).map(([, name, category]) => [name, category])).toEqual([
      ['Vladan Đurišić', ''],
      ['Bogoljub Nikolajević 000005', 'M 25-39'],
    ])
  })

  it('has nobody on it for a team the freeze did not write', async () => {
    renderAt('/sr/tim/nisavski-maraton-klub?sezona=2027')

    expect(await screen.findByText(sr.teams.noMembersThatSeason)).toBeInTheDocument()
  })
})

describe('a frozen competition', () => {
  it('is the grid the freeze wrote, an event deleted since a day that opens nothing', async () => {
    renderAt('/sr/liga/runtrace-2027')

    const grid = await screen.findByRole('table', { name: sr.leagues.standing })

    expect(rowsOf(grid)).toEqual([
      ['84,20', '40,10', '44,10'],
      ['30,00', '30,00', ''],
    ])
    expect(within(grid).getAllByRole('rowheader').map((one) => one.textContent)).toEqual([
      expect.stringContaining('Vladan Đurišić'),
      expect.stringContaining('Relja Momčilović'),
    ])
    expect(within(grid).queryByRole('link', { name: /Relja/ })).toBeNull()
    expect(within(grid).getByRole('link', { name: /Fruškogorski maraton/ })).toBeInTheDocument()
    expect(within(grid).queryByRole('link', { name: /Događaj koji je obrisan/ })).toBeNull()
  })

  it('has no women in it where the freeze wrote none', async () => {
    renderAt('/sr/liga/runtrace-2027?pol=z')

    expect(await screen.findByText(sr.leagues.noneOfThese)).toBeInTheDocument()
  })

  it('has no grid at all where the freeze wrote none', async () => {
    renderAt('/sr/liga/planinska-2027')

    expect(await screen.findByText(sr.leagues.noResults)).toBeInTheDocument()
  })

  it('counts on the list who stands in its snapshot', async () => {
    renderAt('/sr/lige?sezona=2027')

    expect(await screen.findByRole('heading', { name: /RunTrace liga 2027/ })).toBeInTheDocument()
    await waitFor(() => expect(server.asked.map((one) => one.path)).toContain('/api/frozen-tables/2027'))
  })

  it('says it does not know how many stand in it where the snapshot cannot be read', async () => {
    serving((path) => (path === '/api/frozen-tables/2027' ? new Response(null, { status: 500 }) : null))

    renderAt('/sr/lige?sezona=2027')

    expect((await screen.findAllByText(new RegExp(sr.leagues.unknown))).length).toBeGreaterThan(0)
  })

  it('says it does not know how many stand in it where the list of frozen seasons cannot be read', async () => {
    server.stop()
    server = serverThat((path) => (path === '/api/frozen-seasons' ? new Response(null, { status: 500 }) : null))

    renderAt('/sr/lige?sezona=2027')

    expect((await screen.findAllByText(new RegExp(sr.leagues.unknown))).length).toBeGreaterThan(0)
  })
})

describe("a member's trophies in a frozen season", () => {
  it('are the snapshot’s: personal, the team’s and the pair’s', async () => {
    renderAt('/sr/takmicar/000001/priznanja?sezona=sve')

    const table = await screen.findByRole('table', { name: sr.awards.trophies })

    expect(rowsOf(table)).toEqual(
      expect.arrayContaining([
        ['2027', sr.awards.overall, '1. mesto', '412,50'],
        ['2027', 'Kategorija M 40-54', '1. mesto', '412,50'],
        ['2027', 'Timski plasman, Dunavski trkači', '1. mesto', '800,70'],
        ['2027', sr.awards.pair, '1. mesto', '160,40'],
      ]),
    )
  })

  it('are none of the snapshot’s where the record says nothing is frozen', async () => {
    server.stop()
    server = serverThat((path) => (path === '/api/frozen-seasons' ? json([]) : null))

    renderAt('/sr/takmicar/000001/priznanja?sezona=sve')

    await screen.findByRole('heading', { name: new RegExp(sr.awards.trophies) })
    expect(server.asked.map((one) => one.path).filter((one) => one.startsWith('/api/frozen-tables'))).toEqual([])
  })

  it('are said to be unreadable where a frozen season cannot be read', async () => {
    serving((path) => (path === '/api/frozen-tables/2027' ? new Response(null, { status: 500 }) : null))

    renderAt('/sr/takmicar/000001/priznanja?sezona=sve')

    expect(await screen.findByText(sr.data.error)).toBeInTheDocument()
  })

  it('wait for the list of frozen seasons, and say where it cannot be read', async () => {
    server.stop()
    server = serverThat((path) => (path === '/api/frozen-seasons' ? new Response(null, { status: 500 }) : null))

    renderAt('/sr/takmicar/000001/priznanja?sezona=sve')

    expect(await screen.findByText(sr.data.error)).toBeInTheDocument()
  })
})

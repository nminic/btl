import { screen, within } from '@testing-library/react'
import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'
import sr from '../../i18n/sr.json'
import { at, first, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { PER_PAGE } from '../../components/pageOf'
import { formatDistance, formatShortDate } from '../../i18n/format'

/* Fifty placed to a page (owner, 03.08.2026, PDL P24).
 *
 * The generated data holds thirty two competitors, so the grid never fills a
 * page on its own and the paging would go untested on the one screen that uses
 * it: the slice could be replaced with `slice(0, PER_PAGE)`, the address could be
 * read under the wrong name, or the pager could be deleted, and every test would
 * stay green. So the two files the grid is built from are answered with enough
 * rows to page through, the way the other tests of this screen answer them.
 */

const RUN = '/sr/liga/brdska-2019/rezultati'
/** Comfortably more than one page, and not a round multiple of it, so the last
 *  page is a remainder rather than a full page. */
const MANY = 137

/**
 * The grid, with as many competitors as asked for and a result each.
 *
 * Everything else is answered from the real files, so the competition, its
 * events and its races are the ones the screen would really draw.
 */
async function withCompetitors(count: number) {
  const real = globalThis.fetch
  /* The races this competition is made of, read once, so the results put in its
     place belong to it. */
  const races = (await (await real('/mock/races.json')).json()) as Race[]
  const events = (await (await real('/mock/events.json')).json()) as BtlEvent[]
  const leagues = (await (await real('/mock/leagues.json')).json()) as League[]
  const league = must(
    leagues.find((one) => one.slug === 'brdska-2019'),
    'takmičenje brdska-2019',
  )
  const held = new Set(events.filter((one) => league.eventIds.includes(one.id)).map((one) => one.id))
  const mine = new Set(races.filter((race) => held.has(race.eventId)).map((race) => race.id))

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const name = String(input)

    if (name.endsWith('/competitors.json')) {
      const all = (await (await real(input)).json()) as Competitor[]
      const one = first(all)

      return new Response(
        JSON.stringify(
          Array.from({ length: count }, (_ignored, index) => ({
            ...one,
            memberNumber: String(index + 1).padStart(6, '0'),
            firstName: 'Takmičar',
            lastName: `Broj ${index + 1}`,
            active: true,
          })),
        ),
        { status: 200 },
      )
    }

    if (name.endsWith('/results.json')) {
      const all = (await (await real(input)).json()) as Result[]
      /* One result of a race that belongs to this competition, copied to every
         competitor, so every one of them is placed and the grid has a row for
         each.
       *
         Chosen through the competition's own races rather than by the year. By
         the year it happened to work, and would stop working the day the data is
         generated again and the first result of 2019 lands on an event outside
         this competition: the grid would then be empty and all five tests would
         fail on a timeout, saying nothing about why. */
      const model = must(
        all.find((result) => mine.has(result.raceId)),
        'rezultat sa trke ovog takmičenja',
      )

      return new Response(
        JSON.stringify(
          Array.from({ length: count }, (_ignored, index) => ({
            ...model,
            id: `res-${index + 1}`,
            memberNumber: String(index + 1).padStart(6, '0'),
            points: count - index,
          })),
        ),
        { status: 200 },
      )
    }

    return real(input)
  }) as typeof fetch

  return () => {
    globalThis.fetch = real
  }
}

const grid = async () => within(await screen.findByRole('table', { name: 'Poredak takmičenja' }))

describe('a competition with more placed than fit on one page', () => {
  it('draws fifty of them and no more', async () => {
    const undo = await withCompetitors(MANY)

    try {
      renderAt(RUN)

      expect((await grid()).getAllByRole('rowheader')).toHaveLength(PER_PAGE)
    } finally {
      undo()
    }
  })

  it('says which rows are on the screen and offers the way on', async () => {
    const undo = await withCompetitors(MANY)

    try {
      renderAt(RUN)
      await grid()

      /* Named from the dictionary, so renaming the key is caught here rather
         than by nobody: `translate` hands back the key itself when there is no
         such entry, and the landmark would quietly be called
         "pager.leagueStanding". */
      expect(screen.getByRole('navigation', { name: sr.pager.leagueStanding })).toBeVisible()
      expect(screen.getByText(`Prikazano 1 do 50 od ${MANY}`)).toBeVisible()
      /* Read off `aria-disabled`, which is what this pager says: `toBeEnabled`
         looks at the `disabled` attribute alone, and the pager never sets one,
         so it passed over a step that was shut on every page. */
      expect(screen.getByRole('button', { name: 'Sledeća' })).toHaveAttribute(
        'aria-disabled',
        'false',
      )
    } finally {
      undo()
    }
  })

  it('shows the next fifty on the next page, and the rest on the last', async () => {
    const undo = await withCompetitors(MANY)

    try {
      const user = setupUser()
      const { router } = renderAt(RUN)

      const before = (await grid()).getAllByRole('rowheader').map((cell) => cell.textContent)

      await user.click(screen.getByRole('button', { name: 'Sledeća' }))

      const second = (await grid()).getAllByRole('rowheader').map((cell) => cell.textContent)

      expect(router.state.location.search).toContain('strana=2')
      expect(second).toHaveLength(PER_PAGE)
      /* A different fifty, not the same fifty again: that is the whole of what
         the slice does, and a slice that ignored the page would pass everything
         above this line. */
      expect(second).not.toEqual(before)
      expect(second.filter((name) => before.includes(name))).toEqual([])

      await user.click(screen.getByRole('button', { name: 'Sledeća' }))

      expect((await grid()).getAllByRole('rowheader')).toHaveLength(MANY - 2 * PER_PAGE)
      /* Said with `aria-disabled` rather than by switching the button off, so
         the keyboard is not thrown back to the top of the document by the last
         press somebody makes (Pager.tsx). */
      expect(screen.getByRole('button', { name: 'Sledeća' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    } finally {
      undo()
    }
  })

  it('opens on the page the address names', async () => {
    /* A page somebody is reading is a page they can send to somebody else. */
    const undo = await withCompetitors(MANY)

    try {
      renderAt(`${RUN}?strana=3`)
      await grid()

      expect(screen.getByText(`Prikazano 101 do ${MANY} od ${MANY}`)).toBeVisible()
    } finally {
      undo()
    }
  })

  it('keeps the order across the pages, so the fiftieth is above the fifty first', async () => {
    const undo = await withCompetitors(MANY)

    try {
      const user = setupUser()
      renderAt(RUN)

      /* The first cell of a row is the total, written the Serbian way, so the
         comma has to come out before it is a number again. */
      const total = (row: HTMLElement) =>
        Number((at(within(row).getAllByRole('cell'), 0).textContent ?? '').replace(',', '.'))

      const firstPage = (await grid()).getAllByRole('row').slice(1)
      const lastOfFirst = total(at(firstPage, PER_PAGE - 1))

      await user.click(screen.getByRole('button', { name: 'Sledeća' }))

      const secondPage = (await grid()).getAllByRole('row').slice(1)
      const firstOfSecond = total(first(secondPage))

      expect(lastOfFirst).not.toBeNaN()

      expect(firstOfSecond).toBeLessThanOrEqual(lastOfFirst)
    } finally {
      undo()
    }
  })
})

describe('a competition everybody in it fits on one page', () => {
  it('is drawn whole, with no way from one page to another', async () => {
    renderAt(RUN)

    const rows = (await grid()).getAllByRole('rowheader')

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(PER_PAGE)
    expect(screen.queryByRole('navigation', { name: sr.pager.leagueStanding })).toBeNull()
  })
})

describe('a competition whose event runs over more than one morning', () => {
  /* A race carries no name of its own (data/types.ts), so a column is headed by
     a length and a day. Two races of one length on two mornings therefore have
     to differ by the day, and the day of a race is not the day of its event
     (PDL P10). */
  async function overTwoMornings() {
    const real = globalThis.fetch
    const races = (await (await real('/mock/races.json')).json()) as Race[]
    const events = (await (await real('/mock/events.json')).json()) as BtlEvent[]
    const leagues = (await (await real('/mock/leagues.json')).json()) as League[]
    const league = must(
      leagues.find((one) => one.slug === 'brdska-2019'),
      'takmičenje brdska-2019',
    )
    const held = new Set(events.filter((one) => league.eventIds.includes(one.id)).map((one) => one.id))
    const mine = must(
      races.find((race) => held.has(race.eventId)),
      'trka ovog takmičenja',
    )
    /* The same length as it already is, one day later: two columns that only the
       day can tell apart. */
    const second: Race = {
      ...mine,
      id: `${mine.id}-drugo-jutro`,
      date: `${mine.date.slice(0, 8)}${String(Number(mine.date.slice(8, 10)) + 1).padStart(2, '0')}`,
    }

    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/races.json')
        ? new Response(JSON.stringify([...races, second]), { status: 200 })
        : real(input)) as typeof fetch

    return { first: mine, second, undo: () => { globalThis.fetch = real } }
  }

  it('heads the two columns with two different days', async () => {
    const { first, second, undo } = await overTwoMornings()

    try {
      renderAt(RUN)

      const heads = (await grid()).getAllByRole('columnheader').map((one) => one.textContent ?? '')
      const length = formatDistance(first.distanceKm, 'sr')
      const mine = heads.filter((one) => one.startsWith(`${length},`))

      expect(mine.length).toBeGreaterThanOrEqual(2)
      /* Each morning said once, rather than one morning said twice. */
      expect(mine.filter((one) => one.includes(formatShortDate(second.date, 'sr')))).toHaveLength(1)
      expect(new Set(mine).size).toBe(mine.length)
    } finally {
      undo()
    }
  })
})

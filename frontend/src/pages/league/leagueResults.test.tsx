import { screen, within } from '@testing-library/react'
import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'
import sr from '../../i18n/sr.json'
import { at, first, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { PER_PAGE } from '../../components/pageOf'
import { SLOW } from '../../test/slow'
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

/** The browser's own `fetch`, taken once before anything has replaced it, so the
 *  clean-up below has something true to put back. Read at module level rather than
 *  inside the fixture: a case that times out leaves its own copy behind, and a
 *  clean-up that read from the last fixture would restore that. */
const REAL_FETCH = globalThis.fetch

/**
 * The grid, with as many competitors as asked for and a result each.
 *
 * Everything else is answered from the real files, so the competition, its
 * events and its races are the ones the screen would really draw.
 */
async function withCompetitors(count: number, mixed = false) {
  const real = globalThis.fetch
  /* The races this competition is made of, read once, so the results put in its
     place belong to it. */
  const races: Race[] = await (await real('/mock/races.json')).json()
  const events: BtlEvent[] = await (await real('/mock/events.json')).json()
  const leagues: League[] = await (await real('/mock/leagues.json')).json()
  const league = must(
    leagues.find((one) => one.slug === 'brdska-2019'),
    'takmičenje brdska-2019',
  )
  const held = new Set(events.filter((one) => league.eventIds.includes(one.id)).map((one) => one.id))
  const mine = new Set(races.filter((race) => held.has(race.eventId)).map((race) => race.id))

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const name = String(input)

    if (name.endsWith('/competitors.json')) {
      const all: Competitor[] = await (await real(input)).json()
      const one = first(all)

      return new Response(
        JSON.stringify(
          Array.from({ length: count }, (_ignored, index) => ({
            ...one,
            memberNumber: String(index + 1).padStart(6, '0'),
            firstName: 'Takmičar',
            lastName: `Broj ${index + 1}`,
            active: true,
            /* Both genders, in turn, where a case asks for it. Copied from one
               record, everybody in this field is otherwise the same person with a
               different number, so the standing they build is **one block** and
               the arithmetic that cuts a page across blocks is never run over
               more than one. That is what let a page of a hundred through, and it
               is why this switch exists.

               Both written out rather than only the women: the record copied from
               is whoever stands first in the file, and if that happens to be a
               woman then setting every other one to a woman leaves one block
               again, which is how the first attempt at this case measured
               nothing. */
            ...(mixed ? { gender: index % 2 === 0 ? ('M' as const) : ('F' as const) } : {}),
          })),
        ),
        { status: 200 },
      )
    }

    if (name.endsWith('/results.json')) {
      const all: Result[] = await (await real(input)).json()
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
  })

  return () => {
    globalThis.fetch = real
  }
}

/**
 * The real `fetch` back after every case, whatever became of the one before it.
 *
 * The cases below put theirs back in a `finally`, which is right while a case
 * runs to its end and useless when one times out: Vitest calls such a case failed
 * and does **not** stop its body, so the `finally` runs later, in the middle of
 * the next case, and takes that one's `fetch` away with it. Measured on
 * 28.08.2026: with one case timing out, `is drawn whole, with no way from one page
 * to another` failed with „expected <nav class="pager"> to be null" and `reaches
 * across every column` with „the standing is drawn as one block", neither of which
 * has a stub of its own and one of which never asks for one. Both had been handed
 * somebody else's field of 137 competitors.
 *
 * One slow case then reads as three broken screens, and every message points at
 * production code rather than at the clock. That is the shape of red gate this
 * whole change exists to stop, in its worst form: the failure lies about what
 * failed.
 *
 * Here rather than in place of the `finally`, because the two answer different
 * questions: the `finally` keeps a case from leaking into the next one while the
 * suite is healthy, and this keeps a case that never finished from leaking at all.
 */
afterEach(() => {
  globalThis.fetch = REAL_FETCH
})

const grid = async () => within(await screen.findByRole('table', { name: 'Poredak takmičenja' }))

/**
 * The rows that are people, out of a table that also has rows that are names of
 * blocks.
 *
 * The standing has been split into blocks since 27.08.2026 (PDL P15), and each
 * block is introduced by a row carrying one heading across the whole width. Those
 * rows are not placings and must not be counted as any: `slice(1)` used to be
 * enough because the only row that was not a person was the one at the top.
 *
 * Both carry a heading of their own row: the runner's name on a placing, and the
 * name of the block on the row that opens one, since a heading over a `<tbody>`
 * is a row group heading and not a column one. What tells them apart is what
 * follows the heading: a placing has cells, and a block heading is alone in its
 * row.
 */
const placings = (table: ReturnType<typeof within>): HTMLElement[] =>
  table
    .getAllByRole('row')
    .filter(
      (row: HTMLElement) =>
        within(row).queryAllByRole('rowheader').length > 0 &&
        within(row).queryAllByRole('cell').length > 0,
    )

describe('a competition with more placed than fit on one page', () => {
  it('draws fifty of them and no more', async () => {
    const undo = await withCompetitors(MANY)

    try {
      renderAt(RUN)

      /* Counted as placings and not as every heading of a row: the row that
         opens a block carries one too, and it is not a placing. */
      expect(placings(await grid())).toHaveLength(PER_PAGE)
    } finally {
      undo()
    }
  }, SLOW)

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

      const before = placings(await grid()).map((row) => within(row).getAllByRole('rowheader')[0]?.textContent)

      await user.click(screen.getByRole('button', { name: 'Sledeća' }))

      const second = placings(await grid()).map((row) => within(row).getAllByRole('rowheader')[0]?.textContent)

      expect(router.state.location.search).toContain('strana=2')
      expect(second).toHaveLength(PER_PAGE)
      /* A different fifty, not the same fifty again: that is the whole of what
         the slice does, and a slice that ignored the page would pass everything
         above this line. */
      expect(second).not.toEqual(before)
      expect(second.filter((name) => before.includes(name))).toEqual([])

      await user.click(screen.getByRole('button', { name: 'Sledeća' }))

      expect(placings(await grid())).toHaveLength(MANY - 2 * PER_PAGE)
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
  }, SLOW)

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

      const firstPage = placings(await grid())
      const lastOfFirst = total(at(firstPage, PER_PAGE - 1))

      await user.click(screen.getByRole('button', { name: 'Sledeća' }))

      const secondPage = placings(await grid())
      const firstOfSecond = total(first(secondPage))

      expect(lastOfFirst).not.toBeNaN()

      expect(firstOfSecond).toBeLessThanOrEqual(lastOfFirst)
    } finally {
      undo()
    }
  }, SLOW)
})

describe('a competition everybody in it fits on one page', () => {
  it('is drawn whole, with no way from one page to another', async () => {
    renderAt(RUN)

    const rows = placings(await grid()).map((row) => must(within(row).getAllByRole('rowheader')[0], 'the name of the placing'))

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
    const races: Race[] = await (await real('/mock/races.json')).json()
    const events: BtlEvent[] = await (await real('/mock/events.json')).json()
    const leagues: League[] = await (await real('/mock/leagues.json')).json()
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
        : real(input))

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

describe('the heading that names one block of the standing', () => {
  it('reaches across every column, so the grid keeps one shape', async () => {
    /* A block heading is one cell in a row of its own, and it has to be as wide
       as the table or the table has two shapes: sixteen columns in every row of
       people and one in every row that names a group. A browser then draws the
       heading in the width of the first column and the rest of that row empty,
       and a screen reader announcing „column 1 of 16" over a heading meant for
       all sixteen tells the reader the wrong thing about where they are.

       Counted against the headings the table actually has, rather than against a
       number written here: the grid is as wide as the competition has races, and
       a figure repeated here would be a second home for that count.

       Measured by a mutation: with the span cut to one, every other test in this
       file and in `details.test.tsx` stayed green. */
    renderAt(RUN)

    const table = await grid()
    const columns = within(must(table.getAllByRole('rowgroup')[0], 'the head of the table'))
      .getAllByRole('columnheader')

    expect(columns.length).toBeGreaterThan(2)

    const blocks = table.getAllByRole('rowgroup').slice(1)

    expect(blocks.length, 'the standing is drawn as one block').toBeGreaterThan(1)

    for (const block of blocks) {
      const heading = must(within(block).getAllByRole('rowheader')[0], 'the name of the block')

      expect(heading).toHaveAttribute('colspan', String(columns.length))
      /* And it names the group of rows it opens rather than a group of columns.
         The portal draws no `<colgroup>` anywhere, so `colgroup` pointed at
         something that does not exist; a heading that opens a `<tbody>` is a row
         group heading, which is what a reader moving through the table is told
         when they ask which block they are in. */
      expect(heading).toHaveAttribute('scope', 'rowgroup')
    }
  })
})

describe('a page of a standing that is split into blocks', () => {
  it('is still fifty placings, however the blocks fall across it', async () => {
    /* The page is cut out of the ordered list and then dealt into blocks, so the
       arithmetic that says where a block starts runs once per block. Measured by
       a review on 27.08.2026: with that running total left at nought, every block
       was cut from the beginning, page one drew a hundred placings in a field of
       two blocks and all 137 in a field of six, and 61 tests stayed green.

       Green because every other case here builds its field by copying one
       competitor, so the whole of it is one man of one age and the standing is
       one block: the only arithmetic this change added was never run over more
       than one. This is the case that runs it. */
    const undo = await withCompetitors(MANY, true)

    try {
      renderAt(RUN)

      const table = await grid()

      expect(placings(table)).toHaveLength(PER_PAGE)

      /* And the field really is two blocks, which is what makes the count above
         mean anything. Not asked of this page: the blocks are cut out of one
         ordered list and the men fill the first sixty nine places, so page one is
         one block and the boundary falls on page two. Asked of the second page,
         which is where both blocks meet. */
      await setupUser().click(screen.getByRole('button', { name: 'Sledeća' }))

      const second = await grid()

      expect(
        second.getAllByRole('rowgroup').slice(1).length,
        'the field is one block after all',
      ).toBeGreaterThan(1)
      expect(placings(second)).toHaveLength(PER_PAGE)

      /* And page one drew one block and not two with an empty one under it. The
         men fill the first sixty nine places, so the women have nobody on that
         page at all, and a block with nobody on the page is a heading over
         nothing. This is what the filter over the cut blocks is for; the comment
         beside it used to claim it was for a competition of five people showing
         eight empty tables, which cannot happen at all because the blocks are
         built only out of rows that exist. */
      await setupUser().click(screen.getByRole('button', { name: 'Prethodna' }))

      const back = await grid()

      expect(back.getAllByRole('rowgroup').slice(1)).toHaveLength(1)
      expect(
        within(must(back.getAllByRole('rowgroup')[1], 'the one block of page one'))
          .getAllByRole('rowheader')[0]?.textContent,
        'the block is named by its code rather than in words',
      ).toBe('Muškarci')
    } finally {
      undo()
    }
  }, SLOW)

  it('loses nobody at a boundary a block falls on', async () => {
    /* Every placing once and no more, read across all three pages of a mixed
       field. A block that runs out mid-page and one that begins mid-page are the
       two ways an off-by-one shows here, and both are on this walk. */
    const undo = await withCompetitors(MANY, true)

    try {
      const user = setupUser()

      renderAt(RUN)

      const named = () =>
        placings(within(screen.getByRole('table', { name: 'Poredak takmičenja' }))).map(
          (row) => within(row).getAllByRole('rowheader')[0]?.textContent ?? '',
        )

      await grid()
      const seen = [...named()]

      for (let page = 2; page <= 3; page += 1) {
        await user.click(screen.getByRole('button', { name: 'Sledeća' }))
        await grid()
        seen.push(...named())
      }

      expect(seen).toHaveLength(MANY)
      expect(new Set(seen).size, 'somebody is drawn on two pages').toBe(MANY)
    } finally {
      undo()
    }
  }, SLOW)
})

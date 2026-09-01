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

/**
 * The `fetch` these cases are meant to see between them, taken once at module
 * level so the clean-up below has something true to put back.
 *
 * **Not the browser's own**, and the difference matters: `test/setup.ts` replaces
 * `fetch` with a reader that serves `public/` off the disc, and it runs before this
 * module is evaluated, so what is caught here is that reader. That is the right
 * thing to put back, and saying so is the point of this note. A review measured
 * what happens to somebody who believes otherwise and reaches for
 * `vi.unstubAllGlobals()`: nine of the ten cases in this file fail with „Failed to
 * parse URL from /mock/races.json".
 *
 * Read at module level rather than inside the fixture, because a case that times
 * out leaves its own copy behind and a clean-up reading from the last fixture would
 * put that back.
 */
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
 * The cases below used to put theirs back in a `finally`, which is right while a
 * case runs to its end and worse than useless when one times out: Vitest calls such
 * a case failed and does **not** stop its body, so the `finally` runs later, in the
 * middle of the next case, and takes that one's `fetch` away with it. Measured on
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
 * **Instead of the `finally` and not beside it**, which was the first answer and
 * was measured wrong: this hook cleans up before the next case begins, and the
 * stale `finally` then runs inside that case and undoes it again. A review measured
 * both, with one case's clock cut short: with the `finally` kept, two cases fail and
 * the second one changes between runs; with it gone, one fails, three runs out of
 * three. `pages/publicData.test.tsx` had already answered this the same way.
 */
afterEach(() => {
  globalThis.fetch = REAL_FETCH
})

const grid = async () => within(await screen.findByRole('table', { name: 'Poredak takmičenja' }))

/**
 * The rows that are people, out of a table that also has rows that are names of
 * blocks.
 *
 * The standing has been split into blocks since 27.08.2026, and each
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
    await withCompetitors(MANY)

      renderAt(RUN)

      /* Counted as placings and not as every heading of a row: the row that
         opens a block carries one too, and it is not a placing. */
      expect(placings(await grid())).toHaveLength(PER_PAGE)
  }, SLOW)

  it('says which rows are on the screen and offers the way on', async () => {
    await withCompetitors(MANY)

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
  })

  it('shows the next fifty on the next page, and the rest on the last', async () => {
    await withCompetitors(MANY)

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
  }, SLOW)

  it('opens on the page the address names', async () => {
    /* A page somebody is reading is a page they can send to somebody else. */
    await withCompetitors(MANY)

      renderAt(`${RUN}?strana=3`)
      await grid()

      expect(screen.getByText(`Prikazano 101 do ${MANY} od ${MANY}`)).toBeVisible()
  })

  it('keeps the order across the pages, so the fiftieth is above the fifty first', async () => {
    await withCompetitors(MANY)

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
  /* Two races of one length on two mornings of one year: the year cannot part them,
     so the label falls to its second rung and writes the day in place of the year
     (`data/raceLabel.ts`). The heading therefore does part them, and by the day,
     which is what the first case below measures.

     Two sentences used to stand here and both were untrue. The first said such a pair
     reads alike in the heading; the ladder of rungs answers that, and the case below
     proves it. The second said what still parts them is the `title`, which carries the
     day: the title is the two visible halves joined back together
     (`LeagueResults.tsx` writes it as the name, a space, and the rest), so it says
     neither more nor less than the heading says.

     **What the change really cost, written down rather than mended.** On `main` the
     title was built here as `${column.event}, ${name}, ${day}`, so the day of every
     race was on this screen whatever the heading carried. Now the day appears only
     where a rung reaches for it, and an event running over several mornings whose
     races differ in length is parted by the first rung already. Measured over the
     file on 29.08.2026, one such event is in it: „Beogradski maraton" of the
     runtrace-2027 competition runs 2,47 km on 3 April and 42,2 km on 4 April, and its
     two columns read „Beogradski maraton 2027. (2,5 km)" and „... (42,2 km)", with
     the day nowhere on the screen. A reader who wants the morning has to open the
     event. That follows from the owner's decision of 29.08.2026 and is not this
     file's to undo.

     The pair below is built rather than found because no competition in the file
     holds one: measured the same day, the three competitions have 23 columns between
     them, no two races of one length on two mornings anywhere among them, and no two
     labels alike. */

  /** The morning after the given one, counted on the calendar and not in the string.
   *
   *  Adding one to the last two characters does not know how long a month is. A race
   *  on the 28th of February would become „2019-02-29", which JS reads as the first
   *  of March, so this case would stay green while measuring a day it does not name;
   *  a race on the 31st would become „2019-01-32", which is not a date at all and
   *  makes `Intl` throw a RangeError. Precedent for counting days: `data/derive.ts`. */
  const morningAfter = (day: string): string =>
    new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + 1))
      .toISOString()
      .slice(0, 10)

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
      date: morningAfter(mine.date),
    }

    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/races.json')
        ? new Response(JSON.stringify([...races, second]), { status: 200 })
        : real(input))

    return { first: mine, second }
  }

  it('parts two mornings by their day, where the year cannot', async () => {
    /* A column is headed the way the whole portal names a race: its name, when it
       was run, and its measure in brackets (`data/raceLabel.ts`, owner 29.08.2026).
       Normally „when" is the year, and inside one competition the year is what tells
       one season of a race from another.

       Two races of one length on two mornings of one year is the case the year
       cannot answer, and there the day takes its place, once for each morning. Left
       to the year, those are two columns reading alike over two different races. */
    const { first, second } = await overTwoMornings()

    renderAt(RUN)

    const heads = await (await grid()).findAllByRole('columnheader')
    const mine = heads.filter((one) => (one.textContent ?? '').startsWith(first.name))

    expect(mine.length, 'the two mornings are no longer two columns').toBe(2)

    const said = mine.map((one) => one.textContent)
    const measure = `(${formatDistance(first.distanceKm, 'sr')})`

    expect(new Set(said).size, 'two columns of one competition read alike').toBe(2)
    expect(said).toContain(`${first.name} ${formatShortDate(first.date, 'sr')} ${measure}`)
    expect(said).toContain(`${first.name} ${formatShortDate(second.date, 'sr')} ${measure}`)
  })

  it('says the name first, and keeps the whole label on the title', async () => {
    /* Measured by a review on 29.08.2026 in Chrome: the heading is turned on its
       side and capped (`League.css` writes the cap, and what it came to in pixels is
       beside the markup in `LeagueResults.tsx`; no third copy of it here), and all
       fourteen headings of this competition were cut before the name began, so the
       one thing the change was made for was never seen. Put first, the name ate the
       measure instead: two columns of „Šidski novogodišnji maraton" read alike though
       one is 32,4 km and the other 42,2.

       So the two halves are two elements, drawn in that order, and the measure is the
       one that never gives way. Asked of the drawn screen rather than of a copy of the
       rule: the version of this that lived in `leagueTable.test.ts` wrote the rule out
       again and passed with the screen putting the name last.

       **What this cannot say, and who says it instead.** Where the cut falls at a
       given width is a question for a browser; jsdom lays nothing out. It was measured
       in Chrome over the built sheet, and the numbers are written beside the markup
       (`LeagueResults.tsx`). That the sheet still gives the measure its place before
       the name, under the class names this file reads, is weighed by
       `styles/raceHeadingHalves.test.ts`.

       **Why the two halves are found by class here** (`CLAUDE.md`: component tests use
       role and label queries, not CSS selectors). Neither half is a control and neither
       carries a name of its own: they are two spans inside one column heading, and the
       heading's accessible name is both of them together, so there is no role or label
       that reaches one and not the other. The class is the only handle, and the risk it
       brings is exactly the one measured on 29.08.2026: renamed in `League.css` alone,
       the sheet stopped reaching the markup and 2297 tests stayed green. That is the
       hole `styles/raceHeadingHalves.test.ts` was written to close, and it is what
       stands behind the two selectors below. */
    renderAt(RUN)

    const heads = (await (await grid()).findAllByRole('columnheader')).filter(
      (head) => within(head).queryByTitle(/./) !== null,
    )

    expect(heads.length, 'the grid draws no race columns at all').toBe(14)

    for (const head of heads) {
      const box = within(head).getByTitle(/./)
      const called = must(head.querySelector('.league__race-called'), 'the half that may be cut')
      const measure = must(head.querySelector('.league__race-measure'), 'the half that may not')

      /* The name first, read off the order the heading is drawn in. The two above are
         found by their class and so say nothing about which of them a reader meets
         first, and the name standing last is the fault of 29.08.2026 itself. */
      expect([...box.children], 'the two halves are drawn the other way round').toEqual([
        called,
        measure,
      ])

      /* And the whole label on the title, which is the only place it survives once the
         name has been cut: at 360 a long measure leaves the name nought pixels wide.
         Held against the two halves rather than rebuilt out of the data here, so a
         title that has stopped being the label is caught: written as the name alone it
         left 2297 tests green. */
      expect(box.getAttribute('title'), 'the title is no longer the whole label').toBe(
        `${called.textContent}${measure.textContent}`,
      )

      /* When it was run and what it measured, in that order and in brackets. */
      expect(measure.textContent).toMatch(/^ (\d{4}\.|\d{1,2}\. \d{1,2}\. \d{4}\.) \([\d.,]+ km\)$/)
      expect((called.textContent ?? '').length, 'the name is empty').toBeGreaterThan(0)
    }
  })

})

describe('a competition holding one race in two seasons', () => {
  /* The year is what a grid of a competition gains by carrying a date at all: inside
     one event it is a constant, across seasons it is the whole difference. Two
     mutations passed a whole round of review because nothing asked for values, only
     for shape: a year pinned to a constant, and a length rounded to whole
     kilometres.

     A competition of the file cannot answer that on its own, because every race of
     one holds one year, so the second season is built here the way the second
     morning is above. The third mutation of that round, the year written in Serbian
     on an English page, is **not** measured here and that is worth saying rather
     than implying otherwise: the portal has one dictionary (`i18n/sr.json`), so
     there is no English page to draw. What holds that claim is `i18n/format.test.ts`,
     which asks `formatYear` for both languages. */
  it('writes each race under its own year, and the length as it stands', async () => {
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
    /* The same race a year earlier, which is what a competition looks like when it
       has run before. */
    const older: Race = {
      ...mine,
      id: `${mine.id}-ranija-sezona`,
      date: `${Number(mine.date.slice(0, 4)) - 1}${mine.date.slice(4)}`,
    }

    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/races.json')
        ? new Response(JSON.stringify([...races, older]), { status: 200 })
        : real(input))

    renderAt(RUN)

    const said = (await (await grid()).findAllByRole('columnheader'))
      .map((head) => head.textContent ?? '')
      .filter((one) => one.startsWith(mine.name))

    expect(said.length, 'the two seasons are no longer two columns').toBe(2)
    expect(
      new Set(said).size,
      `a year that is not the race's own: ${said.join(' / ')}`,
    ).toBe(2)
    expect(said.some((one) => one.includes(`${mine.date.slice(0, 4)}.`)), said.join(' / ')).toBe(true)
    expect(said.some((one) => one.includes(`${older.date.slice(0, 4)}.`)), said.join(' / ')).toBe(true)
    /* And a length nobody rounded on the way. */
    expect(
      said.every((one) => one.endsWith(`(${formatDistance(mine.distanceKm, 'sr')})`)),
      said.join(' / '),
    ).toBe(true)
  }, SLOW)
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
    await withCompetitors(MANY, true)

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
  }, SLOW)

  it('loses nobody at a boundary a block falls on', async () => {
    /* Every placing once and no more, read across all three pages of a mixed
       field. A block that runs out mid-page and one that begins mid-page are the
       two ways an off-by-one shows here, and both are on this walk. */
    await withCompetitors(MANY, true)

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
  }, SLOW)
})

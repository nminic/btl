import { screen, within } from '@testing-library/react'
import type { BtlEvent, Competitor, League, Race, Result } from '../../data/types'
import sr from '../../i18n/sr.json'
import { at, first, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { PER_PAGE } from '../../components/pageOf'
import { SLOW } from '../../test/slow'
import { formatDayMonth } from '../../i18n/format'

/* Fifty placed to a page (owner, 03.08.2026, PDL P24).
 *
 * The generated data holds thirty two competitors, so the grid never fills a
 * page on its own and the paging would go untested on the one screen that uses
 * it: the slice could be replaced with `slice(0, PER_PAGE)`, the address could be
 * read under the wrong name, or the pager could be deleted, and every test would
 * stay green. So the two files the grid is built from are answered with enough
 * rows to page through, the way the other tests of this screen answer them.
 */

const RUN = '/sr/liga/brdska-2019'
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
            /* **Written out and never inherited, in both shapes.** The record copied
               from is whoever stands first in the file, and the screen draws one half
               of the field at a time, opening on the men (`LeagueResults.tsx`). Left to
               the file, the day somebody reorders it every case here draws an empty
               competition and says nothing about the paging it exists to measure.

               Mixed where a case asks for it, and then it is a field the boundary
               between the halves really falls inside. */
            gender: mixed && index % 2 === 1 ? ('F' as const) : ('M' as const),
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
 * 28.08.2026: with one case timing out, two other cases failed, neither of which has
 * a stub of its own and one of which never asks for one. Both had been handed
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
 * The rows that are people.
 *
 * Every row of the body is a placing since 07.09.2026, when the two blocks became
 * one chosen half and the heading that used to open each block went with them. The
 * head of the table is still a row and is still not a placing, and what tells them
 * apart is what follows the heading of the row: a placing has cells, the head of
 * the table has none.
 */
const placings = (table: ReturnType<typeof within>): HTMLElement[] =>
  table
    .getAllByRole('row')
    .filter(
      (row: HTMLElement) =>
        within(row).queryAllByRole('rowheader').length > 0 &&
        within(row).queryAllByRole('cell').length > 0,
    )

/** The name of every placing on the screen, in the order they are drawn. */
const named = (table: ReturnType<typeof within>): (string | null | undefined)[] =>
  placings(table).map((row) => within(row).getAllByRole('rowheader')[0]?.textContent)

describe('a competition with more placed than fit on one page', () => {
  it('draws fifty of them and no more', async () => {
    await withCompetitors(MANY)

    renderAt(RUN)

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
    expect(screen.getByRole('button', { name: 'Sledeća' })).toHaveAttribute('aria-disabled', 'false')
  })

  it('counts the pages of the half being read, not of the whole field', async () => {
    /* **Two sources of one number, separated** (mutation, 07.09.2026). Every other case in this
       describe answers with a field of one gender, so the rows of the half and the rows of the
       whole competition are the same list, and the pager reads the same however it is written:
       `rows.length` and `table.rows.length` both say 137. A mutation that paged over the whole
       field passed every one of them.

       Here the field is mixed, so the three numbers are three: 137 in the competition, 69 men,
       68 women. The pager is of the men, and no other reading of it gives 69. */
    await withCompetitors(MANY, true)

    renderAt(RUN)
    await grid()

    const men = Math.ceil(MANY / 2)

    expect(screen.getByText(`Prikazano 1 do ${PER_PAGE} od ${men}`)).toBeVisible()
    expect(screen.queryByText(new RegExp(`od ${MANY}$`))).toBeNull()
  }, SLOW)

  it('stops at the last page of the half, not of the whole field', async () => {
    /* **The other half of the same pair of sources** (mutation, 07.09.2026). The number of rows is
       read twice on this screen: once to bound the page asked for in the address, and once to say
       how many there are. The case above measures the second; nothing measured the first, and a
       page bounded by the whole field passed it, because on page one the two bounds agree.

       They part on a page that exists for one and not for the other. Of 137 placings the men are
       69, so the men have two pages and the competition would have three: asked for the third, a
       reader bounded by the competition lands on a page with nobody on it. */
    await withCompetitors(MANY, true)

    renderAt(`${RUN}?strana=3`)

    const men = Math.ceil(MANY / 2)

    expect(placings(await grid()).length, 'the third page of the men is empty').toBeGreaterThan(0)
    expect(screen.getByText(`Prikazano ${PER_PAGE + 1} do ${men} od ${men}`)).toBeVisible()
  }, SLOW)

  it('shows the next fifty on the next page, and the rest on the last', async () => {
    await withCompetitors(MANY)

    const user = setupUser()
    const { router } = renderAt(RUN)

    const before = named(await grid())

    await user.click(screen.getByRole('button', { name: 'Sledeća' }))

    const second = named(await grid())

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
    expect(screen.getByRole('button', { name: 'Sledeća' })).toHaveAttribute('aria-disabled', 'true')
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

    const rows = named(await grid())

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(PER_PAGE)
    expect(screen.queryByRole('navigation', { name: sr.pager.leagueStanding })).toBeNull()
  })
})

describe('the head of a race column', () => {
  /* **The day, written across, and the event behind it** (owner, 07.09.2026): „treba da stoje
     datumi trka samo u redu u kojem su sad uspravni nazivi (normalno ispisani horizontalno, format
     dd.mm.) i da ti datumi na mouseover daju samo naziv događaja, a da klik vodi na stranu događaja
     u novom prozoru."

     It carried the name of the race turned on its side until then, capped and cut in two halves so
     that the name could give way and the measure never did. All of that is gone with the turning,
     and so is the guard that held the two halves against the sheet. */

  /** The events this competition is really made of, read off the same files the screen reads, so
   *  the numbers below are not a second copy of the data. An event with no race is not a column. */
  async function eventsOfIt(): Promise<BtlEvent[]> {
    const real = globalThis.fetch
    const events: BtlEvent[] = await (await real('/mock/events.json')).json()
    const races: Race[] = await (await real('/mock/races.json')).json()
    const leagues: League[] = await (await real('/mock/leagues.json')).json()
    const league = must(
      leagues.find((one) => one.slug === 'brdska-2019'),
      'takmičenje brdska-2019',
    )
    const raced = new Set(races.map((race) => race.eventId))

    return events.filter((one) => league.eventIds.includes(one.id) && raced.has(one.id))
  }

  it('is one column per event, and the day it was held', async () => {
    const held = await eventsOfIt()

    renderAt(RUN)

    const heads = (await (await grid()).findAllByRole('columnheader')).slice(2)

    /* Ten events and fourteen races: four of them share an event with another, which is exactly
       the case the owner settled on 07.09.2026 („U teoriji neko moze imati rezultate na dve trke u
       istom dogadjaju"). Counted off the files rather than written down here, or this would be a
       second home for the size of the competition. */
    expect(heads).toHaveLength(held.length)
    expect(heads.map((one) => one.textContent)).toEqual(
      [...held]
        .sort((left, right) => left.date.localeCompare(right.date) || left.name.localeCompare(right.name))
        .map((one) => formatDayMonth(one.date)),
    )
  }, SLOW)

  it('tells the pointer the event, and opens its page in a new window', async () => {
    const held = await eventsOfIt()

    renderAt(RUN)

    const heads = (await (await grid()).findAllByRole('columnheader')).slice(2)

    for (const head of heads) {
      const way = must(within(head).getByRole('link'), 'the way to the event')
      const event = must(
        held.find((one) => way.getAttribute('title') === one.name),
        `the event named ${String(way.getAttribute('title'))}`,
      )

      /* **The name on the pointer, and the same name out loud.** A `title` reaches a pointer and
         almost nothing else, and this heading is what a screen reader says over every number in
         the column under it; „12.09." on its own says nothing about which event that is. The day
         stays inside the spoken name as well, which is what SC 2.5.3 asks of a control whose
         visible words are part of it. */
      expect(way).toHaveAccessibleName(`${event.name} ${formatDayMonth(event.date)}`)
      expect(way).toHaveTextContent(formatDayMonth(event.date))

      /* **A new window, which is what was asked.** A reader is inside a standing they have
         scrolled sideways, and following a link in place would cost them that place. */
      expect(way).toHaveAttribute('href', `/sr/kalendar/${event.slug}`)
      expect(way).toHaveAttribute('target', '_blank')
      expect(way).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    }
  }, SLOW)

  it('draws two events of one day as two columns of one date, told apart by the event', async () => {
    /* Owner, 07.09.2026: „ako dva dogadjaja imaju isti datum i neko stigne da ih istrci obe,
       svakako neka bude opcija 2", and option two was the day and nothing else. This competition
       already holds such a pair, so nothing is contrived here: what is measured is that the pair
       is two columns rather than one, and that the two do not say the same thing to a reader. */
    const held = await eventsOfIt()
    const days = held.map((one) => one.date)
    const shared = must(
      days.find((day, index) => days.indexOf(day) !== index),
      'dva događaja istog dana u ovom takmičenju',
    )
    const pair = held.filter((one) => one.date === shared)

    renderAt(RUN)

    const heads = (await (await grid()).findAllByRole('columnheader')).slice(2)
    const theirs = heads.filter((one) => one.textContent === formatDayMonth(shared))

    expect(theirs).toHaveLength(pair.length)
    expect(
      new Set(theirs.map((one) => within(one).getByRole('link').getAttribute('href'))).size,
      'two events of one day open one page',
    ).toBe(pair.length)
  }, SLOW)

  it('gives an event that ran over two mornings one column, on the day of the event', async () => {
    /* A race carries its own day, because one event may run over several mornings (PDL P10), and
       while a column was a race that was the only thing telling two races of one event apart. A
       column that **is** the event has one day by definition, and it is the event's.

       Built rather than found: no event in the file holds two races on two mornings. */
    const real = globalThis.fetch
    const races: Race[] = await (await real('/mock/races.json')).json()
    const held = await eventsOfIt()
    const event = first(held)
    const mine = must(
      races.find((race) => race.eventId === event.id),
      'trka tog događaja',
    )
    const second: Race = { ...mine, id: `${mine.id}-drugo-jutro`, date: '2019-12-31' }

    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/races.json')
        ? new Response(JSON.stringify([...races, second]), { status: 200 })
        : real(input))

    renderAt(RUN)

    const heads = (await (await grid()).findAllByRole('columnheader')).slice(2)

    expect(heads, 'the second morning became a column of its own').toHaveLength(held.length)
    expect(heads.map((one) => one.textContent)).not.toContain(formatDayMonth(second.date))
  }, SLOW)
})

describe('which half of the field is being read', () => {
  it('opens on the men, and the control changes the standing to the women', async () => {
    /* Owner, 07.09.2026: „Žene ne treba da budu ispod muškaraca, nego da postoji filter gore desno
       da se biraju Muškarci ili Žene." Both blocks stood one under the other until then, which put
       a woman behind men she was never competing against unless the reader had scrolled far enough
       to meet the heading that said otherwise. */
    await withCompetitors(MANY, true)

    const user = setupUser()
    const { router } = renderAt(RUN)

    const men = named(await grid())

    await user.click(screen.getByRole('button', { name: 'Žene' }))

    const women = named(await grid())

    expect(router.state.location.search).toContain('pol=z')
    /* Nobody is in both, which is what the split is. Two lists that merely differ would also be
       given by a page that had moved on by one. */
    expect(women.filter((one) => men.includes(one))).toEqual([])
    expect(women.length).toBeGreaterThan(0)

    /* **And back**, which is not the same button pressed twice: the control writes the half into
       the address, and a control that could only ever write one of the two would leave a reader
       who chose the women with no way to the men but the browser's own back. */
    await user.click(screen.getByRole('button', { name: 'Muškarci' }))

    expect(named(await grid())).toEqual(men)
    expect(router.state.location.search).toContain('pol=m')
  }, SLOW)

  it('says which half it is drawing, out loud and in the same breath', async () => {
    /* **One reader of one fact** (review, 07.09.2026). The control and the standing both asked the
       address which half was being read, and two readers can disagree: with the control frozen to
       the men, the table drew the women and the button „Muškarci" still reported
       `aria-pressed="true"`, so a reader working by ear was told the opposite of what was on the
       screen, and the whole gate stayed green.

       The address is now read once, by the screen that draws the control, and handed down
       (`pages/LeagueDetail.tsx`). What is asked here is the thing that can no longer part: the
       button that says it is pressed, and the rows underneath it, name the same half.

       Read on an address that opens **on the women**, because the men are what both a working
       screen and a frozen one show first. */
    await withCompetitors(MANY, true)

    renderAt(`${RUN}?pol=z`)

    const women = named(await grid())

    expect(screen.getByRole('button', { name: 'Žene' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Muškarci' })).toHaveAttribute('aria-pressed', 'false')

    /* And the rows really are the women, not merely fifty of somebody: the fixture makes every
       odd-numbered member a woman, so their numbers are the odd ones. */
    expect(women.length).toBeGreaterThan(0)
    expect(
      women.filter((one) => Number((one ?? '').replace(/\D/g, '')) % 2 === 1),
      'the standing under „Žene" is not the women',
    ).toEqual([])
  }, SLOW)

  it('goes back to the first page when the half changes', async () => {
    /* Read on page two of the men, the women may have fewer pages than that, and `pageFrom` would
       land the reader on their last rather than on their first. The main standing drops the age
       category with the gender for the same reason (`pages/Rankings.tsx`). */
    await withCompetitors(MANY, true)

    const user = setupUser()
    const { router } = renderAt(RUN)

    await grid()
    await user.click(screen.getByRole('button', { name: 'Sledeća' }))
    await grid()

    expect(router.state.location.search).toContain('strana=2')

    await user.click(screen.getByRole('button', { name: 'Žene' }))
    await grid()

    expect(router.state.location.search).not.toContain('strana')
    expect(screen.getByText(/^Prikazano 1 do /)).toBeVisible()
  }, SLOW)

  it('says so plainly for a half nobody in the competition is', async () => {
    /* A competition of five men has no women in it, and a table with no rows is a table that says
       nothing rather than one that says there is nobody. */
    await withCompetitors(20)

    const user = setupUser()

    renderAt(RUN)
    await grid()

    await user.click(screen.getByRole('button', { name: 'Žene' }))

    expect(await screen.findByText(sr.leagues.noneOfThese)).toBeVisible()
    expect(screen.queryByRole('table', { name: 'Poredak takmičenja' })).toBeNull()
  }, SLOW)
})

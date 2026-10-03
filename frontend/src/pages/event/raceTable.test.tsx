import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, getNodeText, screen, within } from '@testing-library/react'
import { at, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { everyRule } from '../../test/stylesheet'

/**
 * The table of races on an event, as markup: what is written into it, and what the
 * sheet reads off it.
 *
 * Where it lands is a browser's question and `pages/eventTableStyle.test.ts` holds what the
 * sheet says about it (ADL A18). What a stylesheet can only ask of the markup is asked
 * here, and every one of those questions is about a NAME: the class a cell wears is how a
 * column is given its width and its side, and a cell under the wrong one is drawn in the
 * wrong column of a table that reads as correct.
 *
 * Owner, 03.10.2026: one markup, a block per race on a telephone and a table from the
 * wide layout up (`pages/Profile.css`).
 */

const PROFILE = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')

/** An event of one morning, with four races. */
const ONE_DAY = '/sr/kalendar/maraton-maratona-2015'
/** A weekend: two races on the Friday and two on the Saturday after it. */
const TWO_DAYS = '/sr/kalendar/balkansko-prvenstvo-veterana-2021'
/** Somebody who ran the first of them. */
const MEMBER = '000007'
/** Twelve races of one morning, which is what tells „more than one race" from „more than one morning". */
const TWELVE_RACES = '/sr/kalendar/btl-dezorijentiring-2018'
/** Four mornings, a race on each of them. */
const FOUR_MORNINGS = '/sr/kalendar/danube-maraton-2022-03'

const DAY = 'event-races__day'
const WAY_IN = 'event-races__way-in'

/** Everybody the table is drawn for, and what each of them is shown. The weekend is read on the Friday
 *  evening, so the way in is a column and two of its four cells are empty. */
const READINGS = [
  ['a visitor to an event of one morning', ONE_DAY, 'visitor', null, null],
  ['a member at an event of one morning', ONE_DAY, 'competitor', MEMBER, null],
  ['a visitor to a weekend', TWO_DAYS, 'visitor', null, null],
  ['a member at a weekend, the Friday run and the Saturday not', TWO_DAYS, 'competitor', MEMBER, '2021-09-17'],
] as const

async function openTable(
  where: string,
  role: 'visitor' | 'competitor',
  member: string | null,
  today: string | null,
): Promise<HTMLElement> {
  renderAt(where, role, member, undefined, today)

  return screen.findByRole('table', { name: 'Trke' })
}

/** The rows of the body, which is every row but the one of headings. */
const raceRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1)

/** What each column is headed by. */
const headings = (table: HTMLElement) =>
  within(table)
    .getAllByRole('columnheader')
    .map((one) => one.textContent)

/** What a column says in each race, by what it is headed by: the text the cell has of its own. */
const columnOf = (table: HTMLElement, heading: string) =>
  raceRows(table).map((row) =>
    getNodeText(at(within(row).getAllByRole('cell'), headings(table).indexOf(heading))),
  )

describe('the table of races on an event, as it is written', () => {
  it.each(READINGS)(
    'gives a heading and every cell under it one class, for %s',
    async (_who, where, role, member, today) => {
      const table = await openTable(where, role, member, today)
      const heads = within(table).getAllByRole('columnheader')
      const classes = heads.map((one) => one.className)

      /* The sheet gives a column its width and its side by that class, on the heading and on every cell
         under it alike, so a cell under another one is drawn in the wrong column. Two headings under one
         class would have the sheet size them as one. */
      expect(new Set(classes).size, 'two headings wear one class').toBe(classes.length)

      const rows = raceRows(table)

      expect(rows.length, 'a table with no race in it measures nothing').toBeGreaterThan(1)

      for (const row of rows) {
        expect(
          within(row)
            .getAllByRole('cell')
            .map((one) => one.className),
          'a cell wears the class of another column',
        ).toEqual(classes)
      }

      /* And the two columns the sheet asks the table about (`:has`), which is the only place „is there
         one" is written: it is the cell. A day column that is drawn without its class is a column the
         sheet gives no width, and one that wears the class without the heading is a width for nothing. */
      expect(classes.includes(DAY), 'the day column and its class disagree').toBe(
        heads.some((one) => one.textContent === 'Dan'),
      )
      expect(classes.includes(WAY_IN), 'the way in and its class disagree').toBe(
        heads.some((one) => one.textContent === 'Opcije'),
      )
    },
    SLOW,
  )

  it('draws the day as a column of the day each race is run, and only on an event of more than one morning', async () => {
    /* Owner, 10.08.2026: „A column of one repeated date under a heading that already says the day is a
       column that says nothing". Two readings that tell „more than one race" from „more than one
       morning": twelve races of one morning draw no day, and a weekend of four races on two mornings
       draws it. A count of the races in place of a count of the mornings fails the first.

       And the day is the race's and not the event's: the event of a weekend is dated on its first
       morning, so a column that read the day off the event would write the Friday on all four rows. */
    expect(headings(await openTable(TWELVE_RACES, 'visitor', null, null))).toEqual(['Trka', 'Mera', 'Uspon', 'Spust'])
    cleanup()

    const weekend = await openTable(TWO_DAYS, 'visitor', null, null)

    expect(headings(weekend)).toEqual(['Trka', 'Dan', 'Mera', 'Uspon', 'Spust'])
    expect(columnOf(weekend, 'Dan')).toEqual(['17. 9. 2021.', '17. 9. 2021.', '18. 9. 2021.', '18. 9. 2021.'])
    cleanup()

    const four = await openTable(FOUR_MORNINGS, 'visitor', null, null)

    expect(columnOf(four, 'Dan')).toEqual(['14. 3. 2022.', '15. 3. 2022.', '16. 3. 2022.', '17. 3. 2022.'])
  }, SLOW)

  it('puts over every figure the word that heads its column, and first', async () => {
    const table = await openTable(ONE_DAY, 'visitor', null, null)
    const heads = within(table)
      .getAllByRole('columnheader')
      .map((one) => one.textContent)

    expect(heads, 'the heads this case is written around').toEqual(['Trka', 'Mera', 'Uspon', 'Spust'])

    for (const row of raceRows(table)) {
      const cells = within(row).getAllByRole('cell')

      /* The three figures, each with the word of its own column and not of a neighbour: found by the
         word the HEAD of that column says, so a climb under the word for the fall fails here. */
      for (const index of [1, 2, 3]) {
        const cell = at(cells, index)
        const word = within(cell).getByText(at(heads, index))

        expect(cell.firstChild, 'the word stands after the figure and not over it').toBe(word)
        /* Not hidden from a reader: on a telephone, where the head is not drawn, it is the only name
           the figure has (`pages/EventDetail.tsx`). */
        expect(word, 'the only name a figure has on a telephone is hidden from it').not.toHaveAttribute(
          'aria-hidden',
        )
        expect(getNodeText(cell), 'a figure with nothing after its word').not.toBe('')
      }

      /* The name carries no word of its own: it is what the block is about and not one of three figures. */
      expect(at(cells, 0).childElementCount, 'the name has a word over it').toBe(0)
    }
  }, SLOW)

  it.each(READINGS)('hides no figure from a telephone, for %s', async (_who, where, role, member, today) => {
    const table = await openTable(where, role, member, today)

    /* It carried `table__hide-phone` on the climb and the fall until 03.10.2026, which is the class that
       takes a column off the screen under 700px (`styles/table.css`). The owner asked for three figures
       under the name on a telephone, so none of them is hidden by it. */
    const hidden = [...table.querySelectorAll('*')].filter((one) => one.classList.contains('table__hide-phone'))

    expect(hidden, 'something in the table is taken off a telephone').toEqual([])
  }, SLOW)

  it('carries no count of its own columns, which the sheet reads off the cells', async () => {
    const table = await openTable(TWO_DAYS, 'competitor', MEMBER, '2021-09-17')

    /* A number written on the element beside the headings it counted was the other home of „how many
       columns", measured disagreeing on 23.08.2026: five columns drawn in the width of four. */
    expect(table, 'the table is sized from a count it carries').not.toHaveAttribute('style')
  }, SLOW)

  it('draws an empty cell for the way in of a race that has not been run, because the sheet gives an empty one no room', async () => {
    const table = await openTable(TWO_DAYS, 'competitor', MEMBER, '2021-09-17')
    const ways = raceRows(table).map((row) => at(within(row).getAllByRole('cell'), 5))

    /* Two races on the Friday, which is today, and two on the Saturday after it. */
    expect(ways.map((one) => within(one).queryByRole('link') !== null)).toEqual([true, true, false, false])

    for (const empty of ways.filter((one) => within(one).queryByRole('link') === null)) {
      /* Nothing in it at all, not a space and not a word: `:empty` is what takes the cell out of the
         row of a block, and a blank text node keeps it there (`pages/Profile.css`). */
      expect(empty).toBeEmptyDOMElement()
    }
  }, SLOW)

  it('stands in a box that is a container, which is what the widths are shares of', async () => {
    const table = await openTable(ONE_DAY, 'visitor', null, null)
    const written = everyRule(PROFILE, 'Profile.css')
    const boxes: Element[] = []

    /* Walked up from the table and asked of the rules, not of a name: a `cqi` with no container above it
       is not an error but a share of the WINDOW, so the widths would be drawn and be wrong, and jsdom
       lays nothing out and sees no difference (`rankingsLayout.test.tsx` asks the same of the circle).
       `inline-size` and nothing else: `size` contains the height as well, and a table's box has none
       of its own to give.

       The NEAREST one is what a `cqi` is a share of, so it is the nearest that has to be the box right
       around the table. Another container further up is harmless and is not asked about; one standing
       between the table and its box would be the box the widths are measured against, and the first
       of them is what this finds. */
    for (let up = table.parentElement; up !== null; up = up.parentElement) {
      const candidate = up

      if (
        written.some(
          (rule) =>
            rule.style.getPropertyValue('container-type') === 'inline-size' && candidate.matches(rule.selectorText),
        )
      ) {
        boxes.push(candidate)
      }
    }

    expect(boxes.length, 'no box above the table is a container').toBeGreaterThan(0)
    expect(boxes[0], 'the nearest container is not the box right around the table').toBe(
      must(table.parentElement, 'the box around the table'),
    )
  }, SLOW)

  it('writes every name the sheet selects, and selects every name it writes', async () => {
    /* A class is written in markup and selected in a sheet, and it takes both ends to do anything; a name
       with one end is dead or broken, and which of the two hardly matters (`styles/hooks.test.ts`, which
       says the same of the ducats). The fullest reading, so the day and the way in are both there. */
    const table = await openTable(TWO_DAYS, 'competitor', MEMBER, '2021-09-17')
    const named = /event-races(?:__[a-z-]+)?/g
    const selected = new Set(
      everyRule(PROFILE, 'Profile.css').flatMap((rule) => rule.selectorText.match(named) ?? []),
    )
    const written = new Set(
      [table.parentElement, ...table.querySelectorAll('*')].flatMap((one) => [...(one?.classList ?? [])]).filter(
        (one) => one.startsWith('event-races'),
      ),
    )

    expect(written.size, 'the table writes no name of this family').toBeGreaterThan(5)
    expect([...written].filter((one) => !selected.has(one)), 'written and never selected').toEqual([])
    expect([...selected].filter((one) => !written.has(one)), 'selected and never written').toEqual([])
  }, SLOW)
})

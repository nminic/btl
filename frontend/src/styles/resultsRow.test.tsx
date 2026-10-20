import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configure, screen, within } from '@testing-library/react'
import { must } from '../test/at'
import { moderatorWith, renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { ruleFor, unconditionalRules } from '../test/stylesheet'

/**
 * THE ROW OF A MEMBER'S RESULT ON THE PAGE OF AN EVENT: WHAT PUTS EVERY CELL OF IT ON ONE CENTRE, HELD
 * WHERE IT IS DECIDED.
 *
 * Owner, 20.10.2026, from a screenshot of QA: „Red sa rezultatom člana nije centriran, ikonice su niže
 * nego vrednosti u redu". For whoever checks results the last cell of every row of „Rezultati članova"
 * holds the pencil and the x, and `styles/table.css` puts every cell of a table at the TOP of its row,
 * so the words stood high and the buttons, the taller thing, stood lower.
 *
 * **jsdom lays nothing out and applies no stylesheet (ADL A18), so this file cannot say where a button
 * stands, and does not pretend to.** That is asked of Chrome in `geometry/resultsRow.geometry.ts`, which
 * measured the centre of every cell of every row at 360, 768 and 1280px: before, the worst row had its
 * words and its buttons 52,09px apart at 360 and at 768 and 7,70px apart at 1280; after, 0,90px apart at
 * all three, and no width moves the page sideways. What this file holds is the two halves that
 * measurement stands on and that a browser run cannot tell apart from a coincidence of widths:
 *
 * - **the rule is written** in the sheet of the event page, for exactly the selector that reaches the
 *   cells of the BODY (the head is not a row of results and stays where the shared rule puts it), and
 *   nothing in it holds the pair of buttons on one line (PDL P24);
 * - **the table they are written for is the table the page draws**, asked of the rendered tree with
 *   `matches`, so a class taken off the markup, or a rule moved onto the head, fails here although every
 *   word of the sheet is still in place.
 *
 * **The shared default is held beside them** (the precedent of `pages/rankingsMemberRow.test.ts`):
 * reading that this table centres its own cells says nothing unless every other table is still at the
 * top, or a change here could just as easily have been a change there.
 */

configure({ asyncUtilTimeout: SLOW / 2 })

const PROFILE = readFileSync(join(process.cwd(), 'src/pages/Profile.css'), 'utf-8')
const SHARED = readFileSync(join(process.cwd(), 'src/styles/table.css'), 'utf-8')

/** An event with many results, and a moderator who checks them. */
const WITH_RESULTS = 'mrazijada-2020'
const CHECKS_RESULTS = moderatorWith(['queue:results'])

describe('the sheet of the event page', () => {
  it('centres every cell of the body of the table of results, and not the head', () => {
    /* „Red sa rezultatom člana nije centriran." The BODY, so the selector reaches `td` of `tbody`
       itself rather than one class among several: the name, the category, the figures and the points
       carry no class of their own here and would be invisible to a rule that asked for one. */
    expect(ruleFor(PROFILE, '.table--results tbody td', 'Profile.css').getPropertyValue('vertical-align')).toBe(
      'middle',
    )

    /* And no second rule for the head: the head cells keep the shared „top", one line of words each. */
    expect(
      unconditionalRules(PROFILE, 'Profile.css').filter(
        (rule) => /\.table--results/.test(rule.selectorText) && /\bth\b|thead/.test(rule.selectorText),
      ),
    ).toEqual([])
  })

  it('does not hold the pencil and the x on one line, so the question of the x has room and the table does not scroll', () => {
    /* PDL P24, „Tabele na telefonu nemaju horizontalni skrol". The box wraps (`pages/admin/Entity.css`)
       and has to: the question the x opens puts two more buttons in it. Measured in Chrome in PR 586,
       with `flex-wrap: nowrap` on it the table's own box was 345 inside 328 at 360px with long names,
       491 inside 347 with the question open, and 851 inside 736 at 768px. Held two ways, because either
       alone is a coincidence of one sheet: the shared rule still wraps, and no rule written for this
       table says otherwise. */
    const entity = readFileSync(join(process.cwd(), 'src/pages/admin/Entity.css'), 'utf-8')

    expect(ruleFor(entity, '.entity-row-actions', 'Entity.css').getPropertyValue('flex-wrap')).toBe('wrap')
    expect(
      unconditionalRules(PROFILE, 'Profile.css').filter(
        (rule) => /\.table--results/.test(rule.selectorText) && rule.style.getPropertyValue('flex-wrap') !== '',
      ),
    ).toEqual([])
  })

  it('leaves every other table at the top of its row', () => {
    const shared = unconditionalRules(SHARED, 'table.css').filter((rule) => {
      const parts = rule.selectorText.split(',').map((one) => one.trim())

      return parts.length === 2 && parts.includes('.table th') && parts.includes('.table td')
    })

    expect(shared).toHaveLength(1)
    expect(must(shared[0], 'the shared rule').style.getPropertyValue('vertical-align')).toBe('top')
  })
})

describe('the table of results on the page of an event', () => {
  it('is the table those rules are written for, in every cell of its body and none of its head', async () => {
    renderAt(`/sr/kalendar/${WITH_RESULTS}`, 'moderator', null, CHECKS_RESULTS)

    const table = await screen.findByRole('table', { name: 'Rezultati članova' })
    const cells = [...table.querySelectorAll('tbody td')]

    /* Every cell of every row, the last one (the buttons) among them. */
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.every((cell) => cell.matches('.table--results tbody td'))).toBe(true)
    expect(within(table).getAllByRole('link', { name: /^Izmeni rezultat: / }).length).toBeGreaterThan(0)

    expect([...table.querySelectorAll('thead th')].some((cell) => cell.matches('.table--results tbody td'))).toBe(false)

  }, SLOW)

  it('is not the table of races above it', async () => {
    renderAt(`/sr/kalendar/${WITH_RESULTS}`, 'moderator', null, CHECKS_RESULTS)

    const races = await screen.findByRole('table', { name: 'Trke' })

    expect(races.matches('.table--results')).toBe(false)
  }, SLOW)
})

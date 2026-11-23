import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE BOX OF A MEMBER ON A ROW OF RESULTS OPENS ITS LIST OVER THE BOXES BELOW AND MOVES NONE OF THEM, ASKED OF
 * CHROME (owner, 23.11.2026, PDL „Tri brze izmene administracije": „Spisak predloga se otvara preko sadržaja
 * ispod, ne gura ga nadole."; ADL A63).
 *
 * <p>jsdom lays nothing out, so `pages/event/memberChoice.test.tsx` holds the combobox by role and key and this
 * holds where it LANDS: at a telephone, a tablet in portrait and a desktop, and at 200% text, with the list open,
 * <b>the first box of figures under it stands exactly where it stood with the list shut</b>, <b>the list stands
 * over that box</b> (it starts below the member's box and reaches past the top of the figures), <b>the list is
 * inside the viewport</b>, and <b>the page does not move sideways</b> (PDL P24).
 *
 * <p><b>The mutation that fells it</b> is the list put back in the flow (`position: static`, what
 * `forms/Suggesting.css` and `.place__list` on a telephone do): the figures then move down by the list's height.
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers (the shape `raceInMotion.geometry.ts` reads it in). */
function everyAnswer(dir = MOCK, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(
    readdirSync(dir, { withFileTypes: true }).flatMap((entry): [string, unknown][] => {
      const at = join(dir, entry.name)

      if (entry.isDirectory()) {
        return Object.entries(everyAnswer(at, `${prefix}${entry.name}/`))
      }

      return entry.name.endsWith('.json')
        ? [[`/api/${prefix}${entry.name.slice(0, -'.json'.length)}`, JSON.parse(readFileSync(at, 'utf-8'))]]
        : []
    }),
  )
}

const SAMPLE = everyAnswer()

/** The event the vitest cases of this screen are written around (`pages/event/leagueResults.test.tsx`), and its
 *  last race, which is one of a length and so draws three figures beside the member. */
const EVENT = 'maraton-maratona-2015'

function theRace(): number {
  const events = SAMPLE['/api/events']
  const races = SAMPLE['/api/races']

  if (!Array.isArray(events) || !Array.isArray(races)) {
    throw notMeasured('the sample carries no events or no races')
  }

  const event: unknown = events.find((one: unknown) => Reflect.get(Object(one), 'slug') === EVENT)
  const id: unknown = Reflect.get(Object(event), 'id')
  const own = races.filter((one: unknown) => Reflect.get(Object(one), 'eventId') === id)
  const race: unknown = Reflect.get(Object(own.at(-1)), 'id')

  if (typeof race !== 'number') {
    throw notMeasured(`the sample has no race of ${EVENT}`)
  }

  return race
}

const ANSWERS: Answers = { ...SAMPLE, '/api/me': { role: 'superadmin', account: 41, membershipBasis: null } }

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  /* Shorter than the harness's default, so the page is taller than the window and a desktop draws the scrollbar
     every reader's has (`support/harness.ts`). */
  { width: 1280, text: 100, height: 600 },
  { width: 1280, text: 200 },
]

const BOX = '#league-row-1-member'
/* The list the box controls, by its own id: the header carries listboxes of its own. */
const LIST = `${BOX}-list`

for (const at of WIDTHS) {
  test(`the list of members opens over the figures and moves none of them, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, `/sr/kalendar/${EVENT}/rezultati?trka=${String(theRace())}`, BOX, ANSWERS)

    /* The first box after the member's in the document: the first figure of the row. */
    const figureTop = () =>
      page.evaluate((selector) => {
        const boxes = [...document.querySelectorAll('form input')]
        const member = document.querySelector(selector)
        const next = member === null ? undefined : boxes[boxes.indexOf(member) + 1]

        return next === undefined ? null : next.getBoundingClientRect().top
      }, BOX)

    const shut = await figureTop()

    if (shut === null) {
      throw notMeasured('the row drew no box after the member')
    }

    await page.locator(BOX).fill('Re')
    await page.locator(LIST).waitFor({ state: 'visible' })

    const measured = await page.evaluate(
      ({ box, listed }) => {
        const list = document.querySelector(listed)?.getBoundingClientRect()
        const member = document.querySelector(box)?.getBoundingClientRect()

        return list === undefined || member === undefined
          ? null
          : { top: list.top, bottom: list.bottom, left: list.left, right: list.right, memberBottom: member.bottom }
      },
      { box: BOX, listed: LIST },
    )
    const viewport = await page.evaluate(() => document.documentElement.clientWidth)
    const opened = await figureTop()

    if (measured === null || opened === null) {
      throw notMeasured('the list or the member box was not drawn')
    }

    expect(opened, 'the figures under the box moved while the list was open').toBeCloseTo(shut, 0)
    expect(measured.top, 'the list starts above the bottom of the member box').toBeGreaterThanOrEqual(
      measured.memberBottom - SLACK,
    )
    expect(measured.bottom, 'the list does not reach over the figures below').toBeGreaterThan(opened)
    expect(measured.left, 'the list starts inside the page').toBeGreaterThanOrEqual(-SLACK)
    expect(measured.right, 'the list ends inside the page').toBeLessThanOrEqual(viewport + SLACK)
    expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
    expect(probe.sideways, 'the page scrolls sideways').toBe(0)
  })
}

/* EVERY MEMBER, IN A LIST THAT SCROLLS INSIDE ITSELF AND STAYS IN THE WINDOW (owner, 23.11.2026, after PR 800:
   „Ovde nema dropdown-a, gde si ti zapravo uradio izmenu????”; recorded under the decision: „klik ili strelica
   dole otvaraju spisak SVIH članova koji se mogu izabrati, spisak se skroluje unutar sebe”). A press on the ARROW,
   the right end of the box and not its middle, opens the list on every member the route answers with; the list
   is shorter than they are and scrolls; it ends inside the window; and nothing under it moved. The mutations that
   fell it: the list given back its two letters or its eight, and the list let grow past the window
   (`max-block-size` taken away). */
const RUNNERS = SAMPLE['/api/results/runners']

for (const at of WIDTHS) {
  test(`a press on the arrow opens every member in a list that scrolls and stays in the window, ${label(at)}`, async ({ open }) => {
    if (!Array.isArray(RUNNERS) || RUNNERS.length < 20) {
      throw notMeasured('the sample has too few runners for a list longer than its room')
    }

    const { page, probe } = await open(at, `/sr/kalendar/${EVENT}/rezultati?trka=${String(theRace())}`, BOX, ANSWERS)
    const box = page.locator(BOX)
    const size = await box.boundingBox()

    if (size === null) {
      throw notMeasured('the member box was not drawn')
    }

    const nextTop = () =>
      page.evaluate((selector) => {
        const boxes = [...document.querySelectorAll('form input')]
        const member = document.querySelector(selector)
        const next = member === null ? undefined : boxes[boxes.indexOf(member) + 1]

        return next === undefined ? null : next.getBoundingClientRect().top
      }, BOX)
    const shut = await nextTop()

    /* Where the arrow is painted: 8px in from the right edge, in a box 18px wide, so its middle is 17px in. */
    await box.click({ position: { x: size.width - 17, y: size.height / 2 } })
    /* A short wait of its own, so a press that opens nothing fails here, by this sentence, and not by the clock of
       the case (`CLAUDE.md`, 25). */
    await expect(page.locator(LIST), 'a press on the arrow opened no list').toBeVisible({ timeout: 3_000 })

    const list = await page.evaluate((listed) => {
      const one = document.querySelector(listed)

      return one === null
        ? null
        : {
            rows: one.querySelectorAll('[role="option"]').length,
            scrolls: one.scrollHeight > one.clientHeight,
            top: one.getBoundingClientRect().top,
            bottom: one.getBoundingClientRect().bottom,
            viewport: window.innerHeight,
          }
    }, LIST)

    if (list === null || shut === null) {
      throw notMeasured('the list or the box after the member was not drawn')
    }

    expect(await box.getAttribute('aria-expanded')).toBe('true')
    expect(list.rows, 'the list is not every member the route answers with').toBe(RUNNERS.length)
    expect(list.scrolls, 'a list of every member does not scroll inside itself').toBe(true)
    expect(list.top, 'the list starts above the window').toBeGreaterThanOrEqual(0)
    expect(list.bottom, 'the list runs out of the window').toBeLessThanOrEqual(list.viewport)
    expect(await nextTop(), 'the figures under the box moved while the list was open').toBeCloseTo(shut, 0)
    expect(probe.sideways, 'the page scrolls sideways').toBe(0)

    /* Walked to its last row with the keys, the list has scrolled to show it. */
    await page.keyboard.press('ArrowUp')

    const last = await page.evaluate((listed) => {
      const one = document.querySelector(listed)
      const row = one?.querySelector('[role="option"]:last-child')

      return one === null || row === null || row === undefined
        ? null
        : { list: one.getBoundingClientRect(), row: row.getBoundingClientRect() }
    }, LIST)

    if (last === null) {
      throw notMeasured('the last row was not drawn')
    }

    expect(last.row.bottom, 'the row walked to is under the edge of the list').toBeLessThanOrEqual(last.list.bottom + SLACK)
    expect(last.row.top, 'the row walked to is above the edge of the list').toBeGreaterThanOrEqual(last.list.top - SLACK)
  })
}

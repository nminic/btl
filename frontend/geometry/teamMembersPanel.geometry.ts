import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE LIST OF MEMBERS OF A TEAM'S PANEL OPENS WHOLE, AND NEITHER THE TABLE NOR THE PAGE GAINS A SCROLL BAR FOR IT (owner,
 * 23.11.2026, PDL „Izbor člana u panelu „Članovi" tima": „Em se ne vidi lista clanova u dropdown, em se pojavljuje
 * scroll bar. Nema potrebe uopšte da dropdown bude ovoliko širok, može da bude mnogo uži. Na telefonu može jedan
 * red dropdown, a drugi dugme, ali na kompu sve ovo može mnogo uže i bez scrollbara."; ADL A63).
 *
 * <p>The panel of a team stands in a row of a table inside `.table-scroll`, which clips (`overflow-x: auto` makes the
 * vertical overflow clip too). A list that is `absolute` inside its box was cut to the height of the row, and the
 * table grew a scroll bar beside it. Asked of Chrome, **with the list open**, on a telephone, a tablet and a desktop,
 * and **in the two places the list was cut**: a table with ONE team, and the LAST row of a table with
 * several. What is held:
 *
 * - the list is whole in the window (`top >= 0`, `bottom <= the window`, inside it sideways);
 * - **nothing clips it**: the element at the middle of each row it shows is that row
 *   (`elementFromPoint`), which no clipping ancestor lets pass, whatever its overflow says;
 * - neither the table's frame nor the page has a scroll bar the open list caused (`scrollHeight`, `scrollWidth`);
 * - **on a desktop and a tablet the box is narrow and the button stands at its side**: the box is not wider than the
 *   longest name it offers needs (no row of the list is cut with an ellipsis), the button starts where the box ends
 *   (a gap of the portal's, not a column), on the same line; **on a telephone the box is one line and the button is
 *   under it**.
 *
 * <p><b>The mutations that fell it:</b> the list `position: absolute` again (what `MemberChoice.css` had: the rows
 * are no longer the element at their point, in the table of one team), and the box without `fitted`
 * (`.member-choice--fitted`: the box takes the whole row and the button stands at the far end of it).
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers (the shape `memberChoice.geometry.ts` reads it in). */
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
const ADMINISTRATION: Answers = { ...SAMPLE, '/api/me': { role: 'superadmin', account: 41, membershipBasis: null } }

const teams = SAMPLE['/api/teams']

if (!Array.isArray(teams) || teams.length < 2) {
  throw notMeasured('the sample carries fewer than two teams, so there is no last row')
}

/** A table with one team only: the row the panel opens in is the whole table. */
const ONE_TEAM: Answers = { ...ADMINISTRATION, '/api/teams': [teams[0]] }

/** Names so short that the box and the button would stand side by side in the row of a telephone if nothing said they
 *  must not (the longest name of the sample is long enough to fill the row by itself, so it cannot tell). */
const SHORT_NAMES: Answers = {
  ...ADMINISTRATION,
  '/api/competitors': Array.isArray(SAMPLE['/api/competitors'])
    ? SAMPLE['/api/competitors'].map((one: unknown) =>
        Reflect.get(Object(one), 'teamId') === null ? { ...Object(one), firstName: 'Ana', lastName: 'Li' } : one,
      )
    : [],
}

const SIZES: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100, height: 600 },
]

/** A telephone with the text enlarged (WCAG 2.2 SC 1.4.4): at 150 % and 200 % a name is wider than the window, so the
 *  rows go on to a second line and the box is read by scrolling the table (review of PR 813, high: a ceiling of
 *  `100vw - 4.5rem` was 216px at 200 % on 360px and cut every row and the chosen name). One theme, which is all this
 *  question depends on. */
const LARGE_TEXT: At[] = [
  { width: 360, text: 150 },
  { width: 360, text: 200 },
  { width: 390, text: 200 },
  { width: 412, text: 200 },
]

const AT: At[] = SIZES

for (const [which, answers, pick, phoneOnly] of [
  ['the table of one team', ONE_TEAM, 'first', false],
  ['the last row of a table', ADMINISTRATION, 'last', false],
  ['short names', SHORT_NAMES, 'first', true],
] as const) {
  for (const at of phoneOnly ? AT.filter((one) => one.width < 768) : [...AT, ...LARGE_TEXT]) {
    test(`the list of members of a team opens whole and no scroll bar comes of it, ${which}, ${label(at)}`, async ({
      open,
    }) => {
      const { page } = await open(at, '/sr/administracija/timovi', '.entity-open', answers)

      const openers = page.locator('.entity-open[aria-controls$="-members"]')
      const opener = pick === 'first' ? openers.first() : openers.last()
      const rowId = await opener.getAttribute('aria-controls')
      const team = /^team-(\d+)-members$/.exec(rowId ?? '')?.[1]

      if (team === undefined) {
        throw notMeasured('the button that opens the panel names no team')
      }

      await opener.click()

      const box = page.locator(`#team-${team}-member`)
      /* What the table scrolls sideways by itself, with the panel open and the list shut: a wide table scrolls inside
         its own frame on a telephone, by design (`styles/table.css`), and what is asked is what the LIST adds. */
      const before = await box.evaluate((one) => {
        const frame = one.closest('.table-scroll')

        return {
          frame: frame === null ? Number.NaN : frame.scrollWidth - frame.clientWidth,
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      const frameWideBefore = before.frame

      /* The panel itself, with the list shut, does not make the page scroll sideways (PR 810, „bočno klizanje sa
         otvorenim panelom članova na 768 px nije mereno"). */
      expect(before.page, 'the open panel makes the page scroll sideways').toBeLessThanOrEqual(0)

      /* **THE BOX AND ITS WHOLE ARROW STAND INSIDE THE VISIBLE PART OF THE FRAME OF THE TABLE**, asked before anything
         is pressed in the panel (review of PR 813, high; owner's decision, PDL „Na telefonu polje nikad nije šire od
         vidljivog okvira tabele”). The frame scrolls the wide table inside itself and clips what is past it, so a box
         that runs out of it has no arrow to be seen and a focus ring that is cut. The right edge of the box, with the
         ring's room, is not past where the frame shows (`left + clientWidth`), at every text size. */
      const standing = await box.evaluate((one) => {
        const frame = one.closest('.table-scroll')

        if (frame === null) {
          return null
        }

        const framed = frame.getBoundingClientRect()
        const inside = one.getBoundingClientRect()

        /* `--space-8`, the padding of a cell, as the browser resolves it at this text size. */
        const probe = document.createElement('div')

        probe.style.inlineSize = 'var(--space-8)'
        probe.style.position = 'absolute'
        document.body.append(probe)

        const pad = probe.getBoundingClientRect().width

        probe.remove()

        return {
          shownRight: framed.left + frame.clientWidth,
          shownLeft: framed.left,
          left: inside.left,
          right: inside.right,
          pad,
        }
      })

      if (standing === null) {
        throw notMeasured('the box stands in no frame of a table')
      }

      expect(standing.right + 4, 'the box and its arrow run out of the visible frame of the table').toBeLessThanOrEqual(
        standing.shownRight,
      )
      expect(standing.left, 'the box starts before the visible frame of the table').toBeGreaterThanOrEqual(standing.shownLeft)

      if (at.width < 768 && !phoneOnly) {
        /* AND IT TAKES WHAT THE FRAME SHOWS where the names are wider than that (every one of these: 360px at 100 %
           is already narrower than the longest name, and the larger text only more): not narrower than the frame by
           more than the cell's padding at both ends and the room of the ring. A ceiling in a unit that grows with
           the text (`100vw - 4.5rem`) leaves the box well short of it, and cuts the name for nothing. */
        expect(
          standing.shownRight - standing.right,
          'the box stops well short of what the frame shows, so the names are cut for nothing',
        ).toBeLessThanOrEqual(standing.pad * 2)
      }

      /* From the first character the box offers every member whose label holds it, and every label holds a nought. */
      await box.fill('0')
      await page.locator(`#team-${team}-member-list`).waitFor({ state: 'visible' })
      /* What a reader does where the box is near the foot of the window: scrolls to the list. The page has to be
         long enough to let him, which is what a list that is part of the document gives (`MemberChoice.tsx`). */
      await page.locator(`#team-${team}-member-list`).evaluate((list) => list.scrollIntoView({ block: 'nearest' }))

      const seen = await page.evaluate((id) => {
        const list = document.getElementById(`${id}-list`)
        const input = document.getElementById(id)
        const button = input?.closest('.leagues__adding')?.querySelector('button.button')
        const frame = input?.closest('.table-scroll')

        if (list === null || input === null || button === null || button === undefined || frame === null || frame === undefined) {
          return null
        }

        const rows = [...list.children]
        const middle = (row: Element) => {
          const found = row.getBoundingClientRect()
          const point = document.elementFromPoint(found.left + found.width / 2, found.top + found.height / 2)

          return point !== null && row.contains(point)
        }
        const inside = list.getBoundingClientRect()
        const field = input.getBoundingClientRect()
        const next = button.getBoundingClientRect()
        /* The rows the list shows without being scrolled inside itself: it scrolls inside itself past twenty rem, on
           purpose, and a row it keeps out of sight is not one that something covers. */
        const shown = rows.filter((row) => row.getBoundingClientRect().bottom <= inside.bottom + 0.5)

        return {
          rows: rows.length,
          top: inside.top,
          bottom: inside.bottom,
          left: inside.left,
          right: inside.right,
          window: window.innerHeight,
          across: document.documentElement.clientWidth,
          shown: shown.length,
          unreached: shown.filter((row) => !middle(row)).length,
          frameTall: frame.scrollHeight - frame.clientHeight,
          frameWide: frame.scrollWidth - frame.clientWidth,
          pageWide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          cut: rows.filter((one) => one.scrollWidth - one.clientWidth > 0.5).length,
          cutBy: Math.max(0, ...rows.map((one) => one.scrollWidth - one.clientWidth)),
          field: { left: field.left, right: field.right, top: field.top, bottom: field.bottom },
          button: { left: next.left, top: next.top, bottom: next.bottom },
          cell: input.closest('td')?.getBoundingClientRect().width ?? Number.NaN,
        }
      }, `team-${team}-member`)

      if (seen === null) {
        throw notMeasured('the panel, its list or its button was not drawn')
      }

      expect(seen.rows, 'the list offers the members of no team').toBeGreaterThan(1)
      expect(seen.top, 'the list starts inside the window').toBeGreaterThanOrEqual(-SLACK)
      expect(seen.bottom, 'the list ends inside the window').toBeLessThanOrEqual(seen.window + SLACK)
      expect(seen.left, 'the list starts inside the page').toBeGreaterThanOrEqual(-SLACK)
      expect(seen.right, 'the list ends inside the page').toBeLessThanOrEqual(seen.across + SLACK)
      /* At 100 % a few rows. At 150 % and 200 % a name takes two or three lines in a list no wider than the frame, and
         the list the window leaves under the box (`roomFor`, 144px at the least, in pixels) may show none of them
         whole: it scrolls inside itself, and the rows reached are asked about below. */
      if (at.text === 100) {
        expect(seen.shown, 'the list shows no more than a row or two').toBeGreaterThan(2)
      }
      expect(seen.unreached, 'rows of the list that something covers or cuts').toBe(0)
      expect(seen.frameTall, 'the table gained a vertical scroll bar').toBeLessThanOrEqual(1)
      expect(seen.frameWide, 'the list made the table scroll sideways further').toBeLessThanOrEqual(frameWideBefore + 1)
      expect(seen.pageWide, 'the page scrolls sideways').toBeLessThanOrEqual(0)

      /* No row is cut, at any width and any text size: a name that does not fit goes on to a second line. */
      expect(seen.cut, `a name is cut (by ${String(seen.cutBy)}px), the box is narrower than the longest`).toBe(0)

      if (at.width >= 768) {
        /* A desktop and a tablet: the box is as wide as its longest name and no wider, and the button is at its side. */
        expect(seen.field.right - seen.field.left, 'the box takes the whole row').toBeLessThan(seen.cell * 0.6)
        expect(seen.button.left, 'the button starts before the box ends').toBeGreaterThanOrEqual(seen.field.right - SLACK)
        expect(seen.button.left - seen.field.right, 'the button is not at the side of the box').toBeLessThanOrEqual(40)
        expect(seen.button.top, 'the button is under the box, not beside it').toBeLessThan(seen.field.bottom)
      } else {
        /* A telephone: the box in one row and the button in the next. */
        expect(seen.button.top, 'the button is not under the box').toBeGreaterThanOrEqual(seen.field.bottom - SLACK)
      }

      /* THE NAME CHOSEN IS THE ONE PRESSED, AND WHOLE IN THE BOX where the box can hold it. The longest of the list is
         pressed (a row is chosen on the press), after every assertion above, so a position that is wrong fails on its
         own sentence and not on the time of a press that cannot be made. On a telephone with the text enlarged the box
         may show the chosen name shortened: the member is chosen from rows that carry the whole name and number, and
         that is what is asked of them (owner's decision, PDL „Na telefonu polje nikad nije šire od vidljivog okvira
         tabele”, 24.11.2026). Everywhere else the name stays whole in the box (review of PR 813, high). */
      const longest = await page.evaluate(
        (id) => [...(document.getElementById(`${id}-list`)?.children ?? [])]
          .map((one) => (one.textContent ?? '').trim())
          .reduce((most, one) => (one.length > most.length ? one : most), ''),
        `team-${team}-member`,
      )

      await page.locator(`#team-${team}-member-list`).getByRole('option', { name: longest, exact: true }).click()

      const chosen = await box.evaluate((one) => ({
        value: one instanceof HTMLInputElement ? one.value : null,
        runsOut: one.scrollWidth - one.clientWidth,
      }))

      expect(chosen.value, 'the box holds another name than the one pressed').toBe(longest)

      if (at.width >= 768 || at.text === 100) {
        expect(chosen.runsOut, 'the name chosen runs out of the box, and its number with it').toBeLessThanOrEqual(0.5)
      }
    })
  }
}

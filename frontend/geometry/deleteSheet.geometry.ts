import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE SHEET THAT ASKS „OBRIŠI X?" BEFORE A ROW OF THE ADMINISTRATION IS TAKEN AWAY, ASKED IN CHROME AT 360,
 * 768 AND 1280 AND AT 200% TEXT (owner, 23.10.2026, PDL „Tri odgovora od 23.10.2026": every screen of the
 * administration that deletes asks as the row of a member does).
 *
 * Vitest answers what the sheet says, what the buttons are called, where the focus goes and what is sent.
 * It cannot answer where anything stands, what is under a point, or where the second click of a double
 * press lands, and those are what this file asks (`geometry/promptAlignment.geometry.ts` asks the same of
 * the sheets of the members' row; the cell that holds the sheet there is the cell that holds it here).
 *
 * <p><b>THE ROW PRESSED IS THE SECOND, never the first</b>: a sheet that named, or a click that reached,
 * the first row would be right on a list of one.
 *
 * <p><b>WHAT IS ASKED, FOR EACH OF THE FOUR SCREENS:</b>
 *
 * 1. **The sheet is inside the screen**: both of its sides between the edges of the window at every width
 *    and at 200% text, the page does not move sideways with it open, and every button of it is inside it
 *    and the buttons do not overlap.
 * 2. **The text of the sheet stands at its start edge**, as on the members' screen: the cell of the table
 *    that draws it computes `text-align: right` (`.table td`) and the sheet says where its own text
 *    stands.
 * 3. **A double press on the cross opens one sheet and sends nothing.** The first click opens the sheet
 *    under the pointer and the second lands wherever the sheet put its text or its buttons, which is
 *    geometry and differs with every row and every width: `detail` 2 answers no button of the sheet
 *    (`components/Prompt.tsx`).
 * 4. **After a deletion the sentence stands in the window**, between the controls of the screen and the
 *    table, and moves nothing sideways.
 */

test.use({ theDay: '2026-10-20' })

function sample<T>(name: string): T {
  const read: T = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'),
  )

  return read
}

type Screen = {
  name: string
  path: string
  /** The question the sheet asks. */
  asks: string
  /** What the screen says once the row is gone. */
  gone: string
  /** The address a deletion on it goes to, as a pattern the browser's route understands. */
  route: string
  answers: Answers
}

const ME = { role: 'superadmin', account: 41, membershipBasis: null }

const SCREENS: Screen[] = [
  {
    name: 'the events',
    path: '/sr/administracija/dogadjaji',
    asks: 'Obriši događaj?',
    gone: 'Događaj je obrisan, sa svojim trkama i rezultatima.',
    route: '**/api/events/*',
    answers: {
      '/api/me': ME,
      '/api/events': sample('events'),
      '/api/races': sample('races'),
      '/api/results': [],
    },
  },
  {
    name: 'the competitions',
    path: '/sr/administracija/lige',
    asks: 'Obriši ligu?',
    gone: 'Liga je obrisana.',
    route: '**/api/leagues/*',
    answers: {
      '/api/me': ME,
      '/api/leagues': sample('leagues'),
      '/api/races': sample('races'),
      '/api/events': sample('events'),
    },
  },
  {
    name: 'the moderators',
    path: '/sr/administracija/moderatori',
    asks: 'Obriši moderatora?',
    gone: 'Moderator je obrisan.',
    route: '**/api/moderators/*',
    answers: { '/api/me': ME, '/api/moderators': sample('moderators') },
  },
  {
    name: 'the teams',
    path: '/sr/administracija/timovi',
    asks: 'Obriši tim?',
    gone: 'Tim je obrisan.',
    route: '**/api/teams/*',
    answers: { '/api/me': ME, '/api/teams': sample('teams'), '/api/competitors': sample('competitors') },
  },
]

/** The three widths the portal is measured at (CLAUDE.md, UI standards), at the reader's own text and at 200%. */
const WIDTHS = [360, 768, 1280]
const TEXTS = [100, 200] as const

const READY = 'table tbody tr'

/**
 * THE SCREENS THAT ALREADY MOVE SIDEWAYS BEFORE ANY SHEET IS OPEN, on `main`.
 *
 * <p>Measured 24.10.2026 on `origin/main` (af327df5), with nothing of this branch on it: the events screen
 * at 360px and 200% text is wider than the window (the field of the search and the table are wider than the
 * column), and at the reader's own text it is not. **By 32px on the machine it was measured on and by 82px
 * on the CI runner**, whose fonts are not the same (the first CI run of this file said so), so the amount
 * is not written down: it is a fact about the fonts and not about the screen. PDL P24 forbids it. It is
 * reported with this branch and not fixed in it.
 *
 * <p>Written as a name and not as a skip, so the guard still fails if the sheet or the sentence makes it
 * worse, and still fails on every other screen and width where nothing moves.
 */
const MOVES_ALREADY: ReadonlySet<string> = new Set(['the events|360|200'])

const movesAlready = (screen: string, at: At) => MOVES_ALREADY.has(`${screen}|${at.width}|${at.text}`)

/** What a screen is asked about its own width before a sheet is opened: nothing moves, unless it is on the list. */
function expectNoSidewaysBeforeTheSheet(screen: string, at: At, sideways: number) {
  if (!movesAlready(screen, at)) {
    expect(sideways).toBe(0)
  }
}

/** The cross of the second row that is drawn on this screen. */
async function secondCross(page: Page) {
  const crosses = page.getByRole('button', { name: /^Obriši: / }).filter({ visible: true })

  expect(await crosses.count(), 'one row cannot tell a row from the first row').toBeGreaterThan(1)

  return crosses.nth(1)
}

/** Where the sheet stands, and where its buttons and its text stand inside it. */
async function readTheSheet(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"].prompt__sheet')

    if (sheet === null) {
      throw new Error('no sheet is open')
    }

    const box = sheet.getBoundingClientRect()
    const style = getComputedStyle(sheet)
    const startEdge = box.left + parseFloat(style.paddingLeft)
    const buttons = [...sheet.querySelectorAll('button')].map((one) => {
      const at = one.getBoundingClientRect()

      return { text: (one.textContent ?? '').trim(), left: at.left, right: at.right, top: at.top, bottom: at.bottom }
    })
    const text = [...sheet.querySelectorAll('.prompt__title, .prompt__body > p')].map((one) => {
      const range = document.createRange()

      range.selectNodeContents(one)

      const line = range.getClientRects()[0]

      return {
        text: (one.textContent ?? '').trim(),
        align: getComputedStyle(one).textAlign,
        offset: (line?.left ?? Number.NaN) - startEdge,
      }
    })

    return {
      left: box.left,
      right: box.right,
      top: box.top,
      width: innerWidth,
      sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      buttons,
      text,
    }
  })
}

for (const screen of SCREENS) {
  for (const width of WIDTHS) {
    for (const text of TEXTS) {
      const at: At = { width, text }

      test(`${screen.name}: the sheet stands inside the window and its text at its start at ${label(at)}`, async ({ open }) => {
        const { page, probe } = await open(at, screen.path, READY, screen.answers)

        await (await secondCross(page)).click()
        await page.getByRole('dialog', { name: screen.asks }).waitFor({ state: 'visible' })
        await page.waitForFunction(() => document.getAnimations().length === 0)

        const seen = await readTheSheet(page)
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)

        expectNoSidewaysBeforeTheSheet(screen.name, at, probe.sideways)
        expect(seen.sideways, 'the sheet makes the page move sideways').toBeLessThanOrEqual(probe.sideways)
        expect(seen.left, 'the sheet runs off the left edge').toBeGreaterThanOrEqual(-SLACK)
        expect(seen.right, 'the sheet runs off the right edge').toBeLessThanOrEqual(clientWidth + SLACK)
        expect(seen.top, 'the sheet starts above the window').toBeGreaterThanOrEqual(-SLACK)

        expect(seen.buttons.map((one) => one.text)).toEqual(['Obriši', 'Odustani'])

        for (const one of seen.buttons) {
          expect(one.left, `„${one.text}" leaves the sheet on the left`).toBeGreaterThanOrEqual(seen.left - SLACK)
          expect(one.right, `„${one.text}" leaves the sheet on the right`).toBeLessThanOrEqual(seen.right + SLACK)
        }

        const [yes, no] = seen.buttons

        expect(
          (yes?.right ?? 0) <= (no?.left ?? 0) + SLACK || (yes?.bottom ?? 0) <= (no?.top ?? 0) + SLACK,
          'the two buttons overlap',
        ).toBe(true)

        expect(seen.text.length).toBeGreaterThan(1)

        for (const one of seen.text) {
          expect(['start', 'left'], `„${one.text}" computes ${one.align}`).toContain(one.align)
          expect(Math.abs(one.offset), `„${one.text}" stands ${String(one.offset)}px from the start edge`).toBeLessThanOrEqual(
            SLACK,
          )
        }
      })

      test(`${screen.name}: a double press on the cross opens one sheet and sends nothing at ${label(at)}`, async ({ open }) => {
        const { page } = await open(at, screen.path, READY, screen.answers)
        const sent: string[] = []

        page.on('request', (request) => {
          if (request.method() === 'DELETE') {
            sent.push(request.url())
          }
        })

        const cross = await secondCross(page)

        await cross.dblclick()
        await page.waitForFunction(() => document.getAnimations().length === 0)

        /* WHEREVER THE SECOND CLICK LANDED (a button of the sheet, its words, its backdrop) the sheet is
           either still open or was put away by nobody: a second click is not an answer. */
        expect(await page.getByRole('dialog', { name: screen.asks }).count()).toBe(1)
        expect(sent).toEqual([])
      })
    }
  }

  for (const width of WIDTHS) {
    const at: At = { width, text: 200 }

    test(`${screen.name}: the sentence after a deletion stands in the window, over the table, at ${label(at)}`, async ({ open }) => {
      const { page, probe } = await open(at, screen.path, READY, screen.answers)

      await page.route(screen.route, (route) => route.fulfill({ status: 204 }))
      await (await secondCross(page)).click()
      await page.getByRole('dialog', { name: screen.asks }).getByRole('button', { name: 'Obriši', exact: true }).click()

      const said = page.getByText(screen.gone, { exact: true })

      await said.waitFor({ state: 'visible' })
      await page.waitForFunction(() => document.getAnimations().length === 0)

      const box = await said.boundingBox()
      const table = await page.locator('table').first().boundingBox()
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)

      expectNoSidewaysBeforeTheSheet(screen.name, at, probe.sideways)
      expect(sideways, 'the sentence makes the page move sideways').toBeLessThanOrEqual(probe.sideways)
      expect(box, 'the sentence draws no box').not.toBeNull()
      expect(table, 'the table draws no box').not.toBeNull()
      expect((box?.x ?? -1) + SLACK, 'the sentence runs off the left edge').toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0) - SLACK, 'the sentence runs off the right edge').toBeLessThanOrEqual(clientWidth)
      expect((box?.y ?? 0) + (box?.height ?? 0), 'the sentence stands over the table').toBeLessThanOrEqual((table?.y ?? 0) + SLACK)
    })
  }
}

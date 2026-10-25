import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  /** What the screen says once the row is gone, where it says it: the four lists of the administration do (`DeletionSaid`). */
  gone?: string
  answers: Answers
  /** Something only this screen has, to wait for; a table row by default. */
  ready?: string
  /** The cross that asks, by name: a record's „Obriši: {name}" by default. */
  cross?: RegExp | string
  /** Which of the crosses, counted from nought: the second by default, never the first where there is a list. */
  which?: number
  /** Whether the sheet names a record under the question; a member's own rating has none to name. */
  named?: boolean
}

const ME = { role: 'superadmin', account: 41, membershipBasis: null }

const SCREENS: Screen[] = [
  {
    name: 'the events',
    path: '/sr/administracija/dogadjaji',
    asks: 'Obriši događaj?',
    gone: 'Događaj je obrisan, sa svojim trkama i rezultatima.',
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
    answers: { '/api/me': ME, '/api/moderators': sample('moderators') },
  },
  {
    name: 'the teams',
    path: '/sr/administracija/timovi',
    asks: 'Obriši tim?',
    gone: 'Tim je obrisan.',
    answers: { '/api/me': ME, '/api/teams': sample('teams'), '/api/competitors': sample('competitors') },
  },
  /* THE FOUR PLACES OUTSIDE THE ADMINISTRATION (owner, 24.10.2026, PDL „Odgovori od 24.10.2026 (popodne)"): the
     team's own page, a result on the page of its event, a member's own results and his own rating. They say
     nothing after a deletion that the sheet's own geometry would need, so they carry no `gone`. The answers are
     every answer of the sample (`src/test/mock`), as `actionTip.geometry.ts` reads these same screens. */
  /* THE PAGE OF AN EVENT, which deleted the whole event through `window.confirm` until 25.10.2026 (PDL, „Odgovori od
     25.10.2026 (noć): prozor brisanja"). Its cross stands in the head of the page, the first of the crosses by that name
     (the results below carry crosses of their own, named after the member). After the deletion the reader is on the
     calendar, which says so. */
  {
    name: 'the page of an event',
    path: '/sr/kalendar/maraton-maratona-2015',
    asks: 'Obriši događaj?',
    gone: 'Događaj je obrisan, sa svojim trkama i rezultatima.',
    answers: { ...everyAnswer(), '/api/me': ME },
    ready: 'h1',
    cross: 'Obriši: Maraton maratona',
    which: 0,
  },
  {
    name: 'the page of a team',
    path: '/sr/tim/dunavski-trkaci',
    asks: 'Obriši tim?',
    gone: 'Tim je obrisan.',
    answers: { ...everyAnswer(), '/api/me': member('000001') },
    ready: 'h1.profile__name',
    which: 0,
  },
  {
    name: 'a result on the page of its event',
    path: '/sr/kalendar/zimski-nocni-polumaraton-2020',
    asks: 'Obriši rezultat?',
    gone: 'Rezultat je obrisan.',
    answers: { ...everyAnswer(), '/api/me': ME },
    ready: 'tbody td.table__points',
  },
  {
    name: 'the results of a member',
    path: '/sr/moji-rezultati',
    asks: 'Obriši rezultat?',
    gone: 'Rezultat je obrisan.',
    answers: { ...everyAnswer(), '/api/me': member('000021') },
    ready: 'tbody td.table__points',
  },
  {
    name: 'the rating of a member',
    path: '/sr/kalendar/fruskogorski-maraton-2010',
    asks: 'Obriši svoju ocenu?',
    gone: 'Ocena je obrisana.',
    answers: { ...everyAnswer(), '/api/me': member('000021') },
    ready: '.comments__his',
    cross: 'Obriši svoju ocenu',
    which: 0,
    named: false,
  },
]

/** The three widths the portal is measured at (CLAUDE.md, UI standards), at the reader's own text and at 200%. */
const WIDTHS = [360, 768, 1280]
const TEXTS = [100, 200] as const

const READY = 'table tbody tr'

/** Every answer of the sample, under the address it answers (`/api/results/runners` from `results/runners.json`). */
function everyAnswer(dir = fileURLToPath(new URL('../src/test/mock/', import.meta.url)), prefix = ''): Record<string, unknown> {
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

/** A member of the sample, answering `/api/me` with his own record. */
function member(number: string) {
  const record = sample<Record<string, unknown>[]>('competitors').find((one) => one.memberNumber === number)

  return { role: 'competitor', account: 1, mailLanguage: 'sr', seasonsOpenForAReport: [2027], member: record }
}

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
 * <p>**The page of an event with a member's own rating on it moves the same way at 360px and 200% text** (70px on the
 * machine it was measured on, 24.10.2026, `origin/main` af327df5, with nothing of this branch on it; none at the
 * reader's own text). It is a fault of that page and is reported, not fixed, here.
 *
 * <p>Written as a name and not as a skip, so the guard still fails if the sheet or the sentence makes it
 * worse, and still fails on every other screen and width where nothing moves.
 */
const MOVES_ALREADY: ReadonlySet<string> = new Set(['the events|360|200', 'the rating of a member|360|200'])

const movesAlready = (screen: string, at: At) => MOVES_ALREADY.has(`${screen}|${at.width}|${at.text}`)

/** What a screen is asked about its own width before a sheet is opened: nothing moves, unless it is on the list. */
function expectNoSidewaysBeforeTheSheet(screen: string, at: At, sideways: number) {
  if (!movesAlready(screen, at)) {
    expect(sideways).toBe(0)
  }
}

/** The cross of the row that is drawn on this screen: the second, so a first row cannot stand in for it. */
async function crossOf(page: Page, screen: Screen) {
  const crosses = page.getByRole('button', { name: screen.cross ?? /^Obriši: / }).filter({ visible: true })
  const which = screen.which ?? 1

  expect(await crosses.count(), 'one row cannot tell a row from the first row').toBeGreaterThan(which)

  return crosses.nth(which)
}

/** Where the sheet stands, and where its buttons and its text stand inside it. */
async function readTheSheet(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"].prompt__sheet')

    if (sheet === null) {
      throw new Error('no sheet is open')
    }

    const box = sheet.getBoundingClientRect()
    const backdrop = (sheet.parentElement ?? sheet).getBoundingClientRect()
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
      backdropLeft: backdrop.left,
      backdropRight: backdrop.right,
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
        const { page, probe } = await open(at, screen.path, screen.ready ?? READY, screen.answers)

        await (await crossOf(page, screen)).click()
        await page.getByRole('dialog', { name: screen.asks }).waitFor({ state: 'visible' })
        await page.waitForFunction(() => document.getAnimations().length === 0)

        const seen = await readTheSheet(page)
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)

        expectNoSidewaysBeforeTheSheet(screen.name, at, probe.sideways)
        expect(seen.sideways, 'the sheet makes the page move sideways').toBeLessThanOrEqual(probe.sideways)
        /* THE EDGES OF THE WINDOW, and where the page is wider than the window already (`MOVES_ALREADY`) the
           edges of the sheet's own backdrop, which is as wide as the page and not as the window: against the
           window the sheet would be judged by a fault of the screen behind it (on the CI runner the backdrop
           is 410px wide there, measured in the first CI run of this file). */
        const [leftEdge, rightEdge] = movesAlready(screen.name, at)
          ? [seen.backdropLeft, seen.backdropRight]
          : [0, clientWidth]

        expect(seen.left, 'the sheet runs off the left edge').toBeGreaterThanOrEqual(leftEdge - SLACK)
        expect(seen.right, 'the sheet runs off the right edge').toBeLessThanOrEqual(rightEdge + SLACK)
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

        expect(seen.text.length).toBeGreaterThan(screen.named === false ? 0 : 1)

        for (const one of seen.text) {
          expect(['start', 'left'], `„${one.text}" computes ${one.align}`).toContain(one.align)
          expect(Math.abs(one.offset), `„${one.text}" stands ${String(one.offset)}px from the start edge`).toBeLessThanOrEqual(
            SLACK,
          )
        }
      })

      test(`${screen.name}: a double press on the cross opens one sheet and sends nothing at ${label(at)}`, async ({ open }) => {
        const { page } = await open(at, screen.path, screen.ready ?? READY, screen.answers)
        const sent: string[] = []

        page.on('request', (request) => {
          if (request.method() === 'DELETE') {
            sent.push(request.url())
          }
        })

        const cross = await crossOf(page, screen)

        await cross.dblclick()
        await page.waitForFunction(() => document.getAnimations().length === 0)

        /* WHEREVER THE SECOND CLICK LANDED (a button of the sheet, its words, its backdrop) the sheet is
           either still open or was put away by nobody: a second click is not an answer. */
        expect(await page.getByRole('dialog', { name: screen.asks }).count()).toBe(1)
        expect(sent).toEqual([])
      })
    }
  }

  for (const width of screen.gone === undefined ? [] : WIDTHS) {
    for (const text of TEXTS) {
      const at: At = { width, text }

      test(`${screen.name}: the sentence after a deletion is drawn, whole and not cut off, in the window, before its table, at ${label(at)}`, async ({ open }) => {
        const { page, probe } = await open(at, screen.path, screen.ready ?? READY, screen.answers)

        /* Only the deletion is answered here (204); everything else the page asks for goes on to the answers of the sample. */
        await page.route('**/api/**', (route) =>
          route.request().method() === 'DELETE' ? route.fulfill({ status: 204 }) : route.fallback(),
        )
        await (await crossOf(page, screen)).click()
        await page.getByRole('dialog', { name: screen.asks }).getByRole('button', { name: 'Obriši', exact: true }).click()

        const said = page.getByText(screen.gone ?? '', { exact: true })

        await said.waitFor({ state: 'visible' })
        await page.waitForFunction(() => document.getAnimations().length === 0)
        await said.scrollIntoViewIfNeeded()

        const seen = await said.evaluate((one) => {
          const box = one.getBoundingClientRect()
          /* WHAT STANDS AT THE MIDDLE OF IT: itself, or its own words. A box cut off by an ancestor, or covered, answers
             with something else, which is what „not cut off" is asked through. */
          const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
          /* The first table AFTER it in the document, which is the table that the sentence is over; none on a page with no table. */
          const next = [...document.querySelectorAll('table')].find(
            (table) => (one.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          )

          return {
            x: box.left,
            right: box.right,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
            standsThere: top !== null && one.contains(top),
            // The words are not cut: the content is not taller or wider than the box that draws it.
            cutOff: one.scrollWidth > one.clientWidth + 1 || one.scrollHeight > one.clientHeight + 1,
            nextTableTop: next === undefined ? null : next.getBoundingClientRect().top,
            sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            clientWidth: document.documentElement.clientWidth,
          }
        })

        expectNoSidewaysBeforeTheSheet(screen.name, at, probe.sideways)
        expect(seen.sideways, 'the sentence makes the page move sideways').toBeLessThanOrEqual(probe.sideways)
        expect(seen.width, 'the sentence draws no box').toBeGreaterThan(0)
        expect(seen.height, 'the sentence draws no box').toBeGreaterThan(0)
        expect(seen.x + SLACK, 'the sentence runs off the left edge').toBeGreaterThanOrEqual(0)
        expect(seen.right - SLACK, 'the sentence runs off the right edge').toBeLessThanOrEqual(seen.clientWidth)
        expect(seen.standsThere, 'something else stands over the middle of the sentence, or an ancestor cuts it off').toBe(true)
        expect(seen.cutOff, 'the words of the sentence are cut off by its own box').toBe(false)

        if (seen.nextTableTop !== null) {
          expect(seen.bottom, 'the sentence stands over the table').toBeLessThanOrEqual(seen.nextTableTop + SLACK)
        }
      })
    }
  }
}

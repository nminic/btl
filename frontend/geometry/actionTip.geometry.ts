import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE BOX WITH THE WORD OF A SYMBOL, ASKED OF CHROME (owner, 20.10.2026: the word shows in a small
 * box on the pointer and on the keyboard, `components/ActionButton.tsx`).
 *
 * jsdom lays nothing out and draws no generated content, so `components/ActionButton.test.tsx`
 * holds where the box is PLACED against numbers it makes up and what the sheet SAYS about the word.
 * This asks where it LANDS and what Chrome DRAWS:
 *
 * 1. **The word is drawn**, out of the attribute the component writes (`::before`), and it is the
 *    word the button carries as its text.
 * 2. **The box stands inside the window, eight pixels from every edge, and the page does not scroll
 *    sideways**, with the button at the far right of a table that scrolls on its own: the cross of
 *    the last column of the members' table, scrolled to its end (PDL P24).
 * 3. **It opens on the keyboard as well as on the pointer, and Escape puts it away.**
 *
 * The members' table because it is the longest row of symbols the portal draws (a payment, a
 * cancellation or an exemption, and the deletion), and the one the owner named to be no worse than
 * before. Measured on 20.10.2026 against `main` (b9c6c411) with the same answers: the table is as
 * wide inside its box as it was (936px at all three widths) and its rows are lower (5628px for the
 * whole table against 5904px), so nothing here pins a width that the symbols could make worse.
 */

/** The day the moderation of the members is read on. */
test.use({ theDay: '2026-10-20' })

function sample<T>(name: string): T {
  const read: T = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'),
  )

  return read
}

/** Somebody who moderates the members: a superadmin, who may do everything (`useMay`). */
const ANSWERS: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/members': sample('members'),
  '/api/competitors': sample('competitors'),
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

/** Eight pixels, what the component holds the box from every edge of the window. */
const EDGE = 8

for (const at of WIDTHS) {
  test(`the word of a symbol is drawn inside the window, on the pointer and on the keyboard, at ${label(at)}`, async ({
    open,
  }) => {
    const { page, probe } = await open(at, '/sr/administracija/clanovi', 'tbody tr', ANSWERS)
    const cross = page.getByRole('button', { name: /^Obriši: / }).first()

    await cross.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      const box = document.querySelector('.table-scroll')

      if (box === null) {
        throw new Error('the members are not in a box of their own')
      }

      box.scrollLeft = box.scrollWidth
    })

    const drawn = async () =>
      page.evaluate(() => {
        const tip = document.querySelector('.action-tip')
        const words = document.querySelector('.action-tip__words')

        if (tip === null || words === null) {
          return null
        }

        const { left, top, right, bottom } = tip.getBoundingClientRect()
        const root = document.documentElement

        return {
          left,
          top,
          right,
          bottom,
          across: root.clientWidth,
          down: root.clientHeight,
          word: getComputedStyle(words, '::before').content,
          sideways: root.scrollWidth - root.clientWidth,
        }
      })

    const word = (await cross.textContent()) ?? ''

    expect(word, 'the cross carries its word as text').toBe('Obriši')

    /* A square of two rem, 32px at the size the browser starts from, whatever the look it wears
       gives a button of padding or height: the rule that makes it one has to win, and only a
       browser says whether it does. */
    const square = await cross.boundingBox()

    expect(square === null ? null : [Math.round(square.width), Math.round(square.height)]).toEqual([32, 32])

    for (const how of ['the pointer', 'the keyboard'] as const) {
      if (how === 'the pointer') {
        await cross.hover()
      } else {
        await page.mouse.move(1, 1)
        await cross.focus()
        /* A focus given by a script is one Chrome shows only after the keyboard has been used,
           so the keyboard is used: a Tab away and back. */
        await page.keyboard.press('Shift+Tab')
        await page.keyboard.press('Tab')
      }

      await page.locator('.action-tip').waitFor({ state: 'visible' })

      const seen = await drawn()

      expect(seen, `the box on ${how}`).not.toBeNull()

      if (seen === null) {
        return
      }

      expect(seen.word, `the word drawn on ${how}`).toBe(`"${word}"`)
      expect(seen.left, `left edge on ${how}`).toBeGreaterThanOrEqual(EDGE)
      expect(seen.top, `top edge on ${how}`).toBeGreaterThanOrEqual(EDGE)
      expect(seen.right, `right edge on ${how}`).toBeLessThanOrEqual(seen.across - EDGE)
      expect(seen.bottom, `bottom edge on ${how}`).toBeLessThanOrEqual(seen.down - EDGE)
      expect(seen.sideways, `the page scrolls sideways with the box open on ${how}`).toBe(0)

      await page.keyboard.press('Escape')
      await expect(page.locator('.action-tip')).toHaveCount(0)
    }

    expect(probe.sideways).toBe(0)
  })
}

/**
 * EVERY SYMBOL STANDS IN THE MIDDLE OF ITS SQUARE, ON EVERY SCREEN THAT DRAWS ONE (review of PR 593).
 *
 * The square is laid out by `components/ActionButton.css`, but the look it wears is each screen's, and
 * a screen's rule of two classes is as heavy as the square's: `.review__decide .button` and
 * `.my-results__own .button` (Member.css) gave Odobri, Odbij, Ispravi and a member's pencil and cross a
 * padding of 6px by 12px, and the symbol stood 6px off the centre. So this is asked of every screen,
 * with every answer the sample has (`src/test/mock`), at three widths: every symbol that is drawn is a
 * square of 32px with its drawing within one pixel of its centre, and each screen draws at least the
 * symbols named for it, so a screen that failed to draw passes nothing.
 */
const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

/** Every answer of the sample, under the address it answers (`/api/results/runners` from `results/runners.json`). */
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
const SUPERADMIN = { role: 'superadmin', account: 41, membershipBasis: null }

/** A member of the sample, answering `/api/me` with his own record. */
function member(number: string) {
  const record = sample<Record<string, unknown>[]>('competitors').find((one) => one.memberNumber === number)

  return { role: 'competitor', account: 1, mailLanguage: 'sr', seasonsOpenForAReport: [2027], member: record }
}

/** The queue of runs to check has nothing in the sample, so three are put in it, on a race that exists. */
const RACE = sample<Record<string, unknown>[]>('races')[0] ?? {}
const WAITING = sample<Record<string, unknown>[]>('verification')[0] ?? {}
const RUNS = [1, 2, 3].map((one) => ({
  ...WAITING,
  id: `ver-run-${String(one)}`,
  queue: 'results',
  memberNumber: '000021',
  who: 'Ksenija Vasiljević',
  subject: String(RACE.name),
  raceId: RACE.id,
  raceDate: RACE.date,
  raceKind: RACE.kind,
  distanceKm: RACE.distanceKm,
  ascentM: RACE.ascentM,
  descentM: RACE.descentM,
  seconds: 3600 + one,
  link: 'https://rezultati.rs/primer',
  eventId: RACE.eventId,
  eventName: 'Primer',
}))

const SCREENS: { path: string; me: unknown; least: number; extra?: Record<string, unknown> }[] = [
  { path: '/sr/administracija/clanovi', me: SUPERADMIN, least: 30 },
  { path: '/sr/administracija/dogadjaji', me: SUPERADMIN, least: 20 },
  { path: '/sr/administracija/cenovnik', me: SUPERADMIN, least: 3 },
  { path: '/sr/administracija/timovi', me: SUPERADMIN, least: 4 },
  { path: '/sr/administracija/lige', me: SUPERADMIN, least: 4 },
  { path: '/sr/administracija/moderatori', me: SUPERADMIN, least: 4 },
  {
    path: '/sr/administracija/verifikacija/rezultati',
    me: SUPERADMIN,
    least: 9,
    extra: { '/api/verification': [...sample<unknown[]>('verification'), ...RUNS] },
  },
  { path: '/sr/administracija/verifikacija/uplate', me: SUPERADMIN, least: 2 },
  { path: '/sr/administracija/verifikacija/timovi', me: SUPERADMIN, least: 3 },
  { path: '/sr/administracija/verifikacija/trkacki-profil', me: SUPERADMIN, least: 3 },
  { path: '/sr/administracija/verifikacija/komentari', me: SUPERADMIN, least: 3 },
  { path: '/sr/kalendar/zimski-nocni-polumaraton-2020', me: SUPERADMIN, least: 20 },
  { path: '/sr/lige', me: SUPERADMIN, least: 2 },
  { path: '/sr/tim/dunavski-trkaci', me: member('000001'), least: 1 },
  { path: '/sr/moji-rezultati', me: member('000021'), least: 30 },
  { path: '/sr/moja-clanarina', me: member('000021'), least: 1 },
]

for (const at of WIDTHS) {
  for (const screen of SCREENS) {
    test(`every symbol stands in the middle of its square on ${screen.path}, at ${label(at)}`, async ({ open }) => {
      const { page, probe } = await open(at, screen.path, '.action:visible', {
        ...SAMPLE,
        ...screen.extra,
        '/api/me': screen.me,
      })

      const seen = await page.evaluate(() =>
        [...document.querySelectorAll('.action')]
          .filter((one) => one.getBoundingClientRect().width > 0)
          .map((one) => {
            const square = one.getBoundingClientRect()
            const drawing = one.querySelector('svg')?.getBoundingClientRect()

            return {
              name: one.getAttribute('aria-label') ?? one.textContent,
              size: [Math.round(square.width), Math.round(square.height)],
              off:
                drawing === undefined
                  ? Number.POSITIVE_INFINITY
                  : Math.max(
                      Math.abs(drawing.left + drawing.width / 2 - (square.left + square.width / 2)),
                      Math.abs(drawing.top + drawing.height / 2 - (square.top + square.height / 2)),
                    ),
            }
          }),
      )

      expect(seen.length, 'the symbols this screen draws').toBeGreaterThanOrEqual(screen.least)
      expect(seen.filter((one) => one.size[0] !== 32 || one.size[1] !== 32)).toEqual([])
      expect(seen.filter((one) => one.off > 1)).toEqual([])
      expect(probe.sideways).toBe(0)
    })
  }
}

/**
 * „PRIKAŽI" IS NOT DRAWN ON A WIDE SCREEN, WHERE EVERY CARD IS OPEN (review of PR 593; the owner's
 * decision of 06.08.2026, written over the control in `pages/admin/PendingQueue.tsx`).
 *
 * The queues hide it with `display: none` on one class inside a query of width (`Verification.css`,
 * `.pending__toggle`), and a `display` written by the square at two classes drew it again: four
 * chevrons at 1280px over cards that were all open, each saying `aria-expanded="false"`. Asked on all
 * three queues that draw it: not drawn at 1280, drawn at 360, and present in the document at both.
 */
const QUEUES = [
  '/sr/administracija/verifikacija/timovi',
  '/sr/administracija/verifikacija/trkacki-profil',
  '/sr/administracija/verifikacija/komentari',
]

for (const path of QUEUES) {
  for (const [width, drawn] of [
    [360, true],
    [1280, false],
  ] as const) {
    test(`the toggle of a card is ${drawn ? '' : 'not '}drawn on ${path} at ${String(width)}px`, async ({ open }) => {
      const { page } = await open({ width, text: 100 }, path, '.action:visible', { ...SAMPLE, '/api/me': SUPERADMIN })

      const toggles = await page.evaluate(() =>
        [...document.querySelectorAll('.pending__toggle')].map((one) => getComputedStyle(one).display !== 'none'),
      )

      expect(toggles.length, 'the toggles in the document').toBeGreaterThan(0)
      expect(toggles.every((one) => one === drawn)).toBe(true)
    })
  }
}

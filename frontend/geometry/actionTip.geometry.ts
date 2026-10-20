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
 *    sideways**, with the button at the far right of a table: the cross of the last column of the
 *    members' table, its box scrolled to its end (PDL P24). Since 20.10.2026 that box no longer
 *    scrolls at the ordinary text size (`geometry/membersTable.geometry.ts`), so the scroll is a
 *    no-op there and the cross is simply at the right edge of the table.
 * 3. **It opens on the keyboard as well as on the pointer, and Escape puts it away.**
 *
 * The members' table because it is the longest row of symbols the portal draws (a payment, a
 * cancellation or an exemption, and the deletion), and the one the owner named to be no worse than
 * before. Measured on 20.10.2026 against `main` (b9c6c411) with the same answers, before the table
 * was fitted to its box later that day: the symbols left it as wide as it was and made its rows lower
 * (5628px for the whole table against 5904px). The table's width and its box are asked of Chrome in
 * `geometry/membersTable.geometry.ts`, so nothing here pins a width.
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

/**
 * A PRESS ALWAYS REACHES THE CONTROL UNDER THE POINTER (owner, 20.10.2026: the box must not get in the
 * way), replaying the moves the review of PR 593 measured.
 *
 * The pointer rests on one symbol, its box opens, the pointer goes to the symbol beside it, and that
 * one is pressed. With a box that took presses, the press landed on the words of the first box
 * (`elementFromPoint` answered `SPAN.action-tip__words`) and the neighbour got nothing, three times in
 * six: the members' cross and „Storniraj" above it at 360 and at 1280, and the teams' cross and
 * „Otvori" beside it at 360. Asked here: the neighbour is what stands under the pointer, and it gets
 * the click on the first press.
 */
const NEIGHBOURS: { path: string; width: number; from: RegExp; to: RegExp; answers: Answers }[] = [
  { path: '/sr/administracija/clanovi', width: 360, from: /^Obriši: /, to: /^Storniraj$/, answers: ANSWERS },
  { path: '/sr/administracija/clanovi', width: 1280, from: /^Obriši: /, to: /^Storniraj$/, answers: ANSWERS },
  {
    path: '/sr/administracija/timovi',
    width: 360,
    from: /^Obriši: /,
    to: /^Otvori: /,
    answers: { ...SAMPLE, '/api/me': SUPERADMIN },
  },
]

for (const one of NEIGHBOURS) {
  test(`the neighbour of a symbol gets the first press, on ${one.path} at ${String(one.width)}px`, async ({ open }) => {
    const { page } = await open({ width: one.width, text: 100 }, one.path, '.action:visible', one.answers)
    const row = page.locator('tbody tr').filter({ has: page.getByRole('button', { name: one.to }) }).first()
    const from = row.getByRole('button', { name: one.from })
    const to = row.getByRole('button', { name: one.to })

    await from.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      const box = document.querySelector('.table-scroll')

      if (box !== null) {
        box.scrollLeft = box.scrollWidth
      }
    })

    /* Held as the element itself and not as a query: pressing „Otvori" opens the record in place of
       the list, and the row the query names is gone by the time it is asked again. */
    const pressedOne = await to.elementHandle()

    await to.evaluate((button) => {
      button.addEventListener('click', (pressed) => {
        pressed.preventDefault()
        button.dataset.pressed = String(Number(button.dataset.pressed ?? '0') + 1)
      })
    })

    const start = await from.boundingBox()
    const end = await to.boundingBox()

    expect(start, 'the symbol the pointer rests on').not.toBeNull()
    expect(end, 'its neighbour').not.toBeNull()

    if (start === null || end === null) {
      return
    }

    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.locator('.action-tip').first().waitFor({ state: 'visible' })
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 })

    const under = await page.evaluate(
      ([x, y]) => {
        const hit = document.elementFromPoint(x ?? 0, y ?? 0)

        return hit?.closest('button, a')?.getAttribute('aria-label') ?? hit?.closest('button, a')?.textContent ?? hit?.className
      },
      [end.x + end.width / 2, end.y + end.height / 2],
    )

    expect(String(under), 'what stands under the pointer').toMatch(one.to)

    await page.mouse.down()
    await page.mouse.up()

    expect(await pressedOne?.getAttribute('data-pressed'), 'the clicks the neighbour got').toBe('1')
  })
}

/**
 * EVERY SYMBOL STANDS ON THE LINE OF THE WORDS AROUND IT (review of PR 593, round 3).
 *
 * The symbol is out of the flow, so the square needs a baseline of its own (the line of nothing in
 * `ActionButton.css`). Without it a container that lines its children up by their baselines put the
 * square about ten pixels too high: the chevron beside the heading of a card in the three queues
 * (`.submissions__head`, `align-items: baseline`), measured −9.5px at 360 and −10px at 768, where `main`
 * stood at +1.0. Asked here of every symbol on every screen, so that no container can repeat it: the
 * vertical centre of the symbol against the centre of the nearest words on its line in its own
 * surroundings, climbing at most three boxes up from it and never out of a cell of a table (the row of
 * a table is `resultsRow.geometry.ts`'s question). Words that wrap count as one block, since a symbol
 * lined up with them is lined up with the block. A symbol with no words on its line around it is not
 * asked, and the queues below make sure the ones the review found always are.
 *
 * **Two pixels**, measured: every symbol that has words around it stands within one pixel of them
 * today, and the two states this was written against stand 2,5px (the row of a
 * table, with the symbol out of the flow and no line of its own) and ten pixels off.
 */
const ON_THE_LINE = 2

/** For every drawn symbol, how far the centre of the nearest words on its line stands from its own. */
function offTheLine(): { name: string | null; words: string | null; off: number | null }[] {
  const wordsIn = (scope: Element) => {
    const found: { text: string; top: number; bottom: number; left: number; right: number }[] = []
    const walk = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)

    for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
      const holder = node.parentElement

      if (
        holder === null ||
        (node.textContent ?? '').trim() === '' ||
        holder.closest('.action, .action-tip, .visually-hidden') !== null ||
        getComputedStyle(holder).visibility === 'hidden'
      ) {
        continue
      }

      const range = document.createRange()

      range.selectNodeContents(node)

      const rect = range.getBoundingClientRect()

      if (rect.width > 0 && rect.height > 0) {
        found.push({ text: (node.textContent ?? '').trim().slice(0, 30), top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right })
      }
    }

    return found
  }

  return [...document.querySelectorAll('.action')]
    .filter((one) => one.getBoundingClientRect().width > 0)
    .map((one) => {
      const box = one.getBoundingClientRect()
      let scope = one.parentElement
      let near: { text: string; top: number; bottom: number } | undefined

      for (let step = 0; step < 3 && scope !== null && near === undefined; step += 1) {
        near = wordsIn(scope)
          .filter((line) => line.bottom > box.top && line.top < box.bottom)
          .map((line) => ({ ...line, gap: Math.max(0, line.left - box.right, box.left - line.right) }))
          .sort((left, right) => left.gap - right.gap)[0]

        if (scope.matches('td, th')) {
          break
        }

        scope = scope.parentElement
      }

      return {
        name: one.getAttribute('aria-label') ?? one.textContent,
        words: near === undefined ? null : near.text,
        off: near === undefined ? null : (near.top + near.bottom) / 2 - (box.top + box.height / 2),
      }
    })
}

for (const at of WIDTHS) {
  for (const screen of SCREENS) {
    test(`every symbol stands on the line of the words around it on ${screen.path}, at ${label(at)}`, async ({ open }) => {
      const { page } = await open(at, screen.path, '.action:visible', { ...SAMPLE, ...screen.extra, '/api/me': screen.me })
      const seen = await page.evaluate(offTheLine)

      expect(seen.filter((one) => one.off !== null && Math.abs(one.off) > ON_THE_LINE)).toEqual([])
    })
  }
}

for (const path of QUEUES) {
  for (const width of [360, 768]) {
    test(`the toggle of a card stands on the line of its heading on ${path} at ${String(width)}px`, async ({ open }) => {
      const { page } = await open({ width, text: 100 }, path, '.action:visible', { ...SAMPLE, '/api/me': SUPERADMIN })
      const seen = (await page.evaluate(offTheLine)).filter((one) => one.name?.startsWith('Prikaži') === true)

      /* Measured, not assumed: at least one toggle stands beside words, so the case is never passed
         for having nothing to ask. Not every one does: at 360 a long heading takes the line and the
         head wraps (`flex-wrap`, Member.css), and the toggle then stands on a line of its own. */
      const measured = seen.filter((one) => one.off !== null)

      expect(seen.length, 'the toggles drawn').toBeGreaterThan(0)
      expect(measured.length, 'toggles with words on their line').toBeGreaterThan(0)
      expect(measured.filter((one) => Math.abs(one.off ?? 0) > ON_THE_LINE)).toEqual([])
    })
  }
}

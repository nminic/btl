import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'
import { readPng } from './support/pixels.ts'

/**
 * THE ARROW OF A DROPDOWN IS SEEN WHERE THE READER HAS ASKED THE SYSTEM FOR ITS OWN COLOURS (forced colors, Windows
 * high contrast), ASKED OF CHROME (review of PR 803, medium 1; WCAG 2.2 SC 1.4.11 Non-text Contrast, 3:1).
 *
 * <p>The arrow is a picture whose colour is written into it (`index.css`), and under forced colors the system paints
 * the box in its own colours and leaves the picture as it was: the palette's light grey on the system's white, or,
 * while the portal had a light theme (until 24.11.2026), its dark grey on the system's black. The comment in `index.css` said 3:1 „on
 * every surface” and the measure said otherwise. A computed style says what was asked and not what the system
 * painted, so this reads the PIXELS of a screenshot: the arrow region of a select, of the box of a member and of the
 * language box of the header, under `forcedColors: 'active'`, with the system in its light and its dark scheme, and
 * the most contrasting pixel in it against the pixel of the box's own ground has to be 3:1 or more.
 *
 * <p><b>The mutation that fells it</b> is the forced-colors rule of `index.css` taken out: the picture is then the
 * palette's grey on the system's ground, and the ratio falls well under 3.
 */

const MOCK = fileURLToPath(new URL('../src/test/mock/', import.meta.url))

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

const ANSWERS: Answers = { ...everyAnswer(), '/api/frozen-seasons': [], '/api/me': { role: 'superadmin', account: 41, membershipBasis: null } }

/** The relative luminance of a colour (WCAG 2.2). */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (one: number) => {
    const scaled = one / 255

    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function ratio(one: [number, number, number], other: [number, number, number]): number {
  const [light, dark] = [luminance(one), luminance(other)].sort((left, right) => right - left)

  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}

const ARROWS = [
  { name: 'a select (SEZONA of the tables)', path: '/sr/tabela', ready: '.rankings__field select', find: '.rankings__field select', room: 28 },
  { name: 'the language box of the header', path: '/sr/tabela', ready: '.lang__caret', find: '.lang__caret', room: 0 },
  {
    name: 'the box of a member',
    path: '/sr/kalendar/maraton-maratona-2015/rezultati?trka=RACE',
    ready: '#league-row-1-member',
    find: '#league-row-1-member',
    room: 28,
  },
] as const

function theRace(): number {
  const events = ANSWERS['/api/events']
  const races = ANSWERS['/api/races']

  if (!Array.isArray(events) || !Array.isArray(races)) {
    throw notMeasured('the sample carries no events or no races')
  }

  const event: unknown = events.find((one: unknown) => Reflect.get(Object(one), 'slug') === 'maraton-maratona-2015')
  const race: unknown = Reflect.get(
    Object(races.filter((one: unknown) => Reflect.get(Object(one), 'eventId') === Reflect.get(Object(event), 'id')).at(-1)),
    'id',
  )

  if (typeof race !== 'number') {
    throw notMeasured('the sample has no race of maraton-maratona-2015')
  }

  return race
}

const AT: At[] = [{ width: 1280, text: 100, height: 500 }, { width: 360, text: 100 }]

for (const arrow of ARROWS) {
  for (const at of AT) {
    for (const system of ['light', 'dark'] as const) {
      test(`the arrow of ${arrow.name} is seen under forced colors, system ${system}, ${label(at)}`, async ({ open }) => {
        const { page } = await open(
          at,
          arrow.path.replace('RACE', String(theRace())),
          arrow.ready,
          ANSWERS,
        )

        await page.emulateMedia({ forcedColors: 'active', colorScheme: system })

        const forced = await page.evaluate(() => matchMedia('(forced-colors: active)').matches)

        if (!forced) {
          throw notMeasured('the browser did not take forced colors')
        }

        const found = page.locator(arrow.find).first()

        await found.scrollIntoViewIfNeeded()

        const box = await found.boundingBox()

        if (box === null) {
          throw notMeasured('the dropdown has no box')
        }

        /* The arrow region: the right end of a select (its own room, `--space-32`), or the whole of the caret of the
           language box. A margin of two pixels keeps the border of the box out of it. */
        const region = {
          x: arrow.room === 0 ? box.x - 2 : box.x + box.width - arrow.room,
          y: box.y + 3,
          width: arrow.room === 0 ? box.width + 4 : arrow.room - 3,
          height: box.height - 6,
        }
        const pixels = readPng(await page.screenshot({ clip: region }))
        const ground = pixels.at(0, 0)
        let best = 1

        for (let y = 0; y < pixels.height; y += 1) {
          for (let x = 0; x < pixels.width; x += 1) {
            best = Math.max(best, ratio(pixels.at(x, y), ground))
          }
        }

        expect(best, `the most contrasting pixel of the arrow is ${best.toFixed(2)}:1 against the ground of its box`).toBeGreaterThanOrEqual(3)
      })
    }
  }
}

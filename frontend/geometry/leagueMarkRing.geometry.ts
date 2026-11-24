import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE RING AROUND THE MARK OF A LEAGUE IS WHITE, ASKED OF CHROME FOR ITS COMPUTED COLOUR (owner, 24.11.2026, PDL
 * „Okvir oko znaka lige je beo”: „Okvir oko znaka Lige (i tima jednog dana), treba da bude beo”), for the mark drawn
 * from a picture and for the one drawn from the initials, in every place a league's mark is drawn (the head of the
 * sheet of the leagues, a tile of the showcase, the heading of a league's own page), on a telephone,
 * a tablet and a desktop. The mark of a team is not asked, it is not changed.
 *
 * <p>It reads `getComputedStyle`, which the browser has resolved from the cascade, and not the text of
 * `Leagues.css`, so a ring put back in gold by any rule, of any weight, in any sheet, falls here. The thickness is
 * asked as well, since the owner said the colour and not the width: it stays 2px.
 *
 * <p><b>The mutation that fells it</b> is the ring in `var(--gold-400)` again.
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

const ANSWERS: Answers = { ...everyAnswer(), '/api/frozen-seasons': [] }

const PLACES = [
  { name: 'the head of the sheet of the leagues', path: '/sr/lige?sezona=2027', ready: '.leagues__score .leagues__mark', find: '.leagues__score .leagues__mark' },
  { name: 'a tile of the showcase', path: '/sr/lige?sezona=2027', ready: '.leagues__tile .leagues__mark', find: '.leagues__tile .leagues__mark' },
  { name: 'the heading of the page of a league', path: '/sr/liga/runtrace-2027', ready: '.league__title .leagues__mark', find: '.league__title .leagues__mark' },
] as const

const SIZES: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100, height: 300 },
]
const AT: At[] = SIZES

for (const place of PLACES) {
  for (const at of AT) {
    test(`the ring of the mark of a league is white on ${place.name}, ${label(at)}`, async ({ open }) => {
      const { page } = await open(at, place.path, place.ready, ANSWERS)

      const seen = await page.evaluate((selector) => {
        /* White as the portal names it, resolved by the browser. */
        const probe = document.createElement('span')

        probe.style.color = 'var(--white)'
        document.body.append(probe)

        const white = getComputedStyle(probe).color

        probe.remove()

        return {
          white,
          marks: [...document.querySelectorAll<HTMLElement>(selector)].map((one) => {
            const style = getComputedStyle(one)

            return {
              picture: one.classList.contains('leagues__mark--logo'),
              colour: style.borderTopColor,
              width: style.borderTopWidth,
              borderStyle: style.borderTopStyle,
            }
          }),
        }
      }, place.find)

      if (seen.marks.length === 0) {
        throw notMeasured(`no mark of a league was drawn on ${place.name}`)
      }

      for (const mark of seen.marks) {
        expect(mark.colour, `the ring of a mark drawn from ${mark.picture ? 'a picture' : 'the initials'}`).toBe(seen.white)
        expect(mark.width, 'the ring is not as thick as it was').toBe('2px')
        expect(mark.borderStyle).toBe('solid')
      }
    })
  }
}

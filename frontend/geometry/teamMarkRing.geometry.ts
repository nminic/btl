import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE RING AROUND A TEAM'S LOGO IS WHITE, ASKED OF CHROME FOR ITS COMPUTED COLOUR (owner, 24.11.2026, PDL „Okvir oko
 * znaka lige je beo”: „Okvir oko znaka Lige (i tima jednog dana), treba da bude beo”, the day a team can set its logo,
 * PDL 25.11.2026), for the logo drawn from a picture and for the one drawn from the initials, in the two places a
 * team's logo is drawn (the table of teams, and the head of a team's own page), on a telephone, a tablet and a desktop.
 *
 * <p>It reads `getComputedStyle`, so a ring put in another colour by any rule in any sheet falls here. And the page
 * does not scroll sideways at any of the three widths, since the ring makes the circle no wider (the box is
 * `border-box`) and that is asked rather than assumed.
 *
 * <p><b>The mutation that fells it</b> is the ring taken off `TeamMark.css`, or given a colour of its own.
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
  { name: 'the table of teams', path: '/sr/timovi', ready: '.team-mark', find: '.team-mark', both: true },
  { name: 'the head of the page of a team', path: '/sr/tim/dunavski-trkaci', ready: '.profile__name .team-mark', find: '.profile__name .team-mark', both: false },
] as const

const AT: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100, height: 300 },
]

for (const place of PLACES) {
  for (const at of AT) {
    test(`the ring of a team's logo is white on ${place.name}, ${label(at)}`, async ({ open }) => {
      const { page } = await open(at, place.path, place.ready, ANSWERS)

      const seen = await page.evaluate((selector) => {
        const probe = document.createElement('span')

        probe.style.color = 'var(--white)'
        document.body.append(probe)

        const white = getComputedStyle(probe).color

        probe.remove()

        return {
          white,
          sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          marks: [...document.querySelectorAll<HTMLElement>(selector)].map((one) => {
            const style = getComputedStyle(one)

            return {
              picture: one.classList.contains('team-mark--logo'),
              colour: style.borderTopColor,
              width: style.borderTopWidth,
              borderStyle: style.borderTopStyle,
            }
          }),
        }
      }, place.find)

      if (seen.marks.length === 0) {
        throw notMeasured(`no logo of a team was drawn on ${place.name}`)
      }

      if (place.both) {
        expect(new Set(seen.marks.map((one) => one.picture)), 'the table drew only one of the two kinds of logo').toEqual(
          new Set([true, false]),
        )
      }

      for (const mark of seen.marks) {
        expect(mark.colour, `the ring of a logo drawn from ${mark.picture ? 'a picture' : 'the initials'}`).toBe(seen.white)
        expect(mark.width).toBe('2px')
        expect(mark.borderStyle).toBe('solid')
      }

      expect(seen.sideways, 'the page scrolls sideways').toBeLessThanOrEqual(0)
    })
  }
}

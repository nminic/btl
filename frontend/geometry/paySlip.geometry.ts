import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { whoIAm } from '../src/test/theAnswer.ts'
import { SLACK, label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE PAYMENT SLIP ON „MOJA ČLANARINA": THE CODE BESIDE THE DETAILS, NO TALLER THAN THEY ARE.
 *
 * PDL P8, owner, 18.10.2026, four sentences about one block, each held here where a browser lays it
 * out, because jsdom lays out nothing:
 * - „QR kod stoji uz DESNU IVICU strane, ne odmah pored podataka" - the code's right edge is the
 *   slip's right edge;
 * - „Naslov „Uplatnica sa QR kodom” se briše, a kod ostaje na istoj visini" - „ne diži gore na mesto
 *   naslova": the code's top is the top of the details, not the top of the slip;
 * - „QR kod nije viši od stupca podataka za uplatu levo od njega ... Kod ostaje kvadrat i poravnat po
 *   vrhu sa podacima" - its height is at most the height of the details, and it is square;
 * - „Na telefonu kod ostaje ispod podataka" - one column, the code under the details at its own size.
 *
 * Measured for a member with a reference and for somebody who has never paid, who has none: his column
 * of details is one row shorter, so it is the one that asks the most of the rule above.
 */

/** A day inside the window, when the slip is drawn to both of them. */
test.use({ theDay: '2026-10-20' })

const ADDRESS = '/sr/moja-clanarina'
const READY = '.pay__slip svg.qr'

/** The smallest code this portal draws on two columns: below it a banking app is not trusted to
 *  read it (the coordinator's reasoning of 18.10.2026, not the owner's decision; the owner is asked
 *  before anything goes under it). */
const SMALLEST_CODE = 120

const prices: unknown = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/test/mock/pricing.json', import.meta.url)), 'utf-8'),
)

const aChoice = { season: 2027, firstSeason: false, firstSeasonAllowed: true, category: 'M25-39', open: true }

const common: Answers = {
  '/api/pricing': prices,
  '/api/results': [],
  '/api/teams': [],
  '/api/competitors': [],
  '/api/pairs': [],
  '/api/me/category': aChoice,
}

/** A member of the file whose fee stands, renewing early, with a reference of his own. */
const WITH_A_REFERENCE: Answers = { ...common, '/api/me': whoIAm }

/** Somebody who registered and has not paid: no member number, so no reference and one row less. */
const { memberNumber: _number, teamId: _team, teamSince: _since, photo: _photo, crop: _crop, ...unpaid } =
  whoIAm.member
const WITHOUT_ONE: Answers = {
  ...common,
  '/api/me': { ...whoIAm, member: { ...unpaid, active: false, firstSeason: 2027 } },
}

const TWO_COLUMNS: At[] = [
  { width: 820, text: 100 },
  { width: 1280, text: 100 },
]

for (const [who, answers] of [
  ['a member with a reference', WITH_A_REFERENCE],
  ['somebody with no reference', WITHOUT_ONE],
] as const) {
  for (const at of TWO_COLUMNS) {
    test(`the code beside the details, no taller than they are, for ${who} at ${label(at)}`, async ({ open }) => {
      const { page, probe } = await open(at, ADDRESS, READY, answers)

      const seen = await page.evaluate(() => {
        const box = (selector: string) => {
          const found = document.querySelector(selector)

          if (found === null) {
            throw new Error(`nothing matches ${selector}`)
          }

          const { top, right, bottom, left, width, height } = found.getBoundingClientRect()

          return { top, right, bottom, left, width, height }
        }

        return {
          slip: box('.pay__slip'),
          details: box('.pay__slip .pay__details'),
          code: box('.pay__slip svg.qr'),
          headings: document.querySelectorAll('.pay__slip h3, .pay__slip h4').length,
        }
      })

      expect(probe.sideways).toBe(0)
      expect(seen.headings).toBe(1)
      expect(Math.abs(seen.code.right - seen.slip.right)).toBeLessThanOrEqual(SLACK)
      expect(Math.abs(seen.code.top - seen.details.top)).toBeLessThanOrEqual(SLACK)
      expect(seen.code.height).toBeLessThanOrEqual(seen.details.height + SLACK)
      expect(Math.abs(seen.code.width - seen.code.height)).toBeLessThanOrEqual(SLACK)
      expect(seen.code.height).toBeGreaterThanOrEqual(SMALLEST_CODE)
      expect(seen.code.left).toBeGreaterThan(seen.details.left)
    })
  }

  test(`the code under the details at its own size for ${who} on a telephone`, async ({ open }) => {
    const at: At = { width: 360, text: 100 }
    const { page, probe } = await open(at, ADDRESS, READY, answers)

    const seen = await page.evaluate(() => {
      const box = (selector: string) => {
        const found = document.querySelector(selector)

        if (found === null) {
          throw new Error(`nothing matches ${selector}`)
        }

        const { top, bottom, width, height } = found.getBoundingClientRect()

        return { top, bottom, width, height }
      }

      return { details: box('.pay__slip .pay__details'), code: box('.pay__slip svg.qr') }
    })

    expect(probe.sideways).toBe(0)
    expect(seen.code.top).toBeGreaterThanOrEqual(seen.details.bottom)
    expect(seen.code.height).toBe(180)
    expect(seen.code.width).toBe(180)
  })
}

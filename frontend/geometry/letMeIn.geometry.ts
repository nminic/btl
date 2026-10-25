import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { whoIAm } from '../src/test/theAnswer.ts'
import { SLACK, label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * „AKTIVIRAJ ČLANSTVO" ON „MOJA ČLANARINA", AT THE THREE WIDTHS EVERY SCREEN IS HELD TO.
 *
 * <p>The owner's answers of 25.10.2026 put a button and its sentence on the renewal panel, alone where
 * the balance covers the fee and above the slip for the member whose balance grew after his slip was
 * minted. jsdom lays out nothing, so these say what a browser does with it: the page does not move
 * sideways, the button stays inside the panel, and where both stand the button comes first.
 */

test.use({ theDay: '2026-10-20' })

const ADDRESS = '/sr/moja-clanarina'
const READY = '.member__panel button.button--primary'

const prices: unknown = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/test/mock/pricing.json', import.meta.url)), 'utf-8'),
)

const dinars = (amount: number) => ({ amount, currency: 'RSD' })

/** The whole fee on the book, nothing to transfer. */
const covered = {
  season: 2027,
  alreadyAMember: false,
  priceKey: 'early',
  fee: dinars(4200),
  balance: dinars(4800),
  fromTheBalance: dinars(4200),
  toTransfer: dinars(0),
  processingFeeEur: 0,
  coveredByTheBalance: true,
}

/** Covered today, and a slip from before still asking for 3.600. */
const grew = { ...covered, fromTheBalance: dinars(600), toTransfer: dinars(3600) }

/* A member of the file holding no membership of the season on sale, the same arrangement
   `paySlip.geometry.ts` gives its reason for. */
const { membershipBasis: _basis, membershipSeason: _heldSeason, ...holdingNone } = whoIAm.member

const answering = (owed: unknown): Answers => ({
  '/api/me': { ...whoIAm, member: holdingNone },
  '/api/me/membership': owed,
  '/api/pricing': prices,
  '/api/results': [],
  '/api/teams': [],
  '/api/competitors': [],
  '/api/pairs': [],
})

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
]

for (const at of WIDTHS) {
  test(`the button alone, inside its panel and with nothing sideways, at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, ADDRESS, READY, answering(covered))

    const seen = await page.evaluate((ready) => {
      const button = document.querySelector(ready)

      if (button === null) {
        throw new Error(`nothing matches ${ready}`)
      }

      const panel = button.closest('.member__panel')

      if (panel === null) {
        throw new Error('the button is in no panel')
      }

      const b = button.getBoundingClientRect()
      const p = panel.getBoundingClientRect()

      return {
        button: { left: b.left, right: b.right, height: b.height },
        panel: { left: p.left, right: p.right },
        slips: document.querySelectorAll('.pay__slip').length,
      }
    }, READY)

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)
    expect(seen.slips).toBe(0)
    expect(seen.button.left).toBeGreaterThanOrEqual(seen.panel.left - SLACK)
    expect(seen.button.right).toBeLessThanOrEqual(seen.panel.right + SLACK)
    /* WCAG 2.2 SC 2.5.8, the target at least 24 CSS pixels tall. */
    expect(seen.button.height).toBeGreaterThanOrEqual(24)
  })

  test(`the button above the slip, and nothing sideways, at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, ADDRESS, '.pay__slip svg.qr', answering(grew))

    const seen = await page.evaluate((ready) => {
      const box = (selector: string) => {
        const found = document.querySelector(selector)

        if (found === null) {
          throw new Error(`nothing matches ${selector}`)
        }

        const { top, bottom, left, right } = found.getBoundingClientRect()

        return { top, bottom, left, right }
      }

      return { button: box(ready), slip: box('.pay__slip') }
    }, READY)

    expect(probe.sideways).toBe(0)
    expect(probe.widened).toBe(0)
    expect(seen.button.bottom).toBeLessThanOrEqual(seen.slip.top + SLACK)
    expect(seen.button.right).toBeLessThanOrEqual(at.width + SLACK)
  })
}

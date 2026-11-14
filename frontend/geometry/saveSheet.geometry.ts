import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, notMeasured, SLACK, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE SHEET THAT ASKS „SAČUVATI DOGAĐAJ?" BEFORE A SAVE THAT TAKES THE RACES OF AN EVENT AWAY FITS THE WINDOW AT EVERY
 * WIDTH (owner, 07.11.2026, PDL „I čuvanje događaja koje briše njegove trke radi isto"; `pages/admin/EntityEditor.tsx`).
 *
 * It is `components/Prompt.tsx`, whose own geometry the deletion sheet's guard holds (`deleteSheet.geometry.ts`); what is
 * new here is the words in it (a longer title and a sentence with two numbers), so the question is the closed one: **does
 * the page grow sideways, and do the sheet and both of its buttons stay inside the window.** Three widths, 360, 768 and
 * 1280.
 */

test.use({ theDay: '2026-10-20' })

const sample = (name: string): Record<string, unknown>[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'))

const EVENT_WITH_TWO_RACES = 309

const ANSWERS: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/events': sample('events'),
  '/api/races': sample('races'),
  '/api/results': sample('results'),
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 360, text: 200 },
]

for (const at of WIDTHS) {
  test(`the sheet before a save that takes races away stays inside the window, ${label(at)}`, async ({ open }) => {
    const { page } = await open(
      at,
      `/sr/administracija/dogadjaji?izmena=${String(EVENT_WITH_TWO_RACES)}`,
      '.entity-editor',
      ANSWERS,
    )

    await page.getByLabel(/^Vrsta događaja/).selectOption('gathering')
    await page.getByRole('button', { name: 'Sačuvaj' }).click()

    const sheet = page.getByRole('dialog', { name: 'Sačuvati događaj?' })

    await sheet.waitFor({ state: 'visible', timeout: 15_000 })

    const seen = await page.evaluate(() => {
      const box = (one: Element) => {
        const found = one.getBoundingClientRect()

        return { left: found.left, right: found.right, top: found.top, bottom: found.bottom }
      }
      const dialog = document.querySelector('[role="dialog"]')

      if (dialog === null) {
        return null
      }

      return {
        sheet: box(dialog),
        buttons: [...dialog.querySelectorAll('button')].map((one) => ({ name: one.textContent ?? '', ...box(one) })),
        viewport: { width: document.documentElement.clientWidth, height: window.innerHeight },
        scroll: document.documentElement.scrollWidth,
      }
    })

    if (seen === null) {
      throw notMeasured('the question of the save drew no sheet')
    }

    expect(seen.buttons.map((one) => one.name).sort(), 'the sheet has its two buttons').toEqual(['Odustani', 'Sačuvaj'])
    expect(seen.scroll, 'the page grows sideways').toBeLessThanOrEqual(seen.viewport.width + SLACK)
    expect(seen.sheet.left, 'the sheet starts inside the window').toBeGreaterThanOrEqual(-SLACK)
    expect(seen.sheet.right, 'the sheet ends inside the window').toBeLessThanOrEqual(seen.viewport.width + SLACK)

    for (const one of seen.buttons) {
      expect(one.left, `${one.name} starts inside the sheet`).toBeGreaterThanOrEqual(seen.sheet.left - SLACK)
      expect(one.right, `${one.name} ends inside the sheet`).toBeLessThanOrEqual(seen.sheet.right + SLACK)
      expect(one.bottom, `${one.name} stays inside the window`).toBeLessThanOrEqual(seen.viewport.height + SLACK)
    }
  })
}

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE SENTENCE UNDER THE LIST OF SEASONS, WHEN THE FROZEN SEASONS COULD NOT BE READ, IS SEEN WHOLE AND MOVES
 * NOTHING SIDEWAYS (owner, 24.11.2026, PDL: „Kad ekran ne uspe da pročita koje su sezone zamrznute, ispod
 * spiska sezona piše rečenica."; the measurement asked for: 360, 768 and 1280, with the list open, the dark
 * theme the portal has).
 *
 * Asked in Chrome, because jsdom lays nothing out:
 *
 * 1. **Where `/api/frozen-seasons` is not answered** (the harness answers 404, which is a failed read) every
 *    opened list has its sentence directly under it, drawn, inside the table's box side to side, with no word
 *    broken inside the word, and the page does not scroll sideways.
 * 2. **Where it is answered** no list has a sentence, so the case above measures the failure and not the
 *    page.
 */

test.use({ theDay: '2026-10-20' })

const SAMPLE_AT = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'))

const BASE: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/members': SAMPLE_AT('members'),
  '/api/competitors': SAMPLE_AT('competitors'),
}

const SENTENCE = 'Prošle sezone se trenutno ne mogu menjati. Pokušaj ponovo za koji minut.'

for (const width of [360, 768, 1280]) {
  const at: At = { width, text: 100 }

  for (const [what, answers, said] of [
    ['read', { ...BASE, '/api/frozen-seasons': [{ season: 2027 }] }, false],
    ['not read', BASE, true],
  ] as const) {
    test(`the sentence of the frozen seasons that ${what} ${said ? 'stands under every opened list' : 'is nowhere'}, at ${label(at)}`, async ({
      open,
    }) => {
      const { page, probe } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', answers)

      await page.getByRole('combobox').first().selectOption('all')

      const toggles = page.locator('table.members-table button[aria-expanded]')

      for (let index = 0; index < (await toggles.count()); index += 1) {
        const toggle = toggles.nth(index)

        if (await toggle.isVisible()) {
          await toggle.click()
        }
      }

      await page.waitForLoadState('networkidle')
      await page.mouse.move(1, 1)

      const seen = await page.evaluate((sentence) => {
        const table = document.querySelector('table.members-table')
        const box = table?.closest('.table-scroll')

        if (table === null || table === undefined || box === null || box === undefined) {
          throw new Error('the table of the members is not on the page in a box of its own')
        }

        const drawn = (one: Element) => getComputedStyle(one).display !== 'none' && one.getClientRects().length > 0
        const lists = [...table.querySelectorAll('.members-seasons__list')].filter(drawn)
        const outer = box.getBoundingClientRect()
        const under = lists.map((list) => {
          const next = list.nextElementSibling
          const edges = next?.getBoundingClientRect()

          return {
            text: (next?.textContent ?? '').trim() === sentence,
            drawn: next !== null && next !== undefined && drawn(next) && (edges?.height ?? 0) > 0,
            below: edges !== undefined && edges.top >= list.getBoundingClientRect().bottom - 0.5,
            inside: edges !== undefined && edges.left >= outer.left - 0.5 && edges.right <= outer.right + 0.5,
            scrolls: next !== null && next !== undefined && next.scrollWidth > next.clientWidth,
          }
        })
        /* No word of the sentence stands on two lines: cut where the portal may cut it, at a space. */
        const broken = [...table.querySelectorAll('.members-seasons__unreadable')].filter(drawn).flatMap((one) => {
          const walk = document.createTreeWalker(one, NodeFilter.SHOW_TEXT)
          const wrong: string[] = []

          for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
            for (const word of (node.textContent ?? '').matchAll(/[^\s]+/g)) {
              const range = document.createRange()

              range.setStart(node, word.index)
              range.setEnd(node, word.index + word[0].length)

              if (new Set([...range.getClientRects()].map((rect) => Math.round(rect.top / 4))).size > 1) {
                wrong.push(word[0])
              }
            }
          }

          return wrong
        })

        return {
          lists: lists.length,
          under,
          broken,
          inside: box.scrollWidth,
          outside: box.clientWidth,
          anywhere: table.querySelectorAll('.members-seasons__unreadable').length,
        }
      }, SENTENCE)

      expect(probe.sideways).toBe(0)
      expect(probe.widened).toBe(0)
      /* Measured is not assumed: lists are open on the screen. */
      expect(seen.lists).toBeGreaterThan(0)
      expect(seen.inside, `the table's box scrolls: ${String(seen.inside)} inside ${String(seen.outside)}`).toBeLessThanOrEqual(
        seen.outside,
      )

      if (said) {
        expect(seen.under.every((one) => one.text && one.drawn && one.below && one.inside && !one.scrolls)).toBe(true)
        expect(seen.broken, 'words broken inside the word').toEqual([])
      } else {
        expect(seen.anywhere).toBe(0)
      }
    })
  }
}

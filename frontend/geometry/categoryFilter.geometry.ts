import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE FILTER OF THE CATEGORY IN THE BTL TABLES (owner, 21.11.2026, PDL: „Na desktopu filter … nije širok kao
 * strana nego koliko mu dugmad traže, levo; ostali filteri istog smisla na portalu dobijaju isti vizuelni
 * oblik, istu komponentu"), ASKED OF CHROME at 360, 768 and 1280, at the browser's own text and at 200%:
 *
 * <ol>
 * <li><b>The WORDS stay inside their buttons</b> (`scrollWidth <= clientWidth`, and the range of the text inside
 * the box of the button) and no two buttons overlap.
 * <li><b>The group stays inside the page</b>, and the page does not move sideways (PDL P24, WCAG 2.2 SC 1.4.10).
 * <li><b>At 1280px the group is as wide as its buttons ask and stands at the left</b> of the room it is given: not
 * wider than the buttons and their frame, and not centred or pushed right.
 * </ol>
 *
 * <p><b>Relations, never pixels.</b>
 */

function sample(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'))
}

/** What the tables read: the people, their results and no frozen season. */
const EVERY: Answers = {
  '/api/competitors': sample('competitors'),
  '/api/results': sample('results'),
  '/api/teams': sample('teams'),
  '/api/frozen-seasons': [],
}

const GROUP = '.seg[aria-labelledby="rankings-categories"]'

const WIDTHS: At[] = [360, 768, 1280].flatMap((width) => ([100, 200] as const).map((text): At => ({ width, text })))

for (const at of WIDTHS) {
  test(`the category filter of the tables: words in their buttons, nothing overlaps, ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, '/sr/tabela', `${GROUP} .seg__b`, EVERY)

    const seen = await page.evaluate((group) => {
      const root = document.querySelector(group)

      if (root === null) {
        return null
      }

      const box = (rect: DOMRect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })
      const field = root.parentElement?.getBoundingClientRect()
      const frame = getComputedStyle(root)

      return {
        viewport: document.documentElement.clientWidth,
        field: field === undefined ? null : box(field),
        group: box(root.getBoundingClientRect()),
        frame:
          parseFloat(frame.paddingLeft) + parseFloat(frame.paddingRight) + parseFloat(frame.borderLeftWidth) + parseFloat(frame.borderRightWidth),
        buttons: [...root.querySelectorAll('.seg__b')].map((one) => {
          const drawn: DOMRect[] = []
          const walk = document.createTreeWalker(one, NodeFilter.SHOW_TEXT)

          for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
            if ((node.textContent ?? '').trim() !== '') {
              const range = document.createRange()

              range.selectNodeContents(node)
              drawn.push(...range.getClientRects())
            }
          }

          return {
            text: (one.textContent ?? '').trim(),
            box: box(one.getBoundingClientRect()),
            overflow: one.scrollWidth - one.clientWidth,
            words: drawn.map(box),
          }
        }),
      }
    }, GROUP)

    if (seen === null) {
      throw notMeasured('the tables drew no category filter')
    }

    expect(seen.buttons.length, 'the filter has „Sve" and at least one category').toBeGreaterThan(1)

    for (const one of seen.buttons) {
      expect(one.overflow, `the words of „${one.text}" run out of their button`).toBeLessThanOrEqual(SLACK)
      expect(one.words.length, `„${one.text}" draws no words`).toBeGreaterThan(0)

      for (const word of one.words) {
        expect(word.left, `the words of „${one.text}" start left of the button`).toBeGreaterThanOrEqual(one.box.left - SLACK)
        expect(word.right, `the words of „${one.text}" end right of the button`).toBeLessThanOrEqual(one.box.right + SLACK)
      }

      expect(one.box.left, `„${one.text}" starts left of the group`).toBeGreaterThanOrEqual(seen.group.left - SLACK)
      expect(one.box.right, `„${one.text}" runs off the group`).toBeLessThanOrEqual(seen.group.right + SLACK)
    }

    for (const [index, one] of seen.buttons.entries()) {
      for (const other of seen.buttons.slice(index + 1)) {
        const crosses =
          one.box.left < other.box.right - SLACK &&
          other.box.left < one.box.right - SLACK &&
          one.box.top < other.box.bottom - SLACK &&
          other.box.top < one.box.bottom - SLACK

        expect(crosses, `„${one.text}" and „${other.text}" overlap`).toBe(false)
      }
    }

    expect(seen.group.left, 'the group starts left of the page').toBeGreaterThanOrEqual(-SLACK)
    expect(seen.group.right, 'the group runs off the page').toBeLessThanOrEqual(seen.viewport + SLACK)
    expect(probe.sideways, 'the page scrolls sideways').toBe(0)
    expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)

    if (at.width === 1280 && at.text === 100) {
      const asked = seen.buttons.reduce((sum, one) => sum + (one.box.right - one.box.left), 0) + seen.frame

      expect(seen.group.right - seen.group.left, 'the group is wider than its buttons ask').toBeLessThanOrEqual(asked + SLACK)

      if (seen.field !== null) {
        expect(seen.group.left, 'the group does not stand at the left of its field').toBeLessThanOrEqual(seen.field.left + SLACK)
        expect(seen.field.right - seen.field.left, 'the field is as wide as the page and not as its buttons').toBeLessThan(seen.viewport / 2)
      }
    }
  })
}

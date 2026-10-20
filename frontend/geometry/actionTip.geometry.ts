import { readFileSync } from 'node:fs'
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

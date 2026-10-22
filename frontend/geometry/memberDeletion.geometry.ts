import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE DELETION OF A MEMBER ON THE MODERATION OF THE MEMBERS, ASKED OF CHROME (owner, 22.10.2026, PDL
 * „Brisanje člana na ekranu članova": „dugme „Obriši" je odvojeno razmakom od „Upiši uplatu" i
 * „Storniraj"; potvrda umesto „Sigurno?" kaže „Obriši člana?" uz dugmad „Obriši" i „Odustani"; posle
 * brisanja se na ekranu vidi poruka „Član je obrisan."").
 *
 * The occasion was measured in Chrome at 1280 and 360: the three squares of the record stood one under
 * another with nothing between, and a press three pixels under „Storniraj" landed on „Obriši". jsdom
 * lays nothing out, so what only a browser can say is asked here:
 *
 * 1. **A distance stands between the deletion and the action over it, on every row**, at least the
 *    height of a finger's slop (16px; the page keeps 20).
 * 2. **A press three pixels under the lowest of the other actions of a row lands on nothing of the
 *    deletion**, found by what Chrome says stands at that point and not by the numbers above.
 * 3. **The question, once asked, fits**: the page does not scroll sideways at any width, and the two
 *    buttons are inside the window. It says „Obriši člana?" and „Odustani".
 * 4. **After the deletion the sentence is on the screen**, in a box of its own that is not clipped to a
 *    pixel (`visually-hidden`), inside the window.
 */

/** The day the moderation of the members is read on. */
test.use({ theDay: '2026-10-20' })

function sample<T>(name: string): T {
  const read: T = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'),
  )

  return read
}

const ANSWERS: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/members': sample('members'),
  '/api/competitors': sample('competitors'),
}

/** What a finger's slop asks of the distance, in pixels; the page keeps more (`AdminMembers.css`). */
const LEAST_APART = 16

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 360, text: 200 },
]

for (const at of WIDTHS) {
  test(`the deletion of a member is held apart from the actions over it, on every row, at ${label(at)}`, async ({
    open,
  }) => {
    const { page } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', ANSWERS)

    /* Everybody ever given a number, so every kind of record is among the rows. */
    await page.getByRole('combobox').first().selectOption('all')
    await page.getByRole('button', { name: /^Obriši: / }).first().waitFor({ state: 'visible' })

    const seen = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('table.members-table tbody tr')]

      return rows.map((row) => {
        const cell = row.lastElementChild
        const buttons = cell === null ? [] : [...cell.querySelectorAll('button')]
        const own = buttons.find((one) => (one.getAttribute('aria-label') ?? '').startsWith('Obriši: '))
        const over = buttons.filter((one) => one !== own)

        if (own === undefined) {
          return { name: row.textContent ?? '', over: over.length, gap: null, landsOnIt: null, shift: null }
        }

        const lowest = over.reduce<HTMLElement | null>(
          (low, one) => (low === null || one.getBoundingClientRect().bottom > low.getBoundingClientRect().bottom ? one : low),
          null,
        )

        if (lowest === null) {
          return { name: row.textContent ?? '', over: 0, gap: null, landsOnIt: null, shift: null }
        }

        const above = lowest.getBoundingClientRect()
        const below = own.getBoundingClientRect()
        /* Three pixels under the lowest action, in the middle of it: where the owner's press landed. */
        const hit = document.elementFromPoint(above.left + above.width / 2, above.bottom + 3)

        return {
          name: own.getAttribute('aria-label') ?? '',
          over: over.length,
          gap: below.top - above.bottom,
          landsOnIt: hit !== null && (hit === own || own.contains(hit)),
          /* Where the two stand across: the deletion ends where the actions over it end, as it did when
             it stood in their line, and does not start at the other side of the cell. */
          shift: Math.abs(below.right - above.right),
        }
      })
    })

    /* Measured is not assumed: there are rows, and they carry actions over the deletion. */
    expect(seen.length).toBeGreaterThan(3)
    expect(seen.filter((one) => one.gap === null)).toEqual([])
    expect(seen.reduce((sum, one) => sum + one.over, 0)).toBeGreaterThan(seen.length)

    for (const one of seen) {
      expect(one.gap, `the distance over the deletion of ${one.name}`).toBeGreaterThanOrEqual(LEAST_APART)
      expect(one.landsOnIt, `a press 3px under the action over ${one.name} lands on its deletion`).toBe(false)
      expect(one.shift, `the deletion of ${one.name} stands under the actions over it, not across from them`).toBeLessThanOrEqual(1)
    }
  })
}

for (const at of WIDTHS) {
  test(`the question about deleting a member fits, and the sentence after it is on the screen, at ${label(at)}`, async ({
    open,
  }) => {
    const { page } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', ANSWERS)

    /* The server answers the deletion; everything else the harness answers as it does. */
    await page.route('**/api/competitors/*', (route) =>
      route.request().method() === 'DELETE' ? route.fulfill({ status: 200, json: {} }) : route.fallback(),
    )

    await page.getByRole('combobox').first().selectOption('all')

    const cross = page.getByRole('button', { name: /^Obriši: / }).first()
    const name = (await cross.getAttribute('aria-label'))?.replace('Obriši: ', '') ?? ''

    expect(name).not.toBe('')

    await cross.scrollIntoViewIfNeeded()
    await cross.click()

    const sure = page.getByRole('button', { name: `Obriši člana? ${name}` })
    const keep = page.getByRole('button', { name: `Odustani od brisanja: ${name}` })

    await sure.waitFor({ state: 'visible' })

    expect(await sure.textContent()).toBe('Obriši člana?')
    expect(await keep.textContent()).toBe('Odustani')
    await expect(page.getByRole('button', { name: /^Potvrdi brisanje/ })).toHaveCount(0)

    const asked = await page.evaluate(() => {
      const inside = (one: Element | null) => {
        const box = one?.getBoundingClientRect()

        return box === undefined ? false : box.left >= 0 && box.right <= document.documentElement.clientWidth
      }
      const root = document.documentElement
      const buttons = [...document.querySelectorAll('table.members-table button')].filter(
        (one) => (one.textContent ?? '').trim() === 'Obriši člana?' || (one.textContent ?? '').trim() === 'Odustani',
      )

      return {
        sideways: Math.max(0, root.scrollWidth - root.clientWidth),
        buttons: buttons.length,
        inside: buttons.every((one) => inside(one)),
      }
    })

    expect(asked.buttons).toBe(2)

    if (at.text === 100) {
      expect(asked.sideways).toBe(0)
      expect(asked.inside, 'both buttons are inside the window').toBe(true)
    } else {
      expect(asked.sideways).toBe(0)
    }

    await sure.click()

    const said = page.getByText('Član je obrisan.')

    await said.waitFor({ state: 'visible' })

    const drawn = await said.evaluate((one) => {
      const box = one.getBoundingClientRect()
      const root = document.documentElement

      return {
        height: box.height,
        width: box.width,
        left: box.left,
        right: box.right,
        window: root.clientWidth,
        sideways: Math.max(0, root.scrollWidth - root.clientWidth),
        clipped: getComputedStyle(one).clip !== 'auto' || getComputedStyle(one).position === 'absolute',
      }
    })

    /* Drawn and not clipped to a pixel (`visually-hidden`, which Chrome still reports as a box). */
    expect(drawn.clipped).toBe(false)
    expect(drawn.height).toBeGreaterThanOrEqual(16)
    expect(drawn.width).toBeGreaterThanOrEqual(100)
    expect(drawn.left).toBeGreaterThanOrEqual(0)
    expect(drawn.right).toBeLessThanOrEqual(drawn.window)
    expect(drawn.sideways).toBe(0)
    await expect(page.getByRole('button', { name: `Obriši: ${name}` })).toHaveCount(0)
  })
}

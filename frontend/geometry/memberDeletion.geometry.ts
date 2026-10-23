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
 *    buttons are inside the window. The question is a sentence, „Obriši člana?", beside the two buttons
 *    „Obriši" and „Odustani" (the review the owner chose).
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

    const sure = page.getByRole('button', { name: `Obriši člana: ${name}` })
    const keep = page.getByRole('button', { name: `Odustani od brisanja: ${name}` })

    await sure.waitFor({ state: 'visible' })

    expect(await sure.textContent()).toBe('Obriši')
    /* The question is a sentence of its own beside them, and not on a button. */
    await expect(page.getByText('Obriši člana?')).toBeVisible()
    expect(await page.getByText('Obriši člana?').evaluate((one) => one.closest('button') === null)).toBe(true)
    expect(await keep.textContent()).toBe('Odustani')
    await expect(page.getByRole('button', { name: /^Potvrdi brisanje/ })).toHaveCount(0)

    const asked = await page.evaluate(() => {
      const inside = (one: Element | null) => {
        const box = one?.getBoundingClientRect()

        return box === undefined ? false : box.left >= 0 && box.right <= document.documentElement.clientWidth
      }
      const root = document.documentElement
      /* Only the row that asks: every other row still has its cross, whose word is „Obriši" too. */
      const asking = [...document.querySelectorAll('table.members-table .entity-row-note')]
        .find((one) => (one.textContent ?? '').trim() === 'Obriši člana?')
        ?.closest('tr')
      const buttons = [...(asking?.querySelectorAll('button') ?? [])].filter(
        (one) => (one.textContent ?? '').trim() === 'Obriši' || (one.textContent ?? '').trim() === 'Odustani',
      )
      const sentence = [...document.querySelectorAll('table.members-table .entity-row-note')].filter(
        (one) => (one.textContent ?? '').trim() === 'Obriši člana?',
      )

      return {
        sideways: Math.max(0, root.scrollWidth - root.clientWidth),
        buttons: buttons.length,
        inside: buttons.every((one) => inside(one)) && sentence.every((one) => inside(one)),
        sentences: sentence.length,
      }
    })

    expect(asked.buttons).toBe(2)
    expect(asked.sentences).toBe(1)

    /* The page does not scroll sideways at any text size; the buttons and the sentence stand inside the
       window at the ordinary one (at 200% the table's box may scroll, PDL P24). */
    expect(asked.sideways).toBe(0)

    if (at.text === 100) {
      expect(asked.inside, 'the sentence and both buttons are inside the window').toBe(true)
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

/**
 * A DOUBLE PRESS ON THE CROSS DELETES NOBODY, AT ANY WIDTH (review of PR 632, high; measured: at 768, 560
 * and 900 the confirming „Obriši" stood exactly under the cross after the first press, so a real
 * `dblclick` sent `DELETE /api/competitors/000001?account=delete` and said „Član je obrisan.").
 *
 * The first press of a double press opens the question; the second lands where the pointer is. So the
 * place of the cross must be taken by something that does nothing when pressed (the sentence), at EVERY
 * width and on every shape of the record, because the widths where the question wrapped differently were
 * found between the ones that were asked: every 40px from 360 to 1280, and 360 at 200% text. Four
 * shapes of the record (the exemption, a payment, the balance, nothing), and the two a moderator makes
 * (the record after a cancellation, and after the exemption is granted again), each pressed twice in
 * quick succession by `dblclick` and by two presses one after the other.
 *
 * Asked of Chrome by what really happens: the requests that left the page and the sentence on it, never
 * by where the two buttons stand.
 */
const SHAPES = (() => {
  const members = sample<Record<string, unknown>[]>('members')

  return members.map((one, index) => {
    if (index === 1) {
      return { ...one, membershipBasis: 'payment', seasons: [{ season: 2027, basis: 'payment' }] }
    }

    if (index === 2) {
      return { ...one, membershipBasis: 'balance', seasons: [{ season: 2027, basis: 'balance' }] }
    }

    return one
  })
})()

const SWEEP: At[] = [
  ...Array.from({ length: 24 }, (_, step): At => ({ width: 360 + step * 40, text: 100 })),
  { width: 360, text: 200 },
]

for (const at of SWEEP) {
  test(`a double press on the cross deletes nobody, on every shape of the record, at ${label(at)}`, async ({
    open,
  }) => {
    let members: Record<string, unknown>[] = SHAPES.map((one) => ({ ...one }))
    const { page } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', ANSWERS)
    const deletions: string[] = []

    await page.route('**/api/competitors/*', (route) => {
      if (route.request().method() === 'DELETE') {
        deletions.push(route.request().url())

        return route.fulfill({ status: 200, json: {} })
      }

      return route.fallback()
    })
    await page.route('**/api/members', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ status: 200, json: members }) : route.fallback(),
    )
    await page.route('**/api/members/**', (route) => route.fulfill({ status: 200, json: {} }))

    /* Read the list again under the routes above, so that the screen shows what they serve. */
    await page.reload()
    await page.locator('table.members-table tbody tr').first().waitFor({ state: 'visible' })
    await page.getByRole('combobox').first().selectOption('all')

    const numbers = SHAPES.map((one) => String(one.memberNumber))
    const rowOf = (number: string) => page.locator('table.members-table tbody tr', { hasText: number }).first()

    /* The cross of a row pressed twice, two ways, and the question put away after each. */
    async function pressTwice(number: string, what: string) {
      for (const how of ['dblclick', 'two presses'] as const) {
        const cross = rowOf(number).getByRole('button', { name: /^Obriši: / })

        await cross.scrollIntoViewIfNeeded()

        if (how === 'dblclick') {
          await cross.dblclick()
        } else {
          const box = await cross.boundingBox()

          if (box === null) {
            throw new Error(`the cross of ${number} has no box`)
          }

          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        }

        await page.waitForTimeout(150)

        expect(deletions, `${how} on the cross of ${number} (${what}) sent a deletion`).toEqual([])
        await expect(page.getByText('Član je obrisan.')).toHaveCount(0)

        /* Measured is not assumed: the question really was asked by the first press. */
        await expect(rowOf(number).getByText('Obriši člana?')).toBeVisible()

        await rowOf(number).getByRole('button', { name: /^Odustani/ }).click()
        await expect(rowOf(number).getByText('Obriši člana?')).toHaveCount(0)
      }
    }

    for (const [index, number] of numbers.slice(0, 4).entries()) {
      await pressTwice(number, ['the exemption', 'a payment', 'the balance', 'the exemption'][index] ?? '')
    }

    /* A row that holds nothing: the first of the sample that does not. */
    const empty = numbers.find((_, index) => SHAPES[index]?.membershipBasis === undefined)

    if (empty !== undefined) {
      await pressTwice(empty, 'nothing')
    }

    /* AFTER A CANCELLATION: the record of the first row loses its season, which is what the screen
       draws once the route has answered, and the row is laid out again. */
    const first = numbers[0] ?? ''
    const was = { ...(SHAPES[0] ?? {}) }

    members = members.map((one) =>
      one.memberNumber === first ? { ...one, membershipBasis: undefined, membershipSeason: undefined, seasons: [] } : one,
    )
    await rowOf(first).getByRole('button', { name: 'Storniraj' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Da' }).click()
    await rowOf(first).getByRole('button', { name: 'Odobri oslobođenje' }).waitFor({ state: 'visible' })
    await pressTwice(first, 'after a cancellation')

    /* AND AFTER THE EXEMPTION IS GRANTED AGAIN. */
    members = members.map((one) => (one.memberNumber === first ? { ...was } : one))
    await rowOf(first).getByRole('button', { name: 'Odobri oslobođenje' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Da' }).click()
    await rowOf(first).getByRole('button', { name: 'Storniraj' }).waitFor({ state: 'visible' })
    await pressTwice(first, 'after the exemption was granted again')
  })
}

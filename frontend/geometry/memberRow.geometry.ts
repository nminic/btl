import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE ACTIONS OF A MEMBER'S ROW ON THE MODERATION OF THE MEMBERS, ASKED OF CHROME (owner, 22.10.2026, PDL
 * „Red na ekranu članova ima pet kolona" and „Potvrda brisanja više nije rečenica u redu tabele nego
 * iskačući prozor": „Obriši člana?" [Obriši] [Odustani], „Član je obrisan." on the screen, and the symbol
 * of the deletion in the row, held apart from the others).
 *
 * It took over from `memberDeletion.geometry.ts` (PR 632), whose question stood in the row and is a sheet
 * over the page now. What that guard asked is asked here of the new shape, and the review of PR 632 is
 * why each part is here:
 *
 * 1. **A distance stands between the deletion and the action beside it, on every row**, at least a
 *    finger's slop (16px), and a press 3px past the edge of that action lands on nothing of the deletion,
 *    found by what Chrome says stands at that point. **And every symbol stands at the same place on every
 *    row**, which is what the places that never move are for (the coordinator's answer of 22.10.2026, P3).
 * 2. **The sheet, once open, fits**, and after the deletion „Član je obrisan." is on the screen, in a box
 *    of its own that is not clipped to a pixel (`visually-hidden`), inside the window.
 * 3. **A double press deletes, cancels, grants and books nothing, at any width.** The first press opens a
 *    sheet and the second lands where the pointer is: measured on 22.10.2026 at 360px, inside the sheet.
 *    Asked by what really happens (the requests that leave the page), on the four symbols and on the box
 *    of the season on sale, on every shape of the record, by `dblclick` and by two presses, every 40px
 *    from 360 to 1280 and at 768, 900 and 360 with the text at 200%.
 * 4. **And near the bottom edge of the window**, where PR 632's question scrolled the page under the
 *    pointer: the sheet is fixed to the window, so nothing scrolls, and at most one sheet is open.
 */

/** The day the moderation of the members is read on. */
test.use({ theDay: '2026-10-20' })

function sample<T>(name: string): T {
  const read: T = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'),
  )

  return read
}

/**
 * THE SAMPLE WITH EVERY SHAPE OF THE RECORD IN ITS FIRST FOUR ROWS: the exemption, a payment, the balance,
 * and nothing of the season on sale. The fourth keeps an older season, so its list holds a box that
 * cannot be changed beside one that can.
 */
const SHAPES = sample<Record<string, unknown>[]>('members').map((one, index) => {
  if (index === 1) {
    return { ...one, membershipBasis: 'payment', membershipSeason: 2027, seasons: [{ season: 2027, basis: 'payment' }] }
  }

  if (index === 2) {
    return { ...one, membershipBasis: 'balance', membershipSeason: 2027, seasons: [{ season: 2027, basis: 'balance' }] }
  }

  if (index === 3) {
    return { ...one, membershipBasis: undefined, membershipSeason: undefined, seasonOnSale: 2028, seasons: [{ season: 2027, basis: 'payment' }] }
  }

  return one
})

const ANSWERS: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/members': SHAPES,
  '/api/competitors': sample('competitors'),
}

/** What a finger's slop asks of the distance, in pixels (`AdminMembers.css`). */
const LEAST_APART = 16

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 360, text: 200 },
]

/** Every request that is not a read, as the page sent it. */
async function writesOf(page: Page): Promise<string[]> {
  const writes: string[] = []

  await page.route('**/api/**', (route) => {
    if (route.request().method() !== 'GET') {
      writes.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)

      return route.fulfill({ status: 200, json: {} })
    }

    return route.fallback()
  })

  return writes
}

/** Every member ever given a number, so every shape of the record is a row. */
async function everybody(page: Page): Promise<void> {
  await page.getByRole('combobox').first().selectOption('all')
  await page.getByRole('button', { name: /^Obriši: / }).first().waitFor({ state: 'visible' })
}

for (const at of WIDTHS) {
  test(`the deletion of a member is held apart and stands at one place on every row, at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', ANSWERS)

    await everybody(page)

    const seen = await page.evaluate(() =>
      [...document.querySelectorAll('table.members-table tbody tr')].map((row) => {
        const buttons = [...row.querySelectorAll('td:last-child button')]
        const own = buttons.find((one) => (one.getAttribute('aria-label') ?? '').startsWith('Obriši: '))
        const beside = buttons.find((one) => (one.textContent ?? '').trim() === 'Storniraj')

        if (own === undefined || beside === undefined) {
          return { name: row.textContent ?? '', gap: null, landsOnIt: null, left: null, payment: null, cancel: null }
        }

        const near = beside.getBoundingClientRect()
        const far = own.getBoundingClientRect()
        /* Three pixels past the edge of „Storniraj", on its middle: where a press meant for it lands. */
        const hit = document.elementFromPoint(near.right + 3, near.top + near.height / 2)

        /* Where each of the symbols stands across, by its word: the places never move. */
        const place = (word: string) =>
          Math.round(buttons.find((one) => (one.textContent ?? '').trim() === word)?.getBoundingClientRect().left ?? -1)

        return {
          name: own.getAttribute('aria-label') ?? '',
          gap: far.left - near.right,
          landsOnIt: hit !== null && (hit === own || own.contains(hit)),
          left: Math.round(far.left),
          payment: place('Upiši uplatu'),
          cancel: place('Storniraj'),
        }
      }),
    )

    /* Measured is not assumed: every row carries both. */
    expect(seen.length).toBeGreaterThan(3)
    expect(seen.filter((one) => one.gap === null)).toEqual([])

    for (const one of seen) {
      expect(one.gap, `the distance beside the deletion of ${one.name}`).toBeGreaterThanOrEqual(LEAST_APART)
      expect(one.landsOnIt, `a press 3px past „Storniraj" lands on the deletion of ${one.name}`).toBe(false)
    }

    /* EVERY SYMBOL AT ONE PLACE ON EVERY ROW, and not the deletion alone: a row that drew one place fewer
       would move the others while the deletion, set to the right of the cell, stayed where it was. */
    for (const symbol of ['left', 'payment', 'cancel'] as const) {
      const places = seen.map((one) => one[symbol] ?? -1)

      expect(places.filter((one) => one < 0), `rows without ${symbol}`).toEqual([])
      expect(Math.max(...places) - Math.min(...places), `${symbol} does not stand at one place on every row`).toBeLessThanOrEqual(1)
    }
  })

  test(`the sheet about deleting a member fits, and the sentence after it is on the screen, at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', ANSWERS)
    const writes = await writesOf(page)

    await everybody(page)

    const cross = page.getByRole('button', { name: /^Obriši: / }).nth(2)
    const name = (await cross.getAttribute('aria-label'))?.replace('Obriši: ', '') ?? ''

    expect(name).not.toBe('')

    await cross.scrollIntoViewIfNeeded()
    await cross.click()

    const sheet = page.getByRole('dialog', { name: 'Obriši člana?' })

    await sheet.waitFor({ state: 'visible' })
    await expect(sheet.getByText(name)).toBeVisible()

    const asked = await page.evaluate(() => {
      const root = document.documentElement
      const sheet = document.querySelector('[role="dialog"]')
      const buttons = [...(sheet?.querySelectorAll('button') ?? [])]

      return {
        sideways: Math.max(0, root.scrollWidth - root.clientWidth),
        words: buttons.map((one) => (one.textContent ?? '').trim()),
        inside: buttons.every((one) => {
          const box = one.getBoundingClientRect()

          return box.left >= 0 && box.right <= root.clientWidth && box.top >= 0 && box.bottom <= innerHeight
        }),
      }
    })

    expect(asked.words).toEqual(['Obriši', 'Odustani'])
    expect(asked.sideways).toBe(0)
    expect(asked.inside, 'both buttons of the sheet are inside the window').toBe(true)

    await sheet.getByRole('button', { name: 'Obriši' }).click()

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

    expect(writes).toHaveLength(1)
    expect(drawn.clipped).toBe(false)
    expect(drawn.height).toBeGreaterThanOrEqual(16)
    expect(drawn.width).toBeGreaterThanOrEqual(100)
    expect(drawn.left).toBeGreaterThanOrEqual(0)
    expect(drawn.right).toBeLessThanOrEqual(drawn.window)
    expect(drawn.sideways).toBe(0)
  })
}

/**
 * THE LIST OF SEASONS IS SHUT UNTIL IT IS OPENED (review of PR 638, high): a `display` written on its class
 * drew every list open while its button said `aria-expanded="false"`, and nothing above saw it, because
 * `membersTable.geometry.ts` opens every list before it measures. Asked here of the list this width draws,
 * on a row of every shape: shut, it takes no room and its button says so; opened, it does, and says so.
 */
for (const at of WIDTHS.filter((one) => one.text === 100)) {
  test(`the list of seasons takes no room until it is opened, at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', ANSWERS)

    await everybody(page)

    const rows = page.locator('table.members-table tbody tr')

    for (let index = 0; index < 4; index += 1) {
      const toggle = rows.nth(index).locator('button[aria-expanded]').filter({ visible: true }).first()
      const list = page.locator(`[id="${(await toggle.getAttribute('aria-controls')) ?? ''}"]`)
      const height = async () => (await list.evaluate((one) => one.getBoundingClientRect().height))

      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(await height(), `the shut list of row ${String(index)} takes room`).toBe(0)

      await toggle.click()

      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(await height(), `the open list of row ${String(index)} takes no room`).toBeGreaterThan(0)
    }
  })
}

const SWEEP: At[] = [
  ...Array.from({ length: 24 }, (_, step): At => ({ width: 360 + step * 40, text: 100 })),
  { width: 360, text: 200 },
  { width: 768, text: 100 },
  { width: 900, text: 100 },
]

for (const at of SWEEP) {
  test(`a double press writes nothing on any action of a row, on every shape of the record, at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', ANSWERS)
    const writes = await writesOf(page)

    await everybody(page)

    const rows = page.locator('table.members-table tbody tr')
    let pressed = 0

    for (let index = 0; index < 4; index += 1) {
      const row = rows.nth(index)
      /* The list of seasons this width draws, opened, so its box can be pressed. */
      const toggle = row.locator('button[aria-expanded]').filter({ visible: true }).first()

      await toggle.scrollIntoViewIfNeeded()
      await toggle.click()

      const controls = [
        row.getByRole('button', { name: /^Obriši: / }),
        row.getByRole('button', { name: 'Storniraj' }),
        row.getByRole('button', { name: 'Upiši uplatu' }),
        row.getByRole('checkbox').filter({ visible: true }).last(),
      ]

      for (const control of controls) {
        if ((await control.getAttribute('aria-disabled')) === 'true' || (await control.isDisabled())) {
          continue
        }

        for (const how of ['dblclick', 'two presses'] as const) {
          await control.scrollIntoViewIfNeeded()

          if (how === 'dblclick') {
            await control.dblclick()
          } else {
            const box = await control.boundingBox()

            if (box === null) {
              throw new Error(`a control of row ${String(index)} has no box`)
            }

            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
          }

          await page.waitForTimeout(150)

          /* Measured is not assumed: the first press really did open a sheet, and only one. */
          await expect(page.getByRole('dialog')).toHaveCount(1)
          expect(writes, `${how} on row ${String(index)} wrote`).toEqual([])
          await expect(page.getByText('Član je obrisan.')).toHaveCount(0)

          await page.keyboard.press('Escape')
          await expect(page.getByRole('dialog')).toHaveCount(0)
          pressed += 1
        }
      }
    }

    /* Every shape was pressed on, both ways: the deletion and the box on all four rows, „Storniraj" on the
       three that hold the season on sale, „Upiši uplatu" on the exemption and on the row that holds
       nothing. Thirteen controls. */
    expect(pressed).toBe(26)
  })
}

const NEAR_THE_EDGE = [1, 13, 20, 40, 60]
const EDGE_SCREENS: At[] = [
  ...[360, 560, 768, 900, 1280].map((width): At => ({ width, text: 100 })),
  ...[360, 768, 1280].map((width): At => ({ width, text: 200 })),
]

for (const at of EDGE_SCREENS) {
  test(`a double press on a cross near the bottom edge deletes nobody and opens one sheet, at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', ANSWERS)
    const writes = await writesOf(page)

    await everybody(page)

    const cross = page.locator('table.members-table tbody tr').nth(5).getByRole('button', { name: /^Obriši: / })

    for (const gap of NEAR_THE_EDGE) {
      await cross.scrollIntoViewIfNeeded()

      /* The cross set so that its bottom stands `gap` pixels above the bottom edge of the window. */
      await cross.evaluate((one, above) => {
        const box = one.getBoundingClientRect()

        window.scrollBy(0, box.bottom - (innerHeight - above))
      }, gap)

      const scrolled = await page.evaluate(() => scrollY)
      const box = await cross.boundingBox()

      if (box === null) {
        throw new Error('the cross has no box')
      }

      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(150)

      expect(writes, `a double press ${String(gap)}px above the edge deleted`).toEqual([])
      await expect(page.getByRole('dialog')).toHaveCount(1)
      expect(await page.evaluate(() => scrollY), 'the page scrolled under the pointer').toBe(scrolled)

      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  })
}

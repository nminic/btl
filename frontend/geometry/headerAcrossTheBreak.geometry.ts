import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { test } from './support/harness.ts'
import type { At } from './support/harness.ts'

/**
 * THE HEADER KEEPS WHAT THE READER HAD WHEN THE WINDOW CROSSES 700px, in either direction (PENDING, review of
 * PR 755, 17.11.2026: „pri promeni širine preko 700 px u hodu (rotacija telefona) fokus pada na BODY, a otvoren
 * panel naloga se zatvara", measured in all four directions, 699 to 700 and back and 360x740 to 740x360 and
 * back).
 *
 * <p>What jsdom cannot answer: it has no window to turn. On a telephone the envelope and the picture stand in
 * the second row after the words and on a desktop in the first row after the language (`app/phoneHeader.ts`
 * says why they are two orders of the document), so crossing the width draws them in another place, and the
 * navigation moved from the row of cells to the header with them. A reader who turns the telephone with the
 * panel of his account open, or with the focus on a word of the navigation, meets a page that has forgotten
 * both. Asked of the browser: the same control has the focus after the turn, and a panel that was open is open.
 *
 * <p>Dark theme only (the light one is leaving the portal).
 */

const HIM = (() => {
  const all: unknown = JSON.parse(
    readFileSync(fileURLToPath(new URL('../src/test/mock/competitors.json', import.meta.url)), 'utf-8'),
  )

  return { ...(Array.isArray(all) ? all[0] : {}), active: true, membershipBasis: 'payment' }
})()

const INBOX = JSON.parse(readFileSync(fileURLToPath(new URL('../src/test/mock/inbox.json', import.meta.url)), 'utf-8'))

const ANSWERS = {
  '/api/me': { role: 'competitor', account: 1, member: HIM, mailLanguage: 'sr' },
  '/api/inbox': INBOX,
}

/** The turns: the width of a window across 700px and back, and a telephone laid on its side and up again. */
const TURNS: { from: { width: number; height: number }; to: { width: number; height: number } }[] = [
  { from: { width: 699, height: 900 }, to: { width: 700, height: 900 } },
  { from: { width: 700, height: 900 }, to: { width: 699, height: 900 } },
  { from: { width: 360, height: 740 }, to: { width: 740, height: 360 } },
  { from: { width: 740, height: 360 }, to: { width: 360, height: 740 } },
]

const at = (size: { width: number; height: number }): At => ({ ...size, text: 100 })

const turn = (one: (typeof TURNS)[number]) => `${one.from.width}x${one.from.height} to ${one.to.width}x${one.to.height}`

/** What has the focus, said as an address or a name the two shapes of the header both give it. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const now = document.activeElement

    return now === null || now === document.body
      ? 'the body'
      : (now.getAttribute('href') ?? now.getAttribute('aria-controls') ?? now.getAttribute('aria-label') ?? now.tagName)
  })

/** Waits for the header to be the shape the window now asks for, which only the new state has (a window turned
 *  is read by the page a moment later, and a read taken before that is a read of the old header, which holds the
 *  focus it always held), and then for it to stop moving. */
async function settleAfterTheTurn(page: Page, to: { width: number }): Promise<void> {
  const phone = to.width < 700

  await page.waitForFunction(
    (wanted) => document.querySelector('header.shell__header')?.classList.contains('shell__header--phone') === wanted,
    phone,
  )
  await page.waitForFunction(() => document.getAnimations().length === 0)
  /* Two frames, so a header that was redrawn for the new width has been. */
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
}

for (const one of TURNS) {
  test(`the word of the navigation that has the focus keeps it when the window turns ${turn(one)}`, async ({
    open,
  }) => {
    const { page } = await open(at(one.from), '/sr/kalendar', 'header .brand', ANSWERS)
    const word = page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('link').nth(1)
    const address = await word.getAttribute('href')

    await word.focus()
    expect(await focused(page)).toBe(address)

    await page.setViewportSize(one.to)
    await settleAfterTheTurn(page, one.to)

    expect(await focused(page)).toBe(address)
  })

  for (const [panel, button] of [
    ['account', 'Otvori nalog'],
    ['messages', /^Otvori poruke/],
  ] as const) {
    test(`the panel of the ${panel} that is open stays open, and the focus stays on its button, when the window turns ${turn(one)}`, async ({
      open,
    }) => {
      const { page } = await open(at(one.from), '/sr/kalendar', 'header .brand', ANSWERS)

      await page.getByRole('button', { name: button }).click()

      const opened = page.getByRole('button', { name: button })

      await expect(opened).toHaveAttribute('aria-expanded', 'true')

      const controls = await opened.getAttribute('aria-controls')

      expect(controls, 'the panel has an id').not.toBeNull()

      await page.setViewportSize(one.to)
      await settleAfterTheTurn(page, one.to)

      const after = page.getByRole('button', { name: button })

      await expect(after).toHaveAttribute('aria-expanded', 'true')
      await expect(page.locator(`#${controls ?? ''}`)).toBeVisible()
      expect(await focused(page)).toBe(controls)
    })
  }
}

for (const one of TURNS) {
  test(`a control inside the open panel of the account keeps the focus when the window turns ${turn(one)}`, async ({
    open,
  }) => {
    const { page } = await open(at(one.from), '/sr/kalendar', 'header .brand', ANSWERS)

    await page.getByRole('button', { name: 'Otvori nalog' }).click()

    const inside = page.locator('#account-menu a').first()
    const address = await inside.getAttribute('href')

    expect(address, 'the panel holds a link').not.toBeNull()

    await inside.focus()
    expect(await focused(page)).toBe(address)

    await page.setViewportSize(one.to)
    await settleAfterTheTurn(page, one.to)

    await expect(page.locator('#account-menu')).toBeVisible()
    expect(await focused(page)).toBe(address)
  })
}

for (const one of TURNS.slice(0, 1)) {
  test(`a panel that was shut is still shut after the window turns ${turn(one)}`, async ({ open }) => {
    const { page } = await open(at(one.from), '/sr/kalendar', 'header .brand', ANSWERS)

    await page.setViewportSize(one.to)
    await settleAfterTheTurn(page, one.to)

    await expect(page.getByRole('button', { name: 'Otvori nalog' })).toHaveAttribute('aria-expanded', 'false')
    expect(await focused(page)).toBe('the body')
  })
}

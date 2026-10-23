import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, label, test } from './support/harness.ts'
import type { Answers, At, Geometry } from './support/harness.ts'

/**
 * THE TEXT OF A SHEET IS ALIGNED TO THE START, ON THE SCREEN OF THE MEMBERS, AT EVERY WIDTH (PDL, owner,
 * 23.10.2026, the anchor „Tekst u iskačućim prozorima na ekranu članova se poravnava levo": „Tekst u
 * iskačućim prozorima na ekranu članova se poravnava levo, odmah (izuzetak od pravila o srednjim
 * nalazima; prozor je nasleđivao desno poravnanje ćelije tabele)").
 *
 * Measured in the review of PR 638: `Prompt` is drawn inside the `<td>` of the column of the actions, a
 * cell that gets `text-align: right` from `.table td` (`styles/table.css`), and `Prompt.css` set no
 * alignment of its own, so the heading, the paragraphs, the label and the row of buttons all computed
 * `right` at 360, 768 and 1280.
 *
 * **Asked in Chrome**, because jsdom computes no style at all:
 *
 * 1. **What the sheet's text computes to is the start**, for the heading, every paragraph of the body and
 *    the label of the field (`start`, or `left` where the writing runs left to right).
 * 2. **And where it stands says the same**: the first letter of each of those is at the sheet's own
 *    content edge on the starting side. A computed value alone could be satisfied by a rule on the
 *    wrong element; an edge cannot.
 *
 * Both sheets the screen draws in that cell are asked, the payment and the deletion of a member: the
 * first holds a field, so it is the one that carries a label as well as a heading and paragraphs.
 */

/** The day the moderation of the members is read on, as `membersTable.geometry.ts` reads it. */
test.use({ theDay: '2026-10-20' })

function sample<T>(name: string): T {
  const read: T = JSON.parse(
    readFileSync(fileURLToPath(new URL(`../src/test/mock/${name}.json`, import.meta.url)), 'utf-8'),
  )

  return read
}

/** Somebody who moderates the members: a superadmin, who may do everything (`useMay`). */
const SAMPLE: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/members': sample('members'),
  '/api/competitors': sample('competitors'),
}

/** The three widths the portal is measured at (CLAUDE.md, UI standards). */
const WIDTHS = [360, 768, 1280]

/** Opens the moderation of the members with every member on it. */
async function openTheMembers(open: Geometry['open'], at: At) {
  const { page, probe } = await open(at, '/sr/administracija/clanovi', 'table.members-table tbody tr', SAMPLE)

  /* Everybody ever given a number, so the rows that can be paid are among them. */
  await page.getByRole('combobox').first().selectOption('all')
  await page.mouse.move(1, 1)

  return { page, probe }
}

/** What the sheet's text computes to and where it stands, read off the dialog that is open. */
async function readTheSheet(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"].prompt__sheet')

    if (sheet === null) {
      throw new Error('no sheet is open')
    }

    const sheetStyle = getComputedStyle(sheet)
    /* The edge on the starting side, inside the sheet's own padding. */
    const startEdge = sheet.getBoundingClientRect().left + parseFloat(sheetStyle.paddingLeft)

    const each = (selector: string) =>
      [...sheet.querySelectorAll(selector)].map((one) => {
        const walk = document.createTreeWalker(one, NodeFilter.SHOW_TEXT)
        const range = document.createRange()
        const first = walk.nextNode()

        if (first === null) {
          throw new Error(`${selector} holds no text`)
        }

        range.selectNodeContents(first)

        const line = range.getClientRects()[0]

        if (line === undefined) {
          throw new Error(`${selector} draws no line`)
        }

        return {
          text: (one.textContent ?? '').trim(),
          align: getComputedStyle(one).textAlign,
          /* How far the first letter stands from the sheet's content edge on the starting side. */
          offset: line.left - startEdge,
        }
      })

    return {
      direction: sheetStyle.direction,
      titles: each('.prompt__title'),
      paragraphs: each('.prompt__body > p'),
      labels: each('.prompt__body label'),
    }
  })
}

function askedAtTheStart(seen: Awaited<ReturnType<typeof readTheSheet>>, expectLabel: boolean) {
  expect(seen.direction).toBe('ltr')
  expect(seen.titles).toHaveLength(1)
  expect(seen.paragraphs.length).toBeGreaterThan(0)
  expect(seen.labels).toHaveLength(expectLabel ? 1 : 0)

  for (const one of [...seen.titles, ...seen.paragraphs, ...seen.labels]) {
    expect(['start', 'left'], `„${one.text}" computes ${one.align}`).toContain(one.align)
    expect(Math.abs(one.offset), `„${one.text}" stands ${String(one.offset)}px from the start edge`).toBeLessThanOrEqual(
      SLACK,
    )
  }
}

for (const width of WIDTHS) {
  const at: At = { width, text: 100 }

  test(`the sheet of the payment of a member has its text at the start at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await openTheMembers(open, at)

    await page.getByRole('button', { name: 'Upiši uplatu' }).filter({ visible: true }).first().click()
    await page.getByRole('dialog', { name: 'Upiši uplatu' }).waitFor({ state: 'visible' })
    await page.waitForFunction(() => document.getAnimations().length === 0)

    expect(probe.sideways).toBe(0)
    askedAtTheStart(await readTheSheet(page), true)
  })

  test(`the sheet of the deletion of a member has its text at the start at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await openTheMembers(open, at)

    await page.getByRole('button', { name: /^Obriši/ }).filter({ visible: true }).first().click()
    await page.getByRole('dialog', { name: 'Obriši člana?' }).waitFor({ state: 'visible' })
    await page.waitForFunction(() => document.getAnimations().length === 0)

    expect(probe.sideways).toBe(0)
    askedAtTheStart(await readTheSheet(page), false)
  })
}

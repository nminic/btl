import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'
import { label, SLACK, test } from './support/harness.ts'
import type { At } from './support/harness.ts'

/**
 * THE ROWS OF THE PANEL OF MESSAGES ARE WHOLE INSIDE THE LIST THEY STAND IN, the date at the end of each
 * included (PENDING „Na 360 uz tekst 200% kartica panela poruka je sada cela (296 px), ali redovi traze 76 px
 * vise nego sto lista daje, pa je datum na kraju reda odsecen unutar liste", measured 02.10.2026 and again on
 * 24.11.2026 as `clip 76` by `scripts/header-panels-geometry.mjs`, which prints it and never fails on it).
 *
 * <p>What jsdom cannot answer: how wide a row asks to be and how wide the list gives it. A card that is whole on
 * the screen (`app/headerPanelsStyle.test.ts`) says nothing about a row that is wider than the card, and the
 * page does not scroll sideways for it, so nothing on the screen says the date is there. Asked of the boxes:
 * for every row the link does not overflow itself, its date ends inside the link and the subject ends before the
 * date begins, and the list does not scroll sideways. Dark theme only (the light one is leaving the portal).
 *
 * <p>The sample is the one the vitest suite reads (`src/test/mock/inbox.json`) plus a subject that is one word
 * of 59 characters, the other fault of the same row (PENDING „Tema poruke od jedne reci").
 */

const SUBJECT_OF_ONE_WORD = 'Nepodeljivaoznakaporukekojaneumedasestaneuokvirkarticeporuke'

const ORDINARY = [
  {
    id: 41,
    from: 'Balkanska trkačka liga',
    subject: 'Fotografija je prihvaćena',
    body: 'Tvoja profilna fotografija je pregledana.',
    date: '2026-09-25',
    read: false,
    teamInvitationId: null,
    pairInviteId: null,
  },
  {
    id: 17,
    from: 'Milica Anđelković',
    subject: 'Prevoz do Jadovnika',
    body: 'Idem kolima iz Beograda u subotu ujutru.',
    date: '2026-07-09',
    read: true,
    teamInvitationId: null,
    pairInviteId: null,
  },
]

/** The same two, the second with a subject that is one word and cannot be broken at a space. */
const ONE_WORD = [ORDINARY[0], { ...ORDINARY[1], subject: SUBJECT_OF_ONE_WORD }]

/** A member of the sample whose fee stands, the way `phoneHeader.geometry.ts` takes one. */
const HIM = (() => {
  const all: unknown = JSON.parse(
    readFileSync(fileURLToPath(new URL('../src/test/mock/competitors.json', import.meta.url)), 'utf-8'),
  )

  return {
    ...(Array.isArray(all) ? all[0] : {}),
    active: true,
    membershipBasis: 'payment',
  }
})()

const answers = (inbox: unknown) => ({
  '/api/me': {
    role: 'competitor',
    account: 1,
    member: HIM,
    mailLanguage: 'sr',
  },
  '/api/inbox': inbox,
})

const WHERE: At[] = [
  { width: 360, text: 100, theme: 'dark' },
  { width: 360, text: 200, theme: 'dark' },
  { width: 390, text: 200, theme: 'dark' },
  { width: 768, text: 100, theme: 'dark' },
  { width: 1280, text: 100, theme: 'dark', height: 300 },
]

type Row = {
  subjectRight: number
  subjectBottom: number
  dateTop: number
  dateLeft: number
  dateRight: number
  linkRight: number
  overflow: number
  /** Where the row's own padding ends, which is where the date stands against. */
  contentRight: number
  /** How many words of the subject are laid out across two lines. */
  broken: number
}

const rowsOf = (list: Locator): Promise<Row[]> =>
  list.evaluate((element) =>
    [...element.querySelectorAll('.inbox__link')].map((link) => {
      const subject = link.querySelector('.inbox__subject')?.getBoundingClientRect()
      const date = link.querySelector('.inbox__date')?.getBoundingClientRect()
      const box = link.getBoundingClientRect()

      return {
        subjectRight: subject?.right ?? Number.NaN,
        subjectBottom: subject?.bottom ?? Number.NaN,
        dateTop: date?.top ?? Number.NaN,
        dateLeft: date?.left ?? Number.NaN,
        dateRight: date?.right ?? Number.NaN,
        linkRight: box.right,
        overflow: link.scrollWidth - link.clientWidth,
        contentRight: box.right - Number.parseFloat(getComputedStyle(link).paddingRight),
        broken: [...(link.querySelector('.inbox__subject')?.textContent ?? '').matchAll(/\S+/g)].filter((word) => {
          const text = link.querySelector('.inbox__subject')?.firstChild
          const range = document.createRange()

          if (text === null || text === undefined) {
            return false
          }

          range.setStart(text, word.index)
          range.setEnd(text, word.index + word[0].length)

          return new Set([...range.getClientRects()].map((one) => Math.round(one.top))).size > 1
        }).length,
      }
    }),
  )

for (const [what, inbox] of [
  ['two ordinary subjects', ORDINARY],
  ['a subject of one word', ONE_WORD],
] as const) {
  for (const at of WHERE) {
    test(`every row of the panel of messages with ${what} is whole inside the list, date and all, at ${label(at)}`, async ({
      open,
    }) => {
      const { page, probe } = await open(at, '/sr/kalendar', 'header .brand', answers(inbox))

      await page.getByRole('button', { name: /^Otvori poruke/ }).click()

      const list = page.locator('.inbox__list')

      await expect(list).toBeVisible()

      const rows = await rowsOf(list)
      const listBox = await list.evaluate((element) => ({
        right: element.getBoundingClientRect().right,
        sideways: element.scrollWidth - element.clientWidth,
      }))

      expect(rows).toHaveLength(2)
      expect(probe.sideways).toBe(0)
      expect(listBox.sideways, 'the list scrolls sideways').toBeLessThanOrEqual(SLACK)

      for (const [index, row] of rows.entries()) {
        expect(row.overflow, `row ${index} is wider than itself`).toBeLessThanOrEqual(SLACK)
        expect(row.dateRight, `the date of row ${index} ends past the list`).toBeLessThanOrEqual(listBox.right + SLACK)
        expect(row.dateRight, `the date of row ${index} ends past its row`).toBeLessThanOrEqual(row.linkRight + SLACK)
        if (what === 'two ordinary subjects') {
          /* A word is kept whole where the date can go under it; only a word wider than the row is broken. */
          expect(row.broken, `row ${index} breaks a word of its subject in two`).toBe(0)
        }

        /* And the date is at the END of the row, on the line of its own as well as beside the subject. */
        expect(row.dateRight, `the date of row ${index} is not at the end of its row`).toBeGreaterThanOrEqual(
          row.contentRight - SLACK,
        )

        /* Beside the date, or above it where the date has gone to a line of its own. */
        expect(
          row.subjectRight <= row.dateLeft + SLACK || row.subjectBottom <= row.dateTop + SLACK,
          `the subject of row ${index} runs into the date`,
        ).toBe(true)
      }
    })
  }
}

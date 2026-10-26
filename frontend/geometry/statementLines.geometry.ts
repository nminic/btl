import { expect, type Page } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { Answers, At } from './support/harness.ts'

/**
 * THE PAYMENTS OF A BANK STATEMENT THAT WAIT, ON THE PAYMENTS SCREEN, ASKED OF CHROME (owner, 24.10.2026
 * and 25.10.2026, PDL „Učitavanje izvoda iz banke na ekranu Uplate" and „Učitavanje izvoda: dva odgovora
 * od 25.10.2026"): every line with what the statement printed, whom it may be about, „Potvrdi", „Drugi
 * član" and „Nije članarina".
 *
 * <p>Asked at 360, 768 and 1280, and at 360 with the text at 200%, because a sideways scroll is seen
 * nowhere else (`CLAUDE.md`): the page does not scroll sideways, the table of lines stands in its own
 * scrolling box, and every control of a line can be reached in it. And once „Potvrdi" has opened the
 * member's row, the sentence about it and „Prikaži sve" fit the window as well.
 *
 * <p><b>At 360 with the text at 200% the page itself does scroll 32px sideways, and not because of this
 * box</b>: measured 25.10.2026 with no line of a statement on the screen at all, the search field of the
 * list under it (`.rankings__field--wide`) runs 32px past the window. That is the list's and was there
 * before this box had a list; it is reported, not fixed here. So at that size what is asked is that
 * nothing of the statement's own box runs past the window, which is the part this guard is about.
 */

const ADDRESS = '/sr/administracija/verifikacija/uplate'

const READY = '.statement__lines'

const DUSKO = { competitorId: 4, memberNumber: '000004', firstName: 'Duško', lastName: 'Kunić', city: 'Beograd' }

const ANSWERS: Answers = {
  '/api/me': { role: 'superadmin', account: 41, membershipBasis: null },
  '/api/payments': {
    season: 2027,
    accounts: [
      { ...DUSKO, currency: 'RSD', expected: 4200, price: 4200, balance: 0 },
      { competitorId: 27, memberNumber: '000027', firstName: 'Marko', lastName: 'Marković', city: 'Niš',
        currency: 'RSD', expected: 4200, price: 4200, balance: 0 },
    ],
  },
  '/api/statements/lines': [
    {
      id: 7, dated: '2026-10-23', statement: 1, position: 1,
      payer: 'DUŠKO KUNIĆ, KRALJEVAČKIH ŽRTAVA 53, BEOGRAD-ČUKARICA', payerAccount: '200-0000015673761-71',
      amount: 4200, currency: 'RSD', paymentCode: '289', purpose: 'Članarina za 2027. godinu',
      reference: null, season: 2027, state: 'waiting', member: null, candidates: [DUSKO], waitsBecause: 'noReference',
    },
    {
      id: 8, dated: '2026-10-23', statement: 1, position: 2,
      payer: 'NEKO SASVIM DRUGI SA VEOMA DUGIM IMENOM I PREZIMENOM, ULICA BEZ KRAJA 1, NOVI SAD',
      payerAccount: '160-0000000000002-22', amount: 1234567, currency: 'RSD', paymentCode: '189',
      purpose: 'Uplata za nešto što nije članarina i što ima dugačku svrhu koja se prelama u više redova',
      reference: '2027999999', season: 2027, state: 'waiting', member: null, candidates: [], waitsBecause: 'unknownReference',
    },
  ],
}

/**
 * Every element of the statement's box and of the sentence about an opened row that runs past the right
 * edge of the window, leaving out what stands inside a box that scrolls on its own.
 */
async function pastTheWindow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const window = document.documentElement.clientWidth

    return [...document.querySelectorAll('.statement *, .statement__opened, .statement__opened *')]
      .filter((one) => one.closest('.table-scroll') === null || one.matches('.table-scroll'))
      .filter((one) => one.getBoundingClientRect().right > window + 0.5)
      .map((one) => `${one.tagName.toLowerCase()}.${one.className}`)
  })
}

const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100 },
  { width: 360, text: 200 },
]

for (const at of WIDTHS) {
  test(`the lines that wait fit and keep every control within reach at ${label(at)}`, async ({ open }) => {
    const { page, probe } = await open(at, ADDRESS, READY, ANSWERS)

    if (at.text === 100) {
      expect(probe.sideways).toBe(0)
      expect(probe.widened).toBe(0)
    }

    expect(await pastTheWindow(page)).toEqual([])

    const seen = await page.evaluate(() => {
      const table = document.querySelector('.statement__lines')
      const box = table?.closest('.table-scroll')

      return {
        inABox: box !== null && box !== undefined,
        boxRight: box?.getBoundingClientRect().right ?? Number.POSITIVE_INFINITY,
        window: document.documentElement.clientWidth,
      }
    })

    expect(seen.inABox).toBe(true)
    expect(seen.boxRight).toBeLessThanOrEqual(seen.window + 0.5)

    for (const name of ['Potvrdi: Duško Kunić (000004), Beograd', 'Nije članarina']) {
      const control = page.getByRole('button', { name }).first()

      await control.scrollIntoViewIfNeeded()
      await expect(control).toBeInViewport()
    }
  })

  test(`the row „Potvrdi" opened fits with its sentence at ${label(at)}`, async ({ open }) => {
    const { page } = await open(at, ADDRESS, READY, ANSWERS)

    await page.getByRole('button', { name: 'Potvrdi: Duško Kunić (000004), Beograd' }).click()
    await page.getByText(/Otvoren je red za uplatu sa izvoda/).waitFor()

    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )

    if (at.text === 100) {
      expect(sideways).toBeLessThanOrEqual(0)
    }

    expect(await pastTheWindow(page)).toEqual([])
    await expect(page.getByRole('button', { name: 'Prikaži sve' })).toBeVisible()
    await expect(page.getByLabel(/Uplaćeno/)).toHaveValue('4200')
  })
}

import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SLACK, label, notMeasured, test } from './support/harness.ts'
import type { At } from './support/harness.ts'

/**
 * THE ROW „KONTAKT I DOSTAVA" OF THE REGISTRATION, ASKED OF CHROME (owner, PDL P36, 20.11.2026: the box for
 * the community on Viber „stoji u trećoj, do sada praznoj trećini reda „Kontakt i dostava”. Na tabletu i
 * telefonu ide ispod telefona", and the draft he chose has it „poravnat sa poljima").
 *
 * <p>jsdom lays nothing out, so `pages/Registration.test.tsx` holds what is drawn and this holds where it
 * LANDS. <b>On a desktop</b> the box stands right of the telephone, clear of it, in the row of the address and
 * the telephone, and the tick sits across the box of the telephone, not across its name; and it stays there
 * when the telephone is told it is needed and grows a sentence under itself. <b>On a telephone and a tablet</b>
 * the box stands under the telephone and above the town. <b>At every width</b> nothing runs off the page.
 *
 * <p><b>Relations, never pixels</b>, as in `settings.geometry.ts`; the numbers are printed so the report can
 * quote them.
 */

const ADDRESS = '/sr/registracija'
const READY = 'input[name="viberCommunity"]'

type Box = { top: number; bottom: number; left: number; right: number }

type Landed = { address: Box; phone: Box; phoneControl: Box; viber: Box; tick: Box; words: Box; city: Box }

const landedOf = (page: Page) =>
  page.evaluate(() => {
    const box = (element: Element | null | undefined) => {
      if (element === null || element === undefined) {
        return null
      }

      const { top, bottom, left, right } = element.getBoundingClientRect()

      return { top, bottom, left, right }
    }
    const field = (name: string) => box(document.querySelector(`[name="${name}"]`)?.closest('.field'))
    const tick = document.querySelector('input[name="viberCommunity"]')
    /* The first line of the words beside the tick, read as a range so a sentence that wraps is measured
       by its first line and not by the whole of it. */
    const words = tick?.closest('.field')?.querySelector('.field__label') ?? null
    const line = document.createRange()

    if (words !== null) {
      line.selectNodeContents(words)
    }

    const first = words === null ? undefined : line.getClientRects()[0]

    return {
      address: field('address'),
      phone: field('phone'),
      phoneControl: box(document.querySelector('[name="phone"]')),
      viber: field('viberCommunity'),
      tick: box(tick),
      words: first === undefined ? null : { top: first.top, bottom: first.bottom, left: first.left, right: first.right },
      city: field('city'),
    }
  })

function landed(found: Awaited<ReturnType<typeof landedOf>>, at: string): Landed {
  const { address, phone, phoneControl, viber, tick, words, city } = found

  if (address === null || phone === null || phoneControl === null || viber === null || tick === null || words === null || city === null) {
    throw notMeasured(`${at}: a field of the row was not drawn`)
  }

  return { address, phone, phoneControl, viber, tick, words, city }
}

const middle = (one: Box) => (one.top + one.bottom) / 2

function expectInLineWithTheTelephone(row: Landed, at: string): void {
  console.log(
    `${at}: telephone box ${row.phoneControl.top.toFixed(2)}-${row.phoneControl.bottom.toFixed(2)} (middle ${middle(row.phoneControl).toFixed(2)}),`
      + ` tick ${row.tick.top.toFixed(2)}-${row.tick.bottom.toFixed(2)} (middle ${middle(row.tick).toFixed(2)}),`
      + ` first line ${row.words.top.toFixed(2)}-${row.words.bottom.toFixed(2)} (middle ${middle(row.words).toFixed(2)});`
      + ` address ${row.address.left.toFixed(2)}-${row.address.right.toFixed(2)}, telephone ${row.phone.left.toFixed(2)}-${row.phone.right.toFixed(2)},`
      + ` box ${row.viber.left.toFixed(2)}-${row.viber.right.toFixed(2)}`,
  )

  expect(Math.abs(row.viber.top - row.phone.top), `${at}: the box stands in the row of the telephone`).toBeLessThanOrEqual(SLACK)
  expect(row.viber.left, `${at}: the box stands right of the telephone, clear of it`).toBeGreaterThanOrEqual(row.phone.right - SLACK)
  expect(row.phone.left, `${at}: the telephone stands right of the address`).toBeGreaterThanOrEqual(row.address.right - SLACK)
  /* The tick and the first line of its words across the box of the telephone, not across its name: both
     middles inside the box, and within a few pixels of its own middle. */
  for (const [what, one] of [['tick', row.tick], ['first line of the words', row.words]] as const) {
    expect(middle(one), `${at}: the ${what} stands below the top of the telephone's box`).toBeGreaterThan(row.phoneControl.top)
    expect(middle(one), `${at}: the ${what} stands above the bottom of the telephone's box`).toBeLessThan(row.phoneControl.bottom)
    expect(Math.abs(middle(one) - middle(row.phoneControl)), `${at}: the ${what} is across the middle of the telephone's box`).toBeLessThanOrEqual(4)
  }
}

test('the box stands in the third of the row, in line with the telephone’s box, 1280px, text 100%', async ({ open }) => {
  const at: At = { width: 1280, text: 100 }
  const { page, probe } = await open(at, ADDRESS, READY, {})

  expectInLineWithTheTelephone(landed(await landedOf(page), label(at)), label(at))
  expect(probe.sideways, 'the page scrolls sideways').toBe(0)
})

test('and stays in line when the telephone is told it is needed, 1280px, text 100%', async ({ open }) => {
  const at: At = { width: 1280, text: 100 }
  const { page } = await open(at, ADDRESS, READY, {})

  await page.locator('input[name="viberCommunity"]').check()
  await page.getByRole('button', { name: 'Pošalji prijavu' }).click()
  await expect(page.getByText('Za Viber zajednicu upišite broj telefona.')).toBeVisible()

  expectInLineWithTheTelephone(landed(await landedOf(page), `${label(at)}, told`), `${label(at)}, told`)
})

for (const width of [360, 768]) {
  test(`the box stands under the telephone and above the town, ${width}px, text 100%`, async ({ open }) => {
    const at: At = { width, text: 100 }
    const { page, probe } = await open(at, ADDRESS, READY, {})
    const row = landed(await landedOf(page), label(at))

    console.log(
      `${label(at)}: telephone ${row.phone.top.toFixed(2)}-${row.phone.bottom.toFixed(2)}, box ${row.viber.top.toFixed(2)}-${row.viber.bottom.toFixed(2)},`
        + ` town from ${row.city.top.toFixed(2)}; box ${row.viber.left.toFixed(2)}-${row.viber.right.toFixed(2)}, telephone ${row.phone.left.toFixed(2)}-${row.phone.right.toFixed(2)}`,
    )

    expect(row.viber.top, `${label(at)}: the box stands under the telephone`).toBeGreaterThanOrEqual(row.phone.bottom - SLACK)
    expect(row.city.top, `${label(at)}: the town stands under the box`).toBeGreaterThanOrEqual(row.viber.bottom - SLACK)
    expect(Math.abs(row.viber.left - row.phone.left), `${label(at)}: the box starts where the telephone starts`).toBeLessThanOrEqual(SLACK)
    expect(probe.widened, 'the page was widened by something running off its right edge').toBe(0)
    expect(probe.sideways, 'the page scrolls sideways').toBe(0)
  })
}

import { expect } from '@playwright/test'
import { label, test } from './support/harness.ts'
import type { At } from './support/harness.ts'

/**
 * THE TWO LINKS UNDER THE SIGN IN FORM, AT THE THREE WIDTHS EVERY SCREEN IS HELD TO (owner, 21.11.2026:
 * „Preveliko je vertikalno rastojanje između zaboravljene lozinke i donjeg linka za učlanjenje. Nema
 * razloga da bude veće od prethodnog vertikalnog razmaka.").
 *
 * <p>The page is a flex column with a gap, and margins do not collapse in one, so the browser's own margin
 * of a paragraph was added to the gap once above the first link and twice between the two. jsdom lays out
 * nothing, so this reads the boxes: the space from the sentence (or, with none, the button) to
 * „Zaboravljena lozinka" is the space from that link to „Nemaš nalog? Učlani se", within a pixel.
 */

const ADDRESS = '/sr/prijava'
const READY = '#sign-in-email'
const SENTENCE = '#sign-in-waits'
const ONE_PIXEL = 1

/* A window of 400px on a desktop, because the sign in screen is shorter than 900 and a desktop that does not scroll
   draws no scrollbar, which the harness will not measure (`support/harness.ts`). */
const WIDTHS: At[] = [
  { width: 360, text: 100 },
  { width: 768, text: 100 },
  { width: 1280, text: 100, height: 400 },
]

type Spaces = { above: number; between: number; sentence: boolean }

const read = (hint: string): Spaces => {
  const box = (found: Element | null, what: string) => {
    if (found === null) {
      throw new Error(`nothing matches ${what}`)
    }

    const { top, bottom } = found.getBoundingClientRect()

    return { top, bottom }
  }

  /* The paragraphs that hold the two links, boxes of whole lines like the sentence above them, so the three
     spaces are measured edge to edge the same way and not once from a line and once from the glyphs of a link. */
  const links = [...document.querySelectorAll('.member > p')].filter((p) => p.querySelector('a') !== null)
  const forgotten = box(links[0] ?? null, 'the forgotten password link')
  const joining = box(links[1] ?? null, 'the joining link')
  const sentence = document.querySelector(hint)
  const above = box(sentence ?? document.querySelector('.member__form button'), 'what stands above the links')

  return {
    above: forgotten.top - above.bottom,
    between: joining.top - forgotten.bottom,
    sentence: sentence !== null,
  }
}

for (const at of WIDTHS) {
  test(`the space above the first link is the space between the two, with the sentence, at ${label(at)}`, async ({
    open,
  }) => {
    const { page, probe } = await open(at, ADDRESS, READY, {})
    const seen = await page.evaluate(read, SENTENCE)

    console.log(`MEASURED ${at.width} with sentence: above ${seen.above}, between ${seen.between}`)
    expect(seen.sentence).toBe(true)
    expect(probe.sideways).toBe(0)
    expect(seen.above).toBeGreaterThan(0)
    expect(Math.abs(seen.between - seen.above)).toBeLessThanOrEqual(ONE_PIXEL)
  })

  test(`the same two spaces with no sentence, and the two links as far apart as with it, at ${label(at)}`, async ({
    open,
  }) => {
    const { page } = await open(at, ADDRESS, READY, {})
    const withSentence = await page.evaluate(read, SENTENCE)

    await page.getByLabel(/^Adresa/).fill('a@b.rs')
    await page.getByLabel(/^Lozinka/).fill('x')
    await page.waitForSelector(SENTENCE, { state: 'detached' })

    const without = await page.evaluate(read, SENTENCE)

    console.log(`MEASURED ${at.width} without sentence: above ${without.above}, between ${without.between}`)
    expect(without.sentence).toBe(false)
    expect(without.above).toBeGreaterThan(0)
    expect(Math.abs(without.between - without.above)).toBeLessThanOrEqual(ONE_PIXEL)
    expect(Math.abs(without.between - withSentence.between)).toBeLessThanOrEqual(ONE_PIXEL)
  })
}

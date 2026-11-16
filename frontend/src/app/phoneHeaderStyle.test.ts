import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { everyRule, ruleFor } from '../test/stylesheet'
import { PHONE_HEADER } from './phoneHeader'

/**
 * WHAT `app/Shell.css` SAYS ABOUT THE HEADER OF A TELEPHONE, read off the sheet (owner, 16.11.2026, PDL
 * „Pravilnik prelazi u podnožje, a Timovi postaju treća kartica BTL tabela”). Where the cells stand and
 * how wide they are is Chrome's to answer (`geometry/phoneHeader.geometry.ts`); what is held here is
 * what a reading of the text can hold whole.
 */

const SHEET = readFileSync(join(process.cwd(), 'src/app/Shell.css'), 'utf-8')
const PORTAL = readFileSync(join(process.cwd(), 'src/index.css'), 'utf-8')

/** The rule that moves the word of a cell and the code of the language out of sight. */
const OUT_OF_SIGHT = '.shell__cells .shell__word, .shell__header--phone .lang__code'

describe('the header of a telephone, as its sheet writes it', () => {
  it('moves the word of a cell and the code of the language out of sight with what `.visually-hidden` carries', () => {
    /* ADL A7, 31.07.2026: „Skrivanje se radi pomeranjem van vidnog polja (ista pravila koja nosi
       `visually-hidden`), nikad uklanjanjem". So the floor is that rule itself, read off `index.css`,
       and not a copy of it kept here (the shape `pages/calendarStyle.test.ts` has). Both selectors are
       asked by name: written over the whole link, or over the whole button, the symbol would go with
       the word. */
    const recipe = ruleFor(PORTAL, '.visually-hidden', 'index.css')
    const here = ruleFor(SHEET, OUT_OF_SIGHT, 'app/Shell.css')
    const named = [...recipe].sort()

    expect(named.length, '.visually-hidden in index.css declares nothing').toBeGreaterThan(5)
    expect([...here].sort()).toEqual(named)

    for (const property of named) {
      expect(here.getPropertyValue(property), `the header says something else about ${property}`).toBe(
        recipe.getPropertyValue(property),
      )
    }
  })

  it('never takes the word away, at any width and by any rule', () => {
    /* The other half of the decision, „nikad uklanjanjem": a rule anywhere in the sheet, in any query,
       that reached the word or the code with `display: none`, `visibility: hidden` or
       `content-visibility: hidden` would take the name with it, while the rule above went on reading as
       though it worked. */
    const reaching = everyRule(SHEET, 'app/Shell.css').filter((rule) => /\.shell__word|\.lang__code/.test(rule.selectorText))

    expect(reaching.map((rule) => rule.selectorText)).toContain(OUT_OF_SIGHT)

    for (const rule of reaching) {
      expect(rule.style.getPropertyValue('display'), rule.selectorText).not.toBe('none')
      expect(rule.style.getPropertyValue('visibility'), rule.selectorText).not.toBe('hidden')
      expect(rule.style.getPropertyValue('content-visibility'), rule.selectorText).not.toBe('hidden')
    }
  })

  it('names no width at which the telephone ends, so the shell is the one place that does', () => {
    /* The shape is the class the shell gives the header (`app/phoneHeader.ts`), and a query here at the
       same width would be a second home for it, free to drift from the first. */
    const widths = [...SHEET.matchAll(/@media[^{]*\(\s*(?:max|min)-width\s*:\s*([\d.]+)(em|px)\s*\)/g)].map(
      ([, figure, unit]) => (unit === 'em' ? Number(figure) * 16 : Number(figure)),
    )

    expect(widths.length, 'the sheet still has its own queries, so this read something').toBeGreaterThan(0)
    expect(widths.filter((one) => one >= 699 && one <= 700)).toEqual([])
  })

  it('asks for the lower half of 700px in em, the width the portal already turns at', () => {
    /* 699.98 is on the closed list of the portal (`styles/scale.test.ts`), and the shape is changed in
       `em` (ADL A7, 13.08.2026). */
    expect(PHONE_HEADER).toBe(`(max-width: ${699.98 / 16}em)`)
  })
})

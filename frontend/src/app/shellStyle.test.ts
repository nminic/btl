import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { everyRule, ruleFor } from '../test/stylesheet'

/**
 * Where the three links of the footer sit, which no rendered test can see.
 *
 * jsdom applies no stylesheet, so a test over the markup finds the three links
 * and can say nothing about where they land. The owner asked on 22.08.2026 that
 * they be centred, and the row became the only thing in the footer that day: the
 * note about trial data left with it, and a row against the left edge under
 * nothing at all reads as the remains of something.
 *
 * Who wins is a question for a browser and is not asked here; the arrangement
 * itself was measured by hand in Chrome, at 1280 and at 360. What is asked is
 * that the rule is written, **that it applies unconditionally**, and that it
 * declares what it is meant to declare.
 *
 * That middle question is why this reads `sheet.cssRules` and not the text of the
 * sheet (ADL A18). Written over the text first, and a review measured the cost
 * the same day: the whole rule wrapped in `@media print` left this green while
 * the links stopped being a flex row on screen and their boxes overlapped at
 * 360px in real Chrome. Text does not tell a live rule from a dead one.
 */
const css = readFileSync(join(process.cwd(), 'src/app/Shell.css'), 'utf-8')

describe('the footer of every screen', () => {
  it('lays its links out centred, and does so on every screen', () => {
    const rule = ruleFor(css, '.shell__footer-links', 'Shell.css')

    expect(rule.getPropertyValue('display')).toBe('flex')
    expect(rule.getPropertyValue('justify-content')).toBe('center')
  })
})

/**
 * The two links of a visitor, while the server has not said who is reading (owner, 10.10.2026,
 * PDL P26: „nevidljiva i nedostupna, pa se ništa ne pomera i ništa se ne izgovara").
 *
 * <p>jsdom applies no stylesheet, so `session/beforeTheServerHasSaid.test.tsx` can say the links
 * are there and wear the class, and cannot say what the class does. It must hide them AND keep
 * their box, and those are two different words: `visibility: hidden` does both, `display: none`
 * hides and gives the row of tools its width back a moment later, which is the pomak this is meant
 * not to have. Measured in Chrome at 360, 768 and 1280 as well, by hand, for the same reason.
 */
describe('the header links of a visitor, while they wait', () => {
  it('are hidden by visibility, which keeps their box, and never by display', () => {
    const rule = ruleFor(css, '.shell__guest--waiting', 'Shell.css')

    expect(rule.getPropertyValue('visibility')).toBe('hidden')
    expect(rule.getPropertyValue('display')).toBe('')
    expect(rule.getPropertyValue('position')).toBe('')
  })
})


/**
 * The main is as tall as the window WHILE A SCREEN IS ON ITS WAY, so the foot is not in the first screen when
 * the content lands (owner, 25.11.2026, „1 potvrđujem": „min-height na .shell__main dok ekran stiže"; 0.18
 * measured by Lighthouse on `footer.shell__footer`, the limit for „dobro" is 0.10), and only while it is.
 *
 * <p>Where the foot stands is a question for a browser and `geometry/footerBelowTheFold.geometry.ts` asks it.
 * What is asked here is the half that is the stylesheet's own word: that the rule is bound to the page-level
 * loader and not to the inline one, and that nothing else gives the main a height, which is what would make
 * a short screen scroll for good.
 */
describe('the main of every screen', () => {
  it('is as tall as the window while the page-level loader is in it, and no other time', () => {
    const rules = everyRule(css, 'Shell.css').filter((rule) => rule.selectorText.includes('.shell__main'))
    const tall = rules.filter((rule) => rule.style.getPropertyValue('min-height') !== '')
    const when = (rule: CSSStyleRule) => [rule.parentRule?.cssText.split('{')[0]?.trim() ?? '', rule.selectorText, rule.style.getPropertyValue('min-height')]

    /* The rule, and the one that gives it back from 1000px (a desktop was not over the limit before it). */
    expect(tall.map(when)).toEqual([
      ['', '.shell__main:has(.loader:not(.loader--inline))', '100svh'],
      ['@media (min-width: 62.5em)', '.shell__main:has(.loader:not(.loader--inline))', 'auto'],
    ])
  })
})

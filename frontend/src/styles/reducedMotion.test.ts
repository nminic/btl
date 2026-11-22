import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rulesInMedia } from '../test/stylesheet'

/**
 * UNDER REDUCED MOTION NOTHING IS DRAWN BETWEEN TWO STATES, AND THE DURATION SAYS SO WITH A ZERO.
 *
 * The rule in `index.css` gave every element `transition-duration: 0.01ms`. An element that declares no
 * transition has `transition-property: all` with a duration of 0, so the rule turned it into one that
 * transitions, for 0.01ms, and a value a script writes (`left`, `top`, `transform`) was drawn at the old
 * place for a frame before it reached the new one. Measured in Chrome on 21.11.2026, on the box with the
 * word of a symbol (`components/ActionButton.tsx`, `place()` in a layout effect), under `reduce`: one
 * frame with the box at `left: 0`, then its place, on the pointer and on the keyboard
 * (`geometry/actionTip.geometry.ts`). The `0.01ms` was there so that `animationend` would still fire; the
 * portal listens for no such event, and a zero-length animation fires it anyway.
 *
 * jsdom draws nothing, so what a frame shows is asked of Chrome. What is asked here is the text: that
 * every duration this block writes is zero. It is derived from the block (every property that ends in
 * `-duration`), so a second duration added later lands here. A `transition-delay` is not read here, and the
 * rule does not write one, so a delay is held by nothing in jsdom.
 */

const CSS = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf-8')
const REDUCE = '(prefers-reduced-motion: reduce)'

describe('the rule for reduced motion in index.css', () => {
  const rules = rulesInMedia(CSS, REDUCE, 'index.css')
  const universal = rules.filter((rule) => rule.selectorText.replace(/\s+/g, ' ') === '*, *::before, *::after')

  it('is written once, for every element and both of its generated boxes', () => {
    expect(universal).toHaveLength(1)
  })

  it('gives no transition and no animation any time at all', () => {
    const declared = [...(universal[0]?.style ?? [])]

    expect(declared).toEqual(expect.arrayContaining(['animation-duration', 'transition-duration']))

    for (const property of declared.filter((name) => name.endsWith('-duration'))) {
      expect(universal[0]?.style.getPropertyValue(property), property).toBe('0s')
      /* AND IT WINS: without `!important` the rule loses to every class that writes a `transition:` of its
         own (measured 21.11.2026: forty elements on the member screens stayed on 0.16s, and the language
         menu slid), and the value above is read as zero all the same. */
      expect(universal[0]?.style.getPropertyPriority(property), `${property} is important`).toBe('important')
    }
  })

  it('runs an animation once, and does not scroll smoothly', () => {
    const style = universal[0]?.style

    expect(style?.getPropertyValue('animation-iteration-count')).toBe('1')
    expect(style?.getPropertyValue('scroll-behavior')).toBe('auto')
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * What the rule beside a field looks like when it is open.
 *
 * jsdom applies no stylesheet and computes no layout, so nothing in a rendered
 * test can see where this box lands or how wide it is. That is exactly where its
 * faults were: anchored to the letter that opens it, it ran off the side of a
 * telephone and took the page with it; shown by three separate conditions, only
 * one of which could hide it, Escape closed a box that a hover was still holding
 * open.
 *
 * So the stylesheet is read as text, which is the portal's own answer to this
 * (styles/scale.test.ts, components/DucatGallery.test.tsx). What is held here is
 * the handful of properties those faults turned on, and nothing else: a test
 * that spelled out the whole rule would fail on every repaint of it.
 */
const css = readFileSync(join(process.cwd(), 'src/forms/FieldHint.css'), 'utf8')

/** One rule of the stylesheet, by its selector, with the spaces taken out. */
function ruleFor(selector: string): string {
  const at = css.indexOf(`${selector} {`)

  expect(at, `${selector} is not in FieldHint.css`).toBeGreaterThan(-1)

  return css.slice(at, css.indexOf('}', at)).replace(/\s+/g, ' ')
}

describe('the box the rule of a field opens in', () => {
  it('stands in the flow, between the name of the field and the field', () => {
    /* Laid over what follows, it covered the field under it: a rule left open by
       a finger swallowed the first press on whatever it covered, and a pointer
       could never reach the words to read them to the end, because the way down
       crossed the control and the control is outside the hint. In the flow it
       covers nothing and is reached by moving straight down. */
    const open = ruleFor('.hint--open .hint__text')

    expect(open).toContain('position: static;')
    expect(open).not.toContain('z-index')
    /* Across the whole of the head, which is the row the name of the field
       stands in. */
    expect(open).toContain('grid-column: 1 / -1;')

    const head = readFileSync(join(process.cwd(), 'src/forms/FormRenderer.css'), 'utf8')
    const at = head.indexOf('.field__head {')

    expect(head.slice(at, head.indexOf('}', at))).toContain('display: grid')
  })

  it('is shown by one thing only, so that one thing can hide it', () => {
    /* It was shown by `:hover` and by `:focus-visible` as well as by the state,
       and Escape moves only the state: the tooltip stayed on screen under a
       pointer that had not moved, which is what SC 1.4.13 asks not to happen.
       The pointer and the keyboard now go through the same state
       (FieldHint.tsx), so the stylesheet has one condition and not three. */
    expect(css).not.toContain(':focus-visible + .hint__text')
    expect(css).not.toContain('.hint:hover .hint__text')

    /* Whatever selector unfolds the box, read off the rule that undoes the
       clipping. The comments above a rule are stripped first, or the sweep
       carries whatever prose stands in front of the selector. */
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const shown = [...bare.matchAll(/([^{}]+)\{[^}]*clip-path: none/g)].map((one) =>
      (one[1] ?? '').trim(),
    )

    expect(shown).toEqual(['.hint--open .hint__text'])
  })

  it('keeps the letter and the words inside one element', () => {
    /* Which is what lets the pointer travel from one to the other without the
       box closing under it (SC 1.4.13 asks that hovered content be hoverable):
       the hint is a wrapper the two share, and whether the pointer left it is
       decided against that wrapper rather than against either half
       (FieldHint.tsx). `display: contents` is what keeps the wrapper out of the
       layout while leaving it in the document. */
    expect(ruleFor('.hint')).toContain('display: contents;')
  })
})

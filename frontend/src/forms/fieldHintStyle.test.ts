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
  it('hangs from the field and stretches to both of its edges', () => {
    /* Anchored to the letter beside the label it opened at whatever pixel the
       label happened to end on, and a box of up to 22rem starting there is off
       the right edge of a 360 pixel screen: the page then scrolls sideways,
       which P24 and WCAG 2.2 SC 1.4.10 both forbid. Anchored to the field, its
       edges are the field's, and the field is inside the page's own column. */
    const open = ruleFor('.hint--open .hint__text')

    expect(open).toContain('inset-inline: 0;')
    expect(open).toContain('inset-block-start: 100%;')
    /* And the field is what it is measured against. */
    const field = readFileSync(join(process.cwd(), 'src/forms/FormRenderer.css'), 'utf8')

    expect(field.slice(field.indexOf('.field {'), field.indexOf('}', field.indexOf('.field {'))))
      .toContain('position: relative')
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

  it('leaves no gap between the letter and the words', () => {
    /* A gap is a strip the pointer falls into on its way down to the text: the
       wrapper is left, the box closes, and the words can never be reached to be
       read to the end or copied. SC 1.4.13 asks that hovered content be
       hoverable. */
    const open = ruleFor('.hint--open .hint__text')

    expect(open).toContain('margin-block-start: 0;')
  })
})

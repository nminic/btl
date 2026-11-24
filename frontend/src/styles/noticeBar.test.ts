import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { at, must } from '../test/at'
import { contrast } from '../test/contrast'
import { bodyOf, ruleFor, unremarked } from '../test/stylesheet'

/* THE GOLD STRIP UNDER THE HEADER (owner, 21.11.2026, PDL „Zlatna traka obaveštenja ispod zaglavlja"), and
 * what no screen test can see of it: jsdom computes no custom property and paints no gradient, so the
 * sheet is read as text and the arithmetic is done here, the way `styles/raceInMotion.test.ts` does it
 * for the decoration the strip borrows its gold from.
 *
 * What the owner's condition on the decoration is, the strip keeps: its sentence is held at 4,5:1 against
 * its own face (WCAG 2.2 SC 1.4.3), and its line, which carries nothing but is meant to be
 * seen, at 3:1 (SC 1.4.11). The face is laid under the line's FULL strength, the weakest ground there is.
 */

const FLOOR = 4.5
const MARK = 3

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf-8').replaceAll('\r\n', '\n')
}

const strip = read('src/app/NoticeBar.css')
const decoration = read('src/app/RaceInMotion.css')
const tokens = read('src/styles/tokens.css')

/** Every value a sheet gives a custom property: one, since the portal has one palette (PDL „Portal ima samo
 *  tamnu temu; svetla se izbacuje", 24.11.2026). */
function given(css: string, name: string): string[] {
  return [...unremarked(css).matchAll(new RegExp(`\\s${name}: ([^;]+);`, 'g'))].map((one) => at(one, 1).trim())
}

/** A colour of the palette, followed through `var()` to the value it ends at. */
function colour(css: string, name: string, seen: string[] = []): string {
  expect(seen, `${name} is defined in terms of itself`).not.toContain(name)

  const values = given(css, name)

  expect(values, `${name} is given more than one value`).toHaveLength(1)

  const value = must(values[0], `${name} has no value`)
  const named = /^var\((--[a-z0-9-]+)\)$/.exec(value)

  if (named === null) {
    expect(value, `${name} is not an opaque colour written as hex`).toMatch(/^#[0-9a-f]{6}$/)
    return value
  }

  return colour(css, must(named[1], 'the name inside var()'), [...seen, name])
}

describe('the face of the strip', () => {
  it('is given once, in the one rule of the palette', () => {
    expect(given(strip, '--notice-face')).toEqual(['#262a2e'])
    expect(ruleFor(strip, ':root', 'NoticeBar.css').getPropertyValue('--notice-face')).toBe('#262a2e')
  })

  it('is the only custom property the sheet declares', () => {
    const declared = new Set([...unremarked(strip).matchAll(/\s(--[a-z0-9-]+):/g)].map((one) => at(one, 1)))

    expect([...declared]).toEqual(['--notice-face'])
  })

  it('keeps 4,5:1 for the sentence, and 3:1 for the gold line at its strongest', () => {
    const face = colour(strip, '--notice-face')
    const ink = colour(tokens, '--text')
    const line = colour(decoration, '--race-gold')

    expect(contrast(ink, face), `--text on ${face}`).toBeGreaterThanOrEqual(FLOOR)
    expect(contrast(line, face), `--race-gold on ${face}`).toBeGreaterThanOrEqual(MARK)
  })

  it('is painted by the strip, and its ink is the portal\'s own text', () => {
    const rule = ruleFor(strip, '.notice', 'NoticeBar.css')

    expect(rule.getPropertyValue('background')).toBe('var(--notice-face)')
    expect(rule.getPropertyValue('color')).toBe('var(--text)')
  })

  it('draws the line in the gold of the header, fading to both ends, and nothing else paints it', () => {
    const body = unremarked(bodyOf(strip, '.notice::after'))

    expect(body).toMatch(/background:\s*linear-gradient\(90deg, transparent 0, var\(--race-gold\) 12%, var\(--race-gold\) 88%, transparent 100%\);/)
    expect(body.replaceAll(/var\(--[a-z0-9-]+\)/g, '')).not.toMatch(/#[0-9a-f]{3,8}|rgb|hsl/)
  })
})

describe('the shape of the strip', () => {
  it('has a cross whose pressed area is 44px square, over the 24px WCAG 2.2 SC 2.5.8 asks for', () => {
    const rule = ruleFor(strip, '.notice__close', 'NoticeBar.css')

    expect(rule.getPropertyValue('inline-size')).toBe('2.75rem')
    expect(rule.getPropertyValue('block-size')).toBe('2.75rem')
  })

  it('moves nothing, so there is nothing for prefers-reduced-motion to switch off', () => {
    expect(unremarked(strip)).not.toMatch(/animation|transition|@keyframes|transform/)
  })

  it('has no stacking order of its own, so the panels that hang from the header go over it', () => {
    expect(unremarked(strip)).not.toMatch(/z-index|position:\s*(fixed|sticky)/)
  })

  it('keeps the sentence in the column of the page: the width and the gutters the main content has', () => {
    const inner = ruleFor(strip, '.notice__inner', 'NoticeBar.css')

    expect(inner.getPropertyValue('max-width')).toBe('1100px')
    expect(inner.getPropertyValue('padding-inline')).toBe('var(--space-16)')
  })

  it('lets the sentence shrink instead of pushing the cross off a 360px screen', () => {
    const text = unremarked(bodyOf(strip, '.notice__text'))

    expect(text).toMatch(/min-width:\s*0;/)
    expect(text).toMatch(/flex:\s*1;/)
  })
})

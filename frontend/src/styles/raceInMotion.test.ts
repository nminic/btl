import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { at, must } from '../test/at'
import { contrast } from '../test/contrast'
import { bodyOf, closes, everyRule, ruleFor, ruleInMedia, rulesInMedia, unremarked } from '../test/stylesheet'

/* The decoration of „Race in Motion" (owner, 14.11.2026, PDL „Vizuelno osveženje „Race in
 * Motion""), and the things about it no screen test can see.
 *
 * jsdom computes no custom property, paints no gradient and lays nothing out, so the sheet is read
 * as text and the arithmetic is done here, the way `styles/goldBand.test.ts` does it for the gold
 * band. Where the layers stand and that the pointer passes through them is asked of Chrome
 * (`geometry/raceInMotion.geometry.ts`).
 *
 * The owner's own condition is the one measured hardest: the decoration must never reduce the
 * readability of text. So every colour the layers paint is laid over the ground it is painted on,
 * at its full strength, and the text of that ground is held at 4,5:1 against the result (WCAG 2.2
 * SC 1.4.3), in both themes.
 */

const FLOOR = 4.5

/** What a mark meant to be seen owes its ground (WCAG 2.2 SC 1.4.11), taken here as the measure of
 *  the owner's „istaknute zlatne linije" (15.11.2026): where the gold line is strongest it stands
 *  out of the header at least this far, in both themes, as the reference's does (its brightest pixel
 *  is #d8be84 on #19212f). The faint gold of the first drawing stood at 1,45:1 and 1,39:1. */
const MARK = 3

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf-8').replaceAll('\r\n', '\n')
}

const decoration = read('src/app/RaceInMotion.css')
const tokens = read('src/styles/tokens.css')
const shell = read('src/app/Shell.css')

type Theme = 'light' | 'dark'

/** Every value a sheet gives a custom property, in the order written: the light block, the dark one
 *  the system asks for, and the dark one a member chose. */
function given(css: string, name: string): string[] {
  return [...unremarked(css).matchAll(new RegExp(`\\s${name}: ([^;]+);`, 'g'))].map((one) => at(one, 1).trim())
}

/** A colour of one theme, followed through `var()` to the value it ends at. */
function colour(css: string, name: string, theme: Theme, seen: string[] = []): string {
  expect(seen, `${name} is defined in terms of itself`).not.toContain(name)

  const values = given(css, name)
  const value = must(theme === 'dark' ? values.at(-1) : values[0], `${name} has no value`)
  const named = /^var\((--[a-z0-9-]+)\)$/.exec(value)

  if (named === null) {
    expect(value, `${name} is not a colour written as hex`).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/)
    return value
  }

  return colour(css, must(named[1], 'the name inside var()'), theme, [...seen, name])
}

const own = (name: string, theme: Theme) => colour(decoration, name, theme)
const portal = (name: string, theme: Theme) => colour(tokens, name, theme)

/** A selector list as one line, however its lines are broken. */
const flat = (text: string) => text.replaceAll(/\s+/g, ' ').trim()

/** The one rule outside every query whose selector is this list, however its lines are broken. */
function written(selector: string): CSSStyleDeclaration {
  const found = everyRule(decoration, 'RaceInMotion.css').filter(
    (rule) => flat(rule.selectorText) === flat(selector) && rule.parentRule === null,
  )

  expect(found.length, `${selector} is one rule outside every query`).toBe(1)
  return must(found[0], selector).style
}

/** The one rule of one media query whose selector is this list, however its lines are broken. */
function writtenIn(condition: string, selector: string): CSSStyleDeclaration {
  const found = rulesInMedia(decoration, condition, 'RaceInMotion.css').filter((rule) => flat(rule.selectorText) === flat(selector))

  expect(found.length, `${selector} is one rule of ${condition}`).toBe(1)
  return must(found[0], selector).style
}

/** One colour laid over an opaque one, at the alpha it carries. */
function over(top: string, ground: string): string {
  const alpha = top.length === 9 ? Number.parseInt(top.slice(7, 9), 16) / 255 : 1
  const channel = (hex: string, start: number) => Number.parseInt(hex.slice(start, start + 2), 16)
  const mixed = [1, 3, 5].map((start) =>
    Math.round(channel(top, start) * alpha + channel(ground, start) * (1 - alpha))
      .toString(16)
      .padStart(2, '0'),
  )

  expect(ground, 'the ground under a layer is opaque').toMatch(/^#[0-9a-f]{6}$/)
  return `#${mixed.join('')}`
}

describe('the colours of the decoration', () => {
  const NAMES = [
    '--race-header-top',
    '--race-header-bottom',
    '--race-header-glow',
    '--race-track',
    '--race-gold',
    '--race-runner',
    '--race-page-glow',
    '--race-contour',
    '--race-route',
  ]

  it('are each given once per theme block, and the two dark blocks agree', () => {
    for (const name of NAMES) {
      const values = given(decoration, name)

      expect(values, `${name}: light, dark by the system, dark by choice`).toHaveLength(3)
      expect(values[1], `${name} in the two dark blocks`).toBe(values[2])
    }
  })

  it('are the only custom properties the sheet declares, so a new one cannot skip the blocks above', () => {
    const declared = new Set([...unremarked(decoration).matchAll(/\s(--[a-z0-9-]+):/g)].map((one) => at(one, 1)))

    expect([...declared].sort()).toEqual([...NAMES].sort())
  })
})

describe('the text of the header, over the decoration', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`keeps 4,5:1 at both ends of the gradient and under every line that may cross it, ${theme}`, () => {
      const stops = ['--race-header-top', '--race-header-bottom'].map((name) => own(name, theme))
      const glow = own('--race-header-glow', theme)
      /* The lanes are the one line that crosses the words. The gold line is bright where the
         reference has it bright, and it and the runner are drawn only where no word stands, which is a
         question of where things are on the screen and is asked of Chrome:
         `geometry/raceInMotion.geometry.ts`, „the bright gold and the runner touch no text". Between
         the two guards every ground a word of the header stands on is measured. */
      const lines = ['--race-track'].map((name) => own(name, theme))

      /* Each stop as it is, with the glow over it, and with each line over that. */
      const grounds = stops.flatMap((stop) => {
        const glowing = over(glow, stop)

        return [stop, glowing, ...lines.map((line) => over(line, glowing))]
      })

      for (const ink of ['--text', '--text-muted']) {
        for (const ground of grounds) {
          expect(contrast(portal(ink, theme), ground), `${ink} on ${ground}, ${theme}`).toBeGreaterThanOrEqual(FLOOR)
        }
      }
    })
  }

  for (const theme of ['light', 'dark'] as const) {
    it(`draws the gold line to be seen where it is strongest, at least 3:1 on the header, ${theme}`, () => {
      const glow = own('--race-header-glow', theme)
      const grounds = ['--race-header-top', '--race-header-bottom'].map((name) => over(glow, own(name, theme)))

      /* Only the line. The runner is the reference's faint outline, at the strength measured off it
         (about three tenths of the gold), and is not a mark meant to stand out; how he looks against
         the reference has no floor here, it is compared by eye. */
      for (const mark of ['--race-gold']) {
        const ink = own(mark, theme)

        for (const ground of grounds) {
          expect(contrast(over(ink, ground), ground), `${mark} on ${ground}, ${theme}`).toBeGreaterThanOrEqual(MARK)
        }
      }
    })
  }

  it('paints the gradient from those two stops and nothing else', () => {
    const background = must(/\sbackground:([^;]+);/.exec(unremarked(bodyOf(decoration, '.race-header')))?.[1], 'the background')
    const used = [...background.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((one) => at(one, 1)).sort()

    expect(used).toEqual(['--race-header-bottom', '--race-header-glow', '--race-header-top'])
    /* No colour written out beside the tokens, which would be a ground nothing here measures. */
    expect(background.replaceAll(/var\(--[a-z0-9-]+\)/g, '')).not.toMatch(/#|rgb|hsl/)
  })
})

describe('the text of the page, over the decoration', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`keeps 4,5:1 on the page colour under the glow, the contours and the route, ${theme}`, () => {
      const glowing = over(own('--race-page-glow', theme), portal('--bg', theme))
      const grounds = [glowing, ...['--race-contour', '--race-route'].map((name) => over(own(name, theme), glowing))]

      for (const ink of ['--text', '--text-muted', '--accent']) {
        for (const ground of grounds) {
          expect(contrast(portal(ink, theme), ground), `${ink} on ${ground}, ${theme}`).toBeGreaterThanOrEqual(FLOOR)
        }
      }
    })
  }
})

describe('the layers stand out of the way', () => {
  it('lets the pointer through both, cuts both to their box and puts both under what they lie in', () => {
    for (const layer of ['.race-header', '.race-page']) {
      const rule = ruleFor(decoration, layer, 'RaceInMotion.css')

      expect(rule.getPropertyValue('pointer-events'), layer).toBe('none')
      expect(rule.getPropertyValue('overflow'), layer).toBe('hidden')
      expect(rule.getPropertyValue('z-index'), layer).toBe('-1')
    }

    expect(ruleFor(decoration, '.race-header', 'RaceInMotion.css').getPropertyValue('position')).toBe('absolute')
    expect(ruleFor(decoration, '.race-page', 'RaceInMotion.css').getPropertyValue('position')).toBe('fixed')
  })

  it('makes the shell and the header the contexts the layers lie at the bottom of', () => {
    expect(ruleFor(shell, '.shell', 'Shell.css').getPropertyValue('isolation')).toBe('isolate')
    expect(ruleFor(shell, '.shell__header', 'Shell.css').getPropertyValue('position')).toBe('relative')
  })

  it('stands the header against the page exactly where its highest panel stood', () => {
    /* The header became a stacking context, so its panels are measured against the page by the
       header's number and not by their own. Any lower and a panel would fall under a chart it used
       to cover; any higher and it would climb over what used to cover it. */
    const panels = everyRule(shell, 'Shell.css')
      .filter((rule) => /\.(lang__menu|account__panel|inbox__panel)\b/.test(rule.selectorText))
      .map((rule) => rule.style.getPropertyValue('z-index'))
      .filter((value) => value !== '')
      .map(Number)

    expect(panels.length).toBeGreaterThan(1)
    expect(Number(ruleFor(shell, '.shell__header', 'Shell.css').getPropertyValue('z-index'))).toBe(Math.max(...panels))
  })
})

describe('what is drawn at which width', () => {
  it('draws the runner and the gold he runs up only from 1280px, where the gutter beside the column holds him', () => {
    expect(written('.race-header__rise').getPropertyValue('display')).toBe('none')
    expect(writtenIn('(min-width: 80em)', '.race-header__rise').getPropertyValue('display')).toBe('block')

    /* And it is shown nowhere else, so no narrower query can bring it back. */
    const shown = everyRule(decoration, 'RaceInMotion.css').filter(
      (rule) => /race-header__(rise|runner)/.test(rule.selectorText) && !['', 'none'].includes(rule.style.getPropertyValue('display')),
    )

    expect(shown).toHaveLength(1)
  })

  it('draws every lane and the gold beside the column at every width, the window cutting what it does not show', () => {
    const hiding = everyRule(decoration, 'RaceInMotion.css').filter(
      (rule) => /race-header__(track|lane|gold)/.test(rule.selectorText) && rule.style.getPropertyValue('display') !== '',
    )

    expect(hiding.map((rule) => rule.selectorText)).toEqual([])
  })

  it('keeps the gold route off a telephone', () => {
    expect(
      ruleInMedia(decoration, '(min-width: 35em)', '.race-page::after', 'RaceInMotion.css').getPropertyValue('display'),
    ).toBe('block')
    expect(unremarked(decoration)).toMatch(/\.race-page::after \{\s*display: none;/)
  })
})

describe('the drawing of the page', () => {
  it('covers the whole window, the middle as well as the edges, and repeats across and down it', () => {
    /* Owner, 15.11.2026: the drawing goes between the boxes and behind the middle of the page, and
       not only along the two sides. So both drawings take the layer's whole box, which is the
       window, and no rule narrows either of them to a band at any width. */
    const drawings = everyRule(decoration, 'RaceInMotion.css').filter((rule) => /\.race-page::(before|after)/.test(rule.selectorText))
    const both = must(
      drawings.find((rule) => flat(rule.selectorText) === '.race-page::before, .race-page::after'),
      'the one rule of both drawings',
    )

    /* jsdom hands `inset: 0` back as `0px`. */
    expect(both.style.getPropertyValue('inset')).toMatch(/^0(px)?$/)
    expect(both.style.getPropertyValue('mask-repeat')).toBe('repeat')

    for (const rule of drawings) {
      for (const narrows of ['width', 'max-width', 'left', 'right', 'inset-inline', 'transform']) {
        expect(rule.style.getPropertyValue(narrows), `${rule.selectorText} sets ${narrows}`).toBe('')
      }
    }

    for (const rule of drawings.filter((one) => one !== both)) {
      expect(rule.style.getPropertyValue('mask-repeat'), `${rule.selectorText} repeats otherwise`).toBe('')
    }
  })
})

describe('a browser that does not know masks', () => {
  it('meets every mask inside the one question that asks whether it does', () => {
    /* Outside it, the token colour under the mask would be painted as a solid band. */
    const plain = unremarked(decoration)
    const asks = plain.indexOf('@supports (mask-image: none) {')

    expect(asks).toBeGreaterThan(-1)

    const end = closes(decoration, asks)
    const masks = [...plain.matchAll(/mask-image|background-color/g)].map((one) => one.index)

    expect(masks.length).toBeGreaterThan(3)

    for (const index of masks) {
      expect(index > asks && index < end, `a mask or its colour at ${index}, outside the question`).toBe(true)
    }
  })
})

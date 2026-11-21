import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { at, must } from '../test/at'
import { contrast } from '../test/contrast'
import { bodyOf, everyRule, ruleFor, rulesInMedia, unremarked } from '../test/stylesheet'

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
 * SC 1.4.3), in both themes. On the page that is four grounds: the page under its glow, a contour over it,
 * the route over it, and the place where a contour and the route cross, both at full strength (the weakest
 * ground there is). The dot that runs the route (20.11.2026) is gold and meant to be seen, 3:1 against the
 * page, and no word stands on it: that is Chrome's to ask. The header's own text is measured under the glow
 * and the lanes. A ground the layers
 * can make and this does not measure is not measured at all.
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

/** Every stylesheet the portal draws with, found by walking `src`. */
function sheets(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`

    if (entry.isDirectory()) return sheets(path)
    return entry.name.endsWith('.css') ? [path] : []
  })
}

/** The tokens some rule of the portal writes text in: `color: var(--x)` and no other property. */
const writtenInText = new Set(
  sheets('src').flatMap((path) =>
    [...unremarked(read(path)).matchAll(/(?:^|[\s;{])color:\s*var\((--[a-z0-9-]+)\)/g)].map((one) => at(one, 1)),
  ),
)

/** The inks that are found by the derivation below and still do not stand on the bare page, each
 *  with where it does stand. The list is of exceptions and so fails the safe way: an ink that is
 *  not named here is measured, so a new one is held to 4,5:1 until someone writes why it need not
 *  be. The gold of the text at 4,40:1 under the contours is why this one is named: it is written
 *  on the podium, the stars, the calendar day and the member's balance, which are cards, and not
 *  on the page itself. That is a reading of where they stand and not a measurement of it; Chrome
 *  walking the screens is what would measure it, and is left as the boundary of this guard. */
const NOT_ON_THE_PAGE: Record<string, string> = {
  '--gold-text': 'the podium, the stars, the calendar day and the balance of a member, all on cards',
}

/** The colours of text that stand straight on the page, found and not listed: every token some
 *  stylesheet of the portal writes text in (`color: var(--x)`, read from all of them) that reaches
 *  4,5:1 on the page colour in this theme, since text that cannot be read on the page itself is
 *  written on a card of its own and is measured there. A list written by hand was the first
 *  guard's flaw: it named three, and the red of the star of a required field, which stands on the
 *  page of the settings, was measured by no one and was at 3,42:1 under the route. A token that
 *  some rule writes in tomorrow is measured without anyone remembering it. The limit is the
 *  derivation's own and is written here: text on the page in a colour set some other way than
 *  `color: var(--token)` is not found by it. */
function inkOf(theme: Theme): string[] {
  const page = portal('--bg', theme)

  return [...writtenInText].filter((name) => {
    if (name in NOT_ON_THE_PAGE) return false

    /* Followed through `var()` by hand, since a token that ends at a length and not a colour is
       not an ink and must not stop the reading the way `colour()` stops it. */
    let value = name

    for (let step = 0; step < 8 && value.startsWith('--'); step += 1) {
      const values = given(tokens, value)
      const written = theme === 'dark' ? values.at(-1) : values[0]

      value = written ?? ''
      value = /^var\((--[a-z0-9-]+)\)$/.exec(value)?.[1] ?? value
    }

    return /^#[0-9a-f]{6}$/.test(value) && contrast(value, page) >= FLOOR
  })
}

describe('the text of the page, over the decoration', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`finds the inks of the page in the tokens, the red of the star of a required field among them, ${theme}`, () => {
      expect(inkOf(theme)).toEqual(expect.arrayContaining(['--text', '--text-muted', '--accent', '--down']))
    })

    it(`keeps 4,5:1 on the page colour under the glow, the contours, the route, and where a contour crosses the route, ${theme}`, () => {
      const glowing = over(own('--race-page-glow', theme), portal('--bg', theme))
      const contour = over(own('--race-contour', theme), glowing)
      /* The contours and the route are painted in one drawing, the route over the contours, so where a
         contour and the route cross a word stands on both at once, each at its full strength: that is the last
         ground, and the weakest one (PR 736 review, 15.11.2026; the owner's choice of 16.11.2026 was to keep the
         lines as they are and to give the inks that fell short colours that clear 4,5:1 on it). */
      const crossing = over(own('--race-route', theme), contour)
      const grounds = [glowing, contour, over(own('--race-route', theme), glowing), crossing]

      for (const ink of inkOf(theme)) {
        for (const ground of grounds) {
          expect(contrast(portal(ink, theme), ground), `${ink} on ${ground}, ${theme}`).toBeGreaterThanOrEqual(FLOOR)
        }
      }
    })
  }
})

describe('the dot, as a colour', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`is the gold of the header's line, and stands out of the page at least 3:1, ${theme}`, () => {
      /* Owner, 20.11.2026: „Jaka tačka, nikad ispod teksta". The dot is meant to be seen, so it owes the page
         what a mark owes it (WCAG 2.2 SC 1.4.11, MARK), and it is the gold of the header's line, not a
         colour of its own. NO WORD IS MEASURED AGAINST IT, and that is the point of the decision: a word
         never stands on the dot or on the route it runs, which Chrome is asked about
         (geometry/raceInMotion.geometry.ts, „the route and the dot touch no word"). The text of the page
         keeps 4,5:1 on every ground that is left. */
      expect(written('.race-page__dot-core').getPropertyValue('fill')).toBe('var(--race-gold)')
      expect(written('.race-page__dot-ring').getPropertyValue('stroke')).toBe('var(--race-gold)')

      const glowing = over(own('--race-page-glow', theme), portal('--bg', theme))

      expect(contrast(over(own('--race-gold', theme), glowing), glowing), `the dot against the page, ${theme}`).toBeGreaterThanOrEqual(MARK)
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

  it('draws the hills and the lane of the route and the dot from 560px and a telephone its own', () => {
    expect(written('.terrain--wide').getPropertyValue('display')).toBe('none')
    expect(written('.terrain--lane').getPropertyValue('display')).toBe('none')
    expect(writtenIn('(min-width: 35em)', '.terrain--wide, .terrain--lane').getPropertyValue('display')).toBe('block')
    expect(writtenIn('(min-width: 35em)', '.terrain--narrow').getPropertyValue('display')).toBe('none')

    /* The telephone's drawing is drawn by nothing else, so it has no way to be drawn wide: no rule gives
       it a display outside the one that takes it away. */
    const narrow = everyRule(decoration, 'RaceInMotion.css').filter((rule) => flat(rule.selectorText) === '.terrain--narrow')

    expect(narrow.map((rule) => rule.style.getPropertyValue('display'))).toEqual(['none'])
  })
})

describe('the ground of the page', () => {
  it('covers the whole window, the middle as well as the edges, and is one drawing, not a tile that repeats', () => {
    /* Owner, 15.11.2026: the drawing goes between the boxes and behind the middle of the page, and not only
       along the two sides. Both drawings take the layer's whole box, which is the window; and nothing in the
       sheet is a mask or a repeated image any more (20.11.2026), which is what a tile was. */
    const ground = written('.terrain')

    expect(ground.getPropertyValue('inset')).toMatch(/^0(px)?$/)
    expect(ground.getPropertyValue('width')).toBe('100%')
    expect(ground.getPropertyValue('height')).toBe('100%')
    expect(unremarked(decoration)).not.toMatch(/mask|repeat|url\(/)
  })

  it('draws no stroke wider than the sheet says whatever the drawing is scaled to', () => {
    expect(flat(written('.terrain path, .terrain circle').getPropertyValue('vector-effect'))).toBe('non-scaling-stroke')
  })

  it('paints the lines in the tokens and only in them', () => {
    expect(written('.terrain__hills').getPropertyValue('stroke')).toBe('var(--race-contour)')
    expect(written('.terrain__route').getPropertyValue('stroke')).toBe('var(--race-route)')
    expect(written('.terrain__waypoint').getPropertyValue('fill')).toBe('var(--race-route)')
    expect(written('.terrain__waypoint-ring').getPropertyValue('stroke')).toBe('var(--race-route)')
  })
})

describe('the lane of the route', () => {
  it('lies beside the column of the page, its right edge on the edge of the column, so no word is ever over it', () => {
    /* Owner, 20.11.2026: „Jaka tačka, nikad ispod teksta". The strip is 100 units wide and drawn 100px wide
       (6,25rem), and the column is the 1100px the shell gives the page; what is asked of Chrome is that no
       word is over the route (geometry/raceInMotion.geometry.ts), and what is asked here is why that holds. */
    const lane = written('.terrain--lane')

    /* jsdom writes the calc back in its own order, so the three numbers are asked for and not the spelling:
       half of what is left of the window beside a column of 1100px, less the width of the strip. */
    const left = lane.getPropertyValue('left')

    expect(left).toMatch(/^calc\(/)
    expect(left).toContain('100% - 1100px')
    expect(left).toContain('6.25rem')
    expect(left).toMatch(/0\.5|\/ 2/)
    expect(lane.getPropertyValue('width')).toBe('6.25rem')
    expect(lane.getPropertyValue('height')).toBe('100%')
    expect(shell).toMatch(/max-width: 1100px;/)
  })
})

describe('the dot', () => {
  const CONDITION = '(min-width: 35em) and (prefers-reduced-motion: no-preference)'

  /** The rules that name the dot itself, with the question each one is asked inside. */
  function dotRules() {
    return everyRule(decoration, 'RaceInMotion.css')
      .filter((rule) => flat(rule.selectorText) === '.race-page__dot')
      .map((rule) => {
        const asks: string[] = []

        for (let up = rule.parentRule; up !== null; up = up.parentRule) {
          asks.push(flat(up.cssText.slice(0, up.cssText.indexOf('{'))))
        }

        return { style: rule.style, asks }
      })
  }

  it('is not drawn unless the width, the reader and the browser all allow it', () => {
    const rules = dotRules()

    expect(rules).toHaveLength(2)

    const plain = rules.filter((rule) => rule.asks.length === 0)
    const moving = rules.filter((rule) => rule.asks.length > 0)

    expect(plain.map((rule) => rule.style.getPropertyValue('display'))).toEqual(['none'])
    expect(moving).toHaveLength(1)
    expect(must(moving[0], 'the rule that draws the dot').style.getPropertyValue('display')).toBe('inline')

    /* From 560px and for a reader who has not asked for less movement: a reader who has gets no dot at all,
       not a still one. And only in a browser that moves things along a path, which would otherwise leave it
       in the corner of the drawing. */
    expect(must(moving[0], 'the rule that draws the dot').asks).toEqual([`@media ${CONDITION}`, "@supports (offset-path: path('M0 0'))"])
  })

  it('runs once, for five seconds at most, and stays where it stops', () => {
    const moving = must(
      dotRules().find((rule) => rule.asks.length > 0),
      'the rule that draws the dot',
    )
    const animation = moving.style.getPropertyValue('animation')
    const [name, duration, curve, count, ...more] = animation.split(/\s+(?![^(]*\))/)

    expect(more, animation).toEqual([])
    expect(name).toBe('race-dot-run')
    expect(duration).toMatch(/^\d+(\.\d+)?s$/)
    expect(Number.parseFloat(must(duration, 'the duration')), 'seconds the dot runs').toBeLessThanOrEqual(5)
    expect(Number.parseFloat(must(duration, 'the duration')), 'seconds the dot runs').toBeGreaterThan(0)
    expect(curve).toMatch(/^cubic-bezier\(/)
    /* One run and no more: nothing but a number one, so „infinite" and „2" both fail. */
    expect(count).toBe('1')
    /* It rests on the waypoint by its own style and not by an animation that fills forwards, which never
       ends and so never lets a page settle. */
    expect(moving.style.getPropertyValue('offset-distance')).toBe('100%')
  })

  it('is the only thing in the sheet that moves, and it moves along the route from the start to the end', () => {
    const plain = unremarked(decoration)

    expect([...plain.matchAll(/\s(animation[a-z-]*|transition[a-z-]*):/g)].map((one) => at(one, 1))).toEqual(['animation'])
    expect(plain.match(/@keyframes/g)).toHaveLength(1)
    expect(plain).toMatch(/@keyframes race-dot-run \{\s*from \{\s*offset-distance: 0%;\s*\}\s*to \{\s*offset-distance: 100%;\s*\}\s*\}/)

  })
})

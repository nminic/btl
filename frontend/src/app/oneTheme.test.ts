import { globSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { everyRule, ruleFor } from '../test/stylesheet'

/**
 * THE PORTAL HAS ONE THEME, THE DARK ONE (owner, 24.11.2026, PDL „Portal ima samo tamnu temu; svetla se
 * izbacuje": „Da, izbaci"; the reason, his words: „Realno je užasna").
 *
 * <p>Until that day a palette was written three times (light at the root, dark behind the system's
 * preference, dark behind a member's choice) and an attribute on the root element picked one. All of it
 * left, and what is held here is that none of it comes back by a side door: no file of the portal asks the
 * system which scheme it prefers, none writes or reads a theme attribute, and the tokens are one rule.
 *
 * <p><b>Read off every file there is, not off a list of the ones that used to carry a theme.</b> Four
 * sheets did (`styles/tokens.css`, `index.css`, `app/NoticeBar.css`, `app/RaceInMotion.css`), and a fifth
 * written tomorrow would be in none of them; the sweep is the source folder, the page, the guards that
 * drive Chrome and the scripts beside them, each counted so that a sweep narrowed by accident fails rather
 * than passing over nothing.
 */
const ROOT = process.cwd()
const tokens = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf-8')
const page = readFileSync(join(ROOT, 'index.html'), 'utf-8')

/** The ways a second theme is asked for or written down. */
const A_SECOND_THEME = /prefers-color-scheme|data-theme|dataset\.theme|color-scheme:\s*light/i

/** This file names them in order to refuse them, and is the only one that may. */
const HERE = join('src', 'app', 'oneTheme.test.ts')

function everyFile(): { path: string; text: string }[] {
  return [
    ...globSync('src/**/*.{css,ts,tsx,json}', { cwd: ROOT }),
    ...globSync('geometry/**/*.ts', { cwd: ROOT }),
    ...globSync('scripts/**/*.{mjs,js,ts}', { cwd: ROOT }),
    'index.html',
  ]
    .map((path) => relative(ROOT, join(ROOT, path)))
    .filter((path) => path !== HERE)
    .map((path) => ({ path: path.split(sep).join('/'), text: readFileSync(join(ROOT, path), 'utf-8') }))
}

describe('one theme', () => {
  it('is asked for nowhere: no file of the portal names a second scheme or an attribute that picks one', () => {
    const files = everyFile()

    /* The floor: the sweep reached all four places it is made of, and enough of each that no one folder
       can stand in for it. */
    expect(files.filter(({ path }) => path.endsWith('.css')).length, 'stylesheets read').toBeGreaterThan(50)
    expect(files.filter(({ path }) => path.startsWith('geometry/')).length, 'guards of Chrome read').toBeGreaterThan(40)
    expect(files.some(({ path }) => path.startsWith('scripts/')), 'the scripts beside them read').toBe(true)
    expect(files.some(({ path }) => path === 'index.html'), 'the page read').toBe(true)

    expect(
      files.filter(({ text }) => A_SECOND_THEME.test(text)).map(({ path }) => path),
      'files that still ask for a second theme',
    ).toEqual([])
  })

  it('writes the palette once, in the one rule of the sheet of tokens', () => {
    /* Every rule the sheet has, wherever it is written, inside a query or not: one, and it is `:root`.
       A palette put back under a selector of its own, or behind any query, is a second rule. */
    expect(everyRule(tokens, 'tokens.css').map((rule) => rule.selectorText)).toEqual([':root'])

    const root = ruleFor(tokens, ':root', 'tokens.css')

    /* And it tells the browser to draw its own parts dark, whatever the system prefers. */
    expect(root.getPropertyValue('color-scheme')).toBe('dark')
    /* The page and the card of the dark theme, which is what the portal has been drawn in for everybody
       who did not choose otherwise since 29.07.2026 (PDL P28a). */
    expect(root.getPropertyValue('--bg')).toBe('#060b16')
    expect(root.getPropertyValue('--surface')).toBe('#101a2e')
    expect(root.getPropertyValue('--text')).toBe('#eef2f8')
  })

  it("tells the browser to paint its own bar in the theme's page, from the first frame", () => {
    /* The stylesheet does not reach the address bar; this tag is the only thing that does, and nothing
       moves it any more. It said `#ffffff` once, which put a white bar above an almost black page. */
    const bar = /<meta name="theme-color" content="([^"]+)"/.exec(page)

    expect(bar, 'index.html names no theme-color').not.toBeNull()
    expect(bar?.[1]).toBe(ruleFor(tokens, ':root', 'tokens.css').getPropertyValue('--bg'))
  })
})

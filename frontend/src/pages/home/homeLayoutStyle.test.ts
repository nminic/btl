import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TWO_COLUMNS } from './rowsThatFit'

/**
 * THE TWO ENDS OF VARIANT A THAT MEET IN THE STYLESHEET (PDL P24, owner 18.11.2026).
 *
 * The page writes a class and asks a query, and `Home.css` answers both; jsdom reads neither, so they are
 * held to each other here as text:
 *
 * - the query `rowsThatFit.ts` asks to know whether the page stands in two columns is the one the sheet
 *   splits the page at, so the calendar counts its rows exactly where they have a bottom to run to;
 * - the class `Home.tsx` writes when there is a sponsor is the one the sheet gives a place for the box;
 * - the rule that lets the calendar fill its column weighs nothing only in two columns and only without
 *   a sponsor. Outside the query it would leave a telephone with a list of nought.
 */

const css = readFileSync(join(process.cwd(), 'src/pages/Home.css'), 'utf-8')
  .replaceAll('\r\n', '\n')
  .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))

/** The inside of the one block that opens with `@media <query> {`, counted to its own closing brace. */
function block(query: string): string {
  const opening = `@media ${query} {`
  const start = css.indexOf(opening)

  expect(start, `Home.css has no ${opening}`).toBeGreaterThan(-1)
  expect(css.indexOf(opening, start + 1), `Home.css opens ${opening} twice`).toBe(-1)

  let depth = 1
  let at = start + opening.length

  while (depth > 0) {
    depth += css[at] === '{' ? 1 : css[at] === '}' ? -1 : 0
    at += 1
  }

  return css.slice(start + opening.length, at - 1)
}

const FILLS = '.home__split:not(.home__split--sponsored) .home__next .extract {'

describe('the stylesheet of the front page', () => {
  it('splits the page at the query the calendar asks, into two columns that are boxes of their own', () => {
    const split = block(TWO_COLUMNS)

    expect(split).toContain('.home__split--cols {')
    expect(split).toMatch(/\.home__colL,\s*\.home__colR \{[^}]*display: flex;[^}]*flex-direction: column;/)
  })

  it('makes the box of the sponsor take what the taller column has over, and keeps the calendar to its four rows', () => {
    const split = block(TWO_COLUMNS)

    expect(/\.home__sponsor \{([^}]*)\}/.exec(split)?.[1] ?? '').toMatch(/flex: 1 1 auto;/)
    expect(/\.home__split--sponsored \.home__next \{([^}]*)\}/.exec(split)?.[1] ?? '').toMatch(/flex: none;/)
  })

  it('makes the address the box of the left column that takes what the right column has over', () => {
    expect(/\.home__address \{([^}]*)\}/.exec(block(TWO_COLUMNS))?.[1] ?? '').toMatch(/flex: 1 1 auto;/)
  })

  it('moves nothing with `order` and hides no column in a `display: contents`', () => {
    /* The markup is the order the page is seen in on both layouts (ADL A7, owner, 21.11.2026: „Kod prati
       ekran"; `Home.tsx`, `useTwoColumns`), so a sheet that put a box somewhere else would part the order
       of the eye from the order of the focus (WCAG 2.4.3, 1.3.2). */
    expect(css).not.toMatch(/\.home__[a-z]+ \{[^}]*\border:/)
    expect(css).not.toContain('display: contents')
  })

  it('lets the calendar fill its column only in two columns and only without a sponsor', () => {
    const split = block(TWO_COLUMNS)
    const rule = split.slice(split.indexOf(FILLS))

    expect(split).toContain(FILLS)
    expect(rule.slice(0, rule.indexOf('}'))).toContain('contain: size;')
    expect(css.split(FILLS)).toHaveLength(2)
  })
})

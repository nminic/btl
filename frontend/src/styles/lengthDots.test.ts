import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { bare } from '../test/sources'
import { DOTS } from '../data/types'

/* The dots a calendar tile carries, as colours.
 *
 * One home for the whole fact (ADL A31), and it was the profile's before: that
 * test named the five by hand, inside a `describe` about the ring on a profile.
 * The ring has five slices and always will, since it is drawn per length; the
 * calendar got a sixth dot on 30.08.2026 for a race that fixes no length, and a
 * list written out by hand says nothing about a name added to `DOTS`. So the
 * fact moved here and is asked of the list itself.
 *
 * jsdom computes no custom property and lays nothing out (ADL A33), so both
 * sheets are read as text, the way the ducat art is read.
 */

const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf-8')
const table = readFileSync(join(process.cwd(), 'src/styles/table.css'), 'utf-8')
const calendar = readFileSync(join(process.cwd(), 'src/pages/Calendar.css'), 'utf-8')

/**
 * What one rule says, and nothing any other rule says.
 *
 * A sheet read whole answers for every rule in it at once, which is how the
 * first draft of the check on wrapping passed on the fault it was written to
 * catch: `flex-wrap: wrap` is written three times in `Calendar.css`, twice in
 * the legend, so the row of dots could be told not to wrap and the sheet still
 * held the words (found in review, 30.08.2026).
 *
 * Comments are blanked first, in the one place that does that (`test/sources`),
 * because this portal explains itself at length inside its rules and a brace in
 * a note would end the rule early.
 */
function rule(sheet: string, selector: string): string {
  const opens = bare(sheet).indexOf(`${selector} {`)

  expect(opens, `a rule for ${selector}`).toBeGreaterThan(-1)

  return bare(sheet).slice(opens, bare(sheet).indexOf('}', opens))
}

/** The three places a colour is written: the light theme, the dark one behind
 *  the media query, and the dark one behind the switch. Cut by the selectors
 *  themselves rather than by line number, which moves whenever anything above
 *  is edited. */
function blocks(): { where: string; text: string }[] {
  const media = tokens.indexOf('@media (prefers-color-scheme: dark)')
  const swtch = tokens.indexOf(":root[data-theme='dark']")

  expect(media, 'the media query is in this sheet').toBeGreaterThan(0)
  expect(swtch, 'the switch is in this sheet').toBeGreaterThan(media)

  return [
    { where: 'the light theme', text: tokens.slice(0, media) },
    { where: 'the dark theme, behind the media query', text: tokens.slice(media, swtch) },
    { where: 'the dark theme, behind the switch', text: tokens.slice(swtch) },
  ]
}

describe('every dot a calendar tile can carry', () => {
  it('is given a colour in each of the three theme blocks, once each', () => {
    /* Once each, not three times over the sheet. Written as a count of three
       across the whole file, this passed on the very fault it was meant to
       catch: the sixth colour was written twice into the media query and left
       out of the switch, which is three occurrences and a dot that keeps its
       light colour on a dark ground the moment somebody uses the toggle
       (measured 30.08.2026, in this branch, before the review). */
    for (const one of DOTS) {
      for (const { where, text } of blocks()) {
        expect(text.match(new RegExp(`--length-${one}:`, 'g')) ?? [], `${one} in ${where}`).toHaveLength(1)
      }
    }
  })

  it('is drawn in a colour of its own', () => {
    /* The colour is what a reader sees, so a rule that reaches for the wrong
       token gives two lengths one colour and nothing else says so. Measured:
       with the sixth dot painted `var(--length-ultra)`, every test in the
       portal passed, this one included, until it asked this question. */
    for (const one of DOTS) {
      /* Its own token and no other's, which is the whole question: a rule that
         reaches for a neighbour's gives two dots one colour, and a bookkeeping
         of who wears what would only ask the same thing twice, since a rule
         holding its own token cannot also be holding somebody else's. */
      expect(rule(table, `.length-dot--${one}`), `${one} is painted its own token`).toContain(
        `var(--length-${one})`,
      )
    }
  })

  it('is drawn at a size the calendar can write its ceiling from', () => {
    /* The row of dots on a day may be as wide as five dots and the four gaps
       between them, and wraps past that: five is what the floor of a day was
       measured to hold, and a sixth arrived on 30.08.2026 and pushed its day
       12,78px past its own edge at 780/100% until this ceiling was written
       (`pages/Calendar.css`, and the number is measured in a browser because
       jsdom lays nothing out).

       What is asked here is only that the ceiling and the dot are the same
       fact, in one place. Written apart, the dot could be made wider and the
       ceiling would go on describing the old one, which is silent: the row
       would simply overflow again, and no test that runs here can see a width.
       Both halves are named, so either one moved alone lands on this. */
    const row = rule(calendar, '.chip__lengths')

    expect(tokens, 'the size has a home').toContain('--length-dot-size:')
    expect(rule(table, '.length-dot'), 'a dot is drawn from it').toContain(
      'inline-size: var(--length-dot-size)',
    )
    expect(row, 'and the ceiling is written from the same one').toContain(
      'max-inline-size: calc(5 * var(--length-dot-size) + 4 * var(--space-4))',
    )
    expect(row, 'and the row is allowed to wrap under it').toContain('flex-wrap: wrap')
  })
})

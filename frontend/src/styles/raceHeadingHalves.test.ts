import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The two halves of a race column heading, weighed in the sheet that decides which
 * of them gives way.
 *
 * A column of a competition grid is headed by one turned line holding two elements:
 * what the race is called, and when it was run with what it measured
 * (`pages/league/LeagueResults.tsx`). The line is capped and clipped, so on every
 * screen narrower than the label something is lost, and **which** of the two is lost
 * is the whole of the decision. It is written nowhere but in `League.css`, in three
 * declarations, and until 29.08.2026 nothing measured any of them.
 *
 * **Two faults a review measured that day, both with 2297 tests green:**
 *
 * - `.league__race-called` renamed in `League.css` alone. The class has two homes,
 *   the sheet and the markup, and the only guard that read it read the markup: with
 *   the rule orphaned, Chrome on a 1280 screen cut „ km)" off
 *   ` 5. 8. 2022. (42,2 km)`, and on a 360 both columns of „Šidski novogodišnji
 *   maraton" read alike again, which is the fault the whole change was made for.
 * - `white-space: pre` turned to `normal` on `.league__race-measure`. A flex item
 *   drops the whitespace at its own edges, so the heading came out
 *   „Mrazijada2019. (6,4 km)".
 *
 * **What is asked here and what is not.** This weighs the source: that the sheet
 * still styles the classes the screen writes, and that the two halves are declared
 * with the precedence they are meant to have. Where the cut actually falls on a
 * given screen is a question for a browser, and it was measured in one, in Chrome
 * over the built stylesheet; the numbers are written beside the markup that produced
 * them (`pages/league/LeagueResults.tsx`). jsdom lays nothing out, so a test that
 * claimed to measure the cut would be claiming what the tool beneath it cannot say.
 *
 * Read as a sheet rather than as text, so the day either selector is rewritten the
 * question is still the one that matters. Precedent for reading a stylesheet as the
 * source it is: `leagueGroupWeight.test.ts` beside this file.
 */
const LEAGUE = readFileSync(join(process.cwd(), 'src/pages/league/League.css'), 'utf-8')
const SCREEN = readFileSync(join(process.cwd(), 'src/pages/league/LeagueResults.tsx'), 'utf-8')

/** The sheet without its explanations, which are longer than its rules and hold
 *  class names of their own. */
const PLAIN = LEAGUE.replaceAll(/\/\*[\s\S]*?\*\//g, ' ')

/** Every rule in the sheet as a selector and a body. A rule inside `@media` is found
 *  by its own selector, because the media block itself never matches: its body holds
 *  braces and this pattern allows none.
 *
 *  A selector may hold no semicolon either, and that is not decoration: this sheet
 *  opens with `@import`, and without the semicolon barred the whole of that statement
 *  is swallowed into the first selector, which then begins with an `@` and is dropped
 *  as an at-rule. Measured while this file was being written: the rule that turns the
 *  heading on its side went missing and nothing said so. */
const RULES = [...PLAIN.matchAll(/([^{};]+)\{([^{}]*)\}/g)]
  .map((found) => ({ selector: (found[1] ?? '').trim(), body: found[2] ?? '' }))
  .filter((rule) => !rule.selector.startsWith('@'))

/** Whether a rule dresses the given class: one of the selectors it lists ends on a
 *  compound that carries the class. A rule reaching it through an ancestor counts,
 *  and one that merely mentions it further up does not. */
function dresses(selector: string, css: string): boolean {
  return selector
    .split(',')
    .map((one) => one.trim().split(/\s+/).at(-1) ?? '')
    .some((last) => new RegExp(`\\.${css}(?![\\w-])`).test(last))
}

/** What the sheet says about one class, every rule that reaches it folded together in
 *  the order they are written. Two rules may name it: the second is inside the
 *  narrow-screen query, and it changes only the cap and the letters. */
function declared(css: string): Map<string, string> {
  const out = new Map<string, string>()

  for (const rule of RULES.filter((one) => dresses(one.selector, css))) {
    for (const line of rule.body.split(';')) {
      const at = line.indexOf(':')

      if (at > 0) {
        out.set(line.slice(0, at).trim(), line.slice(at + 1).trim())
      }
    }
  }

  return out
}

/** The middle number of the `flex` shorthand, which is how much of itself an item
 *  will give up. `flex: 0 1 auto` gives way, `flex: 0 0 auto` does not. */
function shrink(flex: string | undefined): number {
  return Number((flex ?? '').split(/\s+/)[1] ?? 'NaN')
}

/** The classes on the heading, taken from the screen rather than written here: the
 *  point of this file is that the two homes agree, and a third copy would be a third
 *  home to drift from. */
const WORN = [...SCREEN.matchAll(/className="([^"]*)"/g)]
  .flatMap((found) => (found[1] ?? '').split(/\s+/))
  .filter((one) => one.startsWith('league__race'))

describe('the heading of a race column', () => {
  it('is styled under the names the screen writes on it', () => {
    /* Both ways round. A class the screen writes and the sheet has forgotten is a
       heading nothing dresses; a class the sheet styles and the screen no longer
       writes is a rule reaching nothing. Either one is the rename that passed a whole
       gate, seen from one side or the other. */
    expect(new Set(WORN), 'the screen no longer writes the two halves').toEqual(
      new Set(['league__race', 'league__race-name', 'league__race-called', 'league__race-measure']),
    )

    for (const css of new Set(WORN)) {
      expect(declared(css).size, `nothing in League.css dresses .${css}`).toBeGreaterThan(0)
    }

    const styled = new Set(
      RULES.flatMap((rule) => [...rule.selector.matchAll(/\.(league__race[\w-]*)/g)]).map(
        (found) => found[1] ?? '',
      ),
    )

    for (const css of styled) {
      expect(WORN, `League.css dresses .${css}, which the screen writes on nothing`).toContain(css)
    }
  })

  it('gives the measure its place before the name, and lets the name go to nothing', () => {
    /* The turned line is one flex row with a cap on it, and the cap is smaller than
       many of the labels. What the browser does then is decided by these three
       declarations and nothing else: the measure refuses to shrink, the name agrees
       to, and the name is allowed all the way down to nothing.

       So the measure is served first at every width, and where the cap is narrower
       than the measure alone the name is gone entirely and the measure loses its own
       tail. Measured in Chrome on 29.08.2026 over the built sheet, at 360 where the
       cap is 104px: ` 15. 10. 2022. (42,2 km)` wants 116,69px and leaves the name
       0px. Turn either of the two numbers below around and the browser serves the
       name first, which is the fault of 29.08.2026 in its original form: two columns
       of one event reading alike because the measure was eaten. */
    const name = declared('league__race-name')
    const called = declared('league__race-called')
    const measure = declared('league__race-measure')

    expect(name.get('display'), 'the heading is no longer a flex row').toBe('inline-flex')
    expect(name.has('max-inline-size'), 'the heading is no longer capped').toBe(true)
    expect(name.get('overflow'), 'the heading no longer clips what overruns it').toBe('hidden')

    expect(shrink(called.get('flex')), 'the name no longer gives way').toBeGreaterThan(0)
    /* Without this a flex item will not shrink below its own content, and then the
       whole heading overruns the cap and the name is never cut at all. */
    expect(called.get('min-inline-size'), 'the name cannot be squeezed to nothing').toBe('0')
    expect(called.get('overflow'), 'the name no longer clips').toBe('hidden')
    expect(called.get('text-overflow'), 'the name loses its ellipsis').toBe('ellipsis')

    expect(shrink(measure.get('flex')), 'the measure gives way like the name').toBe(0)
    /* The one space in front of the measure lives in the text and not in a margin, so
       that what the element says is exactly what the label says and the screen's own
       test may compare the two. A flex item drops the whitespace at its own edges. */
    expect(measure.get('white-space'), 'the space in front of the measure is dropped').toBe('pre')
  })
})

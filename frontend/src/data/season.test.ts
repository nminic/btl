import ts from 'typescript'
import { basename } from 'node:path'
import { seasonBeingRenewed } from './pricing'
import { sources, WHOLE_PORTAL } from '../test/sources'
import {
  inYearlyWindow,
  referralMayBeSet,
  seasonRunning,
  transfersTakeEffect,
} from './season'

describe('the yearly window', () => {
  it('opens on the first of October and shuts with the year', () => {
    expect(inYearlyWindow('2026-09-30')).toBe(false)
    expect(inYearlyWindow('2026-10-01')).toBe(true)
    expect(inYearlyWindow('2026-12-31')).toBe(true)
    expect(inYearlyWindow('2027-01-01')).toBe(false)
  })

  /**
   * The year the league starts is written once, and every other name for it reads that one.
   *
   * **Two guards, because the fault has two shapes and neither sees the other.** A second name
   * holding the same number is harmless until somebody moves the first, and then half the portal
   * follows and half does not, silently, because the number was right in both places up to that
   * moment (review, 06.09.2026). And a body copied instead of called drifts the same way.
   *
   * The floor is derived and holds no list: **the whole portal may write a year as a number
   * exactly once**, and that once is `FIRST_SEASON` itself. Anything else — a price list with its
   * own 2027, a screen that types the year instead of reading it, a season worked out inline —
   * falls here and asks the question once.
   */
  it('writes the year of the first season in exactly one place', () => {
    /* **Asked of the parser, not of the text.** A line that holds a year may be prose: a review
       written down in a comment, a date inside a sentence, a slug. Only the language can say
       which four digits are a number the portal computes with, and it is the one thing here
       that cannot be wrong about its own syntax. */
    const swept = sources()

    /* **The whole portal, and that is not ambition but measurement.** The first draft swept
       `src/data` only, and the second name for this year lives outside it: `SEASON` comes out
       of `data/pricing.ts` and three screens read it, so a screen that writes the year instead
       of reading it was exactly the drift this floor is for and exactly what it could not see
       (review, 06.09.2026). Narrowing bought nothing either: over all 222 files the sweep finds
       the same single hit it found over 24.

       And no filter on the path. `sources()` records that `path.includes` reads the **absolute**
       path, so a checkout under a folder called `data` would have quietly changed what this
       measured. */
    expect(swept.length, 'the portal is still here').toBeGreaterThan(WHOLE_PORTAL)

    const written = swept
      .flatMap((one) => {
        const file = ts.createSourceFile(one.path, one.code, ts.ScriptTarget.Latest, true)
        const found: string[] = []

        const walk = (node: ts.Node): void => {
          if (ts.isNumericLiteral(node) && /^20\d\d$/.test(node.text)) {
            const [first] = node.parent.getText().split(/\r?\n/)

            found.push(`${basename(one.path)}: ${first?.trim() ?? ''}`)
          }

          ts.forEachChild(node, walk)
        }

        walk(file)

        return found
      })

    expect(written).toEqual(['season.ts: FIRST_SEASON = 2027'])
  })

  /* And the two names that answer „which season are we heading into" answer the same on every
     day that matters. Written as agreement rather than as a rule about the text, because what
     hurts is not a second copy but a second copy that says something else. */
  it('answers the same whether it is asked as a renewal or as a transfer', () => {
    for (const day of ['2026-09-30', '2026-10-01', '2026-12-31', '2027-01-01', '2025-11-15']) {
      expect(seasonBeingRenewed(day)).toBe(transfersTakeEffect(day))
    }
  })

  /* **The season a transfer lands in, on both sides of the window and on both sides of New
     Year.** It shared a body with „what is being sold" until 06.09.2026, and outside the window
     that body answered with the season that is **running**: a proposal decided on 5 January put
     its founder into a squad in the middle of a season. The two look alike and are not, so this
     asks on the days where they used to disagree. */
  it('lands a transfer at the start of a season, never inside one', () => {
    expect(transfersTakeEffect('2026-09-30')).toBe(2027)
    expect(transfersTakeEffect('2026-10-01')).toBe(2027)
    expect(transfersTakeEffect('2026-12-31')).toBe(2027)
    expect(transfersTakeEffect('2027-01-01')).toBe(2028)
    /* And never a season the league does not have: the clock can be put back, and
       „the next year" before the first season is a year nothing was run in. */
    expect(transfersTakeEffect('2025-11-15')).toBe(2027)
  })

  it('shuts the referral amount on the day the window opens, and not before', () => {
    /* Owner, 16.08.2026: „administrator podešava do 1.10. u 00 po CET za
       predstojeću godinu." The deadline and the opening of the window are one
       instant read two ways, which is why this is the negation of the window and
       not a second date to keep right.
     *
       Written here because the rule had no test of its own: the screen that
       obeys it was measured on 30 September and on 1 November, so the boundary
       itself, the one day the sentence is about, was never touched. And because
       the negation is what makes 1 January true again, which is a fact about the
       running season the screen has to admit to (pages/admin/AdminPricing.tsx). */
    expect(referralMayBeSet('2026-09-30')).toBe(true)
    expect(referralMayBeSet('2026-10-01')).toBe(false)
    expect(referralMayBeSet('2026-12-31')).toBe(false)
    expect(referralMayBeSet('2027-01-01')).toBe(true)
  })

  it('has no season running until the first one begins', () => {
    /* The one boundary this function exists for, and it had no test: the screen
       that reads it was measured in 2026 and in 2028, so the day the league's first
       season begins was never touched. A review made the comparison `<=` and the
       whole suite stayed green, which means that for the whole of 2027 the price
       list would silently drop the sentence „Sezona 2027 je u toku" and an
       administrator would set an amount in July 2027 without being told that the
       same save moves the amount standing for the season they are in.
     *
       The hour is not read, here or anywhere in this file. On 1 January until 16:00
       the portal has two seasons over one another (PDL P9 and P14: a result goes to
       the season that has closed, the widget already counts the new one), and this
       answers with the new one from midnight. Written down rather than pretended
       away, as with the hour in `referralMayBeSet` above. */
    expect(seasonRunning('2026-09-30')).toBeNull()
    expect(seasonRunning('2026-12-31')).toBeNull()
    expect(seasonRunning('2027-01-01')).toBe(2027)
    expect(seasonRunning('2027-12-31')).toBe(2027)
    expect(seasonRunning('2028-06-01')).toBe(2028)
  })
})

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { THE_CLOCKS_OWN_TESTS } from '../test/theDay'

/* The rule this file exists for: nothing on the portal reads the machine's
 * clock except src/clock/context.ts.
 *
 * Not style. A simulated date is worth something only if it cannot be gone
 * around, and it was gone around in eleven places before this: every screen that
 * cared what day it was called `new Date()` for itself. A simulation that
 * reached ten of them would be worse than none, because the calendar would open
 * on a month that disagreed with the price beside it, and the disagreement would
 * read as a bug in the portal rather than in the simulation.
 *
 * It cannot be a lint rule: `new Date(text)` parses a stored date and is used
 * everywhere, so what has to be caught is the argument-less call and Date.now(),
 * which is a question about the shape of the call. Reading the source is the
 * cheapest way to ask it, and the same trick already guards the ducat art.
 */

const ROOT = join(process.cwd(), 'src')

/** The one file allowed to read it, which is where the clock comes from. */
const ALLOWED = join('clock', 'context.ts')

/**
 * Every way of asking the machine what time it is now.
 *
 * `new Date()`, and `new Date` with no brackets at all, which is the same
 * constructor call; `Date()` without `new`, which hands back the moment as a
 * string; `Date.now()`; and an `Intl` formatter called with nothing to format,
 * which formats now. That last one is not hypothetical here: the portal builds
 * and keeps `Intl.DateTimeFormat` instances (src/i18n/format.ts), so a helper
 * that one day forgets its argument would read the clock and look like
 * formatting.
 *
 * Parsing a stored date is none of these and must go on working, which is why
 * this asks about the shape of the call rather than about the word Date.
 */
const READS_THE_CLOCK =
  /new Date\s*(\(\s*\))?(?![(\w])|(?<!new\s+)\bDate\(|Date\.now\(|\.format(ToParts)?\(\s*\)/

const IS_A_TEST = /\.test\.tsx?$/

function filesUnder(dir: string, wanted: (name: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)

    if (entry.isDirectory()) {
      return filesUnder(full, wanted)
    }

    return /\.tsx?$/.test(entry.name) && wanted(entry.name) ? [full] : []
  })
}

describe('the portal has one clock', () => {
  it('is read in exactly one file', () => {
    const readers = filesUnder(ROOT, (name) => !IS_A_TEST.test(name))
      .filter((file) => READS_THE_CLOCK.test(readFileSync(file, 'utf-8')))
      .map((file) => relative(ROOT, file))

    expect(readers).toEqual([ALLOWED])
  })

  /* And no test reads it either, which is the half the replacement in
   * `test/setup.ts` cannot see.
   *
   * That replacement pins `realToday` and so pins every screen, but a test that
   * asks the machine ITSELF what year it is goes around it entirely: measured
   * 21.09.2026, a case written as `expect(new Date().getFullYear()).toBe(2026)`
   * is green on both of the days the gate reads the suite as, because the portal
   * is never asked. It is exactly the shape that was live here -
   * `rateEvent.test.tsx` compared a card's date with the machine's year, so the
   * card and the check were two readings of one clock and could never disagree.
   *
   * The same question in the same words as the case above it, over the other half
   * of the same folder, and the same exception for the same reason: the clock's
   * own tests are ABOUT the machine's clock. `clock.test.tsx` moves the system
   * time on purpose, and this very file carries every way of reading it written
   * out as text. One home for that exception (`test/theDay.ts`), because a second
   * copy of it is a second thing to keep right.
   */
  it('and no test reads it either, outside the clock its own tests are about', () => {
    const readers = filesUnder(ROOT, (name) => IS_A_TEST.test(name))
      .filter((file) => !THE_CLOCKS_OWN_TESTS.test(file))
      .filter((file) => READS_THE_CLOCK.test(readFileSync(file, 'utf-8')))
      .map((file) => relative(ROOT, file))

    expect(readers).toEqual([])
  })

  it('notices every way of asking what time it is now', () => {
    // The check itself, since the list above passing proves only that today
    // nobody does it.
    for (const reader of [
      'const now = new Date()',
      'const now = new Date',
      'const now = Date()',
      'const now = Date.now()',
      'const month = formatter.format()',
      'const parts = formatter.formatToParts()',
    ]) {
      expect(READS_THE_CLOCK.test(reader)).toBe(true)
    }
  })

  it('goes on allowing a stored date to be read back, which is everywhere', () => {
    for (const parse of [
      'new Date(Date.UTC(year, month - 1, day))',
      'new Date(`${today}T00:00:00Z`)',
      'new Date(Date.parse(text))',
      'formatter.format(new Date(iso))',
      'const stamp = record.date',
    ]) {
      expect(READS_THE_CLOCK.test(parse)).toBe(false)
    }
  })
})

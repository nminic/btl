import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

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
 * cheapest way to ask it, and the same trick already guards the badge art.
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

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)

    if (entry.isDirectory()) {
      return sourceFiles(full)
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })
}

describe('the portal has one clock', () => {
  it('is read in exactly one file', () => {
    const readers = sourceFiles(ROOT)
      .filter((file) => READS_THE_CLOCK.test(readFileSync(file, 'utf-8')))
      .map((file) => relative(ROOT, file))

    expect(readers).toEqual([ALLOWED])
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

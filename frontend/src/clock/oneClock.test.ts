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

/** `new Date()` with nothing in it, and Date.now(). Parsing a stored date is
 *  not this and must go on working. */
const READS_THE_CLOCK = /new Date\(\s*\)|Date\.now\(/

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

  it('notices a reader that should not be one', () => {
    // The check itself, since the list above passing proves only that today
    // nobody does it.
    expect(READS_THE_CLOCK.test('const now = new Date()')).toBe(true)
    expect(READS_THE_CLOCK.test('const now = Date.now()')).toBe(true)
    // And what must go on being allowed: a stored date being read back.
    expect(READS_THE_CLOCK.test("new Date(Date.UTC(year, month - 1, day))")).toBe(false)
    expect(READS_THE_CLOCK.test("new Date(`${today}T00:00:00Z`)")).toBe(false)
  })
})

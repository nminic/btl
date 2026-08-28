import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'

/**
 * Every production source file of the portal, for the tests that make a claim
 * about what the whole portal does rather than about one screen.
 *
 * Four such sweeps were written separately and every one of them carried the
 * same two faults, so this is the one of them (16.08.2026).
 *
 * **Tests are excluded by folder and by suffix, never by the whole path.**
 * `path.includes('.test.')` reads the absolute path, so a checkout into a folder
 * whose own name carries `.test.` swept the entire application away and left a
 * guard passing over nothing. Measured with a root of `C:\work\btl.test.wt`:
 * nought files of three hundred and nineteen.
 *
 * **And the helpers the tests are written with are not production code.**
 * `src/test/` has no `.test.` in its file names, so `render.tsx` and the rest
 * were read as screens: a plain sentence in a comment there failed a guard about
 * what the portal can do. `src/dev/` stays in, because the switch of roles is
 * built and shipped and only hidden.
 */
export function sources(): { path: string; code: string }[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.isDirectory()) {
        return entry.name === 'test' ? [] : walk(join(dir, entry.name))
      }

      const code = entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')

      return code && !entry.name.includes('.test.') ? [join(dir, entry.name)] : []
    })

  return walk(join(process.cwd(), 'src')).map((path) => ({
    path,
    code: readFileSync(path, 'utf-8'),
  }))
}

/**
 * The smallest sweep that can still be the whole portal.
 *
 * A sweep narrowed by accident answers with nothing, and every guard written on
 * top of it then reads as „nothing is wrong" rather than „nothing was looked at".
 * There are around two hundred files today and the largest single folder holds
 * under a hundred, so this floor cannot be met by any one folder.
 */
export const WHOLE_PORTAL = 150

/** Where a file lives, written the way this platform writes it, for the tests
 *  that name one file to prove the sweep reached it. */
export function inside(...parts: string[]): string {
  return parts.join(sep)
}

/** What this platform puts between the parts of a path, for the one test that
 *  prints a path back and has to print it the same on either. */
export const SEP = sep

/**
 * The code with every comment blanked out, and the same length as what went in,
 * so a position in it is still a position in the file.
 *
 * A `<table` written in prose is not one drawn, and this portal explains itself
 * at length: the note above the matrix names the tag it is about, and the file
 * you are reading names it a dozen times.
 *
 * **Nothing is blanked after a colon**, which is the half a second copy of this
 * kept getting wrong. An address is `https://…`, so a stripper that blanks from
 * the first `//` to the end of the line blanks the rest of every line an address
 * appears on, and a violation written after one is invisible to every guard built
 * on top of it. Measured in `src/app/head.ts` on 23.08.2026: the violation on the
 * same line as an address went unseen, the identical violation on the next line
 * was found.
 *
 * Here rather than in `stylesheet.ts`, where it was written, because the third
 * reader of it is not about stylesheets at all: `data/contract.test.ts` sweeps
 * the portal's own source, and had a copy with the colon left out.
 */
export function bare(code: string): string {
  return code
    .replaceAll(/\/\*[\s\S]*?\*\//g, (comment) => comment.replaceAll(/[^\n]/g, ' '))
    .replaceAll(/(^|[^:])\/\/[^\n]*/g, (line, before: string) =>
      before + ' '.repeat(line.length - before.length),
    )
}

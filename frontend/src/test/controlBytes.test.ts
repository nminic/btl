import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inside, sources } from './sources'

/**
 * That no file the portal is written in carries a character nobody can see.
 *
 * Written because one did, and it made a guard that could not fail. A refusal in
 * `pages/league/leagueTable.test.ts` needed a word boundary; the expression was
 * put in by a shell replacement, the escape came out as a real backspace byte, and
 * the refusal then asked for a character no source file holds. It could not fail
 * whatever the code did, and the reading it refused came straight back with 2447
 * tests green. Found in review on 31.08.2026, and the diff showed nothing at all,
 * because the character prints as nothing.
 *
 * **Every file, tests included, and not only the two extensions the portal runs.**
 * The portal's own sweep (`test/sources.ts`) drops anything with `.test.` in its
 * name, because it answers questions about what the portal ships; this one is about
 * what is written, and the byte was written in a test. A stylesheet and a
 * dictionary are read by guards of their own (`test/stylesheet.ts`, `i18n`), and a
 * character nobody can see empties those the same way, so they are swept too.
 *
 * **Two kinds, not one.** Below a space are the control characters, of which a tab,
 * a newline and a carriage return are the three whose effect is visible. Above it
 * are characters that take no room at all or take the room of a space without being
 * one: a non-breaking space, the zero-width family, a word joiner, a byte-order
 * mark, a soft hyphen, and the two separators. Neither kind is in the portal today,
 * and either kind makes text that looks right and is not.
 *
 * What is **not** held: a character that is visible but wrong, a Cyrillic „а" among
 * Latin ones. That is a different fault and it needs a different guard; it is said
 * here rather than left to be found.
 */

/** Every file the portal is written in: code, stylesheets and dictionaries, under
 *  `src`, with nothing left out. */
function everySource(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const here = join(dir, entry.name)

    if (entry.isDirectory()) {
      return everySource(here)
    }

    return /\.(ts|tsx|css|json)$/.test(entry.name) ? [here] : []
  })
}

/**
 * Whether a character is one somebody can see the effect of.
 *
 * Asked by arithmetic rather than by a pattern, which is not a nicety: a pattern
 * for these characters is written with the very escapes that turned into one of
 * them, and this file would then be the next one carrying them and would refuse
 * itself. It did, on the first draft, six times over.
 */
function canBeSeen(one: string): boolean {
  const code = one.codePointAt(0)

  if (code === undefined) {
    return true
  }

  if (code < 32) {
    return one === '\n' || one === '\t' || one === '\r'
  }

  /* DEL, the non-breaking space, the soft hyphen, the zero-width family and the
     marks beside it, the two separators, and the byte-order mark. */
  return ![127, 160, 173, 8232, 8233, 8288, 65279].includes(code) && !(code >= 8203 && code <= 8207)
}

describe('the source of the portal', () => {
  it('carries no character that cannot be seen', () => {
    const files = everySource(join(process.cwd(), 'src'))

    /* The floor and the witness, because a sweep that finds nothing agrees with
       everything. Derived rather than written down: this sweep sees everything the
       portal's own sweep sees and the tests besides, so it must see more. A number
       here would be a number with no home, which the ADL names as a fault of its
       own — and 150, the number the first draft carried, is the floor of a sweep
       calibrated for a different population. Narrowed back to what the portal ships
       it would still have cleared 150 while the byte sat in a test (review,
       31.08.2026), which is why the witness is a test file. */
    expect(files.length).toBeGreaterThan(sources().length)
    expect(files.some((path) => path.endsWith(inside('test', 'controlBytes.test.ts')))).toBe(true)
    expect(files.some((path) => path.endsWith('.css'))).toBe(true)
    expect(files.some((path) => path.endsWith('.json'))).toBe(true)

    const carrying = files.flatMap((path) =>
      [...readFileSync(path, 'utf-8')]
        .map((one, at) => ({ one, at }))
        .filter(({ one }) => !canBeSeen(one))
        .map(({ one, at }) => `${path}: ${JSON.stringify(one)} at ${String(at)}`),
    )

    expect(carrying).toEqual([])
  })
})

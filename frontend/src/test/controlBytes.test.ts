import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * That no source file carries a character nobody can see.
 *
 * Written because one did, and it made a guard that could not fail. A refusal in
 * `pages/league/leagueTable.test.ts` needed a word boundary, `\b`; the expression
 * was put in by a shell replacement, and the escape came out as a real backspace
 * byte. The refusal then asked for a control character no source file holds, so
 * `not.toMatch` could not fail whatever the code did, and the reading it refused
 * came straight back with all 2447 tests green. Found in review on 31.08.2026, and
 * the diff showed nothing at all, because the byte prints as nothing.
 *
 * **Every file, tests included.** The portal's own sweep (`test/sources.ts`) drops
 * anything with `.test.` in its name, because it answers questions about what the
 * portal ships. This one is about what is written, and the byte was written in a
 * test, so a guard built on that sweep would have walked straight past it.
 *
 * **Asked by arithmetic rather than by a pattern**, which is not a nicety: a
 * pattern for these characters is written with the very escapes that turned into
 * one of them, and this file would then be the next one carrying them and would
 * refuse itself. It did, on the first draft. Nothing here can be mangled by a tool
 * that rewrites escapes, because there are none.
 */

/** Every file the portal is written in, tests and helpers included. */
function everySource(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const here = join(dir, entry.name)

    if (entry.isDirectory()) {
      return everySource(here)
    }

    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [here] : []
  })
}

/**
 * Whether a character is one somebody can see the effect of.
 *
 * A tab, a newline and a carriage return are; the last of those is only ever half
 * of a line ending on this platform. Everything else below a space is not, and
 * neither is the one just above the printable range, which a terminal keeps for
 * itself.
 */
function canBeSeen(one: string): boolean {
  const code = one.codePointAt(0) ?? 0

  if (code >= 32) {
    return code !== 127
  }

  return one === '\n' || one === '\t' || one === '\r'
}

describe('the source of the portal', () => {
  it('carries no character that cannot be seen', () => {
    const files = everySource(join(process.cwd(), 'src'))

    /* The floor, because a sweep that finds nothing agrees with everything. */
    expect(files.length).toBeGreaterThan(150)

    const carrying = files.flatMap((path) =>
      [...readFileSync(path, 'utf-8')]
        .map((one, at) => ({ one, at }))
        .filter(({ one }) => !canBeSeen(one))
        .map(({ one, at }) => `${path}: ${JSON.stringify(one)} at ${String(at)}`),
    )

    expect(carrying).toEqual([])
  })
})

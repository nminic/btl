import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inside, sources } from './sources'

/**
 * That no file the portal is written in carries a character nobody can see.
 *
 * Written because one did, and it made a guard that could not fail. A refusal in
 * `pages/league/leagueTable.test.ts` needed a word boundary; the expression was put
 * in by a shell replacement, the escape came out as a real backspace byte, and the
 * refusal then asked for a character no source file holds. It could not fail
 * whatever the code did, and the reading it refused came straight back with 2447
 * tests green. The diff showed nothing at all, because the character prints as
 * nothing.
 *
 * **Every file the portal is written in, and the pages it publishes.** The portal's
 * own sweep (`test/sources.ts`) drops anything with `.test.` in its name, because it
 * answers questions about what the portal ships; this one is about what is written,
 * and the byte was written in a test. Stylesheets and dictionaries are read by
 * guards of their own, and the written pages are read by six — a character nobody
 * can see empties any of them the same way. `public/mock` is swept for that reason,
 * the way `data/contract.test.ts` sweeps it (ADL A20).
 *
 * **Asked by what Unicode calls these characters, not by a list.** Two lists written
 * by hand were both too short. The first held seven code points and let through the
 * whole bidirectional family, `U+202E` among them, which is the character that makes
 * source read one way and run another (CVE-2021-42574). The second named six classes
 * and let through `U+3164` and its Hangul kin, which draw as nothing and are not
 * format characters at all (both measured in review, 31.08.2026).
 *
 * What names most of the fault in one word is `Default_Ignorable_Code_Point`:
 * Unicode's own list of what a renderer should draw as nothing, and it carries the
 * zero-width family, the bidirectional overrides, the variation selectors and the
 * fillers together. It does **not** carry all of `Cf`: thirty-two format characters
 * stand outside it, and replacing one class with the other quietly dropped them
 * (measured in review, 31.08.2026), so both are asked for. Beside them stand the
 * controls, the separators, and every space that is not the space.
 *
 * What is **not** held: a character that is visible but wrong, a Cyrillic „а" among
 * Latin ones. That is a different fault, it needs a different guard, and it is said
 * here rather than left to be found.
 */

/** Every file the portal is written in: code, stylesheets and dictionaries under
 *  `src`, and the pages it publishes under `public/mock`. */
function everySource(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const here = join(dir, entry.name)

    if (entry.isDirectory()) {
      return everySource(here)
    }

    return /\.(ts|tsx|css|json)$/.test(entry.name) ? [here] : []
  })
}

/** The braille blank, written as its number rather than as itself: put in as the
 *  character, this file becomes the next one carrying it and refuses itself, which
 *  is what the first draft did. */
const BRAILLE_BLANK = 0x2800

/**
 * Whether a character is one somebody can see the effect of.
 *
 * A tab, a newline and a carriage return are, and they are the only three below a
 * space that are. Everything else is asked of Unicode: `Cc` control, `Zl` and `Zp`
 * separators, `Zs` — every space character except the one on the keyboard — and
 * `Default_Ignorable_Code_Point`, which is Unicode's own name for what a renderer
 * should draw as nothing: the zero-width family, the bidirectional overrides, the
 * byte-order mark, the soft hyphen, the variation selectors and the fillers.
 */
function canBeSeen(one: string): boolean {
  if (one === '\n' || one === '\t' || one === '\r' || one === ' ') {
    return true
  }

  /* The braille blank belongs to none of those classes: it is a printing character
     that prints nothing, and it is the one exception a class cannot carry. */
  if (one.codePointAt(0) === BRAILLE_BLANK) {
    return false
  }

  return !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Zs}\p{Default_Ignorable_Code_Point}]/u.test(one)
}

describe('the source of the portal', () => {
  it('carries no character that cannot be seen', () => {
    const here = process.cwd()
    const files = [...everySource(join(here, 'src')), ...everySource(join(here, 'public', 'mock'))]

    /* The floor, and it asks for **containment** rather than for a count. Written as
       „more files than the portal's own sweep" it left two hundred of them spare:
       skipping the whole of `pages`, every screen there is, still cleared the number
       (review, 31.08.2026). Every file that sweep sees, this one sees, and the tests
       and the written pages besides. */
    const shipped = sources().map((one) => one.path)

    expect(shipped.filter((path) => !files.includes(path)), 'files the portal sweep sees and this does not').toEqual([])

    /* And a witness of every kind, not one witness. Containment against the portal's
       own sweep says nothing about the files that sweep never sees, so narrowing this
       one to skip every `.test.tsx` — seventy files — cleared it, and the three
       witnesses it had were one apiece of the kinds that survived (review,
       31.08.2026). Each kind that could be dropped on its own is named. */
    for (const kind of [
      inside('test', 'controlBytes.test.ts'),
      /* A folder is an axis of its own, and `styles` is the one that hides: it holds
         twelve guards and four stylesheets and not a single file the portal ships, so
         containment against the portal's sweep says nothing about it and no other
         witness lives there (review, 31.08.2026). */
      inside('styles', 'circle.test.ts'),
      inside('pages', 'publicScreens.test.tsx'),
      inside('data', 'derive.ts'),
      inside('pages', 'Leagues.tsx'),
      inside('pages', 'league', 'League.css'),
      inside('i18n', 'sr.json'),
      inside('mock', 'pages.json'),
    ]) {
      expect(files.some((path) => path.endsWith(kind)), kind).toBe(true)
    }

    const carrying = files.flatMap((path) =>
      [...readFileSync(path, 'utf-8')]
        .map((one, at) => ({ one, at }))
        .filter(({ one }) => !canBeSeen(one))
        .map(({ one, at }) => `${path}: ${JSON.stringify(one)} at ${String(at)}`),
    )

    expect(carrying).toEqual([])
  })
})

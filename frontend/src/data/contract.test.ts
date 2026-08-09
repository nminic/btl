import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES } from './client'

/* Two rules that say something the code cannot say for itself, and that have
 * each been broken once without anything noticing.
 */

const SRC = join(process.cwd(), 'src')

describe('the list of resources', () => {
  it('is the eleven names the backend has to answer for', () => {
    /* ADL A7 calls this a contract: whoever adds a twelfth resource adds it to
       the contract on the same day. Nothing was holding it, so the list could
       have grown or shrunk in silence, and the sentence in the log that says it
       is closed would have gone on saying so.

       Ten until 07.08.2026, when comments a moderator has published became a
       record of their own (owner, 06.08.2026). They arrive through the queue and
       do not live in it: the queue holds what is waiting, and a screen reading a
       published comment out of it would have to decide all over again what
       counts as decided. */
    expect([...RESOURCE_NAMES]).toEqual([
      'ducats',
      'comments',
      'competitors',
      'events',
      'leagues',
      'moderators',
      'pages',
      'races',
      'results',
      'teams',
      'verification',
    ])
  })

  it('is matched by a file under public/mock for every one of them', () => {
    /* The other half: a name in the contract with no file behind it is a screen
       that fails on a request nobody can answer. */
    const served = readdirSync(join(process.cwd(), 'public', 'mock'))

    expect(RESOURCE_NAMES.filter((name) => !served.includes(`${name}.json`))).toEqual([])
  })
})

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return sourceFiles(path)
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** A file with what it says about itself taken out, so a rule about what the code
 *  does is not answered by a comment explaining the rule. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf-8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/\/\/[^\n]*/g, '')
}

describe('the screens that draw a section of a written page', () => {
  /* Three of them: the rulebook, the written pages, and the card on the front
   * page that carries the address of the president. What a record shows is its
   * own sections and the ones it takes in, and that is `sectionsOf`; reading
   * `page.sections` instead draws one record two ways depending on which screen
   * is drawing it.
   *
   * It has been broken quietly once already: the front page went on reading
   * `page.sections` while the comment that said why it should not was deleted in
   * the same change. A comment is not a guard, so this is one. Read off the
   * source, the same shape as the guard on the clock (src/clock/oneClock.test.ts)
   * and the one on the writing of a filter (src/app/filterParams.test.ts).
   *
   * It has to be read off the source, because no screen test can ever catch it:
   * no record in `public/mock/pages.json` takes another one in today, so the two
   * ways of reading a record draw the same thing. The day one does, the screen
   * that reads it the wrong way draws less, and nothing says so.
   */
  const files = sourceFiles(SRC)

  /* The two files that reach for the field itself, each for a reason that is not
     drawing a page: one says what a page shows, the other lists the pages for the
     administrator and counts the sections of each. */
  const ALLOWED = [join('data', 'pages.ts'), join('pages', 'admin', 'AdminPages.tsx')]

  it('reads the whole application, and finds both files that are allowed it', () => {
    expect(files.length).toBeGreaterThan(80)
    expect(files.filter((path) => ALLOWED.some((one) => path.endsWith(one)))).toHaveLength(2)
  })

  it('reaches a record through sectionsOf, never through its own sections', () => {
    /* The field itself, both ways it can be spelt: read off the record, and
       pulled out of it into a name of its own. The first version of this forbade
       `page.sections.map(` and held nothing, because the most ordinary rewrite
       there is walks straight past it; the second forbade `.sections` and was
       walked past by `const { sections } = page`.

       A name that merely reads `sections` is left alone: what comes back from
       `sectionsOf` is called that in the rulebook, and rightly. */
    const READ_OFF_THE_RECORD = /\.sections\b|\{[^}]*\bsections\b[^}]*\}\s*=/

    const straight = files.filter(
      (path) =>
        !ALLOWED.some((one) => path.endsWith(one)) && READ_OFF_THE_RECORD.test(codeOf(path)),
    )

    expect(straight.map((path) => path.slice(SRC.length + 1))).toEqual([])
  })
})

/**
 * One name for one thing, after the rename of 06.08.2026.
 *
 * The owner asked for the badges to become Dukati and, asked whether that
 * reached the code and the addresses too, answered that it did (PDL P11). A
 * rename of four hundred occurrences across seventy-five files is exactly the
 * kind that half happens: one file keeps the old word, and the portal has two
 * names for one thing again with nothing saying so.
 *
 * Two things keep the old word on purpose and are named here, so that "no
 * exceptions" does not have to mean "no old address":
 *
 * The public page that no longer exists. It was folded into the rulebook on
 * 04.08.2026, and two tests say so by name; an address that stopped being
 * served has to go on being written down somewhere or nothing holds that it
 * stopped.
 *
 * And this file, whose own prose is about the rename.
 */
describe('what the ducats are called', () => {
  /**
   * The three files that keep the old word on purpose.
   *
   * Named one by one rather than caught by a pattern: a pattern would let the
   * next file that keeps the old word in past it. And the list is held to
   * exactly these three below, because a list nothing bounds is a line anybody
   * can add to silence a file.
   */
  const ALLOWED = ['app/navigation.test.tsx', 'app/routes.test.ts', 'data/contract.test.ts']

  it('is nowhere still the old word, in any language', () => {
    const said: string[] = []

    for (const { path, code } of everything()) {
      if (ALLOWED.includes(path)) {
        continue
      }

      /* Without regard to case, because the first pass asked for `[Bb]adge` and
         a constant written `BADGES` walked past it, as did every capitalised
         `Značke`: a guard that sees two of the three ways a word is written is
         one that lets the third through. */
      for (const match of code.matchAll(/[A-Za-z]*badge[A-Za-z_]*|zna[čc]k[a-zčćšđž]*/gi)) {
        said.push(`${path}: ${match[0]}`)
      }
    }

    expect(said).toEqual([])
  })

  it('holds the list of exceptions to exactly those three', () => {
    /* Otherwise the list is a place to put whatever fails: adding a path to it
       and the old word to that file passed everything, which is a guard that
       can be switched off from inside. */
    expect(ALLOWED).toHaveLength(3)
    expect(ALLOWED.filter((one) => one !== 'data/contract.test.ts')).toEqual([
      'app/navigation.test.tsx',
      'app/routes.test.ts',
    ])
  })

  it('keeps the dead public address written down, which is what those two hold', () => {
    const holding = ['app/navigation.test.tsx', 'app/routes.test.ts']
    const kept = everything().filter((one) => holding.includes(one.path))

    expect(kept.map((one) => one.path).sort()).toEqual([...holding].sort())
    expect(kept.every((one) => one.code.includes('znacke'))).toBe(true)
  })

  it('reads the words a visitor sees, and not only the code', () => {
    /* The dictionary and the generated records were outside the sweep, and that
       is where the old word actually survived: a heading that said Dukati over a
       paragraph whose first word was Značka, and a ducat whose own name began
       with it. Neither is code, and both are on a public page. */
    const read = everything().map((one) => one.path)

    expect(read).toContain('i18n/sr.json')
    expect(read).toContain('mock/pages.json')
    expect(read).toContain('mock/ducats.json')
  })

  it('reads every file, so the sweep above is looking at something', () => {
    expect(everything().length).toBeGreaterThan(150)
    expect(everything().some((one) => one.path.endsWith('DucatGallery.tsx'))).toBe(true)
  })
})

/**
 * Everything the rename had to reach: the code, the words a visitor reads, and
 * the records the portal is generated from.
 *
 * Two roots rather than one, because the old word survived in neither of the
 * places `src/**` alone could see it. Paths under `public/mock` are given
 * without that prefix, so a file reads as `mock/pages.json`.
 */
function everything(): { path: string; code: string }[] {
  return [
    ...under(join(process.cwd(), 'src'), '', ['.ts', '.tsx', '.css', '.json']),
    ...under(join(process.cwd(), 'public'), '', ['.json']),
  ]
}

function under(dir: string, prefix: string, kinds: string[]): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return under(at, name, kinds)
    }

    return kinds.some((kind) => entry.name.endsWith(kind))
      ? [{ path: name, code: readFileSync(at, 'utf-8') }]
      : []
  })
}

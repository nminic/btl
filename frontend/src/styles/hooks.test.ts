import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A class or a custom property named on one side and not the other.
 *
 * The rename of 06.08.2026 moved five hundred occurrences across markup and
 * stylesheets, and the guard written for the word catches the word that went,
 * never a name changed in one file and left standing in the other. Half-renaming
 * `--ducat-art-size` on the profile passed every test on the portal, and the
 * drawing there would have fallen back to its default at every width.
 *
 * The first answer was a list of five pairs written by hand. A list is the wrong
 * shape: there are twenty of these names and it held a quarter of them, so the
 * very one its own note cited as the reason could still be half-renamed at its
 * other end. This reads them all instead.
 *
 * The rule is one sentence: a name the ducats hang on stands in a stylesheet and
 * outside one. A class is written in markup and selected in a sheet; a custom
 * property is set in one of the two and read in the other. Either way it takes
 * both ends to do anything, so a name with only one end is either dead or
 * broken, and which of the two hardly matters.
 *
 * Comments are blanked first. `toContain` over a whole file was satisfied by a
 * note saying `was .awards__ducats` left above the renamed rule, which is
 * exactly where an old name lingers.
 */

const SRC = join(process.cwd(), 'src')

/**
 * Every name a ducat hangs on: the classes a stylesheet selects and markup
 * writes, and the two custom properties.
 *
 * Written as shapes rather than as a list, so a new class joins on the day it is
 * written. The custom properties are matched with their dashes and the classes
 * without them: without that separation `--ducat-art-size` was read as a class
 * called `ducat-art-size`, and every module named `ducatRule` or `ducatEarned`
 * was read as a class nothing styles.
 */
const SET = /(--ducat[a-z0-9-]*)\s*(?::|'\s*\]?\s*:|"\s*\]?\s*:)/g
const READ = /var\(\s*(--ducat[a-z0-9-]*)/g
const CLASS = /(?:^|[.\s"'`>,:])((?:ducat|ducats|awards__ducat|awards__ducats|inbox__count)(?:[-_][a-z0-9_-]+)*)(?![A-Za-z0-9_-])/g


/** Every file under `src` of the given kinds, tests left out: what a test
 *  mentions is not what the portal draws. */
function under(kinds: string[], dir = SRC, prefix = ''): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return under(kinds, at, name)
    }

    return kinds.some((kind) => entry.name.endsWith(kind)) && !entry.name.includes('.test.')
      ? [{ path: name, code: readFileSync(at, 'utf-8') }]
      : []
  })
}

/** The text with every comment blanked, so a name that survives only in prose
 *  counts for nothing. */
function bare(code: string): string {
  return code.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/** Every hook named in the given files, with where each one was found. */
function named(files: { path: string; code: string }[]): Map<string, string[]> {
  const found = new Map<string, string[]>()

  for (const { path, code } of files) {
    const text = bare(code)
    const names = [...text.matchAll(CLASS)].map((one) => one[1])

    for (const name of names) {
      if (name !== undefined) {
        found.set(name, [...(found.get(name) ?? []), path])
      }
    }
  }

  return found
}

describe('the hooks the ducats hang on', () => {
  const inSheets = named(under(['.css']))
  const inTheRest = named(under(['.ts', '.tsx']))

  it('finds them, so what follows is not a check over an empty list', () => {
    /* Nineteen classes and two properties today. Written as a floor rather than
       as the number, because a new ducat class is an ordinary thing to add and
       this test is not about how many there are. */
    expect(new Set([...inSheets.keys(), ...inTheRest.keys()]).size).toBeGreaterThan(15)
    expect([...inSheets.keys()]).toContain('ducat-art')
    expect([...inTheRest.keys()]).toContain('inbox__count')
    expect(properties(SET).size).toBe(2)
  })

  it('names every class in a stylesheet and in the markup that writes it', () => {
    const lonely = [...new Set([...inSheets.keys(), ...inTheRest.keys()])]
      .filter((name) => !inSheets.has(name) || !inTheRest.has(name))
      .map((name) => `${name} (only in ${(inSheets.get(name) ?? inTheRest.get(name) ?? []).join(', ')})`)

    expect(lonely).toEqual([])
  })

  it('sets every custom property somewhere and reads it somewhere else', () => {
    /* Not "in a stylesheet and outside one": one of the two is set in a sheet
       and read in another sheet, and the other is set from a component and read
       in a sheet. What has to hold either way is that both ends exist. */
    const set = properties(SET)
    const read = properties(READ)
    const lonely = [...new Set([...set, ...read])].filter(
      (name) => !set.has(name) || !read.has(name),
    )

    expect(lonely).toEqual([])
  })
})

/** Every custom property the given pattern finds, across every file the portal
 *  draws from. */
function properties(pattern: RegExp): Set<string> {
  const found = new Set<string>()

  for (const { code } of under(['.css', '.ts', '.tsx'])) {
    for (const match of bare(code).matchAll(pattern)) {
      const name = match[1]

      if (name !== undefined) {
        found.add(name)
      }
    }
  }

  return found
}

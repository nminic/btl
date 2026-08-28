import { readFileSync, readdirSync } from 'node:fs'
import { bare } from '../test/sources'
import type { MembershipBasis } from '../data/types'
import { SUBMISSION_STATUSES } from '../session/context'
import { join } from 'node:path'

/**
 * A class or a custom property named on one side and not the other.
 *
 * Not every one on the portal: the names read here are the ones the two changes
 * of 06.08.2026 touched, listed as prefixes in `CLASS` and `SET` below. A class
 * named outside that list is not seen, and joins the day its prefix does. What
 * makes the list is a family that a rename or a rebuild has already moved, since
 * that is where an end gets left behind.
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
const CLASS = /(?:^|[.\s"'`>,:])((?:ducat|ducats|awards__ducat|awards__ducats|inbox__count|adminsection|entity-races)(?:[-_][a-z0-9_-]+)*)(?![A-Za-z0-9_-])/g


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

/**
 * What of a file may name a class.
 *
 * A stylesheet, all of it. A component, only what it writes into `className` or
 * `class`: everything else in it is identifiers, and an identifier that happens
 * to read like a class is how `ducats` kept both its ends while one of them was
 * renamed.
 */
function written(text: string, path: string): string {
  if (path.endsWith('.css')) {
    return text
  }

  const said: string[] = []

  for (const match of text.matchAll(/class(?:Name)?=/g)) {
    const at = (match.index ?? 0) + match[0].length

    said.push(text.slice(at, at + valueLength(text, at)))
  }

  /* The strings inside the attribute, because a class is often chosen: the panel
     writes `open ? 'a a--open' : 'a'`, and reading the expression whole would
     take the word `open` for a class name. */
  return said
    .flatMap((one) => [...one.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)])
    .map((one) => one[1] ?? one[2] ?? one[3] ?? '')
    .join(' ')
}

/** How far the value of an attribute reaches: to the end of the quoted string,
 *  or to the brace that closes the expression. */
function valueLength(text: string, at: number): number {
  const opens = text[at]

  if (opens === '"' || opens === "'") {
    return (text.indexOf(opens, at + 1) - at) + 1
  }

  let depth = 0

  for (let index = at; index < text.length; index += 1) {
    if (text[index] === '{') {
      depth += 1
    } else if (text[index] === '}') {
      depth -= 1

      if (depth === 0) {
        return index - at + 1
      }
    }
  }

  return 0
}


/**
 * Every hook named in the given files, with where each one was found.
 *
 * In markup only where a class is actually written as one. The first pass read
 * any bare word, and `ducats` and `ducat` are also ordinary identifiers all over
 * the data layer, so those two names had their "outside a stylesheet" end
 * satisfied by an import and could be half-renamed in the markup with the guard
 * green.
 */
function named(files: { path: string; code: string }[]): Map<string, string[]> {
  const found = new Map<string, string[]>()

  for (const { path, code } of files) {
    const text = bare(code)
    const names = [...written(text, path).matchAll(CLASS)].map((one) => one[1])

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

  /* Every custom property on the portal, not only the ones the ducats hang on.
     A name read and never set is a declaration the browser throws away whole:
     `border-bottom: 1px solid var(--line)` with no --line anywhere draws no
     border at all, silently, and that is how the sector names on the wide screen
     shipped without the rule under them (tenth review, 10.08.2026). */
  /* Nothing may stand before the two dashes. Without that, a modifier class
     inside a ternary (`open ? 'a a--open' : 'a'`) and a pseudo-class on one in a
     sheet (`.rankings--tooled:has(...)`) both read as a property being set, and
     twelve names the portal never sets counted as set: --open and --waiting are
     modifiers of this very navigation, so `var(--waiting)` here, which is the
     exact typo this test is for, passed. */
  const ANY_SET = /(?<![\w-])(--[a-z][a-z0-9-]*)\s*(?::|'\s*\]?\s*:|"\s*\]?\s*:|'\s*,)/g
  const ANY_READ = /var\(\s*(--[a-z][a-z0-9-]*)/g

  it('reads no custom property that nothing sets', () => {
    const set = properties(ANY_SET)
    const missing = [...properties(ANY_READ)].filter((name) => !set.has(name))

    expect(missing).toEqual([])
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

/* The pill whose class name is worked out from a value rather than written:
 * `tag--${one.membershipBasis}` (pages/admin/AdminMembers.tsx), and the same
 * shape for the state of a submission and of an event.
 *
 * The ground of membership was renamed once, on 17.08.2026, and the rule that
 * colours it stayed behind under the old name: the pill lost its colour, the
 * rule became unreachable, and nothing said so.
 *
 * Asked the way round that can fail. Not „every value has a rule", since a
 * value drawn in the plain colour needs none, but „every rule names a value",
 * which is exactly what a rename breaks. */
describe('the pill whose name is worked out from a value', () => {
  /** Every value that may stand after `tag--`, off the sources that define them, and
   *  nothing written by hand beside them.
   *
   *  Two names used to stand here as exceptions, `confirmed` and `cancelled`, with a
   *  comment sending the reader to a type called `EventState`. No such type exists: the
   *  only mention of that name in the whole repository was the comment itself, and the
   *  two rules it kept alive were drawn by nobody. A list of exceptions is a way to make
   *  a guard agree with whatever it finds, so both the rules and the exceptions are gone
   *  and the guard is again what its own name says. */
  const NAMED: string[] = [
    ...(['payment', 'feeExempt'] satisfies MembershipBasis[]),
    ...SUBMISSION_STATUSES,
  ]

  it('has no rule left behind under a name nothing draws any more', () => {
    const styles = readFileSync(join(SRC, 'pages/member/Member.css'), 'utf8')
    const named = [...styles.matchAll(/\.tag--([A-Za-z]+)/g)].map((found) => String(found[1]))

    expect(named.length, 'no rule of the pill is written at all').toBeGreaterThan(0)
    expect(named.filter((one) => !NAMED.includes(one))).toEqual([])
  })
})

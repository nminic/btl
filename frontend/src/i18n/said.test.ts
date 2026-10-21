import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import devSr from '../dev/words.sr.json'
import sr from './sr.json'

/**
 * Every name the portal asks the dictionary for, and whether the dictionary has
 * it.
 *
 * `translate` answers a name it does not know with the name itself, which is the
 * right thing at the moment of asking and the wrong thing to find out about from
 * a visitor. It has gone wrong three times in one week, each time in a different
 * place and each time invisible: a key written into `seo.leagues` instead of
 * `leagues` printed `leagues.racesUnknown` in a table cell, one written into
 * `admin.field` instead of `admin.hint` printed itself under a form field, and
 * one deleted with a screen that no longer exists was still asked for by the
 * front page. Coverage cannot see any of it, because the call runs either way.
 *
 * Read off the source rather than off a render: a name is asked for in code, and
 * the screen that asks may be one no test opens.
 */

const SRC = join(process.cwd(), 'src')

/** Every file the portal is built from, tests aside: a name a test asks for is
 *  the test's business. */
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
 * A name asked for with no gaps in it: `t('event.races')`, and the `labelKey`
 * and `hintKey` of a form definition.
 *
 * Names built out of a value are not read: `admin.form.new.${entity.id}` is a
 * family rather than a name, and the lists it is built from have guards of their
 * own (entityForms.test, keys.test). What is read here is every name written out
 * in full, which is what has gone wrong every time.
 */
const NAME = '[a-z][a-zA-Z0-9]*(?:\\.[a-zA-Z0-9]+)+'
const KEYS = '(?:label|hint|title|submit|placeholder|shown|source)Key'
/** What the dictionary opens with, which is what tells a name from a sentence. */
const TOP = Object.keys(sr).join('|')
const ASKED = new RegExp(
  [
    "\\bt\\(\\s*'(" + NAME + ")'",
    '"' + KEYS + '":\\s*"(' + NAME + ')"',
    /* The same thing written in TypeScript rather than in a definition: an
       entity says `hintKey: 'admin.hint.eventFromScreen'`, and that one printed
       itself under a form field for want of being read here. */
    KEYS + ":\\s*'(" + NAME + ")'",
    /* And the name an error carries: a rule answers with `{ key: 'admin.eventTaken' }`,
       which is a name written out in full like any other and stood outside this net
       until a rule was added that uses one. */
    "\\bkey:\\s*'(" + NAME + ")'",
    /* And a name that reaches `t` through something else: a queue picks between
       two questions and asks for whichever it chose, a helper answers with the
       name of a state. Thirty six names were written out in full and stood
       outside this net for want of `t(` on the same line (tenth review,
       10.08.2026).

       What tells one of these from an ordinary string is its first segment: it
       is one of the names the dictionary opens with, and prose does not use
       those with a dot after them.

       Which is a rule about the words and not about their meaning, so a sort key
       or a field path that happens to begin with one of them ('event.date',
       'profile.name') will be reported here as a name the dictionary does not
       have. The report names the file and the string; the answer is to build
       that string from something other than a literal, not to widen this. */
    "'((?:" + TOP + ")(?:\\.[a-zA-Z0-9]+)+)'",
  ].join('|'),
  'g',
)

/**
 * A file that imports the words of the development controls (`dev/words.ts`) is answered by
 * THEIR book and by no other, and every other file by the dictionary of the portal.
 *
 * Two books because the words of the two switches are kept out of the dictionary every
 * screen imports whole (28869, ADL A15): a production bundle carried them for controls it
 * does not draw. The split is read off the import and not off a list, so a third file that
 * reads `useDevWords` is held to the same book, and a screen that asked for `role.label`
 * through `useI18n` is told the portal does not have it.
 */
const ASKS_THE_BOOK_OF_THE_CONTROLS = /from '(?:\.\.\/dev\/|\.\/)words'/

/** What the dictionary answers, or nothing. Read as the file is written: a leaf
 *  may be a sentence or the three forms of a plural. */
function held(name: string, book: unknown): boolean {
  let at: unknown = book

  for (const step of name.split('.')) {
    if (typeof at !== 'object' || at === null || !(step in at)) {
      return false
    }

    at = Object.getOwnPropertyDescriptor(at, step)?.value
  }

  return typeof at === 'string' || (typeof at === 'object' && at !== null)
}

describe('what the portal asks the dictionary for', () => {
  const asked = under(['.ts', '.tsx', '.json']).flatMap(({ path, code }) =>
    [...code.matchAll(ASKED)].map((one) => ({
      path,
      name: one[1] ?? one[2] ?? one[3] ?? one[4] ?? one[5] ?? '',
      book: ASKS_THE_BOOK_OF_THE_CONTROLS.test(code) ? devSr : sr,
    })),
  )

  it('asks for a great many names, so what follows is not a check over nothing', () => {
    expect(new Set(asked.map((one) => one.name)).size).toBeGreaterThan(200)
    expect(asked.some((one) => one.name === 'home.results')).toBe(true)
  })

  it('reads the two switches against their own book, which is not the portal’s', () => {
    /* The floor under the split above: with no file answered by the book of the controls
       the case after it would pass over nothing, and a pattern that stopped matching the
       import would send the switches to the portal’s dictionary, which no longer has them,
       and fail on every name - or, with the keys put back there, pass on none of this. */
    const theirs = asked.filter((one) => one.book === devSr)

    expect(new Set(theirs.map((one) => one.path))).toEqual(
      new Set(['roles/RoleSwitch.tsx', 'clock/DateSwitch.tsx']),
    )
    expect(theirs.map((one) => one.name)).toContain('role.label')
    expect(theirs.map((one) => one.name)).toContain('clock.reset')
    expect(theirs.map((one) => one.name)).toContain('server.named')
    expect(held('role.label', sr)).toBe(false)
    expect(held('role.label', devSr)).toBe(true)
  })

  it('has every one of them', () => {
    const missing = [...new Set(asked.filter((one) => !held(one.name, one.book)).map(
      (one) => `${one.path}: ${one.name}`,
    ))]

    expect(missing).toEqual([])
  })
})

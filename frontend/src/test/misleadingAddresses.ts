/* Addresses that read as one host and open another, written once and read by three files.
 *
 * Measured on 03.10.2026 by the review of the change that made an address in the terms or the prizes
 * of a competition a link, and completed the same day with the ways to the same hosts that the review
 * did not try (a `%` escape, a backslash). Every one of them is accepted by the gate
 * (`data/outsideLink.ts`), which is why `pages/league/addressesIn.ts` has to refuse them itself:
 *
 * - `pages/league/addressesIn.test.ts` holds that the gate accepts each one and what host a browser
 *   opens for it, and asks the parser about every address it turns into a link;
 * - `pages/league/addressesInAlone.test.ts` holds that each one is words under a gate that accepts
 *   everything, so the refusal is the doing of `addressesIn` and of nothing beneath it;
 * - `pages/league/leagueAddresses.test.tsx` holds that the list of competitions draws each one as
 *   words.
 *
 * **Written with code points and never with the characters.** Some of these draw as nothing, and
 * `test/controlBytes.test.ts` refuses a source file that carries one: a table that held them as
 * themselves is a table nobody can read in a diff, and a file that fails that guard. The Cyrillic
 * small letters A, ES and IE look like Latin ones, which is the one fault that guard says it does not
 * hold, so they are written as numbers too and the reader sees what they are.
 *
 * `src/test/` is outside the coverage sweep and outside `sources()`, which is where a table read by
 * cases belongs. */

/** The character with this number. */
export const fromPoint = (point: number): string => String.fromCodePoint(point)

/** A backslash, which a browser reads as a slash and a reader does not. */
export const BACKSLASH = String.fromCharCode(92)

/** The host every address below reads as. */
export const SHOWN = 'www.runtrace.net'

export type Misleading = {
  /** The address as an administrator would type it into the box. */
  typed: string
  /** How it is done, in words, for the name of a case. */
  how: string
  /** The host a browser opens for it, measured on 03.10.2026 with Node's `URL` and with jsdom's. */
  opens: string
}

const SLASH_FORMS: [string, number, string][] = [
  ['U+2215 DIVISION SLASH', 0x2215, 'www.runtrace.xn--netzlo-re3c.example'],
  ['U+2044 FRACTION SLASH', 0x2044, 'www.runtrace.xn--netzlo-rq0c.example'],
  ['U+29F8 BIG SOLIDUS', 0x29f8, 'www.runtrace.xn--netzlo-kx4d.example'],
]

const NOTHING_FORMS: [string, number, string][] = [
  ['U+3164 HANGUL FILLER', 0x3164, 'www.runtrace.netzlo.example'],
  ['U+2800 BRAILLE PATTERN BLANK', 0x2800, 'www.runtrace.xn--netzlo-r11d.example'],
]

/**
 * What a reader takes for `www.runtrace.net` and a browser does not.
 *
 * Each way is written in both forms the owner's sentence names (`www.` and `https://`) wherever
 * both exist, because a rule that is applied to one of the two forms only is a rule that half of the
 * table cannot tell from the right one. The slashes that a browser skips stand behind a scheme, so
 * the three ways that use them are in the `https://` form only.
 */
export const MISLEADING: readonly Misleading[] = [
  { typed: 'www.runtrace.net@zlo.example', how: 'a user part, with www.', opens: 'zlo.example' },
  {
    typed: 'https://www.runtrace.net@zlo.example',
    how: 'a user part, with https://',
    opens: 'zlo.example',
  },
  {
    typed: 'https:///www.runtrace.net@zlo.example',
    how: 'a user part behind a third slash, which a browser skips',
    opens: 'zlo.example',
  },
  {
    typed: 'https:////www.runtrace.net@zlo.example',
    how: 'a user part behind a fourth slash',
    opens: 'zlo.example',
  },
  {
    typed: `https://${BACKSLASH}${BACKSLASH}www.runtrace.net@zlo.example`,
    how: 'a user part behind two backslashes, which a browser skips as it skips slashes',
    opens: 'zlo.example',
  },
  {
    typed: `www.runtr${fromPoint(0x430)}${fromPoint(0x441)}${fromPoint(0x435)}.net`,
    how: 'Cyrillic letters that look Latin, with www.',
    opens: 'www.xn--runtr-8ve9a9f.net',
  },
  {
    typed: `https://www.runtr${fromPoint(0x430)}${fromPoint(0x441)}${fromPoint(0x435)}.net`,
    how: 'Cyrillic letters that look Latin, with https://',
    opens: 'www.xn--runtr-8ve9a9f.net',
  },
  ...SLASH_FORMS.flatMap(([name, point, opens]): Misleading[] => [
    {
      typed: `https://www.runtrace.net${fromPoint(point)}zlo.example`,
      how: `${name}, which is no slash, with https://`,
      opens,
    },
    {
      typed: `www.runtrace.net${fromPoint(point)}zlo.example`,
      how: `${name}, which is no slash, with www.`,
      opens,
    },
  ]),
  ...NOTHING_FORMS.flatMap(([name, point, opens]): Misleading[] => [
    {
      typed: `www.runtrace.net${fromPoint(point)}zlo.example`,
      how: `${name}, which draws as nothing, with www.`,
      opens,
    },
    {
      typed: `https://www.runtrace.net${fromPoint(point)}zlo.example`,
      how: `${name}, which draws as nothing, with https://`,
      opens,
    },
  ]),
  {
    typed: 'www.runtrace.net%E2%88%95zlo.example',
    how: 'the escape of U+2215, with www.',
    opens: 'www.runtrace.xn--netzlo-re3c.example',
  },
  {
    typed: 'https://www.runtrace.net%E2%88%95zlo.example',
    how: 'the escape of U+2215, with https://',
    opens: 'www.runtrace.xn--netzlo-re3c.example',
  },
  {
    typed: 'www.runtrace.net%E3%85%A4zlo.example',
    how: 'the escape of U+3164, with www.',
    opens: 'www.runtrace.netzlo.example',
  },
  {
    typed: 'https://www.runtrace.net%E3%85%A4zlo.example',
    how: 'the escape of U+3164, with https://',
    opens: 'www.runtrace.netzlo.example',
  },
  {
    typed: 'www.runtr%D0%B0ce.net',
    how: 'the escape of a Cyrillic small letter A, with www.',
    opens: 'www.xn--runtrce-6fg.net',
  },
  {
    typed: 'https://www.runtr%D0%B0ce.net',
    how: 'the escape of a Cyrillic small letter A, with https://',
    opens: 'www.xn--runtrce-6fg.net',
  },
  {
    typed: `www.zlo.example${BACKSLASH}@www.runtrace.net`,
    how: 'an @ behind a backslash, which a browser reads as the end of the host, with www.',
    opens: 'www.zlo.example',
  },
  {
    typed: `https://zlo.example${BACKSLASH}@www.runtrace.net`,
    how: 'an @ behind a backslash, with https://',
    opens: 'zlo.example',
  },
]

/** The address a browser is given for what was typed: `www.` gets `https://` in front of it. */
export const hrefOf = (typed: string): string =>
  typed.startsWith('https://') ? typed : `https://${typed}`

/**
 * Addresses that the gate refuses and that `addressesIn` does not.
 *
 * Read by two files, which is the point of keeping them here. `addressesIn.test.ts` holds that each of
 * them is words under the real gate, and `addressesInAlone.test.ts` holds that each of them is a link
 * under a gate that accepts everything. Together the two say that the refusal is the gate's: a case
 * of the first file that the rule of `addressesIn` refused as well would pass whether or not the gate
 * did, which is the shape of fault `addressesInAlone.test.ts` was written about.
 *
 * Nothing in them is outside ASCII, and none has an `@`, a `%` or a backslash in front of its first
 * slash, which are the three things `addressesIn` asks about: an unclosed bracket, a port no machine
 * has, a character a host cannot hold, and the control characters (U+0001 and U+007F are in ASCII
 * and are not blanks, and the gate refuses every control character).
 */
export const ONLY_THE_GATE_REFUSES: readonly string[] = [
  'https://[::1',
  'www.primer.rs:99999/lige',
  'www.primer.rs|lige',
  'www.primer]rs',
  `https://primer.rs${fromPoint(0x01)}/lige`,
  `https://primer${fromPoint(0x7f)}.rs/lige`,
]

export type Stays = {
  typed: string
  /** What it is about the address that a careless rule would take for a reason to refuse it. */
  why: string
}

/**
 * Addresses that stay links, each with the thing about it that a careless rule would refuse.
 *
 * Read by `addressesInAlone.test.ts` (the rule does not refuse it) and by `addressesIn.test.ts` (the
 * gate accepts it, so it is a link end to end). The three at the end are numbers, the boundary that
 * `addressesIn.ts` writes down: a browser reads a number as an address of its own, and the words do
 * not say so.
 */
export const STAYS_A_LINK: readonly Stays[] = [
  { typed: 'www.runtrace.net', why: 'the plain address' },
  {
    typed: `https://sr.wikipedia.org/wiki/Ni${fromPoint(0x161)}`,
    why: 'a letter outside ASCII in the path',
  },
  { typed: `https://example.com?q=Ni${fromPoint(0x161)}`, why: 'a letter outside ASCII in the query' },
  {
    typed: `https://example.com#Ni${fromPoint(0x161)}`,
    why: 'a letter outside ASCII in the fragment',
  },
  {
    typed: `https://www.runtrace.net/a${fromPoint(0x2215)}b`,
    why: 'a character that looks like a slash, in the path, where it changes nothing',
  },
  { typed: 'https://medium.com/@ime/post', why: 'an @ in the path' },
  { typed: 'https://example.com/?email=ime@primer.rs', why: 'an @ in the query' },
  { typed: 'https://example.com#@ime', why: 'an @ in the fragment' },
  { typed: 'https://example.com/a%20b', why: 'a % escape in the path' },
  { typed: 'https://example.com?q=%C5%A1', why: 'a % escape in the query' },
  { typed: `https://example.com/a${BACKSLASH}b`, why: 'a backslash behind the first slash' },
  { typed: 'www.runtrace.net:8080/x', why: 'a port' },
  { typed: 'https://www.runtrace.net:443/x', why: 'the port that a browser leaves out' },
  { typed: 'https://192.168.1.1/admin', why: 'an address of numbers, in its usual form' },
  { typed: 'https://[::1]/x', why: 'an address of numbers and colons in brackets' },
  { typed: 'https://0x7f.1/', why: 'a number a browser reads as 127.0.0.1 (the boundary)' },
  { typed: 'https://127.1/', why: 'a number a browser reads as 127.0.0.1 (the boundary)' },
  { typed: 'https://3232235777/', why: 'a number a browser reads as 192.168.1.1 (the boundary)' },
]

import { vi } from 'vitest'
import { at } from '../../test/at'
import {
  BACKSLASH,
  MISLEADING,
  ONLY_THE_GATE_REFUSES,
  STAYS_A_LINK,
  fromPoint,
  hrefOf,
} from '../../test/misleadingAddresses'
import { SLOW } from '../../test/slow'
import { addressesIn, type Piece } from './addressesIn'

/**
 * What `addressesIn` decides on its own, under a gate that says yes to everything.
 *
 * **Why this is a file of its own.** The gate beneath it (`data/outsideLink.ts`) is a different rule
 * held by a different file, and some of what the owner decided about the two forms of address
 * (03.10.2026, PDL P15) is today also the gate's doing: its pattern is written in lower case, so it
 * refuses `HTTPS://primer.rs` whether or not anything above it does. A rule that is held twice is
 * held by whichever copy is asked first, and a case that runs against the real gate cannot tell
 * which of the two refused. Measured with a mutation on 03.10.2026: `https://` made case-insensitive
 * in `addressesIn` survived all 115 cases of `addressesIn.test.ts`, because the gate refused the
 * upper-case word for it.
 *
 * So the gate is replaced here by one that hands every address back, and what stays words below is
 * the doing of `addressesIn` and of nothing beneath it. The day the gate changes (it is shared with
 * the page of an event, and that page is changed by another job), the two forms stay the two forms.
 */
vi.mock('../../data/outsideLink', () => ({ outsideLink: (said: string): string => said }))

const words = (text: string): Piece => ({ text, href: null })
const link = (text: string, href: string): Piece => ({ text, href })

describe('under a gate that accepts everything', () => {
  it.each(['HTTPS://primer.rs', 'Https://primer.rs', 'hTTps://primer.rs/lige'])(
    'https:// in any case but lower stays words: %s',
    (word) => {
      expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
    },
  )

  it.each(['http://primer.rs', 'http://www.primer.rs', 'ftp://primer.rs', 'javascript:alert(1)'])(
    'what is not one of the two forms stays words: %s',
    (word) => {
      expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
    },
  )

  it.each(['www.', 'www..', 'www.,', 'https://', 'https://.', '(www.)', '„https://“'])(
    'a prefix with nothing behind it stays words: %s',
    (word) => {
      expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
    },
  )

  it.each(['ime@www.primer.rs', 'xwww.primer.rs', 'a(www.primer.rs)', 'ahttps://primer.rs'])(
    'an address that begins in the middle of a word stays words: %s',
    (word) => {
      expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
    },
  )

  it('hands the gate the address and nothing else: no bracket, no quotation mark, no full stop', () => {
    /* The gate here answers with what it was given, so the `href` is exactly what was asked of it. */
    expect(addressesIn('Vidi („www.primer.rs/lige“), pa https://btl.example/nagrade.')).toEqual([
      words('Vidi („'),
      link('www.primer.rs/lige', 'https://www.primer.rs/lige'),
      words('“), pa '),
      link('https://btl.example/nagrade', 'https://btl.example/nagrade'),
      words('.'),
    ])
  })

  it('takes the answer of the gate for the address, and does not judge a browser’s address itself', () => {
    /* `https://[::1` is what a browser refuses and what the real gate refuses. A gate that accepts it
       gets it linked: the judgement of what a browser may be given is the gate's and nothing above it
       repeats it. */
    expect(addressesIn('https://[::1')).toEqual([link('https://[::1', 'https://[::1')])
  })

  it.each(ONLY_THE_GATE_REFUSES)(
    'does not refuse what only the gate refuses, so the refusal in the file with the real gate is the gate’s: %j',
    (typed) => {
      expect(addressesIn(`Vidi ${typed} i dalje.`)).toEqual([
        words('Vidi '),
        link(typed, hrefOf(typed)),
        words(' i dalje.'),
      ])
    },
  )
})

describe('an address whose host, as it was typed, is not the host that opens', () => {
  /**
   * What `addressesIn` decides about the host on its own (PDL P15, 03.10.2026 in the evening, and what
   * is derived from it, said at `addressIn`).
   *
   * **Every address of the table is one that the real gate accepts**, and `addressesIn.test.ts` holds
   * it, so what stays words below is the doing of `addressesIn` and of nothing beneath it. The day the
   * gate learns to refuse one of them (it is shared with the page of an event), the refusal here stays.
   */
  it.each(MISLEADING)('stays words, the whole word of it: $how', ({ typed }) => {
    expect(addressesIn(`Vidi ${typed} i dalje.`)).toEqual([words(`Vidi ${typed} i dalje.`)])
  })

  it.each(MISLEADING)('takes the brackets and the full stop around it with it: $how', ({ typed }) => {
    expect(addressesIn(`(${typed}).`)).toEqual([words(`(${typed}).`)])
  })

  it('is judged on its own: the address beside it is still a link', () => {
    for (const { typed, how } of MISLEADING) {
      expect(addressesIn(`${typed} i www.runtrace.net`), how).toEqual([
        words(`${typed} i `),
        link('www.runtrace.net', 'https://www.runtrace.net'),
      ])
    }
  })

  /**
   * Words although what they say is the host that opens, because the rule reads the typed words and
   * is wider than the trick it was written against, on purpose: a rule that had to know which of
   * these a browser reads as another host would be asking the parser, and what it would be given is
   * ASCII in every case.
   */
  const WIDER: [string, string][] = [
    ['an empty user part', 'https://@zlo.example'],
    ['an empty user part, with www.', 'www.@zlo.example'],
    ['an empty user part and an empty password', 'https://:@zlo.example'],
    ['a user part and a password', 'https://ime:lozinka@zlo.example/p'],
    ['a user part behind a port', 'https://www.runtrace.net:443@zlo.example'],
    ['a % that is no escape', 'https://prim%er.rs/lige'],
    ['a zero width space in the host', `https://primer.rs${fromPoint(0x200b)}/lige`],
    ['a soft hyphen in the host', `https://primer${fromPoint(0xad)}.rs/lige`],
    [
      'a full width full stop, which a browser reads as a dot',
      `https://www${fromPoint(0xff0e)}runtrace${fromPoint(0xff0e)}net`,
    ],
    [
      'a letter of the Serbian Latin alphabet in the host, the boundary said at addressIn',
      `https://www.${fromPoint(0x161)}umadija.rs`,
    ],
    ['a backslash where a slash was meant', `https://example.com${BACKSLASH}lige`],
  ]

  it.each(WIDER)('is words: %s', (_name, typed) => {
    expect(addressesIn(`Vidi ${typed} i dalje.`)).toEqual([words(`Vidi ${typed} i dalje.`)])
  })

  it.each(STAYS_A_LINK)('stays a link: $why', ({ typed }) => {
    expect(addressesIn(`Vidi ${typed} i dalje.`)).toEqual([
      words('Vidi '),
      link(typed, hrefOf(typed)),
      words(' i dalje.'),
    ])
  })
})

describe('the part of an address that is asked about, found by walking and not by listing', () => {
  /** Every character outside ASCII that is one: the surrogates are halves of characters and no text
   *  holds one alone. */
  function* outsideAscii(): Generator<number> {
    for (let point = 0x80; point <= 0x10ffff; point += 1) {
      if (point < 0xd800 || point > 0xdfff) {
        yield point
      }
    }
  }

  it('is words for every character outside ASCII that stands in a host, in both forms', () => {
    const escaped: string[] = []
    let walked = 0

    for (const point of outsideAscii()) {
      /* A blank ends the word, so it never stands in a host: `www.runtrace` and `net` are two words
         and the first of them is an address with no character outside ASCII in it. Nineteen of them
         are outside ASCII, and they are asked of the regular expression that says what a blank is
         and not listed. */
      if (/\s/u.test(fromPoint(point))) {
        continue
      }

      walked += 1

      /* One form for each character, and the other for the next: a character that gets through in one
         form only is a different fault from the one asked about here, and the table above holds both
         forms of every way that was measured, wherever both exist. */
      const typed =
        point % 2 === 0
          ? `www.runtrace${fromPoint(point)}net`
          : `https://www.runtrace${fromPoint(point)}net/lige`

      if (addressesIn(typed).some((piece) => piece.href !== null)) {
        escaped.push(`U+${point.toString(16).toUpperCase()}`)
      }
    }

    /* A floor under the walk: Unicode has 1,111,936 characters outside ASCII that are not halves of
       one, and a walk that stopped early has looked at nothing it did not already know. */
    expect(walked).toBeGreaterThan(1_100_000)
    expect({ count: escaped.length, first: escaped.slice(0, 20) }).toEqual({ count: 0, first: [] })
  }, SLOW)

  it('asks nothing of what stands behind the first slash, question mark or number sign', () => {
    const refused: string[] = []
    const ends = ['/', '?', '#']

    for (let point = 0; point <= 0x10ffff; point += 1) {
      if (point >= 0xd800 && point <= 0xdfff) {
        continue
      }

      const typed = `https://example.com${at(ends, point % 3)}a${fromPoint(point)}b`

      /* The character may be a blank, which ends the word, so what is asked is that the address is
         there and starts where it should: never that all of it is. */
      if (
        !addressesIn(typed).some((piece) => piece.href !== null && piece.text.startsWith('https://example.com'))
      ) {
        refused.push(`U+${point.toString(16).toUpperCase()}`)
      }
    }

    expect({ count: refused.length, first: refused.slice(0, 20) }).toEqual({ count: 0, first: [] })
  }, SLOW)

  it('looks behind every run of slashes and backslashes that a browser skips after https:', () => {
    const runs = ['']

    for (let length = 1; length <= 5; length += 1) {
      for (let bits = 0; bits < 2 ** length; bits += 1) {
        runs.push(
          Array.from({ length }, (_one, place) => (((bits >> place) & 1) === 1 ? BACKSLASH : '/')).join(''),
        )
      }
    }

    /* Every run of up to five, in both of the two characters: 1 + 2 + 4 + 8 + 16 + 32. */
    expect(runs).toHaveLength(63)

    for (const run of runs) {
      const lying = `https://${run}www.runtrace.net@zlo.example`
      const clean = `https://${run}www.runtrace.net/lige`

      expect(addressesIn(lying), JSON.stringify(run)).toEqual([words(lying)])
      expect(addressesIn(clean), JSON.stringify(run)).toEqual([link(clean, clean)])
    }
  })
})

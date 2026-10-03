import { outsideHost, outsideLink } from '../../data/outsideLink'
import { at, must } from '../../test/at'
import {
  MISLEADING,
  ONLY_THE_GATE_REFUSES,
  SHOWN,
  STAYS_A_LINK,
  fromPoint,
  hrefOf,
} from '../../test/misleadingAddresses'
import { SLOW } from '../../test/slow'
import { addressesIn, type Piece } from './addressesIn'

/**
 * Which words of an administrator's text are addresses, and where each of them begins and ends.
 *
 * The owner's sentence (03.10.2026, PDL P15, chosen among the options offered): „Svaka adresa koja
 * počinje sa `www.` ili `https://` otvara se u novom prozoru". Two forms, and the rest of the text
 * is left exactly as it was written.
 *
 * **Every case below is written so that the value it reads has one source.** An address that
 * stands alone in a text is read from the same characters whichever way it is cut, so a case over
 * one address cannot tell a link built from the typed words from one built from a constant, from
 * the first address of the text or from the address before it. The cases that read an `href` or a
 * `text` therefore carry two addresses with different hosts and paths, and the cases about what
 * stands around an address carry words on both sides that differ from each other.
 */
const words = (text: string): Piece => ({ text, href: null })
const link = (text: string, href: string): Piece => ({ text, href })
/** A link written with `www.`, whose `href` is the same address under `https://`. */
const www = (text: string): Piece => link(text, `https://${text}`)
/** A link written with `https://`, whose `href` is the address itself. */
const https = (text: string): Piece => link(text, text)

/** The text the runs make when they are put back together, which is what must never change. */
const putBack = (pieces: Piece[]): string => pieces.map((one) => one.text).join('')

describe('a text with no address in it', () => {
  const TEXTS = [
    'Boduju se svi rezultati sa događaja koji ulaze u ligu.',
    '  two  blanks, and a leading one',
    'a trailing one ',
    'Prvi red\nDrugi red\n\nTreći red posle praznog.',
    'tab\there',
    'blank\u00a0that does not break',
    'line\r\nbreak',
    '   \n ',
  ]

  it.each(TEXTS)('is one run of words, exactly as written: %j', (text) => {
    expect(addressesIn(text)).toEqual([words(text)])
  })

  it('is no run at all when there is no text', () => {
    expect(addressesIn('')).toEqual([])
  })
})

describe('an address that begins with www.', () => {
  it('is a link to the same address under https, drawn as it was typed', () => {
    expect(addressesIn('www.runtrace.net')).toEqual([www('www.runtrace.net')])
  })

  it('keeps the words on both sides of it as they were', () => {
    /* The paragraph the owner is putting into the terms of the RunTrace league, which is the
       sentence this was written for. */
    expect(
      addressesIn('Vreme na svim trkama meri portal www.runtrace.net i na kojima se boduje.'),
    ).toEqual([
      words('Vreme na svim trkama meri portal '),
      www('www.runtrace.net'),
      words(' i na kojima se boduje.'),
    ])
  })

  it('is read from the words that were typed, and from no other address of the text', () => {
    /* Two hosts and two paths, so a link built from a constant, from the first address or from the
       one before gives an `href` that does not belong to its own words. */
    expect(addressesIn('Prvo www.runtrace.net/lige a zatim www.btl.example/nagrade/2027.')).toEqual([
      words('Prvo '),
      www('www.runtrace.net/lige'),
      words(' a zatim '),
      www('www.btl.example/nagrade/2027'),
      words('.'),
    ])
  })

  it('may be the whole of the text, its first words, or its last', () => {
    expect(addressesIn('www.runtrace.net je portal')).toEqual([
      www('www.runtrace.net'),
      words(' je portal'),
    ])
    expect(addressesIn('Portal je www.runtrace.net')).toEqual([
      words('Portal je '),
      www('www.runtrace.net'),
    ])
  })
})

describe('an address that begins with https://', () => {
  it('is a link to itself', () => {
    expect(addressesIn('https://runtrace.net/lige?sezona=2027#kraj')).toEqual([
      https('https://runtrace.net/lige?sezona=2027#kraj'),
    ])
  })

  it('is read from the words that were typed, beside an address with www.', () => {
    expect(addressesIn('Vidi https://btl.example/nagrade i www.runtrace.net/lige')).toEqual([
      words('Vidi '),
      https('https://btl.example/nagrade'),
      words(' i '),
      www('www.runtrace.net/lige'),
    ])
  })
})

describe('what is not an address', () => {
  it.each([
    'http://primer.rs',
    'http://www.primer.rs',
    'ftp://primer.rs',
    'mailto:ime@primer.rs',
    'javascript:alert(1)',
    '//www.primer.rs',
    'runtrace.net',
  ])('is left as words, as one run: %s', (word) => {
    expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
  })

  it('does not take the www. out of an address that begins with http://', () => {
    /* The gate beneath accepts `http://`, so what stops this word is the one asking about the
       beginning of the word. Linking the part after the scheme would put an address in front of a
       reader that is not the one that was written. */
    const pieces = addressesIn('http://www.runtrace.net/lige')

    expect(pieces).toEqual([words('http://www.runtrace.net/lige')])
  })

  it.each([
    'ime@www.runtrace.net',
    'pogledaj:www.runtrace.net',
    'xwww.runtrace.net',
    '-www.runtrace.net',
    '/www.runtrace.net',
    '.www.runtrace.net',
    '*www.runtrace.net*',
    'a(www.runtrace.net)',
    'ahttps://runtrace.net',
  ])('is not one when it begins in the middle of a word: %s', (word) => {
    expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
  })

  it.each([
    '<b>podebljano</b>',
    '[tekst](https://primer.rs)',
    '[https://primer.rs](https://primer.rs)',
    '<https://primer.rs>',
    '<a href="https://primer.rs">primer</a>',
    '**podebljano**',
  ])('is not made out of text that looks like markup, which stays text: %s', (word) => {
    expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
  })

  it('is not a sentence that merely says www., which is what a bare prefix looks like', () => {
    expect(addressesIn('adresa počinje sa www. a završava se tačkom')).toEqual([
      words('adresa počinje sa www. a završava se tačkom'),
    ])
  })

  it.each(['www.', 'www..', 'www.,', 'www.)', '(www.)', 'https://', 'https://.', '„https://“'])(
    'is not a prefix with nothing behind it, which the gate beneath would accept: %s',
    (word) => {
      expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
    },
  )

  it('is not a word made of nothing but brackets and quotation marks', () => {
    expect(addressesIn('(((')).toEqual([words('(((')])
    expect(addressesIn('„“')).toEqual([words('„“')])
    expect(addressesIn('"')).toEqual([words('"')])
  })
})

describe('the case of the prefix', () => {
  it('does not matter for www., and the text is drawn as it was typed', () => {
    /* The `href` carries the same letters as the text, and the host is lowered by the browser. */
    expect(addressesIn('WWW.RUNTRACE.NET')).toEqual([www('WWW.RUNTRACE.NET')])
    expect(addressesIn('Www.runtrace.net')).toEqual([www('Www.runtrace.net')])
    expect(addressesIn('wWw.runtrace.net')).toEqual([www('wWw.runtrace.net')])
  })

  it('matters for https://, which is a prefix only in lower case', () => {
    expect(addressesIn('HTTPS://primer.rs')).toEqual([words('HTTPS://primer.rs')])
    expect(addressesIn('Https://primer.rs')).toEqual([words('Https://primer.rs')])
  })
})

describe('the punctuation that stands behind an address', () => {
  it.each(['.', ',', ';', ':', '!', '?', '…', ')', ']', '}', '"', "'", '”', '“', '’', '»'])(
    'is not part of it: %s',
    (tail) => {
      expect(addressesIn(`Vidi www.runtrace.net${tail} i dalje.`)).toEqual([
        words('Vidi '),
        www('www.runtrace.net'),
        words(`${tail} i dalje.`),
      ])
      expect(addressesIn(`Vidi https://runtrace.net/lige${tail}`)).toEqual([
        words('Vidi '),
        https('https://runtrace.net/lige'),
        words(tail),
      ])
    },
  )

  it.each([').', '.)', '?!', '...', '),', '".', '.”'])('is not part of it, however many: %s', (tail) => {
    expect(addressesIn(`www.runtrace.net${tail}`)).toEqual([
      www('www.runtrace.net'),
      words(tail),
    ])
  })

  it('is only what closes a sentence or a bracket, and never a character an address ends in', () => {
    for (const ending of ['/', '%20', '&b=2', '#kraj', '-', '_', '~', '=', '1', 'a', '+', '*']) {
      const address = `https://runtrace.net/lige${ending}`

      expect(addressesIn(`Vidi ${address} i dalje.`), ending).toEqual([
        words('Vidi '),
        https(address),
        words(' i dalje.'),
      ])
    }
  })

  it('leaves in the address the punctuation that is inside it', () => {
    expect(addressesIn('Vidi www.runtrace.net/lige.2027,a;b:c!d?e (f) ok.')).toEqual([
      words('Vidi '),
      www('www.runtrace.net/lige.2027,a;b:c!d?e'),
      words(' (f) ok.'),
    ])
  })

  it('does not count brackets: one that closes the address is taken off with the sentence', () => {
    /* The rule that was chosen on 03.10.2026: a closing bracket at the end stays out of the link,
       also where the address has an opening one of its own. The address is shortened by one
       character and the reader is taken to the page before it. */
    expect(addressesIn('https://sr.wikipedia.org/wiki/Trka_(sport)')).toEqual([
      https('https://sr.wikipedia.org/wiki/Trka_(sport'),
      words(')'),
    ])
  })
})

describe('what stands in front of an address', () => {
  it.each([
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
    ['„', '“'],
    ['"', '"'],
    ["'", "'"],
    ['«', '»'],
    ['“', '”'],
    ['((', '))'],
    ['("', '")'],
    ['„(', ')“'],
  ])('is not part of it: %s … %s', (open, close) => {
    expect(addressesIn(`Vidi ${open}www.runtrace.net${close} i dalje.`)).toEqual([
      words(`Vidi ${open}`),
      www('www.runtrace.net'),
      words(`${close} i dalje.`),
    ])
    expect(addressesIn(`${open}https://runtrace.net/lige${close}`)).toEqual([
      words(open),
      https('https://runtrace.net/lige'),
      words(close),
    ])
  })

  it('is read in front of the first of them only when it stands in front of the word', () => {
    expect(addressesIn('(www.runtrace.net, https://btl.example/nagrade)')).toEqual([
      words('('),
      www('www.runtrace.net'),
      words(', '),
      https('https://btl.example/nagrade'),
      words(')'),
    ])
  })
})

describe('an address that the gate beneath refuses', () => {
  /**
   * **Every one of these is an address that `addressesIn` itself lets through** (`addressesInAlone.test.ts`
   * holds it, under a gate that accepts everything), so what makes it words here is the gate and
   * nothing above it. Three that stood here until 03.10.2026 (evening) are gone from this list for
   * that reason: a zero width space, a soft hyphen and a `%` in a host are refused by `addressesIn`
   * as well since then, and a case about them proves nothing about the gate. They are held in the
   * file with the permissive gate, where the refusal can only be the function's.
   */
  it.each(ONLY_THE_GATE_REFUSES)('stays words, the whole word of it: %j', (word) => {
    expect(addressesIn(`Vidi ${word} i dalje.`)).toEqual([words(`Vidi ${word} i dalje.`)])
  })

  it('takes the brackets around it with it, so what is shown is what was written', () => {
    const control = `www.primer.rs${fromPoint(1)}`

    expect(addressesIn('Vidi (https://[::1) i dalje.')).toEqual([words('Vidi (https://[::1) i dalje.')])
    expect(addressesIn(`Vidi „${control}“ i dalje.`)).toEqual([words(`Vidi „${control}“ i dalje.`)])
  })

  it('is judged on its own: the address beside it is still a link', () => {
    expect(addressesIn('https://[::1 i www.runtrace.net')).toEqual([
      words('https://[::1 i '),
      www('www.runtrace.net'),
    ])
  })

  it('is why the gate itself is not enough: it accepts what this has to refuse', () => {
    /* Measured on 03.10.2026 and held here, so that the sentences in `addressesIn.ts` that say what
       the gate does and does not do are the gate's own behaviour and not a memory of it. */
    expect(outsideLink('http://primer.rs')).toBe('http://primer.rs')
    expect(outsideLink('https://www.')).toBe('https://www.')
    expect(outsideLink('https://.')).toBe('https://.')
    expect(outsideLink('https://www.runtrace.net)')).toBe('https://www.runtrace.net)')
    expect(outsideLink('HTTPS://primer.rs')).toBeUndefined()
  })
})

describe('an address that the gate accepts and whose host a browser reads as another', () => {
  /**
   * Measured on 03.10.2026 by the review of the change that made these words links (and completed
   * the same day with the ways to the same hosts that the review did not try), and held here so that
   * the sentences of `addressesIn.ts` about what the gate lets through are the gate's own behaviour
   * and not a memory of it. The host of each row is the one `outsideHost` answers, which is the one a
   * browser opens: read by the parser of this test environment (jsdom's) and by Node's, which agree
   * on every row.
   *
   * `addressesInAlone.test.ts` holds that the refusal is `addressesIn`'s own, under a gate that
   * accepts everything; what is held here is that the gate does accept them, and that the function
   * refuses them end to end all the same.
   */
  it.each(MISLEADING)(
    'is accepted by the gate, and a browser opens $opens for it: $how',
    ({ typed, opens }) => {
      const href = hrefOf(typed)

      expect(outsideLink(href)).toBe(href)
      expect(outsideHost(href)).toBe(opens)
      expect(outsideHost(href)).not.toBe(SHOWN)
    },
  )

  it.each(MISLEADING)('is words all the same, the whole word of it: $how', ({ typed }) => {
    expect(addressesIn(`Vidi ${typed} i dalje.`)).toEqual([words(`Vidi ${typed} i dalje.`)])
  })

  it.each(STAYS_A_LINK)('stays a link, end to end: $why', ({ typed }) => {
    const href = hrefOf(typed)

    expect(outsideLink(href)).toBe(href)
    expect(addressesIn(`Vidi ${typed} i dalje.`)).toEqual([
      words('Vidi '),
      link(typed, href),
      words(' i dalje.'),
    ])
  })

  it('opens another address than the one a number is written as, which is the boundary written down at addressIn', () => {
    /* Held, so that the sentence in `addressesIn.ts` that says what these numbers open is the
       parser's own answer. Nothing here is a reason to refuse them: what stands in the words is
       digits, and nobody reads digits as the name of a site. */
    expect(outsideHost('https://0x7f.1/')).toBe('127.0.0.1')
    expect(outsideHost('https://127.1/')).toBe('127.0.0.1')
    expect(outsideHost('https://3232235777/')).toBe('192.168.1.1')
  })
})

describe('the host that opens, asked of the parser for every address that becomes a link', () => {
  /**
   * THE FLOOR UNDER THE RULE OF `addressIn`, and not a second copy of it.
   *
   * The rule is a short class (`@`, `%`, a backslash, anything outside ASCII), and every member of
   * it was found by measurement. A class that is found by measuring is a class that can be short by
   * one, so this asks the parser, which is the source of truth, a question that does not name any
   * member: **for every address the function turns into a link, is the host that opens the host that
   * was typed?** A sweep of three million typed hosts per form, run on 03.10.2026 outside the
   * repository, found exactly three kinds of answer „no" (a user part, a percent escape, a number) and
   * no fourth. The same question is asked here of thirty thousand each time the suite runs, so the
   * fourth kind, the day a parser or a browser reads something else in a new way, fails here and
   * asks for a decision, and does not wait for a review to find it.
   *
   * **The number is the one answer that is allowed, and it is written down as such**: `addressIn`
   * says why, and the case before this one holds what a number opens.
   *
   * Everything is ASCII on purpose: what is outside ASCII is asked of every character Unicode has
   * in `addressesInAlone.test.ts`, where no gate can be the reason for a refusal.
   */
  const FRONTS = ['www.', 'https://', 'https:///']

  /** What stands behind the host: nothing, and each of the three that end it. The first is only
   *  used when the host ends in a letter or a digit, since a full stop at the very end of an
   *  address is taken off as the full stop of a sentence and then is not part of it. */
  const BACKS = ['', '/p', '?q', '#f', `/Ni${fromPoint(0x161)}`, '/@x%']

  /** Printable ASCII, minus the three characters that end a host: every character that a keyboard
   *  types without a modifier of its own. */
  const PRINTABLE = Array.from({ length: 94 }, (_one, place) => String.fromCharCode(33 + place)).filter(
    (one) => !'/?#'.includes(one),
  )

  /** What a host is built from. The escapes and the user part are written whole, since a `%` that
   *  does not stand in front of two hexadecimal digits is refused by the gate before anything else
   *  is asked, and the sweep would reach the escapes one time in a thousand. */
  const PIECES = [
    ...'abcxz017f..--_'.split(''),
    ':',
    ':80',
    ':443',
    '@',
    '%41',
    '%2e',
    '%E2%88%95',
    '%E3%85%A4',
    '%D0%B0',
    'xn--',
    '0x7f',
    '127',
    '[::1]',
    ...PRINTABLE,
  ]

  /** A seeded generator, so a failing address is the same address on every run and every machine. */
  function samples(count: number): { front: string; region: string; back: string }[] {
    let seed = 20261003

    const next = (below: number): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff

      return seed % below
    }

    const pick = (list: readonly string[]): string => at(list, next(list.length))

    return Array.from({ length: count }, () => {
      const region = Array.from({ length: 1 + next(5) }, () => pick(PIECES)).join('')

      return {
        front: pick(FRONTS),
        region,
        back: pick(/[0-9a-z]$/i.test(region) ? BACKS : BACKS.slice(1)),
      }
    })
  }

  /** The host with its port taken off, which is what a reader reads as the host. */
  const withoutPort = (host: string): string => host.replace(/:\d*$/, '')

  /** A host that a browser reads as a number: the last of its labels is one. */
  const NUMBER = /(^|\.)(\d+|0x[0-9a-f]*)\.?$/i

  it('is the host that was typed, in every address that becomes a link, but for a number', () => {
    const differ: string[] = []
    let links = 0
    let numbers = 0
    let refused = 0

    for (const { front, region, back } of samples(30_000)) {
      const typed = `${front}${region}${back}`
      const link = addressesIn(typed).find((piece) => piece.href !== null)

      if (link === undefined) {
        /* An address that the gate accepts and the function does not make a link of: what stands in
           front of it is the function, and nothing else. */
        if (outsideLink(hrefOf(typed)) !== undefined) {
          refused += 1
        }

        continue
      }

      links += 1

      /* The host as it was typed, the way a reader finds it: behind `https:` and every slash and
         backslash that a browser skips after it (in front of `www.` it skips nothing), up to the
         first `/`, `?` or `#`. A reader does not end it at a backslash, and a browser does. */
      const written = withoutPort(
        typed.replace(/^https:[/\\]*/, '').replace(/[/?#].*/su, ''),
      ).toLowerCase()
      const opened = withoutPort(
        must(outsideHost(must(link.href, 'the address of a link')), `the host of ${typed}`),
      )

      if (written === opened) {
        continue
      }

      if (NUMBER.test(written)) {
        numbers += 1
      } else {
        differ.push(`${typed} opens ${opened}`)
      }
    }

    /* Floors under the sweep, so that an answer of „nothing found" is not the answer of a sweep that
       reached nothing: addresses that became links, numbers that were let through on purpose, and
       addresses that the gate accepts and only the function stood in front of. */
    expect(links).toBeGreaterThan(9_000)
    expect(numbers).toBeGreaterThan(300)
    expect(refused).toBeGreaterThan(3_000)

    expect(differ.slice(0, 10)).toEqual([])
  }, SLOW)
})

describe('more than one address', () => {
  it('draws each of them, in the order they were written', () => {
    expect(
      addressesIn('www.runtrace.net, https://btl.example/nagrade i www.primer.rs/trke.'),
    ).toEqual([
      www('www.runtrace.net'),
      words(', '),
      https('https://btl.example/nagrade'),
      words(' i '),
      www('www.primer.rs/trke'),
      words('.'),
    ])
  })

  it('draws the same address twice as two links', () => {
    expect(addressesIn('www.runtrace.net pa opet www.runtrace.net')).toEqual([
      www('www.runtrace.net'),
      words(' pa opet '),
      www('www.runtrace.net'),
    ])
  })

  it('reads two addresses with no blank between them as the one word they are', () => {
    expect(addressesIn('www.runtrace.net,www.btl.example')).toEqual([
      www('www.runtrace.net,www.btl.example'),
    ])
  })
})

describe('the blanks around an address', () => {
  const CASES: [string, string, Piece[]][] = [
    [
      'a line break behind it',
      'www.runtrace.net\nDrugi red',
      [www('www.runtrace.net'), words('\nDrugi red')],
    ],
    [
      'a line break in front of it',
      'Prvi red\nwww.runtrace.net',
      [words('Prvi red\n'), www('www.runtrace.net')],
    ],
    [
      'a carriage return and a line break',
      'Prvi red\r\nwww.runtrace.net\r\ndrugi',
      [words('Prvi red\r\n'), www('www.runtrace.net'), words('\r\ndrugi')],
    ],
    [
      'a tab',
      'Vidi\twww.runtrace.net\ti dalje',
      [words('Vidi\t'), www('www.runtrace.net'), words('\ti dalje')],
    ],
    [
      'a blank that does not break',
      'Vidi\u00a0www.runtrace.net\u00a0i dalje',
      [words('Vidi\u00a0'), www('www.runtrace.net'), words('\u00a0i dalje')],
    ],
    [
      'two blanks',
      'Vidi  www.runtrace.net  i dalje',
      [words('Vidi  '), www('www.runtrace.net'), words('  i dalje')],
    ],
    [
      'blanks at both ends of the text',
      '  www.runtrace.net  ',
      [words('  '), www('www.runtrace.net'), words('  ')],
    ],
  ]

  it.each(CASES)('is kept exactly, with %s', (_name, text, expected) => {
    expect(addressesIn(text)).toEqual(expected)
  })
})

describe('the runs of any text', () => {
  const PARTS = [
    'www.',
    'WWW.',
    'https://',
    'http://',
    /* Whole addresses as well as the pieces of one, so that most of the texts hold something to cut
       and the rest hold something close to it. */
    'www.primer.rs',
    'Www.primer.rs/lige',
    'https://primer.rs/lige',
    'http://primer.rs',
    'runtrace.net',
    'a',
    'b.',
    '/lige',
    ' ',
    '  ',
    '\n',
    '\r\n',
    '\t',
    '(',
    ')',
    '„',
    '“',
    '"',
    "'",
    '.',
    ',',
    '!',
    '?',
    '…',
    '%',
    '[',
    ']',
    '<',
    '>',
    '|',
    '@',
    '\u200b',
    '\u00ad',
    'č',
    'ž',
    '😀',
  ]

  /** A seeded generator, so a failing text is the same text on every run and every machine. */
  function texts(count: number): string[] {
    let seed = 20261003

    const next = (below: number): number => {
      seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff

      return seed % below
    }

    return Array.from({ length: count }, () =>
      Array.from({ length: 1 + next(14) }, () => PARTS[next(PARTS.length)]).join(''),
    )
  }

  it('put back together are the text, in no run empty and in no two runs of words in a row', () => {
    const generated = texts(4000)

    for (const text of generated) {
      const pieces = addressesIn(text)

      expect(putBack(pieces), JSON.stringify(text)).toBe(text)

      pieces.forEach((one, at) => {
        expect(one.text, JSON.stringify(text)).not.toBe('')

        if (one.href === null) {
          expect(pieces[at + 1]?.href, `${JSON.stringify(text)}: two runs of words in a row`).not.toBeNull()
        }
      })
    }

    /* The generator has to reach what it is for: addresses, refusals and plain text alike. */
    const links = generated.flatMap(addressesIn).filter((one) => one.href !== null)

    expect(links.length).toBeGreaterThan(500)
    expect(generated.map(addressesIn).filter((one) => one.length === 1 && one[0]?.href === null).length).toBeGreaterThan(500)
  })

  it('make a link of a whole word that begins with a prefix, and of nothing else', () => {
    for (const text of texts(4000)) {
      for (const one of addressesIn(text)) {
        if (one.href === null) {
          continue
        }

        expect(one.text, JSON.stringify(text)).not.toMatch(/\s/u)
        expect(
          one.href,
          JSON.stringify(text),
        ).toBe(one.text.startsWith('https://') ? one.text : `https://${one.text}`)
        expect(one.text.toLowerCase().startsWith('www.') || one.text.startsWith('https://')).toBe(true)
        expect(one.text.length, JSON.stringify(text)).toBeGreaterThan(one.text.startsWith('https://') ? 8 : 4)
      }
    }
  })
})

describe('a long text', () => {
  it('is cut in one pass, however it is made', () => {
    /* The field takes 4000 characters (`admin-liga.form.json`) and refuses nothing else, so every
       shape of 4000 is a text this has to read. */
    const address = `www.primer.rs/${'a'.repeat(3986)}`

    expect(address).toHaveLength(4000)
    expect(addressesIn(address)).toEqual([www(address)])
    expect(addressesIn('.'.repeat(4000))).toEqual([words('.'.repeat(4000))])
    expect(addressesIn(`${'('.repeat(2000)}www.primer.rs${')'.repeat(1987)}`)).toEqual([
      words('('.repeat(2000)),
      www('www.primer.rs'),
      words(')'.repeat(1987)),
    ])
    expect(addressesIn(`www.primer.rs${'.'.repeat(3987)}`)).toEqual([
      www('www.primer.rs'),
      words('.'.repeat(3987)),
    ])

    const many = 'www.primer.rs '.repeat(250)
    const found = addressesIn(many)

    expect(found.filter((one) => one.href !== null)).toHaveLength(250)
    expect(putBack(found)).toBe(many)
  })
})

describe('what stands in front of and behind an address, asked of every character', () => {
  /** Every printable character of ASCII, which is every character a keyboard types without a
   *  modifier of its own and the whole of what an address is made of. */
  const ASCII = Array.from({ length: 94 }, (_one, at) => String.fromCharCode(33 + at))

  it('closes exactly the marks of a sentence, the closing brackets and the quotation marks, in ASCII', () => {
    /* One run when the character stays in the address, or when the address is refused, and two when
       it is taken off behind it. A character taken off that should have stayed splits `https://x/…`
       in two; a closing mark that stayed is a link that ends in a full stop. */
    const taken = ASCII.filter((one) => addressesIn(`www.primer.rs${one}`).length === 2)

    expect(taken.join(' ')).toBe('! " \' ) , . : ; ? ] }')
  })

  it('opens exactly the opening brackets and the quotation marks, in ASCII', () => {
    const taken = ASCII.filter((one) => addressesIn(`${one}www.primer.rs`).length === 2)

    expect(taken.join(' ')).toBe('" \' ( [ {')
  })

  /** Every character Unicode files as punctuation, found by asking Unicode and walked once. */
  const PUNCTUATION: string[] = []

  for (let point = 0; point <= 0x10ffff; point += 1) {
    /* A lone surrogate is a character no text holds, and the regular expression has no category
       for half of one. */
    if (point >= 0xd800 && point <= 0xdfff) {
      continue
    }

    const one = String.fromCodePoint(point)

    if (/^\p{P}$/u.test(one)) {
      PUNCTUATION.push(one)
    }
  }

  /** The characters of that walk that Unicode files under one of these categories. */
  function of(...categories: string[]): string[] {
    const wanted = new RegExp(`^[${categories.map((one) => `\\p{${one}}`).join('')}]$`, 'u')

    return PUNCTUATION.filter((one) => wanted.test(one))
  }

  it('closes every closing bracket and every quotation mark that Unicode knows', () => {
    const closing = of('Pe', 'Pi', 'Pf')

    /* A floor under the sweep: an empty answer would pass every line below it. */
    expect(closing.length).toBeGreaterThan(80)

    for (const one of closing) {
      expect(addressesIn(`www.primer.rs${one}`), `U+${one.codePointAt(0)?.toString(16)}`).toEqual([
        www('www.primer.rs'),
        words(one),
      ])
    }
  })

  it('opens at every opening bracket and every quotation mark that Unicode knows', () => {
    const opening = of('Ps', 'Pi', 'Pf')

    expect(opening.length).toBeGreaterThan(80)

    for (const one of opening) {
      expect(addressesIn(`${one}www.primer.rs`), `U+${one.codePointAt(0)?.toString(16)}`).toEqual([
        words(one),
        www('www.primer.rs'),
      ])
    }
  })
})

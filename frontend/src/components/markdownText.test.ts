import { describe, expect, it } from 'vitest'
import { BACKSLASH, MISLEADING, STAYS_A_LINK } from '../test/misleadingAddresses'
import {
  addressOf,
  blocksOf,
  breakOf,
  escapeLineStart,
  escapeWords,
  inlineOf,
  MARKER,
  startOf,
  type Inline,
} from './markdownText'

/* What a written text says, asked of the reading itself and not of a screen: the screen
   (`Markdown.test.tsx`) and the editor (`markdownEditor/convert.test.ts`) each hold that they draw
   what this answers. */

/** A piece as plain data, so a whole line can be compared at once. */
const text = (words: string): Inline => ({ kind: 'text', text: words })

describe('the blocks of a written text', () => {
  it('keeps the lines of a table and of a rule as they were written', () => {
    expect(blocksOf('| a | b |\n|---|---|\n| 1 | 2 |\n\n-----')).toEqual([
      {
        kind: 'table',
        rows: [
          ['a', 'b'],
          ['1', '2'],
        ],
        source: ['| a | b |', '|---|---|', '| 1 | 2 |'],
      },
      { kind: 'rule', source: '-----' },
    ])
  })

  it('reads the place of a drawing as a block of its own, even between two lines of words', () => {
    expect(blocksOf(`Prvo\n  ${MARKER}  \nDrugo`)).toEqual([
      { kind: 'paragraph', lines: ['Prvo'] },
      { kind: 'marker', source: MARKER },
      { kind: 'paragraph', lines: ['Drugo'] },
    ])
  })

  it('says how many hashes a heading was written with', () => {
    expect(blocksOf('## Dva\n#### Četiri')).toEqual([
      { kind: 'heading', hashes: 2, text: 'Dva' },
      { kind: 'heading', hashes: 4, text: 'Četiri' },
    ])
  })
})

describe('the pieces of a line', () => {
  it('reads bold as two stars and italic as an underscore, each able to hold the other', () => {
    expect(inlineOf('**jako _i koso_** pa _koso **i jako**_', false)).toEqual([
      { kind: 'strong', children: [text('jako '), { kind: 'em', children: [text('i koso')] }] },
      text(' pa '),
      { kind: 'em', children: [text('koso '), { kind: 'strong', children: [text('i jako')] }] },
    ])
  })

  it('reads italic inside a word, which is what the editor writes for it', () => {
    expect(inlineOf('Beo_grad_ski', false)).toEqual([
      text('Beo'),
      { kind: 'em', children: [text('grad')] },
      text('ski'),
    ])
  })

  it('leaves an underscore that opens or closes on a blank as the words they are', () => {
    expect(inlineOf('a _ b _ c', false)).toEqual([text('a _ b _ c')])
    expect(inlineOf('a _b _ c', false)).toEqual([text('a _b _ c')])
    expect(inlineOf('kraj_', false)).toEqual([text('kraj_')])
  })

  it('leaves a single star, an unclosed pair and an empty pair as the words they are', () => {
    expect(inlineOf('5 * 3 = 15', false)).toEqual([text('5 * 3 = 15')])
    expect(inlineOf('**Važno', false)).toEqual([text('**Važno')])
    expect(inlineOf('****', false)).toEqual([text('****')])
    expect(inlineOf('``', false)).toEqual([text('``')])
    expect(inlineOf('`otvoreno', false)).toEqual([text('`otvoreno')])
  })

  it('makes a character literal behind a backslash, and only the characters that mark something', () => {
    expect(inlineOf('\\*\\*nije\\*\\* \\_ni ovo\\_ \\[x\\](y) \\# \\- 1\\. \\|', false)).toEqual([
      text('**nije** _ni ovo_ [x](y) # - 1. |'),
    ])
    /* A backslash in front of anything else is a backslash, so a path and an address keep theirs. */
    expect(inlineOf('C:\\Users\\nmini i https://\\\\a.example', false)).toEqual([
      text('C:\\Users\\nmini i https://\\\\a.example'),
    ])
  })

  it('reads a value between backticks whole, with nothing inside it read', () => {
    expect(inlineOf('Broj `**42**` ovde', false)).toEqual([
      text('Broj '),
      { kind: 'code', text: '**42**' },
      text(' ovde'),
    ])
  })

  it('reads a link with its words, which may be bold and may hold an escaped bracket', () => {
    expect(inlineOf('Vidi [**sajt** \\] lige](https://primer.rs/a_b) ovde', false)).toEqual([
      text('Vidi '),
      {
        kind: 'link',
        url: 'https://primer.rs/a_b',
        inside: false,
        children: [{ kind: 'strong', children: [text('sajt')] }, text(' ] lige')],
      },
      text(' ovde'),
    ])
  })

  it('leaves a link to an address it does not allow as every character of the words', () => {
    expect(inlineOf('[klik](javascript:alert(1))', false)).toEqual([text('[klik](javascript:alert(1))')])
    expect(inlineOf('[klik](//zlo.example)', false)).toEqual([text('[klik](//zlo.example)')])
    expect(inlineOf('[nedovršeno](https://primer.rs', false)).toEqual([text('[nedovršeno](https://primer.rs')])
  })

  it('reads raw HTML as the words it is', () => {
    expect(inlineOf('<script>alert(1)</script> <b>x</b>', false)).toEqual([
      text('<script>alert(1)</script> <b>x</b>'),
    ])
  })
})

describe('the bare addresses of a line, for the terms and the prizes of a competition', () => {
  it('are links only where they are asked for', () => {
    expect(inlineOf('Vidi www.runtrace.net.', false)).toEqual([text('Vidi www.runtrace.net.')])
    expect(inlineOf('Vidi www.runtrace.net.', true)).toEqual([
      text('Vidi '),
      { kind: 'address', text: 'www.runtrace.net', href: 'https://www.runtrace.net' },
      text('.'),
    ])
  })

  it('keep the underscores of their path, which are not italic', () => {
    expect(inlineOf('Vidi https://sr.wikipedia.org/wiki/Trka_na_100m i to', true)).toEqual([
      text('Vidi '),
      {
        kind: 'address',
        text: 'https://sr.wikipedia.org/wiki/Trka_na_100m',
        href: 'https://sr.wikipedia.org/wiki/Trka_na_100m',
      },
      text(' i to'),
    ])
  })

  it('read an escaped underscore of their path as the underscore it is', () => {
    expect(inlineOf('www.primer.rs/a\\_b', true)).toEqual([
      { kind: 'address', text: 'www.primer.rs/a_b', href: 'https://www.primer.rs/a_b' },
    ])
  })

  it('stay addresses inside bold and italic', () => {
    expect(inlineOf('**www.runtrace.net** i _(www.primer.rs)_', true)).toEqual([
      {
        kind: 'strong',
        children: [{ kind: 'address', text: 'www.runtrace.net', href: 'https://www.runtrace.net' }],
      },
      text(' i '),
      {
        kind: 'em',
        children: [
          text('('),
          { kind: 'address', text: 'www.primer.rs', href: 'https://www.primer.rs' },
          text(')'),
        ],
      },
    ])
  })

  it('are never read inside the words of a link, which is a link already', () => {
    expect(inlineOf('[www.runtrace.net](https://www.runtrace.net)', true)).toEqual([
      {
        kind: 'link',
        url: 'https://www.runtrace.net',
        inside: false,
        children: [text('www.runtrace.net')],
      },
    ])
  })
})

describe('the addresses a link may lead to', () => {
  it('are this portal, a file of it, and another site written in one of three ways', () => {
    for (const hostChecked of [false, true]) {
      expect(addressOf('/pravilnik', hostChecked)).toEqual({ inside: true, href: '/pravilnik' })
      expect(addressOf('/BTL%20Statut.pdf', hostChecked)).toEqual({ inside: false, href: '/BTL%20Statut.pdf' })
      expect(addressOf('https://primer.rs', hostChecked)).toEqual({ inside: false, href: 'https://primer.rs' })
      expect(addressOf('http://primer.rs', hostChecked)).toEqual({ inside: false, href: 'http://primer.rs' })
      expect(addressOf('mailto:liga@primer.rs', hostChecked)).toEqual({
        inside: false,
        href: 'mailto:liga@primer.rs',
      })
    }
  })

  it('are nothing else', () => {
    for (const refused of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//zlo.example', '/\\zlo.example', 'ftp://primer.rs', 'primer.rs']) {
      for (const hostChecked of [false, true]) {
        expect(addressOf(refused, hostChecked), refused).toBeUndefined()
      }
    }
  })
})

/* PDL P15, 03.10.2026: „Adresa sa „@" ili sa slovima van latinice u hostu ne postaje veza nego
   ostaje običan tekst." Said of the address under the words of a link as it is of a bare address,
   by the same question (`opensAsTyped`), asked where the text asks for it (`hostChecked`). */
describe('the host of the address under the words of a link', () => {
  const typedAsLinks = MISLEADING.map((one) => (one.typed.startsWith('www.') ? `https://${one.typed}` : one.typed))

  it('is not the host of another site when it is asked, for every address that reads as one host and opens another', () => {
    /* A floor under the table, since a table that lost its rows would pass every line below it. */
    expect(typedAsLinks.length).toBeGreaterThan(20)

    for (const typed of typedAsLinks) {
      expect(addressOf(typed, true), typed).toBeUndefined()
    }
  })

  it('is left as it was written where nothing asks, because a written page has always carried such a link', () => {
    for (const typed of typedAsLinks) {
      expect(addressOf(typed, false), typed).toEqual({ inside: false, href: typed })
    }
  })

  it('is asked for http:// as it is for https://, since a user part hides a host behind either', () => {
    expect(addressOf('http://www.runtrace.net@zlo.example', true)).toBeUndefined()
    expect(addressOf('http:///www.runtrace.net@zlo.example', true)).toBeUndefined()
    expect(addressOf(`http://${BACKSLASH}${BACKSLASH}www.runtrace.net@zlo.example`, true)).toBeUndefined()
    expect(addressOf('http://primer.rs/a@b', true)).toEqual({ inside: false, href: 'http://primer.rs/a@b' })
  })

  it('is still the host of another site when nothing is wrong with it, wherever the oddity is only in the path', () => {
    for (const one of STAYS_A_LINK) {
      const typed = one.typed.startsWith('www.') ? `https://${one.typed}` : one.typed

      expect(addressOf(typed, true), `${typed} (${one.why})`).toEqual({ inside: false, href: typed })
    }
  })

  it('is not asked of an address of this portal or of a mailbox, which have no host to mistake', () => {
    expect(addressOf('/pravilnik#ime@kraj', true)).toEqual({ inside: true, href: '/pravilnik#ime@kraj' })
    expect(addressOf('mailto:ime@primer.rs', true)).toEqual({ inside: false, href: 'mailto:ime@primer.rs' })
  })

  it('is refused by the gate as well as by the typed part, so an address with nothing in it is text', () => {
    expect(addressOf('https://', false)).toEqual({ inside: false, href: 'https://' })
    expect(addressOf('https://', true)).toBeUndefined()
  })

  it('makes a link of the words only where the address passes, and leaves every character of the rest as typed', () => {
    const typed = 'https://www.runtrace.net@zlo.example'
    const link = `[www.runtrace.net](${typed})`

    expect(inlineOf(link, true)).toEqual([text(link)])
    /* The cells of a table ask the links alone, and draw no bare address. */
    expect(inlineOf(link, false, true)).toEqual([text(link)])
    /* And where nothing asks, it is the link it always was. */
    expect(inlineOf(link, false)).toEqual([
      { kind: 'link', url: typed, inside: false, children: [text('www.runtrace.net')] },
    ])
    expect(inlineOf('[ime](https://primer.rs/a@b)', true)).toEqual([
      { kind: 'link', url: 'https://primer.rs/a@b', inside: false, children: [text('ime')] },
    ])
  })
})

/* A number somebody typed is the number the page draws and the editor writes back. */
describe('the numbers a numbered list was written with', () => {
  const list = (numbers: number[], items: string[]) => ({ kind: 'list', ordered: true, items, numbers })

  it('are kept for every item, whatever their order', () => {
    expect(blocksOf('1. a\n2. b\n3. c')).toEqual([list([1, 2, 3], ['a', 'b', 'c'])])
    expect(blocksOf('3. a\n4. b')).toEqual([list([3, 4], ['a', 'b'])])
    expect(blocksOf('1. mesto\n2. mesto\n4. do 10. mesto')).toEqual([
      list([1, 2, 4], ['mesto', 'mesto', 'do 10. mesto']),
    ])
    expect(blocksOf('- a\n- b')).toEqual([{ kind: 'list', ordered: false, items: ['a', 'b'], numbers: [] }])
  })

  it('say where a list starts, and where it jumps, and nothing where it counts from one in order', () => {
    expect(startOf([1, 2, 3])).toBeUndefined()
    expect(startOf([3, 4])).toBe(3)
    expect(startOf([0, 1])).toBe(0)
    expect([1, 2, 4, 5, 3].map((_, index) => breakOf([1, 2, 4, 5, 3], index))).toEqual([
      undefined,
      undefined,
      4,
      undefined,
      3,
    ])
    expect(breakOf([], 0)).toBeUndefined()
  })

  it('are read from a line that is a number, a full stop and a word, and from nothing else', () => {
    expect(blocksOf('15. oktobra se trči trka.')).toEqual([list([15], ['oktobra se trči trka.'])])
    expect(blocksOf('0. nulti')).toEqual([list([0], ['nulti'])])
    /* The number is read as written, so a number that could not be written back as it is stays words. */
    for (const words of ['007. prvi', '1234567890. predug', '15.oktobra', '15 . oktobra', '-3. minus']) {
      expect(blocksOf(words), words).toEqual([{ kind: 'paragraph', lines: [words] }])
    }
  })

  it('do not begin a list inside a paragraph unless the number is one', () => {
    expect(blocksOf('Prvi red\n2026. godine je liga počela.')).toEqual([
      { kind: 'paragraph', lines: ['Prvi red', '2026. godine je liga počela.'] },
    ])
    expect(blocksOf('Prvi red\n1. stavka\n2. druga')).toEqual([
      { kind: 'paragraph', lines: ['Prvi red'] },
      list([1, 2], ['stavka', 'druga']),
    ])
    /* A list that is open takes the next number, and a bullet does not. */
    expect(blocksOf('- tačka\n2026. godine')).toEqual([
      { kind: 'list', ordered: false, items: ['tačka'], numbers: [] },
      list([2026], ['godine']),
    ])
    expect(blocksOf('1. a\n- b')).toEqual([list([1], ['a']), { kind: 'list', ordered: false, items: ['b'], numbers: [] }])
  })
})

describe('what the editor escapes', () => {
  it('escapes the characters of words that would mark a piece of a line', () => {
    expect(escapeWords('a*b_c`d[e]f')).toBe('a\\*b\\_c\\`d\\[e\\]f')
    expect(escapeWords('obično')).toBe('obično')
  })

  it('escapes the start of a line exactly where the line would be read as a block', () => {
    expect(escapeLineStart('## Naslov', false)).toBe('\\## Naslov')
    expect(escapeLineStart('- stavka', false)).toBe('\\- stavka')
    expect(escapeLineStart('---', false)).toBe('\\---')
    expect(escapeLineStart('| a | b |', false)).toBe('\\| a | b |')
    expect(escapeLineStart('2027. godine', false)).toBe('2027\\. godine')
    /* And nothing where it would not be: these are words wherever they stand. */
    for (const words of ['#oznaka', '-5 stepeni', '| otvoreno', '2027.godine', 'obična reč']) {
      expect(escapeLineStart(words, false), words).toBe(words)
    }
  })

  it('escapes a number under the words of a paragraph only where it would begin a list there, which is a one', () => {
    expect(escapeLineStart('1. stavka', true)).toBe('1\\. stavka')
    expect(escapeLineStart('2027. godine', true)).toBe('2027. godine')
    expect(escapeLineStart('## Naslov', true)).toBe('\\## Naslov')
  })

  it('writes lines that read back as the words they are', () => {
    for (const words of ['## Naslov', '- stavka', '---', '| a | b |', '2027. godine']) {
      expect(blocksOf(escapeLineStart(words, false))).toEqual([
        { kind: 'paragraph', lines: [escapeLineStart(words, false)] },
      ])
      expect(inlineOf(escapeLineStart(words, false), false)).toEqual([text(words)])
    }

    /* Under a line of words, the same lines, escaped as they are asked to be there. */
    for (const words of ['1. stavka', '2027. godine', '## Naslov']) {
      const written = `Prvo\n${escapeLineStart(words, true)}`

      expect(blocksOf(written), words).toEqual([{ kind: 'paragraph', lines: ['Prvo', escapeLineStart(words, true)] }])
      expect(inlineOf(escapeLineStart(words, true), false), words).toEqual([text(words)])
    }
  })
})

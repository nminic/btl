import { describe, expect, it } from 'vitest'
import {
  addressOf,
  blocksOf,
  escapeLineStart,
  escapeWords,
  inlineOf,
  MARKER,
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
    expect(addressOf('/pravilnik')).toEqual({ inside: true, href: '/pravilnik' })
    expect(addressOf('/BTL%20Statut.pdf')).toEqual({ inside: false, href: '/BTL%20Statut.pdf' })
    expect(addressOf('https://primer.rs')).toEqual({ inside: false, href: 'https://primer.rs' })
    expect(addressOf('http://primer.rs')).toEqual({ inside: false, href: 'http://primer.rs' })
    expect(addressOf('mailto:liga@primer.rs')).toEqual({ inside: false, href: 'mailto:liga@primer.rs' })
  })

  it('are nothing else', () => {
    for (const refused of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//zlo.example', '/\\zlo.example', 'ftp://primer.rs', 'primer.rs']) {
      expect(addressOf(refused), refused).toBeUndefined()
    }
  })
})

describe('what the editor escapes', () => {
  it('escapes the characters of words that would mark a piece of a line', () => {
    expect(escapeWords('a*b_c`d[e]f')).toBe('a\\*b\\_c\\`d\\[e\\]f')
    expect(escapeWords('obično')).toBe('obično')
  })

  it('escapes the start of a line exactly where the line would be read as a block', () => {
    expect(escapeLineStart('## Naslov')).toBe('\\## Naslov')
    expect(escapeLineStart('- stavka')).toBe('\\- stavka')
    expect(escapeLineStart('---')).toBe('\\---')
    expect(escapeLineStart('| a | b |')).toBe('\\| a | b |')
    expect(escapeLineStart('2027. godine')).toBe('2027\\. godine')
    /* And nothing where it would not be: these are words wherever they stand. */
    for (const words of ['#oznaka', '-5 stepeni', '| otvoreno', '2027.godine', 'obična reč']) {
      expect(escapeLineStart(words), words).toBe(words)
    }
  })

  it('writes lines that read back as the words they are', () => {
    for (const words of ['## Naslov', '- stavka', '---', '| a | b |', '2027. godine']) {
      expect(blocksOf(escapeLineStart(words))).toEqual([
        { kind: 'paragraph', lines: [escapeLineStart(words)] },
      ])
      expect(inlineOf(escapeLineStart(words), false)).toEqual([text(words)])
    }
  })
})

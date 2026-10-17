import { describe, expect, it } from 'vitest'
import type { Node } from 'prosemirror-model'
import { blocksOf, inlineOf } from '../markdownText'
import pages from '../../test/mock/pages.json'
import leagues from '../../test/mock/leagues.json'
import { fromMarkdown, toMarkdown } from './convert'
import { schema } from './schema'

/*
 * WHAT GOES INTO THE EDITOR COMES OUT OF IT SAYING THE SAME THING.
 *
 * Two directions and one promise, asked both ways: a text opened and left unchanged reads exactly
 * as it did, and what the editor holds, written out, reads back as what it held. The second is the
 * one „vidiš šta dobijaš" rests on: what somebody sees in the box is what the page will draw.
 */

const { nodes, marks } = schema

/** What a text says, as a reader of it sees it: its blocks with every line read into pieces. */
function said(text: string): unknown {
  return blocksOf(text).map((block) => {
    if (block.kind === 'heading') {
      return { ...block, text: inlineOf(block.text, false) }
    }

    if (block.kind === 'paragraph') {
      return { kind: 'paragraph', pieces: inlineOf(block.lines.join('\n'), false) }
    }

    if (block.kind === 'list') {
      return { ...block, items: block.items.map((item) => inlineOf(item, false)) }
    }

    return block
  })
}

const SECTIONS: string[] = pages.flatMap((page) => page.sections.map((section) => section.body))
const LEAGUE_TEXTS: string[] = leagues.flatMap((league) => [league.rules, league.prizes])

describe('a text opened in the editor and left as it is', () => {
  it('says what it said, for every section of every written page and every text of a competition', () => {
    /* The written pages carry a table in ten sections, a rule in four and the place of a drawing in
       two: a floor, so a file that lost them does not pass for one that kept them. */
    expect(SECTIONS.filter((body) => body.includes('|')).length).toBeGreaterThan(5)
    expect(SECTIONS.filter((body) => body.includes('[[gallery]]')).length).toBeGreaterThan(1)

    for (const text of [...SECTIONS, ...LEAGUE_TEXTS]) {
      expect(said(toMarkdown(fromMarkdown(text).content)), text.slice(0, 60)).toEqual(said(text))
    }
  })

  it('is a paragraph and nothing else when it is empty', () => {
    const doc = fromMarkdown('')

    expect(doc.childCount).toBe(1)
    expect(doc.child(0).type).toBe(nodes.paragraph)
    expect(toMarkdown(doc.content)).toBe('')
  })
})

/** A paragraph of words with marks, written the short way. */
function para(...children: Node[]): Node {
  return nodes.paragraph.create(null, children)
}

const words = (text: string, ...on: string[]) =>
  schema.text(
    text,
    on.map((name) => (name === 'link' ? marks.link.create({ href: 'https://primer.rs/a_b' }) : schema.mark(name))),
  )

describe('what the editor holds, written out', () => {
  /* Every shape the toolbar can make and every character that would mark something if it were not
     escaped, in one document, so nothing here passes by being the only thing in its text. */
  const doc = nodes.doc.create(null, [
    nodes.heading.create({ hashes: 2 }, [words('Naslov sa '), words('jakim', 'strong')]),
    nodes.heading.create({ hashes: 4 }, [words('Dublji')]),
    para(
      words('Obično, '),
      words('jako', 'strong'),
      words(' i '),
      words('jako i koso', 'strong', 'em'),
      words(', '),
      words('koso', 'em'),
      words(' pa '),
      words('veza ', 'link'),
      words('jaka veza', 'link', 'strong'),
      words('. Beo'),
      words('grad', 'em'),
      words('ski.'),
    ),
    para(words('Zvezde * i ** i _ i ` i [ ] i \\ ostaju znaci.')),
    para(
      words('## nije naslov'),
      nodes.hard_break.create(),
      words('- nije stavka'),
      nodes.hard_break.create(),
      words('2027. nije broj'),
      nodes.hard_break.create(),
      words('| nije | red |'),
      nodes.hard_break.create(),
      words('---'),
      nodes.hard_break.create(),
      words('[[gallery]]'),
    ),
    para(words('razmak '), words(' koso sa razmacima ', 'em'), words(' kraj')),
    para(words('Vrednost '), words('42.2', 'code'), words(' i '), words('ne`moguća', 'code')),
    nodes.bullet_list.create(null, [
      nodes.list_item.create(null, para(words('prva '), words('jaka', 'strong'))),
      nodes.list_item.create(null, para(words('druga'), nodes.hard_break.create(), words('u redu'))),
    ]),
    nodes.ordered_list.create(null, [
      nodes.list_item.create(null, para(words('jedan'))),
      nodes.list_item.create(null, para(words('dva'))),
    ]),
    nodes.kept.create(null, schema.text('| a | b |\n|---|---|\n| 1 | 2 |')),
    nodes.kept.create(null, schema.text('[[gallery]]')),
  ])

  const written = toMarkdown(doc.content)

  it('reads back as what it held, mark for mark', () => {
    const back = fromMarkdown(written)

    /* Two documents that differ only where a line break inside a list item became a blank, which a
       written list cannot hold (an item is one line): asked block by block. */
    expect(back.childCount).toBe(doc.childCount)
    doc.forEach((block, _offset, index) => {
      if (block.type === nodes.bullet_list) {
        expect(back.child(index).textContent).toBe('prva jakadruga u redu')
        return
      }

      if (
        block.type === nodes.paragraph &&
        (block.textContent.includes('ne`moguća') || block.textContent.includes('razmacima'))
      ) {
        /* A value cannot hold a backtick, so that one is written as the words it is; and the blanks
           at the edge of an italic piece are written outside it, where they mean the same. */
        expect(back.child(index).textContent).toBe(block.textContent)
        return
      }

      expect(back.child(index).toJSON(), block.textContent).toEqual(block.toJSON())
    })
  })

  it('writes the marks the page reads and escapes every character that would otherwise mark something', () => {
    expect(written).toContain('## Naslov sa **jakim**')
    expect(written).toContain('#### Dublji')
    expect(written).toContain('**jako** i **_jako i koso_**, _koso_ pa [veza **jaka veza**](https://primer.rs/a_b)')
    expect(written).toContain('Beo_grad_ski.')
    expect(written).toContain('Zvezde \\* i \\*\\* i \\_ i \\` i \\[ \\] i \\ ostaju znaci.')
    expect(written).toContain('\\## nije naslov\n\\- nije stavka\n2027\\. nije broj\n\\| nije | red |\n\\---\n\\[\\[gallery\\]\\]')
    /* Blanks at the edge of an italic piece stand outside it, where an italic piece may begin. */
    expect(written).toContain('razmak  _koso sa razmacima_  kraj')
    expect(written).toContain('Vrednost `42.2` i ne\\`moguća')
    expect(written).toContain('- prva **jaka**\n- druga u redu')
    expect(written).toContain('1. jedan\n2. dva')
    expect(written).toContain('| a | b |\n|---|---|\n| 1 | 2 |\n\n[[gallery]]')
  })

  it('leaves out a heading, an item and a paragraph that hold nothing', () => {
    const empty = nodes.doc.create(null, [
      nodes.heading.create({ hashes: 2 }),
      para(),
      nodes.bullet_list.create(null, [
        nodes.list_item.create(null, para()),
        nodes.list_item.create(null, para(words('jedina'))),
      ]),
      nodes.kept.create(),
    ])

    expect(toMarkdown(empty.content)).toBe('- jedina')
  })

  it('writes a marked run that is nothing but blanks as the blanks, with no mark around them', () => {
    const blank = nodes.doc.create(null, [para(words('a'), words('  ', 'em'), words('b'))])

    expect(toMarkdown(blank.content)).toBe('a  b')
  })

  it('closes every mark at a line break and opens it again after it', () => {
    const broken = nodes.doc.create(null, [
      para(words('jako', 'strong'), nodes.hard_break.create(), words('dalje', 'strong')),
    ])

    expect(toMarkdown(broken.content)).toBe('**jako**\n**dalje**')
  })
})

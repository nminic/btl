import { describe, expect, it } from 'vitest'
import { DOMParser, DOMSerializer } from 'prosemirror-model'
import { toMarkdown } from './convert'
import { schema } from './schema'

/* What the editor makes of a piece of a page dropped into it, or read back off its own box when a
   browser has changed the box under it (a spelling correction, a word composed with a dead key):
   only what a written text can say, and everything else as words or nothing. */

function read(html: string): string {
  const place = document.createElement('div')

  place.innerHTML = html

  return toMarkdown(DOMParser.fromSchema(schema).parse(place).content)
}

describe('a piece of a page, read into the editor', () => {
  it('keeps the shapes a written text has, a link with its address among them', () => {
    expect(
      read(
        '<h2>Dva</h2><h3>Tri</h3><h4>Četiri</h4><h5>Pet</h5><h6>Šest</h6>' +
          '<p><b>jako</b> <i>koso</i> <strong>i</strong> <em>ovo</em> <code>42</code> ' +
          '<a href="https://primer.rs">veza</a><br>red</p>' +
          '<ul><li>stavka</li></ul><ol><li>prva</li></ol><pre>| a |</pre>',
      ),
    ).toBe(
      '## Dva\n\n### Tri\n\n#### Četiri\n\n##### Pet\n\n###### Šest\n\n' +
        '**jako** _koso_ **i** _ovo_ `42` [veza](https://primer.rs)\nred\n\n- stavka\n\n1. prva\n\n| a |',
    )
  })

  it('keeps the words of what it has no shape for, and nothing of the shape', () => {
    expect(read('<p><span style="color:red">crveno</span> <img src="x.png" alt="slika"> <u>podvučeno</u></p>')).toBe(
      'crveno podvučeno',
    )
  })
})

describe('a link in a piece of a page', () => {
  /* The address of a pasted link is asked what the address of a link made in the box is asked
     (`linkableAddress`), so a drop brings in no link that the box would have refused. */
  const REFUSED = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,x',
    '//zlo.example',
    'https://www.runtrace.net@zlo.example',
    'https://primer.rs/a b',
    'mailto:nije mejl',
    '',
  ]
  const KEPT = ['https://primer.rs/a_b', 'http://primer.rs', '/pravilnik', 'mailto:info@primer.rs']

  it('is a link only where the address is one the box would have made a link to, and its words are kept either way', () => {
    for (const href of REFUSED) {
      expect(read(`<p><a href="${href}">klik</a></p>`), href).toBe('klik')
    }

    for (const href of KEPT) {
      expect(read(`<p><a href="${href}">klik</a></p>`), href).toBe(`[klik](${href})`)
    }
  })

  it('keeps the bold of the words of a refused link, which are words like any other', () => {
    expect(read('<p><a href="javascript:alert(1)"><b>klik</b> ovde</a></p>')).toBe('**klik** ovde')
  })
})

describe('the numbers of a pasted numbered list', () => {
  it('keeps the number a list counts from and the number of an item that jumps', () => {
    expect(read('<ol start="3"><li>prva</li><li>druga</li><li value="9">treća</li></ol>')).toBe(
      '3. prva\n4. druga\n9. treća',
    )
    expect(read('<ol start="0"><li>nulta</li></ol>')).toBe('0. nulta')
  })

  it('reads a number it cannot write as no number at all, so the list counts from one', () => {
    for (const start of ['', 'x', '-2', '1.5', '007', '1234567890']) {
      expect(read(`<ol start="${start}"><li value="${start}">prva</li><li>druga</li></ol>`), start).toBe(
        '1. prva\n2. druga',
      )
    }

    expect(read('<ol><li>prva</li><li>druga</li></ol>')).toBe('1. prva\n2. druga')
  })
})

describe('what the editor draws', () => {
  it('draws a list with the numbers it holds, and a list that counts from one with none said', () => {
    const item = (number: number | null) =>
      schema.nodes.list_item.create({ number }, schema.nodes.paragraph.create(null, schema.text('a')))
    const drawn = (start: number, numbers: (number | null)[]) => {
      const list = DOMSerializer.fromSchema(schema).serializeNode(
        schema.nodes.ordered_list.create({ start }, numbers.map(item)),
      )

      if (!(list instanceof HTMLElement)) {
        throw new Error('A list is drawn as an element')
      }

      return list
    }

    const counting = drawn(1, [null, null])

    expect(counting.getAttribute('start')).toBeNull()
    expect(Array.from(counting.children).map((one) => one.getAttribute('value'))).toEqual([null, null])

    const skipping = drawn(3, [null, 8])

    expect(skipping.getAttribute('start')).toBe('3')
    expect(Array.from(skipping.children).map((one) => one.getAttribute('value'))).toEqual([null, '8'])
  })

  it('draws a heading as a written page draws it, an h3 for two and three hashes', () => {
    const drawn = (hashes: number) =>
      DOMSerializer.fromSchema(schema).serializeNode(schema.nodes.heading.create({ hashes }, schema.text('N')))

    expect(drawn(2).nodeName).toBe('H3')
    expect(drawn(3).nodeName).toBe('H3')
    expect(drawn(4).nodeName).toBe('H4')
    expect(drawn(6).nodeName).toBe('H6')
  })
})

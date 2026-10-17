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

describe('what the editor draws', () => {
  it('draws a heading as a written page draws it, an h3 for two and three hashes', () => {
    const drawn = (hashes: number) =>
      DOMSerializer.fromSchema(schema).serializeNode(schema.nodes.heading.create({ hashes }, schema.text('N')))

    expect(drawn(2).nodeName).toBe('H3')
    expect(drawn(3).nodeName).toBe('H3')
    expect(drawn(4).nodeName).toBe('H4')
    expect(drawn(6).nodeName).toBe('H6')
  })
})

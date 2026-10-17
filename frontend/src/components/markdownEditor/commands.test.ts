import { describe, expect, it } from 'vitest'
import { EditorState, TextSelection, type Command } from 'prosemirror-state'
import {
  aroundCursor,
  bold,
  fits,
  heading,
  inHeading,
  inList,
  linkable,
  linkableAddress,
  linkIn,
  lineBreak,
  list,
  marked,
  paste,
  removeLink,
  setLink,
  sizeOf,
  stateFor,
} from './commands'
import { toMarkdown } from './convert'
import { schema } from './schema'

/* What the buttons and the keys of the editor do, asked of a state and answered by a state, with
   no screen in between: `MarkdownEditor.test.tsx` holds that the screen asks these. */

/** A state for a text, with the cursor at `from` and the selection running to `to`. */
function at(text: string, from: number, to = from, max: number | undefined = undefined): EditorState {
  const state = stateFor(text, () => max)

  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)))
}

/** What a command leaves the text as, or nothing where it refuses. */
function after(state: EditorState, command: Command): string | null {
  const next: EditorState[] = []
  const done = command(state, (tr) => {
    next.push(state.apply(tr))
  })
  const last = next.at(-1)

  return done && last !== undefined ? toMarkdown(last.doc.content) : null
}

describe('the four buttons that switch something', () => {
  it('make the selection bold, and say so', () => {
    const state = at('Jedna reč', 1, 6)

    expect(marked(state, schema.marks.strong)).toBe(false)
    expect(after(state, bold)).toBe('**Jedna** reč')
    expect(marked(at('**Jedna** reč', 2, 4), schema.marks.strong)).toBe(true)
  })

  it('say a mark is on for what is about to be typed, after it is pressed with nothing selected', () => {
    const state = at('Jedna reč', 3)
    let next = state

    bold(state, (tr) => {
      next = state.apply(tr)
    })

    expect(marked(state, schema.marks.strong)).toBe(false)
    expect(marked(next, schema.marks.strong)).toBe(true)
  })

  it('make a heading of a paragraph, and a paragraph of a heading again', () => {
    expect(inHeading(at('Reči', 1))).toBe(false)
    expect(after(at('Reči', 1), heading)).toBe('## Reči')
    expect(inHeading(at('## Reči', 1))).toBe(true)
    expect(after(at('## Reči', 1), heading)).toBe('Reči')
  })

  it('make a list of a paragraph, and take an item out of a list of either kind', () => {
    expect(inList(at('Reči', 1))).toBe(false)
    expect(after(at('Reči', 1), list)).toBe('- Reči')
    expect(inList(at('- Reči', 3))).toBe(true)
    expect(after(at('- Reči', 3), list)).toBe('Reči')
    expect(inList(at('1. Reči', 3))).toBe(true)
    expect(after(at('1. Reči', 3), list)).toBe('Reči')
  })

  it('make an item of a heading, as a line of words, in one change', () => {
    const state = at('## Naslov', 2)
    const next: EditorState[] = []

    expect(list(state)).toBe(true)
    list(state, (tr) => next.push(state.apply(tr)))

    const made = next.at(-1)

    expect(made === undefined ? null : toMarkdown(made.doc.content)).toBe('- Naslov')
  })

  it('refuse a heading inside a list, which a written list cannot hold', () => {
    expect(heading(at('- Reči', 3))).toBe(false)
  })

  it('refuse a mark inside a block kept as it was written', () => {
    const table = at('| a | b |', 2, 4)

    expect(bold(table)).toBe(false)
    expect(linkable(table)).toBe(false)
    expect(linkable(at('Reči', 1))).toBe(true)
  })
})

describe('a line break', () => {
  it('is a break inside a paragraph', () => {
    expect(after(at('Prvo drugo', 5), lineBreak)).toBe('Prvo\ndrugo')
  })

  it('is a new line inside a block kept as it was written', () => {
    expect(after(at('| a |', 6), lineBreak)).toBe('| a |')
    const state = at('| a |', 6)
    let next = state

    lineBreak(state, (tr) => {
      next = state.apply(tr)
    })

    expect(next.doc.child(0).textContent).toBe('| a |\n')
  })

  it('answers whether it can be made without making it', () => {
    expect(lineBreak(at('Prvo', 2))).toBe(true)
  })
})

describe('a link', () => {
  it('leads only where a written page may lead', () => {
    for (const address of ['https://primer.rs', 'http://primer.rs/a', 'mailto:liga@primer.rs', '/pravilnik']) {
      expect(linkableAddress(address), address).toBe(true)
    }

    for (const address of [
      'javascript:alert(1)',
      '//zlo.example',
      '/\\zlo.example',
      'https://',
      'https://primer.rs/a b',
      'https://primer.rs/(a)',
      'primer.rs',
      '',
    ]) {
      expect(linkableAddress(address), address).toBe(false)
    }
  })

  it('is written as the address itself where nothing is selected and no link stands', () => {
    const state = at('Vidi', 5)

    expect(linkIn(state)).toBeUndefined()
    expect(toMarkdown(state.apply(setLink(state, 'https://primer.rs')).doc.content)).toBe(
      'Vidi[https://primer.rs](https://primer.rs)',
    )
  })

  it('is put on the selection', () => {
    const state = at('Vidi sajt lige', 6, 10)

    expect(toMarkdown(state.apply(setLink(state, 'https://primer.rs')).doc.content)).toBe(
      'Vidi [sajt](https://primer.rs) lige',
    )
  })

  it('is changed whole where the cursor stands in it with nothing selected', () => {
    const state = at('A [prva](https://a.example) b [druga](https://b.example) c', 4)
    const existing = linkIn(state)

    expect(existing?.attrs.href).toBe('https://a.example')
    expect(toMarkdown(state.apply(setLink(state, 'https://c.example')).doc.content)).toBe(
      'A [prva](https://c.example) b [druga](https://b.example) c',
    )
  })

  it('is found in a selection that begins before it', () => {
    const state = at('A [prva](https://a.example) b', 1, 5)

    expect(linkIn(state)?.attrs.href).toBe('https://a.example')
  })

  it('is taken off the words around the cursor, or off the selection', () => {
    const inside = at('A [prva](https://a.example) b', 4)
    const selected = at('A [prva](https://a.example) b', 1, 7)

    expect(toMarkdown(inside.apply(removeLink(inside, schema.marks.link.create({ href: 'https://a.example' }))).doc.content)).toBe(
      'A prva b',
    )
    expect(toMarkdown(selected.apply(removeLink(selected, schema.marks.link.create({ href: 'https://a.example' }))).doc.content)).toBe(
      'A prva b',
    )
  })

  it('around the cursor is the run of words that carries it, and nothing where none does', () => {
    const state = at('[a **b**](https://x.example) c', 2)
    const link = schema.marks.link.create({ href: 'https://x.example' })

    /* Words of one link that carry different marks are two pieces, and still one link. */
    expect(aroundCursor(state, link)).toEqual({ from: 1, to: 4 })
    expect(aroundCursor(at('Reči', 2), link)).toEqual({ from: 2, to: 2 })
  })
})

describe('a paste', () => {
  it('is read as a written text, so a copied text comes back with its shape', () => {
    const state = at('Pre', 4)
    const { tr, dropped } = paste(state, '**jako** i _koso_', undefined)

    expect(dropped).toBe(0)
    expect(toMarkdown(state.apply(tr).doc.content)).toBe('Pre**jako** i _koso_')
  })

  it('goes in whole where it fits', () => {
    const state = at('Pre', 4, 4, 20)
    const { tr, dropped } = paste(state, 'dvanaest zn', 20)

    expect(dropped).toBe(0)
    expect(toMarkdown(state.apply(tr).doc.content)).toBe('Predvanaest zn')
  })

  it('is cut where the limit is, and says how much of it did not fit', () => {
    const state = at('Pre', 4, 4, 10)
    const { tr, dropped } = paste(state, 'abcdefghij', 10)

    expect(toMarkdown(state.apply(tr).doc.content)).toBe('Preabcdefg')
    expect(dropped).toBe(3)
  })

  it('is refused whole where there is no room at all', () => {
    const state = at('Pun', 4, 4, 3)
    const { tr, dropped } = paste(state, 'x', 3)

    expect(tr.docChanged).toBe(false)
    expect(dropped).toBe(1)
  })
})

describe('the limit', () => {
  it('is asked of the Markdown, which is what the server counts', () => {
    expect(sizeOf(at('**jako**', 1).doc)).toBe(8)
  })

  it('refuses a change that makes the text longer than the field takes', () => {
    const state = at('Četiri', 7, 7, 6)
    const longer = state.tr.insertText('!')

    expect(fits(longer, state, 6)).toBe(false)
    expect(state.apply(longer).doc.textContent).toBe('Četiri')
  })

  it('lets through a change that does not make it longer, even over the limit', () => {
    const over = at('Predugačko', 3, 3, 4)
    const shorter = over.tr.delete(1, 3)

    expect(fits(shorter, over, 4)).toBe(true)
    expect(over.apply(shorter).doc.textContent).toBe('edugačko')
  })

  it('lets through a change where the field names none, and anything that changes nothing', () => {
    const state = at('Reči', 1)

    expect(fits(state.tr.insertText('x'.repeat(10000)), state, undefined)).toBe(true)
    expect(fits(state.tr, state, 0)).toBe(true)
  })
})

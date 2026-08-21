import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The two sheets that set the space between the blocks of a written section.
 *
 * `Markdown.css` sets it between the paragraphs of one body; `PageSectionBody.css`
 * sets it between the words, the drawing, and the words after it. They have to be
 * the same number, and the comment in the second one says so out loud: a drawing
 * in the middle of an article is spaced like the paragraph it stands between,
 * rather than tighter or looser than one.
 *
 * Written twice because the two are different rules on different elements, and
 * a token cannot be shared between them without one selecting the other. So this
 * holds them together instead. Without it, somebody giving the paragraphs more
 * air leaves the fee schedule and the wall of ducats at the old distance, which
 * is exactly what the comment promises will not happen.
 *
 * Read as text, because jsdom computes no styles (ADL A7 says the same about
 * every guard over a stylesheet on this portal).
 */
const gapOf = (sheet: string, rule: string): string | undefined => {
  const file = readFileSync(join(__dirname, '..', 'components', sheet), 'utf8')
  const block = file.split(rule)[1]?.split('}')[0] ?? ''

  return /gap:\s*([^;]+);/.exec(block)?.[1]?.trim()
}

describe('the rhythm of a written section', () => {
  it('spaces a drawing like the paragraphs it stands among', () => {
    const words = gapOf('Markdown.css', '.markdown {')
    const column = gapOf('PageSectionBody.css', '.section-body {')

    expect(words).toBeDefined()
    expect(column).toBe(words)
  })
})

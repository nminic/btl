import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The heading that names one block of a competition, weighed against the rule it
 * has to beat.
 *
 * It was written as `.league__group th`, which is one class and one element, and
 * so is `.table th`. A tie is settled by source order and `table.css` is emitted
 * last, so four of the seven declarations never applied: measured in Chrome over
 * the built stylesheet, the heading came out at 11,2px rather than the 0,78rem it
 * asks for, with the letter spacing and the padding of an ordinary column heading
 * and its alignment taken by `.table th:nth-child(-n + 3)`. It read exactly the
 * same size as the heading „Član" beside it, which is the difference the rule
 * exists to make.
 *
 * `cellSpecificity.test.ts` exists for this very fault and says in its own words
 * that it skips rules whose last part is a bare `th` or `td`. This cell carries no
 * class of its own, so it fell through that hole; what is weighed here is the one
 * rule that fell through it.
 *
 * Counted rather than compared as text, so the day either selector is rewritten
 * the question is still the one that matters: does the heading of a block outrank
 * the heading of a column.
 */
const LEAGUE = readFileSync(join(process.cwd(), 'src/pages/league/League.css'), 'utf-8')
const TABLE = readFileSync(join(process.cwd(), 'src/styles/table.css'), 'utf-8')

/** Ids, then classes and pseudo-classes, then elements. Enough for these two. */
function weight(selector: string): number {
  const classes = (selector.match(/\.[\w-]+|:[\w-]+(\([^)]*\))?|\[[^\]]*\]/g) ?? []).length
  const elements = (selector.replace(/\.[\w-]+|:[\w-]+(\([^)]*\))?|\[[^\]]*\]/g, '').match(/[a-z]+/g) ?? []).length

  return classes * 100 + elements
}

/** The selector of the one rule in a sheet that ends in the given words.
 *
 *  Comments are taken out first: this portal explains its rules at least as often
 *  as it writes them, and a note above one of them is part of what stands between
 *  the previous brace and this selector. */
function selectorFor(css: string, ending: string): string {
  const plain = css.replaceAll(/\/\*[\s\S]*?\*\//g, ' ')
  const found = [...plain.matchAll(/([^{}]+)\{[^{}]*\}/g)]
    .map((one) => (one[1] ?? '').trim())
    .filter((one) => one.endsWith(ending) && !one.startsWith('@'))

  expect(found.length, `${ending} is not one rule`).toBe(1)

  return found[0] ?? ''
}

describe('the heading that names a block of a competition', () => {
  it('outranks the rule for an ordinary column heading', () => {
    const block = selectorFor(LEAGUE, '.league__group th')
    const column = selectorFor(TABLE, '.table th')

    expect(weight(block), `${block} does not outrank ${column}`).toBeGreaterThan(weight(column))
  })

  it('outranks the rule that would otherwise take its alignment', () => {
    /* `.table th:nth-child(-n + 3)` pushes the first three cells of any table to
       the left and reaches this one too, and it is two weights rather than one.
       Beating `.table th` alone would leave the alignment behind. */
    const block = selectorFor(LEAGUE, '.league__group th')
    /* Written as a list of two, `th` and `td`, so it is read by the part that
       reaches this cell rather than by the whole head of the rule. */
    const first = '.table th:nth-child(-n + 3)'

    expect(TABLE, 'the rule that aligns the first three cells has moved').toContain(first)

    expect(weight(block), `${block} does not outrank ${first}`).toBeGreaterThan(weight(first))
  })
})

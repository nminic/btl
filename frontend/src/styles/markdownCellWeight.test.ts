import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A written table wears two class sets at once, and the lighter one loses.
 *
 * `Markdown.tsx` draws `<table className="table markdown__table">`, so every
 * rule in Markdown.css that styles a cell is arguing with one in
 * `styles/table.css` over the same element. Until 13.08.2026 it lost all three
 * arguments while reading as though it won them: the privacy policy's four
 * column tables turned to the right on the fourth column, the rulebook's nine
 * column example turned on the fourth of nine, and every written table lit up
 * under the mouse that the file asks it not to.
 *
 * Two ways to lose, and only one of them is visible in the file:
 *
 * - **Lighter.** `text-align` is set by `.table th:nth-child(-n + 3)`, and a
 *   pseudo-class counts as a class, so that is (0,2,1) and a plain
 *   `.markdown__table th` at (0,1,1) never had a chance.
 * - **Tied.** `.markdown__table th` and `.table th` are both (0,1,1), and a tie
 *   goes to whichever is written out last. That is never this file: the body of
 *   table.css is emitted at the last sheet that asks for it, which is Rights.css,
 *   about a hundred and forty rules after these. The `@import` at the top of
 *   Markdown.css does not change that and cannot.
 *
 * The second is why this is read here rather than left to the eye. A tie is the
 * shape that looks settled and is not, and the only file on the portal a tie is
 * safe in is the one the shared body is emitted just before (ADL A7).
 */

const SRC = join(process.cwd(), 'src')

/**
 * What the cascade weighs a selector at: ids, then classes, then elements.
 *
 * Attribute selectors and pseudo-classes count as classes, pseudo-elements as
 * elements, which is the part people get wrong and the part this file turns on.
 * `:not(…)` is not written anywhere on this portal and is not handled: its
 * argument counts and the `:not` itself does not, so a selector using it would
 * be weighed too heavy here and the test would pass something it should not.
 */
function weight(selector: string): [number, number, number] {
  const ids = selector.match(/#[\w-]+/g) ?? []
  const classes = selector.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g) ?? []
  const elements = selector
    .replaceAll(/[#.][\w-]+|\[[^\]]*\]|::?[\w-]+(\([^)]*\))?/g, ' ')
    .match(/[a-zA-Z][\w-]*/g) ?? []

  return [ids.length, classes.length, elements.length]
}

/** Whether the first selector loses to the second, a tie counting as a loss.
 *
 *  A tie is a loss everywhere the shared sheet is written out later, which is
 *  everywhere except the sheet it is emitted just before. This file is about
 *  Markdown.css, which is not that sheet. */
function loses(mine: string, theirs: string): boolean {
  const a = weight(mine)
  const b = weight(theirs)

  for (let i = 0; i < 3; i++) {
    const ours = a[i] ?? 0
    const other = b[i] ?? 0

    if (ours !== other) return ours < other
  }

  return true
}

/** Every rule in a sheet: the selectors it lists and the properties it sets.
 *  Comments go first, since this portal writes more of them than of CSS. */
function rules(css: string): { selectors: string[]; properties: string[] }[] {
  return [...css.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    (one) => ({
      selectors: (one[1] ?? '')
        .split(',')
        .map((selector) => selector.trim().replaceAll(/\s+/g, ' '))
        .filter((selector) => selector !== '' && !selector.startsWith('@')),
      properties: [...(one[2] ?? '').matchAll(/(^|;)\s*([\w-]+)\s*:/g)].map((hit) => hit[2] ?? ''),
    }),
  )
}

/** The properties the shared sheet sets on a kind of cell, each with the
 *  heaviest selector it sets it with. */
function sharedCellRules(kind: 'th' | 'td'): Map<string, string> {
  const heaviest = new Map<string, string>()

  for (const rule of rules(readFileSync(join(SRC, 'styles', 'table.css'), 'utf-8'))) {
    for (const selector of rule.selectors) {
      /* A rule about the cell itself. `.table tbody tr` styles the row, and the
         one property it sets there is settled by the hover rule below. */
      if (!new RegExp(String.raw`^\.table\s+${kind}\b\S*$`).test(selector)) continue

      for (const property of rule.properties) {
        const before = heaviest.get(property)

        if (before === undefined || loses(before, selector)) heaviest.set(property, selector)
      }
    }
  }

  return heaviest
}

describe('the weights this file judges by', () => {
  it('are the ones the cascade uses', () => {
    /* Checked against the four selectors this file is about, rather than left to
       be trusted, since every judgement below rests on them. */
    expect(weight('.table th')).toEqual([0, 1, 1])
    expect(weight('.table th:nth-child(-n + 3)')).toEqual([0, 2, 1])
    expect(weight('.markdown .markdown__table thead th')).toEqual([0, 2, 2])
    expect(weight('.markdown .markdown__table tbody tr:hover')).toEqual([0, 3, 2])
  })

  it('count a tie as a loss, which is the whole point of reading this', () => {
    expect(loses('.markdown__table th', '.table th')).toBe(true)
    expect(loses('.markdown .markdown__table thead th', '.table th')).toBe(false)
    expect(loses('.markdown__table th', '.table th:nth-child(-n + 3)')).toBe(true)
  })
})

describe('a rule that styles a cell of a written table', () => {
  const shared = { th: sharedCellRules('th'), td: sharedCellRules('td') }
  const written = rules(readFileSync(join(SRC, 'components', 'Markdown.css'), 'utf-8')).filter(
    (rule) => rule.selectors.some((selector) => selector.includes('markdown__table')),
  )

  it('is found by this test, so what follows is not a check over an empty list', () => {
    /* Three today. A floor, because a written page gaining another table rule is
       ordinary; the properties are named because a rewrite that stopped this
       test seeing the shared sheet would leave every assertion below green. */
    expect(written.length).toBeGreaterThan(2)
    expect([...shared.th.keys()]).toEqual(expect.arrayContaining(['text-align', 'padding']))
    expect([...shared.td.keys()]).toEqual(expect.arrayContaining(['text-align', 'padding']))
  })

  it('outweighs the shared rule it argues with, rather than tying with it', () => {
    const beaten = written.flatMap((rule) =>
      rule.selectors.flatMap((selector) => {
        const kind = selector.includes(' th') ? 'th' : 'td'

        return rule.properties.flatMap((property) => {
          /* `padding-block` is half of `padding`, and the shorthand takes it
             whole when the shorthand wins. */
          const theirs = shared[kind].get(property) ?? shared[kind].get(property.split('-')[0] ?? '')

          return theirs !== undefined && loses(selector, theirs)
            ? [`${selector} { ${property} } is not heavier than ${theirs}, so it never applies`]
            : []
        })
      }),
    )

    /* Said as a sentence. Whoever trips this has written a rule that reads
       perfectly and does nothing, and needs to be told which rule is taking it. */
    expect(beaten).toEqual([])
  })

  it('outweighs the shared hover, which is a row rule and tied until it was named', () => {
    const hover = written.flatMap((rule) => rule.selectors).filter((one) => one.includes(':hover'))

    expect(hover.length).toBe(1)
    expect(loses(hover[0] ?? '', '.table tbody tr:hover')).toBe(false)
  })
})

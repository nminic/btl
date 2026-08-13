import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { at } from '../test/at'

/**
 * A written table is read from the left, and the rule that says so has to be
 * able to win.
 *
 * `Markdown.tsx` draws `<table className="table markdown__table">`, so every
 * cell of a written page is also a cell of the shared table and both sheets
 * reach it. `styles/table.css` writes `.table th` and `.table td`: one class and
 * one element, (0,1,1). `.markdown__table th` is the same weight, and equal
 * weight is settled by whichever the bundler emitted later, which was never this
 * file.
 *
 * Measured on the rulebook before the fix, on the example table of nine columns:
 * columns one to three read from the left only because
 * `.table th:nth-child(-n + 3)` happens to agree, and **columns four to nine
 * were right-aligned**, under a comment promising the opposite. The same tie
 * killed the tighter row padding (12px where 10 was written) and the rule that
 * stops a written row lighting up under the pointer.
 *
 * So the number to beat is not (0,1,1) but the (0,2,1) of that `:nth-child`
 * rule, since a pseudo-class counts as a class. This checks the arithmetic
 * rather than the spelling: whoever rewrites those selectors is free to reach
 * the weight any way they like, and only has to reach it.
 *
 * Read as text. jsdom resolves no cascade across stylesheets, so the component
 * test beside this one renders the table happily and cannot see any of it.
 *
 * A general form of this check, over every screen rather than this one, is
 * `cellSpecificity.test.ts` (ADL A7). It deliberately passes over rules whose
 * selector ends in a bare `th` or `td`, which is exactly the shape that failed
 * here, so this file stays even once that one is widened.
 */

const SRC = join(process.cwd(), 'src')

function read(path: string): string {
  /* Comments blanked, length kept. Both sheets are mostly prose, and this one
     names `.table th` a dozen times in the note above. */
  return readFileSync(join(SRC, path), 'utf-8').replaceAll(/\/\*[\s\S]*?\*\//g, (one) =>
    one.replaceAll(/[^\n]/g, ' '),
  )
}

type Rule = { selectors: string[]; properties: string[] }

function rules(css: string): Rule[] {
  return [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].flatMap((block) => {
    const head = at(block, 1)
    /* An at-rule ending in a semicolon belongs to whatever preceded this
       selector; `@import` is the one both sheets write. */
    const written = head.slice(head.lastIndexOf(';') + 1)

    return written.trim().startsWith('@')
      ? []
      : [
          {
            selectors: written.split(',').map((one) => one.trim()).filter(Boolean),
            properties: [...at(block, 2).matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)].map((one) =>
              at(one, 1),
            ),
          },
        ]
  })
}

/**
 * What a selector weighs, as the three numbers the cascade compares.
 *
 * Only the shapes these two sheets write: classes, element names and
 * pseudo-classes with or without parentheses. Each kind is removed as it is
 * counted, so the `n` inside `:nth-child(-n + 3)` cannot be read as an element
 * afterwards.
 */
function weight(selector: string): [number, number, number] {
  let rest = selector

  const take = (pattern: RegExp): number => {
    const found = rest.match(pattern) ?? []
    rest = rest.replaceAll(pattern, ' ')

    return found.length
  }

  const classes = take(/\.[\w-]+/g) + take(/:[\w-]+(?:\([^()]*\))?/g)

  return [0, classes, take(/(?:^|[\s>+~])\s*[a-z][\w-]*/g)]
}

/** Whether the cascade prefers the second outright, source order aside. */
function loses(mine: string, theirs: string): boolean {
  const [, myClasses, myElements] = weight(mine)
  const [, theirClasses, theirElements] = weight(theirs)

  return myClasses !== theirClasses ? myClasses < theirClasses : myElements <= theirElements
}

/** Each property the shared sheet decides about a `th` or a `td`, against the
 *  heaviest selector it decides it with. */
function shared(): Map<string, Map<string, string>> {
  const found = new Map([
    ['th', new Map<string, string>()],
    ['td', new Map<string, string>()],
  ])

  for (const rule of rules(read(join('styles', 'table.css')))) {
    for (const selector of rule.selectors) {
      const cell = /^\.table\s+(th|td)((?::[\w-]+(?:\([^()]*\))?)*)$/.exec(selector)

      if (cell === null) continue

      const known = found.get(at(cell, 1))

      for (const property of rule.properties) {
        /* One edge of one box under either of its names: the shared `padding`
           decides `padding-block` too. */
        const name = property.replaceAll(/-(?:block|inline)(?:-(?:start|end))?\b/g, '')
        const before = known?.get(name)

        if (before === undefined || loses(before, selector)) known?.set(name, selector)
      }
    }
  }

  return found
}

describe('the shared sheet', () => {
  const decided = shared()

  it('is read by this test, so what follows is not a check against an empty list', () => {
    expect([...(decided.get('th') ?? new Map()).keys()]).toEqual(
      expect.arrayContaining(['text-align', 'vertical-align', 'padding']),
    )
    /* The one that catches people out, and the reason the fix needed two
       elements rather than one. */
    expect(decided.get('th')?.get('text-align')).toBe('.table th:nth-child(-n + 3)')
    expect(weight('.table th:nth-child(-n + 3)')).toEqual([0, 2, 1])
  })
})

describe('every rule that styles a cell of a written table', () => {
  const written = rules(read(join('components', 'Markdown.css'))).flatMap((rule) =>
    rule.selectors
      .filter((one) => one.includes('markdown__table') && /\b(th|td)\b/.test(one))
      .map((selector) => ({ selector, properties: rule.properties })),
  )

  it('is found by this test', () => {
    /* Three today: the alignment of both kinds of cell and the padding of a
       body cell. Written as a floor, since a fourth is an ordinary thing to
       add and this test is not about how many there are. */
    expect(written.length).toBeGreaterThanOrEqual(3)
  })

  it('outweighs the shared rule it argues with, so it is not settled by load order', () => {
    const decided = shared()

    const beaten = written.flatMap(({ selector, properties }) =>
      properties.flatMap((property) => {
        const kind = /\bth\b/.test(selector) ? 'th' : 'td'
        const name = property.replaceAll(/-(?:block|inline)(?:-(?:start|end))?\b/g, '')
        const theirs = decided.get(kind)?.get(name)

        return theirs !== undefined && loses(selector, theirs)
          ? [`${selector} { ${property} } does not outweigh ${theirs}, so load order decides it`]
          : []
      }),
    )

    expect(beaten).toEqual([])
  })
})

describe('the row of a written table', () => {
  it('outweighs the shared hover, which is two classes and two elements', () => {
    /* `.markdown__table tbody tr:hover` counts `.markdown__table` and `:hover`
       against `tbody` and `tr`, which is exactly what `.table tbody tr:hover`
       counts. That tie lost, and the row lit up under the pointer on every
       written page. */
    const hover = rules(read(join('components', 'Markdown.css')))
      .flatMap((rule) => rule.selectors)
      .filter((one) => one.includes('markdown__table') && one.includes(':hover'))

    expect(hover.length).toBe(1)
    expect(loses(at(hover, 0), '.table tbody tr:hover')).toBe(false)
  })
})

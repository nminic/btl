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
 * **Both sides are read from the sheets**, neither is written down here. A rule
 * added to `table.css` tomorrow (`.table tbody td` is an ordinary next edit, and
 * that sheet already writes `tbody` three times) has to be able to change the
 * answer, or this file passes by not looking.
 *
 * A general form of this check, over every screen rather than this one, is
 * `cellSpecificity.test.ts`. It is **not in this tree yet**: it waits on the
 * branch that fixes the standing of a competition, and it passes over rules
 * whose selector ends in a bare `th` or `td`, which is exactly the shape that
 * failed here. When the two meet, the arithmetic below should stop being a
 * second copy and become one shared with it; two engines for one question is
 * what let a hole already closed in that file reopen in this one (ADL A7).
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
 * `:where()` weighs nothing whatever it holds, and `:is()`, `:not()` and
 * `:has()` weigh what their heaviest argument weighs. Counting a functional
 * pseudo-class as one class and then counting its contents again reads a rule as
 * heavier than it is, which is the direction that lets a rule that loses on the
 * screen pass here: `:is(.markdown__table) :is(thead) th` is (0,1,2) and loses
 * to `.table th:nth-child(-n + 3)`, and was scored (0,3,2).
 *
 * One level deep, which is what `[^()]*` allows and what these two sheets write.
 */
function weight(selector: string): [number, number, number] {
  let rest = selector.replaceAll(/:where\([^()]*\)/g, ' ')

  const inside = [...rest.matchAll(/:(?:is|not|has)\(([^()]*)\)/g)].map((one) =>
    at(one, 1)
      .split(',')
      .map((argument) => weight(argument.trim()))
      .reduce<[number, number, number]>(
        (heaviest, one) =>
          one[0] !== heaviest[0]
            ? one[0] > heaviest[0]
              ? one
              : heaviest
            : one[1] !== heaviest[1]
              ? one[1] > heaviest[1]
                ? one
                : heaviest
              : one[2] > heaviest[2]
                ? one
                : heaviest,
        [0, 0, 0],
      ),
  )

  rest = rest.replaceAll(/:(?:is|not|has)\([^()]*\)/g, ' ')

  const take = (pattern: RegExp): number => {
    const found = rest.match(pattern) ?? []
    rest = rest.replaceAll(pattern, ' ')

    return found.length
  }

  const ids = take(/#[\w-]+/g)
  const elements = take(/::[\w-]+/g)
  const classes = take(/\.[\w-]+/g) + take(/\[[^\]]*\]/g) + take(/:[\w-]+(?:\([^()]*\))?/g)
  const types = take(/(?:^|[\s>+~])\s*[a-z][\w-]*/g)

  return inside.reduce<[number, number, number]>(
    (total, one) => [total[0] + one[0], total[1] + one[1], total[2] + one[2]],
    [ids, classes, elements + types],
  )
}

/** Whether the cascade prefers the second outright, source order aside. A tie is
 *  a loss here: this file exists because a tie was decided by load order. */
function loses(mine: string, theirs: string): boolean {
  const [myIds, myClasses, myElements] = weight(mine)
  const [theirIds, theirClasses, theirElements] = weight(theirs)

  if (myIds !== theirIds) return myIds < theirIds
  if (myClasses !== theirClasses) return myClasses < theirClasses

  return myElements <= theirElements
}

/**
 * The property a declaration argues over, under whichever of its names.
 *
 * One edge of one box is one argument however it is spelled: the shared
 * `padding` decides `padding-block` and `padding-top` alike, and
 * `border-block-end` is `border-bottom` by the logical name. Compared as
 * written, each of those is a real loss that reads as a property nobody shares.
 */
function family(property: string): string {
  return property
    .replaceAll(/-(?:block|inline)(?:-(?:start|end))?\b/g, '')
    .replaceAll(/-(?:top|right|bottom|left)\b/g, '')
}

/** Whether a selector picks out a cell of the shared table: it names `.table`
 *  and ends on a `th` or a `td`, whatever stands between. */
function sharedCell(selector: string): string | null {
  const ends = /\b(th|td)((?::[\w-]+(?:\([^()]*\))?)*)$/.exec(selector)

  return ends !== null && /(^|\s)\.table\b/.test(selector) ? at(ends, 1) : null
}

/** Each property the shared sheet decides about a `th` or a `td`, against the
 *  selector that actually decides it: the heaviest, and of equals the last. */
function shared(): Map<string, Map<string, string>> {
  const found = new Map([
    ['th', new Map<string, string>()],
    ['td', new Map<string, string>()],
  ])

  for (const rule of rules(read(join('styles', 'table.css')))) {
    for (const selector of rule.selectors) {
      const kind = sharedCell(selector)

      if (kind === null) continue

      const known = found.get(kind)

      for (const property of rule.properties) {
        const name = family(property)
        const before = known?.get(name)

        if (before === undefined || loses(before, selector)) known?.set(name, selector)
      }
    }
  }

  return found
}

/** The rule in the shared sheet that lights a row under the pointer. */
function sharedHover(): string {
  const found = rules(read(join('styles', 'table.css')))
    .flatMap((rule) => rule.selectors)
    .filter((one) => /^\.table\b/.test(one) && /tr:hover$/.test(one))

  return at(found, 0)
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
    expect(sharedHover()).toBe('.table tbody tr:hover')
  })

  it('is weighed the way the cascade weighs it', () => {
    /* The functional pseudo-classes are the ones that read heavier than they
       weigh, and reading a page rule as heavier is what lets a loser pass. */
    expect(weight('.a:where(.b)')).toEqual([0, 1, 0])
    expect(weight(':where(.table.markdown__table) :where(thead) th')).toEqual([0, 0, 1])
    expect(weight(':is(.markdown__table) :is(thead) th')).toEqual([0, 1, 2])
    expect(weight('.table.markdown__table thead th')).toEqual([0, 2, 2])
    expect(weight('.table.markdown__table tbody tr:hover')).toEqual([0, 3, 2])

    /* One edge of one box, under any of its three spellings. */
    expect(family('padding-block')).toBe('padding')
    expect(family('padding-top')).toBe('padding')
    expect(family('border-block-end')).toBe(family('border-bottom'))
  })

  it('is recognised whatever shape a cell rule in it takes', () => {
    /* `.table tbody td` is an ordinary next edit in that sheet, which already
       writes `tbody` three times. Pinning the prefix to a bare `.table ` skipped
       every such rule, and a markdown rule that ties it passed. */
    expect(sharedCell('.table td')).toBe('td')
    expect(sharedCell('.table tbody td')).toBe('td')
    expect(sharedCell('.table thead th:first-child')).toBe('th')
    expect(sharedCell('.table tbody tr:hover')).toBeNull()
    expect(sharedCell('.markdown__table td')).toBeNull()
  })
})

describe('every rule that styles a cell of a written table', () => {
  /* Any rule in this sheet that ends on a cell, not only those spelling out the
     class: `.markdown thead th` styles the same cells through the wrapper and
     loses just as quietly. */
  const written = rules(read(join('components', 'Markdown.css'))).flatMap((rule) =>
    rule.selectors
      .filter((one) => /\b(th|td)((?::[\w-]+(?:\([^()]*\))?)*)$/.test(one))
      .map((selector) => ({ selector, properties: rule.properties })),
  )

  it('is found by this test', () => {
    /* Three selectors today, over two rules. A floor rather than the number,
       since merging or splitting them is nobody's business but the sheet's. */
    expect(written.length).toBeGreaterThanOrEqual(2)
  })

  it('outweighs the shared rule it argues with, so it is not settled by load order', () => {
    const decided = shared()

    const beaten = written.flatMap(({ selector, properties }) => {
      const kind = /\bth((?::[\w-]+(?:\([^()]*\))?)*)$/.test(selector) ? 'th' : 'td'

      return properties.flatMap((property) => {
        const theirs = decided.get(kind)?.get(family(property))

        return theirs !== undefined && loses(selector, theirs)
          ? [`${selector} { ${property} } does not outweigh ${theirs}, so load order decides it`]
          : []
      })
    })

    expect(beaten).toEqual([])
  })
})

describe('the row of a written table', () => {
  it('outweighs the shared hover rather than tying it', () => {
    /* `.markdown__table tbody tr:hover` counts `.markdown__table` and `:hover`
       against `tbody` and `tr`, which is exactly what the shared rule counts.
       That tie lost, and the row lit up under the pointer on every written page.
       The opponent is read from the sheet, so tightening it there tightens this. */
    const hover = rules(read(join('components', 'Markdown.css')))
      .flatMap((rule) => rule.selectors)
      .filter((one) => /tr:hover$/.test(one))

    expect(hover.length).toBeGreaterThanOrEqual(1)
    expect(hover.filter((one) => loses(one, sharedHover()))).toEqual([])
  })
})

import { bare } from '../test/sources'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { at } from '../test/at'

/**
 * A rule about a cell of the shared table has to be able to win.
 *
 * `styles/table.css` styles every table on the portal through `.table th` and
 * `.table td`, which is one class and one element: (0,1,1). A screen that wants
 * one of its own columns to sit differently writes a class, and a class alone is
 * (0,1,0). It loses, in every source order and from every sheet, and it loses
 * silently: the rule is valid, the file reads as though it works, and the screen
 * simply does something else.
 *
 * This is not hypothetical and it is not rare. Measured on the standing of a
 * competition (`pages/league/League.css`, 13.08.2026), where `.league__race` had
 * carried four declarations since 31.07.2026 and not one of them had ever
 * applied: the turned headings came out top-aligned rather than resting on the
 * body, at `10px 8px` of padding rather than `6px 2px`, and bold at 700 rather
 * than the 400 they were written in. The same file had `font-weight: 400` on
 * `.league__who` for the same reason and the same length of time, so every
 * competitor's name in that grid was bold while the same names on the ranking
 * table were not. Nothing said so, because nothing can: both sheets are correct
 * on their own terms and the cascade quietly picks one.
 *
 * So the check is arithmetic on the source. It reads which properties
 * `styles/table.css` sets on a cell, reads which class names the portal puts on
 * a `th` or a `td` inside a `.table`, and requires any rule that sets one of
 * those properties on one of those classes to be at least as specific as the
 * shared rule it is arguing with.
 *
 * Two things this deliberately does not do, both worth knowing before trusting
 * it further than it goes.
 *
 * It does not fail a tie. Equal weight is settled by source order, and a rule
 * written at the same weight is one its author had to think about; losing
 * outright is the fault here. Whoever writes a tie should know what they are
 * buying, because the bundler emits the body of the shared sheet at the last
 * sheet that asks for it, which is rarely the sheet doing the arguing.
 *
 * And it only examines a rule whose last compound carries a class, because that
 * is the shape a screen writes when it means one of its own columns. A rule
 * ending in a bare `th` or `td` is never looked at. `.moderators th` is one, and
 * it is deliberate. `.markdown__table th` was another, and was a live defect: it
 * tied `.table th` and lost on order, leaving every column past the third of a
 * written table right-aligned against a comment saying they read from the left.
 * That one is fixed, in the branch that landed just before this one, by naming
 * both classes the element carries. It is left written down because it is what
 * the hole costs when nobody is looking for it, not because it is still there.
 *
 * Read as text, not as a rendered screen. jsdom resolves no cascade across
 * stylesheets, so a test that mounted the grid would agree with whichever rule it
 * was given and see nothing.
 */

const SRC = join(process.cwd(), 'src')
const SHARED = join('styles', 'table.css')

/** Files under `src` with this ending, tests and their helpers left out. */
function sources(ending: string, dir = SRC, prefix = ''): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    const name = prefix === '' ? entry.name : join(prefix, entry.name)

    if (entry.isDirectory()) {
      return entry.name === 'test' ? [] : sources(ending, full, name)
    }

    return entry.name.endsWith(ending) && !entry.name.includes('.test.')
      ? [{ path: name, code: readFileSync(full, 'utf-8') }]
      : []
  })
}

/**
 * The text with the inside of every comment blanked out and its length kept, so
 * a position in it is still a position in the file.
 *
 * This portal explains itself at length and these sheets are mostly prose. The
 * comment above says `.table th` and `font-weight` in the same breath a dozen
 * times, and every one of them would read as a declaration.
 */

type Rule = { selectors: string[]; properties: string[]; line: number }

/**
 * Every rule in a stylesheet: what it selects and which properties it sets.
 *
 * At-rules are stepped into rather than over. A media query adds nothing to
 * specificity, so a rule that loses at every width goes on losing inside one, and
 * the phone block of League.css is exactly where a narrowed column would be
 * written.
 */
function rules(code: string): Rule[] {
  const text = bare(code)
  const found: Rule[] = []

  for (const block of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const head = at(block, 1)
    const body = at(block, 2)

    /* An at-rule that ends in a semicolon rather than a block belongs to
       whatever came before this selector, not to it. `@import` is the one this
       tree writes, and it has no braces, so the head of the first rule in a
       sheet that imports anything begins with it. Taking the head whole let
       `startsWith('@')` fire and threw that rule away: eight sheets lost their
       first rule, and the sheets that import `table.css` are precisely the ones
       whose rules argue with it. */
    const written = head.slice(head.lastIndexOf(';') + 1)

    /* The head of an at-rule with a block, not of a rule. `@media (...)` opens
       one whose contents this same loop reaches on its own, since a head cannot
       hold a brace. */
    if (written.trim().startsWith('@')) continue

    found.push({
      selectors: written.split(',').map((one) => one.trim()).filter(Boolean),
      properties: [...body.matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)].map((one) => at(one, 1)),
      /* Where the selector starts, not where the match does. Everything between
         the previous rule and this one belongs to this match, and a comment
         blanked to spaces is most of it, so the match itself begins a screenful
         too early and every rule in a sheet would be reported on line 1. */
      line: text
        .slice(0, block.index + head.length - written.length + Math.max(written.search(/\S/), 0))
        .split('\n').length,
    })
  }

  return found
}

/**
 * How much a selector weighs, as the three numbers the cascade compares.
 *
 * Ids, then classes with attributes and pseudo-classes, then elements with
 * pseudo-elements. Each kind is taken out of the text as it is counted so the
 * next pass cannot see it again: `-n + 3` inside `:nth-child()` holds a bare `n`
 * that would otherwise be counted as an element and hand
 * `.table th:nth-child(-n + 3)` one weight too many.
 */
function weight(selector: string): [number, number, number] {
  /* `:where()` weighs nothing whatever is inside it, and `:is()`, `:not()` and
     `:has()` weigh exactly what their heaviest argument weighs. Counting them as
     one class apiece and then counting their contents as well was wrong in the
     direction that matters: it made a page rule look heavier than it is, which
     is a rule that loses on the screen and passes here. `.a:where(.b)` came out
     (0,3,0) against the (0,1,0) it really is.

     One level deep, which is what `[^()]*` allows and what this tree writes. A
     selector with parentheses inside parentheses would be scored as text and
     should be given a test of its own on the day somebody writes one. */
  let rest = selector.replaceAll(/:where\([^()]*\)/g, ' ')

  const inside = [...rest.matchAll(/:(?:is|not|has)\(([^()]*)\)/g)].map((one) =>
    at(one, 1)
      .split(',')
      .map((argument) => weight(argument.trim()))
      .reduce<[number, number, number]>(
        (heaviest, one) =>
          one[0] !== heaviest[0]
            ? (one[0] > heaviest[0] ? one : heaviest)
            : one[1] !== heaviest[1]
              ? (one[1] > heaviest[1] ? one : heaviest)
              : (one[2] > heaviest[2] ? one : heaviest),
        [0, 0, 0],
      ),
  )

  rest = rest.replaceAll(/:(?:is|not|has)\([^()]*\)/g, ' ')

  const take = (pattern: RegExp): number => {
    const hits = rest.match(pattern) ?? []
    rest = rest.replaceAll(pattern, ' ')

    return hits.length
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

/**
 * The property a declaration is arguing over.
 *
 * Two names for one edge of one box are one argument. `.table th { padding }`
 * decides `padding-block` as well, and `border-bottom` and `border-block-end`
 * are the same line drawn by the logical name and the physical one. Compared as
 * written, `.league__who { padding-block: 0 }` is a real loss that reads here as
 * a property the shared sheet never mentions, and this tree already writes
 * `padding-inline` and `border-block-end` on cells.
 */
function family(property: string): string {
  return property
    .replaceAll(/-(?:block|inline)(?:-(?:start|end))?\b/g, '')
    .replaceAll(/-(?:top|right|bottom|left)\b/g, '')
}

/** Whether the cascade prefers the second selector outright, source order aside.
 *  A tie is not a loss; see the note at the top of this file. */
function loses(mine: string, theirs: string): boolean {
  const [myIds, myClasses, myElements] = weight(mine)
  const [theirIds, theirClasses, theirElements] = weight(theirs)

  if (myIds !== theirIds) return myIds < theirIds
  if (myClasses !== theirClasses) return myClasses < theirClasses

  return myElements < theirElements
}

/** The whole of a JSX opening tag, expressions and all, so an arrow inside an
 *  attribute is not mistaken for the end of it. */
function tagFrom(text: string, start: number): string {
  let depth = 0

  for (let index = start; index < text.length; index += 1) {
    const letter = text[index]

    if (letter === '{') depth += 1
    else if (letter === '}') depth -= 1
    else if (letter === '>' && depth === 0) return text.slice(start, index + 1)
  }

  /* An opening tag with no `>` is not something this tree can contain, since it
     would not compile. Returning the tail costs nothing and saves the caller
     from wondering. */
  return text.slice(start)
}

/** The text from an opening brace to the one that closes it. */
function braced(text: string, start: number): string {
  let depth = 0

  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1
    else if (text[index] === '}') {
      depth -= 1

      if (depth === 0) return text.slice(start, index + 1)
    }
  }

  return text.slice(start)
}

/**
 * Every class named in the `className` of one tag, however it is written: a bare
 * string, or an expression whose branches are strings.
 *
 * Only the value of that one attribute. Reading to the end of the tag instead
 * would collect the strings of every attribute after it, and `id="x"` or a
 * `title` built from a name and a date would arrive here looking like classes.
 */
function classesOf(tag: string): string[] {
  const found = /className=(?:(["'])([^"']*)\1|\{)/.exec(tag)

  if (found === null) return []

  const quoted = found[2]

  if (quoted !== undefined) return quoted.split(/\s+/).filter(Boolean)

  return [...braced(tag, found.index + found[0].length - 1).matchAll(/['"`]([^'"`]*)['"`]/g)]
    .flatMap((one) => at(one, 1).split(/\s+/))
    .filter(Boolean)
}

/**
 * Which class names the portal writes on a cell of a shared table, and on which
 * kind of cell.
 *
 * Only inside a `<table>` that wears `table` itself: the rights matrix is a
 * `<table className="rights">` with no shared rule reaching into it at all, and
 * its own `vertical-align: bottom` applies exactly as written. A check that
 * counted every `th` in the tree would have condemned the one table on the portal
 * where the pattern is already right.
 */
function cellClasses(): { found: Map<string, Set<string>>; unreadable: string[] } {
  const found = new Map<string, Set<string>>()
  const unreadable = new Set<string>()

  for (const { path, code } of sources('.tsx')) {
    const text = bare(code)

    for (const opening of text.matchAll(/<table\b/g)) {
      const tag = tagFrom(text, opening.index)

      if (!classesOf(tag).includes('table')) continue

      const from = opening.index + tag.length
      const closing = text.indexOf('</table>', from)
      const inside = text.slice(from, closing === -1 ? undefined : closing)

      for (const cell of inside.matchAll(/<(th|td)\b/g)) {
        const written = tagFrom(inside, cell.index)
        const names = classesOf(written)

        /* A cell whose class is decided somewhere else. Reading source cannot
           follow `className={cellClass(column)}` into the function that answers
           it, so those classes are not in the map and the rules that style them
           are not checked. That is worth knowing rather than worth guessing at,
           so it is counted and pinned below instead of passing in silence. */
        if (names.length === 0 && written.includes('className=')) unreadable.add(path)

        for (const name of names) {
          found.set(name, (found.get(name) ?? new Set()).add(at(cell, 1)))
        }
      }
    }
  }

  return { found, unreadable: [...unreadable].map((one) => one.replaceAll('\\', '/')).sort() }
}

/** What the shared sheet decides about a cell: for each kind of cell, each
 *  property it sets and the heaviest selector it sets it with. */
function sharedRules(): Map<string, Map<string, string>> {
  const shared = new Map<string, Map<string, string>>([
    ['th', new Map()],
    ['td', new Map()],
  ])

  for (const rule of rules(readFileSync(join(SRC, SHARED), 'utf-8'))) {
    for (const selector of rule.selectors) {
      /* `.table th`, `.table td`, and the same with pseudo-classes after them.
         A descendant further down (`.table tbody tr`) styles the row and not the
         cell, and never reaches a property a cell rule is arguing over.

         The pseudo-class is matched with its own parentheses rather than with
         `\S*`, which cannot cross a space. `.table th:nth-child(-n + 3)` is
         written with spaces inside the parens, so it never entered this map at
         all and `text-align` was recorded at the (0,1,1) of `.table th` instead
         of the (0,2,1) it really carries. That is the one selector this whole
         file is about, and a rule at (0,2,0) that truly loses to it passed. */
      const cell = /^\.table\s+(th|td)((?::[\w-]+(?:\([^()]*\))?)*)$/.exec(selector)

      if (cell === null) continue

      const known = shared.get(at(cell, 1))

      for (const property of rule.properties) {
        const name = family(property)
        const before = known?.get(name)

        if (before === undefined || loses(before, selector)) known?.set(name, selector)
      }
    }
  }

  return shared
}

describe('the shared table rules', () => {
  const shared = sharedRules()

  it('are found by this test, so what follows is not a check against an empty list', () => {
    /* The four this file exists because of. Named rather than counted: a
       property added to `.table th` widens the check by itself, which is the
       point, but a rewrite that stops this test seeing the sheet at all would
       leave every screen unguarded and every assertion below green. */
    expect([...(shared.get('th') ?? new Map()).keys()]).toEqual(
      expect.arrayContaining(['vertical-align', 'padding', 'font-weight', 'text-align']),
    )
    expect([...(shared.get('td') ?? new Map()).keys()]).toEqual(
      expect.arrayContaining(['vertical-align', 'padding', 'text-align']),
    )
  })

  it('are weighed the way the cascade weighs them', () => {
    /* The arithmetic above decides every judgement below, so it is checked
       against the two selectors this file is actually about rather than left to
       be trusted. The second is the one that catches people out: a pseudo-class
       counts as a class, so `.table th:nth-child(-n + 3)` weighs the same as two
       classes and one element and beats a rule that merely looks longer. */
    expect(weight('.table th')).toEqual([0, 1, 1])
    expect(weight('.table th:nth-child(-n + 3)')).toEqual([0, 2, 1])
    expect(weight('.league__grid th.league__who')).toEqual([0, 2, 1])
    expect(weight('.league__grid thead th.league__race')).toEqual([0, 2, 2])

    /* The functional pseudo-classes, which are the ones that read heavier than
       they weigh. `:where()` contributes nothing at all, and the other three
       contribute what their heaviest argument contributes and no more. Counted
       naively, the first of these came out (0,3,0) and a rule that really loses
       passed this whole file. */
    expect(weight('.a:where(.b)')).toEqual([0, 1, 0])
    expect(weight('.a:not(.b)')).toEqual([0, 2, 0])
    expect(weight('.a:not(h1)')).toEqual([0, 1, 1])
    /* The heaviest argument, not all of them: one class of its own and the id
       the `:is()` weighs in at. */
    expect(weight('.a:is(.b, #c)')).toEqual([1, 1, 0])

    expect(loses('.league__race', '.table th')).toBe(true)
    expect(loses('.league__grid thead th.league__race', '.table th')).toBe(false)
    /* A tie is not a loss, and this is the shape that made that policy worth
       stating: (0,2,0) against the pseudo-class rule is a loss, not a tie. */
    expect(loses('.league__grid .league__who', '.table th:nth-child(-n + 3)')).toBe(true)
  })

  it('reads one edge of a box under either of its two names', () => {
    /* `.table th` decides padding, so it decides `padding-block` too, and the
       logical name is what this tree increasingly writes. Compared as written,
       a real loss reads as a property nobody shares. */
    expect(family('padding-block')).toBe('padding')
    expect(family('padding-inline-start')).toBe('padding')
    expect(family('border-block-end')).toBe(family('border-bottom'))
    /* And a name that merely looks like one of those is left alone. */
    expect(family('vertical-align')).toBe('vertical-align')
    expect(family('white-space')).toBe('white-space')
    expect(family('font-weight')).toBe('font-weight')
  })

  it('reads a rule that follows an at-rule with no block of its own', () => {
    /* `@import` ends in a semicolon, so it lands in the head of the first rule
       after it. Taken whole, that head began with `@` and the rule was dropped:
       eight sheets lost their first rule, and the sheets that import the shared
       one are exactly those whose rules argue with it. */
    const [first] = rules("@import 'x.css';\n\n.a th {\n  padding: 0;\n}\n")

    expect(first?.selectors).toEqual(['.a th'])
    expect(first?.properties).toEqual(['padding'])
    expect(first?.line).toBe(3)
  })
})

describe('a class the portal puts on a cell of a shared table', () => {
  const { found: cells, unreadable } = cellClasses()

  it('is counted, or the screen it is on is named as one this test cannot read', () => {
    /* One screen builds its cell classes in a function (`cellClass` in
       TopBoards.tsx), so `boards__detail` and `boards__figure` are outside every
       check below. Nothing is wrong with them today, since both are (0,3,0) or
       heavier and win comfortably; what would be wrong is not knowing. A second
       screen appearing here is a second blind spot and is worth either writing
       the class out in the markup or widening this file. */
    expect(unreadable).toEqual(['pages/TopBoards.tsx'])
  })

  it('is found by this test, in both kinds of cell', () => {
    /* The grid of a competition is named because it is where this was measured,
       and because it is the one screen that puts a class on a `th` in the body
       as well as in the head. */
    expect([...cells.keys()]).toEqual(
      expect.arrayContaining(['league__race', 'league__who', 'league__total', 'table__points']),
    )
    expect([...(cells.get('league__who') ?? [])]).toContain('th')
    expect([...(cells.get('league__total') ?? [])]).toContain('td')
  })

  it('is not read from a table that carries no shared rules of its own', () => {
    /* The matrix of moderator rights is a `<table className="rights">`, so
       `.table th` never reaches it and `.rights__column { vertical-align:
       bottom }` applies exactly as written (measured: thirteen headings of
       thirteen different lengths, every one of them ending on the same line).
       Were it ever collected here, the check below would order it rewritten to
       cure a fault it does not have. */
    expect([...cells.keys()]).not.toContain('rights__column')
    expect([...cells.keys()]).not.toContain('rights__corner')
  })

  it('is not styled from a rule the shared sheet outranks', () => {
    const shared = sharedRules()

    const beaten = sources('.css')
      .filter(({ path }) => path !== SHARED)
      .flatMap(({ path, code }) =>
        rules(code).flatMap((rule) =>
          rule.selectors.flatMap((selector) => {
            /* The class the rule ends on is the one it styles. A class further
               left is an ancestor, and the shared sheet is not arguing with it. */
            const key = selector.slice(selector.search(/[^\s>+~]+$/))

            return (key.match(/\.[\w-]+/g) ?? []).flatMap((name) => {
              const kinds = cells.get(name.slice(1))

              if (kinds === undefined) return []

              return rule.properties.flatMap((property) =>
                [...kinds].flatMap((kind) => {
                  const theirs = shared.get(kind)?.get(family(property))

                  return theirs !== undefined && loses(selector, theirs)
                    ? [
                        /* Forward slashes whichever machine reads this. `join`
                           writes the separator of the host, and a path with
                           backslashes in it is not one an editor will open. */
                        `${path.replaceAll('\\', '/')}:${rule.line}  ${selector} ` +
                          `{ ${property} } is written lighter than ${theirs}, ` +
                          `so it never applies`,
                      ]
                    : []
                }),
              )
            })
          }),
        ),
      )

    /* Said as a sentence rather than as a count. Whoever trips this has written a
       rule that reads perfectly and does nothing, and the one thing they need to
       be told is which rule is taking it. */
    expect([...new Set(beaten)]).toEqual([])
  })
})

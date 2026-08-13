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
 * At least as specific, not more. A tie is settled by source order, and there is
 * one in the tree that is deliberate and documented: `.moderators th` is (0,1,1)
 * exactly like `.table th`, and wins because Rights.css imports the shared sheet
 * above it (`white-space: normal`, measured on the moderators screen). A tie is a
 * rule its author had to think about; losing outright is the fault here. Whoever
 * writes one should know what they are buying: League.css never imports the
 * shared sheet, so a tie written there is settled by where the bundler happens to
 * put a sheet this file has no say over.
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
function bare(code: string): string {
  return code
    .replaceAll(/\/\*[\s\S]*?\*\//g, (comment) => comment.replaceAll(/[^\n]/g, ' '))
    .replaceAll(/(^|[^:])\/\/[^\n]*/g, (line, before: string) =>
      before + ' '.repeat(line.length - before.length),
    )
}

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

    /* The head of an at-rule, not of a rule: `@media (...)` opens a block whose
       contents this same loop reaches on its own. */
    if (head.trim().startsWith('@')) continue

    found.push({
      selectors: head.split(',').map((one) => one.trim()).filter(Boolean),
      properties: [...body.matchAll(/(?:^|;)\s*([a-z-]+)\s*:/g)].map((one) => at(one, 1)),
      /* Where the selector starts, not where the match does. Everything between
         the previous rule and this one belongs to this match, and a comment
         blanked to spaces is most of it, so the match itself begins a screenful
         too early and every rule in a sheet would be reported on line 1. */
      line: text.slice(0, block.index + Math.max(head.search(/\S/), 0)).split('\n').length,
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
  let rest = selector

  const take = (pattern: RegExp): number => {
    const hits = rest.match(pattern) ?? []
    rest = rest.replaceAll(pattern, ' ')

    return hits.length
  }

  const ids = take(/#[\w-]+/g)
  const elements = take(/::[\w-]+/g)
  const classes = take(/\.[\w-]+/g) + take(/\[[^\]]*\]/g) + take(/:[\w-]+(?:\([^()]*\))?/g)

  return [ids, classes, elements + take(/(?:^|[\s>+~])\s*[a-z][\w-]*/g)]
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
function cellClasses(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>()

  for (const { code } of sources('.tsx')) {
    const text = bare(code)

    for (const opening of text.matchAll(/<table\b/g)) {
      const tag = tagFrom(text, opening.index)

      if (!classesOf(tag).includes('table')) continue

      const from = opening.index + tag.length
      const closing = text.indexOf('</table>', from)
      const inside = text.slice(from, closing === -1 ? undefined : closing)

      for (const cell of inside.matchAll(/<(th|td)\b/g)) {
        for (const name of classesOf(tagFrom(inside, cell.index))) {
          found.set(name, (found.get(name) ?? new Set()).add(at(cell, 1)))
        }
      }
    }
  }

  return found
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
      /* `.table th`, `.table td`, and the same with a pseudo-class after them.
         A descendant further down (`.table tbody tr`) styles the row and not the
         cell, and never reaches a property a cell rule is arguing over. */
      const cell = /^\.table\s+(th|td)\b\S*$/.exec(selector)

      if (cell === null) continue

      const known = shared.get(at(cell, 1))

      for (const property of rule.properties) {
        const before = known?.get(property)

        if (before === undefined || loses(before, selector)) known?.set(property, selector)
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

    expect(loses('.league__race', '.table th')).toBe(true)
    expect(loses('.league__grid thead th.league__race', '.table th')).toBe(false)
    /* A tie is not a loss, which is the whole of why `.moderators th` survives
       this test. */
    expect(loses('.moderators th', '.table th')).toBe(false)
  })
})

describe('a class the portal puts on a cell of a shared table', () => {
  const cells = cellClasses()

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
                  const theirs = shared.get(kind)?.get(property)

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

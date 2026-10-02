import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { screen } from '@testing-library/react'
import { at, must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { everyRule } from '../test/stylesheet'

/**
 * WHAT THE MAIN STANDING DRAWS AT THE WIDTHS THE OWNER CHOSE, asked of every rule the portal has.
 *
 * <p><b>Two decisions of 02.10.2026 about one table, and both were only half held.</b> The circle
 * is drawn „tek od 745px, kad ime staje u jedan red", and „raspored od devet naspram cetiri kolone
 * OSTAJE na 700px" (`PDL.md`, „Odluke iz ciscenja nalaza", stavka 260). The first half of the second
 * was held by `styles/goldBand.test.ts`, which reads the one rule of `styles/table.css` that takes the
 * columns away. The other half - that NOTHING ELSE does, at any width from 700 up - was held by no
 * case: a rule written into the block that takes the circle away, `.table__hide-phone { display: none
 * }`, would have dropped the table to four columns at the circle's width instead of at 700's, which
 * is „Prelom glavne tabele se podize", the sentence the owner's own choice was narrowed to avoid
 * (found by the review of PR 461, `PENDING.md`). Measured before this file: the mutation that writes
 * it passed every case the portal has.
 *
 * <p><b>It asks the rules, not a spelling, and it asks EVERY rule.</b> jsdom lays nothing out and
 * computes no cascade (ADL A33), so what can be asked here is which rules take something off the
 * screen at a width: every `display: none` of every sheet the portal has, found from the file
 * system and not listed, against the cells of the table the screen really draws. A rule is read as
 * applying when every query it is written under holds at the width. A query this cannot read - one
 * that is not a width, or a rule that takes a column away under something that is not a media query -
 * fails and names itself, rather than being guessed at: a reading that knew one spelling would be a
 * guard for that spelling. What it does NOT ask is specificity and order between two rules, so a
 * later rule that gave a column back would still read as taken away: the direction that fails
 * loudly. Measured in a browser instead: nine columns at 700, 744, 745, 760 and 1280, four at 699 and
 * 360.
 *
 * <p><b>And the circle's own question is asked of the box it is asked about, which is why the second
 * case is longer than the first.</b> The circle is taken away by a QUERY ON THE TABLE'S BOX and not on
 * the window (`pages/Rankings.css`, for the measurement that chose it), and a container query that
 * names a box which does not exist applies to nothing. Here that would leave the circle drawn on a
 * telephone, with every name beside it on two lines, and nothing that renders this screen would say
 * so. So the case asks the real tree: that the circle's query names a container, and that the element
 * the rule makes one is the box right around the standing's table.
 */

const SRC = join(process.cwd(), 'src')

/** Every stylesheet the portal has, found rather than listed. */
function everySheet(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return everySheet(join(dir, entry.name))
    }

    return entry.name.endsWith('.css') ? [join(dir, entry.name)] : []
  })
}

type Written = {
  rule: CSSStyleRule
  /** The queries and the like the rule is written inside, outermost first. */
  under: CSSRule[]
  sheet: string
}

/** Every rule of every sheet, with what it is written under. */
function everythingWritten(): Written[] {
  return everySheet(SRC).flatMap((path) => {
    const sheet = relative(SRC, path)

    return everyRule(readFileSync(path, 'utf-8'), sheet).map((rule) => {
      const under: CSSRule[] = []

      for (let up = rule.parentRule; up !== null; up = up.parentRule) {
        under.unshift(up)
      }

      return { rule, under, sheet }
    })
  })
}

/**
 * Whether a width query holds at a width, in pixels, in the two syntaxes the portal writes one in.
 *
 * Sixteen is the initial font size, which is what a width query in `em` is measured against
 * (`styles/scale.test.ts` reads it the same way). A query that says anything this does not understand
 * fails and names itself.
 */
function holdsAt(query: string, width: number, where: string): boolean {
  let left = query
  let holds = true

  for (const one of query.matchAll(/\(\s*(min|max)-width\s*:\s*([\d.]+)(px|em)\s*\)/g)) {
    const edge = Number(must(one[2], 'the number')) * (one[3] === 'em' ? 16 : 1)

    holds = holds && (one[1] === 'min' ? width >= edge : width <= edge)
    left = left.replace(one[0], '')
  }

  for (const one of query.matchAll(/\(\s*width\s*(>=|<=|>|<)\s*([\d.]+)(px|em)\s*\)/g)) {
    const edge = Number(must(one[2], 'the number')) * (one[3] === 'em' ? 16 : 1)
    const sign = must(one[1], 'the sign')

    holds =
      holds &&
      (sign === '>=' ? width >= edge : sign === '<=' ? width <= edge : sign === '>' ? width > edge : width < edge)
    left = left.replace(one[0], '')
  }

  expect(
    left.replace(/\b(screen|all|and)\b/g, '').trim(),
    `${where}: „${query}" says something this reading cannot ask a width`,
  ).toBe('')

  return holds
}

/** The main standing as the screen draws it, once it has drawn its rows. */
async function theStanding(): Promise<{ heads: Element[]; row: Element[]; table: Element }> {
  renderAt('/sr/tabela?sezona=2019', 'visitor', null)

  const table = must((await screen.findByRole('table')).closest('table'), 'the standing')

  await screen.findAllByRole('row')

  const heads = [...table.querySelectorAll('thead th')]
  const row = [...must(table.querySelector('tbody tr'), 'a row of the standing').children]

  expect(row, 'every column has one cell in a row').toHaveLength(heads.length)

  return { heads, row, table }
}

describe('the main standing, at the widths the owner chose', () => {
  /** The columns, by position, that some rule of the portal takes off the screen at this width. */
  function takenAwayAt(width: number, cells: Element[][]): number[] {
    const taken = new Set<number>()

    for (const { rule, under, sheet } of everythingWritten()) {
      if (rule.style.getPropertyValue('display') !== 'none') {
        continue
      }

      const hit = cells.flatMap((line) =>
        line.flatMap((cell, index) => (cell.matches(rule.selectorText) ? [index] : [])),
      )

      if (hit.length === 0) {
        continue
      }

      const where = `${sheet}: ${rule.selectorText}`
      const applies = under.every((one) => {
        expect(one, `${where} takes a column off the screen under something that is not a media query`).toBeInstanceOf(
          CSSMediaRule,
        )

        return one instanceof CSSMediaRule && holdsAt(one.conditionText, width, where)
      })

      if (applies) {
        for (const index of hit) {
          taken.add(index)
        }
      }
    }

    return [...taken].sort((left, right) => left - right)
  }

  it('draws nine columns from 700px and four below it, and no other rule takes one away', async () => {
    const { heads, row } = await theStanding()
    const marked = heads.flatMap((one, index) => (one.classList.contains('table__hide-phone') ? [index] : []))

    /* Nine and four, and the five that make the difference, from the DOM. The owner's numbers are
       asked as numbers; which five they are is what the table marks. */
    expect(heads).toHaveLength(9)
    expect(heads.length - marked.length).toBe(4)

    /* Four on a telephone, and at the one width just under 700 where the portal narrows every table. */
    for (const width of [360, 699.98]) {
      expect(takenAwayAt(width, [heads, row]), `${width}px`).toEqual(marked)
    }

    /* Nine from 700 up, and at the widths between 700 and the one the circle comes back at in
       particular: that is where a rule written beside the circle's would take the columns away. */
    for (const width of [700, 720, 744.98, 745, 760, 768, 1280]) {
      expect(takenAwayAt(width, [heads, row]), `${width}px`).toEqual([])
    }
  }, SLOW)

  it('draws the circle where the table is wide enough for the names, and only through a box that really is one', async () => {
    const { table } = await theStanding()
    const written = everythingWritten()
    const portraits = [...table.querySelectorAll('.portrait')]

    expect(portraits.length, 'the standing draws circles').toBeGreaterThan(0)

    /* EVERY CIRCLE OF THE STANDING, and not the first one. A circle is a `.portrait` (`test/plate.ts`),
       and the rule that takes it away is found by walking UP from each of them and asking every rule
       of the portal that says `display: none` whether it reaches one of the elements on the way. It
       has to be asked of both shapes the plate draws, the circle that is a link and the circle that
       is not: a link that forgot the class the rule is written against would be a circle no rule
       reaches, drawn on a telephone with every name beside it on two lines, and the whole of the
       gate was green over it (mutation L3, measured before this case). */
    const takers = new Set<Written>()

    for (const portrait of portraits) {
      const on: Element[] = []

      for (let up = portrait.parentElement; up !== null && up !== table; up = up.parentElement) {
        on.push(up)
      }

      const reaching = written.filter(
        ({ rule }) =>
          rule.style.getPropertyValue('display') === 'none' && on.some((one) => one.matches(rule.selectorText)),
      )

      expect(reaching, 'a circle of the standing that no rule can take away').not.toHaveLength(0)

      for (const one of reaching) {
        takers.add(one)
      }
    }

    expect(takers.size, 'one rule takes the circles away, wherever it is written').toBe(1)

    const taker = must([...takers][0], 'the rule')

    expect(taker.under, 'and one query').toHaveLength(1)

    const asked = must(at(taker.under, 0), 'the query')

    expect(asked, 'on the box around the table and not on the window').toBeInstanceOf(CSSContainerRule)

    if (!(asked instanceof CSSContainerRule)) {
      return
    }

    /* The box is real. Walked up from a circle and asked of the rules, not of a name: an element that
       a rule makes a container, of the name the query asks for. A container query naming a box that
       does not exist applies to nothing, which here is the circle on a telephone. */
    const circle = must(portraits[0], 'a circle')
    const boxes: Element[] = []

    for (let up = circle.parentElement; up !== null; up = up.parentElement) {
      const candidate = up

      /* `inline-size` and nothing else. `size` contains the HEIGHT of the box as well, which a table's
         box has none of its own to give, so it would collapse to nothing in a browser while jsdom
         lays nothing out and saw no difference. */
      const makesOne = written.some(
        ({ rule }) =>
          rule.style.getPropertyValue('container-type') === 'inline-size' &&
          rule.style.getPropertyValue('container-name').split(/\s+/).includes(asked.containerName) &&
          candidate.matches(rule.selectorText),
      )

      if (makesOne) {
        boxes.push(candidate)
      }
    }

    expect(boxes, `no box on the way up from the circle is a container called „${asked.containerName}"`).toHaveLength(1)
    expect(boxes[0], "and it is the box around the standing's table, which is what a table is wide in").toBe(
      must(table.closest('.table-scroll'), 'the box around the table'),
    )

    /* WHERE IT CHANGES, in the width of that box. 727px is the table in which every name of every
       season the standing draws is on one line (`pages/Rankings.css` has the table of seasons and
       the boundary it is written as): a window of 759px with no scrollbar and one of 774px with a
       15px scrollbar. 713px, which was the first choice in this branch and is the table of a 745px
       window, is taken away now; 328 is a 360px telephone and 668 a 700px window. The edge is
       asked from both sides, so moving it either way fails. */
    for (const width of [328, 668, 713, 726.98]) {
      expect(holdsAt(asked.containerQuery, width, 'the circle'), `taken away at ${width}`).toBe(true)
    }

    /* And drawn from the edge up: 736 is a tablet of 768px in portrait with overlay scrollbars, 1068 a
       desktop of 1280px. */
    for (const width of [727, 736, 1068]) {
      expect(holdsAt(asked.containerQuery, width, 'the circle'), `drawn at ${width}`).toBe(false)
    }
  }, SLOW)
})

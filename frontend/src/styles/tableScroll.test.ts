import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every table the portal draws sits in a box that scrolls, so that the page
 * never has to.
 *
 * That the page never scrolls sideways is one of the few rules written down as a
 * rule (PDL P24, and CLAUDE.md), and the box called `.table-scroll` is the whole
 * of how it is kept: a table wider than the column it sits in scrolls inside its
 * own kerb, and the reader's screen stays where it was.
 *
 * The matrix of moderator rights was drawn for a year without one. Nothing said
 * so, because at the default text size sixteen columns of checkboxes do fit in
 * the 900 pixels the shape switches at, and every width in that table is in
 * `rem` while the page is not: at 1280 with the text at 200 per cent it wanted
 * 214 pixels more than it had and took them from the page. Twenty-three tables
 * had the box and the twenty-fourth did not, which is the kind of thing a list
 * of twenty-four cannot be trusted to keep.
 *
 * So it is read here rather than remembered. The read is of the source and not
 * of a rendered screen: jsdom lays nothing out, so nothing that renders can see
 * a page 214 pixels too wide. What can be seen is the box, and the box is
 * written in the markup.
 */

const SRC = join(process.cwd(), 'src')

/**
 * The box has to be the one immediately around the table: `table-scroll` named
 * in the opening tag that precedes `<table`, with nothing but whitespace between
 * the two.
 *
 * Immediately, and not anywhere above, because a box further out is a box with
 * something else in it as well. The classes may be shared with another job on
 * the same element, which is how the matrix wears it (`rights-wrap table-scroll`
 * carries the margin and the scroll at once), and `[^<>]` is what keeps that to
 * one tag rather than letting it reach back through a whole screen.
 */
const INSIDE_THE_BOX = /table-scroll[^<>]*>\s*$/

/**
 * The one table that needs no box: one clipped to a single pixel.
 *
 * The donut of categories draws itself for the eye and writes the same numbers
 * out as a table for a screen reader (`visually-hidden`, index.css). A pixel
 * pushes nothing, and a box around it would scroll a table nobody can see.
 *
 * Written as the reason rather than as a path, so a second hidden table is
 * excused on the day it is written and a visible one never is.
 */
const CLIPPED = /visually-hidden/

/** Every component under `src`, tests left out: a table written in a test is not
 *  a table the portal draws. */
function components(dir = SRC, prefix = ''): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return components(at, name)
    }

    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.')
      ? [{ path: name, code: readFileSync(at, 'utf-8') }]
      : []
  })
}

/**
 * The code with every comment blanked out, and the same length as what went in,
 * so a position in it is still a position in the file.
 *
 * A `<table` written in prose is not one drawn, and this portal explains itself
 * at length: the note above the matrix names the tag it is about, and the file
 * you are reading names it a dozen times.
 */
function bare(code: string): string {
  return code
    .replaceAll(/\/\*[\s\S]*?\*\//g, (comment) => comment.replaceAll(/[^\n]/g, ' '))
    .replaceAll(/(^|[^:])\/\/[^\n]*/g, (line, before: string) =>
      before + ' '.repeat(line.length - before.length),
    )
}

/** Where a table is drawn, the tag that opens it, and everything written before
 *  it, which is where its box would be. */
function drawn(): { where: string; tag: string; before: string }[] {
  return components().flatMap(({ path, code }) => {
    const text = bare(code)

    return [...text.matchAll(/<table\b[^>]*>/g)].map((one) => {
      const at = one.index ?? 0

      return {
        where: `${path}:${text.slice(0, at).split('\n').length}`,
        tag: one[0],
        before: text.slice(0, at),
      }
    })
  })
}

describe('every table the portal draws', () => {
  const all = drawn()

  it('is found by this test, so what follows is not a check over an empty list', () => {
    /* Twenty-four today. Written as a floor rather than as the number: a screen
       with a table on it is an ordinary thing to add, and this test is not about
       how many there are. The matrix is named because it is the one that was
       missing its box, and a rewrite of it that this test stops seeing is a
       rewrite this test stops guarding. */
    expect(all.length).toBeGreaterThan(20)
    expect(all.map((one) => one.where.split(':')[0])).toContain('pages/admin/RightsMatrix.tsx')
  })

  it('sits in a box of its own, so a table too wide scrolls and the page does not', () => {
    const loose = all
      .filter((one) => !CLIPPED.test(one.tag) && !INSIDE_THE_BOX.test(one.before))
      .map((one) => one.where)

    expect(loose).toEqual([])
  })

  it('is excused the box only where it is clipped to a pixel and can push nothing', () => {
    const excused = all.filter((one) => CLIPPED.test(one.tag)).map((one) => one.where)

    /* One, and the day a second appears it is worth reading rather than
       counting: a table hidden from the eye is a text alternative, and a table
       hidden because it did not fit is the fault this file is about. */
    expect(excused).toEqual(['components/CategoryDonut.tsx:191'])
  })
})

describe('the box the tables sit in', () => {
  it('scrolls sideways, which is the whole of what it is for', () => {
    /* The markup above is checked against a class name, and a class name is
       worth what its rule is worth. */
    expect(bare(readFileSync(join(SRC, 'styles', 'table.css'), 'utf-8'))).toMatch(
      /\.table-scroll\s*\{[^}]*overflow-x:\s*auto/,
    )
  })

  it('is asked for by the matrix itself, which draws it without the rest of the screen', () => {
    /* Rights.css is the sheet that RightsMatrix.tsx brings with it. The screen
       around it happens to pull table.css in as well, through Member.css and
       Profile.css, but that is an accident of the other tables on that screen:
       take the entity list off it and the matrix loses its box without a word
       being said about the matrix. */
    expect(readFileSync(join(SRC, 'pages', 'admin', 'Rights.css'), 'utf-8')).toContain(
      "@import '../../styles/table.css'",
    )
  })
})

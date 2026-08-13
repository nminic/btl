import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every table the portal draws sits in a box that scrolls, so that the page
 * never has to.
 *
 * That the page never scrolls sideways is one of the few rules written down as a
 * rule (PDL P24, and CLAUDE.md), and the box called `.table-scroll` is half of
 * how it is kept: a table wider than the column it sits in scrolls inside its
 * own kerb, and the reader's screen stays where it was.
 *
 * The other half is that the box is allowed to be narrower than what is in it.
 * A flex or grid item is `min-width: auto` by default, which is min-content, so
 * a box holding a wide table refuses to shrink and the width goes on the page
 * with `overflow-x: auto` written and doing nothing. The portal already knows
 * this and says so where it matters (`minmax(0, 1fr)` in TopBoards.css and
 * SectionNav.css, `min-inline-size: 0` in Rankings.css). This file does not
 * check that half: it reads markup, and that half is in the stylesheets and in
 * the shape of the screen around them.
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
 *
 * The tag also has to open something. `<div className="table-scroll" />` before
 * a table is a box the table is beside rather than in, and the width of the
 * table goes on the page exactly as if no box had been written at all, so the
 * character before the `>` may not be the slash that closes the tag on itself.
 *
 * The name is whole or it is not the name. `no-table-scroll` and
 * `table-scrollbar` both hold these thirteen letters and neither is this box,
 * and `\b` does not tell them apart because a dash is already a boundary to a
 * word. A comment between the box and the table is allowed through, however:
 * `bare` leaves a blanked one as an empty pair of braces, and a note about why
 * a table scrolls is exactly the sort of thing written there.
 */
const INSIDE_THE_BOX = /(?<![\w-])table-scroll(?![\w-])[^<>]*[^/<>]>[\s{}]*$/

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

/** Every component under `src`, the tests left out along with the helpers they
 *  are built from: a table written for a test is not a table the portal draws,
 *  whether it is written in a `.test.` file or in `src/test` beside it. */
function components(dir = SRC, prefix = ''): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return entry.name === 'test' ? [] : components(at, name)
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
      /* Not `one.index ?? 0`. A match from `matchAll` carries its index, so the
         fallback is a branch nothing can reach, and were it ever reached it
         would hand the whole file to the check below as what precedes the
         table, where some other screen's box could satisfy it. A test is the
         one place a silent nothing is never the right answer (src/test/at.ts). */
      const at = one.index

      return {
        where: `${path}:${text.slice(0, at).split('\n').length}`,
        tag: one[0],
        before: text.slice(0, at),
      }
    })
  })
}

/** Which file a table is drawn in, without the line it is on. Cut from the last
 *  colon rather than the first, since a path may hold one and a line may not. */
function file(one: { where: string }): string {
  return one.where.slice(0, one.where.lastIndexOf(':'))
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
    expect(all.map(file)).toContain('pages/admin/RightsMatrix.tsx')
  })

  it('sits in a box of its own, so a table too wide scrolls and the page does not', () => {
    /* Said as a sentence rather than as a path. Whoever trips this has almost
       certainly written a perfectly good screen and is owed the rule, not a
       line number to go and look up. */
    const loose = all
      .filter((one) => !CLIPPED.test(one.tag) && !INSIDE_THE_BOX.test(one.before))
      .map((one) => `${one.where} draws a table with no <div className="table-scroll"> around it`)

    expect(loose).toEqual([])
  })

  it('is excused the box only where it is clipped to a pixel and can push nothing', () => {
    const excused = all.filter((one) => CLIPPED.test(one.tag)).map((one) => file(one))

    /* One, and the day a second appears it is worth reading rather than
       counting: a table hidden from the eye is a text alternative, and a table
       hidden because it did not fit is the fault this file is about.

       By file and not by `where`, which carries the line as well. A line number
       in an expectation is a claim about a file this test has no business
       having an opinion on: one import added at the top of the donut moves the
       table from 191 to 192 and turns the suite red over an edit that changed
       nothing here. The line is worth having in the failure above, where it
       says which table has no box, and worth nothing here. */
    expect(excused).toEqual(['components/CategoryDonut.tsx'])
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
    /* Rights.css is the sheet that RightsMatrix.tsx brings with it, and the
       screen around it happens to pull table.css in as well, through Member.css
       and Profile.css, which are there for the entity list and not for the
       matrix.

       Nothing breaks today if that goes: the portal builds one stylesheet with
       no code splitting, so every rule in it is on every screen no matter who
       asked. This is about the source rather than the artefact. A component that
       writes a class its own sheet knows nothing about is a component whose
       styling is somebody else's business to keep, and the day the build splits
       CSS per route, or the day the entity list moves off this screen, the
       matrix would lose its box without a word being said about the matrix. */
    expect(readFileSync(join(SRC, 'pages', 'admin', 'Rights.css'), 'utf-8')).toContain(
      "@import '../../styles/table.css'",
    )
  })
})

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

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

/** Every file under `src` that the portal is built from, the tests left out
 *  along with the helpers they are built from: a table written for a test is not
 *  a table the portal draws, whether it is written in a `.test.` file or in
 *  `src/test` beside it. */
function sources(dir = SRC, prefix = ''): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return entry.name === 'test' ? [] : sources(at, name)
    }

    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')
      ? [{ path: name, code: readFileSync(at, 'utf-8') }]
      : []
  })
}

/** Of those, the ones that draw something. */
function components(): { path: string; code: string }[] {
  return sources().filter((one) => one.path.endsWith('.tsx'))
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

/**
 * What a file asks for by name: `import './Member.css'` in a component,
 * `@import 'Rankings.css'` in a stylesheet. One expression for both, since a
 * component never writes the second and a stylesheet never writes the first.
 *
 * Comments are blanked first. This portal explains its imports at least as often
 * as it writes them, and the note above one of them names the file it is about.
 */
function asks(text: string): string[] {
  return [...bare(text).matchAll(/@?import\s+[\w{},*\s]*(?:from\s+)?(?:url\()?['"][^'"]+\.css[^'"]*['"]/g)].map(
    (one) =>
      /* The name without the quotes around it or the query after it, cut from
         the whole match rather than caught in a group. A group is
         `string | undefined` under `noUncheckedIndexedAccess` (ADL A14), and the
         `?? ''` that would settle it is a branch nothing can reach.

         The forms around the name are wider than what this portal writes today,
         on purpose: `@import url(…)` is plain CSS, `?inline` and `?raw` are
         ordinary Vite, and `import sheet from './x.css'` is ordinary TypeScript.
         Unmatched, each of them would be reported as a component asking for
         nothing, which is a failure saying the opposite of what is true. */
      one[0].slice(one[0].search(/['"]/) + 1, -1).replace(/\?.*$/, ''),
  )
}

/**
 * Every stylesheet a file ends up with: the ones it asks for, and the ones those
 * ask for in turn.
 *
 * Whole paths, so a sheet reached two ways is one entry and a cycle is not a
 * loop. `Profile.css` is both: it asks for `Rankings.css` and for `table.css`,
 * and `Rankings.css` has already brought `table.css` by the time it is asked.
 */
function sheetsOf(at: string, code: string, seen = new Set<string>()): Set<string> {
  for (const name of asks(code)) {
    const sheet = resolve(dirname(at), name)

    if (!seen.has(sheet)) {
      seen.add(sheet)
      sheetsOf(sheet, readFileSync(sheet, 'utf-8'), seen)
    }
  }

  return seen
}

/** The sheet this file is about. */
const TABLE = join(SRC, 'styles', 'table.css')

/**
 * Where one of its names is written and is not a class.
 *
 * The portal has a screen whose route is called `table`, and a route id is a
 * word in a table of routes rather than a name worn by anything
 * (`{ id: 'table', labelKey: 'nav.table', path: 'tabela' }`). Nothing tells the
 * two apart from the outside: both are the same five letters, written whole,
 * inside a string.
 *
 * By path, since the reason is about this one line and not about a shape a
 * second file could have. A list of one that grows is a list worth reading.
 */
const NOT_A_CLASS = ['app/routes.ts']

/** Every class name it defines. */
const defined = new Set(
  [...bare(readFileSync(TABLE, 'utf-8')).matchAll(/\.(-?[_a-z][\w-]*)/gi)].map((one) => one[0].slice(1)),
)

/**
 * Every word a component writes inside a string, which is where a class name is
 * written and where it is safe to look for one.
 *
 * Not a search of the whole file. `table` and `podium` are ordinary words and
 * ordinary names for a variable, and one screen here does write
 * `const table = useMemo(…)`; a check that trips over that is a check somebody
 * turns off. A string is cut at its own quote and at the holes in a template,
 * so `` `length-dot length-dot--${one}` `` gives up the part that is written
 * rather than the part that is computed.
 */
function names(code: string): string[] {
  return [...bare(code).matchAll(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g)].flatMap((one) =>
    one[0].slice(1, -1).split(/[\s${}]+/),
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
    expect(bare(readFileSync(TABLE, 'utf-8'))).toMatch(/\.table-scroll\s*\{[^}]*overflow-x:\s*auto/)
  })

  it('is asked for by every file that writes a name from it', () => {
    /* Nothing breaks today where it is not asked for: the portal builds one
       stylesheet with no code splitting, so every rule in it is on every screen
       no matter who asked. This is about the source rather than the artefact. A
       component that writes a class its own sheet knows nothing about is a
       component whose styling is somebody else's business to keep, and the day
       the build splits CSS per route, or the day one of these screens stops
       drawing whatever else was bringing the sheet along, it would lose those
       rules without a word being said about it.

       Every name the sheet defines, not the box alone. The box was where this
       started, and asking only about the box would have been enough for the
       tables: every component that writes `table` writes `table-scroll` too. It
       is not enough for the sheet, which also holds the five colours of the race
       length dots, and the three screens that draw a dot draw no table at all.

       Every file, not every component. Two of these names are not written in
       any markup: `mine.ts` and `podium.ts` each hold a mark that three or four
       screens draw the same way, and a name handed out by a module is a name
       that module knows and its callers do not.

       It was written for the matrix of moderator rights, which reached the sheet
       through Member.css and Profile.css, there for the entity list beside it
       and not for the matrix. Seven more were found the same way afterwards,
       which is why it is asked of all of them rather than of the one. */
    const wearing = sources()
      .filter((one) => !NOT_A_CLASS.includes(one.path))
      .filter((one) => names(one.code).some((name) => defined.has(name)))

    /* Twenty-seven today, and a floor rather than the number: a screen with a
       table on it is an ordinary thing to add, and this test is not about how
       many there are. */
    expect(wearing.length).toBeGreaterThan(20)

    const borrowed = wearing
      .filter((one) => !sheetsOf(join(SRC, one.path), one.code).has(TABLE))
      .map((one) => {
        /* Each name once. A screen writes `table__points` on every cell of a
           column, and a failure that says so eleven times says it worse. */
        const written = [...new Set(names(one.code).filter((name) => defined.has(name)))]

        return `${one.path} writes ${written.join(', ')}, and no sheet of its own asks for styles/table.css`
      })

    expect(borrowed).toEqual([])
  })
})

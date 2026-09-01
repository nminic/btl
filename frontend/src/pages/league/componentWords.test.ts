import { readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import ts from 'typescript'
import sr from '../../i18n/sr.json'
import { sources } from '../../test/sources'
import held from '../../test/leagueComponentWords.snapshot.json'
import dictionary from '../../test/dictionary.snapshot.json'

/**
 * Every word the components that draw a competition can put on a screen,
 * held as it stands.
 *
 * **Why this is here and not another screen.** The snapshot of the drawn screens
 * (`pages/publicScreens.test.tsx`) holds only the branches its seats happen to take,
 * and three rounds of review each found another branch it did not: a competition with
 * no events, a standing with no rows, a field with nothing written in it, a list with
 * no competitions at all, the cell that counts races while its file is still on the
 * way and again when it never arrives, and the state a competition is edited in. Each
 * was closed by opening one more seat, and the next round found the next branch. That
 * is a class, not a list, and a class is swept once rather than chased.
 *
 * A branch is only reachable by contriving the state it needs — a failing fetch, a
 * press, an empty portal — and each contrivance is machinery inside a guard that is
 * meant to be smaller than the change it guards. Read here instead: a sentence has to
 * be **written in the file** before any branch can draw it, and the file says so
 * whether the branch is ever taken or not.
 *
 * **What is held:** every string the source of these four files contains — literals,
 * template text, and text standing directly in the markup. Comments are not held,
 * because the parser tells them apart from text and a comment draws nothing.
 *
 * **What it costs, said plainly:** adding a class name, a key or a separator to one of
 * these four files fails here until it is written down below. There are twenty-odd of
 * them and they change rarely, which is the whole reason this is affordable.
 */
const FILES = sources()
  .map((one) => one.path.slice(process.cwd().length + 1).split(sep).join('/'))
  .filter((path) => path.endsWith('.tsx') && /league/i.test(path.split('/').at(-1) ?? ''))
  .sort()

function wordsIn(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(join(process.cwd(), path), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      found.push(node.text)
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      found.push(node.text)
    } else if (ts.isJsxText(node)) {
      found.push(node.text)
    }

    ts.forEachChild(node, walk)
  }

  walk(source)

  return [...new Set(found.map((one) => one.trim()).filter((one) => one !== ''))].sort()
}

/**
 * Every word the dictionary is asked for from a competition screen, held as it stands.
 *
 * **Why computed and not chosen.** Four rounds of review in a row found the same thing:
 * a key drawn on one of these screens that no held branch covered. `rankings`, then
 * `pager.leagueStanding`, then `data.error` — each was closed by adding the branch it
 * happened to be in, and the next round found the next branch. Choosing branches is
 * guessing, and the guess was wrong four times.
 *
 * So the set is not chosen. Every file a competition screen reaches is followed through
 * its imports, every key those files ask `t` for is collected, and the words behind those
 * keys are held. A key that reaches one of these screens cannot be outside it, because
 * reaching the screen is what puts it in.
 *
 * A key built out of pieces at run time is not seen here, and neither is one asked for
 * with anything but a literal; those are held instead by the screens themselves, which
 * draw whatever the pieces come to.
 */
describe('the words the competition screens are written with', () => {
  it('says nothing a competition could be ranked by, in any branch drawn or not', () => {
    const kept: Record<string, unknown> = held

    for (const path of FILES) {
      expect(wordsIn(path), path).toEqual(kept[path])
    }

    /* **The list of files is found, not written down.** Written out beside a written
       snapshot, the two only agreed with each other: `LeagueResults.tsx` taken out of both
       left the standing of a competition drawn by a component no guard reads, and the
       whole gate stayed green (review, 01.09.2026). It is now every component of the
       portal named after a competition, so a new one joins the moment it is written.

       **It does not claim more than that.** A guard cannot hold against being edited
       away, and narrowing the name this line looks for drops files without naming any of
       them: `/league/i` written as `/leagues/i` quietly stops reading both the page of a
       competition and its standing (review, 01.09.2026). What is bought here is the one
       direction that matters for a portal still being written — a component added
       tomorrow is read without anybody remembering to add it. */
    expect(FILES.length, 'the portal still draws a competition').toBeGreaterThan(0)
    expect(Object.keys(kept).sort()).toEqual([...FILES].sort())
  })

  it('says nothing a competition could be ranked by, through any word it knows', () => {
    /* **The whole dictionary, held as it stands.**

       Five rounds of review each found the same shape: a word the portal says that the
       guard did not hold. First a branch nobody had chosen (`rankings`, then `pager`,
       then `data`); then a frame that draws around a screen and so is never imported by
       it (the shell, then the administration's own navigation); then a key that lives as
       **data** rather than as a call — `labelKey` and `hintKey` in the form definitions,
       `headingKey` in the rights, and the title of an editor, which is built as
       `admin.form.edit.${entity.id}` and cannot be read off a call site at all. Ninety-
       seven of the hundred and seventeen keys the forms declare were outside the set
       (review, 01.09.2026).

       Every one of those was closed by collecting a little more, and the next round found
       what the collecting still missed. Collecting is the mistake. What the portal can
       say is not a set to be computed; it is a file, and the file is held.

       **What it costs, said plainly:** changing any sentence in the portal is a change in
       two files. That is the whole cost, it is paid at the moment of writing, and it buys
       the end of the question. */
    expect(sr).toEqual(dictionary)
  })
})

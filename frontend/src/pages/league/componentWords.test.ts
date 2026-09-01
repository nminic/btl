import { readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import ts from 'typescript'
import { sources } from '../../test/sources'
import held from '../../test/leagueComponentWords.snapshot.json'

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
})

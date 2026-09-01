import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import held from '../../test/leagueComponentWords.snapshot.json'

/**
 * Every word the four components that draw a competition can put on a screen,
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
const FILES = [
  'src/pages/Leagues.tsx',
  'src/pages/LeagueDetail.tsx',
  'src/pages/league/LeagueResults.tsx',
  'src/pages/admin/AdminLeagues.tsx',
] as const

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

    /* And no file has been added to the held list that this case never reads, nor
       removed from it while it still draws a competition. */
    expect(Object.keys(kept).sort()).toEqual([...FILES].sort())
  })
})

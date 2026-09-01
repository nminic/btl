import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import ts from 'typescript'
import sr from '../../i18n/sr.json'
import { sources } from '../../test/sources'
import held from '../../test/leagueComponentWords.snapshot.json'
import spoken from '../../test/leagueSpokenKeys.snapshot.json'

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
/**
 * The one place that says what the portal draws.
 *
 * Walking imports downward from the four screens misses everything drawn **around**
 * them, because a frame takes the screen as a child and never imports it. Two frames
 * were found that way, one per round: the shell, whose words to a signed-in member and
 * whose message when a screen throws went past everything; and the administration's
 * own navigation, whose alarm when a queue cannot be counted is drawn on the screen a
 * competition is edited on (reviews, 01.09.2026).
 *
 * Both were closed by writing the frame's name down, and the second review said the
 * true thing about the first fix: a written list agrees only with itself, in the very
 * file whose other list is found rather than written.
 *
 * So there is no list of frames. The route table is the root, because it is where the
 * portal says what is drawn and what is drawn around it, and every word reachable from
 * it is held. There is no frame left to forget, and no branch left to guess.
 *
 * **What it costs, said plainly:** every sentence the portal can say is held here, so
 * changing any of them is a change in two files. That is the price of never having to
 * ask again which screen reaches which word.
 */
const ROOT = 'src/app/routeObjects.tsx'

function keysReached(): string[] {
  const seen = new Set<string>()
  const keys = new Set<string>()

  const found = (from: string, spec: string): string | null => {
    if (!spec.startsWith('.')) {
      return null
    }

    const base = resolve(dirname(from), spec)

    return (
      ['.tsx', '.ts', '/index.tsx', '/index.ts']
        .map((ending) => base + ending)
        .find((path) => existsSync(path)) ?? null
    )
  }

  const visit = (path: string): void => {
    if (seen.has(path)) {
      return
    }

    seen.add(path)

    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )

    const asked = (node: ts.Node): void => {
      if (ts.isStringLiteral(node)) {
        keys.add(node.text)
      } else if (ts.isConditionalExpression(node)) {
        asked(node.whenTrue)
        asked(node.whenFalse)
      }
    }

    const walk = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 't' &&
        node.arguments[0] !== undefined
      ) {
        asked(node.arguments[0])
      }

      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const next = found(path, node.moduleSpecifier.text)

        if (next !== null && next.startsWith(join(process.cwd(), 'src'))) {
          visit(next)
        }
      }

      ts.forEachChild(node, walk)
    }

    walk(source)
  }

  visit(join(process.cwd(), ROOT))

  return [...keys].sort()
}

/** Whether a step down the dictionary can be stepped into. */
function branching(step: unknown): step is Record<string, unknown> {
  return step !== null && typeof step === 'object'
}

/**
 * Whatever a key names: a sentence, a set of them counted by number, or nothing.
 *
 * The count is kept whole rather than dropped. Asked only for sentences, this let
 * every plural key out silently — four of them today, all from the counter under the
 * two long boxes of a competition's own form — and a plural key added tomorrow would
 * have entered the dictionary with no guard and no sign, while a plain one would have
 * failed (review, 01.09.2026).
 */
function saidBy(key: string): unknown {
  let step: unknown = sr

  for (const part of key.split('.')) {
    step = branching(step) && part in step ? step[part] : null
  }

  return step
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

  it('says nothing a competition could be ranked by, through any key the portal asks for', () => {
    const words: Record<string, unknown> = spoken
    const asked = keysReached()

    expect(asked.length, 'the portal still asks the dictionary for something').toBeGreaterThan(0)

    /* Every key, and whatever it names. Nothing is dropped on the way: a key that names
       a set counted by number is held as that set, and a key that names nothing at all
       is held as nothing, so it fails the day it starts naming a sentence. */
    for (const key of asked) {
      expect(saidBy(key), key).toEqual(words[key])
    }

    /* And no key has appeared that the held list does not know, nor left it while a
       competition screen still asks for it. */
    expect(asked).toEqual(Object.keys(words).sort())
  })
})

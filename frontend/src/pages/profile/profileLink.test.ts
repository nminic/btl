import { dirname, relative, resolve, sep } from 'node:path'
import ts from 'typescript'
import { inside, sources, WHOLE_PORTAL } from '../../test/sources'

/**
 * Only four modules reach the maker of a profile's address.
 *
 * **Why this is a floor and not a preference.** Whether a name may be a link is the same question
 * the profile page asks to decide whether to draw itself at all (`profile/visible.ts`), and it now
 * has two reasons: a member whose fee has run out, and a member hiding from a reader who is not
 * signed in (P23, 06.09.2026). Nine screens draw a competitor and eight of them may link one. Ask
 * that question at each of them and it is eight places to forget it, which is what happened to the
 * first reason: `components/CompetitorName.tsx` was written on 05.09.2026 precisely because „the
 * rule was being kept on two screens out of eight and there was nothing to say which".
 *
 * So the address itself is built in one module, and everything else asks for a link and is handed
 * one or nothing (`profile/useProfileLink.ts`, `profile/ProfileLink.tsx`).
 *
 * **This is the fourth form of this question, and the first that cannot be spelt around.** The
 * three before it each read the source and each missed one way of writing the same import, one per
 * round of review:
 *
 * 1. a regular expression over the text, blind to double quotes;
 * 2. the parser, but only `ImportDeclaration`, blind to `export { … } from` and to `import(…)`;
 * 3. the specifier anchored at its end, blind to `'./profileAddress.ts'`, which
 *    `tsconfig.app.json` explicitly allows (`allowImportingTsExtensions`).
 *
 * **A guard that has been wrong three times about how something is written must stop reading how
 * it is written.** What is asked instead is what the compiler itself answers: `ts.preProcessFile`
 * hands back every module a file refers to, by any of those forms, and each one is then **resolved
 * to a path** rather than compared as text, so the extension, the quoting and the number of dots
 * stop mattering. Two files reach the same module exactly when they resolve to the same file, and
 * that is the whole of the question.
 *
 * **And nothing may pass the maker along**, which is the second case below. A module on the list
 * could re-export what it imports (`export { profilePath } from '…'`), and a screen reaching for it
 * *there* resolves to that module rather than to this one, so the first case would answer as
 * though nothing had happened. A review measured exactly that. The portal writes no such
 * re-export anywhere, so the cheapest complete answer is to refuse the form outright rather than to
 * follow it: the day one is wanted, it fails here and asks the question once.
 *
 * **What this floor deliberately does not hold, written down rather than left to be found.** An
 * address spelt out by hand reaches no module at all, so nothing here sees it. A guard over that
 * was tried and removed in the same round: „is this string an address" cannot be answered from one
 * expression, because the pieces can be glued together in any number of ways — a review wrote
 * `` `/${locale}/takmicar` + `/${number}` `` and walked past a pattern that had just been written
 * to catch exactly that. What holds that case is behaviour and not text
 * (`pages/profilePrivacy.test.tsx`, which hides two members and then reads five screens), and the
 * limit of **that** is its five screens. A sixth screen that spells an address out by hand is
 * caught by neither, and that is the boundary of this pair, recorded in `btl-produkt/PDL.md`.
 *
 * What is named is the four modules that reach it, each with the reason it may:
 *
 * - `profile/useProfileLink.ts` is the one place that turns „may this reader reach this profile"
 *   into an address, and it hands the address out without handing out the turning.
 * - `profile/ProfileHead.tsx` builds the tabs **inside** an open profile, which is not a link from
 *   elsewhere: a reader who is on the page has already been let in, and the tabs are the same
 *   address with a part hung off it.
 * - `pages/CompetitorProfile.tsx` and `pages/CompetitorAwards.tsx` are those two pages. They read
 *   the member number out of the address they were opened at and send the reader to the canonical
 *   spelling of it, which they do **after** the rule has said the profile may be seen at all; a
 *   redirect that ran first would answer „is there such a member" for a reader who is not allowed
 *   to ask.
 *
 * Cases are outside this altogether, because `sources()` is the production tree and nothing else:
 * a case that spells an address out is saying what it expects to find on a screen, which is the
 * opposite of a screen deciding one for itself.
 */
const MAY = [
  `profile${sep}useProfileLink.ts`,
  `profile${sep}ProfileHead.tsx`,
  `pages${sep}CompetitorProfile.tsx`,
  `pages${sep}CompetitorAwards.tsx`,
]

/** The module in question, as a path with no extension on it. */
const MAKER = resolve(process.cwd(), inside('src', 'pages', 'profileAddress'))

/** A path with whichever of the four endings it carries taken off, so that
 *  `./profileAddress`, `./profileAddress.ts` and `./profileAddress.js` are one answer. */
const bare = (path: string) => path.replace(/\.(ts|tsx|js|jsx)$/, '')

/**
 * Whether a file reaches the maker of the address, by any spelling.
 *
 * `ts.preProcessFile` is the compiler's own answer to „what does this file refer to": it returns
 * the specifier of every `import`, every `export … from`, every `import(…)` and every `require(…)`
 * alike. Each is then resolved against the file it was written in, which is what the bundler does,
 * so a relative path with an extension and one without are the same answer.
 *
 * A specifier that does not begin with a dot is a package, and no package on this portal is this
 * module.
 */
function reaches(path: string, code: string): boolean {
  return ts
    .preProcessFile(code, true, true)
    .importedFiles.map((one) => one.fileName)
    .filter((one) => one.startsWith('.'))
    .some((one) => bare(resolve(dirname(path), one)) === MAKER)
}

describe('the address of a profile', () => {
  it('is reached from four modules, and every screen asks for a link instead', () => {
    const swept = sources()

    /* The floor of the floor: an answer of „nobody" is right and is also what a walk over
       nothing gives. */
    expect(swept.length, 'the portal is still here').toBeGreaterThan(WHOLE_PORTAL)

    const reaching = swept
      .filter(({ path, code }) => reaches(path, code))
      .map(({ path }) => path)
      .filter((path) => bare(path) !== MAKER)
      .map((path) => relative(process.cwd(), path).split(sep).slice(-2).join(sep))
      .sort()

    expect(reaching).toEqual([...MAY].sort())
  })

  it('is not passed along, because nothing in the portal passes anything along', () => {
    /* One module re-exporting another is a second name for the same thing, and the case above
       answers about the name a file writes rather than about what stands behind it. Rather than
       follow the chain, the form is refused: the portal has never written one, so this costs
       nothing today and closes the way in for good.

       Asked of the parser and not of the text, for the reason the whole file exists: `export … from`
       can be written with either quote, with a type modifier, with a namespace or with a list, and
       the parser tells them apart from an ordinary export without being told how they are spelt. */
    const passing = sources()
      .filter(({ path, code }) => {
        const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        let found = false
        const walk = (node: ts.Node): void => {
          if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
            found = true
          }

          ts.forEachChild(node, walk)
        }

        walk(source)

        return found
      })
      .map(({ path }) => relative(process.cwd(), path).split(sep).slice(-2).join(sep))

    expect(passing, 'a module now hands on what it imports').toEqual([])
  })
})

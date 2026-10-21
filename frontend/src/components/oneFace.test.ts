import ts from 'typescript'
import { join, relative, sep } from 'node:path'
import { sources, WHOLE_PORTAL } from '../test/sources'

/**
 * THE CIRCLE OF A MEMBER HAS ONE HOME, and this is what holds it there.
 *
 * Owner, 26.09.2026 (PDL P28f): an approved photograph „tog trenutka pocinje da se vidi na
 * svim avatar mestima (u rang listama, profilnoj sekciji, gornjem desnom zaglavlju ulogovanog
 * korisnika itd.)", and „Mozda ovo nisu jedina mesta, ja sam nabrojao ono sto sam znao.
 * Proveri dobro gde sve treba da zavrsi."
 *
 * **A sentence like that is deliverable only if there is one place to teach.** Taught to one
 * component the picture arrives everywhere at once; taught to five it arrives on the three
 * somebody remembered, and the owner finds the other two on QA - which is exactly what
 * happened, and is why P28f exists at all.
 *
 * **WHY THIS ASKS THE IMPORT GRAPH AND NOT A CLASS NAME, which is the whole of the lesson.**
 * On 27.09.2026 the branch that taught `Portrait` the photograph was started on a measurement
 * that said the circle already had one home. The measurement was
 * `grep -rn "face-circle" src --include=*.tsx`, and it answered with two files. It was
 * **right about the class and wrong about the circle**: `pages/Competitors.tsx` drew a 7,5rem
 * disc of a member's own colour with his initials in it and called it `card__face`, and
 * `app/AccountMenu.tsx` drew a 1,7rem one and called it `account__monogram` - the second of
 * them being the place the owner had named BY NAME. A sweep for a class cannot see a screen
 * that does not wear the class, and the two screens that mattered were exactly those.
 *
 * P28f had already written down that one trace is never enough: „Cetiri traga daju cetiri
 * razlicita skupa, pa nijedan sam nije dovoljan: po komponenti 5 fajlova, po monogramu 5, po
 * CSS klasi `face-circle` 6, po `hueFor` 4."
 *
 * **So the questions below are the traces that DID find them**, asked of the module graph
 * rather than of any text:
 *
 * - who reaches the module that makes the letters of a circle with no person behind it
 *   (`app/monogram.ts`), and
 * - whether the header reaches `Portrait`.
 *
 * **The third trace of P28f, who reaches the module that makes a COLOUR (`pages/competitorFace.ts`),
 * is gone with the module** (owner, 21.10.2026, PDL: „Inicijali tima postaju jednobojni, kao
 * kartice članova"). It had two readers until the member's circle lost its colour on 21.10.2026
 * (PENDING 29205) and one, the team mark, until the same day; a graph of a module that does not
 * exist answers „nothing reaches it" in the words of a portal with one home, so the question moved
 * to what a colour IS on a screen: an element that sets `--face-hue`. That is asked of the rendered
 * competitors and teams screens, ancestors of a circle included (`pages/publicScreens.test.tsx`,
 * „sets no hue on any element"), and of every stylesheet (`styles/circle.test.ts`).
 *
 * Every `import`, `export … from`, `import(…)` and `require(…)` is read off the parser rather
 * than off the text (`ts.preProcessFile`), and each specifier is resolved the way the bundler
 * resolves it, so `'./monogram'`, `"./monogram.ts"` and
 * `'../app/monogram'` are one answer and not three. Four drafts of one guard were
 * lost to those spellings on 07.09.2026 (PDL, and `pages/member/oneQuestion.test.tsx` is the
 * precedent this copies whole).
 *
 * **WHAT THIS DOES NOT HOLD, written here rather than left for a review to find.** A screen
 * that drew its own circle without either module - a colour written out as `hsl(210 45% 32%)`
 * and two letters sliced on the spot - would reach neither of them and would pass. That is a
 * real boundary and not a hole this could be widened to cover: the alternative is a list of
 * every round rule in every stylesheet, and there are thirteen of them today, most about
 * loaders, coins, counters and dots. Six times over this portal has measured that a guard
 * which has to enumerate never converges, and each round of it costs a review. What closes
 * this boundary instead is the review question the two cases below put in front of a reader:
 * a new screen with a face on it either reaches `Portrait` or it fails one of these.
 */

/** Where the portal's own modules live, so one can be named by its place under it. */
const SRC = join(process.cwd(), 'src')

/** A module by its place under `src`, spelt the one way on either platform. */
function named(path: string): string {
  return relative(SRC, path).split(sep).join('/')
}

/**
 * Enough of the project's own settings for a specifier to be resolved the way the bundler
 * resolves it.
 *
 * `allowImportingTsExtensions` is not decoration: `tsconfig.app.json` turns it on, so
 * `'./monogram.ts'` is a spelling somebody may write tomorrow, and a reader that does
 * not know it would answer „nothing reaches this module".
 */
const AS_THE_BUNDLER_DOES: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
}

/**
 * Every module of the portal that reaches the given one, and how many were read.
 *
 * The count comes back with the answer and is asserted beside it, because a sweep narrowed by
 * accident answers „nothing reaches it" in exactly the words of a portal with one home.
 */
function modulesReaching(wanted: string): { walked: number; reaching: string[] } {
  let walked = 0

  const reaching = sources().flatMap((one) => {
    const reaches = ts.preProcessFile(one.code, true, true).importedFiles.some((ref) => {
      const { resolvedModule } = ts.resolveModuleName(
        ref.fileName,
        one.path,
        AS_THE_BUNDLER_DOES,
        ts.sys,
      )

      return resolvedModule !== undefined && named(resolvedModule.resolvedFileName) === wanted
    })

    /* Counted after the file has been read rather than before, so this says what was parsed
       and not what was offered. */
    walked += 1

    return reaches ? [named(one.path)] : []
  })

  return { walked, reaching: reaching.sort() }
}

describe('the circle a member is drawn in', () => {
  it('takes its letters from a member’s own record, so only an account asks for a monogram', () => {
    /* The other trace, and the one that found the header. `app/monogram.ts` answers the last
       two characters of whatever identifies somebody, which is what a circle holds when there
       is NO person behind it: administration has no competitor record (PDL P21), nor has
       anybody who registered and is not a member yet (ADL A44), nor has a member for the
       moment before his own record arrives.

       One module may ask, `app/AccountMenu.tsx`, and it asks only in the arm where there is no
       member (the file names that boundary and why). A member's letters come off his record
       inside `Portrait` and from nowhere else.

       **It took a `Competitor` and answered initials until 27.09.2026**, which made it the
       second home of those two letters; `pages/Competitors.tsx` reached it for exactly that.
       The branch is gone rather than left standing, because a branch no screen can reach while
       a unit test calls it directly is the one shape a coverage threshold reports as
       healthy. */
    const { walked, reaching } = modulesReaching('app/monogram.ts')

    expect(walked).toBeGreaterThan(WHOLE_PORTAL)
    expect(reaching, 'a screen has begun to draw a monogram of its own').toEqual([
      'app/AccountMenu.tsx',
    ])
  })

  it('is drawn by the header through Portrait, and not by a circle the header keeps for itself', () => {
    /* THE TWO TRACES ABOVE BOTH STAYED GREEN THROUGH THE VERY REGRESSION THAT MOTIVATED THEM,
       and that is the finding this case closes rather than a second telling of it.

       Reverting `app/AccountMenu.tsx` alone leaves it the sole reacher of `app/monogram.ts`
       either way, because the account arm above needs that module whether the member arm
       beside it draws through `Portrait` or draws its own circle again, and a plain monogram
       with no colour of its own needs nothing else. The list does not move, so the case
       does not notice - a member with an
       approved photograph would have gone back to seeing his own initials in the header and
       the case above would still read exactly as it does here.

       So this asks the one question that does move: whether the header's own module reaches
       `Portrait` at all. It is a question about REACH rather than about a class name or a
       kept branch, so unlike a sweep for text there is no spelling it can be incomplete in
       (`ts.preProcessFile` and module resolution read every `import`, `export … from`,
       `import(…)` and `require(…)` alike, exactly as the case above already relies on). */
    const { walked, reaching } = modulesReaching('components/Portrait.tsx')

    expect(walked).toBeGreaterThan(WHOLE_PORTAL)
    expect(reaching, 'the header no longer reaches the one place a member’s circle is drawn').toContain(
      'app/AccountMenu.tsx',
    )
  })
})

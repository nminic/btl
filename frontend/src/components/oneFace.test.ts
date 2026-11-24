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
 *
 * **THE BOUNDARY OF THE LAST CASE, written here the way the one above is (review of PR 809, low 2).** It asks which
 * modules reach the arithmetic of the cut (`components/fitted.ts`), and that is all it asks. A screen that cut a
 * picture with arithmetic of its own, an `object-position` and a `transform` written out, would reach no module and
 * would pass, exactly as a circle with a colour written out passes the questions above. What the pixels of the two
 * kinds of circle show is held by Chrome (`geometry/memberPicture.geometry.ts`), and that every circle that is
 * drawn goes through `CutPicture` at all is a review question and not one this file can ask.
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

/**
 * Everything a module hands to whoever imports it, as the compiler counts it: a name it declares, one it
 * re-exports under the same or another name, `export *`, a type. Asked of the checker and not of the text,
 * for the reason the case above gives of `ts.preProcessFile`: the ways of writing a re-export are not a
 * list a guard can finish.
 */
function exportedBy(wanted: string): string[] {
  const at = join(SRC, wanted).split(sep).join('/')
  const program = ts.createProgram([at], {
    ...AS_THE_BUNDLER_DOES,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    noEmit: true,
    skipLibCheck: true,
  })
  const file = program.getSourceFile(at)
  const checker = program.getTypeChecker()
  const module = file === undefined ? undefined : checker.getSymbolAtLocation(file)

  if (module === undefined) {
    throw new Error(`the compiler found no module at ${wanted}`)
  }

  return checker
    .getExportsOfModule(module)
    .map((one) => one.name)
    .sort()
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
  it('has the arithmetic of the cut reached by one component only, which is not the same as no circle cutting it another way', () => {
    /* Owner, 23.11.2026: „Zašto se drugačije seče i prikazuje u malom i velikom krugu?????" and
       „Veliki krug je rezprezentativan, tako treba da bude svuda." The profile drew the original
       and cut it in a box of its own, which was not square, and so cut a different part of the
       picture from the card beside it. The cut now has one home (`components/CutPicture.tsx`),
       and this asks the question that keeps it one: which modules REACH the arithmetic of the
       cut. A screen that imports `fittedTo` again, under any name and in any form of import,
       is drawing a picture of its own around it, and is caught here rather than on the screen
       nobody looks at. What the pixels show is measured in Chrome, on both kinds of circle
       (`geometry/memberPicture.geometry.ts`). */
    const { walked, reaching } = modulesReaching('components/fitted.ts')
    expect(walked).toBeGreaterThan(WHOLE_PORTAL)
    expect(reaching, 'a module cuts a picture without CutPicture').toEqual(['components/CutPicture.tsx'])
  })
})

describe('the control a circle is moved with', () => {
  it('is one, CropChooser, so no module draws the window or the sliders of a circle around it', () => {
    /* Owner, 24.11.2026 (PDL „Podešavanje kruga na slici radi identično na svakom mestu portala"): „Zelim da
       ovo za sliku radi identično kao za bilo koje prilagođavanje kruga na slici na portalu (unos članske,
       znaka tima i sl.)". Identical by construction is one control: the drag, the cap on the height, the
       sliders and the keyboard are `CropWindow` and `CropSliders`, and only `CropChooser` may put them
       together. The moderator's card of a waiting picture did, from 23.11.2026, until this decision; a screen
       that reaches either part again, under any spelling of the import, is a second control and is caught
       here. The next place, a team's logo, has to go through `CropChooser` or fail this.

       WHAT THIS DOES NOT HOLD: a screen that drew a circle over a picture with code of its own, reaching
       neither module, would pass, as a circle with arithmetic of its own passes the case above. That every
       circle a person moves is moved through `CropChooser` at all is a review question. What the four screens
       do alike is measured in Chrome only as far as `geometry/adminCircle.geometry.ts` asks (`behavesTheSame`):
       the cap on the height, three sliders on the page, the arrow keys, a drag from the middle and no sideways
       page. Not asked: whether the sliders stand open or fold away, the cursor, a drag from the rim and a
       touch; a rule written for one screen alone that changes one of those passes both files (measured,
       PENDING, review of PR 815). */
    for (const part of ['components/CropWindow.tsx', 'components/CropSliders.tsx']) {
      const { walked, reaching } = modulesReaching(part)

      expect(walked).toBeGreaterThan(WHOLE_PORTAL)
      expect(reaching, `a module puts ${part} together without CropChooser`).toEqual(['components/CropChooser.tsx'])
    }
  })


  it('is handed out whole by CropChooser, which does not hand out its two parts for a screen to put together again', () => {
    /* THE SECOND DOOR TO THE SAME PARTS (PENDING, review of PR 815): the case above asks who IMPORTS `CropWindow`
       and `CropSliders`, and a line `export { CropSliders } from './CropSliders'` in `CropChooser` is the one
       importer that is allowed, so every screen could then take the sliders from it and the case above would
       stay green. Asked of what the module exports, as the compiler counts it, so `export *` and a renamed
       re-export are the same answer as the plain one. */
    const handed = exportedBy('components/CropChooser.tsx')

    expect(handed, 'the module hands nothing out, so there is nothing to ask of it').toContain('CropChooser')
    expect(handed, 'CropChooser hands out a part of the control').not.toContain('CropWindow')
    expect(handed, 'CropChooser hands out a part of the control').not.toContain('CropSliders')
  })
})

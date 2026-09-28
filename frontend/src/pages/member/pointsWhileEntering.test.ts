import ts from 'typescript'
import { join, relative, sep } from 'node:path'
import sr from '../../i18n/sr.json'
import { bare, sources, WHOLE_PORTAL } from '../../test/sources'

/**
 * A SCREEN THAT SENDS A RESULT IN SAYS NOTHING ABOUT WHAT IT IS WORTH.
 *
 * Owner, 28.09.2026, asked about the timed race alone and answering over both kinds:
 * „bodovi ni na dužinskoj ni na vremenskoj trci ne ulaze u obračun pre verifikacije. Ne
 * vidim razlog da se ispisuju bilo kome prilikom unosa parametara prijave rezultata. Ako
 * ga zanima koliko će bodova dobiti, neka se igra kalkulatorom na naslovnoj strani
 * portala."
 *
 * **What the number was, when it was still drawn.** It was the browser's own arithmetic,
 * and on a timed race the browser and the server disagree by construction: the server takes
 * the time off the RACE („jer je zadato trkom", owner 29.08.2026) while the form for
 * correcting a counted result leaves the three boxes open. On a six hour limit over 50 km
 * with 1000 up and 1000 down, five hours typed works out to 41,19 against the 27,90 the
 * server stores, which is 48 per cent high. That measurement is what the owner was shown
 * before he answered, and he answered wider than it: no number on either kind of race.
 *
 * **WHY THIS IS A PROPERTY AND NOT TWO SCREENS NAMED.** Each road has its own case
 * (`event/reportResult.test.tsx`, `memberFlows.test.tsx`), and each of those asks a rendered
 * screen for two sentences it knows the names of. A third road written tomorrow would pass
 * both by never being rendered by either. So this asks the question of the portal rather
 * than of a screen, and both of its halves are derived:
 *
 * - **who sends a result in** is read off the import graph, never off a list of screens;
 * - **what counts as writing a figure** is read off the dictionary and off the import graph,
 *   never off a list of sentences.
 *
 * **WHERE IT CANNOT SEE, written here rather than left for a review to find.** A screen that
 * formatted the figure itself - `formatNumber(points, locale, 2)` under a sentence that never
 * says „BTL poena" - reaches neither half and would pass. That is a real boundary and not a
 * hole to widen: the alternative is to follow a value through the code, which this portal has
 * measured six times over as a question with no floor (`i18n/valueInSentence.test.ts` carries
 * the whole of that lesson). What closes it instead is that the two ways of writing a figure
 * a reader would recognise as points - the portal's own formatter, and the portal's own word
 * for them - are both held here.
 */

/** Where the portal's own modules live, so one can be named by its place under it. */
const SRC = join(process.cwd(), 'src')

/** The module every road a result travels goes through. */
const WRITES_LIVE_IN = 'pages/member/resultWrites.ts'

/** Where the portal writes a number of BTL points. */
const FORMATTER_LIVES_IN = 'i18n/format.ts'

/**
 * The two of that module's exports that SEND A RESULT, as against the one that takes one
 * back and the addresses and the refusals beside them.
 *
 * Written out rather than derived, because „does this export write a submission" is a
 * question about what a function does and no tool answers it. Its floor is a case of its
 * own below: both names have to still be exports of that module, so a rename there fails
 * loudly instead of quietly emptying the set this whole file stands on.
 */
const SENDS = ['theCorrectionWasSentIn', 'theRunWasSentIn']

/**
 * Enough of the project's own settings for a specifier to be resolved the way the bundler
 * resolves it. `allowImportingTsExtensions` is not decoration: `tsconfig.app.json` turns it
 * on, so `'./resultWrites.ts'` is a spelling somebody may write tomorrow, and a reader that
 * did not know it would answer „nothing reaches this module" (PDL, 07.09.2026, where four
 * drafts of one guard were lost to exactly these spellings).
 */
const AS_THE_BUNDLER_DOES: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
}

/** A module by its place under `src`, spelt the one way on either platform. */
function named(path: string): string {
  return relative(SRC, path).split(sep).join('/')
}

function parsed(path: string, code: string): ts.SourceFile {
  return ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)
}

/**
 * Which of a module's OWN EXPORTED NAMES another file takes out of it.
 *
 * The exported name and never the local one, so `import { theRunWasSentIn as send }` is the
 * same answer as the plain spelling. The specifier is resolved rather than compared, for the
 * reason given above.
 */
function namesTakenFrom(code: string, path: string, wanted: string): string[] {
  return parsed(path, code).statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      return []
    }

    const { resolvedModule } = ts.resolveModuleName(
      statement.moduleSpecifier.text,
      path,
      AS_THE_BUNDLER_DOES,
      ts.sys,
    )

    if (resolvedModule === undefined || named(resolvedModule.resolvedFileName) !== wanted) {
      return []
    }

    const clause = statement.importClause?.namedBindings

    return clause !== undefined && ts.isNamedImports(clause)
      ? clause.elements.map((one) => (one.propertyName ?? one.name).text)
      : []
  })
}

/** Every function a module exports, read off the module itself. */
function functionsExportedBy(code: string, path: string): string[] {
  return parsed(path, code)
    .statements.flatMap((statement) =>
      ts.isFunctionDeclaration(statement) && statement.name !== undefined ? [statement] : [],
    )
    .flatMap((one) =>
      ts.getModifiers(one)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ===
      true
        ? [one.name?.text ?? '']
        : [],
    )
    .sort()
}

/**
 * The portal's own word for a number of BTL points, taken out of the sentence that exists to
 * write one rather than typed in here.
 *
 * `units.btlPoints` is „{value} BTL poena", so what is left when the value is taken out is
 * the two words a reader recognises. Read this way, a rename of the unit carries the needle
 * with it, instead of leaving a guard hunting for a word the portal has stopped using.
 */
const THE_WORD = sr.units.btlPoints.replaceAll(/\{[^}]*\}/g, '').trim()

/** Every key of the dictionary whose Serbian sentence names BTL points. */
function keysNamingPoints(): string[] {
  const walk = (value: unknown, path: string): string[] => {
    if (typeof value === 'string') {
      return value.includes(THE_WORD) ? [path] : []
    }

    return typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([key, under]) =>
          walk(under, path === '' ? key : `${path}.${key}`),
        )
      : []
  }

  return walk(sr, '').sort()
}

/** Every module of the portal, sorted into the two answers that matter. */
function sweep(): { walked: number; sending: string[]; writingAFigure: string[] } {
  const keys = keysNamingPoints()
  const sending: string[] = []
  const writingAFigure: string[] = []
  const walked = sources()

  for (const one of walked) {
    const where = named(one.path)

    if (namesTakenFrom(one.code, one.path, WRITES_LIVE_IN).some((name) => SENDS.includes(name))) {
      sending.push(where)
    }

    /* Two ways of putting a figure on a page, and a module doing either is one that writes
       one. The code is read with its comments blanked (`test/sources.ts`), so the notes this
       change left behind - each of which names the sentence it removed - are not taken for
       the sentence being asked for again. */
    const written = bare(one.code)
    const formats = namesTakenFrom(one.code, one.path, FORMATTER_LIVES_IN).includes('formatPoints')

    if (formats || keys.some((key) => written.includes(`'${key}'`))) {
      writingAFigure.push(where)
    }
  }

  return {
    walked: walked.length,
    sending: sending.sort(),
    writingAFigure: writingAFigure.sort(),
  }
}

describe('what a result is worth, while it is being entered', () => {
  it('is written by no screen that sends one in', () => {
    const { walked, sending, writingAFigure } = sweep()

    /* The floor under everything below: a sweep narrowed by accident answers „no screen
       writes a figure" in exactly the words of a portal that obeys the owner. */
    expect(walked, 'the sweep read fewer files than the portal has').toBeGreaterThan(WHOLE_PORTAL)

    /* And the other half of the floor. Both sets have to hold something, and the second has
       to hold the screen that really does announce a number before anybody has decided: a
       reading that found nothing anywhere would pass the line that matters while measuring
       nothing at all. */
    expect(sending, 'no module sends a result in, so the graph was not read').not.toEqual([])
    expect(writingAFigure, 'no module writes a figure, so neither reading is looking').toContain(
      'pages/member/MyResults.tsx',
    )

    expect(
      sending.filter((one) => writingAFigure.includes(one)),
      'a screen that sends a result in has begun to write what it is worth',
    ).toEqual([])
  })

  it('is asked of both roads, and there are two of them', () => {
    /* Named here and nowhere else in this file, so the claim above stays a property while
       this one says what that property was measured over. Either road leaving the graph - a
       specifier spelt in a way the resolver does not follow, a screen that stopped importing
       the writer - empties the set silently, and the claim above then holds over nothing. */
    expect(sweep().sending).toEqual(['pages/event/ReportResult.tsx', 'pages/member/NewResult.tsx'])
  })

  it('stands on two exports that the writer really has', () => {
    /* `SENDS` is the one thing here written out of somebody's head. If either name is renamed
       and this is not, the sweep above quietly answers „nothing sends a result in"; the case
       before this one is what would fail, and this one says why. */
    const writer = sources().find((one) => named(one.path) === WRITES_LIVE_IN)

    expect(writer, `${WRITES_LIVE_IN} was not read at all`).toBeDefined()
    expect(
      functionsExportedBy(writer?.code ?? '', WRITES_LIVE_IN),
      'the writer exports neither of the two names this file stands on',
    ).toEqual(expect.arrayContaining(SENDS))
  })

  it('reads the dictionary for the word, and the dictionary has one', () => {
    /* The needle is derived and could therefore derive to nothing: a unit sentence reduced to
       „{value}" leaves an empty string, which every file contains, and the claim above would
       then report the whole portal as writing a figure rather than passing over nothing. Both
       readings are held, in the direction each of them can fail.

       `newResult.donePoints` („Ova trka ti donosi {points} BTL poena.") stood among these
       until 28.09.2026, and removing it is what this change did. The two that are left are
       the unit itself and the word under the counter on the front page, and neither belongs
       to a screen that sends a result in. */
    expect(THE_WORD, 'the unit sentence no longer names anything').not.toBe('')
    expect(keysNamingPoints()).toEqual(['home.pointsUnit', 'units.btlPoints'])
  })
})

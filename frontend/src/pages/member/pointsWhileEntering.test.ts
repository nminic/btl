import ts from 'typescript'
import { join, relative, sep } from 'node:path'
import sr from '../../i18n/sr.json'
import { SLOW } from '../../test/slow'
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

/**
 * Whether a module puts a figure of BTL points on a page, asked two ways.
 *
 * Two, because either alone has a direction it cannot see: the formatter misses a sentence
 * that carries a figure worked out elsewhere, and the word misses a figure printed with no
 * word beside it. Each way has a floor of its own below, naming a module only that way
 * finds, so neither can quietly stop answering behind the other.
 *
 * The code is read with its comments blanked (`test/sources.ts`), so a note ABOUT a sentence
 * - and this change left several, each naming what it removed - is not taken for the
 * sentence being asked for.
 */
function writesAFigure(code: string, path: string, keys: string[]): boolean {
  const formats = namesTakenFrom(code, path, FORMATTER_LIVES_IN).includes('formatPoints')
  const written = bare(code)

  return formats || keys.some((key) => written.includes(`'${key}'`))
}

/** Whether a module is one of the roads a result is sent in by. */
function sendsAResult(code: string, path: string): boolean {
  return namesTakenFrom(code, path, WRITES_LIVE_IN).some((name) => SENDS.includes(name))
}

/** Every module of the portal, sorted into the two answers that matter. */
function sweep(): { walked: number; sending: string[]; writingAFigure: string[] } {
  const keys = keysNamingPoints()
  const sending: string[] = []
  const writingAFigure: string[] = []
  const walked = sources()

  for (const one of walked) {
    const where = named(one.path)

    if (sendsAResult(one.code, one.path)) {
      sending.push(where)
    }

    if (writesAFigure(one.code, one.path, keys)) {
      writingAFigure.push(where)
    }
  }

  return {
    walked: walked.length,
    sending: sending.sort(),
    writingAFigure: writingAFigure.sort(),
  }
}

/**
 * THE THREE CASES THAT SWEEP THE WHOLE PORTAL CARRY THE CLOCK A SWEEP NEEDS (`test/slow.ts`).
 *
 * **Measured, not assumed.** A sweep reads all 277 production files (09.10.2026) and works out
 * what each one imports and says. That is computation with nothing in it to wait for, so what
 * Vitest's five seconds measure here is how fast the runner is. In the first pass of the gate
 * (`npm run test:coverage`, coverage on), over the 61 runs between 03.10.2026 and 09.10.2026:
 *
 * - `is written by no screen that sends one in` took a median of 4343 ms, 4885 at the 90th
 *   percentile and 5316 at the slowest, and it ran out of its five seconds three times on
 *   09.10.2026 (5316, 5042 and 5081 ms) on branches that do not touch this file.
 * - `finds a figure by the formatter and by the word, and neither alone` took a median of 3741
 *   (slowest 4545) and `is asked of both roads, and there are two of them` 3649 (slowest 4420).
 *   They sweep the same portal the same way, and in the run that took the first one out they
 *   stood at 4107 and 4160. They have passed on luck, not on margin.
 * - The other four cases take 1 to 21 ms and keep the default. The second pass of the gate
 *   (another day, no coverage) took no sweep past 1606.
 *
 * On the machine this was written on, ten runs of this file with coverage on (alone, and beside
 * a parallel pass of 71 other files on six workers) took 1788 to 3857 ms for the first case,
 * 1641 to 2937 for the second and 1713 to 2658 for the fifth: over the two seconds that
 * `test/slow.ts` takes as the edge in six or seven of the ten, and the spread is what else the
 * machine was doing, the code being the same. Without coverage, two runs took 761 to 1494.
 *
 * **What the clock does.** Nothing that is asserted moves, only the clock the case is measured
 * against. A synchronous case cannot be interrupted: Vitest compares its time with the clock
 * when the case returns, so the 5042 in the log is how long the sweep really took and not a
 * hang. A longer clock cures that. It does not cure starvation (`vite.config.ts`), and the
 * price (ADL A2) is that a sweep dearer than today's is noticed at twenty seconds, 4.6 times the
 * median above, instead of five.
 */
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
  }, SLOW)

  it('finds a figure by the formatter and by the word, and neither alone', () => {
    /* `MyResults.tsx` above does BOTH - it takes the formatter and names the unit - so it
       would go on being found with either half of the reading switched off, and the case
       above would pass over a guard reading half of what it says it reads. Measured:
       switching off either half left every line above green.

       So each half is floored on a module only IT finds. `Rankings.tsx` formats a figure
       into a table cell and names no unit sentence; `home/Counters.tsx` says the word under
       a counter and never touches the formatter. */
    const { writingAFigure } = sweep()

    expect(writingAFigure, 'nothing is found by the formatter alone').toContain(
      'pages/Rankings.tsx',
    )
    expect(writingAFigure, 'nothing is found by the word alone').toContain(
      'pages/home/Counters.tsx',
    )
  }, SLOW)

  it('reads an import by what the other module calls it, and not by the local name', () => {
    /* Nothing in the portal renames either import today, so the whole of this reading would
       answer the same with the renaming dropped, and the sweep would then be blind to
       exactly the one-token change somebody makes while tidying up. Asked here of a snippet
       instead, since the portal has no instance to ask it of.

       A real path is handed in with the made-up code, because the specifier is RESOLVED and
       resolution needs somewhere to start from. */
    const where = join(SRC, 'pages', 'member', 'NewResult.tsx')

    expect(
      namesTakenFrom("import { formatPoints as howMany } from '../../i18n/format'\n", where, FORMATTER_LIVES_IN),
    ).toEqual(['formatPoints'])
    expect(
      namesTakenFrom("import { theRunWasSentIn as send } from './resultWrites'\n", where, WRITES_LIVE_IN),
    ).toEqual(['theRunWasSentIn'])
  })

  it('counts a sentence being asked for, and never one being written about', () => {
    /* This change left a note in four files naming the sentence it removed, and the removed
       one is no longer in the dictionary so none of those notes is found. The next such note
       may name a sentence that IS - `MyResults.tsx` already carries one - and a reading that
       took prose for a call would report a screen as writing a figure because somebody
       explained why it does not.

       Asked of a snippet for the same reason as above: today's portal has no sending module
       with such a comment in it, so the blanking carries nothing until it does. */
    const where = join(SRC, 'pages', 'member', 'NewResult.tsx')
    const keys = keysNamingPoints()

    expect(writesAFigure("const said = t('units.btlPoints')\n", where, keys)).toBe(true)
    expect(writesAFigure("/* Never t('units.btlPoints') on this screen. */\n", where, keys)).toBe(
      false,
    )
  })

  it('is asked of both roads, and there are two of them', () => {
    /* Named here and nowhere else in this file, so the claim above stays a property while
       this one says what that property was measured over. Either road leaving the graph - a
       specifier spelt in a way the resolver does not follow, a screen that stopped importing
       the writer - empties the set silently, and the claim above then holds over nothing. */
    expect(sweep().sending).toEqual(['pages/event/ReportResult.tsx', 'pages/member/NewResult.tsx'])
  }, SLOW)

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

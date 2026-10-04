import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { SLOW } from '../test/slow'
import { sources, WHOLE_PORTAL } from '../test/sources'

/**
 * A READ THAT FAILED IS NEVER TURNED INTO AN EMPTY LIST WITHOUT SOMETHING SAYING SO (decision of
 * 02.10.2026, PENDING stavka 368, in the words of the PDL's record of it and not the owner's:
 * „Spisak koji ne moze da se ucita KAZE to, umesto da izgleda prazan, uz dugme „Pokusaj ponovo".
 * Vazi za sve ekrane sa spiskom.").
 *
 * <p><b>TWO QUESTIONS ARE ASKED HERE AND THEY ARE NOT THE SAME KIND.</b> The first has a floor and
 * the second does not, and an earlier version of this file claimed the second was the first (the
 * review of PR 469 measured it: of eight realistic ways to hide a failed read, six passed).
 *
 * <p><b>1. Who OPENS a read that failed, asked of the compiler.</b> Every production file that
 * reads a field of a `ResourceState`, takes one apart, tests it with `in`, spreads it or hands it to
 * `dataOr` or `failed` is a place where a failure can be turned into something else. The set of such
 * files is DERIVED: `ts.createProgram` over the production sources, and every property access,
 * element access, destructuring, `in` and spread whose object has the type of a `ResourceState`,
 * wherever it was written and in whatever shape (`a.status === 'ready' && b.status === 'ready' ? …
 * : []` and `if (s.status !== 'ready') { return [] }` and `switch (s.status)` are all one question
 * to it). Each file in that set has a row in `OPENING` saying how it treats a failure, and the case
 * fails in BOTH directions: a file that opens a state and has no row, and a row for a file that
 * does not. So a new place does not wait for somebody to look, it is a decision the day it is
 * written. That is the floor, and it is the compiler's and not a list's: no shape is named.
 *
 * <p><b>2. Whether ONE expression stands an empty list in for a failed read, asked of the syntax
 * tree.</b> `dataOr(<state>, [])`, `<state>.status === 'ready' ? … : []`, and an `async` function
 * that calls `fetch` and `return []`s. This is a sample of shapes and nothing more, and it is kept
 * because it is the only thing here that looks at what a place DOES with the failure and not at
 * whether it looks. It follows nothing: an earlier version also asked „does the SAME function look
 * at the failure", which has to follow a value through the code and has no bottom - six rounds of the
 * guards over `profileAddress` and `valueInSentence` paid for that fault, and here it let
 * `failed(s) ? [] : dataOr(s, [])` through, because looking at a failure is not saying it. What a
 * finding needs now is a row that names it.
 *
 * <p><b>WHAT THIS DOES NOT SEE, written down so that nobody reads it as more.</b>
 * <ul>
 * <li>A read that never becomes a `ResourceState`: a promise taken straight from `loadResource` or
 * `fetch` and swallowed (`.then(set, () => {})`, `.catch(() => [])`, an `async` function that
 * returns `[]` from a `catch`). Question 1 starts from the state's own fields and cannot see them;
 * question 2 sees only the `fetch` form.</li>
 * <li>A NEW place inside a file that already has a row. The row says how THAT FILE treats a
 * failure, not that no place can be added to it: such a place is seen only if it has one of the three
 * shapes of question 2, and every other way of hiding it there is for the review that reads the
 * file.</li>
 * <li>Whether a reason in a row is TRUE. The guard holds that there is one. A reason that is not
 * from a recorded decision says so in its first words (MY REASONING), and one that is the file's own
 * comment says that.</li>
 * </ul>
 *
 * <p><b>Two kinds of row are not boundaries.</b> `open` is a place where what to do has not been
 * decided: it names whose decision it waits for, and it does not claim the place is right.
 * `says` is a place that tells the reader; a row may name the case that holds it, and where the
 * search for one found nothing the row says so.
 */

type Shape = 'dataOr' | 'condition' | 'fetch'

type Finding = { file: string; shape: Shape; call: string }

const emptyList = (node: ts.Node | undefined): boolean =>
  node !== undefined && ts.isArrayLiteralExpression(node) && node.elements.length === 0

const words = (node: ts.Node) => node.getText().replace(/\s+/g, ' ')

function enclosingFunction(node: ts.Node): ts.Node {
  let current: ts.Node = node

  while (current.parent !== undefined) {
    current = current.parent

    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current
    }
  }

  return current
}

/** Every node under `scope`, `scope` included. */
function walk(scope: ts.Node, visit: (node: ts.Node) => void): void {
  visit(scope)
  ts.forEachChild(scope, (child) => {
    walk(child, visit)
  })
}

/** What `code` does that stands an empty list in for a failed read, one expression at a time. */
function findingsIn(file: string, code: string): Finding[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: Finding[] = []

  walk(source, (node) => {
    /* 1. dataOr(<state>, []) */
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'dataOr' &&
      emptyList(node.arguments[1])
    ) {
      found.push({ file, shape: 'dataOr', call: words(node) })
    }

    /* 2. <state>.status === 'ready' ? … : []   and its mirror, !== 'ready' ? [] : … */
    if (ts.isConditionalExpression(node) && ts.isBinaryExpression(node.condition)) {
      const { left, right, operatorToken } = node.condition
      const ready = operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
      const unready = operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
      const access = ts.isPropertyAccessExpression(left) ? left : undefined

      if (
        access !== undefined &&
        access.name.text === 'status' &&
        ts.isStringLiteralLike(right) &&
        right.text === 'ready' &&
        ((ready && emptyList(node.whenFalse)) || (unready && emptyList(node.whenTrue)))
      ) {
        found.push({ file, shape: 'condition', call: words(node) })
      }
    }

    /* 3. an async function that calls fetch and answers [] on some path of its own */
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Async
    ) {
      let fetches = false
      let answersEmpty = false

      walk(node, (inside) => {
        if (
          ts.isCallExpression(inside) &&
          ts.isIdentifier(inside.expression) &&
          inside.expression.text === 'fetch'
        ) {
          fetches = true
        }

        if (
          ts.isReturnStatement(inside) &&
          emptyList(inside.expression) &&
          enclosingFunction(inside) === node
        ) {
          answersEmpty = true
        }
      })

      if (fetches && answersEmpty) {
        found.push({ file, shape: 'fetch', call: node.getText().split('\n')[0] ?? '' })
      }
    }
  })

  return found
}

/**
 * HOW EACH FILE THAT OPENS A READ THAT FAILED TREATS ONE, and why.
 *
 * <p>The files are the compiler's (`openingsIn` below), the reasons are the only part that could
 * not be derived, so they are written here and held to the floor in both directions. A row is one
 * of four things: `says` (the reader is told, and the row names the sentence or the case),
 * `hands on` (the failure goes on, as a state, to somebody who says it), `boundary` (a decision to
 * say nothing, with its reason) and `open` (nobody has decided; it names who must).
 *
 * <p>`calls` names the places in that file that question 2 finds and the row excuses, each by its
 * shape and its words. They are held in the other direction too: the last case below fails on the
 * day one of them stops being found, so a row cannot outlive the code it excuses.
 *
 * <p><b>Every reason that is not from a recorded decision says what it is from</b> in its first
 * words: `MY REASONING` where nothing was written down, `THE FILE'S OWN` where it is that file's own
 * comment, which is a reason somebody wrote and not one the owner took.
 */
type How = 'says' | 'hands on' | 'boundary' | 'open'

const OPENING: { file: string; how: How; why: string; calls?: { shape: Shape; call: string }[] }[] = [
  {
    file: 'app/AccountMenu.tsx',
    how: 'boundary',
    why: 'MY REASONING: a NAME in the header and not a list. A read that failed (or a number the list does not hold) leaves the member number where the name would be, which is also what a member with no row gets.',
  },
  {
    file: 'app/MessagesMenu.tsx',
    how: 'says',
    why: 'THE FILE\'S OWN, and held by `app/messagesUnreadable.test.tsx`: the panel says „Poruke se ne mogu ucitati" inside itself, with the button that asks again. The unread count in the name of the envelope still counts a failed read as nought: a low finding of the review of PR 469, recorded in PENDING and not fixed here.',
    calls: [{ shape: 'dataOr', call: 'dataOr(inbox, [])' }],
  },
  {
    file: 'app/Shell.tsx',
    how: 'boundary',
    why: 'THE FILE\'S OWN: a COUNT in the header, not a list: the number of things waiting for a moderator. A header that waited for the file would hold up every screen behind it, and the section that names each queue says when the file failed (`pages/admin/SectionNav.tsx`, `verification.shortCount`).',
    calls: [{ shape: 'dataOr', call: 'dataOr(items, [])' }],
  },
  {
    file: 'roles/RoleSwitch.tsx',
    how: 'boundary',
    why: 'THE DEVELOPMENT SWITCH of roles, drawn only where the development controls are on (`dev/tools.ts`) and never in production: a list of moderators to be somebody else with, for whoever is building the portal.',
    calls: [{ shape: 'dataOr', call: 'dataOr(useModerators(), [])' }],
  },
  {
    file: 'pages/Leagues.tsx',
    how: 'says',
    why: 'THE FILE\'S OWN, and held by `pages/resourceScope.test.tsx`: two cells of a row (the days that count and the number placed) say „nepoznato" when the file failed and nothing while it is on its way, three states and not two. Numbers and not lists.',
    calls: [
      { shape: 'dataOr', call: 'dataOr(racesState, [])' },
      { shape: 'dataOr', call: 'dataOr(eventsState, [])' },
      { shape: 'dataOr', call: 'dataOr(resultsState, [])' },
      { shape: 'dataOr', call: 'dataOr(competitorsState, [])' },
    ],
  },
  {
    file: 'pages/admin/AdminLeagues.tsx',
    how: 'says',
    why: 'THE FILE\'S OWN, and held by `pages/admin/leagueRaceModeration.test.tsx`: the cell that counts days says „nepoznato" for a file that failed and nothing for one on its way. A number and not a list.',
  },
  {
    file: 'pages/admin/AdminEvents.tsx',
    how: 'says',
    why: 'THE FILE\'S OWN, and held by `pages/adminEventKind.test.tsx`: the row that deletes an event says `admin.resultsFailed` for a file that failed and `admin.waitingForResults` for one on its way, because told to wait for something that never arrives an administrator is refused for good.',
  },
  {
    file: 'pages/admin/PendingQueue.tsx',
    how: 'says',
    why: 'THE FILE\'S OWN: the queue of teams says `verification.membersFailed` and refuses the decision while the list of members failed, two states and not one. NO CASE HOLDS THAT SENTENCE: the search of the tests for its key and its words found none, which is a finding about the cases and not about the screen.',
    calls: [{ shape: 'dataOr', call: 'dataOr(membersState, [])' }],
  },
  {
    file: 'pages/admin/SectionNav.tsx',
    how: 'says',
    why: 'THE FILE\'S OWN: the alarm says `verification.shortCount` when the file of queues failed, and every queue it feeds counts as nought. The file records that a file still on its way raises nothing. NO CASE HOLDS THE ALARM: found the same way as for `PendingQueue.tsx`.',
    calls: [{ shape: 'dataOr', call: 'dataOr(items, [])' }],
  },
  {
    file: 'pages/admin/pending.ts',
    how: 'hands on',
    why: 'MY REASONING: `usePending` maps a state that is ready and gives every other state back as it is, with its way to ask again, to the two screens that read it and say it (`PendingQueue.tsx`, `SectionNav.tsx`).',
  },
  {
    file: 'pages/event/EventComments.tsx',
    how: 'boundary',
    why: 'THE FILE\'S OWN, and held by `pages/event/eventWaiting.test.tsx`: for an event still to be run the part is drawn by nothing at all, and an alert about a part nobody was going to be shown is worse than the silence. An event that has been run goes through `<Resource>` and says it.',
  },
  {
    file: 'pages/event/OverallMark.tsx',
    how: 'boundary',
    why: 'THE FILE\'S OWN: a single figure in the head of the page, silent because a box that resolves into nothing moves the name of the race under the reader\'s eye, and an alert about a mark is noise about a figure nobody asked for. Not a list.',
  },
  {
    file: 'pages/EventDetail.tsx',
    how: 'open',
    why: 'OPEN: PENDING stavka 372, a separate PR (D). The block of actions is drawn only when the races AND the results are both ready, so a failed read of either takes the buttons away without a word. (The part for the results is silent for an event still to be run for the reason `pages/event/EventComments.tsx` gives, held by `pages/event/eventWaiting.test.tsx`.)',
  },
  {
    file: 'pages/member/NewResult.tsx',
    how: 'open',
    why: 'OPEN: waits for the owner\'s answer to whether the list of suggestions in a field of a form is a list in the sense of decision 368 (PENDING stavka 368, review of PR 469). What it says today: the road in with `?ispravka=` waits through `<Resource>`, which says it and offers to ask again.',
    calls: [{ shape: 'condition', call: "results.status === 'ready' ? results.data : []" }],
  },
  {
    file: 'pages/profile/useProfileLink.ts',
    how: 'boundary',
    why: 'MY REASONING: a BOOLEAN and not a list. The call asks only whether the reader\'s number is on the list the server serves, to decide whether a name is a link or plain text, so a read that failed leaves the reader read as nobody who may read a hidden profile: a refusal that lifts when the list arrives, never an admission. The list is not drawn from this call: every caller hands in a `Competitor`, a record of that same list, so a failure of it is already the caller\'s to say. Written 04.10.2026 with the reader fact (PDL P23).',
    calls: [{ shape: 'dataOr', call: 'dataOr(useCompetitors(), [])' }],
  },
]

/**
 * THE TWO FILES THAT ARE THE HOMES OF THE STATE AND NOT PLACES THAT OPEN IT: `useResource` defines it,
 * builds it and hands it on, and `Resource` is the component that says a failure of it. Every other
 * place is a row above. Held in the other direction too, because a home that stopped opening the
 * state would be an exemption for nothing.
 */
const HOMES = ['data/useResource.ts', 'components/Resource.tsx']

/** The module the state is defined in, and the types in it that ARE the state. */
const THE_STATE_IS_DEFINED_IN = 'data/useResource.ts'
const THE_STATE = ['ResourceState', 'FailedRead']

/** The two functions that are given a state and look at whether it failed. `combine…` hand it on
 *  and are not places that open it. */
const LOOK_AT_THE_FAILURE = ['dataOr', 'failed']

type Opening = { file: string; how: string; text: string }

/**
 * Every place under `root` that opens a `ResourceState`, asked of the type checker and of nothing
 * written by hand.
 *
 * <p><b>The question is about the TYPE of the thing being opened, never about its name or its
 * shape</b>, which is the whole difference from the three detectors above: a state called `s`, `a`,
 * `inbox` or `state`, narrowed or not, read in a condition, a `switch`, an early return or a
 * destructuring, has the same type. The type is recognised by where its declaration stands: inside
 * the aliases of `data/useResource.ts` that define the state. That is also why `submission.status`
 * is not one: its `status` is declared somewhere else.
 *
 * @param wanted whether a file under `root` is production, by its place under it
 */
function openingsIn(program: ts.Program, root: string, wanted: (place: string) => boolean): Opening[] {
  const checker = program.getTypeChecker()
  const placeOf = (fileName: string) => relative(root, fileName).split(sep).join('/')

  const insideTheState = (declaration: ts.Node): boolean => {
    for (let node: ts.Node | undefined = declaration; node !== undefined; node = node.parent) {
      if (
        ts.isTypeAliasDeclaration(node) &&
        THE_STATE.includes(node.name.text) &&
        placeOf(node.getSourceFile().fileName) === THE_STATE_IS_DEFINED_IN
      ) {
        return true
      }
    }

    return false
  }

  const declaredInside = (symbol: ts.Symbol | undefined): boolean =>
    symbol?.declarations?.some(insideTheState) ?? false

  const isAState = (type: ts.Type): boolean =>
    declaredInside(type.aliasSymbol) ||
    declaredInside(type.symbol) ||
    (type.isUnion() && type.types.some(isAState))

  const found: Opening[] = []

  for (const file of program.getSourceFiles()) {
    const place = placeOf(file.fileName)

    if (!wanted(place)) {
      continue
    }

    const note = (how: string, node: ts.Node) => {
      found.push({ file: place, how, text: words(node).slice(0, 80) })
    }

    walk(file, (node) => {
      if (
        (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
        isAState(checker.getTypeAtLocation(node.expression))
      ) {
        note('a field is read', node)
      }

      if (ts.isObjectBindingPattern(node) && isAState(checker.getTypeAtLocation(node))) {
        note('it is taken apart', node)
      }

      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.InKeyword &&
        isAState(checker.getTypeAtLocation(node.right))
      ) {
        note('it is tested with in', node)
      }

      if (
        (ts.isSpreadAssignment(node) || ts.isSpreadElement(node)) &&
        isAState(checker.getTypeAtLocation(node.expression))
      ) {
        note('it is spread', node)
      }

      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const symbol = checker.getSymbolAtLocation(node.expression)
        const target =
          symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(symbol)
            : symbol

        if (
          target !== undefined &&
          LOOK_AT_THE_FAILURE.includes(target.name) &&
          (target.declarations ?? []).some(
            (declaration) =>
              placeOf(declaration.getSourceFile().fileName) === THE_STATE_IS_DEFINED_IN,
          )
        ) {
          note('it is looked at by a function', node)
        }
      }
    })
  }

  return found
}

const SRC = join(process.cwd(), 'src')

const named = (path: string) => relative(SRC, path).split(sep).join('/')

/** A file of the portal itself and not of the compiler's libraries or of `node_modules`, by its place
 *  under `src`. It is NOT where production is told from tests: that is the roots the program is
 *  built from (`portal` below), and a rule written here too would be a second home for it that
 *  nothing could tell from its absence - taken out, every case stayed green, because a test file is
 *  never in the program unless production imports it.
 *
 *  <p>What this one is for is TIME, and that is measured and said rather than hidden: taken out,
 *  nothing fails and every scan walks the compiler's own libraries. A case that pretended to hold
 *  it would be measuring the clock. */
const underSrc = (place: string) => !place.startsWith('..')

let thePortal: ts.Program | undefined

/** The production sources of the portal as one program, built once because it takes seconds. The
 *  settings are the project's own, so a specifier is resolved the way the bundler resolves it.
 *
 *  <p><b>What is production is what `sources()` lists</b> (`test/sources.ts`: the files on the disc
 *  that are not in a folder called `test` and are not test files), and it is the ROOTS of the
 *  program, so a test that builds a state by hand is never read as a place that opens one. */
function portal(): ts.Program {
  if (thePortal === undefined) {
    const configPath = join(process.cwd(), 'tsconfig.app.json')
    const config = ts.readConfigFile(configPath, ts.sys.readFile)
    const options = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd()).options

    thePortal = ts.createProgram(
      sources().map((one) => one.path),
      options,
    )
  }

  return thePortal
}

describe('a read that failed', () => {
  it('reads the whole portal', () => {
    /* The floor under the cases below: a sweep narrowed by accident answers with nothing, and
       „no failed read is drawn as an empty list" is then true of a portal nobody looked at. */
    expect(sources().length).toBeGreaterThan(WHOLE_PORTAL)
    expect(
      portal()
        .getSourceFiles()
        .filter((file) => underSrc(named(file.fileName))).length,
      'the compiler read fewer production files than the portal has',
    ).toBeGreaterThan(WHOLE_PORTAL)
  }, SLOW)

  it('is opened only by files that have a row, and every row is a file that opens one', () => {
    const opening = openingsIn(portal(), SRC, underSrc)
    const files = [...new Set(opening.map((one) => one.file))].filter((one) => !HOMES.includes(one)).sort()
    const rows = OPENING.map((one) => one.file).sort()

    expect(
      files.filter((one) => !rows.includes(one)),
      'a file opens a read that failed and no row says how it treats one: add the row, and say why',
    ).toEqual([])
    expect(
      rows.filter((one) => !files.includes(one)),
      'a row names a file that no longer opens a read that failed: delete the row',
    ).toEqual([])
    expect(new Set(rows).size, 'a file has two rows').toBe(rows.length)
  }, SLOW)

  it('still sees the two homes of the state open it, which is what shows the question reaches the portal', () => {
    const files = new Set(openingsIn(portal(), SRC, underSrc).map((one) => one.file))

    expect(HOMES.filter((one) => !files.has(one))).toEqual([])
  }, SLOW)

  it('is never drawn as an empty list unless a row names the place', () => {
    const found = sources().flatMap(({ path, code }) => findingsIn(named(path), code))
    const unexcused = found.filter(
      (one) =>
        !OPENING.some(
          (row) =>
            row.file === one.file &&
            (row.calls ?? []).some((call) => call.shape === one.shape && call.call === one.call),
        ),
    )

    expect(
      unexcused.map((one) => `${one.file}: ${one.call}`),
      'a failed read looks like an empty list here, and no row names the place',
    ).toEqual([])
  })

  it('still finds every place a row names, and fails on the day it does not', () => {
    const found = sources().flatMap(({ path, code }) => findingsIn(named(path), code))
    const gone = OPENING.flatMap((row) =>
      (row.calls ?? [])
        .filter(
          (call) =>
            !found.some(
              (one) => one.file === row.file && one.shape === call.shape && one.call === call.call,
            ),
        )
        .map((call) => `${row.file}: ${call.call}`),
    )

    expect(gone, 'a place that no longer stands in the code: delete it from the row').toEqual([])
  })
})

/**
 * THE DETECTORS, ASKED OF CODE THAT IS WRITTEN FOR THE QUESTION. A guard that cannot be told from
 * its own absence is not a guard (ADL A2): without these, a walk that found nothing anywhere would
 * pass the portal-wide case above for the wrong reason.
 */
describe('the walk that finds them', () => {
  const found = (code: string) => findingsIn('x.tsx', code).map((one) => one.shape)

  it('finds a list stood in for a state', () => {
    expect(found('function A() { const s = useX(); return dataOr(s, []) }')).toEqual(['dataOr'])
  })

  it('finds a state that is a call, because it has no name to be looked at by', () => {
    expect(found('function A() { return dataOr(useX(), []) }')).toEqual(['dataOr'])
  })

  it('does not let the same function looking at the failure excuse it, because looking is not saying', () => {
    expect(found('function A() { const s = useX(); return failed(s) ? 1 : dataOr(s, []) }')).toEqual(['dataOr'])
    expect(found("function A() { const s = useX(); return s.status === 'error' ? 1 : dataOr(s, []) }")).toEqual([
      'dataOr',
    ])
    expect(found('function A() { const s = useX(); return failed(s) ? [] : dataOr(s, []) }')).toEqual(['dataOr'])
  })

  it('finds a condition that answers an empty list for a state that is not ready', () => {
    expect(found("function A() { const s = useX(); return s.status === 'ready' ? s.data : [] }")).toEqual([
      'condition',
    ])
    expect(found("function A() { const s = useX(); return s.status !== 'ready' ? [] : s.data }")).toEqual([
      'condition',
    ])
  })

  it('does not take a condition that answers something else, or tests something else, for one', () => {
    expect(found("function A() { const s = useX(); return s.status === 'ready' ? s.data : null }")).toEqual([])
    expect(found("function A() { const s = useX(); return s.status === 'pending' ? s.data : [] }")).toEqual([])
  })

  it('does not take a fallback that is not a list for one', () => {
    expect(found('function A() { const s = useX(); return dataOr(s, null) }')).toEqual([])
  })

  it('finds an async function that calls fetch and answers an empty list', () => {
    expect(found('async function read() { try { await fetch(p) } catch { return [] } return [1] }')).toEqual([
      'fetch',
    ])
    expect(found('const read = async () => { await fetch(p); return [] }')).toEqual(['fetch'])
  })

  it('does not take an async function that answers an empty list without asking a server for one', () => {
    expect(found('async function read() { return [] }')).toEqual([])
    expect(found('function read() { fetch(p); return [] }')).toEqual([])
  })
})

/**
 * THE COMPILER'S QUESTION, ASKED OF CODE THAT IS WRITTEN FOR IT, in a project that exists only here.
 *
 * <p>The state is the real one in shape (a copy of the two aliases, in a file at the place the real
 * one lives, because that is how the question recognises it), and every file below is one way to hide
 * a failed read. They are the eight realistic shapes the review of PR 469 listed and the ones found
 * after it, and they are examples and not the claim: what is claimed is the question, which names no
 * shape. What these cases hold is that the question SEES what it says it sees, and that it does not
 * see what it says it does not - a promise taken straight from a loader is not a state, and a
 * `status` on something else is not one either.
 */
describe('the compiler asked of code written for the question', () => {
  /** A place under `src` that does not exist on the disc, so nothing here can be confused with the
   *  portal. */
  const HERE = join(process.cwd(), 'imagined', 'src')

  const STATE = `
export type FailedRead = { status: 'error'; error: Error; readAgain: () => void; reading: boolean }
export type ResourceState<T> = { status: 'loading' } | { status: 'ready'; data: T } | FailedRead
export declare function dataOr<T>(state: ResourceState<T>, fallback: T): T
export declare function failed(...states: ResourceState<unknown>[]): boolean
export declare function combinePair<A, B>(a: ResourceState<A>, b: ResourceState<B>): ResourceState<[A, B]>
export declare function useX(): ResourceState<string[]>
export declare function useY(): ResourceState<string[]>
export declare function loadResource(name: string): Promise<string[]>
`

  const HEAD = "import { combinePair, dataOr, failed, loadResource, useX, useY } from '../data/useResource'\n"

  /** Each way to hide a failed read, as the file that has it. The two that are NOT a state are below. */
  const OPEN: Record<string, string> = {
    'Called.ts': 'export function A() { const s = useX(); return dataOr(s, []) }',
    'Condition.ts': "export function A() { const s = useX(); return s.status === 'ready' ? s.data : [] }",
    'Double.ts':
      "export function A() { const a = useX(); const b = useY(); return a.status === 'ready' && b.status === 'ready' ? [...a.data, ...b.data] : [] }",
    'Constant.ts': 'const NONE: string[] = []\nexport function A() { const s = useX(); return dataOr(s, NONE) }',
    'Early.ts': "export function A() { const s = useX(); if (s.status !== 'ready') { return [] } return s.data }",
    'FailedThenEmpty.ts': 'export function A() { const s = useX(); return failed(s) ? [] : dataOr(s, []) }',
    'Switch.ts':
      "export function A() { const s = useX(); switch (s.status) { case 'ready': return s.data; default: return [] } }",
    'Element.ts': "export function A() { const s = useX(); return s['status'] === 'ready' ? [1] : [] }",
    'TakenApart.ts': "export function A() { const { status } = useX(); return status === 'ready' ? [1] : [] }",
    'Tested.ts': "export function A() { const s = useX(); return 'data' in s ? [1] : [] }",
    'Spread.ts': 'export function A() { const s = useX(); return { ...s } }',
  }

  const NOT_OPEN: Record<string, string> = {
    /* Handed on, which is what `Resource` and the combiners do: nothing is read. */
    'HandedOn.ts':
      'export function A() { const s = useX(); return combinePair(s, useY()) }\nexport function B() { return use(useX()) }\ndeclare function use(state: unknown): void',
    /* A promise that never becomes a state: the boundary written in the header, held here so that
       it is a measured limit and not a hope. */
    'PromiseThen.ts':
      'export function A(set: (rows: string[]) => void) { loadResource("races").then(set, () => {}) }',
    'PromiseCatch.ts': 'export function A() { return loadResource("races").catch(() => []) }',
    /* A `status` that is somebody else's: the type is what is asked, never the word. */
    'OtherStatus.ts':
      "type Submission = { status: 'pending' | 'approved' }\nexport function A(one: Submission) { return one.status === 'approved' }",
  }

  function opened(files: Record<string, string>): string[] {
    const all: Record<string, string> = { 'data/useResource.ts': STATE }

    for (const [name, code] of Object.entries(files)) {
      all[`pages/${name}`] = HEAD + code
    }

    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      lib: ['lib.es2022.d.ts'],
      types: [],
    }
    const real = ts.createCompilerHost(options)
    const imagined = (name: string): string | undefined => all[relative(HERE, name).split(sep).join('/')]
    /* A folder of the imagined project is a folder, or the compiler records a failure for every
       file it would have looked for in it and resolves nothing. */
    const folderOfTheImagined = (name: string): boolean => {
      const place = relative(HERE, name).split(sep).join('/')

      return !place.startsWith('..') && Object.keys(all).some((one) => one.startsWith(`${place}/`))
    }
    const host: ts.CompilerHost = {
      ...real,
      directoryExists: (name) => folderOfTheImagined(name) || (real.directoryExists?.(name) ?? false),
      fileExists: (name) => imagined(name) !== undefined || real.fileExists(name),
      readFile: (name) => imagined(name) ?? real.readFile(name),
      getSourceFile: (name, languageVersion, onError, shouldCreate) => {
        const text = imagined(name)

        return text === undefined
          ? real.getSourceFile(name, languageVersion, onError, shouldCreate)
          : ts.createSourceFile(name, text, languageVersion, true)
      },
    }
    const program = ts.createProgram(
      Object.keys(all).map((name) => join(HERE, name)),
      options,
      host,
    )

    return [...new Set(openingsIn(program, HERE, underSrc).map((one) => one.file))].sort()
  }

  it.each(Object.keys(OPEN))('sees %s as a place that opens a state', (name) => {
    expect(opened({ [name]: OPEN[name] ?? '' })).toEqual([`pages/${name}`])
  })

  it.each(Object.keys(NOT_OPEN))('does not take %s for one', (name) => {
    expect(opened({ [name]: NOT_OPEN[name] ?? '' })).toEqual([])
  })

})

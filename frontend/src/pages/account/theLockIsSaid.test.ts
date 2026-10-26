import { join, relative, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { SLOW } from '../../test/slow'
import { sources, WHOLE_PORTAL } from '../../test/sources'

/**
 * EVERY PLACE THAT WRITES TO THE SERVER IS A PLACE THAT HAS DECIDED WHAT IT SAYS WHEN THE SITE IS LOCKED.
 *
 * <p>Owner, 22.10.2026 (`btl-produkt/ADL.md`, „portal to kaže i nudi novu karticu"), and 23.10.2026
 * (`btl-produkt/PDL.md`, „važi za svaki ekran koji upisuje"): when the browser has forgotten the word of
 * the trial period, the proxy answers a write 401 with a `Basic` challenge, and the portal says so and
 * offers a new tab. 25.10.2026 (PDL, „Poruka o probnoj šifri na svakom ekranu koji upisuje: odgovori od
 * 25.10.2026"): it is said screen by screen, beside the control that was pressed, and a test over the
 * whole portal holds it; the read receipt and signing out stay silent, as a boundary.
 *
 * <p><b>TWO QUESTIONS, AND BOTH ARE ABOUT ONE CALL, never about where a value goes.</b>
 *
 * <p><b>1. Who can write, asked of the syntax tree.</b> Every reference to `fetch` in production is the
 * callee of a call, and a call with more than one argument - an `init`, and so a verb - stands in
 * `account/askTheServer.ts` alone. `XMLHttpRequest` and `sendBeacon` are not named anywhere. So a write
 * cannot be sent around the one function that recognises the lock (`isTheLock`): a new screen either
 * calls it or fails this file. A `fetch` with one argument is a `GET`, and a read is not this decision.
 *
 * <p><b>2. Who OPENS what the server answered, asked of the compiler</b>, the shape
 * `data/aFailedReadIsSaid.test.ts` gives the same question about a read that failed. Every production
 * file that reads a field of an `Answer`, takes one apart, tests it with `in` or spreads it - wherever
 * and in whatever shape - is a place where the lock can be turned into something else or dropped, and so
 * is every file that THROWS AN ANSWER AWAY: a statement, or a `void`, whose value is an `Answer` or the
 * promise of one. Each such file has a row in `OPENING` saying how it treats the lock, and the case fails
 * in both directions: a file that opens one and has no row, and a row for a file that does not.
 *
 * <p><b>WHAT THIS DOES NOT SEE, written down so that nobody reads it as more</b> (PDL 25.10.2026,
 * „[GRANICA 25.10.2026 ...]"):
 * <ul>
 * <li><b>A new place that writes, inside a file that already has a row.</b> The row says how THAT FILE
 * treats the lock, not that nothing can be added to it; such a place is for the review that reads the
 * file. The same limit `data/aFailedReadIsSaid.test.ts` writes down.</li>
 * <li><b>Whether a row is TRUE.</b> The guard holds that there is one, and that a row which says the lock
 * is said stands in a file that imports one of the components that say it (`SAYERS`). That is a
 * necessary condition and not a proof: `member/Membership.tsx` imported `ServerSaid` for leaving a team
 * while the choice of category beside it dropped the lock without a word. What proves it is a case, and
 * a row that names one names it.</li>
 * <li><b>A `<form>` that posts by itself.</b> Not a `fetch`: it is a navigation, and a navigation is
 * exactly what makes the browser ask for the word again, so it cannot meet this answer. The portal has
 * none; every form is sent by `askTheServer`.</li>
 * </ul>
 */

/* ---------------------------------------------------------------------------------------------- */
/* 1. WHO CAN WRITE                                                                               */
/* ---------------------------------------------------------------------------------------------- */

/** The one place a request with a verb is sent from. */
const THE_ONE_WRITER = 'pages/account/askTheServer.ts'

/** What a write could be sent with other than `fetch`. Named, because these are the platform's own
 *  names and a reference to one is the whole of the question. */
const OTHER_WAYS_TO_SEND = ['XMLHttpRequest', 'sendBeacon']

type Sending = { file: string; what: string }

/** Every place under `code` that could send a write past `askTheServer`, by the syntax alone. */
function sendingIn(file: string, code: string): Sending[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: Sending[] = []
  const words = (node: ts.Node) => node.getText().replace(/\s+/g, ' ').slice(0, 80)

  const visit = (node: ts.Node): void => {
    /* `fetch`, or `window.fetch` / `globalThis.fetch`: the name, as an identifier or as the name of a
       property, wherever it stands. */
    const isFetch =
      (ts.isIdentifier(node) && node.text === 'fetch' && !ts.isPropertyAccessExpression(node.parent)) ||
      (ts.isPropertyAccessExpression(node) && node.name.text === 'fetch')

    if (isFetch) {
      const call = node.parent

      if (!ts.isCallExpression(call) || call.expression !== node) {
        found.push({ file, what: `fetch is handed on rather than called: ${words(call)}` })
      } else if (call.arguments.length > 1 && file !== THE_ONE_WRITER) {
        found.push({ file, what: `fetch is called with an init: ${words(call)}` })
      }
    }

    if (
      (ts.isIdentifier(node) && OTHER_WAYS_TO_SEND.includes(node.text) && !ts.isPropertyAccessExpression(node.parent)) ||
      (ts.isPropertyAccessExpression(node) && OTHER_WAYS_TO_SEND.includes(node.name.text))
    ) {
      found.push({ file, what: `a request is sent another way: ${words(node)}` })
    }

    ts.forEachChild(node, visit)
  }

  visit(source)

  return found
}

/* ---------------------------------------------------------------------------------------------- */
/* 2. WHO OPENS AN ANSWER                                                                         */
/* ---------------------------------------------------------------------------------------------- */

/** The module the answer is defined in, and the alias that IS it. */
const THE_ANSWER_IS_DEFINED_IN = 'pages/account/askTheServer.ts'

const THE_ANSWER = 'Answer'

type Opening = { file: string; how: string; text: string }

const words = (node: ts.Node) => node.getText().replace(/\s+/g, ' ')

/** Every node under `scope`, `scope` included. */
function walk(scope: ts.Node, visit: (node: ts.Node) => void): void {
  visit(scope)
  ts.forEachChild(scope, (child) => {
    walk(child, visit)
  })
}

/**
 * Every place under `root` that opens an `Answer` or throws one away, asked of the type checker.
 *
 * <p><b>The question is about the TYPE, never the name or the shape</b>: an answer called `answer`,
 * `said`, `came` or `refused.answer`, narrowed or not, read in a condition, a `switch` or a
 * destructuring, has the same type, recognised by where its declaration stands - inside the alias
 * `Answer` of `account/askTheServer.ts`. That is why the `got` of `joiningThisTeam.ts`'s `Queue` is not
 * one, and why `Exclude<Answer, { got: 'done' }>` is.
 */
function openingsIn(program: ts.Program, root: string, wanted: (place: string) => boolean): Opening[] {
  const checker = program.getTypeChecker()
  const placeOf = (fileName: string) => relative(root, fileName).split(sep).join('/')

  const insideTheAnswer = (declaration: ts.Node): boolean => {
    for (let node: ts.Node | undefined = declaration; node !== undefined; node = node.parent) {
      if (
        ts.isTypeAliasDeclaration(node) &&
        node.name.text === THE_ANSWER &&
        placeOf(node.getSourceFile().fileName) === THE_ANSWER_IS_DEFINED_IN
      ) {
        return true
      }
    }

    return false
  }

  const declaredInside = (symbol: ts.Symbol | undefined): boolean =>
    symbol?.declarations?.some(insideTheAnswer) ?? false

  const isAnAnswer = (type: ts.Type): boolean =>
    declaredInside(type.aliasSymbol) ||
    declaredInside(type.symbol) ||
    (type.isUnion() && type.types.some(isAnAnswer))

  /** An answer, or the promise of one. */
  const isAnAnswerOrItsPromise = (type: ts.Type): boolean => {
    if (isAnAnswer(type)) {
      return true
    }

    const awaited = checker.getAwaitedType(type)

    return awaited !== undefined && awaited !== type && isAnAnswer(awaited)
  }

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
        isAnAnswer(checker.getTypeAtLocation(node.expression))
      ) {
        note('a field is read', node)
      }

      if (ts.isObjectBindingPattern(node) && isAnAnswer(checker.getTypeAtLocation(node))) {
        note('it is taken apart', node)
      }

      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.InKeyword &&
        isAnAnswer(checker.getTypeAtLocation(node.right))
      ) {
        note('it is tested with in', node)
      }

      if (
        (ts.isSpreadAssignment(node) || ts.isSpreadElement(node)) &&
        isAnAnswer(checker.getTypeAtLocation(node.expression))
      ) {
        note('it is spread', node)
      }

      /* THROWN AWAY: a statement whose value is an answer or its promise, and nothing reads it. An
         assignment is a statement too, and it keeps the value rather than dropping it. */
      if (
        ts.isExpressionStatement(node) &&
        !(ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) &&
        isAnAnswerOrItsPromise(checker.getTypeAtLocation(node.expression))
      ) {
        note('it is thrown away', node)
      }

      if (ts.isVoidExpression(node) && isAnAnswerOrItsPromise(checker.getTypeAtLocation(node.expression))) {
        note('it is thrown away with void', node)
      }
    })
  }

  return found
}

const SRC = join(process.cwd(), 'src')

const named = (path: string) => relative(SRC, path).split(sep).join('/')

/** A file of the portal and not of the compiler's libraries, by its place under `src`; production is
 *  told from tests by the ROOTS of the program (`portal`), as in `data/aFailedReadIsSaid.test.ts`. */
const underSrc = (place: string) => !place.startsWith('..')

let thePortal: ts.Program | undefined

/** The production sources as one program, with the project's own settings. */
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

/**
 * The components that say the lock: the owner's sentence and the way to a new tab. A row that says the
 * lock is said stands in one of them or imports one of them, resolved as the bundler resolves it.
 */
const SAYERS = [
  'pages/account/ServerSaid.tsx',
  'pages/account/TheSiteIsLocked.tsx',
  'pages/account/serverWords.ts',
  'pages/admin/WhatTheServerSaid.tsx',
  'pages/admin/EventRaces.tsx',
]

/** What `file` imports, as files under `src`, asked of the compiler's own resolution. */
function importsOf(program: ts.Program, file: string): string[] {
  const source = program.getSourceFile(join(SRC, file))

  if (source === undefined) {
    return []
  }

  const options = program.getCompilerOptions()

  return ts
    .preProcessFile(source.text, true, true)
    .importedFiles.map((one) => ts.resolveModuleName(one.fileName, source.fileName, options, ts.sys))
    .flatMap((one) => (one.resolvedModule === undefined ? [] : [named(one.resolvedModule.resolvedFileName)]))
}

/**
 * HOW EACH FILE THAT OPENS AN ANSWER TREATS THE LOCK, and why.
 *
 * <p>A row is one of four things: `says` (the lock is drawn beside the control that was pressed, through
 * one of `SAYERS`), `hands on` (the answer goes on, whole, to a caller whose file has its own row),
 * `boundary` (a decision to say nothing, with its reason) and `open` (nobody has decided; it names who
 * must). A reason that is not from a recorded decision says what it is from in its first words: `MY
 * REASONING`, or `THE FILE'S OWN` where it is that file's comment.
 */
type How = 'says' | 'hands on' | 'boundary' | 'open'

const OPENING: { file: string; how: How; why: string }[] = [
  {
    file: 'app/AccountMenu.tsx',
    how: 'boundary',
    why: 'Owner, 25.10.2026 (PDL, „Poruka o probnoj šifri na svakom ekranu koji upisuje: odgovori od 25.10.2026”): signing out stays silent under the lock, because there is no form to send again and the portal forgets the session on the screen either way. The price, shown to him before he chose: the session on the server lives until it runs out. `void signOutOfTheServer()` is the answer thrown away.',
  },
  {
    file: 'pages/AskingThisTeam.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: every answer that is not done goes whole into `ServerSaid`, which draws the lock (`TheSiteIsLocked`). A refusal that says the screen is stale is drawn after the list is read again; the lock is not one of those. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/EventDetail.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the deletion of a result keeps the answer beside its row and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/Leagues.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the terms and the prizes keep the answer beside the box that was saved and draw it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/Registration.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: registering and asking for the letter again each keep the answer and draw it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/TeamDetail.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the deletion of a team keeps the answer for the page it was pressed on and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/account/ConfirmAddress.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the confirmation keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/account/ForgottenPassword.tsx',
    how: 'says',
    why: 'THE DECISION OF 22.10.2026, held by `theSiteIsLocked.test.tsx` („keeps what was typed on the screen the sentence stands on, and writes it nowhere”): the answer goes whole into `ServerSaid`.',
  },
  {
    file: 'pages/account/NewPassword.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the new password keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/account/ServerSaid.tsx',
    how: 'says',
    why: 'THE FILE\'S OWN, and held by `theSiteIsLocked.test.tsx`: the home that draws the lock for every screen that hands it an answer, through `TheSiteIsLocked`.',
  },
  {
    file: 'pages/account/serverWords.ts',
    how: 'says',
    why: 'THE FILE\'S OWN, and held by `serverWords.test.ts`: where the owner\'s sentence is chosen (`server.locked`), for every component that draws an answer.',
  },
  {
    file: 'pages/admin/AdminEvents.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the event and its deletion go through `ServerSaid` (`saying`), and the races of an event through `EventRaces`, which draws the way to a new tab once for the list (`NotSaved.locked`). No case puts the lock on this screen.',
  },
  {
    file: 'pages/admin/AdminLeagues.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: saving a league and its deletion go through `ServerSaid` (`saying`). No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/admin/AdminMembers.tsx',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 25.10.2026: the deletion of a member hands every answer that is not done back to `MemberRow.tsx`, which draws it beside the row.',
  },
  {
    file: 'pages/admin/AdminModerators.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: each of the four writes goes through `ServerSaid` (`saying`). No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/admin/AdminPricing.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: saving a price goes through `ServerSaid` (`saying`). No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/admin/AdminTeams.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the deletion of a team keeps the answer beside its row and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/admin/LeagueRaceModeration.tsx',
    how: 'says',
    why: 'Owner, 23.10.2026 (PDL, „važi za svaki ekran koji upisuje”, the races of a league named in it), and held by `admin/leagueRaceModeration.test.tsx` (the cases about the site being locked): the lock is drawn by `TheSiteIsLocked` under the panel, for adding a race and for taking one out, and is not one of the panel\'s own sentences.',
  },
  {
    file: 'pages/admin/MemberRow.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the writes of the row (`send`, the new invitation of `invitationOnTheRow` among them) and the deletion keep the answer beside the row and draw it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/admin/Payments.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: an activation keeps the answer beside its row and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/admin/PendingQueue.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: every answer that is not done goes whole into `WhatTheServerSaid`, which draws the lock (`TheSiteIsLocked`). No case puts the lock on this screen; `WhatTheServerSaid`\'s own case is in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/admin/ReviewQueue.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: every answer that is not done goes whole into `WhatTheServerSaid`. Of a sweep of several rows the first refusal is the one drawn, and on a locked site every row meets the same lock. No case puts the lock on this screen.',
  },
  {
    file: 'pages/admin/WhatTheServerSaid.tsx',
    how: 'says',
    why: 'THE FILE\'S OWN, and held by `theSiteIsLocked.test.tsx` („is said by the queues of administration too”): the queues\' own switch draws the lock through `TheSiteIsLocked`.',
  },
  {
    file: 'pages/event/EnterResults.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the three writes of the league\'s entry keep the answer and draw it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/event/EventActions.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the deletion of an event keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/event/EventComments.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the deletion of a rating keeps every answer that is not done and not a 404 (`saysNothing`) and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/event/GoingToEvent.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: „Idem” and a message to a runner each keep the answer and draw it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/event/RateEvent.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: a rating keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/event/ReportResult.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: a reported result keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/event/commentWrites.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 25.10.2026: opens the answer only to drop the cache after a deletion, and hands it back whole to `event/EventComments.tsx`.',
  },
  {
    file: 'pages/event/leagueResultWrites.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 25.10.2026: opens the answer only to drop the caches a write changed, and hands it back whole to `event/EnterResults.tsx` and `EventDetail.tsx`.',
  },
  {
    file: 'pages/joiningThisTeam.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 25.10.2026: opens the answer only to drop caches, and hands it back whole to `AskingThisTeam.tsx`, `useTeamQueue.ts` and `profile/InviteToTeam.tsx`.',
  },
  {
    file: 'pages/member/ChangePassword.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: changing the password keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/MailLanguageChoice.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the language of mail keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/Membership.tsx',
    how: 'says',
    why: 'Owner, 25.10.2026 (PDL, „Izbor kategorije kaže svaki neuspeh, kao ostali ekrani”), and held by `member/categoryLocked.test.tsx`: the choice of category draws every failure that is not a refusal through `ServerSaid` beside the box, and leaving a team draws its answer through `ServerSaid` beside the button.',
  },
  {
    file: 'pages/member/MyRacingPairs.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: breaking a pair keeps the answer beside the pair and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/MyResults.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: taking a result back keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/NewResult.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: a result and its correction keep the answer and draw it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/PersonalData.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: his data keep the answer and draw it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/ProfileBio.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the biography keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/ProfilePicture.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the picture keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/ProfileVisibility.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the visibility of the profile keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/ProposeTeam.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: the proposal of a team keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/ServedPairInvite.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: answering a question of a pair keeps the answer and draws it through `ServerSaid`; only a 404 is drawn otherwise. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/ServedTeamInvite.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: answering an invitation into a team keeps the answer and draws it through `ServerSaid`; only a 404 is drawn otherwise. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/member/SignIn.tsx',
    how: 'says',
    why: 'THE DECISION OF 22.10.2026, held by `theSiteIsLocked.test.tsx` (the site locked at the sign-in, and its neighbour about the portal\'s own 401): the answer goes whole into `ServerSaid`.',
  },
  {
    file: 'pages/member/inboxRead.ts',
    how: 'boundary',
    why: 'Owner, 25.10.2026 (PDL, „Poruka o probnoj šifri na svakom ekranu koji upisuje: odgovori od 25.10.2026”): the read receipt stays silent under the lock, because nothing was pressed and there is no form to send again. The line stays unread, which is what the file\'s own comment already says of any receipt that does not land.',
  },
  {
    file: 'pages/member/pairWrites.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 25.10.2026: opens the answer only to drop caches, and hands it back whole to the screens of pairs.',
  },
  {
    file: 'pages/member/resultWrites.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 25.10.2026: opens the answer only to drop caches, and hands it back whole to `NewResult.tsx`, `MyResults.tsx` and `event/ReportResult.tsx`.',
  },
  {
    file: 'pages/member/teamExit.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 25.10.2026: opens the answer only to drop caches, and hands it back whole to `Membership.tsx`.',
  },
  {
    file: 'pages/member/teamWrites.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 25.10.2026: opens the answer only to drop caches, and hands it back whole to `ServedTeamInvite.tsx`.',
  },
  {
    file: 'pages/member/fromTheBalance.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 26.10.2026: `theServerWasAskedToLetMeIn` returns the answer of `POST /api/me/membership` whole, after only clearing a cache on done, to `useLetMeIn.ts`.',
  },
  {
    file: 'pages/member/useLetMeIn.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 26.10.2026: every answer that is not done is kept whole as the outcome `not`, which `Membership.tsx` draws through `ServerSaid` beside the button „Aktiviraj članstvo".',
  },
  {
    file: 'pages/member/useMyCategory.ts',
    how: 'hands on',
    why: 'Owner, 25.10.2026 (PDL, „Izbor kategorije kaže svaki neuspeh”): every answer that is not done is kept, a refusal as its reason and everything else whole as `failure`, for `Membership.tsx` to draw; held by `member/categoryLocked.test.tsx`.',
  },
  {
    file: 'pages/profile/InviteToPair.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: inviting into a pair keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/profile/InviteToTeam.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: inviting into a team keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/profile/TheMembersData.tsx',
    how: 'says',
    why: 'MY REASONING, read off the code on 25.10.2026: correcting a member\'s data keeps the answer and draws it through `ServerSaid`. No case puts the lock on this screen; what says it is drawn is `ServerSaid`\'s own case in `theSiteIsLocked.test.tsx`.',
  },
  {
    file: 'pages/useTeamQueue.ts',
    how: 'hands on',
    why: 'MY REASONING, read off the code on 25.10.2026: keeps every answer that is not done with its row and hands it to `TeamQueue.tsx`, which draws it through `ServerSaid`.',
  },
]

describe('a write the site is locked against', () => {
  it('reads the whole portal', () => {
    /* The floor under the cases below: a sweep narrowed by accident answers with nothing. */
    expect(sources().length).toBeGreaterThan(WHOLE_PORTAL)
    expect(
      portal()
        .getSourceFiles()
        .filter((file) => underSrc(named(file.fileName))).length,
      'the compiler read fewer production files than the portal has',
    ).toBeGreaterThan(WHOLE_PORTAL)
  }, SLOW)

  it('is sent from askTheServer and from nowhere else', () => {
    const found = sources().flatMap(({ path, code }) => sendingIn(named(path), code))

    expect(
      found.map((one) => `${one.file}: ${one.what}`),
      'a request with a verb leaves the portal past askTheServer, which is the one place that recognises the lock',
    ).toEqual([])
  })

  it('still sees the one writer send with an init, which is what shows the question reaches it', () => {
    const writer = sources().find(({ path }) => named(path) === THE_ONE_WRITER)
    const code = writer?.code ?? ''

    expect(sendingIn('elsewhere.ts', code).map((one) => one.what)).toEqual([
      expect.stringContaining('fetch is called with an init'),
    ])
  }, SLOW)

  it('is answered only in files that have a row, and every row is a file that opens one', () => {
    const opening = openingsIn(portal(), SRC, underSrc)
    const files = [...new Set(opening.map((one) => one.file))].sort()
    const rows = OPENING.map((one) => one.file).sort()

    expect(
      files.filter((one) => !rows.includes(one)),
      'a file opens what the server answered and no row says how it treats the lock: add the row, and say why',
    ).toEqual([])
    expect(
      rows.filter((one) => !files.includes(one)),
      'a row names a file that no longer opens what the server answered: delete the row',
    ).toEqual([])
    expect(new Set(rows).size, 'a file has two rows').toBe(rows.length)
  }, SLOW)

  it('is said, where a row says it is, by a file that can say it', () => {
    const program = portal()
    const cannot = OPENING.filter(
      (row) =>
        row.how === 'says' &&
        !SAYERS.includes(row.file) &&
        !importsOf(program, row.file).some((one) => SAYERS.includes(one)),
    ).map((row) => row.file)

    expect(cannot, 'a row says the lock is said, and the file imports nothing that says it').toEqual([])
  }, SLOW)
})

/**
 * THE WALK THAT FINDS A WRITE SENT PAST `askTheServer`, asked of code written for the question. A guard
 * that cannot be told from its own absence is not a guard (ADL A2).
 */
describe('the walk that finds a write sent another way', () => {
  const found = (code: string, file = 'pages/x.ts') => sendingIn(file, code).map((one) => one.what.split(':')[0])

  it('finds fetch called with an init anywhere but the one writer, and leaves a read alone', () => {
    expect(found("fetch('/api/x', { method: 'POST' })")).toEqual(['fetch is called with an init'])
    expect(found('fetch(p, init)')).toEqual(['fetch is called with an init'])
    expect(found("window.fetch('/api/x', { method: 'PUT' })")).toEqual(['fetch is called with an init'])
    expect(found("fetch('/api/x', { method: 'POST' })", THE_ONE_WRITER)).toEqual([])
    expect(found("fetch('/api/x')")).toEqual([])
  })

  it('finds fetch handed on rather than called, because a name for it is a way around the question', () => {
    expect(found('const send = fetch')).toEqual(['fetch is handed on rather than called'])
    expect(found('use(globalThis.fetch)')).toEqual(['fetch is handed on rather than called'])
  })

  it('finds the other two ways a browser sends a request', () => {
    expect(found('const x = new XMLHttpRequest()')).toEqual(['a request is sent another way'])
    expect(found("navigator.sendBeacon('/api/x', body)")).toEqual(['a request is sent another way'])
  })

  it('does not take a property that only shares the name for a write', () => {
    expect(found("const state = { fetching: true }; read('fetch')")).toEqual([])
  })
})

/**
 * THE COMPILER'S QUESTION, ASKED OF CODE WRITTEN FOR IT, in a project that exists only here: the shape
 * `data/aFailedReadIsSaid.test.ts` gives its own. The answer is the real one in shape, in a file at the
 * place the real one lives, because that is how the question recognises it. Each file is one way to open
 * an answer or to throw one away, and they are examples and not the claim: what is claimed is the
 * question, which names no shape.
 */
describe('the compiler asked of code written for the question', () => {
  const HERE = join(process.cwd(), 'imagined', 'src')

  const ANSWER = `
export type Answer =
  | { got: 'done'; body: unknown }
  | { got: 'refused'; reason: string }
  | { got: 'rejected' }
  | { got: 'locked' }
  | { got: 'wrong'; status: number }
  | { got: 'nothing' }
export declare function askTheServer(path: string, said: object): Promise<Answer>
export declare function draw(answer: Answer): void
`

  const HEAD = "import { askTheServer, draw, type Answer } from './askTheServer'\n"

  const OPEN: Record<string, string> = {
    'Narrowed.ts': "export async function A() { const a = await askTheServer('/x', {}); return a.got === 'done' }",
    'Folded.ts':
      "export async function A() { const a = await askTheServer('/x', {}); return a.got === 'refused' ? a.reason : null }",
    'Switch.ts':
      "export async function A() { const a = await askTheServer('/x', {}); switch (a.got) { case 'done': return 1; default: return 0 } }",
    'Element.ts': "export async function A() { const a = await askTheServer('/x', {}); return a['got'] }",
    'TakenApart.ts': "export async function A() { const { got } = await askTheServer('/x', {}); return got }",
    'Tested.ts': "export async function A() { const a = await askTheServer('/x', {}); return 'reason' in a }",
    'Spread.ts': "export async function A() { const a = await askTheServer('/x', {}); return { ...a } }",
    'Excluded.ts': "export function A(a: Exclude<Answer, { got: 'done' }>) { return a.got }",
    'Then.ts': "export function A() { return askTheServer('/x', {}).then((a) => a.got) }",
    'Voided.ts': "export function A() { void askTheServer('/x', {}) }",
    'Statement.ts': "export function A() { askTheServer('/x', {}) }",
    'Awaited.ts': "export async function A() { await askTheServer('/x', {}) }",
  }

  const NOT_OPEN: Record<string, string> = {
    /* Handed on whole, which is what a module of writes does: nothing is read. */
    'Returned.ts': "export function A() { return askTheServer('/x', {}) }",
    'Drawn.ts': "export async function A() { draw(await askTheServer('/x', {})) }",
    'Kept.ts':
      "let kept: Answer | null = null\nexport async function A() { kept = await askTheServer('/x', {}); return kept }",
    /* A `got` that is somebody else's: the type is what is asked, never the word. */
    'OtherGot.ts':
      "type Queue = { got: 'rows'; rows: string[] } | { got: 'unreadable' }\nexport function A(q: Queue) { return q.got === 'rows' }",
  }

  function opened(files: Record<string, string>): string[] {
    const all: Record<string, string> = { 'pages/account/askTheServer.ts': ANSWER }

    for (const [name, code] of Object.entries(files)) {
      all[`pages/account/${name}`] = HEAD + code
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
    /* A folder of the imagined project is a folder, or the compiler resolves nothing in it. */
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

    return [...new Set(openingsIn(program, HERE, underSrc).map((one) => one.file))]
      .filter((one) => one !== THE_ANSWER_IS_DEFINED_IN)
      .sort()
  }

  it.each(Object.keys(OPEN))('sees %s as a place that opens an answer or throws one away', (name) => {
    expect(opened({ [name]: OPEN[name] ?? '' })).toEqual([`pages/account/${name}`])
  })

  it.each(Object.keys(NOT_OPEN))('does not take %s for one', (name) => {
    expect(opened({ [name]: NOT_OPEN[name] ?? '' })).toEqual([])
  })
})

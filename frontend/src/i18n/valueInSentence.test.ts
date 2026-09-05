import ts from 'typescript'
import sr from './sr.json'
import { sources } from '../test/sources'

/**
 * Every sentence of the dictionary that has a value put into it, and — where the value is
 * written straight from the formatter module — which formatter writes it.
 *
 * **What this is for.** Serbian puts a word in a different case depending on what stands
 * around it: „Trke, 1. oktobar 2026." takes the nominative, „Učlanjenje se otvara 1.
 * oktobra 2026." the genitive, and no tool can tell which a sentence needs. What a tool
 * can do is refuse to let a new one arrive without anybody being asked. On 05.09.2026 two
 * had: the registration screen said the first under a verb, ten days from the period of
 * insight, and so did the message every inbox starts with (ADL A35).
 *
 * **Why it is written this way, which is the short version of six rounds of review.**
 * Every earlier draft tried to answer „is this value a formatted one", and every one of
 * them was found incomplete in a different direction: it named five of eight formatters,
 * then read only `.tsx`, then missed a value held in a constant, then missed a sentence
 * chosen by a ternary, then took the word a ternary is chosen by for a sentence, then
 * missed a value arriving through a helper function. Each fix was right and each left the
 * next direction open, because that question needs to follow a value through the code and
 * a guard cannot do that.
 *
 * So it stopped being asked. **What is frozen here is every sentence that takes a value at
 * all**, which is a question about the shape of a call and nothing else, and there is no
 * direction left for it to be incomplete in. The arrow is added where it can be read off
 * the same call without following anything, and its absence means „not written here", not
 * „not formatted".
 *
 * **What that costs, said plainly:** a new sentence with a value in it fails this until
 * somebody adds a line, which is the moment the question gets asked. That is the whole
 * point, and it is the only thing this guard does.
 *
 * **Where it still cannot see.** `t` bound under another name — nought of the hundred and
 * thirty three `useI18n()` bindings do that, all of them being `{ t }`, `{ locale, t }`,
 * `{ t, locale }` or `{ locale }`. And a key with no name written out in it is „?" with
 * its file rather than its own line, so several such calls in one file share an entry.
 * Both are written down rather than left to be found.
 */
/**
 * Which sentences a first word can name, by the shape of it and not by its letters.
 *
 * A choice contributes its two answers and never its question: read for words instead,
 * the word a sentence is chosen by went in as though it were a sentence of the dictionary
 * (review, 05.09.2026). Anything else names nothing, and `unknown` stands in for it.
 *
 * **One reading, because two of them disagreed.** For a while the question „is this a
 * sentence at all" read only a plain word while the question „which sentence" read all
 * four shapes, so a call through a renamed maker whose key was a choice of two real names
 * was neither counted nor marked: it vanished (review, 05.09.2026).
 */
/**
 * Whether a call is one of the dictionary's sentences being made.
 *
 * **The dictionary answers it, not a name.** A call whose first word names one of
 * `sr.json`'s own sentences is that sentence being made, whatever the thing making it is
 * called: `t` is handed to helpers as a value at twenty five places and one of them
 * renames it on the way in (`components/PriceTable.tsx`, where it arrives as `say`), so a
 * reading tied to the name had a live hole (review, 05.09.2026). A choice of two names
 * counts if either of them is one, which is the same reading `keysOf` gives.
 *
 * The name is still asked, and only where the first word names nothing: there is no
 * sentence to look up in those, so nothing but the name can say they are sentences at
 * all, and they end up as „?" with their file.
 */
function spoken(call: ts.CallExpression, said: Set<string>): boolean {
  const first = call.arguments[0]

  if (first !== undefined && !ts.isPropertyAccessExpression(call.expression)) {
    if (keysOf(first, '').some((one) => said.has(one))) {
      return true
    }
  }

  return ts.isIdentifier(call.expression) && call.expression.text === 't'
}

function keysOf(node: ts.Node, unknown: string): string[] {
  if (ts.isStringLiteral(node)) {
    return [node.text]
  }

  if (ts.isConditionalExpression(node)) {
    return [...keysOf(node.whenTrue, unknown), ...keysOf(node.whenFalse, unknown)]
  }

  if (ts.isParenthesizedExpression(node)) {
    return keysOf(node.expression, unknown)
  }

  return [unknown]
}

export function sentencesIn(path: string, code: string, said: Set<string>): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imported = new Set<string>()

  ts.forEachChild(source, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.endsWith('i18n/format')
    ) {
      const bound = node.importClause?.namedBindings

      if (bound !== undefined && ts.isNamedImports(bound)) {
        for (const one of bound.elements) {
          imported.add(one.name.text)
        }
      }
    }
  })

  /* Which sentences a key can name, by the shape of the key and not by its words. A
     choice contributes its two answers and never its question: read for words instead,
     the word a sentence is chosen by went in as though it were a sentence of the
     dictionary (review, 05.09.2026). */
  const unknown = `? (${path.split(/[/\\]/).slice(-1).join('')})`

  const found: string[] = []

  const walk = (node: ts.Node): void => {
    /* **Which call is a sentence being made, and it is not answered by a name.** The
       dictionary answers it: a call whose first word is a key of `sr.json` is that
       sentence being made, whatever the thing doing the making is called. `t` is handed
       to helpers as a value at twenty five places and one of them renames it on the way
       in (`components/PriceTable.tsx`, where it arrives as `say`), so a reading tied to
       the name had a live hole (review, 05.09.2026).

       The name is still asked, and only for the calls whose key is not written out: there
       is no key to look up in those, so nothing but the name can say they are sentences
       at all. */
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 1 &&
      spoken(node, said)
    ) {
      const [named, ...rest] = node.arguments

      if (named !== undefined) {
        const used = new Set<string>()
        const scan = (one: ts.Node): void => {
          if (ts.isIdentifier(one) && imported.has(one.text)) {
            used.add(one.text)
          }

          ts.forEachChild(one, scan)
        }

        rest.forEach(scan)

        const said = used.size > 0 ? ` <- ${[...used].sort().join(', ')}` : ''

        for (const key of keysOf(named, unknown)) {
          found.push(`${key}${said}`)
        }
      }
    }

    ts.forEachChild(node, walk)
  }

  walk(source)

  return found
}

/**
 * Every name the dictionary answers to, branches and leaves alike, which is what says a
 * call is one of its sentences being made. Read off the dictionary itself rather than
 * listed, so it cannot be behind.
 */
function namesOf(node: object, stem: string): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const full = stem === '' ? key : `${stem}.${key}`

    return typeof value === 'object' && value !== null
      ? [full, ...namesOf(value, full)]
      : [full]
  })
}

const SAID = new Set(namesOf(sr, ''))

describe('a sentence with a value put into it', () => {
  it('is one of exactly these, and nothing arrives among them unasked', () => {
    const said = [
      ...new Set(sources().flatMap(({ path, code }) => sentencesIn(path, code, SAID))),
    ].sort()

    expect(said).toEqual([
      /* The ones whose key is not written out: a template, or a name held in a variable.
         There is nowhere to look up which sentence that is, so the file stands in for it
         and several such calls in one file share this line. */
      '? (CategoryDonut.tsx)',
      '? (Counters.tsx)',
      '? (FormRenderer.tsx)',
      '? (Home.tsx)',
      '? (Payments.tsx)',
      '? (PendingQueue.tsx)',
      '? (ReportResult.tsx)',
      '? (ReviewQueue.tsx)',
      '? (SendBack.tsx)',
      'admin.form.deleteNamed',
      'admin.form.deleteSureNamed',
      'admin.form.keepNamed',
      'admin.form.openNamed',
      'admin.form.raceNumber',
      'admin.form.removeRow',
      'admin.ofMany',
      'admin.processingFee',
      'admin.racesOf',
      'admin.referralOpen',
      'admin.referralRunning',
      'admin.referralSettled',
      'admin.sectionNav',
      'admin.showing',
      'awards.category',
      'awards.position <- formatNumber',
      /* „Nov događaj {date}", and the date is written in numbers: „1. 10. 2026." has no
         month word in it, so it has no case to be wrong in. */
      'calendar.addOnDay <- formatShortDate',
      /* „Trke, {date}": the date stands after a comma as the thing being named, which is
         the nominative, and that is what this formatter gives. */
      'calendar.dayTitle <- formatDate',
      'calendar.more',
      'competitors.count',
      'crop.share <- formatNumber',
      'crop.tooSmall',
      'data.loadingPart',
      'ducats.again <- formatNumber',
      'ducats.everyMonth',
      'ducats.everySeason',
      'ducats.sentence <- formatNumber',
      'ducats.stepUp <- formatNumber',
      'event.allComments',
      'event.deleteAsk',
      'event.enterResultNamed',
      'event.fromEdition',
      'event.ratedBy',
      'event.rating.stars',
      'event.showingComments',
      'event.writeSubject',
      'event.writeTo',
      'event.written',
      'form.pasteCut',
      'form.suggested',
      'home.moreRuns',
      'home.place',
      'leagues.season',
      'membership.active',
      'membership.byCountry',
      'membership.chooseCategory',
      'membership.costs',
      'membership.firstSeasonClosed',
      'membership.firstSeasonOpen',
      'membership.inTeam',
      'membership.junior <- money',
      'membership.priceNow <- money',
      'membership.referralNote',
      'membership.renew',
      'membership.renewal',
      'membership.transferOpen',
      'messages.unread',
      'myResults.changeNamed',
      'myResults.sendAgainNamed',
      'newResult.again',
      'newResult.donePoints <- formatPoints',
      'pager.page <- formatNumber',
      'pager.showing <- formatNumber',
      'profile.allDucats',
      'profile.allResults',
      'profile.inClub',
      'profile.memberNumberLabel',
      'profile.memberSince',
      'profile.noneInSeason',
      'profile.racesWord',
      'profile.showingDucats',
      'profile.showingResults',
      'rankings.rowCount',
      'rankings.rowCountWomen',
      'registration.bioFull',
      'registration.bioLeft',
      'registration.doneText',
      /* „Učlanjenje se otvara {date}, za {count} dana.": a verb governs the date, so the
         genitive, and this is the sentence a review found wrong on 05.09.2026. */
      'registration.opensIn <- formatDayInSentence',
      'review.proof',
      'review.sweptLeft',
      'rights.box',
      'rights.granted',
      /* „{date}: sve trke tog dana…": the date opens the sentence as its subject. */
      'seo.calendarDay.recordDescription <- formatDate',
      'seo.calendarDay.recordTitle <- formatDate',
      'seo.competitor.awardsDescription',
      'seo.competitor.awardsTitle',
      'seo.competitor.recordDescription',
      'seo.competitor.recordTitle',
      'seo.event.recordDescription',
      /* „{name}, {date}": the race and then the day it is run, both named. */
      'seo.event.recordTitle <- formatDate',
      'seo.league.recordDescription',
      'seo.league.recordTitle',
      'seo.leagueResults.recordDescription',
      'seo.leagueResults.recordTitle',
      'seo.team.recordDescription',
      'seo.team.recordTitle',
      'seo.verificationQueue.queueDescription',
      'seo.verificationQueue.queueTitle',
      'shell.unread',
      'shell.waiting',
      'teams.editDone',
      /* The six an application to a team is made of, and one answer covers all of them:
         every value in them is a name, and a name here stands in the nominative because
         it is either the subject of the sentence („{name} se prijavljuje") or a proper
         name inside quotation marks („u tim „{team}""), which is how this portal has
         written a team's name since `teams.proposeDone`. Nothing in them is governed by a
         verb or a preposition that would ask for another case. */
      'teams.joinBody',
      'teams.joinDoneBody',
      'teams.joinDoneSubject',
      'teams.joinNoBody',
      'teams.joinNoSubject',
      'teams.joinSubject',
      'teams.proposeBody',
      'teams.proposeDone',
      'topBoards.place',
      'units.btlPoints <- formatPoints',
      'units.memberCount',
      'verification.activateAllAsk',
      'verification.approveAllAsk',
      'verification.approveAllDone',
      'verification.deleteNamed',
      'verification.foldCardNamed',
      'verification.openCardNamed',
      'verification.pictureAlt',
      'verification.sentBy',
      'verification.teamAccepted',
      'verification.teamAcceptedBody',
      'verification.teamChangeAccepted',
      'verification.teamChangeAcceptedBody',
      'verification.teamChangeOf',
    ])
  })

  it('knows the dictionary by its own names, and the frozen list cannot say so', () => {
    /* **Written because nothing else could fail for it.** Every call that makes a
       sentence is named `t` today, so the whole of the list above is held by the name
       alone and emptying this set changes nothing there — measured, and the whole guard
       stayed green (05.09.2026). What the set is for is the call whose maker is **not**
       named `t`, and the portal has no such call yet. So it is asked here directly.

       Branches as well as leaves, because a plural key is a branch (`one`, `few`,
       `other`) and is called by the name of the branch. */
    expect(SAID.has('teams.title')).toBe(true)
    expect(SAID.has('units.raceCount')).toBe(true)
    expect(SAID.has('units.raceCount.one')).toBe(true)
    expect(SAID.has('teams')).toBe(true)
    /* And nothing it does not say. */
    expect(SAID.has('nema.ovoga')).toBe(false)
    expect(SAID.has('')).toBe(false)
    /* A floor under the whole of it, so a reading that answers a handful cannot pass. */
    expect(SAID.size).toBeGreaterThan(1000)
  })

  it('is read by the shape of the call, which is all it ever asks', () => {
    /* A dictionary of its own, so the reading is measured against names written here
       rather than against whatever the portal happens to say today. */
    const KNOWN = new Set(['x.y', 'x.a', 'x.b', 'pricing.ranking'])
    const read = (path: string, code: string) => sentencesIn(path, code, KNOWN)
    const brought = "import { formatDate } from '../i18n/format'\n"

    /* A sentence with a value in it, whatever the value is. */
    expect(read('proba.tsx', "const a = t('x.y', { name: n })")).toEqual(['x.y'])
    /* And the arrow when the formatter is written in the same call. */
    expect(read('proba.tsx', `${brought}const a = t('x.y', { date: formatDate(d, l) })`)).toEqual([
      'x.y <- formatDate',
    ])
    /* Two of them, named in one order however they were written. */
    expect(
      read(
        'proba.tsx',
        "import { formatDate, money } from '../i18n/format'\nconst a = t('x.y', { b: money(m, l), a: formatDate(d, l) })",
      ),
    ).toEqual(['x.y <- formatDate, money'])
    /* A choice names both answers and never the question it is asked by. */
    expect(
      read('proba.tsx', `${brought}const a = t(p === 'results' ? 'x.a' : 'x.b', { d: formatDate(d, l) })`),
    ).toEqual(['x.a <- formatDate', 'x.b <- formatDate'])
    /* A key with no name written out in it is the file it stands in. */
    expect(read('proba.tsx', "const a = t(someKey, { name: n })")).toEqual(['? (proba.tsx)'])
    /* And a file that draws nothing is read the same, because ten `.ts` modules of this
       portal build sentences too. */
    expect(read('proba.ts', "const a = t('x.y', { name: n })")).toEqual(['x.y'])

    /* What it does not do. A sentence with nothing put into it is not one of these: it
       has no value whose case anybody could get wrong. */
    expect(read('proba.tsx', "const a = t('x.y')")).toEqual([])
    /* A value drawn on its own is a value and not a sentence. */
    expect(read('proba.tsx', `${brought}const a = <span>{formatDate(d, l)}</span>`)).toEqual([])

    /* And the arrow says „written here", not „not formatted". A value that reaches the
       sentence through a helper is still a sentence with a value in it and is still held,
       but the formatter behind it is not named — following one through the code is the
       question five earlier drafts of this tried to answer and none could (review,
       05.09.2026, `data/raceLabel.ts` among the live ones). */
    expect(read('proba.tsx', `${brought}const label = () => formatDate(d, l)\nconst a = t('x.y', { d: label() })`)).toEqual(
      ['x.y'],
    )

    /* And the name does not matter, which is the whole of why the dictionary answers
       this and not a name. `t` is handed to helpers as a value at twenty five places and
       one of them renames it on the way in, so a reading tied to the name had a live hole
       (review, 05.09.2026, `components/PriceTable.tsx`). */
    expect(read('proba.tsx', "const a = say('x.y', { name: n })")).toEqual(['x.y'])
    expect(read('proba.tsx', "const a = reci('pricing.ranking', { count: 1 })")).toEqual([
      'pricing.ranking',
    ])

    /* What is still asked of the name, and only there: a call whose first word names
       nothing has no sentence to look up, so only the name can say it is one. */
    expect(read('proba.tsx', 'const a = say(someKey, { name: n })')).toEqual([])

    /* And a choice of two real names through a maker with another name, which is where
       the two readings used to disagree: „is this a sentence" read one shape while „which
       sentence" read four, so this was neither counted nor marked and vanished (review,
       05.09.2026). */
    expect(read('proba.tsx', "const a = say(x ? 'x.a' : 'x.b', { count: 1 })")).toEqual([
      'x.a',
      'x.b',
    ])
    /* A choice named on one side only is named on one side only: the half nobody wrote
       out takes its values under „?", which breaks the list. Filtered away instead, that
       half is a sentence the list no longer holds and nobody is asked about; through a
       maker with another name the whole call disappears (review, 05.09.2026). */
    expect(read('proba.tsx', "const a = t(x ? 'x.a' : other, { name: n })")).toEqual([
      'x.a',
      '? (proba.tsx)',
    ])
    expect(read('proba.tsx', "const a = say(x ? 'x.a' : other, { name: n })")).toEqual([
      'x.a',
      '? (proba.tsx)',
    ])

    /* And a sentence is made by something called, not by something reached through
       another thing: `obj.say('x.y', …)` is a method of somebody else's object that
       happens to share a word with the dictionary. The portal writes none, and the
       condition that says so had nothing holding it. */
    expect(read('proba.tsx', "const a = obj.say('x.y', { name: n })")).toEqual([])

    /* And a word that is not one of the dictionary's names is not a sentence, whatever is
       called with it. Written as a word rather than as a list, because a list is not a
       word and this would pass without the dictionary being asked at all. */
    expect(read('proba.tsx', "const a = mineIn('team-dunav', mine, locale)")).toEqual([])
  })
})

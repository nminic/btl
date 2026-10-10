import ts from 'typescript'
import sr from './sr.json'
import { sources, WHOLE_PORTAL } from '../test/sources'

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

/** Every sentence the dictionary holds, with the name it is looked up by. `namesOf` above walks
 *  the same tree for the names alone; this one keeps the words, which is what a rule about what a
 *  sentence carries has to read. */
function wordsOf(node: object, stem: string): { key: string; text: string }[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const full = stem === '' ? key : `${stem}.${key}`

    return typeof value === 'object' && value !== null
      ? wordsOf(value, full)
      : [{ key: full, text: String(value) }]
  })
}

const SAID = new Set(namesOf(sr, ''))

describe('a sentence with a value put into it', () => {
  /**
   * No sentence the portal says carries a year of its own.
   *
   * **Three were found this way in one day, and each was a lie waiting for a date** (review,
   * 06.09.2026): the letter every member is greeted with named the season being prepared, the
   * line a member freed of the fee reads named the season they were freed of, and the label on
   * the beginner category named the season it applies to. All three were right while the year
   * they carried happened to be the current one, and all three would have started lying on a day
   * that can be named. Two of them were found only because a review read the dictionary by hand.
   *
   * **Derived, and with no list.** Every sentence in the dictionary, and the question is asked of
   * the sentence rather than of the screen that says it: a year that belongs in a sentence
   * arrives as a value, and `valueInSentence` above is where somebody then has to write it down.
   *
   * A year that is genuinely part of the words — the name of a rulebook, a season in a title —
   * would fall here and ask the question once, which is the point. There is none today.
   */
  it('carries no year of its own', () => {
    const every = wordsOf(sr, '')

    /* The floor is the sweep, not the finding: an empty answer to „which sentences carry a year"
       is the right answer and also what a walk over nothing gives. */
    expect(every.length, 'the dictionary still has sentences in it').toBeGreaterThan(WHOLE_PORTAL)

    const carried = every.filter(({ text }) => /(?<!\d)(19|20)\d\d(?!\d)/.test(text))

    expect(carried.map(({ key, text }) => `${key}: ${text}`)).toEqual([])
  })

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
      /* What is wrong with one cell of the table of races. The key is built from the cell and
         the reason (`admin/raceRows.ts`, `sentenceFor`), so it is not written into the call. The
         only values any of them take are the two bounds of the cell, in „Dozvoljene su
         vrednosti od {least} do {most}.": numbers written in figures after „od" and „do", with
         no separator for the thousands, so they have no case to be wrong in. */
      '? (EventRaces.tsx)',
      '? (FormRenderer.tsx)',
      '? (Home.tsx)',
      /* The rule beside the password, whose name is declared as a `hintKey` on the
         screen rather than written into the call: `t(PASSWORD_FIELD.hintKey, { count })`.
         That shape is not an accident and is not avoidable either. `forms/fieldHint.test.tsx`
         counts the rules the portal keeps by reading `hintKey`, so a rule typed straight
         into a call is a rule nothing counts, which is how three of them outlived the
         deletion of 31.08.2026. The value it takes is the one number this portal has for
         the length of a password (`pages/account/passwordRule.ts`). */
      '? (NewPassword.tsx)',
      '? (Payments.tsx)',
      '? (PendingQueue.tsx)',
      '? (ReportResult.tsx)',
      '? (ReviewQueue.tsx)',
      '? (SendBack.tsx)',
      /* The sentence a bare number gets from the decision route, chosen by
         `whatABareNumberSays` and handed the number: „Server je odgovorio brojem {status}".
         It stood under `PendingQueue.tsx` until R1 of the results flows, when the line that
         draws it moved, unchanged, into a module of its own so the table of results could
         draw it too. A status is written in figures after „brojem", so it has no case to be
         wrong in. */
      '? (WhatTheServerSaid.tsx)',
      /* The refusal a route named, looked up by the word the server sent rather than by
         a name written out here: `refusals[answer.reason]`. Which sentence that is
         cannot be read off the call at all, which is the case this row stands for.
         It stood under `ServerSaid.tsx` until 03.10.2026, when the working out of the
         sentence moved, unchanged, into `wordsFor` in this file, so the list of races an
         event's press did not save can say it without an alert per race
         (`admin/EventRaces.tsx`); `ServerSaid` calls it and has no such call left. */
      '? (serverWords.ts)',
      /* „Izbaci trku {race} iz lige": the race is named by `raceLabel`, which writes the
         race's own name and adds what parts it from the races beside it. No case to be
         wrong in - it stands after „trku" as the thing being named, and a proper name in
         Serbian keeps its written form there. */
      'admin.dropRaceNamed',
      /* „Ovim brišeš i {count} rezultata.", asked before an event is deleted (owner,
         28.09.2026). The value is a COUNT, so it governs the noun rather than being
         governed by one, and the three plural forms are where that is answered. */
      'admin.eventDeleteTakes',
      'admin.form.deleteNamed',
      'admin.form.deleteSureNamed',
      'admin.form.keepNamed',
      'admin.form.openNamed',
      'admin.form.raceNumber',
      'admin.form.removeRow',
      /* „Trke u ligi {name}", the accessible name of the box that folds on the list of
         competitions. The name of a competition stands after „u ligi", which governs the
         locative - and a competition's name is a proper name the portal never declines
         anywhere („Poredak takmičenja", „Događaji i trke, {name}"), so this is the same
         answer `leagues.countingOf` already gives one screen along. */
      'admin.leagueRacesOf',
      /* „U kalendaru nema nijednog događaja iz sezone {season}.", and the season is a
         number: a year written in figures has no case to be wrong in. */
      'admin.noEventsOfSeason',
      'admin.ofMany',
      /* „Trka {name} ({date}) nije obrisana", said under the table of races for a race an
         event's press meant to take away and the route kept (owner, 03.10.2026, „Događaj
         ostaje, trke čekaju"). The name is the race's own and stands as the subject, in the
         nominative its name is written in, so it has no case to be wrong in; and the day is
         written in figures, inside the brackets, with no word for the month. */
      'admin.race.notDeleted <- formatShortDate',
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
      /* „od {from} do {to}", the range a bar across several days says out loud
         (PDL P35, 21.09.2026). Both prepositions govern the genitive, so both dates
         take the case this formatter makes: „od 31. maja 2019. do 1. juna 2019." The
         nominative would give „od 31. maj 2019.", which is the very fault
         `formatDayInSentence` was written for on 05.09.2026. */
      'calendar.spanDays <- formatDayInSentence',
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
      /* The name of the competition inside the name of the control that opens its list of events
         and races, and inside the wait under it. Nominative, because the competition is what the
         box is about and nothing governs it: „Događaji i trke, RunTrace liga 2027". */
      'leagues.countingOf',
      'leagues.season',
      'membership.active',
      'membership.chooseCategory',
      /* The same fee said to the member, and the same move on the same day: it was
         `PROCESSING_FEE_EUR` written straight into the sentence and it is the served row
         now, so it is formatted like the two amounts either side of it. */
      'membership.costs <- money',
      'membership.feeExempt',
      'membership.firstSeasonClosed',
      'membership.firstSeasonOpen',
      'membership.inTeam',
      'membership.junior <- money',
      /* The team a member is about to leave, and the case it wants is the one
         `membership.inTeam` two lines up already asks for: „Sigurno izlaziš iz tima
         Nišavski maraton klub?" takes the nominative, exactly as „Trenutno si u timu
         Nišavski maraton klub." does, because the preposition „iz" governs the genitive of
         „tim" and leaves the name itself alone. No formatter writes it: `Team.name` is
         handed over as the server answers it. */
      'membership.leaveTeamAsk',
      'membership.priceNow <- money',
      'membership.referralNote',
      'membership.renewal',
      'membership.transferOpen',
      'messages.unread',
      'myResults.changeNamed',
      'myResults.sendAgainNamed',
      'newResult.again',
      /* `newResult.donePoints` stood here until 28.09.2026, when the confirmation of a
         result stopped printing what the run was worth (owner: „Ne vidim razlog da se
         ispisuju bilo kome prilikom unosa parametara prijave rezultata"). */
      'pager.page <- formatNumber',
      'pager.showing <- formatNumber',
      /* The racing pair, which the owner asked for on 07.09.2026: who is asking and for which
         season, whose pair the reader is already in, and who a broken pair was broken for. */
      'pair.brokenBody',
      'pair.endedBody',
      /* The season a pair runs in, and not the day it was made: that day is answered to
         nobody since 13.09.2026 and is drawn nowhere. */
      'pair.forSeason',
      'pair.inviteBody',
      'pair.received',
      'pair.sent',
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
      'seo.team.recordDescription',
      'seo.team.recordTitle',
      'seo.verificationQueue.queueDescription',
      'seo.verificationQueue.queueTitle',
      /* What the server answered, in the case where the screen can only repeat it: the
         name of a refusal this portal does not know. A value the server chose, so it
         cannot be written into the words. The number of an answer that is not one of the
         shapes the portal reads is the same kind of value, and its sentence is chosen at
         run time (`pages/account/serverWords.ts`), so it stands under the two files that
         ask for it, `? (serverWords.ts)` and `? (PendingQueue.tsx)`, and not under a name
         of its own: `server.wrong` stood here until 02.10.2026, when the last screen that
         wrote its key into a call went through that function instead. */
      'server.refused',
      /* The number of the account somebody is signed in as, in the header, and it takes
         no case at all: the sentence is „Nalog 41", the word stands first and the number
         after it is a label rather than a thing being counted. It is drawn only where the
         league has given the caller no number - administration, and somebody who has
         registered and is not a member yet (app/AccountMenu.tsx).

         **This is the THIRD reason written here and the first two both expired**: „a
         portal still reading its members out of `/mock`", which went with the mock on
         21.09.2026, and „a portal that does not read one off `GET /api/me` yet", which
         went on 24.09.2026 when it began to. The sentence is still drawn, and what has
         changed each time is only who reads it. */
      'shell.accountNumber',
      'shell.unread',
      'shell.waiting',
      'teams.editDone',
      /* And the four an invitation is written with. Same answer as the ones below and for the
         same reason: every value is either the team's name inside quotation marks, which is
         how this portal has written a team since `teams.proposeDone`, or the invited member's
         name at the head of a sentence, which is the nominative for the same reason
         `admin.form.deleteNamed` is. `inviteMissedBody` carries both at once.

         TWO WENT FROM THIS LIST ON 10.10.2026 (T5) AND THEIR KEYS DID NOT: `teams.inviteSubject`
         and `teams.inviteBody`, the message „Pozovi u tim" wrote into the session. The press
         sends `POST /api/teams/{id}/invitations` since that day and the server writes the
         message (`TeamJoiningWriteApi.theInvitationReads` and `theInvitationBodyReads`), so no
         screen makes either sentence. The keys stay for the reason given below for the four
         that went on 29.09.2026: `TeamJoiningWriteApiTest.theSentencesAreThePortalsOwnWords`
         holds both against the Java that writes them. */
      'teams.inviteAccepted',
      'teams.inviteMissedBody',
      'teams.inviteOvertaken',
      /* The third control of the same kind, added 29.09.2026 with the team's own queue going
         to the server: „Povuci poziv: {name}", a person's name after a colon, which is the
         nominative for the same reason `teams.joinRefusedNamed` is. The two sentences beside
         it (`teams.decideRefused.*`) take no value at all and are not here. */
      'teams.inviteWithdrawNamed',
      'teams.invited',
      /* The four an answer to an application is written with, and the two that name the
         member each control is about. One answer covers all six: every value is either the
         team's name inside quotation marks, which is how this portal has written it since
         `teams.proposeDone`, or a person's name after a colon, which is the nominative for
         the same reason `admin.form.deleteNamed` is. */
      /* FOUR WENT FROM THIS LIST ON 29.09.2026 AND THEIR KEYS DID NOT: `teams.joinDoneBody`,
         `joinDoneSubject`, `joinNoBody` and `joinNoSubject`. They were the messages the team's
         own page posted into the applicant's inbox out of the session; the server writes them
         now (`TeamJoiningWriteApi.heIsInTheTeamReads` and its three neighbours), so no screen
         makes those sentences and this list is derived from the calls that do.

         THE KEYS THEMSELVES ARE STILL LOAD-BEARING AND MUST NOT BE DELETED, which is measured
         rather than assumed: `TeamJoiningWriteApiTest.theSentencesAreThePortalsOwnWords` reads
         `frontend/src/i18n/sr.json` and holds all four against the Java that writes them, so
         the dictionary is where that Serbian sentence is decided even though nothing on this
         side draws it. */
      'teams.joinRefusedNamed',
      'teams.joinTakenNamed',
      'teams.proposeBody',
      'teams.proposeDone',
      'topBoards.place',
      /* The races a pair ran together, under the points they scored on them (owner, 04.08.2026).
         A plural, so the number decides which of the three Serbian forms the sentence takes. */
      'topBoards.sharedRaces',
      'units.btlPoints <- formatPoints',
      'units.memberCount',
      'verification.approveAllAsk',
      'verification.approveAllDone',
      /* „{whose}, sezona {season}." - the name and the year under the question asking whether
         a season is to be granted free of the fee. Both stand as the thing being NAMED, which
         is the nominative and is what a name arrives as; a year in figures has no case to be
         wrong in. The season is written straight in for the same reason
         `verification.paymentsSeason` is - see the note on it below - and the name comes off
         the served row rather than off a session, because the moderator is being asked about
         somebody who is not him. */
      'verification.askExemptionWhose',
      /* „Aktivacija članstva: {whose}, sezona {season}." - the same pair after a colon, which
         is again the nominative. Two sentences and not one because they head two different
         questions, and the owner's grid asks them of different rows. */
      'verification.askGround',
      /* „Balans: {amount}", „Očekivan iznos: {amount}" and, since 10.10.2026, „Članarina:
         {amount}". The amount arrives already written with its currency („12,75 EUR"), which is
         the shape `pages/member/Membership.tsx` already writes for the member's own side of this.
         After a colon it is the thing being named, so the nominative, and the currency is a code
         that never declines.
         AND THE AMOUNT IS NEVER A BARE NUMBER: it is put together by one helper on the screen
         so that the number and the currency cannot come apart, which matters because the two
         currencies stand in NO ratio anywhere in this portal - there is no rate in it at all.
         The third is the owner's choice of 10.10.2026 for the prompt of the balance (PDL, the entry
         „Odgovori na pitanja skupljena dok je bio odsutan", item „Članstvo i uplate"), and it is
         the fee WITHOUT the processing charge: `MembershipDue.price`, not `expected`. */
      'verification.askGroundBalance',
      'verification.askGroundExpected',
      'verification.askGroundFee',
      /* „Nedostaje: {amount}" - what is still missing under the question „Prihvatam umanjen
         ukupan iznos? Da / Ne", which is the owner's cases 3 and 3b (PDL section 19). After a
         colon it is the thing being named, so the nominative, exactly as the two amounts above
         it; and it is written by the same helper on the same screen, so the number and its
         currency cannot come apart.
         WHAT THE NUMBER IS, and it is worth saying on this line because the case is the easy half
         of the question: it is the shortfall left AFTER everything being counted - what arrived,
         plus the balance where the box is ticked - and never the expected amount and never the
         balance. The owner's own sentence for case 3 is what fixes that („ukljucen balans koji
         kad se iskoristi POTPUNO i dalje nije ukupan zbir jednak ocekivanog"), so the moderator
         is accepting a total short by this much rather than being shown what the fee was. */
      'verification.askShortfallShort',
      'verification.deleteNamed',
      'verification.foldCardNamed',
      /* „uključi balans ({amount})" - the owner's own label for the tick box, with the amount
         in brackets so it is read as an aside rather than as part of the instruction. In
         brackets it is the nominative. The value is the member's balance IN HIS CURRENCY, and
         that is the owner's decision of 27.09.2026 rather than a choice made here: when the
         balance covers a difference, both numbers have to be in one currency for the taking
         away to be visible at all. */
      'verification.includeBalance',
      'verification.openCardNamed',
      /* „Uplaćeno ({currency})" - the name of the field the moderator types into, and the
         value is a currency CODE rather than an amount, so there is nothing to format and no
         case to get wrong. It is in the name rather than only beside the box because a reader
         who cannot see the mark would otherwise be told which amount to type and not in what,
         on a screen where the row above may be in the other currency. */
      'verification.paidIn',
      /* A YEAR, AND IT IS THE ONE VALUE HERE THAT MUST NOT GO THROUGH A FORMATTER. The
         season arrives off the answer as a number, and `formatNumber` would write 2.027 in
         Serbian, which is a thousands separator inside a year. Written straight into the
         sentence for that reason, and the reason is on this line because it is exactly the
         question this gate exists to make somebody ask.
         `verification.activateAllAsk` left this list on the same day: the sweep that asked
         it is gone from the screen of payments, because on a derived list a row means „no
         money has arrived" and one press would have activated every debtor at once. */
      'verification.paymentsSeason',
      /* `verification.pictureAlt` left this list on 27.09.2026 when the only call passing a
         value into it went with the frame it named (`admin/PendingQueue.tsx` said the whole
         of why). It is back: `WaitingPicture` feeds it `{ who: item.who }` for the picture
         served from `GET /api/verification/{id}/photo` (PR 399), and the guard in
         `data/theRealAnswer.test.tsx` is written against exactly this literal call. */
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

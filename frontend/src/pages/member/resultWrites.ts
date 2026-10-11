import { clearResourceCache } from '../../data/client'
import { theInboxHasChanged } from '../../data/useResource'
import { askTheServer, type Answer } from '../account/askTheServer'

/**
 * A MEMBER'S OWN THREE WRITES ABOUT A RESULT: SENDING ONE IN, ASKING FOR IT TO BE PUT
 * RIGHT, AND TAKING IT BACK.
 *
 * <p>`ResultWriteApi` has answered all three since it was written and until this module
 * nothing on the portal called any of them: measured 28.09.2026 on `origin/main`,
 * `grep -rn "api/results" frontend/src` found only comments and test mocks, and none of
 * the 29 callers of `askTheServer` named this route. The three screens wrote to the
 * browser's own overlay and told the member it was sent.
 *
 * <p><b>A module of its own rather than a function inside each screen</b>, which is
 * `member/teamWrites.ts`'s shape and its reason: `askTheServer` lives under
 * `pages/account` and `data/` imports nothing from `pages/`, so the one place that may
 * hold both the write and the caches it drops is a module on this side of that line.
 * `react/only-export-components` asks the same thing from the other direction.
 *
 * <p><b>WHICH ADDRESS EACH ROAD TAKES, BECAUSE TWO KEYS ON THESE SCREENS LOOK ALIKE AND ARE
 * NOT.</b> Both `PUT` and `DELETE` go through `ResultWriteApi.his`, which reads
 * `from result r ... where r.id = ? and r.competitor_id = ?`, so both take a
 * <b>`result.id`</b> - a run somebody has already counted. `GET /api/results` serves that
 * very id (`ResultApi`), so `Result.id` is the number these addresses take.
 *
 * <ul>
 * <li>`MyResults.tsx`'s „Obriši" in the table of COUNTED results, and `NewResult.tsx`'s
 * `?ispravka=` road, are about a `result`.
 * <li>`NewResult.tsx`'s `?ponovo=` road is about a run a moderator SENT BACK, whose key is a
 * submission's (`GET /api/me/result-submissions`, `SentRun.id`). No route takes that key, and
 * none is needed: sending it again is sending a run, so a fresh run goes to `POST` and a sent-back
 * correction goes to `PUT` on the result it corrects (`SentRun.amendsResultId`). The owner's
 * choice of 10.10.2026, in the record's wording: „sada ponovno slanje odbijene prijave preko
 * postojećih ruta".
 * <li>A run that is still WAITING is not changed or taken back from these screens at all until a
 * separate piece of work gives it routes of its own, which is the other half of the same choice:
 * „„Izmeni" i „Obriši" na prijavi koja čeka se skrivaju do zasebnog posla".
 * </ul>
 *
 * <p><b>The list of what was sent is the server's since R2 of the results flows</b>, read off
 * `GET /api/me/result-submissions`. Until then it was the browser's own overlay, written after
 * every one of these writes, and it was the only view of a waiting run there was.
 */

/** Where a run is sent. One address for both doors, which is what makes them one act. */
export const A_RUN_IS_SENT_TO = '/api/results'

/**
 * Where a counted result is corrected or taken back.
 *
 * @param result `result.id`, as `GET /api/results` serves it and as the address
 *               `?ispravka=` carries it
 */
export function theResultAt(result: number): string {
  return `${A_RUN_IS_SENT_TO}/${String(result)}`
}

/**
 * EVERY REASON `ResultWriteApi` CAN ANSWER WITH, each to a sentence.
 *
 * <p><b>One map for all three routes rather than one per route, and that is the floor
 * deciding the shape rather than tidiness.</b> The reasons come from three places in the
 * one class - constants it declares, constants it borrows from `EventWriteApi` for the
 * town, and the words `WHY_NOT` gives the outcomes of `ProofThatTheRunHappened` - and
 * `resultWrites.test.ts` reads all three out of the Java source. Which of the three routes
 * can reach which reason is a different question, and answering it means following a value
 * from a constant through two private methods to a `return`: the shape `CLAUDE.md` says
 * has no bottom, because every round finds one more hop. Split three ways, the lists would
 * be mine; kept as one, the list is the compiler's.
 *
 * <p>What that costs is a screen able to say a sentence its own route cannot produce,
 * which costs the reader nothing. What it buys is the other direction: a reason added to
 * that class fails a case here on the day it is written, rather than reaching a member as
 * a bare word.
 *
 * <p><b>`theFormIsNotComplete` is one name for many causes and the sentence says so.</b>
 * The route answers it for a missing figure, a length past the scale the column keeps, a
 * climb below nought, a time of nought, a race with no name and a kind that is not one of
 * the three. Pointing at one box would point at the wrong one most of the time, which is
 * the same reading `WHEN_CHANGING_MY_PASSWORD` gives its own shared name.
 */
export const WHEN_A_RESULT_IS_WRITTEN: Record<string, string> = {
  theFormIsNotComplete: 'results.refused.theFormIsNotComplete',
  /* The calendar has no race under that number. Reachable from the form away from the
     calendar, where a race chosen from the list carries its id and the list is a read of
     the calendar that may be older than the write. */
  theRaceIsNotKnown: 'results.refused.theRaceIsNotKnown',
  /* PDL, owner, 11.08.2026: „Ne sme, ne može biti rezultata u budućnosti." The day of the
     race itself counts as run, on the server and on both forms. */
  theRaceHasNotBeenRun: 'results.refused.theRaceHasNotBeenRun',
  /* The body both picked a race out of the calendar and described one. Unreachable by
     construction now that each door builds its body by road, and answered because that
     construction is exactly what a later hand could undo. */
  theRaceIsNamedTwice: 'results.refused.theRaceIsNamedTwice',
  /* The town, borrowed from `EventWriteApi` so that one rule answers in one voice all over
     the portal (owner, 11.08.2026: „Jedna kontrola i jedno pravilo za ceo portal, ne dva
     slična"). Reachable only from the road where the member describes a race. */
  theTownIsNotSaidOnce: 'results.refused.theTownIsNotSaidOnce',
  theTownIsNotKnown: 'results.refused.theTownIsNotKnown',
  theCountryIsNotKnown: 'results.refused.theCountryIsNotKnown',
  theCountryBelongsToATypedTown: 'results.refused.theCountryBelongsToATypedTown',
  aTypedTownNamesItsCountry: 'results.refused.aTypedTownNamesItsCountry',
  /* The three the proof rule names (`ProofThatTheRunHappened`). The forms ask for a link
     unless a picture stands in for it, so the first two are what a body that went round a
     form would meet; the third is a link that is not a web address, which a form does not
     judge. */
  nothingShowsItHappened: 'results.refused.nothingShowsItHappened',
  aPhotographNeverStandsAlone: 'results.refused.aPhotographNeverStandsAlone',
  aLinkThatIsNotALink: 'results.refused.aLinkThatIsNotALink',
}

/** The four figures every body carries, whichever of the three writes it is. */
type Figures = {
  distanceKm: number
  ascentM: number
  descentM: number
  seconds: number
}

/** And the proof, which is the same pair on every road (PDL P9). */
type Proof = {
  link: string
  comment: string
}

/**
 * A RUN ON A RACE THE CALENDAR HOLDS.
 *
 * <p><b>The race and NOTHING ELSE ABOUT IT, and that is the whole of why the two bodies
 * are two types.</b> `ResultWriteApi.fromTheCalendar` answers `theRaceIsNamedTwice` when
 * `raceName`, `raceKind`, `placeId`, `city` or `country` arrives beside a `raceId`, and
 * measured on 28.09.2026 the screen's own record carried `raceKind`, `city` and `country`
 * on every road - so a body built the old way would have been refused on <b>every</b> race
 * picked out of the calendar. The race answers for its kind, its town and its day; asking
 * the member to restate them is what the id is instead of.
 *
 * <p>The four figures travel even where the race fixes them, because which ones it fixes
 * is the server's answer and not this screen's: `figuresOf` takes the length, climb and
 * fall off a race of a length and the time off a race to a limit, and ignores what came
 * with the request. Sending them costs nothing and deciding here would be a second opinion
 * about a question that already has one home.
 */
export type ARunFromTheCalendar = Figures &
  Proof & {
    /** `race.id`, which is the one thing that says „do not make a race for this". */
    raceId: number
  }

/**
 * A RUN ON A RACE THE CALENDAR DOES NOT HOLD, where the member answers for all of it.
 *
 * <p>PDL: „Član sme da unese trku koje nema u kalendaru. Tada administrator kreira događaj
 * i trku uz rezultat, i sve troje nastaje istovremeno." So everything an approval will need
 * to make an event and a race out of travels here, at the one moment somebody knows it.
 *
 * <p><b>The town goes by NAME and COUNTRY, and `placeId` is deliberately not sent.</b>
 * That is `Registration.tsx`'s decision word for word and for its measured reason: the
 * route takes exactly one of the two shapes and refuses both together, and `PlaceField`
 * writes a town's name and its country code, never the GeoNames mark `placeId` means. A
 * mark has no source anywhere in the values, so sending the key that is there instead
 * would be sending a different town's number - the very fault `EventWriteApi` carried
 * until 19.09.2026.
 */
export type ARunDescribed = Figures &
  Proof & {
    raceName: string
    /**
     * The day it was run, named `day` and not `date`.
     *
     * The record on the server calls it `day` (`ResultWriteApi.Ran`), and a key by any
     * other name arrives as `null` and is answered `theFormIsNotComplete` about a date the
     * member filled in. Written as `yyyy-MM-dd`, which is what `storedDate` gives and what
     * Jackson reads a `LocalDate` from.
     */
    day: string
    /** One of the three words `WhatARaceCarries.KINDS` holds. Measured 28.09.2026: the
     *  server's set is `length`, `time`, `free`, which is `RACE_KINDS` exactly, so what the
     *  select holds goes over unchanged. */
    raceKind: string
    city: string
    country: string
  }

/**
 * A CORRECTION, WHICH IS THE NUMBERS AND THE PROOF AND NOTHING ELSE.
 *
 * <p>There is no race on it and that is PDL rather than an omission. Owner, 27.08.2026:
 * „Menja se sve osim trke. Ko je pogrešio trku, briše rezultat i unosi nov." The route
 * declares no field for one either, so a race sent here would be a key nothing reads.
 */
export type ACorrection = Figures & Proof

/**
 * THE POINTS ARE WORKED OUT ON THE SCREEN FROM THE FIGURES THE SERVER WOULD COUNT, which closed
 * the one road on which the screen's number and the server's could differ.
 *
 * <p>The screen works them out for the row it draws while a run waits (`MyResults.tsx`), and the
 * server works them out again when the run is approved, because they are never accepted from a
 * request. Until R2 of the results flows the row was the browser's own record of what the member
 * TYPED, and on a race to a limit the server takes the time off the race (`WhatARaceCarries.
 * figuresOf`): measured on 28.09.2026, a member who typed five hours against a six hour limit over
 * 50 km with 1000 up and 1000 down was shown 41,19 where the server stores 27,90, 48 per cent high.
 * The row is read off `GET /api/me/result-submissions` now, whose figures are `figuresOf`'s answer
 * over the race as it stands today, so the screen and the server count the same four numbers.
 *
 * <p><b>Whether a number belongs beside a run that waits at all is still a question for the
 * owner</b> (PENDING, 29.09.2026): his decision of 28.09.2026 took it off the two forms („Ne vidim
 * razlog da se ispisuju bilo kome prilikom unosa parametara prijave rezultata") and said nothing
 * about this list, so the list keeps it, with the sentence that says it is not final.
 */

/**
 * WHAT IS NO LONGER TRUE AFTER A RUN OR A CORRECTION IS WRITTEN, AND IT IS NOT THE
 * RESULTS.
 *
 * <p><b>`results` is deliberately left alone on both, which is the one thing this file
 * could get wrong in the direction nobody would notice.</b> Neither write touches the
 * `result` table: PDL, „Rezultat ulazi u rang liste <b>tek posle odobrenja</b>", and for a
 * correction the owner decided it twice over on 28.08.2026 - „Stari rezultat ostaje u
 * poretku dok ispravka čeka, i menja se tek kad je moderator odobri" - against a
 * measurement of what the other answer cost, a profile falling from 180 runs and 1.752,86
 * points to 179 and 1.744,60 with no way back. Dropping `results` here would send every
 * board, every profile and every league table to re-read a list that has not moved.
 *
 * <p>What HAS moved: the member's own list of what he sent, which holds the new row; his
 * inbox, because the route writes him a line about it inside the same transaction
 * (`ResultWriteApi.tell`; a run sent in is told there and nowhere else since 09.10.2026, and a
 * correction is posted as well); and the moderator's queue, because the row that waits is a new
 * item in it. The queue is dropped for the same member who may be reading it: a moderator is a
 * member too and sends in his own runs.
 */
function whatAWaitingRowChanges(): void {
  clearResourceCache('me/result-submissions')
  clearResourceCache('verification')
  theInboxHasChanged()
}

/**
 * WHETHER THE SERVER HAS JUST SAID THAT A COUNTED RESULT IS NOT THERE, which is the one refusal
 * of these routes that proves what the screen is drawing is out of date.
 *
 * <p>`ResultWriteApi.his` answers an empty 404 for a result that is not there and for one that is
 * not his alike (ADL A8), and a result of his own that is not there is one taken back in another
 * tab or by another hand since this visit read the list. The list goes on drawing it, and goes on
 * drawing a correction of it that the server has already removed with it
 * (`result_submission_amends_fk` cascades). So both answers are dropped here and the screen that
 * stays reads them again: the class the review of T5 named on 10.10.2026, a list read once per
 * visit that has to be read again when a refusal says it is stale and not only after the screen's
 * own success (PENDING, „Odbijanje koje dokazuje da je ekran zastareo ostavlja zastareo crtež").
 *
 * <p><b>Nothing else is read that way</b>: a refusal by name is about what was typed, and an
 * answer that never came, a 403 or a 5xx says nothing about what is on the server, so none of them
 * moves a list.
 */
export function saysTheResultIsGone(answer: Answer): boolean {
  return answer.got === 'wrong' && answer.status === 404
}

/** Drops what a 404 about a counted result has shown to be out of date (see
 *  {@link saysTheResultIsGone}), and nothing on any other answer. */
function whatAResultThatIsGoneChanges(answer: Answer): void {
  if (saysTheResultIsGone(answer)) {
    clearResourceCache('results')
    clearResourceCache('me/result-submissions')
  }
}

/**
 * Sends one run, from either door or sent again, and says what came back.
 *
 * <p><b>The caches are dropped only where the server agreed</b>, which is the axis this
 * function cannot get wrong and is `member/teamWrites.ts`'s own rule in its own words: a
 * portal that dropped them on the asking would draw a member a queue item the server never
 * took.
 */
export async function theRunWasSentIn(run: ARunFromTheCalendar | ARunDescribed): Promise<Answer> {
  const answer = await askTheServer(A_RUN_IS_SENT_TO, run)

  if (answer.got === 'done') {
    whatAWaitingRowChanges()
  }

  return answer
}

/**
 * Asks for a counted result to be put right, which makes a submission and leaves the
 * result standing.
 *
 * @param result `result.id` of the run being corrected
 */
export async function theCorrectionWasSentIn(
  result: number,
  correction: ACorrection,
): Promise<Answer> {
  const answer = await askTheServer(theResultAt(result), correction, 'PUT')

  if (answer.got === 'done') {
    whatAWaitingRowChanges()
  }

  whatAResultThatIsGoneChanges(answer)

  return answer
}

/**
 * TAKES A COUNTED RESULT BACK, AND THIS IS THE ONE OF THE THREE THAT REALLY MOVES THE
 * STANDING.
 *
 * <p>Owner, 27.08.2026: „član ga ili briše (ima pravo na to, iako je verifikovan)...",
 * and „Verifikacija je provera tačnosti, ne prenos vlasništva nad zapisom". Owner again,
 * 25.09.2026: „Čovek ima pravo da obriše svoj rezultat bez javljanja i time se i tabele i
 * obračuni automatski ažuriraju."
 *
 * <p><b>So `results` is dropped here and only here</b>, and with it everything drawn from
 * it: the boards, the profile and the league tables all read that one resource
 * (`data/derive.ts`), so there is no second name to drop for them. `verification` goes too,
 * and so does the member's own list of what he sent, because `result_submission_amends_fk`
 * cascades and any correction that was waiting on this result or was sent back went with it:
 * the queue a member who is also a moderator reads, and his own list, would otherwise each draw a
 * row pointing at a run nobody can see.
 *
 * <p>The boundary the owner was shown before he chose, written here rather than left to be
 * found: „tabele se automatski ažuriraju" is about the RUNNING season. Past a freeze, a
 * change shows on that member's own profile and nowhere else (PDL).
 */
export async function theResultWasTakenBack(result: number): Promise<Answer> {
  const answer = await askTheServer(theResultAt(result), {}, 'DELETE')

  if (answer.got === 'done') {
    clearResourceCache('results')
    whatAWaitingRowChanges()
  }

  whatAResultThatIsGoneChanges(answer)

  return answer
}

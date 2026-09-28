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
 * <p><b>WHICH THREE, BECAUSE TWO SCREEN ACTIONS THAT LOOK LIKE THESE ARE NOT THESE.</b>
 * Both `PUT` and `DELETE` go through `ResultWriteApi.his`, which reads
 * `from result r ... where r.id = ? and r.competitor_id = ?`, so both take a
 * <b>`result.id`</b> - a run somebody has already counted. `GET /api/results` serves that
 * very id (`ResultApi`), so `Result.id` is the number these addresses take.
 *
 * <ul>
 * <li>`MyResults.tsx`'s „Obriši" in the table of COUNTED results, and
 * `NewResult.tsx`'s `?ispravka=` road, are about a `result`. They are these routes.
 * <li>`MyResults.tsx`'s „Obriši" in the list of what has been SENT, and
 * `NewResult.tsx`'s `?ponovo=` road, are about a `Submission` - a question the member
 * asked, whose key is a string the browser itself minted (`session/context.ts`). There is
 * no route for either, and that is deliberate rather than missing: `ResultWriteApi` writes
 * it out - „<i>Withdrawing a submission that is still waiting. That is a different row in
 * a different table and a different verb, and PDL keeps them apart</i>". Those two stay on
 * the overlay and this module must not be reached for them.
 * </ul>
 *
 * <p><b>AND THE SENT LIST STAYS IN THE BROWSER, WHICH IS A BOUNDARY AND NOT AN
 * OVERSIGHT.</b> Measured the same day: no route serves a member his own submissions. The
 * only route that reads `result_submission` to serve anything is `GET /api/verification`,
 * the moderator's queue. So after a write lands, the row really stands on the server, and
 * what „Poslato" draws is still the overlay. Writing the overlay as well is therefore not
 * a second home for one fact but the only view there is; it is written <b>after</b> the
 * server agreed, never before, which is `member/teamWrites.ts`'s own rule.
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
 * A BOUNDARY, WRITTEN DOWN RATHER THAN LEFT TO BE FOUND: THE POINTS ARE WORKED OUT TWICE,
 * AND ON ONE ROAD THE TWO ANSWERS CAN DIFFER.
 *
 * <p>The screen works them out to say what the run earned the moment it is sent, which PDL
 * P9 asks for („Član odmah po unosu vidi koliko je bodova dobio"), and the server works them
 * out again because they are never accepted from a request. The two agree everywhere but one
 * place.
 *
 * <p><b>Where they can differ.</b> `ResultWriteApi.figuresOf` takes the time off the RACE for
 * a race run to a limit („jer je zadato trkom", owner 29.08.2026), and the length, climb and
 * fall off the race for a race of a length. Every road but one hands the screen those same
 * figures: `pages/event/reportForm.ts` drops the time boxes on a timed race altogether, and
 * `member/racesToOffer.ts` fills and locks them with the race's own limit when a race is
 * picked out of the list. The form for correcting a COUNTED result does neither - it keeps
 * the three boxes open, seeded from the record - so a member correcting a result on a timed
 * race may type a time the server will then ignore.
 *
 * <p><b>What that costs, as arithmetic rather than a worry.</b> On a six hour limit over 50 km
 * with 1000 up and 1000 down, a member who types five hours is shown 41,19 while the server
 * stores 27,90: the screen is 48 per cent high. What keeps it from being worse is that the
 * screen already says the number is not the last word on every one of these roads
 * (`newResult.pointsNotFinal`, PDL 30.08.2026 point 8), so nobody is shown a settled figure.
 *
 * <p><b>Why this increment does not close it.</b> Which of the two answers a member should be
 * shown BEFORE verification is a decision nobody has made, and this increment carries none.
 * <b>It is also unreachable with today's data, measured rather than assumed:</b>
 * `test/mock/races.json` holds 1612 races and every one of them is of a length, so no counted
 * result stands on a timed race at all. The day one does, this is where it was written down.
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
 * <p>What HAS moved is the member's own inbox, because the route writes him a line about
 * it inside the same transaction (`ResultWriteApi.tell`, and PDL P22 makes both of these
 * messages mandatory), and the moderator's queue, because the row that waits is a new item
 * in it. The queue is dropped for the same member who may be reading it: a moderator is a
 * member too and sends in his own runs.
 */
function whatAWaitingRowChanges(): void {
  clearResourceCache('verification')
  theInboxHasChanged()
}

/**
 * Sends one run, from either door, and says what came back.
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
 * because `result_submission_amends_fk` cascades and any correction that was waiting on
 * this result went with it - a queue the member is also a moderator of would otherwise
 * draw a row pointing at a run nobody can see.
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

  return answer
}

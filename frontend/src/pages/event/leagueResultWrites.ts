import { clearResourceCache } from '../../data/client'
import { theInboxHasChanged } from '../../data/useResource'
import { askTheServer, type Answer } from '../account/askTheServer'
import type { FiguresSent } from './leagueResultRows'

/**
 * WHAT THE LEAGUE SENDS WHEN IT ENTERS, CHANGES OR DELETES A MEMBER'S RESULT FROM THE EVENT PAGE,
 * and what it is told back (`ResultsByTheLeagueApi`, PDL P9, 18.10.2026).
 *
 * <p><b>The refusals of that route, by name</b>, held to the Java source by
 * `pages/account/refusals.test.ts`: every reason the class declares has a sentence here, and nothing
 * here is a reason the class cannot give. The words are proposals: the owner changes them on QA
 * (the coordinator, 19.10.2026). Two of them already had words for the MEMBER'S own report
 * (`results.refused.heHasAResultOnThisRace`, „Za ovu trku već imaš rezultat"), which speak to the
 * member about himself; a moderator reads them about somebody else, so this screen has its own.
 *
 * <p>The three the route borrows from `CompetitorWriteApi` (the empty save, the save of too many
 * rows) and from `ResultWriteApi` (the run that is not whole) are answered here too, and they are on
 * the gate by the files that declare them.
 */
export const WHEN_THE_LEAGUE_ENTERS_RESULTS: Record<string, string> = {
  /* The whole save, when one or more rows are named below it: nothing was written. */
  aRowIsWrong: 'leagueResults.refused.aRowIsWrong',
  theMemberIsNotKnown: 'leagueResults.refused.theMemberIsNotKnown',
  theMemberIsNamedTwice: 'leagueResults.refused.theMemberIsNamedTwice',
  /* PDL P6, 09.09.2026: „Član ima najviše jedan rezultat na jednoj trci". */
  heHasAResultOnThisRace: 'leagueResults.refused.heHasAResultOnThisRace',
  /* PDL P9, 18.10.2026: „unos se odbija uz rečenicu da član već ima prijavu koja čeka i da je prvo
     treba odobriti ili odbiti u redu za proveru". Also the pencil's and the x's 409. */
  hisSubmissionWaits: 'leagueResults.refused.hisSubmissionWaits',
  /* PDL P9, 18.10.2026: „Za trku iz TEKUĆE sezone liga unosi rezultat samo članu koji ima članstvo
     za tu sezonu; inače se red odbija uz rečenicu." */
  heHoldsNoMembershipOfTheRunningSeason: 'leagueResults.refused.heHoldsNoMembershipOfTheRunningSeason',
  theFormIsNotComplete: 'leagueResults.refused.theFormIsNotComplete',
  theGroupIsEmpty: 'leagueResults.refused.theGroupIsEmpty',
  theGroupIsTooBig: 'leagueResults.refused.theGroupIsTooBig',
}

/**
 * AND THE ONE IT BORROWS FROM THE MEMBER'S OWN ROUTE, with the member's own sentence, which is just as
 * true of a moderator: a race whose day has not come. Kept apart from the map above because
 * `ResultWriteApi.java` is not on the gate of `refusals.test.ts`, and a claim the gate cannot trace
 * to a file it reads would fail it. The button that leads here is not drawn for such a race
 * (`EventDetail.tsx`), so this is reached only by an address typed by hand.
 */
export const THE_LEAGUE_ENTERING: Record<string, string> = {
  ...WHEN_THE_LEAGUE_ENTERS_RESULTS,
  theRaceHasNotBeenRun: 'results.refused.theRaceHasNotBeenRun',
}

/**
 * WHAT IS NO LONGER TRUE ONCE THE LEAGUE HAS WRITTEN A RESULT, and it is every reader of `result`.
 *
 * <p>`results` for the event page, the profile, every table and board; `races` and `events` because
 * both carry the lengths run at a race (`CalendarApi`, the dots of a timed race); the inbox, because
 * the route writes the member a line and the moderator may be that member.
 */
function whatAWriteChanges(answer: Answer): void {
  if (answer.got !== 'done') {
    return
  }

  clearResourceCache('results')
  clearResourceCache('races')
  clearResourceCache('events')
  theInboxHasChanged()
}

/** `POST /api/races/{race}/results`: several members, written together or not at all. */
export async function theLeagueEntered(
  race: number,
  rows: (FiguresSent & { memberNumber: string })[],
): Promise<Answer> {
  const answer = await askTheServer(`/api/races/${String(race)}/results`, { rows })

  whatAWriteChanges(answer)

  return answer
}

/** `PUT /api/races/{race}/results/{result}`: the pencil, the figures and nothing else. */
export async function theLeagueChanged(race: number, result: number, figures: FiguresSent): Promise<Answer> {
  const answer = await askTheServer(`/api/races/${String(race)}/results/${String(result)}`, figures, 'PUT')

  whatAWriteChanges(answer)

  return answer
}

/** `DELETE /api/races/{race}/results/{result}`: the x. */
export async function theLeagueDeleted(race: number, result: number): Promise<Answer> {
  const answer = await askTheServer(`/api/races/${String(race)}/results/${String(result)}`, {}, 'DELETE')

  whatAWriteChanges(answer)

  return answer
}

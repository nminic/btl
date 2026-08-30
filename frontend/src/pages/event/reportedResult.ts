import { categoryOf } from '../../data/raceCategory'
import { btlPoints } from '../../data/scoring'
import type { Race, RaceCategory } from '../../data/types'
import { fromBoxes } from '../../forms/clock'
import type { FormValues } from '../../forms/types'
import { raceKind } from '../../data/raceKind'

/** What a report says about the run itself: the figures the formula is fed and
 *  what it gives back. The rest of the submission is about the report and not
 *  about the run, so it is not decided here. */
export type Reported = {
  distanceKm: number
  ascentM: number
  descentM: number
  seconds: number
  points: number
  category: RaceCategory
}

/** A race as it really arrives: everything `Race` carries, except that the kind is
 *  still only a word. The type says one of three and the file says whatever it
 *  says, and this is the function that reads it (`data/raceKind.ts`). */
type Reporting = Omit<Race, 'kind'> & { kind: string }

/**
 * What was run, worked out from the race and from what the member typed.
 *
 * Its own function and not an expression inside the screen, because none of what
 * it decides is drawn anywhere: the queue a moderator reads shows the distance and
 * no more, so the category, the seconds and the points can only be asked of the
 * thing that decides them. That is the same reason `copiedRace.ts` and
 * `racesToOffer.ts` are functions of their own.
 *
 * **Which figures come from where depends on what the race fixes.** A race of a
 * length answers for the distance, the climb and the fall, and the member gives the
 * time; that is every race in `public/mock/races.json` and it is untouched. A timed
 * race answers for the time and for nothing else, and the owner said on 29.08.2026
 * that the time in question is the race's own limit rather than what anybody spent:
 * it is the same for everyone who finished, and the other reading rewards stopping,
 * 60 km in 6 h beating the same 60 km run out over the full 24. A free race answers
 * for neither, so all four come from the member.
 */
export function reportedResult(race: Reporting, values: FormValues): Reported {
  const kind = raceKind(race.kind)
  const measured =
    kind === 'length'
      ? { distanceKm: race.distanceKm, ascentM: race.ascentM, descentM: race.descentM }
      : {
          distanceKm: Number(values.distanceKm),
          ascentM: Number(values.ascentM),
          descentM: Number(values.descentM),
        }
  /* The form asks for no time at all on a timed race (`reportForm.ts`), so there is
     nothing else this could read there. */
  const seconds =
    kind === 'time'
      ? race.limitSeconds
      : fromBoxes(values)

  return {
    ...measured,
    seconds,
    points: btlPoints(measured.distanceKm, measured.ascentM, measured.descentM, seconds) ?? 0,
    /* Off the race where the race fixes a length, which leaves every one of the 1612
       races in the file reading exactly as it did. Where it does not, the race
       carries the category of a length nobody ran, so it is read off what the member
       covered, through the one function that answers that (`data/raceCategory.ts`).
       The category and the points are worked out from the same distance on purpose:
       PDL P5 has one figure deciding both. */
    category: kind === 'length' ? race.category : categoryOf(measured.distanceKm),
  }
}

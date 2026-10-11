import type { RaceKind } from '../../data/types'
import { fromBoxes } from '../../forms/clock'
import { storedNumber } from '../../forms/numberField'
import type { FieldDef } from '../../forms/types'
import { reportForm } from '../event/reportForm'
import type { Amended } from './verificationWrites'

/** The figures a run is counted on, by the names the member's own forms give them, in the
 *  order those forms ask them in: the length, the climb and the fall, and the time in its
 *  three boxes. The link, the picture and the comment are on those forms too and are not
 *  figures. */
const FIGURES = ['distanceKm', 'ascentM', 'descentM', 'hours', 'minutes', 'seconds'] as const

export type Figure = (typeof FIGURES)[number]

/**
 * WHAT A MODERATOR MAY SET IN PLACE OF THE RUNNER'S FIGURES ON A RACE OF THIS KIND, which
 * is exactly what the member's own form asks on it: the same boxes, with the same labels,
 * hints and bounds, in the same order.
 *
 * <p><b>Taken from that form and never written a third time</b> (`pages/event/reportForm.ts`).
 * The owner decided what each kind leaves to the runner, 29.08.2026 among the outcomes
 * offered, in the record's wording: „Na vremenskoj trci vreme ne unosi, jer je zadato trkom",
 * and on a free race the member gives all four. A race of a length gives the time alone. So
 * the figures a race fixes are never offered here: they are corrected on the race, „gde
 * ispravka stiže svima koji su je istrčali, a ne na jednoj prijavi" (the record of
 * 03.08.2026, in its wording), and the server does not read them off an amendment either
 * (`VerificationWriteApi.Amended`).
 *
 * <p><b>A list of pairs and not a lookup by name</b>, which is the shape this file had before
 * and its reason: a lookup answers „or nothing" for a name that is always there, and the
 * nothing is a branch no case can reach. Each figure brings its definition, and a figure the
 * kind does not ask for brings none and is simply not in the list.
 *
 * <p><b>Read off the race's kind and never off the member's hint</b>: the run the screen is
 * handed carries the calendar's kind for a race the calendar holds (`VerificationApi`). A race
 * it does not hold is settled in the panel that names the race (`admin/placingTheRace.ts`), which
 * asks this of the race the moderator chose, and asks all four of a race the approval makes,
 * because that race is made of them.
 */
export function figuresAsked(kind: RaceKind): { name: Figure; field: FieldDef }[] {
  const fields = reportForm(kind).fields

  return FIGURES.flatMap((name) => fields.filter((one) => one.name === name).map((field) => ({ name, field })))
}

/**
 * THE FIGURES AS THEY TRAVEL, read off the boxes that were asked and no others.
 *
 * <p>Read the way a form leaves by (`forms/numberField.ts`, `storedNumber`): the one comma a
 * box may hold is the separator of the decimals. The time is the sum of its three boxes
 * (`forms/clock.ts`), because the route keeps seconds. Only what was asked travels, so a figure
 * the race fixes is never sent at all.
 *
 * <p>One home for both panels that send figures, the one over a run from the calendar and the
 * one that names the race of a run the calendar does not hold: two copies of how a box becomes
 * a number are two answers to one question.
 */
export function amendedFrom(asked: readonly { name: Figure }[], written: Record<Figure, string>): Amended {
  const has = (name: Figure): boolean => asked.some((one) => one.name === name)
  const number = (name: Figure): number => Number(storedNumber(written[name].trim()))

  return {
    ...(has('distanceKm') ? { distanceKm: number('distanceKm') } : {}),
    ...(has('ascentM') ? { ascentM: number('ascentM') } : {}),
    ...(has('descentM') ? { descentM: number('descentM') } : {}),
    ...(has('seconds') ? { seconds: fromBoxes(written) } : {}),
  }
}

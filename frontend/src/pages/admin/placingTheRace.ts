import { raceKind } from '../../data/raceKind'
import type { Race, RaceKind } from '../../data/types'
import { noTime } from '../../forms/clock'
import { dogadjaj, unosRezultata } from '../../forms/definitions'
import type { FieldDef, FieldError } from '../../forms/types'
import { validateField } from '../../forms/validate'
import { amendedFrom, figuresAsked, type Figure } from './amendFields'
import { anApprovalOnANewRace, anApprovalOnTheRace, type Answered } from './verificationWrites'

/**
 * THE RACE OF A RUN THE CALENDAR DOES NOT HOLD, AS THE MODERATOR SETTLES IT BEFORE APPROVING
 * (R3b of the results flows).
 *
 * <p>The owner's answer of 10.10.2026, in the record's wording: „red NOVO se odobrava samo kroz
 * panel u kom se upisuje ili bira trka". So the panel has the two roads the route has
 * (`VerificationWriteApi`, `newRace` and `raceId`), and which one it is on is a single fact: a
 * race CHOSEN from the calendar, or none, and then the race is the one this approval makes.
 *
 * <p><b>The choosing is the member's own form's</b> (`pages/member/racesToOffer.ts` and
 * `forms/Suggesting.tsx`): the same list, the newest races run by today with their day and
 * measure, opened by typing into the race's name, and typing over a chosen race lets go of it
 * (owner, 23.08.2026, for that form). The owner's words for this panel, 30.08.2026: „mogu da
 * zamenim njegov naziv događaja i izbor trke autocompletom sad već postojeće trke".
 *
 * <p>Its own module, so the screen draws and this decides: `react/only-export-components` asks
 * for that, and a case about what the panel sends can ask it without mounting anything.
 */

/** The race of the calendar chosen from the list, by its key, and the line the list said it in. */
export type Chosen = { raceId: number; said: string }

/** The panel over one run, as its boxes stand. */
export type Placing = {
  /** The run it is open over, by the identity the decision is written under. */
  id: string
  /** The race's name as it stands in the box the list opens from. */
  raceName: string
  /** The race chosen from the list, or nothing: then the race is the one the approval makes. */
  chosen: Chosen | null
  /** The event's name, asked only of a race the approval makes. */
  eventName: string
  /** The kind the moderator decided, asked only of a race the approval makes. */
  kind: RaceKind
  /** The figures' boxes, as they are written. */
  written: Record<Figure, string>
}

/**
 * THE BOXES THAT NAME THE RACE, each the box of the form that already asks it: the race's name
 * as the member's own form asks it, the event's as the administration's form of an event asks
 * it, and the kind as the member's form offers it. Lists and not lookups, for the reason
 * `amendFields.ts` gives: a lookup answers „or nothing" for a name that is always there.
 */
export const RACE_NAME: FieldDef[] = unosRezultata.fields.filter((one) => one.name === 'raceName')
export const EVENT_NAME: FieldDef[] = dogadjaj.fields.filter((one) => one.name === 'name')
export const RACE_KIND: FieldDef[] = unosRezultata.fields.filter((one) => one.name === 'raceKind')

/**
 * THE FIGURES ASKED: what the chosen race leaves to the runner, or all four on a race the
 * approval makes, because that race is made of them - what its kind fixes is put on it, and on
 * a race to a limit the time is its limit (PDL P9, 30.08.2026). All four is what a free race
 * asks, so it is asked of the member's form for a free race and not written a second time.
 *
 * <p>A chosen race is read off the calendar by its key and never remembered with its kind: read
 * from the list that is there now, a race the calendar no longer holds asks nothing, and the
 * route says why it will not count a run on it.
 */
export function figuresFor(placing: Placing, races: readonly Race[]): { name: Figure; field: FieldDef }[] {
  const chosen = placing.chosen

  return chosen === null
    ? figuresAsked('free')
    : races.filter((one) => one.id === chosen.raceId).flatMap((one) => figuresAsked(raceKind(one.kind)))
}

/** What is wrong with one box: the box's own label, and what its rule says. */
export type Wrong = { label: string; said: FieldError }

/**
 * BOX BY BOX, IN THE ORDER THEY ARE DRAWN, what each one's rule says is wrong with it, held to
 * the rule that box is held to on the form it comes from (`forms/validate.ts`). Kept per box,
 * so each control says of itself that it is wrong and the line under the buttons names the box
 * its sentence came from, as the panel over a run from the calendar does.
 */
export function whatIsWrong(placing: Placing, races: readonly Race[]): Map<string, Wrong> {
  const named: { name: string; field: FieldDef; value: string }[] = [
    ...RACE_NAME.map((field) => ({ name: 'raceName', field, value: placing.raceName })),
    ...(placing.chosen === null
      ? [
          ...EVENT_NAME.map((field) => ({ name: 'eventName', field, value: placing.eventName })),
          ...RACE_KIND.map((field) => ({ name: 'raceKind', field, value: placing.kind })),
        ]
      : []),
    ...figuresFor(placing, races).map(({ name, field }) => ({ name, field, value: placing.written[name] })),
  ]

  return new Map(
    named.flatMap(({ name, field, value }) => {
      const said = validateField(field, value)

      return said === null ? [] : [[name, { label: field.labelKey, said }] as const]
    }),
  )
}

/** Whether the time is asked and adds up to nothing, which no box says on its own (owner,
 *  31.08.2026: „Ne sme da se popuni 0:0:0!"). */
export function timeIsNought(placing: Placing, races: readonly Race[]): boolean {
  return figuresFor(placing, races).some((one) => one.name === 'seconds') && noTime(placing.written)
}

/**
 * THE APPROVAL THE PANEL SENDS: on the chosen race, at what it leaves to the runner, or on a
 * race this approval makes, with its event, at all four figures. The names travel as the boxes
 * hold them with the spaces taken off, which is how every form here sends a name; the route
 * refuses a blank one rather than falling back on the member's.
 */
export function theApproval(placing: Placing, races: readonly Race[]): Answered {
  const amended = amendedFrom(figuresFor(placing, races), placing.written)

  return placing.chosen === null
    ? anApprovalOnANewRace(
        { eventName: placing.eventName.trim(), raceName: placing.raceName.trim(), raceKind: placing.kind },
        amended,
      )
    : anApprovalOnTheRace(placing.chosen.raceId, amended)
}

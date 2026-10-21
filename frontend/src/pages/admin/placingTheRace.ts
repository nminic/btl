import { raceKind } from '../../data/raceKind'
import type { Race, RaceKind } from '../../data/types'
import { noTime } from '../../forms/clock'
import { dogadjaj, unosRezultata } from '../../forms/definitions'
import { theOneNamedExactly } from '../../forms/exactName'
import type { FieldDef, FieldError, Suggestion } from '../../forms/types'
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
 * <p><b>THE EVENT FIRST, SINCE 19.10.2026</b>, as on the member's own form: „Jedan ekran za sve”
 * (owner, PDL P9), the block of an event and its race the two share (the coordinator's answer Q5 C
 * of 7a). An event of the calendar is chosen from the list, or typed exactly (`exactName.ts`), and
 * then the race is one of its races or a new one on it; a new event's name is given to its race
 * until the race is named for itself, and a new event is asked its place („Na moderatorovom ekranu
 * nov događaj traži naziv, datum i mesto”), the run's own town to start from. The day is the
 * member's and is not asked (PDL „[IZVEDENO 19.10.2026, moje, PR za 7b]”, (3)).
 *
 * <p>Its own module, so the screen draws and this decides: `react/only-export-components` asks
 * for that, and a case about what the panel sends can ask it without mounting anything.
 */

/** The race of the calendar chosen from the list, by its key, and the line the list said it in. */
export type Chosen = { raceId: number; said: string }

/** The event of the calendar the race goes on, by its key, and the line the list said it in. */
export type ChosenEvent = { eventId: number; said: string }

/** The panel over one run, as its boxes stand. */
export type Placing = {
  /** The run it is open over, by the identity the decision is written under. */
  id: string
  /** The day the run was run on, which is the member's and is not asked (`yyyy-MM-dd`). */
  day: string
  /** The race's name as it stands in the box the list opens from. */
  raceName: string
  /** The race chosen from the list, or nothing: then the race is the one the approval makes. Only
   *  ever beside an event of the calendar, whose races the list offers. */
  chosen: Chosen | null
  /** The event's name as it stands in its box. */
  eventName: string
  /** The event of the calendar it names, or nothing: then the approval makes the event as well. */
  event: ChosenEvent | null
  /** The place of a new event, the town and its country, as `PlaceField` writes them. */
  city: string
  country: string
  /** The country the place field wrote because the town was recognised, or nothing. Kept here and not in
   *  the field, which is drawn only while no event of the calendar is chosen and takes what it remembers
   *  with it when it goes (`forms/withThePlace.ts`). */
  countryWrote: string | null
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
export const EVENT_NAME: FieldDef[] = dogadjaj.fields
  .filter((one) => one.name === 'name')
  /* Under the member's form's own word for it, „Događaj” (approved 19.10.2026), since the two share
     the block; the rule is still the administration's form of an event. */
  .map((one) => ({ ...one, labelKey: 'newResult.eventName' }))
export const RACE_KIND: FieldDef[] = unosRezultata.fields.filter((one) => one.name === 'raceKind')
/** The place of a new event, held to the rule the member's form holds a town to, under the panel's
 *  own label „Mesto novog događaja” (approved 19.10.2026). */
export const NEW_EVENT_PLACE: FieldDef[] = unosRezultata.fields
  .filter((one) => one.name === 'city')
  .map((one) => ({ ...one, labelKey: 'review.placeTown' }))

/**
 * A NAME TYPED INTO THE EVENT'S BOX: an event of the list it names exactly is linked, as if chosen
 * (`exactName.ts`), and anything else lets go of the event and of a race chosen under it. The race
 * takes the new event's name while it is empty or still says what the event said a letter earlier,
 * so a race the moderator named for himself is not written over: the rule `FormRenderer` keeps for
 * `follows` on the member's form.
 */
export function typingTheEvent(placing: Placing, next: string, events: readonly Suggestion[]): Placing {
  const linked = theOneNamedExactly(events, next)

  if (linked !== undefined) {
    return choosingTheEvent({ ...placing, eventName: next }, linked, next)
  }

  return {
    ...placing,
    eventName: next,
    event: null,
    chosen: null,
    raceName: [placing.eventName, ''].includes(placing.raceName) ? next : placing.raceName,
  }
}

/** AN EVENT CHOSEN FROM THE LIST, or typed exactly: the race is now one of its races or a new one
 *  on it, so the race's box is emptied, as choosing an event empties it on the member's form. */
export function choosingTheEvent(placing: Placing, one: Suggestion, shown = one.value): Placing {
  return {
    ...placing,
    eventName: shown,
    event: { eventId: Number(one.id), said: one.said },
    raceName: '',
    chosen: null,
  }
}

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
    ...(placing.event === null
      ? EVENT_NAME.map((field) => ({ name: 'eventName', field, value: placing.eventName }))
      : []),
    ...RACE_NAME.map((field) => ({ name: 'raceName', field, value: placing.raceName })),
    ...(placing.chosen === null
      ? RACE_KIND.map((field) => ({ name: 'raceKind', field, value: placing.kind }))
      : []),
    ...(placing.event === null
      ? NEW_EVENT_PLACE.map((field) => ({ name: 'city', field, value: placing.city }))
      : []),
    ...figuresFor(placing, races).map(({ name, field }) => ({ name, field, value: placing.written[name] })),
  ]

  return new Map([
    ...named.flatMap(({ name, field, value }) => {
      const said = validateField(field, value)

      return said === null ? [] : [[name, { label: field.labelKey, said }] as const]
    }),
    /* A town with no country is half a place, which the form says on the town in the words it
       says it everywhere (`validate.ts`, `countryMissing`). */
    ...NEW_EVENT_PLACE.flatMap((field) =>
      placing.event === null && placing.city.trim() !== '' && placing.country === ''
        ? [['country', { label: field.labelKey, said: { key: 'form.errors.countryMissing' } }] as const]
        : [],
    ),
  ])
}

/** Whether the time is asked and adds up to nothing, which no box says on its own (owner,
 *  31.08.2026: „Ne sme da se popuni 0:0:0!"). */
export function timeIsNought(placing: Placing, races: readonly Race[]): boolean {
  return figuresFor(placing, races).some((one) => one.name === 'seconds') && noTime(placing.written)
}

/**
 * THE APPROVAL THE PANEL SENDS: on the chosen race, at what it leaves to the runner, or on a
 * race this approval makes, on the event of the calendar or on the event it makes with its place,
 * at all four figures. The names travel as the boxes
 * hold them with the spaces taken off, which is how every form here sends a name; the route
 * refuses a blank one rather than falling back on the member's.
 */
export function theApproval(placing: Placing, races: readonly Race[]): Answered {
  const amended = amendedFrom(figuresFor(placing, races), placing.written)

  const race = { raceName: placing.raceName.trim(), raceKind: placing.kind }

  /* The event by its key where it is the calendar's, and by its name and its place where the
     approval makes it (`VerificationWriteApi.NewRace`): never both, which the route refuses. */
  return placing.chosen !== null
    ? anApprovalOnTheRace(placing.chosen.raceId, amended)
    : anApprovalOnANewRace(
        placing.event === null
          ? { ...race, eventName: placing.eventName.trim(), city: placing.city.trim(), country: placing.country }
          : { ...race, eventId: placing.event.eventId },
        amended,
      )
}

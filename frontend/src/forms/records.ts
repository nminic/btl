import { countryName } from '../data/countryName'
import { fieldDate, isoDate } from './dateField'
import type { FieldDef, FieldOption, FormDef, FormValues } from './types'

/* The bridge between a record and the form that changes it.
 *
 * A form deals in text and checkboxes; a record keeps numbers as numbers, dates
 * as yyyy-mm-dd and flags as booleans. Everything that converts between the two
 * lives here, driven by the field types in the definition, so a new entity is a
 * new JSON file and not a new converter (PDL P30).
 */

/** The answer for a field that offers no choices, as one list rather than a new
 *  empty one per call: a field only redraws when something about it changed, and
 *  a fresh empty list every time counts as a change. Shut, because one list
 *  handed to every choiceless field on the portal has to stay empty. */
const NONE: readonly FieldOption[] = Object.freeze([])

/** The choices a select offers: from the definition, or handed in by the screen
 *  where the list is data rather than a fixed set. A race belongs to one of
 *  twelve hundred events, and those have no business being copied into JSON. */
export function optionsFor(
  field: FieldDef,
  supplied: Record<string, FieldOption[]>,
): readonly FieldOption[] {
  return field.options ?? supplied[field.name] ?? NONE
}

/**
 * What the form opens with, read off the record it is going to change.
 *
 * And the country beside a town, which is a value with no field of its own
 * (forms/types.ts): read back here so a form opened on an event already knows
 * which country it is in. Left out, an event saved without its town being
 * touched was saved into no country at all.
 */
export function valuesFor(form: FormDef, record: Record<string, unknown>): FormValues {
  const values: FormValues = {}

  for (const field of form.fields) {
    const value = record[field.name]

    if (field.type === 'checkbox') {
      values[field.name] = value === true
    } else if (yesOrNo(field) && typeof value === 'boolean') {
      /* The way back for a question a record keeps as a yes or a no and a pair
         of buttons answers in words (`recordValue` is the way out). Written as
         `String(true)` it came back as „true", which is neither of the two
         values the buttons carry, so a record that says yes opened a form with
         neither button taken.

         Asked of the ANSWERS and not of the control since 20.09.2026, which is
         the same question `recordValue` asks on the way out and the reason it is
         asked in one place: `featured` offers the same two words out of a select
         and `firstSeason2027` out of a pair of buttons, and both records keep a
         flag. Read off the control, an event that IS singled out opened its form
         with the word „true" in it, which is neither button. */
      values[field.name] = value ? 'yes' : 'no'
    } else if (field.type === 'date') {
      values[field.name] = fieldDate(String(value ?? ''))
    } else {
      values[field.name] = value === null || value === undefined ? '' : String(value)
    }

    if (field.type === 'place') {
      const country = record.country

      values.country = country === null || country === undefined ? '' : String(country)
    }
  }

  return values
}

/**
 * What the session remembers, which is the record's own shape written as text.
 *
 * The overlay is a flat map of strings on purpose: it is read back through the
 * record underneath, which is what says whether a field is a number, and it is
 * the shape a PATCH body will have when the backend arrives.
 */
export function textFrom(form: FormDef, values: FormValues): Record<string, string> {
  const text: Record<string, string> = {}

  for (const field of form.fields) {
    const value = values[field.name]

    text[field.name] = field.type === 'date' ? isoDate(String(value)) : String(value)

    /* And the country the town came with. It is a value the form holds and not
       a field it draws, so a loop over the fields cannot see it, and everything
       downstream is built out of what this returns: an event entered on the
       screen was saved with the word "undefined" for a country, and one edited
       from Beograd to Zagreb stayed in Serbia. */
    if (field.type === 'place') {
      text.country = String(values.country)
    }
  }

  return text
}

/**
 * The fields an overlay writes that a record keeps as a NUMBER even when what is
 * there now is nothing.
 *
 * **Why a list of names, said plainly.** `like` puts a value back into the shape
 * of the value it replaces, and that works for every field that already holds
 * something. It cannot work where the record holds `null`, because nothing has no
 * shape: `typeof null` is „object" and the text goes in as text. That was
 * harmless while every one of these was itself text; it stopped being harmless on
 * 20.09.2026, when a team became something identified by a number. Measured on
 * the team's own page that day: a member let into a club had `teamId` written as
 * „1", the six readers that compare it with `team.id` found no match, and the
 * member was in the club on their own record and in no club on every screen.
 *
 * The four of them are every field the overlay writes whose record keeps a number:
 * the club somebody is in, the season they joined it, the event a copy came out
 * of, and the event a race belongs to. Held to the served files in
 * `records.test.ts`, so a fifth cannot arrive unnoticed.
 */
export const KEPT_AS_A_NUMBER = ['copiedFrom', 'eventId', 'teamId', 'teamSince']

/** One value out of the overlay, put back into the shape the record keeps it in,
 *  so a screen that formats a number keeps being handed a number. */
function like(current: unknown, value: string, field: string): unknown {
  if (typeof current === 'number') {
    return Number(value)
  }

  if ((current === null || current === undefined) && KEPT_AS_A_NUMBER.includes(field)) {
    /* Nothing written over one of these is nothing again, and that is the whole of
       how somebody is taken out of a club: an empty box is not the club numbered
       nought (`data/derive.ts`, `teamOf`).

       `undefined` as well as `null`, because a record being MADE starts from the
       entity's blank and a blank does not carry every field: a race entered under
       an event is written with the event's identity as text, and read straight it
       is a race that belongs to the event „1133" while every screen looks for
       1133. */
    return value === '' ? null : Number(value)
  }

  if (typeof current === 'boolean') {
    /* „true" is what a checkbox writes and „yes" is what a pair of buttons
       writes (forms/types.ts, `choice`): the same question asked two ways, and
       the record keeps one answer. Written without this, „no" is not „true" and
       so is false, which is right by accident, while „yes" is false as well,
       which puts a beginner into the wrong category for a whole season and
       cannot be undone (PDL P7). */
    return value === 'true' || value === 'yes'
  }

  return value
}

/**
 * One value off a record, by a field name that is data rather than code.
 *
 * A record is typed by the fields it declares, and a name coming out of a form
 * definition or an entity table is not one of them as far as the compiler can
 * see; reading it used to mean calling the record a bag of unknowns first
 * (`record as Record<string, unknown>`), which ADL A14 bans. `Reflect.get` is
 * the read itself, and what comes back is what it is: unknown.
 */
export function fieldValue(record: object, field: string): unknown {
  return Reflect.get(record, field)
}

/** The record as the screens read it: what was generated, with what
 *  administration has changed on top. The record underneath is never touched. */
export function applyChanges<T extends object>(
  record: T,
  changes: Record<string, string> | undefined,
): T {
  if (changes === undefined) {
    return record
  }

  const next: Record<string, unknown> = {}

  for (const [field, value] of Object.entries(changes)) {
    next[field] = like(fieldValue(record, field), value, field)
  }

  /* `Object.assign` rather than a spread, because it hands back the type of
     what it was given: the copy is still the record's own type, and nothing has
     to be asserted about the changes going onto it. */
  return Object.assign({ ...record }, next)
}

/** Whether a field's two answers are the words a yes or no question carries. */
function yesOrNo(field: FieldDef): boolean {
  const answers = (field.options ?? []).map((one) => one.value)

  return answers.length === 2 && answers.includes('yes') && answers.includes('no')
}

/** One value out of a form, in the shape a record keeps it in. Used for a record
 *  that is being created, where there is nothing underneath to take the shape
 *  from, so the field type is what decides. */
export function recordValue(field: FieldDef, text: string): unknown {
  if (field.type === 'number') {
    return Number(text)
  }

  if (field.type === 'checkbox') {
    return text === 'true'
  }

  /* A question a record keeps as a yes or a no: „Početnička" and „Starosna" are the
     two faces of `firstSeason2027`, and „Da"/„Ne" the two faces of `BtlEvent.featured`
     (data/types.ts). Which question that is is decided by what the field OFFERS
     rather than by what was typed into it or by the control it is drawn with: a
     field offering „yes" and „no" and nothing else is the shape of a question a
     record keeps as a boolean, and one that happens to receive the word „yes"
     among other answers is not. Every other choice writes its own value and falls
     through.

     The control was part of the test until 20.09.2026, and `featured` is why it
     no longer is: the owner asked for that one as a list of two rather than a box
     to tick, so it is a `select`, and the record keeps the flag the schema keeps
     (`CalendarApi.Event`). Read off the control, a new event went in carrying the
     word „no" where a false belongs. */
  if (yesOrNo(field)) {
    return text === 'yes'
  }

  /* And a field that NAMES another record by its number. The control is a list of
     events, so what it hands over is text, and the record keeps the number the
     schema keeps (`/api/races`, `long eventId`). Read straight, a race entered
     under an event belonged to the event „1133" while every screen that draws it
     looks for 1133, and the race stood in the calendar under nothing. */
  if (KEPT_AS_A_NUMBER.includes(field.name)) {
    /* `Number` and nothing else, as on every `number` field above: a record is
       made out of a form, the one such field a form asks for is the event a race
       belongs to, and that one is obligatory. Emptiness reaches a record through
       the OVERLAY rather than through here, and that is where it is read as
       nothing (`like`). */
    return Number(text)
  }

  return text
}

/**
 * The words the confirmation shows for one saved value.
 *
 * Returns a dictionary key where there is one and the text itself where there is
 * not, which is exactly what translate() does with an unknown key: an option
 * handed in by a screen carries the name of an event or of a member, not a key.
 */
export function shownValue(
  field: FieldDef,
  value: string | boolean,
  supplied: Record<string, FieldOption[]>,
): string {
  if (typeof value === 'boolean') {
    return value ? 'admin.yes' : 'admin.no'
  }

  if (field.type === 'country') {
    return countryName(value)
  }

  return optionsFor(field, supplied).find((one) => one.value === value)?.labelKey ?? value
}

/**
 * The limit a field carries in the definition it is defined in.
 *
 * For the boxes that are edited outside a form. A biography was written on the
 * registration form, where it is capped, and then rewritten by a moderator on
 * the verification screen in a bare textarea, until the owner withdrew that on
 * 06.08.2026 and a biography became something refused rather than rewritten
 * (PDL P22); the rules of a
 * competition are entered on the administration form, capped, and then rewritten
 * in place on the competition's own page. Both rewrites took as much as anybody
 * cared to paste, so a value could come back longer than the form that made it
 * would ever have accepted, and the next person to open that form was told their
 * own text was too long.
 *
 * Read from the definition rather than written out beside each box, so the limit
 * is one number in one file and the two ends cannot drift.
 *
 * Throws where the field is not there, because a name that does not match a
 * field is a mistake in the code and not a box without a limit: returning
 * undefined would take the cap off quietly, which is the thing this exists to
 * stop.
 */
export function limitOf(form: FormDef, name: string): number {
  const field = form.fields.find((one) => one.name === name)

  if (field?.maxLength === undefined) {
    throw new Error(`Form ${form.id} has no field ${name} with a length limit`)
  }

  return field.maxLength
}

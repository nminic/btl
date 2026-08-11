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
    } else if (field.type === 'choice' && typeof value === 'boolean') {
      /* The way back for a question a record keeps as a yes or a no and a pair
         of buttons answers in words (`recordValue` is the way out). Written as
         `String(true)` it came back as „true", which is neither of the two
         values the buttons carry, so a record that says yes opened a form with
         neither button taken. */
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

/** One value out of the overlay, put back into the shape the record keeps it in,
 *  so a screen that formats a number keeps being handed a number. */
function like(current: unknown, value: string): unknown {
  if (typeof current === 'number') {
    return Number(value)
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

/** The record as the screens read it: what was generated, with what
 *  administration has changed on top. The record underneath is never touched. */
export function applyChanges<T extends object>(
  record: T,
  changes: Record<string, string> | undefined,
): T {
  if (changes === undefined) {
    return record
  }

  const next = { ...record } as Record<string, unknown>

  for (const [field, value] of Object.entries(changes)) {
    next[field] = like(next[field], value)
  }

  return next as T
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

  /* Two buttons answering a question a record keeps as a yes or a no, which is
     the one shape of `choice` that is not a word of its own: „Prva sezona" and
     „Starosna" are the two faces of `firstSeason2027` (data/types.ts). Every
     other `choice` writes its own value and falls through. */
  /* Decided by what the field offers rather than by what was typed into it: a
     `choice` whose two answers are „yes" and „no" is the shape of a question a
     record keeps as a boolean. Asked of the text alone, any future choice that
     happened to use those two words would be turned into a boolean without
     anybody meaning it. */
  if (field.type === 'choice' && yesOrNo(field)) {
    return text === 'yes'
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
 * For the two boxes that are edited outside a form. A biography is written on
 * the registration form, where it is capped, and then rewritten by a moderator
 * on the verification screen, which is a bare textarea; the rules of a
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

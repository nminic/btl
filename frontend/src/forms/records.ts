import countries from '../data/countries.json'
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

/** What the form opens with, read off the record it is going to change. */
export function valuesFor(form: FormDef, record: Record<string, unknown>): FormValues {
  const values: FormValues = {}

  for (const field of form.fields) {
    const value = record[field.name]

    if (field.type === 'checkbox') {
      values[field.name] = value === true
    } else if (field.type === 'date') {
      values[field.name] = fieldDate(String(value ?? ''))
    } else {
      values[field.name] = value === null || value === undefined ? '' : String(value)
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
    return value === 'true'
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

  return text
}

function countryName(code: string): string {
  return [...countries.region, ...countries.rest].find((one) => one.code === code)?.name ?? code
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

import { ageOn, parseDate } from './dateField'
import type { FieldDef, FieldError, FormDef, FormValues } from './types'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Never matches, so a broken pattern rejects the value instead of the page. */
const NEVER = /(?!)/

/**
 * Patterns come from JSON that a person edits by hand, so a typo is a question
 * of when, not if. An uncompilable pattern must not throw out of a submit
 * handler: with no error boundary above it, React would unmount the tree and
 * leave a blank page.
 */
function compile(pattern: string): RegExp {
  try {
    return new RegExp(pattern)
  } catch {
    return NEVER
  }
}

/**
 * Returns the first broken rule, or null. First and not all of them on purpose:
 * a field shows one message, and the order below is the order a person reads
 * the rules in.
 *
 * This is the front end copy of the rules. The backend validates again, always
 * (ADL A8); nothing here is a security measure.
 */
export function validateField(field: FieldDef, value: string | boolean): FieldError | null {
  if (typeof value === 'boolean') {
    return field.required === true && !value ? { key: 'form.errors.required' } : null
  }

  const text = value.trim()

  if (text === '') {
    return field.required === true ? { key: 'form.errors.required' } : null
  }

  if (field.minLength !== undefined && text.length < field.minLength) {
    return { key: 'form.errors.minLength', params: { min: field.minLength } }
  }

  if (field.maxLength !== undefined && text.length > field.maxLength) {
    return { key: 'form.errors.maxLength', params: { max: field.maxLength } }
  }

  if (field.pattern !== undefined && !compile(field.pattern).test(text)) {
    return { key: 'form.errors.pattern' }
  }

  if (field.type === 'email' && !EMAIL.test(text)) {
    return { key: 'form.errors.email' }
  }

  if (field.type === 'date' && parseDate(text) === null) {
    return { key: 'form.errors.date' }
  }

  if (field.type === 'number') {
    const numeric = Number(text)

    // Number('abc') is NaN, and every comparison against NaN is false, so
    // without this a bounded number field silently accepts words.
    if (!Number.isFinite(numeric)) {
      return { key: 'form.errors.number' }
    }

    if (field.min !== undefined && numeric < field.min) {
      return { key: 'form.errors.min', params: { min: field.min } }
    }

    if (field.max !== undefined && numeric > field.max) {
      return { key: 'form.errors.max', params: { max: field.max } }
    }
  }

  return null
}

/**
 * Whether a field is on screen at all. A hidden field is neither shown nor
 * validated, or a member over sixteen could never submit the form because of a
 * parent signature they cannot see.
 */
export function isVisible(field: FieldDef, values: FormValues, today: Date): boolean {
  const rule = field.showWhenYoungerThan

  if (rule === undefined) {
    return true
  }

  const birth = parseDate(String(values[rule.field] ?? ''))

  return birth !== null && ageOn(birth, today) < rule.years
}

/* The day is handed in rather than read here. A rule that decides whether a
 * parent's signature is needed must decide it from the same day the field
 * appeared on, and the portal has one clock (src/clock). */
export function validateForm(
  form: FormDef,
  values: FormValues,
  today: Date,
): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {}

  for (const field of form.fields) {
    if (!isVisible(field, values, today)) {
      continue
    }

    const value = values[field.name] ?? ''
    let error = validateField(field, value)

    if (error === null && field.matches !== undefined && value !== values[field.matches]) {
      error = { key: 'form.errors.matches' }
    }

    if (error !== null) {
      errors[field.name] = error
    }

    /* And the country the town carries, which is a value with no field of its
       own (forms/types.ts) and so was walked past by the loop above: the form
       validates `form.fields`, and `country` is not one of them.
     *
       It was written down as required, and then it stopped being asked: a town
       typed by hand that the codebook does not know leaves the country as it
       started, which is empty, and the registration went through with no
       country at all. What hangs on it is the price and the way of paying it
       (PDL P8): a member with no country is offered PayPal, which is the one
       thing that must not be offered to a member from Serbia.

       Said on the place, because the country is drawn there and there is
       nowhere else to say it. */
    /* Compared to the empty string and not through a fallback: a form with a
       place field always carries a country, because `emptyValues` writes one
       (below), so „no such key" is a case that cannot happen and a fallback for
       it is a branch nothing can walk. */
    if (field.type === 'place' && field.required === true && values.country === '') {
      errors[field.name] = { key: 'form.errors.countryMissing' }
    }
  }

  return errors
}

/** What actually gets submitted. Validation trims, so submission must too,
 *  or "  Vladan  " passes the length rules and is stored with its spaces. */
export function trimValues(values: FormValues): FormValues {
  const trimmed: FormValues = {}

  for (const [name, value] of Object.entries(values)) {
    trimmed[name] = typeof value === 'string' ? value.trim() : value
  }

  return trimmed
}

/**
 * Every value a form holds, empty.
 *
 * One value per field, and one more where there is a place field: a place
 * writes the country it came with, and the country is no longer a field of its
 * own (src/forms/types.ts). Without it here the country would be missing from
 * the values the form is seeded with, so an event edited without touching its
 * town would be saved into no country at all.
 */
export function emptyValues(form: FormDef): FormValues {
  const values: FormValues = {}

  for (const field of form.fields) {
    values[field.name] = field.type === 'checkbox' ? false : ''

    if (field.type === 'place') {
      values.country = ''
    }
  }

  return values
}

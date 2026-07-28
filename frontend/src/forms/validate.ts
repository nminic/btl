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

export function validateForm(form: FormDef, values: FormValues): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {}

  for (const field of form.fields) {
    const error = validateField(field, values[field.name] ?? '')

    if (error !== null) {
      errors[field.name] = error
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

export function emptyValues(form: FormDef): FormValues {
  const values: FormValues = {}

  for (const field of form.fields) {
    values[field.name] = field.type === 'checkbox' ? false : ''
  }

  return values
}

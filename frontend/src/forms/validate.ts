import type { FieldDef, FieldError, FormDef, FormValues } from './types'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  if (field.pattern !== undefined && !new RegExp(field.pattern).test(text)) {
    return { key: 'form.errors.pattern' }
  }

  if (field.type === 'email' && !EMAIL.test(text)) {
    return { key: 'form.errors.email' }
  }

  if (field.type === 'number') {
    const numeric = Number(text)

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

export function emptyValues(form: FormDef): FormValues {
  const values: FormValues = {}

  for (const field of form.fields) {
    values[field.name] = field.type === 'checkbox' ? false : ''
  }

  return values
}

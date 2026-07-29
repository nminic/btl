/* A form is data, not code (PDL P30). The owner changes a field by editing a
 * JSON file; nobody touches a component. Hence a closed set of field types and
 * a closed set of rules: anything outside them cannot be described, and that is
 * on purpose.
 */

export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'date'
  /** Time of day, hh:mm on a 24 hour clock, which reads the same everywhere. */
  | 'time'
  | 'number'
  | 'select'
  /** The whole world, with the region the league runs in on top. Its own type
   *  because a list of 252 countries has no business being copied into a form
   *  definition. */
  | 'country'
  | 'checkbox'
  | 'textarea'
  /** A picture attached as proof. Optional, and deleted once the result has
   *  been checked, so the disc does not fill with photographs of watches. */
  | 'photo'

export type FieldOption = {
  value: string
  labelKey: string
}

export type FieldDef = {
  name: string
  type: FieldType
  labelKey: string
  /** Every field that carries a rule carries the rule next to it (PDL P8).
   *  Rules are never hidden in the rulebook or in a separate help page. */
  hintKey?: string
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  options?: FieldOption[]
  /** Must hold the same value as this field. Used by the password repeat. */
  matches?: string
  /**
   * Shown only when the date in `field` says the person is younger than
   * `years`. The one rule of its kind, and named rather than general on
   * purpose: a general condition language in a JSON file is a small
   * programming language, and those grow teeth.
   */
  showWhenYoungerThan?: { field: string; years: number }
}

export type FormDef = {
  id: string
  titleKey: string
  submitKey: string
  fields: FieldDef[]
}

export type FormValues = Record<string, string | boolean>

export type FieldError = {
  key: string
  params?: Record<string, string | number>
}

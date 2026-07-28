/* A form is data, not code (PDL P30). The owner changes a field by editing a
 * JSON file; nobody touches a component. Hence a closed set of field types and
 * a closed set of rules: anything outside them cannot be described, and that is
 * on purpose.
 */

export type FieldType = 'text' | 'email' | 'date' | 'number' | 'select' | 'checkbox' | 'textarea'

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

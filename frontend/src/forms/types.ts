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
  | 'number'
  | 'select'
  /** The whole world, with the region the league runs in on top. Its own type
   *  because a list of 252 countries has no business being copied into a form
   *  definition. */
  | 'country'
  /**
   * A town, offered out of the codebook of the world from the second letter,
   * each answer carrying the country it is in (owner, 10.08.2026).
   *
   * It writes two values: its own, and `country`. That is fixed rather than
   * configured, because a form has one place on it and the country of that
   * place has one name; a setting here would be a knob with one position. The
   * country field goes off the form when a place field goes on it, so
   * `emptyValues` puts `country` in the values itself (src/forms/validate.ts).
   */
  | 'place'
  /**
   * One answer out of two or three, drawn as buttons rather than as a list.
   *
   * For the questions whose answers are short, few, and worth seeing at once:
   * „Muški / Ženski", „Prva sezona / Starosna kategorija" (owner, 11.08.2026).
   * Nothing is chosen to begin with and exactly one must be, which is what a
   * group of radio buttons is; the buttons are what it looks like, and the radio
   * is what it is, so the keyboard behaves the way every other one does.
   */
  | 'choice'
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
   * Which row of the form this field stands in, on a screen wide enough for
   * rows (owner, 11.08.2026, for the registration form).
   *
   * A number and not a width: fields that name the same row share it, and how
   * many columns that makes is counted rather than declared, so moving a field
   * from one row to another is one number in one place. Fields without it stand
   * on a row of their own, which is what every form did before this and what
   * every form still does on a telephone.
   */
  row?: number
  /**
   * A link inside the words of the field, where the words point somewhere.
   *
   * One case, and it is the one that matters: the confirmation that the rules
   * have been read carries a link to them (owner, 11.08.2026). The label holds
   * `{link}` where the link goes, and these two say what it reads and where it
   * leads.
   */
  linkKey?: string
  linkTo?: string
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

/**
 * A value a form shows but never asks for, because it is read off the values it
 * does ask for: the category of a race is its distance, exactly (PDL P5).
 *
 * Not a field type, on purpose. A field is something a person fills in, and the
 * whole point of these is that nobody can, so they carry no rules and no state.
 */
export type DerivedField = {
  /**
   * Worked out and saved, and not drawn on the form.
   *
   * The address of an event is made from its name and its year and there is
   * nothing anybody can do about it on the form, so the owner took the row off
   * (11.08.2026). It is still written into the record on every save, and it is
   * still in the confirmation of that save, which is where somebody about to
   * send a link reads it (admin/EntityEditor.tsx): what is hidden is the row
   * that asks, not the value.
   */
  hidden?: boolean
  /** The field on the record it fills. */
  name: string
  labelKey: string
  /** Where the value comes from, in words. A value nobody can change has to say
   *  who decided it, or it reads as a fault. */
  hintKey: string
  /** The words shown for it: a dictionary key where there is one, and the value
   *  itself where there is not, which is what translate() does with a key it
   *  does not know. */
  shownKey: string
}

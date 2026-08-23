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
   * „Muški / Ženski", „Početnička / Starosna" (owner, 11.08.2026).
   * Nothing is chosen to begin with and exactly one must be, which is what a
   * group of radio buttons is; the buttons are what it looks like, and the radio
   * is what it is, so the keyboard behaves the way every other one does.
   */
  | 'choice'
  | 'checkbox'
  | 'textarea'
  /**
   * A picture the member hands over. Two of them on the portal, and they are
   * not the same thing:
   *
   * - **proof beside a result**, optional, deleted once the result has been
   *   checked, so the disc does not fill with photographs of watches;
   * - **the profile picture in registration**, obligatory (PDL P8), kept for as
   *   long as the member is one, and looked at by a moderator before it shows.
   *
   * What the field type carries is the picking; how long the file lives is the
   * business of whatever receives it.
   */
  | 'photo'

/**
 * One entry of a list a field is typed against.
 *
 * What the portal already holds, offered so it does not have to be typed again.
 * Choosing one writes `value` into the field itself and `fills` into the fields
 * beside it, which are then locked: they came off a record and editing them
 * would make the record say something it does not say (FormRenderer.tsx).
 */
export type Suggestion = {
  /** Its own, so React can key the list and two identical rows are still two. */
  id: string
  /** What goes into the field that is being typed in. */
  value: string
  /** What the row reads on the screen, which is more than the value: the value
   *  alone would offer five identical rows for five races of one event. */
  said: string
  /** What choosing it writes into the other fields, by field name. */
  fills: Record<string, string>
}

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
  /**
   * Asked of everybody, and required of everybody except somebody younger than
   * `years`, who may leave it empty.
   *
   * The mirror of the rule above, named rather than general for the same reason.
   * The one case is the number of an identity document. The register of members
   * asks for it, and an identity card is issued at sixteen, voluntarily from
   * ten, so a child usually has neither card nor passport. Demanded of them, the
   * only way to send the form is for a parent to type their own number, and the
   * association ends up holding the document number of somebody who is not a
   * member: no row in the privacy policy, no basis, no retention. A security
   * review measured exactly that on 20.08.2026, and the owner decided the same
   * day: asked of minors as well, but not required of them.
   */
  optionalWhenYoungerThan?: { field: string; years: number }
  /**
   * Required of everybody, and not of somebody who has answered `field`.
   *
   * The one case is the link to the official results, and the field that lets it
   * go is the picture (Član 37, owner 22.08.2026): a photograph of the watch or
   * of the diploma is a proof of its own, so a member who has one is not asked
   * for a link as well.
   *
   * Named rather than general, like the two rules above and for the same reason:
   * a condition language in a JSON file is a small programming language.
   */
  optionalWhenFilled?: { field: string }
  /**
   * Asked of everybody, and required of somebody who has answered `field`.
   *
   * The mirror of the rule above and the other half of one decision: a result
   * proved by a picture instead of a link has to say in words what the picture
   * shows, so the comment stops being optional the moment the picture is there.
   */
  requiredWhenFilled?: { field: string }
  /**
   * The row of the privacy policy that describes what is done with this answer.
   *
   * The first column of that row, word for word. A field is a thing the portal collects
   * about a person, and a thing collected about a person has to be declared; written as
   * a property of the field, the declaration cannot be forgotten when the field is added,
   * because a field without one fails the gate.
   *
   * It was a guard over two words in a hint before, which held exactly as long as nobody
   * reworded a hint: a review reworded one, deleted the row, and the whole suite stayed
   * green while the portal went on asking. Before that, `firstSeason2027` was collected
   * for weeks with no row at all.
   *
   * Optional on the type and demanded of the registration form by its own guard: the
   * other forms of the portal ask about a race or an event, not about a person, and a
   * property every form had to carry would say the opposite.
   */
  policyRow?: string
  /**
   * The legal basis that same row names, word for word.
   *
   * The row alone was not enough. A guard that only asks whether the row exists lets the
   * basis be rewritten under it: a review moved `Ime oca` from a legal obligation to
   * consent and nothing failed, which would tell a member they may withdraw a consent
   * that was never the ground, over data the association cannot delete on request.
   */
  policyBasis?: string
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

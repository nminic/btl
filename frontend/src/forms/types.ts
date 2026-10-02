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
   * - ~~**the profile picture in registration**, obligatory (PDL P8)~~ — no form
   *   asks for a profile picture since 28.09.2026, when the owner moved it out of
   *   the registration („Profilna sekcija se sa slikom i svojim recima izbacuje iz
   *   registracione forme"). It is still kept for as long as the member is one and
   *   still looked at by a moderator before it shows; what changed is that it
   *   arrives as a file at `POST /api/me/photo` rather than as a field of a form.
   *   So this type has one user today, the two forms a result is reported by.
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
  /**
   * A number the server keeps as a WHOLE number, so the box takes no separator at all.
   *
   * <p>Twelve of the sixteen number fields the portal has: hours, minutes and seconds (the
   * server keeps their sum, `result.seconds integer`, so each of the three has to be whole for
   * the sum to be whole), the climb and the fall (`ascent_m`, `descent_m integer`), the season
   * of a competition and a member's first season. A length and the two amounts of a price are
   * kept with two decimals and do not carry it.
   *
   * <p><b>Why it exists, and it is the coordinator's reasoning rather than the owner's
   * words:</b> once a number box took a comma (owner, 02.10.2026, „Polje za broj prima i zarez
   * i tacku"), „30,5" seconds no longer stopped at „obavezno" and went to a server that keeps a
   * whole number, and „1.200" metres of climb, which somebody writing twelve hundred types,
   * was already quietly one point two. A field that keeps a whole number now refuses a
   * separator on the form, so the member is stopped there rather than given a different
   * number or a refusal he cannot read.
   *
   * <p>Read off the definition and held to the server by `forms/wholeNumbers.test.ts`, which
   * reads the type the route declares for every number field on disk.
   */
  integer?: boolean
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
   * Which group of the form this field belongs to, named by what the group is
   * called (owner, 28.09.2026: „organizuj je bolje, možda ponovo jedno ispod
   * drugog", answered with groups rather than with one column).
   *
   * Drawn as a `fieldset` with a `legend`, which is the one construct a screen
   * reader says before every field inside it: a heading over a run of fields
   * says nothing about which fields it covers, and a member who arrives at
   * „Broj ličnog dokumenta" by keyboard is told which part of the form he is
   * in only if the grouping is the real one.
   *
   * Grouped by walking the list in order, the same way rows are, so a group is
   * a run of neighbours and what is on screen is always in the order of the
   * file. Fields without it are drawn exactly as they were before groups
   * existed, which is what the other eleven forms rely on.
   *
   * Rows live INSIDE groups and keep their thirds (`PDL.md`, owner 12.08.2026:
   * „Podeli je racionalno na trećine horizontalno"). What the group removes is
   * only the need to fill a row to three ACROSS a boundary: before groups, the
   * three fields nothing else claimed had to share a row, and the number of an
   * identity document sat beside the size of a shirt.
   */
  groupKey?: string
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
  /**
   * How many columns every row of this form has, whatever its fields fill.
   *
   * Without it a row is as wide as the fields standing on it, which is right for
   * eleven of the twelve forms: they have no shape of their own and a row of two
   * is two halves. The registration has one. Owner, 12.08.2026: „Podeli je
   * racionalno na trećine horizontalno", and on 28.09.2026 he said what happens
   * where a row does not fill them, three times over: „Prvi red je Adresa i
   * telefon (Treća kolona je prazna)", „Drugi red su jednake trećine za Mesto i
   * Državu (Treća kolona je prazna)", „Takmičenje ima Kategoriju i Veličinu
   * majice po trećinama, treća trećina je prazna".
   *
   * So the empty third is a decision and not what is left over: a field on a row
   * of two is HALF the form wide, and he asked for it to be a third and for the
   * rest to stay empty. Counted per row, „Adresa, Telefon" cannot say that;
   * declared once on the form, every row says it and there is one number to
   * move.
   *
   * A row that needs MORE than this keeps what it needs (`FormRenderer.tsx`), so
   * this is a floor and never a ceiling: it cannot push a field off a row into a
   * second line, which is the one way a number written here could break a form
   * silently. `drawsEveryRowOfTheRegistrationInThirds` in `fieldHint.test.tsx`
   * measures that no row of the registration reaches for it.
   */
  columns?: number
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
  /* Where the value comes from used to be said here, in words, on the ground that
     a value nobody can change has to say who decided it or it reads as a fault.
     Both of the two the portal has, the address of an event and the address of a
     team, were on the numbered list of sixty one the owner read on 31.08.2026, and
     neither is among the seven he kept: „Sve ostalo treba obrisati." The property
     goes with them rather than staying as a shape nothing fills, and the reason it
     existed is written here so it is not learned again. */
  /** The words shown for it: a dictionary key where there is one, and the value
   *  itself where there is not, which is what translate() does with a key it
   *  does not know. */
  shownKey: string
}

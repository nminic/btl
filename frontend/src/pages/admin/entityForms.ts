import clan from '../../forms/definitions/admin-clan.form.json'
import dogadjaj from '../../forms/definitions/admin-dogadjaj.form.json'
import liga from '../../forms/definitions/admin-liga.form.json'
import cena from '../../forms/definitions/admin-cena.form.json'
import strana from '../../forms/definitions/admin-strana.form.json'
import tim from '../../forms/definitions/admin-tim.form.json'
import trka from '../../forms/definitions/admin-trka.form.json'
import znacka from '../../forms/definitions/admin-znacka.form.json'
import { categoryOf } from '../../data/raceCategory'
import { applyChanges, recordValue } from '../../forms/records'
import type { DerivedField, FieldError, FormDef, FormValues } from '../../forms/types'
import type { Created, Creations, Edits } from '../../session/context'

/* The eight entities administration owns, described rather than programmed.
 *
 * Each one is a JSON definition of its fields and three facts about the record
 * behind them: what its identity is called, and what it carries that the form
 * does not ask about. There is one renderer, one editor and one list merger for
 * all eight, so a ninth entity is a JSON file and four lines here, never a
 * screen (PDL P30).
 */
export type EntityDef = {
  /**
   * Both the key its new records are remembered under in the session and the
   * stem of the two headings in the dictionary: admin.form.new.<id> and
   * admin.form.edit.<id>. Serbian will not interpolate a noun into "new", so the
   * eight titles are written out rather than composed.
   */
  id: string
  form: FormDef
  /** The field that names a record. Taken from the form where the form asks for
   *  it, generated where it does not: a member number is typed in by hand, the
   *  id of an event is not something anybody should be typing. */
  idField: string
  /** What the record carries that the form leaves alone, so a created record has
   *  the same shape as a generated one and the lists cannot tell them apart. */
  blank: Record<string, unknown>
  /** What the record carries that is read off the fields rather than asked for.
   *  Shown on the form as words, and written onto the record on saving. */
  derived?: (values: FormValues) => DerivedValue[]
}

/** A derived value as the record needs it: the words the form shows, plus the
 *  value that is written down. */
export type DerivedValue = DerivedField & { value: string }

/**
 * Membership of a team is deliberately not on the member form: a competitor
 * joins a team through a request or an invitation, and never because an
 * administrator typed an id (PDL P13).
 */
export const MEMBERS: EntityDef = {
  id: 'members',
  form: clan as FormDef,
  idField: 'memberNumber',
  blank: { teamId: null },
}

export const EVENTS: EntityDef = {
  id: 'events',
  form: dogadjaj as FormDef,
  idField: 'id',
  blank: { slug: '', raceIds: [] },
}

/**
 * The category of a race is not on the form and never will be: it is read off
 * the distance, by the exact value with no tolerance (PDL P5), so a race entered
 * as 42.2 km is a marathon and there is nothing to decide. It was a free choice
 * beside the distance, which let a marathon be saved as a short race and made
 * the board of most marathons lie.
 */
export const RACES: EntityDef = {
  id: 'races',
  form: trka as FormDef,
  idField: 'id',
  blank: {},
  derived: (values) => {
    /* Words and an empty field both come out as not a number, and every
       comparison against that is false, so one comparison covers both. */
    const distance = Number(String(values.distanceKm))
    const known = distance > 0
    const category = known ? categoryOf(distance) : ''

    return [
      {
        name: 'category',
        labelKey: 'admin.field.category',
        hintKey: 'admin.hint.category',
        value: category,
        shownKey: known ? `category.${category}` : 'admin.field.categoryFromDistance',
      },
    ]
  },
}

export const TEAMS: EntityDef = {
  id: 'teams',
  form: tim as FormDef,
  idField: 'id',
  blank: { slug: '' },
}

/** Which events count towards a league is not on the form: there is no field
 *  type for a list of records, and inventing one to hold forty-six event ids
 *  would be a worse screen than the one that assigns them properly. */
export const LEAGUES: EntityDef = {
  id: 'leagues',
  form: liga as FormDef,
  idField: 'id',
  blank: { slug: '', eventIds: [] },
}

export const BADGES: EntityDef = {
  id: 'badges',
  form: znacka as FormDef,
  idField: 'id',
  blank: {},
}

export const PRICING: EntityDef = {
  id: 'pricing',
  form: cena as FormDef,
  idField: 'key',
  blank: {},
}

/** A written page is a title and a list of sections. The form reaches the first
 *  section, which is what a page starts with; the rest wait for the editor that
 *  arrives with the database. */
export const PAGES: EntityDef = {
  id: 'pages',
  form: strana as FormDef,
  idField: 'slug',
  blank: { sectionCount: 1 },
}

/** All eight, so a test can walk them and nothing can be half added. */
export const ENTITY_FORMS: EntityDef[] = [
  MEMBERS,
  EVENTS,
  RACES,
  TEAMS,
  LEAGUES,
  BADGES,
  PRICING,
  PAGES,
]

/** What the editor is open on: a record being changed, or a new one. */
export type Editing = { mode: 'new' } | { mode: 'one'; record: Record<string, unknown> }

/** Whether the form itself asks for the identity of the record it creates. */
export function namesItself(entity: EntityDef): boolean {
  return entity.form.fields.some((field) => field.name === entity.idField)
}

/** The identity a record about to be created gets: what was typed where the form
 *  asks for it, and a made up one where it does not. */
export function idFor(entity: EntityDef, values: FormValues, made: number): string {
  return namesItself(entity) ? String(values[entity.idField]) : `${entity.id}-nov-${made + 1}`
}

/**
 * Whether the identity typed into the form belongs to somebody already, as an
 * error beside that field.
 *
 * A member number is unique (PDL P8) and so is the address of a written page.
 * Without this the identity was taken as typed: two records answered to one
 * identity, the list drew two rows with the same key, and one change reached
 * both of them, because the overlay of changes is keyed by exactly that
 * identity. Entering a member as 000001 was enough.
 *
 * Only for the entities whose form asks for their identity. The other six
 * generate one that cannot collide.
 */
export function takenIdentity(
  entity: EntityDef,
  values: FormValues,
  taken: string[],
): Record<string, FieldError> {
  const typed = String(values[entity.idField] ?? '').trim()

  return namesItself(entity) && taken.includes(typed)
    ? { [entity.idField]: { key: 'form.errors.taken' } }
    : {}
}

/** A created record in the shape the lists read. */
export function recordFrom(entity: EntityDef, created: Created): Record<string, unknown> {
  const record: Record<string, unknown> = { ...entity.blank }

  for (const field of entity.form.fields) {
    record[field.name] = recordValue(field, created.values[field.name])
  }

  /* What the form did not ask for but the record carries all the same, read off
     what it did ask for: the category of a race is its distance (PDL P5). */
  for (const value of entity.derived?.(created.values) ?? []) {
    record[value.name] = value.value
  }

  record[entity.idField] = created.id

  return record
}

/**
 * Everything the list shows: what was created during this visit first, then what
 * was generated, all of it read through the overlay of changes.
 *
 * The cast is the one place the prototype admits it has no database. A created
 * record is built out of a form definition and a table of defaults, so nothing
 * can prove its shape at compile time; the tests prove it at run time instead.
 */
export function recordsOf<T extends object>(
  entity: EntityDef,
  base: T[],
  edits: Edits,
  creations: Creations,
): T[] {
  const made = (creations[entity.id] ?? []).map((one) => recordFrom(entity, one) as T)

  return [...made, ...base].map((one) =>
    applyChanges(one, edits[String((one as Record<string, unknown>)[entity.idField])]),
  )
}

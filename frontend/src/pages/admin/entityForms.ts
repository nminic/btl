import clan from '../../forms/definitions/admin-clan.form.json'
import dogadjaj from '../../forms/definitions/admin-dogadjaj.form.json'
import liga from '../../forms/definitions/admin-liga.form.json'
import cena from '../../forms/definitions/admin-cena.form.json'
import moderator from '../../forms/definitions/admin-moderator.form.json'
import strana from '../../forms/definitions/admin-strana.form.json'
import tim from '../../forms/definitions/admin-tim.form.json'
import trka from '../../forms/definitions/admin-trka.form.json'
import znacka from '../../forms/definitions/admin-znacka.form.json'
import { nextMemberNumber } from '../../data/memberNumber'
import { categoryOf } from '../../data/raceCategory'
import { applyChanges, recordValue } from '../../forms/records'
import type { DerivedField, FieldError, FormDef, FormValues } from '../../forms/types'
import type { Created, Creations, Edits } from '../../session/context'

/* The nine entities administration owns, described rather than programmed.
 *
 * Each one is a JSON definition of its fields and a few facts about the record
 * behind them: what it is called, where its screen lives, what its identity is
 * called, and what it carries that the form does not ask about. There is one
 * renderer, one editor and one list merger for all nine, so a tenth entity is a
 * JSON file and four lines here, never a screen (PDL P30).
 *
 * This list is also what the list of entities and the rights matrix are built
 * from, so a tenth entity appears on both the day it is added rather than on the
 * day somebody remembers a second list.
 */
export type EntityDef = {
  /**
   * Both the key its new records are remembered under in the session and the
   * stem of the two headings in the dictionary: admin.form.new.<id> and
   * admin.form.edit.<id>. Serbian will not interpolate a noun into "new", so the
   * nine titles are written out rather than composed.
   */
  id: string
  /** The words that name it: on the list of entities, and over its column in
   *  the rights matrix. */
  labelKey: string
  /** Where its screen lives, below the language. */
  path: string
  /**
   * Whether only the superadmin reaches it, rather than everybody on staff.
   *
   * True of moderators alone, and it is the whole difference between the two
   * roles: the superadmin does nothing a moderator cannot, he decides what the
   * moderator may (PDL P21). A moderator who could open this screen would be a
   * moderator who could tick his own boxes.
   */
  superadminOnly?: boolean
  form: FormDef
  /** The field that names a record. Taken from the form where the form asks for
   *  it, handed out or made up where it does not: the address of a written page
   *  is typed in, the id of an event is not something anybody should be typing. */
  idField: string
  /**
   * How a record gets an identity the system owns, given every identity that is
   * spoken for. Only members have one: a member number is handed out first free
   * in order and an administrator never types it (PDL P8, 30.07.2026).
   *
   * The other seven either ask for their identity on the form or get a made up
   * one, and neither of those needs to know what is taken.
   */
  handsOutIdentity?: (taken: string[]) => string
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
 * Three things are deliberately not on the member form.
 *
 * Membership of a team, because a competitor joins a team through a request or an
 * invitation, and never because an administrator typed an id (PDL P13).
 *
 * The member number, because the system hands it out: first free in order, at the
 * moment somebody records that the fee arrived, and never typed by an
 * administrator (PDL P8, 30.07.2026). It was an obligatory field of six digits
 * with a rule beside it and a check that the number was still free; all three go,
 * and what they were protecting is now the property of the one function that
 * hands the number out.
 *
 * And whether the membership is active, which was a box saying that an unpaid
 * member has an account but is visible nowhere. Nothing reads it any more: a
 * member who has not paid is not in the member list at all, they wait in the
 * queue of memberships (ADL A4d). Leaving the box on the form was a way to put
 * back into the list exactly what that change took out of it, so it is gone and
 * the flag is set here, where the shape of a record is decided.
 */
export const MEMBERS: EntityDef = {
  id: 'members',
  labelKey: 'admin.members',
  path: 'administracija/clanovi',
  form: clan as FormDef,
  idField: 'memberNumber',
  handsOutIdentity: nextMemberNumber,
  blank: { teamId: null, active: true },
}

export const EVENTS: EntityDef = {
  id: 'events',
  labelKey: 'admin.events',
  path: 'administracija/dogadjaji',
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
  labelKey: 'admin.races',
  path: 'administracija/trke',
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
  labelKey: 'admin.teams',
  path: 'administracija/timovi',
  form: tim as FormDef,
  idField: 'id',
  blank: { slug: '' },
}

/** Which events count towards a league is not on the form: there is no field
 *  type for a list of records, and inventing one to hold forty-six event ids
 *  would be a worse screen than the one that assigns them properly. */
export const LEAGUES: EntityDef = {
  id: 'leagues',
  labelKey: 'admin.leagues',
  path: 'administracija/lige',
  form: liga as FormDef,
  idField: 'id',
  blank: { slug: '', eventIds: [] },
}

export const BADGES: EntityDef = {
  id: 'badges',
  labelKey: 'admin.badges',
  path: 'administracija/znacke',
  form: znacka as FormDef,
  idField: 'id',
  blank: {},
}

export const PRICING: EntityDef = {
  id: 'pricing',
  labelKey: 'admin.pricing',
  path: 'administracija/cenovnik',
  form: cena as FormDef,
  idField: 'key',
  blank: {},
}

/** A written page is a title and a list of sections. The form reaches the first
 *  section, which is what a page starts with; the rest wait for the editor that
 *  arrives with the database. */
export const PAGES: EntityDef = {
  id: 'pages',
  labelKey: 'admin.pages',
  path: 'administracija/strane',
  form: strana as FormDef,
  idField: 'slug',
  blank: { sectionCount: 1 },
}

/**
 * The ninth, and the one that is unlike the other eight in what it is for rather
 * than in how it is entered (PDL P28a, 30.07.2026).
 *
 * The form asks for three things and nothing else. What a moderator may do is
 * not on it and must not be: rights are ticked in the matrix on the same screen,
 * a box per entity and a box per queue, and a second place to set them would be
 * a second answer to one question. A moderator entered here therefore starts
 * with none, which is exactly what a newly made moderator is.
 *
 * The identity is made up rather than typed, like six of the other eight. The
 * address of a moderator is the obvious candidate and is deliberately not used:
 * it is the one field on the form somebody may have to correct, and an identity
 * that changes takes every right hung off it with it.
 */
export const MODERATORS: EntityDef = {
  id: 'moderators',
  labelKey: 'admin.moderators',
  path: 'administracija/moderatori',
  superadminOnly: true,
  form: moderator as FormDef,
  idField: 'id',
  blank: { rights: [] },
}

/** All nine, so a test can walk them and nothing can be half added. */
export const ENTITY_FORMS: EntityDef[] = [
  MEMBERS,
  EVENTS,
  RACES,
  TEAMS,
  LEAGUES,
  BADGES,
  PRICING,
  PAGES,
  MODERATORS,
]

/** What the editor is open on: a record being changed, or a new one. */
export type Editing = { mode: 'new' } | { mode: 'one'; record: Record<string, unknown> }

/** Whether the form itself asks for the identity of the record it creates. */
export function namesItself(entity: EntityDef): boolean {
  return entity.form.fields.some((field) => field.name === entity.idField)
}

/**
 * The identity a record about to be created gets, in the three ways an entity can
 * come by one: handed out by the system out of what is free, typed where the form
 * asks for it, or made up where nobody should be typing it.
 *
 * `taken` is every identity that is spoken for, which is what makes the first of
 * the three possible. The list is the one the screen is showing rather than the
 * file it read, so numbers taken by records entered during this visit are in it.
 */
export function idFor(
  entity: EntityDef,
  values: FormValues,
  made: number,
  taken: string[],
): string {
  if (entity.handsOutIdentity !== undefined) {
    return entity.handsOutIdentity(taken)
  }

  return namesItself(entity) ? String(values[entity.idField]) : `${entity.id}-nov-${made + 1}`
}

/**
 * Whether the identity typed into the form belongs to somebody already, as an
 * error beside that field.
 *
 * The address of a written page is unique, and without this it was taken as
 * typed: two records answered to one identity, the list drew two rows with the
 * same key, and one change reached both of them, because the overlay of changes
 * is keyed by exactly that identity. Two pages on /pravilnik was enough.
 *
 * Only for the entities whose form asks for their identity, which is now written
 * pages alone. A member number is unique too (PDL P8), and it is kept unique by
 * being handed out rather than checked: the number the system gives is the first
 * one nobody holds, so there is no typed value left to refuse. The other six
 * generate an identity that cannot collide.
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

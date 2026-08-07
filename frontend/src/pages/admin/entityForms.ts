import clan from '../../forms/definitions/admin-clan.form.json'
import dogadjaj from '../../forms/definitions/admin-dogadjaj.form.json'
import liga from '../../forms/definitions/admin-liga.form.json'
import cena from '../../forms/definitions/admin-cena.form.json'
import moderator from '../../forms/definitions/admin-moderator.form.json'
import strana from '../../forms/definitions/admin-strana.form.json'
import tim from '../../forms/definitions/admin-tim.form.json'
import trka from '../../forms/definitions/admin-trka.form.json'
import dukat from '../../forms/definitions/admin-dukat.form.json'
import { nextMemberNumber } from '../../data/memberNumber'
import { categoryOf } from '../../data/raceCategory'
import { isoDate } from '../../forms/dateField'
import { slugify } from '../rulebookToc'
import { applyChanges, recordValue } from '../../forms/records'
import type { DerivedField, FieldDef, FieldError, FormDef, FormValues } from '../../forms/types'
import type { Created, Creations, Deletions, Edits } from '../../session/context'

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
  /**
   * Whether the set of records is fixed: nothing added, nothing removed, only
   * changed.
   *
   * True of the price list alone (owner, 30.07.2026), whose rows are the four
   * windows of the year. It keeps its right in the matrix and its guard like
   * every other entity, and it leaves the section of entities, which is the
   * place for the ones that are created and removed.
   */
  fixed?: boolean
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
  blank: { raceIds: [] },
  /**
   * The address the event answers at, from its name and its day.
   *
   * Not on the form and never will be, for the same reason the category of a
   * race is not: it is read off what the form does ask for, so there is nothing
   * to decide and nothing to get wrong. The generated events are named this way
   * (`btl-produkt/istorijski-podaci/napravi-mock.py`) and so anything entered
   * here matches what is already there.
   *
   * It used to be blank, which meant every event entered by hand answered at
   * `/kalendar/`, an address that is no event: the record was in the
   * administration's list and nowhere a visitor could reach. Nothing said so,
   * because nobody looks for an event they have just typed in. Copying an event
   * is what made it impossible to miss (owner, 03.08.2026).
   *
   * Shown on the form, because an administrator who is about to send somebody a
   * link should be able to read it before they save.
   */
  derived: (values) => [
    {
      name: 'slug',
      labelKey: 'admin.field.eventSlug',
      hintKey: 'admin.hint.eventSlug',
      value: eventSlug(String(values.name), String(values.date)),
      shownKey: eventSlug(String(values.name), String(values.date)),
    },
  ],
}

/**
 * The address an event answers at: its name, then the day it is run.
 *
 * The day is part of it because the same race is run every year and the name on
 * its own would collide with itself: there are three events called Resolution
 * Run in the data and they are three different mornings.
 */
export function eventSlug(name: string, date: string): string {
  const day = isoDate(date)

  return [slugify(name), day].filter((part) => part !== '').join('-')
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
  /* What the form does not ask for but every team carries. A screen reads
     `team.bio` and splits it into paragraphs, so a team made without one is a
     team whose page cannot be drawn. */
  blank: { bio: '' },
  /**
   * The address the team answers at, from its name.
   *
   * The same reasoning as the event's, and the same fault it had: `slug` was
   * blank on anything entered by hand, so a team entered in the administration
   * or approved out of the queue sat in the list carrying no address at all. A
   * team's name has no day to go with it, because a team is not run once a year.
   *
   * What this fixes is the record, not yet the sight of it. No public screen
   * reads the overlay this prototype keeps its changes in, so a team approved
   * today is not on `/tim/…` whatever its address says (PENDING, R7). The
   * address is right in the record from the moment it is made, which is what
   * the database will be handed.
   */
  derived: (values) => [
    {
      name: 'slug',
      labelKey: 'admin.field.teamSlug',
      hintKey: 'admin.hint.teamSlug',
      value: slugify(String(values.name)),
      shownKey: slugify(String(values.name)),
    },
  ],
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
  id: 'ducats',
  labelKey: 'admin.ducats',
  path: 'administracija/dukati',
  form: dukat as FormDef,
  idField: 'id',
  blank: {},
}

/* The one entity whose rows are the year itself: four windows that tile it and
 * repeat, plus the junior price that has none. Nothing is added and nothing is
 * removed (owner, 30.07.2026), so it is not in the section that is about
 * creating and removing; it is a screen of administration. */
export const PRICING: EntityDef = {
  id: 'pricing',
  labelKey: 'admin.pricing',
  path: 'administracija/cenovnik',
  form: cena as FormDef,
  idField: 'key',
  fixed: true,
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
  made: string[],
  taken: string[],
): string {
  if (entity.handsOutIdentity !== undefined) {
    return entity.handsOutIdentity(taken)
  }

  if (namesItself(entity)) {
    return String(values[entity.idField])
  }

  /* One past the highest already used, and not the length of the list.
   *
   * The length goes back down. Make two records, delete the first, make a
   * third, and the third is handed the identity the second holds: the list
   * draws two rows under one key, and a change to either reaches both, because
   * the overlay of changes is keyed by exactly that identity. That is the same
   * fault this file warns about two functions down, arriving by a different
   * door. Counting up from the highest never goes back. */
  const highest = made.reduce((most, one) => {
    /* Taken apart rather than indexed. Read as `found[1]` the digits are "string
       or nothing", `Number(undefined)` is not a number, and `Math.max` of it is
       not a number either: every record then came out `-nov-NaN`, which is one
       identity for all of them. That is the very fault this counter exists to
       stop, and it went in silently, because nothing about a name is checked at
       the point it is made. */
    /* Two backslashes, because this is a template literal: written with one,
       JavaScript reads it as an escape and hands the expression `d+`, which
       matches nothing, so the count stayed at nought and every record was
       named `-nov-1`. */
    const [, digits] = new RegExp(`^${entity.id}-nov-(\\d+)$`).exec(one) ?? []

    return digits === undefined ? most : Math.max(most, Number(digits))
  }, 0)

  return `${entity.id}-nov-${highest + 1}`
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

/**
 * What a form holds, value by value, with the field each value belongs to.
 *
 * Walked from the values and matched to the fields, rather than walked from the
 * fields and reaching into the values by name. The two are one thing seen twice:
 * a form's values are written from that same form's fields and cover them
 * exactly (forms/validate.ts, emptyValues). Reaching in by name is nevertheless
 * a question that can be asked about a field the values say nothing about, and
 * whatever the answer to that question were, it would be a value nobody typed
 * being written into a record or shown on a confirmation as though somebody had.
 * Paired this way there is no such question: every value that comes out arrived
 * with the field that describes it.
 */
export function fieldValues<T extends string | boolean>(
  form: FormDef,
  values: Record<string, T>,
): { field: FieldDef; value: T }[] {
  return Object.entries(values).flatMap(([name, value]) =>
    form.fields.filter((field) => field.name === name).map((field) => ({ field, value })),
  )
}

/** A created record in the shape the lists read. */
export function recordFrom(entity: EntityDef, created: Created): Record<string, unknown> {
  const record: Record<string, unknown> = { ...entity.blank }

  for (const { field, value } of fieldValues(entity.form, created.values)) {
    record[field.name] = recordValue(field, value)
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
 * Everything administration has changed, handed over whole.
 *
 * One argument rather than three, so a tenth screen cannot be written that reads
 * the changes and the creations and forgets the deletions: the type says all
 * three or none, and a record somebody deleted going on standing in a list is
 * the kind of thing nobody reports because it reads as a screen that has not
 * refreshed.
 */
export type Overlay = { edits: Edits; creations: Creations; deletions: Deletions }

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
  { edits, creations, deletions }: Overlay,
): T[] {
  const made = (creations[entity.id] ?? []).map((one) => recordFrom(entity, one) as T)
  const gone = deletions[entity.id] ?? []
  const identity = (one: T) => String((one as Record<string, unknown>)[entity.idField])

  /* Deletions are read past the generated records only. What was entered during
     this visit is dropped when it is deleted (SessionProvider), so it is never
     in here to be filtered; filtering it here as well would mean that entering a
     member under a number that a deletion had just freed produced a member who
     saved, confirmed, and was then not in the list, with the next member handed
     the same number again, and again after that. */
  return [...made, ...base.filter((one) => !gone.includes(identity(one)))].map((one) =>
    applyChanges(one, edits[identity(one)]),
  )
}

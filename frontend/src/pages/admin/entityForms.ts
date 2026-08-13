import { fieldDate } from '../../forms/dateField'
import { cena, clan, dogadjaj, liga, moderator, strana, tim, trka } from '../../forms/definitions'
import { nextMemberNumber } from '../../data/memberNumber'
import { categoryOf } from '../../data/raceCategory'
import { isoDate } from '../../forms/dateField'
import { slugify } from '../rulebookToc'
import { applyChanges, fieldValue, recordValue } from '../../forms/records'
import type { DerivedField, FieldDef, FieldError, FormDef, FormValues } from '../../forms/types'
import type { Created, Creations, Deletions, Edits } from '../../session/context'

/* The seven entities administration owns, described rather than programmed.
 *
 * Each one is a JSON definition of its fields and a few facts about the record
 * behind them: what it is called, where its screen lives, what its identity is
 * called, and what it carries that the form does not ask about. There is one
 * renderer, one editor and one list merger for all seven, so an eighth entity is a
 * JSON file and four lines here, never a screen (PDL P30).
 *
 * This list is also what the list of entities and the rights matrix are built
 * from, so an eighth entity appears on both the day it is added rather than on the
 * day somebody remembers a second list.
 */
export type EntityDef = {
  /**
   * Both the key its new records are remembered under in the session and the
   * stem of the two headings in the dictionary: admin.form.new.<id> and
   * admin.form.edit.<id>. Serbian will not interpolate a noun into "new", so the
   * titles are written out rather than composed.
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
  /**
   * What a new record's form opens on, where an empty field is the wrong answer.
   *
   * Different from `blank`, which is what the record carries and the form never
   * asks about. This is asked about: the day of a race is a field somebody may
   * change, and it starts on the day of the event it is being entered under.
   */
  start?: FormValues
  /**
   * What the record carries that is read off the fields rather than asked for.
   * Shown on the form as words, and written onto the record on saving.
   *
   * The record as it was is handed in where there is one, because one derived
   * value is not a function of the fields alone: an address that was written
   * once must not be rewritten by a save that did not touch what it is made of
   * (`EVENTS`, and the events whose address carries more than the rule can
   * build).
   */
  derived?: (values: FormValues, was?: Record<string, unknown>) => DerivedValue[]
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
  form: clan,
  idField: 'memberNumber',
  handsOutIdentity: nextMemberNumber,
  blank: { teamId: null, active: true },
}

export const EVENTS: EntityDef = {
  id: 'events',
  labelKey: 'admin.events',
  path: 'administracija/dogadjaji',
  form: dogadjaj,
  idField: 'id',
  /* An event entered by hand came out of nothing, and says so. Without this the
     field was simply missing from the record while the type promised a string,
     and the walk of editions stopped on the second of its two guards rather
     than the first (data/editions.ts). */
  blank: { copiedFrom: '' },
  /* What a new event opens holding, and every one of the three is the answer
     nearly every event gives (owner, 10. and 11.08.2026): it is a race, it is
     not featured, and it is run in Serbia. A required field whose answer is the
     same ninety nine times in a hundred is a press taken from whoever is
     entering a whole calendar.

     The country is here rather than on a field of its own, because it is the
     second half of the town and has no field (forms/types.ts): the place field
     fills it from the codebook when the town is one the codebook has, and this
     is where it starts for a town it does not. */
  start: { kind: 'race', featured: 'no', country: 'RS' },
  /**
   * The address the event answers at, from its name and its year.
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
   * Off the form since 11.08.2026 and still in the confirmation of the save,
   * which is where an administrator about to send somebody a link reads it.
   */
  derived: (values, was) => {
    const address = addressOfEvent(values, was)

    return [
      {
        name: 'slug',
        labelKey: 'admin.field.eventSlug',
        hintKey: 'admin.hint.eventSlug',
        value: address,
        shownKey: address,
        /* Not on the form any more (owner, 11.08.2026). It is made from the
           name and the year, so there was nothing to do about it there; it is
           still written on every save, which is what it is for. */
        hidden: true,
      },
    ]
  },
}

/**
 * The address a save leaves the event at.
 *
 * Worked out from the name and the year, except where nothing that goes into it
 * has changed: then the address the record already carries stays, whatever it
 * is. Two reasons, and both are about records the rule cannot build.
 *
 * The first is history. Some events of one name were run twice in one year, so
 * their address carries the month as well (Gradska liga, 2017); recomputed on a
 * save that changed the town, it would collapse onto the address its sibling
 * answers at, every result of it would come loose, and the sibling could never
 * be saved again.
 *
 * The second is the point of the year (owner, 10.08.2026): an event put off a
 * week keeps its address and everything joined to it. Rewriting an address that
 * nobody asked to change is the same fault in a smaller size.
 */
export function addressOfEvent(values: FormValues, was?: Record<string, unknown>): string {
  const wanted = eventSlug(String(values.name), String(values.date))

  if (was === undefined) {
    return wanted
  }

  const before = eventSlug(String(was.name), fieldDate(String(was.date)))

  return before === wanted ? String(was.slug) : wanted
}

/**
 * Why this event cannot be saved, or nothing.
 *
 * Two events at one address is the fault this exists to stop. The address is
 * read off the name and the year (`eventSlug`), and copying an event keeps both
 * until somebody moves it, so pressing Kopiraj and saving without touching the
 * date wrote a second record answering at the first one's address. A copy is
 * made for the next season, so moving it out of the year is the ordinary thing
 * to do with one.
 * Everything that joins to an event by address then means both of them: the
 * results of the one are the results of the other, and deleting either takes
 * the other's with it.
 *
 * Said on the form rather than refused quietly, and on the date, because the
 * date is what a copy is expected to change.
 */
export function eventClash(
  values: FormValues,
  taken: string[],
  was?: Record<string, unknown>,
): Record<string, FieldError> {
  /* The address the save will leave, not the one the rule would build out of the
     fields: an event whose address carries more than the rule can build keeps it
     (`addressOfEvent`), and asked about the rule's answer instead, a save that
     changed the town was refused for an address it was not going to take. */
  const address = addressOfEvent(values, was)

  return taken.includes(address) ? { date: { key: 'admin.eventTaken' } } : {}
}

/**
 * Two races of one event on one morning and of one length.
 *
 * A race has no name (PDL P6), so it is known by its event, its day and its
 * length, and two that share all three are two records nothing can tell apart:
 * the row of one and the row of the other carry the same words, and one of the
 * two buttons deletes results. The same pair stands twice in the list a member
 * reports a result from, and whichever is picked is picked blindly.
 *
 * Refused where it is made rather than drawn around afterwards. A duplicate like
 * this is a mistake in the entering, not a shape the calendar has: an event that
 * really runs two races of one length on one morning gives them different
 * lengths, because they are different races.
 *
 * Said on the length, which is the field somebody would change to fix it.
 */
export function raceClash(
  values: FormValues,
  others: { date: string; distanceKm: number }[],
): Record<string, FieldError> {
  const day = isoDate(String(values.date))
  const length = Number(values.distanceKm)

  const same = others.some((one) => one.date === day && one.distanceKm === length)

  return same ? { distanceKm: { key: 'admin.raceTaken' } } : {}
}

/**
 * The address an event answers at: its name, then the year it is run in.
 *
 * The year is part of it because the same race is run every year and the name on
 * its own would collide with itself: there are three events called Resolution
 * Run in the data and they are three different mornings. The year rather than
 * the whole day (owner, 10.08.2026), because an address is read and typed by
 * people: beogradski-maraton-2027 is the Belgrade marathon of that season, and
 * a day in it is a detail that also changes when the race is put off a week.
 *
 * Which is why it is the year and not the day: an event moved inside its season
 * keeps its address, and everything joined to it by address stays joined.
 */
export function eventSlug(name: string, date: string): string {
  /* Both shapes, because both reach here: a form speaks dd/mm/gggg and a record
     keeps gggg-mm-dd, and the copy of an event hands over what the record keeps.
     Read as a form value alone, the copy's address came out with no year at all
     and the rule could never have built it. */
  const day = ISO_DAY.test(date) ? date : isoDate(date)
  const written = slugify(name)

  /* The whole day where the name cannot be spelt at all. The calendar carries
     Greek races (Υψηλάντειος Αγώνας Δρόμου), and the table of letters spells
     Latin and Cyrillic: with the name gone the address would be the year and
     nothing else, so two Greek races of one season would answer at one address
     and the refusal would say the name is taken, which is not what is wrong. */
  if (written === '') {
    return day
  }

  return [written, day.slice(0, 4)].filter((part) => part !== '').join('-')
}

/** What a stored date looks like, as against what a form writes. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The category of a race is not on the form and never will be: it is read off
 * the distance, by the exact value with no tolerance (PDL P5), so a race entered
 * as 42.2 km is a marathon and there is nothing to decide. It was a free choice
 * beside the distance, which let a marathon be saved as a short race and made
 * the board of most marathons lie.
 */
/** The category, read off the distance. Its own function because two definitions
 *  share it: the races, and the races of one event (`racesOf`). */
function categoryFrom(values: FormValues): DerivedValue[] {
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
}

export const RACES: EntityDef = {
  id: 'races',
  /* Neither of these two is read by anything. A definition carries both because
     every entity does, and the races are the one entity whose screen is inside
     another: nothing routes the address since 06.08.2026, and the words are on
     the list of entities, which the races left the same day. They stay as what
     the entity is called and where it would live, so a definition is a whole
     entity rather than the part that happens to be used today. */
  labelKey: 'admin.races',
  path: 'administracija/trke',
  form: trka,
  idField: 'id',
  blank: {},
  derived: categoryFrom,
}

/**
 * The races of one event, as the event's own screen edits them.
 *
 * The same records as `RACES`, minus the one question the screen has already
 * answered: which event this is. A race is one length of one morning and is
 * defined inside its event (owner, 06.08.2026), so offering a list of one
 * thousand events beside it is offering a wrong answer.
 *
 * The event is written on the record all the same, through `derived`, which is
 * where everything that is not asked for is written (the address of an event,
 * the category of a race). The link lives on the race and nowhere else, so this
 * is the only place it is set.
 */
export function racesOf(eventId: string, eventName: string, eventDate: string): EntityDef {
  return {
    ...RACES,
    form: {
      ...RACES.form,
      fields: RACES.form.fields.filter((field) => field.name !== 'eventId'),
    },
    /* The day of the event, in a race being entered rather than changed. One
       event may run over more than one morning, and most do not: the day that is
       right nine times in ten is the one already on the screen, and the form
       says so under the field (owner, 10.08.2026). */
    start: { date: fieldDate(eventDate) },
    derived: (values) => [
      ...categoryFrom(values),
      {
        name: 'eventId',
        labelKey: 'admin.field.event',
        hintKey: 'admin.hint.eventFromScreen',
        value: eventId,
        shownKey: eventName,
      },
    ],
  }
}

export const TEAMS: EntityDef = {
  id: 'teams',
  labelKey: 'admin.teams',
  path: 'administracija/timovi',
  form: tim,
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
  form: liga,
  idField: 'id',
  /* No address here: the form asks for one, and an empty default is exactly what
     left a league answering at /liga/ (PENDING, 10.08.2026). */
  blank: { eventIds: [] },
}

/* The one entity whose rows are the year itself: four windows that tile it and
 * repeat, plus the junior price that has none. Nothing is added and nothing is
 * removed (owner, 30.07.2026), so it is not in the section that is about
 * creating and removing; it is a screen of administration. */
export const PRICING: EntityDef = {
  id: 'pricing',
  labelKey: 'admin.pricing',
  path: 'administracija/cenovnik',
  form: cena,
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
  form: strana,
  idField: 'slug',
  blank: { sectionCount: 1 },
}

/**
 * The sixth, and the one that is unlike the other six in what it is for rather
 * than in how it is entered (PDL P28a, 30.07.2026).
 *
 * The form asks for three things and nothing else. What a moderator may do is
 * not on it and must not be: rights are ticked in the matrix on the same screen,
 * a box per entity and a box per queue, and a second place to set them would be
 * a second answer to one question. A moderator entered here therefore starts
 * with none, which is exactly what a newly made moderator is.
 *
 * The identity is made up rather than typed, like four of the other six. The
 * address of a moderator is the obvious candidate and is deliberately not used:
 * it is the one field on the form somebody may have to correct, and an identity
 * that changes takes every right hung off it with it.
 */
export const MODERATORS: EntityDef = {
  id: 'moderators',
  labelKey: 'admin.moderators',
  path: 'administracija/moderatori',
  superadminOnly: true,
  form: moderator,
  idField: 'id',
  blank: { rights: [] },
}

/**
 * Every entity with a screen of its own, in the order the section lists them
 * (owner, 06.08.2026).
 *
 * The races are not among them: a race is one length of one morning and is
 * edited inside its event, which is the only place that knows which event it
 * is. Its definition stands above all the same, because the form is the same
 * form (`racesOf`).
 *
 * Nor are the ducats: they are a catalogue in the rulebook and a collection on
 * a profile (PDL P11), and the definitions behind them are not something
 * administration edits day to day.
 */
export const ENTITY_FORMS: EntityDef[] = [
  MEMBERS,
  EVENTS,
  TEAMS,
  LEAGUES,
  PAGES,
  MODERATORS,
  PRICING,
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
 * Whether the address typed into the form is answered at by something already,
 * as an error beside that field.
 *
 * An address is unique or it is not an address. Without this it was taken as
 * typed: two written pages answered on /pravilnik, the list drew two rows under
 * one key, and one change reached both, because the overlay of changes is keyed
 * by the identity a page is filed under, which is its address.
 *
 * Only for the two entities whose form asks for one: a written page, filed under
 * its address, and a league, filed under an id nobody sees and answering at an
 * address somebody chose (`addressField`). An event's address is worked out from
 * the name and the year and refused by a rule of its own (`eventClash`). A member
 * number is unique too (PDL P8) and kept so by being handed out rather than
 * checked: the number the system gives is the first nobody holds, so there is no
 * typed value to refuse. The rest are filed under an identity nobody types.
 */
export function takenAddress(
  entity: EntityDef,
  values: FormValues,
  taken: string[],
): Record<string, FieldError> {
  /* The field the address is typed into, which is the identity for a written
     page and a field of its own for a league: a league is filed under an id it
     never shows and answers at an address somebody chose (`btl-2027` is not what
     the rule would make of "Balkanska trkačka liga 2027"). Either way it is the
     one field two records must not share. */
  const named = addressField(entity)
  const typed = String(values[named] ?? '').trim()

  return named !== '' && taken.includes(typed) ? { [named]: { key: 'form.errors.taken' } } : {}
}

/**
 * Which field of a form carries the address, or nothing where the form does not
 * ask for one.
 *
 * It is the field called `slug`, wherever it appears, and that is the whole
 * rule. A written page is filed under its address, so for it the field is the
 * identity as well; a league is filed under an id nobody sees and answers at an
 * address somebody chose, so there it is a field like any other. An event is
 * neither: its address is worked out from the name and the year and never typed,
 * so its form has no such field and this answers with nothing.
 */
export function addressField(entity: EntityDef): string {
  return entity.form.fields.some((field) => field.name === 'slug') ? 'slug' : ''
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

/**
 * A created record in the shape the lists read.
 *
 * Everything that was written, and not only what a field asked for. A record is
 * what was made; a form is one way of filling it, and there are values that
 * reach here without a field of their own: the country a place field writes
 * beside the town (forms/types.ts), and the event a copy says it came out of
 * (event/EventActions.tsx). A loop over the fields drops both in silence, which
 * is how an event once went in filed in no country at all while the form had
 * been holding one the whole time.
 *
 * Written before the fields rather than after, so a value that is a field is
 * converted by `recordValue` and a value that is not stays the text it was.
 */
export function recordFrom(entity: EntityDef, created: Created): Record<string, unknown> {
  const record: Record<string, unknown> = { ...entity.blank }

  for (const [name, value] of Object.entries(created.values)) {
    record[name] = value
  }

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
 *
 * ADL A14 bans assertions and the linter refuses them, so this one is refused
 * by name rather than left to pass unnoticed. What takes it away is a backend
 * that answers with records of a known shape, not a rewrite here: any other
 * spelling of it (`any`, a hand-written type guard) makes the same claim with
 * less said.
 */
export function recordsOf<T extends object>(
  entity: EntityDef,
  base: T[],
  { edits, creations, deletions }: Overlay,
): T[] {
  // oxlint-disable-next-line typescript/consistent-type-assertions
  const made = (creations[entity.id] ?? []).map((one) => recordFrom(entity, one) as T)
  const gone = deletions[entity.id] ?? []
  const identity = (one: T) => String(fieldValue(one, entity.idField))

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

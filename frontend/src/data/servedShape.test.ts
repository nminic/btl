import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES, type ResourceName } from './client'
import { must } from '../test/at'
import type {
  Attending,
  BtlEvent,
  EventComment,
  Moderator,
  Race,
  Result,
  StaticPage,
} from './types'
import type { Place } from './places'


/**
 * THE ANSWER THE BACKEND REALLY GIVES, held against the types the screens read.
 *
 * **Why this file exists.** Moving `BASE` from `/mock` to `/api` was refused once,
 * and the refusal was right: the addresses answer, but what they answer with was
 * not the shape a screen could read. The shapes were brought together on
 * 20.09.2026, and what a change like that needs is not a promise but a case: the
 * answer written down as it came off the wire, and handed to the very types the
 * portal reads it through.
 *
 * **The compiler is the assertion, and that is deliberate.** Each sample below is
 * written as a plain value and then handed to a name that carries the type. A
 * field of the wrong sort, or one the type needs and the answer has not got, is a
 * build that does not finish; nothing here has to be run for that half to hold.
 * Written the other way round, as a literal annotated in place, TypeScript would
 * also refuse a field the answer carries and the type does not, which is the one
 * thing that must be allowed: `/api/leagues` answers with `raceIds` and the
 * portal does not read it yet.
 *
 * **One resource is NOT read by its type, and that is the finding rather than an
 * omission.** `/api/ducats` answers with nine fields and `DucatFamily` needs
 * sixteen: the seven legends and marks a coin is drawn from live in the portal
 * and nowhere in the schema. `/api/competitors` is the same shape of gap, five
 * fields wide. Both are named below and neither is papered over, because what to
 * do about a field the server has not got is the half the owner kept for himself
 * („Uskladi oblike, pa polje po polje odluci", 20.09.2026).
 *
 * **Where the samples come from, said exactly.** The ones marked „off the wire"
 * were taken from `127.0.0.1:8081/api/...` on QA on 20.09.2026, against the
 * database carrying the owner's own history. Four addresses answered 401 with an
 * empty body and one answered with an empty list, so for those there was no row
 * to see; those are marked „off the record" and are copied from the record the
 * server declares (`backend/src/main/java/com/btl/portal/web`), which is what
 * Jackson writes out. The difference is written down rather than smoothed over,
 * because a sample nobody measured is a claim and not a measurement.
 */

/* ---- off the wire ------------------------------------------------------- */

const anEvent = {
  id: 273,
  slug: 'fruskogorski-maraton-2010-05-08',
  name: 'Fruškogorski maraton',
  date: '2010-05-08',
  city: 'Novi Sad',
  country: 'RS',
  kind: 'race' as const,
  featured: false,
  description: '',
  link: '',
  copiedFrom: null,
}

const aRace = {
  id: 275,
  eventId: 273,
  name: 'Fruškogorski maraton',
  renamed: false,
  date: '2010-05-08',
  kind: 'length' as const,
  limitSeconds: 0,
  distanceKm: 42.2,
  ascentM: 1200,
  descentM: 1200,
  category: 'marathon' as const,
}

/** A result of somebody who has registered and has no member number yet, which is
 *  an ordinary row since V16 and the reason `Result.memberNumber` takes nothing. */
const aResult = {
  id: 275,
  memberNumber: null,
  raceId: 275,
  raceName: 'Fruškogorski maraton',
  eventName: 'Fruškogorski maraton',
  eventSlug: 'fruskogorski-maraton-2010-05-08',
  date: '2010-05-08',
  distanceKm: 42.2,
  ascentM: 1200,
  descentM: 1200,
  seconds: 15_600,
  points: 231.44,
  category: 'marathon' as const,
}

/** And the other state: a result of somebody who has a number. */
const aCountedResult = { ...aResult, id: 276, memberNumber: '000001' }

/** A list whose rows carry their own address, and every block says whether it
 *  draws anything: `gallery` is there and empty on a block that draws none. */
/** The other state of the same field: an event that WAS copied, which is what
 *  says `copiedFrom` is a number or nothing and never text. */
const aCopiedEvent = { ...anEvent, id: 274, copiedFrom: 273 }

const aPage = {
  slug: 'politika-privatnosti',
  title: 'Politika privatnosti',
  sections: [{ heading: '1. Ko smo i koji propisi važe', body: 'Vašim podacima…', gallery: null }],
  includes: [],
}

const aDucat = {
  id: 'duk-mesecni-km',
  name: 'Mesečni kilometri',
  kind: 'totalKm' as const,
  value: 125,
  period: 'month' as const,
  tier: 1 as const,
  step: 0,
  last: 0,
  tierUpFrom: 0,
}

/** Three long, or four where a town's English name really differs. The lengths are
 *  written down here because that is what the answer holds; whether the portal reads
 *  them is what the two names below say. */
const aTown: [number, string, string] = [1_796_236, 'Shanghai', 'CN']
const anEnglishTown: [number, string, string, string] = [792_680, 'Beograd', 'RS', 'Belgrade']

/* ---- off the record the server declares --------------------------------- */

const anAttendance = { eventId: 273, memberNumber: '000001' }

const aComment = {
  id: 1,
  eventId: 273,
  memberNumber: '000007',
  who: 'Strahinja Vukićević',
  date: '2010-05-08',
  rating: { organisation: 5, value: 4, ambience: 5 },
  body: 'Odlična organizacija.',
}

/** `/api/competitors` answered with an empty list on the day the samples were
 *  taken, so no row of it has been seen; this is its record, component for
 *  component (`CompetitorApi.Competitor`). It is here for the second half of the
 *  question only - which fields the server has not got - and no name carries it,
 *  because `Competitor` needs five it has not. */
const aCompetitor = {
  memberNumber: '000001',
  firstName: 'Vladan',
  lastName: 'Đurišić',
  gender: 'M' as const,
  city: 'Beograd',
  country: 'RS',
  firstSeason2027: false,
  firstSeason: 2014,
  bio: '',
  teamId: 1,
  teamSince: 2014,
  profileHidden: false,
  birthdayShown: 'none' as const,
}

/** And a comment whose author is gone, which is the other state of the same
 *  field: the comment stays and the link to a profile goes (`CommentApi`). */
const anOrphanedComment = { ...aComment, id: 2, memberNumber: null }

const aModerator = {
  id: 4,
  firstName: 'Jelena',
  lastName: 'Radulović',
  email: 'jelena.radulovic@primer.rs',
  rights: ['entity:members'],
}

/* ---- and the whole of the assertion ------------------------------------- */

/* Handed over as values rather than as literals written in place, for the reason
   in the header: a field the answer carries and the portal does not read yet must
   be allowed through, and a literal would be refused for carrying it. */
const readAsEvent: BtlEvent = anEvent
const readAsRace: Race = aRace
const readAsResult: Result = aResult
const readAsPage: StaticPage = aPage
const readAsTown: Place = aTown
const readAsEnglishTown: Place = anEnglishTown
const readAsAttendance: Attending = anAttendance
const readAsComment: EventComment = aComment
const readAsModerator: Moderator = aModerator

/** Every row of what the portal serves today, by resource. */
function servedRows(name: ResourceName): Record<string, unknown>[] {
  const file = readFileSync(join(process.cwd(), 'public', 'mock', `${name}.json`), 'utf8')
  const rows: unknown = JSON.parse(file)

  if (!Array.isArray(rows)) {
    throw new Error(`${name}.json is not a list`)
  }

  must(rows[0], `a first row of ${name}`)

  return rows.map((row: unknown) => {
    /* Read as what it is rather than claimed to be a record: a served file that had
       become a list of numbers would otherwise be compared field by field against
       nothing at all and agree with everything. */
    if (row === null || typeof row !== 'object') {
      throw new Error(`a row of ${name}.json is not a record`)
    }

    return { ...row }
  })
}

/** The first of them, for the questions that are about the shape of a row rather
 *  than about what a column holds. */
function servedRow(name: ResourceName): Record<string, unknown> {
  return must(servedRows(name)[0], `a first row of ${name}`)
}

/** What sort of thing a value is, in the words a JSON answer can be told apart by:
 *  nothing is its own answer rather than „object", because nothing and an object
 *  are the difference this whole change is about. */
function sortOf(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  return Array.isArray(value) ? 'list' : typeof value
}

/**
 * Every sort a field holds across a whole set of rows.
 *
 * **The whole column and not the first row, and that is the difference between a
 * guard and a coincidence.** A field that is a number or nothing shows one of the
 * two in any one row: read off row nought alone, `copiedFrom` written back as an
 * empty string would be „text against nothing", and „nothing" has to be tolerated
 * because a sample cannot show both. Read over the column, the file says
 * `{nothing, number}` and text is not in it.
 */
function sortsUnder(rows: Record<string, unknown>[], field: string): Set<string> {
  return new Set(rows.filter((row) => field in row).map((row) => sortOf(row[field])))
}

/**
 * What the file holds that the answer never does, field by field.
 *
 * Walked from the SERVED fields, so a field the backend has and the file has not
 * is simply not compared; the other way round is the list of what the backend does
 * not serve, and that is named out loud below.
 *
 * The answer's sorts are the union over every sample of that resource, which is
 * why a field with two states gets two samples: `copiedFrom` is a number on an
 * event that was copied and nothing on one that was not, and both are written
 * down, so the file may hold either and nothing else.
 */
function shared(
  answers: Record<string, unknown>[],
  served: Record<string, unknown>[],
): string[] {
  const row = must(served[0], 'a first served row')

  return Object.keys(row)
    .filter((field) => answers.some((answer) => field in answer))
    .flatMap((field) => {
      const there = sortsUnder(answers, field)
      const loose = [...sortsUnder(served, field)].filter((sort) => !there.has(sort))

      return loose.map(
        (sort) => `${field}: served ${sort}, answered ${[...there].sort().join(' or ')}`,
      )
    })
}

/** What the server has not got, of what the file carries. */
function missing(answer: Record<string, unknown>, served: Record<string, unknown>): string[] {
  return Object.keys(served).filter((field) => !(field in answer)).sort()
}

describe('the answer the backend gives', () => {
  it('is read by the types the screens read, field for field', () => {
    /* The compiler has already said so by the time this runs; what is left is to
       name the values, so that a sample deleted in a tidy-up takes a failing case
       with it rather than going quietly. */
    expect(readAsEvent.id).toBe(273)
    expect(readAsEvent.copiedFrom).toBeNull()
    expect(readAsRace.renamed).toBe(false)
    expect(readAsResult.memberNumber).toBeNull()
    expect(readAsPage.slug).toBe('politika-privatnosti')
    expect(aDucat.id).toBe('duk-mesecni-km')
    expect(readAsTown).toHaveLength(3)
    expect(readAsEnglishTown).toHaveLength(4)
    expect(readAsAttendance.eventId).toBe(273)
    expect(readAsComment.eventId).toBe(273)
    expect(readAsModerator.id).toBe(4)
  })

  it('agrees with the served file about the sort of every field they share', () => {
    /* The half the compiler cannot do: it reads the types, and this reads what is
       on the disc. A file that drifted back to text identities or to the words
       „yes" and „no" would still satisfy every type in the portal, because the
       types are what drifted with it. */
    const against: [ResourceName, Record<string, unknown>[]][] = [
      ['events', [anEvent, aCopiedEvent]],
      ['races', [aRace]],
      ['results', [aResult, aCountedResult]],
      ['pages', [aPage]],
      ['ducats', [aDucat]],
      ['attendance', [anAttendance]],
      ['comments', [aComment, anOrphanedComment]],
      ['moderators', [aModerator]],
    ]

    for (const [name, answers] of against) {
      expect(shared(answers, servedRows(name)), name).toEqual([])
    }
  })

  it('names what it does not serve, which is the half nobody has decided yet', () => {
    /* Owner, 20.09.2026: „Uskladi oblike, pa polje po polje odluci." This is the
       second half written down rather than left to be rediscovered: every field
       the portal draws and the server says nothing about. A field that leaves this
       list is a decision somebody took, and a field that joins it is a screen
       drawing something out of nothing. */
    expect(missing(anEvent, servedRow('events'))).toEqual([])
    expect(missing(aRace, servedRow('races'))).toEqual([])
    expect(missing(aResult, servedRow('results'))).toEqual([])
    expect(missing(aPage, servedRow('pages'))).toEqual([])
    expect(missing(anAttendance, servedRow('attendance'))).toEqual([])
    expect(missing(aComment, servedRow('comments'))).toEqual([])
    expect(missing(aModerator, servedRow('moderators'))).toEqual([])

    /* The five a member is drawn by and the schema says nothing about here: the
       band they compete in, whether the fee is standing, what it stands on, the
       code their own link carries, and whose link brought them. `active` is the
       one with a decision already behind it (13.09.2026: a member whose fee has
       lapsed is not on this list at all), and the other four are open. */
    expect(missing(aCompetitor, servedRow('competitors'))).toEqual([
      'active',
      'ageBand',
      'membershipBasis',
      'referralCode',
      'referredBy',
    ])

    /* The seven a coin is drawn from, which is why `DucatFamily` does not read
       this answer at all and why no name above carries it: the legend along the
       top, the same legend for a woman, the legend along the bottom, which of the
       two the period takes, the mark in the middle, the drawing behind it, and
       what the step of a series is counted in. */
    expect(missing(aDucat, servedRow('ducats'))).toEqual([
      'art',
      'bottom',
      'counted',
      'mark',
      'periodAt',
      'top',
      'topFemale',
    ])
  })

  it('is measured for every resource the contract names, or the reason is written here', () => {
    /* The floor under the list above: a fifteenth resource cannot arrive without
       somebody either measuring it or saying why it is not measured. */
    const measured: ResourceName[] = [
      'events',
      'races',
      'results',
      'pages',
      'ducats',
      'places',
      'attendance',
      'comments',
      'moderators',
    ]

    /* The four that were not. `competitors`, `leagues`, `pairs` and `teams`
       answered 200 with an empty list on the day the samples were taken, so no
       row of theirs has ever been seen; `verification` answered 401 and its whole
       shape is a decision the owner has not taken (its answer is grouped by tab
       and carries nine fields fewer than this screen draws). */
    const notSeen: ResourceName[] = ['competitors', 'leagues', 'pairs', 'teams', 'verification']

    expect([...measured, ...notSeen].sort()).toEqual([...RESOURCE_NAMES].sort())
  })
})

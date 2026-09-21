import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES, type ResourceName } from './client'
import { must } from '../test/at'
import type {
  Attending,
  BtlEvent,
  Competitor,
  EventComment,
  League,
  Moderator,
  Race,
  RacingPair,
  Result,
  StaticPage,
  Team,
} from './types'
import type { DucatFamily } from './ducatRule'
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
 * **THE SWITCH HAPPENED ON 21.09.2026 AND THIS FILE IS WHAT IT WAS WAITING FOR, so
 * it grows rather than goes.** Nothing under `src/` fetches the wire in a test run,
 * so the only way a case can hold the answer's SHAPE is to write it down, and the
 * only way to keep a written-down shape honest is to hand it to the types the
 * screens read it through. That was true while `BASE` was `/mock` and it is true
 * now; what changed is which resources have been seen, and the five fields a member
 * was drawn by that the schema said nothing about - three of them are answered
 * since, one has moved home and one has gone.
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
 * **ALL FIFTEEN ARE READ BY THEIR TYPES SINCE 21.09.2026, WHICH IS THE OTHER HALF
 * OF THE OWNER'S ORDER CARRIED OUT.** `/api/competitors` answered thirteen fields
 * on 20.09.2026 and the file the portal drew a member from carried eighteen. „Uskladi
 * oblike, pa polje po polje odluci" is what happened to the five:
 *
 * - `ageBand` is answered, worked out for the season rather than stored (PR 334);
 * - `membershipBasis` is answered to the administration and to nobody else (PR 332);
 * - `referralCode` is answered on the caller's own row and on no other (PR 330);
 * - `referredBy` is GONE and `referredCount` stands where it stood: the column holds
 *   a KEY and never a code (V7), so the count is worked out on the far side and the
 *   portal is handed the number;
 * - `active` is GONE with nothing in its place, because the owner made the absence of
 *   the ROW carry it (13.09.2026).
 *
 * The three that are conditional are optional on the type, which is the same sentence
 * said in TypeScript: a row that is not the caller's own, or an answer that is not the
 * administration's, has not got them.
 *
 * **`/api/ducats` was the second such resource until V27 and is not one any
 * more.** It answered with nine of the sixteen names a coin is drawn by, and the
 * seven that were missing - the two legends, which arc the period takes, the mark,
 * the artwork and what a piece of a run is counted in - were a decision of V15
 * that V27 reversed. So `aDucat` is handed to `DucatFamily` like every other
 * sample here, and the list of what the server has not got is empty rather than
 * seven names long. That empty list is the case, not a tidy-up: a field that
 * rejoins it is a screen drawing something out of nothing.
 *
 * **What a sample is a sample OF, said exactly, because it is not everything.**
 * What this file holds against the types is the set of FIELD NAMES a row carries
 * and the SORT of each (number, text, nothing, list), and those are what was read
 * off `127.0.0.1:8081/api/...` on QA on 20.09.2026, against the database carrying
 * the owner's own history. **The values beside them are not all the server's**,
 * and that was found in review the same day: the event of id 273 answers from
 * another town than the one written here, the race of id 275 with another length,
 * climb and length-class, and the result of id 275 with another time and score.
 * Nothing reads a value here for its own sake - `sortOf` reduces every one of them
 * to its sort before a word of this is compared - so what is wrong is the sentence
 * and never the answer, and the sentence is now the narrow one it should always
 * have been.
 *
 * **Two of the samples are not answers at all and are no longer filed as if they
 * were.** `aCopiedEvent` and `aCountedResult` are the OTHER state of a field that
 * has two, built here out of the row above them, and they have to be built: on QA
 * `copiedFrom` is nothing in all 319 events and `memberNumber` is nothing in all
 * 264 results, so the state where each is a value has no row to be read off. They
 * stand under a heading of their own below, saying so.
 *
 * Four addresses answered 401 with an empty body and one answered with an empty
 * list, so for those there was no row to see at all; those are marked „off the
 * record" and are copied from the record the server declares
 * (`backend/src/main/java/com/btl/portal/web`), which is what Jackson writes out.
 *
 * **And the reach of the two comparisons below, which is one way and not two.**
 * `shared` and `missing` both walk the keys of the SERVED row, so what they answer
 * is „the file holds a field, or a sort, the answer has not". The other direction
 * is invisible to them: `/api/pages` answers with `includes: []` on all four pages
 * and no page in the file carries that field at all, and both of these pass. What
 * the backend has and the portal has not is the half the owner kept for himself
 * („Uskladi oblike, pa polje po polje odluci", 20.09.2026), so it is written down
 * here rather than guarded.
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

/** A list whose rows carry their own address, and every block says whether it
 *  draws anything: `gallery` is there and empty on a block that draws none. */
const aPage = {
  slug: 'politika-privatnosti',
  title: 'Politika privatnosti',
  sections: [{ heading: '1. Ko smo i koji propisi važe', body: 'Vašim podacima…', gallery: null }],
  includes: [],
}

/** All sixteen since V27, which is why this one is read by its type below. The
 *  legend on the bottom arc is empty because the period stands there, and the unit
 *  is empty because the family is one ducat and counts no pieces. */
const aDucat = {
  id: 'duk-mesecni-km',
  name: 'Mesečni kilometri',
  kind: 'totalKm' as const,
  value: 125,
  period: 'month' as const,
  top: 'ISTRČANIH',
  topFemale: '',
  bottom: '',
  periodAt: 'bottom' as const,
  mark: 'distance' as const,
  art: 'none' as const,
  tier: 1 as const,
  step: 0,
  last: 0,
  tierUpFrom: 0,
  counted: '',
}

/** Three long, or four where a town's English name really differs. The lengths are
 *  written down here because that is what the answer holds; whether the portal reads
 *  them is what the two names below say. */
const aTown: [number, string, string] = [1_796_236, 'Shanghai', 'CN']
const anEnglishTown: [number, string, string, string] = [792_680, 'Beograd', 'RS', 'Belgrade']

/* ---- the other state of a field, built rather than read ------------------ */

/* Two fields the answer gives in two states, and QA holds only one of each: on the
   day the samples were taken `copiedFrom` was nothing in all 319 events and
   `memberNumber` was nothing in all 264 results. The state with a value in it
   therefore has no row to be copied from, and is made here out of the row above.
   Written this way round on purpose: what is claimed is only that the field may
   hold that sort, which is what the comparison below reads, and never that some
   row on QA holds exactly this. */

/** An event that WAS copied, which is what says `copiedFrom` is a number or
 *  nothing and never text. */
const aCopiedEvent = { ...anEvent, id: 274, copiedFrom: 273 }

/** And a result of somebody who has a member number. */
const aCountedResult = { ...aResult, id: 276, memberNumber: '000001' }

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
 *  component (`CompetitorApi.Competitor`).
 *
 *  **The three conditional fields are not on it, and that is the sample of a
 *  VISITOR'S row rather than a shortfall.** `referralCode`, `referredCount` and
 *  `membershipBasis` answer null unless the one asking is the member himself or the
 *  administration, and `@JsonInclude(NON_NULL)` leaves a null key out of the answer
 *  altogether, so the row a visitor is handed has fourteen names and no more. The
 *  caller's own row is the sample below it. */
const aCompetitor = {
  memberNumber: '000001',
  firstName: 'Vladan',
  lastName: 'Đurišić',
  gender: 'M' as const,
  city: 'Beograd',
  country: 'RS',
  ageBand: '40-54' as const,
  firstSeason2027: false,
  firstSeason: 2014,
  bio: '',
  teamId: 1,
  teamSince: 2014,
  profileHidden: false,
  birthdayShown: 'none' as const,
}

/** And the same member's row as HE is answered it, which is the other state of
 *  every one of the three: his own code, his own count, and the basis - that last
 *  one because the sample is taken as the administration, which is who the basis
 *  goes to. */
const myOwnRow = {
  ...aCompetitor,
  referralCode: '7f07b38ff7ee7543',
  referredCount: 4,
  membershipBasis: 'payment' as const,
}

/** A team as the administration is answered one: the seat is a member number, and
 *  the mark and its square are both there, which is the only way a picture ever
 *  arrives (`TeamApi`, „both halves or neither"). */
const aTeam = {
  id: 1,
  slug: 'dunavski-trkaci',
  name: 'Dunavski trkači',
  city: 'Novi Sad',
  country: 'RS',
  bio: '',
  logo: '/api/photos/7d1f0a2b',
  crop: { x: 0.5, y: 0.35, size: 0.72 },
  organizerMemberNumber: '000001',
}

/** And a team with no mark, answered to a signed in member who did not found it:
 *  nothing where the picture would be, nothing where its square would be, and no
 *  seat at all. The two nothings travel together and that is the point of writing
 *  this one down beside the row above. */
const aTeamWithNoMark = {
  ...aTeam,
  id: 4,
  slug: 'novoosnovani-tim',
  name: 'Novoosnovani tim',
  logo: null,
  crop: null,
  organizerMemberNumber: undefined,
  foundedByMe: false,
}

/** Both of them, the man first, which is the order the schema stores them in.
 *  Named rather than written in place so the two are a PAIR and not a list that
 *  happens to hold two: ADL A14 refuses an assertion here, and a type annotation
 *  says the same thing without one. */
const twoMembers: [string, string] = ['000001', '000009']

/** A pair, which is three names and not four: the day it was made is answered to
 *  nobody (owner, 13.09.2026). */
const aPair = {
  id: 1,
  season: 2019,
  memberNumbers: twoMembers,
}

/** A league. `raceIds` is on the answer and not on the type, which is the one
 *  direction this file deliberately lets through: what the backend has and the
 *  portal has not is the owner's half. */
const aLeague = {
  id: 1,
  slug: 'btl-liga-2019',
  name: 'BTL liga 2019',
  season: 2019,
  rules: '',
  prizes: '',
  raceIds: [275],
  eventIds: [273],
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
const readAsDucat: DucatFamily = aDucat
const readAsTown: Place = aTown
const readAsEnglishTown: Place = anEnglishTown
const readAsAttendance: Attending = anAttendance
const readAsComment: EventComment = aComment
const readAsModerator: Moderator = aModerator
const readAsVisitorsMember: Competitor = aCompetitor
const readAsMyOwnRow: Competitor = myOwnRow
const readAsTeam: Team = aTeam
const readAsTeamWithNoMark: Team = aTeamWithNoMark
const readAsPair: RacingPair = aPair
const readAsLeague: League = aLeague

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
    expect(readAsDucat.id).toBe('duk-mesecni-km')
    /* The arc the period takes is the empty one, which is the rule V27 put in the
       schema and the shape a screen reads it back by. */
    expect(readAsDucat.periodAt).toBe('bottom')
    expect(readAsDucat.bottom).toBe('')
    expect(readAsTown).toHaveLength(3)
    expect(readAsEnglishTown).toHaveLength(4)
    expect(readAsAttendance.eventId).toBe(273)
    expect(readAsComment.eventId).toBe(273)
    expect(readAsModerator.id).toBe(4)
    /* The four that had never been seen until 21.09.2026, and for each of them the
       state that is the whole reason it is written down twice or not at all. */
    expect(readAsVisitorsMember.membershipBasis).toBeUndefined()
    expect(readAsMyOwnRow.referredCount).toBe(4)
    expect(readAsTeam.organizerMemberNumber).toBe('000001')
    /* Both halves of the mark gone together, which is the arrangement `TeamApi`
       refuses to answer in any other way. */
    expect(readAsTeamWithNoMark.logo).toBeNull()
    expect(readAsTeamWithNoMark.crop).toBeNull()
    expect(readAsTeamWithNoMark.foundedByMe).toBe(false)
    expect(readAsPair.memberNumbers).toHaveLength(2)
    expect(readAsLeague.eventIds).toEqual([273])
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

    /* AND THE DUCATS, WHICH LEFT THIS LIST ON 20.09.2026 RATHER THAN SHRANK IN IT.
       Seven names stood here - `art`, `bottom`, `counted`, `mark`, `periodAt`, `top`
       and `topFemale` - with V15's sentence for a reason: the mark, the artwork and
       the words on the two arcs „is the portal's and stays in the portal". V27
       overturned that and gave them columns, so the answer carries all sixteen names
       a coin is drawn by and this list is empty. Left standing rather than deleted
       because an empty list is the claim: a name that comes back is a screen drawing
       something out of nothing. */
    expect(missing(aDucat, servedRow('ducats'))).toEqual([])

    /* **AND THE MEMBER, WHOSE LIST SHRANK FROM FIVE TO TWO ON 21.09.2026 AND WILL NOT
       GO FURTHER.** The five were the band they compete in, whether the fee is standing,
       what it stands on, the code their own link carries, and whose link brought them.
       Three of them are answered since (PRs 330, 332 and 334); the two below are the file
       carrying names the answer has DECIDED not to have, and both decisions are the
       owner's:

       - `active`, because a member whose fee has lapsed is not on the list at all
         (13.09.2026), so the flag has nothing left to say;
       - `referredBy`, because the column holds the KEY of whoever brought a member (V7)
         and a key does not leave the server; what the screen wanted it for arrives
         counted, as `referredCount`.

       So this is no longer „nobody has decided yet" for these two. It is the generated
       file carrying two fields the portal does not read and the server does not send,
       and it is written down here because that is exactly the difference somebody has to
       see before they trust a green suite: `test/setup.ts` answers a resource out of this
       file, so a case that reads one of these two is reading the seed and not the portal.
       Nothing does, because neither is on `Competitor` any more. */
    expect(missing(myOwnRow, servedRow('competitors'))).toEqual(['active', 'referredBy'])

    /* The team, where the file and the answer agree on every name. The seat is on both,
       although the answer carries it to the administration alone; `missing` is about
       NAMES and the answer to somebody else is a different question, held by
       `TeamApiTest`. */
    expect(missing(aTeam, servedRow('teams'))).toEqual([])

    /* And the pair, where the file carries the one name the owner closed: the day the two
       of them confirmed (13.09.2026, „ne prikazuje se nikome"). */
    expect(missing(aPair, servedRow('pairs'))).toEqual(['since'])

    expect(missing(aLeague, servedRow('leagues'))).toEqual([])
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
      /* The four that answered 200 with an empty list on the day the samples were
         taken, so no row of theirs had been seen. They are written down off the
         record the server declares, the same way the four above them are, and they
         joined the list on 21.09.2026 because `BASE` moved and a resource the portal
         reads with nothing said about its shape is exactly what this file exists to
         forbid. */
      'competitors',
      'leagues',
      'pairs',
      'teams',
    ]

    /* And the one that is not measured, which is now a list of one. `verification`
       answers 401 and its whole shape is a decision the owner has not taken: the
       answer is grouped by tab and carries nine fields fewer than the screen draws.
       The portal asks for it at `/api/verification` like everything else since the
       switch, and what a moderator sees off that answer is the one thing the switch
       leaves owing. It is in `PENDING.md` as a question rather than guessed at here. */
    const notSeen: ResourceName[] = ['verification']

    expect([...measured, ...notSeen].sort()).toEqual([...RESOURCE_NAMES].sort())
  })
})

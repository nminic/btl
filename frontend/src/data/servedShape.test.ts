import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES, type ResourceName } from './client'
/* The answers themselves live in one place, because the harness that stands in for the
   server has to read the same thing this holds (`test/theAnswer.ts` says why). */
import {
  aCompetitor,
  aCompetitorToTheAdministration,
  aLeague,
  aPair,
  aPricePeriod,
  aProcessingFee,
  aTeam,
  aTeamWithNoMark,
  aWaitingItem,
  myOwnRow,
  readAsWaitingItem,
  readAsWaitingItemWithNoNumber,
  readAsAdministrationsRow,
  readAsFee,
  readAsLeague,
  readAsMyOwnRow,
  readAsPrice,
  readAsPair,
  readAsTeam,
  readAsTeamWithNoMark,
  readAsVisitorsMember,
} from '../test/theAnswer'
import { must } from '../test/at'
import { asAnswered } from '../test/theAnswer'
import type {
  Attending,
  BtlEvent,
  EventComment,
  Moderator,
  Race,
  Result,
  StaticPage,
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
 * - `referralCode` was answered on the caller's own row and on no other (PR 330) and is
 *   GONE since 25.09.2026, answered to nobody at all;
 * - `referredBy` is GONE, and `referredCount` stood where it stood until the same day
 *   and is gone with it;
 * - `active` is GONE with nothing in its place, because the owner made the absence of
 *   the ROW carry it (13.09.2026).
 *
 * **WHY THE LAST TWO WENT, AND IT IS THE SAME MEASUREMENT TWICE.** `referredBy` could
 * not leave because it holds a KEY and never a code (V7), so the count was worked out on
 * the far side and the portal handed the number. That answer was still on a list ending
 * `where c.active`, so the member whose fee has LAPSED reached neither the link nor the
 * count - and he is the one V24 section 6 promises them to. Owner, 25.09.2026 (PDL
 * P26a): the link „se sklanja sa javne liste takmicara" and stays only on „Moja
 * članarina". Both now come off `GET /api/me`, which answers one row and that row is his
 * whether or not his fee is standing.
 *
 * The one that is conditional is optional on the type, which is the same sentence
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
    /* The queue's item, and the two halves of it that the wrapper hid: the tab is ON
       the item, and the key is a number here where the portal identifies by text. A
       sample that lost either would be the shape that broke the screen. */
    expect(readAsWaitingItem.queue).toBe('teams')
    expect(readAsWaitingItem.id).toBe(7)
    /* And the second state of the one field of a queue item that has two, which is the
       same shape `copiedFrom` and `memberNumber` are written down twice for above: the
       server answers nothing where there is no member number to give, and the portal's
       empty string is a different sentence that must not stand in for it. */
    expect(readAsWaitingItemWithNoNumber.memberNumber).toBeNull()
    expect(readAsWaitingItem.memberNumber).toBe('000001')

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
    /* THE ONE CONDITIONAL FIELD LEFT, in each of the states its condition puts it in:
       nothing for a visitor, nothing for a member on HIS OWN ROW - which is the thing a
       screen was wrong about until 21.09.2026, because the condition is the CALLER and
       never the row - and the word itself where the caller is the administration.

       There were three until 25.09.2026. The caller's own two went to `/api/me` whole
       (PDL P26a), so the member's own row and a visitor's row are now the same fourteen
       names, and the line below that read his count off his row went with them. */
    expect(readAsVisitorsMember.membershipBasis).toBeUndefined()
    expect(readAsMyOwnRow.membershipBasis).toBeUndefined()
    expect(readAsAdministrationsRow.membershipBasis).toBe('payment')
    expect(readAsTeam.organizerMemberNumber).toBe('000001')
    /* Both halves of the mark gone together, which is the arrangement `TeamApi`
       refuses to answer in any other way. */
    expect(readAsTeamWithNoMark.logo).toBeNull()
    expect(readAsTeamWithNoMark.crop).toBeNull()
    expect(readAsTeamWithNoMark.foundedByMe).toBe(false)
    expect(readAsPair.memberNumbers).toHaveLength(2)
    expect(readAsLeague.eventIds).toEqual([273])
    /* THE FIFTEENTH, AND ITS THREE NULLS ARE THE WHOLE OF WHY IT IS WRITTEN DOWN TWICE.
       A period answers all seven fields; the processing fee answers four of them and says
       „the question does not apply" to the other three, which is V4's own shape in both
       directions and `PricingApi`'s own words. Read through a `string` instead of a
       `string | null`, that first null is what draws „undefined - undefined" in a cell of
       the public price table. */
    expect(readAsPrice.from).toBe('10-01')
    expect(readAsPrice.rsd).toBe(4200)
    expect(readAsPrice.ranking).toBe(true)
    expect(readAsFee.from).toBeNull()
    expect(readAsFee.to).toBeNull()
    expect(readAsFee.rsd).toBeNull()
    expect(readAsFee.ranking).toBeNull()
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
      /* Both shapes of the price list against the served file, and the pair matters here
         more than anywhere else on this list: the fee is the only row of the seven whose
         three nulls have to survive the round trip, and a file that had written `''` and
         `false` in their place - which is what `data/pricing.ts` spells - would satisfy
         every type in the portal while drawing „undefined - undefined" on the page the
         rulebook publishes. */
      ['pricing', [aPricePeriod, aProcessingFee]],
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

    /* AND THREE OF THE QUEUE, WHICH ARE THREE AND NOT TWELVE ANY MORE (22.09.2026,
       ADL A64). Twelve names stood on the server's own list with one reason for all of
       them - „there is no column for any of them" - and it was true of none of them by
       22.09.2026: V11 had already given a proposal its own row with the town, the
       country and the team a change is about, `competitor` carries the sender's name,
       which sort of thing a row is can be read off the schema twice over, and V30 gave
       the comments and the schedule tabs a row of their own too, so `rating`,
       `currentDate` and `proposedDate` briefly answered for real off those. PDL P10a,
       the same day, removed the schedule tab and the two columns with it; `rating` is
       the one of the three still standing. Nine of the twelve were answered that day.

       The three below still have no home, each for its own reason, and each is in
       `PENDING.md` with the table that lacks it: the address of a registration has no
       column, and the picture and its square are not a missing column at all but ADL
       A60 - a picture held only by something awaiting a decision answers exactly as a
       picture that is not there, so an address served here would draw a broken frame.

       `crop` reads as three names because the file nests it and this compares the
       names of one record; that is the same subtraction the ducats made above. */
    expect(missing(aWaitingItem, servedRow('verification'))).toEqual(['crop', 'email', 'picture'])

    /* **AND THE FOUR THAT WERE NEVER SEEN UNTIL 21.09.2026, COUNTED RATHER THAN
       LISTED.** Every name the generated file carries that the answer does not, over
       every resource there is a record of, in one place. That set is the whole of what
       `test/setup.ts` can hide: it answers a resource out of that file, so a screen
       reading a name on this list is reading the seed and not the portal.

       Written as one derived table and not as four assertions, because the question is
       about the CLASS: „is there a field the file carries and the server does not, that
       nobody has swept". Three of the four were found that way rather than remembered,
       and the fourth was missed by a hand-written list and cost a round.

       Each name on it is a decision that has been taken, and the decision is beside it:

       - `active`, because a member whose fee has lapsed is not on the list at all
         (owner, 13.09.2026), so the flag has nothing left to say;
       - `referredBy`, because the column holds the KEY of whoever brought a member (V7)
         and a key does not leave the server; what the screen wanted it for arrives
         counted, and since 25.09.2026 it arrives through `/api/me`;
       - `referralCode`, which was answered on the caller's own row until 25.09.2026 and
         is on this list from that day, because the owner took it off the public list
         altogether (PDL P26a) - the list ends `where c.active`, so the member whose fee
         has lapsed, whom V24 section 6 promises it to, was answered nothing;
       - `membershipBasis`, which a member is not given even on his own row - the
         condition is the CALLER and never the row - and which reaches him through
         `/api/me` instead (owner, 20.09.2026, „Clan vidi SVOJ osnov clanstva");
       - `since`, the day a pair was made, answered to nobody (owner, 13.09.2026). */
    const answers: [ResourceName, Record<string, unknown>][] = [
      ['competitors', myOwnRow],
      ['teams', aTeam],
      ['pairs', aPair],
      ['leagues', aLeague],
    ]

    const held = answers.flatMap(([name, answer]) =>
      missing(answer, servedRow(name)).map((field) => `${name}.${field}`),
    )

    expect(held).toEqual([
      'competitors.active',
      'competitors.membershipBasis',
      'competitors.referralCode',
      'competitors.referredBy',
      'pairs.since',
    ])

    /* **AND THE HARNESS TAKES AWAY EXACTLY THOSE, which is the floor the list it used
       to keep never had.** `membersAsServed` builds its answer out of the KEYS of the
       records above (`test/theAnswer.ts`), so this is not two lists agreeing: it is the
       same record read twice. A name that leaves the answer leaves the harness on the
       same day, and this says out loud that it did. */
    const asTheServerWould = asAnswered(servedRow('competitors'), myOwnRow)

    expect(
      Object.keys(servedRow('competitors')).filter((one) => !(one in asTheServerWould)).sort(),
    ).toEqual(['active', 'membershipBasis', 'referralCode', 'referredBy'])

    /* **AND THE SAME QUESTION ASKED OF THE OTHER TWO READERS, which is what makes the
       list above a statement about the CALLER rather than about the field.**

       UNTIL 25.09.2026 THE THREE ANSWERS DIFFERED AND THAT WAS THE POINT: a visitor was
       given neither the basis nor the code, the administration the basis on every row
       and the code on none but its own, and the caller his own code on his own row. Only
       `active` and `referredBy` were missing whoever asked.

       SINCE P26a THE CODE IS MISSING WHOEVER ASKS TOO, so the caller's own row and a
       visitor's row hold the same names and the only one left that turns on who is
       asking is the basis. The three comparisons stay side by side rather than
       collapsing into one: what they say now is that the three answers agree, and a
       resource that starts telling any of them apart again fails here. */
    expect(missing(aCompetitor, servedRow('competitors'))).toEqual([
      'active',
      'membershipBasis',
      'referralCode',
      'referredBy',
    ])

    expect(missing(aCompetitorToTheAdministration, servedRow('competitors'))).toEqual([
      'active',
      'referralCode',
      'referredBy',
    ])

    /* The team with no mark, whose two nothings are the state the file has no row of:
       every generated team carries a square, so the answer's own `null` is only ever
       read here. */
    expect(missing(aTeamWithNoMark, servedRow('teams'))).toEqual([])
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
      /* THE FIFTEENTH, AND THE ONE THIS LIST USED TO EXCUSE (22.09.2026). What stood
         below said `verification` „answers 401 and its whole shape is a decision the
         owner has not taken: the answer is grouped by tab and carries nine fields fewer
         than the screen draws", and left it out on that ground. Both halves were true,
         and leaving it out is what let the two ends drift until „Administracija →
         Verifikacija → Timovi" threw in front of the owner: the portal read a
         `{queue, waiting}` wrapper as an item. The answer is a flat list of items now,
         so there is a shape to write down, and it is written down. */
      'verification',
      /* THE SIXTEENTH NAME AND THE FIFTEENTH RESOURCE, added 26.09.2026 with the screens
         that read it. It arrives measured on the day it arrives, which is the whole of what
         this list is for: `/api/pricing` had been answered and unread for weeks, so there
         was never a moment when the two ends could have been held against each other. */
      'pricing',
    ]

    /* AND NOTHING IS EXCUSED ANY MORE. */
    const notSeen: ResourceName[] = []

    /* THE EMPTINESS IS ASSERTED AND NOT MERELY WRITTEN, and that is a finding rather
       than a flourish. The line below on its own says every resource is on one list or
       the other, which is satisfied just as well by moving a name from the first to the
       second: measured before this line existed, taking `verification` out of `measured`
       and putting it back in `notSeen` left this case GREEN. That is precisely the road
       the portal went down once already - the resource was excused here for a day and
       the screen it feeds threw in front of the owner - so the road is shut.

       A sixteenth resource that genuinely cannot be measured makes this red, on purpose:
       the way past it is a written decision, not a name quietly added to a list. */
    expect(notSeen).toEqual([])

    expect([...measured, ...notSeen].sort()).toEqual([...RESOURCE_NAMES].sort())
  })
})

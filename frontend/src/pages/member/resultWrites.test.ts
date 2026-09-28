import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { arrivedResource, clearResourceCache, loadResource } from '../../data/client'
import { did, refused, serverThat } from '../../test/serverAnswers'
import { first } from '../../test/at'
import sr from '../../i18n/sr.json'
import {
  A_RUN_IS_SENT_TO,
  theCorrectionWasSentIn,
  theResultAt,
  theResultWasTakenBack,
  theRunWasSentIn,
  WHEN_A_RESULT_IS_WRITTEN,
  type ACorrection,
  type ARunDescribed,
  type ARunFromTheCalendar,
} from './resultWrites'

/**
 * WHAT GOES ON THE WIRE WHEN A MEMBER WRITES ABOUT HIS OWN RESULT.
 *
 * <p>The arithmetic and the addresses are measured here and the screens are measured in
 * `newResult.test.tsx`, `reportResult.test.tsx` and `ownResult.test.tsx`, which is the split
 * `member/photoWrites.test.ts` and its screen already keep: a question about a body does not
 * need React mounted.
 */

const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')

function java(file: string): string {
  return readFileSync(join(WEB, file), 'utf-8')
}

/**
 * EVERY `static final String` A CLASS DECLARES, WITH ITS VALUE.
 *
 * <p>`pages/account/refusals.test.ts`'s own reader, and the whitespace is `\s*` for its
 * measured reason: read as a literal space, a declaration long enough to push its value onto
 * the next line is invisible, and `LeagueWriteApi` has one.
 */
function declaredIn(source: string): Map<string, string> {
  return new Map(
    [...source.matchAll(/static final String (\w+)\s*=\s*"([^"]+)";/g)].map((one) => [
      one[1] ?? '',
      one[2] ?? '',
    ]),
  )
}

/**
 * THE TWO CONSTANTS `ResultWriteApi` DECLARES THAT ARE NOT REFUSALS AT ALL.
 *
 * <p>`RESULTS = "results"` is the NAME OF A QUEUE, the value the route writes into
 * `verification.queue` and the tab a waiting run stands in (V5, V10). `THE_PORTAL =
 * "Rezultati"` is who the member hears from in his inbox, which is the league and never a
 * person. Neither is ever a reason a write was turned away, and the case below that counts
 * every constant is what stops this list growing in silence.
 */
const NOT_A_REASON = ['results', 'Rezultati']

/**
 * EVERY REASON `ResultWriteApi` CAN PUT IN A `Refused` BODY, ASKED OF THE JAVA SOURCE IN
 * THE THREE PLACES IT REALLY KEEPS THEM.
 *
 * <p><b>Three readers and not one, because the class holds them three ways and a guard that
 * knew only the first would pass while nine of the twelve reached a member as a bare
 * word.</b> `pages/account/refusals.test.ts` reads the first kind for eighteen routes; the
 * other two kinds are why this route keeps its floor here rather than joining that list -
 * the same division `member/myAccount.ts` writes down for itself, and for the same second
 * reason, that the shared file is being edited by other increments this week.
 *
 * <ol>
 * <li><b>Declared here.</b> `THE_FORM_IS_NOT_COMPLETE` and its three neighbours.
 * <li><b>Borrowed from `EventWriteApi` for the town</b>, so that one rule answers in one
 * voice all over the portal (owner, 11.08.2026). The NAME is read off this class and the
 * VALUE off the class that declares it, so a rename on either side fails here.
 * <li><b>Given to the outcomes of `ProofThatTheRunHappened` by `WHY_NOT`.</b> These are
 * literals in a map rather than constants, so no reader of declarations can see them -
 * which is exactly how a reason becomes invisible to a guard that looks in one place.
 * </ol>
 */
/** The four this class declares for itself, less the two that are not refusals at all. */
function declaredHere(mine = java('ResultWriteApi.java')): string[] {
  return [...declaredIn(mine).values()].filter((one) => !NOT_A_REASON.includes(one))
}

/** The town's five, whose NAME is read off this class and whose VALUE off the class that
 *  declares it, so a rename on either side fails here. */
function borrowedForTheTown(mine = java('ResultWriteApi.java')): string[] {
  const theirs = declaredIn(java('EventWriteApi.java'))

  return [...new Set([...mine.matchAll(/EventWriteApi\.([A-Z_][A-Z_0-9]*)/g)])].map(
    (one) => theirs.get(one[1] ?? '') ?? `<${one[1] ?? ''} is not declared by EventWriteApi>`,
  )
}

/** The three `WHY_NOT` gives the outcomes of `ProofThatTheRunHappened`. Literals in a map
 *  rather than constants, so no reader of declarations can see them. */
function forTheProof(mine = java('ResultWriteApi.java')): string[] {
  return [...mine.matchAll(/words\.put\(Outcome\.[A-Z_]+,\s*"([^"]+)"\)/g)].map(
    (one) => one[1] ?? '',
  )
}

/**
 * @param mine the text of `ResultWriteApi.java`. A PARAMETER and not a read, so the case
 *             below can hand it a source this reader has never seen - which is the only way
 *             to show that these readers really read Java rather than reciting the screen's
 *             own map back. Measured 28.09.2026: with the union rewritten to answer
 *             `Object.keys(WHEN_A_RESULT_IS_WRITTEN)` every other case here still passed,
 *             because a correct map and a correct reading of the source are the same twelve
 *             strings, so nothing that compares the two can tell them apart.
 */
function everyReasonTheRouteCanName(mine = java('ResultWriteApi.java')): string[] {
  return [
    ...new Set([...declaredHere(mine), ...borrowedForTheTown(mine), ...forTheProof(mine)]),
  ]
}

describe('every reason the result routes can name', () => {
  /**
   * THE THREE READERS ARE MEASURING SOMETHING, and this case is what makes the two below
   * mean anything.
   *
   * <p>A regular expression that stopped matching answers „nothing is missing" to both
   * directions at once, which is the shape that reads as though it works. So each of the
   * three is asked for a count, and the counts are written out: four declared, five borrowed
   * for the town, three for the proof. A thirteenth reason added to that class fails here
   * with the number in the message, and somebody decides once what its sentence is.
   */
  it('is found by all three readers, and none of them has gone quiet', () => {
    const ours = declaredIn(java('ResultWriteApi.java'))

    expect([...ours.values()], 'ResultWriteApi declares no constant at all').toHaveLength(6)
    expect(
      [...ours.values()].filter((one) => !NOT_A_REASON.includes(one)),
      'the declared refusals of ResultWriteApi',
    ).toHaveLength(4)
    expect(declaredHere(), 'the declared refusals').toHaveLength(4)
    expect(borrowedForTheTown(), 'the town reasons borrowed from EventWriteApi').toHaveLength(5)
    expect(forTheProof(), 'the reasons the proof rule names').toHaveLength(3)
    expect(everyReasonTheRouteCanName(), 'every reason across the three readers').toHaveLength(12)
  })

  /**
   * AND THE UNION IS REALLY THE THREE READERS, which is the one thing the two cases below
   * cannot ask on their own.
   *
   * <p>Measured 28.09.2026 by a mutation: with the union rewritten to answer
   * `Object.keys(WHEN_A_RESULT_IS_WRITTEN)`, both directions become „the map equals the map"
   * and pass, and so does every count above, because the map really does hold twelve. A
   * guard that reads as though it works, exactly the shape `CLAUDE.md` names. So the union
   * is compared against the three readers here, where the map has no part in it.
   */
  it.each([
    [
      'a constant it declares itself',
      'static final String A_BRAND_NEW_ONE = "aBrandNewOne";',
      'aBrandNewOne',
    ],
    [
      'a word given to an outcome of the proof rule',
      'words.put(Outcome.SOMETHING_ELSE, "andThisOneToo");',
      'andThisOneToo',
    ],
  ])('sees %s the day it is written, and says it has no sentence', (_what, line, reason) => {
    /* THE SOURCE IS DOCTORED RATHER THAN THE BACKEND TOUCHED. Handing the readers a copy of
       the real file with one line spliced in is the only way to show they read Java at all:
       against the file as it stands, a union that recited `WHEN_A_RESULT_IS_WRITTEN` back
       gives the very same twelve strings, so every comparison between the two passes.

       What this asks is the question the whole file exists for - „a reason added on the
       server is a red gate on the day it is written" - and it asks it without waiting for
       somebody to add one. */
    const doctored = java('ResultWriteApi.java').replace(
      'private final JdbcClient db;',
      `	${line}

	private final JdbcClient db;`,
    )

    expect(doctored, 'the splice found nowhere to go').not.toBe(java('ResultWriteApi.java'))
    expect(everyReasonTheRouteCanName(doctored)).toContain(reason)
    /* And the gate over it really would go red, which is the half that matters: the reason
       is one no sentence answers. */
    expect(Object.hasOwn(WHEN_A_RESULT_IS_WRITTEN, reason)).toBe(false)
    expect(
      everyReasonTheRouteCanName(doctored).filter(
        (one) => !Object.hasOwn(WHEN_A_RESULT_IS_WRITTEN, one),
      ),
    ).toEqual([reason])
  })

  /**
   * AND EVERY NAME ON THE EXEMPT LIST IS PULLING ITS WEIGHT, which is what makes
   * {@link NOT_A_REASON} a list with a bottom rather than a list.
   *
   * <p>`refusals.test.ts` found this class of mutation on itself: adding a REAL reason to
   * such a list satisfies „the class declares it", moves no count, and quietly takes that
   * reason out of the gate. So the question asked is what the exemption is FOR - a name here
   * that the class really declares, and that no sentence answers.
   */
  it('excuses only a constant that is not a reason', () => {
    const declared = [...declaredIn(java('ResultWriteApi.java')).values()]

    for (const exempt of NOT_A_REASON) {
      expect(declared, `${exempt} is excused but ResultWriteApi does not declare it`).toContain(
        exempt,
      )
      expect(
        Object.hasOwn(WHEN_A_RESULT_IS_WRITTEN, exempt),
        `${exempt} is excused as "not a reason" and yet a sentence answers it`,
      ).toBe(false)
    }
  })

  it('has a sentence on the screen that meets it', () => {
    expect(
      everyReasonTheRouteCanName().filter(
        (reason) => !Object.hasOwn(WHEN_A_RESULT_IS_WRITTEN, reason),
      ),
    ).toEqual([])
  })

  /* The other direction, and it is not decoration: a key left behind by a reason the server
     dropped is a sentence in the dictionary that nothing can ever draw, and the next reader
     has no way to tell it from one that is live. */
  it('and the screens claim no reason the routes cannot answer', () => {
    const known = new Set(everyReasonTheRouteCanName())

    expect(Object.keys(WHEN_A_RESULT_IS_WRITTEN).filter((one) => !known.has(one))).toEqual([])
  })

  /* And each of those sentences really exists, which the dictionary's own gate cannot ask
     about a key built out of a variable. */
  it('points at a sentence the dictionary really has', () => {
    for (const key of Object.values(WHEN_A_RESULT_IS_WRITTEN)) {
      const said = key.split('.').reduce<unknown>((at, step) => {
        return typeof at === 'object' && at !== null && Object.hasOwn(at, step)
          ? Reflect.get(at, step)
          : undefined
      }, sr)

      expect(typeof said, `${key} is not a sentence in sr.json`).toBe('string')
      expect(said, `${key} is empty`).not.toBe('')
    }
  })
})

describe('where each of the three writes goes', () => {
  const FIGURES = { distanceKm: 21.1, ascentM: 120, descentM: 120, seconds: 5400 }
  const PROOF = { link: 'https://rezultati.example/1', comment: '' }

  const FROM_THE_CALENDAR: ARunFromTheCalendar = { raceId: 7, ...FIGURES, ...PROOF }

  const DESCRIBED: ARunDescribed = {
    raceName: 'Trka kroz šumu',
    day: '2027-04-18',
    raceKind: 'length',
    city: 'Valjevo',
    country: 'RS',
    ...FIGURES,
    ...PROOF,
  }

  const CORRECTION: ACorrection = { ...FIGURES, seconds: 5100, ...PROOF }

  it('sends a run from the calendar to the one address, as a POST, carrying only the race', async () => {
    const { asked, stop } = serverThat(() => did())

    try {
      await theRunWasSentIn(FROM_THE_CALENDAR)

      const sent = asked.filter((one) => one.path === A_RUN_IS_SENT_TO)

      expect(first(sent).init?.method).toBe('POST')
      expect(JSON.parse(String(first(sent).init?.body))).toEqual(FROM_THE_CALENDAR)
      /* AND NOT ONE WORD ABOUT THE RACE BESIDE ITS NUMBER, which is the whole of
         `theRaceIsNamedTwice`: `ResultWriteApi.fromTheCalendar` refuses the body outright
         when any of these five arrives with a `raceId`. Measured 28.09.2026 on `origin/main`:
         the screen's own record carried three of them on every road, so a body built that
         way would have been refused on EVERY race picked out of the calendar. */
      for (const beside of ['raceName', 'raceKind', 'placeId', 'city', 'country']) {
        expect(
          Object.hasOwn(JSON.parse(String(first(sent).init?.body)) as object, beside),
          `${beside} travelled beside a raceId, which the route refuses`,
        ).toBe(false)
      }
    } finally {
      stop()
    }
  })

  it('sends a described run to the same address, naming the town but never a placeId', async () => {
    const { asked, stop } = serverThat(() => did())

    try {
      await theRunWasSentIn(DESCRIBED)

      const body = JSON.parse(
        String(first(asked.filter((one) => one.path === A_RUN_IS_SENT_TO)).init?.body),
      ) as object

      expect(body).toEqual(DESCRIBED)
      /* `PlaceField` writes a town's NAME and its country CODE, never the GeoNames mark that
         `placeId` means, so a mark has no source anywhere in the values - `Registration.tsx`'s
         own decision, and its reason: the route takes exactly one of the two shapes and
         refuses both together. */
      expect(Object.hasOwn(body, 'placeId')).toBe(false)
      /* And the day is called `day`. `ResultWriteApi.Ran` names it that, and a key by any
         other name arrives as null and is answered `theFormIsNotComplete` about a date the
         member filled in. */
      expect(Object.hasOwn(body, 'day')).toBe(true)
      expect(Object.hasOwn(body, 'date')).toBe(false)
    } finally {
      stop()
    }
  })

  it('sends a correction to the result it is about, as a PUT, with no race on it', async () => {
    const { asked, stop } = serverThat(() => did())

    try {
      await theCorrectionWasSentIn(41, CORRECTION)

      /* The address names the RESULT and not the submission, which is the one thing these two
         routes could be pointed at wrongly: `ResultWriteApi.his` reads `result` by `r.id`. */
      const sent = asked.filter((one) => one.path === theResultAt(41))

      expect(first(sent).path).toBe('/api/results/41')
      expect(first(sent).init?.method).toBe('PUT')
      expect(JSON.parse(String(first(sent).init?.body))).toEqual(CORRECTION)
      /* „Menja se sve osim trke" (owner, 27.08.2026). The record on the server declares no
         field for one, so a race sent here would be a key nothing reads. */
      for (const beside of ['raceId', 'raceName', 'day', 'raceKind']) {
        expect(Object.hasOwn(JSON.parse(String(first(sent).init?.body)) as object, beside)).toBe(
          false,
        )
      }
    } finally {
      stop()
    }
  })

  it('takes a result back with a DELETE on that same address', async () => {
    const { asked, stop } = serverThat(() => did())

    try {
      await theResultWasTakenBack(41)

      const sent = asked.filter((one) => one.path === theResultAt(41))

      expect(first(sent).init?.method).toBe('DELETE')
    } finally {
      stop()
    }
  })

  /* The address is built from the number rather than written out, so this is the one place
     that says what it looks like. A result and a submission are different rows in different
     tables, and only the first has an address at all. */
  it('builds the address out of the result it names', () => {
    expect(theResultAt(41)).toBe('/api/results/41')
    expect(theResultAt(1)).toBe('/api/results/1')
  })
})

/**
 * WHAT IS DROPPED AFTER EACH OF THE THREE, AND IT IS DIFFERENT FOR EACH.
 *
 * <p><b>The axis here is `results`, and it points the opposite way from the one a reader
 * expects.</b> Sending a run and correcting one do NOT touch the `result` table - PDL,
 * „Rezultat ulazi u rang liste tek posle odobrenja", and owner 28.08.2026, „Stari rezultat
 * ostaje u poretku dok ispravka čeka". Only taking one back moves it. So the case is written
 * as „dropped" against „kept" for the same name across the three acts, and a version that
 * cleared everything everywhere fails two of the three.
 */
describe('what each act leaves stale', () => {
  async function holding(): Promise<void> {
    clearResourceCache()

    const { stop } = serverThat(() => new Response('[]', { status: 200 }))

    try {
      await Promise.all([
        loadResource('results'),
        loadResource('verification'),
        loadResource('inbox'),
      ])
    } finally {
      stop()
    }
  }

  function stillHeld(): string[] {
    return (['results', 'verification', 'inbox'] as const).filter(
      (one) => arrivedResource(one) !== undefined,
    )
  }

  beforeEach(async () => {
    await holding()
  })

  it('is measuring something: all three are held before any of this', () => {
    expect(stillHeld()).toEqual(['results', 'verification', 'inbox'])
  })

  it.each([
    [
      'a run is sent in',
      async () =>
        theRunWasSentIn({
          raceId: 7,
          distanceKm: 21.1,
          ascentM: 0,
          descentM: 0,
          seconds: 5400,
          link: 'https://x.example/1',
          comment: '',
        }),
      ['results'],
    ],
    [
      'a correction is sent in',
      async () =>
        theCorrectionWasSentIn(41, {
          distanceKm: 21.1,
          ascentM: 0,
          descentM: 0,
          seconds: 5100,
          link: 'https://x.example/1',
          comment: '',
        }),
      ['results'],
    ],
    ['a result is taken back', async () => theResultWasTakenBack(41), []],
  ])('keeps %s', async (_what, act, kept) => {
    const { stop } = serverThat(() => did())

    try {
      await act()
    } finally {
      stop()
    }

    expect(stillHeld()).toEqual(kept)
  })

  /**
   * AND A REFUSAL DROPS NOTHING AT ALL, which is the axis this file cannot get wrong.
   *
   * <p>`member/teamWrites.ts`'s own rule in its own words: a portal that dropped the caches
   * on the ASKING rather than on the ANSWERING would draw a member a queue item the server
   * never took, and here it would take a counted result off his profile over a write that was
   * turned away.
   *
   * <p>Measured for the deletion because it is the one with something to lose: it is the only
   * act that drops `results`.
   */
  it.each([
    [
      'a run was refused',
      async () =>
        theRunWasSentIn({
          raceId: 7,
          distanceKm: 21.1,
          ascentM: 0,
          descentM: 0,
          seconds: 5400,
          link: 'https://x.example/1',
          comment: '',
        }),
    ],
    [
      'a correction was refused',
      async () =>
        theCorrectionWasSentIn(41, {
          distanceKm: 21.1,
          ascentM: 0,
          descentM: 0,
          seconds: 5100,
          link: 'https://x.example/1',
          comment: '',
        }),
    ],
    ['a deletion was refused', async () => theResultWasTakenBack(41)],
  ])('drops nothing where %s', async (_what, act) => {
    const { stop } = serverThat(() => refused('theFormIsNotComplete'))

    try {
      expect(await act()).toEqual({ got: 'refused', reason: 'theFormIsNotComplete' })
    } finally {
      stop()
    }

    /* ALL THREE AND NOT THE DELETION ALONE. Measured 28.09.2026: with only the deletion
       here, dropping the caches on the ASKING in `theRunWasSentIn` survived every case in
       the suite - the two acts that leave `results` alone have nothing else that would
       notice, and the inbox and the queue are re-read cheaply enough that no screen
       complains. */
    expect(stillHeld()).toEqual(['results', 'verification', 'inbox'])
  })
})

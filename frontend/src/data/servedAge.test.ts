import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGE_BANDS } from './categories'
import { RESOURCE_NAMES } from './client'
import { FIRST_SEASON } from './season'
import served from '../test/servedFields.snapshot.json'

/**
 * Nothing the portal serves carries a year of birth or an age, in any file, under
 * any name.
 *
 * **Why this exists, and why it is a guard rather than a note.** Everything under
 * `public/mock` is a static file handed to anybody who asks for its address, signed
 * in or not (ADL A8). Until 13.09.2026 `competitors.json` carried `birthYear` for all
 * thirty two members, one of them a minor. Član 74 and the published privacy policy
 * both say the date of birth „se nikada ne prikazuje, ni u punom ni u skraćenom
 * obliku. Javna je samo kategorija koja iz njega proizlazi", and a year is the short
 * form. The field is gone and the age band is served in its place.
 *
 * The file it was in is **generated outside this repository**
 * (`btl-produkt/istorijski-podaci/napravi-mock.py`), so the next run of that tool can
 * put the field back with nobody typing it. That is the case this is written for.
 *
 * **Two questions, and each is complete in its own direction.**
 *
 * 1. **WHICH FIELDS ARE SERVED** is held as a snapshot of the whole set
 *    (`test/servedFields.snapshot.json`). It judges nothing, so it cannot be wrong
 *    about a name nobody has written yet: `born`, `age`, `godiste`, `yob` or a field
 *    called `y` all fail simply by not being in it. This is the shape the portal
 *    already uses wherever a filter would have to enumerate (`leagueScreens`,
 *    `dictionary`), and it converges in one round instead of growing by one word per
 *    review.
 * 2. **WHAT THOSE FIELDS HOLD** is asked of the value, and in two different ways
 *    depending on what the question really is. Where it is „does this look like a year
 *    of birth", the value is filtered to year-shaped ones first. Where it is „is this
 *    field still what it claims to be", as with the three seasons, **nothing is
 *    filtered at all**, because the answer must not depend on the wrong answer looking
 *    like the right one.
 *
 * **What the second half of that cost when it was got wrong** (review, 13.09.2026, and
 * this is why it is spelt out). The season check used to run over values already
 * filtered to `1900..2027`, so it could never see anything below 1900: `"teamSince": 58`
 * on a member passed the whole suite, and the profile then drew „U klubu Dunavski
 * trkači od 58." — a bare age, on a publicly served record. The guard this file
 * replaced caught exactly that, and replacing it took the live half away. A prefilter
 * belongs only where the question itself is about the shape of the value.
 */

/** The served folder itself, which is the source of truth for every case here. */
const MOCK = join(process.cwd(), 'public', 'mock')

/**
 * The codebook of the world's towns, which is not read here.
 *
 * Forty seven thousand rows nobody in this project wrote, holding no person and no
 * field of a person: it is an array of arrays, so it has no field names at all, and
 * its numbers are identifiers. `data/contract.test.ts` drops it from its own sweep for
 * the same reason and says so the same way. Named rather than filtered by size, and
 * the case below holds that it really is the only thing dropped.
 */
const NOT_READ = 'places.json'

/**
 * Every served file, at any depth, named by its path below `public/mock`.
 *
 * **Depth matters and was measured** (review, 13.09.2026). This read one level while
 * its own heading said „in any file", and `public/mock` already has a folder in it:
 * `logo/`, which `teams.json` points into. Vite copies the whole of `public/` across
 * verbatim, so a file one level down is served exactly as publicly as one at the top.
 * A `logo/roster.json` carrying a year of birth and an age passed the whole suite.
 */
function servedFiles(dir = MOCK, prefix = ''): { name: string; body: unknown }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)
    const name = prefix === '' ? entry.name : `${prefix}/${entry.name}`

    if (entry.isDirectory()) {
      return servedFiles(at, name)
    }

    if (!entry.name.endsWith('.json')) {
      return []
    }

    const body: unknown = JSON.parse(readFileSync(at, 'utf-8'))

    return [{ name, body }]
  })
}

/**
 * Every field inside one served file, named by the PATH it sits at.
 *
 * **The path and not the bare name, and that too was measured** (review, 13.09.2026).
 * Collected as bare names and flattened into one set per file, a name that exists
 * nested covers the same name at the top of a record: `crop` carries `x`, `y` and
 * `size`, so all three were already in the snapshot, and `"y": 58` written at the top
 * of a record in `verification.json` changed nothing and passed. `crop.y` and `y` are
 * different fields and are now written down as such.
 *
 * Arrays are transparent: every element of a list is the same shape, so `sections.body`
 * is one field and not one per section.
 */
function fieldsIn(body: unknown, at = ''): string[] {
  if (Array.isArray(body)) {
    return body.flatMap((one) => fieldsIn(one, at))
  }

  if (typeof body === 'object' && body !== null) {
    return Object.entries(body).flatMap(([key, value]) => {
      const path = at === '' ? key : `${at}.${key}`

      return [path, ...fieldsIn(value, path)]
    })
  }

  return []
}

/** Every value inside one served file, with the path of the field it sits under. */
function valuesIn(body: unknown, at = ''): { under: string; value: unknown }[] {
  if (Array.isArray(body)) {
    return body.flatMap((one) => valuesIn(one, at))
  }

  if (typeof body === 'object' && body !== null) {
    return Object.entries(body).flatMap(([key, value]) =>
      valuesIn(value, at === '' ? key : `${at}.${key}`),
    )
  }

  return [{ under: at, value: body }]
}

const everything = servedFiles()
const read = everything.filter((one) => one.name !== NOT_READ)
/* Each value with the file it came out of, because since 20.09.2026 one of the
   rules below has to be told file by file: an identity is a number a sequence
   handed out, and a sequence counts into the band a year sits in. */
const everyValue = read.flatMap((one) =>
  valuesIn(one.body).map((each) => ({ ...each, file: one.name, path: `${one.name}:${each.under}` })),
)

describe('the sweep itself', () => {
  /* **The floor, and the reason this describe is first.** A guard over a folder answers
     „nothing is wrong" and „nothing was looked at" with the same green, and the second
     is what happens when a path is wrong, a filter is narrowed, or the folder is empty.
     Run against an empty `public/mock`, every case below passes over an empty list;
     these fail. */
  it('reads every file the portal serves, and there are as many as the contract names', () => {
    expect(everything.length).toBeGreaterThanOrEqual(RESOURCE_NAMES.length)
    expect(everything.map((one) => one.name)).toContain('competitors.json')
  })

  it('reads the values inside them, not merely the files', () => {
    /* The file list can be right while the walk returns nothing, which is what a
       flattener that stops at the first array does. There are tens of thousands of
       values under this folder; a floor in the thousands cannot be met by one record. */
    expect(everyValue.length).toBeGreaterThan(5000)
    expect(everyValue.filter((one) => one.under === 'memberNumber').length).toBeGreaterThan(30)
  })

  it('goes down into folders, so a file one level below is read like any other', () => {
    /* Proved by running the sweep one folder higher, where `mock/` is itself a
       subfolder holding every file above. If it descends there it descends anywhere,
       and this needs no fixture written into the repository to say so.

       Worth doing because `public/mock` already has a folder in it today — `logo/`,
       which `teams.json` points into — and Vite copies the whole of `public/` across
       verbatim, so a file one level down is served exactly as publicly as one at the
       top. While this read a single level, `logo/roster.json` carrying a year of birth
       and an age passed the whole suite (review, 13.09.2026). */
    expect(readdirSync(MOCK, { withFileTypes: true }).some((one) => one.isDirectory())).toBe(true)

    const deeper = servedFiles(join(process.cwd(), 'public')).map((one) => one.name)

    expect(deeper).toContain('mock/competitors.json')
    expect(deeper.length).toBeGreaterThanOrEqual(everything.length)
  })

  it('drops the codebook of towns and nothing else', () => {
    /* So that the one exclusion stays a decision rather than a hole that quietly grows
       to cover whatever fails next. Both halves: it really is dropped, and everything
       else really is read. */
    expect(read.map((one) => one.name)).not.toContain(NOT_READ)
    expect(everything.length - read.length).toBe(1)
  })
})

describe('which fields the portal serves', () => {
  it('is the set that was written down, path by path', () => {
    /* **The whole set held as it stands**, which is what makes this complete: a field
       added anywhere under `public/mock`, whatever it is called and whatever it holds,
       is a field this does not recognise. `born`, `age`, `godiste`, `yearOfBirth`, `dob`
       and a field called `y` all fail here for the same reason, and so does a field that
       has nothing to do with a birthday.

       **What it costs, said plainly:** serving a new field is a change in two files. That
       is the same cost the dictionary and the drawn screens already pay, and it is the
       point. The snapshot is written by hand from the files it describes; there is no
       command that regenerates it, because a snapshot something else can rewrite is a
       snapshot nobody reads. Rewriting it wholesale to make this pass is not a way round
       the guard, it is the deliberate act the guard exists to put in front of a reader. */
    const now = Object.fromEntries(
      read.map((one) => [one.name, [...new Set(fieldsIn(one.body))].sort()]),
    )

    expect(now).toEqual(served)
  })

  it('is a snapshot of something, so the case above is comparing two full sets', () => {
    /* Without this the comparison passes when both sides are empty, which is what a
       broken read gives. Thirteen files and a hundred and fifty three paths on
       13.09.2026, of which twenty three are nested. Fourteen since 26.09.2026, when the
       price list became a resource the portal reads: seven more paths, none of them
       nested, and not one of them about a person - a price row belongs to nobody, which
       is why `PricingApi` is public and says so at length. */
    expect(Object.keys(served)).toHaveLength(14)
    expect(Object.values(served).flat().length).toBeGreaterThan(100)
    expect(Object.values(served).flat().filter((one) => one.includes('.')).length).toBeGreaterThan(
      10,
    )
  })
})

describe('what the portal serves about how old somebody is', () => {
  /**
   * The three fields that name a season, and the rule they are held to.
   *
   * **Nothing is filtered before this.** Every value at these three paths is read,
   * whatever it is, because the question is „is this still a season" and not „does this
   * look like a year". A prefilter here is what let `58` through.
   */
  const SEASONS = ['firstSeason', 'season', 'teamSince']

  /** The league's earliest imported season (PDL P26). Nothing it serves is older. */
  const FIRST_LEAGUE_SEASON = 2010

  /** And the latest it can name: the season being sold is the one after the first
   *  official one, so a season past that is not one either. Read off the portal's own
   *  constant rather than written here, so the two cannot drift. */
  const LAST_LEAGUE_SEASON = FIRST_SEASON + 1

  const WHOLE_NUMBER = /^-?\d+$/

  /** A value read as a whole number whether it arrived as a number or as text.
   *
   *  **Text matters, and that was measured.** The checks below used to ask
   *  `typeof value === 'number'` while a comment beside them claimed a year moved into
   *  `firstSeason` would be caught. A review wrote `"1975"` there — the very year this
   *  change had just taken off that member — and the whole suite stayed green
   *  (13.09.2026). JSON has no opinion about which of the two a number arrives as. */
  function asWholeNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value : null
    }

    if (typeof value === 'string' && WHOLE_NUMBER.test(value.trim())) {
      return Number(value.trim())
    }

    return null
  }

  it('holds every season to a season the league has had, whatever the value looks like', () => {
    /* **Read over every value at those three paths with no filter in front of it**, which
       is the whole point: an age, a day of the month, a word or a year of birth in a
       field that claims to be a season are all the same failure, and a guard that only
       looks at values already shaped like a year sees none of them.

       Null is a season nobody has: a member with no club has no year of joining one, and
       the two travel together (`data/types.ts`).

       **The boundary, written here rather than left for somebody to find.** A season and
       a year of birth overlap between 2010 and today, so a recent year of birth written
       into one of these three reads as a season and is not caught — the youngest member
       served is inside that window. What closes it is the backend, not a wider guard: no
       query over a public file can tell one 2013 from another. Everything OUTSIDE that
       window is caught, and that includes a bare age, which is what this case was blind
       to until 13.09.2026. */
    const wrong = everyValue
      .filter((one) => SEASONS.includes(one.under) && one.value !== null)
      .flatMap((one) => {
        const season = asWholeNumber(one.value)

        return season === null || season < FIRST_LEAGUE_SEASON || season > LAST_LEAGUE_SEASON
          ? [`${one.under}: ${JSON.stringify(one.value)}`]
          : []
      })

    expect(wrong, 'a field that names a season is holding something that is not one').toEqual([])
  })

  /**
   * The fields that carry a value shaped like a year, and the only ones that may.
   *
   * Read off the files rather than remembered: these are every path under `public/mock`
   * holding a whole number between 1900 and 2027, measured on 13.09.2026 and again on
   * 20.09.2026. Seasons, a race's metres and seconds, which really do reach those
   * sizes, and one identity.
   *
   * **By file and by path since 20.09.2026, not by path alone.** A name on this list
   * used to excuse that name in every served file at once, and the entry that made
   * that intolerable is `id`: it is an identity in ten files and a quantity in none.
   */
  const MAY_HOLD_A_YEAR = [
    'competitors.json:firstSeason',
    'competitors.json:teamSince',
    'leagues.json:season',
    'pairs.json:season',
    'races.json:ascentM',
    'races.json:descentM',
    'results.json:ascentM',
    'results.json:descentM',
    /* **The one that is not a quantity at all, and the reason this list is now told
       file by file** (20.09.2026). A result is identified by a number the schema
       hands out (`/api/results`, `bigserial`), and a sequence that has handed out
       three and a half thousand rows has counted through 1900 to 2027 on its way.
       Named here and nowhere else: `id` permitted across the folder would permit a
       year of birth under that name in `competitors.json`, which is the one file
       this whole guard is about. */
    'results.json:id',
    'results.json:seconds',
  ]

  /**
   * What to do when the two cases below fail, written here because the failure message
   * is the only place the next person is standing.
   *
   * **Do not add the field to `MAY_HOLD_A_YEAR`.** It is the cheapest fix and it is
   * usually the wrong one: an entry here permits a year of birth at that exact path. `value` is the one to watch, because it is three fields in three
   * files (`comments.json`, `ducats.json`, `verification.json`) and a ducat is a round
   * number a step away from this band — `duk-sezonski-km` stands at 1000 today and 2000
   * is the next rung. `last` reaches 1000, `tierUpFrom` 500 and `step` 100.
   *
   * **What to do instead: look at the value.** If it is a year of birth or an age, it
   * must not be served at all, and that is this guard working. If it is a genuine figure
   * that has grown into this band, the honest fix is to say so in the same breath as
   * widening the list, and to say which files that widens it in. By value alone a ducat
   * of 2000 and a year of birth of 2000 cannot be told apart, and no guard here will
   * ever tell them apart; what can be told apart is a decision somebody wrote down and
   * one nobody did.
   */
  const READ_THIS_BEFORE_WIDENING_THE_LIST =
    'do NOT add this path to MAY_HOLD_A_YEAR to make this pass: that permits a year of' +
    ' birth at exactly that path. Look at the value first. See the note above' +
    ' MAY_HOLD_A_YEAR in this file.'

  const yearShaped = everyValue.flatMap((one) => {
    const year = asWholeNumber(one.value)

    return year !== null && year >= 1900 && year <= 2027 ? [{ ...one, year }] : []
  })

  it('holds the list of fields that may carry a year to the files themselves', () => {
    /* Both directions. A field on the list that is not in the files excuses something
       that is not there; a field in the files and not on the list is what the case after
       this is about, and it would find it, but this says which of the two went wrong. */
    const carrying = [...new Set(yearShaped.map((one) => one.path))].sort()

    expect(carrying, READ_THIS_BEFORE_WIDENING_THE_LIST).toEqual([...MAY_HOLD_A_YEAR].sort())
  })

  it('carries no year-shaped value in any other field, in any file', () => {
    /* The value and not the name, so a year of birth restored as `born`, as `age`, as
       `y` or with no new field at all lands here. Read as text or as a number alike. */
    const loose = yearShaped
      .filter((one) => !MAY_HOLD_A_YEAR.includes(one.path))
      .map((one) => `${one.path}: ${String(one.year)}`)

    expect(loose, READ_THIS_BEFORE_WIDENING_THE_LIST).toEqual([])
  })

  it('serves every member an age band, and only a band the rulebook has', () => {
    /* A member with no band at all, or with one invented, fails here. Held to
       `AGE_BANDS` rather than to four strings written out again, so the two cannot
       drift: the rulebook fixes the bands and `categories.ts` is where the portal keeps
       them (PDL P7). */
    const members: { memberNumber: string; ageBand?: unknown }[] = JSON.parse(
      readFileSync(join(MOCK, 'competitors.json'), 'utf-8'),
    )

    expect(members.length).toBeGreaterThan(30)

    const wrong = members
      .filter((one) => typeof one.ageBand !== 'string' || !AGE_BANDS.some((b) => b === one.ageBand))
      .map((one) => `${one.memberNumber}: ${String(one.ageBand)}`)

    expect(wrong).toEqual([])
  })
})

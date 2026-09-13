import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGE_BANDS } from './categories'
import { RESOURCE_NAMES } from './client'
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
 * put the field back with nobody typing it. That is the case this is written for: the
 * removal is a one line diff and its absence has to be held by something that runs.
 *
 * **Two questions, and each is complete in its own direction.** What this asked in its
 * first draft was neither, and a review measured three ways past it on 13.09.2026:
 *
 * - A pattern over field NAMES. It knew a list of words, so `born` and `age` walked
 *   straight past it, and a list of words in a guard is the thing that needs a floor
 *   and never has one.
 * - A list of the fields a member may carry, read over `competitors.json` ALONE. The
 *   heading above it said „in any field, under any name" while it opened one file of
 *   thirteen, so `"born": 1968` and `"age": 58` written into `verification.json` —
 *   which is served just as publicly and already carries a name, an e-mail and a town
 *   — were invisible.
 *
 * So the name is not asked about at all any more. Instead:
 *
 * 1. **WHICH FIELDS ARE SERVED** is held as a snapshot of the whole set
 *    (`test/servedFields.snapshot.json`). It judges nothing, so it cannot be wrong
 *    about a name nobody has written yet: `born`, `age`, `godiste`, `yob` or a field
 *    called `y` all fail simply by not being in it. This is the shape the portal
 *    already uses wherever a filter would have to enumerate (`leagueScreens`,
 *    `dictionary`), and it converges in one round instead of growing by one word per
 *    review.
 * 2. **WHAT THOSE FIELDS HOLD** is asked of the value and not of the name: every
 *    year-shaped value anywhere has to sit under one of six fields that are known to
 *    carry one, and the three that are seasons have to hold a season the league has
 *    actually had.
 *
 * **Where this stops, written down rather than left to be found.** An age is a bare
 * small integer and is indistinguishable from a count, a rating or a step, so nothing
 * here can recognise one by its value; what catches an age is the snapshot, because
 * an age has to arrive in a field, and a new field is what the snapshot refuses. A
 * year of birth moved INTO `ascentM`, `descentM` or `seconds` is likewise not caught
 * by its value, because those really do carry numbers of that size; it is caught only
 * if it arrives as a new field. And `places.json` is outside the sweep for the reason
 * given where it is dropped.
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

/** Every served file, parsed, with the name it is served under. */
function servedFiles(): { name: string; body: unknown }[] {
  return readdirSync(MOCK, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      const body: unknown = JSON.parse(readFileSync(join(MOCK, entry.name), 'utf-8'))

      return { name: entry.name, body }
    })
}

/** Every field name anywhere inside one served file, however deeply nested. */
function fieldsIn(body: unknown): string[] {
  if (Array.isArray(body)) {
    return body.flatMap((one) => fieldsIn(one))
  }

  if (typeof body === 'object' && body !== null) {
    return Object.entries(body).flatMap(([key, value]) => [key, ...fieldsIn(value)])
  }

  return []
}

/** Every value anywhere inside one served file, with the field it sits under. */
function valuesIn(body: unknown, under: string): { under: string; value: unknown }[] {
  if (Array.isArray(body)) {
    return body.flatMap((one) => valuesIn(one, under))
  }

  if (typeof body === 'object' && body !== null) {
    return Object.entries(body).flatMap(([key, value]) => valuesIn(value, key))
  }

  return [{ under, value: body }]
}

const everything = servedFiles()
const read = everything.filter((one) => one.name !== NOT_READ)
const everyValue = read.flatMap((one) => valuesIn(one.body, '<the file itself>'))

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

  it('drops the codebook of towns and nothing else', () => {
    /* So that the one exclusion stays a decision rather than a hole that quietly grows
       to cover whatever fails next. Both halves: it really is dropped, and everything
       else really is read. */
    expect(read.map((one) => one.name)).not.toContain(NOT_READ)
    expect(everything.length - read.length).toBe(1)
  })
})

describe('which fields the portal serves', () => {
  it('is the set that was written down, file by file', () => {
    /* **The whole set held as it stands**, which is what makes this complete: a field
       added anywhere under `public/mock`, whatever it is called and whatever it holds,
       is a field this does not recognise. `born`, `age`, `godiste`, `yearOfBirth`, `dob`
       and a field called `y` all fail here for the same reason, and so does a field that
       has nothing to do with a birthday.

       **What it costs, said plainly:** serving a new field is a change in two files. That
       is the same cost the dictionary and the drawn screens already pay, and it is the
       point. The snapshot is written by hand from the files it describes; there is no
       command that regenerates it, because a snapshot something else can rewrite is a
       snapshot nobody reads. */
    const now = Object.fromEntries(
      read.map((one) => [one.name, [...new Set(fieldsIn(one.body))].sort()]),
    )

    expect(now).toEqual(served)
  })

  it('is a snapshot of something, so the case above is comparing two full sets', () => {
    /* Without this the comparison passes when both sides are empty, which is what a
       broken read gives. Thirteen files and a hundred and forty one names on
       13.09.2026. */
    expect(Object.keys(served)).toHaveLength(13)
    expect(Object.values(served).flat().length).toBeGreaterThan(100)
  })
})

describe('what the portal serves about how old somebody is', () => {
  /**
   * The six fields that carry a value shaped like a year, and the only ones that may.
   *
   * Read off the files rather than remembered: these are every field under
   * `public/mock` holding an integer between 1900 and 2027, measured on 13.09.2026.
   * Three are seasons and three are a race's metres and seconds, which really do reach
   * those sizes. Held in both directions by the case below, so it can neither grow
   * quietly nor go stale.
   */
  const MAY_HOLD_A_YEAR = ['ascentM', 'descentM', 'firstSeason', 'seconds', 'season', 'teamSince']

  /** The seasons among them, which have a floor that metres and seconds do not. */
  const SEASONS = ['firstSeason', 'season', 'teamSince']

  /** The league's earliest imported season (PDL P26). Nothing it serves is older. */
  const FIRST_LEAGUE_SEASON = 2010

  const YEAR_SHAPED = /^-?\d+$/

  /** A value read as a year whether it arrived as a number or as text.
   *
   *  **Text matters, and that was measured.** Both halves of this used to ask
   *  `typeof value === 'number'` while a comment beside them claimed a year moved into
   *  `firstSeason` would be caught. A review wrote `"1975"` there — the very year this
   *  change had just taken off that member — and the whole suite stayed green
   *  (13.09.2026). JSON has no opinion about which of the two a number arrives as. */
  function asYear(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value : null
    }

    if (typeof value === 'string' && YEAR_SHAPED.test(value.trim())) {
      return Number(value.trim())
    }

    return null
  }

  const yearShaped = everyValue.flatMap((one) => {
    const year = asYear(one.value)

    return year !== null && year >= 1900 && year <= 2027 ? [{ ...one, year }] : []
  })

  it('holds the list of fields that may carry a year to the files themselves', () => {
    /* Both directions. A field added to the list without being in the files excuses
       something that is not there; a field in the files and not on the list is what the
       case after this is about, and it would find it, but this says which of the two
       went wrong. */
    const carrying = [...new Set(yearShaped.map((one) => one.under))].sort()

    expect(carrying).toEqual([...MAY_HOLD_A_YEAR].sort())
  })

  it('carries no year-shaped value in any other field, in any file', () => {
    /* The value and not the name, so a year of birth restored as `born`, as `age`, as
       `y` or with no new field at all lands here. Read as text or as a number alike. */
    const loose = yearShaped
      .filter((one) => !MAY_HOLD_A_YEAR.includes(one.under))
      .map((one) => `${one.under}: ${String(one.year)}`)

    expect(loose).toEqual([])
  })

  it('holds every season to a season the league has had', () => {
    /* The other way a year of birth gets served without a new field: written into one of
       the three that are allowed to hold a year. A season before the league's first is
       not a season.

       **The boundary, written here rather than left for somebody to find.** A season and
       a year of birth overlap from 2010 on, so a year of birth between 2010 and today
       written into one of these three reads as a season and is not caught. The youngest
       member served is in that window. What closes it is the backend, not a wider guard:
       no query over a public file can tell one 2013 from another. */
    const wrong = yearShaped
      .filter((one) => SEASONS.includes(one.under) && one.year < FIRST_LEAGUE_SEASON)
      .map((one) => `${one.under}: ${String(one.year)}`)

    expect(wrong).toEqual([])
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

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AGE_BANDS } from './categories'
import { RESOURCE_NAMES } from './client'

/**
 * Nothing the portal serves carries a year of birth, in any field, under any name.
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
 * **Read off the files rather than off a list of them.** A resource added tomorrow is
 * swept the day it is added, and the floor below says the sweep read something. The
 * shape is `data/contract.test.ts`, which is the other guard over this folder.
 */

/** The served folder itself, which is the source of truth for every case here. */
const MOCK = join(process.cwd(), 'public', 'mock')

/** Every served file, read as text and parsed, with the name it is served under. */
function served(): { name: string; body: unknown; text: string }[] {
  return readdirSync(MOCK, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      const text = readFileSync(join(MOCK, entry.name), 'utf-8')
      const body: unknown = JSON.parse(text)

      return { name: entry.name, body, text }
    })
}

/** Every (key, value) pair anywhere inside a served file, however deeply nested,
 *  with the path it was found at. Read rather than listed: a field added inside a
 *  record the portal does not draw is still a field the portal serves. */
function pairs(body: unknown, at: string): { at: string; key: string; value: unknown }[] {
  if (Array.isArray(body)) {
    return body.flatMap((one, index) => pairs(one, `${at}[${String(index)}]`))
  }

  if (typeof body === 'object' && body !== null) {
    return Object.entries(body).flatMap(([key, value]) => [
      { at: `${at}.${key}`, key, value },
      ...pairs(value, `${at}.${key}`),
    ])
  }

  return []
}

const everything = served()
const everyPair = everything.flatMap((one) => pairs(one.body, one.name))

describe('the sweep itself', () => {
  /* **M5, and the reason this describe is first.** A guard over a folder answers
     „nothing is wrong" and „nothing was looked at" with the same green, and the second
     is what happens when a path is wrong, a filter is narrowed, or the folder is empty.
     Run against an empty `public/mock`, every case below passes on an empty list; these
     two fail. */
  it('reads every file the portal serves, and there are as many as the contract names', () => {
    expect(everything.length).toBeGreaterThanOrEqual(RESOURCE_NAMES.length)
    expect(everything.map((one) => one.name)).toContain('competitors.json')
  })

  it('reads the fields inside them, not merely the files', () => {
    /* The file list can be right while the walk returns nothing, which is what a
       flattener that stops at the first array does. There are tens of thousands of
       fields under this folder; a floor in the thousands cannot be met by one record. */
    expect(everyPair.length).toBeGreaterThan(5000)
    expect(everyPair.filter((one) => one.key === 'memberNumber').length).toBeGreaterThan(30)
  })
})

describe('what the portal serves about how old somebody is', () => {
  /**
   * The one field whose name speaks of a birthday and which is allowed to stand.
   *
   * It carries a member's own choice about their birthday and never a date: its three
   * values are `none`, `year` and `full` (`data/types.ts`). Named one by one rather
   * than caught by a pattern, because a pattern is what lets the next such field
   * through, and held to exactly this one below so the list cannot become a place to
   * put whatever fails.
   */
  const ALLOWED = ['birthdayShown']

  it('holds the list of allowed names to exactly that one', () => {
    /* Otherwise this guard can be switched off from inside: adding a name here and the
       field to the file passes everything. */
    expect(ALLOWED).toEqual(['birthdayShown'])
  })

  it('names no field for a birth, an age or a year of birth', () => {
    /* **M1 and M2.** The obvious spelling and the ones somebody reaches for instead:
       `birthYear`, `yearOfBirth`, `godiste`, `godište`, `dob`, `uzrast`, `decenija`.
       Without regard to case, because a constant written `BIRTH_YEAR` walks past a
       pattern that asks for the camel spelling, and with the Serbian letters written
       both ways, because the portal's own data carries both.

       This is the cheap half. It cannot be complete — a field called `y` says nothing
       to any pattern — and the case after it is the one that does not depend on
       guessing a name. */
    const named = /birth|rodj|rođ|godi[sš]t|\bdob\b|uzrast|decenij|yob/i

    const found = everyPair
      .filter((one) => named.test(one.key) && !ALLOWED.includes(one.key))
      .map((one) => `${one.at}: ${one.key}`)

    expect(found).toEqual([])
  })

  it('is asked something a name cannot walk past, over the record that carried the year', () => {
    /* **M2 proper.** The case above knows a list of words; this one knows none. Every
       field on a member is held to the fields a member has, so a year of birth arriving
       under `godiste`, under `yearOfBirth` or under `y` fails here whatever it is
       called, and so does any other field nobody decided to serve.

       Written out by hand, and that is deliberate: this is the set somebody has to
       change on purpose. What keeps it honest is that it is checked in both directions
       — no record may carry a field outside it, and no field in it may be one no record
       carries — so it cannot quietly grow and it cannot quietly go stale. */
    const FIELDS = [
      'memberNumber',
      'firstName',
      'lastName',
      'gender',
      'city',
      'country',
      'ageBand',
      'firstSeason2027',
      'firstSeason',
      'active',
      'membershipBasis',
      'bio',
      'teamId',
      'teamSince',
      'referralCode',
      'referredBy',
      'profileHidden',
      'birthdayShown',
    ]

    const members: Record<string, unknown>[] = JSON.parse(
      readFileSync(join(MOCK, 'competitors.json'), 'utf-8'),
    )

    expect(members.length).toBeGreaterThan(30)

    const extra = [...new Set(members.flatMap((one) => Object.keys(one)))].filter(
      (key) => !FIELDS.includes(key),
    )
    const unused = FIELDS.filter((key) => !members.some((one) => key in one))

    expect(extra, 'a member carries a field nobody decided to serve').toEqual([])
    expect(unused, 'a field is listed here that no member carries').toEqual([])
  })

  it('serves every member an age band, and only a band the rulebook has', () => {
    /* **M4, and the half of M3 a list can answer.** A member with no band at all, or
       with one invented, fails here. Held to `AGE_BANDS` rather than to four strings
       written out again, so the two cannot drift: the rulebook fixes the bands and
       `categories.ts` is where the portal keeps them (PDL P7). */
    const members: { memberNumber: string; ageBand?: unknown }[] = JSON.parse(
      readFileSync(join(MOCK, 'competitors.json'), 'utf-8'),
    )

    const wrong = members
      .filter((one) => typeof one.ageBand !== 'string' || !AGE_BANDS.some((b) => b === one.ageBand))
      .map((one) => `${one.memberNumber}: ${String(one.ageBand)}`)

    expect(wrong).toEqual([])
  })

  it('carries no four digit year in a member record at all, outside the two seasons', () => {
    /* The value rather than the name, which is what M2 is really about: a year of birth
       is a four digit number in a person's record, and the only two such numbers a
       member is allowed are the season they joined the league and the season they joined
       their club. Both are seasons, both are named, and both are held to seasons the
       league has actually seen.

       So a year of birth restored under any name at all lands here: it is a four digit
       number in a field that is not one of those two. Measured at the time this was
       written: seven members carry a year of birth in the 1960s and 1970s, every one of
       which is outside the range below as well. */
    const SEASONS = ['firstSeason', 'teamSince']
    const FIRST_LEAGUE_SEASON = 2010

    const members: Record<string, number | unknown>[] = JSON.parse(
      readFileSync(join(MOCK, 'competitors.json'), 'utf-8'),
    )

    const years = members.flatMap((one) =>
      Object.entries(one)
        .filter(([key, value]) => typeof value === 'number' && !SEASONS.includes(key))
        .map(([key, value]) => `${String(one.memberNumber)}.${key}: ${String(value)}`),
    )

    expect(years, 'a member carries a number that is not one of the two seasons').toEqual([])

    /* And the two that are allowed are seasons rather than anything four digits wide:
       a year of birth moved into `firstSeason` would be caught by this and not by the
       line above. */
    const outside = members.flatMap((one) =>
      SEASONS.filter((key) => {
        const value = one[key]

        return typeof value === 'number' && value < FIRST_LEAGUE_SEASON
      }).map((key) => `${String(one.memberNumber)}.${key}: ${String(one[key])}`),
    )

    expect(outside, 'a season earlier than the league itself').toEqual([])
  })
})

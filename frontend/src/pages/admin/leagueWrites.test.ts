import { identityIn, upsertFrom } from './leagueWrites'

/**
 * WHAT THE ADMINISTRATION SENDS WHEN IT WRITES A COMPETITION, AND WHAT IT READS BACK.
 *
 * <p>A module rather than a screen, for the reason `pages/member/myAccount.test.ts` gives
 * about its own: a question about a body and about an answer is asked of the function that
 * builds and reads them, not by mounting React round it. What the screens do with these is
 * measured where the screen is (`adminLeagues.test.tsx`).
 */

describe('the body a competition is written with', () => {
  it('carries all five off the form, with the season as a number and never as text', () => {
    /* `forms/types.ts` holds every value as a string or a flag; `LeagueWriteApi.Upsert`
       takes an `Integer`. Sent as „2027" the binder refuses the whole body, which reaches
       the screen as a 400 with no reason in it - the one refusal nobody can act on. */
    expect(
      upsertFrom({
        name: 'Vojvođanska liga 2027',
        slug: 'vojvodjanska-2027',
        season: '2027',
        rules: '',
        prizes: '',
        highlightsEvents: true,
      }),
    ).toEqual({
      name: 'Vojvođanska liga 2027',
      slug: 'vojvodjanska-2027',
      season: 2027,
      rules: '',
      prizes: '',
      highlightsEvents: true,
    })
  })

  it('sends an empty string for a field the form did not carry, and never nothing at all', () => {
    /* A key left out of the JSON binds as null, and `whatIsWrongWith` answers
       `theFormIsNotComplete` to a blank name or address - which is a sentence the reader
       can act on. A field dropped from the body is the same refusal with nothing said. */
    expect(upsertFrom({ name: 'Liga', slug: 'liga', season: '2027' })).toEqual({
      name: 'Liga',
      slug: 'liga',
      season: 2027,
      rules: '',
      prizes: '',
      highlightsEvents: false,
    })
  })

  it('sends the box „Istakni događaje" as a flag, and only a tick is true', () => {
    /* A checkbox writes `true` or `false` (`forms/records.ts`); the word „true" or anything else is not a tick,
       so a value that is not the flag cannot tick the box on a league nobody ticked. */
    for (const [given, sent] of [[true, true], [false, false], ['true', false]] as const) {
      expect(upsertFrom({ name: 'Liga', slug: 'liga', season: '2027', highlightsEvents: given }).highlightsEvents)
        .toBe(sent)
    }
  })
})

describe('the identity a new competition comes back with', () => {
  it('is the number the database handed out', () => {
    expect(identityIn({ id: 4212, slug: 'vojvodjanska-2027' })).toBe(4212)
  })

  it('is nothing where the answer carried no body at all', () => {
    /* A 204, and a 201 whose body could not be parsed: `askTheServer` answers `undefined`
       for both rather than claiming a shape. */
    expect(identityIn(undefined)).toBeNull()
    expect(identityIn(null)).toBeNull()
    expect(identityIn('4212')).toBeNull()
  })

  it('is nothing where the body carries no identity, or one of the wrong kind', () => {
    expect(identityIn({ slug: 'vojvodjanska-2027' })).toBeNull()
    /* Read without an assertion, so a number written as text is refused rather than
       coerced: `/api/leagues/4212` and `/api/leagues/NaN` are both addresses. */
    expect(identityIn({ id: '4212' })).toBeNull()
    expect(identityIn({ id: 42.5 })).toBeNull()
  })

  it('refuses nought and below, which is the range the session overlay handed out', () => {
    /* THE WHOLE REASON THIS READ IS NOT JUST `typeof id === 'number'`. `admin/raceIds.ts`
       counts DOWN from nought, so a competition entered during a visit used to be `-1` and
       the panel of races posted to `/api/leagues/-1/races`. A `bigserial` starts at one, so
       nothing at or below nought can be an identity the database gave, and accepting one
       would rebuild the very fault by another road. */
    expect(identityIn({ id: 0 })).toBeNull()
    expect(identityIn({ id: -1 })).toBeNull()
    expect(identityIn({ id: 1 })).toBe(1)
  })
})

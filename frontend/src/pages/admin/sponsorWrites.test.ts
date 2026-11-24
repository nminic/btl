import { arrivedResource, clearResourceCache, loadResource } from '../../data/client'
import { LOCALES } from '../../i18n/config'
import { theSponsorsHaveChanged, upsertFrom } from './sponsorWrites'

/**
 * WHAT THE ADMINISTRATION SENDS WHEN IT WRITES A SPONSOR. A module and not a screen, as
 * `leagueWrites.test.ts` is: the question is about the body, so the function that builds it is asked.
 */
describe('the body a sponsor is written with', () => {
  it('sends an empty string for a field the form did not carry, and the three boxes as unticked', () => {
    /* A key left out of the JSON binds as null, and the route answers `theFormIsNotComplete` to a blank
       name: a sentence the reader can act on, which a field dropped from the body would not be. */
    expect(upsertFrom({ name: 'Volt' })).toEqual({
      name: 'Volt',
      url: '',
      descriptionSr: '',
      descriptionEn: '',
      main: false,
      inRotation: false,
      inStrip: false,
    })
  })

  it('sends the three boxes as flags, and only a tick is true', () => {
    expect(upsertFrom({ main: true, inRotation: 'true', inStrip: false })).toMatchObject({
      main: true,
      inRotation: false,
      inStrip: false,
    })
  })
})

/**
 * WHICH ANSWERS A WRITE OF A SPONSOR PUTS AWAY, asked of the cache by language and not by how many times something was
 * dropped (independent review of PR 826, 24.11.2026, SREDNJI 2). A counter of drops says that two things were dropped
 * and not which two: `clearResourceCache('sponsors', 'sr')` called once for each locale drops the Serbian front page
 * twice and counts the same, and the English one, read in the same visit, stays with the sponsors from before.
 */
describe('what the sponsors having changed puts away', () => {
  beforeEach(() => {
    clearResourceCache()
  })

  it.each(LOCALES)('puts away the front page as it was read in %s', async (locale) => {
    await loadResource('sponsors', locale)
    expect(arrivedResource('sponsors', locale), 'the case did not read the front page').toBeDefined()

    theSponsorsHaveChanged()

    expect(arrivedResource('sponsors', locale)).toBeUndefined()
  })

  it('puts away the list of the administration too', async () => {
    await loadResource('sponsors/all')
    expect(arrivedResource('sponsors/all'), 'the case did not read the list').toBeDefined()

    theSponsorsHaveChanged()

    expect(arrivedResource('sponsors/all')).toBeUndefined()
  })
})

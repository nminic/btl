import { upsertFrom } from './sponsorWrites'

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

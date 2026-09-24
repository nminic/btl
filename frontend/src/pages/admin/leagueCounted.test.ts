import { countedRacesOf } from './leagueCounted'

/**
 * WHICH RACES A COMPETITION COUNTS, READ OFF AN ANSWER NOBODY HAS PROMISED ANYTHING ABOUT.
 *
 * This reads a field the portal's own type does not carry (`leagueCounted.ts` says why), so
 * what comes in is `unknown` in the fullest sense: not merely a `League` whose `raceIds` may
 * be missing, but whatever `/api/leagues` answered with. Every case below is a shape a
 * screen would otherwise have thrown on, and the answer to all of them is the same one an
 * empty competition gets, which is the decision that file records rather than a shortcut.
 */
describe('the races a competition counts', () => {
  const SERVED = [
    { id: 7, raceIds: [] },
    { id: 9, raceIds: [125, 957] },
    { id: 11, raceIds: [4] },
  ]

  it('reads them off the competition with that key and off no other', () => {
    /* Not the first row and not the last, because „the competition asked for" and „the first
       one" have to be two different answers before this says anything at all. */
    expect(countedRacesOf(SERVED, 9)).toEqual([125, 957])
    expect(countedRacesOf(SERVED, 7)).toEqual([])
    expect(countedRacesOf(SERVED, 11)).toEqual([4])
  })

  it('answers nothing for a competition the answer does not carry', () => {
    expect(countedRacesOf(SERVED, 13)).toEqual([])
  })

  it('answers nothing for an answer that is not a list at all', () => {
    /* What a failed read, a wrapped answer or a body of some other shape looks like from
       here. The screen draws an empty competition rather than falling over, which is the
       state every competition is in before its season anyway. */
    expect(countedRacesOf(null, 9)).toEqual([])
    expect(countedRacesOf({ leagues: SERVED }, 9)).toEqual([])
    expect(countedRacesOf('nije spisak', 9)).toEqual([])
  })

  it('answers nothing where the competition carries no such field, and keeps only numbers', () => {
    /* The field is one the shared type does not promise, so „it is not there" is an ordinary
       answer and not a fault - and a list that holds something other than a number would put
       `NaN` into an address, which is a request for a race nobody has. */
    expect(countedRacesOf([{ id: 9 }], 9)).toEqual([])
    expect(countedRacesOf([{ id: 9, raceIds: 'sve' }], 9)).toEqual([])
    expect(countedRacesOf([{ id: 9, raceIds: [125, '957', null, 4] }], 9)).toEqual([125, 4])
  })

  it('reads past a row that is not an object, rather than falling over it', () => {
    expect(countedRacesOf([null, 'liga', { id: 9, raceIds: [125] }], 9)).toEqual([125])
  })
})

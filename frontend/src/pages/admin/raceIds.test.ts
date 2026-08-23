import { nextRaceNumber } from './raceIds'

describe('the identity a race entered under an event is handed', () => {
  it('counts up from the highest already used, never from how many there are', () => {
    /* The fault this exists for, measured on the real screen on 23.08.2026: two
       races saved as `-trka-1` and `-trka-2`, the first deleted, a third entered,
       and a count handed it `-trka-2` again. Two records answered to one id, React
       said „two children with the same key", and the third race was not drawn at
       all. */
    expect(nextRaceNumber(['E-trka-1', 'E-trka-2'], 'E')).toBe(3)
    expect(nextRaceNumber(['E-trka-2'], 'E'), 'counted rather than measured').toBe(3)
    expect(nextRaceNumber([], 'E')).toBe(1)
  })

  it('reads every race of that event, whatever gave it its name', () => {
    /* A race out of the file, a race copied from another event, and a race entered
       here all live in one list, and only the ones under this event count. */
    expect(nextRaceNumber(['D-trka-9', 'E-trka-1'], 'E'), 'another event was counted').toBe(2)
    expect(nextRaceNumber(['E-race-4', 'E-trka-1'], 'E')).toBe(2)
    /* And what is not a number is not one: an id ending in something else must not
       become `NaN + 1`. */
    expect(nextRaceNumber(['E-trka-kopija-1', 'E-trka-2'], 'E')).toBe(3)
    expect(nextRaceNumber(['E-trka-0'], 'E'), 'nought is not a number in use').toBe(1)
  })
})

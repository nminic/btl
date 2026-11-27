import { must } from '../test/at'
import { btlPoints, effectiveLengthKm } from './scoring'

/**
 * The score of one race, and a failure rather than a null.
 *
 * `btlPoints` answers null for a race it cannot score, which is a real answer
 * the portal has to handle. In a test of the formula it is never the answer
 * being looked for, and comparing a null is how a test of arithmetic quietly
 * stops testing arithmetic.
 */
const scored = (km: number, up: number, down: number, seconds: number): number =>
  must(btlPoints(km, up, down, seconds), `a score for ${km} km in ${seconds} seconds`)

describe('effectiveLengthKm', () => {
  it('folds the climb in, weighing ascent above descent, and a descent still adds', () => {
    expect(effectiveLengthKm(20, 1000, 1000)).toBe(30)
    expect(effectiveLengthKm(20, 1000, 0)).toBe(29)
    expect(effectiveLengthKm(20, 0, 1000)).toBe(21)
  })

  it('leaves a flat race alone', () => {
    expect(effectiveLengthKm(21.1, 0, 0)).toBe(21.1)
  })

  it('matches the golden race', () => {
    expect(effectiveLengthKm(62.07, 3456, 3133)).toBe(96.307)
  })
})

describe('btlPoints', () => {
  // The golden set: the organiser's race (62.07 km, +3456 m, -3133 m) under the formula the
  // owner decided on 26.11.2026 (PDL P4, „Nova formula bodova, na produkciju”), worked out
  // independently in Python. The backend is held to the same numbers
  // (BtlScoreCalculatorTest). Never change what is expected here without the owner.
  it.each([
    [26911, '86.67'],
    [34395, '30.55'],
    [37476, '21.21'],
    [37813, '20.42'],
    [37850, '20.34'],
  ])('gives %i seconds %s points', (seconds, expected) => {
    expect(scored(62.07, 3456, 3133, seconds).toFixed(2)).toBe(expected)
  })

  /* The control the owner published (21.1 km, +250 m, -250 m, 1:45:00 is 18.59, „Kontrola sa FB
     ostaje ista”), then each road through the reference table: below its first point, on each of
     its points, between points and beyond its last, with a climb alone and a fall alone. The same
     rows and the same Python working as BtlScoreCalculatorTest. */
  it.each([
    [21.1, 250, 250, 6300, '18.59'],
    [3, 0, 0, 900, '3.07'],
    [5, 0, 0, 755, '78.86'],
    [5, 0, 0, 1200, '11.01'],
    [7, 0, 0, 2100, '5.28'],
    [10, 0, 0, 1571, '103.34'],
    [10, 0, 0, 3000, '6.61'],
    [21.0975, 0, 0, 3450, '138.27'],
    [42.195, 0, 0, 7235, '181.18'],
    [46, 0, 0, 8400, '183.66'],
    [50, 0, 0, 9613, '193.58'],
    [75, 0, 0, 30000, '13.98'],
    [100, 0, 0, 21935, '253.67'],
    [150, 0, 0, 86400, '6.81'],
    [300, 0, 0, 86400, '297.44'],
    [10, 1000, 0, 5400, '12.37'],
    [10, 0, 800, 2400, '24.82'],
    [3, 1000, 0, 1920, '107.02'],
  ])('agrees with the independent working for %f km, +%i, -%i, %i s: %s', (km, up, down, s, expected) => {
    expect(scored(km, up, down, s).toFixed(2)).toBe(expected)
  })

  it('rewards a faster time and a longer race at the same pace', () => {
    expect(scored(42.2, 0, 0, 12600)).toBeGreaterThan(scored(42.2, 0, 0, 14400))
    expect(scored(42.2, 0, 0, 42.2 * 360)).toBeGreaterThan(scored(21.1, 0, 0, 21.1 * 360))
  })

  it('refuses anything that is not a race', () => {
    expect(btlPoints(0, 0, 0, 7200)).toBeNull()
    expect(btlPoints(-5, 0, 0, 7200)).toBeNull()
    expect(btlPoints(21.1, 0, 0, 0)).toBeNull()
    expect(btlPoints(21.1, 0, 0, -60)).toBeNull()
    expect(btlPoints(21.1, -1, 0, 7200)).toBeNull()
    expect(btlPoints(21.1, 0, -1, 7200)).toBeNull()
  })

  /* A number that is not one is refused by the same sentence as a negative, for every one of the
     four. The three beside the climb were already refused, because a comparison asked as „above
     nought" is false for `NaN`; the climb and the fall were asked as „below nought", which is
     false for it too, and the formula answered `NaN` for a race with a climb that was not a number
     (the calculator on the front page, whose boxes are text since 02.10.2026, PENDING 383). */
  it('refuses a number that is not one, in every place there is one', () => {
    expect(btlPoints(Number.NaN, 0, 0, 7200)).toBeNull()
    expect(btlPoints(21.1, Number.NaN, 0, 7200)).toBeNull()
    expect(btlPoints(21.1, 0, Number.NaN, 7200)).toBeNull()
    expect(btlPoints(21.1, 0, 0, Number.NaN)).toBeNull()
  })
})

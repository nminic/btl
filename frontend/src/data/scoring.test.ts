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
  it('folds the climb in, weighing ascent above descent', () => {
    expect(effectiveLengthKm(20, 1000, 1000)).toBe(30)
    expect(effectiveLengthKm(20, 1000, 0)).toBeGreaterThan(effectiveLengthKm(20, 0, 1000))
  })

  it('leaves a flat race alone', () => {
    expect(effectiveLengthKm(21.1, 0, 0)).toBe(21.1)
  })

  it('matches the golden race', () => {
    expect(effectiveLengthKm(62.07, 3456, 3133)).toBe(96.307)
  })
})

describe('btlPoints', () => {
  // THIS BRANCH (b-formula-b-qa) IS NEVER MERGED: the proposal of 25.11.2026 (94.80, exponent 0.35,
  // no cap) for a comparison on QA. On main the golden set stays 79.03, 46.78, 38.94, 38.21, 38.13.
  it.each([
    [26911, '77.29'],
    [34395, '28.96'],
    [37476, '20.55'],
    [37813, '19.83'],
    [37850, '19.75'],
  ])('gives %i seconds %s points', (seconds, expected) => {
    expect(scored(62.07, 3456, 3133, seconds).toFixed(2)).toBe(expected)
  })

  it.each([
    [21.1, 250, 250, 6300, '18.59'],
    [3, 0, 0, 900, '3.53'],
    [5, 0, 0, 755, '74.38'],
    [10, 0, 0, 1571, '94.80'],
    [75, 0, 0, 30000, '13.94'],
    [150, 0, 0, 86400, '7.00'],
    [300, 0, 0, 86400, '241.95'],
    [10, 1000, 0, 5400, '12.72'],
    [10, 0, 800, 2400, '24.73'],
    [3, 1000, 0, 1920, '97.67'],
    [5, 0, 0, 1200, '11.65'],
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

import { must } from '../test/at'
import { btlPoints, effectiveLengthKm, pointsOf } from './scoring'

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
    expect(effectiveLengthKm(20, 1000, 1000)).toBe(27)
    expect(effectiveLengthKm(20, 1000, 0)).toBe(25)
    expect(effectiveLengthKm(20, 0, 1000)).toBe(22)
  })

  it('leaves a flat race alone', () => {
    expect(effectiveLengthKm(21.1, 0, 0)).toBe(21.1)
  })

  it('matches the golden race', () => {
    expect(effectiveLengthKm(62.07, 3456, 3133)).toBeCloseTo(85.616, 9)
  })
})

describe('btlPoints', () => {
  // The golden set: the organiser's race (62.07 km, +3456 m, -3133 m) under the formula the
  // owner chose on 27.11.2026 (PDL P4, „Izabrana varijanta V3c”), worked out independently in
  // Python by the owner's reference calculation. The backend is held to the same numbers
  // (BtlScoreCalculatorTest). Never change what is expected here without the owner.
  it.each([
    [26911, '42.38'],
    [34395, '21.58'],
    [37476, '17.05'],
    [37813, '16.63'],
    [37850, '16.59'],
  ])('gives %i seconds %s points', (seconds, expected) => {
    expect(scored(62.07, 3456, 3133, seconds).toFixed(2)).toBe(expected)
  })

  /* The control the owner published (21.1 km, +250 m, -250 m, 1:45:00 is 18.59, „Kontrola sa FB
     ostaje ista”), then each road through the curve: below 5 km, on 5 km, between the records and
     beyond the last, with a climb alone and a fall alone, the examples the owner printed (10 km in
     40:00 16.37, in 50:00 8.86, the marathon in 3:30 24.44, Red Bull 400 5.69) and the walk at 5:00
     per kilometre that showed him the curve has no corner. The same rows and the same Python
     working as BtlScoreCalculatorTest. */
  it.each([
    [21.1, 250, 250, 6300, '18.59'],
    [3, 0, 0, 900, '5.09'],
    [1, 0, 0, 200, '4.43'],
    [5, 0, 0, 755, '43.89'],
    [5, 0, 0, 1200, '12.27'],
    [7, 0, 0, 2100, '7.52'],
    [10, 0, 0, 1571, '52.51'],
    [10, 0, 0, 2400, '16.37'],
    [10, 0, 0, 3000, '8.86'],
    [21.0975, 0, 0, 3450, '73.87'],
    [42.195, 0, 0, 7235, '112.39'],
    [42.195, 0, 0, 12600, '24.44'],
    [46, 0, 0, 8400, '102.12'],
    [50, 0, 0, 9613, '95.68'],
    [75, 0, 0, 30000, '19.00'],
    [100, 0, 0, 21935, '135.00'],
    [150, 0, 0, 86400, '15.21'],
    [300, 0, 0, 86400, '253.32'],
    [10, 1000, 0, 5400, '6.74'],
    [10, 0, 800, 2400, '26.63'],
    [3, 1000, 0, 1920, '14.72'],
    [0.27, 140, 0, 174, '5.69'],
    [40, 0, 0, 12000, '23.03'],
    [42.1, 0, 0, 12630, '24.09'],
    [45, 0, 0, 13500, '25.56'],
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

describe('pointsOf at a race to a limit', () => {
  /* A race to a limit is counted by its own formula: the length covered against the length a
     runner of reference covers in the limit (PDL P4, „Izabrana varijanta V3c”). The 24 hours of
     115.64 km is 11.51 as the owner printed it. The same rows and the same Python working as
     BtlScoreCalculatorTest, and the same figures read as a race of a length give another number. */
  it.each([
    [115.64, 0, 0, 86400, '11.51'],
    [60, 2000, 500, 86400, '2.36'],
    [44, 0, 0, 21600, '10.24'],
    [50.82, 55, 55, 43200, '3.59'],
    [30, 0, 0, 21600, '2.95'],
    [5, 0, 0, 600, '88.68'],
    [150, 0, 0, 86400, '26.82'],
    [300, 0, 0, 86400, '255.15'],
  ])('agrees with the independent working for %f km, +%i, -%i, limit %i s: %s', (km, up, down, s, expected) => {
    expect(pointsOf(km, up, down, s, 'time').toFixed(2)).toBe(expected)
  })

  it('counts the same figures by the formula of a length on a race of a length and on a free one', () => {
    expect(pointsOf(60, 2000, 500, 86400, 'length').toFixed(2)).toBe('0.84')
    expect(pointsOf(60, 2000, 500, 86400, 'free').toFixed(2)).toBe('0.84')
    expect(pointsOf(60, 2000, 500, 86400, 'time').toFixed(2)).toBe('2.36')
  })
})

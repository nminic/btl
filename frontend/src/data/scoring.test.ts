import { btlPoints, effectiveLengthKm } from './scoring'

describe('effectiveLengthKm', () => {
  it('folds the climb in, weighing ascent above descent', () => {
    expect(effectiveLengthKm(20, 1000, 1000)).toBe(30)
    expect(effectiveLengthKm(20, 1000, 0)).toBeGreaterThan(effectiveLengthKm(20, 0, 1000))
  })

  it('leaves a flat race alone', () => {
    expect(effectiveLengthKm(21.1, 0, 0)).toBe(21.1)
  })

  it('matches the golden race', () => {
    expect(effectiveLengthKm(62.07, 3456, 3133)).toBe(95.41875)
  })
})

describe('btlPoints', () => {
  // The golden set from an official race, confirmed by the organiser. The
  // backend is held to the same numbers. Never change what is expected here.
  it.each([
    [26911, '79.03'],
    [34395, '46.78'],
    [37476, '38.94'],
    [37813, '38.21'],
    [37850, '38.13'],
  ])('gives %i seconds %s points', (seconds, expected) => {
    expect(btlPoints(62.07, 3456, 3133, seconds)!.toFixed(2)).toBe(expected)
  })

  it('rewards a faster time and a longer race at the same pace', () => {
    expect(btlPoints(42.2, 0, 0, 12600)!).toBeGreaterThan(btlPoints(42.2, 0, 0, 14400)!)
    expect(btlPoints(42.2, 0, 0, 42.2 * 360)!).toBeGreaterThan(btlPoints(21.1, 0, 0, 21.1 * 360)!)
  })

  it('refuses anything that is not a race', () => {
    expect(btlPoints(0, 0, 0, 7200)).toBeNull()
    expect(btlPoints(-5, 0, 0, 7200)).toBeNull()
    expect(btlPoints(21.1, 0, 0, 0)).toBeNull()
    expect(btlPoints(21.1, 0, 0, -60)).toBeNull()
    expect(btlPoints(21.1, -1, 0, 7200)).toBeNull()
    expect(btlPoints(21.1, 0, -1, 7200)).toBeNull()
  })
})

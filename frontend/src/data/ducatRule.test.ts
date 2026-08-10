import {
  coinNumber,
  firstOf,
  instancesOf,
  periodLegend,
  ruleSentence,
  tierOf,
  topFor,
  unitOf,
  type DucatFamily,
} from './ducatRule'
import { at, first } from '../test/at'

/** A family with everything switched off, so each test turns on the one thing
 *  it is about. */
const plain: DucatFamily = {
  id: 'duk-proba',
  name: 'Proba',
  kind: 'raceCount',
  value: 10,
  period: 'always',
  top: 'ISTRČANIH',
  topFemale: '',
  bottom: 'TRKA',
  periodAt: 'none',
  mark: 'races',
  art: 'none',
  tier: 3,
  step: 0,
  last: 0,
  tierUpFrom: 0,
}

const t = (key: string, params?: Record<string, string | number>) =>
  `${key}${params === undefined ? '' : JSON.stringify(params)}`

describe('what stands on the coin', () => {
  it('gives a unit only to the quantities that are measured in one', () => {
    expect(unitOf({ kind: 'totalKm', art: 'none' })).toBe('km')
    expect(unitOf({ kind: 'totalTime', art: 'none' })).toBe('sati')
    // Races, points, seasons and countries are counted in themselves, and the
    // legend under the number is what names them.
    expect(unitOf({ kind: 'raceCount', art: 'none' })).toBe('')
  })

  it('gives neither number nor unit to a ducat that carries a drawing', () => {
    /* Two of the fifteen have a drawing in the middle instead of a figure, and
       a drawing with a unit floating under it is a drawing with a caption. */
    expect(coinNumber({ value: 40075, art: 'globe' })).toBe('')
    expect(unitOf({ kind: 'totalKm', art: 'globe' })).toBe('')
  })

  it('strikes the number as plain digits, without a grouping mark', () => {
    /* A separator is a speck of dirt on a disc drawn at 120 pixels. The grouped
       number is in the sentence beside the coin, where it can be read. */
    expect(coinNumber({ value: 1000, art: 'none' })).toBe('1000')
  })

  it('names the period the way a coin names it, and says nothing when there is none', () => {
    expect(periodLegend('month', 2027, 6)).toBe('JUL 2027')
    expect(periodLegend('season', 2027, 0)).toBe('SEZONA 2027')
    expect(periodLegend('always', 2027, 0)).toBe('')
  })

  it('does not invent a month it has no name for', () => {
    /* Unreachable through the two callers, both of which count from zero to
       eleven, and present because indexing a list answers `undefined` under
       `noUncheckedIndexedAccess` (ADL A14). Asserted rather than assumed: the
       fallback is what stops a thirteenth month printing "undefined 2027". */
    expect(periodLegend('month', 2027, 12)).toBe(' 2027')
  })

  it('reads the legend to a woman in her own words, where the words differ', () => {
    const gendered = { ...plain, top: 'TRČAO U', topFemale: 'TRČALA U' }

    expect(topFor(gendered, 'F')).toBe('TRČALA U')
    expect(topFor(gendered, 'M')).toBe('TRČAO U')
    // And where they do not differ, one string serves both.
    expect(topFor(plain, 'F')).toBe('ISTRČANIH')
  })
})

describe('the one coin the rulebook draws for a family', () => {
  it('puts the period where the family says, and the fixed legend in the other place', () => {
    const below = firstOf({ ...plain, period: 'month', periodAt: 'bottom' }, 'M')
    const above = firstOf({ ...plain, period: 'season', periodAt: 'top' }, 'M')

    expect(below.top).toBe('ISTRČANIH')
    expect(below.bottom).toBe('JANUAR 2027')
    expect(above.top).toBe('SEZONA 2027')
    expect(above.bottom).toBe('TRKA')
  })

  it('leaves both legends alone when the family has no period at all', () => {
    const one = firstOf(plain, 'M')

    expect(one.top).toBe('ISTRČANIH')
    expect(one.bottom).toBe('TRKA')
  })

  it('draws the first of a series, at its first threshold and its own value', () => {
    /* A wall that drew every instance would be fifty-five coins in the first
       season and grow by twenty-eight a year (ADL A12, 7). */
    const one = firstOf({ ...plain, step: 100, last: 1000, value: 100, tierUpFrom: 500 }, 'M')

    expect(one.value).toBe(100)
    expect(one.tier).toBe(3)
  })
})

describe('the ducats a family actually makes', () => {
  it('makes exactly one when the family has neither period nor series', () => {
    const made = instancesOf(plain, '2029-05-04', 'M')

    expect(made).toHaveLength(1)
    expect(first(made).from).toBe('')
    expect(first(made).to).toBe('')
  })

  it('makes one a month, from the first season up to the month we are in', () => {
    const made = instancesOf({ ...plain, period: 'month', periodAt: 'bottom' }, '2028-03-15', 'M')

    // Twelve of 2027 and three of 2028, the third being the month in progress.
    expect(made).toHaveLength(15)
    expect(first(made).from).toBe('2027-01-01')
    expect(first(made).to).toBe('2027-01-31')
    expect(at(made, 14).bottom).toBe('MART 2028')
  })

  it('closes February on the day February closes', () => {
    /* A month ends where it ends: the twenty-eighth, and the twenty-ninth in a
       leap year. Written out once here so that no rule anywhere has to know. */
    const made = instancesOf({ ...plain, period: 'month' }, '2028-02-10', 'M')

    expect(at(made, 1).to).toBe('2027-02-28')
    expect(at(made, 13).to).toBe('2028-02-29')
  })

  it('makes none at all before the first season has begun', () => {
    // The league starts on 1 January 2027, and until then there is no month to
    // have run 125 kilometres in.
    expect(instancesOf({ ...plain, period: 'month' }, '2026-08-10', 'M')).toHaveLength(0)
  })

  it('makes one a season, each closed on the last day of its year', () => {
    const made = instancesOf({ ...plain, period: 'season', periodAt: 'top' }, '2028-06-01', 'M')

    expect(made).toHaveLength(2)
    expect(first(made).from).toBe('2027-01-01')
    expect(first(made).to).toBe('2027-12-31')
    expect(at(made, 1).top).toBe('SEZONA 2028')
  })

  it('makes one per step of a series, up to the last', () => {
    const made = instancesOf(
      { ...plain, value: 100, step: 100, last: 1000, tierUpFrom: 500 },
      '2027-01-01',
      'M',
    )

    expect(made.map((one) => one.value)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
    // Ten ducats, ten identities, or a profile would hold one of them ten times.
    expect(new Set(made.map((one) => one.id)).size).toBe(10)
  })

  it('lifts the second half of a series a value higher', () => {
    /* The owner moved the step up to the middle of the series rather than its
       end (10.08.2026): a hundred races and a thousand should not wear the same
       metal. */
    const made = instancesOf(
      { ...plain, value: 100, step: 100, last: 1000, tierUpFrom: 500 },
      '2027-01-01',
      'M',
    )

    expect(made.filter((one) => one.tier === 3).map((one) => one.value)).toEqual([100, 200, 300, 400])
    expect(made.filter((one) => one.tier === 4)).toHaveLength(6)
  })

  it('multiplies the periods by the thresholds when a family has both', () => {
    const made = instancesOf(
      { ...plain, period: 'season', value: 10, step: 10, last: 30 },
      '2028-01-01',
      'M',
    )

    expect(made).toHaveLength(6)
    expect(new Set(made.map((one) => one.id)).size).toBe(6)
  })

  it('reads the legend to the member whose profile it is', () => {
    const gendered = { ...plain, top: 'POPEO SE', topFemale: 'POPELA SE' }

    expect(first(instancesOf(gendered, '2027-01-01', 'F')).top).toBe('POPELA SE')
  })
})

describe('the value of a ducat', () => {
  it('is the family value where the family does not step up', () => {
    expect(tierOf(plain, 10)).toBe(3)
  })

  it('never climbs past the fifth', () => {
    /* The scale has five metals and there is no sixth to draw, so a family that
       is already the highest and steps up stays where it is. */
    expect(tierOf({ ...plain, tier: 5, tierUpFrom: 5 }, 10)).toBe(5)
  })
})

describe('the sentence that says how a ducat is earned', () => {
  it('counts through the whole history when the family has no period', () => {
    expect(ruleSentence(plain, t, 'sr')).toContain('ducats.ever')
  })

  it('says which month and which season it repeats in, and from when', () => {
    expect(ruleSentence({ ...plain, period: 'month' }, t, 'sr')).toContain(
      'ducats.everyMonth{"season":2027}',
    )
    expect(ruleSentence({ ...plain, period: 'season' }, t, 'sr')).toContain(
      'ducats.everySeason{"season":2027}',
    )
  })

  it('says a series repeats, and where it stops', () => {
    const said = ruleSentence({ ...plain, value: 100, step: 100, last: 1000 }, t, 'sr')

    expect(said).toContain('ducats.again{"step":"100","last":"1.000"}')
  })

  it('says nothing about repeating when the family is one ducat', () => {
    expect(ruleSentence(plain, t, 'sr')).not.toContain('ducats.again')
  })

  it('writes the value the way this language writes a number', () => {
    /* The sentence and the coin stand on the same card. The coin carries plain
       digits by design; the sentence is prose and carries the separator. */
    expect(ruleSentence({ ...plain, value: 1000 }, t, 'sr')).toContain('1.000')
  })
})

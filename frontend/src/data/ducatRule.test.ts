import {
  coinNumber,
  firstOf,
  instanceAt,
  periodLegend,
  ruleSentence,
  topFor,
  unitOf,
  type DucatFamily,
} from './ducatRule'

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
  counted: 'trka',
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

describe('one ducat a member holds, drawn from its family', () => {
  /* Which ducats he holds is the server's since 13.11.2026 (`DucatAwardApi`), and what it sends is the
     family's code, the threshold, the tier it was won at, and the season and month (1 to 12). */
  const always = { value: 10, tier: 3, season: null, month: null } as const

  it('stands for ever, with no period on it, where the record names no season', () => {
    const drawn = instanceAt(plain, 'M', always)

    expect(drawn).toEqual({
      id: 'duk-proba',
      name: 'Proba',
      kind: 'raceCount',
      value: 10,
      from: '',
      to: '',
      tier: 3,
      mark: 'races',
      art: 'none',
      top: 'ISTRČANIH',
      bottom: 'TRKA',
    })
  })

  it('carries the tier the record kept, and not the one the family has today', () => {
    /* A run's tier rises part way and a ducat won at one tier goes on saying it (V91). The family says 3,
       the record says 5, so a coin drawn from the family is a different coin. */
    expect(instanceAt(plain, 'M', { ...always, tier: 5 }).tier).toBe(5)
  })

  it('names the threshold in its identity when the family is a run', () => {
    const drawn = instanceAt({ ...plain, value: 100, step: 100, last: 1000 }, 'M', { ...always, value: 300 })

    expect(drawn.id).toBe('duk-proba-300')
    expect(drawn.value).toBe(300)
  })

  it('is one season, closed on the last day of its year, with the season where the family puts it', () => {
    const drawn = instanceAt({ ...plain, period: 'season', periodAt: 'top' }, 'M', { ...always, season: 2028 })

    expect([drawn.id, drawn.from, drawn.to, drawn.top, drawn.bottom]).toEqual([
      'duk-proba-2028',
      '2028-01-01',
      '2028-12-31',
      'SEZONA 2028',
      'TRKA',
    ])
  })

  it('is one month, read 1 to 12 as the server keeps it, and closed on the day that month closes', () => {
    const monthly = { ...plain, period: 'month', periodAt: 'bottom' } as const
    const february = instanceAt(monthly, 'M', { ...always, season: 2028, month: 2 })

    expect([february.id, february.from, february.to, february.bottom]).toEqual([
      'duk-proba-2028-02',
      '2028-02-01',
      '2028-02-29',
      'FEBRUAR 2028',
    ])
    expect(instanceAt(monthly, 'M', { ...always, season: 2027, month: 2 }).to).toBe('2027-02-28')

    /* The last month is the edge a reading of 0 to 11 falls off. */
    const december = instanceAt(monthly, 'M', { ...always, season: 2027, month: 12 })

    expect([december.to, december.bottom]).toEqual(['2027-12-31', 'DECEMBAR 2027'])
  })

  it('reads the legend to the member whose profile it is', () => {
    const gendered = { ...plain, top: 'POPEO SE', topFemale: 'POPELA SE' }

    expect(instanceAt(gendered, 'F', always).top).toBe('POPELA SE')
    expect(instanceAt(gendered, 'M', always).top).toBe('POPEO SE')
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

  it('says a series repeats, in what it is counted, and where it stops', () => {
    const said = ruleSentence({ ...plain, value: 100, step: 100, last: 1000 }, t, 'sr')

    // Serbian counts with the noun: "na svakih 100" alone is half a sentence.
    expect(said).toContain('ducats.again{"step":"100","last":"1.000","counted":"trka"}')
  })

  it('says where a series starts being worth one value more', () => {
    /* The wall draws the first coin of a family, which is the cheap one, so this
       sentence is the only place the step up is ever said (PDL P16). */
    const said = ruleSentence({ ...plain, step: 100, last: 1000, tierUpFrom: 500 }, t, 'sr')

    expect(said).toContain('ducats.stepUp{"upFrom":"500","counted":"trka"}')
  })

  it('says nothing about stepping up where a family never does', () => {
    expect(ruleSentence(plain, t, 'sr')).not.toContain('ducats.stepUp')
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

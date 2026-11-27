import {
  coinNumber,
  firstOf,
  instanceAt,
  periodLegend,
  ruleSentence,
  topFor,
  unitFor,
  unitOf,
  type DucatFamily,
} from './ducatRule'
import sr from '../i18n/sr.json'
import en from '../i18n/en.json'
import { translate } from '../i18n/translate'

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

/** The two readers of a coin, with the dictionaries the portal draws them from. */
const inSerbian = (key: string, params?: Record<string, string | number>) => translate(sr, 'sr', key, params)
const inEnglish = (key: string, params?: Record<string, string | number>) => translate(en, 'en', key, params)

describe('what stands on the coin', () => {
  it('gives a unit only to the quantities that are measured in one', () => {
    expect(unitOf({ kind: 'totalKm', art: 'none' }, inSerbian)).toBe('km')
    expect(unitOf({ kind: 'totalTime', art: 'none' }, inSerbian)).toBe('sati')
    // Races, points, seasons and countries are counted in themselves, and the
    // legend under the number is what names them.
    expect(unitOf({ kind: 'raceCount', art: 'none' }, inSerbian)).toBe('')
  })

  it('says the unit in the language of the reader, kilometre and metre being the same two letters', () => {
    expect(unitOf({ kind: 'totalTime', art: 'none' }, inEnglish)).toBe('hours')
    expect(unitFor('totalTime', inSerbian)).toBe('sati')
    expect(unitFor('totalAscent', inEnglish)).toBe('m')
    expect(unitFor('bestRaceKm', inEnglish)).toBe('km')
    expect(firstOf({ ...plain, kind: 'totalTime' }, 'M', inEnglish).unit).toBe('hours')
    expect(instanceAt({ ...plain, kind: 'totalTime' }, 'M', { value: 10, tier: 3, season: null, month: null }, inEnglish).unit).toBe('hours')
    expect(firstOf({ ...plain, kind: 'totalTime', art: 'galaxy' }, 'M', inEnglish).unit).toBe('')
  })

  it('gives no unit under a drawing on the path a member\'s own ducat takes, whichever drawing it is', () => {
    /* `instanceAt` is the road of every ducat a member holds and `firstOf` of the rulebook's, and the rule that a
       drawing carries no unit is one rule that has to hold on both: a kind that has a unit, with each of the two
       drawings, and a plain one beside them that does, so the empty string is not simply what `instanceAt` gives. */
    const held = { value: 10, tier: 3, season: null, month: null } as const
    const hours = { ...plain, kind: 'totalTime' } as const

    expect(instanceAt({ ...hours, art: 'globe' }, 'M', held, inEnglish).unit).toBe('')
    expect(instanceAt({ ...hours, art: 'galaxy' }, 'M', held, inEnglish).unit).toBe('')
    expect(instanceAt({ ...hours, art: 'galaxy' }, 'M', { ...held, season: 2027, month: 3 }, inEnglish).unit).toBe('')
    expect(instanceAt(hours, 'M', held, inEnglish).unit).toBe('hours')
  })

  it('gives neither number nor unit to a ducat that carries a drawing', () => {
    /* Two of the fifteen have a drawing in the middle instead of a figure, and
       a drawing with a unit floating under it is a drawing with a caption. */
    expect(coinNumber({ value: 40075, art: 'globe' })).toBe('')
    expect(unitOf({ kind: 'totalKm', art: 'globe' }, inSerbian)).toBe('')
  })

  it('strikes the number as plain digits, without a grouping mark', () => {
    /* A separator is a speck of dirt on a disc drawn at 120 pixels. The grouped
       number is in the sentence beside the coin, where it can be read. */
    expect(coinNumber({ value: 1000, art: 'none' })).toBe('1000')
  })

  it('names the period the way a coin names it, and says nothing when there is none', () => {
    expect(periodLegend('month', 2027, 6, inSerbian)).toBe('JUL 2027')
    expect(periodLegend('season', 2027, 0, inSerbian)).toBe('SEZONA 2027')
    expect(periodLegend('always', 2027, 0, inSerbian)).toBe('')
  })

  it('names the twelve months of a coin in Serbian exactly as it always did', () => {
    /* Written out and not read from the dictionary, so that a dictionary which lost a month or moved
       one cannot agree with itself. The nominative, because `Intl` would give the genitive. */
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((month) => periodLegend('month', 2027, month, inSerbian))).toEqual([
      'JANUAR 2027',
      'FEBRUAR 2027',
      'MART 2027',
      'APRIL 2027',
      'MAJ 2027',
      'JUN 2027',
      'JUL 2027',
      'AVGUST 2027',
      'SEPTEMBAR 2027',
      'OKTOBAR 2027',
      'NOVEMBAR 2027',
      'DECEMBAR 2027',
    ])
  })

  it('names them in English, in the words of en-GB (PDL P18, 25.11.2026), and the season too', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((month) => periodLegend('month', 2027, month, inEnglish))).toEqual([
      'JANUARY 2027',
      'FEBRUARY 2027',
      'MARCH 2027',
      'APRIL 2027',
      'MAY 2027',
      'JUNE 2027',
      'JULY 2027',
      'AUGUST 2027',
      'SEPTEMBER 2027',
      'OCTOBER 2027',
      'NOVEMBER 2027',
      'DECEMBER 2027',
    ])
    expect(periodLegend('season', 2027, 0, inEnglish)).toBe('SEASON 2027')
    expect(periodLegend('always', 2027, 0, inEnglish)).toBe('')
  })

  it('draws the legend of a coin in the language it is asked in, on both paths that draw one', () => {
    const family = { ...plain, period: 'month' as const, periodAt: 'bottom' as const }
    const held = { value: 10, tier: 3 as const, season: 2028, month: 7 }

    expect(firstOf(family, 'M', inEnglish).bottom).toBe('JANUARY 2027')
    expect(instanceAt(family, 'M', held, inEnglish).bottom).toBe('JULY 2028')
    expect(instanceAt({ ...family, period: 'season', periodAt: 'top' }, 'M', { ...held, month: null }, inEnglish).top).toBe(
      'SEASON 2028',
    )
  })

  it('does not invent a month it has no name for', () => {
    /* Unreachable through the two callers, both of which count from zero to
       eleven, and present because indexing a list answers `undefined` under
       `noUncheckedIndexedAccess` (ADL A14). Asserted rather than assumed: the
       fallback is what stops a thirteenth month printing "undefined 2027". */
    expect(periodLegend('month', 2027, 12, inSerbian)).toBe(' 2027')
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
    const below = firstOf({ ...plain, period: 'month', periodAt: 'bottom' }, 'M', inSerbian)
    const above = firstOf({ ...plain, period: 'season', periodAt: 'top' }, 'M', inSerbian)

    expect(below.top).toBe('ISTRČANIH')
    expect(below.bottom).toBe('JANUAR 2027')
    expect(above.top).toBe('SEZONA 2027')
    expect(above.bottom).toBe('TRKA')
  })

  it('leaves both legends alone when the family has no period at all', () => {
    const one = firstOf(plain, 'M', inSerbian)

    expect(one.top).toBe('ISTRČANIH')
    expect(one.bottom).toBe('TRKA')
  })

  it('draws the first of a series, at its first threshold and its own value', () => {
    /* A wall that drew every instance would be fifty-five coins in the first
       season and grow by twenty-eight a year (ADL A12, 7). */
    const one = firstOf({ ...plain, step: 100, last: 1000, value: 100, tierUpFrom: 500 }, 'M', inSerbian)

    expect(one.value).toBe(100)
    expect(one.tier).toBe(3)
  })
})

describe('one ducat a member holds, drawn from its family', () => {
  /* Which ducats he holds is the server's since 13.11.2026 (`DucatAwardApi`), and what it sends is the
     family's code, the threshold, the tier it was won at, and the season and month (1 to 12). */
  const always = { value: 10, tier: 3, season: null, month: null } as const

  it('stands for ever, with no period on it, where the record names no season', () => {
    const drawn = instanceAt(plain, 'M', always, inSerbian)

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
      unit: '',
    })
  })

  it('carries the tier the record kept, and not the one the family has today', () => {
    /* A run's tier rises part way and a ducat won at one tier goes on saying it (V91). The family says 3,
       the record says 5, so a coin drawn from the family is a different coin. */
    expect(instanceAt(plain, 'M', { ...always, tier: 5 }, inSerbian).tier).toBe(5)
  })

  it('names the threshold in its identity when the family is a run', () => {
    const drawn = instanceAt({ ...plain, value: 100, step: 100, last: 1000 }, 'M', { ...always, value: 300 }, inSerbian)

    expect(drawn.id).toBe('duk-proba-300')
    expect(drawn.value).toBe(300)
  })

  it('is one season, closed on the last day of its year, with the season where the family puts it', () => {
    const drawn = instanceAt({ ...plain, period: 'season', periodAt: 'top' }, 'M', { ...always, season: 2028 }, inSerbian)

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
    const february = instanceAt(monthly, 'M', { ...always, season: 2028, month: 2 }, inSerbian)

    expect([february.id, february.from, february.to, february.bottom]).toEqual([
      'duk-proba-2028-02',
      '2028-02-01',
      '2028-02-29',
      'FEBRUAR 2028',
    ])
    expect(instanceAt(monthly, 'M', { ...always, season: 2027, month: 2 }, inSerbian).to).toBe('2027-02-28')

    /* The last month is the edge a reading of 0 to 11 falls off. */
    const december = instanceAt(monthly, 'M', { ...always, season: 2027, month: 12 }, inSerbian)

    expect([december.to, december.bottom]).toEqual(['2027-12-31', 'DECEMBAR 2027'])
  })

  it('reads the legend to the member whose profile it is', () => {
    const gendered = { ...plain, top: 'POPEO SE', topFemale: 'POPELA SE' }

    expect(instanceAt(gendered, 'F', always, inSerbian).top).toBe('POPELA SE')
    expect(instanceAt(gendered, 'M', always, inSerbian).top).toBe('POPEO SE')
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

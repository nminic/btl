import { describe, expect, it } from 'vitest'
import { isWhole, parseNumber, storedNumber } from './numberField'

/**
 * WHAT A NUMBER BOX TAKES, AND WHAT LEAVES IT.
 *
 * <p>Owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza"): „Polje za broj
 * prima i zarez i tacku, a portal salje tacku." „21,1" is how a length is written here.
 */
describe('a number as it is typed', () => {
  it('takes the comma and the dot alike, as the separator of the decimals', () => {
    expect(parseNumber('10,55')).toBe(10.55)
    expect(parseNumber('10.55')).toBe(10.55)
    expect(parseNumber('21')).toBe(21)
    expect(parseNumber('  21,1  ')).toBe(21.1)
  })

  /* WHAT THE BROWSER TOOK BEFORE, AND NOTHING MORE. Measured in Chrome on 02.10.2026 over a
     `type="number"` box, which is what decided this until that day: „.5", „1e1" and a sign in
     front stand, „+5", „5." and „0x10" are emptied. The box is text now, and `Number()` reads
     the last three as numbers (sixteen, for „0x10"), so the shape is what keeps them out. */
  it('takes what a browser number box took', () => {
    expect(parseNumber('.5')).toBe(0.5)
    expect(parseNumber(',5')).toBe(0.5)
    expect(parseNumber('1e1')).toBe(10)
    expect(parseNumber('-5')).toBe(-5)
  })

  it('refuses what a browser number box refused, and what is not a number at all', () => {
    for (const written of ['+5', '5.', '5,', '0x10', '1,000.5', '1.2.3', '10 000', 'abc', '', ',']) {
      expect(parseNumber(written), JSON.stringify(written)).toBeNull()
    }
  })

  /* In the shape and still not a number anybody can be told about: too large to be one. */
  it('refuses a number too large to be one', () => {
    expect(parseNumber('1e999')).toBeNull()
  })
})

describe('a whole number as it is written', () => {
  /* Asked of the WRITING, because „1.200" and „1,200" are twelve hundred with a separator for
     the thousands as often as they are one point two, and either reading of them as a value is
     quietly a different climb. */
  it('is digits and nothing else, with a sign where there is one', () => {
    expect(isWhole('1200')).toBe(true)
    expect(isWhole(' 1200 ')).toBe(true)
    expect(isWhole('-5')).toBe(true)

    for (const written of ['1.200', '1,200', '10,0', '1e3', '30,5', '']) {
      expect(isWhole(written), JSON.stringify(written)).toBe(false)
    }
  })
})

describe('a number as it is sent', () => {
  it('carries the dot whichever separator was typed', () => {
    expect(storedNumber('21,1')).toBe('21.1')
    expect(storedNumber('21.1')).toBe('21.1')
    expect(storedNumber('21')).toBe('21')
    expect(storedNumber('')).toBe('')
  })
})

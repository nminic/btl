import { at, first, last, must } from './at'

/* The four helpers that about a hundred and fifty assertions now lean on.
 *
 * They live under `src/test/`, which the coverage report excludes, so nothing
 * else in the project would notice if one of them stopped throwing. That is the
 * one failure that matters here: a helper that quietly hands back `undefined`
 * turns every test using it into a test that cannot fail, all at once and
 * without a word.
 */

describe('at', () => {
  it('hands back the element at that position', () => {
    expect(at(['a', 'b', 'c'], 1)).toBe('b')
  })

  it('throws for a position past the end, saying how long the list was', () => {
    expect(() => at(['a', 'b'], 5)).toThrow('asked for 5 of a list 2 long')
  })

  it('throws for a list that is not there at all', () => {
    expect(() => at(undefined, 0)).toThrow('asked for 0 of a list that is not there')
  })

  it('reads anything with a length, not only an array', () => {
    /* Every screen test hands it a NodeList out of `getAllByRole`. */
    expect(at('trka', 2)).toBe('k')
  })
})

describe('first and last', () => {
  it('take the ends of a list', () => {
    expect(first([10, 20, 30])).toBe(10)
    expect(last([10, 20, 30])).toBe(30)
  })

  it('throw on an empty list rather than hand back nothing', () => {
    expect(() => first([])).toThrow()
    expect(() => last([])).toThrow()
  })
})

describe('must', () => {
  it('hands back what it was given', () => {
    expect(must('Milorad', 'a name')).toBe('Milorad')
  })

  /* The one thing it must not do. Nought points, an empty biography and an
     unticked box are all real answers, and a helper that rejected them would
     turn a passing test red for a value the portal deliberately holds. */
  it.each([[0], [''], [false]])('takes %p, which is a value and not an absence', (value) => {
    expect(must(value, 'a value')).toBe(value)
  })

  it.each([[null], [undefined]])('throws on %p, saying what was looked for', (value) => {
    expect(() => must(value, 'a name on the delete control')).toThrow(
      'there is no a name on the delete control',
    )
  })
})

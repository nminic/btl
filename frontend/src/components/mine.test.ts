import { MINE, mineClass, mineIn, rowClass } from './mine'

/* The mark on the row that belongs to whoever is reading (owner, 05.08.2026).
 *
 * The screens are held in publicScreens.test.tsx, where the mark is read off a
 * rendered table. What is held here is the three answers the helper gives, and
 * in particular the two that no screen can show: a visitor, for whom no row is
 * anybody's, and a row wearing two marks at once.
 */

describe('the row that belongs to the reader', () => {
  it('is the one about them, and only while somebody is reading', () => {
    expect(mineClass('000007', '000007')).toBe(MINE)
    expect(mineClass('000008', '000007')).toBeUndefined()
    /* Nobody signed in. Every row would otherwise be compared against nothing,
       and a member number that is somehow empty would match it. */
    expect(mineClass('000007', null)).toBeUndefined()
    expect(mineClass('', null)).toBeUndefined()
  })

  it('is either of a pair, because a pair is two people', () => {
    expect(mineIn(['000007', '000008'], '000008')).toBe(MINE)
    expect(mineIn(['000007', '000008'], '000009')).toBeUndefined()
    /* A row about nobody, which is what an empty list means. */
    expect(mineIn([], '000007')).toBeUndefined()
  })
})

describe('the marks a row wears', () => {
  it('carries both when a row belongs to the reader and stands on the podium', () => {
    expect(rowClass('podium', MINE)).toBe(`podium ${MINE}`)
  })

  it('carries the one that is there, and no attribute at all where there is none', () => {
    expect(rowClass(undefined, MINE)).toBe(MINE)
    expect(rowClass('podium', undefined)).toBe('podium')
    /* Not an empty string: `class=""` is an attribute that says nothing and is
       still written into the markup. */
    expect(rowClass(undefined, undefined)).toBeUndefined()
    expect(rowClass()).toBeUndefined()
  })
})

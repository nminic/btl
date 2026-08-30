import { describe, expect, it } from 'vitest'
import { fromBoxes, inBoxes } from './clock'

/* A length of time and the three boxes a form asks for it in, asked of the one place
   that answers both ways.

   ADL A31 asks for this: a fact moved into one home gets a guard beside it rather
   than being held only through whoever calls it. Six places called this before it
   existed, and the two decisions it makes were each measured passing a mutation
   while every screen that reads it stayed green. */

describe('a length of time in the boxes a form asks for it in', () => {
  it('splits into hours, minutes and seconds, each into its own box', () => {
    /* Three different numbers, and none of them nought. Twenty four hours leaves the
       minutes and the seconds both nought and 6:30:30 leaves them equal; on either,
       two of the three expressions can be swapped and nothing says so, and both were
       measured passing that swap (30.08.2026). */
    expect(inBoxes(6 * 3600 + 30 * 60 + 45)).toEqual({
      hours: '6',
      minutes: '30',
      seconds: '45',
    })
  })

  it('adds the three back up to the number it started from', () => {
    /* The two directions asked against each other, since that is the whole of what
       this module promises.

       Nothing negative among them: a length of time is never below nought here, and
       the plain arithmetic these three places always used does not answer for one
       (`inBoxes(-90)` gives -1 hours and -2 minutes). Lifting it to nought was in
       the same first draft and went with the rounding, because it answered a
       question nothing asks and no case could hold it. */
    for (const total of [0, 45, 90, 3_600, 23_445, 86_400, 359_999]) {
      expect(fromBoxes(inBoxes(total)), String(total)).toBe(total)
    }
  })

  it('rounds nothing, so a result comes back as it was sent', () => {
    /* Rounding was not here before and was written into a first draft of this. The
       boxes take a decimal, which is a fault of their own and older than this
       module, but a result of 1:01:01,5 has to come back into its own correction as
       the number it was: rounded, the member sends 1:01:02 instead, with different
       points, and nothing on the screen says anything changed.

       Under a second as well, where rounding would swallow the number whole rather
       than shift it. */
    expect(inBoxes(3_661.5).seconds).toBe('1.5')
    expect(fromBoxes(inBoxes(3_661.5))).toBe(3_661.5)
    expect(inBoxes(0.5)).toEqual({ hours: '0', minutes: '0', seconds: '0.5' })
  })

  it('reads a box that is not there as no number at all, rather than as nought', () => {
    /* A form read through an index gives nothing where a field is missing (ADL A14,
       `noUncheckedIndexedAccess`), and a missing time is not a time of nought: the
       formula refuses `NaN` and would have taken a nought as a race run in no time.
       The forms that ask for a time require all three, so this is what happens when
       one is asked of a form that does not have them. */
    expect(fromBoxes({})).toBeNaN()
    expect(fromBoxes({ hours: '1', minutes: '0' })).toBeNaN()
  })
})

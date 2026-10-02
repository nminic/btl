import { describe, expect, it } from 'vitest'
import { fromBoxes, inBoxes, noTime } from './clock'

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
       boxes refuse a separator since 02.10.2026 and the server keeps whole seconds, so
       a fraction should never arrive; but a result of 1:01:01,5 that did would have to
       come back into its own correction as the number it was: rounded, the member
       sends 1:01:02 instead, with different points, and nothing on the screen says
       anything changed.

       Under a second as well, where rounding would swallow the number whole rather
       than shift it. */
    expect(inBoxes(3_661.5).seconds).toBe('1.5')
    expect(fromBoxes(inBoxes(3_661.5))).toBe(3_661.5)
    expect(inBoxes(0.5)).toEqual({ hours: '0', minutes: '0', seconds: '0.5' })
  })

  it('says that all three at nought is no time at all, and that one of them is not', () => {
    /* Owner, 31.08.2026: „Ne sme da se popuni 0:0:0!" Each box is right to take
       nought on its own, since a race of forty five minutes has nought hours, so
       the rule is about the three together and no field definition can hold it.

       Written as „not above nought" rather than „equals nought", so the same
       sentence refuses a missing box and a negative one: every comparison against
       `NaN` is false, and a draft written the other way let both through. */
    expect(noTime({ hours: '0', minutes: '0', seconds: '0' })).toBe(true)
    expect(noTime({ hours: '0', minutes: '45', seconds: '0' })).toBe(false)
    expect(noTime({ hours: '0', minutes: '0', seconds: '1' })).toBe(false)
    expect(noTime({})).toBe(true)
    expect(noTime({ hours: '-1', minutes: '0', seconds: '0' })).toBe(true)
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

  /* A box takes the comma Serbian writes a decimal with since 02.10.2026 (owner: „Polje za
     broj prima i zarez i tacku"), and `noTime` is asked of what was TYPED, while the form is
     still open. Read with `Number()`, 0:0:30,5 was no time at all, and the form refused it
     for having no time over three boxes that held one. */
  it('reads a box written with a comma as the number it is, and an empty box as nought', () => {
    expect(fromBoxes({ hours: '0', minutes: '0', seconds: '30,5' })).toBe(30.5)
    expect(noTime({ hours: '0', minutes: '0', seconds: '30,5' })).toBe(false)
    expect(fromBoxes({ hours: '', minutes: '1', seconds: '0' })).toBe(60)
    expect(fromBoxes({ hours: 'sat', minutes: '1', seconds: '0' })).toBeNaN()
  })
})

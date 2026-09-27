import { describe, expect, it } from 'vitest'
import { closestIn, WHOLE } from '../../components/crop'
import { AS_FINE_AS_THE_COLUMN, asTheColumnHolds, pictureToSend, theRowIn } from './photoWrites'

/**
 * WHAT GOES ON THE WIRE WHEN A MEMBER SENDS HIS PORTRAIT.
 *
 * <p><b>The arithmetic is measured here and the screen is measured in
 * `profilePicture.test.tsx`</b>, which is the split `admin/moderatorWrites.test.ts` and its
 * screen already keep: a question about a number does not need React mounted, and a
 * question about a press does not want the number spelt out beside it.
 */

/**
 * WHAT `MePhotoApi` WILL TAKE, written once as a predicate rather than as a list of
 * expected strings.
 *
 * <p>`MePhotoApi.fraction` parses the text with `BigDecimal` and then asks for
 * `setScale(8, RoundingMode.UNNECESSARY)`, which THROWS where a digit would be lost. So the
 * question is not „is this number close enough" but „can this TEXT be written with eight
 * decimal places and no loss", and that is a question about the spelling.
 *
 * <p>Asked of the text and not of the number, because text is what crosses the wire.
 */
function theColumnCanHold(written: string): boolean {
  const digits = /^\d+(?:\.(\d+))?$/.exec(written)

  return digits !== null && (digits[1]?.length ?? 0) <= AS_FINE_AS_THE_COLUMN
}

/**
 * THE VALUES A SLIDER REALLY HANDS OVER, derived from the portal's own arithmetic rather
 * than typed out.
 *
 * <p>`closestIn` is what the size slider takes as its `min` (`components/CropChooser.tsx`),
 * so every value on that slider is the floor plus some number of steps of `0.01`, and none
 * of those additions is exact in binary. Derived here so that a change to `SMALLEST_PIXELS`
 * or to `closestIn` moves these numbers with it instead of leaving a fixture behind.
 *
 * <p>The shapes are three real ones: a square photograph where the floor comes out round, a
 * portrait off a telephone, and a picture whose floor is round to nobody.
 */
const OFF_A_REAL_SLIDER = [
  { width: 1200, height: 1200 },
  { width: 1080, height: 2400 },
  { width: 1234, height: 1600 },
].flatMap((shape) => [closestIn(shape), closestIn(shape) + 0.01, closestIn(shape) + 0.37])

describe('the three fractions, as fine as the column and no finer', () => {
  it('is measuring something: the raw numbers really are finer than the column', () => {
    /* THE CASE THAT KEEPS THE ONE BELOW HONEST, and it is the half a fixture of round
       numbers would have left out. A crop of `0.5` survives `UNNECESSARY` untouched, so a
       case built on an untouched frame passes whether anything rounds or not.

       Measured rather than claimed: at least one value a real slider hands over is finer
       than the column, and on a square photograph of 1200 pixels - where the floor is
       exactly 0.2 - ONE step of the slider is already seventeen decimal places. */
    const finer = OFF_A_REAL_SLIDER.filter((one) => !theColumnCanHold(String(one)))

    expect(finer.length, `none of ${String(OFF_A_REAL_SLIDER.length)} is finer than the column`)
      .toBeGreaterThan(0)
    /* And the ordinary case is among them, not just the awkward shape: a round floor plus
       one step. */
    expect(theColumnCanHold(String(closestIn({ width: 1200, height: 1200 }) + 0.01))).toBe(false)
  })

  it('writes every one of them so the column can hold it', () => {
    for (const one of OFF_A_REAL_SLIDER) {
      const written = asTheColumnHolds(one)

      expect(theColumnCanHold(written), `${String(one)} became ${written}`).toBe(true)
      /* And it is still the same crop. Eight places move a fraction by at most five in the
         ninth, which on a photograph of 1200 pixels is six millionths of a pixel. A guard
         that only asked about the spelling would pass over a function that wrote `0` every
         time. */
      expect(Math.abs(Number(written) - one)).toBeLessThanOrEqual(5e-9)
    }
  })

  it('keeps the two ends V21 calls legal', () => {
    /* `crop_x` and `crop_y` are `between 0 and 1` and „0 and 1 are legal positions and not
       edge cases" (V21, quoted in `MePhotoApi`), and `crop_diameter` is `> 0 and <= 1`. So
       both ends have to survive the writing: a 1 written as `1.00000001` is refused, and a
       diameter written as `0.00000000` is refused as well. */
    expect(Number(asTheColumnHolds(1))).toBe(1)
    expect(Number(asTheColumnHolds(0))).toBe(0)
    expect(theColumnCanHold(asTheColumnHolds(1))).toBe(true)
    expect(theColumnCanHold(asTheColumnHolds(0))).toBe(true)
  })
})

describe('the body a picture travels in', () => {
  const aFile = () => new File(['bytes of a face'], 'lice.jpg', { type: 'image/jpeg' })

  /* THREE DIFFERENT NUMBERS, AND NONE OF THEM THE DEFAULT. A crop whose three values were
     equal - which `WHOLE` very nearly is - would be satisfied by a body that read `x` into
     all three parts, so the axes are told apart here before anything is asserted. */
  const crop = { x: 0.125, y: 0.875, size: 0.5 }

  it('carries the four parts the route reads, and each from its own axis', () => {
    const body = pictureToSend(aFile(), crop)

    expect(body.get('cropX')).toBe(asTheColumnHolds(0.125))
    expect(body.get('cropY')).toBe(asTheColumnHolds(0.875))
    /* `cropSize` on the wire, `size` in the portal, `crop_diameter` in the column: three
       names for one number, which ADL A17 writes down as the cost of V21 renaming the
       third. Read off `size` and never off either of the other two. */
    expect(body.get('cropSize')).toBe(asTheColumnHolds(0.5))
    /* And the three really are three, so the assertions above cannot be satisfied by one
       value copied into all of them. */
    expect(new Set([body.get('cropX'), body.get('cropY'), body.get('cropSize')]).size).toBe(3)
  })

  it('carries the file itself, not a rendering of it', () => {
    const file = aFile()
    const sent = pictureToSend(file, crop).get('picture')

    /* THE VERY OBJECT THE BROWSER HANDED OVER. `MePhotoApi` decides the type by reading the
       bytes (`WhatAPictureIs.sniff`, ADL A12a), so a data URL turned back into a blob would
       be the same picture arrived at the long way round with a type invented on the way. */
    expect(sent).toBe(file)
  })

  it('carries nothing else at all', () => {
    /* WHAT THE SCREEN HOLDS AND THE ROUTE DOES NOT READ. `Chosen` also carries the name of
       the file and the picture as a data URL; the route has no part for either, and the
       name is the one thing V8 refuses to let near a path. A fifth part would be a value
       sent to a route that never looks at it, which is how a reader comes to believe it
       matters. */
    expect([...pictureToSend(aFile(), crop).keys()].sort()).toEqual([
      'cropSize',
      'cropX',
      'cropY',
      'picture',
    ])
  })

  it('sends an untouched frame as the three numbers that frame really is', () => {
    /* The other state of the crop axis, and it is here so the pair is on the record: a
       member who never moves anything sends `WHOLE`, and all three of its numbers survive
       the writing unchanged. This case passes whether anything rounds or not, which is
       precisely why the first `describe` above exists. */
    const body = pictureToSend(aFile(), WHOLE)

    expect(Number(body.get('cropX'))).toBe(WHOLE.x)
    expect(Number(body.get('cropY'))).toBe(WHOLE.y)
    expect(Number(body.get('cropSize'))).toBe(WHOLE.size)
  })
})

describe('the queue row the answer names', () => {
  /* The key the member's own screen files his wait under, and the SAME key the moderator's
     decision is filed under (`session/context.ts#pictureSent`). The shape of these cases is
     `admin/leagueWrites.test.ts`'s for `identityIn`, because the function is that one's shape
     too: a route that answers with a record answers with its identity, and this side reads it
     off `unknown` rather than asserting it (ADL A14). */
  it('is the number the route filed the picture as', () => {
    expect(theRowIn({ waiting: 2, digest: 'abc', standing: null })).toBe(2)
  })

  it('is nothing where the answer carried no body at all', () => {
    expect(theRowIn(undefined)).toBeNull()
    expect(theRowIn(null)).toBeNull()
    expect(theRowIn('2')).toBeNull()
  })

  it('is nothing where the body names no row, or one of the wrong kind', () => {
    /* `digest` is there and `waiting` is not, which is the one shape a route that had dropped
       the key would really answer with. */
    expect(theRowIn({ digest: 'abc', standing: null })).toBeNull()
    expect(theRowIn({ waiting: '2' })).toBeNull()
    expect(theRowIn({ waiting: 2.5 })).toBeNull()
  })

  it('is nothing for a row number no sequence hands out', () => {
    /* `verification.id` is a `bigserial`, so it starts at one. Nought and below are what a
       route answering about no row at all would send, and a decision must never be filed
       under one. */
    expect(theRowIn({ waiting: 0 })).toBeNull()
    expect(theRowIn({ waiting: -1 })).toBeNull()
  })
})

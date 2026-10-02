import { parseNumber } from './numberField'
import type { FormValues } from './types'

/** The three as they are written back into a form, which is always text. */
export type WrittenBoxes = { hours: string; minutes: string; seconds: string }

/**
 * A length of time as the three boxes a form asks for it in, and back again.
 *
 * Both directions in one place, because they are one fact read two ways and the
 * portal had them written six times over: a result being corrected, a submission
 * being sent again and a timed race handing over its own limit all split the same
 * seconds into the same three boxes, and three screens added them up again, the
 * calculator on the front page among them (ADL A31).
 *
 * **What that cost, measured 30.08.2026.** The splitting of a race's limit was
 * written a third time and its only guard used a limit of twenty four hours, where
 * the minutes and the seconds are both nought and the two expressions cannot be
 * told apart. With them swapped, a race of six and a half hours handed the member
 * 6:00:30, locked, and the formula scored it against 21630 seconds instead of
 * 23400. One home and one guard answer both.
 *
 * Strings, because that is what a form holds: every value in `FormValues` is text,
 * and a number written into one comes back as text anyway.
 */
export function inBoxes(totalSeconds: number): WrittenBoxes {
  /* Nothing is rounded and nothing is lifted to nought. Both were in a first draft
     of this and neither was there before: the three places this replaced did the
     plain arithmetic, so a result of 1:01:01,5 came back into its own correction as
     „1.5" in the seconds box and went out again as the number it was. Rounded, it
     would come back as 2 and the member would send a different result from the one
     they are correcting, with different points. ~~That the boxes take a decimal at all
     is a fault of their own and older than this.~~ The boxes refuse a separator since
     02.10.2026 (`types.ts`, `integer`) and the server keeps whole seconds, so a fraction
     no longer reaches here from either side; nothing is rounded all the same, because a
     fraction that did arrive would be sent back as somebody else's number. */
  return {
    hours: String(Math.floor(totalSeconds / 3600)),
    minutes: String(Math.floor((totalSeconds % 3600) / 60)),
    seconds: String(totalSeconds % 60),
  }
}

/**
 * Whether what stands in the three boxes is no time at all.
 *
 * Each box takes nought on its own and is right to: a race of forty five minutes
 * has nought hours. What no form may take is all three at once (owner,
 * 31.08.2026: „Ne sme da se popuni 0:0:0!"), and no field can hold that rule
 * because it is about the three together.
 *
 * Nought, and everything under it, and a box that is not a number at all: written
 * as „not above nought" rather than „equals nought" so that `NaN` and a negative
 * are refused by the same sentence, since a comparison against `NaN` is false
 * whichever way it is written.
 */
export function noTime(values: FormValues): boolean {
  return !(fromBoxes(values) > 0)
}

/** And the three boxes added up. Every form that asks for a time requires all
 *  three, so there is nothing here to fall back to. */
export function fromBoxes(values: FormValues): number {
  return box(values.hours) * 3600 + box(values.minutes) * 60 + box(values.seconds)
}

/**
 * One box of a time, read the way every number box on the portal is read (`numberField.ts`).
 *
 * <p><b>Through that reader and not through `Number()`, and the reason is a reader that comes
 * BEFORE the form is sent.</b> A box takes a comma since 02.10.2026 (owner: „Polje za broj
 * prima i zarez i tacku"), and `noTime` above is asked of what was typed, while the form is
 * still open (`alsoRefuses` on both forms that report a result). Read with `Number()`, „30,5"
 * seconds is not a number, and a run of 0:0:30,5 was refused as no time at all over boxes the
 * field rules had just let through.
 *
 * <p>An empty box is nought, as `Number('')` always made it; something that is not a number at
 * all is still not one.
 */
function box(value: string | boolean | undefined): number {
  const written = String(value)

  return written.trim() === '' ? 0 : (parseNumber(written) ?? Number.NaN)
}

import type { FormValues } from './types'

/**
 * A length of time as the three boxes a form asks for it in, and back again.
 *
 * Both directions in one place, because they are one fact read two ways and the
 * portal had them written five times over: a result being corrected, a submission
 * being sent again and a timed race handing over its own limit all split the same
 * seconds into the same three boxes, and the two forms that add them up again did
 * that twice more (ADL A31).
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
export function inBoxes(totalSeconds: number): { hours: string; minutes: string; seconds: string } {
  const whole = Math.max(0, Math.round(totalSeconds))

  return {
    hours: String(Math.floor(whole / 3600)),
    minutes: String(Math.floor((whole % 3600) / 60)),
    seconds: String(whole % 60),
  }
}

/** And the three boxes added up. Every form that asks for a time requires all
 *  three, so there is nothing here to fall back to. */
export function fromBoxes(values: FormValues): number {
  return Number(values.hours) * 3600 + Number(values.minutes) * 60 + Number(values.seconds)
}

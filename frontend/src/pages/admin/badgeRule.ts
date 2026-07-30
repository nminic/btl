/* A badge is a rule kept as data, never as code (ADL A12).
 *
 * Everything here is a closed list on purpose. A free text box in which the
 * superadmin writes a condition is the shortest path there is to running
 * arbitrary code on the server, so there is no free text: a quantity from a
 * fixed list, a number, and an optional range of dates.
 *
 * There is no operator at all. The condition is always "at least", greater than
 * or equal to the value given (PDL P16). The choice between "at least" and "more
 * than" differed by exactly one, which nobody could see from the screen, so it
 * was a field that cost a decision and bought nothing.
 *
 * What that choice existed to protect is protected still, because "at least"
 * over a quantity the portal only ever adds to is monotonic: once it is true it
 * stays true, so a badge that has been earned can never be taken away by a later
 * result. That is what makes a rule fit to award something permanent.
 */
export const QUANTITIES = [
  'raceCount',
  'marathonCount',
  'halfCount',
  'longCount',
  'shortCount',
  'ultraCount',
  'totalKm',
  'totalAscent',
  'totalDescent',
  'totalTime',
  'points',
  'countryCount',
  'seasonCount',
] as const

export type Quantity = (typeof QUANTITIES)[number]

export type BadgeRule = {
  quantity: Quantity
  value: number
  from: string
  to: string
}

/** The rule as a sentence, so it can be read back before it is saved. The
 *  sentence carries the "at least" itself, there being nothing else it could
 *  say. */
export function ruleSentence(
  rule: BadgeRule,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const core = t('badges.sentence', {
    quantity: t(`badges.quantity.${rule.quantity}`),
    value: rule.value,
  })

  if (rule.from === '' && rule.to === '') {
    return `${core} ${t('badges.everSince')}`
  }

  if (rule.from !== '' && rule.to !== '') {
    return `${core} ${t('badges.between', { from: rule.from, to: rule.to })}`
  }

  return rule.from !== ''
    ? `${core} ${t('badges.after', { from: rule.from })}`
    : `${core} ${t('badges.before', { to: rule.to })}`
}


/* A badge is a rule kept as data, never as code (ADL A12).
 *
 * Everything here is a closed list on purpose. A free text box in which the
 * superadmin writes a condition is the shortest path there is to running
 * arbitrary code on the server, so there is no free text: a quantity from a
 * fixed list, an operator that can only be "at least" or "more than", a number,
 * and an optional range of dates.
 *
 * Only those two operators, and both monotonic, so a badge once earned can
 * never be taken away by a later result.
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

export const OPERATORS = ['atLeast', 'moreThan'] as const

export type Operator = (typeof OPERATORS)[number]

export type BadgeRule = {
  quantity: Quantity
  operator: Operator
  value: number
  from: string
  to: string
}

/** The rule as a sentence, so it can be read back before it is saved. */
export function ruleSentence(
  rule: BadgeRule,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const core = t('badges.sentence', {
    quantity: t(`badges.quantity.${rule.quantity}`),
    operator: t(`badges.operator.${rule.operator}`),
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


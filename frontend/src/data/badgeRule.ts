import { formatNumber, formatShortDate, wholePeriod } from '../i18n/format'

/* A badge is a rule kept as data, never as code (ADL A12).
 *
 * Everything here is a closed list on purpose. A free text box in which the
 * superadmin writes a condition is the shortest path there is to running
 * arbitrary code on the server, so there is no free text: a kind from a fixed
 * list, a number, and an optional range of dates.
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
 *
 * The field is the kind of the badge, "vrsta" (PDL P28a, 30.07.2026). It used to
 * be "veličina", and the owner asked for "tip" or "kategorija", but both are
 * spoken for in this domain: a category is the length of a race and also the band
 * a competitor runs in, and a type is the type of a race in the data.
 */

/* The last three read one race rather than a whole season: everything above them
 * is a sum that grows all season long, these are the best single result there is.
 * They are monotonic in the same way, because a best never falls. */
export const BADGE_KINDS = [
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
  'bestRacePoints',
  'bestRaceKm',
  'bestRaceAscent',
] as const

export type BadgeKind = (typeof BADGE_KINDS)[number]

export type BadgeRule = {
  kind: BadgeKind
  value: number
  from: string
  to: string
}

/** A badge as it is stored: what it is called, what it says, the short text its
 *  mark carries, and the rule that awards it. The rule half is the closed set
 *  above. The label is the one of them that may be empty: it is a period or a
 *  word under the drawing, "Jul 2027", and a badge that needs none has none. */
export type Badge = BadgeRule & {
  id: string
  name: string
  description: string
  label: string
}

/* What the number in a rule is counted in. Symbols rather than words, so they
 * read the same in every language, and a kind counted in nothing (races,
 * seasons, countries, points) carries an empty one: the name beside it says what
 * is being counted. */
const UNITS: Record<BadgeKind, string> = {
  raceCount: '',
  marathonCount: '',
  halfCount: '',
  longCount: '',
  shortCount: '',
  ultraCount: '',
  totalKm: ' km',
  totalAscent: ' m',
  totalDescent: ' m',
  totalTime: ' h',
  points: '',
  countryCount: '',
  seasonCount: '',
  bestRacePoints: '',
  bestRaceKm: ' km',
  bestRaceAscent: ' m',
}

/** The value as a reader of this language writes it: 1.200, and 42,2 for the
 *  kinds that have a fraction at all, which are the ones measured in kilometres. */
function reading(value: number, locale: string): string {
  return formatNumber(value, locale, Number.isInteger(value) ? 0 : 1)
}

/** The threshold, short enough to stand over the mark of a badge: "42,2 km",
 *  "1.000 m", "25". */
export function thresholdOf(rule: BadgeRule, locale: string): string {
  return `${reading(rule.value, locale)}${UNITS[rule.kind]}`
}

/**
 * The rule as a sentence, so that it can be read back before it is saved, and
 * read by the member who came to find out how a badge is earned. The sentence
 * carries the "at least" itself, there being nothing else it could say.
 *
 * Every date in it is written for the reader, and none of them is an ISO string.
 * They used to be dropped in raw, so a badge on the public badges page read
 * "računato od 2027-07-01 do 2027-07-31", which is both a date nobody in this
 * region writes and the long way of saying "jul 2027" (PDL P28a, 30.07.2026).
 * Where the two ends describe a whole period, the sentence names the period
 * instead of reciting its edges (wholePeriod).
 */
export function ruleSentence(
  rule: BadgeRule,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: string,
): string {
  const core = t('badges.sentence', {
    kind: t(`badges.kind.${rule.kind}`),
    value: reading(rule.value, locale),
  })

  /* No space between the two halves: every one of the five endings starts with
     the comma that joins it to the sentence, and a space in front of a comma is
     a mistake a reader sees before they read the words. It was invisible while
     the sentence only stood in the panel; it stands in front of members now.
     The full stop belongs to the ending too, and one of the five leaves it out:
     a whole period ends the Serbian sentence with a date, and every Serbian date
     already carries the stop that makes it an ordinal ("jul 2027.", "2027.").
     Which is why punctuation lives in the dictionary rather than here. */
  if (rule.from === '' && rule.to === '') {
    return `${core}${t('badges.everSince')}`
  }

  if (rule.from !== '' && rule.to !== '') {
    const period = wholePeriod(rule.from, rule.to, locale)

    return period === null
      ? `${core}${t('badges.between', {
          from: formatShortDate(rule.from, locale),
          to: formatShortDate(rule.to, locale),
        })}`
      : `${core}${t('badges.during', { period })}`
  }

  return rule.from !== ''
    ? `${core}${t('badges.after', { from: formatShortDate(rule.from, locale) })}`
    : `${core}${t('badges.before', { to: formatShortDate(rule.to, locale) })}`
}

import { formatNumber } from '../i18n/format'
import type { Gender } from './types'

/* A ducat is a rule kept as data, never as code (ADL A12).
 *
 * Everything here is a closed list on purpose. There is no free text anywhere: a
 * kind from a fixed list, a number, a period, and the two legends the coin
 * carries. The owner closed the list itself on 10.08.2026 and took the editor
 * out of the administration, so nobody types a condition anywhere any more
 * (PDL P16).
 *
 * There is no operator at all. The condition is always "at least", greater than
 * or equal to the value given. What that protects is protected still, because
 * "at least" over a quantity the portal only ever adds to is monotonic: once it
 * is true it stays true, so a ducat that has been earned can never be taken away
 * by a later result.
 *
 * Two axes of repetition, and they are not the same thing:
 *
 *   a period series   one ducat per month or per season, same threshold
 *                     (125 km in July, 125 km in August, and so on for ever)
 *   a threshold series  one ducat per step of the number, no period at all
 *                     (100 races, 200 races, up to 1000)
 *
 * A family is what the rulebook shows and what this file stores. An instance is
 * one ducat a member can actually hold, and `instancesOf` is the only place the
 * two are joined.
 */

export const DUCAT_KINDS = [
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

export type DucatKind = (typeof DUCAT_KINDS)[number]

/** The small mark at nine and at three o'clock, which says what is being
 *  counted without saying how much. One per kind of quantity, not one per
 *  family, so a wall of ducats reads as a set with seven signs in it. */
export const DUCAT_MARKS = [
  'distance',
  'time',
  'points',
  'races',
  'vertical',
  'club',
  'countries',
] as const

export type DucatMark = (typeof DUCAT_MARKS)[number]

/** What stands in the middle when a number would say less than a drawing.
 *  Exactly two families have one, and they are the two whose threshold is a
 *  place rather than a score (PDL P16). */
export const DUCAT_ARTS = ['none', 'galaxy', 'globe'] as const

export type DucatArtName = (typeof DUCAT_ARTS)[number]

/** How a family repeats through time. */
export const DUCAT_PERIODS = ['always', 'month', 'season'] as const

export type DucatPeriod = (typeof DUCAT_PERIODS)[number]

/** One to five, low to high, exactly as the owner ranked them on 10.08.2026.
 *  Drawn as metal rather than as an ornament, because colour is the only signal
 *  that still reads at the smallest size a ducat is drawn at. */
export type DucatTier = 1 | 2 | 3 | 4 | 5

/** The first season anything is counted for, for the families that go by month
 *  or by season. The rest read every race on a profile, including the ones run
 *  before the league existed (PDL P16). */
export const FIRST_SEASON = 2027

export type DucatFamily = {
  id: string
  /** A couple of words, never a number: what the ducat is about, under the coin. */
  name: string
  kind: DucatKind
  /** The threshold, or the first threshold when the family is a series. */
  value: number
  /** How it repeats through time. */
  period: DucatPeriod
  /** The legend along the top of the coin. Empty when the period stands there. */
  top: string
  /** The same legend for a woman, empty when the wording does not change. */
  topFemale: string
  /** The legend along the bottom. Empty when the period stands there. */
  bottom: string
  /** Which of the two legends the period takes. */
  periodAt: 'top' | 'bottom' | 'none'
  mark: DucatMark
  art: DucatArtName
  tier: DucatTier
  /** How much the threshold grows per step, 0 when the family is one ducat. */
  step: number
  /** The last threshold of a threshold series, 0 when there is none. */
  last: number
  /** The threshold from which the series is worth one tier more, 0 when never. */
  tierUpFrom: number
}

/** One ducat a member can hold: a family with its period and its threshold
 *  settled, and its legends already written for the reader. */
export type Ducat = {
  id: string
  name: string
  kind: DucatKind
  value: number
  /** Inclusive, empty when open. The date of the race decides, never the date
   *  the result was entered (ADL A12, 2c). */
  from: string
  to: string
  tier: DucatTier
  mark: DucatMark
  art: DucatArtName
  top: string
  bottom: string
}

/* What the number in the middle is counted in, when it is counted in anything.
 * Races, seasons, countries and points carry none: the legend under them says
 * what is being counted, and a coin that says both is a coin that stutters. */
const UNITS: Partial<Record<DucatKind, string>> = {
  totalKm: 'km',
  totalTime: 'sati',
  totalAscent: 'm',
  totalDescent: 'm',
  bestRaceKm: 'km',
  bestRaceAscent: 'm',
}

export function unitOf(ducat: Pick<Ducat, 'kind' | 'art'>): string {
  return ducat.art === 'none' ? (UNITS[ducat.kind] ?? '') : ''
}

/** The threshold as it is struck into the coin: plain digits, no grouping.
 *
 *  A grouping separator is a speck of dirt on a disc drawn at 120 pixels, and
 *  the number on a struck coin has never carried one. The grouped, localised
 *  number is in the sentence beside it, where a reader who wants to be sure
 *  reads it. */
export function coinNumber(ducat: Pick<Ducat, 'value' | 'art'>): string {
  return ducat.art === 'none' ? String(ducat.value) : ''
}

/** The months, upper case, as they stand on a coin. Not `Intl`: this is a
 *  legend struck in one language at a time, and `Intl` in Serbian yields the
 *  genitive ("januara") which is a caption and not an inscription. */
const MONTHS = [
  'JANUAR',
  'FEBRUAR',
  'MART',
  'APRIL',
  'MAJ',
  'JUN',
  'JUL',
  'AVGUST',
  'SEPTEMBAR',
  'OKTOBAR',
  'NOVEMBAR',
  'DECEMBAR',
]

/** The legend that names the period of one instance: "JUL 2027", "SEZONA 2027",
 *  and nothing at all for a family that runs through the whole history. */
export function periodLegend(period: DucatPeriod, season: number, month: number): string {
  if (period === 'month') {
    return `${MONTHS[month] ?? ''} ${season}`
  }

  return period === 'season' ? `SEZONA ${season}` : ''
}

/** Which of the two legends a woman reads differently. Three families do
 *  (PDL P16); for the rest the two are the same string. */
export function topFor(family: DucatFamily, gender: Gender): string {
  return gender === 'F' && family.topFemale !== '' ? family.topFemale : family.top
}

/** Two digits, because a date is a date and `2027-1-1` is not one. */
function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** The last day of a month, which February makes worth writing down once. */
function lastDay(season: number, month: number): number {
  return new Date(Date.UTC(season, month + 1, 0)).getUTCDate()
}

/**
 * Every ducat of one family that exists by the day given: the periods that have
 * begun, times the thresholds of the series.
 *
 * The list is worked out rather than stored, because it grows by itself: two
 * ducats a month and four a season, for ever. A table somebody fills in would
 * mean twenty-eight rows typed every first of January, and a portal that lies
 * about what can be won until somebody remembers to type them (ADL A12, 7).
 */
export function instancesOf(family: DucatFamily, today: string, gender: Gender): Ducat[] {
  const out: Ducat[] = []
  const thisSeason = Number(today.slice(0, 4))
  const thisMonth = Number(today.slice(5, 7)) - 1
  const top = topFor(family, gender)

  const thresholds: number[] = []
  for (
    let value = family.value;
    value <= (family.step > 0 ? family.last : family.value);
    value += family.step > 0 ? family.step : 1
  ) {
    thresholds.push(value)
  }

  const add = (from: string, to: string, legend: string, suffix: string) => {
    for (const value of thresholds) {
      out.push({
        id: `${family.id}${suffix}${family.step > 0 ? `-${value}` : ''}`,
        name: family.name,
        kind: family.kind,
        value,
        from,
        to,
        tier: tierOf(family, value),
        mark: family.mark,
        art: family.art,
        top: family.periodAt === 'top' ? legend : top,
        bottom: family.periodAt === 'bottom' ? legend : family.bottom,
      })
    }
  }

  if (family.period === 'always') {
    add('', '', '', '')

    return out
  }

  for (let season = FIRST_SEASON; season <= thisSeason; season += 1) {
    if (family.period === 'season') {
      add(
        `${season}-01-01`,
        `${season}-12-31`,
        periodLegend('season', season, 0),
        `-${season}`,
      )
      continue
    }

    const until = season === thisSeason ? thisMonth : 11
    for (let month = 0; month <= until; month += 1) {
      add(
        `${season}-${twoDigits(month + 1)}-01`,
        `${season}-${twoDigits(month + 1)}-${twoDigits(lastDay(season, month))}`,
        periodLegend('month', season, month),
        `-${season}-${twoDigits(month + 1)}`,
      )
    }
  }

  return out
}

/** The value of one ducat of a family: the family's own, one higher from the
 *  threshold at which the owner said the series stops being ordinary. */
export function tierOf(family: DucatFamily, value: number): DucatTier {
  const stepped = family.tierUpFrom > 0 && value >= family.tierUpFrom

  return (stepped ? Math.min(5, family.tier + 1) : family.tier) as DucatTier
}

/** The one instance the rulebook draws for a family: the first of them, which
 *  for a series is the first month and the first step. A wall that drew every
 *  instance would be fifty-five coins in the first season and grow by
 *  twenty-eight a year (ADL A12, 7). */
export function firstOf(family: DucatFamily, gender: Gender): Ducat {
  const legend = periodLegend(family.period, FIRST_SEASON, 0)
  const top = topFor(family, gender)

  return {
    id: family.id,
    name: family.name,
    kind: family.kind,
    value: family.value,
    from: '',
    to: '',
    tier: family.tier,
    mark: family.mark,
    art: family.art,
    top: family.periodAt === 'top' ? legend : top,
    bottom: family.periodAt === 'bottom' ? legend : family.bottom,
  }
}

/**
 * The rule as a sentence, for the member who came to find out how a ducat is
 * earned. It carries the "at least" itself, there being nothing else it could
 * say, and it is the accessible description of the coin at all times, whether or
 * not the hint is drawn.
 *
 * Written from the family rather than from an instance, because the question is
 * about the rule and not about July.
 */
export function ruleSentence(
  family: DucatFamily,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: string,
): string {
  const core = t('ducats.sentence', {
    kind: t(`ducats.kind.${family.kind}`),
    value: formatNumber(family.value, locale, 0),
  })

  const when =
    family.period === 'month'
      ? t('ducats.everyMonth', { season: FIRST_SEASON })
      : family.period === 'season'
        ? t('ducats.everySeason', { season: FIRST_SEASON })
        : t('ducats.ever')

  const again =
    family.step > 0
      ? t('ducats.again', {
          step: formatNumber(family.step, locale, 0),
          last: formatNumber(family.last, locale, 0),
        })
      : ''

  return `${core}${when}${again}`
}

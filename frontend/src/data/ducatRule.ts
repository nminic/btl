import type { Translate } from '../i18n/context'
import { formatNumber } from '../i18n/format'
import { FIRST_SEASON } from './season'
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
 * one ducat a member can actually hold. Which instances a family makes, and which
 * of them a member holds, is the server's since 13.11.2026 (`DucatInstances`,
 * `DucatAwardApi`); `instanceAt` is the only place this side joins a family to one
 * ducat it is told he holds.
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
 *  family, so a wall of ducats reads as a set with seven signs in it.
 *
 *  A union rather than a list, unlike the kinds below it: nothing reads these at
 *  run time, and a list nobody reads is a list that only looks like a contract. */
export type DucatMark =
  | 'distance'
  | 'time'
  | 'points'
  | 'races'
  | 'vertical'
  | 'club'
  | 'countries'

/** What stands in the middle when a number would say less than a drawing.
 *  Exactly two families have one, and they are the two whose threshold is a
 *  place rather than a score (PDL P16). */
export type DucatArtName = 'none' | 'galaxy' | 'globe'

/** How a family repeats through time. */
export type DucatPeriod = 'always' | 'month' | 'season'

/** One to five, low to high, exactly as the owner ranked them on 10.08.2026.
 *  Drawn as metal rather than as an ornament, because colour is the only signal
 *  that still reads at the smallest size a ducat is drawn at. */
export type DucatTier = 1 | 2 | 3 | 4 | 5

/* The first season the families that go by month or by season count anything
   for. The rest read every race on a profile, including the ones run before the
   league existed (PDL P16). The year itself is the league's and lives with the
   league's own dates (data/season.ts), because a second rule reads it too. */

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
  /** What the step of a series is counted in, in the case a number puts it in:
   *  "trka", "država". Empty for a family that is one ducat. Serbian counts
   *  with the noun and "na svakih 100, do 1.000" is half a sentence. */
  counted: string
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
  /** What the number is counted in, written for the reader, empty where the coin carries a drawing. */
  unit: string
}

/* What the number in the middle is counted in, when it is counted in anything.
 * Races, seasons, countries and points carry none: the legend under them says
 * what is being counted, and a coin that says both is a coin that stutters. */
const UNITS: Partial<Record<DucatKind, 'km' | 'm' | 'hours'>> = {
  totalKm: 'km',
  totalTime: 'hours',
  totalAscent: 'm',
  totalDescent: 'm',
  bestRaceKm: 'km',
  bestRaceAscent: 'm',
}

/** What a quantity is measured in, whatever is drawn, in the language of the reader (`ducats.coin.unit`,
 *  PDL P18, 25.11.2026). The kilometre and the metre are the same two letters in both languages and are
 *  asked of the dictionary all the same, so that no unit of a coin is written anywhere else. */
export function unitFor(kind: DucatKind, t: Translate): string {
  const unit = UNITS[kind]

  return unit === undefined ? '' : t(`ducats.coin.unit.${unit}`)
}

/** The same, for the coin: a ducat that carries a drawing instead of a number
 *  has nothing for a unit to stand under, and a drawing with a unit floating
 *  below it is a drawing with a caption. */
export function unitOf(ducat: Pick<Ducat, 'kind' | 'art'>, t: Translate): string {
  return ducat.art === 'none' ? unitFor(ducat.kind, t) : ''
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

/** The legend that names the period of one instance: "JUL 2027" and "SEZONA 2027" on `/sr`, "JULY 2027" and
 *  "SEASON 2027" on `/en`, and nothing at all for a family that runs through the whole history.
 *
 *  Written in the reader's language through the dictionary (`ducats.coin`), as every other text of the
 *  portal is, and not by a machine: it is a closed set of thirteen words and a year, and the machine pass
 *  never reads a ducat (PDL P18, 25.11.2026).
 *
 *  **Not `Intl`, for the months:** this is a legend struck in one language at a time, and `Intl` in Serbian
 *  yields the genitive ("januara") which is a caption and not an inscription. The Serbian months are
 *  therefore the nominative, upper case, exactly as they stood in this file before they moved. */
export function periodLegend(period: DucatPeriod, season: number, month: number, t: Translate): string {
  if (period === 'month') {
    const named = month >= 0 && month <= 11 ? t(`ducats.coin.month.${String(month + 1)}`) : ''

    return `${named} ${String(season)}`
  }

  return period === 'season' ? t('ducats.coin.season', { season: String(season) }) : ''
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
 * ONE DUCAT A MEMBER HOLDS, drawn from its family and from where it stands in it: the threshold he
 * crossed, what it was worth when he crossed it, and the season and the month of a ducat of a period.
 *
 * Which ducats he holds is the server's (`DucatAwardApi`, the record `ducat_award` that verification
 * writes), and so is the list of instances a family makes (`DucatInstances`, ADL A12, 7). Until
 * 13.11.2026 this side worked both out again on every draw (`instancesOf`, `data/ducatEarned.ts`); now
 * it only draws. **The tier is the one the record keeps and is not worked out again here**: a run's tier
 * rises part way (`tierUpFrom`), and a ducat won at one tier goes on saying it after the definition is
 * rewritten (V91, A36 O13).
 *
 * `month` is 1 to 12 as the server keeps it, and both are empty for a ducat of all time
 * (`ducat_award_a_period_says_its_season`, `ducat_award_only_a_month_says_its_month`, V15). The
 * identity is the one `instancesOf` gave the same ducat, so the wall's keys did not change with it.
 */
export function instanceAt(
  family: DucatFamily,
  gender: Gender,
  held: { value: number; tier: DucatTier; season: number | null; month: number | null },
  t: Translate,
): Ducat {
  const top = topFor(family, gender)
  const drawn = (from: string, to: string, legend: string, suffix: string): Ducat => ({
    id: `${family.id}${suffix}${family.step > 0 ? `-${String(held.value)}` : ''}`,
    name: family.name,
    kind: family.kind,
    value: held.value,
    from,
    to,
    tier: held.tier,
    mark: family.mark,
    art: family.art,
    top: family.periodAt === 'top' ? legend : top,
    bottom: family.periodAt === 'bottom' ? legend : family.bottom,
    unit: unitOf({ kind: family.kind, art: family.art }, t),
  })
  const { season, month } = held

  if (season === null) {
    return drawn('', '', '', '')
  }

  if (month === null) {
    return drawn(`${String(season)}-01-01`, `${String(season)}-12-31`, periodLegend('season', season, 0, t), `-${String(season)}`)
  }

  const mm = twoDigits(month)

  return drawn(
    `${String(season)}-${mm}-01`,
    `${String(season)}-${mm}-${twoDigits(lastDay(season, month - 1))}`,
    periodLegend('month', season, month - 1, t),
    `-${String(season)}-${mm}`,
  )
}

/** The one instance the rulebook draws for a family: the first of them, which
 *  for a series is the first month and the first step. A wall that drew every
 *  instance would be fifty-five coins in the first season and grow by
 *  twenty-eight a year (ADL A12, 7). */
export function firstOf(family: DucatFamily, gender: Gender, t: Translate): Ducat {
  const legend = periodLegend(family.period, FIRST_SEASON, 0, t)
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
    unit: unitOf({ kind: family.kind, art: family.art }, t),
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
          counted: family.counted,
        })
      : ''

  /* A series is not worth the same all the way along: from the threshold the
     owner set, the rest of it is one value higher (PDL P16). The wall draws the
     first of the family, so this sentence is the only place that says so. */
  const higher =
    family.tierUpFrom > 0
      ? t('ducats.stepUp', {
          upFrom: formatNumber(family.tierUpFrom, locale, 0),
          counted: family.counted,
        })
      : ''

  return `${core}${when}${again}${higher}`
}

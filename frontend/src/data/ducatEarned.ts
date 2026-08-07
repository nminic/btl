import type { Ducat, DucatKind } from './ducatRule'
import { resultsOf, seasonOf } from './derive'
import type { Competitor, Result } from './types'

/* Which ducats a competitor has actually won.
 *
 * The rule is data and is interpreted, never executed (ADL A12): the kinds are a
 * closed list, the comparison is always "at least", and the period is any range
 * of dates with either end open. So this measures the quantity a kind names over
 * the results inside the period, and compares.
 *
 * Counted from the results themselves rather than from a stored tally, because
 * the period is arbitrary: 15 July to 20 August lines up with no month and no
 * season, so buckets by month could only ever be an optimisation and never the
 * source (ADL A12, 2b). What counts is the date of the race, not the date the
 * result was entered (2c).
 *
 * **What this cannot do, and the backend must.** A ducat already won is never
 * taken away and carries a snapshot of the rule that was in force when it was
 * given (ADL A12, 4), and it is awarded when a result is verified rather than
 * whenever a profile is drawn (rule 6). Neither is possible without somewhere to
 * write the award down, so here the answer is worked out again on every draw:
 * an administrator who raises a ducat's threshold takes that ducat off every
 * profile that held it, which is exactly what P16 forbids. Nothing a competitor
 * does can lose them one, because every quantity is a sum or a maximum over
 * races that have happened; only an edit to the rule can. Recorded in the
 * decision log as owed to the database.
 */

/** Whether a race falls inside the ducat's period. Either end may be empty,
 *  which is what an open-ended period is. */
function inPeriod(result: Result, from: string, to: string): boolean {
  return (from === '' || result.date >= from) && (to === '' || result.date <= to)
}

/**
 * The quantity a kind names, over the races given.
 *
 * One function for all sixteen, so a seventeenth is a line here rather than a
 * screen anywhere. The three that end in "best" are a maximum over one race; the
 * rest are sums or counts.
 */
export function quantityOf(kind: DucatKind, races: Result[]): number {
  const count = (of: string) => races.filter((one) => one.category === of).length
  const sum = (pick: (one: Result) => number) => races.reduce((all, one) => all + pick(one), 0)
  const best = (pick: (one: Result) => number) =>
    races.reduce((most, one) => Math.max(most, pick(one)), 0)

  const answers: Record<DucatKind, () => number> = {
    raceCount: () => races.length,
    marathonCount: () => count('marathon'),
    halfCount: () => count('half'),
    longCount: () => count('long'),
    shortCount: () => count('short'),
    ultraCount: () => count('ultra'),
    totalKm: () => sum((one) => one.distanceKm),
    totalAscent: () => sum((one) => one.ascentM),
    totalDescent: () => sum((one) => one.descentM),
    // Hours, because that is what the threshold of a time ducat is written in.
    totalTime: () => sum((one) => one.seconds) / 3600,
    points: () => sum((one) => one.points),
    /* A result does not carry the country; the event it belongs to does, and
       the profile does not load the events. Until it does, the ducats of this
       kind are measured against nothing and nobody earns one, which is the safe
       way round: a ducat is never taken away once given (ADL A12, 4), so one
       given wrongly is given for ever. */
    countryCount: () => 0,
    seasonCount: () => new Set(races.map(seasonOf)).size,
    bestRacePoints: () => best((one) => one.points),
    bestRaceKm: () => best((one) => one.distanceKm),
    bestRaceAscent: () => best((one) => one.ascentM),
  }

  return answers[kind]()
}

/** Every ducat this competitor has earned, in the order the ducats are defined,
 *  which is the order the public catalogue lists them in. */
export function earnedDucats(
  competitor: Competitor,
  results: Result[],
  ducats: Ducat[],
): Ducat[] {
  const mine = resultsOf(results, competitor.memberNumber)

  return ducats.filter((ducat) => {
    const inside = mine.filter((one) => inPeriod(one, ducat.from, ducat.to))

    return quantityOf(ducat.kind, inside) >= ducat.value
  })
}

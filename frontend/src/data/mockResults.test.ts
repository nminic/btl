import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SEASON } from './pricing'
import { btlPoints } from './scoring'

/* The results the prototype is filled with, held to what a result can be.
 *
 * These are the owner's own thirty years of racing, with the names replaced.
 * They are worth holding because a screen is built around what they contain: the
 * columns of the table on a profile are pinned to the widest value the league can
 * ever show (pages/Profile.css, owner 12.08.2026), and a row that is impossible
 * makes those widths a lie without anybody noticing.
 *
 * One such row was found on 12.08.2026, by a reviewer measuring a column rather
 * than by anything here: a half marathon entered as 211 kilometres instead of
 * 21,10, run in an hour and forty nine minutes, which is a hundred and fifteen
 * kilometres an hour and twenty one thousand points. It went through the source
 * data, the generator and every screen, and it broke the table on a telephone.
 */

type Result = {
  id: string
  raceId: string
  distanceKm: number
  ascentM: number
  descentM: number
  seconds: number
  points: number
}

const results = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/results.json'), 'utf-8'),
) as Result[]

type Race = { id: string; date: string; distanceKm: number }

const races = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/races.json'), 'utf-8'),
) as Race[]

/**
 * How long the rest of a field took, on average.
 *
 * An average and not a middle: a middle is read out of a sorted list by index,
 * and an index into a list is a value that might not be there, so the two
 * fallbacks written for it were branches nothing could take (ADL A14). What a
 * mean is usually bad at does not apply here, because the row being looked at is
 * not in the field it is measured against.
 */
function restTook(field: Result[]): number {
  return field.reduce((sum, one) => sum + one.seconds, 0) / field.length
}

/**
 * Nobody runs a race at this speed.
 *
 * Twenty two, not thirty. The marathon record is a shade over twenty one an hour
 * and the fastest honest row in all three thousand five hundred is 18,46, over a
 * cross country mile and a half. Set at thirty, the guard sat above the one
 * impossible row still in the data and caught nothing at all, which is a test
 * written for a fault and set just out of its reach.
 */
const FASTEST_KMH = 22

/* Two rows were named here on 12.08.2026 as impossible and unfixable from the
   data: a marathon at 26,88 kilometres an hour and two kilometres walked at one.
   The owner answered the same day, and the answer was the one thing the data
   could not say: both were half marathons, 21,10 kilometres, and the times were
   right all along. Corrected in the source and in the mock, so there is nothing
   left to except and no list to keep. */


describe('the results the prototype is filled with', () => {
  it('holds nothing that was run faster than a person can run', () => {
    const impossible = results
      .filter((one) => one.seconds > 0)
      .map((one) => ({ id: one.id, kmh: one.distanceKm / (one.seconds / 3600) }))
      .filter((one) => one.kmh > FASTEST_KMH)

    expect(impossible).toEqual([])
  })

  it('scores every result by the formula, to the second decimal', () => {
    /* Which is what turns a wrong distance into a wrong number of points, and
       what makes a corrected distance safe to correct: the points follow from
       the row and are not a figure typed beside it.

       Equal and not „within a hundredth": both sides are already rounded to two
       places, so anything else is a tolerance, and a tolerance written as
       `> 0.01` is not even the tolerance it looks like. 186,42 against 186,41
       came out as 0,009999999999990905 and passed, while 11,89 against 11,88
       did not: the same one cent, caught at one end of the list and let through
       at the other. */
    const scored = results.map((one) => ({
      id: one.id,
      written: one.points,
      due: btlPoints(one.distanceKm, one.ascentM, one.descentM, one.seconds),
    }))

    /* Every row can be scored at all: a length, a time, and no climb entered as
       a negative number, which is the whole of what the formula refuses
       (data/scoring.ts). Asked first, so that what follows needs no fallback for
       an answer that cannot come. */
    expect(scored.filter((one) => one.due === null).map((one) => one.id)).toEqual([])

    const wrong = scored.filter(
      (one) => one.due !== null && one.written !== Math.round(one.due * 100) / 100,
    )

    expect(wrong).toEqual([])
  })

  it('holds nothing that took many times longer than the same race took everybody else', () => {
    /* The other half of „impossible", and the half a speed alone cannot see: a
       vertical race really is walked at two kilometres an hour and a hundred hour
       ultra really is slower still, so a floor written as a speed either lets a
       walking pace through or calls a mountain race a fault.

       Against the race rather than against a number, then: whoever else ran that
       same distance on that same day is the measure. Three finishers at least, so
       that no field is judged by one other runner alone, and three times how long
       the rest of them took, which is far past anything a field spreads over.

       It found one row when it was written, seven and a half times the rest of
       its field: two kilometres walked in an hour and fifty six, which the owner
       then said was a half marathon (12.08.2026). Nothing is over the line now,
       and nothing comes near it: the widest gap left in three and a half thousand
       rows is 1,98 times, and the fast side is clear down to a factor of 2,5:
       at 2,2 it would find `res-00461`, who ran a mountain race in 1860 seconds
       where the other three took 4329 apiece, which is a real gap and not a
       fault. */
    const byRace = new Map<string, Result[]>()

    for (const one of results.filter((row) => row.seconds > 0)) {
      byRace.set(one.raceId, [...(byRace.get(one.raceId) ?? []), one])
    }

    const adrift = [...byRace.values()]
      .filter((field) => field.length >= 3)
      .flatMap((field) =>
        field
          .filter((one) => one.seconds > 3 * restTook(field.filter((other) => other !== one)))
          .map((one) => one.id),
      )

    expect(adrift).toEqual([])
  })

  it('holds no result worth more points than the profile has room for', () => {
    /* Owner, 12.08.2026: „a bodovi do 200,00." The column on a profile is pinned
       to exactly that, so a result above it does not merely look odd, it pushes
       the table sideways on a telephone. */
    const tooMany = results.filter((one) => one.points > 200).map((one) => one.id)

    expect(tooMany).toEqual([])
  })

  it('runs every result in a race that exists and says the same length', () => {
    /* The half that was missed when the 211 kilometre row was corrected: the
       result was mended and the race it points at was not, so a race nobody ran
       stood on the public page of that event with no finishers, and the one
       result on the portal whose length disagreed with its own race was the one
       just corrected.

       The length and nothing else. Twenty one results disagree with their race
       about the climb, and a hundred and sixty one are dated six years apart from
       it: every one of those is a result of 2026 pointing at a race of 2020, the
       generator's own copies of an old season into the one before this. Both are
       older than any of this and neither is what the correction could have
       broken. */
    const byId = new Map(races.map((one) => [one.id, one]))
    const adrift = results
      .map((one) => ({ id: one.id, race: byId.get(one.raceId), km: one.distanceKm }))
      .filter((one) => one.race === undefined || Math.abs(one.race.distanceKm - one.km) > 0.001)
      .map((one) => one.id)

    expect(adrift).toEqual([])
  })

  it('leaves no run race standing that nobody finished', () => {
    /* A race in the past with no result is a distance an event page advertises
       and no member ever finished. The generator makes one race per distance
       somebody ran, so an empty one there means a result moved away and left the
       race behind, which is exactly what the 211 kilometre correction did.

       The coming season is another matter: forty six races of 2027 are on the
       calendar and nobody has run any of them yet, which is what a calendar is
       for. */
    const run = new Set(results.map((one) => one.raceId))
    const empty = races
      .filter((one) => one.date < `${SEASON}-01-01` && !run.has(one.id))
      .map((one) => one.id)

    expect(empty).toEqual([])
  })

  it('holds no race longer than the profile has room for', () => {
    /* And the same for the length, which is pinned to „1000,00 km ako zatreba". */
    const tooFar = results.filter((one) => one.distanceKm > 1000).map((one) => one.id)

    expect(tooFar).toEqual([])
  })
})

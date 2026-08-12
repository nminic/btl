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

/** The points a row is due, rounded the way the portal writes them. Written out
 *  because the rows are already filtered to what can be scored, and a fallback
 *  for the answer that cannot come back would be a branch nothing can take
 *  (ADL A14). */
function scoredTo(places: number, one: Result): number {
  const points = btlPoints(one.distanceKm, one.ascentM, one.descentM, one.seconds)
  const step = 10 ** places

  return Math.round((points === null ? 0 : points) * step) / step
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

/**
 * The one row that is impossible and cannot be corrected from here.
 *
 * `mirko-vojinovic`, Amsterdam marathon, 20.10.2019: 42,20 kilometres in
 * 1:34:11, which is 26,88 an hour. The distance and the climb agree with the
 * other finisher of that race, so the time is what is wrong, and the scrape it
 * came from says the same 1:34:11: there is nothing in the data to correct it
 * against. His four other marathons run between 3:36:11 and 3:51:35, so 3:34:11
 * is the likely reading, but a likely reading is not a record and this is the
 * owner's own racing history. It waits on him.
 *
 * Named here rather than left under a generous threshold, so that it is one row
 * anybody can see and not a hole the whole guard falls through.
 */
const WAITING_ON_THE_OWNER = ['res-02135']

describe('the results the prototype is filled with', () => {
  it('holds nothing that was run faster than a person can run', () => {
    const impossible = results
      .filter((one) => one.seconds > 0 && !WAITING_ON_THE_OWNER.includes(one.id))
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
    const wrong = results
      .filter((one) => one.seconds > 0 && one.distanceKm > 0)
      .map((one) => ({
        id: one.id,
        written: one.points,
        due: scoredTo(2, one),
      }))
      .filter((one) => one.written !== one.due)

    expect(wrong).toEqual([])
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
       just corrected. A result and its race are two files and one fact. */
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

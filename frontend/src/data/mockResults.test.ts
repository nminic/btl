import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  distanceKm: number
  ascentM: number
  descentM: number
  seconds: number
  points: number
}

const results = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/results.json'), 'utf-8'),
) as Result[]

/** Nobody runs a race at this speed. Set high on purpose: the fault this catches
 *  is a decimal point in the wrong place, which is out by a factor of ten. */
const FASTEST_KMH = 30

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
       the row and are not a figure typed beside it. */
    const wrong = results
      .filter((one) => one.seconds > 0 && one.distanceKm > 0)
      .map((one) => ({
        id: one.id,
        written: one.points,
        due: Math.round((btlPoints(one.distanceKm, one.ascentM, one.descentM, one.seconds) ?? 0) * 100) / 100,
      }))
      .filter((one) => Math.abs(one.written - one.due) > 0.01)

    expect(wrong).toEqual([])
  })

  it('holds no result worth more points than the profile has room for', () => {
    /* Owner, 12.08.2026: „a bodovi do 200,00." The column on a profile is pinned
       to exactly that, so a result above it does not merely look odd, it pushes
       the table sideways on a telephone. */
    const tooMany = results.filter((one) => one.points > 200).map((one) => one.id)

    expect(tooMany).toEqual([])
  })

  it('holds no race longer than the profile has room for', () => {
    /* And the same for the length, which is pinned to „1000,00 km ako zatreba". */
    const tooFar = results.filter((one) => one.distanceKm > 1000).map((one) => one.id)

    expect(tooFar).toEqual([])
  })
})

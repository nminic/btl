import { describe, expect, it } from 'vitest'
import { btlPoints } from '../../data/scoring'
import type { Race } from '../../data/types'
import type { FormValues } from '../../forms/types'
import { reportedResult } from './reportedResult'

/* What a report says about the run itself, asked of the thing that decides it.
 *
 * None of it is drawn: the queue a moderator reads shows the distance and no more,
 * so the category, the seconds and the points have nowhere else they could be
 * asked. And every race in `public/mock/races.json` is a race of a length, so the
 * screen can only ever walk one of the three ways through here.
 *
 * Owner, 29.08.2026: on a timed race `Tsec` is the race's own limit, the same for
 * everyone who finished, and the member gives the length, the climb and the fall;
 * on a free race the member gives all four; on a race of a length nothing changes.
 */

const race = (over: Partial<Race> = {}): Race => ({
  id: 'r1',
  eventId: 'e1',
  name: 'Trka',
  renamed: 'no',
  date: '2026-09-19',
  kind: 'length',
  limitSeconds: 0,
  distanceKm: 21.1,
  ascentM: 300,
  descentM: 250,
  /* Deliberately not what the length says. `categoryOf(21.1)` is „half", so a
     fixture that carried it could not tell „off the race" from „worked out from what
     was covered", and the case about the category would pass whichever way the code
     read.

     Where such a record comes from is not the administration: `storedRow` works the
     category out from the length every time it writes, and every existing row goes
     through it on a save, so the two agree in all 1612 races in the file. It comes
     from outside, which is the same door the kinds come through: a backend, an
     import, a file somebody edited. What this fixture says is that the two readings
     are different readings, not that the portal produces the difference. */
  category: 'marathon',
  ...over,
})

/** What the member typed. Climb and fall differ on purpose: with both the same,
 *  a screen that read one for the other would be measured as right. */
const typed = (over: Partial<FormValues> = {}): FormValues => ({
  hours: '3',
  minutes: '41',
  seconds: '12',
  distanceKm: '60',
  ascentM: '2000',
  descentM: '500',
  link: 'https://primer.rs/rezultati',
  photo: '',
  comment: '',
  ...over,
})

const TYPED_SECONDS = 3 * 3600 + 41 * 60 + 12

describe('what a report says about the run', () => {
  it('takes the figures off a race of a length and the time off the member', () => {
    /* Every race in the file is one of these, so this is the case that says the
       1612 are untouched. All six answers asked, because the fault this guards
       against is one figure coming from the wrong side, not all of them. */
    const said = reportedResult(race(), typed())

    expect(said.distanceKm).toBe(21.1)
    expect(said.ascentM).toBe(300)
    expect(said.descentM).toBe(250)
    expect(said.seconds).toBe(TYPED_SECONDS)
    expect(said.category).toBe('marathon')
    expect(said.points).toBe(btlPoints(21.1, 300, 250, TYPED_SECONDS))
  })

  it('scores a timed race against the limit of the race, not against any time', () => {
    /* He turned down the reading where `Tsec` is the time a runner spent, because it
       rewards stopping: 60 km in 6 h would beat the same 60 km run out over the full
       24. The member typed a time here even so, and it must not reach the formula;
       the form does not draw those boxes on such a race, so this is the guard that
       says nothing else reads them. */
    const said = reportedResult(race({ kind: 'time', limitSeconds: 86_400, distanceKm: 0 }), typed())

    expect(said.seconds).toBe(86_400)
    expect(said.seconds).not.toBe(TYPED_SECONDS)
    expect(said.points).toBe(btlPoints(60, 2000, 500, 86_400))
  })

  it('takes all four off the member on a free race, the time included', () => {
    /* The other half of the same sentence: a free race fixes neither, so the time is
       the member's. Asked because the limit is nought on every race that is not
       timed, and scoring a free race against it would hand the formula a nought and
       tell the member they earned nothing at all. */
    const said = reportedResult(race({ kind: 'free', distanceKm: 0 }), typed())

    expect(said.seconds).toBe(TYPED_SECONDS)
    expect(said.points).toBe(btlPoints(60, 2000, 500, TYPED_SECONDS))
    expect(said.points).toBeGreaterThan(0)
  })

  it('never reads the climb for the fall, whichever side they come from', () => {
    /* Two figures of the same shape next to each other, and the formula weighs them
       differently: `Le = L + (1.25 × AP + 0.75 × AN) / 200`. Measured on 30.08.2026
       by a review: with the two swapped, 60 km of 2000 up and 500 down comes out
       about a fifth lighter, and a case that typed nought into both could not see
       it. Asked on the side the member fills in and on the side the race answers
       for, because they are two different readings. */
    const mine = reportedResult(race({ kind: 'free', distanceKm: 0 }), typed())

    expect(mine.ascentM).toBe(2000)
    expect(mine.descentM).toBe(500)

    const theirs = reportedResult(race(), typed())

    expect(theirs.ascentM).toBe(300)
    expect(theirs.descentM).toBe(250)
  })

  it('reads the category off what was covered where the race fixes no length', () => {
    /* PDL P5: one figure decides the category and the points together. A race that
       fixes no length carries the category of a length nobody ran, so taking it off
       the race would file 60 km under „short": the wrong ring on the profile, the
       wrong board, the wrong award. Both sides asked, since the race of a length
       must go on carrying its own. */
    expect(reportedResult(race({ kind: 'time', limitSeconds: 86_400 }), typed()).category).toBe(
      'ultra',
    )
    expect(reportedResult(race({ kind: 'free' }), typed()).category).toBe('ultra')
    expect(reportedResult(race(), typed()).category).toBe('marathon')
  })

  it('reads a kind it does not know as a race of a length', () => {
    /* The type says one of three; the file says whatever it says. A word this portal
       has never heard of takes the figures off the race, which is what every race
       was before the field existed, rather than off boxes the form did not draw. */
    const said = reportedResult({ ...race(), kind: 'ludilo' }, typed())

    expect(said.distanceKm).toBe(21.1)
    expect(said.seconds).toBe(TYPED_SECONDS)
    expect(said.category).toBe('marathon')
  })
})

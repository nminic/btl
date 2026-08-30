import { describe, expect, it } from 'vitest'
import { prijava, unosRezultata } from '../../forms/definitions'
import { RACE_KINDS } from '../../data/types'
import { reportForm } from './reportForm'

/* The form for reporting a result is not the same form for every kind of race, and
   asking it of the function is the only way to ask about all three: every race in
   `public/mock/races.json` is a race of a length, so the screen can only ever open
   the one form. The same reason `data/raceLabel.test.ts` exists.

   Owner, 29.08.2026: „Na vremenskoj trci član unosi dužinu, uspon i spust. Vreme ne
   unosi, jer je zadato trkom", and on a free race „i dužinu i uspon i spust i
   vreme". */

const asked = (kind: (typeof RACE_KINDS)[number]) => reportForm(kind).fields.map((one) => one.name)

const TIME = ['hours', 'minutes', 'seconds']
const MEASURED = ['distanceKm', 'ascentM', 'descentM']

describe('the form a result is reported on', () => {
  it('asks a race of a length for the time and for nothing it already knows', () => {
    /* Every race in the file is one of these, so this is the case that says the
       1612 are untouched. Compared against the written definition itself rather
       than against a list copied out here, which would be a second place to keep up
       to date, and asked by identity as well: the form handed over is the very one
       the definition holds, so nothing is rebuilt on each render (ADL A2). */
    expect(reportForm('length')).toBe(prijava)
    expect(asked('length')).toEqual(prijava.fields.map((one) => one.name))
  })

  it('never asks a timed race for a time, and asks it what was covered instead', () => {
    /* The limit is the race's own and the same for everyone who finished, so a time
       asked here would be a number the formula must not use. Both halves: the three
       that go and the three that come, because a form that dropped the time and
       asked for nothing in its place would leave the member with no way to say what
       they ran. */
    expect(asked('time')).toEqual(expect.arrayContaining(MEASURED))
    expect(asked('time').filter((one) => TIME.includes(one))).toEqual([])
  })

  it('asks a free race for all four, since it fixes neither', () => {
    expect(asked('free')).toEqual(expect.arrayContaining([...MEASURED, ...TIME]))
  })

  it('asks for the measurements exactly as the other form asks for them', () => {
    /* One home for what a member is asked to measure (ADL A31). A member filling in
       both forms meets the same three fields, in the same order, with the same
       labels, hints and bounds; taken from the written definition rather than
       written again, the two cannot drift. */
    const mine = reportForm('time').fields.filter((one) => MEASURED.includes(one.name))
    const theirs = unosRezultata.fields.filter((one) => MEASURED.includes(one.name))

    expect(mine).toEqual(theirs)
    expect(mine.map((one) => one.name)).toEqual(MEASURED)
  })

  it('keeps what every kind is asked, whichever kind it is', () => {
    /* The proof, the address and the comment belong to the report and not to the
       race, so no kind may lose them. Walked over `RACE_KINDS` rather than named
       one by one, so a kind added later is asked the same question. */
    for (const kind of RACE_KINDS) {
      expect(asked(kind), kind).toEqual(expect.arrayContaining(['link', 'photo', 'comment']))
    }
  })
})

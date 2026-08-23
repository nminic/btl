import { nextSeason } from './nextSeason'

/**
 * A copy of last season's event opens on the same place in next year's calendar.
 *
 * The owner's own example, and the whole of the rule (23.08.2026): „ukoliko se
 * kopirani događaj održao 3. subote u oktobru 2026, predlog datuma novog događaja
 * treba da bude 3. subota u oktobru 2027 (koji god to datum bio)".
 */
describe('the day a copy of an event opens on', () => {
  it('keeps the weekday and its place in the month, a year on', () => {
    /* The owner's example, worked out: 17 October 2026 is the third Saturday of
       that month, and the third Saturday of October 2027 is the 16th. */
    expect(nextSeason('2026-10-17')).toBe('2027-10-16')
    /* And the first of its kind, where the month opens on it: 1 May 2027 is a
       Saturday and so is the first Saturday of May 2028, the 6th. */
    expect(nextSeason('2027-05-01')).toBe('2028-05-06')
    /* Beogradski maraton, the third Sunday of April. */
    expect(nextSeason('2026-04-19')).toBe('2027-04-18')
  })

  it('holds the end of the month where next year has one fewer', () => {
    /* 30 May 2026 is the fifth Saturday of May; May 2027 has only five Saturdays
       counting from the 1st, and 29 May 2027 is the last of them. A month that
       does not reach a fifth gives the last instead, because an event at the end
       of its month belongs at the end of its month.

       31 January 2026 is the fifth Saturday of January; January 2027 has four,
       and the last is the 30th. */
    expect(nextSeason('2026-05-30')).toBe('2027-05-29')
    expect(nextSeason('2026-01-31')).toBe('2027-01-30')
    /* And the one where next year really has one fewer, which the two above do
       not reach: 29 January 2020 is the fifth Wednesday of that month, and
       January 2021 opens on a Friday, so its Wednesdays are 6, 13, 20 and 27.
       The last of them is what a fifth Wednesday becomes. */
    expect(nextSeason('2020-01-29')).toBe('2021-01-27')
  })

  it('counts the year from the day it was given, never from today', () => {
    /* A calendar filled in for 2027 is copied from 2026, and an older event lands
       one year on from where it stood rather than in a year nobody asked about.
       The date is a proposal, so moving it further is one edit either way. */
    expect(nextSeason('2015-06-13')).toBe('2016-06-11')
  })

  it('gives nothing back for something that is not a day', () => {
    /* An event with no date cannot propose one. Held so that the form opens empty
       rather than on „NaN", which is what a date built out of nothing prints. */
    expect(nextSeason('')).toBe('')
    expect(nextSeason('2026-13-45')).toBe('')
  })
})

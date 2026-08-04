import { PODIUM, leaderClass, podiumClass } from './podium'

/* The podium, from one place.
 *
 * It was the same number written out in three files, and on 01.08.2026 it went
 * missing from two of them at once: the gold came off the standing and the Top
 * 10 boards on a misreading of the owner's note and stayed on the teams, so the
 * portal marked the podium on some tables and not on others. What he had asked
 * to be rid of was the yellow-edged line of prose above the table.
 */

describe('the top of a table', () => {
  it('is the first three places, and nothing below them', () => {
    expect(PODIUM).toBe(3)
    expect([1, 2, 3].map(podiumClass)).toEqual(['podium', 'podium', 'podium'])
    expect([4, 5, 40].map(podiumClass)).toEqual([undefined, undefined, undefined])
  })

  it('marks a shared place like any other place it is', () => {
    /* A tie nothing separates is shared, so the column can read 1, 1, 3 (PDL
       P12). Three rows, three golds, and the fourth row is fourth. */
    expect([1, 1, 3, 4].map(podiumClass)).toEqual(['podium', 'podium', 'podium', undefined])
  })

  it('marks four rows when the third place is shared, which the data does contain', () => {
    /* 1, 2, 3, 3 is a real board: the shorter races in 2023 end that way. So the
       podium is not always three rows, and anything counting on three is
       counting on the ties falling out one particular way. */
    expect([1, 2, 3, 3, 5].map(podiumClass)).toEqual([
      'podium',
      'podium',
      'podium',
      'podium',
      undefined,
    ])
  })
})

/* The other mark, for the tables that award only the first place (owner,
 * 04.08.2026: "Nagrade se i dodeljuju samo najboljima").
 *
 * Two functions rather than one with a number beside it. Written as
 * `podiumClass(position, top = PODIUM)` it is a trap for anybody who reaches for
 * `.map()`, which hands the index in as its second argument: the second row of
 * every board would ask for a podium of one and the third for a podium of two.
 * Nothing in the application calls them that way; these tests do, which is how
 * the trap was found.
 */
describe('the leader of a table', () => {
  it('is the first place and no other', () => {
    expect([1, 2, 3, 4].map(leaderClass)).toEqual(['podium', undefined, undefined, undefined])
  })

  it('is both of them when the first place is shared', () => {
    /* A tie nothing separates is shared, and two people who both came first both
       won: 1, 1, 3 is a board the data contains, and the mark follows the place
       rather than the row. */
    expect([1, 1, 3].map(leaderClass)).toEqual(['podium', 'podium', undefined])
  })
})

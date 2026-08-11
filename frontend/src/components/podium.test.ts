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

  it('reads the place it is given, not the row it is drawn in', () => {
    /* The mark follows the number, whatever list it came out of. A board may be
       cut short, filtered, or drawn from a standing that starts elsewhere, so
       the row a column is drawn in is not the place it holds.

       Until 11.08.2026 there was a sharper reason: a tie nothing separated was
       a shared place, so a board could read 1, 1, 3 and the podium was not
       always three rows. There is no shared place any more (PDL P12), and the
       function is unchanged, because it never counted rows. */
    expect([2, 3, 4].map(podiumClass)).toEqual(['podium', 'podium', undefined])
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

  it('reads the place it is given, not the row it is drawn in', () => {
    /* Same reason as the podium above: the number decides, not the position in
       the array it was mapped over. */
    expect([2, 1, 3].map(leaderClass)).toEqual([undefined, 'podium', undefined])
  })
})

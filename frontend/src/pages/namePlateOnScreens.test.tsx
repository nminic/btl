import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { htmlElement, must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'

/**
 * Where the circle is drawn, and which of the two shapes each screen wears.
 *
 * The owner named six places on 07.09.2026 and, asked whether they should all look alike, said
 * they should not: **„U ligi dva reda, u tabelama jedan."** The standing of a competition has one
 * name in a frozen column and room under it; the main standing has a row per member and every
 * extra line is a row taller.
 *
 * **Both halves in one case, because the decision is the difference.** Measured apart, each half
 * passes on a screen that draws the other shape too, and the thing the owner actually chose — that
 * the two are not alike — is what neither would hold. The circle is on both, so it is asked of
 * both in the same breath.
 *
 * What each screen writes beside the circle is its own (`components/NamePlate.tsx`), and the
 * component's own cases hold the rest: the initials are the member's own, they are silent to a
 * reader, and a pair is two circles.
 */
const plate = () =>
  htmlElement(must(document.querySelector('.plate'), 'the circle and the name beside it'))

/**
 * Which board writes a name over two lines and which keeps it on one, and it is not the same
 * answer for all four (owner, 07.09.2026).
 *
 * Hand written, because no rule derives it: it is which of his two sentences a board belongs to.
 * Its floor is the case below, which reads the boards that carry a plate off the drawn screen and
 * compares them with the names here, so a fifth board fails the gate instead of being missed.
 */
const SHAPE = [
  ['Najbolji pojedinačni rezultati', 'one'],
  ['Najbolji trkački parovi', 'two'],
  ['Najduže na stazi', 'two'],
  ['Najviše kilometara', 'two'],
] as const

describe('the circle beside a name', () => {
  it('breaks the name in the standing of a competition, and keeps it whole in the tables', async () => {
    renderAt('/sr/liga/brdska-2019')

    await screen.findByRole('table', { name: 'Poredak takmičenja' })

    const inLeague = plate()

    /* The circle, with the letters of the member whose row this is: the row is headed by their
       name, so the two are read together or not at all. */
    const face = must(inLeague.querySelector('.portrait'), 'the circle')
    const words = must(inLeague.querySelector('.plate__words'), 'the name')

    expect(face.textContent).toBe(
      `${must(words.textContent, 'the name').slice(0, 1)}${must(
        inLeague.querySelector('.plate__family'),
        'the surname',
      ).textContent?.slice(0, 1)}`,
    )
    /* Two lines. Which screens do that and which do not is the case below; here it is enough
       that this one does. */
    expect(within(inLeague).getByText(/./, { selector: '.plate__given' })).toBeVisible()

    cleanup()

    /* And the main standing, where the same circle stands beside a name that does not break.
       Read on a season the standing has rows in, or there is no plate to ask about. */
    renderAt('/sr/tabela?sezona=2019')

    await waitFor(() => {
      expect(document.querySelector('.plate')).not.toBeNull()
    })

    const inTable = plate()

    /* **And the table wears the name its own rule reaches for**, read off the drawn screen rather
       than off the source of the file (review, 07.09.2026: read as text, a mention of the name in a
       comment answered for it). That name is what carries the owner's decision of the same day —
       „Krug se ne crta ispod 700px" — and the rule that hangs off it is held in
       `styles/leagueLayout.test.ts`; here is the other half, that something actually wears it.
       Precedent for asking the drawn element: `pages/publicScreens.test.tsx`. */
    expect(
      [...must(inTable.closest('table'), 'the table of the standing').classList],
      'the main standing no longer wears the name its own rule reaches for',
    ).toContain('rankings__table')

    expect(inTable.querySelector('.portrait')).not.toBeNull()
    expect(
      inTable.querySelector('.plate__given'),
      'the main standing breaks the name, which the owner asked it not to',
    ).toBeNull()
  }, SLOW)

  it('is drawn on the four boards the owner named, and on no other', async () => {
    /* Owner, 07.09.2026: „Samo koje sam naveo ovako, ali da dodam da u glavnoj BTL tabeli i u
       Najboljim pojedinačnim rezultatima treba dodati kružnu sličicu / inicijale pre Imena i
       prezimena." The boards left out are his choice of scope, recorded in the journal.

       **What the second half of this list holds today, said plainly.** Seven of the ten boards are
       charts, so none of them has a name to put a circle beside: the „and on no other" is answered
       by their shape rather than by anybody's restraint. It becomes a real question the day one of
       those charts becomes a table, and then this line is what asks it. Measured: all four boards
       that are tables are named here.

       **The board of pairs joined the list on 07.09.2026**, when it got rows. Until then it was
       empty, „because a pair is made by two people confirming each other and there is no database",
       and this comment said so; the owner then asked for two pairs to be mocked so he could see
       the shape (`public/mock/pairs.json`). */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najviše kilometara' })

    const carried = [...document.querySelectorAll('.boards__board')]
      .filter((board) => board.querySelector('.plate') !== null)
      .map((board) => board.querySelector('.boards__title')?.textContent)
      .sort()

    expect(carried).toEqual(SHAPE.map(([name]) => name))

    /* **And each of them writes the name the way the owner sorted it** (07.09.2026). His sentence
       that morning put three of these boards with the standing of a competition („Tako bi trebalo
       da izgledaju i top liste Najviše kilometara, Najduže na stazi…"), and „u tabelama jedan" was
       about the two he named as additions that afternoon, the main standing and the best single
       races. Read as „every board is a table", which is what this file did until the owner asked
       „Zašto se ovde nije našao krug a onda ime i prezime u dva reda?", two of these boards were
       wrong.

       The list is compared with the screen above, so a fifth board fails here rather than going
       unmeasured, and each row of it says what that board draws. */
    for (const [name, lines] of SHAPE) {
      const board = htmlElement(
        must(
          [...document.querySelectorAll('.boards__board')].find(
            (one) => one.querySelector('.boards__title')?.textContent === name,
          ),
          `the board ${name}`,
        ),
      )
      const halves = board.querySelectorAll('.plate__given').length

      expect(halves > 0, `${name} writes the name in ${lines === 'two' ? 'one line' : 'two lines'}`)
        .toBe(lines === 'two')
    }
  }, SLOW)

  it('draws a pair as two circles above one another and four lines beside them', async () => {
    /* Owner, 07.09.2026: „najbolji parovi treba da ima dve slike, a desno od njih ime, prezime,
       ime, prezime u 4 reda ukupno."

       **Four lines and not two**, which is what parts this from every other board: each of the two
       is written the way the standing of a competition writes a name, and the pair's own rule lays
       the two of them one under the other. Asked of the drawn screen, because the count of lines
       is the whole of what the owner asked for and nothing in a stylesheet says it.

       **The one on top is the one who scored more of the pair's points, not the better season**
       (owner, 04.08.2026). For **this** pair the two measures agree, so what parts them is the
       second pair below; this one holds the order of the four lines and nothing about which
       measure chose it (review, 07.09.2026).

       Measured in a browser after this was written. At 780: the two circles at x 76, one at y 127
       and one at y 164; the four lines all at x 119; the row 106px. At **360**, where the card is
       328px wide: the circles at x 74 and 1,7rem across, the four lines at x 107, the races under
       the points at x 214 and 107px wide, the row 106px, and the page does not scroll sideways. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najbolji trkački parovi' })

    const board = htmlElement(
      must(
        [...document.querySelectorAll('.boards__board')].find(
          (one) => one.querySelector('.boards__title')?.textContent === 'Najbolji trkački parovi',
        ),
        'the board of pairs',
      ),
    )
    const row = htmlElement(must(board.querySelector('tbody tr'), 'the first pair'))

    /* Two circles, and the pair's class that lays them one above the other. */
    expect(htmlElement(must(row.querySelector('.plate'), 'the plate'))).toHaveClass('plate--pair')
    expect(row.querySelectorAll('.portrait').length).toBe(2)

    /* And four lines, in the order the two circles are drawn in, so the second face is not read
       against the first name. */
    expect([...row.querySelectorAll('.plate__given, .plate__family')].map((one) => one.textContent))
      .toEqual(['Isidora', 'Živković', 'Radoslav', 'Milovanović'])

    /* **Two elements beside the circles and not four**, which is what puts the gap between the two
       people rather than between a given name and its own surname: the pair rule lays the words in
       rows, and a row is a child. Handed over as four halves, the screen reads the same and the
       spacing is wrong, and nothing drawn can see spacing (ADL A33). */
    expect(
      [...must(row.querySelector(".plate__words"), "the words").children].length,
      "a pair hands over its names in something other than two pieces",
    ).toBe(2)

    /* **And the second pair is the one that proves which measure decides**, because for the first
       the two answers agree (review, 07.09.2026). Over the whole of 2019 Vladan Đurišić has more
       points than Milica Bogdanović; on the twenty one races they ran together she has more. Read
       off the season, he would be the first line here. */
    const second = htmlElement(must(board.querySelectorAll('tbody tr')[1], 'the second pair'))

    expect(
      [...second.querySelectorAll('.plate__given, .plate__family')].map((one) => one.textContent),
      'the half on top of a pair is not the one who scored more of its points',
    ).toEqual(['Milica', 'Bogdanović', 'Vladan', 'Đurišić'])

    /* The initials of both, in the same order, so a circle never stands beside the other name. */
    expect([...row.querySelectorAll('.portrait')].map((one) => one.textContent)).toEqual([
      'IŽ',
      'RM',
    ])
  }, SLOW)
})

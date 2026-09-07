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
    /* Two lines, which is this screen and no other. */
    expect(within(inLeague).getByText(/./, { selector: '.plate__given' })).toBeVisible()

    cleanup()

    /* And the main standing, where the same circle stands beside a name that does not break.
       Read on a season the standing has rows in, or there is no plate to ask about. */
    renderAt('/sr/tabela?sezona=2019')

    await waitFor(() => {
      expect(document.querySelector('.plate')).not.toBeNull()
    })

    const inTable = plate()

    expect(inTable.querySelector('.portrait')).not.toBeNull()
    expect(
      inTable.querySelector('.plate__given'),
      'the main standing breaks the name, which the owner asked it not to',
    ).toBeNull()
  }, SLOW)

  it('is drawn on the three boards the owner named, and on no other', async () => {
    /* Owner, 07.09.2026: „Samo koje sam naveo ovako, ali da dodam da u glavnoj BTL tabeli i u
       Najboljim pojedinačnim rezultatima treba dodati kružnu sličicu / inicijale pre Imena i
       prezimena." The four boards left out are his choice of scope, recorded in the journal, and
       what makes this case worth having is that it holds **both** directions: the three that
       carry the circle and the ones that must not. */
    renderAt('/sr/top-liste?sezona=2019')

    await screen.findByRole('table', { name: 'Najviše kilometara' })

    const carried = [...document.querySelectorAll('.boards__board')]
      .filter((board) => board.querySelector('.plate') !== null)
      .map((board) => board.querySelector('.boards__title')?.textContent)
      .sort()

    expect(carried).toEqual(
      ['Najbolji pojedinačni rezultati', 'Najduže na stazi', 'Najviše kilometara'].sort(),
    )
  }, SLOW)
})

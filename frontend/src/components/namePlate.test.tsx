import { render, screen, within } from '@testing-library/react'
import { NamePlate, OverTwoLines } from './NamePlate'
import { at, first, htmlElement, must } from '../test/at'
import type { Competitor } from '../data/types'

/**
 * The circle beside a name, and what it is allowed to say.
 *
 * The owner asked for it on 07.09.2026 („kružni logo sa slikom ili inicijalima, i pored u dva reda
 * Ime i Prezime") and it is drawn on five screens. Measured here rather than five times, and the
 * one thing the screens cannot answer is answered here too: **a pair**, which the board of pairs
 * will draw the day there is a database to build one from and which nothing draws today.
 */
const person = (memberNumber: string, firstName: string, lastName: string): Competitor => ({
  memberNumber,
  firstName,
  lastName,
  gender: 'M',
  city: 'Beograd',
  country: 'RS',
  birthYear: 1985,
  firstSeason2027: false,
  firstSeason: 2027,
  membershipBasis: 'payment',
  referralCode: 'proba0000',
  referredBy: null,
  teamId: null,
  teamSince: null,
  profileHidden: false,
  birthdayShown: 'none',
  bio: '',
  active: true,
})

/* Two people whose initials, numbers and names differ in every letter, so a plate that took the
   wrong one of the two is caught by any of the three. */
const ANA = person('000011', 'Ana', 'Marković')
const BORIS = person('000022', 'Boris', 'Petrović')

const circles = (container: HTMLElement) =>
  [...container.querySelectorAll('.portrait')].map(htmlElement)

describe('a competitor as a circle and a name', () => {
  it('draws one circle, with that member’s own initials in it', () => {
    /* **The member the plate was given, and not whoever came first** (the rule about two sources
       of one value, `CLAUDE.md`). Both people are in the same render, so a plate reading the wrong
       one draws „BP" where „AM" belongs. */
    const { container } = render(
      <>
        <NamePlate competitors={[BORIS]}>{`${BORIS.firstName} ${BORIS.lastName}`}</NamePlate>
        <NamePlate competitors={[ANA]}>{`${ANA.firstName} ${ANA.lastName}`}</NamePlate>
      </>,
    )

    const drawn = circles(container)

    expect(drawn).toHaveLength(2)
    /* And neither of the two is a pair, which is the other half of that one class. */
    expect(container.querySelectorAll('.plate--pair')).toHaveLength(0)
    expect(first(drawn).textContent).toBe('BP')
    expect(at(drawn, 1).textContent).toBe('AM')
  })

  it('says nothing out loud that the words beside it do not', () => {
    /* The letters in the circle are the letters the name begins with, and hearing them once as
       „BP" and then again as „Boris Petrović" is worse than not hearing them at all. `Portrait`
       carries `aria-hidden`; what a reader hears is the words the screen wrote. */
    render(<NamePlate competitors={[BORIS]}>Boris Petrović</NamePlate>)

    expect(first(circles(document.body))).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Boris Petrović')).toBeVisible()
  })

  it('draws two circles for a pair, and the words beside them', () => {
    /* **A pair, which nothing on the portal draws today** (owner, 07.09.2026: „dva kruga jedan
       iznad drugog, imena desno"). The board of pairs has no rows until there is a database,
       because a pair is made by two people confirming each other, and its own words say so.
       Measured here so that the day the rows arrive nothing has to be drawn again
       (`btl-produkt/PDL.md`, „Ime sa slikom"). */
    const { container } = render(
      <NamePlate competitors={[ANA, BORIS]}>
        <span>Ana Marković</span>
        <span>Boris Petrović</span>
      </NamePlate>,
    )

    const drawn = circles(container)

    expect(drawn.map((one) => one.textContent)).toEqual(['AM', 'BP'])
    /* **And the plate says it is a pair**, which is what every rule about a pair hangs off
       (`NamePlate.css`). Without the class the two **names** go onto one line, side by side, and
       every rule about a pair becomes dead while the whole gate stays green — so the day the board
       of pairs has rows, the shape is simply wrong.
     *
       What does **not** change is the circles: a circle is `display: grid` in its own right
       (`components/Portrait.css`), so the two stand one above the other whatever this class says,
       and the rule that names them buys the four pixels between them and nothing more. Measured by
       a review on 07.09.2026, after an earlier version of this note claimed otherwise. */
    expect(htmlElement(must(container.firstElementChild, 'the plate'))).toHaveClass('plate--pair')
    /* Both names beside them, in the order their circles are drawn in, so the second face is not
       read against the first name. */
    const words = htmlElement(
      must(container.querySelector('.plate__words'), 'the words beside the circles'),
    )

    expect([...words.children].map((one) => one.textContent)).toEqual([
      'Ana Marković',
      'Boris Petrović',
    ])
  })

  it('breaks a name over two lines where a screen asks for that, and nowhere else', () => {
    /* Owner, asked whether the tables should look like the standing of a competition: „U ligi dva
       reda, u tabelama jedan." So the breaking is the caller's word, not the plate's, and the two
       halves are two elements with a space between them: what a reader hears has to be one name
       either way. */
    const { container } = render(
      <NamePlate competitors={[ANA]}>
        <OverTwoLines competitor={ANA} />
      </NamePlate>,
    )

    const words = htmlElement(
      must(container.querySelector('.plate__words'), 'the words beside the circle'),
    )

    expect(within(words).getByText('Ana')).toHaveClass('plate__given')
    expect(within(words).getByText('Marković')).toHaveClass('plate__family')
    /* One name to the ear, and that is what the space between the two elements buys. */
    expect(words.textContent).toBe('Ana Marković')
  })
})

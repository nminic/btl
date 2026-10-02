import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { NamePlate, OverTwoLines } from './NamePlate'
import { at, first, htmlElement, must } from '../test/at'
import { PLATE_CLASSES, person } from '../test/plate'

/**
 * The circle beside a name, and what it is allowed to say.
 *
 * The owner asked for it on 07.09.2026 („kružni logo sa slikom ili inicijalima, i pored u dva reda
 * Ime i Prezime") and it is drawn on **six**: the standing of a competition, the main standing, and
 * four boards, the last of which is the pairs. Measured here rather than six times.
 *
 * **A pair is measured here too**, and that is this file's own half: that the component takes two
 * people, marks itself a pair, and puts the words beside the circles in the order the circles are
 * drawn in. What the board does with that shape is measured on the board
 * (`pages/namePlateOnScreens.test.tsx`). Until 07.09.2026 nothing drew a pair at all and this file
 * said so; the owner then asked for two to be mocked.
 */
/* Two people whose initials, numbers and names differ in every letter, so a plate that took the
   wrong one of the two is caught by any of the three. */
const ANA = person('000011', 'Ana', 'Marković')
const BORIS = person('000022', 'Boris', 'Petrović')
/* A third, whose portrait was approved, for the one case that has to see both forms of the circle
   in one render. Not one of the two above: they are read by every other case here for their
   initials, and a photograph draws none. */
const HAS_A_PORTRAIT = person('000033', 'Vesna', 'Ilić', {
  photo: '/mock/photo/andjelija.svg',
  crop: { x: 0.3, y: 0.15, size: 0.55 },
})

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
    /* **A pair** (owner, 07.09.2026: „dva kruga jedan iznad drugog, imena desno"). The board of
       best pairs draws them, and this is where the component's own half is measured: that it takes
       two people, marks itself a pair, and puts the words beside the circles in the order the
       circles are drawn in. What the board does with that shape, four lines and the races under
       the points, is measured on the board (`pages/namePlateOnScreens.test.tsx`). */
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

  it('wears these classes and no others, in every shape this component has', () => {
    /* **The floor under `PLATE_CLASSES`**, written in the same commit as the list itself
       (07.09.2026). A guard over the stylesheets asks „does any other sheet in the portal write
       one of the plate's classes", and it can only ask that of names it has. Read off the source,
       it would have neither of the two the outer element wears: they are written
       `` `plate${pair ? ' plate--pair' : ''}` ``.

       **The cost of getting this list wrong was measured that day.** It held only names beginning
       with `plate`, so a review wrote `.rankings__table .portrait { display: none }` into
       `pages/Rankings.css` and the main standing drew no circle at any width, against the owner's
       „Krug se ne crta ispod 700px" (which says it is drawn above it), with the whole gate green.

       **Two shapes, since 02.10.2026, and this said one.** It said „a pair with a name over two
       lines is every shape this component has", which stopped being true the day `faceTo` gave the
       circle a branch of its own: a plate of one whose circle is a LINK is drawn by a different
       element than the pair is, and a class written on that branch alone was never drawn here.
       Measured in the review of PR 461 (`PENDING.md`): a class added to the link's branch only
       passed 129 of 129 cases, and with a rule in `Rankings.css` that takes the circle away on that
       class the circle left the main standing at every width with 372 of 372 green. Both are drawn
       now, each asked on its own, so the message names the shape that wears the class nobody has
       heard of.

       The plain plate is still the same element as the pair without one modifier, and a screen that
       writes its own words writes no class of the plate's.

       **One of the two carries a portrait and the other does not, and that is not decoration of
       the case.** Since 26.09.2026 the circle has two forms, a photograph and a monogram, and only
       the first wears `crop-fitted` (PDL P28f). Drawn with two members who both have no picture,
       this case would pass while never once seeing the class the photograph brings, and the
       stylesheet guard beside it would go on never having heard of it. */
    const { container } = render(
      <MemoryRouter>
        <NamePlate competitors={[ANA, HAS_A_PORTRAIT]}>
          <OverTwoLines competitor={ANA} />
        </NamePlate>
        <NamePlate competitors={[BORIS]} faceTo="/sr/takmicar/000022-boris-petrovic">
          Boris Petrović
        </NamePlate>
      </MemoryRouter>,
    )

    /* THE SECOND SHAPE IS REALLY THE ONE WITH A LINK. A `faceTo` the component ignored would draw
       a plain plate and this floor would go on passing while never once seeing the branch it was
       written for. */
    const links = container.querySelectorAll('a')

    expect(links).toHaveLength(1)
    expect(first(links)).toHaveAttribute('href', '/sr/takmicar/000022-boris-petrovic')
    expect(first(links).querySelector('.portrait'), 'the circle is inside the link').not.toBeNull()

    const worn = new Set<string>()

    for (const plate of container.children) {
      for (const one of [plate, ...plate.querySelectorAll('*')]) {
        for (const name of one.classList) {
          expect(
            PLATE_CLASSES,
            `the plate ${plate.querySelector('a') === null ? 'without' : 'with'} a link wears „${name}", which the stylesheet guard has never heard of`,
          ).toContain(name)

          worn.add(name)
        }
      }
    }

    /* And the list has no class that no shape wears, which is the other half: a name left in it
       after the markup stopped writing it is a name every sheet is held against for nothing. */
    expect([...worn].sort()).toEqual(PLATE_CLASSES)
  })
})

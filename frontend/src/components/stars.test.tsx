import { render, screen } from '@testing-library/react'
import { at, inputElement } from '../test/at'
import { setupUser } from '../test/user'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { Stars } from './Stars'

function draw(ui: React.ReactNode) {
  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>,
  )
}

/* The stars, both shapes.
 *
 * The one that asks used to be left to the screen that uses it, and the screen
 * held its radios, its names and what it hands back, never its drawing: the
 * control could have filled none of the five, or filled them one short, and
 * every test on the portal passed. What a member sees is the drawing.
 */
/** How many of the five are drawn filled. The one thing about these stars that
 *  no role reaches: a filled star and an empty one are the same shape and differ
 *  by an attribute (Stars.tsx). */
function fillingIn(container: HTMLElement): number {
  return [...container.querySelectorAll('path')].filter(
    (one) => one.getAttribute('fill') === 'currentColor',
  ).length
}

describe('a rating being given', () => {
  it('is one group of five, so the arrow keys move through it', () => {
    /* Five radios of one name are one choice; five of five names are five
       choices that happen to sit together, and then the arrow keys do nothing
       and a reader is told "1 of 1" five times over. */
    draw(<Stars name="organisation" label="Organizacija" value={0} onChange={() => undefined} />)

    const radios = screen.getAllByRole('radio')

    expect(radios).toHaveLength(5)
    /* The name itself, not merely one name between them: five radios with no
       name at all also share one, and that is exactly the broken case. A browser
       does not tie nameless radios together, so the arrows do nothing and more
       than one of them can be checked at once. */
    expect(new Set(radios.map((one) => one.getAttribute('name')))).toEqual(
      new Set(['organisation']),
    )
  })

  it('fills the stars up to the mark that was chosen, and no further', async () => {
    /* The whole of what the owner asked for: "empty stars that fill on a click".
       The radios were held from the first day and the drawing was not, so the
       control could have filled none of them, or filled them one short, with
       nothing on the portal saying so. */
    const user = setupUser()
    let given = 0
    const { container, rerender } = draw(
      <Stars name="organisation" label="Organizacija" value={given} onChange={(one) => (given = one)} />,
    )

    expect(fillingIn(container)).toBe(0)

    await user.click(screen.getByRole('radio', { name: '3 od 5' }))
    rerender(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <Stars
            name="organisation"
            label="Organizacija"
            value={given}
            onChange={() => undefined}
          />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(given).toBe(3)
    expect(fillingIn(container)).toBe(3)
  })

  it('gives every star a name of its own, so a reader knows which is which', () => {
    draw(<Stars name="value" label="Vrednost za novac" value={0} onChange={() => undefined} />)

    /* By the name a reader is actually given, which is computed from the label
       around the radio and not read off an attribute: the star has no
       `aria-label`, and asking for one gets five empty strings and passes. */
    for (const mark of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('radio', { name: `${mark} od 5` })).toBeInTheDocument()
    }
  })

  it('marks the one that was chosen, and only it', () => {
    draw(<Stars name="ambience" label="Ambijent" value={4} onChange={() => undefined} />)

    const chosen = screen.getAllByRole('radio').filter((one) => inputElement(one).checked)

    expect(chosen).toHaveLength(1)
    expect(chosen[0]).toHaveAttribute('value', '4')
  })

  it('hands back the mark that was pressed', async () => {
    const user = setupUser()
    const given: number[] = []

    draw(<Stars name="organisation" label="Organizacija" value={0} onChange={(one) => given.push(one)} />)

    await user.click(at(screen.getAllByRole('radio'), 2))

    expect(given).toEqual([3])
  })
})

describe('a rating that is read rather than given', () => {
  it('is a picture with the number in its name, and nothing to press', () => {
    draw(<Stars label="Organizacija" value={4} />)

    expect(screen.getByRole('img', { name: 'Organizacija: 4 od 5' })).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('draws exactly as many filled stars as the mark it was given', () => {
    /* The picture and the name have to say the same number. Held on the drawing
       as well as on the name, because the name is a string this file builds and
       the drawing is what a sighted reader gets: one of the two going wrong is
       invisible to a test that reads only the other. */
    const { container } = draw(<Stars label="Organizacija" value={3} />)
    const filled = [...container.querySelectorAll('path')].filter(
      (one) => one.getAttribute('fill') === 'currentColor',
    )

    expect(filled).toHaveLength(3)
    expect(container.querySelectorAll('path')).toHaveLength(5)
  })

  it('keeps the five drawings out of what is read aloud', async () => {
    /* The group already carries the whole rating in its name. Left in the tree
       the five stars are five more things to walk past, and each of them says
       nothing: an image with no name is announced as an image with no name. */
    const { container } = draw(<Stars label="Organizacija" value={3} />)
    const stars = [...container.querySelectorAll('svg')]

    expect(stars).toHaveLength(5)
    expect(stars.every((one) => one.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('says so where nobody has rated it', () => {
    /* Nought is not "nought out of five": it is a comment that carries no
       rating at all, which the record allows for anything written before the
       ratings existed. */
    draw(<Stars label="Ambijent" value={0} />)

    expect(screen.getByRole('img', { name: 'Ambijent: Bez ocene' })).toBeInTheDocument()
  })
})

describe('a star filled part of the way across', () => {
  /** How wide the cut is on each star of a rating, or null where the star is
   *  whole or empty. jsdom computes no layout, so the drawing has to say in
   *  figures what it does in ink. */
  function cuts(): (number | null)[] {
    return [...document.querySelectorAll('.stars__mark')].map((one) => {
      const rect = one.querySelector('clipPath rect')

      return rect === null ? null : Number(rect.getAttribute('width'))
    })
  }

  it('is cut at the remainder, on the one star the number falls inside', () => {
    /* Owner, 11.08.2026: an average of 3,33 is three whole stars and a fourth
       filled a third of the way across. Measured on the star's own width, 2.6
       to 21.4 across a box of 24: a third of the box would be a different
       place, and the star is what a reader sees. */
    draw(<Stars label="Ocena" value={3.33} />)

    const [first, second, third, fourth, fifth] = cuts()

    expect([first, second, third, fifth]).toEqual([null, null, null, null])
    /* Close to, because 3.33 minus 3 is not 0.33 in binary and the width in the
       markup carries the difference. */
    expect(fourth).toBeCloseTo(2.6 + 18.8 * 0.33, 5)
  })

  it('draws whole stars with no cut at all, and empty ones with no ink', () => {
    /* A clip that cuts nothing is an id in the document for nothing, and there
       are five of these on every rating on the screen.

       And the whole star must not point at one either: a `clip-path` naming an
       id that is not in the document is an invalid reference, and by CSS
       Masking an element with one is not rendered at all. jsdom draws nothing,
       so the only way to see that is to read the attribute. */
    draw(<Stars label="Ocena" value={4} />)

    expect(cuts()).toEqual([null, null, null, null, null])
    expect(inked()).toBe(4)
    expect(document.querySelectorAll('.stars__mark path[clip-path]')).toHaveLength(0)
  })

  it('says the number the way the portal writes numbers', () => {
    draw(<Stars label="Ocena" value={3.33} />)

    expect(screen.getByRole('img', { name: 'Ocena: 3,3 od 5' })).toBeVisible()
  })

  it('rounds nothing: 4,7 is not five stars and not four', () => {
    /* Both of the ways this was wrong before. Drawn up it said what nobody
       gave; drawn down it said less than the figure beside it. */
    draw(<Stars label="Ocena" value={4.7} />)

    expect(inked()).toBe(5)
    expect(cuts()[4]).toBeCloseTo(2.6 + 18.8 * 0.7, 5)
  })
})

/** How many of the five carry ink, whole or cut. */
function inked(): number {
  return [...document.querySelectorAll('.stars__mark')].filter(
    (one) => one.querySelector('path[fill="currentColor"]') !== null,
  ).length
}

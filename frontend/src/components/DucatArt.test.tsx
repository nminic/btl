import { render, screen } from '@testing-library/react'
import { DucatArt } from './DucatArt'
import type { Ducat } from '../data/ducatRule'
import { at, must } from '../test/at'

/* What this file holds is the part of the coin that cannot be seen by looking at
 * it: the two rules the drawing is built on, and the three things a later redraw
 * would lose without turning a single pixel wrong.
 *
 * There is no assertion here about how a ducat looks. That is checked in a
 * browser. What is checked here is that it is still a struck coin and not a
 * picture of one.
 *
 * These read attributes rather than roles, against the usual rule for component
 * tests. A drawing has no role: it is deliberately hidden from a screen reader,
 * because everything it says is said in words beside it. The queries here are
 * the only way to reach it at all. */

const coin: Ducat = {
  id: 'duk-proba',
  name: 'Proba',
  kind: 'totalKm',
  value: 125,
  from: '',
  to: '',
  tier: 1,
  mark: 'distance',
  art: 'none',
  top: 'ISTRČANIH',
  bottom: 'JUL 2027',
}

/** The radius of one of the two arcs the legends are set along, read back out
 *  of the path the component wrote. */
function radiusOf(container: HTMLElement, which: 'top' | 'bottom'): number {
  const paths = container.querySelectorAll('defs path')
  const d = must(at(paths, which === 'top' ? 0 : 1).getAttribute('d'), 'an arc for the legend')

  return Number(must(/A ([\d.]+)/.exec(d), 'a radius in the arc')[1])
}

function sizeOf(container: HTMLElement, className: string): number {
  const found = must(container.querySelector(`.${className}`), `something drawn as ${className}`)

  return Number(found.getAttribute('font-size'))
}

describe('the two legends', () => {
  it('sets them so that both stop the same distance short of the edge', () => {
    /* The rule the whole drawing is built on. A legend along the top grows away
       from its baseline towards the rim; one along the bottom grows from its
       baseline towards the middle. One radius for both therefore gives two
       different gaps, which is exactly what the owner saw (10.08.2026). So the
       lower baseline is the circle both of them touch, and the upper one is that
       circle less the height of a capital. */
    const { container } = render(<DucatArt ducat={coin} label="Proba" />)
    const size = sizeOf(container, 'ducat-art__legend')

    expect(radiusOf(container, 'bottom')).toBeCloseTo(82, 4)
    expect(radiusOf(container, 'top')).toBeCloseTo(82 - 0.7154 * size, 4)
  })

  it('sets a longer legend smaller, and does not let that move the gap', () => {
    /* Seventeen letters would walk half way round the coin at the ordinary size.
       Setting them smaller is allowed to change how large the legend is; it is
       not allowed to change how far it stands from the edge, and the arithmetic
       above is what keeps the two apart. */
    const long = { ...coin, top: 'BTL ULTRAMARATONA' }
    const { container } = render(<DucatArt ducat={long} label="Proba" />)
    const size = sizeOf(container, 'ducat-art__legend')

    expect(size).toBeLessThan(13)
    expect(radiusOf(container, 'top')).toBeCloseTo(82 - 0.7154 * size, 4)
    expect(radiusOf(container, 'bottom')).toBeCloseTo(82, 4)
  })

  it('strikes both of them, and the number, as text', () => {
    /* Selectable, searchable, and read out as the words and the number they are.
       Drawn as paths they would be a picture of a legend, and no search on this
       page would ever find one. */
    const { container } = render(<DucatArt ducat={coin} label="Proba" />)

    expect(container).toHaveTextContent('ISTRČANIH')
    expect(container).toHaveTextContent('JUL 2027')
    expect(screen.getByText('125')).toBeVisible()
  })

  it('is an image with a name, and not a heap of fragments', () => {
    /* Everything struck on the coin is text, and text inside a drawing is read
       out piece by piece: "ISTRČANIH", "125", "km", "JUL 2027". The label is the
       same coin said as a sentence, and it is the only thing a screen reader is
       given, because the owner took the hint beside it away (11.08.2026). */
    render(<DucatArt ducat={coin} label="Mesečni kilometri, 125 km." />)

    expect(screen.getByRole('img', { name: 'Mesečni kilometri, 125 km.' })).toBeInTheDocument()
  })
})

describe('the number in the middle', () => {
  it('sets it as large as the space between the two marks allows', () => {
    /* Thirty-one is where the mark of the kind ends, and nothing comes closer to
       it than twelve, so a number is never wider than a hundred and fourteen.
       The owner asked for the number to be much larger and then, seeing it,
       for the space beside it to be kept (10.08.2026). */
    const { container } = render(<DucatArt ducat={coin} label="Proba" />)
    const size = sizeOf(container, 'ducat-art__number')

    expect(3 * 0.5605 * size).toBeCloseTo(114, 1)
  })

  it('steps down as the number gains a figure, so that it never leaves the coin', () => {
    const { container } = render(<DucatArt ducat={{ ...coin, value: 1000 }} label="Proba" />)

    expect(4 * 0.5605 * sizeOf(container, 'ducat-art__number')).toBeCloseTo(114, 1)
  })

  it('holds a ceiling that two figures would otherwise sail past', () => {
    /* By the space alone, two figures would be set at a hundred and one, and
       beside a coin carrying four they would read as a different drawing. A wall
       of ducats has to be one set. */
    const { container } = render(<DucatArt ducat={{ ...coin, value: 20 }} label="Proba" />)

    expect(sizeOf(container, 'ducat-art__number')).toBe(86)
  })

  it('centres the number and its unit together on the middle of the coin', () => {
    /* Not the number on its own. With the unit under it, a number centred by
       itself sits high by half the unit, and a wall of coins where half the
       numbers sit high is a wall that looks untidy without anybody being able to
       say why. */
    const { container } = render(<DucatArt ducat={coin} label="Proba" />)
    const number = must(container.querySelector('.ducat-art__number'), 'a number')
    const unit = must(container.querySelector('.ducat-art__unit'), 'a unit')

    const top = Number(number.getAttribute('y')) - 0.7187 * Number(number.getAttribute('font-size'))
    const foot = Number(unit.getAttribute('y'))

    expect((top + foot) / 2).toBeCloseTo(100, 4)
  })

  it('carries its unit under it, where the quantity is measured in one', () => {
    const { container } = render(<DucatArt ducat={coin} label="Proba" />)

    expect(screen.getByText('km')).toBeVisible()
    expect(container.querySelector('.ducat-art__unit')).not.toBeNull()
  })

  it('carries none where the legend under it already names what is counted', () => {
    const { container } = render(<DucatArt ducat={{ ...coin, kind: 'raceCount' }} label="Proba" />)

    expect(container.querySelector('.ducat-art__unit')).toBeNull()
  })

  it('gives the middle to a drawing where a family has one, and then sets no number', () => {
    const { container } = render(<DucatArt ducat={{ ...coin, art: 'globe' }} label="Proba" />)

    expect(container.querySelector('.ducat-art__art')).not.toBeNull()
    expect(container.querySelector('.ducat-art__number')).toBeNull()
    expect(container.querySelector('.ducat-art__unit')).toBeNull()
  })

  it('draws the galaxy for the one that climbs and the globe for the one that circles', () => {
    const climbed = render(<DucatArt ducat={{ ...coin, art: 'galaxy' }} label="Proba" />).container
    const circled = render(<DucatArt ducat={{ ...coin, art: 'globe' }} label="Proba" />).container

    // The galaxy is turned on the coin; the globe stands square.
    expect(must(climbed.querySelector('.ducat-art__art'), 'a galaxy').getAttribute('transform'))
      .toContain('rotate')
    expect(circled.querySelector('.ducat-art__art')).not.toHaveAttribute('transform')
  })
})

describe('what says how much a ducat is worth', () => {
  it('carries the value on the coin as a fact, and the metal follows from it', () => {
    const { container } = render(<DucatArt ducat={{ ...coin, tier: 3 }} label="Proba" />)

    expect(must(container.firstElementChild, 'the coin')).toHaveAttribute('data-tier', '3')
  })

  it('fills the milled edge in solid at the fourth value, and at no other', () => {
    /* More metal in the same place, without a second colour, and outwards rather
       than inwards: inwards is the seven units of air between the legend and the
       edge, and that measure is the same on all five. */
    const fourth = render(<DucatArt ducat={{ ...coin, tier: 4 }} label="Proba" />).container
    const third = render(<DucatArt ducat={{ ...coin, tier: 3 }} label="Proba" />).container

    expect(fourth.querySelector('.ducat-art__band')).not.toBeNull()
    expect(third.querySelector('.ducat-art__band')).toBeNull()
  })
})

describe('a wall of them', () => {
  it('gives every coin arcs of its own to hang its legends on', () => {
    /* Fifteen coins are drawn on the rulebook. Path names are a document-wide
       namespace, so two coins sharing one would set both legends of the second
       along the arcs of the first. */
    const { container } = render(
      <>
        <DucatArt ducat={coin} label="Proba" />
        <DucatArt ducat={{ ...coin, id: 'duk-druga' }} label="Proba" />
      </>,
    )

    const names = [...container.querySelectorAll('defs path')].map((path) => path.id)

    expect(names).toHaveLength(4)
    expect(new Set(names).size).toBe(4)
  })
})

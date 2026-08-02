import { at, must } from '../test/at'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BadgeArt } from './BadgeArt'

/* What this file holds is the part of the drawing that cannot be seen: three
 * things that a later redraw would lose without turning a single pixel wrong,
 * and one rule about how the number is sized.
 *
 * There is no assertion here about how the badge looks. That is what it looks
 * like that is checked in a browser; what is checked here is that it is still a
 * badge and not a picture of one. */

describe('BadgeArt', () => {
  it('keeps the threshold as text, outside the drawing', () => {
    const { container } = render(
      <BadgeArt kind="totalKm" threshold="1.000 km" label="Jul 2027" />,
    )

    /* Selectable, searchable, and read out as the number it is. Set inside the
       svg it would be a picture of a number, and no search on this page would
       ever find it. */
    const threshold = screen.getByText('1.000 km')
    expect(threshold).toBeVisible()
    expect(threshold.closest('svg')).toBeNull()
    expect(container.querySelector('svg text')).toBeNull()
  })

  it('hides the drawing from a screen reader, which already has the words', () => {
    const { container } = render(<BadgeArt kind="totalKm" threshold="100 km" label="Jul 2027" />)

    /* Decorative rather than named: the threshold and the label are beside it,
       and the screen that shows the badge adds its name and its rule. A name of
       its own would be the same badge read out twice. */
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Jul 2027')).toBeVisible()
  })

  it('leaves nothing standing where an empty label would have been', () => {
    const { container, rerender } = render(
      <BadgeArt kind="totalKm" threshold="100 km" label="Jul 2027" />,
    )
    expect(screen.getByText('Jul 2027')).toBeVisible()

    rerender(<BadgeArt kind="totalKm" threshold="100 km" label="" />)

    expect(screen.queryByText('Jul 2027')).toBeNull()
    // The mark and nothing else, so a row of badges does not step up and down
    // around the one that has no period.
    expect(container.querySelector('.badge-art')?.childElementCount).toBe(1)
  })

  it('sizes the number by its widest word rather than by the whole threshold', () => {
    render(<BadgeArt kind="totalKm" threshold="10.000 km" label="" />)

    /* Six, for "10.000", and not nine for the string: the unit stands on its own
       line, so what has to fit across the disc is the number alone. Measuring
       the string would set every threshold carrying a unit smaller than it needs
       to be, and at 48px that is the difference between a number that can be
       read and one that cannot. */
    expect(screen.getByText('10.000 km').style.getPropertyValue('--badge-art-chars')).toBe('6')
  })

  it('draws the shoe for kilometres and the wreath for a kind with no emblem yet', () => {
    const { container, rerender } = render(
      <BadgeArt kind="totalKm" threshold="100 km" label="" />,
    )
    expect(container.querySelector('.badge-art')).toHaveAttribute('data-kind', 'totalKm')
    expect(container.querySelector('.badge-art__wreath')).toBeNull()

    rerender(<BadgeArt kind="raceCount" threshold="25" label="" />)

    expect(container.querySelector('.badge-art')).toHaveAttribute('data-kind', 'raceCount')
    expect(container.querySelector('.badge-art__wreath')).not.toBeNull()
  })
})

/* The drawing steps down in density as the disc gets smaller, and a step that
 * nothing can reach is not a step, it is a comment describing a screen nobody
 * can open. Two of the three densities were exactly that: --badge-art-size was
 * set nowhere at all, so the disc stood at 104px on a 360px telephone and on a
 * 1600px desktop alike and neither container query could ever match.
 *
 * jsdom evaluates none of this, so it is read as text. What it holds is the one
 * fact that made the rules dead, and it is a fact about two files at once, which
 * is why neither of them can be trusted to state it about itself.
 */
describe('the sizes the mark is drawn at', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf-8')

  /** The smallest disc anything on the portal asks for, in pixels. */
  function smallestSize(): number {
    const clamp = /--badge-art-size:\s*clamp\(\s*([\d.]+)rem/.exec(read('pages/Badges.css'))

    /* Whoever draws a badge says how large. Nobody saying so is the fault this
       guards: the component's own fallback is then the only size there is. */
    expect(clamp).not.toBeNull()

    return Number(at(must(clamp, 'a clamp on the badge art'), 1)) * 16
  }

  /** Every density step in the drawing, as the width it cuts at. */
  function cuts(): number[] {
    return [...read('components/BadgeArt.css').matchAll(/@container badge-art \(max-width: (\d+)px\)/g)]
      .map((match) => Number(match[1]))
  }

  it('shrinks the disc on a narrow window, so a step below can be reached', () => {
    // 360px is the narrowest screen this portal supports (ADL A7).
    expect(smallestSize()).toBeLessThan(Math.max(...cuts()))
  })

  it('keeps no step the disc can never get down to', () => {
    expect(cuts()).not.toEqual([])
    expect(cuts().filter((cut) => cut < smallestSize())).toEqual([])
  })
})

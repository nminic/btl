import { fireEvent } from '@testing-library/react'
import { must } from '../../test/at'
import { renderWithI18n } from '../../test/render'
import { LeagueMark } from './LeagueMark'

/**
 * THE SIGN OF A COMPETITION, IN ITS TWO STATES AND THE FALL BACK BETWEEN THEM (owner, PDL 23.11.2026,
 * „Pravi logo lige”: „krug, seče se kao znak tima ... čuva se original, prikazuje se u krugu; bez loga
 * ostaje krug sa inicijalima”).
 *
 * The original and the small one are two different addresses with two different circles, so a mark drawn
 * from the wrong one of the two, or cut by a circle that is not the league's, is told apart.
 */
const RUNTRACE = 'RunTrace liga 2027'

const withAMark = {
  name: RUNTRACE,
  logo: '/api/photos/original',
  crop: { x: 0.2, y: 0.8, size: 0.5 },
  smallLogo: '/api/photos/original/small/0.20000000-0.80000000-0.50000000',
}

const withNone = { name: RUNTRACE, logo: null, crop: null, smallLogo: null }

const drawn = (container: HTMLElement): HTMLElement => must(container.querySelector('.leagues__mark'), 'the mark')

describe('the sign of a competition', () => {
  it('is the small circle the server cut, whole, where the league has a mark', () => {
    const { container } = renderWithI18n(<LeagueMark league={withAMark} />)
    const mark = drawn(container)
    const picture = must(mark.querySelector('img'), 'the picture')

    expect(picture).toHaveAttribute('src', withAMark.smallLogo)
    expect(picture).toHaveAttribute('alt', '')
    expect(picture.getAttribute('style')).toBeNull()
    expect(mark).toHaveClass('leagues__mark--logo', 'crop-fitted')
    expect(mark).toHaveAttribute('aria-hidden', 'true')
    expect(mark.textContent).toBe('')
  })

  it('is the original cut by the league’s own circle where the small one will not load', () => {
    const { container } = renderWithI18n(<LeagueMark league={withAMark} />)

    fireEvent.error(must(drawn(container).querySelector('img'), 'the small picture'))

    const picture = must(drawn(container).querySelector('img'), 'the original')

    expect(picture).toHaveAttribute('src', withAMark.logo)
    expect(picture).toHaveStyle({ objectPosition: '20% 80%', transform: 'scale(2)' })
  })

  it('is the original cut by its circle where the server answered no small one', () => {
    const { container } = renderWithI18n(<LeagueMark league={{ ...withAMark, smallLogo: null }} />)
    const picture = must(drawn(container).querySelector('img'), 'the original')

    expect(picture).toHaveAttribute('src', withAMark.logo)
    expect(picture).toHaveStyle({ objectPosition: '20% 80%', transform: 'scale(2)' })
  })

  it('is the initials, in the same circle, where the league has none', () => {
    const { container } = renderWithI18n(<LeagueMark league={withNone} />)
    const mark = drawn(container)

    expect(mark.textContent).toBe('RT')
    expect(mark.querySelector('img')).toBeNull()
    expect(mark).not.toHaveClass('leagues__mark--logo')
    expect(mark).toHaveAttribute('aria-hidden', 'true')
  })

  it('is the initials for a record that does not carry the key at all, and never a picture with no address', () => {
    const { container } = renderWithI18n(<LeagueMark league={JSON.parse(JSON.stringify({ name: RUNTRACE }))} />)

    expect(drawn(container).textContent).toBe('RT')
    expect(container.querySelector('img')).toBeNull()
  })
})

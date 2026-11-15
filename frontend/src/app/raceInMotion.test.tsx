import { render, screen } from '@testing-library/react'
import { htmlElement, must } from '../test/at'
import { renderAt } from '../test/render'
import { HeaderDecoration, PageBackgroundDecoration } from './RaceInMotion'

/* „Race in Motion" (owner, 14.11.2026, PDL „Vizuelno osveženje „Race in Motion""): two pictures that
 * say nothing, drawn once by the shell. What a reader of the page meets of them is nothing at all,
 * and that is what is asked here. Where they stand on the screen, and that the pointer passes
 * through them, is asked of Chrome (`geometry/raceInMotion.geometry.ts`), because jsdom lays nothing
 * out.
 *
 * The layers carry no role and no name on purpose, so they are reached from the landmark they live
 * in, by the tree, rather than by a query a reader could make. */

/** Every element under one, itself included. */
function everything(root: Element): Element[] {
  return [root, ...[...root.children].flatMap(everything)]
}

/** What the keyboard could stop on: a link, a control, or anything given a tab index. */
function reachable(root: Element): Element[] {
  return everything(root).filter(
    (one) => one.matches('a[href], button, input, select, textarea, [tabindex]') || one.hasAttribute('contenteditable'),
  )
}

describe('the decoration of the header', () => {
  it('is hidden from a reader of the page, as a whole', () => {
    const { container } = render(<HeaderDecoration />)
    const layer = htmlElement(container.firstElementChild)

    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(reachable(layer)).toEqual([])
  })

  it('makes no drawing a stop for the keyboard of an old browser', () => {
    const { container } = render(<HeaderDecoration />)
    const drawings = everything(htmlElement(container.firstElementChild)).filter((one) => one.localName === 'svg')

    /* The track, the strip of gold at the foot, the climb and the runner. */
    expect(drawings).toHaveLength(4)

    for (const drawing of drawings) {
      expect(drawing).toHaveAttribute('focusable', 'false')
    }
  })

  it('draws two lanes on a telephone, a third from a tablet and a fourth from a desktop, and the gold line with its companion and its climb', () => {
    const { container } = render(<HeaderDecoration />)
    const paths = everything(htmlElement(container.firstElementChild)).filter((one) => one.localName === 'path')
    const classes = paths.map((one) => one.getAttribute('class'))

    expect(classes.filter((one) => one === 'race-header__lane race-header__lane--always')).toHaveLength(2)
    expect(classes.filter((one) => one === 'race-header__lane race-header__lane--tablet')).toHaveLength(1)
    expect(classes.filter((one) => one === 'race-header__lane race-header__lane--desktop')).toHaveLength(1)
    expect(classes.filter((one) => one === 'race-header__gold race-header__gold--echo')).toHaveLength(1)

    /* The line itself in the strip at the foot, and its climb in the drawing of its own. */
    const gold = paths.filter((one) => one.getAttribute('class') === 'race-header__gold')

    expect(gold.map((one) => one.parentElement?.getAttribute('class'))).toEqual(['race-header__strip', 'race-header__rise'])
  })

  it('draws the runner as one closed outline, not as strokes', () => {
    /* Owner, 15.11.2026, about the five strokes this replaced: „Ovaj trkac je prejadan". The sheet
       fills it and gives it a rim; here it is one shape, closed, with nothing else in its drawing. */
    const { container } = render(<HeaderDecoration />)
    const runner = everything(htmlElement(container.firstElementChild)).filter((one) =>
      one.matches('svg.race-header__runner'),
    )

    expect(runner).toHaveLength(1)

    const parts = everything(must(runner[0], 'the runner')).slice(1)

    expect(parts.map((one) => one.localName)).toEqual(['path'])
    expect(parts[0]?.getAttribute('d')).toMatch(/^M[^M]+Z$/)
  })
})

describe('the decoration of the page', () => {
  it('is hidden from a reader of the page, as a whole, and holds nothing to reach', () => {
    const { container } = render(<PageBackgroundDecoration />)
    const layer = htmlElement(container.firstElementChild)

    expect(layer).toHaveAttribute('aria-hidden', 'true')
    expect(reachable(layer)).toEqual([])
    expect(layer).toHaveTextContent('')
    /* The drawing is the sheet's, over the whole window: nothing in the tree for it to stand in. */
    expect(layer.children).toHaveLength(0)
  })
})

describe('the shell', () => {
  it('draws each layer exactly once: the page under everything, the header inside the header', async () => {
    renderAt('/sr', 'competitor', '000007')

    const banner = await screen.findByRole('banner')
    const header = htmlElement(banner.firstElementChild)
    const page = htmlElement(banner.previousElementSibling)

    /* The first thing in the header, so the bar and the navigation are drawn after it. */
    expect(header).toHaveClass('race-header')
    expect(header).toHaveAttribute('aria-hidden', 'true')
    expect(page).toHaveClass('race-page')
    expect(page).toHaveAttribute('aria-hidden', 'true')

    const shell = htmlElement(banner.parentElement)

    expect(everything(shell).filter((one) => one.classList.contains('race-header'))).toHaveLength(1)
    expect(everything(shell).filter((one) => one.classList.contains('race-page'))).toHaveLength(1)
  })

  it('leaves the landmarks and the controls of the header as a reader finds them', async () => {
    renderAt('/sr', 'competitor', '000007')

    const banner = await screen.findByRole('banner')

    /* The header still names the portal and still opens its menus: nothing in the layer took a role,
       a name or a stop for the keyboard. */
    expect(await screen.findByRole('link', { name: 'Naslovna strana' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible()
    expect(reachable(htmlElement(banner.firstElementChild))).toEqual([])
  })
})

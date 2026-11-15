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

    /* What stands beside the column, and what stands past the tools. */
    expect(drawings).toHaveLength(2)

    for (const drawing of drawings) {
      expect(drawing).toHaveAttribute('focusable', 'false')
    }
  })

  it('draws the five lanes of the reference in three strengths, and its one gold line in the three spans it is seen in', () => {
    const { container } = render(<HeaderDecoration />)
    const paths = everything(htmlElement(container.firstElementChild)).filter((one) => one.localName === 'path')
    const classes = paths.map((one) => one.getAttribute('class'))

    expect(classes.filter((one) => one?.startsWith('race-header__lane '))).toEqual([
      'race-header__lane race-header__lane--mid',
      'race-header__lane race-header__lane--faint',
      'race-header__lane race-header__lane--full',
      'race-header__lane race-header__lane--mid',
      'race-header__lane race-header__lane--faint',
    ])

    /* Behind the logo and past the navigation beside the column, and up under the runner past the
       tools. There is no other gold line: the reference has none along the foot of the header. */
    const gold = paths.filter((one) => one.getAttribute('class') === 'race-header__gold')

    expect(gold.map((one) => one.closest('svg')?.getAttribute('class'))).toEqual([
      'race-header__track',
      'race-header__track',
      'race-header__rise',
    ])
  })

  it('gives every line the fade it is drawn in, from its own drawing, so it comes and goes as in the reference', () => {
    /* The reference's lines are not of one strength: each comes in out of nothing and goes back into
       it. That strength is a gradient the stroke names, and a name that points at nothing is a line
       the browser does not draw at all. */
    const { container } = render(<HeaderDecoration />)
    const layer = htmlElement(container.firstElementChild)
    const lines = everything(layer).filter((one) => /race-header__(lane|gold)\b/.test(one.getAttribute('class') ?? ''))

    expect(lines).toHaveLength(8)

    for (const line of lines) {
      const named = must(/^url\(#([^)]+)\)$/.exec(line.getAttribute('stroke') ?? '')?.[1], 'the fade a line names')
      const fade = must(line.closest('svg')?.querySelector(`linearGradient[id="${named}"]`), `the fade ${named}`)
      const stops = [...fade.querySelectorAll('stop')]

      /* It starts and ends at nothing and is somewhere seen. */
      expect(stops.at(0)?.getAttribute('stop-opacity')).toBe('0')
      expect(stops.at(-1)?.getAttribute('stop-opacity')).toBe('0')
      expect(Math.max(...stops.map((stop) => Number(stop.getAttribute('stop-opacity'))))).toBeGreaterThan(0.8)
    }
  })

  it('draws the runner as one closed outline traced from the reference', () => {
    /* Owner, 15.11.2026: „Moze li da se iskopira verno ovo sto sam ti dao kao primer?" One shape,
       closed; the sheet gives it a thin stroke and nothing inside. */
    const { container } = render(<HeaderDecoration />)
    const runner = everything(htmlElement(container.firstElementChild)).filter((one) => one.matches('path.race-header__runner'))

    expect(runner).toHaveLength(1)
    expect(runner[0]?.closest('svg')).toHaveClass('race-header__rise')
    expect(runner[0]?.getAttribute('d')).toMatch(/^M[^M]+Z$/)
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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { first } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

/* What a browser does for itself when it loads a page, and what a single page
 * application has to do by hand: put the reader at the top of the new screen and
 * take the keyboard there with them.
 *
 * The scroll is the other half, and `ScrollRestoration` in the shell does it.
 * jsdom lays nothing out, so nothing here can watch the page move; what it can
 * watch is what the shell asks the browser for, and that turns out to be enough
 * to tell the two cases apart. */

describe('arriving on a new screen', () => {
  it('leaves the focus where the browser put it when the page first loads', async () => {
    renderAt('/sr/takmicari')

    await screen.findByRole('heading', { level: 1 })

    /* Taking the focus on the first render announces a screen nobody asked to
       be taken to, and moves it off whatever the browser had chosen. */
    expect(document.activeElement).toBe(document.body)
  })

  it('takes the keyboard into the screen that just opened', async () => {
    const user = setupUser()
    renderAt('/sr/takmicari')

    await screen.findByRole('heading', { level: 1, name: 'Takmičari' })
    await user.click(first(await screen.findAllByRole('link', { name: /000/ })))
    await screen.findByRole('heading', { level: 1, name: /\w/ })

    /* Otherwise the focus stays on `body`: a screen reader carries on from the
       top of the document while the eye is somewhere else, and the first Tab
       lands on the skip link rather than in the screen just opened. */
    expect(document.activeElement).toBe(document.querySelector('main#content'))
  })

  it('does not take it again when only the query changes', async () => {
    const user = setupUser()
    renderAt('/sr/takmicar/000002?sezona=sve')

    await screen.findByRole('table', { name: 'Rezultati' })
    const chip = screen.getByRole('button', { name: 'Polumaraton 21,1 km' })
    await user.click(chip)

    /* Choosing a filter is not arriving anywhere. Moving the focus on every
       query change would take it off the control the reader is using, which is
       worse than the fault this fixes. */
    expect(document.activeElement).toBe(chip)
  })
})

describe('the scroll, on the way between screens', () => {
  beforeEach(() => {
    vi.mocked(window.scrollTo).mockClear()
  })

  it('goes back to the top when the screen changes', async () => {
    const user = setupUser()
    renderAt('/sr/takmicari')

    await screen.findByRole('heading', { level: 1, name: 'Takmičari' })
    vi.mocked(window.scrollTo).mockClear()

    await user.click(first(await screen.findAllByRole('link', { name: /000/ })))
    await screen.findByRole('heading', { level: 1, name: /\w/ })

    /* A data router turns the browser's own handling off, so a profile opened
       from the foot of a long list opened halfway down. */
    expect(window.scrollTo).toHaveBeenCalled()
  })

  it('asks for the position it was at when only a filter changes', async () => {
    /* The router saves the scroll under the key it is given and puts it back. On
       the path alone, a filter finds its own screen's position waiting and
       restores it, which changes nothing; with the default key it finds nothing
       and asks for the top, so the table jumped on every keystroke typed into
       the search and the row of six lengths threw the reader up the page on
       every click.
     *
     * jsdom scrolls nothing, but it will hold a position if one is put there,
     * and that is enough: what is compared is not whether the call happened but
     * what it asked for. */
    const user = setupUser()
    renderAt('/sr/takmicar/000002?sezona=sve')

    await screen.findByRole('table', { name: 'Rezultati' })

    Object.defineProperty(window, 'scrollY', { value: 800, writable: true, configurable: true })
    Object.defineProperty(window, 'pageYOffset', { value: 800, writable: true, configurable: true })
    vi.mocked(window.scrollTo).mockClear()

    await user.click(screen.getByRole('button', { name: 'Polumaraton 21,1 km' }))
    await new Promise((wait) => setTimeout(wait, 50))

    expect(window.scrollTo).toHaveBeenCalledWith(0, 800)
  })
})

describe('the width of a screen', () => {
  it('leaves room for the scrollbar whether or not there is one', () => {
    /* A long screen has a scrollbar and a short one does not, so going between
       them moved every heading, every card and the navigation itself sideways
       by the width of that bar (owner, 31.07.2026). jsdom has no layout, so the
       rule is read as text, the way the badge art is tested (ADL A7). */
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf-8')

    const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))

    expect(root).toContain('scrollbar-gutter: stable')
    expect(css).not.toContain('scrollbar-gutter: auto')
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

/* What a browser does for itself when it loads a page, and what a single page
 * application has to do by hand: put the reader at the top of the new screen and
 * take the keyboard there with them.
 *
 * The scroll is the other half of this and is not testable here, because jsdom
 * lays nothing out and has nothing to scroll. It is `ScrollRestoration` in the
 * shell, and it is checked in the browser. */

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
    await user.click((await screen.findAllByRole('link', { name: /000/ }))[0])
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

    await user.click((await screen.findAllByRole('link', { name: /000/ }))[0])
    await screen.findByRole('heading', { level: 1, name: /\w/ })

    /* A data router turns the browser's own handling off, so a profile opened
       from the foot of a long list opened halfway down. jsdom lays nothing out,
       so what is checked here is that the shell asked for it. */
    expect(window.scrollTo).toHaveBeenCalled()
  })

  /* Whether a filter leaves the scroll alone is not settled here, and is not
     settled anywhere yet.
   *
   * The router restores the position saved under the key it is given, so with
   * the key on the path alone a filter finds its own screen's position waiting
   * and puts it back, which is a no-op. In jsdom every position is nought, so
   * the call looks identical either way, and the browser this was built in does
   * not composite frames, so nothing scrolls there to be measured. What is known
   * is the half that was measured: without a key of its own the router asked for
   * the top on every keystroke typed into the table's search box.
   *
   * This is the one claim in this change that rests on the router's documented
   * behaviour rather than on a measurement, and it wants a look on QA. */
})

describe('the width of a screen', () => {
  it('leaves room for the scrollbar whether or not there is one', () => {
    /* A long screen has a scrollbar and a short one does not, so going between
       them moved every heading, every card and the navigation itself sideways
       by the width of that bar (owner, 31.07.2026). jsdom has no layout, so the
       rule is read as text, the way the badge art is tested (ADL A7). */
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf-8')

    expect(css).toMatch(/:root\s*\{[\s\S]*?scrollbar-gutter: stable/)
  })
})

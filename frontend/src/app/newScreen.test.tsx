import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
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

  it('asks for nothing at all when only a filter changes', async () => {
    /* A filter writes itself into the address, and to the router that is a
       navigation like any other: it would put the reader at the top of the page.
       So the screens say what is actually true when they write one, through
       `useFilterParams`: this is not an arrival (preventScrollReset).

       It was answered before by keying the saved positions on the path, so a
       filter found its own position waiting and putting it back changed nothing.
       That cost the other half: a screen reopened from the navigation also found
       a position waiting. Asking for nothing is the narrower answer.

       jsdom scrolls nothing, but what is compared here is not whether the page
       moved: it is what the shell asked the browser for. */
    const user = setupUser()
    renderAt('/sr/takmicar/000002?sezona=sve')

    await screen.findByRole('table', { name: 'Rezultati' })

    Object.defineProperty(window, 'scrollY', { value: 800, writable: true, configurable: true })
    Object.defineProperty(window, 'pageYOffset', { value: 800, writable: true, configurable: true })
    vi.mocked(window.scrollTo).mockClear()

    await user.click(screen.getByRole('button', { name: 'Polumaraton 21,1 km' }))
    await new Promise((wait) => setTimeout(wait, 50))

    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('asks the router for the position it left, on the way back', async () => {
    /* The owner's ask, 04.08.2026: leaving a list for a profile and coming back
       has to land where it left, not at the top of the list. This is the half of
       it the router does: it saves the position of the entry it is leaving and
       asks for it again on the way back. The other half, the one that actually
       broke, is the test under this one. */
    const user = setupUser()
    const { router } = renderAt('/sr/takmicari')

    await screen.findByRole('heading', { level: 1, name: 'Takmičari' })

    Object.defineProperty(window, 'scrollY', { value: 640, writable: true, configurable: true })
    Object.defineProperty(window, 'pageYOffset', { value: 640, writable: true, configurable: true })

    await user.click(first(await screen.findAllByRole('link', { name: /000/ })))
    await screen.findByRole('heading', { level: 1, name: /\w/ })

    vi.mocked(window.scrollTo).mockClear()
    await router.navigate(-1)

    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 640))
    expect(screen.getByRole('heading', { level: 1, name: 'Takmičari' })).toBeVisible()
  })

  it('opens a screen it has read before with its content already there', async () => {
    /* And this is what made the asking work. Everything on the portal is drawn
       from a file, and the data layer used to start every screen empty and fill
       it a moment later. The router puts the position back the instant the screen
       commits, so what it was putting it back into was one loading box: a
       document with nowhere to scroll to, and the browser quietly clamps the
       request to nought.

       jsdom lays nothing out, so no test here can watch that clamping. What it
       can watch is the thing that causes it, which is the whole of the fix: on a
       second visit the screen has to be its full height in the very first render,
       with no loading state in between.

       Read with `getBy` and no `await`, which is the assertion: `findBy` would
       wait, and waiting is exactly what must not be needed. */
    const user = setupUser()

    renderAt('/sr/takmicari')
    await screen.findByRole('heading', { level: 1, name: 'Takmičari' })
    await user.click(first(await screen.findAllByRole('link', { name: /000/ })))
    await screen.findByRole('heading', { level: 1, name: /\w/ })

    cleanup()

    renderAt('/sr/takmicari')

    /* The word the loading state says out loud, which is the one thing on the
       screen that tells the two states apart. Asked for by its text and not by
       its role: `status` is a role two other things on this screen carry, and a
       `status` has no accessible name to narrow it by, so a query by role either
       finds the wrong element or, with a name, finds nothing in either state and
       passes whatever happens. */
    expect(screen.queryByText('Učitavanje')).not.toBeInTheDocument()
    expect(within(screen.getByRole('list')).getAllByRole('listitem').length).toBeGreaterThan(20)
  })
})

describe('the width of a screen', () => {
  it('leaves room for the scrollbar whether or not there is one', () => {
    /* A long screen has a scrollbar and a short one does not, so going between
       them moved every heading, every card and the navigation itself sideways
       by the width of that bar (owner, 31.07.2026). jsdom has no layout, so the
       rule is read as text, the way the ducat art is tested (ADL A7). */
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf-8')

    const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))

    expect(root).toContain('scrollbar-gutter: stable')
    expect(css).not.toContain('scrollbar-gutter: auto')
  })
})

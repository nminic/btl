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

import { screen, waitFor, within } from '@testing-library/react'
import { at } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/* Where the browser's own way back leads from a screen that says something was sent.
 *
 * Owner, 05.09.2026: „Back na pregledaču uvek treba da radi tako da kad bi vratilo na formu
 * koja je bila popunjena pa poslata, da se preskoči i vrati još na smisleni nivo nazad.
 * Primera radi Nazad sa potvrde poslatog rezultata treba da vodi na formu Moji rezultati, a
 * ne na formu za slanje rezultata."
 *
 * Each of these four screens drew its confirmation in place, so the address under it was
 * the form itself, filled in and already sent, and pressing back offered a member the
 * chance to send the same thing twice. The level that belongs under each is named in
 * `btl-produkt/PDL.md` and measured here.
 *
 * **Measured through the router's own history, not through a link**, because the control
 * that used to lead back is the thing being taken away: what is left is the browser, and
 * the browser is what this asks.
 */

const EVENT = 'fruskogorski-maraton-2010'
const ME = '000021'

describe('the way back from a confirmation', () => {
  it('skips the comment form and lands on the event', async () => {
    const user = setupUser()
    const { router } = renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)

    await user.type(await screen.findByLabelText(/^Komentar/), 'Staza je bila jasno obeležena.')

    for (const name of ['Organizacija', 'Vrednost za novac', 'Ambijent']) {
      await user.click(at(within(screen.getByRole('radiogroup', { name })).getAllByRole('radio'), 4))
    }

    await user.click(screen.getByRole('button', { name: 'Pošalji' }))

    expect(await screen.findByText('Ocena je poslata na odobrenje.')).toBeVisible()

    await router.navigate(-1)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/sr/kalendar/${EVENT}`)
    })
  }, SLOW)
})

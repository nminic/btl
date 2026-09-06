import { screen, waitFor, within } from '@testing-library/react'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { at } from '../test/at'
import { renderAt } from '../test/render'
import { BACK_CASES } from '../test/backCases'
import { sources } from '../test/sources'
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
/** A race of `maraton-maratona-2015`, for the report form. */
const RACE = 'evt-maraton-maratona-2015-03-14-4400'

describe('the way back from a confirmation', () => {
  it('skips the comment form and lands on the event', async () => {
    const user = setupUser()
    const { router } = renderAt(`/sr/kalendar/${EVENT}/ocena`, 'competitor', ME)
    const form = router.state.location.pathname

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

    /* **And one press further, which is where the replacing shows.** Without it the form
       is not gone from the history but pushed one step deeper: the first press still lands
       on the level and only the second one finds the form, filled in and already sent. A
       case that pressed once measured nothing, and both halves of the mechanism could be
       taken away with the package green (review, 06.09.2026). */
    await router.navigate(-1)

    expect(router.state.location.pathname).not.toBe(form)
  }, SLOW)

  it('skips the report form and lands on the list of own results', async () => {
    /* The owner's own example, word for word: „Nazad sa potvrde poslatog rezultata treba
       da vodi na formu Moji rezultati, a ne na formu za slanje rezultata." */
    const user = setupUser()
    const { router } = renderAt(
      `/sr/kalendar/maraton-maratona-2015/prijava?trka=${RACE}`,
      'competitor',
      '000007',
    )
    const form = router.state.location.pathname

    await user.type(await screen.findByLabelText(/Sati/), '3')
    await user.type(screen.getByLabelText(/Minuta/), '41')
    await user.type(screen.getByLabelText(/Sekundi/), '12')
    await user.type(screen.getByLabelText(/Link ka zvaničnim/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: 'Pošalji rezultat' }))

    expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()

    await router.navigate(-1)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/moji-rezultati')
    })

    /* **And one press further, which is where the replacing shows.** Without it the form
       is not gone from the history but pushed one step deeper: the first press still lands
       on the level and only the second one finds the form, filled in and already sent. A
       case that pressed once measured nothing, and both halves of the mechanism could be
       taken away with the package green (review, 06.09.2026). */
    await router.navigate(-1)

    expect(router.state.location.pathname).not.toBe(form)
  }, SLOW)

  it('skips the standalone result form and lands on the same list', async () => {
    /* The same screen by another road, and the one that was left behind when the other
       four were put right: its confirmation was held by the screen, so the entry under it
       was this form, sent and filled in (review, 06.09.2026). Both confirmations draw the
       same words, so the portal had two of them and only one was true. */
    const user = setupUser()
    const { router } = renderAt('/sr/rezultat/novi', 'competitor', '000007')
    const form = router.state.location.pathname

    await user.type(await screen.findByLabelText(/^Naziv trke/), 'Probna trka')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText('Mesto'), 'Niš')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Dužina/), '21.1')
    await user.type(screen.getByLabelText(/Uspon/), '540')
    await user.type(screen.getByLabelText(/Spust/), '540')
    await user.type(screen.getByLabelText(/Sati/), '1')
    await user.type(screen.getByLabelText(/Minuta/), '52')
    await user.type(screen.getByLabelText(/Sekundi/), '10')
    await user.type(screen.getByLabelText(/Link ka zvaničnim/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()

    await router.navigate(-1)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/moji-rezultati')
    })

    /* **And one press further, which is where the replacing shows.** Without it the form
       is not gone from the history but pushed one step deeper: the first press still lands
       on the level and only the second one finds the form, filled in and already sent. A
       case that pressed once measured nothing, and both halves of the mechanism could be
       taken away with the package green (review, 06.09.2026). */
    await router.navigate(-1)

    expect(router.state.location.pathname).not.toBe(form)
  }, SLOW)

  it('skips the proposal form and lands on the list of teams', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000002', undefined, '2026-10-15')
    const form = router.state.location.pathname

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    expect(await screen.findByRole('heading', { name: 'Predlog je poslat' })).toBeVisible()

    await router.navigate(-1)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/timovi')
    })

    /* **And one press further, which is where the replacing shows.** Without it the form
       is not gone from the history but pushed one step deeper: the first press still lands
       on the level and only the second one finds the form, filled in and already sent. A
       case that pressed once measured nothing, and both halves of the mechanism could be
       taken away with the package green (review, 06.09.2026). */
    await router.navigate(-1)

    expect(router.state.location.pathname).not.toBe(form)
  }, SLOW)

  it('skips the change form and lands on the team itself', async () => {
    const user = setupUser()
    const { router } = renderAt(
      '/sr/tim/dunavski-trkaci/izmena',
      'competitor',
      '000001',
      undefined,
      '2026-10-15',
    )
    const form = router.state.location.pathname

    await user.type(await screen.findByLabelText(/Zašto ovaj tim/), 'Dopisujemo par reči o timu.')
    await user.click(screen.getByRole('button', { name: 'Pošalji izmenu' }))

    expect(await screen.findByRole('heading', { name: 'Izmena je poslata' })).toBeVisible()

    await router.navigate(-1)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/tim/dunavski-trkaci')
    })

    /* **And one press further, which is where the replacing shows.** Without it the form
       is not gone from the history but pushed one step deeper: the first press still lands
       on the level and only the second one finds the form, filled in and already sent. A
       case that pressed once measured nothing, and both halves of the mechanism could be
       taken away with the package green (review, 06.09.2026). */
    await router.navigate(-1)

    expect(router.state.location.pathname).not.toBe(form)
  }, SLOW)
})

/**
 * And the floor under the four cases above.
 *
 * Written after a review measured what they were worth: the mechanism itself
 * (`navigate(..., { replace: true })` in `pages/sent.ts`) could be taken away, and every
 * named level could be changed to the wrong address, with the whole package green
 * (06.09.2026). One case held one of the eight facts the decision names.
 *
 * **The list of screens is not written from memory but read off the imports.** Whatever
 * takes `useSend` out of `pages/sent.ts` is a screen that confirms a sending, under any
 * name, and the day a sixth does so this fails and asks for its case. That is the shape
 * `CLAUDE.md` calls a floor: the question is answered by something the language already
 * says out loud, not by a list somebody has to remember to extend.
 */
describe('every screen that confirms a sending', () => {
  it('names a file that is really there, and a case really in it', () => {
    const wrong = Object.entries(BACK_CASES).filter(([, [file, address]]) => {
      const at = join(process.cwd(), 'src', file)
      const named = file.split('/').at(-1)
      /* By the listing rather than by `existsSync`: Windows answers yes to the wrong case and
         the gate runs on Linux, so the wrong name passed on the machine it was written on. */
      const there = readdirSync(dirname(at)).includes(named ?? '')

      const said = there ? readFileSync(at, 'utf8') : ''

      /* Both, because either alone is met by a file that has nothing to do with this: the
         address of the registration form appears in the sweep of every address too, and the
         walk appears in every file that measures history. Together they name a case that walks
         back from this screen. */
      return !there || !said.includes(address) || !said.includes('router.navigate(-1)')
    })

    expect(wrong).toEqual([])
  })

  it('has a case here saying where the way back leads', () => {
    const sending = sources()
      .filter(({ code }) => /import \{[^}]*\buseSend\b[^}]*\} from/.test(code))
      .map(({ path }) => relative(join(process.cwd(), 'src'), path).split(sep).join('/'))
      .sort()

    expect(sending).toEqual(Object.keys(BACK_CASES).sort())
  })
})

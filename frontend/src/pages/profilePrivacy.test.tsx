import { screen } from '@testing-library/react'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useSession } from '../session/useSession'

/* What a member chooses to show, and to whom.
 *
 * The published privacy policy has promised both of these since it was written: hiding the
 * profile from readers who are not signed in, and showing the birthday only by choice. Nothing
 * in the code answered for either until 06.09.2026, when the owner asked for the controls
 * rather than for the sentences to go.
 *
 * **Both are measured on the screen that draws them and on the screen that reads them**, in one
 * visit, because the whole of the question is what somebody else sees.
 */

/** The reader stops being signed in, without leaving the visit. */
function SignOut() {
  const { signOut } = useSession()

  return (
    <button type="button" onClick={() => { signOut() }}>
      odjavi se
    </button>
  )
}

/** The one line under the name, whole. The member number is drawn in a span of its own, so
 *  reading that span answers about the number and not about the line it stands in. */
function lineUnderTheName(number: string): string {
  const span = screen.getByText(new RegExp(`Članski broj ${number}`))

  return must(span.closest('p'), 'the line under the name').textContent ?? ''
}

/* 000007 is Strahinja Vukićević, born 2007, of Banja Luka, in Dunavski trkači.
   The year is read off the data rather than remembered: written from memory it was 1988, and
   the case then failed on a mechanism that worked. */
const HIM = '/sr/takmicar/000007-strahinja-vukicevic'

describe('hiding a profile from readers who are not signed in', () => {
  it('is offered in the settings and answered by the profile', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )

    /* Still everything, to the member themselves. */
    await router.navigate(HIM)

    expect(
      await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ }),
    ).toBeVisible()
    expect(lineUnderTheName('000007')).toMatch(/Banja Luka/)

    /* And to a reader who is not signed in, the page says so and nothing else. */
    await user.click(screen.getByRole('button', { name: 'odjavi se' }))

    expect(
      await screen.findByText(/sakrio svoj profil od posetilaca koji nisu prijavljeni/),
    ).toBeVisible()
    expect(screen.queryByText(/Članski broj 000007/)).toBeNull()
    /* The name stays, because the reader followed it here from a table where it also stays:
       „ali ne i od ostalih članova, jer bi time nestao smisao zajedničkog rangiranja". */
    expect(screen.getByRole('heading', { level: 1, name: /Strahinja Vukićević/ })).toBeVisible()
  }, SLOW)

  it('leaves every other profile alone', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007', undefined, undefined, <SignOut />)

    await user.click(
      await screen.findByLabelText('Sakrij moj profil od posetilaca koji nisu prijavljeni'),
    )
    await user.click(screen.getByRole('button', { name: 'odjavi se' }))
    await router.navigate('/sr/takmicar/000002-relja-momcilovic')

    /* One member's choice is one member's: read as a switch on the screen rather than on the
       record, it would have hidden everybody at once. */
    expect(await screen.findByText(/Članski broj 000002/)).toBeVisible()
    expect(screen.queryByText(/sakrio svoj profil/)).toBeNull()
  }, SLOW)
})

describe('the birthday a member chooses to show', () => {
  it('is nowhere until it is chosen', async () => {
    renderAt(HIM)

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    expect(lineUnderTheName('000007')).not.toMatch(/2007/)
  })

  it('stands between the category and the town once it is', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007')

    await user.click(await screen.findByLabelText('Prikaži samo godinu'))
    await router.navigate(HIM)

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    /* Read off the one line rather than off the page: „nakon kategorije, a pre grada" is an
       order, and a year found anywhere on a profile full of seasons says nothing about it. */
    expect(lineUnderTheName('000007')).toMatch(/M24-.*2007.*Banja Luka/)
  }, SLOW)

  it('shows the year for „ceo datum" too, because the record has no date yet', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'competitor', '000007')

    await user.click(await screen.findByLabelText('Prikaži ceo datum'))
    await router.navigate(HIM)

    await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })

    expect(lineUnderTheName('000007')).toMatch(/M24-.*2007.*Banja Luka/)
  }, SLOW)

  it('says in the settings why the whole date is not there yet', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000007')

    expect(
      await screen.findByText(/pun datum još nigde ne čuva/),
    ).toBeVisible()
  })
})

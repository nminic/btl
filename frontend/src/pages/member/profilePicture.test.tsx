import { screen, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'

/* Changing or removing the picture on a profile, after joining.
 *
 * Owner, 12.08.2026: „Članovi treba da imaju mogućnost da promene ili obrišu
 * fotografiju naknadno tokom korišćenja sajta. Tad se samo fotografija šalje na
 * odobrenje Adminu ili moderatoru sa adekvatnim pravima."
 *
 * The half that is easy to get wrong is „only the picture": a member who wants a
 * better photograph must not have their biography and their town sent back
 * through a queue with it. So the tests below watch what reaches the queue, not
 * only what the screen says.
 */
describe('the picture on a profile, changed later', () => {
  const anImage = () => new File(['slika'], 'nova-slika.jpg', { type: 'image/jpeg' })

  it('sends the picture for review, and nothing else with it', async () => {
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = within(
      await screen.findByRole('region', { name: 'Profilna slika' }),
    )

    /* Told off rather than switched off, as everywhere else: the button is
       reachable and says why it will not go yet. */
    const send = panel.getByRole('button', { name: 'Pošalji na odobrenje' })

    expect(send).toHaveAttribute('aria-disabled', 'true')
    expect(send).not.toBeDisabled()
    expect(send).toHaveAccessibleDescription('Izaberi sliku da bi mogao da je pošalješ.')

    /* Pressed with nothing chosen: reachable means pressable, so the refusal has
       to live in the handler too. */
    await user.click(send)

    expect(panel.getByText(/vide je svi članovi/)).toBeVisible()

    await user.upload(panel.getByLabelText(/Izaberi novu sliku/), anImage())

    expect(send).toHaveAttribute('aria-disabled', 'false')

    await user.click(send)

    expect(panel.getByText(/Nova slika čeka odobrenje/)).toBeVisible()
  })

  it('reaches the moderator as a picture, under the member it belongs to', async () => {
    /* The queue holds two sorts and decides them differently: a text is edited
       and published, a picture is handed back with an instruction. Sent as the
       wrong sort, a photograph would be offered the button that publishes
       somebody's words as their own. */
    const user = setupUser()
    /* Signed in as the superadmin so the queue can be opened at the end, but
       under the member's own number, because the picture belongs to them. One
       render throughout: what was put forward lives in the session, and a second
       render is a second session that never saw it. */
    const { router } = renderAt('/sr/podesavanja', 'superadmin', '000007')

    const panel = within(await screen.findByRole('region', { name: 'Profilna slika' }))

    await user.upload(panel.getByLabelText(/Izaberi novu sliku/), anImage())
    await user.click(panel.getByRole('button', { name: 'Pošalji na odobrenje' }))

    await router.navigate('/sr/administracija/verifikacija/trkacki-profil')

    /* Found by the name of the member on it, which is how a moderator finds it
       too: the card is a list item under the heading of what is waiting. */
    const heading = await screen.findByRole('heading', { name: 'Strahinja Vukićević' })
    const card = must(heading.closest('li'), 'the card the heading stands in')

    expect(within(card).getByText(/nova-slika\.jpg/)).toBeVisible()
    /* The decision offered is the one for a picture: handed back with an
       instruction, never edited and published. */
    expect(within(card).getByRole('button', { name: 'Odobri' })).toBeVisible()
    expect(within(card).queryByRole('button', { name: 'Objavi' })).not.toBeInTheDocument()
  })

  it('asks nobody when a member takes their own face off the portal', async () => {
    /* Removing is not a decision anybody else makes: the member is not asking
       for anything, so nothing is queued. The circle holds their initials again,
       which is what it holds for everybody who never sent one. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = within(await screen.findByRole('region', { name: 'Profilna slika' }))

    await user.click(panel.getByRole('button', { name: 'Ukloni sliku' }))

    expect(panel.getByText(/Nemaš sliku na portalu/)).toBeVisible()
    expect(panel.queryByRole('button', { name: 'Ukloni sliku' })).not.toBeInTheDocument()
    expect(panel.queryByText(/čeka odobrenje/)).not.toBeInTheDocument()
  })

  it('takes one picture at a time', async () => {
    /* A second while the first is undecided gives the moderator two faces of one
       person and no way to know which one was meant. */
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const panel = within(await screen.findByRole('region', { name: 'Profilna slika' }))

    await user.upload(panel.getByLabelText(/Izaberi novu sliku/), anImage())
    await user.click(panel.getByRole('button', { name: 'Pošalji na odobrenje' }))

    expect(panel.queryByLabelText(/Izaberi novu sliku/)).not.toBeInTheDocument()
    expect(panel.queryByRole('button', { name: 'Pošalji na odobrenje' })).not.toBeInTheDocument()
    expect(panel.getByText(/javljamo ti u sanduče/)).toBeVisible()
  })
  it('draws no picture panel for a number the member list does not hold', async () => {
    /* A number handed out during this visit is not in the file the list is read
       from, and after the database arrives the two can be a moment apart for a
       hundred other reasons. The rest of the settings still work; there is
       simply no face to change. */
    renderAt('/sr/podesavanja', 'competitor', '999999')

    expect(await screen.findByRole('heading', { name: 'Podešavanja' })).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Profilna slika' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Tema' })).toBeVisible()
  })

  it('says a picture is waiting when one was already in the queue', async () => {
    /* Not only what was sent during this visit: a member who sends a picture,
       leaves, and comes back must not be offered the button again while the
       first one is still undecided. Read off the queue rather than off what
       this screen remembers. */
    const user = setupUser()
    const { router } = renderAt('/sr/podesavanja', 'superadmin', '000007')

    const panel = within(await screen.findByRole('region', { name: 'Profilna slika' }))

    await user.upload(panel.getByLabelText(/Izaberi novu sliku/), anImage())
    await user.click(panel.getByRole('button', { name: 'Pošalji na odobrenje' }))

    /* Away and back, which is what empties what the screen remembers while
       leaving the queue as it was. */
    await router.navigate('/sr/moj-profil')
    await router.navigate('/sr/podesavanja')

    const again = within(await screen.findByRole('region', { name: 'Profilna slika' }))

    expect(again.getByText(/Nova slika čeka odobrenje/)).toBeVisible()
    expect(again.queryByRole('button', { name: 'Pošalji na odobrenje' })).not.toBeInTheDocument()
  })
  it('is not held up by something else the member put forward', async () => {
    /* The queue holds what a member has put forward, of every sort. A team
       waiting for a decision is not a picture waiting for one, and reading the
       queue without asking which sort would leave somebody unable to change
       their photograph because they once proposed a team. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/podesavanja')

    const panel = within(await screen.findByRole('region', { name: 'Profilna slika' }))

    expect(panel.getByText(/vide je svi članovi/)).toBeVisible()
    expect(panel.getByRole('button', { name: 'Pošalji na odobrenje' })).toBeVisible()
  })
})

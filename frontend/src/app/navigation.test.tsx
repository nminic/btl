import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'

/** The groups in the navigation open as panels, so a screen inside one is two
 *  clicks away: the group, then the screen. */
async function openGroup(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name }))
}

describe('navigation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('sends the bare address to the default language', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Balkanska trkačka liga',
    )
    expect(document.documentElement.lang).toBe('sr')
  })

  it('treats an unknown language as a path in the default language', async () => {
    renderAt('/de/kalendar')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ove strane nema' })).toBeVisible()
  })

  it('shows the not found page for an unknown address', async () => {
    renderAt('/sr/ovoga-nema')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ove strane nema' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Nazad na naslovnu' })).toBeInTheDocument()
  })

  it('opens a public screen straight from the navigation', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    // The calendar is the one entry that is a link rather than a group.
    await user.click(await screen.findByRole('link', { name: 'Kalendar' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Kalendar' })).toBeVisible()
  })

  it('opens a screen that sits inside a group', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await openGroup(user, 'Statistike')
    await user.click(screen.getByRole('link', { name: 'Tabela' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Tabela' })).toBeVisible()
  })

  /* Badges left the navigation on 29.07.2026 and kept their address, which is
     exactly the case worth testing: an address with no screen behind it yet
     still has to answer with something a person can read. */
  it('shows a placeholder for a screen that has not been built yet', () => {
    renderAt('/sr/znacke')

    expect(screen.getByRole('heading', { level: 1, name: 'Značke' })).toBeVisible()
    expect(screen.getByText(/Ovaj ekran dolazi u sledećoj fazi/)).toBeVisible()
  })

  it('keeps the current screen when the language changes', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rang-liste')

    await user.click(screen.getByRole('button', { name: 'Jezik' }))
    await user.click(screen.getByRole('option', { name: 'English' }))

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Rang liste' })).toBeVisible()
  })

  it('declares the language the text is actually written in', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await user.click(await screen.findByRole('button', { name: 'Jezik' }))
    await user.click(screen.getByRole('option', { name: 'English' }))

    // /en still shows Serbian words until an English dictionary exists, and
    // lang="en" over Serbian text is read out with English phonetics.
    await waitFor(() => expect(document.documentElement.lang).toBe('sr'))
  })

  it('names every screen in the document title', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await waitFor(() => expect(document.title).toBe('Naslovna · Balkanska trkačka liga'))

    await user.click(screen.getByRole('link', { name: 'Kalendar' }))
    await waitFor(() => expect(document.title).toBe('Kalendar · Balkanska trkačka liga'))
  })

  it('titles an unknown address as not found', async () => {
    renderAt('/sr/ovoga-nema')

    await waitFor(() =>
      expect(document.title).toBe('Ove strane nema · Balkanska trkačka liga'),
    )
  })

  it('says out loud which screen opened', async () => {
    renderAt('/sr/timovi')

    expect(await screen.findByRole('status')).toHaveTextContent('Timovi')
  })

  it('offers a visitor the way in, and nothing that belongs to a member', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toHaveAttribute(
      'href',
      '/sr/prijava',
    )
    expect(screen.queryByRole('button', { name: 'Otvori nalog' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Otvori poruke' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Podešavanja' })).not.toBeInTheDocument()
  })

  it('gives a signed-in member the account menu in place of the sign-in symbol', async () => {
    renderAt('/sr', 'competitor', '000007')

    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Prijavi se' })).not.toBeInTheDocument()
  })

  it.each([['visitor'], ['competitor']] as const)(
    'hides administration from a %s',
    async (role) => {
      renderAt('/sr', role, '000007')

      await screen.findByRole('link', { name: 'Kalendar' })
      expect(screen.queryByRole('button', { name: 'Administracija' })).not.toBeInTheDocument()
    },
  )

  it('shows the account screens to a member', async () => {
    const user = userEvent.setup()
    renderAt('/sr', 'competitor', '000007')

    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))

    expect(screen.getByRole('link', { name: 'Moj profil' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Moja članarina' })).toBeVisible()
  })

  it('shows administration to staff', async () => {
    const user = userEvent.setup()
    renderAt('/sr', 'moderator', '000007')

    await openGroup(user, 'Administracija')

    expect(screen.getByRole('link', { name: 'Verifikacija' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Entiteti' })).toBeVisible()
  })

  it('opens and closes the mobile menu', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    const button = await screen.findByRole('button', { name: 'Otvori meni' })
    await user.click(button)

    const close = screen.getByRole('button', { name: 'Zatvori meni' })
    expect(close).toHaveAttribute('aria-expanded', 'true')

    await user.click(close)
    expect(screen.getByRole('button', { name: 'Otvori meni' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('closes the menu after following a link out of a group', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await user.click(await screen.findByRole('button', { name: 'Otvori meni' }))
    await openGroup(user, 'Statistike')
    await user.click(screen.getByRole('link', { name: 'Rang liste' }))

    expect(screen.getByRole('button', { name: 'Otvori meni' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Rang liste' })).toBeVisible()
  })

  it('closes the menu after following a link that is not in a group', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await user.click(await screen.findByRole('button', { name: 'Otvori meni' }))
    await user.click(screen.getByRole('link', { name: 'Kalendar' }))

    expect(screen.getByRole('button', { name: 'Otvori meni' })).toBeInTheDocument()
  })

  it('no longer switches the theme from the header, and sends the cog to settings', async () => {
    const user = userEvent.setup()
    renderAt('/sr', 'competitor', '000007')

    // The switch moved to the settings screen (PDL P28a); the header only leads
    // there now, from behind the account picture.
    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
    expect(screen.getByRole('link', { name: 'Podešavanja' })).toHaveAttribute(
      'href',
      '/sr/podesavanja',
    )
    expect(screen.queryByRole('button', { name: 'Uključi tamnu temu' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Uključi svetlu temu' })).not.toBeInTheDocument()
  })

  it('offers contact as an address rather than as a screen', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('link', { name: 'Kontakt' })).toHaveAttribute(
      'href',
      'mailto:info@balkanskatrkackaliga.net',
    )
  })

  it('offers the skip link as the first thing in the page', async () => {
    renderAt('/sr')

    const skip = await screen.findByRole('link', { name: 'Preskoči na sadržaj' })
    expect(skip).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
  })
})

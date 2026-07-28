import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'

describe('navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
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

  it('opens a public screen from the navigation', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await user.click(await screen.findByRole('link', { name: 'Kalendar' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Kalendar' })).toBeVisible()
  })

  it('shows a placeholder for a screen that has not been built yet', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await user.click(await screen.findByRole('link', { name: 'Značke' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Značke' })).toBeVisible()
    expect(screen.getByText(/Ovaj ekran dolazi u sledećoj fazi/)).toBeVisible()
  })

  it('keeps the current screen when the language changes', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rang-liste')

    await user.click(screen.getByRole('link', { name: 'English' }))

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'English' })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Rang liste' })).toBeVisible()
  })

  it('declares the language the text is actually written in', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await user.click(await screen.findByRole('link', { name: 'English' }))

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

  it('offers registration to a visitor', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('link', { name: 'Registracija' })).toBeVisible()
  })

  it('hides registration from someone who is already a member', async () => {
    renderAt('/sr', 'competitor')

    await screen.findByRole('link', { name: 'Kalendar' })
    expect(screen.queryByRole('link', { name: 'Registracija' })).not.toBeInTheDocument()
  })

  it('hides member and administration links from a visitor', async () => {
    renderAt('/sr')

    await screen.findByRole('link', { name: 'Kalendar' })
    expect(screen.queryByRole('link', { name: 'Moj profil' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Administracija' })).not.toBeInTheDocument()
  })

  it('shows member links to a competitor and staff links to a moderator', async () => {
    renderAt('/sr', 'competitor')
    expect(await screen.findByRole('link', { name: 'Moj profil' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Red za proveru' })).not.toBeInTheDocument()

    renderAt('/sr', 'moderator')
    expect((await screen.findAllByRole('link', { name: 'Red za proveru' }))[0]).toBeVisible()
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

  it('closes the menu after following a link', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await user.click(await screen.findByRole('button', { name: 'Otvori meni' }))
    await user.click(screen.getByRole('link', { name: 'Timovi' }))

    expect(screen.getByRole('button', { name: 'Otvori meni' })).toBeInTheDocument()
  })

  it('switches the theme from the header', async () => {
    const user = userEvent.setup()
    renderAt('/sr')

    await user.click(await screen.findByRole('button', { name: 'Uključi tamnu temu' }))
    expect(document.documentElement.dataset.theme).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Uključi svetlu temu' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('offers the skip link as the first thing in the page', async () => {
    renderAt('/sr')

    const skip = await screen.findByRole('link', { name: 'Preskoči na sadržaj' })
    expect(skip).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
  })
})

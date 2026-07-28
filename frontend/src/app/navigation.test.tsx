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

  it('keeps the current screen when the language changes', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rang-liste')

    await user.click(screen.getByRole('link', { name: 'English' }))

    await waitFor(() => expect(document.documentElement.lang).toBe('en'))
    expect(screen.getByRole('heading', { level: 1, name: 'Rang liste' })).toBeVisible()
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
    expect(skip).toHaveAttribute('href', '#sadrzaj')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'sadrzaj')
  })
})

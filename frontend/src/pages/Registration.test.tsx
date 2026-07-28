import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'

describe('Registration', () => {
  it('is reachable from the navigation and renders the JSON definition', async () => {
    renderAt('/sr/registracija')

    expect(await screen.findByRole('heading', { level: 1, name: 'Registracija' })).toBeVisible()
    expect(screen.getByLabelText(/Ime/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Veličina majice/)).toBeInTheDocument()
  })

  it('shows what would be sent once the form is correct', async () => {
    const user = userEvent.setup()
    renderAt('/sr/registracija')

    await user.type(await screen.findByLabelText(/^Ime$/), 'Vladan')
    await user.type(screen.getByLabelText(/Prezime/), 'Đurišić')
    await user.type(screen.getByLabelText(/Adresa elektronske pošte/), 'vladan@primer.rs')
    await user.type(screen.getByLabelText(/Datum rođenja/), '1985-04-12')
    await user.selectOptions(screen.getByLabelText(/Pol/), 'M')
    await user.type(screen.getByLabelText(/Grad/), 'Beograd')
    await user.selectOptions(screen.getByLabelText(/Država/), 'RS')
    await user.selectOptions(screen.getByLabelText(/Veličina majice/), 'L')
    await user.click(screen.getByLabelText(/zdravstveno sposoban/))
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.getByText('Vladan')).toBeInTheDocument()
  })
})

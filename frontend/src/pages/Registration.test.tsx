import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'

async function fillEverythingExceptBirthDate(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/^Ime$/), 'Vladan')
  await user.type(screen.getByLabelText(/Prezime/), 'Đurišić')
  await user.type(screen.getByLabelText(/Adresa elektronske pošte/), 'vladan@primer.rs')
  await user.type(screen.getByLabelText(/^Lozinka$/), 'trkacka2027')
  await user.type(screen.getByLabelText(/Ponovi lozinku/), 'trkacka2027')
  await user.selectOptions(screen.getByLabelText(/Pol/), 'M')
  await user.type(screen.getByLabelText(/Grad/), 'Beograd')
  await user.selectOptions(screen.getByLabelText(/Država/), 'RS')
  await user.selectOptions(screen.getByLabelText(/Veličina majice/), 'XXXL')
  await user.click(screen.getByLabelText(/zdravstveno sposoban/))
}

describe('Registration', () => {
  it('renders the JSON definition, with sizes from XS to XXXL', async () => {
    renderAt('/sr/registracija')

    expect(await screen.findByRole('heading', { level: 1, name: 'Registracija' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'XS' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'XXXL' })).toBeInTheDocument()
  })

  it('writes the date of birth as dd/mm/gggg and puts the slashes in itself', async () => {
    const user = userEvent.setup()
    renderAt('/sr/registracija')

    const birth = await screen.findByLabelText(/Datum rođenja/)
    await user.type(birth, '12041985')

    expect(birth).toHaveValue('12/04/1985')
  })

  it('refuses a date that does not exist', async () => {
    const user = userEvent.setup()
    renderAt('/sr/registracija')

    await user.type(await screen.findByLabelText(/Datum rođenja/), '31022027')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByText('Unesi datum u obliku dd/mm/gggg.')).toBeVisible()
  })

  it('asks for a parent as soon as the date says the competitor is under sixteen', async () => {
    const user = userEvent.setup()
    renderAt('/sr/registracija')

    const birth = await screen.findByLabelText(/Datum rođenja/)
    expect(screen.queryByLabelText(/roditelja ili staratelja/)).not.toBeInTheDocument()

    await user.type(birth, '01012015')
    expect(screen.getByLabelText(/roditelja ili staratelja/)).toBeVisible()

    // And it goes away again once the date says otherwise.
    await user.clear(birth)
    await user.type(birth, '01011990')
    expect(screen.queryByLabelText(/roditelja ili staratelja/)).not.toBeInTheDocument()
  })

  it('will not submit when the two passwords differ', async () => {
    const user = userEvent.setup()
    renderAt('/sr/registracija')

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.clear(screen.getByLabelText(/Ponovi lozinku/))
    await user.type(screen.getByLabelText(/Ponovi lozinku/), 'nesto-drugo')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByText('Ne poklapa se sa prethodnim poljem.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).not.toBeInTheDocument()
  })

  it('puts the confirmation box before the words it confirms', async () => {
    renderAt('/sr/registracija')

    const box = await screen.findByLabelText(/zdravstveno sposoban/)
    const label = box.parentElement!.querySelector('label')!

    expect(box.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows what would be sent once the form is correct', async () => {
    const user = userEvent.setup()
    renderAt('/sr/registracija')

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.getByText('Vladan')).toBeInTheDocument()
  })
})

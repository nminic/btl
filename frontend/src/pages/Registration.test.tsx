import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { renderAt } from '../test/render'
import { NewResult } from './member/NewResult'
import { SessionProvider } from '../session/SessionProvider'
import { Registration } from './Registration'

/** After registration opens, so the form itself is on screen. */
const OPEN = '2026-10-02'

function renderForm(today = OPEN) {
  return render(
    <I18nProvider locale="sr">
      <MemoryRouter>
        <Registration today={today} />
      </MemoryRouter>
    </I18nProvider>,
  )
}

async function fillEverythingExceptBirthDate(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Ime$/), 'Vladan')
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

describe('Registration while it is shut', () => {
  it('offers no form at all during the period of looking around', () => {
    renderForm('2026-09-20')

    expect(screen.getByRole('heading', { name: 'Registracija još nije otvorena' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pošalji prijavu' })).not.toBeInTheDocument()
    expect(screen.getByText(/Otvara se za 11 dana/)).toBeVisible()
  })

  it('is shut on the route today, since October has not come', async () => {
    renderAt('/sr/registracija')

    expect(
      await screen.findByRole('heading', { name: 'Registracija još nije otvorena' }),
    ).toBeVisible()
  })
})

describe('Registration once it is open', () => {
  it('renders the JSON definition, with sizes from XS to XXXL', () => {
    renderForm()

    expect(screen.getByRole('heading', { level: 1, name: 'Registracija' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'XS' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'XXXL' })).toBeInTheDocument()
  })

  it('writes the date of birth as dd/mm/gggg and puts the slashes in itself', async () => {
    const user = userEvent.setup()
    renderForm()

    const birth = screen.getByLabelText(/Datum rođenja/)
    await user.type(birth, '12041985')

    expect(birth).toHaveValue('12/04/1985')
  })

  it('refuses a date that does not exist', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/Datum rođenja/), '31022027')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByText('Unesi datum u obliku dd/mm/gggg.')).toBeVisible()
  })

  it('asks for a parent as soon as the date says the competitor is under sixteen', async () => {
    const user = userEvent.setup()
    renderForm()

    const birth = screen.getByLabelText(/Datum rođenja/)
    expect(screen.queryByLabelText(/roditelja ili staratelja/)).not.toBeInTheDocument()

    await user.type(birth, '01012015')
    expect(screen.getByLabelText(/roditelja ili staratelja/)).toBeVisible()

    await user.clear(birth)
    await user.type(birth, '01011990')
    expect(screen.queryByLabelText(/roditelja ili staratelja/)).not.toBeInTheDocument()
  })

  it('will not submit when the two passwords differ', async () => {
    const user = userEvent.setup()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.clear(screen.getByLabelText(/Ponovi lozinku/))
    await user.type(screen.getByLabelText(/Ponovi lozinku/), 'nesto-drugo')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByText('Ne poklapa se sa prethodnim poljem.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).not.toBeInTheDocument()
  })

  it('takes a photograph as proof, and lets it be taken back', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <SessionProvider initialMemberNumber="000007">
            <NewResult />
          </SessionProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    const field = screen.getByLabelText(/Fotografija kao dokaz/) as HTMLInputElement
    const file = new File(['sadržaj'], 'sat.jpg', { type: 'image/jpeg' })

    await user.upload(field, file)
    expect(field.files?.[0].name).toBe('sat.jpg')

    // Clearing it must leave nothing behind rather than the word undefined.
    await user.upload(field, [])
    expect(field.files).toHaveLength(0)
  })

  it('puts the confirmation box before the words it confirms', () => {
    renderForm()

    const box = screen.getByLabelText(/zdravstveno sposoban/)
    const label = box.parentElement!.querySelector('label')!

    expect(box.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows what would be sent once the form is correct', async () => {
    const user = userEvent.setup()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.getByText('Vladan')).toBeInTheDocument()
  })
})

import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { first, must } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { NewResult } from './member/NewResult'
import { SessionProvider } from '../session/SessionProvider'
import { Registration } from './Registration'

/** After registration opens, so the form itself is on screen. */
const OPEN = '2026-10-02'

/* The day goes on the clock above the screen, which is where the portal keeps
   it and what the switch in the header moves (src/clock). */
function renderForm(today = OPEN) {
  return render(
    <ClockProvider simulatedDay={today}>
      <I18nProvider locale="sr">
        <MemoryRouter>
          <Registration />
        </MemoryRouter>
      </I18nProvider>
    </ClockProvider>,
  )
}

async function fillEverythingExceptBirthDate(user: ReturnType<typeof setupUser>) {
  await user.type(screen.getByLabelText(/^Ime$/), 'Vladan')
  await user.type(screen.getByLabelText(/Prezime/), 'Đurišić')
  await user.type(screen.getByLabelText(/Adresa elektronske pošte/), 'vladan@primer.rs')
  await user.type(screen.getByLabelText(/^Lozinka$/), 'trkacka2027')
  await user.type(screen.getByLabelText(/Ponovi lozinku/), 'trkacka2027')
  await user.selectOptions(screen.getByLabelText(/Pol/), 'M')
  /* Required since 31.07.2026: the shirt and the finisher medal are posted
     together once a member reaches twelve points, and a parcel needs an
     address. */
  await user.type(screen.getByLabelText(/^Adresa za slanje$/), 'Bulevar oslobođenja 12')
  await user.type(screen.getByLabelText(/^Mesto$/), 'Beograd')
  await user.selectOptions(screen.getByLabelText(/Država/), 'RS')
  /* Required since 31.07.2026: the biography is written here, at the moment of
     joining, and goes from here to a moderator for approval. */
  await user.type(screen.getByLabelText(/Svojim rečima/), 'Trčim zbog druženja.')
  await user.selectOptions(screen.getByLabelText(/Veličina majice/), 'XXXL')
  await user.click(screen.getByLabelText(/zdravstveno sposoban/))
}

describe('Registration while it is shut', () => {
  it('offers no form at all during the period of looking around', () => {
    renderForm('2026-09-20')

    expect(screen.getByRole('heading', { name: 'Registracija još nije otvorena' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pošalji prijavu' })).not.toBeInTheDocument()
    expect(screen.getByText(/Učlanjenje se otvara .*, za 11 dana\./)).toBeVisible()
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
    const user = setupUser()
    renderForm()

    const birth = screen.getByLabelText(/Datum rođenja/)
    await user.type(birth, '12041985')

    expect(birth).toHaveValue('12/04/1985')
  })

  it('refuses a date that does not exist', async () => {
    const user = setupUser()
    renderForm()

    await user.type(screen.getByLabelText(/Datum rođenja/), '31022027')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByText('Unesi datum u obliku dd/mm/gggg.')).toBeVisible()
  })

  it('asks for a parent as soon as the date says the competitor is under sixteen', async () => {
    const user = setupUser()
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
    const user = setupUser()
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
    const user = setupUser()
    render(
      <ClockProvider>
        <I18nProvider locale="sr">
          <MemoryRouter>
            <SessionProvider initialMemberNumber="000007">
              <NewResult />
            </SessionProvider>
          </MemoryRouter>
        </I18nProvider>
      </ClockProvider>,
    )

    const field = screen.getByLabelText(/Fotografija kao dokaz/) as HTMLInputElement
    const file = new File(['sadržaj'], 'sat.jpg', { type: 'image/jpeg' })

    await user.upload(field, file)
    /* A field holding nothing answers `null` here and one that was emptied
       answers a list of length nought, and both mean the same thing: no
       photograph was taken. Read as the empty list, so that either way this
       fails saying the list was empty rather than passing on an undefined. */
    expect(first(field.files ?? []).name).toBe('sat.jpg')

    // Clearing it must leave nothing behind rather than the word undefined.
    await user.upload(field, [])
    expect(field.files).toHaveLength(0)
  })

  it('puts the confirmation box before the words it confirms', () => {
    renderForm()

    const box = screen.getByLabelText(/zdravstveno sposoban/)
    const label = must(
      must(box.parentElement, 'a parent').querySelector('label'),
      'a label beside the box',
    )

    expect(box.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('says what happens next once the form is correct, and never the password', async () => {
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    /* The address the letter went to, what it is for, where to look if it does
       not arrive, and a way to ask for another one (PDL P22). */
    expect(screen.getByText(/vladan@primer\.rs/)).toBeVisible()
    expect(screen.getByText(/neželjenu poštu/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pošalji potvrdu ponovo' })).toBeVisible()

    /* And never what was typed. This screen used to print every field under its
       own name in the code, the password among them, in plain sight. */
    expect(screen.queryByText(/trkacka2027/)).not.toBeInTheDocument()
    expect(screen.queryByText('password')).not.toBeInTheDocument()

    /* Asking for the letter again says so and stays where it is. It used to
       empty the confirmation and hand back a blank form, so nothing said the
       letter had gone out and everything typed was lost. */
    await user.click(screen.getByRole('button', { name: 'Pošalji potvrdu ponovo' }))
    expect(screen.getByText(/poslata ponovo/)).toBeVisible()
    expect(screen.getByText(/vladan@primer\.rs/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pošalji prijavu' })).not.toBeInTheDocument()
  })
})

describe('the address, at the moment of joining', () => {
  /* Required since 31.07.2026: the shirt and the finisher medal are posted
     together once a member reaches twelve points, and a parcel needs an
     address. */
  it('will not let the form through without it', async () => {
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12031990')
    await user.clear(screen.getByLabelText(/^Adresa za slanje$/))
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Adresa za slanje$/ })).toBeVisible()
  })
})

describe('the biography, at the moment of joining', () => {
  it('will not let the form through without it', async () => {
    /* Owner, 31.07.2026: it is written when the profile is created and goes from
       there for approval. Until now it was a field somewhere in the member area
       that most people never found, which is why most profiles in the data have
       none. */
    const user = setupUser()
    renderForm()

    await user.type(screen.getByLabelText(/^Ime$/), 'Vladan')
    await user.type(screen.getByLabelText(/Prezime/), 'Đurišić')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    const summary = screen.getByRole('alert')
    expect(within(summary).getByRole('link', { name: /Svojim rečima/ })).toBeInTheDocument()
  })

  it('says what happens to it, beside the field', async () => {
    renderForm()

    expect(screen.getByText(/Moderator ih pregleda pre nego što se pojave/)).toBeVisible()
  })
})

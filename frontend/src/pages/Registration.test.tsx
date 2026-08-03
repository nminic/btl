import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { translate, type Dictionary } from '../i18n/translate'
import sr from '../i18n/sr.json'
import { first, last, must } from '../test/at'
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
  /* Optional again since 03.08.2026 (PDL P8), and filled here because most
     members will fill it: the form has to go through with it as well as
     without. Never shown on the portal. */
  await user.type(screen.getByLabelText(/Broj telefona/), '+381601234567')
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

describe('the telephone', () => {
  it('is not asked for, and the form goes through without it', async () => {
    /* Optional again (owner, 03.08.2026, PDL P8), and that is what lets it
       stand on consent: consent has to be freely given, and it is not free if
       membership is impossible without it. The privacy policy says "optional,
       on your consent", so a form that refused to submit without it would make
       that sentence untrue.

       Written as a walk through the form rather than as a look at the JSON,
       because the JSON is what would be changed back. */
    const user = setupUser()
    renderForm()

    /* Read off the words beside the field. `not.toBeRequired()` was true of
       every field on the portal, because the renderer marks a required field
       with neither `required` nor `aria-required`: what it does is write
       "(neobavezno)" beside the ones that are not. */
    expect(screen.getByLabelText('Broj telefona (neobavezno)')).toBeVisible()

    await user.type(screen.getByLabelText(/^Ime$/), 'Vladan')
    await user.type(screen.getByLabelText(/Prezime/), 'Đurišić')
    await user.type(screen.getByLabelText(/Adresa elektronske pošte/), 'vladan@primer.rs')
    await user.type(screen.getByLabelText(/^Lozinka$/), 'trkacka2027')
    await user.type(screen.getByLabelText(/Ponovi lozinku/), 'trkacka2027')
    await user.selectOptions(screen.getByLabelText(/Pol/), 'M')
    await user.type(screen.getByLabelText(/^Adresa za slanje$/), 'Bulevar oslobođenja 12')
    await user.type(screen.getByLabelText(/^Mesto$/), 'Beograd')
    await user.selectOptions(screen.getByLabelText(/Država/), 'RS')
    await user.type(screen.getByLabelText(/Svojim rečima/), 'Trčim zbog druženja.')
    await user.selectOptions(screen.getByLabelText(/Veličina majice/), 'XXXL')
    await user.click(screen.getByLabelText(/zdravstveno sposoban/))
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  })
})

describe('the box a member writes about themselves in', () => {
  it('counts down what is left and refuses more than the limit', async () => {
    /* Owner, 01.08.2026. Three hundred and sixty is the limit the form has
       always carried; what it did with it was mark the field wrong after the
       fact. It refuses at the door now, and says how much room is left before
       anybody runs out of it. */
    const user = setupUser()
    renderForm()

    const box = screen.getByLabelText(/Svojim rečima/)

    expect(screen.getByText('Još 360 znakova')).toBeVisible()

    await user.type(box, 'Trčim zbog druženja.')
    expect(screen.getByText('Još 340 znakova')).toBeVisible()

    /* Tall enough for the whole of it from the start, so nothing that fits has
       to be read through a scrollbar. */
    expect(box).toHaveAttribute('rows', '6')
    expect(box).toHaveAttribute('maxlength', '360')
  })

  it('tells whoever cannot see the count that it is there', () => {
    /* The count was printed under the box and described by nothing, so a screen
       reader read the label and the rule on arrival and never the one number
       that says how much of the box is already spent. */
    renderForm()

    const box = screen.getByLabelText(/Svojim rečima/)
    const described = box.getAttribute('aria-describedby') ?? ''
    const counter = must(document.getElementById(last(described.split(' '))), 'brojač')

    expect(counter).toHaveTextContent('Još 360 znakova')
  })

  it('counts in Serbian, which has three forms and not one', () => {
    /* "Još 1 znakova" is not a sentence anybody writes. The engine has had
       plural forms since it was written and this key was a single string. */
    expect(translate(sr as Dictionary, 'sr', 'registration.bioLeft', { count: 1 })).toBe(
      'Još 1 znak',
    )
    expect(translate(sr as Dictionary, 'sr', 'registration.bioLeft', { count: 3 })).toBe(
      'Još 3 znaka',
    )
    expect(translate(sr as Dictionary, 'sr', 'registration.bioLeft', { count: 7 })).toBe(
      'Još 7 znakova',
    )
  })

  it('says so when there is no room left, rather than counting nought', async () => {
    const user = setupUser()
    renderForm()

    const box = screen.getByLabelText(/Svojim rečima/)
    await user.click(box)
    /* Exactly the limit, so the box is full and nothing was lost filling it. */
    await user.paste('x'.repeat(360))

    expect(box).toHaveValue('x'.repeat(360))
    /* Twice in the markup and once to a reader: the line under the box, hidden
       from the reader because the same words reach it through
       `aria-describedby`, and the region that says it. The region is on the page
       from the start and empty until now, because one that is added together
       with its text is one a screen reader often misses. */
    expect(screen.getAllByText('Dosta je, granica je 360 znakova.')).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('Dosta je, granica je 360 znakova.')
  })

  it('keeps the region quiet while there is still room', () => {
    /* It used to hold the count and change on every keystroke, which is three
       hundred and fifty-nine announcements of a number nobody was waiting to
       hear, each one to be got through before anything else could be said. */
    renderForm()

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('says how much of a paste was thrown away, rather than throwing it away in silence', async () => {
    /* The limit is refused at the door, and the browser refuses in silence: 400
       characters into a box that holds 360 keeps 360 and drops 40 without a
       word. The counter then reads "the box is full", which is read as "I
       filled it". */
    const user = setupUser()
    renderForm()

    const box = screen.getByLabelText(/Svojim rečima/)
    await user.click(box)
    await user.paste('x'.repeat(400))

    const said = 'Nalepljeni tekst je bio 40 znakova duži nego što staje, pa taj višak nije primljen.'

    /* On the screen once and to a reader once: the visible sentence is hidden
       from the reader, and the region that was there all along says it. */
    expect(screen.getAllByText(said)).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent(said)

    /* And it goes the moment the writer does anything themselves. Not when the
       box drops below its limit, which was the first rule and left the message
       standing through every edit that kept the length: typing over a selected
       character is an edit the writer made and the length does not move. */
    await user.type(box, '{Backspace}x')
    expect(screen.queryByText(/Nalepljeni tekst/)).toBeNull()
  })

  it('counts what a paste over a selection really loses, not what it brought', async () => {
    /* Pasting over the whole box is not an overflow: what the selection gives
       back is room. Without this the rule is arithmetic no test touches, so
       taking the two the wrong way round would go green.

       The event is dispatched rather than performed, because neither Ctrl+A nor
       a selection set on the element moves the selection userEvent pastes
       against, and a paste into a box that is full is the other case, not this
       one. What is being checked is the arithmetic the handler does with the
       selection it is given, and that is exactly what this hands it. */
    const user = setupUser()
    renderForm()

    const box = screen.getByLabelText<HTMLTextAreaElement>(/Svojim rečima/)
    await user.click(box)
    await user.paste('x'.repeat(360))

    box.setSelectionRange(0, 360)
    fireEvent.paste(box, { clipboardData: { getData: () => 'y'.repeat(380) } })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Nalepljeni tekst je bio 20 znakova duži nego što staje, pa taj višak nije primljen.',
    )
  })

  it('does not charge a Windows clipboard for its line endings', async () => {
    /* The clipboard carries CR LF and a textarea keeps LF, so counting the
       clipboard as it comes charges the writer one character per line for
       something the box never held. Ten lines of thirty-six, which is 360 in
       the box and 369 on the clipboard: it all fits, and nothing is lost. */
    const user = setupUser()
    renderForm()

    const box = screen.getByLabelText(/Svojim rečima/)
    await user.click(box)
    await user.paste(Array.from({ length: 10 }, () => 'x'.repeat(35)).join('\r\n'))

    expect(screen.queryByText(/Nalepljeni tekst/)).toBeNull()
  })

  it('says nothing when the paste fits', async () => {
    const user = setupUser()
    renderForm()

    const box = screen.getByLabelText(/Svojim rečima/)
    await user.click(box)
    await user.paste('x'.repeat(40))

    expect(screen.queryByText(/Nalepljeni tekst/)).toBeNull()
    expect(screen.getByText('Još 320 znakova')).toBeVisible()
  })
})

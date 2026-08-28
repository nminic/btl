import { SLOW } from '../test/slow'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { I18nProvider } from '../i18n/I18nProvider'
import { translate } from '../i18n/translate'
import sr from '../i18n/sr.json'
import { first, inputElement, last, must } from '../test/at'
import { renderAt } from '../test/render'
import { inside, SEP, sources, WHOLE_PORTAL } from '../test/sources'
import { setupUser } from '../test/user'
import { NewResult } from './member/NewResult'
import { SessionProvider } from '../session/SessionProvider'
import { Registration } from './Registration'

/** After registration opens, so the form itself is on screen. */
const OPEN = '2026-10-02'

/* The day goes on the clock above the screen, which is where the portal keeps
   it and what the switch in the header moves (src/clock). */
function renderForm(today = OPEN, address = '/sr/registracija') {
  return render(
    <ClockProvider simulatedDay={today}>
      <I18nProvider locale="sr">
        {/* The address matters to one pair of tests and to nothing else: a
            member who arrives by somebody's referral link arrives with the code
            in the query, and that is the only fact the programme rests on. */}
        <MemoryRouter initialEntries={[address]}>
          <Registration />
        </MemoryRouter>
      </I18nProvider>
    </ClockProvider>,
  )
}

async function fillEverythingExceptBirthDate(
  user: ReturnType<typeof setupUser>,
  /** Left out where the test is about the picture being missing: a file input
   *  cannot be cleared once it holds something (`user.clear` refuses it). */
  { picture = true }: { picture?: boolean } = {},
) {
  await user.type(screen.getByLabelText(/^Ime$/), 'Vladan')
  await user.type(screen.getByLabelText(/^Prezime$/), 'Đurišić')
  /* Obligatory since 20.08.2026: the register of members the association keeps
     by law asks for the father's name and for the number of an identity
     document, and neither is shown anywhere on the portal. */
  await user.type(screen.getByLabelText(/^Ime oca$/), 'Milan')
  await user.type(screen.getByLabelText(/^Broj ličnog dokumenta$/), '123456789')
  await user.type(screen.getByLabelText(/Adresa elektronske pošte/), 'vladan@primer.rs')
  await user.type(screen.getByLabelText(/^Lozinka$/), 'trkacka2027')
  await user.type(screen.getByLabelText(/Ponovi lozinku/), 'trkacka2027')
  /* Buttons since 11.08.2026, not a list: two answers worth seeing at once. */
  await user.click(screen.getByRole('radio', { name: 'Muški' }))
  /* Required since 31.07.2026: the shirt and the finisher medal are posted
     together once a member reaches twelve points, and a parcel needs an address.
     The same field is the address of residence in the register of members
     (owner, 20.08.2026). The telephone stands beside it and is optional, so
     nothing here fills it. */
  await user.type(screen.getByLabelText(/^Adresa za slanje$/), 'Bulevar oslobođenja 12')
  /* The town carries the country: picked out of the codebook, which is what
     fills the one beside it (forms/PlaceField.tsx). */
  await user.type(screen.getByLabelText(/^Mesto$/), 'Beograd')
  /* Either the beginners' category or the one for their age, and the portal
     asks rather than assumes (PDL P7). */
  await user.click(screen.getByRole('radio', { name: 'Starosna' }))
  /* Required since the list of obligatory fields was written, and given its
     place in the layout on 11.08.2026: the picture stands to the left of the
     box below, in a row of its own two. */
  if (picture) {
    await user.upload(
      screen.getByLabelText(/Profilna slika/),
      new File(['slika'], 'vladan.jpg', { type: 'image/jpeg' }),
    )
  }
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

  it('asks the parent which of the three they are', async () => {
    /* Owner, 31.07.2026 and again 11.08.2026: the signature is kept with the
       relationship („padajući izbor: majka, otac, staratelj"), the date and time
       and the address it came from. The terms and the rulebook say the
       relationship is chosen and the privacy policy says what is kept with the
       signature; the form asked for the name and never for the relationship, so
       the portal promised a choice it never offered. */
    const user = setupUser()
    renderForm()

    expect(screen.queryByLabelText(/Srodstvo/)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/Datum rođenja/), '01012015')

    const kinship = screen.getByLabelText(/Srodstvo/)

    /* A list and not buttons: the decision says „padajući izbor" and it has not
       been changed, unlike the gender and the category, which the owner turned
       into buttons on 11.08.2026 and said so. */
    expect(kinship.tagName).toBe('SELECT')
    expect(within(kinship).getAllByRole('option').map((one) => one.getAttribute('value'))).toEqual([
      '',
      'mother',
      'father',
      'guardian',
    ])
    /* And it is asked for, like the signature beside it. */
    expect(kinship).toHaveAttribute('aria-required', 'true')
  })

  it('takes the message off a field a date of birth has just freed', async () => {
    /* The fourth of the four rules by which one field decides another (ADL A21),
       and the one a list written by hand left out. Measured by a round on
       23.08.2026: press „Pošalji prijavu" on an empty form and „Broj ličnog
       dokumenta" is asked for and says so; type a date of birth under sixteen and
       the form stops asking, while the message and `aria-invalid` stayed on. The
       screen then says the field is wrong and that nothing is being asked of it,
       in the same breath.

       On the real registration form and not a made-up one, because this is the
       only form on the portal carrying `optionalWhenYoungerThan`, and a definition
       written inside a test would leave the real one free to lose the rule. */
    const user = setupUser()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    const document = screen.getByLabelText(/^Broj ličnog dokumenta$/)

    expect(document).toHaveAttribute('aria-required', 'true')
    expect(document).toHaveAttribute('aria-invalid', 'true')
    expect(must(document.getAttribute('aria-describedby'), 'what describes the document')).toContain(
      'error',
    )

    await user.type(screen.getByLabelText(/Datum rođenja/), '01012015')

    expect(
      document,
      'the form goes on asking for a document a child has not got',
    ).not.toHaveAttribute('aria-required')
    expect(document, 'the field still reads as wrong').toHaveAttribute('aria-invalid', 'false')
    /* And the words themselves are gone, not only the flag beside them. */
    expect(
      document.getAttribute('aria-describedby'),
      'the message stands under a field the form has stopped asking about',
    ).not.toContain('error')
  })

  it('keeps who brought a member who arrived by a referral link', async () => {
    /* The address said `?preporuka=` and nothing read it. The link was written
       on the membership screen, printed for the member to share, and the one
       fact the whole programme rests on was dropped at the door: no record
       could say who brought whom, so no credit could ever be worked out, and
       the balance beside the link was the string „0" written out.
     *
       Owner, 12.08.2026: the link brings 5 EUR / 600 RSD „po novom članu koji
       se registrovao preko tog linka i članarina mu je postala aktivirana prvi
       naredni put". This is the first half. The second half is `active` on the
       membership screen. */
    const user = setupUser()
    renderForm(OPEN, '/sr/registracija?preporuka=7f07b38ff7ee7543')

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.getByText(/zabeležena kao preporuka/)).toBeVisible()
    /* And whoever brought them is not named: the code belongs to that member,
       not to this one. */
    expect(screen.queryByText(/7f07b38ff7ee7543/)).not.toBeInTheDocument()
  }, SLOW)

  it.each([
    ['a link that lost its code while being copied', '/sr/registracija?preporuka='],
    ['a code of the wrong shape', '/sr/registracija?preporuka=nemaovakvogkoda'],
    ['anything at all', '/sr/registracija?preporuka=%22%3E%3Cimg+src%3Dx+onerror%3Dalert(1)%3E'],
  ])('refuses %s', async (_what, address) => {
    /* `get` answers the empty string for a parameter with nothing after it, not
       null, so the first of these was recorded as a referral: somebody was told
       „Prijava je zabeležena kao preporuka" over a credit nobody could ever be
       paid, and `referredBy: ''` went out, a third state the record's own type
       does not have.

       The third arrived word for word in what is sent, sixty eight characters of
       it. React draws none of it and nothing puts it in an address, so it is not
       an attack today; it becomes one the day a backend keeps it and an
       administration screen writes out who brought whom. */
    const user = setupUser()
    renderForm(OPEN, address)

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.queryByText(/zabeležena kao preporuka/)).not.toBeInTheDocument()
  }, SLOW)

  it('says nothing about a referral to somebody who arrived without one', async () => {
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.queryByText(/zabeležena kao preporuka/)).not.toBeInTheDocument()
  }, SLOW)

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
  }, SLOW)

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

    const field = inputElement(screen.getByLabelText(/Slika kao dokaz/))
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
  }, SLOW)
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
  }, SLOW)
})

describe('the biography, at the moment of joining', () => {
  it('is asked for here, and the form goes through without it', async () => {
    /* Owner, 31.07.2026: it is written when the profile is created and goes from
       there for approval. Until then it was a field somewhere in the member area
       that most people never found, which is why most profiles in the data have
       none. Asked for at the moment of joining, and not demanded: the list of
       obligatory fields (PDL P8, 11.08.2026) does not hold it, and the privacy
       policy says in as many words that it is given „dobrovoljno", on consent.
       It was `required` in the definition all the same, so the portal refused a
       registration over a field its own policy calls voluntary. */
    const user = setupUser()
    renderForm()

    expect(screen.getByLabelText(/Svojim rečima/)).toBeVisible()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12031990')
    await user.clear(screen.getByLabelText(/Svojim rečima/))
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  }, SLOW)

  it('says what happens to it, beside the field, refusal and all', async () => {
    /* Both halves. It said only that a moderator reads it, which was the whole
       story while a biography was published as the moderator left it; since
       15.08.2026 it can come back (PDL P22), and the field beside which a member
       writes is where they should learn that. The picture has said as much all
       along, so the two now tell the same story. */
    renderForm()

    expect(screen.getByText(/Moderator ih pregleda/)).toBeVisible()
    expect(screen.getByText(/dobijaš razlog u poruci/)).toBeVisible()
    /* And it goes on to the second half, which the portal did not have until
       16.08.2026: a refused biography reached the member with a reason they had
       nowhere to act on. The panel in Podešavanja is where they act on it now
       (owner, 15.08.2026: „Panel u Podešavanjima, kao za sliku"), so the sentence
       beside the field says so. */
    expect(screen.getByText(/pišeš nov tekst u Podešavanjima/)).toBeVisible()
  })

  it('promises only what the portal does, and no more than one sentence of it', () => {
    /* Four attempts at mechanising this, and the fourth is the reason there is
       no fifth.
     *
       „These five words are not on the screen" was beaten by a review putting
       the same promise back in different words. „One form definition has a box
       for a biography" was beaten because the panel the owner decided on uses no
       form definition. „No source file contains `kind: 'bio'`" was beaten by
       `const kind = SORT`, and by double quotes: a guard that reads source text
       guards the spelling. Counting the controls on Settings was beaten twice
       over, because `findAllByRole` settles on the first tick with any match at
       all; and when that was fixed by waiting for the picture and giving the
       loop a turn, a review beat it again with a panel two turns out. That last
       one is the one that matters: a panel whose clock starts with the picture's
       is exactly the shape the real one has. A guard that misses the case it was
       written for is worse than none, because it reads as cover.
     *
       So the promise is held as a promise, exactly: the hint is spelt out here,
       word for word. That is a change of the dictionary nobody can make by
       accident, and the branch that builds the panel has to come through it.
     *
       And the net is back beside it, because taking it away was worse than
       keeping it. A review measured what the two actually catch: the source scan
       catches a panel written plainly, which is the shape most likely to be
       written, and misses one built through a variable or a second quotation
       mark; the spelt sentence catches nobody at all, it only catches a change of
       the words. Neither is a wall. Together they are a net with two holes rather
       than one with all of them, and a hole named in a comment is a hole somebody
       can step over. */
    expect(sr.registration.bioHint).toBe(
      'Nekoliko rečenica o sebi, najviše 360 znakova. Moderator ih pregleda; ako ih vrati, dobijaš razlog u poruci i pišeš nov tekst u Podešavanjima.',
    )

    /* And the net now names the one screen there is, rather than none.
     *
       It was written to fail the day a second place could send a biography for
       review, so that this sentence would be read again. That day was 16.08.2026
       and it worked: the panel arrived, the net fired, and the sentence gained
       its other half. What the net keeps saying from here on is that there is
       exactly one such place and this is it; a third would fail again.
     *
       What it does not catch is still named, so nobody reads it as cover: a
       panel that builds the sort through a variable, or writes it in double
       quotes, walks past. What it does catch is the plain one, which is how both
       the picture and this panel are written. */
    /* And the net is asked whether it caught anything at all before it is asked
       what it caught. Narrowed to one folder by accident, it would go on passing
       over a panel written in plain sight: measured, with the root cut to
       `src/clock`, the guard stayed green while the panel stood there. The same
       shape the repo already uses on its other source sweep
       (app/filterParams.test.ts). */
    const swept = sources()

    expect(swept.length).toBeGreaterThan(WHOLE_PORTAL)
    expect(swept.some(({ path }) => path.endsWith(inside('member', 'ProfileBio.tsx')))).toBe(true)
    /* And it holds no helper. Nothing under `src/test/` ships, so a sentence
       written in one of them is not something the portal does; read as though it
       were, a plain line in a comment there failed a guard about screens. Asked
       of the sweep itself, because no helper carries such a line today and so no
       ordinary test can tell the two sweeps apart. */
    expect(swept.filter(({ path }) => path.includes(inside('src', 'test', '')))).toEqual([])

    const sending = swept
      .filter(({ code }) => code.includes("kind: 'bio'") || code.includes('kind: "bio"'))
      /* Named from `src` down, and cut at the **last** `src` rather than the
         first: a checkout into a folder that itself carries `src` would otherwise
         make every path unrecognisable and this list impossible to read. */
      .map(({ path }) => path.slice(path.lastIndexOf(inside('src', ''))).split(SEP).join('/'))

    expect(sending).toEqual(['src/pages/member/ProfileBio.tsx'])
  })
})

describe('the country a member lives in', () => {
  it('is refused without a picture, which is an obligatory field', async () => {
    /* Obligatory since the list of obligatory fields was written (PDL P8), and
       it stayed obligatory when it was given its place in the layout on
       11.08.2026. The picture is how members recognise each other at a race, so
       a profile without one is a profile half made.

       Everything else is filled in, so the only thing keeping the form shut is
       the picture, and the refusal cannot be somebody else's. */
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user, { picture: false })
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).toBeNull()

    /* Said where the field is, and said again in the summary at the top, which
       is what carries a keyboard back to it. */
    const field = must(
      screen.getByLabelText(/Profilna slika/).closest<HTMLElement>('.field'),
      'the field the picture stands in',
    )

    expect(within(field).getByText('Ovo polje je obavezno.')).toBeVisible()
    expect(screen.getByLabelText(/Profilna slika/)).toHaveAttribute('aria-invalid', 'true')
    expect(
      within(screen.getByRole('alert')).getByRole('link', { name: /Profilna slika/ }),
    ).toHaveAttribute('href', '#field-photo')

    /* And it goes through once the picture is there. */
    await user.upload(
      screen.getByLabelText(/Profilna slika/),
      new File(['slika'], 'vladan.jpg', { type: 'image/jpeg' }),
    )
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  })

  it('is refused when the town was typed by hand and no country was picked', async () => {
    /* The country has no field of its own: the town carries it (PDL P6). What
       that cost was the rule that used to stand on the country field: a town the
       codebook does not know leaves the country as the form opened it, which is
       empty, and the registration went through with no country at all. The price
       and the way of paying it hang on it (PDL P8), and a member with no country
       is offered PayPal, which must never be offered to a member from Serbia. */
    const user = setupUser()
    renderForm()

    await user.type(screen.getByLabelText(/^Ime$/), 'Vladan')
    await user.type(screen.getByLabelText(/^Prezime$/), 'Đurišić')
    await user.type(screen.getByLabelText(/^Ime oca$/), 'Milan')
    await user.type(screen.getByLabelText(/^Broj ličnog dokumenta$/), '123456789')
    await user.type(screen.getByLabelText(/Adresa elektronske pošte/), 'vladan@primer.rs')
    await user.type(screen.getByLabelText(/^Lozinka$/), 'trkacka2027')
    await user.type(screen.getByLabelText(/Ponovi lozinku/), 'trkacka2027')
    await user.click(screen.getByRole('radio', { name: 'Muški' }))
    await user.type(screen.getByLabelText(/^Adresa za slanje$/), 'Bulevar oslobođenja 12')
    /* A hamlet of two hundred people that no codebook of the world has heard
       of, which is exactly what the field is allowed to take. */
    await user.type(screen.getByLabelText(/^Mesto$/), 'Zaseok pod brdom')
    await user.click(screen.getByRole('radio', { name: 'Starosna' }))
    await user.upload(
      screen.getByLabelText(/Profilna slika/),
      new File(['slika'], 'vladan.jpg', { type: 'image/jpeg' }),
    )
    await user.type(screen.getByLabelText(/Svojim rečima/), 'Trčim zbog druženja.')
    await user.selectOptions(screen.getByLabelText(/Veličina majice/), 'XXXL')
    await user.click(screen.getByLabelText(/zdravstveno sposoban/))
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByText('Izaberi državu uz mesto.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).toBeNull()

    /* And it goes through once the country is answered. */
    await user.selectOptions(screen.getByRole('combobox', { name: /^Država/ }), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  })
})

describe('an empty form', () => {
  it('says the town is missing, and not that a country was not chosen', async () => {
    /* The town and the country are one field and two controls, so the rule about
       the country was written beside the rule about the town and then over the
       top of it: an empty form said „Izaberi državu uz mesto." under a box
       nobody had typed into. The answer to that is to type the town, and the
       sentence sent whoever read it to the other control (WCAG 2.2 SC 3.3.1). */
    const user = setupUser()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.queryByText('Izaberi državu uz mesto.')).toBeNull()

    const town = screen.getByLabelText(/^Mesto$/)
    const said = must(town.getAttribute('aria-describedby'), 'what the town is described by')

    expect(town).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(said.split(' ').filter((one) => one.endsWith('-error'))[0] ?? ''))
      .toHaveTextContent('Ovo polje je obavezno.')
    /* And the country is not the one being pointed at. */
    expect(screen.getByRole('combobox', { name: /^Država/ })).toHaveAttribute('aria-invalid', 'false')
  })

  it('names the confirmation in the summary of errors without the mark in it', async () => {
    /* The sentence carries `{link}` where the link to the rulebook goes, and the
       summary writes the name of the field on its own: „Potvrđujem da sam
       upoznat sa {link} i da sam zdravstveno sposoban" is what a visitor read
       the day the first sentence carried one. A link inside a link is not a
       thing, so what the summary carries is the words the link would have led
       with (forms/worded.tsx). */
    const user = setupUser()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    const summary = within(screen.getByRole('alert'))
    const toConfirm = summary.getByRole('link', { name: /zdravstveno sposoban/ })

    expect(toConfirm).toHaveTextContent(
      'Potvrđujem da sam upoznat sa pravilnikom i da sam zdravstveno sposoban za rekreativan sport.',
    )
    expect(summary.queryByText(/\{link\}/)).toBeNull()
    /* And it is one link, not a link inside a link. */
    expect(within(toConfirm).queryByRole('link')).toBeNull()
  })

  it('points at the country once the town is one the codebook does not know', async () => {
    const user = setupUser()
    renderForm()

    await user.type(screen.getByLabelText(/^Mesto$/), 'Zaseok pod brdom')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    const country = screen.getByRole('combobox', { name: /^Država/ })

    expect(country).toHaveAttribute('aria-invalid', 'true')
    /* And the town is no longer the one being blamed for it. */
    expect(screen.getByLabelText(/^Mesto$/)).toHaveAttribute('aria-invalid', 'false')
    expect(screen.getByText('Izaberi državu uz mesto.')).toBeVisible()

    /* And the list of things to fix leads to the country, not to the town: it
       said „Mesto" and led to a box that was already filled in, while the one
       marked wrong could not be reached from the list at all. */
    const summary = within(screen.getByRole('alert'))
    const toFix = summary.getByRole('link', { name: /^Država/ })
    const at = must(toFix.getAttribute('href'), 'the address the summary points at')

    expect(document.getElementById(at.replace('#', ''))).toBe(country)
    expect(summary.queryByRole('link', { name: 'Mesto' })).toBeNull()

    /* And the town keeps saying how it works while somebody else's error is
       being shown: the rule and the error arrive as one string, so dropping the
       error dropped the rule with it. */
    const town = screen.getByLabelText(/^Mesto$/)
    const said = must(town.getAttribute('aria-describedby'), 'what describes the town')

    expect(said).toContain('field-city-hint')
    expect(said).not.toContain('field-city-error')

    /* And the country carries what is wrong with it, and not the rule that
       belongs to the town: given the whole of that, it was read out as „Država,
       od drugog slova portal nudi mesta iz svetskog šifarnika...", which is a
       rule about the other control. */
    const saidCountry = must(
      country.getAttribute('aria-describedby'),
      'what describes the country',
    )

    expect(saidCountry).toBe('field-city-error')
  })
})

describe('a town the codebook does know', () => {
  it('carries its country, so nothing more is asked', async () => {
    /* The other half of the rule above: a town out of the codebook answers the
       country itself, and the form goes through without anybody choosing one. */
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.queryByText('Izaberi državu uz mesto.')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  })
})

describe('the telephone', () => {
  it('never shows what the register of members asks for, once the form is sent', async () => {
    /* The father's name and the number of an identity document are collected for
       the register the association keeps by law, and the policy promises they
       are shown nowhere. The confirmation is the first screen that could break
       that promise, since it is the one holding what was just typed. */
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.queryByText(/123456789/)).toBeNull()
    expect(screen.queryByText(/Milan/)).toBeNull()
  })

  it('is asked for, optional, and the form goes through without it', async () => {
    /* Obligatory on 01.08.2026, optional on 03.08, gone on 11.08, and back as
       something optional on 20.08. What holds it here is that it is genuinely
       optional: the walk below never touches the field and the form still goes
       through. Written as a walk rather than as a look at the JSON, because the
       JSON is what would be changed back. */
    const user = setupUser()
    renderForm()

    /* The word beside the name is what makes it optional to a reader, and every
       field on the portal that may be left alone carries it (FormRenderer). */
    const phone = screen.getByLabelText(/^Telefon \(neobavezno\)$/)

    expect(phone).toBeVisible()
    expect(phone).not.toBeRequired()

    await fillEverythingExceptBirthDate(user)
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
    expect(translate(sr, 'sr', 'registration.bioLeft', { count: 1 })).toBe(
      'Još 1 znak',
    )
    expect(translate(sr, 'sr', 'registration.bioLeft', { count: 3 })).toBe(
      'Još 3 znaka',
    )
    expect(translate(sr, 'sr', 'registration.bioLeft', { count: 7 })).toBe(
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

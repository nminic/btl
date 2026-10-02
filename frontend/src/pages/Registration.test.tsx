import { SLOW } from '../test/slow'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { registracija } from '../forms/definitions'
import { I18nProvider } from '../i18n/I18nProvider'
import { first, inputElement, must } from '../test/at'
import { renderAt } from '../test/render'
import sr from '../i18n/sr.json'
import {
  answeredWith,
  did,
  forgetEveryCookie,
  refused,
  serverThat,
  type Asked,
} from '../test/serverAnswers'
import { setupUser } from '../test/user'
import { NewResult } from './member/NewResult'
import { SessionProvider } from '../session/SessionProvider'
import { Registration } from './Registration'

/** After registration opens, so the form itself is on screen. */
const OPEN = '2026-10-02'

/* The password every case here types, and its length is deliberately not this
 * file's to choose.
 *
 * WHY IT IS DERIVED AND NOT TYPED OUT. Until 20.09.2026 this was the literal
 * `trkacka2027`, eleven characters. That was never a password the portal would
 * have taken: `PasswordPolicy.SHORTEST` has kept twelve since the owner decided
 * it on 11.09.2026 (`ADL.md` A43), so every one of these cases was submitting
 * something the real server refuses. It passed only because
 * `registracija.form.json` had drifted to ten and nothing held the two numbers
 * together. `forms/passwordLength.test.ts` holds them now.
 *
 * So the length is read off the same definition this screen draws, which is the
 * copy that guard keeps equal to the server. Raise `SHORTEST` and this grows
 * with it; nobody has to remember this file, and it cannot go stale again the
 * one way it already did.
 *
 * None of the cases below are about the password. They type it because the form
 * will not submit without one, and what they then assert is the referral code,
 * the picture, the town, the register of members. */
const PASSWORD_FIELD = must(
  registracija.fields.find((field) => field.name === 'password'),
  'a password field on the registration form',
)

const PASSWORD = 'trkackaliga'.padEnd(
  must(PASSWORD_FIELD.minLength, 'a length rule on the registration password'),
  '7',
)

/* For the one case about the two boxes disagreeing. Built out of the password
   rather than written beside it, so it can never quietly become equal to it and
   can never be the shorter of the two: if it were refused for its length as
   well, that case would stop telling a mismatch apart from a short password. */
const A_DIFFERENT_PASSWORD = `${PASSWORD}-nije-ista`

/* EVERY CASE HERE HAS A SERVER IN FRONT OF IT, BECAUSE SINCE 21.09.2026 THIS SCREEN
 * SPEAKS TO ONE.
 *
 * Before that the press drew the confirmation by itself, so thirteen of these cases were
 * measuring a screen that told somebody „Poslali smo poruku na …" with nothing sent. The
 * default is a server that TAKES the registration, since the great majority of these
 * cases are about the form rather than about the answer; the handful that are about the
 * answer say so by installing their own. */
let server: { asked: Asked[]; stop: () => void } | null = null

/** What `POST /api/email-confirmation/resend` answers in this case, which is „done" unless a case
 *  says otherwise: the button is only on the screen after a registration was taken. */
let resendAnswer: (init: RequestInit | undefined) => Response | Promise<Response> = () => did()

function registrationAnswered(
  answer: (init: RequestInit | undefined) => Response | Promise<Response>,
): void {
  server?.stop()
  /* Null for everything else, which hands the request back to the disc reader: the
     codebook of towns is read that way, and these cases type into a place field. */
  server = serverThat((path, init) => {
    if (path === '/api/registration') {
      return answer(init)
    }

    return path === '/api/email-confirmation/resend' ? resendAnswer(init) : null
  })
}

/** The one registration this case sent, and nothing else that went over the wire. */
function whatWasSent(): Asked[] {
  return (server?.asked ?? []).filter((one) => one.path === '/api/registration')
}

/** Every time the letter was asked for again, in the order it was asked. */
function resendsSent(): Asked[] {
  return (server?.asked ?? []).filter((one) => one.path === '/api/email-confirmation/resend')
}

/** The body of that registration, as the server would parse it. */
function theBodySent(): unknown {
  const sent = must(whatWasSent()[0], 'a registration sent to the server')

  return JSON.parse(String(sent.init?.body))
}

beforeEach(() => {
  resendAnswer = () => did()
  forgetEveryCookie()
  /* The token already in the jar, so no case here spends a request being handed one.
     That the portal really can be handed one, and echoes it unchanged, is measured
     where it belongs (`account/askTheServer.test.ts`) rather than a second time here. */
  document.cookie = 'XSRF-TOKEN=imam'
  registrationAnswered(() => did())
})

afterEach(() => {
  server?.stop()
  server = null
  forgetEveryCookie()
})

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
  {
    /** What is typed into both password boxes. Handed in for the one pair of cases about
     *  a secret with a space in it, which is a value the portal must not alter. */
    password = PASSWORD,
    /** And the one case beside them about a name with spaces, which the portal must
     *  still trim. Without that pair nothing tells „leave the password alone" apart from
     *  „leave everything alone". */
    firstName = 'Vladan',
  }: /** ~~`picture`, left out where the case was about the picture being missing.~~ It
   *  went on 28.09.2026 with the field: the owner took the profile section out of the
   *  registration („Profilna sekcija se sa slikom i svojim recima izbacuje iz
   *  registracione forme - to ce clan popunjavati naknadno kad bude odobren"), so there
   *  is no picture here to leave out. */
  { password?: string; firstName?: string } = {},
) {
  await user.type(screen.getByLabelText(/^Ime$/), firstName)
  await user.type(screen.getByLabelText(/^Prezime$/), 'Đurišić')
  /* Obligatory since 20.08.2026: the register of members the association keeps
     by law asks for the father's name and for the number of an identity
     document, and neither is shown anywhere on the portal. */
  await user.type(screen.getByLabelText(/^Ime oca$/), 'Milan')
  await user.type(screen.getByLabelText(/^Broj ličnog dokumenta$/), '123456789')
  await user.type(screen.getByLabelText(/Adresa elektronske pošte/), 'vladan@primer.rs')
  await user.type(screen.getByLabelText(/^Lozinka$/), password)
  await user.type(screen.getByLabelText(/Ponovi lozinku/), password)
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
  /* ~~The picture stood here, to the left of the box below.~~ The owner took it out of
     the registration on 28.09.2026; it is given to `POST /api/me/photo` once the account
     is live, and `member/ProfilePicture.tsx` is the screen that sends it. */
  /* ~~The biography was typed here.~~ It left the form on 28.09.2026 with the picture,
     and is written afterwards on `member/ProfileBio.tsx`. */
  await user.selectOptions(screen.getByLabelText(/Veličina majice/), 'XXXL')
  await user.click(screen.getByLabelText(/zdravstveno sposoban/))
}

describe('Registration is never shut', () => {
  /* Owner, 27.09.2026 (PDL, „Zabrana registracije pre 01.10.2026 se SKIDA"): „Zapravo bih
     najradije da skinem tu zabranu i da mogu prijave odmah da krenu, a svakako niko nece
     pristupiti ovome pre nego sto sajt bude live 1.10." This block held the two cases that
     used to prove the opposite: a page saying the form was not open yet, drawn while
     `registrationOpen(today)` read false off the browser's own clock. That branch is gone,
     and what replaces it is not silence but its own claim, tested on both sides of the date
     it used to divide - a form that existed on one side of 15 October only must now be shown
     to exist on both, which is a different thing from no longer being hidden on the side it
     was hidden on. */
  it.each([
    ['well before 15 October', '2026-09-20'],
    ['after 15 October', OPEN],
  ])('renders the form %s, not the page that used to say it was shut', (_when, today) => {
    renderForm(today)

    expect(screen.getByRole('heading', { level: 1, name: 'Registracija' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pošalji prijavu' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Registracija još nije otvorena' }),
    ).not.toBeInTheDocument()
  })

  it('renders it through the real route as well, on a day before October', async () => {
    /* Through `renderAt` and the real route table rather than through `renderForm`, which is
       what the deleted case „is shut on the route on a day before October" measured: a
       review of an earlier branch found this screen's date once read off the calendar
       rather than off the route it was meant to guard (21.09.2026). There is no date left
       that changes the answer here, and that absence is the point being measured now. */
    renderAt('/sr/registracija', 'visitor', null, undefined, '2026-09-20')

    expect(await screen.findByRole('heading', { level: 1, name: 'Registracija' })).toBeVisible()
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

  it('forgets what it was told about a parent the moment it stops asking', async () => {
    /* Owner, 28.09.2026: „Ukoliko ukucam greskom 2026 godinu za koju mi trazi povezano
       lice, a onda promenim na 2006 godinu za koju mi ne trazi, bitno mi je da se ne
       cuvaju nepotrebni podaci o staratelju koje sam mozda uneo pa izgubio uvid u
       njih." His reason is the whole of it and it is not tidiness: he has lost sight of
       them. A third person named in a form nobody can see any more is a record with
       nothing holding it up (PDL P23 collects nothing that is not needed).

       BOTH DIRECTIONS, AND THE SECOND IS THE ONE THAT SHOWS. Going back to an age that
       asks again has to give EMPTY boxes; a form that hands back what was typed is the
       fault itself wearing the look of a convenience. Measured in a browser on
       28.09.2026 before the change, both came back - „Milan Đurišić" and „father" - so
       this case fails on the code as it stood.

       THE OTHER HOME OF THE SAME FACT IS THE BODY, and it is asserted separately, in
       „sends nothing about a parent…" below. Only one of the two was ever broken:
       `onScreen` has left hidden fields out of what is sent since it was written, so a
       case that looked only at the body passed the whole time the box still said the
       name. One of them alone says nothing about the other. */
    const user = setupUser()
    renderForm()

    const birth = () => screen.getByLabelText(/Datum rođenja/)

    await user.type(birth(), '01012015')
    await user.type(screen.getByLabelText(/roditelja ili staratelja/), 'Milan Đurišić')
    await user.selectOptions(screen.getByLabelText(/Srodstvo/), 'father')

    expect(screen.getByLabelText(/roditelja ili staratelja/), 'the form never took the name')
      .toHaveValue('Milan Đurišić')

    await user.clear(birth())
    await user.type(birth(), '01011990')

    expect(screen.queryByLabelText(/roditelja ili staratelja/)).not.toBeInTheDocument()

    await user.clear(birth())
    await user.type(birth(), '01012015')

    expect(screen.getByLabelText(/roditelja ili staratelja/), 'the name came back with the field')
      .toHaveValue('')
    expect(screen.getByLabelText(/Srodstvo/), 'the relationship came back with the field')
      .toHaveValue('')
  })

  it('does not scold an empty parent box it emptied itself', async () => {
    /* The other half of forgetting, and it is not the same half: the VALUE goes, and the
       message about the value has to go with it. Left behind, it comes back when the
       field does, and „Ovo polje je obavezno." then stands under a box that is empty
       only because the form emptied it, over an answer nobody was asked for again. That
       is the „jezivo, prenapadno" the owner threw out on 12.08.2026 arriving by a back
       door.

       The message has to be raised first for there to be anything to lose, which is why
       this sends the form once with the parent left blank. */
    const user = setupUser()
    renderForm()

    const birth = () => screen.getByLabelText(/Datum rođenja/)

    await user.type(birth(), '01012015')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByLabelText(/roditelja ili staratelja/), 'the parent was never refused')
      .toHaveAttribute('aria-invalid', 'true')

    await user.clear(birth())
    await user.type(birth(), '01011990')
    await user.clear(birth())
    await user.type(birth(), '01012015')

    expect(screen.getByLabelText(/roditelja ili staratelja/), 'the message came back with the field')
      .toHaveAttribute('aria-invalid', 'false')
  }, SLOW)

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

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
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

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.queryByText(/zabeležena kao preporuka/)).not.toBeInTheDocument()
  }, SLOW)

  it('leaves the form behind when it is sent, so the way back does not offer it again', async () => {
    /* The sixth screen that confirms a sending, and the last one still holding its
       confirmation in itself. Owner, 06.09.2026: „Popravi isto kao ostalih pet." Left as it
       was, one press forward brought the form back filled in, and this form carries the
       password, the electronic address, the street and the number of an identity document.

       Two presses, because the fault lives one step deep: without the replacing, the first
       press still lands on the level and only the second finds the form (review,
       06.09.2026). Drawn through the portal's own router rather than the memory one above,
       since the question is about history and only that router has any. */
    const user = setupUser()
    const { router } = renderAt('/sr/registracija', 'visitor', null, undefined, OPEN)

    const form = router.state.location.pathname

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()

    /* **And only two facts made the journey.** The whole of this change is what does not
       travel, and nothing measured it: written as `{ ...values, ... }` the entry would carry
       the password and the number of an identity document, and no case would fall, because
       neither is ever drawn and „never on the screen" does not reach them. The browser keeps
       this entry and hands it back when a session is restored, on the machine the member
       typed on (review, 06.09.2026; ADL A12 keeps the document number as the most sensitive
       thing the portal holds).

       Asserted as the whole of what is there, not as „the password is absent": a list of
       what must not be in it is a list somebody has to remember to extend. */
    expect(router.state.location.state).toEqual({
      sent: { email: 'vladan@primer.rs', referred: false },
    })

    await router.navigate(-1)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })

    await router.navigate(-1)

    expect(router.state.location.pathname).not.toBe(form)
  }, SLOW)

  it('says nothing about a referral to somebody who arrived without one', async () => {
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.queryByText(/zabeležena kao preporuka/)).not.toBeInTheDocument()
  }, SLOW)

  it('will not submit when the two passwords differ', async () => {
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.clear(screen.getByLabelText(/Ponovi lozinku/))
    await user.type(screen.getByLabelText(/Ponovi lozinku/), A_DIFFERENT_PASSWORD)
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

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    /* The address the letter went to, what it is for, where to look if it does
       not arrive, and a way to ask for another one (PDL P22). */
    expect(screen.getByText(/vladan@primer\.rs/)).toBeVisible()
    expect(screen.getByText(/neželjenu poštu/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pošalji potvrdu ponovo' })).toBeVisible()

    /* And never what was typed. This screen used to print every field under its
       own name in the code, the password among them, in plain sight.

       It looks for the very value this case typed, not for a copy of it written
       out here: a literal beside a derived password is two sources for one
       value, and the moment they drift this line searches the screen for a
       string nobody ever typed and passes without looking at anything. */
    expect(screen.queryByText(PASSWORD, { exact: false })).not.toBeInTheDocument()
    expect(screen.queryByText('password')).not.toBeInTheDocument()

    /* Asking for the letter again says so and stays where it is. It used to
       empty the confirmation and hand back a blank form, so nothing said the
       letter had gone out and everything typed was lost. What it says, and that it
       says it only once the server has answered, is the next block's. */
    await user.click(screen.getByRole('button', { name: 'Pošalji potvrdu ponovo' }))
    expect(await screen.findByText(sr.registration.resent)).toBeVisible()
    expect(screen.getByText(/vladan@primer\.rs/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pošalji prijavu' })).not.toBeInTheDocument()
  }, SLOW)
})

/**
 * THE LETTER ASKED FOR AGAIN, WHICH THE BUTTON SAID IT HAD SENT AND HAD NOT (PENDING stavka 26).
 *
 * <p>The button used to do `setResent(true)` and nothing else: the sentence under it told a member
 * that the confirmation had gone out again while no request had been made, and the case that held
 * the button (`says what happens next ...` above) only looked for that sentence, so it passed on
 * the lie. <b>What is measured here is what CROSSES THE WIRE</b>, which is the half that case
 * could not see: the request is recorded by the server the cases stand in front of, and its path,
 * its verb and its body are read back out of that record.
 *
 * <p><b>What the server answers is the same for every address</b> (`EmailConfirmationApi.resend`:
 * 204 whether the address belongs to nobody, to somebody already confirmed or to somebody waiting
 * on exactly this message, so that the route is no oracle for which addresses are members). A 204
 * therefore says „received", not „sent", and the sentence under the button says what that is worth:
 * <b>if</b> the address is still waiting, a message went out. The shape is `forgottenPassword.done`'s
 * for the same reason, and the words are the coordinator's proposal and not the owner's.
 *
 * <p><b>The address sent is the one the letter went to</b>, which is the only address this screen
 * holds: the form that took it is gone, replaced in the history by this confirmation
 * (`useSend`), and the entry carries two facts and the address is one of them.
 */
describe('the letter asked for again', () => {
  async function registered(user: ReturnType<typeof setupUser>) {
    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))
    await screen.findByRole('heading', { name: 'Prijava je zabeležena' })
  }

  const ASK = { name: 'Pošalji potvrdu ponovo' }

  it('is asked of the server, with the address the letter went to, as a POST', async () => {
    const user = setupUser()
    renderForm()

    await registered(user)

    expect(resendsSent(), 'asking happened before the button was pressed').toHaveLength(0)

    await user.click(screen.getByRole('button', ASK))

    expect(await screen.findByText(sr.registration.resent)).toBeVisible()

    const sent = must(resendsSent()[0], 'the request that asks for the letter again')

    expect(resendsSent()).toHaveLength(1)
    expect(sent.init?.method).toBe('POST')
    /* The whole body and not the key that is expected in it: `ResendTyped` has one component, and a
       second key sent beside it is a key nothing reads, which is the shape the registration body
       is written out name by name to make impossible. */
    expect(JSON.parse(String(sent.init?.body))).toEqual({ email: 'vladan@primer.rs' })
  }, SLOW)

  it('says nothing is sent until the server has answered, and says it is being asked', async () => {
    const holding: { answer: ((response: Response) => void) | null } = { answer: null }

    resendAnswer = () =>
      new Promise<Response>((resolve) => {
        holding.answer = resolve
      })

    const user = setupUser()
    renderForm()

    await registered(user)
    await user.click(screen.getByRole('button', ASK))

    /* While the request is out, which is the only moment the old behaviour is visible: it drew
       the sentence on the press. */
    expect(await screen.findByText(sr.registration.resending)).toBeVisible()
    expect(screen.queryByText(sr.registration.resent)).toBeNull()
    expect(screen.getByRole('button', ASK)).toHaveAttribute('aria-disabled', 'true')

    must(holding.answer, 'the answer the server was holding')(did())

    expect(await screen.findByText(sr.registration.resent)).toBeVisible()
    expect(screen.queryByText(sr.registration.resending)).toBeNull()
    /* And it goes once, like the registration: the sentence replaces the button, which is what
       keeps one member from asking the mail relay for a letter per press. */
    expect(screen.queryByRole('button', ASK)).toBeNull()
  }, SLOW)

  it('sends one request however many times the button is pressed while it is out', async () => {
    /* The ref and not the state, for the reason the registration carries: two presses that arrive
       before a redraw both read the state as not sending. The ordinary double press is what is
       measured, and that the guard lets go once the answer is here is the case below. */
    const holding: { answer: ((response: Response) => void) | null } = { answer: null }

    resendAnswer = () =>
      new Promise<Response>((resolve) => {
        holding.answer = resolve
      })

    const user = setupUser()
    renderForm()

    await registered(user)
    await user.click(screen.getByRole('button', ASK))
    await user.click(screen.getByRole('button', ASK))
    await user.click(screen.getByRole('button', ASK))

    expect(resendsSent()).toHaveLength(1)

    must(holding.answer, 'the answer the server was holding')(did())
    await screen.findByText(sr.registration.resent)
  }, SLOW)

  it.each([
    ['a bare 400', () => answeredWith(400), sr.server.malformed],
    ['a 403, which is the token the server did not recognise', () => answeredWith(403), sr.server.rejected],
    ['a 500', () => answeredWith(500), sr.server.wrong.replace('{status}', '500')],
    [
      'no answer at all',
      () => {
        throw new TypeError('Failed to fetch')
      },
      sr.server.nothing,
    ],
  ])('says what came back, and not that the letter went, on %s', async (_what, answer, words) => {
    resendAnswer = answer

    const user = setupUser()
    renderForm()

    await registered(user)
    await user.click(screen.getByRole('button', ASK))

    expect(await screen.findByText(words)).toBeVisible()
    expect(screen.queryByText(sr.registration.resent)).toBeNull()
    /* The button stays, because the letter has not gone and the one way to get it is to ask. */
    expect(screen.getByRole('button', ASK)).toBeVisible()
    expect(screen.getByRole('button', ASK)).not.toHaveAttribute('aria-disabled', 'true')
  }, SLOW)

  it('puts the keyboard on the sentence when the sentence replaces the button', async () => {
    /* A control taken out of the document under the focus drops a keyboard reader to the top of
       the page, and the sentence is where he was looking (WCAG 2.2 SC 2.4.3). */
    const user = setupUser()
    renderForm()

    await registered(user)
    await user.click(screen.getByRole('button', ASK))

    expect(await screen.findByText(sr.registration.resent)).toHaveFocus()
  }, SLOW)

  it('lets the next press through after a refusal, and then says it', async () => {
    resendAnswer = () => answeredWith(500)

    const user = setupUser()
    renderForm()

    await registered(user)
    await user.click(screen.getByRole('button', ASK))
    await screen.findByText(sr.server.wrong.replace('{status}', '500'))

    resendAnswer = () => did()
    await user.click(screen.getByRole('button', ASK))

    expect(await screen.findByText(sr.registration.resent)).toBeVisible()
    /* The refusal is gone with the press that followed it, and not left standing under a sentence
       that says the opposite. */
    expect(screen.queryByText(sr.server.wrong.replace('{status}', '500'))).toBeNull()
    expect(resendsSent()).toHaveLength(2)
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
    /* ~~And the summary above the form links to it.~~ The summary went on 28.09.2026;
       the cursor goes to the field instead (`forms/FormRenderer.tsx`, `owed`). This is
       the real form's version of that road, and the strongest shape it can take here:
       everything else on the form is answered, so the address is the ONE field that is
       wrong, and a cursor that merely went to the top of the form would fail. */
    const address = screen.getByLabelText(/^Adresa za slanje$/)

    expect(address).toHaveFocus()
    expect(address).toHaveAttribute('aria-invalid', 'true')
  }, SLOW)
})

describe('the biography', () => {
  it('is not asked for here at all, and the form goes through without it', async () => {
    /* Owner, 28.09.2026: „Profilna sekcija se sa slikom i svojim recima izbacuje iz
       registracione forme - to ce clan popunjavati naknadno kad bude odobren."

       ~~It was asked for at the moment of joining (owner, 31.07.2026), because before
       that it was a field somewhere in the member area that most people never found.~~
       The panel under Settings is that field's home now, and it is the one the owner
       decided on for a refused biography on 15.08.2026, so the words are written where
       they are also corrected.

       BOTH HALVES, for the reason the picture's case beside this one gives: that the box
       is not drawn is what was asked for, and that the form SENDS without it is what says
       the field was taken out rather than hidden behind a rule that still refuses. */
    const user = setupUser()
    renderForm()

    expect(screen.queryByLabelText(/Svojim rečima/)).toBeNull()
    /* And the words are gone from the whole screen, not only from a box: a legend or a
       summary line still saying them would read as a field nobody can find. */
    expect(screen.queryByText(/Svojim rečima/)).toBeNull()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12031990')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  }, SLOW)

  it('takes the whole profile section with it, so no empty part of the form is left', () => {
    /* The picture and the words were the two fields of one group, and a group is the
       fields that stand in it: „Profilna sekcija" is what the owner named, not two fields
       that happened to share a legend. Held here as well as in `fieldHint.test.tsx`,
       because that file reads the definition and this one reads the screen - a legend
       drawn from somewhere else would pass there and fail here.

       AND A GROUP THAT SHOULD BE THERE IS ASKED FOR FIRST, because „no group called
       Profil" is satisfied by a screen that draws no groups at all: a form that failed
       to render, a renderer that stopped drawing legends, a blank page. An absence can
       always be satisfied by nothing being there, so it is asked beside a presence. */
    renderForm()

    expect(screen.getByRole('group', { name: 'Takmičenje' })).toBeVisible()
    expect(screen.queryByRole('group', { name: 'Profil' })).toBeNull()
  })
})

describe('the profile picture', () => {
  it('is not asked for here at all, and the form goes through without one', async () => {
    /* Owner, 28.09.2026: „Profilna sekcija se sa slikom i svojim recima izbacuje iz
       registracione forme - to ce clan popunjavati naknadno kad bude odobren."

       ~~It was obligatory from the day the list of obligatory fields was written (PDL
       P8) and kept its place in the layout on 11.08.2026~~, and the case that stood here
       refused a registration without it. What did NOT change is that a picture is still
       approved and still cropped the same way: `member/ProfilePicture.tsx` sends it to
       `POST /api/me/photo` once the account is live, and the queue decides it there.

       BOTH HALVES, because either alone is half a guard. That the field is not drawn is
       what the owner asked for; that the form SENDS without it is what says the field
       was taken out rather than merely hidden behind a rule that still refuses. A field
       left in the definition and not drawn would pass the first and fail the second. */
    const user = setupUser()
    renderForm()

    expect(screen.queryByLabelText(/Profilna slika/)).toBeNull()
    /* And the label is gone from the whole screen, not only from a box: a legend or a
       summary line still saying it would read as a field the member cannot find. */
    expect(screen.queryByText(/Profilna slika/)).toBeNull()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  }, SLOW)
})

describe('the country a member lives in', () => {
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
    await user.type(screen.getByLabelText(/^Lozinka$/), PASSWORD)
    await user.type(screen.getByLabelText(/Ponovi lozinku/), PASSWORD)
    await user.click(screen.getByRole('radio', { name: 'Muški' }))
    await user.type(screen.getByLabelText(/^Adresa za slanje$/), 'Bulevar oslobođenja 12')
    /* A hamlet of two hundred people that no codebook of the world has heard
       of, which is exactly what the field is allowed to take. */
    await user.type(screen.getByLabelText(/^Mesto$/), 'Zaseok pod brdom')
    await user.click(screen.getByRole('radio', { name: 'Starosna' }))
    await user.selectOptions(screen.getByLabelText(/Veličina majice/), 'XXXL')
    await user.click(screen.getByLabelText(/zdravstveno sposoban/))
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByText('Izaberi državu uz mesto.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).toBeNull()

    /* And it goes through once the country is answered. */
    await user.selectOptions(screen.getByRole('combobox', { name: /^Država/ }), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  }, SLOW)
})

describe('an empty form', () => {
  it('draws no list of what is wrong above it, and puts the cursor in it instead', async () => {
    /* THE OWNER'S OWN SCREEN AND THE ONE HE PHOTOGRAPHED. 28.09.2026, over a picture of
       „Prijava nije poslata. Popravi ova polja:" with eleven links under it: „U strani
       registracije (a i na svim ostalim stranama) zbirne greske kao u prilogu ne treba
       da se pojavljuju. Dovoljna je validacija na nivou polja kako je sad u
       Registraciji."

       An empty registration is the worst case there is for this - fourteen fields are
       wrong at once - so if the box is ever rebuilt it is rebuilt here. Measured before
       the change: the box was 437px tall at 360, 412 at 768 and 387 at 1280, and the
       whole form sat under it.

       Asked as „is there anything announcing itself above the form" rather than by
       class name: what he objected to is the thing that hits the eye first, and one
       built again under another class would be the same thing to him and to a screen
       reader. The two halves of the replacement are asserted beside it, so a case that
       merely deleted the box could not pass: the field says what is wrong with it, and
       the cursor is put there. */
    const user = setupUser()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.queryByRole('alert'), 'a summary of broken fields came back')
      .not.toBeInTheDocument()
    expect(screen.queryByText(/Popravi ova polja/), 'the words of the summary came back')
      .toBeNull()

    const first = screen.getByLabelText(/^Ime$/)

    expect(first, 'the keyboard was left at the top of the document').toHaveFocus()
    expect(
      must(document.getElementById('field-firstName-error'), 'what the first field points at'),
      'the field says nothing about what is wrong with it',
    ).toHaveTextContent('Ovo polje je obavezno.')
  }, SLOW)

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

  it('never shows a visitor the mark where the link to the rulebook goes', async () => {
    /* ~~And names the confirmation in the summary of errors without the mark in it.~~
       The summary went on 28.09.2026, and with it the one place on this form that had
       to write the name of a field WITHOUT its link: a link inside a link is not a
       thing, so the list wrote the plain words instead (`forms/worded.tsx`,
       `plainWords`). Nothing on the registration asks for that shape any more, and
       `plainWords` is measured where it still has a reader, in
       `forms/FormRenderer.test.tsx` and on `pages/admin/EntityEditor.tsx`.

       WHAT SURVIVES IS THE HALF THAT IS ABOUT A VISITOR: the sentence carries `{link}`
       where the link goes, and „Potvrđujem da sam upoznat sa {link} i da sam
       zdravstveno sposoban" is what was really on the screen the day the first sentence
       carried one. Asserted over the whole form and not over one field, because the
       mark reaching the screen is a fault wherever it happens. */
    const user = setupUser()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.queryByText(/\{link\}/)).toBeNull()

    const confirm = screen.getByLabelText(/zdravstveno sposoban/)

    /* And the confirmation is drawn as one link inside its words, rather than as words
       with a mark left in them: without this the case above passes on a form that lost
       the link altogether. */
    expect(within(must(confirm.closest<HTMLElement>('.field'), 'the field of the confirmation'))
      .getByRole('link', { name: 'pravilnikom' })).toBeVisible()
    /* And it is marked wrong, which is what the cursor is found by now that there is no
       list to follow (`forms/FormRenderer.tsx`, `owed`). */
    expect(confirm).toHaveAttribute('aria-invalid', 'true')
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

    /* ~~And the list of things to fix leads to the country, not to the town: it said
       „Mesto" and led to a box that was already filled in, while the one marked wrong
       could not be reached from the list at all.~~ The list went on 28.09.2026 and the
       cursor took over its job, so what has to lead to the country is the mark, and it
       is the two assertions above: the country carries `aria-invalid="true"` and the
       town does not, which is the whole of what the cursor reads
       (`forms/FormRenderer.tsx`, `owed`). The cursor actually landing on the country
       half of a place is measured in `forms/FormRenderer.test.tsx`, „lands on the
       country when the country is the half that is wrong"; here the form is otherwise
       empty, so the first field that is wrong is the name and not this. */

    /* And the town says nothing at all while somebody else's error is shown. It
       used to keep its own rule beside it, because the rule and the error arrived
       as one string and dropping the error dropped the rule with it; since
       31.08.2026 the town carries no rule (the owner kept seven on the whole
       portal), so what is held is that the error of another control does not
       attach itself here. */
    const town = screen.getByLabelText(/^Mesto$/)

    expect(town.getAttribute('aria-describedby')).toBeNull()

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
    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  }, SLOW)
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

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
    expect(screen.queryByText(/123456789/)).toBeNull()
    expect(screen.queryByText(/Milan/)).toBeNull()
  }, SLOW)

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

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  }, SLOW)
})

/**
 * WHAT ACTUALLY GOES TO `/api/registration`, WHICH UNTIL 21.09.2026 WAS NOTHING AT ALL.
 *
 * <p>The screen drew „Prijava je zabelezena" and „Poslali smo poruku na …" on the press,
 * and no request had been made: `Registration.tsx` called `confirm(...)` and stopped. The
 * cases in this file all read a rendered sentence, so not one of them could see it.
 *
 * <p><b>These read the body instead, which is the half no drawn sentence shows.</b> The
 * other end of it - that a real server accepts exactly this - is measured in Java
 * (`RegistrationApiTest`); neither is the other.
 */
describe('what the registration sends', () => {
  /** The birthday of somebody comfortably over sixteen on the day the form opens. */
  const GROWN = '12041985'

  /** And of somebody who is fourteen on that day, so a guardian holds the account. */
  const A_CHILD = '20052012'

  async function fillAndSend(
    user: ReturnType<typeof setupUser>,
    born = GROWN,
    { beginner = false }: { beginner?: boolean } = {},
  ) {
    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), born)

    if (beginner) {
      await user.click(screen.getByRole('radio', { name: 'Početnička' }))
    }

    if (born === A_CHILD) {
      await user.type(screen.getByLabelText(/roditelja ili staratelja/), 'Milan Đurišić')
      await user.selectOptions(screen.getByLabelText(/Srodstvo/), 'father')
    }

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))
  }

  it('writes every answer under the name the route reads it by, and nothing else', async () => {
    /* ASSERTED AS THE WHOLE OF WHAT IS THERE, and that is the point of the case rather
       than a style of writing it. A mismatch of names is silent in both directions: the
       route reads a name it cannot find as null and answers „the form is not complete"
       naming no field, so a list of things that must be present would pass while a
       twentieth key nobody meant to send sat beside them.

       Three faults are held by this one comparison and each was real:

       - `firstSeason2027` is a BOOLEAN. The form offers the strings „yes" and „no", and
         `Typed.firstSeason2027` is a `Boolean`, so the word would have been refused by
         Jackson before the handler ran at all - a bare 400 with no reason in it, which
         no screen can turn into a sentence.
       - ~~`photo` IS ABSENT, because its value in the form is the name of a file on
         somebody's disc and the route does not collect a picture.~~ The field itself went
         on 28.09.2026, so there is no longer a value to leave out; what this comparison
         still says about it is that nothing put one back under another name.
       - `placeId` IS ABSENT. `ATownFromTheCodebookOrTyped` takes the codebook's mark or a
         name with a country and refuses BOTH TOGETHER, so a mark sent beside the name
         would refuse every registration this portal makes.

       And `passwordRepeat` is here at all only because `FormRenderer` hands it over
       beside what it sends: `onScreen` drops it, and with one argument this body could
       not be built. */
    const user = setupUser()
    renderForm()

    await fillAndSend(user)

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    expect(theBodySent()).toEqual({
      firstName: 'Vladan',
      lastName: 'Đurišić',
      fatherName: 'Milan',
      birthDate: '1985-04-12',
      gender: 'M',
      firstSeason2027: false,
      email: 'vladan@primer.rs',
      password: PASSWORD,
      passwordRepeat: PASSWORD,
      address: 'Bulevar oslobođenja 12',
      city: 'Beograd',
      country: 'RS',
      idNumber: '123456789',
      phone: '',
      shirtSize: 'XXXL',
      healthStatement: true,
      parentConsent: '',
      parentRelation: '',
      referredBy: null,
    })
  }, SLOW)

  it('posts it, rather than reading anything', async () => {
    /* The mutation this exists for is „send nothing at all": put `confirm(...)` back on
       the press and every other case in this file still passes, because every one of
       them reads a drawn sentence and the sentence would be drawn. */
    const user = setupUser()
    renderForm()

    await fillAndSend(user)

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    expect(must(whatWasSent()[0], 'the registration').init?.method).toBe('POST')
  }, SLOW)

  it('chooses the beginners category as a boolean the other way round too', async () => {
    /* The second state of the axis. With only the case above, `firstSeason2027: false`
       is satisfied by a line that answers false to everything. */
    const user = setupUser()
    renderForm()

    await fillAndSend(user, GROWN, { beginner: true })

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    expect(Reflect.get(Object(theBodySent()), 'firstSeason2027')).toBe(true)
  }, SLOW)

  it('carries the signature of a guardian for somebody under sixteen', async () => {
    /* The other state of the age axis, and the two fields move in opposite directions
       across it: at sixteen the identity card starts being asked for and the signature
       stops. Sent for a grown competitor they are empty strings, which is what the case
       above asserts, and the route reads a blank as nothing. */
    const user = setupUser()
    renderForm()

    await fillAndSend(user, A_CHILD)

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    const body = Object(theBodySent())

    expect(Reflect.get(body, 'parentConsent')).toBe('Milan Đurišić')
    expect(Reflect.get(body, 'parentRelation')).toBe('father')
    /* And the date is the child's, not the grown competitor's: without this the two
       cases differ only in two fields nothing else looks at. */
    expect(Reflect.get(body, 'birthDate')).toBe('2012-05-20')
  }, SLOW)

  it('sends nothing about a parent for somebody who stopped being a child', async () => {
    /* The second home of the fact the case „forgets what it was told about a parent…"
       holds on screen, and the two are asserted apart on purpose: this one has been
       right all along (`onScreen` drops a field the form has stopped asking for), so
       every guard over the body passed while the box still carried the name. A case
       that watched only this one would go on passing the day the dropping is taken out
       of the state again.

       THE MUTATION THAT FELLS IT IS THE REMOVAL OF THE FORGETTING, measured on
       28.09.2026: take `setValues(outside(held))` out of `FormRenderer` and this case
       fails beside the one on screen, 2 of 49.

       AND A BOUNDARY, WRITTEN DOWN BECAUSE IT WAS MEASURED AND NOT ASSUMED. The swap
       that ought to fell a case about the body - hand `onSubmit` the values as typed
       instead of `onScreen(filled)` - SURVIVES this, and the reason is worth knowing
       rather than hiding: once the form stops holding what it stops asking for, the two
       sources agree, so nothing can tell them apart from out here. `onScreen` is a
       second line and no case can see it fall on its own. It is kept anyway, because it
       is what the body's shape is written against and it answers for a caller that hands
       the form another definition without remounting it; but this case is held up by the
       forgetting, and saying otherwise would be a comment claiming a guard that is not
       there. */
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user)

    const birth = () => screen.getByLabelText(/Datum rođenja/)

    await user.type(birth(), A_CHILD)
    await user.type(screen.getByLabelText(/roditelja ili staratelja/), 'Milan Đurišić')
    await user.selectOptions(screen.getByLabelText(/Srodstvo/), 'father')

    await user.clear(birth())
    await user.type(birth(), GROWN)
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    const body = Object(theBodySent())

    expect(Reflect.get(body, 'parentConsent')).toBe('')
    expect(Reflect.get(body, 'parentRelation')).toBe('')
    /* And the registration went through as the grown competitor it now describes,
       rather than being refused for a reason that would have hidden all of the above. */
    expect(Reflect.get(body, 'birthDate')).toBe('1985-04-12')
  }, SLOW)

  it('carries the referral code itself, and never the empty string', async () => {
    /* `referredBy: ''` is a third state the record's own type does not have, and it went
       out for every address that said `?preporuka=` with nothing after it. The screen
       already refuses to SAY a referral was recorded in that case; this is the half that
       goes over the wire, which no drawn sentence shows. */
    const user = setupUser()
    renderForm(OPEN, '/sr/registracija?preporuka=7f07b38ff7ee7543')

    await fillAndSend(user)

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    expect(Reflect.get(Object(theBodySent()), 'referredBy')).toBe('7f07b38ff7ee7543')
  }, SLOW)

  it('sends the password exactly as it was typed, spaces and all', async () => {
    /* THE SECRET IS NOT TRIMMED, and until 21.09.2026 it was: `trimValues` trimmed every
       string, so „trkackaliga7 " arrived as „trkackaliga7" and the server hashed a string
       the member had never chosen. Signing in sends the password RAW
       (`session/SignIn.tsx`), so that member could then never sign in again with what he
       typed - and nothing said so, because the form compares the two boxes BEFORE the
       trim and measures the length AFTER it.

       Owner, 21.09.2026, `btl-produkt/ADL.md` A62c: a password is never trimmed anywhere.
       The fix lives in `trimValues` rather than here, so the next form that asks for a
       password inherits it.

       BOTH BOXES ARE ASSERTED, and that is the axis rather than a flourish: the repeated
       password travels through the second argument, which is trimmed by a separate call,
       so a fix that spared only one side would send two different strings for one typed
       value and the server would refuse a form filled in correctly.

       AND THE NAME BESIDE IT, which is what keeps this from being satisfied by switching
       trimming off altogether: „Vladan" is typed with no spaces here, so the name is read
       from the case below rather than from this one - see the next case. */
    const user = setupUser()
    renderForm()

    const withSpace = `${PASSWORD} `

    await fillEverythingExceptBirthDate(user, { password: withSpace })
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    const body = Object(theBodySent())

    expect(Reflect.get(body, 'password')).toBe(withSpace)
    expect(Reflect.get(body, 'passwordRepeat')).toBe(withSpace)
  }, SLOW)

  it('takes a password that is long enough only with its spaces, and sends it as typed', async () => {
    /* THE LENGTH IS MEASURED OVER WHAT IS SENT. The case above sends a password that is long
       enough with or without its space, so it says nothing about where the length is
       measured. This one reaches the minimum ONLY with the two spaces in front of it: on the
       server it is long enough (the server measures what arrives, and what arrives is what
       was typed), and until 02.10.2026 the form measured it trimmed, came to two short and
       refused it aloud (derived that day from `ADL.md` A62c in `PDL.md`, „Odluke iz ciscenja
       nalaza"). */
    const user = setupUser()
    renderForm()

    const spaced = `  ${PASSWORD.slice(2)}`

    await fillEverythingExceptBirthDate(user, { password: spaced })
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    expect(Reflect.get(Object(theBodySent()), 'password')).toBe(spaced)
  }, SLOW)

  it('goes on trimming everything that is not a secret', async () => {
    /* The other half, and without it the case above is satisfied by a fix that switches
       trimming off for the whole form: then „  Vladan  " would be stored with its spaces
       and no case here would fall. */
    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user, { firstName: '  Vladan  ' })
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    expect(Reflect.get(Object(theBodySent()), 'firstName')).toBe('Vladan')
  }, SLOW)

  it('sends one registration however many times the button is pressed', async () => {
    /* WHAT A SECOND PRESS COSTS HERE IS NOT WHAT IT COSTS ELSEWHERE. `/api/registration`
       writes an account and posts a letter, so the second request is answered 409 - and
       it is answered 409 because of the FIRST one, which means this very person is told
       his own address belongs to somebody else.

       Measured while the first answer is still out, which is the only moment the fault
       exists: the server here is handed a promise that has not come back. */
    /* Held on an object rather than in a bare `let`, and that is the compiler's habit
       rather than a taste: an assignment made inside a callback is invisible to the
       narrowing, so a plain variable stays „null" as far as the types are concerned. */
    const holding: { answer: ((response: Response) => void) | null } = { answer: null }

    registrationAnswered(
      () =>
        new Promise<Response>((resolve) => {
          holding.answer = resolve
        }),
    )

    const user = setupUser()
    renderForm()

    await fillAndSend(user)

    await waitFor(() => {
      expect(whatWasSent()).toHaveLength(1)
    })

    /* And the screen says so rather than looking unpressed, which is the reason somebody
       presses a second time at all. */
    expect(screen.getByText('Šaljemo prijavu...')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(whatWasSent()).toHaveLength(1)

    must(holding.answer, 'the answer the server was holding')(did())

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  }, SLOW)
})

/**
 * WHAT THE SCREEN DOES WITH AN ANSWER THAT IS NOT „DONE", WHICH UNTIL 21.09.2026 IT HAD
 * NO WAY OF HAVING.
 *
 * <p>The confirmation was drawn on the press, so a refusal had nowhere to appear and the
 * form it belonged to was already gone from the history: `useSend` REPLACES the entry
 * underneath before pushing the confirmation over it.
 */
describe('a registration the server refuses', () => {
  async function fillAndSend(user: ReturnType<typeof setupUser>) {
    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))
  }

  it('says the address is taken, in as many words, and keeps what was typed', async () => {
    /* THE 409, WHICH IS THE ONE REFUSAL ON THIS PORTAL THAT IS NOT A 400. Read as
       anything else it lands on „the server answered 409 and nothing changed, try again
       in a minute" - wrong twice, since trying again will never work and the one thing
       he can do was never said.

       That he is told at all is the owner's decision and not a choice of wording here
       (`btl-produkt/ADL.md`, 08.09.2026): „Registracija na vec zauzetu adresu kaze da je
       zauzeta." He was shown what it costs - anybody can then test whether an address
       belongs to a member - and took it. A vaguer sentence would quietly undo that. */
    registrationAnswered(() => refused('theAddressIsTaken', 409))

    const user = setupUser()
    renderForm()

    await fillAndSend(user)

    expect(await screen.findByText(/već član lige/)).toBeVisible()
    /* AND NOTHING MOVED. The confirmation is not drawn, the form is still here, and it
       still holds what was typed into it: the whole of this change is that the screen
       waits for an answer before it throws the form away. */
    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).toBeNull()
    expect(inputElement(screen.getByLabelText(/Adresa elektronske pošte/)).value).toBe(
      'vladan@primer.rs',
    )
    expect(inputElement(screen.getByLabelText(/^Ime$/)).value).toBe('Vladan')
  }, SLOW)

  it('tells a leaked password apart from a form the route would not take', async () => {
    /* Three refusals and three sentences, by name and never by number. Folded into one
       „something went wrong" the reader is handed a form to press again with no idea
       what to change, which is the fault `askTheServer` was written not to have. */
    registrationAnswered(() => refused('thePasswordHasLeaked'))

    const user = setupUser()
    renderForm()

    await fillAndSend(user)

    expect(await screen.findByText(/javno objavljenim provalama/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).toBeNull()
  }, SLOW)

  it('says the form was not taken when the route says so, and names no field', async () => {
    registrationAnswered(() => refused('theFormIsNotComplete'))

    const user = setupUser()
    renderForm()

    await fillAndSend(user)

    expect(await screen.findByText(/Server nije prihvatio prijavu/)).toBeVisible()
  }, SLOW)

  it('reads a refusal it has no sentence for out loud, code and all', async () => {
    /* A screen one release behind its server must not pick the nearest sentence it does
       have: the nearest sentence tells the reader to fix something that is not wrong.
       `account/refusals.test.ts` reads the Java source so this branch stays a boundary
       rather than a plan. */
    registrationAnswered(() => refused('theMoonIsInTheWrongHouse'))

    const user = setupUser()
    renderForm()

    await fillAndSend(user)

    expect(await screen.findByText(/theMoonIsInTheWrongHouse/)).toBeVisible()
  }, SLOW)

  /**
   * A 400 THAT NAMES NO REASON IS A REQUEST THE PORTAL SHOULD NEVER HAVE SENT, and the reader is
   * told so (owner, 02.10.2026, PENDING stavka 376; the sentence is the coordinator's proposal).
   *
   * <p><b>Measured on a real screen because the join is the thing.</b> `askTheServer` turns a 400
   * whose body names no reason into `{ got: 'wrong', status: 400 }` and `ServerSaid` turns that
   * into a sentence, and each file has a case of its own about its half; neither can fail on the
   * other. The three bodies are the three ways `reasonIn` answers nothing: no body at all, a body
   * Spring wrote itself (`error`, `status`, `path`, no `reason`), and a reason that is not text.
   *
   * <p>And a 400 that DOES name its reason keeps the sentence of that reason: the three cases
   * above this one hold it, so the new sentence is not what a 400 now always says.
   */
  it.each([
    ['no body at all', () => answeredWith(400)],
    [
      'a body of the shape Spring writes itself',
      () =>
        new Response(JSON.stringify({ status: 400, error: 'Bad Request', path: '/api/registration' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    ],
    [
      'a reason that is not text',
      () =>
        new Response(JSON.stringify({ reason: 7 }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    ],
  ])('says the fault is the portal’s, and nothing changed, on a 400 with %s', async (_what, answer) => {
    registrationAnswered(answer)

    const user = setupUser()
    renderForm()

    await fillAndSend(user)

    expect(await screen.findByText(sr.server.malformed)).toBeVisible()
    expect(screen.queryByText(sr.server.wrong.replace('{status}', '400'))).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).toBeNull()
  }, SLOW)

  it.each([404, 409, 500])(
    'keeps the number and the old advice for a %i that named no reason',
    async (status) => {
      /* The boundary of the sentence above, said as a case: the owner's decision is about the 400,
         so a number that is not 400 is not read as one. A bare 409 in particular is NOT the
         address being taken (that one names `theAddressIsTaken`), and is reported as a finding
         rather than changed here. */
      registrationAnswered(() => answeredWith(status))

      const user = setupUser()
      renderForm()

      await fillAndSend(user)

      expect(await screen.findByText(sr.server.wrong.replace('{status}', String(status)))).toBeVisible()
      expect(screen.queryByText(sr.server.malformed)).toBeNull()
    },
    SLOW,
  )

  it('says nothing came back when the server never answered', async () => {
    registrationAnswered(() => {
      throw new TypeError('Failed to fetch')
    })

    const user = setupUser()
    renderForm()

    await fillAndSend(user)

    expect(await screen.findByText(/nije uspeo da dođe do servera/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Prijava je zabeležena' })).toBeNull()
  }, SLOW)

  it('takes the last refusal off the screen while the next attempt is out', async () => {
    /* MEASURED WHILE THE SECOND REQUEST IS STILL IN FLIGHT, which is the only moment the
       fault exists. Left standing, somebody who corrected his form and pressed again
       reads the old sentence over a request that has not been answered, and cannot tell
       whether it is about the press he just made or the one before it. Once the answer
       arrives the sentence is replaced either way, so a case that looked afterwards would
       measure nothing. */
    registrationAnswered(() => refused('theAddressIsTaken', 409))

    const user = setupUser()
    renderForm()

    await fillEverythingExceptBirthDate(user)
    await user.type(screen.getByLabelText(/Datum rođenja/), '12041985')
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(await screen.findByText(/već član lige/)).toBeVisible()

    const holding: { answer: ((response: Response) => void) | null } = { answer: null }

    registrationAnswered(
      () =>
        new Promise<Response>((resolve) => {
          holding.answer = resolve
        }),
    )

    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(screen.getByText('Šaljemo prijavu...')).toBeVisible()
    expect(screen.queryByText(/već član lige/)).toBeNull()

    must(holding.answer, 'the answer the server was holding')(did())

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  }, SLOW)

  it('lets a second press through once the first has been refused', async () => {
    /* The other half of the guard above, and it is not decoration: a guard written with
       a ref that is never turned back would refuse every press for the rest of the
       visit, so somebody told to correct his form could never send it again. */
    registrationAnswered(() => refused('theFormIsNotComplete'))

    const user = setupUser()
    renderForm()

    await fillAndSend(user)
    expect(await screen.findByText(/Server nije prihvatio prijavu/)).toBeVisible()

    registrationAnswered(() => did())
    await user.click(screen.getByRole('button', { name: 'Pošalji prijavu' }))

    expect(await screen.findByRole('heading', { name: 'Prijava je zabeležena' })).toBeVisible()
  }, SLOW)
})

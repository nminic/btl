import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Competitor } from '../data/types'
import { ClockProvider } from '../clock/ClockProvider'
import { JUNIOR, PROCESSING_FEE_EUR } from '../data/pricing'
import { I18nProvider } from '../i18n/I18nProvider'
import { NOTIFICATION_KEYS } from '../session/context'
import { SessionProvider } from '../session/SessionProvider'
import { useSession } from '../session/useSession'
import { first, must } from '../test/at'
import { readQr } from '../test/readQr'
import { expectFrontPage, renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { Membership } from './member/Membership'
import { Messages } from './member/Messages'

/* The flows a member walks. The one that matters most is the last: a result
 * goes in, the moderator finds it, decides, and the member sees the decision.
 * That sequence is the reason for building the front end before the database. */

/** The members as the prototype serves them, read rather than restated: one test
 *  has to say what the data actually holds, not repeat a sentence about it. */
const competitors: Competitor[] = JSON.parse(
  readFileSync(join(process.cwd(), 'public/mock/competitors.json'), 'utf-8'),
)

/**
 * Membership on a given day.
 *
 * The day is put on the clock above the screen rather than handed to the screen,
 * which is exactly what the switch in the header does (src/clock). The screen
 * used to take it as a prop, so a test could put it on a day the rest of the
 * portal was not on, and nothing would say so.
 */
/** The one thing administration does that this file is about: it changes the
 *  referral amount, the way the price list screen changes it. */
function Administration({
  eur = '7',
  rsd = '840',
  name = 'izmeni preporuku',
}: {
  eur?: string
  rsd?: string
  name?: string
}) {
  const { editRecord } = useSession()

  return (
    <button type="button" onClick={() => editRecord('referral', { eur, rsd })}>
      {name}
    </button>
  )
}

/* 000032 by default and not 000001: an honorary member owes nothing and is shown
   no renewal at all (Pravilnik član 15, PDL P16), so every test about renewal
   needs somebody who actually pays. Of the thirty, three do, and this is the
   grown one of them living in Serbia. His membership is not active, which this
   screen has no branch for and which none of these tests is about. */
function renderMembershipOn(today: string, memberNumber = '000032') {
  return render(
    <ClockProvider simulatedDay={today}>
      <I18nProvider locale="sr">
        <MemoryRouter>
          <SessionProvider initialMemberNumber={memberNumber}>
            <Membership />
          </SessionProvider>
        </MemoryRouter>
      </I18nProvider>
    </ClockProvider>,
  )
}

describe('signing in', () => {
  it('turns a visitor into a competitor and lands on their profile', async () => {
    const user = setupUser()
    renderAt('/sr/prijava')

    await user.selectOptions(await screen.findByLabelText('Ko si?'), '000007')
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }))

    expect(await screen.findByRole('heading', { name: 'Moje stvari' })).toBeVisible()
    // Member screens are now in the navigation, and also among the actions on
    // the profile, so there is deliberately more than one way in.
    expect(screen.getAllByRole('link', { name: 'Moji rezultati' }).length).toBeGreaterThan(0)
  })

  it('says the one field it has is obligatory, as every field on the portal does', async () => {
    /* Owner, 12.08.2026: the rule holds „na svim formama za unos i
       verifikaciju", and this is the smallest form the portal has. It carried
       the browser's own `required` and nothing else, so it said nothing to a
       reader and drew no star (forms/AskedLabel.tsx). */
    renderAt('/sr/prijava')

    const who = await screen.findByLabelText('Ko si?')

    expect(who).toHaveAttribute('aria-required', 'true')
    expect(who).not.toHaveAttribute('required')
    expect(screen.getByText('Polja sa zvezdicom su obavezna.')).toBeVisible()
    expect(
      must(who.closest('.rankings__field'), 'the field it stands in').querySelector(
        '.field__required',
      ),
    ).not.toBeNull()
  })

  it('will not sign anybody in until somebody is chosen', async () => {
    /* The `required` this form used to carry was taken off and replaced by a
       lone `disabled` on the button, which nothing held: delete it and all 1789
       tests still passed, because an expression in a JSX attribute is not a
       branch coverage counts. What it was hiding: pressing the button signed the
       session in as the empty string and walked to a profile headed „Ovog
       profila nema."
     *
       So it is pressed here, not inspected, and told off rather than switched
       off, which is what the portal does everywhere else it refuses a press. */
    const user = setupUser()
    renderAt('/sr/prijava')

    const send = await screen.findByRole('button', { name: 'Prijavi se' })

    expect(send).toHaveAttribute('aria-disabled', 'true')
    expect(send).not.toBeDisabled()
    expect(send).toHaveAccessibleDescription('Izaberi člana da bi mogao da se prijaviš.')

    await user.click(send)

    expect(screen.getByLabelText('Ko si?')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Ovog profila nema.' })).not.toBeInTheDocument()

    /* And once somebody is chosen it goes through, so the guard cannot be
       „refuse always". */
    await user.selectOptions(screen.getByLabelText('Ko si?'), '000001')

    expect(send).toHaveAttribute('aria-disabled', 'false')

    await user.click(send)

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
  })

  it('says the prototype takes your word for it', async () => {
    renderAt('/sr/prijava')

    expect(await screen.findByText(/veruje na reč/)).toBeVisible()
  })
})

describe('member screens without a session', () => {
  it.each([
    ['/sr/moj-profil'],
    ['/sr/moji-rezultati'],
    ['/sr/moja-clanarina'],
    ['/sr/poruke'],
    ['/sr/poruke/msg-1'],
    ['/sr/podesavanja'],
    ['/sr/rezultat/novi'],
  ])('sends %s to the sign in notice', async (path) => {
    renderAt(path, 'competitor')

    expect(await screen.findByRole('heading', { name: 'Za ovo treba prijava' })).toBeVisible()
  })
})

describe('my profile', () => {
  it('shows the profile with the things only its owner can do', async () => {
    renderAt('/sr/moj-profil', 'competitor', '000007')

    expect(await screen.findByRole('heading', { name: 'Moje stvari' })).toBeVisible()
    // The profile itself is the same one everyone else sees.
    expect(screen.getByRole('table', { name: 'Rezultati' })).toBeVisible()
    // Notifications and the theme left the profile for the settings screen.
    expect(screen.queryByRole('heading', { name: 'Obaveštenja' })).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Podešavanja' }),
    ).toHaveAttribute('href', '/sr/podesavanja')
  })

  it('signs out again', async () => {
    const user = setupUser()
    renderAt('/sr/moj-profil', 'competitor', '000007')

    await user.click(await screen.findByRole('button', { name: 'Odjavi se' }))

    expect(screen.getByRole('heading', { name: 'Za ovo treba prijava' })).toBeVisible()
  })
})

describe('membership', () => {
  /* The payment slip lives inside renewal now (owner, 29.07.2026), and renewal
     only opens between the first of October and the end of December, so these
     render on a date inside that window. */
  function renderFor(memberNumber: string) {
    renderMembershipOn('2026-11-01', memberNumber)
  }

  /* Every way of paying is one way of using the slip above it, so all four sit a
     level below it (PDL P28a puts the slip inside renewal). As third level
     headings they read as four more sections of the renewal, which they are
     not. */
  it('asks an honorary member for nothing at all', async () => {
    /* Pravilnik član 15 and PDL P16: an honorary member never has a payment.
       Only the line about their status said so, while the whole of the renewal
       underneath went on being drawn: a price, „Uplati sada", the recipient, a
       reference number and a QR code for 4.800 RSD they do not owe. Twenty nine
       of the thirty members in the data are honorary, so that was very nearly
       the only thing this screen ever showed. */
    renderFor('000001')

    expect(await screen.findByText(/Počasno članstvo\. Za sezonu/)).toBeVisible()
    expect(screen.getByText(/Počasno članstvo se ne obnavlja/)).toBeVisible()

    expect(screen.queryByRole('heading', { name: 'Uplatnica' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Uplati sada' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /QR/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/^K:PR\|V:01/)).not.toBeInTheDocument()

    /* And not a word about a price either. The slip was taken away and these
       three sentences were not, so the screen went on quoting the fee, the
       processing charge and the junior rate to somebody it had just told pays
       nothing. */
    expect(screen.queryByText(/Danas članarina košta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/taksa za obradu plaćanja/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Do 14 godina članarina/)).not.toBeInTheDocument()
  })

  it('puts the junior fee in the code a junior member scans', async () => {
    /* The junior price was on this screen as a sentence and nowhere else. The
       code carried the figure for a grown member, so somebody of fourteen read
       „Do 14 godina članarina je 20 EUR, a iz Srbije 2.400 RSD" and then scanned
       a request for 4.200. The year of birth was on the record the whole time.

       000031 is fourteen through the season being renewed, which is what PDL P8
       measures: „ko u sezoni za koju plaća bar jedan dan ima 14 godina ili
       manje". */
    renderFor('000031')

    const payload = must(
      (await screen.findByText(/^K:PR\|V:01/)).textContent,
      'the payload the screen shows',
    )

    expect(payload).toContain(`I:RSD${JUNIOR.rsd},00`)
    expect(payload).not.toContain('I:RSD4200,00')

    /* And written out, not only inside the code. The list beside it exists for
       somebody typing the payment into their bank by hand, and it had no amount
       at all: the only figure a junior could read was the grown one. */
    expect(screen.getByText('2.400 RSD')).toBeVisible()
    expect(screen.getByText(/Danas članarina košta 20 EUR, a iz Srbije 2.400 RSD/)).toBeVisible()
  })

  it('offers a member in Serbia the payment slip and the card, never PayPal', async () => {
    renderFor('000032')

    expect(await screen.findByRole('heading', { name: 'Moja članarina' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'Uplatnica' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 4, name: 'Uplatnica sa QR kodom' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 4, name: 'Kartica' })).toBeVisible()
    // Paying between residents of Serbia through PayPal is not allowed.
    expect(screen.queryByRole('heading', { name: 'PayPal' })).not.toBeInTheDocument()
  })

  /* No code at all abroad (owner, 31.07.2026): the association has one account,
     in dinars, at a Serbian bank, and paying into it from abroad is the slowest
     and dearest way there is. PayPal or a card, and nothing else. */
  it('draws the slip the member is told to pay, and not some other text', async () => {
    /* The two ends joined: the payload has its own tests and the drawing has its
       own, and neither says the square on the screen is a drawing of this
       member's slip. The screen writes the payload out under "Prikaži sadržaj
       koda", so the two are read off one render and compared.

       Not opened first: what is inside a `details` is in the page whether it is
       open or not, and what this is about is the two agreeing, not the
       disclosure. */
    renderFor('000032')

    await screen.findByRole('heading', { name: 'Moja članarina' })

    const payload = must(
      screen.getByText(/^K:PR\|V:01/).textContent,
      'the payload the screen shows',
    )

    /* Read off the square itself, by the decoder, rather than compared with a
       second drawing of the same words: what has to hold is that the code on
       this member's screen says this member's slip (test/readQr.ts). */
    expect(readQr(screen.getByRole('img', { name: /QR/ }))).toBe(payload)
  })

  it('offers a member abroad PayPal and a card, and no code at all', async () => {
    /* 000010 is the one member abroad who pays rather than being honoured, and
       the generator says why one had to exist: with every foreign member
       honorary, this screen would have nobody to show and the rule about the
       processing fee could not be checked. */
    renderFor('000010')

    expect(await screen.findByRole('heading', { level: 4, name: 'PayPal' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 4, name: /[Kk]artic/ })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Uplatnica sa QR kodom' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/QR/)).not.toBeInTheDocument()
  })

  it('says which country the ways of paying come from, in words', async () => {
    /* The sentence above them says the ways of paying follow the country on the
       profile, and the country is kept as a code. It was printed raw, so a member
       abroad read the bare code; the words come off the same file the select is
       filled from (countryName). */
    renderFor('000010')

    expect(await screen.findByText(/Severna Makedonija/)).toBeVisible()
    expect(screen.queryByText(/\(ME\)/)).not.toBeInTheDocument()
  })

  it('says what a payment carries besides the fee, to everybody', async () => {
    /* The owner asked for the fee to be something anybody can look up, not
       something only whoever pays it is told (04.08.2026). What differs is who
       pays it, and one sentence says both halves: the euro payment carries it,
       the dinar payment does not. */
    for (const member of ['000010', '000031']) {
      renderFor(member)

      const costs = await screen.findByText(/taksa za obradu plaćanja/)

      expect(costs).toHaveTextContent(`${PROCESSING_FEE_EUR} EUR`)
      expect(costs).toHaveTextContent('nije članarina')
      expect(costs).toHaveTextContent('Uplata u dinarima nema ni taksu ni kursnu razliku')
      expect(costs).toHaveTextContent('kursna razlika i naknada tvoje banke ostaju na tebi')
      cleanup()
    }
  })

  it('has a price in any October of any year, because the list repeats', async () => {
    /* It used to run out at the end of 2027, and this screen carried a line
       saying membership was not on sale yet for the day it did. The four
       periods repeat now (owner, 30.07.2026), so that day never comes. */
    renderMembershipOn('2031-10-01')

    expect(await screen.findByRole('heading', { name: 'Uplatnica' })).toBeVisible()
    expect(screen.getAllByText(/35 EUR, a iz Srbije 4\.200 RSD/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Članarina se još ne prodaje/)).not.toBeInTheDocument()
  })

  it('keeps the slip out of sight while renewal is shut', async () => {
    renderMembershipOn('2026-07-30')

    expect(await screen.findByRole('heading', { name: 'Moja članarina' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Uplatnica sa QR kodom' }),
    ).not.toBeInTheDocument()
    /* And nothing about what a payment costs, because on that day nothing is on
       sale: the panel says so a line above. What a payment carries belongs
       beside a price, and there is no price yet. */
    expect(screen.queryByText(/taksa za obradu plaćanja/)).toBeNull()
  })

  it('says what a payment carries outside the renewal window too, while there is a price', async () => {
    /* For the nine months a season is running the price is quoted and the
       renewal window is shut. Written inside the renewal, the sentence was
       missing exactly then, and a member abroad read a number three euro short
       of what they would pay. */
    renderMembershipOn('2027-06-01', '000010')

    await screen.findByRole('heading', { name: 'Moja članarina' })

    expect(screen.queryByRole('heading', { name: 'Uplatnica' })).not.toBeInTheDocument()
    expect(screen.getByText(/taksa za obradu plaćanja/)).toBeVisible()
  })

  it('carries the referral link, and credits a member in Serbia in dinars', async () => {
    /* Owner, 12.08.2026: „personalizovani link koji donosi 5 eur / 600 din...
       po novom članu koji se registrovao preko tog linka i članarina mu je
       postala aktivirana prvi naredni put."

       One amount and not two, and it is the one this member pays in: „five euro,
       that is six hundred dinars" is a conversion, and the league holds no rate
       (data/pricing.ts). The balance underneath is in the same currency; it said
       „0 EUR" to everybody under a sentence promising dinars. */
    renderAt('/sr/moja-clanarina', 'competitor', '000001')

    /* The link carries a code and not the member number. That number is public
       and consecutive, so a link built out of it can be assembled for anybody,
       by anybody, including for oneself. */
    expect(await screen.findByText(/registracija\?preporuka=7f07b38ff7ee7543/)).toBeVisible()
    expect(screen.queryByText(/preporuka=000001/)).not.toBeInTheDocument()
    expect(screen.getByText(/donosi ti 600 RSD na balans/)).toBeVisible()
    /* And the balance is counted. This member brought five, and four of them
       have had their membership activated: 4 × 600. The fifth registered through
       the link and never went active, and pays nobody, which is the whole of the
       „prvi naredni put" half of the rule. Written out as the string „0 RSD"
       for everybody, no arrangement of the data could ever have shown this.

       All four of the four are honorary, and that is the point of choosing them:
       a review proposed that the credit should require the fee to have been paid,
       and the owner decided otherwise on 13.08.2026, doslovno „OK je da se za
       preporuku dobije balans čak i ako je preporučen član dobio počasnu
       aktivaciju". Read the data rather than trust the sentence: if somebody
       later makes those members payers, this test stops proving the decision and
       says so. */
    const brought = competitors.filter((one) => one.referredBy === competitors[0]?.referralCode)

    expect(brought.filter((one) => one.active && one.membershipBasis === 'honorary')).toHaveLength(4)
    expect(screen.getByText('2.400 RSD')).toBeVisible()
    /* And when it lands, which is the half that keeps anybody from being paid
       for an account that was opened and left. */
    expect(screen.getByText(/kad članarina bude aktivirana/)).toBeVisible()
    expect(screen.getByText('na balansu')).toBeVisible()
  })

  it('promises what administration set, not what the file says', async () => {
    /* The amount is a row of the price list and an administrator changes it
       there (AdminPricing). Read off the constant instead, this screen went on
       promising the old figure while the price list showed the new one, and the
       words above that table said it did not.

       The change is made the way that screen makes it, through the session, and
       this screen is read after it: one session, two screens, which is the whole
       of what „the price list is the source" means. */
    render(
      <ClockProvider simulatedDay="2027-06-01">
        <I18nProvider locale="sr">
          <MemoryRouter>
            <SessionProvider initialMemberNumber="000001">
              <Administration />
              <Membership />
            </SessionProvider>
          </MemoryRouter>
        </I18nProvider>
      </ClockProvider>,
    )

    const user = setupUser()

    await screen.findByText(/donosi ti 600 RSD na balans/)
    await user.click(screen.getByRole('button', { name: 'izmeni preporuku' }))

    expect(await screen.findByText(/donosi ti 840 RSD na balans/)).toBeVisible()
  })

  it('promises the amount as it stands, and does not round it to a whole', async () => {
    /* The price list takes any number the form takes, and the form takes 5,5.
       Written through the portal's own way of writing numbers, which rounds to
       whole unless told otherwise, the price list said 5,5 and this screen
       promised „6 EUR". A promise the terms of use point at is not a place to
       round. */
    render(
      <ClockProvider simulatedDay="2027-06-01">
        <I18nProvider locale="sr">
          <MemoryRouter>
            <SessionProvider initialMemberNumber="000007">
              <Administration eur="5.5" rsd="612.5" name="izmeni na pola" />
              <Membership />
            </SessionProvider>
          </MemoryRouter>
        </I18nProvider>
      </ClockProvider>,
    )

    const user = setupUser()

    await screen.findByText(/donosi ti 5 EUR na balans/)
    await user.click(screen.getByRole('button', { name: 'izmeni na pola' }))

    expect(await screen.findByText(/donosi ti 5,50 EUR na balans/)).toBeVisible()
  })

  it('credits a member from abroad in euro, on both lines', async () => {
    /* 000007 is in Banja Luka, and pays in euro like everyone outside Serbia
       (data/paymentQr.ts). The same country decides both, so the promise and the
       way of paying can never fall out of step. */
    renderAt('/sr/moja-clanarina', 'competitor', '000007')

    expect(await screen.findByText(/donosi ti 5 EUR na balans/)).toBeVisible()
    expect(screen.getByText('0 EUR')).toBeVisible()
  })

  it('tells a paying member since when they have been one', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', '000031')

    expect(await screen.findByText(/Član od .* sezone/)).toBeVisible()
  })

  it('says so when the member does not exist', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', 'M9999')

    expect(await screen.findByRole('heading', { name: 'Ovog profila nema.' })).toBeVisible()
  })
})

describe('settings', () => {
  it('says what it is for, and opens on the theme', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000007')

    expect(await screen.findByRole('heading', { level: 1, name: 'Podešavanja' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Izgled' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Obaveštenja' })).toBeVisible()
  })

  it('switches an optional notification off and on', async () => {
    const user = setupUser()
    renderAt('/sr/podesavanja', 'competitor', '000007')

    const box = await screen.findByRole('checkbox', { name: 'Kad mi rezultat bude odobren' })
    expect(box).toBeChecked()

    await user.click(box)
    expect(box).not.toBeChecked()

    await user.click(box)
    expect(box).toBeChecked()
  })

  it('offers every optional notification and no obligatory one', async () => {
    renderAt('/sr/podesavanja', 'competitor', '000007')

    expect(await screen.findAllByRole('checkbox')).toHaveLength(NOTIFICATION_KEYS.length)
    expect(screen.getByRole('checkbox', { name: 'Povremene vesti iz lige' })).not.toBeChecked()
  })
})

describe('messages', () => {
  it('lists the inbox and marks one read', async () => {
    const user = setupUser()
    renderAt('/sr/poruke', 'competitor', '000007')

    expect(await screen.findByText('1 nepročitana')).toBeVisible()

    await user.click(first(screen.getAllByRole('button', { name: 'Označi kao pročitano' })))

    expect(screen.getByText('0 nepročitanih')).toBeVisible()
  })

  it('opens one message on its own address, and reading it is what marks it read', async () => {
    renderAt('/sr/poruke/msg-1', 'competitor', '000007')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dobro došao u pripremu sezone 2027' }),
    ).toBeVisible()
    expect(screen.getByText(/Kalendar se puni/)).toBeVisible()
    // Nothing was pressed, and the header already says nothing is waiting.
    expect(screen.getByRole('button', { name: 'Otvori poruke, 0 nepročitanih' })).toBeVisible()
  })

  it('leaves a message that was already read alone', async () => {
    renderAt('/sr/poruke/msg-2', 'competitor', '000007')

    expect(await screen.findByRole('heading', { level: 1, name: 'Rezultat je odobren' })).toBeVisible()
    // msg-1 is still unread, so opening a read message changed nothing.
    expect(screen.getByRole('button', { name: 'Otvori poruke, 1 nepročitana' })).toBeVisible()
  })

  it('leads back to the whole inbox', async () => {
    const user = setupUser()
    renderAt('/sr/poruke/msg-2', 'competitor', '000007')

    await user.click(await within(screen.getByRole('main')).findByRole('link', { name: 'Sve poruke' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Poruke' })).toBeVisible()
  })

  it('goes to the front page when the address is a message that is not there', async () => {
    // Same road as any address the portal does not have (owner, 30.07.2026).
    renderAt('/sr/poruke/nema-ovakve', 'competitor', '000007')

    await expectFrontPage()
  })
})

describe('a result from entry to decision', () => {
  async function enterResult(user: ReturnType<typeof setupUser>) {
    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Probna trka')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText(/Dužina/), '21.1')
    await user.type(screen.getByLabelText(/Uspon/), '540')
    await user.type(screen.getByLabelText(/Spust/), '540')
    await user.type(screen.getByLabelText('Sati'), '1')
    await user.type(screen.getByLabelText('Minuta'), '52')
    await user.type(screen.getByLabelText('Sekundi'), '10')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))
  }

  /* The queue moved under verification, so a moderator reaches it the way the
   * navigation now goes: the administration group, then verification, then the
   * queue of results. */
  async function openTheQueue(user: ReturnType<typeof setupUser>) {
    await user.click(await screen.findByRole('link', { name: /^Administracija/ }))
    /* Straight to the queue: the sectors stand beside every administrative
       screen, so there is no road to a section to walk first. The entry carries
       the number waiting in its name (PDL P28a). */
    await user.click(await screen.findByRole('link', { name: /Rezultati/ }))
  }

  it('refuses a result with no link to official results', async () => {
    const user = setupUser()
    renderAt('/sr/rezultat/novi', 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Probna trka')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getAllByText('Ovo polje je obavezno.').length).toBeGreaterThan(0)
  })

  it('goes in, waits, is approved, and the member sees it', async () => {
    const user = setupUser()
    const { unmount } = renderAt('/sr/rezultat/novi', 'superadmin', '000007')

    await enterResult(user)

    /* The entry stays on a confirmation that says what the race earned (PDL P9),
       instead of jumping to the list without a word.

       The number, not the unit beside it. Matching on "BTL poena" also matched
       "0,00 BTL poena", so the one thing the member came to find out was the one
       thing the test never looked at: 21,1 km with 540 up and 540 down in
       1:52:10 is 23,55 by the formula in the rulebook. */
    expect(await screen.findByRole('heading', { name: 'Rezultat je poslat' })).toBeVisible()
    expect(screen.getByText('Ova trka ti donosi 23,55 BTL poena.')).toBeVisible()

    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))

    // It lands among the things sent in, and says it is waiting.
    expect(await screen.findByRole('heading', { name: /Poslato na proveru/ })).toBeVisible()
    expect(screen.getByText('Čeka proveru')).toBeVisible()
    expect(screen.getByText('Probna trka')).toBeVisible()

    // The moderator finds it in the queue and approves it.
    await openTheQueue(user)
    const waiting = await screen.findByRole('heading', { name: /Čeka proveru 1/ })
    expect(waiting).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Odobri' }))

    /* The queue holds what is waiting and nothing else since 06.08.2026: what
       has been settled is not work standing before a moderator. So the decision
       is read where the member reads it, which is the point of the whole
       journey. */
    expect(screen.getByText('Nema nijednog rezultata na čekanju.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Otvori nalog' }))
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))

    expect(await screen.findByText('Odobreno')).toBeVisible()

    unmount()
  })

  it('scores nothing when the time entered is zero', async () => {
    const user = setupUser()
    renderAt('/sr/rezultat/novi', 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Trka bez vremena')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText(/Dužina/), '10')
    await user.type(screen.getByLabelText(/Uspon/), '0')
    await user.type(screen.getByLabelText(/Spust/), '0')
    await user.type(screen.getByLabelText('Sati'), '0')
    await user.type(screen.getByLabelText('Minuta'), '0')
    await user.type(screen.getByLabelText('Sekundi'), '0')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/r')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    // No time is no race, so it carries no points rather than an error, and the
    // confirmation says so straight away.
    expect(await screen.findByText(/0,00 BTL poena/)).toBeVisible()

    // And the way back to an empty form, for the second race of a weekend.
    await user.click(screen.getByRole('button', { name: 'Unesi još jedan' }))
    expect(screen.getByRole('button', { name: 'Pošalji na proveru' })).toBeVisible()
  })

  it('is corrected and sent again, as the same result rather than a second one', async () => {
    /* Owner, 06.08.2026. A refusal is not the end of a result: the member is
       told why, corrects it and sends the same race again, and it goes back into
       the queue it came from. One row and not two, because it is one race. */
    const user = setupUser()
    renderAt('/sr/rezultat/novi', 'superadmin', '000007')

    await enterResult(user)

    /* A second race, which this must leave alone: one correction is about one
       result, and a list rewritten wholesale would carry the correction into
       every row of it. */
    await user.click(screen.getByRole('button', { name: 'Unesi još jedan' }))
    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Druga trka')
    await user.type(screen.getByLabelText(/Datum trke/), '11052026')
    await user.type(screen.getByLabelText(/Dužina/), '10')
    await user.type(screen.getByLabelText(/Uspon/), '0')
    await user.type(screen.getByLabelText(/Spust/), '0')
    await user.type(screen.getByLabelText('Sati'), '0')
    await user.type(screen.getByLabelText('Minuta'), '44')
    await user.type(screen.getByLabelText('Sekundi'), '2')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/druga')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    await openTheQueue(user)

    const probna = must(
      screen
        .getAllByRole('row')
        .find((one) => (one.textContent ?? '').includes('Probna trka')),
      'the row of the first race',
    )

    await user.click(within(probna).getByRole('button', { name: 'Odbij' }))
    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Link ne otvara rezultate.')
    await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

    await user.click(screen.getByRole('button', { name: 'Otvori nalog' }))
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))

    const sent = within(await screen.findByRole('list'))
    expect(sent.getAllByRole('listitem')).toHaveLength(2)

    await user.click(screen.getByRole('link', { name: /Ispravi i pošalji ponovo: / }))

    /* The form opens on what was refused, and says why it is full. */
    expect(await screen.findByText(/Link ne otvara rezultate\./)).toBeVisible()
    const link = screen.getByLabelText(/^Link/)
    expect(link).toHaveValue('https://primer.rs/rezultati')

    await user.clear(link)
    await user.type(link, 'https://primer.rs/ispravno')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    expect(await screen.findByText('Rezultat je ponovo poslat na proveru.')).toBeVisible()

    /* One result, waiting again, and the reason that was answered is gone with
       the version it was about. */
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))

    const again = within(await screen.findByRole('list'))

    expect(again.getAllByRole('listitem')).toHaveLength(2)
    expect(again.getAllByText('Čeka proveru')).toHaveLength(2)
    expect(again.queryByText(/Link ne otvara rezultate\./)).toBeNull()
    // And the race that was never refused still says what it always said.
    expect(again.getByText('Druga trka')).toBeVisible()
  })

  it('is not sent back without a reason, and the reason reaches the member', async () => {
    const user = setupUser()
    renderAt('/sr/rezultat/novi', 'superadmin', '000007')

    await enterResult(user)
    await openTheQueue(user)

    // The reason is asked for after the decision to send back, and the
    // confirmation stays shut until it is written.
    await user.click(await screen.findByRole('button', { name: 'Odbij' }))

    const confirm = screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })
    /* Told off, not switched off: the button stays reachable so the line saying
       why it will not go is reachable with it. */
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(confirm).not.toBeDisabled()

    await user.type(screen.getByLabelText('Razlog odbijanja'), 'Link ne otvara rezultate.')
    expect(confirm).toBeEnabled()

    await user.click(confirm)

    // And the member finds the sentence on their own screen, reached
    // through the account menu in the header.
    await user.click(screen.getByRole('button', { name: 'Otvori nalog' }))
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))
    expect(await screen.findByText('Odbijeno')).toBeVisible()
    expect(screen.getByText('Link ne otvara rezultate.')).toBeVisible()
  })
})

describe('the transfer window and renewal', () => {
  function renderMembership(today: string) {
    renderMembershipOn(today)
  }

  it('opens both on the first of October', async () => {
    renderMembership('2026-11-01')

    expect(await screen.findByRole('heading', { name: /Obnova članarine/ })).toBeVisible()
    expect(screen.getByText(/Obnova je otvorena/)).toBeVisible()
    expect(screen.getByText(/Prelazni rok je otvoren do 31. decembra/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pošalji zahtev timu' })).toBeVisible()
  })

  it('offers the first season category only to somebody still under the threshold', async () => {
    renderMembership('2026-11-01')

    await screen.findByRole('heading', { name: /Obnova članarine/ })

    // 000001 has raced for years and is far past twelve points.
    expect(screen.getByLabelText('U početničkoj kategoriji')).toBeDisabled()
    expect(screen.getByText(/Početnička kategorija ti je zatvorena, jer imaš najmanje 12 bodova/)).toBeVisible()
  })

  it('shuts both outside the window, and says when they open', async () => {
    renderMembership('2026-07-29')

    expect(await screen.findByText(/Obnova se otvara 1. oktobra/)).toBeVisible()
    expect(screen.getByText(/Prelazni rok je zatvoren/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pošalji zahtev timu' })).not.toBeInTheDocument()
  })

  it('says plainly when somebody is in no team at all', async () => {
    renderMembershipOn('2026-11-01', '000006')

    expect(await screen.findByText('Trenutno nisi ni u jednom timu.')).toBeVisible()
  })

  it('keeps a first season member in that choice while it is still open', async () => {
    // 000031 has never raced, so nothing bars them.
    renderMembershipOn('2026-11-01', '000031')

    expect(await screen.findByLabelText('U početničkoj kategoriji')).toBeEnabled()
    expect(screen.getByText(/Početnička kategorija ti je još otvorena/)).toBeVisible()
  })
})

describe('screens that depend on the date', () => {
  it('shows the price in force once membership is on sale, in both currencies', async () => {
    /* Side by side and with no choice between them (PDL P8, owner 31.07.2026).
       The dinar amount is written the way every amount on the portal is
       written, with the thousands separated: it was the one number on the
       screen printed as a bare 4200. */
    renderMembershipOn('2026-10-02', '000032')

    expect(await screen.findByText('Danas članarina košta 35 EUR, a iz Srbije 4.200 RSD.')).toBeVisible()
    /* And the junior price the same way. It was quoted in euro alone, one line
       under a price in both, which is the rule applied on one row and not on the
       one beside it (PDL P8: the price follows from the year of birth). */
    expect(
      screen.getByText(
        `Do 14 godina članarina je ${JUNIOR.eur} EUR, a iz Srbije ${JUNIOR.rsd.toLocaleString('sr-Latn')} RSD, bez obzira na datum.`,
      ),
    ).toBeVisible()
  })

  it('moves the whole portal to another day from the switch in the header', async () => {
    /* The feature end to end, through the real route table and the real switch,
       rather than through a component holding a date: the owner asked for this
       so he could see a screen that only exists after a certain date before
       that date arrives.

       Registration is the sharpest of them. Between 15 and 30 September the
       portal is open for looking only and there is no form at all (PDL P8), so
       nothing about the two states can be mistaken for the other. */
    renderAt('/sr/registracija', 'visitor', null, undefined, '2026-09-20')

    expect(
      await screen.findByRole('heading', { name: 'Registracija još nije otvorena' }),
    ).toBeVisible()

    /* Day first, because the switch is the portal's own date control since
       11.08.2026 and not the browser's. */
    fireEvent.change(screen.getByLabelText('Današnji datum'), {
      target: { value: '02/10/2026' },
    })

    expect(await screen.findByRole('button', { name: 'Pošalji prijavu' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Registracija još nije otvorena' }),
    ).not.toBeInTheDocument()
  })
})

describe('an empty inbox and an empty result list', () => {
  it('says so rather than showing nothing', async () => {
    renderAt('/sr/moji-rezultati', 'competitor', '000031')

    // 000031 has never raced, so nothing is counted and nothing is waiting.
    expect(await screen.findByText('Nijedan rezultat još nije poslat na proveru.')).toBeVisible()
    expect(screen.getByText('Na ovom profilu još nema nijednog rezultata.')).toBeVisible()
  })
})

describe('an inbox with nothing in it', () => {
  it('says so', () => {
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <SessionProvider initialMemberNumber="000001">
            <Messages only={[]} />
          </SessionProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByText('Nemaš nijednu poruku.')).toBeVisible()
  })
})

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { JUNIOR, PROCESSING_FEE_EUR } from '../data/pricing'
import { I18nProvider } from '../i18n/I18nProvider'
import { NOTIFICATION_KEYS } from '../session/context'
import { SessionProvider } from '../session/SessionProvider'
import { first } from '../test/at'
import { expectFrontPage, renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { Membership } from './member/Membership'
import { Messages } from './member/Messages'

/* The flows a member walks. The one that matters most is the last: a result
 * goes in, the moderator finds it, decides, and the member sees the decision.
 * That sequence is the reason for building the front end before the database. */

/**
 * Membership on a given day.
 *
 * The day is put on the clock above the screen rather than handed to the screen,
 * which is exactly what the switch in the header does (src/clock). The screen
 * used to take it as a prop, so a test could put it on a day the rest of the
 * portal was not on, and nothing would say so.
 */
function renderMembershipOn(today: string, memberNumber = '000001') {
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
  it('offers a member in Serbia the payment slip and the card, never PayPal', async () => {
    renderFor('000001')

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
  it('offers a member abroad PayPal and a card, and no code at all', async () => {
    // 000009 is in Montenegro in the generated data.
    renderFor('000009')

    expect(await screen.findByRole('heading', { level: 4, name: 'PayPal' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 4, name: /[Kk]artic/ })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Uplatnica sa QR kodom' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/QR/)).not.toBeInTheDocument()
  })

  it('says what a payment carries besides the fee, to everybody', async () => {
    /* The owner asked for the fee to be something anybody can look up, not
       something only whoever pays it is told (04.08.2026). What differs is who
       pays it, and one sentence says both halves: the euro payment carries it,
       the dinar payment does not. */
    for (const member of ['000009', '000031']) {
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

  it('carries the referral link and the balance', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', '000001')

    expect(await screen.findByText(/registracija\?preporuka=000001/)).toBeVisible()
    expect(screen.getByText('na balansu')).toBeVisible()
  })

  it('tells a paying member since when they have been one', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', '000031')

    expect(await screen.findByText(/Član od .* sezone/)).toBeVisible()
  })

  it('says so when the member does not exist', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', 'M9999')

    expect(await screen.findByRole('heading', { name: 'Ovog takmičara nema.' })).toBeVisible()
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

    expect(screen.getByRole('heading', { name: 'Rešeno' })).toBeVisible()
    expect(screen.getByText('Odobreno')).toBeVisible()

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

  it('is not sent back without a reason, and the reason reaches the member', async () => {
    const user = setupUser()
    renderAt('/sr/rezultat/novi', 'superadmin', '000007')

    await enterResult(user)
    await openTheQueue(user)

    // The reason is asked for after the decision to send back, and the
    // confirmation stays shut until it is written.
    await user.click(await screen.findByRole('button', { name: 'Vrati na doradu' }))

    const confirm = screen.getByRole('button', { name: 'Vrati uz ovaj razlog' })
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText('Razlog vraćanja'), 'Link ne otvara rezultate.')
    expect(confirm).toBeEnabled()

    await user.click(confirm)
    expect(screen.getByText('Link ne otvara rezultate.')).toBeVisible()

    // And the member finds the same sentence on their own screen, reached
    // through the account menu in the header.
    await user.click(screen.getByRole('button', { name: 'Otvori nalog' }))
    await user.click(screen.getByRole('link', { name: 'Moji rezultati' }))
    expect(await screen.findByText('Vraćeno')).toBeVisible()
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
    expect(screen.getByLabelText('U kategoriji Prva sezona')).toBeDisabled()
    expect(screen.getByText(/Prva sezona ti je zatvorena/)).toBeVisible()
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

    expect(await screen.findByLabelText('U kategoriji Prva sezona')).toBeEnabled()
    expect(screen.getByText(/Prva sezona ti je još otvorena/)).toBeVisible()
  })
})

describe('screens that depend on the date', () => {
  it('shows the price in force once membership is on sale, in both currencies', async () => {
    /* Side by side and with no choice between them (PDL P8, owner 31.07.2026).
       The dinar amount is written the way every amount on the portal is
       written, with the thousands separated: it was the one number on the
       screen printed as a bare 4200. */
    renderMembershipOn('2026-10-02', '000031')

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

    fireEvent.change(screen.getByLabelText('Današnji datum'), {
      target: { value: '2026-10-02' },
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
    expect(await screen.findByText('Nisi poslao nijedan rezultat na proveru.')).toBeVisible()
    expect(screen.getByText('Ovaj takmičar još nema nijedan rezultat.')).toBeVisible()
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

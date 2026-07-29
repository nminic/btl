import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { NOTIFICATION_KEYS } from '../session/context'
import { SessionProvider } from '../session/SessionProvider'
import { renderAt } from '../test/render'
import { Membership } from './member/Membership'
import { Messages } from './member/Messages'

/* The flows a member walks. The one that matters most is the last: a result
 * goes in, the moderator finds it, decides, and the member sees the decision.
 * That sequence is the reason for building the front end before the database. */

describe('signing in', () => {
  it('turns a visitor into a competitor and lands on their profile', async () => {
    const user = userEvent.setup()
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
    const user = userEvent.setup()
    renderAt('/sr/moj-profil', 'competitor', '000007')

    await user.click(await screen.findByRole('button', { name: 'Odjavi se' }))

    expect(screen.getByRole('heading', { name: 'Za ovo treba prijava' })).toBeVisible()
  })
})

describe('membership', () => {
  it('offers a member in Serbia the payment slip and the card, never PayPal', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', '000001')

    expect(await screen.findByRole('heading', { name: 'Moja članarina' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'Uplatnica sa QR kodom' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'Kartica' })).toBeVisible()
    // Paying between residents of Serbia through PayPal is not allowed.
    expect(screen.queryByRole('heading', { level: 3, name: 'PayPal' })).not.toBeInTheDocument()
  })

  it('offers a member abroad SEPA and PayPal, never the Serbian slip', async () => {
    // 000003 is in Montenegro in the generated data.
    renderAt('/sr/moja-clanarina', 'competitor', '000009')

    expect(await screen.findByRole('heading', { level: 3, name: /SEPA/ })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'PayPal' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Uplatnica sa QR kodom' }),
    ).not.toBeInTheDocument()
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
    const user = userEvent.setup()
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
    const user = userEvent.setup()
    renderAt('/sr/poruke', 'competitor', '000007')

    expect(await screen.findByText('1 nepročitana')).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: 'Označi kao pročitano' })[0])

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
    const user = userEvent.setup()
    renderAt('/sr/poruke/msg-2', 'competitor', '000007')

    await user.click(await within(screen.getByRole('main')).findByRole('link', { name: 'Sve poruke' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Poruke' })).toBeVisible()
  })

  it('says the message is not there when the address is wrong', async () => {
    renderAt('/sr/poruke/nema-ovakve', 'competitor', '000007')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ove strane nema' })).toBeVisible()
  })
})

describe('a result from entry to decision', () => {
  async function enterResult(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Probna trka')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText(/Vreme starta/), '09:00')
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
  async function openTheQueue(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Administracija' }))
    await user.click(screen.getByRole('link', { name: 'Verifikacija' }))
    await user.click(await screen.findByRole('link', { name: /Rezultati/ }))
  }

  it('refuses a result with no link to official results', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rezultat/novi', 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Probna trka')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getAllByText('Ovo polje je obavezno.').length).toBeGreaterThan(0)
  })

  it('goes in, waits, is approved, and the member sees it', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAt('/sr/rezultat/novi', 'superadmin', '000007')

    await enterResult(user)

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
    const user = userEvent.setup()
    renderAt('/sr/rezultat/novi', 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Trka bez vremena')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText(/Vreme starta/), '09:00')
    await user.type(screen.getByLabelText(/Dužina/), '10')
    await user.type(screen.getByLabelText(/Uspon/), '0')
    await user.type(screen.getByLabelText(/Spust/), '0')
    await user.type(screen.getByLabelText('Sati'), '0')
    await user.type(screen.getByLabelText('Minuta'), '0')
    await user.type(screen.getByLabelText('Sekundi'), '0')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/r')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    // No time is no race, so it carries no points rather than an error.
    expect(await screen.findByText(/0,00 BTL points/)).toBeVisible()
  })

  it('is not sent back without a reason, and the reason reaches the member', async () => {
    const user = userEvent.setup()
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
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <SessionProvider initialMemberNumber="000001">
            <Membership today={today} />
          </SessionProvider>
        </MemoryRouter>
      </I18nProvider>,
    )
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
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <SessionProvider initialMemberNumber="000006">
            <Membership today="2026-11-01" />
          </SessionProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(await screen.findByText('Trenutno nisi ni u jednom timu.')).toBeVisible()
  })

  it('keeps a first season member in that choice while it is still open', async () => {
    // 000031 has never raced, so nothing bars them.
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <SessionProvider initialMemberNumber="000031">
            <Membership today="2026-11-01" />
          </SessionProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(await screen.findByLabelText('U kategoriji Prva sezona')).toBeEnabled()
    expect(screen.getByText(/Prva sezona ti je još otvorena/)).toBeVisible()
  })
})

describe('screens that depend on the date', () => {
  it('shows the price in force once membership is on sale', () => {
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <SessionProvider initialMemberNumber="000001">
            <Membership today="2026-10-02" />
          </SessionProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    return screen.findByText(/Danas članarina košta 35 EUR/).then((found) => {
      expect(found).toBeVisible()
    })
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

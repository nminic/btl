import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
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

    await user.selectOptions(await screen.findByLabelText('Ko si?'), 'M0005')
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
    ['/sr/rezultat/novi'],
  ])('sends %s to the sign in notice', async (path) => {
    renderAt(path, 'competitor')

    expect(await screen.findByRole('heading', { name: 'Za ovo treba prijava' })).toBeVisible()
  })
})

describe('my profile', () => {
  it('shows the profile with the things only its owner can do', async () => {
    renderAt('/sr/moj-profil', 'competitor', 'M0005')

    expect(await screen.findByRole('heading', { name: 'Moje stvari' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Obaveštenja' })).toBeVisible()
    // The profile itself is the same one everyone else sees.
    expect(screen.getByRole('table', { name: 'Rezultati' })).toBeVisible()
  })

  it('switches an optional notification off and on', async () => {
    const user = userEvent.setup()
    renderAt('/sr/moj-profil', 'competitor', 'M0005')

    const box = await screen.findByLabelText('Kad mi rezultat bude odobren')
    expect(box).toBeChecked()

    await user.click(box)
    expect(box).not.toBeChecked()
  })

  it('signs out again', async () => {
    const user = userEvent.setup()
    renderAt('/sr/moj-profil', 'competitor', 'M0005')

    await user.click(await screen.findByRole('button', { name: 'Odjavi se' }))

    expect(screen.getByRole('heading', { name: 'Za ovo treba prijava' })).toBeVisible()
  })
})

describe('membership', () => {
  it('offers a member in Serbia the payment slip and the card, never PayPal', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', 'M0001')

    expect(await screen.findByRole('heading', { name: 'Moja članarina' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'Uplatnica sa QR kodom' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'Kartica' })).toBeVisible()
    // Paying between residents of Serbia through PayPal is not allowed.
    expect(screen.queryByRole('heading', { level: 3, name: 'PayPal' })).not.toBeInTheDocument()
  })

  it('offers a member abroad SEPA and PayPal, never the Serbian slip', async () => {
    // F0001 is in Montenegro in the generated data.
    renderAt('/sr/moja-clanarina', 'competitor', 'F0003')

    expect(await screen.findByRole('heading', { level: 3, name: /SEPA/ })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'PayPal' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Uplatnica sa QR kodom' }),
    ).not.toBeInTheDocument()
  })

  it('carries the referral link and the balance', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', 'M0001')

    expect(await screen.findByText(/registracija\?preporuka=M0001/)).toBeVisible()
    expect(screen.getByText('na balansu')).toBeVisible()
  })

  it('tells a paying member since when they have been one', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', 'M0021')

    expect(await screen.findByText(/Član od .* sezone/)).toBeVisible()
  })

  it('says so when the member does not exist', async () => {
    renderAt('/sr/moja-clanarina', 'competitor', 'M9999')

    expect(await screen.findByRole('heading', { name: 'Ovog takmičara nema.' })).toBeVisible()
  })
})

describe('messages', () => {
  it('lists the inbox and marks one read', async () => {
    const user = userEvent.setup()
    renderAt('/sr/poruke', 'competitor', 'M0005')

    expect(await screen.findByText('1 nepročitana')).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: 'Označi kao pročitano' })[0])

    expect(screen.getByText('0 nepročitanih')).toBeVisible()
  })
})

describe('a result from entry to decision', () => {
  async function enterResult(user: ReturnType<typeof userEvent.setup>) {
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

  it('refuses a result with no link to official results', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rezultat/novi', 'competitor', 'M0005')

    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Probna trka')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getAllByText('Ovo polje je obavezno.').length).toBeGreaterThan(0)
  })

  it('goes in, waits, is approved, and the member sees it', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAt('/sr/rezultat/novi', 'superadmin', 'M0005')

    await enterResult(user)

    // It lands among the things sent in, and says it is waiting.
    expect(await screen.findByRole('heading', { name: /Poslato na proveru/ })).toBeVisible()
    expect(screen.getByText('Čeka proveru')).toBeVisible()
    expect(screen.getByText('Probna trka')).toBeVisible()

    // The moderator finds it in the queue and approves it.
    await user.click(screen.getByRole('link', { name: 'Red za proveru' }))
    const waiting = await screen.findByRole('heading', { name: /Čeka proveru 1/ })
    expect(waiting).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Odobri' }))

    expect(screen.getByRole('heading', { name: 'Rešeno' })).toBeVisible()
    expect(screen.getByText('Odobreno')).toBeVisible()

    unmount()
  })

  it('scores nothing when the time entered is zero', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rezultat/novi', 'competitor', 'M0005')

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

    // No time is no race, so it carries no points rather than an error.
    expect(await screen.findByText(/0,00 BTL points/)).toBeVisible()
  })

  it('is not sent back without a reason, and the reason reaches the member', async () => {
    const user = userEvent.setup()
    renderAt('/sr/rezultat/novi', 'superadmin', 'M0005')

    await enterResult(user)
    await user.click(await screen.findByRole('link', { name: 'Red za proveru' }))

    const sendBack = await screen.findByRole('button', { name: 'Vrati na doradu' })
    expect(sendBack).toBeDisabled()

    await user.type(screen.getByLabelText('Razlog vraćanja'), 'Link ne otvara rezultate.')
    expect(sendBack).toBeEnabled()

    await user.click(sendBack)
    expect(screen.getByText('Link ne otvara rezultate.')).toBeVisible()

    // And the member finds the same sentence on their own screen.
    await user.click(screen.getAllByRole('link', { name: 'Moji rezultati' })[0])
    expect(await screen.findByText('Vraćeno')).toBeVisible()
    expect(screen.getByText('Link ne otvara rezultate.')).toBeVisible()
  })
})

describe('screens that depend on the date', () => {
  it('shows the price in force once membership is on sale', () => {
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <SessionProvider initialMemberNumber="M0001">
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
    renderAt('/sr/moji-rezultati', 'competitor', 'M0021')

    // M0021 has never raced, so nothing is counted and nothing is waiting.
    expect(await screen.findByText('Nisi poslao nijedan rezultat na proveru.')).toBeVisible()
    expect(screen.getByText('Ovaj takmičar još nema nijedan rezultat.')).toBeVisible()
  })
})

describe('an inbox with nothing in it', () => {
  it('says so', () => {
    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <SessionProvider initialMemberNumber="M0001">
            <Messages only={[]} />
          </SessionProvider>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByText('Nemaš nijednu poruku.')).toBeVisible()
  })
})

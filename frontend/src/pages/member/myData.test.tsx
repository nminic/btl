import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { must } from '../../test/at'
import { aNeverPaidRecord, neverPaidAsServed } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import { answeredWith, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { useSession } from '../../session/useSession'
import { hisPageAsServed } from '../../test/hisPage'

/**
 * „MOJI PODACI", THE PAGE SOMEBODY WHO REGISTERED AND HAS NOT PAID CHANGES HIS DATA ON.
 *
 * <p>Owner, 22.10.2026 (PDL, „Član koji još nije platio: bez reči nalog, samo Članarina"): „Neka ima u
 * navigaciji stranu Moji Podaci dok nije odobren koja je iznad Moja Članarina." His data left the
 * settings for everybody on 23.10.2026, and he has neither a profile nor a card „Podaci", so this is
 * the only place he can change them, which the decision of 10.10.2026 still lets him do („svoje
 * podatke za evidenciju i majicu"). Three of the cases below are the three that read his data on the
 * settings and were taken out of `settingsByStanding.test.tsx` when they left it, written again for
 * the page that has them now.
 *
 * <p><b>Every wait is given half of the time a case has</b>, so a wait that never succeeds ends the
 * case in an assertion and not in its own clock.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function stand<T extends { stop: () => void }>(server: T): T {
  stops.push(server.stop)

  return server
}

const PAGE = '/sr/moji-podaci'

describe('the page of somebody who has not paid', () => {
  it('ends a wait that never succeeds in an assertion and not in its own clock', () => {
    /* The floor under the `configure` at the head of the file, asked of the number that decides. */
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })

  it('is headed „Moji podaci" and holds the panel of his data, drawn from the answer that has a row for him', async () => {
    /* The list the server serves is every member whose fee stands, and he is on no row of it, so a
       screen that looked him up THERE would draw nothing of his. His data is asked for under his own
       cookie (`GET /api/me`), after the shell's own question. */
    stand(neverPaidAsServed())
    renderAt(PAGE, 'visitor', null)

    expect(await screen.findByRole('heading', { level: 1, name: 'Moji podaci' })).toBeVisible()
    expect(await screen.findByRole('heading', { level: 2, name: 'Lični podaci' })).toBeVisible()
    expect(screen.getByDisplayValue('Tek')).toBeVisible()
    expect(screen.getByDisplayValue('Stigao')).toBeVisible()
    expect(screen.getByDisplayValue(aNeverPaidRecord.address)).toBeVisible()
  }, SLOW)

  it('draws nothing that makes a member visible, and nothing he types into for what only the administration changes', async () => {
    stand(neverPaidAsServed())
    renderAt(PAGE, 'visitor', null)

    const panel = await screen.findByRole('heading', { level: 2, name: 'Lični podaci' })
    const mine = within(must(panel.closest('section'), 'the panel'))

    /* The father's name, the gender, the date and the document are the administration's to change (PDL
       22.10.2026, 24.10.2026) and he SEES them held (`heldFields.test.tsx` holds how); the address of
       post is not drawn at all, as on the card. What is asked here is that none of them is a box he
       can type into. */
    for (const label of [/^Ime oca/, /^Pol/, /^Datum rođenja/, /^Broj ličnog dokumenta/]) {
      for (const box of mine.getAllByLabelText(label)) {
        expect(box, String(label)).toHaveAttribute('readonly')
      }
    }

    expect(mine.queryByLabelText(/Adresa elektronske pošte|E-pošta|Email/i)).not.toBeInTheDocument()

    /* And none of the three things the entry of 10.10.2026 keeps from him. */
    for (const heading of ['Profilna slika', 'Tekst o sebi', 'Privatnost', 'Lozinka']) {
      expect(screen.queryByRole('heading', { name: heading }), heading).not.toBeInTheDocument()
    }
  }, SLOW)

  it('sends a change to the route the card sends to, as his own record', async () => {
    const user = setupUser()
    /* The server that answers the read first and the one that answers the write in front of it, because
       the one in front is asked first and the read stand-in answers every verb at its address. */
    stand(neverPaidAsServed())

    const kept = stand(
      serverThat((path, init) =>
        path === '/api/me' && init?.method === 'PUT' ? answeredWith(200) : null,
      ),
    )

    renderAt(PAGE, 'visitor', null)

    const phone = await screen.findByLabelText(/Telefon/)

    await user.clear(phone)
    await user.type(phone, '0641234567')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    expect(await screen.findByText('Sačuvano.')).toBeVisible()

    const sent = must(
      kept.asked.find((one) => one.path === '/api/me' && one.init?.method === 'PUT'),
      'the write',
    )

    expect(JSON.parse(String(sent.init?.body))).toEqual({ phone: '0641234567' })
  }, SLOW)

  it('says his data could not be read, and offers to ask again, when the server will not give them', async () => {
    /* The shell's question is answered, and every one after it is not: the menu's read of his name and
       the page's read of his data are both `GET /api/me`, and both fail. Said in the portal's own words
       (`components/Resource`) and not in a sentence of this screen's. */
    let answered = 0

    stand(
      serverThat((path) => {
        if (path !== '/api/me') {
          return null
        }

        answered += 1

        return answered === 1
          ? new Response(
              JSON.stringify({
                role: 'competitor',
                account: 1,
                member: aNeverPaidRecord,
                mailLanguage: 'sr',
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : new Response(null, { status: 500 })
      }),
    )
    renderAt(PAGE, 'visitor', null)

    expect(await screen.findByText('Podaci se ne mogu učitati.')).toBeVisible()
    expect(screen.getByRole('button', { name: /Pokušaj ponovo/ })).toBeVisible()
    /* The heading stays, and so does the way out and the other page. */
    expect(screen.getByRole('heading', { level: 1, name: 'Moji podaci' })).toBeVisible()
  }, SLOW)
})

/**
 * SOMEBODY ELSE SIGNING IN WHILE THE PAGE IS OPEN, through the portal's own live writer.
 *
 * <p>`theServerSignedMeIn` is the very call `member/SignIn.tsx` makes with the answer to `GET
 * /api/me`, `SessionProvider` sits above the router so it never comes down, and the sign in screen
 * can be walked to while somebody is signed in: a shared laptop at a race is the ordinary case. It
 * moves what the server answers in the same click, so a case built on it measures whether the SCREEN
 * reacts and not whether the stand-in server can.
 */
function SignInAsSomebodyWhoHasNotPaid({ account }: { account: number }) {
  const { theServerSignedMeIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        theServerSignedMeIn({
          account,
          memberNumber: null,
          country: 'RS',
          firstSeason: 2027,
          teamId: null,
          membershipBasis: 'payment',
          membershipSeason: null,
          referralCode: '3d6b1f0a9c2e4478',
          referredCount: 0,
          hasARecord: true,
          feeStands: false,
        })
      }}
    >
      prijavi drugog
    </button>
  )
}

describe('the page of somebody who has not paid, when somebody else signs in beside him', () => {
  /* **THE FAULT THIS EXISTS FOR IS THE SECOND MAN READING THE FIRST ONE'S NAME OUT OF THE BOX.**
     His data is held by the account it was asked under (`useMyData`), and the screen is what hands
     the hook that account. A screen that handed it a constant would hold the first answer for ever:
     the effect asks again only when the account it is keyed by changes, so the second reader would
     be drawn the first reader's name and could press „Sačuvaj" on it. The cheaper mutation - the
     hook ignoring the account - is held by `useMyData.test.tsx`; this is the wire between the two,
     and it is asked of the menu's name as well as of the box. */
  it('draws the second reader his own data and his own name, and not the first reader\'s', async () => {
    const user = setupUser()
    let whose: Record<string, unknown> = {}

    stand(
      serverThat((path) =>
        path === '/api/me'
          ? new Response(
              JSON.stringify({
                role: 'competitor',
                account: 1,
                member: { ...aNeverPaidRecord, ...whose },
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          : null,
      ),
    )
    renderAt(PAGE, 'visitor', null, undefined, undefined, <SignInAsSomebodyWhoHasNotPaid account={2} />)

    expect(await screen.findByDisplayValue('Tek')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Otvori moj meni' })).toHaveTextContent('TS')

    whose = { firstName: 'Ana', lastName: 'Anić' }
    await user.click(screen.getByRole('button', { name: 'prijavi drugog' }))

    expect(await screen.findByDisplayValue('Ana')).toBeVisible()
    expect(screen.queryByDisplayValue('Tek')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Otvori moj meni' })).toHaveTextContent('AA')
    })
  }, SLOW)
})

describe('the page, to everybody who is not somebody who has not paid', () => {
  /* **WHAT THE OWNER SAID IS WHERE THE ENTRY GOES AND NOT WHAT THE ADDRESS ANSWERS**, so these are
     derived (PDL 22.10.2026, „posle odobrenja „Moji podaci" nestaje iz navigacije, a podatke menja na
     kartici Podaci profila"): a member whose fee stands is sent to the card, where his data are; a
     member whose fee has lapsed to the page he renews on, which is all that is open to him; and the
     rest are told what every screen of the member area tells them. */
  it('sends a member whose fee stands to the card „Podaci" of his own profile', async () => {
    const { router } = renderAt(PAGE, 'competitor', '000001')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/takmicar/000001/podaci')
    })
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.queryByRole('heading', { level: 1, name: 'Moji podaci' })).not.toBeInTheDocument()
  }, SLOW)

  it('sends a member whose fee has lapsed to the page he renews on', async () => {
    stand(hisPageAsServed())
    const { router } = renderAt(PAGE, 'visitor', null)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/moja-clanarina')
    })
    expect(screen.queryByRole('heading', { level: 1, name: 'Moji podaci' })).not.toBeInTheDocument()
  }, SLOW)

  it('tells a visitor to sign in, as every screen of the member area does', async () => {
    renderAt(PAGE, 'visitor', null)

    expect(await screen.findByRole('heading', { level: 1, name: 'Za ovo treba prijava' })).toBeVisible()
  }, SLOW)
})

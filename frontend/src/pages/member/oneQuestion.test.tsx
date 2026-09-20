import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACCOUNT_ROUTES } from '../../app/routes'
import { renderAt } from '../../test/render'
import { answeredWith, forgetEveryCookie, serverThat, type Asked } from '../../test/serverAnswers'

/**
 * THE MEMBER AREA ASKS THE SAME QUESTION THE HEADER ASKS, ON EVERY ONE OF ITS ADDRESSES.
 *
 * <p><b>What this is for.</b> `session/context.ts` says the question „is anybody signed
 * in" „must not be asked twice and get two answers", and until 20.09.2026 it was: the
 * header read `signedIn` and all five screens behind the picture read the member number.
 * A real session carries no member number - `GET /api/me` answers a role and an account
 * and {@code MeApi} says at length why - so every link in the menu behind a signed in
 * member's own picture led to „Za ovo treba prijava". Measured on all five.
 *
 * <p><b>WHY THE LIST IS NOT WRITTEN OUT BELOW.</b> A guard whose list is typed by hand
 * stops being every screen the moment a sixth is added, and this is exactly the shape
 * where that happens quietly: the sixth screen would be written by copying the fifth,
 * old question and all, and nothing would say so. `ACCOUNT_ROUTES` is what the ROUTER is
 * built from (`app/routeObjects.tsx`) and what the menu is drawn from
 * (`app/AccountMenu.tsx`), so an address of the member area cannot exist outside it, and
 * one added tomorrow is walked here the day it is added.
 *
 * <p><b>And the session is not handed in.</b> There is no prop for it: `SessionProvider`
 * refuses one on purpose, so that nothing can measure a signed in portal without
 * measuring the signing in. The only way in is the one a member has - a cookie in the
 * browser and `GET /api/me` answering - which is what the server below is.
 */

let server: { asked: Asked[]; stop: () => void } | null = null

/**
 * A server holding a session for somebody with no competitor record of their own.
 *
 * Which is what every real session is today, and what a moderator's and a superadmin's
 * always will be: one account is exactly one member (owner, 14.09.2026, PDL P21) and
 * administration has no member to be.
 */
function aSignedInAccount(role = 'competitor', account = 107): void {
  server = serverThat((path) => {
    if (path === '/api/me') {
      return new Response(JSON.stringify({ role, account }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    /* Everything else off the disc, exactly as every other screen reads it. */
    return path.startsWith('/api') ? answeredWith(404) : null
  })
}

beforeEach(() => {
  forgetEveryCookie()
})

afterEach(() => {
  server?.stop()
  server = null
  forgetEveryCookie()
})

describe('every screen of the member area, to somebody the server has signed in', () => {
  it.each(ACCOUNT_ROUTES.map((route) => route.path))('does not send %s back to the sign in', async (path) => {
    aSignedInAccount()
    /* A visitor and no member number, which is a browser that has touched no
       development control: the only thing that makes this a session is the answer
       above. */
    renderAt(`/sr/${path}`, 'visitor', null)

    /* WAITED FOR ON THE HEADER FIRST, and that is not tidiness. A visit begins with
       nobody signed in and the answer arrives a tick later, so the sign in really is on
       screen for one render; read without waiting, this found that first heading and
       measured the moment before the thing it is about. The account menu is the header
       saying it knows somebody is signed in, which is exactly the question the screen
       below is supposed to be asking too. */
    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()

    /* Something was drawn, and it is not the sign in. The positive half matters as much
       as the negative: without it a screen that rendered nothing at all would pass for
       not having said the wrong thing. */
    const heading = await screen.findByRole('heading', { level: 1 })

    expect(heading).toBeVisible()
    expect(heading).not.toHaveTextContent('Za ovo treba prijava')
  })

  it.each(ACCOUNT_ROUTES.map((route) => route.path))(
    'still sends %s to the sign in when nobody is signed in at all',
    async (path) => {
      /* THE OTHER HALF OF THE SAME AXIS. Read alone, the case above is satisfied by a
         member area that lets everybody in, which is a worse fault than the one it
         measures. */
      server = serverThat((one) => (one.startsWith('/api') ? answeredWith(401) : null))
      renderAt(`/sr/${path}`, 'visitor', null)

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Za ovo treba prijava' }),
      ).toBeVisible()
    },
  )
})

describe('what a signed in account with no competitor record is told', () => {
  it('is that this part is for competitors, and not that nobody is signed in', async () => {
    aSignedInAccount()
    renderAt('/sr/moj-profil', 'visitor', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Prijavljen si, ali uz ovaj nalog ne stoji takmičarski zapis, pa ovde nema šta da se prikaže.',
      ),
    ).toBeVisible()
    /* The way onward is the front page and not the sign in: whoever reads this is signed
       in already, and offering them the form is the portal arguing with them. Read
       inside the screen rather than on the page, because the sign of the league in the
       header is a way to the front page as well. */
    const mine = within(screen.getByRole('main'))

    expect(mine.getByRole('link', { name: 'Naslovna strana' })).toHaveAttribute('href', '/sr')
    expect(mine.queryByRole('link', { name: 'Prijava' })).not.toBeInTheDocument()
  })

  it('is the same for a moderator, who by decision has no competitor record at all', async () => {
    /* Not a different sentence and not a different screen. „Jedan nalog je tacno jedan
       clan" (owner, 14.09.2026, PDL P21), and administration is nobody's member. */
    aSignedInAccount('moderator', 11)
    renderAt('/sr/moja-clanarina', 'visitor', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
  })
})

describe('the member number the screens read', () => {
  /**
   * THE SOURCE AND NOT THE OUTCOME. Both facts below say „somebody is signed in", and a
   * screen reading either one draws something rather than the sign in. What tells them
   * apart is WHOSE screen is drawn: only the member number names a person in the file of
   * members, and only one of the two homes carries it.
   */
  it('is the member number and never the account number', async () => {
    aSignedInAccount()
    /* The development switch, which is the one thing that carries a member number
       today, and an account answering beside it with a DIFFERENT number. Read off the
       account, this screen would look for member 107; read off the member number it
       looks for 000001. Neither is the other, and one of them is a real member. */
    renderAt('/sr/moj-profil', 'competitor', '000001')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Vladan Đurišić' }),
    ).toBeVisible()
  })

  it('is missing rather than guessed at when only the account is there', async () => {
    /* The same two facts with the member number taken away, which is the only difference
       between this case and the one above. */
    aSignedInAccount()
    renderAt('/sr/moj-profil', 'competitor', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
  })
})

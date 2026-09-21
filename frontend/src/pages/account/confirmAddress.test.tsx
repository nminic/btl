import { render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ClockProvider } from '../../clock/ClockProvider'
import { I18nProvider } from '../../i18n/I18nProvider'
import { at } from '../../test/at'
import { renderAt } from '../../test/render'
import {
  answeredWith,
  did,
  forgetEveryCookie,
  refused,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { ConfirmAddress } from './ConfirmAddress'

/**
 * THE SCREEN THAT SPENDS THE OTHER LINK, WHERE THERE IS NOTHING TO TYPE AND NOTHING
 * TO PRESS.
 *
 * <p>Everything it does happens on the way in, so every case here is about what it
 * asked for and what it said about the answer.
 */

const AT = '/sr/potvrda-adrese?token=iz-poruke'

let server: { asked: Asked[]; stop: () => void } | null = null

beforeEach(() => {
  forgetEveryCookie()
  document.cookie = 'XSRF-TOKEN=imam'
})

afterEach(() => {
  server?.stop()
  server = null
  forgetEveryCookie()
})

/** Everything the screen sent to the route this screen is about. */
function sentToTheRoute(): Asked[] {
  return (server?.asked ?? []).filter((one) => one.path === '/api/email-confirmation')
}

describe('arriving with a link', () => {
  it('spends it without being asked to, and sends the token and nothing else', async () => {
    server = serverThat(() => did())

    renderAt(AT)

    await screen.findByText(/Adresa je potvrđena/)

    const sent = at(sentToTheRoute(), 0)

    expect(sent.init?.method).toBe('POST')
    /* The token, whole, and no field this route would throw away: there is no
       password on this road and a screen that sent one would be asking a reader for
       something nobody wants. */
    expect(JSON.parse(String(sent.init?.body))).toEqual({ token: 'iz-poruke' })
  })

  it('says what it is doing while it waits', async () => {
    let letGo = (): void => undefined
    server = serverThat(
      () =>
        new Promise<Response>((resolve) => {
          letGo = () => {
            resolve(did())
          }
        }),
    )

    renderAt(AT)

    expect(await screen.findByText(/Potvrđujemo adresu/)).toBeVisible()
    /* And says nothing about the outcome yet, which is the fault this guards: a
       screen that draws its refusal while the answer is still out has told the reader
       his link is dead on every slow connection. */
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/Adresa je potvrđena/)).not.toBeInTheDocument()

    letGo()
    await screen.findByText(/Adresa je potvrđena/)
  })

  it('says the address is confirmed, and where to go next', async () => {
    server = serverThat(() => did())

    renderAt(AT)

    expect(await screen.findByText(/Adresa je potvrđena. Sada možeš da se prijaviš/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Prijava' })).toBeVisible()
  })

  it('asks the server once, and not twice because React mounted it twice', async () => {
    /* `main.tsx` puts the whole portal in `StrictMode`, which runs an effect, cleans
       it up and runs it again. The state the screen keeps is still empty when the
       second run starts, so only something outside the render can tell the two apart.
       Measured here rather than argued: the route table is not what this is about, so
       the screen is mounted on its own, inside `StrictMode`, exactly as the portal
       mounts it. */
    server = serverThat(() => did())

    render(
      <StrictMode>
        <ClockProvider>
          <MemoryRouter initialEntries={['/?token=iz-poruke']}>
            <I18nProvider locale="sr">
              <ConfirmAddress />
            </I18nProvider>
          </MemoryRouter>
        </ClockProvider>
      </StrictMode>,
    )

    await screen.findByText(/Adresa je potvrđena/)
    await waitFor(() => {
      expect(sentToTheRoute()).toHaveLength(1)
    })
  })
})

describe('arriving at the address the server really writes', () => {
  /**
   * WITHOUT A LANGUAGE ON IT, WHICH IS THE ONLY ADDRESS ANYBODY EVER ARRIVES AT.
   *
   * <p>`WhatTheMessageSays.about` writes `portal.address() + message.path() + "?token="`,
   * and for this road `CONFIRM_THE_ADDRESS.path()` is `/potvrda-adrese`. No `/sr` is in it, because
   * the server does not know which language the reader wants. Every other case in this
   * file opens `/sr/potvrda-adrese?token=…`, which is where the reader ENDS UP rather
   * than where he starts.
   *
   * <p>What carries him there is one expression in `LocaleLayout.tsx`, and it had no
   * case of its own on either road: deleting `${location.search}` from it, and
   * separately `${location.pathname}`, each left the whole suite green while every link
   * the server has ever posted would have landed somewhere it cannot be spent.
   */
  const AS_THE_SERVER_WRITES_IT = '/potvrda-adrese?token=veza-iz-poruke'

  it('carries the token through the language the server did not put on it', async () => {
    server = serverThat(() => did())

    const { router } = renderAt(AS_THE_SERVER_WRITES_IT)

    await screen.findByText(/Adresa je potvrđena/)

    const { pathname, search } = router.state.location

    expect(`${pathname}${search}`).toBe('/sr/potvrda-adrese?token=veza-iz-poruke')

    /* And the word this case sent is the word that reached the route. It stands nowhere
       else in the file, so it cannot have come off the address the other cases open. */
    expect(JSON.parse(String(at(sentToTheRoute(), 0).init?.body))).toEqual({
      token: 'veza-iz-poruke',
    })
  })
})

describe('arriving without one', () => {
  it('says there is nothing to confirm, and asks the server for nothing', async () => {
    server = serverThat(() => null)

    renderAt('/sr/potvrda-adrese')

    expect(
      await screen.findByText(/Ova adresa ne nosi vezu iz poruke, pa nema šta da se potvrdi/),
    ).toBeVisible()
    /* The shell asks `GET /api/me` above every screen since 20.09.2026
       (app/Shell.tsx, session/useTheServersSession.ts). That is the portal asking who
       is signed in, not this screen spending anything, so it is named and set aside
       here rather than the assertion being loosened to „not many requests". */
    expect(
      server.asked.filter((one) => one.path.startsWith('/api') && one.path !== '/api/me'),
    ).toEqual([])
  })
})

describe('what the screen says about each answer', () => {
  const answers: [name: string, made: () => Response, said: RegExp][] = [
    [
      'a link that has run out or been used',
      () => refused('theLinkIsNotValid'),
      /Veza je istekla ili je već iskorišćena/,
    ],
    [
      'a reason this screen does not know',
      () => refused('nestoNovo'),
      /odbio zahtev uz razlog nestoNovo/,
    ],
    [
      'a request nobody proved came from the portal',
      () => answeredWith(403),
      /nije uspeo da dokaže serveru/,
    ],
    ['anything else, by its number', () => answeredWith(500), /odgovorio brojem 500/],
    [
      'a server it could not reach',
      () => {
        throw new TypeError('Failed to fetch')
      },
      /nije uspeo da dođe do servera/,
    ],
  ]

  it.each(answers)('tells the reader about %s', async (_name, made, said) => {
    server = serverThat(made)

    renderAt(AT)

    expect(await screen.findByRole('alert')).toHaveTextContent(said)
    /* And never beside the sentence that says it worked. */
    expect(screen.queryByText(/Adresa je potvrđena/)).not.toBeInTheDocument()
    /* The heading stays whatever came back, which is what lets `addresses.ts` name
       this screen by it. */
    expect(screen.getByRole('heading', { level: 1, name: 'Potvrda adrese' })).toBeVisible()
  })

  it('offers the way to a fresh link only where a fresh link is the answer', async () => {
    server = serverThat(() => refused('theLinkIsNotValid'))

    renderAt(AT)
    await screen.findByRole('alert')

    expect(screen.getByRole('link', { name: 'Prijava' })).toBeVisible()

    server.stop()
    server = serverThat(() => answeredWith(500))

    renderAt(AT)
    await screen.findAllByRole('alert')

    /* Two screens are mounted by now, and the first still holds its link, so the
       question is asked of the second: exactly one link on the page, from the first.
       Read this way rather than by cleaning up between the halves, because what is
       being measured is a difference between two answers and not two files. */
    expect(screen.getAllByRole('link', { name: 'Prijava' })).toHaveLength(1)
  })
})

import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { setupUser } from '../../test/user'
import { SHORTEST_PASSWORD } from './passwordRule'

/**
 * THE SCREEN A LINK OUT OF A MESSAGE LANDS ON, READ THE WAY A READER MEETS IT.
 *
 * <p>Every case here starts from an address with a token on it, because that is the
 * only way anybody arrives: the server writes the link. The cookie is put in the jar
 * by hand where a case is not about the cookie, so that what is measured is the screen
 * and not the round trip `askTheServer.test.ts` already measures on its own.
 */

const AT = '/sr/nova-lozinka?token=iz-poruke'

/** Two different strings, and never one string used twice. A case that typed the same
 *  password into both fields could not tell "both fields are sent" from "the first is
 *  sent twice", and the second is the bug that makes every mismatch a success. */
const TYPED = 'prva-lozinka-koju-kucam'

const TYPED_AGAIN = 'druga-lozinka-koju-kucam'

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

/** Fills both fields in and presses the button. */
async function setOne(first = TYPED, second = TYPED_AGAIN): Promise<void> {
  const user = setupUser()

  await user.type(await screen.findByLabelText('Nova lozinka'), first)
  await user.type(screen.getByLabelText('Ponovi novu lozinku'), second)
  await user.click(screen.getByRole('button', { name: 'Postavi lozinku' }))
}

/** Everything the screen sent to the route this screen is about. */
function sentToTheRoute(): Asked[] {
  return (server?.asked ?? []).filter((one) => one.path === '/api/password-reset')
}

describe('opening the screen', () => {
  it('draws no form at an address that carries no link, and says why', async () => {
    server = serverThat(() => null)

    renderAt('/sr/nova-lozinka')

    expect(
      await screen.findByText(/Ova adresa ne nosi vezu iz poruke, pa nema šta da se postavi/),
    ).toBeVisible()
    /* No form, because there is nothing to spend: a password typed here would be a
       password sent to a route that could only refuse it. */
    expect(screen.queryByLabelText('Nova lozinka')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Prijava' })).toBeVisible()
    /* And nothing was asked of the server, which is the other half of "no form". */
    expect(server.asked.filter((one) => one.path.startsWith('/api'))).toEqual([])
  })

  it('says nothing beside the field about how long a password has to be', async () => {
    /* The owner kept seven rules beside fields on the whole portal on 31.08.2026 and
       had the other fifty four deleted; the password field was not among the seven,
       and `forms/fieldHint.test.tsx` is what holds that. Read here as well, from the
       reader's side rather than off the source, because the sweep there knows the
       names a rule has HAD and cannot know one invented under a new one.

       The number is not absent from the screen - it is in the sentence the server's
       own refusal is told in, which the table below reads. */
    server = serverThat(() => null)

    renderAt(AT)

    await screen.findByLabelText('Nova lozinka')

    expect(screen.queryByText(new RegExp(String(SHORTEST_PASSWORD)))).not.toBeInTheDocument()
  })
})

describe('sending the new password', () => {
  it('sends both fields as they were typed, with the token off the address', async () => {
    server = serverThat(() => did())

    renderAt(AT)
    await setOne()

    const sent = at(sentToTheRoute(), 0)

    expect(JSON.parse(String(sent.init?.body))).toEqual({
      token: 'iz-poruke',
      password: TYPED,
      passwordRepeat: TYPED_AGAIN,
    })
  })

  it('says the password is set, and the form goes with it', async () => {
    server = serverThat(() => did())

    renderAt(AT)
    await setOne(TYPED, TYPED)

    expect(await screen.findByText(/Lozinka je postavljena/)).toBeVisible()
    /* The two controls are the only copy of the password the browser was holding. */
    expect(screen.queryByLabelText('Nova lozinka')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Prijava' })).toBeVisible()
  })

  it('does not send a second time while the first is still out', async () => {
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

    const user = setupUser()

    await user.type(await screen.findByLabelText('Nova lozinka'), TYPED)
    await user.type(screen.getByLabelText('Ponovi novu lozinku'), TYPED)

    /* The same element throughout: what changes with the press is the word on it and
       `aria-disabled`, not the control. */
    const press = screen.getByRole('button', { name: 'Postavi lozinku' })

    await user.click(press)
    await user.click(press)

    expect(press).toHaveAccessibleName('Šalje se')

    /* Told off rather than switched off, so the press really does reach the handler
       and the guard is what stops it. Spending the link twice would answer the second
       press with "your link is no good", to the reader who just used it. */
    expect(press).toHaveAttribute('aria-disabled', 'true')
    expect(sentToTheRoute()).toHaveLength(1)

    letGo()
    await screen.findByText(/Lozinka je postavljena/)
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
      'a form that is not complete',
      () => refused('theFormIsNotComplete'),
      new RegExp(`iste i duge najmanje ${String(SHORTEST_PASSWORD)} znakova`),
    ],
    [
      'a password that has leaked',
      () => refused('thePasswordHasLeaked'),
      /već našla u javno objavljenim provalama/,
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
    ['anything else, by its number', () => answeredWith(503), /odgovorio brojem 503/],
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
    await setOne()

    expect(await screen.findByRole('alert')).toHaveTextContent(said)
    /* And never beside a claim that it worked. Both sentences on one screen is the
       fault this row exists against: the form stays, so the reader can try again. */
    expect(screen.queryByText(/Lozinka je postavljena/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nova lozinka')).toBeVisible()
  })

  it('offers the way to a fresh link beside the one refusal a fresh link answers', async () => {
    server = serverThat(() => refused('theLinkIsNotValid'))

    renderAt(AT)
    await setOne()

    await screen.findByRole('alert')

    /* Which is where the message itself already points: „Ako veza istekne, zatražite
       novu sa strane za prijavu" (backend mail/sr.properties). */
    expect(screen.getByRole('link', { name: 'Prijava' })).toBeVisible()
  })

  it('and not beside a refusal a fresh link would not answer', async () => {
    /* Without this the row above would pass just as well on a screen that offers the
       link whatever came back, which would send somebody off to start again over a
       password he only has to retype. */
    server = serverThat(() => refused('thePasswordHasLeaked'))

    renderAt(AT)
    await setOne()

    await screen.findByRole('alert')

    expect(screen.queryByRole('link', { name: 'Prijava' })).not.toBeInTheDocument()
  })
})

describe('where the password is written', () => {
  /** Everything a string could be left in, other than the one request body and the two
   *  controls the reader typed it into. Read as a sweep rather than as a list of three
   *  suspects: the question is „did it reach anywhere at all", and a list is answered
   *  by whatever somebody thought of on the day. */
  function everywhereElse(asked: Asked[], where: string, noise: string[]): string[] {
    const store = (kept: Storage): string =>
      Object.keys(kept)
        .map((key) => `${key}=${kept.getItem(key) ?? ''}`)
        .join('|')

    return [
      ...asked.map((one) => one.path),
      ...asked.map((one) => JSON.stringify(one.init?.headers ?? {})),
      ...asked.map((one) => String(one.init?.method)),
      /* What is drawn, which is what „nikad u poruci o grešci" really means: an input
         of type password holding what was typed into it is the field doing its job,
         and a sentence on the screen repeating it is not. */
      document.body.textContent ?? '',
      where,
      window.location.href,
      store(sessionStorage),
      store(localStorage),
      ...noise,
    ]
  }

  it.each([
    ['it worked', () => did()],
    ['it was refused', () => refused('thePasswordHasLeaked')],
  ])('is the body of one request and nowhere else, when %s', async (_name, made) => {
    const noise: string[] = []
    const heard = ['debug', 'error', 'info', 'log', 'warn'] as const

    for (const kind of heard) {
      vi.spyOn(console, kind).mockImplementation((...said: unknown[]) => {
        noise.push(said.map((one) => String(one)).join(' '))
      })
    }

    try {
      server = serverThat(made)

      const { router } = renderAt(AT)

      await setOne(TYPED, TYPED)
      await waitFor(() => {
        expect(sentToTheRoute()).toHaveLength(1)
      })

      const carried = server.asked.filter((one) => String(one.init?.body ?? '').includes(TYPED))

      expect(carried, 'the password was not sent at all, so this sweep measures nothing')
        .toHaveLength(1)

      const { pathname, search, hash } = router.state.location

      expect(
        everywhereElse(server.asked, `${pathname}${search}${hash}`, noise).filter((one) =>
          one.includes(TYPED),
        ),
      ).toEqual([])
    } finally {
      vi.restoreAllMocks()
    }
  })
})

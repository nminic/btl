import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { at, must } from '../../test/at'
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
    /* And nothing was asked of the server, which is the other half of "no form".
       `GET /api/me` is the shell's own question above every screen since 20.09.2026
       (app/Shell.tsx, session/useTheServersSession.ts) and is named and set aside
       rather than the assertion being loosened to „not many requests". */
    expect(
      server.asked.filter((one) => one.path.startsWith('/api') && one.path !== '/api/me'),
    ).toEqual([])
  })

  it('says beside the field how long a password has to be, and says the number once', async () => {
    /* The owner asked for this on 20.09.2026, as the eighth rule beside a field on the
       portal: whoever reads this screen arrived from a link in a message with no rule in
       front of him, and a password box empties itself on every refusal, so learning the
       rule from the server costs him the whole thing typed again. This case said the
       opposite until that day, because the seven kept on 31.08.2026 did not include the
       password field of the registration form.

       Read from the reader's side rather than off the source: the sweep in
       `forms/fieldHint.test.tsx` knows what the portal DECLARES, and this knows what a
       reader is actually given.

       **Asked of what the field itself points at, not of the page.** The number stands
       in a second sentence on this screen, the one the server's own refusal is told in,
       and a case that looked for it anywhere on the page would be green while the rule
       beside the field was gone and the refusal was on screen instead. Those are two
       different moments and the reader is owed both.

       And the number is the one `PasswordPolicy.SHORTEST` keeps, through the single copy
       of it this portal has (`passwordRule.ts`), never a figure typed into this case. */
    server = serverThat(() => null)

    renderAt(AT)

    const field = await screen.findByLabelText('Nova lozinka')
    const described = must(
      field.getAttribute('aria-describedby'),
      'what the password field is described by',
    )
    const rule = must(document.getElementById(described), 'the rule beside the password')

    expect(rule).toHaveTextContent(new RegExp(`Najmanje ${String(SHORTEST_PASSWORD)} znakova`))
    /* And it is read out with the field rather than only drawn: a rule only sighted
       people have is a rule half the people filling in the form do not (WCAG 2.2
       SC 1.3.1, forms/FieldHint.tsx). */
    expect(rule).toHaveClass('hint__text')
    /* The refusal has not been drawn, so the only sentence carrying the number on this
       screen is the one above. Without this the assertion could be met by a screen that
       had already been told no. */
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('arriving at the address the server really writes', () => {
  /**
   * WITHOUT A LANGUAGE ON IT, WHICH IS THE ONLY ADDRESS ANYBODY EVER ARRIVES AT.
   *
   * <p>`WhatTheMessageSays.about` builds `portal.address() + message.path() + "?token="`,
   * and `SET_A_NEW_PASSWORD.path()` is `/nova-lozinka`. There is no `/sr` in it and there cannot
   * be: the server does not know which language the reader wants. Every other case in
   * this file opens `/sr/nova-lozinka?token=…`, which is where the reader ENDS UP and
   * not where he starts, so none of them touches the one piece of code that carries him
   * there.
   *
   * <p>That piece is a single expression, `LocaleLayout.tsx`:
   * `` `/${DEFAULT_LOCALE}${location.pathname}${location.search}${location.hash}` ``.
   * Measured before this case was written: deleting `${location.search}` left the whole
   * suite green, and so did deleting `${location.pathname}`. The first sends every link
   * ever posted to a screen with no token on it, the second sends it to the front page,
   * and in both cases nobody can set a password at all.
   */
  const AS_THE_SERVER_WRITES_IT = '/nova-lozinka?token=veza-iz-poruke'

  it('carries the token through the language the server did not put on it', async () => {
    server = serverThat(() => did())

    const { router } = renderAt(AS_THE_SERVER_WRITES_IT)

    await setOne()

    /* The address the reader is standing at: the language put in front of the path the
       message carried, with the query still on it. Read off the router, because a
       memory router never writes to `window.location`. */
    const { pathname, search } = router.state.location

    expect(`${pathname}${search}`).toBe('/sr/nova-lozinka?token=veza-iz-poruke')

    /* And the token really reached the route, which is the half an address alone does
       not prove: a screen could stand at the right address and send something else. The
       word is this case's own and stands nowhere else in the file, so it cannot have
       arrived from the address the other cases open. */
    expect(JSON.parse(String(at(sentToTheRoute(), 0).init?.body))).toEqual({
      token: 'veza-iz-poruke',
      password: TYPED,
      passwordRepeat: TYPED_AGAIN,
    })
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
      'a reason that names something every object already has',
      /* The word comes off the wire, so it can be `constructor` as easily as
         `nestoNovo`, and `refusals[reason]` hands back a FUNCTION for that one rather
         than nothing: the sentence below is then looked up by a function, `translate`
         breaks on it, and `ErrorBoundary` takes the whole panel away from a reader who
         should have been told what the server said. Asked with `Object.hasOwn`, which
         is the shape `refusals.test.ts` already uses, it is a reason like any other. */
      () => refused('constructor'),
      /odbio zahtev uz razlog constructor/,
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

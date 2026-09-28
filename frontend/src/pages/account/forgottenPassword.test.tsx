import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { at, inputElement, must } from '../../test/at'
import { renderAt } from '../../test/render'
import {
  answeredWith,
  did,
  forgetEveryCookie,
  isResource,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { setupUser } from '../../test/user'

/**
 * WHERE SOMEBODY WHO CANNOT GET IN ASKS FOR THE MESSAGE THAT LETS HIM.
 *
 * <p>The screen is the near end of the road `newPassword.test.tsx` measures the far end
 * of. What is worth measuring here is almost entirely about WHICH ADDRESS TRAVELS and
 * WHICH ROUTE IT TRAVELS TO, because both have a second source that would look right on
 * screen and be wrong on the wire.
 */

const AT = '/sr/zaboravljena-lozinka'

/**
 * THE ROUTE THAT ASKS FOR A LINK, AND THE ONE THAT SPENDS IT, WHICH ARE ONE WORD APART.
 *
 * <p>Both are named here so that every case can say which of the two it means. A screen
 * that sent to the second would be refused for a token it never had, and the reader
 * would be told his link is no good before he was ever sent one.
 */
const ASKS_FOR_A_LINK = '/api/password-reset/request'

const SPENDS_A_LINK = '/api/password-reset'

/**
 * TWO ADDRESSES AND NEVER ONE, so that "the address that was typed" and "an address"
 * can never be the same string. A case with one address in it cannot tell a screen that
 * sends what was typed from a screen that sends the only address it has ever seen.
 */
const TYPED = 'prvi.trkac@primer.rs'

const SOMEBODY_ELSE = 'drugi.trkac@primer.rs'

/**
 * A MEMBER THE PORTAL IS HOLDING A SESSION FOR, whose number is nothing like either
 * address above.
 *
 * <p>The session is the OTHER SOURCE this screen's one value could come from. It
 * carries no address at all - `session/context.ts` holds a member number - so a screen
 * that reached for the session instead of the field would put THIS string on the wire,
 * and it is deliberately unmistakable.
 */
const SIGNED_IN_AS = '000777'

let server: { asked: Asked[]; stop: () => void } | null = null

beforeEach(() => {
  forgetEveryCookie()
  /* Put in the jar by hand, so that what is measured is the screen and not the round
     trip `askTheServer.test.ts` already measures on its own. */
  document.cookie = 'XSRF-TOKEN=imam'
})

afterEach(() => {
  server?.stop()
  server = null
  forgetEveryCookie()
})

/** Types an address and presses the button. */
async function ask(address = TYPED): Promise<void> {
  const user = setupUser()

  await user.type(await screen.findByLabelText('Adresa elektronske pošte'), address)
  await user.click(screen.getByRole('button', { name: 'Pošalji vezu' }))
}

/** Everything that went to the route this screen is about. */
function sentToTheRoute(): Asked[] {
  return (server?.asked ?? []).filter((one) => one.path === ASKS_FOR_A_LINK)
}

/** The address a request carried. */
function addressIn(asked: Asked): unknown {
  const body: unknown = JSON.parse(String(asked.init?.body))

  return typeof body === 'object' && body !== null ? Reflect.get(body, 'email') : body
}

describe('opening the screen', () => {
  it('asks for an address and asks the server nothing yet', async () => {
    server = serverThat(() => null)

    renderAt(AT)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Zaboravljena lozinka' }),
    ).toBeVisible()
    expect(screen.getByLabelText('Adresa elektronske pošte')).toBeVisible()

    /* Nothing has been asked of the server merely by arriving. `GET /api/me` is the
       shell's own question above every screen (app/Shell.tsx) and the resources are set
       aside by a derived question rather than by name, exactly as `newPassword.test.tsx`
       sets them aside. */
    expect(
      server.asked.filter(
        (one) => one.path.startsWith('/api') && one.path !== '/api/me' && !isResource(one.path),
      ),
    ).toEqual([])
  })

  it('opens for somebody who is already signed in, because asking is not a closed door', async () => {
    /* `ApiSecurity` lists this route under `permitAll` and none of the three screens in
       this folder carries a guard of its own. A member signed in on one account may be
       asking about another, and the next case is the one that measures which address
       then travels. */
    server = serverThat(() => null)

    renderAt(AT, 'competitor', SIGNED_IN_AS)

    expect(await screen.findByLabelText('Adresa elektronske pošte')).toBeVisible()
  })
})

describe('asking for the message', () => {
  it('sends the address that was typed, to the route that asks for a link', async () => {
    server = serverThat((path) => (path === ASKS_FOR_A_LINK ? did() : null))

    renderAt(AT)
    await ask()

    expect(addressIn(at(sentToTheRoute(), 0))).toBe(TYPED)

    /* AND NOT TO THE ROUTE THAT SPENDS ONE, which is the other half of the same fact
       and the join between this screen and `askTheServer`. The two addresses differ by
       one word, and a screen sending to the wrong one would be answered about a token
       nobody gave it. */
    expect((server.asked ?? []).filter((one) => one.path === SPENDS_A_LINK)).toEqual([])
  })

  it('sends what the reader typed and not what the session knows about him', async () => {
    /* THE SECOND SOURCE OF THIS ONE VALUE. Signed in as a member whose number is on the
       session, asking about an address that is not his: what travels must be the field.
       A screen that reached for the session would send `000777`, and the member who
       really cannot get in would be sent nothing at all. */
    server = serverThat((path) => (path === ASKS_FOR_A_LINK ? did() : null))

    renderAt(AT, 'competitor', SIGNED_IN_AS)
    await ask(SOMEBODY_ELSE)

    const sent = addressIn(at(sentToTheRoute(), 0))

    expect(sent).toBe(SOMEBODY_ELSE)
    expect(sent).not.toBe(SIGNED_IN_AS)
    /* And not the other address in this file either: the two are both here so that
       „what was typed" cannot be satisfied by whichever one the screen saw first. */
    expect(sent).not.toBe(TYPED)
  })

  it('sends nothing at all while the field is empty, and says why', async () => {
    server = serverThat(() => null)

    renderAt(AT)

    const user = setupUser()
    const press = await screen.findByRole('button', { name: 'Pošalji vezu' })

    /* Told off rather than switched off, so the press really reaches the handler and
       the guard is what stops it - the shape every button on the portal has. */
    expect(press).toHaveAttribute('aria-disabled', 'true')
    expect(press).toHaveAccessibleDescription(
      'Upiši adresu elektronske pošte da bi mogao da zatražiš vezu.',
    )

    await user.click(press)

    expect(sentToTheRoute()).toEqual([])
  })

  it('does not ask a second time while the first is still out', async () => {
    let letGo = (): void => undefined
    server = serverThat((path) =>
      path === ASKS_FOR_A_LINK
        ? new Promise<Response>((resolve) => {
            letGo = () => {
              resolve(did())
            }
          })
        : null,
    )

    renderAt(AT)

    const user = setupUser()

    await user.type(await screen.findByLabelText('Adresa elektronske pošte'), TYPED)

    /* The same element throughout: what changes with the press is the word on it and
       `aria-disabled`, not the control. */
    const press = screen.getByRole('button', { name: 'Pošalji vezu' })

    await user.click(press)
    await user.click(press)

    expect(press).toHaveAccessibleName('Šalje se')
    expect(press).toHaveAttribute('aria-disabled', 'true')
    /* Two presses, one message. Asked twice, the reader would be sent two links for one
       press and the portal would have minted a second row for nothing. */
    expect(sentToTheRoute()).toHaveLength(1)

    letGo()
    await screen.findByText(/poruka sa vezom je poslata/)
  })
})

describe('what the screen says about the answer', () => {
  it('says the message is on its way, and the form goes with it', async () => {
    server = serverThat((path) => (path === ASKS_FOR_A_LINK ? did() : null))

    renderAt(AT)
    await ask()

    /* By a clause that stands in no other sentence on this screen. The heading and the
       opening line both speak of an account at an address, so a looser pattern would be
       satisfied by a screen that had answered nothing at all. */
    expect(await screen.findByText(/poruka sa vezom je poslata/)).toBeVisible()
    expect(screen.queryByLabelText('Adresa elektronske pošte')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Prijava' })).toBeVisible()
  })

  it('says exactly the same thing for an address nobody has as for one somebody has', async () => {
    /* THE AXIS THE SERVER DECIDES AND THIS SCREEN ONLY OBEYS. `PasswordResetApi`
       answers 204 either way - „REQUESTING A RESET NEVER SAYS WHETHER THE ADDRESS
       BELONGS TO ANYBODY" - so the two cases are one answer on the wire, and what is
       held here is that they are one sentence on screen too. The owner's decision of
       08.09.2026 („Registracija na vec zauzetu adresu kaze da je zauzeta") is about
       REGISTRATION and is a different road; `EmailConfirmationApi` is where the portal
       writes down why this one does not follow it.

       Read as text rather than as two renders compared by eye: both are asked, both
       answers are collected, and the two strings must be identical. */
    const said: string[] = []

    for (const address of [TYPED, SOMEBODY_ELSE]) {
      server = serverThat((path) => (path === ASKS_FOR_A_LINK ? did() : null))

      const { unmount } = renderAt(AT)

      await ask(address)

      said.push((await screen.findByText(/poruka sa vezom je poslata/)).textContent ?? '')

      /* Both really went, so this is two answers and not one measured twice. */
      expect(addressIn(at(sentToTheRoute(), 0))).toBe(address)

      unmount()
      server.stop()
    }

    expect(said).toHaveLength(2)
    expect(at(said, 0)).toBe(at(said, 1))
    /* And neither of them names the address, which is the way this screen could leak
       the very thing the route refuses to say. */
    expect(at(said, 0)).not.toContain(TYPED)
    expect(at(said, 1)).not.toContain(SOMEBODY_ELSE)
  })

  it('keeps the address in the field when the server refuses, so it is not typed again', async () => {
    server = serverThat((path) => (path === ASKS_FOR_A_LINK ? answeredWith(500) : null))

    renderAt(AT)
    await ask()

    expect(await screen.findByRole('alert')).toHaveTextContent(/odgovorio brojem 500/)

    /* The form is still standing and still holds what was typed. Emptied, the reader
       would have to type the address again over an answer that says „try again in a few
       minutes", which is the one thing it asks him to do. */
    const field = inputElement(screen.getByLabelText('Adresa elektronske pošte'))

    expect(field.value).toBe(TYPED)
    expect(screen.getByRole('button', { name: 'Pošalji vezu' })).toBeVisible()
  })

  it('says what the server said, for each answer that is not a yes', async () => {
    /* The three shapes this route can come back in that are not 204. It names no
       refusal of its own - it declares no reason constant, which is what
       `refusals.test.ts` reads the other routes' by - so `ServerSaid` is handed an
       empty map and these three sentences are the whole of what there is to say. */
    const answers: [name: string, made: () => Response, said: RegExp][] = [
      ['a token the server did not recognise', () => answeredWith(403), /nije uspeo da dokaže/],
      ['a number nothing else explains', () => answeredWith(500), /odgovorio brojem 500/],
    ]

    for (const [, made, said] of answers) {
      server = serverThat((path) => (path === ASKS_FOR_A_LINK ? made() : null))

      const { unmount } = renderAt(AT)

      await ask()

      expect(await screen.findByRole('alert')).toHaveTextContent(said)

      unmount()
      server.stop()
    }
  })

  it('says so when it never reached the server at all', async () => {
    server = serverThat((path) => {
      if (path === ASKS_FOR_A_LINK) {
        throw new Error('nema veze')
      }

      return null
    })

    renderAt(AT)
    await ask()

    expect(await screen.findByRole('alert')).toHaveTextContent(/nije uspeo da dođe do servera/)
  })
})

describe('the way in', () => {
  /**
   * WHAT THE MESSAGES ALREADY CALL THIS PAGE, READ OUT OF THE MESSAGES.
   *
   * <p>`mail/sr.properties` tells a member whose link ran out to ask for a new one „sa
   * strane za prijavu, na „Zaboravljena lozinka"". That is a promise the portal has been
   * posting, and until this screen existed it pointed at nothing.
   *
   * <p><b>Read rather than repeated, and that is the whole point of this case.</b> The
   * name lives on the other side of the repository, so a case that wrote it down here
   * would be holding its own copy against itself: renaming the link and the properties
   * file apart would stay green, and the reader following the message would be looking
   * for a control that is not there. The same shape `refusals.test.ts` uses to read the
   * Java sources, and the reason `test/serverConfig.test.ts` reads `deploy/` from here.
   */
  const MAIL = join(
    process.cwd(),
    '..',
    'backend',
    'src',
    'main',
    'resources',
    'mail',
    'sr.properties',
  )

  /**
   * The one control the messages name, in the Serbian quotation marks they name it in.
   *
   * <p>The closing mark is the plain ASCII one and the opening is U+201E, which is how
   * the file is really written; measured rather than assumed, because a pattern that
   * expected a matching pair would find nothing and this case would then be holding an
   * empty string against an empty string.
   */
  function theControlTheMessagesName(): string[] {
    return [...readFileSync(MAIL, 'utf-8').matchAll(/„([^"]+)"/g)].map((one) => one[1] ?? '')
  }

  it('is a link on the sign-in page, called what the messages call it, and it leads here', async () => {
    const named = theControlTheMessagesName()

    /* The floor under the reading itself: a pattern that stopped matching would leave
       nothing to check and this case would pass saying nothing. One name is what the
       file holds today, and a second one is a decision somebody has to make rather than
       something this case should guess at. */
    expect(named).toHaveLength(1)

    const name = must(at(named, 0), 'the control the messages name')

    expect(name).not.toBe('')

    server = serverThat(() => null)

    const { router } = renderAt('/sr/prijava')

    const way = await screen.findByRole('link', { name })

    /* Followed rather than read off the attribute: an `href` proves where a link points
       and not that anything is served there. Pressing it is what holds the two screens
       together. */
    await setupUser().click(way)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Zaboravljena lozinka' }),
    ).toBeVisible()
    expect(screen.getByLabelText('Adresa elektronske pošte')).toBeVisible()
    expect(router.state.location.pathname).toBe(AT)
  })
})

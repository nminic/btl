import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Locale } from '../../i18n/config'
import en from '../../i18n/en.json'
import { I18nProvider } from '../../i18n/I18nProvider'
import sr from '../../i18n/sr.json'
import { renderAt } from '../../test/render'
import {
  answeredWith,
  forgetEveryCookie,
  serverThat,
  type Asked,
} from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { WhatTheServerSaid } from '../admin/WhatTheServerSaid'
import { ServerSaid } from './ServerSaid'
import { NewTabForTheAccess } from './TheSiteIsLocked'

/**
 * WHAT A READER IS TOLD WHEN THE BROWSER FORGOT THE WORD THAT UNLOCKS THE SITE (owner, 22.10.2026,
 * `btl-produkt/ADL.md`, „portal to kaže i nudi novu karticu").
 *
 * <p><b>The words are written out here, letter for letter, and not read from the dictionary.</b> The
 * owner approved these sentences by choosing the option that carried them, and a case that compared
 * the screen with `sr.server.locked` would pass for any sentence at all: it would measure the
 * dictionary against itself. The English is the author's translation and the owner has not seen it
 * (`btl-produkt/ADL.md` says so too), so it is held against the dictionary only to be sure it is there.
 *
 * <p>`askTheServer.test.ts` holds what makes an answer THIS answer; this file holds what is drawn for
 * it, on every component that draws an answer, and on two real screens, because the join between the
 * two is a file apart from either.
 */

const SENTENCE =
  'Pregledač je zaboravio pristupnu šifru za probni period. Otvori portal u novoj kartici i ukucaj je tamo, pa se vrati ovde i pošalji ponovo; ono što si upisao je i dalje tu.'

const OPEN = 'Otvori u novoj kartici'

const CHALLENGE = 'Basic realm="restricted"'

let server: { asked: Asked[]; stop: () => void } | null = null

beforeEach(() => {
  forgetEveryCookie()
  document.cookie = 'XSRF-TOKEN=imam'
})

afterEach(() => {
  server?.stop()
  server = null
  forgetEveryCookie()
  cleanup()
})

/** A 401 as the proxy gives it: no body, the challenge on it. */
function theProxyAnswer(): Response {
  return new Response(null, { status: 401, headers: { 'www-authenticate': CHALLENGE } })
}

function drawn(node: React.ReactNode, locale: Locale = 'sr') {
  render(
    <I18nProvider locale={locale}>
      <MemoryRouter>{node}</MemoryRouter>
    </I18nProvider>,
  )
}

describe('the sentence and the way to a new tab', () => {
  it('says the owner’s words as an alert, and offers the new tab beside them', () => {
    drawn(<ServerSaid answer={{ got: 'locked' }} refusals={{}} />)

    expect(screen.getByRole('alert')).toHaveTextContent(SENTENCE)
    expect(screen.getByRole('link', { name: OPEN })).toBeInTheDocument()
  })

  it('opens the front page in the reader’s language, in a tab that gets no handle on this one', () => {
    drawn(<ServerSaid answer={{ got: 'locked' }} refusals={{}} />)

    const link = screen.getByRole('link', { name: OPEN })

    /* The front page and never the address the reader is on: the screens that take a link out of a
       message carry a token in theirs that is spent when it is read. */
    expect(link).toHaveAttribute('href', '/sr')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')?.split(' ')).toContain('noopener')
  })

  it('is read together with the sentence it answers, so the link is not “open in a new tab” on its own', () => {
    drawn(<ServerSaid answer={{ got: 'locked' }} refusals={{}} />)

    expect(screen.getByRole('link', { name: OPEN })).toHaveAccessibleDescription(SENTENCE)
  })

  it('says it in English, to an address in English, and the translation is there', () => {
    drawn(<ServerSaid answer={{ got: 'locked' }} refusals={{}} />, 'en')

    expect(screen.getByRole('alert')).toHaveTextContent(en.server.locked)
    expect(screen.getByRole('link', { name: en.server.lockedOpen })).toHaveAttribute('href', '/en')
    /* Not the Serbian one by a missing key, which `translate` would answer with the key itself. */
    expect(en.server.locked).not.toBe(sr.server.locked)
    expect(en.server.lockedOpen).not.toBe(sr.server.lockedOpen)
  })

  it('is not looked up in what the screen’s own route can say, because it was never the route that said it', () => {
    drawn(
      <ServerSaid
        answer={{ got: 'locked' }}
        refusals={{ locked: 'server.nothing' }}
        numbers={{ 401: 'server.nothing' }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(SENTENCE)
  })

  it('is said by the queues of administration too, which keep their own switch', () => {
    drawn(<WhatTheServerSaid answer={{ got: 'locked' }} />)

    expect(screen.getByRole('alert')).toHaveTextContent(SENTENCE)
    expect(screen.getByRole('link', { name: OPEN })).toHaveAccessibleDescription(SENTENCE)
  })

  it('is not mistaken for “nothing came back” or for a number by that switch', () => {
    drawn(<WhatTheServerSaid answer={{ got: 'locked' }} />)

    for (const other of [sr.server.nothing, sr.server.wrong.replace('{status}', '401')]) {
      expect(screen.getByRole('alert')).not.toHaveTextContent(other)
    }
  })

  it('offers the new tab alone where the sentence stands in a list, and then has nothing to be read with', () => {
    drawn(<NewTabForTheAccess />)

    const link = screen.getByRole('link', { name: OPEN })

    expect(link).toHaveAttribute('href', '/sr')
    expect(link).toHaveAccessibleDescription('')
  })
})

describe('on the screens', () => {
  /** Everything a value could be left in, other than what is drawn. */
  function leftBehind(): string[] {
    const store = (kept: Storage): string =>
      Object.keys(kept)
        .map((key) => `${key}=${kept.getItem(key) ?? ''}`)
        .join('|')

    return [store(sessionStorage), store(localStorage), document.cookie]
  }

  it('keeps what was typed on the screen the sentence stands on, and writes it nowhere', async () => {
    const typed = 'prvi.trkac@primer.rs'
    const noise: string[] = []

    for (const kind of ['debug', 'error', 'info', 'log', 'warn'] as const) {
      vi.spyOn(console, kind).mockImplementation((...said: unknown[]) => {
        noise.push(said.map((one) => String(one)).join(' '))
      })
    }

    try {
      server = serverThat((path) => (path === '/api/password-reset/request' ? theProxyAnswer() : null))
      renderAt('/sr/zaboravljena-lozinka')

      const user = setupUser()
      const field = await screen.findByLabelText('Adresa elektronske pošte')

      await user.type(field, typed)
      await user.click(screen.getByRole('button', { name: 'Pošalji vezu' }))

      expect(await screen.findByText(SENTENCE)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: OPEN })).toBeInTheDocument()
      /* THE WHOLE OF „ono što si upisao je i dalje tu": the page was never left, so the field holds
         what it held. The promise is kept by not doing anything, and this is where that is read. */
      expect(field).toHaveValue(typed)
      /* And not in a place that outlives the page. The only cookie is the one the case put there. */
      expect(
        leftBehind().filter((one) => one.includes(typed)),
        'the address was left somewhere outside the page',
      ).toEqual([])
      expect(document.cookie).toBe('XSRF-TOKEN=imam')
      expect(sessionStorage.length + localStorage.length).toBe(0)
      expect(noise.filter((one) => one.includes(typed))).toEqual([])
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('says the site is locked and not that the password was wrong, when it is the sign-in that was answered', async () => {
    server = serverThat((path) => (path === '/api/sign-in' ? theProxyAnswer() : null))
    renderAt('/sr/prijava')

    const user = setupUser()

    await user.type(await screen.findByLabelText('Adresa elektronske pošte'), 'a@primer.rs')
    await user.type(screen.getByLabelText('Lozinka'), 'tajna-lozinka-1')
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }))

    expect(await screen.findByText(SENTENCE)).toBeInTheDocument()
    expect(screen.queryByText(sr.signIn.refused)).not.toBeInTheDocument()
  })

  it('still says the password was wrong when the portal itself answered 401, which carries no challenge', async () => {
    /* The cell beside the one above, and the reason the challenge is read: the number is the same. */
    server = serverThat((path) => (path === '/api/sign-in' ? answeredWith(401) : null))
    renderAt('/sr/prijava')

    const user = setupUser()

    await user.type(await screen.findByLabelText('Adresa elektronske pošte'), 'a@primer.rs')
    await user.type(screen.getByLabelText('Lozinka'), 'tajna-lozinka-1')
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }))

    expect(await screen.findByText(sr.signIn.refused)).toBeInTheDocument()
    expect(screen.queryByText(SENTENCE)).not.toBeInTheDocument()
  })
})

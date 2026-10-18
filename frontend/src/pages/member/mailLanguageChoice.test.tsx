import { cleanup, configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearResourceCache } from '../../data/client'
import sr from '../../i18n/sr.json'
import { useSession } from '../../session/useSession'
import { must } from '../../test/at'
import { aNeverPaidRecord } from '../../test/neverPaid'
import { renderAt } from '../../test/render'
import { answeredWith, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { THE_MAIL_LANGUAGE_GOES_TO, type MailLanguage } from './mailLanguage'

/**
 * THE LANGUAGE OF AN ACCOUNT'S MAIL, CHOSEN ON THE SETTINGS SCREEN (JM-B).
 *
 * <p>PDL, the answers of 17.10.2026 on the language of the mail, chosen by the owner between offered
 * outcomes (the sentence is the record's and not his own words): „Jezik pošte sme da promeni svako
 * ko ima nalog, i član bez plaćene članarine i član kome je istekla, jer je to podešavanje naloga a
 * ne takmičarsko pravo." And the entry of 03.10.2026 that the screen does not remember a language:
 * the page's language is the address's, and the mail's is a column of the account. The two are never
 * allowed to stand in for each other, which is what most of this file is about.
 *
 * <p><b>Every case answers `GET /api/me` itself</b> and says what the account holds, rather than
 * leaning on the harness that answers „sr" for everybody: a harness that always says „sr" cannot tell
 * a panel that reads the server from one that reads the page's language on a Serbian page, or from
 * one that opens on Serbian whatever it is told. The server below is stateful on purpose, so that a
 * write is followed by a read that agrees with it, as the real one is.
 *
 * <p>Every wait is given half of the time a case has, so a wait that never succeeds ends the case in
 * an assertion and not in its own clock (`pages/admin/saveWhileSaving.test.tsx`).
 */
configure({ asyncUtilTimeout: SLOW / 2 })

type Kind = 'member' | 'lapsed' | 'neverPaid' | 'account'

/** `GET /api/me` for each of the four kinds of reader the screen draws, without the language. */
const WHO: Record<Kind, object> = {
  member: { role: 'competitor', account: 1, member: { memberNumber: '000007', active: true } },
  lapsed: { role: 'competitor', account: 1, member: { memberNumber: '000032', active: false } },
  neverPaid: { role: 'competitor', account: 1, member: aNeverPaidRecord },
  /* A moderator: signed in, and no competitor record behind the account (PDL P21). */
  account: { role: 'moderator', account: 1 },
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

type Server = {
  asked: Asked[]
  writes: () => Asked[]
  held: () => MailLanguage | null
  stop: () => void
}

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }

  clearResourceCache()
})

/**
 * A server holding an account of the given kind whose mail is written in `held`.
 *
 * `onWrite` answers `PUT /api/me/mail-language` and is handed the language the screen sent; the
 * default is the honest one: the row takes it and the answer names what the row now holds.
 */
function theServer(
  kind: Kind,
  held: MailLanguage | null,
  onWrite: (wanted: string, keep: (language: MailLanguage) => void) => Response | Promise<Response> = (
    wanted,
    keep,
  ) => {
    const language = wanted === 'en' ? 'en' : 'sr'

    keep(language)

    return json({ language })
  },
): Server {
  let language = held
  const { asked, stop } = serverThat((path, init) => {
    if (path === '/api/me' && (init?.method ?? 'GET') === 'GET') {
      return json({ ...WHO[kind], ...(language === null ? {} : { mailLanguage: language }) })
    }

    if (path === THE_MAIL_LANGUAGE_GOES_TO && init?.method === 'PUT') {
      const sent: unknown = JSON.parse(String(init.body))
      const wanted =
        typeof sent === 'object' && sent !== null ? String(Reflect.get(sent, 'language')) : ''

      return onWrite(wanted, (now) => {
        language = now
      })
    }

    return null
  })

  stops.push(stop)

  return {
    asked,
    writes: () => asked.filter((one) => one.path === THE_MAIL_LANGUAGE_GOES_TO),
    held: () => language,
    stop,
  }
}

const sentIn = (one: Asked): unknown => JSON.parse(String(one.init?.body))

/** The panel, found by what it is called and not by where it stands. */
const panel = async (name = 'Pošta') => within(await screen.findByRole('region', { name }))

/** Whether a radio is the one chosen, asked of the document and not of a property the type lacks. */
const isChosen = (one: HTMLElement): boolean => one.matches(':checked')

const radio = async (name: 'Srpski' | 'English', inPanel?: Awaited<ReturnType<typeof panel>>) =>
  (inPanel ?? (await panel())).findByRole('radio', { name })

describe('who is drawn the choice of the language of the mail', () => {
  /**
   * EVERY KIND OF READER THERE IS, WITH THE LANGUAGE THE SERVER HOLDS FOR HIM CHOSEN.
   *
   * <p>The four kinds and both languages, so that a panel hidden from one kind, a panel that opens on
   * one language whatever the server says, and a panel that leaves both radios empty all fail here.
   * The account with no record is the one this increment widens the settings for, and the member
   * whose fee has lapsed is the one the first version of the rule left out (the owner's answer of
   * 17.10.2026 turned both round).
   */
  it.each([
    ['member', 'sr'],
    ['member', 'en'],
    ['lapsed', 'sr'],
    ['lapsed', 'en'],
    ['neverPaid', 'sr'],
    ['neverPaid', 'en'],
    ['account', 'sr'],
    ['account', 'en'],
  ] as const)(
    'draws the choice to a %s account whose mail is written in %s, with that one chosen',
    async (kind, language) => {
      theServer(kind, language)
      renderAt('/sr/podesavanja', 'visitor', null)

      const mine = await panel()
      const serbian = await radio('Srpski', mine)
      const english = await radio('English', mine)

      expect(isChosen(serbian)).toBe(language === 'sr')
      expect(isChosen(english)).toBe(language === 'en')
      expect(mine.getAllByRole('radio')).toHaveLength(2)
    },
    SLOW,
  )

  it('draws the choice under the title of the group, and the two radios inside that group', async () => {
    theServer('member', 'sr')
    renderAt('/sr/podesavanja', 'visitor', null)

    const group = await screen.findByRole('group', { name: 'Jezik pošte' })

    expect(
      within(group)
        .getAllByRole('radio')
        .map((one) => one.getAttribute('value')),
    ).toEqual(['sr', 'en'])
  }, SLOW)

  it('draws it to nobody who is not signed in, and sends nothing', async () => {
    const server = serverThat((path) => (path.startsWith('/api') ? answeredWith(401) : null))

    stops.push(server.stop)
    renderAt('/sr/podesavanja', 'visitor', null)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Za ovo treba prijava' }),
    ).toBeVisible()
    expect(screen.queryByRole('group', { name: 'Jezik pošte' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pošta' })).not.toBeInTheDocument()
    expect(server.asked.filter((one) => one.path === THE_MAIL_LANGUAGE_GOES_TO)).toEqual([])
  }, SLOW)

  it('draws an account with no record the language of its mail beside the theme and the password, and none of the competitor panels', async () => {
    /* Since the evening of 17.10.2026 (PDL: „Nalog administracije bez člana na strani Podešavanja vidi
       sve troje: jezik pošte, izbor teme i promenu lozinke"); the record before it drew such an account
       the language alone. What is still not drawn is every panel that is a competitor's. */
    theServer('account', 'sr')
    renderAt('/sr/podesavanja', 'visitor', null)

    expect(await screen.findByRole('heading', { level: 1, name: 'Podešavanja' })).toBeVisible()
    await radio('Srpski')

    expect(
      within(screen.getByRole('main'))
        .getAllByRole('heading', { level: 2 })
        .map((one) => one.textContent),
    ).toEqual(['Lozinka', 'Izgled', 'Pošta'])
    expect(screen.getByRole('radio', { name: 'Tamna' })).toBeVisible()
  }, SLOW)
})

describe('the language of the mail and the language of the page are two things', () => {
  /**
   * THE MUTATION THIS EXISTS FOR IS THE COMFORTABLE ONE: the choice read off the address.
   *
   * <p>On a Serbian page it is right whenever the member chose Serbian, which is most of them, so a
   * panel that took the page's language for the mail's passes every case in which the two agree. The
   * four combinations are therefore all walked, and the two that disagree are the ones that measure
   * anything.
   */
  it.each([
    ['/sr/podesavanja', 'sr', 'Jezik pošte'],
    ['/sr/podesavanja', 'en', 'Jezik pošte'],
    ['/en/podesavanja', 'sr', 'Language of the mail'],
    ['/en/podesavanja', 'en', 'Language of the mail'],
  ] as const)(
    'on %s, for an account whose mail is written in %s, chooses that one and names the group "%s"',
    async (at, language, legend) => {
      theServer('member', language)
      renderAt(at, 'visitor', null)

      const group = await screen.findByRole('group', { name: legend })

      expect(
        isChosen(within(group).getByRole('radio', { name: 'Srpski' })),
      ).toBe(language === 'sr')
      expect(
        isChosen(within(group).getByRole('radio', { name: 'English' })),
      ).toBe(language === 'en')
    },
    SLOW,
  )

  it('names the two options in their own languages on both pages', async () => {
    theServer('member', 'sr')
    renderAt('/en/podesavanja', 'visitor', null)

    const group = await screen.findByRole('group', { name: 'Language of the mail' })

    expect(within(group).getByRole('radio', { name: 'Srpski' })).toBeVisible()
    expect(within(group).getByRole('radio', { name: 'English' })).toBeVisible()
  }, SLOW)

  it('sends nothing when the language of the page changes, and keeps the choice', async () => {
    const server = theServer('member', 'sr')
    const { router } = renderAt('/sr/podesavanja', 'visitor', null)

    expect(isChosen(await radio('Srpski'))).toBe(true)

    await router.navigate('/en/podesavanja')

    const group = within(await screen.findByRole('group', { name: 'Language of the mail' }))

    expect(isChosen(group.getByRole('radio', { name: 'Srpski' }))).toBe(true)
    expect(isChosen(group.getByRole('radio', { name: 'English' }))).toBe(false)
    expect(server.writes()).toEqual([])
  }, SLOW)

  it('does not change the language of the page when the language of the mail is chosen', async () => {
    const user = setupUser()
    const server = theServer('member', 'sr')
    const { router } = renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))
    await (await panel()).findByText(sr.account.saved)

    expect(server.held()).toBe('en')
    expect(router.state.location.pathname).toBe('/sr/podesavanja')
    expect(screen.getByRole('heading', { level: 1, name: 'Podešavanja' })).toBeVisible()
  }, SLOW)

  it('keeps the choice made on one page when the other page is opened', async () => {
    const user = setupUser()

    theServer('member', 'sr')

    const { router } = renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))
    await (await panel()).findByText(sr.account.saved)
    await router.navigate('/en/podesavanja')

    const group = within(await screen.findByRole('group', { name: 'Language of the mail' }))

    expect(isChosen(group.getByRole('radio', { name: 'English' }))).toBe(true)
    expect(isChosen(group.getByRole('radio', { name: 'Srpski' }))).toBe(false)
  }, SLOW)
})

describe('choosing the language of the mail', () => {
  it.each([
    ['sr', 'English', 'en'],
    ['en', 'Srpski', 'sr'],
  ] as const)(
    'sends that one field and nothing else when the mail is %s and %s is pressed',
    async (held, pressed, sent) => {
      const user = setupUser()
      const server = theServer('member', held)

      renderAt('/sr/podesavanja', 'visitor', null)

      await user.click(await radio(pressed))
      await (await panel()).findByText(sr.account.saved)

      expect(server.writes()).toHaveLength(1)

      const write = must(server.writes()[0], 'the one write')

      expect(write.init?.method).toBe('PUT')
      expect(sentIn(write)).toEqual({ language: sent })
    },
    SLOW,
  )

  it('sends the choice the moment it is made, with no button to press', async () => {
    const user = setupUser()
    const server = theServer('lapsed', 'sr')

    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))

    await waitFor(() => {
      expect(server.writes()).toHaveLength(1)
    })
    expect(screen.queryByRole('button', { name: /Sačuvaj/ })).not.toBeInTheDocument()
  }, SLOW)

  it('sends it for an account with no record, a member who has not paid and a lapsed member alike', async () => {
    for (const kind of ['account', 'neverPaid', 'lapsed'] as const) {
      const user = setupUser()
      const server = theServer(kind, 'sr')
      const { unmount } = renderAt('/sr/podesavanja', 'visitor', null)

      await user.click(await radio('English'))
      await (await panel()).findByText(sr.account.saved)

      expect(sentIn(must(server.writes()[0], `the write of ${kind}`)), kind).toEqual({
        language: 'en',
      })
      expect(isChosen(await radio('English')), kind).toBe(true)

      unmount()
      server.stop()
      clearResourceCache()
    }
  }, SLOW)

  it('says it was saved, and takes the focus there, because the radio the finger was on is gone', async () => {
    const user = setupUser()

    theServer('member', 'sr')
    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))

    const saved = await (await panel()).findByText(sr.account.saved)

    expect(saved).toHaveAttribute('role', 'status')
    await waitFor(() => {
      expect(saved).toHaveFocus()
    })
  }, SLOW)

  it('shows what the row now holds and not what was pressed', async () => {
    /* The press says „English" and the answer says the row holds „Srpski". They are made to DISAGREE
       on purpose: written from the pressed value, the group would sit on English over a row that
       says otherwise, and the member would believe his mail is in a language it is not in. */
    const user = setupUser()
    const server = theServer('member', 'sr', () => json({ language: 'sr' }))

    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))
    await (await panel()).findByText(sr.account.saved)

    expect(server.writes()).toHaveLength(1)
    expect(isChosen(await radio('Srpski'))).toBe(true)
    expect(isChosen(await radio('English'))).toBe(false)
  }, SLOW)

  it('holds both radios still while the request is out, and sends no second one', async () => {
    const user = setupUser()
    let answer: (one: Response) => void = () => undefined
    const server = theServer(
      'member',
      'sr',
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    )

    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))

    await waitFor(() => {
      expect(server.writes()).toHaveLength(1)
    })
    expect(await radio('Srpski')).toBeDisabled()
    expect(await radio('English')).toBeDisabled()

    answer(json({ language: 'en' }))

    await (await panel()).findByText(sr.account.saved)

    expect(await radio('Srpski')).toBeEnabled()
    expect(await radio('English')).toBeEnabled()
    expect(server.writes()).toHaveLength(1)
  }, SLOW)

  it('sends nothing when the choice already standing is pressed again', async () => {
    const user = setupUser()
    const server = theServer('member', 'sr')

    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('Srpski'))

    expect(server.writes()).toEqual([])
  }, SLOW)

  it('takes the old confirmation away the moment another choice is sent', async () => {
    const user = setupUser()
    let answer: (one: Response) => void = () => undefined
    let first = true
    const server = theServer('member', 'sr', (wanted) => {
      if (first) {
        first = false

        return json({ language: wanted })
      }

      return new Promise<Response>((resolve) => {
        answer = resolve
      })
    })

    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))
    await (await panel()).findByText(sr.account.saved)

    await user.click(await radio('Srpski'))

    await waitFor(() => {
      expect(server.writes()).toHaveLength(2)
    })
    expect((await panel()).queryByText(sr.account.saved)).not.toBeInTheDocument()

    answer(json({ language: 'sr' }))
    await (await panel()).findByText(sr.account.saved)
  }, SLOW)
})

describe('when the server will not take the choice', () => {
  it('says the reason in words, leaves the choice where it was and does not say it was saved', async () => {
    const user = setupUser()

    theServer('member', 'sr', () => refused('theFormIsNotComplete'))
    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))

    const mine = await panel()
    const said = await mine.findByText(sr.settings.mailLanguageNotChosen)

    expect(said).toBeVisible()
    expect(said).toHaveAttribute('role', 'alert')
    expect(isChosen(await radio('Srpski'))).toBe(true)
    expect(isChosen(await radio('English'))).toBe(false)
    expect(mine.queryByText(sr.account.saved)).not.toBeInTheDocument()
    /* Enabled again, so a reader who was refused can press once more. */
    expect(await radio('English')).toBeEnabled()
  }, SLOW)

  it('names the number when the server answers one the screen has no sentence for', async () => {
    const user = setupUser()

    theServer('member', 'sr', () => answeredWith(500))
    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))

    expect(await (await panel()).findByText(/Server je odgovorio brojem 500/)).toBeVisible()
    expect(isChosen(await radio('Srpski'))).toBe(true)
  }, SLOW)

  it('says the portal could not reach the server when the request never arrives', async () => {
    const user = setupUser()

    theServer('member', 'sr', () => Promise.reject(new TypeError('Failed to fetch')))
    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))

    expect(await (await panel()).findByText(sr.server.nothing)).toBeVisible()
    expect(isChosen(await radio('Srpski'))).toBe(true)
  }, SLOW)

  it('moves nothing on an answer it cannot read, and says so', async () => {
    /* A 200 with no language in it is a portal one release behind its server. The group stays on
       what it showed, and the member is not told it was saved. */
    const user = setupUser()

    theServer('member', 'sr', () => json({ somethingElse: true }))
    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))

    const mine = await panel()

    expect(await mine.findByText(/Server je odgovorio brojem 200/)).toBeVisible()
    expect(isChosen(await radio('Srpski'))).toBe(true)
    expect(mine.queryByText(sr.account.saved)).not.toBeInTheDocument()
  }, SLOW)

  it('moves nothing on an answer that names a language the portal does not write', async () => {
    const user = setupUser()

    theServer('member', 'sr', () => json({ language: 'de' }))
    renderAt('/sr/podesavanja', 'visitor', null)

    await user.click(await radio('English'))

    expect(await (await panel()).findByText(/Server je odgovorio brojem 200/)).toBeVisible()
    expect(isChosen(await radio('Srpski'))).toBe(true)
    expect(isChosen(await radio('English'))).toBe(false)
  }, SLOW)
})

describe('when the language of the mail cannot be read', () => {
  it('says so, offers to ask again by the name of the part, and draws the rest of the screen', async () => {
    /* The shell's question is answered; the panel's own is not, and the third is. The panels read in
       the order they stand on the screen, which is what makes „the second" the language's. */
    let answered = 0

    stops.push(
      serverThat((path) => {
        if (path !== '/api/me') {
          return null
        }

        answered += 1

        return answered === 2
          ? json({ ...WHO.account })
          : json({ ...WHO.account, mailLanguage: 'en' })
      }).stop,
    )

    const user = setupUser()

    renderAt('/sr/podesavanja', 'visitor', null)

    const mine = await panel()

    expect(await mine.findByText('Podaci se ne mogu učitati.')).toBeVisible()
    expect(mine.queryByRole('radio')).not.toBeInTheDocument()

    await user.click(mine.getByRole('button', { name: 'Pokušaj ponovo: Pošta' }))

    expect(isChosen(await radio('English'))).toBe(true)
    expect(isChosen(await radio('Srpski'))).toBe(false)
    expect(answered).toBe(3)
  }, SLOW)

  it('does not open on Serbian when the answer has no language in it', async () => {
    theServer('account', null)
    renderAt('/sr/podesavanja', 'visitor', null)

    const mine = await panel()

    expect(await mine.findByText('Podaci se ne mogu učitati.')).toBeVisible()
    expect(mine.queryByRole('radio', { name: 'Srpski' })).not.toBeInTheDocument()
  }, SLOW)
})

function SignInAsAnother({ account }: { account: number }) {
  const { theServerSignedMeIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        theServerSignedMeIn({
          account,
          memberNumber: null,
          country: null,
          firstSeason: null,
          teamId: null,
          membershipBasis: null,
          referralCode: null,
          referredCount: null,
          hasARecord: false,
          feeStands: null,
        })
      }}
    >
      prijavi drugog
    </button>
  )
}

describe('the choice of somebody else signing in beside the first', () => {
  /**
   * A SHARED LAPTOP AT A RACE: `SessionProvider` sits above the router, so the sign in screen is
   * walkable while somebody is signed in and one visit can hold two people.
   *
   * <p>The language is held by the reader it was asked for (`useMyMailLanguage`), and the screen is
   * what hands the hook that reader. A hook that ignored it would hold the first answer for ever and
   * the second person would be drawn the first one's language, and could press a radio on it.
   */
  it('draws the second reader his own language and not the first reader\'s', async () => {
    const user = setupUser()
    let whose: MailLanguage = 'en'

    stops.push(
      serverThat((path) =>
        path === '/api/me' ? json({ ...WHO.account, mailLanguage: whose }) : null,
      ).stop,
    )
    renderAt(
      '/sr/podesavanja',
      'visitor',
      null,
      undefined,
      undefined,
      <SignInAsAnother account={2} />,
    )

    expect(isChosen(await radio('English'))).toBe(true)

    whose = 'sr'
    await user.click(screen.getByRole('button', { name: 'prijavi drugog' }))

    await waitFor(async () => {
      expect(isChosen(await radio('Srpski'))).toBe(true)
    })
    expect(isChosen(await radio('English'))).toBe(false)
  }, SLOW)
})

describe('the keyboard', () => {
  it('reaches the group, moves inside it with the arrows and sends the one it lands on', async () => {
    const user = setupUser()
    const server = theServer('member', 'sr')

    renderAt('/sr/podesavanja', 'visitor', null)

    const serbian = await radio('Srpski')

    serbian.focus()
    expect(serbian).toHaveFocus()

    await user.keyboard('{ArrowDown}')

    await (await panel()).findByText(sr.account.saved)

    expect(sentIn(must(server.writes()[0], 'the one write'))).toEqual({ language: 'en' })
  }, SLOW)
})

describe('the language of the mail, after a refresh', () => {
  /**
   * WHAT HE CHOSE IS WHAT THE NEXT VISIT HOLDS (owner, 18.10.2026: „budi siguran da se cuvaju i ostala
   * polja").
   *
   * <p>The server above keeps what it is told and answers the next `GET /api/me` out of the same place.
   * The screen is torn down as a refresh does it (`cleanup`, and the visit's cached lists with it) and
   * drawn again; the radio that is chosen can then come from the server and from nowhere else. Both
   * directions, because a panel that only ever opened on one language passes the first.
   */
  it.each([
    ['sr', 'en', 'English'],
    ['en', 'sr', 'Srpski'],
  ] as const)('opens on %s, is changed to %s, and opens on %s after a refresh', async (from, to, name) => {
    const user = setupUser()
    const server = theServer('member', from)

    renderAt('/sr/podesavanja', 'visitor', null)
    await user.click(await radio(name))
    await waitFor(() => {
      expect(server.held()).toBe(to)
    })

    cleanup()
    clearResourceCache()
    renderAt('/sr/podesavanja', 'visitor', null)

    expect(isChosen(await radio(name))).toBe(true)
    expect(isChosen(await radio(name === 'English' ? 'Srpski' : 'English'))).toBe(false)
  }, SLOW)
})

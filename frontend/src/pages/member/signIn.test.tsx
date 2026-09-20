import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { at, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, did, forgetEveryCookie, serverThat, type Asked } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'

/**
 * SIGNING IN AGAINST A SERVER THAT ANSWERS, READ THE WAY A MEMBER MEETS IT.
 *
 * <p><b>The fake server below is a little state machine and not a table of answers</b>,
 * and that is the whole reason these cases measure anything. A visit begins with
 * `GET /api/me` answering 401, signing in is what makes it answer 200, and the two
 * facts a case sets up - what is TYPED into the form and what `/api/me` says - are
 * deliberately different things. A case whose form named the same role the server
 * answers with could not tell „the role came from the server" from „the role came from
 * the form", and the second is exactly the thing this increment replaced.
 *
 * <p><b>So every case that says anything about a role types an address naming ANOTHER
 * role.</b> A moderator's address against a superadmin's answer, a superadmin's address
 * against a moderator's. Swap the expected value for the one the form offers and the
 * case goes red, which is the only way it can be said to be measuring the source rather
 * than the outcome.
 *
 * <p><b>The role is read off `useRole` through a probe rather than off the
 * navigation</b>, and the reason is a measured one: „moderator" straight from the
 * server carries no moderator RECORD, so the rights table answers „a moderator nobody
 * has named is nobody" (pages/admin/rights.ts) and the administration is not in his
 * navigation. That is a real boundary of the mock rather than a fault in the role, so
 * the role is measured where it is, and the navigation is measured on the superadmin,
 * who holds everything and is never looked up.
 */

/** Two roles, and never the same one on both sides of a case. */
const TYPED_ADDRESS = 'takmicar@primer.rs'

/** Obviously a test and not anybody's password. Nothing here is a real value. */
const TYPED_PASSWORD = 'ovo-je-probna-lozinka-123'

let server: { asked: Asked[]; stop: () => void } | null = null

/** What the server is holding: whether a session is open, and whom it belongs to. */
let open = false
let holder: { role: string; account: number } | null = null
let signInSays: () => Response | Promise<Response> = did

/**
 * A server that behaves like the real one on the three routes this screen uses.
 *
 * @param who     whom `/api/me` answers with once a session is open, or null for a
 *                server that opened one and then will not say whose it is
 * @param already whether the browser arrives already carrying one, which is what a
 *                second tab and a visit tomorrow both look like
 */
function aServerWhere(
  who: { role: string; account: number } | null,
  already = false,
  signIn: () => Response | Promise<Response> = did,
): void {
  open = already
  holder = who
  signInSays = signIn

  server = serverThat((path) => {
    if (path === '/api/me') {
      return open && holder !== null
        ? new Response(JSON.stringify(holder), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        : answeredWith(401)
    }

    if (path === '/api/sign-in') {
      /* The cookie, as far as jsdom is concerned: a 204 is what opens the session, and
         everything else leaves the server exactly as it was. Written as „the case says
         who is signed in" instead, a screen that never sent anything would still find
         somebody there. */
      return Promise.resolve(signInSays()).then((said) => {
        if (said.status === 204) {
          open = true
        }

        return said
      })
    }

    if (path === '/api/sign-out') {
      open = false

      return did()
    }

    /* Everything else is the mock, read off the disc exactly as it is everywhere
       else (test/serverAnswers.ts). */
    return path.startsWith('/api') ? answeredWith(404) : null
  })
}

/** What the portal is holding, for the facts no screen draws. */
function Probe() {
  const { role } = useRole()
  const { signedIn } = useSession()

  return (
    <>
      <span data-testid="role">{role}</span>
      <span data-testid="signed-in">{signedIn === null ? 'nikom' : signedIn.as}</span>
    </>
  )
}

/** The sign in screen, with the probe beside it. */
function openSignIn(at = '/sr/prijava') {
  return renderAt(at, 'visitor', null, undefined, null, <Probe />)
}

async function signIn(address = TYPED_ADDRESS, password = TYPED_PASSWORD): Promise<void> {
  const user = setupUser()

  await user.type(await screen.findByLabelText('Adresa elektronske pošte'), address)
  await user.type(screen.getByLabelText('Lozinka'), password)
  await user.click(screen.getByRole('button', { name: 'Prijavi se' }))
}

/** Everything sent to one route. */
function sentTo(path: string): Asked[] {
  return (server?.asked ?? []).filter((one) => one.path === path)
}

beforeEach(() => {
  forgetEveryCookie()
  /* Put in the jar by hand, so the token is not a round trip every case pays for.
     `askTheServer.test.ts` measures the fetching of it on its own. */
  document.cookie = 'XSRF-TOKEN=imam'
})

afterEach(() => {
  server?.stop()
  server = null
  open = false
  holder = null
  forgetEveryCookie()
})

describe('what the form sends', () => {
  it('sends the address and the password to the sign in route, and nothing else', async () => {
    aServerWhere({ role: 'competitor', account: 7 })
    openSignIn()

    await signIn()

    const sent = at(sentTo('/api/sign-in'), 0)

    expect(sent.init?.method).toBe('POST')
    expect(JSON.parse(String(sent.init?.body))).toEqual({
      email: TYPED_ADDRESS,
      password: TYPED_PASSWORD,
    })
  })

  it('does not ask for a role, because a role is not something anybody picks', async () => {
    aServerWhere({ role: 'competitor', account: 7 })
    openSignIn()

    expect(await screen.findByLabelText('Adresa elektronske pošte')).toBeVisible()
    /* The prototype asked „Ko si?" and offered the members of the league. Nothing on
       this form may ever ask it again: a role chosen here is a role the person at the
       keyboard chose, and the administration is behind it. */
    expect(screen.queryByLabelText('Ko si?')).not.toBeInTheDocument()
    /* Named rather than counted to nothing, because one control on this page IS a
       list of roles: the development switch in the header (roles/RoleSwitch.tsx),
       which is never built into production. A form growing a second one is what this
       catches, and „no combobox anywhere" would have caught the header instead. */
    expect(screen.getAllByRole('combobox').map((one) => one.getAttribute('aria-label'))).toEqual([
      'Uloga',
    ])
  })

  it('says both of its fields are obligatory, as every field on the portal does', async () => {
    /* Owner, 12.08.2026: the rule holds „na svim formama za unos i verifikaciju". It
       was held over this screen's one field while the screen was a `select` of members
       (pages/memberFlows.test.tsx until 20.09.2026), and it is held over both of the
       fields that replaced it: the browser's own `required` says nothing to a reader
       and draws no star (forms/AskedLabel.tsx). */
    aServerWhere({ role: 'competitor', account: 7 })
    openSignIn()

    const fields = [
      await screen.findByLabelText('Adresa elektronske pošte'),
      screen.getByLabelText('Lozinka'),
    ]

    for (const field of fields) {
      expect(field).toHaveAttribute('aria-required', 'true')
      expect(field).not.toHaveAttribute('required')
      expect(
        must(field.closest('.rankings__field'), 'the field it stands in').querySelector(
          '.field__required',
        ),
      ).not.toBeNull()
    }

    expect(screen.getByText('Polja sa zvezdicom su obavezna.')).toBeVisible()
  })

  it('takes the password in a box that hides it and offers the saved one', async () => {
    aServerWhere({ role: 'competitor', account: 7 })
    openSignIn()

    /* `current-password` and never `new-password`: the second tells a password manager
       to offer to make one up, on the form where somebody is typing the one he has. */
    expect(await screen.findByLabelText('Lozinka')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Lozinka')).toHaveAttribute('autocomplete', 'current-password')
  })

  /**
   * BOTH HALVES OF ONE CONDITION, AND THEY ARE TWO CASES BECAUSE THEY ARE TWO STATES.
   *
   * „Nothing typed" reads `email === '' || password === ''`, which is two questions
   * wearing one name. Only the first of them was ever asked: the case typed an address
   * and left the password, so it was satisfied by the half about the password alone, and
   * `nothingTyped = password === ''` passed the whole package green (review, 20.09.2026).
   * The half about the address held nothing at all.
   *
   * Each half is therefore its own row, and each one falls when the OTHER half is taken
   * out of the condition. Written as one row with both fields empty, neither would.
   */
  const halfTyped: [says: string, address: string, password: string][] = [
    ['an address and no password', TYPED_ADDRESS, ''],
    ['a password and no address', '', TYPED_PASSWORD],
  ]

  it.each(halfTyped)('sends nothing at all on %s', async (_says, address, password) => {
    aServerWhere({ role: 'competitor', account: 7 })
    openSignIn()

    const user = setupUser()
    const field = await screen.findByLabelText('Adresa elektronske pošte')

    if (address !== '') {
      await user.type(field, address)
    }

    if (password !== '') {
      await user.type(screen.getByLabelText('Lozinka'), password)
    }

    await user.click(screen.getByRole('button', { name: 'Prijavi se' }))

    expect(screen.getByText('Upiši adresu i lozinku da bi mogao da se prijaviš.')).toBeVisible()
    expect(sentTo('/api/sign-in')).toEqual([])
    /* Told off, not switched off: the button keeps its place in the tab order and
       carries the reason with it, as everywhere else on the portal. */
    expect(screen.getByRole('button', { name: 'Prijavi se' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

describe('where the role comes from', () => {
  /* The address typed names one role and the server answers another, every time. */
  const roles: [said: string, address: string, account: number][] = [
    ['competitor', 'superadmin@primer.rs', 3],
    ['moderator', 'superadmin@primer.rs', 11],
    ['superadmin', 'moderator@primer.rs', 41],
  ]

  it.each(roles)('is /api/me, which said %s', async (said, address, account) => {
    aServerWhere({ role: said, account })
    openSignIn()

    await signIn(address)

    /* Lands on the member's own screen, which is what says the sign in went through
       rather than a sentence this screen wrote about itself. */
    expect(await screen.findByTestId('role')).toHaveTextContent(said)
    expect(screen.getByTestId('signed-in')).toHaveTextContent('account')
  })

  it('reads it after the sign in and not out of the sign in', async () => {
    aServerWhere({ role: 'superadmin', account: 41 })
    openSignIn()

    await signIn('moderator@primer.rs')

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('superadmin'))
    /* Twice: once above every screen on arrival, when it answered 401, and once after
       the 204. Without the second there is no role at all, only a cookie. */
    expect(sentTo('/api/me').length).toBeGreaterThanOrEqual(2)
  })

  it('puts a superadmin in the administration, which is the role doing something', async () => {
    aServerWhere({ role: 'superadmin', account: 41 })
    openSignIn()

    await signIn('takmicar@primer.rs')

    expect(await screen.findByRole('link', { name: 'Administracija' })).toBeVisible()
  })
})

describe('where a sign in that went through lands', () => {
  /**
   * NOTHING HELD THIS AT ALL UNTIL 20.09.2026, and a review found it by changing the
   * address to another one and watching the package stay green. The screen this form
   * leaves is the whole of what a member gets for signing in, so it is worth a row.
   *
   * Read off the ROUTER rather than off what is drawn. What the address answers with is
   * the next screen's business and changes with who signed in; where the portal went is
   * this screen's, and `window.location` is the wrong place to look because a memory
   * router never writes to it (test/render.tsx).
   */
  it('is the member own profile, and the address says so', async () => {
    aServerWhere({ role: 'competitor', account: 7 })
    const { router } = openSignIn()

    await signIn()

    /* Waited for on what the address DREW and not on the address itself. The router's
       own state is written before React has drawn anything, so a wait on the path alone
       is satisfied one render too early, and the form was still on screen when the next
       line read for it. An account of 7 carries no member number, so the profile answers
       with the sentence for exactly that (`memberScreen.tsx`). */
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ovaj deo je za takmičare' }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/sr/moj-profil')
    /* And it left the form: read on the address alone, a screen that drew the sign in
       over the top of it would pass. */
    expect(screen.queryByLabelText('Lozinka')).not.toBeInTheDocument()
  })

  it('stays where it is when the server refused, and goes nowhere at all', async () => {
    /* THE OTHER HALF OF THE SAME AXIS. Without it the row above is satisfied by a form
       that navigates whatever the server said, which is the fault it looks like. */
    aServerWhere({ role: 'competitor', account: 7 }, false, () => answeredWith(401))
    const { router } = openSignIn()

    await signIn()

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(router.state.location.pathname).toBe('/sr/prijava')
  })
})

describe('the header, which is the one thing that differs for a signed in member', () => {
  /* PDL, owner: „Prijavljen član vidi istu naslovnu kao gost. Jedina razlika je gore
     desno, gde umesto Registracija / Prijava stoji link ka opcijama profila
     (uređivanje, odjava i slično)." */

  it('offers a visitor the way in and no profile options', async () => {
    aServerWhere(null)
    openSignIn('/sr')

    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Učlani se' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Otvori nalog' })).not.toBeInTheDocument()
  })

  it('offers the profile options once somebody has signed in, and drops the two links', async () => {
    aServerWhere({ role: 'competitor', account: 7 })
    openSignIn()

    await signIn()

    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Prijavi se' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Učlani se' })).not.toBeInTheDocument()
  })

  it('names the account, because a real session carries no member number', async () => {
    /* Three digits and not one, so „the LAST two" is a claim the case can fail: an
       account of 7 reads the same whichever end is taken. */
    aServerWhere({ role: 'competitor', account: 107 }, true)
    const user = setupUser()
    openSignIn('/sr')

    const button = await screen.findByRole('button', { name: 'Otvori nalog' })
    /* The same rule the member number keeps: the last two of whatever identifies him.
       There is no name to take initials from, and `MeApi` says why there is no member
       number to look one up by. */
    expect(button).toHaveTextContent('07')

    await user.click(button)
    expect(screen.getByText('Nalog 107')).toBeVisible()
  })
})

describe('a visit that arrives already carrying a session', () => {
  it('is signed in without anybody touching the form', async () => {
    aServerWhere({ role: 'moderator', account: 11 }, true)
    openSignIn('/sr')

    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
    expect(screen.getByTestId('role')).toHaveTextContent('moderator')
    /* And nothing was signed in with: the cookie was already there. */
    expect(sentTo('/api/sign-in')).toEqual([])
  })

  it('is nobody when the chain refuses, and nothing the switch set is cleared', async () => {
    aServerWhere(null)
    /* A visit where the development switch has made somebody a superadmin and there is
       no server to be signed in to. The question above every screen must not sign him
       out: that switch is what the whole prototype is walked through with. */
    renderAt('/sr', 'superadmin', null, undefined, null, <Probe />)

    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toBeVisible()
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('superadmin'))
  })
})

describe('when the server says no', () => {
  it('says so, stays where it is, and signs nobody in', async () => {
    aServerWhere({ role: 'superadmin', account: 41 }, false, () => answeredWith(401))
    openSignIn()

    await signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Prijava nije uspela. Adresa ili lozinka nisu tačne, ili je nalog privremeno zaključan zbog previše neuspelih pokušaja.',
    )
    /* 401 is not a way in. The role is untouched and the header still offers the way
       in, both of which a screen treating a refusal as an answer would lose. */
    expect(screen.getByTestId('role')).toHaveTextContent('visitor')
    expect(screen.getByTestId('signed-in')).toHaveTextContent('nikom')
    expect(screen.getByRole('link', { name: 'Prijavi se' })).toBeVisible()
    expect(screen.getByLabelText('Adresa elektronske pošte')).toBeVisible()
  })

  it('says the same thing about a shut account as about a wrong password', async () => {
    /* THE THIRD STATE OF THIS AXIS, AND THE PORTAL CANNOT SEE IT. `SignIn` (backend)
       answers the same bare 401 to an address nobody has, a wrong password, an account
       with no password, an address nobody has confirmed and an account that is shut,
       and says in its own words why: told apart, this form becomes a way of asking the
       portal who its members are. So the sentence names both and the case holds that
       the two answers are one answer, rather than pretending to a difference that is
       not on the wire. */
    aServerWhere({ role: 'competitor', account: 7 }, false, () => answeredWith(401))
    openSignIn()

    await signIn('zakljucan@primer.rs')

    const said = await screen.findByRole('alert')

    expect(said.textContent).toContain('Adresa ili lozinka nisu tačne')
    expect(said.textContent).toContain('privremeno zaključan')
    /* And no number of tries and no length of lock, which are the server's
       (`SignIn.ENOUGH_MISSES_TO_LOCK`, `SignIn.LOCKED_FOR`). A copy here is a second
       home for a fact the server owns, and the first thing it does is go stale. */
    expect(said.textContent).not.toMatch(/\d/)
  })

  it('says so when it got in and the server will not say whose session it is', async () => {
    /* Signed in on the server and unknown to the portal. A guess at a role here is a
       guess about what somebody may do. */
    aServerWhere(null, false)
    openSignIn()

    await signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Prijava je prošla, ali portal nije uspeo da sazna ko si.',
    )
    expect(screen.getByTestId('role')).toHaveTextContent('visitor')
    expect(screen.getByTestId('signed-in')).toHaveTextContent('nikom')
  })

  it('says so when there is no server to reach at all', async () => {
    aServerWhere({ role: 'competitor', account: 7 }, false, () => {
      throw new Error('nema veze')
    })
    openSignIn()

    await signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Portal nije uspeo da dođe do servera',
    )
  })

  it('says so when the token was not accepted', async () => {
    aServerWhere({ role: 'competitor', account: 7 }, false, () => answeredWith(403))
    openSignIn()

    await signIn()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Portal nije uspeo da dokaže serveru da zahtev dolazi sa ove strane',
    )
  })

  it('sends one request while one is still out', async () => {
    let letGo: () => void = () => undefined
    const held = new Promise<Response>((keep) => {
      letGo = () => keep(answeredWith(401))
    })
    aServerWhere({ role: 'competitor', account: 7 }, false, () => held)
    openSignIn()

    const user = setupUser()
    await user.type(await screen.findByLabelText('Adresa elektronske pošte'), TYPED_ADDRESS)
    await user.type(screen.getByLabelText('Lozinka'), TYPED_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Prijavi se' }))

    /* The button says what it is doing, and pressing it again while it says so sends
       nothing: a second sign in is a second miss counted against an account whose
       tenth miss shuts it (`SignIn.ENOUGH_MISSES_TO_LOCK`). */
    await user.click(await screen.findByRole('button', { name: 'Prijavljuje se' }))

    expect(sentTo('/api/sign-in')).toHaveLength(1)

    letGo()
    expect(await screen.findByRole('alert')).toBeVisible()
  })
})

describe('signing out', () => {
  it('tells the server, and the header goes back to offering the way in', async () => {
    aServerWhere({ role: 'moderator', account: 11 }, true)
    const user = setupUser()
    openSignIn('/sr')

    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
    await user.click(screen.getByRole('button', { name: 'Odjavi se' }))

    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toBeVisible()
    expect(sentTo('/api/sign-out')).toHaveLength(1)
    expect(at(sentTo('/api/sign-out'), 0).init?.method).toBe('POST')
    /* And the role goes with it. Left standing, a moderator who signed out would keep
       the administration in his navigation and be refused at every screen behind it. */
    expect(screen.getByTestId('role')).toHaveTextContent('visitor')
    expect(screen.getByTestId('signed-in')).toHaveTextContent('nikom')
  })

  it('tells the server even where the way in was the development switch', async () => {
    /* No real session at all: the member number came off the switch. The request still
       goes, because this screen cannot know which of the two it is, and `SignOutApi`
       answers 204 to a browser carrying nothing. */
    aServerWhere(null)
    const user = setupUser()
    renderAt('/sr', 'competitor', '000007', undefined, null, <Probe />)

    await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
    await user.click(screen.getByRole('button', { name: 'Odjavi se' }))

    expect(await screen.findByRole('link', { name: 'Prijavi se' })).toBeVisible()
    expect(sentTo('/api/sign-out')).toHaveLength(1)
  })
})

describe('where the password is written', () => {
  it('reaches the body of one request and nowhere else', async () => {
    aServerWhere({ role: 'competitor', account: 7 })
    const { router } = openSignIn()

    await signIn()
    await screen.findByRole('button', { name: 'Otvori nalog' })

    const asked = server?.asked ?? []
    const { pathname, search, hash } = router.state.location
    const store = (kept: Storage): string =>
      Object.keys(kept)
        .map((key) => `${key}=${kept.getItem(key) ?? ''}`)
        .join('|')

    /* A sweep and not a list of three suspects: the question is „did it reach anywhere
       at all", and a list is answered by whatever somebody thought of on the day. */
    const everywhereElse = [
      ...asked.map((one) => one.path),
      ...asked.map((one) => JSON.stringify(one.init?.headers ?? {})),
      ...asked.map((one) => String(one.init?.method)),
      document.body.textContent ?? '',
      `${pathname}${search}${hash}`,
      window.location.href,
      document.cookie,
      store(sessionStorage),
      store(localStorage),
    ]

    expect(everywhereElse.filter((one) => one.includes(TYPED_PASSWORD))).toEqual([])
    /* And it did reach the one place it is supposed to, or the sweep above is green
       for the wrong reason. */
    expect(
      asked.filter((one) => String(one.init?.body ?? '').includes(TYPED_PASSWORD)),
    ).toHaveLength(1)
  })
})

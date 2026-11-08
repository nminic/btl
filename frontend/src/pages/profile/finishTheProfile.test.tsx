import { act, configure, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { useSession } from '../../session/useSession'
import { useTellTheHeadABoxWasSent } from './finishTheProfile'
import { OVER_THE_MEMBERS } from './whoReadsTheData'

/* Every wait of this file is given half of the time a case has, so a wait that never succeeds ends the
   case with the assertion's own words and not with the case's clock (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE NAME OF THE ENTRY „MOJI PODACI" IN THE MENU, AND WHERE THE PICTURE AND THE WORDS ABOUT HIMSELF STAND.
 *
 * <p>Owner, 07.11.2026 (PDL „Član svojim podacima pristupa iz glavnog menija”): „Stavka menija se zove „Dopuni
 * podatke” (vlasnikove reči) dok član nema i sliku i tekst o sebi, a posle toga „Moji podaci”; poslato a
 * neodobreno se računa kao namešteno, kao do sada", and „na svom profilu član vidi samo „Rezultati” i
 * „Priznanja”. Administracija i dalje vidi karticu „Podaci” na strani takmičara."
 *
 * <p><b>THE AXES, each with both of its states</b>: the picture none, waiting, standing; the words none,
 * waiting, standing (a picture or words handed back are none on the server, which is what the first state
 * is); the menu opened or not, and opened again after the server changed; one member in the visit or two;
 * the reader the member himself or the administration; the address with `#slika` or without.
 */

const HIS = '000007'

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

type Held = 'none' | 'waiting' | 'standing'

const A_CROP = { x: 0.3, y: 0.7, size: 0.45 }

/**
 * A SERVER THAT HOLDS THIS OF HIM: his pictures on `GET /api/me/photo`, and his words on `GET /api/me`,
 * where the record the disc answers is given the two fields and nothing else. `words` is changed by the
 * case where it sends something, which is what a server does.
 */
function aServerHolding(picture: Held, words: { now: Held }): Asked[] {
  const disc = globalThis.fetch
  const { asked, stop } = serverThat((path, init) => {
    if (path === '/api/me/photo' && init?.method === undefined) {
      return json({
        waiting: picture === 'waiting' ? { photo: '/api/me/photo/abc', crop: A_CROP } : null,
        standing: picture === 'standing' ? { photo: '/api/photos/def', crop: A_CROP } : null,
      })
    }

    if (path === '/api/me' && init?.method === undefined) {
      return disc(path, init).then(async (answer) => {
        const body: Record<string, unknown> = await answer.json()
        const member: Record<string, unknown> = { ...Object(body.member) }

        member.bio = words.now === 'standing' ? 'Odobren tekst o sebi.' : ''
        delete member.bioWaiting

        if (words.now === 'waiting') {
          member.bioWaiting = 'Tekst koji čeka.'
        }

        return json({ ...body, member })
      })
    }

    if (path === '/api/me' && init?.method === 'PUT') {
      words.now = 'waiting'

      return json({ bio: '', waiting: 5 })
    }

    return null
  })

  stops.push(stop)

  return asked
}

/** Signs in another member in the same visit, the way the answer to `GET /api/me` does. */
function SignsInSomebodyElse({ asking }: { asking: { who: string } }) {
  const { theServerSignedMeIn } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        asking.who = '000002'
        theServerSignedMeIn({
          account: 2,
          memberNumber: '000002',
          country: null,
          firstSeason: null,
          teamId: null,
          membershipBasis: null,
          membershipSeason: null,
          referralCode: null,
          referredCount: null,
          hasARecord: true,
          feeStands: true,
        })
      }}
    >
      sign in somebody else
    </button>
  )
}

/** The menu behind the picture, opened. */
async function openTheMenu(user: ReturnType<typeof setupUser>): Promise<void> {
  const button = await screen.findByRole('button', { name: 'Otvori nalog' })

  if (button.getAttribute('aria-expanded') !== 'true') {
    await user.click(button)
  }
}

/** Shuts the menu again, the way a reader does, by the button that opened it. */
async function shutTheMenu(user: ReturnType<typeof setupUser>): Promise<void> {
  const button = await screen.findByRole('button', { name: 'Otvori nalog' })

  if (button.getAttribute('aria-expanded') === 'true') {
    await user.click(button)
  }
}

/** The entry in the menu that leads to „Moji podaci", whichever of its two names it carries. */
function theEntry(): HTMLElement {
  return must(
    within(must(document.getElementById('account-menu'), 'the account menu')).queryByRole('link', {
      name: new RegExp(`^(${sr.nav.myData}|${sr.nav.completeData})$`),
      hidden: true,
    }),
    'the entry of „Moji podaci"',
  )
}

/** His pictures have been asked for at least `times` times, and what was answered has been drawn. */
async function bothAnswered(asked: Asked[], times = 1): Promise<void> {
  await waitFor(() =>
    expect(asked.filter((one) => one.path === '/api/me/photo').length).toBeGreaterThanOrEqual(times),
  )
  await act(async () => {
    await new Promise((settled) => setTimeout(settled, 50))
  })
}

describe('the name of the entry „Moji podaci" in the menu', () => {
  it.each([
    ['nothing at all, or what was handed back', 'none', 'none', sr.nav.completeData],
    ['a picture and words that both wait', 'waiting', 'waiting', sr.nav.myData],
    ['a picture that stands and no words', 'standing', 'none', sr.nav.completeData],
    ['words that stand and no picture', 'none', 'standing', sr.nav.completeData],
    ['a picture that waits and no words', 'waiting', 'none', sr.nav.completeData],
    ['words that wait and no picture', 'none', 'waiting', sr.nav.completeData],
    ['a picture and words that both stand', 'standing', 'standing', sr.nav.myData],
  ] as const)('is the one it should be for %s', async (_what, picture, words, name) => {
    const user = setupUser()
    const asked = aServerHolding(picture, { now: words })

    renderAt('/sr/kalendar', 'competitor', HIS)
    await openTheMenu(user)
    await bothAnswered(asked)

    await waitFor(() => expect(theEntry()).toHaveTextContent(new RegExp(`^${name}$`)))
    expect(theEntry()).toHaveAttribute('href', '/sr/moji-podaci')
  }, SLOW)

  /* NOTHING IS ASKED UNTIL THE MENU IS OPENED: it is drawn on every screen, and a member who never opens it
     costs the server no request for a name nobody reads. The other half is the case above. */
  it('asks nothing of his pictures while the menu has not been opened', async () => {
    const asked = aServerHolding('none', { now: 'none' })

    renderAt('/sr/kalendar', 'competitor', HIS)
    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
    await act(async () => {
      await new Promise((settled) => setTimeout(settled, 100))
    })

    expect(asked.filter((one) => one.path === '/api/me/photo')).toHaveLength(0)
    expect(theEntry()).toHaveTextContent(new RegExp(`^${sr.nav.myData}$`))
  }, SLOW)

  /* ASKED AGAIN EACH TIME THE MENU IS OPENED, so a picture a moderator handed back in the meantime gives the
     name back (owner, 06.11.2026, which the decision of 07.11.2026 keeps: „vraćena slika ili tekst vraćaju
     ime"). */
  it('turns back to „Dopuni podatke" at the next opening once the server holds less than it did', async () => {
    const user = setupUser()
    const picture: { now: Held } = { now: 'standing' }

    aServerHolding('none', { now: 'standing' })

    const { asked, stop } = serverThat((path, init) =>
      path === '/api/me/photo' && init?.method === undefined
        ? json({
            waiting: null,
            standing: picture.now === 'standing' ? { photo: '/api/photos/def', crop: A_CROP } : null,
          })
        : null,
    )

    stops.push(stop)
    renderAt('/sr/kalendar', 'competitor', HIS)

    await openTheMenu(user)
    await bothAnswered(asked)
    await waitFor(() => expect(theEntry()).toHaveTextContent(new RegExp(`^${sr.nav.myData}$`)))

    picture.now = 'none'
    await shutTheMenu(user)
    await openTheMenu(user)
    await bothAnswered(asked, 2)

    await waitFor(() => expect(theEntry()).toHaveTextContent(new RegExp(`^${sr.nav.completeData}$`)))
  }, SLOW)

  it('turns to „Moji podaci" in the same visit once the last thing he lacked has been sent', async () => {
    const user = setupUser()
    const words: { now: Held } = { now: 'none' }
    const asked = aServerHolding('standing', words)

    renderAt('/sr/moji-podaci', 'competitor', HIS)
    await openTheMenu(user)
    await bothAnswered(asked)
    await waitFor(() => expect(theEntry()).toHaveTextContent(new RegExp(`^${sr.nav.completeData}$`)))
    await shutTheMenu(user)

    const panel = within(await screen.findByRole('region', { name: sr.bio.title }))
    const box = await panel.findByLabelText(/Svojim rečima|Tekst o sebi/)

    await user.clear(box)
    await user.type(box, 'Trčim od 2014.')
    await user.click(panel.getByRole('button', { name: sr.bio.send }))

    /* Without opening the menu again: the box says it has sent, and the menu asks. */
    await waitFor(() => expect(theEntry()).toHaveTextContent(new RegExp(`^${sr.nav.myData}$`)))
  }, SLOW)

  /* TWO PEOPLE IN ONE VISIT, a shared laptop at a race: the second is named by his own answer, never by the
     first man's, even where the first man's arrives after the second has signed in. */
  it('names the second member who signs in by his own answer, and a late answer of the first changes nothing', async () => {
    const user = setupUser()
    let answerTheFirst: (one: Response) => void = () => undefined
    const late = new Promise<Response>((resolve) => {
      answerTheFirst = resolve
    })
    const asking = { who: HIS }

    aServerHolding('none', { now: 'standing' })

    const { asked, stop } = serverThat((path, init) => {
      if (path !== '/api/me/photo' || init?.method !== undefined) {
        return null
      }

      return asking.who === HIS ? late : json({ waiting: null, standing: { photo: '/api/photos/def', crop: A_CROP } })
    })

    stops.push(stop)
    renderAt('/sr/kalendar', 'competitor', HIS, undefined, null, <SignsInSomebodyElse asking={asking} />)

    await openTheMenu(user)
    await waitFor(() => expect(asked.filter((one) => one.path === '/api/me/photo')).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: 'sign in somebody else' }))
    await openTheMenu(user)
    await bothAnswered(asked, 2)
    await waitFor(() => expect(theEntry()).toHaveTextContent(new RegExp(`^${sr.nav.myData}$`)))

    await act(async () => {
      answerTheFirst(json({ waiting: null, standing: null }))
      await new Promise((settled) => setTimeout(settled, 50))
    })

    expect(theEntry()).toHaveTextContent(new RegExp(`^${sr.nav.myData}$`))
  }, SLOW)
})

describe('the name of the entry, when the server cannot say', () => {
  it('stays „Moji podaci" where his pictures cannot be read, even though he has nothing', async () => {
    const user = setupUser()

    aServerHolding('none', { now: 'none' })

    const { asked, stop } = serverThat((path, init) =>
      path === '/api/me/photo' && init?.method === undefined ? new Response(null, { status: 500 }) : null,
    )

    stops.push(stop)
    renderAt('/sr/kalendar', 'competitor', HIS)
    await openTheMenu(user)
    await bothAnswered(asked)

    expect(theEntry()).toHaveTextContent(new RegExp(`^${sr.nav.myData}$`))
  }, SLOW)
})

describe('his own profile, and the card read by the administration', () => {
  /* Owner, 07.11.2026: „na svom profilu član vidi samo „Rezultati” i „Priznanja”". */
  it.each([`/sr/takmicar/${HIS}`, `/sr/takmicar/${HIS}/priznanja`, '/sr/moj-profil'])(
    'offers him no card „Podaci" at %s',
    async (where) => {
      renderAt(where, 'competitor', HIS)

      const parts = await screen.findByRole('navigation', { name: sr.profile.parts.label })

      expect(within(parts).getAllByRole('link').map((one) => one.textContent)).toEqual([
        sr.profile.parts.overview,
        sr.profile.parts.awards,
      ])
    },
    SLOW,
  )

  it('is „Podaci" to the administration whatever he lacks, and his own routes are not asked about him', async () => {
    const asked = aServerHolding('none', { now: 'none' })

    renderAt(`/sr/takmicar/${HIS}/podaci`, 'moderator', null, moderatorWith([OVER_THE_MEMBERS]))

    expect(await screen.findByRole('region', { name: sr.picture.title })).toBeVisible()
    await act(async () => {
      await new Promise((settled) => setTimeout(settled, 50))
    })

    const parts = await screen.findByRole('navigation', { name: sr.profile.parts.label })

    expect(within(parts).getByRole('link', { name: sr.profile.parts.data })).toBeVisible()
    expect(asked.filter((one) => one.path === '/api/me/photo')).toHaveLength(0)
  }, SLOW)
})

describe('the boxes on „Moji podaci"', () => {
  const scrolled = vi.fn()

  beforeEach(() => {
    scrolled.mockClear()
    Element.prototype.scrollIntoView = scrolled
  })

  it('stand under the form, and #slika is scrolled to', async () => {
    renderAt('/sr/moji-podaci#slika', 'competitor', HIS)

    const boxes = await screen.findByRole('region', { name: sr.picture.title })
    const pair = must(boxes.closest<HTMLElement>('#slika'), 'the place #slika leads to')

    await waitFor(() => expect(scrolled.mock.contexts).toContain(pair))
    expect(within(pair).getByRole('region', { name: sr.bio.title })).toBeVisible()

    /* AND UNDER THE FORM: the boxes follow the panel of his data in the order of the page. */
    const data = await screen.findByRole('heading', { level: 2, name: sr.account.personalTitle })

    expect(data.compareDocumentPosition(pair) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(pair.contains(data)).toBe(false)
  }, SLOW)

  /* THE OLD ADDRESS OF HIS DATA, his card „Podaci" until 07.11.2026, leads to the new one and keeps the part
     after `#` and the query, so a link written before then still reaches the boxes. */
  it('are reached from his old card, with the query and #slika kept', async () => {
    const { router } = renderAt(`/sr/takmicar/${HIS}/podaci?x=1#slika`, 'competitor', HIS)

    await screen.findByRole('region', { name: sr.picture.title })
    expect(router.state.location.pathname).toBe('/sr/moji-podaci')
    expect(router.state.location.search).toBe('?x=1')
    expect(router.state.location.hash).toBe('#slika')
    await waitFor(() => expect(scrolled).toHaveBeenCalled())
  }, SLOW)

  it('are not scrolled to where the address does not ask for them', async () => {
    renderAt('/sr/moji-podaci', 'competitor', HIS)

    await screen.findByRole('region', { name: sr.picture.title })
    expect(scrolled).not.toHaveBeenCalled()
  }, SLOW)

  it('say nothing beside „Izaberi novu sliku", neither the star nor „(neobavezno)"', async () => {
    renderAt('/sr/moji-podaci', 'competitor', HIS)

    const chooser = await screen.findByLabelText(sr.picture.choose)
    const around = must(chooser.closest('.rankings__field'), 'the field of the chooser')

    expect(around.textContent).toBe(sr.picture.choose)
  }, SLOW)
})

describe('a box drawn where no card is around it', () => {
  it('tells nobody that it sent, and throws nothing', async () => {
    const user = setupUser()

    function ABox() {
      const tell = useTellTheHeadABoxWasSent()

      return (
        <button type="button" onClick={() => tell()}>
          pošalji
        </button>
      )
    }

    render(<ABox />)
    await user.click(screen.getByRole('button', { name: 'pošalji' }))

    expect(screen.getByRole('button', { name: 'pošalji' })).toBeVisible()
  })
})

import { act, configure, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { useTellTheHeadABoxWasSent } from './finishTheProfile'
import { OVER_THE_MEMBERS } from './whoReadsTheData'

/* Every wait of this file is given half of the time a case has, so a wait that never succeeds ends the
   case with the assertion's own words and not with the case's clock (`btl/CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

/**
 * THE NAME OF THE CARD „PODACI", AND WHERE THE PICTURE AND THE WORDS ABOUT HIMSELF STAND.
 *
 * <p>Owner, 06.11.2026 (PDL „Boksovi „Profilna slika" i „Tekst o sebi" prelaze sa Podešavanja"): „Želim da
 * mu se dugme Podaci zove Dovrši profil dok ne namesti i sliku i tekst. Bez dodatnih podsetnika", and,
 * chosen with the recommendation, „poslato a neodobreno se računa kao namešteno", „vraćena slika ili tekst
 * vraćaju ime „Dovrši profil"".
 *
 * <p><b>THE AXES, each with both of its states</b>: the picture none, waiting, standing; the words none,
 * waiting, standing (a picture or words handed back are none on the server, which is what the first state
 * is); the reader the member himself or the administration; the address with `#slika` or without.
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

/** The link to the card in the row of the parts, whichever of its two names it carries. */
async function theCardTab(): Promise<HTMLElement> {
  const parts = await screen.findByRole('navigation', { name: sr.profile.parts.label })

  return must(
    within(parts).queryByRole('link', {
      name: new RegExp(`^(${sr.profile.parts.data}|${sr.profile.parts.finish})$`),
    }),
    'the tab of the card',
  )
}

/** Both reads the name is asked from have been answered, and what they answered has been drawn. */
async function bothAnswered(asked: Asked[]): Promise<void> {
  await waitFor(() => expect(asked.filter((one) => one.path === '/api/me/photo').length).toBeGreaterThan(0))
  await act(async () => {
    await new Promise((settled) => setTimeout(settled, 50))
  })
}

describe('the name of his own card', () => {
  it.each([
    ['nothing at all, or what was handed back', 'none', 'none', sr.profile.parts.finish],
    ['a picture and words that both wait', 'waiting', 'waiting', sr.profile.parts.data],
    ['a picture that stands and no words', 'standing', 'none', sr.profile.parts.finish],
    ['words that stand and no picture', 'none', 'standing', sr.profile.parts.finish],
    ['a picture that waits and no words', 'waiting', 'none', sr.profile.parts.finish],
    ['words that wait and no picture', 'none', 'waiting', sr.profile.parts.finish],
    ['a picture and words that both stand', 'standing', 'standing', sr.profile.parts.data],
  ] as const)('is the one it should be for %s', async (_what, picture, words, name) => {
    const asked = aServerHolding(picture, { now: words })

    renderAt(`/sr/takmicar/${HIS}/podaci`, 'competitor', HIS)
    await bothAnswered(asked)

    await waitFor(async () => expect(await theCardTab()).toHaveTextContent(new RegExp(`^${name}$`)))
  }, SLOW)

  it('is the same on his results, which draw the same head', async () => {
    const asked = aServerHolding('none', { now: 'standing' })

    renderAt(`/sr/takmicar/${HIS}`, 'competitor', HIS)
    await bothAnswered(asked)

    await waitFor(async () => expect(await theCardTab()).toHaveTextContent(sr.profile.parts.finish))
  }, SLOW)

  it('turns to „Podaci" in the same visit once the last thing he lacked has been sent', async () => {
    const user = setupUser()
    const words: { now: Held } = { now: 'none' }
    const asked = aServerHolding('standing', words)

    renderAt(`/sr/takmicar/${HIS}/podaci`, 'competitor', HIS)
    await bothAnswered(asked)
    await waitFor(async () => expect(await theCardTab()).toHaveTextContent(sr.profile.parts.finish))

    const panel = within(await screen.findByRole('region', { name: sr.bio.title }))
    const box = await panel.findByLabelText(/Svojim rečima|Tekst o sebi/)

    await user.clear(box)
    await user.type(box, 'Trčim od 2014.')
    await user.click(panel.getByRole('button', { name: sr.bio.send }))

    await waitFor(async () => expect(await theCardTab()).toHaveTextContent(sr.profile.parts.data))
  }, SLOW)
})

describe('the name of his own card, when the server cannot say', () => {
  it('stays „Podaci" where his pictures cannot be read, even though he has nothing', async () => {
    const { asked, stop } = serverThat((path, init) =>
      path === '/api/me/photo' && init?.method === undefined ? new Response(null, { status: 500 }) : null,
    )

    stops.push(stop)
    renderAt(`/sr/takmicar/${HIS}/podaci`, 'competitor', HIS)
    await bothAnswered(asked)

    expect(await theCardTab()).toHaveTextContent(new RegExp(`^${sr.profile.parts.data}$`))
  }, SLOW)

  it('is not set by an answer that arrives after he has left the page', async () => {
    let answer: (one: Response) => void = () => undefined
    const late = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const { asked, stop } = serverThat((path, init) =>
      path === '/api/me/photo' && init?.method === undefined ? late : null,
    )

    stops.push(stop)

    const { router } = renderAt(`/sr/takmicar/${HIS}`, 'competitor', HIS)

    await theCardTab()
    await waitFor(() => expect(asked.filter((one) => one.path === '/api/me/photo').length).toBeGreaterThan(0))
    await act(async () => {
      await router.navigate('/sr')
    })
    await act(async () => {
      answer(json({ waiting: null, standing: null }))
      await new Promise((settled) => setTimeout(settled, 50))
    })

    expect(screen.queryByRole('navigation', { name: sr.profile.parts.label })).toBeNull()
  }, SLOW)
})

describe('the name of somebody else’s card, read by the administration', () => {
  it('is „Podaci" whatever he lacks, and his own routes are not asked about him', async () => {
    const asked = aServerHolding('none', { now: 'none' })

    renderAt(`/sr/takmicar/${HIS}/podaci`, 'moderator', null, moderatorWith([OVER_THE_MEMBERS]))

    expect(await screen.findByRole('region', { name: sr.picture.title })).toBeVisible()
    await act(async () => {
      await new Promise((settled) => setTimeout(settled, 50))
    })
    expect(await theCardTab()).toHaveTextContent(new RegExp(`^${sr.profile.parts.data}$`))
    expect(asked.filter((one) => one.path === '/api/me/photo')).toHaveLength(0)
  }, SLOW)
})

describe('the boxes at the bottom of his card', () => {
  const scrolled = vi.fn()

  beforeEach(() => {
    scrolled.mockClear()
    Element.prototype.scrollIntoView = scrolled
  })

  it('stand under the form, and #slika is kept on the way to the profile’s own address and scrolled to', async () => {
    const { router } = renderAt(`/sr/takmicar/${HIS}/podaci#slika`, 'competitor', HIS)

    const boxes = await screen.findByRole('region', { name: sr.picture.title })

    await waitFor(() => expect(router.state.location.pathname).toMatch(new RegExp(`^/sr/takmicar/${HIS}-.+/podaci$`)))
    expect(router.state.location.hash).toBe('#slika')

    const pair = must(boxes.closest('#slika'), 'the place #slika leads to')

    await waitFor(() => expect(scrolled.mock.contexts).toContain(pair))
    expect(within(pair as HTMLElement).getByRole('region', { name: sr.bio.title })).toBeVisible()

    /* AND UNDER THE FORM: the boxes follow the panel of his data in the order of the page. */
    const data = await screen.findByRole('heading', { level: 2, name: sr.account.personalTitle })

    expect(data.compareDocumentPosition(pair) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(pair.contains(data)).toBe(false)
  }, SLOW)

  it('are not scrolled to where the address does not ask for them', async () => {
    renderAt(`/sr/takmicar/${HIS}/podaci`, 'competitor', HIS)

    await screen.findByRole('region', { name: sr.picture.title })
    expect(scrolled).not.toHaveBeenCalled()
  }, SLOW)

  it('say nothing beside „Izaberi novu sliku", neither the star nor „(neobavezno)"', async () => {
    renderAt(`/sr/takmicar/${HIS}/podaci`, 'competitor', HIS)

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

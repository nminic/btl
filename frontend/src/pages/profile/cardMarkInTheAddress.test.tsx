import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, configure, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Competitor } from '../../data/types'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { profilePath } from '../profileAddress'

/**
 * HIS OWN PROFILE CARRIES THE MARK OF HIS CARD IN ITS ADDRESS, AND NOBODY ELSE'S DOES.
 *
 * Owner, PDL P11, 16.11.2026, point 15 under „Profil ima deljivu sliku za društvene mreže (OG
 * sliku)”: „pusti ispravku iz tačke 2 odmah”. When a member opens HIS OWN profile the address in the
 * browser gets a short mark of the state of his card, which changes with every change of the card, so
 * the link he copies after a change is a new one; the canonical address and `og:url` stay clean, and
 * the link without the mark still opens the profile.
 *
 * **The axes, each with both of its states in the arrangement.** Whose page: his own, another
 * member's read by a signed-in member, and any page read by a visitor. Where the mark comes from: the
 * server's answer, which is a value nothing on the page could work out (`b7e2`, `4c19`), so a mark
 * computed in the browser is a different mark. Whether the card changed: two visits, two answers, and
 * an address that already carries the old mark. What else is in the address: the two filters of the
 * profile, before the mark and after it. Which history entry: the one he is on, never a new one. Which
 * language: `sr` and `en`, each asked for its own card. And whether there is a card at all: a 404 and
 * a body that is not a mark leave the address as it was.
 *
 * The member is 000009 and not the first on the list, and the other member is 000003, so neither is
 * the only one of its kind (the rule in `CLAUDE.md` about two sources of one value).
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, so that a wait which never succeeds ends
   the case with the assertion's own words and not with the case's clock (`pages/admin/saveWhileSaving
   .test.tsx` found the arrangement; `CLAUDE.md`, section 25). */
configure({ asyncUtilTimeout: SLOW / 2 })

const FILE: Competitor[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

function inTheFile(memberNumber: string): Competitor {
  return must(FILE.find((one) => one.memberNumber === memberNumber), memberNumber)
}

const HIM = inTheFile('000009')
const OTHER = inTheFile('000003')
const HIS_PAGE = profilePath(HIM, 'sr')
const ORIGIN = 'https://balkanskatrkackaliga.net'

const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** A server that answers the mark route with what `mark` says for the page asked, and leaves the rest
 *  to the disc reader. */
function marks(mark: (page: string) => Response | Promise<Response>): Asked[] {
  const server = serverThat((path) => {
    const page = /^\/api\/cards\/marks\/(.+)$/.exec(path)?.[1]

    return page === undefined ? null : mark(page)
  })

  stops.push(server.stop)

  return server.asked
}

function askedForAMark(asked: Asked[]): string[] {
  return asked.map((one) => one.path).filter((path) => path.startsWith('/api/cards/marks/'))
}

/** What the head names as this page's own, which is what a search engine and a network keep. */
function namedAsItsOwn(): [string | null, string | null] {
  return [
    document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    document.head.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? null,
  ]
}

/** Lets every answer already given be read, so that an address that is still clean is clean for good. */
async function everyAnswerRead(): Promise<void> {
  await act(async () => {
    await new Promise((settled) => setTimeout(settled, 0))
  })
}

describe('the mark of his card in the address of his own profile', () => {
  it('is the mark the server answers, written in place, and the page names itself without it', async () => {
    const asked = marks((page) => json({ mark: page === '000009-sr' ? 'b7e2' : '0000' }))
    const { router } = renderAt(HIS_PAGE, 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(router.state.location.search).toBe('?k=b7e2')
    })

    expect(router.state.location.pathname).toBe(HIS_PAGE)
    expect(router.state.historyAction, 'the mark is a new entry in the history').toBe('REPLACE')
    expect(askedForAMark(asked)).toEqual(['/api/cards/marks/000009-sr'])
    expect(await screen.findByRole('heading', { level: 1, name: `${HIM.firstName} ${HIM.lastName}` }))
      .toBeInTheDocument()
    /* The router's state moves before the screen is drawn again, and the head is written by an
       effect of that drawing, so it is read only once the drawing with the mark has been committed:
       read at once, it was the head of the address BEFORE the mark, and a canonical that carried the
       query passed (measured on this branch, 16.11.2026). */
    await everyAnswerRead()
    expect(namedAsItsOwn()).toEqual([`${ORIGIN}${HIS_PAGE}`, `${ORIGIN}${HIS_PAGE}`])
  }, SLOW)

  /* „MOJ PROFIL" LEADS HERE, and with the mark (owner, 16.11.2026, PDL P11, „Moj profil vodi na javnu
     adresu člana”: „uvek otvori onu koju moze lako da share-uje drugima kako smo danas vec napravili").
     Until that day his profile was drawn at `/moj-profil` itself and the mark was never written there. He
     is not the first member of the file, so an address spelt off the first row is not his. */
  it('is written when he arrives by „Moj profil", on his own address, in place', async () => {
    const asked = marks((page) => json({ mark: page === '000009-sr' ? 'b7e2' : '0000' }))
    const { router } = renderAt('/sr/moj-profil', 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(router.state.location.search).toBe('?k=b7e2')
    })

    expect(FILE[0]?.memberNumber, 'he is not the first row of the file').not.toBe(HIM.memberNumber)
    expect(router.state.location.pathname).toBe(HIS_PAGE)
    expect(askedForAMark(asked)).toEqual(['/api/cards/marks/000009-sr'])
  }, SLOW)

  /* AND „MOJ PROFIL" IS NOT LEFT BEHIND HIM: one step back from his profile is where he came from, not
     the address that sends him to it again. Read by walking back, because every later move on the way
     (the canonical address, the mark) is in place as well, so the kind of the last move cannot say
     which of them was. */
  it('leaves nothing between his profile and where he came from', async () => {
    marks(() => json({ mark: 'b7e2' }))
    const { router } = renderAt('/sr/kalendar', 'competitor', HIM.memberNumber)

    await act(async () => {
      await router.navigate('/sr/moj-profil')
    })
    await waitFor(() => {
      expect(router.state.location.search).toBe('?k=b7e2')
    })
    expect(router.state.location.pathname).toBe(HIS_PAGE)

    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr/kalendar')
    })
  }, SLOW)

  it('carries what the address of „Moj profil" asked for, beside the mark', async () => {
    marks(() => json({ mark: 'b7e2' }))
    const { router } = renderAt('/sr/moj-profil?sezona=2019', 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('k')).toBe('b7e2')
    })
    expect(router.state.location.pathname).toBe(HIS_PAGE)
    expect(new URLSearchParams(router.state.location.search).get('sezona')).toBe('2019')
  }, SLOW)

  it('is the English card\'s on the English page', async () => {
    const asked = marks((page) => json({ mark: page === '000009-en' ? '4c19' : '0000' }))
    const { router } = renderAt(profilePath(HIM, 'en'), 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(router.state.location.search).toBe('?k=4c19')
    })
    expect(askedForAMark(asked)).toEqual(['/api/cards/marks/000009-en'])
  }, SLOW)

  it('keeps the filters in the address, before the mark and after it', async () => {
    marks(() => json({ mark: 'b7e2' }))
    const user = setupUser()
    const { router } = renderAt(`${HIS_PAGE}?sezona=2019&duzina=half`, 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('k')).toBe('b7e2')
    })

    const written = new URLSearchParams(router.state.location.search)

    expect(written.get('sezona')).toBe('2019')
    expect(written.get('duzina')).toBe('half')
    expect(await screen.findByRole('button', { name: /^Polumaraton/ }))
      .toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /^Maraton/ }))

    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('duzina')).toBe('marathon')
    })
    expect(new URLSearchParams(router.state.location.search).get('k'), 'a filter took the mark away')
      .toBe('b7e2')
    expect(new URLSearchParams(router.state.location.search).get('sezona')).toBe('2019')
  }, SLOW)

  it('moves when his card does, and an address carrying the old mark is given the new one', async () => {
    let now = 'b7e2'
    const asked = marks(() => json({ mark: now }))
    const first = renderAt(HIS_PAGE, 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(first.router.state.location.search).toBe('?k=b7e2')
    })
    first.unmount()

    now = '91d0'
    const again = renderAt(`${HIS_PAGE}?k=b7e2`, 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(again.router.state.location.search).toBe('?k=91d0')
    })
    expect(askedForAMark(asked)).toHaveLength(2)
  }, SLOW)

  /* „PONIŠTI FILTERE" EMPTIES THE ADDRESS, and the mark is written back at once, in place: the one control of the
     profile that does not copy the address over (`CardMarkInTheAddress`, „The one control that empties the
     address"). Without it the member who cleared his filters would copy a link with no mark, and a network would
     read the old preview. He has no run of „ultra", so the button is on the screen. The address is opened with an
     old mark (`0000`) and the server says another, so the mark written after the press is the server's and not
     what the address carried before. */
  it('writes the mark back, in place, into an address that „Poništi filtere" has emptied', async () => {
    const asked = marks(() => json({ mark: 'b7e2' }))
    const user = setupUser()
    const { router } = renderAt(`${HIS_PAGE}?duzina=ultra&k=0000`, 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(router.state.location.search).toBe('?duzina=ultra&k=b7e2')
    })

    await user.click(await screen.findByRole('button', { name: 'Poništi filtere' }))

    await waitFor(() => {
      expect(router.state.location.search).toBe('?k=b7e2')
    })
    await everyAnswerRead()

    expect(router.state.location.search, 'the address was left without the mark').toBe('?k=b7e2')
    expect(router.state.historyAction, 'the mark came back as a new entry in the history').toBe('REPLACE')
    expect(askedForAMark(asked), 'the mark was asked for again').toEqual(['/api/cards/marks/000009-sr'])
    expect(screen.queryByRole('button', { name: 'Poništi filtere' })).toBeNull()
  }, SLOW)

  it.each([
    ['there is no card for him (a hidden profile, a lapsed member)', () => new Response(null, { status: 404 })],
    ['the answer is not a mark', () => json({ mark: 'NOT A MARK' })],
  ])('leaves the address as it was when %s', async (_, answer) => {
    const asked = marks(answer)
    const { router } = renderAt(`${HIS_PAGE}?duzina=half`, 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(askedForAMark(asked)).toHaveLength(1)
    })
    await everyAnswerRead()

    expect(router.state.location.search).toBe('?duzina=half')
  }, SLOW)

  it('is asked for once per language, and a mark of one is never written into the other', async () => {
    let english: (answer: Response) => void = () => undefined
    marks((page) =>
      page === '000009-en'
        ? new Promise<Response>((answered) => {
            english = answered
          })
        : json({ mark: 'b7e2' }),
    )
    const { router } = renderAt(HIS_PAGE, 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(router.state.location.search).toBe('?k=b7e2')
    })

    await act(async () => {
      await router.navigate(profilePath(HIM, 'en'))
    })
    await everyAnswerRead()

    expect(router.state.location.pathname).toBe(profilePath(HIM, 'en'))
    expect(router.state.location.search, 'the Serbian card\'s mark went into the English address').toBe('')

    await act(async () => {
      english(json({ mark: '4c19' }))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(router.state.location.search).toBe('?k=4c19')
    })
  }, SLOW)

  it('drops an answer that arrives after he has left the page it was asked for', async () => {
    let serbian: (answer: Response) => void = () => undefined
    const asked = marks((page) =>
      page === '000009-sr'
        ? new Promise<Response>((answered) => {
            serbian = answered
          })
        : json({ mark: '4c19' }),
    )
    const { router } = renderAt(HIS_PAGE, 'competitor', HIM.memberNumber)

    await waitFor(() => {
      expect(askedForAMark(asked)).toEqual(['/api/cards/marks/000009-sr'])
    })

    await act(async () => {
      await router.navigate(profilePath(HIM, 'en'))
    })
    await waitFor(() => {
      expect(router.state.location.search).toBe('?k=4c19')
    })

    await act(async () => {
      serbian(json({ mark: 'b7e2' }))
      await Promise.resolve()
    })
    await everyAnswerRead()

    expect(router.state.location.pathname).toBe(profilePath(HIM, 'en'))
    expect(router.state.location.search, 'the Serbian answer was written after he left it').toBe('?k=4c19')
  }, SLOW)
})

describe('and on every other page', () => {
  it.each([
    ['another member\'s profile, read by a member', profilePath(OTHER, 'sr'), 'competitor', HIM.memberNumber],
    ['his profile, read by a visitor', HIS_PAGE, 'visitor', null],
    ['another member\'s profile, read by a visitor', profilePath(OTHER, 'sr'), 'visitor', null],
  ] as const)('nothing is asked and nothing is written: %s', async (_, page, role, reader) => {
    const asked = marks(() => json({ mark: 'b7e2' }))
    const { router } = renderAt(page, role, reader)

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    await everyAnswerRead()

    expect(askedForAMark(asked)).toEqual([])
    expect(router.state.location.search).toBe('')
  }, SLOW)
})

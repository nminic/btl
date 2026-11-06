import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import sr from '../../i18n/sr.json'
import { moderatorWith, renderAt } from '../../test/render'
import { did, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { OVER_THE_MEMBERS } from './whoReadsTheData'

/**
 * „POZOVI U TIM" AND „POZOVI U TRKAČKI PAR" IN THE ROW OF THE PARTS, AND ON WHICH PARTS (owner, 06.11.2026,
 * PDL „Profil: forma „Podaci" po obliku forme za prijavu").
 *
 * <p>His words: „malo normalno dugme alignovano desno, istog formata i reda gde se nalaze i Pregled,
 * Priznanja i nagrade, i podaci"; and the same day, choosing between the offered places, „Rezultati" and
 * „Priznanja", not „Podaci". jsdom lays nothing out, so this file holds where the button is in the
 * document and on which parts; where it LANDS, its size and its format are `geometry/profileHead.geometry.ts`.
 *
 * <p><b>Who sees the button is not asked here</b> and did not change: it is `InviteToTeam` and
 * `InviteToPair`, held by `pages/teamInviteOnTheServer.test.tsx` and `pages/pairInviteOnTheServer.test.tsx`.
 *
 * <p><b>The reader on „Podaci" is one who is offered the button elsewhere</b>: a moderator with the right
 * over the members who races himself, so the same reader is offered „Pozovi u trkački par" on „Rezultati"
 * and reads the card „Podaci" of the same member. A reader who is never offered it would pass a „Podaci"
 * that drew it.
 */

/* Every wait of this file is given half of the time a case has, for the reason `pages/admin/
   saveWhileSaving.test.tsx` gives: a wait that never succeeds ends in the assertion's own words and never in
   `Test timed out` (`btl/CLAUDE.md`, odeljak 25). The last case holds it. */
configure({ asyncUtilTimeout: SLOW / 2 })

type FileMember = { memberNumber: string; active: boolean }

const MEMBERS_ON_FILE: FileMember[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

/** The reader: a man with no pair, 000002 Relja Momčilović. */
const READER = '000002'

/** The member on the page: a woman with no pair, 000015 Katarina Novaković. */
const HER = '000015'

const HER_PAGE = '/sr/takmicar/000015-katarina-novakovic'

/** A day the season being formed is 2027, so a pair can be asked for. */
const DAY = '2026-10-16'

const json = (what: unknown, status = 200): Response =>
  new Response(JSON.stringify(what), { status, headers: { 'content-type': 'application/json' } })

const stops: (() => void)[] = []

afterEach(() => {
  for (const stop of stops.splice(0)) {
    stop()
  }
})

/** A server with no pair and no question standing, which keeps a question it agreed to. */
function aServer(): Asked[] {
  const asked: { memberNumber: string }[] = []
  const { asked: seen, stop } = serverThat((path, init) => {
    const how = init?.method ?? 'GET'

    if (how === 'GET' && path === '/api/competitors') {
      return json(MEMBERS_ON_FILE.filter((one) => one.active))
    }

    if (how === 'GET' && path === '/api/pairs') {
      return json([])
    }

    if (how === 'GET' && path === '/api/me/applications') {
      return json({
        teamApplications: [],
        teamInvitations: [],
        teamProposals: [],
        pairInvites: asked.map((one, index) => ({
          id: 90 + index,
          memberNumber: one.memberNumber,
          sentByMe: true,
          date: DAY,
        })),
        alreadyInATeam: false,
        seasonToPayFor: null,
      })
    }

    if (how === 'GET' && path === `/api/members/${HER}/data`) {
      return json({ memberNumber: HER, firstName: 'Katarina', lastName: 'Novaković', gender: 'F' })
    }

    if (how === 'POST' && path === '/api/pairs') {
      asked.push({ memberNumber: HER })

      return json({ id: 90, memberNumber: HER }, 201)
    }

    return how === 'GET' ? null : did()
  })

  stops.push(stop)

  return seen
}

const theParts = () => screen.findByRole('navigation', { name: sr.profile.parts.label })

/** The row the parts stand in: what holds the nav and nothing above it. */
function rowOf(parts: HTMLElement): HTMLElement {
  const row = parts.parentElement

  if (row === null) {
    throw new Error('the parts stand in no row')
  }

  return row
}

/**
 * IN THE ROW OF THE PARTS, AFTER THEM, AND NOT INSIDE THE NAV. „After" is asked as following and not
 * contained, because `compareDocumentPosition` says „follows" of a descendant too.
 */
function standsInTheRowAfterTheParts(parts: HTMLElement, what: HTMLElement): void {
  expect(parts.contains(what), 'it stands inside the nav, which is a list of where to go').toBe(false)
  expect(rowOf(parts).contains(what), 'it does not stand in the row of the parts').toBe(true)
  expect(
    parts.compareDocumentPosition(what) & Node.DOCUMENT_POSITION_FOLLOWING,
    'it stands before the parts',
  ).not.toBe(0)
}

const readsOfWhatHeWaitsOn = (asked: Asked[]): number =>
  asked.filter((one) => (one.init?.method ?? 'GET') === 'GET' && one.path === '/api/me/applications')
    .length

/** Lets everything already on its way land and be drawn. */
async function settled(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('the invitations in the row of the parts of a profile', () => {
  it('stand on „Rezultati" in the row of the parts, after them and outside the nav', async () => {
    aServer()
    renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

    const parts = await theParts()
    const button = await screen.findByRole('button', { name: sr.pair.invite })

    standsInTheRowAfterTheParts(parts, button)
    expect(within(parts).getByRole('link', { name: 'Rezultati' })).toHaveAttribute('aria-current', 'page')
  })

  it('stand on „Priznanja" in the same row', async () => {
    aServer()
    renderAt(`${HER_PAGE}/priznanja`, 'competitor', READER, undefined, DAY)

    const parts = await theParts()
    const button = await screen.findByRole('button', { name: sr.pair.invite })

    standsInTheRowAfterTheParts(parts, button)
    expect(within(parts).getByRole('link', { name: 'Priznanja' })).toHaveAttribute('aria-current', 'page')
  })

  it('are not drawn on „Podaci", to a reader who is offered them on „Rezultati"', async () => {
    const reader = moderatorWith([OVER_THE_MEMBERS])

    /* The control first: the same reader, on the same member's „Rezultati", is offered the button. */
    const onTheResults = aServer()
    const first = renderAt(HER_PAGE, 'moderator', READER, reader, DAY)

    await screen.findByRole('button', { name: sr.pair.invite })
    expect(readsOfWhatHeWaitsOn(onTheResults)).toBeGreaterThan(0)
    first.unmount()

    const onTheData = aServer()

    renderAt(`${HER_PAGE}/podaci`, 'moderator', READER, reader, DAY)

    const parts = await theParts()

    expect(within(parts).getByRole('link', { name: sr.profile.parts.data })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await settled()
    await settled()

    expect(screen.queryByRole('button', { name: sr.pair.invite })).toBeNull()
    expect(readsOfWhatHeWaitsOn(onTheData), 'the card asked what he waits on, which only the button needs').toBe(0)
  })

  it('leave „Poziv ... je poslat" in the row, where the button stood', async () => {
    const user = setupUser()

    aServer()
    renderAt(HER_PAGE, 'competitor', READER, undefined, DAY)

    const parts = await theParts()

    await user.click(await screen.findByRole('button', { name: sr.pair.invite }))

    const said = await screen.findByText(sr.pair.asked)

    standsInTheRowAfterTheParts(parts, said)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: sr.pair.invite })).toBeNull()
    })
  })

  it('gives every wait half of the time a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBe(SLOW / 2)
  })
})

import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatPoints } from '../i18n/format'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import {
  answeredWith,
  did,
  forgetEveryCookie,
  isResource,
  serverThat,
  type Asked,
} from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { aCompetitor, aTeam } from '../test/theAnswer'
import { setupUser } from '../test/user'

/**
 * ONE VISIT, TWO READERS: WHAT THE SCREENS DRAW AFTER SOMEBODY SIGNS IN OR OUT IN PLACE.
 *
 * <p><b>The finding, and it is a review's (PR 473, 02.10.2026).</b> `/api/competitors` and
 * `/api/teams` are cached by address and nobody is in the key, and signing in and out happen
 * without reloading anything. A visitor who opened the front page - which reads `competitors`
 * and not `teams` - signed in and went to the table of teams drew the first as a visitor is
 * answered it and the second as a member is. For a member who hides his profile that is the
 * one combination in which he is on neither door of his team (`data/derive.ts`, `membersOf`):
 * his record has lost the team to the visitor and the team no longer names him to the member.
 * His team came out with 10 points and one member instead of 17 and two, a second team took
 * the first place, the member himself read „Bez tima" on his own profile and the founder of
 * that team had no „Izmeni" on its page.
 *
 * <p><b>The server answers by SESSION, the way the real one does</b>, and not by what a case
 * asked for: a visitor's answers and a signed in reader's answers are two shapes, the session
 * decides which, and `/api/sign-in` and `/api/sign-out` are what move it. So a screen that
 * reads a list it already held shows a reader the answer the OTHER reader was given, which is
 * exactly the fault; and a cache that drops the right names at the right moment shows the
 * right one. Each case names its other end: signing in straight from the address bar is the
 * control that has always been right, and a case whose control is not green measures its own
 * setup.
 *
 * <p><b>Everything is asked of what a reader SEES</b> - a sum, a head count, a link, a
 * picture. `session/theCachesFollowTheReader.test.tsx` asks of the cache itself.
 */

const THE_TEAM = 41
const ITS_ADDRESS = 'tim-sa-skrivenim'
const ITS_NAME = 'Tim sa skrivenim'
const OPEN = '000101'
const HIDDEN = '000102'
const ELSEWHERE = '000103'
/* A day inside the season the results are dated in, so the table and the page read 2027. */
const TODAY = '2027-06-01'

type Who = 'nobody' | 'member' | 'moderator'

type Session = {
  who: Who
  /** Which member `who === 'member'` is: the one who hides his profile, or the one who does not. */
  member: string
  /** Whether that member founded the team, which the signed in answer says on the team itself. */
  founder: boolean
  /** Who `POST /api/sign-in` makes the session. */
  signsInAs: 'member' | 'moderator'
}

function aMember(
  memberNumber: string,
  firstName: string,
  lastName: string,
  team: { id: number; since: number } | null,
  { hidden = false, picture = false } = {},
) {
  return {
    ...aCompetitor,
    memberNumber,
    firstName,
    lastName,
    teamId: team === null ? null : team.id,
    teamSince: team === null ? null : team.since,
    profileHidden: hidden,
    photo: picture ? aCompetitor.photo : null,
    crop: picture ? aCompetitor.crop : null,
    bio: '',
  }
}

/**
 * The members, as a reader is answered them.
 *
 * <p>The one who hides has the team and the picture on his record for anybody signed in and has
 * neither for a visitor (PDL, odeljak 16, and P28f): that is the whole difference between the
 * two shapes, and a picture is what makes it visible on a page that draws no link to him.
 */
function competitorsTo(signedIn: boolean) {
  return [
    aMember(OPEN, 'Jovan', 'Javni', { id: THE_TEAM, since: 2027 }),
    signedIn
      ? aMember(HIDDEN, 'Skriven', 'Skrivenic', { id: THE_TEAM, since: 2027 }, { hidden: true, picture: true })
      : aMember(HIDDEN, 'Skriven', 'Skrivenic', null, { hidden: true }),
    aMember(ELSEWHERE, 'Drugi', 'Drugic', { id: 42, since: 2027 }),
  ]
}

function aTeamNaming(
  id: number,
  slug: string,
  name: string,
  alsoInTheTeam: { memberNumber: string; since: number }[],
) {
  return { ...aTeam, id, slug, name, organizerMemberNumber: undefined, alsoInTheTeam }
}

/**
 * The teams, as a reader is answered them.
 *
 * <p>A visitor is told the member who hides ON THE TEAM, and nobody's seat. Anybody signed in is
 * told it on the member's own record instead, so the team names nobody, and a MEMBER is told
 * whether he founded it.
 */
function teamsTo(session: Session) {
  if (session.who === 'nobody') {
    return [
      aTeamNaming(THE_TEAM, ITS_ADDRESS, ITS_NAME, [{ memberNumber: HIDDEN, since: 2027 }]),
      aTeamNaming(42, 'drugi-tim', 'Drugi tim', []),
    ]
  }

  const mine = (founded: boolean) => (session.who === 'member' ? { foundedByMe: founded, administeredByMe: founded } : {})

  return [
    { ...aTeamNaming(THE_TEAM, ITS_ADDRESS, ITS_NAME, []), ...mine(session.founder) },
    { ...aTeamNaming(42, 'drugi-tim', 'Drugi tim', []), ...mine(false) },
  ]
}

let made = 800_000

function aResult(memberNumber: string, date: string, points: number) {
  made += 1

  return {
    id: made,
    memberNumber,
    raceId: 275,
    raceName: 'Trka',
    eventName: 'Trka',
    eventSlug: 'trka',
    date,
    distanceKm: 10,
    ascentM: 100,
    descentM: 100,
    seconds: 3000,
    points,
    category: 'short',
  }
}

/* Ten for the member who does not hide, seven for the one who does, twelve for the other team:
   so the team is worth 17 with him and 10 without, and the other team's 12 is between the two. */
const RESULTS = [
  aResult(OPEN, '2027-05-01', 10),
  aResult(HIDDEN, '2027-05-02', 7),
  aResult(ELSEWHERE, '2027-05-03', 12),
]

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

function whoTheServerSays(session: Session): Response {
  if (session.who === 'nobody') {
    return answeredWith(401)
  }

  return session.who === 'member'
    ? json({ role: 'competitor', account: 7, member: { memberNumber: session.member } })
    : json({ role: 'moderator', account: 9 })
}

let session: Session = { who: 'nobody', member: HIDDEN, founder: false, signsInAs: 'member' }
let server: { asked: Asked[]; stop: () => void } | null = null

/** A server that answers by the session it holds, which `/api/sign-in` and `/api/sign-out` move. */
function aServerThatAnswersBySession(start: Partial<Session>): void {
  session = { who: 'nobody', member: HIDDEN, founder: false, signsInAs: 'member', ...start }

  server = serverThat((path) => {
    switch (path) {
      case '/api/me':
        return whoTheServerSays(session)
      case '/api/sign-in':
        session.who = session.signsInAs

        return did()
      case '/api/sign-out':
        session.who = 'nobody'

        return did()
      case '/api/competitors':
        return json(competitorsTo(session.who !== 'nobody'))
      case '/api/teams':
        return json(teamsTo(session))
      case '/api/results':
        return json(RESULTS)
      default:
        return isResource(path) ? null : answeredWith(404)
    }
  })
}

function askedFor(path: string): Asked[] {
  return (server?.asked ?? []).filter((one) => one.path === path)
}

async function signInHere(): Promise<void> {
  const user = setupUser()

  await user.type(await screen.findByLabelText('Adresa elektronske pošte'), 'skriven@primer.rs')
  await user.type(screen.getByLabelText('Lozinka'), 'ovo-je-probna-lozinka-123')
  await user.click(screen.getByRole('button', { name: 'Prijavi se' }))
}

async function signOutHere(): Promise<void> {
  const user = setupUser()

  await user.click(await screen.findByRole('button', { name: 'Otvori nalog' }))
  await user.click(screen.getByRole('button', { name: 'Odjavi se' }))
  /* Waited for rather than assumed: the header says nobody is signed in once the session has. */
  await screen.findByRole('link', { name: 'Prijavi se' })
}

/** His team in the table of teams: what it is worth, how many it counts, and who stands first. */
async function hisTeamRow(): Promise<{ points: string; members: string; first: string }> {
  const table = await screen.findByRole('table', { name: 'Timovi' })
  const rows = within(table).getAllByRole('row').slice(1)
  const his = must(
    rows.find((row) => (row.textContent ?? '').includes(ITS_NAME)),
    'his team',
  )
  const cells = within(his).getAllByRole('cell')

  return {
    points: must(cells.at(-1), 'points').textContent ?? '',
    members: must(cells[3], 'members').textContent ?? '',
    first: must(rows[0], 'first row').textContent ?? '',
  }
}

/**
 * The portraits the page draws, by the address each is drawn from, once the cards are there.
 *
 * <p>Waited for by the member who hides, whose card is drawn in both answers: a page that has not
 * drawn him yet has no portrait of his either, which is what „none" would read as. A circle is
 * decoration (`components/Portrait.tsx`), so it is found as what it is: a picture with no name.
 */
async function picturesOnTheCards(): Promise<string[]> {
  expect(await screen.findByText('Skriven Skrivenic')).toBeVisible()

  return within(screen.getByRole('main'))
    .queryAllByRole('presentation', { hidden: true })
    .flatMap((one) => (one.tagName === 'IMG' ? [one.getAttribute('src') ?? ''] : []))
}

beforeEach(() => {
  forgetEveryCookie()
  document.cookie = 'XSRF-TOKEN=imam'
})

afterEach(() => {
  server?.stop()
  server = null
  forgetEveryCookie()
})

describe('somebody signs in without the page being reloaded', () => {
  it.each([
    ['after the front page, which reads only the members', '/sr'],
    ['straight from the sign in page, which has always been right', '/sr/prijava'],
  ])('draws his team whole on the table of teams and on his own profile, %s', async (_how, start) => {
    aServerThatAnswersBySession({ signsInAs: 'member', member: HIDDEN })
    const { router } = renderAt(start, 'visitor', null, undefined, TODAY)

    if (start === '/sr') {
      /* The front page asks for `competitors` as a visitor is answered it, and that is the half of
         the pair the table of teams will not ask for again. */
      await waitFor(() => {
        expect(askedFor('/api/competitors')).toHaveLength(1)
      })
      await act(async () => {
        await router.navigate('/sr/prijava')
      })
    }

    await signInHere()

    /* On his own profile he is in his team. `Bez tima` is what he read here before. */
    expect(await screen.findByRole('heading', { level: 1, name: /Skriven Skrivenic/ })).toBeVisible()
    expect(await screen.findByRole('link', { name: ITS_NAME })).toBeVisible()
    expect(screen.queryByText('Bez tima')).not.toBeInTheDocument()

    await act(async () => {
      await router.navigate('/sr/timovi')
    })
    const row = await hisTeamRow()

    expect(row.points).toBe(formatPoints(17, 'sr'))
    expect(row.members).toBe('2')
    expect(row.first).toContain(ITS_NAME)
  })
})

describe('the founder of a team that has a member who hides', () => {
  /* The one who founded it IS the one who hides, which is where both halves of the control
     (`readerAdministers`) are read off the answer: `foundedByMe` off the team and his own seat off
     the record. Either one read as a visitor was answered it, and he has no control. */
  it.each([
    ['after the front page, which reads only the members', '/sr'],
    ['after the table of teams, which reads both', '/sr/timovi'],
    ['straight from the sign in page, which has always been right', '/sr/prijava'],
  ])('has the control to edit it on its page, %s', async (_how, start) => {
    aServerThatAnswersBySession({ signsInAs: 'member', member: HIDDEN, founder: true })
    const { router } = renderAt(start, 'visitor', null, undefined, TODAY)

    if (start !== '/sr/prijava') {
      /* Read as a visitor, so there is something for the sign in to leave behind. The table reads
         BOTH names and the front page one of them, which is what makes the two cases two. */
      await waitFor(() => {
        expect(askedFor('/api/competitors')).toHaveLength(1)
      })

      if (start === '/sr/timovi') {
        await hisTeamRow()
      }

      await act(async () => {
        await router.navigate('/sr/prijava')
      })
    }

    await signInHere()
    expect(await screen.findByRole('heading', { level: 1, name: /Skriven Skrivenic/ })).toBeVisible()

    await act(async () => {
      await router.navigate(`/sr/tim/${ITS_ADDRESS}`)
    })

    expect(await screen.findByRole('heading', { level: 1, name: ITS_NAME })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Izmeni' })).toBeVisible()
  })
})

describe('a moderator signs in behind a visitor', () => {
  it('is a reader as much as a member is, so the table of teams is drawn whole for him too', async () => {
    /* An account that races for nobody has no member number and is answered the signed in shape
       all the same. A rule that told readers apart by the number would call him nobody. */
    aServerThatAnswersBySession({ signsInAs: 'moderator' })
    const { router } = renderAt('/sr', 'visitor', null, undefined, TODAY)

    await waitFor(() => {
      expect(askedFor('/api/competitors')).toHaveLength(1)
    })
    await act(async () => {
      await router.navigate('/sr/prijava')
    })
    await signInHere()
    /* The header says somebody is signed in once the session has been told. */
    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()

    await act(async () => {
      await router.navigate('/sr/timovi')
    })
    const row = await hisTeamRow()

    expect(row.points).toBe(formatPoints(17, 'sr'))
    expect(row.members).toBe('2')
  })
})

describe('somebody signs out without the page being reloaded', () => {
  it('is a visitor on the next screens, who is not shown a picture or a team he was not answered', async () => {
    /* A member who does not hide, reading the table of teams and then the cards of the members. He
       is answered the portrait of the member who hides, as everybody signed in is; the visitor who
       uses the same tab next is not, and the PICTURE is what tells the two answers apart on a card
       that links nowhere for either of them. The table of teams is read as well, so that BOTH
       names are held in his shape when he goes: dropped one without the other, his team loses the
       member who hides and his seven points, which is the first half of the finding turned round. */
    aServerThatAnswersBySession({ who: 'member', member: OPEN })
    const { router } = renderAt('/sr/timovi', 'visitor', null, undefined, TODAY)

    expect((await hisTeamRow()).points).toBe(formatPoints(17, 'sr'))
    await act(async () => {
      await router.navigate('/sr/takmicari')
    })

    /* Both ends named, because „no picture" is also what a page that has stopped drawing them
       looks like: before the sign out the very same cards have to hold his. */
    expect(await picturesOnTheCards()).toEqual([aCompetitor.photo])

    await signOutHere()

    await act(async () => {
      await router.navigate('/sr/timovi')
    })
    const row = await hisTeamRow()

    expect(row.points).toBe(formatPoints(17, 'sr'))
    expect(row.members).toBe('2')

    await act(async () => {
      await router.navigate('/sr/takmicari')
    })

    expect(await picturesOnTheCards()).toEqual([])
  }, SLOW)
})

describe('a member who comes back with a cookie', () => {
  it('is not sent back for what the first screen already read, which was answered to him', async () => {
    /* The server already knows him when the page opens: the cookie is in the browser, the portal
       is not told until `GET /api/me` comes back, and everything the first screen asked for in
       the meantime was answered in his shape. Read as a CHANGE of reader, that answer would drop
       the two lists the screen holds and the next one would ask for both again. */
    aServerThatAnswersBySession({ who: 'member', member: OPEN })
    const { router } = renderAt('/sr', 'visitor', null, undefined, TODAY)

    expect(await screen.findByRole('button', { name: 'Otvori nalog' })).toBeVisible()
    await waitFor(() => {
      expect(askedFor('/api/me')).toHaveLength(1)
    })

    await act(async () => {
      await router.navigate('/sr/timovi')
    })
    const row = await hisTeamRow()

    expect(row.points).toBe(formatPoints(17, 'sr'))
    expect(askedFor('/api/competitors')).toHaveLength(1)
    expect(askedFor('/api/teams')).toHaveLength(1)
  })
})

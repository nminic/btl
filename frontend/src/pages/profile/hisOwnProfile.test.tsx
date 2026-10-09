import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { must } from '../../test/at'
import {
  aLapsedMembersPage,
  aServerThatAnswersWhenTold,
  hisPageAsServed,
  WHAT_MAY_BE_LEFT_OUT,
} from '../../test/hisPage'
import { componentsOf } from '../../test/javaRecords'
import { renderAt } from '../../test/render'
import { serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { aCompetitor, asAnswered } from '../../test/theAnswer'
import { setupUser } from '../../test/user'

/**
 * A MEMBER WHOSE FEE HAS LAPSED OPENS HIS OWN PROFILE, AND ONLY HIS OWN.
 *
 * <p>PDL P8a, 25.09.2026, „Treba da moze da otvori svoj profil dokle god postoji": the page this
 * portal used to turn such a member away from, to the front page, even when it was his. He is on no
 * row of `/api/competitors` (the list the server serves ends where the fee does), so the screens
 * find nobody for him and ask the server for his record instead (`profile/HisOwnRecord.tsx`).
 *
 * <p><b>The axes, each with both of its states in the arrangement and not in a comment.</b> The
 * fee: the lapsed member (000032, the one the generated data has) on his own page, and the cases
 * about a standing fee are the ones the rest of the portal already has. Whose page: his, and
 * another's - a hidden one (000007), the FIRST one on the list the server serves (000001, made
 * hidden here so that "his" taken from the first row of the list is a wrong answer and not an
 * accident), and a number nobody has. Where "his" comes from: the number the session names, never
 * the address alone. Whether the page is hidden: his own is not, from him. Whether the record
 * has come: it has not, it has, it cannot be had. Who is reading: a visitor, an account that
 * races for nobody and an administrator, none of whom is him.
 *
 * <p><b>The server is stood in for by `hisPageAsServed`</b> and the list by a stand-in of its own,
 * both IN FRONT of the disc reader, so everything these cases do not name is answered as it always
 * was. The list never carries 000032: that is the whole of the state the cases are about.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, so that a wait which never succeeds ends
   the case with the assertion's own words and not with the case's clock. The global is `SLOW` for both
   (`test/setup.ts`): a mutation that leaves a screen undrawn would then end as `Test timed out` or as
   `Unable to find`, depending on which of two equal clocks ran out first, and a series of mutations
   that cannot tell the two apart counts a clock as a catch. The arrangement is the one
   `pages/admin/saveWhileSaving.test.tsx` found for itself, and it is set here for this file alone. */
configure({ asyncUtilTimeout: SLOW / 2 })

const FILE: Record<string, unknown>[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)
const TEAMS: Record<string, unknown>[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/teams.json'), 'utf-8'),
)

const HIS_NAME = 'Vojislav Antonijević'
const HIS_ADDRESS = '/sr/takmicar/000032-vojislav-antonijevic'
const THE_HIDDEN_ONE = '/sr/takmicar/000007-strahinja-vukicevic'
const THE_FIRST_ON_THE_LIST = must(
  FILE.find((one) => one.active === true),
  'a member who is on the list',
)
const A_NUMBER_NOBODY_HAS = '/sr/takmicar/000999-niko-nikic'

/** The stand-ins, put back in the order they were put in front, because each one restores what
 *  stood before it and a different order puts back a server that is not there. */
const stops: (() => void)[] = []

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.()
  }
})

function stand<T extends { stop: () => void }>(server: T): T {
  stops.push(server.stop)

  return server
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * THE LIST THE SERVER SERVES: every member whose fee stands, none whose fee has lapsed, and the
 * ones named made hidden. A member whose fee has lapsed is not on the list at all (owner,
 * 13.09.2026), and the generated file still carries him with a flag, so the case builds the answer
 * the portal will really get (`test/serverAnswers.ts`, `membersAsServed`, says why).
 */
function theListWith(hidden: string[]): { stop: () => void } {
  const answered = FILE.filter((one) => one.active === true).map((row) => ({
    ...asAnswered(row, aCompetitor),
    ...(hidden.includes(String(row.memberNumber)) ? { profileHidden: true } : {}),
  }))

  return serverThat((path) => (path === '/api/competitors' ? json(answered) : null))
}

/** Whoever the session names, for the cases that ask who is reading. */
function Reader() {
  const { memberNumber } = useSession()

  return <p>čitalac: {memberNumber ?? 'niko'}</p>
}

/** Signs somebody in during the visit, the way the four cases that do it write it: both writes
 *  `session/useTheServersSession.ts` makes with an answer, because the role and the number are
 *  what a reader is read by. */
function SignInAs({ memberNumber, label }: { memberNumber: string; label: string }) {
  const { theServerSignedMeIn } = useSession()
  const { become } = useRole()

  return (
    <button
      type="button"
      onClick={() => {
        become('competitor')
        theServerSignedMeIn({
          account: 2,
          memberNumber,
          country: null,
          firstSeason: null,
          teamId: null,
          membershipBasis: null,
          referralCode: null,
          referredCount: null,
        })
      }}
    >
      {label}
    </button>
  )
}

/** Every `/api/me` the visit asked for. The shell asks once; a second is the page asking for the
 *  reader's own record. */
const timesTheServerWasAskedWhoIAm = (asked: Asked[]): number =>
  asked.filter((one) => one.path === '/api/me').length

describe('the record the server declares', () => {
  it('is exactly the sample these cases answer with, and the four names it may leave out', () => {
    /* The floor under every case below: the sample is the record `MeApi.MyOwnRecord` declares,
       read off the backend's own source. A name added to the record and not to the sample is a page
       drawn from an answer the server does not give; a name in the sample the server has not got is
       a case that passes against a body no server sends. */
    expect([...Object.keys(aLapsedMembersPage), ...WHAT_MAY_BE_LEFT_OUT].sort()).toEqual(
      componentsOf('MyOwnRecord'),
    )
  })
})

describe('a member whose fee has lapsed, on his own page', () => {
  let asked: Asked[] = []

  beforeEach(() => {
    stand(theListWith(['000007']))
    asked = stand(hisPageAsServed()).asked
  })

  it('opens at moj-profil, drawn from his own record, and is not sent anywhere', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/moj-profil', 'competitor', '000032')

    expect(await screen.findByRole('heading', { level: 1, name: HIS_NAME })).toBeVisible()
    expect(router.state.location.pathname).toBe('/sr/moj-profil')

    /* Every fact of the line under the name is his, and none of them is a value another member
       here carries: the number, the category worked out from his band and his gender, the town,
       the season he started in and the absence of a club. */
    const line = must(screen.getByText(/Članski broj 000032/).closest('p'), 'the line under the name')
    expect(line).toHaveTextContent('M40-54')
    expect(line).toHaveTextContent('Zaječar')
    expect(line).toHaveTextContent('U ligi od 2016.')
    expect(line).toHaveTextContent('Bez tima')
    expect(screen.getByText(/Ovaj takmičar još nije napisao ništa o sebi/)).toBeVisible()

    /* And the reason the owner gave for the decision: from here he can reach the page he renews
       on. It is the menu behind his picture, as it is for everybody. */
    await user.click(screen.getByRole('button', { name: 'Otvori nalog' }))
    expect(screen.getByRole('link', { name: 'Moja članarina' })).toBeVisible()
  }, SLOW)

  it('opens at the public address too, and moves to the one address it lives at', async () => {
    const { router } = renderAt('/sr/takmicar/000032', 'competitor', '000032')

    expect(await screen.findByRole('heading', { level: 1, name: HIS_NAME })).toBeVisible()
    expect(router.state.location.pathname).toBe(HIS_ADDRESS)
  }, SLOW)

  it('asks the server for his record once, besides the shell\'s own question', async () => {
    renderAt('/sr/moj-profil', 'competitor', '000032')

    await screen.findByRole('heading', { level: 1, name: HIS_NAME })

    expect(timesTheServerWasAskedWhoIAm(asked)).toBe(2)
  }, SLOW)

  it('moves from the overview to the awards by the link the profile itself draws, and is not sent away', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/moj-profil', 'competitor', '000032')

    await screen.findByRole('heading', { level: 1, name: HIS_NAME })
    await user.click(within(screen.getByRole('navigation', { name: 'Delovi profila' })).getByRole('link', { name: 'Priznanja i nagrade' }))

    expect(await screen.findByRole('heading', { level: 2, name: /^Pehari \d+$/ })).toBeVisible()
    expect(router.state.location.pathname).toBe(`${HIS_ADDRESS}/priznanja`)
    expect(screen.getByRole('heading', { level: 1, name: HIS_NAME })).toBeVisible()
  }, SLOW)

  it('is shown a hidden profile of his own whole: nothing about himself is hidden from him', async () => {
    stand(
      hisPageAsServed({
        profileHidden: true,
        bio: 'Trčim sam i pišem o tome.',
        teamId: TEAMS[0]?.id,
        teamSince: 2018,
      }),
    )
    const { router } = renderAt('/sr/moj-profil', 'competitor', '000032')

    expect(await screen.findByRole('heading', { level: 1, name: HIS_NAME })).toBeVisible()
    expect(router.state.location.pathname).toBe('/sr/moj-profil')
    expect(screen.getByText('Trčim sam i pišem o tome.')).toBeVisible()
    expect(screen.getByRole('link', { name: String(TEAMS[0]?.name) })).toBeVisible()
  }, SLOW)

  describe('and the awards', () => {
    /* A podium he won in 2019, in a season when his fee stood. The results are what the server
       serves: the rows of the seasons he was a member in, with his number on them. The other man
       is on the list. */
    const aRun = (id: number, memberNumber: string, points: number) => ({
      id,
      memberNumber,
      raceId: 700 + id,
      raceName: 'Trka za pehar',
      eventName: 'Trka za pehar',
      eventSlug: 'trka-za-pehar-2019',
      date: '2019-05-05',
      distanceKm: 21.1,
      ascentM: 40,
      descentM: 40,
      seconds: 6000,
      points,
      category: 'half',
    })

    it('shows the trophies he won, which are read back out of boards he is not on', async () => {
      stand(
        serverThat((path) =>
          path === '/api/results' ? json([aRun(9001, '000032', 100), aRun(9002, '000001', 50)]) : null,
        ),
      )
      renderAt(`${HIS_ADDRESS}/priznanja`, 'competitor', '000032')

      const table = await screen.findByRole('table', { name: 'Pehari' })
      const rows = within(table).getAllByRole('row').slice(1)

      expect(screen.getByRole('heading', { level: 2, name: 'Pehari 2' })).toBeVisible()
      expect(rows.map((row) => row.textContent)).toEqual([
        expect.stringContaining('2019Generalni plasman1. mesto'),
        expect.stringContaining('2019Kategorija M40-541. mesto'),
      ])
    }, SLOW)

    it('still says he has won nothing where he has won nothing', async () => {
      stand(serverThat((path) => (path === '/api/results' ? json([aRun(9002, '000001', 50)]) : null)))
      renderAt(`${HIS_ADDRESS}/priznanja`, 'competitor', '000032')

      expect(await screen.findByText('Ovaj takmičar još nema nijedan pehar.')).toBeVisible()
    }, SLOW)
  })

  it.each([
    ['a hidden profile that is not his', THE_HIDDEN_ONE],
    ['the page of awards of a hidden profile that is not his', `${THE_HIDDEN_ONE}/priznanja`],
    ['a number nobody has', A_NUMBER_NOBODY_HAS],
    ['the page of awards of a number nobody has', `${A_NUMBER_NOBODY_HAS}/priznanja`],
  ])('is still sent to the front page from %s, as everybody who is not that member is', async (_what, where) => {
    const { router } = renderAt(where, 'competitor', '000032')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(screen.queryByRole('heading', { level: 1, name: HIS_NAME })).toBeNull()
    expect(screen.queryByText(/Podaci se ne mogu učitati/)).toBeNull()
    expect(timesTheServerWasAskedWhoIAm(asked)).toBe(1)
  }, SLOW)

  it('does not take the first member of the list for himself', async () => {
    /* The list the server serves, with ITS FIRST member made hidden: the wrong source for „his"
       that no case about a hidden member who is the 7th could tell from the right one. */
    stand(theListWith([String(THE_FIRST_ON_THE_LIST.memberNumber)]))
    const { router } = renderAt(
      `/sr/takmicar/${String(THE_FIRST_ON_THE_LIST.memberNumber)}`,
      'competitor',
      '000032',
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(timesTheServerWasAskedWhoIAm(asked)).toBe(1)
  }, SLOW)
})

describe('a reader who is not that member, at his address', () => {
  beforeEach(() => {
    stand(theListWith(['000007']))
  })

  it.each([
    ['a visitor', () => new Response(null, { status: 401 })],
    ['an account that races for nobody', () => json({ role: 'moderator', account: 1 })],
    ['a free account', () => json({ role: 'competitor', account: 1 })],
  ])('is sent to the front page, even though %s names a number nobody else has: his', async (_who, answer) => {
    const { asked } = stand(serverThat((path) => (path === '/api/me' ? answer() : null)))
    const { router } = renderAt(HIS_ADDRESS, 'visitor', null)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(timesTheServerWasAskedWhoIAm(asked)).toBe(1)
  }, SLOW)

  it('is sent to the front page when he is the administration, which races for nobody and reads all the same', async () => {
    const { asked } = stand(
      serverThat((path) => (path === '/api/me' ? json({ role: 'superadmin', account: 1 }) : null)),
    )
    const { router } = renderAt(HIS_ADDRESS, 'visitor', null)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(screen.queryByRole('heading', { level: 1, name: HIS_NAME })).toBeNull()
    expect(timesTheServerWasAskedWhoIAm(asked)).toBe(1)
  }, SLOW)
})

describe('a member whose fee stands, on his own page', () => {
  it('is drawn from the list as it always was, and the server is not asked for a record besides', async () => {
    /* The first member of the file who is active and is a man, drawn from the list the disc
       serves. A page that asked for his own record first would be the same page and a second
       question: the count of questions is what says which road it took. */
    const { asked, stop } = serverThat(() => null)

    try {
      renderAt('/sr/moj-profil', 'competitor', '000007')

      expect(await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })).toBeVisible()
      expect(timesTheServerWasAskedWhoIAm(asked)).toBe(1)
    } finally {
      stop()
    }
  }, SLOW)
})

/**
 * THE TWO MOMENTS BETWEEN THE QUESTIONS, on a cold load of his own address: a new tab, F5, a
 * bookmark. At the first paint of a visit the reader is nobody (`app/App.tsx` mounts the role with
 * no prop and the session holds nothing until `GET /api/me` has come back), and then he is
 * somebody whose page is not on the list and whose record is still on its way.
 *
 * <p>Neither is allowed to be the front page. The first is the fault `profile/beforeTheAnswer.test.tsx`
 * measures for a hidden profile (the screen decided before the server had said who was reading),
 * and the second is its twin: the screen knew WHOSE page it was and had nothing to draw it from yet.
 * A redirect in either would send away the one reader the decision of 25.09.2026 is for.
 */
describe('his own page, on a cold load', () => {
  const waitingOutLoud = () =>
    screen.queryAllByRole('status').filter((one) => one.textContent === 'Učitavanje')

  /** Everything the screen needs besides the answers about the reader has come, so what is
   *  measured is the moment between the questions and not a screen that is still loading. */
  async function theDataHasArrived(asked: Asked[]) {
    await waitFor(() => {
      expect(asked.map((one) => one.path)).toContain('/api/pairs')
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  beforeEach(() => {
    stand(theListWith(['000007']))
  })

  it('waits for the server to say who is reading, then for his record, and is never sent away', async () => {
    const server = stand(aServerThatAnswersWhenTold())
    const { router } = renderAt(HIS_ADDRESS, 'visitor', null)

    await theDataHasArrived(server.asked)

    /* Nobody has said who is reading. */
    expect(router.state.location.pathname).toBe(HIS_ADDRESS)
    expect(waitingOutLoud()).toHaveLength(1)
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(server.count()).toBe(1)

    /* The server says who is reading, and a lapsed member's page is not on the list: the screen
       now knows whose page it is and asks for his record, which has not come. */
    await act(async () => {
      server.answer(0, json({ role: 'competitor', account: 1, member: aLapsedMembersPage }))
      await Promise.resolve()
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })
    expect(router.state.location.pathname).toBe(HIS_ADDRESS)
    expect(waitingOutLoud()).toHaveLength(1)
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()

    /* And the record comes. */
    await act(async () => {
      server.answer(1, json({ role: 'competitor', account: 1, member: aLapsedMembersPage }))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(await screen.findByRole('heading', { level: 1, name: HIS_NAME })).toBeVisible()
    expect(router.state.location.pathname).toBe(HIS_ADDRESS)
    expect(waitingOutLoud()).toHaveLength(0)
  }, SLOW)

  it('still sends a visitor to the front page once the server says nobody is signed in', async () => {
    const server = stand(aServerThatAnswersWhenTold())
    const { router } = renderAt(HIS_ADDRESS, 'visitor', null)

    await theDataHasArrived(server.asked)
    await act(async () => {
      server.answer(0, new Response(null, { status: 401 }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sr')
    })
    expect(server.count()).toBe(1)
  }, SLOW)
})

/**
 * HIS RECORD CANNOT BE HAD, and the page says so instead of sending him anywhere.
 *
 * <p>The decision of 02.10.2026 that a read that failed says so and offers to ask again is carried
 * out by `Resource` for every screen that goes through it, and this page is one (my reading of it,
 * `profile/useHisOwnRecord.ts`). <b>The member stays signed in through all of it</b>, which is the
 * condition this work was accepted under: `session/theServer.ts` reads who he is and what his page
 * is apart, so a fault in the second never signs him out of the first.
 */
describe('his own page, when his record cannot be had', () => {
  beforeEach(() => {
    stand(theListWith(['000007']))
  })

  const itSaysSo = async (router: { state: { location: { pathname: string } } }) => {
    expect(await screen.findByText('Podaci se ne mogu učitati.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Pokušaj ponovo' })).toBeVisible()
    expect(router.state.location.pathname).toBe('/sr/moj-profil')
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
  }

  it.each([
    ['the server cannot be reached', () => new Error('nema veze')],
    ['the server refuses', () => new Response(null, { status: 500 })],
    ['the answer names nobody', () => json({ role: 'competitor', account: 1 })],
    ['the answer names another member', () => json({ role: 'competitor', account: 1, member: { ...aLapsedMembersPage, memberNumber: '000040' } })],
    ['the page is one the portal cannot believe', () => json({ role: 'competitor', account: 1, member: { ...aLapsedMembersPage, gender: 'X' } })],
  ])('says so, and keeps him signed in, when %s', async (_what, theSecondAnswer) => {
    const server = stand(aServerThatAnswersWhenTold())
    const { router } = renderAt('/sr/moj-profil', 'competitor', '000032', undefined, undefined, <Reader />)

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, json({ role: 'competitor', account: 1, member: aLapsedMembersPage }))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })
    await act(async () => {
      server.answer(1, theSecondAnswer())
      await Promise.resolve()
      await Promise.resolve()
    })

    await itSaysSo(router)
    expect(screen.getByText('čitalac: 000032')).toBeVisible()
  }, SLOW)

  it('is the record when he asks again and the server has recovered', async () => {
    const user = setupUser()
    const server = stand(aServerThatAnswersWhenTold())
    const { router } = renderAt('/sr/moj-profil', 'competitor', '000032')

    await waitFor(() => {
      expect(server.count()).toBe(1)
    })
    await act(async () => {
      server.answer(0, json({ role: 'competitor', account: 1, member: aLapsedMembersPage }))
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(server.count()).toBe(2)
    })
    await act(async () => {
      server.answer(1, new Response(null, { status: 500 }))
      await Promise.resolve()
      await Promise.resolve()
    })
    await itSaysSo(router)

    await user.click(screen.getByRole('button', { name: 'Pokušaj ponovo' }))
    await waitFor(() => {
      expect(server.count()).toBe(3)
    })
    await act(async () => {
      server.answer(2, json({ role: 'competitor', account: 1, member: aLapsedMembersPage }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByRole('heading', { level: 1, name: HIS_NAME })).toBeVisible()
    expect(screen.queryByText('Podaci se ne mogu učitati.')).toBeNull()
  }, SLOW)

  /* **THE CASE THE WHOLE SEPARATION IS FOR, ON A COLD LOAD, where the session starts empty.** The
     answer is the same one for both questions and it carries a gender the portal does not know.
     Read as one, the whole answer would be `null` and the session would never learn who he is:
     the reader stays `niko`, the page finds nobody for the address, and he is sent to the front
     page - signed out of every screen by a fault in the part that draws one. Read apart, he is
     `000032` and the page says that it cannot be read. */
  it('does not sign him out of the portal because of a fault in his page', async () => {
    stand(hisPageAsServed({ gender: 'X' }))
    const { router } = renderAt(HIS_ADDRESS, 'visitor', null, undefined, undefined, <Reader />)

    expect(await screen.findByText('Podaci se ne mogu učitati.')).toBeVisible()
    expect(screen.getByText('čitalac: 000032')).toBeVisible()
    expect(router.state.location.pathname).toBe(HIS_ADDRESS)
  }, SLOW)
})

describe('his own page, when the reader changes inside one visit', () => {
  beforeEach(() => {
    stand(theListWith(['000007']))
  })

  it('draws the record of the member who is reading now, and never the one who was', async () => {
    /* A shared laptop at a race is the ordinary case: the sign out and the sign in happen in place
       (`session/theCachesFollowTheReader.ts`). The second man is also a member whose fee has lapsed
       and who is on no list, so both pages are drawn from a record asked for, and the only thing
       that can put the first man's name on the second man's page is the record being kept. */
    const second = { ...aLapsedMembersPage, memberNumber: '000033', firstName: 'Ana', lastName: 'Anić' }
    let current: Record<string, unknown> = aLapsedMembersPage

    stand(
      serverThat((path) =>
        path === '/api/me' ? json({ role: 'competitor', account: 1, member: current }) : null,
      ),
    )
    const user = setupUser()
    renderAt(
      '/sr/moj-profil',
      'competitor',
      '000032',
      undefined,
      undefined,
      <SignInAs memberNumber="000033" label="prijavi drugog" />,
    )

    expect(await screen.findByRole('heading', { level: 1, name: HIS_NAME })).toBeVisible()

    current = second
    await user.click(screen.getByRole('button', { name: 'prijavi drugog' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Ana Anić' })).toBeVisible()
    expect(screen.queryByText(HIS_NAME)).toBeNull()
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    /* The floor under the paragraph at the head of the file, asked of the number that decides and not
       of the text of the file: take the `configure` away and both clocks are `SLOW` again. */
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})

import { describe, expect, it } from 'vitest'
import { did, refused, serverThat, type Asked } from '../test/serverAnswers'
import { clearResourceCache, loadResource } from '../data/client'
import {
  applicationIn,
  invitationIn,
  theApplicationsOf,
  theApplicationWasAnswered,
  theDecisionGoesTo,
  theInvitationsOf,
  theInvitationWasTakenBack,
  theWithdrawalGoesTo,
  whatIsWaitingOn,
  whatThisTeamHasAsked,
  WHEN_DECIDING_AN_APPLICATION,
} from './joiningThisTeam'

/**
 * WHAT COUNTS AS AN ANSWER FROM THE TEAM'S TWO QUEUES, AND WHAT THE TWO WRITES SPEND.
 *
 * <p>The screen's own cases (`pages/teamQueueOnTheServer.test.tsx`) walk what a team sees and
 * presses. What is measured here is the two things a screen cannot show: every way an answer
 * can fail to be one, and which caches a write drops.
 *
 * <p><b>Every failure is deliberately the same outcome</b> - a list that could not be read, which
 * the screen says out loud with a way to ask again (owner, 02.10.2026, PENDING stavka 368) - and
 * that is exactly why each has to be measured on its own: folded into one answer, six different
 * faults look alike and a version that stopped checking one of them would pass every case about
 * the other five. <b>It was an EMPTY list until that day</b>, and an empty list is a list that was
 * read and holds nothing, which a team that could not reach the server is not told by.
 */

/* NOT THE FIRST TEAM AND NOT THE FIRST ROW, anywhere in this file. A team `1` and a row `1`
   would be satisfied by a function that ignored its argument and reached for whatever came
   first, which is the one mistake an address builder can make. */
const TEAM = 2

const APPLICATION = 71

const INVITATION = 94

const listOf = (what: unknown): Response =>
  new Response(JSON.stringify(what), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('where the team answers what is waiting on it', () => {
  it('builds the four addresses out of the team and the row, and not out of a first', () => {
    expect(theApplicationsOf(TEAM)).toBe('/api/teams/2/applications')
    expect(theInvitationsOf(TEAM)).toBe('/api/teams/2/invitations')
    /* Built out of the collection above rather than spelt again, which is what keeps the read
       of one row and the write to it one text. Measured on a DIFFERENT team from the one above
       so that a builder ignoring its argument cannot pass. */
    expect(theDecisionGoesTo(5, APPLICATION)).toBe('/api/teams/5/applications/71')
    expect(theWithdrawalGoesTo(5, INVITATION)).toBe('/api/teams/5/invitations/94')
  })

  it('names the two refusals the deciding route can make and no others', () => {
    /* The sentences themselves are held against the Java source by
       `pages/account/refusals.test.ts`; what is asked here is that this table is not a
       `Record<string, string>` in disguise with a third name quietly in it. */
    expect(Object.keys(WHEN_DECIDING_AN_APPLICATION)).toEqual([
      'theFormIsNotComplete',
      'theWindowIsShut',
    ])
  })
})

describe('what counts as a row the team is waiting on', () => {
  const ROW = { id: APPLICATION, memberNumber: '000004', date: '2026-10-02' }

  it('reads the three fields off a complete application', () => {
    expect(applicationIn(ROW)).toEqual(ROW)
  })

  it.each([
    ['not an object at all', 'a row'],
    ['nothing', null],
    ['an id that is not a number', { ...ROW, id: '71' }],
    ['a member number that is not text', { ...ROW, memberNumber: 4 }],
    ['a day that is not text', { ...ROW, date: 20261002 }],
    ['no member number at all', { id: APPLICATION, date: '2026-10-02' }],
  ])('refuses %s', (_what, row) => {
    expect(applicationIn(row)).toBeNull()
  })

  /* AN APPLICATION NAMING NOBODY IS REFUSED, and that is the whole asymmetry between the two
     lists read from this side. `TeamJoiningApi.waitingOn` carries `c.active`, so a member whose
     fee has lapsed is not in this list at all; a `null` arriving here would be a route
     answering something this side does not know. The invitation below is the opposite. */
  it('refuses an application that names nobody, because that route never answers one', () => {
    expect(applicationIn({ ...ROW, memberNumber: null })).toBeNull()
  })
})

describe('what counts as an invitation the team has sent', () => {
  const ROW = { id: INVITATION, memberNumber: '000006', date: '2026-10-05' }

  it('reads the three fields off a complete invitation', () => {
    expect(invitationIn(ROW)).toEqual(ROW)
  })

  /* AND KEEPS THE ROW THAT NAMES NOBODY, which is the one thing this narrowing exists for.
     `TeamJoiningApi.Invitation#memberNumber` is „whom it asked, or NULL where his fee has since
     lapsed", and the row stays because it is what refuses a second invitation to that man.
     Refused here, the team would be shown an empty place, ask again and be refused. */
  it('keeps an invitation whose member has no number any more', () => {
    expect(invitationIn({ ...ROW, memberNumber: null })).toEqual({ ...ROW, memberNumber: null })
  })

  it.each([
    ['not an object at all', 'a row'],
    ['nothing', null],
    ['an id that is not a number', { ...ROW, id: '94' }],
    ['a day that is not text', { ...ROW, date: 20261005 }],
    ['a member number that is neither text nor nothing', { ...ROW, memberNumber: 6 }],
    ['no member number key at all', { id: INVITATION, date: '2026-10-05' }],
  ])('refuses %s', (_what, row) => {
    expect(invitationIn(row)).toBeNull()
  })
})

describe('reading the two queues off the server', () => {
  const ASKING = [
    { id: APPLICATION, memberNumber: '000004', date: '2026-10-02' },
    { id: 72, memberNumber: '000006', date: '2026-10-03' },
  ]

  const ASKED = [{ id: INVITATION, memberNumber: null, date: '2026-10-05' }]

  it('reads each list off its own address', async () => {
    const server = serverThat((path) => {
      if (path === '/api/teams/2/applications') {
        return listOf(ASKING)
      }

      return path === '/api/teams/2/invitations' ? listOf(ASKED) : null
    })

    try {
      expect(await whatIsWaitingOn(TEAM)).toEqual({ got: 'rows', rows: ASKING })
      expect(await whatThisTeamHasAsked(TEAM)).toEqual({ got: 'rows', rows: ASKED })
    } finally {
      server.stop()
    }
  })

  /* THE SIX WAYS TO NOTHING, and they are one outcome on purpose (`joiningThisTeam.ts` says why).
     404 is the one worth reading twice: by ADL A8 it is BOTH „no such team" and „not for you", so
     a screen that said which of the two it was would be claiming a difference the server refuses
     to make. What it IS no longer is the same outcome as a list that was read and is empty. */
  it.each([
    ['there is no server to reach', () => Promise.reject(new Error('no socket'))],
    ['the route answers 404, whether the team is absent or not this reader\'s', () =>
      new Response(null, { status: 404 })],
    ['the route answers 401', () => new Response(null, { status: 401 })],
    ['the body is not JSON', () => new Response('hello', { status: 200 })],
    ['the body is not a list at all', () => listOf({ rows: [] })],
    ['one row of the list is not a row', () => listOf([ASKING[0], { id: 'seventy-two' }])],
  ])('says the list could not be read when %s', async (_what, answer) => {
    const server = serverThat((path) =>
      path === '/api/teams/2/applications' ? answer() : null,
    )

    try {
      expect(await whatIsWaitingOn(TEAM)).toEqual({ got: 'unreadable' })
    } finally {
      server.stop()
    }
  })

  /* AND AN EMPTY LIST IS A LIST, which is the other half of the change: the route answered, and
     what it answered is nobody. Told apart from the six above, a team whose queue is empty is not
     told that its queue could not be read. */
  it('says a list that was read and holds nothing is that', async () => {
    const server = serverThat((path) =>
      path === '/api/teams/2/applications' ? listOf([]) : null,
    )

    try {
      expect(await whatIsWaitingOn(TEAM)).toEqual({ got: 'rows', rows: [] })
    } finally {
      server.stop()
    }
  })

  /* ONE BAD ROW DROPS THE WHOLE LIST rather than itself, which is the direction chosen and is
     measured rather than left to the paragraph that claims it: a list that quietly left the row
     out would show the team fewer questions than it has. */
  it('drops the whole list rather than the row it cannot read', async () => {
    const server = serverThat((path) =>
      path === '/api/teams/2/invitations'
        ? listOf([{ id: INVITATION, memberNumber: '000006', date: '2026-10-05' }, { id: 95 }])
        : null,
    )

    try {
      expect(await whatThisTeamHasAsked(TEAM)).toEqual({ got: 'unreadable' })
    } finally {
      server.stop()
    }
  })
})

/** What was written, and to where, off the recording server's own account of it. */
function writes(asked: Asked[]): { path: string; how: string; body: string }[] {
  return asked
    .filter((one) => one.init?.method !== undefined && one.init.method !== 'GET')
    .map((one) => ({
      path: one.path,
      how: String(one.init?.method),
      body: String(one.init?.body ?? ''),
    }))
}

/**
 * WHETHER A RESOURCE IS STILL IN THE CACHE, asked of the cache itself and never of a flag.
 *
 * <p>`loadResource` holds one promise per address, so a name that is still cached answers
 * without the socket being touched again. Counting how many times the address was asked for is
 * therefore the only reading that says whether the cache was dropped, and it is the reading
 * that cannot be satisfied by anything else.
 */
async function timesAskedFor(name: 'teams' | 'competitors', act: () => Promise<unknown>) {
  clearResourceCache(name)

  const server = serverThat((path) => (path === `/api/${name}` ? listOf([]) : null))

  try {
    await loadResource(name)

    const before = server.asked.filter((one) => one.path === `/api/${name}`).length

    await act()
    await loadResource(name)

    return server.asked.filter((one) => one.path === `/api/${name}`).length - before
  } finally {
    server.stop()
    clearResourceCache(name)
  }
}

describe('the team answering one application', () => {
  it('sends the answer to that row of that team, and says which answer it is', async () => {
    const server = serverThat((_path, init) =>
      init?.method === 'PUT' && _path === '/api/teams/2/applications/71' ? did() : null,
    )

    try {
      expect(await theApplicationWasAnswered(TEAM, APPLICATION, true)).toEqual({
        got: 'done',
        body: undefined,
      })
      expect(await theApplicationWasAnswered(TEAM, APPLICATION, false)).toEqual({
        got: 'done',
        body: undefined,
      })
    } finally {
      server.stop()
    }

    /* Both bodies, because `accepted` is the whole difference between taking somebody in and
       closing his question, and a screen that sent the same body twice would look identical
       from the outside. */
    expect(writes(server.asked).map((one) => one.body)).toEqual([
      '{"accepted":true}',
      '{"accepted":false}',
    ])
  })

  it('hands back the reason the route named, unchanged', async () => {
    const server = serverThat((_path, init) =>
      init?.method === 'PUT' ? refused('theWindowIsShut', 409) : null,
    )

    try {
      expect(await theApplicationWasAnswered(TEAM, APPLICATION, true)).toEqual({
        got: 'refused',
        reason: 'theWindowIsShut',
      })
    } finally {
      server.stop()
    }
  })

  /* THE THREE CACHE CASES, and they are three rather than one because the two answers change
     different things: „Primi u tim" writes `team_membership` and „Odbij" writes nothing about a
     squad. Read off the cache rather than off a spy, so a version that dropped them on the
     ASKING rather than on the agreeing fails here too. */
  it.each([
    ['teams'] as const,
    ['competitors'] as const,
  ])('drops %s when the server agreed to take him in', async (name) => {
    const again = await timesAskedFor(name, async () => {
      const server = serverThat((_path, init) => (init?.method === 'PUT' ? did() : null))

      try {
        await theApplicationWasAnswered(TEAM, APPLICATION, true)
      } finally {
        server.stop()
      }
    })

    expect(again).toBe(1)
  })

  it.each([
    ['teams'] as const,
    ['competitors'] as const,
  ])('leaves %s alone when the answer was „Odbij"', async (name) => {
    const again = await timesAskedFor(name, async () => {
      const server = serverThat((_path, init) => (init?.method === 'PUT' ? did() : null))

      try {
        await theApplicationWasAnswered(TEAM, APPLICATION, false)
      } finally {
        server.stop()
      }
    })

    expect(again).toBe(0)
  })

  it.each([
    ['teams'] as const,
    ['competitors'] as const,
  ])('leaves %s alone when the route refused', async (name) => {
    const again = await timesAskedFor(name, async () => {
      const server = serverThat((_path, init) =>
        init?.method === 'PUT' ? refused('theWindowIsShut', 409) : null,
      )

      try {
        await theApplicationWasAnswered(TEAM, APPLICATION, true)
      } finally {
        server.stop()
      }
    })

    expect(again).toBe(0)
  })
})

describe('the team taking one invitation back', () => {
  it('sends the withdrawal to that row of that team and spends nothing else', async () => {
    const server = serverThat((_path, init) =>
      init?.method === 'DELETE' && _path === '/api/teams/2/invitations/94' ? did() : null,
    )

    try {
      expect(await theInvitationWasTakenBack(TEAM, INVITATION)).toEqual({
        got: 'done',
        body: undefined,
      })
    } finally {
      server.stop()
    }

    expect(writes(server.asked)).toEqual([
      { path: '/api/teams/2/invitations/94', how: 'DELETE', body: '{}' },
    ])
  })

  /* AND DROPS NO CACHE AT ALL, which is the claim the module makes in words and is worth a case
     because it is indistinguishable from forgetting. `TeamJoiningWriteApi.takingBack` deletes one
     row of `team_invitation` and no resource on this portal is answered out of that table. */
  it.each([
    ['teams'] as const,
    ['competitors'] as const,
  ])('leaves %s alone, because no resource is answered out of that table', async (name) => {
    const again = await timesAskedFor(name, async () => {
      const server = serverThat((_path, init) => (init?.method === 'DELETE' ? did() : null))

      try {
        await theInvitationWasTakenBack(TEAM, INVITATION)
      } finally {
        server.stop()
      }
    })

    expect(again).toBe(0)
  })

  it('hands back the number when the route answered one, since it names no reason', async () => {
    const server = serverThat((_path, init) =>
      init?.method === 'DELETE' ? new Response(null, { status: 404 }) : null,
    )

    try {
      expect(await theInvitationWasTakenBack(TEAM, INVITATION)).toEqual({
        got: 'wrong',
        status: 404,
      })
    } finally {
      server.stop()
    }
  })
})

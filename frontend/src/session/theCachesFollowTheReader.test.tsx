import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { arrivedResource, loadResource } from '../data/client'
import { isResource, serverThat } from '../test/serverAnswers'
import { setupUser } from '../test/user'
import { SessionProvider } from './SessionProvider'
import { readerOf } from './theCachesFollowTheReader'
import { useSession } from './useSession'

/**
 * THE TWO CACHES THAT ANSWER DIFFERENTLY TO DIFFERENT READERS, AND THE MOMENT THEY ARE
 * THROWN AWAY.
 *
 * <p><b>Asked of the cache itself and not of a screen</b>: the cases that draw a team, a roster
 * and a control are `pages/signingInAndOutInPlace.test.tsx`, and they measure what a reader
 * SEES. These measure the one thing underneath, which is whether `competitors` and `teams`
 * are still held at the moment a case looks, so a mutation of the rule fails here by name
 * before it fails there by symptom.
 *
 * <p><b>Three names are warmed and only two may go</b>, because „both were dropped" is
 * satisfied by a rule that empties the whole cache, and that is a request more for every
 * screen of every visit for nothing. `events` is the one that must stay.
 */

const A_MEMBER = {
  account: 7,
  memberNumber: '000101',
  country: null,
  firstSeason: null,
  teamId: null,
  membershipBasis: null,
  referralCode: null,
  referredCount: null,
}

/* Another PERSON and not another record of the same one: a different account AND a different
   number, which is the only thing the portal can see change when somebody else signs in. */
const ANOTHER_MEMBER = { ...A_MEMBER, account: 8, memberNumber: '000102' }

/* No number, which is what a moderator and a superadmin are permanently (PDL P21). */
const A_MODERATOR = { ...A_MEMBER, account: 9, memberNumber: null }

/* The same member told again, with something about him changed: what `Membership` does after
   he leaves a team. The reader is the same and what the answer says about him is not. */
const THE_SAME_MEMBER_AGAIN = { ...A_MEMBER, teamId: 41 }

function Probe() {
  const { theServerAnswered, theServerSignedMeIn, signOut, setGoing } = useSession()

  return (
    <>
      <button type="button" onClick={theServerAnswered}>
        server answered nobody
      </button>
      <button
        type="button"
        onClick={() => {
          /* In ONE handler, which is how `useTheServersSession` calls them and what makes them one
             render: the first answer of a returning member, who is both „the server has answered"
             and „somebody is signed in" at once. */
          theServerAnswered()
          theServerSignedMeIn(A_MEMBER)
        }}
      >
        server answered a member
      </button>
      <button type="button" onClick={() => theServerSignedMeIn(A_MEMBER)}>
        member signs in
      </button>
      <button type="button" onClick={() => theServerSignedMeIn(ANOTHER_MEMBER)}>
        another member signs in
      </button>
      <button type="button" onClick={() => theServerSignedMeIn(A_MODERATOR)}>
        moderator signs in
      </button>
      <button type="button" onClick={() => theServerSignedMeIn(THE_SAME_MEMBER_AGAIN)}>
        the same member is told again
      </button>
      <button type="button" onClick={signOut}>
        signs out
      </button>
      <button type="button" onClick={() => setGoing('1', true)}>
        something else changes
      </button>
    </>
  )
}

let server: { stop: () => void } | null = null

afterEach(() => {
  server?.stop()
  server = null
})

/** Three names read and arrived, so there is something for each case to find held or gone. */
async function warm(): Promise<void> {
  server = serverThat((path) =>
    isResource(path)
      ? new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
      : null,
  )

  await Promise.all([loadResource('competitors'), loadResource('teams'), loadResource('events')])
}

function held() {
  return {
    competitors: arrivedResource('competitors') !== undefined,
    teams: arrivedResource('teams') !== undefined,
    events: arrivedResource('events') !== undefined,
  }
}

const ALL_HELD = { competitors: true, teams: true, events: true }
const THE_TWO_ARE_GONE = { competitors: false, teams: false, events: true }

function visit(initialMemberNumber: string | null = null) {
  render(
    <SessionProvider initialMemberNumber={initialMemberNumber}>
      <Probe />
    </SessionProvider>,
  )

  return setupUser()
}

describe('the first answer of a visit', () => {
  it.each([
    ['nobody (a 401, a server that is not there)', 'server answered nobody'],
    ['a member who comes back with a cookie', 'server answered a member'],
  ])('drops nothing when it names %s', async (_who, button) => {
    /* **Everything the first screen asked for was answered to whoever the cookie names, which is
       the person this answer then names.** Dropped here, each returning member would be sent back
       for `competitors` and `teams` a second time on every visit, to be handed what he already
       holds. The cache is filled BEFORE the answer, which is the order a visit really has. */
    const user = visit()

    await warm()
    await user.click(screen.getByRole('button', { name: button }))

    expect(held()).toEqual(ALL_HELD)
  })

  it('is what registers the reader, so the first CHANGE after it is the one that drops', async () => {
    const user = visit()

    await warm()
    await user.click(screen.getByRole('button', { name: 'server answered nobody' }))
    await user.click(screen.getByRole('button', { name: 'member signs in' }))

    expect(held()).toEqual(THE_TWO_ARE_GONE)
  })
})

describe('somebody signing in', () => {
  it('drops competitors and teams, and nothing else', async () => {
    const user = visit()

    await user.click(screen.getByRole('button', { name: 'server answered nobody' }))
    await warm()
    await user.click(screen.getByRole('button', { name: 'member signs in' }))

    expect(held()).toEqual(THE_TWO_ARE_GONE)
  })

  it('does so for an account the league has given no number, which is a reader of its own', async () => {
    /* A moderator and a superadmin race for nobody, and the administration is answered a shape of
       its own. Read by the member number alone, a moderator signing in behind a visitor is nobody
       changing and nothing is dropped - which this fails by name. */
    const user = visit()

    await user.click(screen.getByRole('button', { name: 'server answered nobody' }))
    await warm()
    await user.click(screen.getByRole('button', { name: 'moderator signs in' }))

    expect(held()).toEqual(THE_TWO_ARE_GONE)
  })
})

describe('somebody signing out', () => {
  it('drops competitors and teams, and nothing else, because nobody is a reader like any other', async () => {
    const user = visit()

    await user.click(screen.getByRole('button', { name: 'server answered a member' }))
    await warm()
    await user.click(screen.getByRole('button', { name: 'signs out' }))

    expect(held()).toEqual(THE_TWO_ARE_GONE)
  })

  it('does so for an account that races for nobody as well', async () => {
    const user = visit()

    await user.click(screen.getByRole('button', { name: 'server answered nobody' }))
    await user.click(screen.getByRole('button', { name: 'moderator signs in' }))
    await warm()
    await user.click(screen.getByRole('button', { name: 'signs out' }))

    expect(held()).toEqual(THE_TWO_ARE_GONE)
  })

  it('does so for a member the portal was TOLD about before the server had answered', async () => {
    /* A case rendered as a member (`renderAt` with a number) names him in the first render, so
       there is a reader before there is an answer. A visit that waited for the answer to know who
       is asking would drop nothing here, and the sign out that follows would leave `competitors`
       and `teams` as he was answered. */
    const user = visit('000101')

    await warm()
    await user.click(screen.getByRole('button', { name: 'signs out' }))

    expect(held()).toEqual(THE_TWO_ARE_GONE)
  })

  it('and the answer that then names the same member changes nothing', async () => {
    const user = visit('000101')

    await warm()
    await user.click(screen.getByRole('button', { name: 'server answered a member' }))

    expect(held()).toEqual(ALL_HELD)
  })
})

describe('somebody else signing in behind a member', () => {
  it('is a change of reader, whichever of them it is', async () => {
    const user = visit()

    await user.click(screen.getByRole('button', { name: 'server answered a member' }))
    await warm()
    await user.click(screen.getByRole('button', { name: 'another member signs in' }))

    expect(held()).toEqual(THE_TWO_ARE_GONE)
  })
})

describe('what is not a change of reader', () => {
  it('is the same member being told about himself again', async () => {
    /* `member/Membership.tsx` does this after he leaves a team: `GET /api/me` again, written into
       the session whole. His team changed, and the caches are dropped by the write that did it
       (`member/teamExit.ts`); who is asking did not, and a rule that dropped on every call would
       send every screen back for both lists after each of them. */
    const user = visit()

    await user.click(screen.getByRole('button', { name: 'server answered a member' }))
    await warm()
    await user.click(screen.getByRole('button', { name: 'the same member is told again' }))

    expect(held()).toEqual(ALL_HELD)
  })

  it('is any other change in the session, which renders the provider again', async () => {
    const user = visit()

    await user.click(screen.getByRole('button', { name: 'server answered a member' }))
    await warm()
    await user.click(screen.getByRole('button', { name: 'something else changes' }))

    expect(held()).toEqual(ALL_HELD)
  })
})

describe('who is asking', () => {
  it('is the member number where there is one, and the account where there is not', () => {
    expect(readerOf('000101', null)).toBe('member 000101')
    expect(readerOf('000101', 7)).toBe('member 000101')
    expect(readerOf(null, 7)).toBe('account 7')
  })

  it('is nobody where there is neither', () => {
    expect(readerOf(null, null)).toBeNull()
  })

  it('never reads a member and an account as one reader, whatever their numbers are', () => {
    /* Two numbers that spell alike are two readers: an account is a row of `account` and a
       member number names a person in the league (`SessionProvider`, `signedIn`). */
    expect(readerOf('7', null)).not.toBe(readerOf(null, 7))
  })

  it('is somebody else when the member is somebody else', () => {
    expect(readerOf('000101', 7)).not.toBe(readerOf('000102', 7))
  })
})

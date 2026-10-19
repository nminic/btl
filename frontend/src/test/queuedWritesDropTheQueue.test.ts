import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * EVERY WRITE THAT PUTS A ROW INTO THE MODERATOR'S QUEUE HAS A CASE THAT HOLDS THE QUEUE
 * DROPPED AFTERWARDS.
 *
 * <p><b>The fault this floor is for, measured on QA on 19.10.2026.</b> The owner (a
 * superadmin, and a member) sent a comment; the screen said it was waiting for approval; and
 * it was in no queue. The server was right (`GET /api/verification` answered the row). The
 * portal was not: `data/client.ts` fetches a resource once per visit, the shell asks for
 * `verification` on every admin screen for the header counter, and `RateEvent.tsx` never
 * dropped it. `ProposeTeam.tsx` had the same fault. Three other screens already dropped it
 * (`ProfilePicture.tsx`, `ProfileBio.tsx`, `resultWrites.ts`), and each one had a case written
 * after a fault of its own; the two that did not were simply the two nobody had met yet.
 *
 * <p><b>The list of writers is read out of the server, not remembered.</b> A route writes into
 * the queue if the class that serves it contains an `insert into verification (`; the routes
 * are the mappings of those classes. A seventh route that queues a row stops this gate on the
 * day it is written, and asks its author which case holds the drop, instead of waiting for a
 * moderator who is also a member to find it. The table below is written by hand because the
 * case that holds each route is a fact the source cannot say; the floor under it is the
 * query over the Java. Read across the two halves of the repo on purpose, as
 * `pages/account/refusals.test.ts` and `test/serverConfig.test.ts` already do.
 *
 * <p><b>What this does not hold, and it is stated rather than left to be found.</b> That the
 * named case exists says nothing about what the case measures; that is measured by removing
 * each drop and watching its own case fail, which is how every row below was checked (see the
 * pull request). A class that merely contains the insert is read as writing it on every
 * route it maps with `POST` or `PUT`: `MeWriteApi` queues only for a `bio`, so its `PUT` is
 * listed here although a change of address does not queue anything, and the case named for it
 * is the one about the biography.
 */

const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')

/** Where the case that holds each route stands, and a title that is in the file. */
const GUARDS: Record<string, { file: string; title: string }> = {
  'POST /api/comments': {
    file: 'src/pages/event/rateEvent.test.tsx',
    title: "drops the moderator's queue once the server has taken the rating",
  },
  'POST /api/teams': {
    file: 'src/pages/member/proposeTeam.test.tsx',
    title: "drops the moderator's queue once the server has taken the proposal",
  },
  'POST /api/me/photo': {
    file: 'src/pages/member/pictureIsOneRow.test.tsx',
    title: 'appears on a queue this visit had ALREADY read once',
  },
  'PUT /api/me': {
    file: 'src/pages/member/profileBio.test.tsx',
    title: 'drops the queue after a text and the member list after a removal',
  },
  'POST /api/results': {
    file: 'src/pages/member/resultWrites.test.ts',
    title: "'a run is sent in'",
  },
  'PUT /api/results/{id}': {
    file: 'src/pages/member/resultWrites.test.ts',
    title: "'a correction is sent in'",
  },
}

/** Every `POST` or `PUT` mapping of every class that inserts into the queue. */
function routesThatQueue(): string[] {
  const found: string[] = []

  for (const name of readdirSync(WEB).filter((one) => one.endsWith('.java'))) {
    const java = readFileSync(join(WEB, name), 'utf-8')

    if (!/insert into verification \(/.test(java)) {
      continue
    }

    for (const one of java.matchAll(/@(Post|Put)Mapping\(\s*(?:path\s*=\s*)?"([^"]+)"/g)) {
      found.push(`${(one[1] ?? '').toUpperCase()} ${one[2] ?? ''}`)
    }
  }

  return found.sort()
}

describe('the writes that queue a row for a moderator', () => {
  it('is measuring something: the server names some', () => {
    expect(routesThatQueue().length).toBeGreaterThan(0)
  })

  it('are exactly the ones this table names, in both directions', () => {
    expect(routesThatQueue()).toEqual(Object.keys(GUARDS).sort())
  })

  it.each(Object.entries(GUARDS))('%s has its case where the table says', (_route, guard) => {
    const source = readFileSync(join(process.cwd(), guard.file), 'utf-8')

    expect(source).toContain(guard.title)
  })
})

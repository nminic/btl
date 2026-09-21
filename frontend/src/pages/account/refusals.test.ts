import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WHEN_CONFIRMING_AN_ADDRESS, WHEN_REGISTERING, WHEN_SETTING_A_PASSWORD } from './refusals'

/**
 * EVERY REASON THESE TWO ROUTES CAN NAME HAS A SENTENCE ON THE SCREEN THAT MEETS IT.
 *
 * <p><b>Why a floor at all, when each screen already has a branch for a reason it does
 * not know.</b> That branch prints the reason's own code at the reader, which is
 * honest and is not an answer: somebody who is told `thePasswordHasLeaked` in English
 * has been told nothing he can act on. The branch is there so a screen one release
 * behind its server cannot lie; this is there so it is never one release behind.
 *
 * <p><b>The list is read out of the server rather than remembered.</b> Both routes
 * declare their reasons as constants, which is the whole of what is read here: a
 * fourth reason added to `PasswordResetApi` stops this gate on the day it is written,
 * rather than reaching a reader as a code he cannot read. That is the shape `CLAUDE.md`
 * asks of any list inside a guard - the list is written by hand, and the floor under
 * it is a query over the source of truth, in the same commit.
 *
 * <p><b>Read across the two halves of the repo on purpose.</b> `test/serverConfig.test.ts`
 * already reads `deploy/` and `.env.example` from here for the same reason: the fact
 * being held lives on the other side of a boundary the gate runs over anyway.
 */

/** Where the server's own words live. */
const WEB = join(process.cwd(), '..', 'backend', 'src', 'main', 'java', 'com', 'btl', 'portal', 'web')

/**
 * Every reason one route can answer with.
 *
 * A `static final String` and nothing else, so `LOG` and every other constant these
 * classes hold stay out of it without being named.
 */
function reasonsIn(file: string): string[] {
  const java = readFileSync(join(WEB, file), 'utf-8')

  return [...java.matchAll(/static final String \w+ = "([^"]+)";/g)].map((one) => one[1] ?? '')
}

describe('the reasons the server can name', () => {
  const routes: [file: string, screen: Record<string, string>, howMany: number][] = [
    /* The counts are here so that a regular expression which stopped matching cannot
       pass as "this route names nothing". Three, one and three are what the files hold
       today; one more is exactly the event this file exists for, and it arrives as a
       red gate with the number in the message. */
    ['PasswordResetApi.java', WHEN_SETTING_A_PASSWORD, 3],
    ['EmailConfirmationApi.java', WHEN_CONFIRMING_AN_ADDRESS, 1],
    /* The third route, added 21.09.2026 when the registration screen began to send.
       It is the first one here whose refusals do not all arrive under 400: the taken
       address is a 409. That changes nothing in this file, and the reason it does not
       is the point - the gate is over the NAMES a route declares, and a name is what
       the screen looks a sentence up by, whichever number carried it. */
    ['RegistrationApi.java', WHEN_REGISTERING, 3],
  ]

  it.each(routes)('are all answered on the screen that meets %s', (file, screen, howMany) => {
    const reasons = reasonsIn(file)

    expect(reasons, `${file} names no reason at all, so this measures nothing`).toHaveLength(
      howMany,
    )
    expect(reasons.filter((reason) => !Object.hasOwn(screen, reason))).toEqual([])
  })

  it('and the screens claim no reason their route cannot answer', () => {
    /* The other direction, and it is not decoration: a key left behind by a reason the
       server dropped is a sentence in the dictionary that nothing can ever draw, and
       the next reader has no way to tell it from one that is live. */
    const known = new Set(routes.flatMap(([file]) => reasonsIn(file)))
    const claimed = routes.flatMap(([, screen]) => Object.keys(screen))

    expect(claimed.filter((reason) => !known.has(reason))).toEqual([])
  })
})

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESOURCE_NAMES } from '../data/client'
import { ANSWERED_TO_THE_READER } from './theCachesFollowTheReader'

/**
 * THE FLOOR UNDER THE LIST OF NAMES THAT FOLLOW THE READER, which is the backend's own source
 * and not a sentence.
 *
 * <p><b>Why a list needs one.</b> `ANSWERED_TO_THE_READER` is written by hand, and a name that
 * starts to depend on who is asking is a name nobody has to be reminded of: the route changes in
 * Java, the portal keeps drawing, and the fault is the one a review found in `competitors` and
 * `teams` on 02.10.2026 - a tab that holds one reader's answer and draws it to the next. A list
 * that only knows what its author remembered has to be held against something that knows more.
 *
 * <p><b>What is asked, and of what.</b> Every cached name has one route that answers a read at
 * `/api/<name>`. The ones whose handler takes the caller (`@AuthenticationPrincipal`) answer
 * different readers differently, and they must be EXACTLY the names this portal drops when the
 * reader changes, plus the two whose own hooks drop them (`data/useResource.ts`). Both
 * directions, because a name on the list that no route asks the caller about is a request more
 * for every screen of every visit, for nothing.
 *
 * <p><b>Where it stops, said rather than left to be found.</b> It reads the parameter the
 * framework injects the caller through. A route that reached the caller another way (the
 * security context, a header it parsed itself) would not be seen, and there is none today: every
 * route behind a cached name was read for `SecurityContext`, `getUserPrincipal` and
 * `Authentication` on 02.10.2026, and only the four below take the principal at all. The
 * authorisation of a whole route (administration only) is the chain's and is a refusal rather
 * than a different answer, so it is not asked here either.
 */

/**
 * The two names that depend on the reader and are not dropped by the session, because their own
 * hooks are handed the member and drop them themselves (`useInbox`, `useWhatIsWaiting`). Written
 * down because it is a list of exceptions, and held by the case below that reads the hook's
 * source, so one of them losing its drop is a failure here and not a leak somebody finds.
 */
const DROPPED_BY_THEIR_OWN_HOOK = ['inbox', 'me/applications']

const JAVA = join(process.cwd(), '..', 'backend', 'src', 'main', 'java')

function javaUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)

    if (entry.isDirectory()) {
      return javaUnder(at)
    }

    return entry.name.endsWith('.java') ? [readFileSync(at, 'utf-8')] : []
  })
}

/**
 * Every address a read is declared at, with whether the handler under it takes the caller.
 *
 * <p>The signature is what stands between the annotation and the opening brace of the method,
 * and it is cut there rather than at the end of the line, because a handler that takes the
 * response as well puts its parameters on two.
 */
function readsDeclared(): Map<string, boolean> {
  const reads = new Map<string, boolean>()

  for (const code of javaUnder(JAVA)) {
    for (const found of code.matchAll(/@GetMapping\("(\/api\/[^"]*)"\)/g)) {
      const from = (found.index ?? 0) + found[0].length
      const signature = code.slice(from, code.indexOf('{', from))

      reads.set(found[1] ?? '', signature.includes('@AuthenticationPrincipal'))
    }
  }

  return reads
}

describe('the names whose answer depends on who is asking', () => {
  const reads = readsDeclared()
  const askingTheCaller = RESOURCE_NAMES.filter((name) => reads.get(`/api/${name}`) === true)

  it('are exactly the ones the portal drops when the reader changes, and the two its hooks drop', () => {
    expect([...askingTheCaller].sort()).toEqual([...ANSWERED_TO_THE_READER, ...DROPPED_BY_THEIR_OWN_HOOK].sort())
  })

  it('is read off the backend, so the line above is looking at something', () => {
    /* The floor, and it is derived rather than written down: a sweep that has stopped recognising
       the route annotation finds fewer than every cached name, and one that has stopped
       recognising the principal finds none. Both are said here by name and not left to agree
       with an empty list. */
    expect(RESOURCE_NAMES.filter((name) => !reads.has(`/api/${name}`))).toEqual([])
    expect(askingTheCaller.length).toBeGreaterThan(3)
  })

  it('do not include a name the backend answers the same to everybody', () => {
    /* The other direction, on its own so that a name added to the list by mistake fails by its
       own name. Everything on the list asks the caller; nothing is dropped for nothing. */
    expect(ANSWERED_TO_THE_READER.filter((name) => !askingTheCaller.includes(name))).toEqual([])
  })

  it('have their own drop in the hooks that are handed the member', () => {
    const hooks = readFileSync(join(process.cwd(), 'src', 'data', 'useResource.ts'), 'utf-8')

    for (const name of DROPPED_BY_THEIR_OWN_HOOK) {
      expect(hooks).toContain(`clearResourceCache('${name}')`)
    }
  })
})

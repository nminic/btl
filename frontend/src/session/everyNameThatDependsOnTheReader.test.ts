import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
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
 * `/api/<name>`. The ones whose handler asks who is calling answer different readers differently,
 * and they must be EXACTLY the names this portal drops when the reader changes, plus the three
 * whose own hooks drop them (`data/useResource.ts`). Both directions, because a name on the list
 * that no route asks the caller about is a request more for every screen of every visit, for
 * nothing.
 *
 * <p><b>THE TWO WAYS A HANDLER ASKS WHO IS CALLING, and the floor knows both because the Java
 * source declares both (PENDING 28771).</b> Until that finding it knew the first only, and the
 * second was the route it missed:
 * <ol>
 * <li>It takes the caller as a parameter the framework fills in (`@AuthenticationPrincipal`, or
 * a `Principal` or `Authentication`). That is what `CompetitorApi` and five others do.</li>
 * <li>It asks a class that reads the caller off the security context itself. Which classes
 * those are is not written here: it is every class whose code reads
 * `SecurityContextHolder.getContext().getAuthentication()` (today `WhatHeMayDo` alone;
 * `WhoIsAsking` only WRITES the context), and a handler asks one when its body calls a field
 * the class declares with that type, or the class itself. `VerificationApi.verification` takes
 * no parameter at all and answers the queues its caller may work in through
 * `WhatHeMayDo.whichOf`, which the floor of 02.10.2026 could not see, so the one name whose
 * answer differs by RIGHTS and not by identity was never dropped when a moderator signed out.</li>
 * </ol>
 * Comments and the text of strings are not code, so a class that only NAMES the door in its
 * heading (`ModeratorApi`, whose answer is the same to everybody who may read it) is not one
 * that asks it.
 *
 * <p><b>Where it stops, said rather than left to be found.</b> It reads the handler and not what
 * the handler calls: a route that handed the caller to a private method of its own, or got him
 * from the request, would not be seen, and a cached name added behind one would still have to
 * be put on the list by whoever adds it. There is none today. The authorisation of a whole
 * route (administration only) is the chain's and is a refusal rather than a different answer,
 * so it is not asked here either.
 */

/**
 * The three names that depend on the reader and are not dropped by the session, because their own
 * hooks are handed the member and drop them themselves (`useInbox`, `useWhatIsWaiting`,
 * `useMyResultSubmissions`). Written
 * down because it is a list of exceptions, and held by the case below that reads the hook's
 * source, so one of them losing its drop is a failure here and not a leak somebody finds.
 */
const DROPPED_BY_THEIR_OWN_HOOK = ['inbox', 'me/applications', 'me/result-submissions']

const JAVA = join(process.cwd(), '..', 'backend', 'src', 'main', 'java')

function javaUnder(dir: string): { name: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)

    if (entry.isDirectory()) {
      return javaUnder(at)
    }

    return entry.name.endsWith('.java')
      ? [{ name: basename(entry.name, '.java'), code: withoutComments(readFileSync(at, 'utf-8')) }]
      : []
  })
}

/**
 * A Java file as the compiler reads it: without its comments, and with the text of its strings
 * left exactly as it is, so that `"/api/**"` is not taken for the start of one.
 */
function withoutComments(java: string): string {
  return java.replace(
    /"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])'|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g,
    (found) => (found.startsWith('/') ? '' : found),
  )
}

type Source = { name: string; code: string }

/**
 * The classes that read the caller off the security context, which is the one way to reach him
 * that is not a parameter. Derived from what the code does, and never from a name.
 */
function classesThatReadTheCaller(sources: Source[]): string[] {
  return sources
    .filter((one) => /SecurityContextHolder\s*\.getContext\(\)\s*\.getAuthentication\(\)/.test(one.code))
    .map((one) => one.name)
}

type Asking = { byParameter: boolean; byADoor: boolean }

/**
 * Every address a read is declared at, and how the handler under it asks who is calling.
 *
 * <p>The signature is what stands between the annotation and the opening brace of the method,
 * and it is cut there rather than at the end of the line, because a handler that takes the
 * response as well puts its parameters on two. The body is what follows, to the closing brace of
 * the method (the one on the first tab, which is where this codebase puts it).
 */
function readsDeclared(sources: Source[], doors: string[]): Map<string, Asking> {
  const reads = new Map<string, Asking>()

  for (const { name, code } of sources) {
    /* The names this class holds a door under (`private final WhatHeMayDo mayHe;`, and the
       constructor's `WhatHeMayDo mayHe`) and the doors themselves, for a call made on the class. */
    const held =
      doors.length === 0 || doors.includes(name)
        ? []
        : [...code.matchAll(new RegExp(`\\b(?:${doors.join('|')})\\s+(\\w+)\\s*[;,)]`, 'g'))].map(
            (one) => one[1] ?? '',
          )
    const askedThrough = [...held, ...doors]
    const asksADoor = new RegExp(`\\b(?:${askedThrough.join('|')})\\s*\\.\\s*\\w+\\s*\\(`)

    for (const found of code.matchAll(/@GetMapping\("(\/api\/[^"]*)"\)/g)) {
      const from = (found.index ?? 0) + found[0].length
      const opens = code.indexOf('{', from)
      const signature = code.slice(from, opens)
      const closes = code.indexOf('\n\t}', opens)
      const body = code.slice(opens, closes === -1 ? code.length : closes)

      reads.set(found[1] ?? '', {
        byParameter: /@AuthenticationPrincipal|\bPrincipal\s+\w+|\bAuthentication\s+\w+/.test(signature),
        byADoor: askedThrough.length > 0 && asksADoor.test(body),
      })
    }
  }

  return reads
}

describe('the names whose answer depends on who is asking', () => {
  const sources = javaUnder(JAVA)
  const doors = classesThatReadTheCaller(sources)
  const reads = readsDeclared(sources, doors)
  const askingTheCaller = RESOURCE_NAMES.filter((name) => {
    const asks = reads.get(`/api/${name}`)

    return asks !== undefined && (asks.byParameter || asks.byADoor)
  })

  it('are exactly the ones the portal drops when the reader changes, and the ones its hooks drop', () => {
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

  it('is read both ways a handler can ask, so neither sweep is satisfied by finding nothing', () => {
    /* Each way has to find a route of its own. A sweep that stopped recognising a door finds the
       first kind alone and the line above would be satisfied by the list it was given; this fails
       by the way it lost instead. */
    expect(doors.length).toBeGreaterThan(0)
    expect(RESOURCE_NAMES.filter((name) => reads.get(`/api/${name}`)?.byParameter === true).length).toBeGreaterThan(3)
    expect(RESOURCE_NAMES.filter((name) => reads.get(`/api/${name}`)?.byADoor === true).length).toBeGreaterThan(0)
  })

  it('see a route that asks through a door and takes no parameter, which is what the first floor missed', () => {
    /* PENDING 28771, by name: this route asks `WhatHeMayDo.whichOf` and has no `@AuthenticationPrincipal`. */
    expect(reads.get('/api/verification')).toEqual({ byParameter: false, byADoor: true })
    expect(ANSWERED_TO_THE_READER).toContain('verification')
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

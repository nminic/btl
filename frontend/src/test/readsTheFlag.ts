import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES, type ResourceName } from '../data/client'

/**
 * THE FLOOR UNDER WHAT A CHANGE OF `active` DROPS (PENDING 29656), which is the backend's own SQL and
 * not a sentence. Moved here, byte for byte as it was, from `pages/admin/rowMembership.test.tsx` so that
 * the three places that move the flag are held to one reading of the backend and not to one reading
 * each (`pages/admin/whatActiveMoves.ts`).
 *
 * <p><b>Why it is read and not listed.</b> A list of cached names written by hand is a list that only
 * knows what its author remembered; it is held against something that knows more.
 *
 * <p><b>What is asked.</b> Every cached name has one route that answers a read at `/api/<name>`. A name
 * READS THE FLAG when the class that declares that route has a line of SQL, a string literal, that names
 * `active`: a javadoc or a comment line begins with `*` or `/` and is never one.
 *
 * <p><b>Where it stops</b> (unchanged, and not widened here). It reads the class, not the route: a class
 * that declares two routes would lend the flag of one to the other, and none of the names does. It reads
 * source text with a regular expression, so a line of SQL that is not a string literal of its own is not
 * seen, and a name whose route reaches the flag through a view or a function in the database would not
 * be seen; no cached name does.
 */
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

export function namesThatReadTheFlag(): ResourceName[] {
  const sources = javaUnder(JAVA)
  const aLineOfSqlNamingIt = /^\s*(?:\+\s*)?"[^"\n]*\bactive\b[^"\n]*"/m

  return RESOURCE_NAMES.filter((name) =>
    sources.some(
      (code) => code.includes(`@GetMapping("/api/${name}")`) && aLineOfSqlNamingIt.test(code),
    ),
  )
}

/**
 * The one name that reads the flag and is not dropped by a change of it. PENDING 29656 records it as an
 * edge („me/applications čita active samo za moderatorove sopstvene prijave"): it is the reader's own
 * list, dropped by its own hook when the member it is handed changes (`theWaitingNowBelongsTo`), and the
 * moderator's screens hand it no member. Written here so that it is a decision and not a gap, and checked
 * in the other direction too: the day it stops reading the flag this exception is dead and the case fails.
 */
export const READS_THE_FLAG_AND_IS_NOT_DROPPED = 'me/applications'

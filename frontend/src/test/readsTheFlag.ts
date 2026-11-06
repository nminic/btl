import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RESOURCE_NAMES, type ResourceName } from '../data/client'

/**
 * THE FLOOR UNDER WHAT A CHANGE OF WHETHER A MEMBER IS ACTIVE DROPS (PENDING 29656), which is the
 * backend's own code and not a sentence. Moved here, byte for byte as it was, from `pages/admin/rowMembership.test.tsx` so that
 * the three places that move the flag are held to one reading of the backend and not to one reading
 * each (`pages/admin/whatActiveMoves.ts`).
 *
 * <p><b>Why it is read and not listed.</b> A list of cached names written by hand is a list that only
 * knows what its author remembered; it is held against something that knows more.
 *
 * <p><b>What is asked.</b> Every cached name has one route that answers a read at `/api/<name>`. A name
 * READS THE FLAG when the class that declares that route asks whether a member is active: since AF-1
 * (PDL 13.09.2026, „Zastavica „aktivan" prestaje da bude podatak i postaje izvedena") that is a call to
 * `AMemberIsActive.of(`, the one condition every reader is built with and the one an act that moves a
 * membership moves. The column `competitor.active` is gone (V86, AF-2), so a line of SQL naming it can no
 * longer exist and is no longer looked for. A javadoc or a comment line begins with `*` or `/` and is
 * never a call.
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
  const asksWhetherAMemberIsActive = /^[^*/\n]*\bAMemberIsActive\.of\(/m

  return RESOURCE_NAMES.filter((name) =>
    sources.some(
      (code) => code.includes(`@GetMapping("/api/${name}")`) && asksWhetherAMemberIsActive.test(code),
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

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Competitor } from '../data/types'
import { must } from '../test/at'
import { isActiveMember, isActiveMemberOrAdministration } from './activeMemberOrAdministration'

/**
 * WHO THE SCREEN DRAWS THE LIST OF WHO IS GOING FOR: AN ACTIVE MEMBER, OR THE ADMINISTRATION.
 *
 * <p>The two halves are two facts, so they are asked as a grid rather than one at a time: a
 * reader who is the administration and not a member in good standing is the one who tells them
 * apart, and a single question could not.
 *
 * <p><b>The list is the one the server serves</b>, which leaves out whoever's fee has lapsed
 * (`/api/competitors` ends `where c.active`). Read off the generated file and cut the way the
 * server cuts it, so the member this case calls lapsed is one the file really carries: his
 * absence from the served list is then a fact about the fee and not about a number nobody has.
 */
type FileMember = Competitor & { active: boolean }

const file: FileMember[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'competitors.json'), 'utf-8'),
)

const served: Competitor[] = file.filter((one) => one.active)

const ACTIVE = must(served[0], 'a member whose fee is standing').memberNumber

const LAPSED = must(
  file.find((one) => !one.active),
  'a member whose fee has lapsed',
).memberNumber

describe('an active member, or the administration', () => {
  it('reads a member as active only where the served list carries him', () => {
    expect(isActiveMember(ACTIVE, served)).toBe(true)
    /* In the file, and not on the list: the fee and nothing else is why. */
    expect(file.some((one) => one.memberNumber === LAPSED)).toBe(true)
    expect(isActiveMember(LAPSED, served)).toBe(false)
    /* Somebody with no number at all: a moderator who does not race, or somebody who has
       registered and never paid. */
    expect(isActiveMember(null, served)).toBe(false)
  })

  it('lets the administration in whatever its own fee, and a member only where his fee stands', () => {
    /* A member, whose fee is standing, has run out, or who has no number. */
    expect(isActiveMemberOrAdministration('competitor', ACTIVE, served)).toBe(true)
    expect(isActiveMemberOrAdministration('competitor', LAPSED, served)).toBe(false)
    expect(isActiveMemberOrAdministration('competitor', null, served)).toBe(false)

    /* The administration: a moderator who races for nobody, one whose own fee has lapsed, and
       the superadmin. PDL section 18's list, „administracija (moderatori i superadmin)". */
    expect(isActiveMemberOrAdministration('moderator', null, served)).toBe(true)
    expect(isActiveMemberOrAdministration('moderator', LAPSED, served)).toBe(true)
    expect(isActiveMemberOrAdministration('superadmin', null, served)).toBe(true)

    /* And nobody signed in, who has no number to be on any list with. */
    expect(isActiveMemberOrAdministration('visitor', null, served)).toBe(false)
  })
})

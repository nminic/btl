import { describe, expect, it } from 'vitest'
import type { SignedIn } from '../session/context'
import { isActiveMember, isActiveMemberOrAdministration } from './activeMemberOrAdministration'

/**
 * WHO THE SCREEN DRAWS THE LIST OF WHO IS GOING FOR, AND SINCE 03.10.2026 WHO IT LETS INTO A
 * HIDDEN PROFILE: AN ACTIVE MEMBER, OR THE ADMINISTRATION.
 *
 * <p>The two halves are two facts, so they are asked as a grid rather than one at a time: a
 * reader who is the administration and not a member in good standing is the one who tells them
 * apart, and a single question could not.
 *
 * <p><b>THE SESSION IS THE ONE HOME OF „THE READER IS ACTIVE" SINCE 16.10.2026</b> (ADL, „Činjenica
 * „član je aktivan" dobija jedan dom na ekranu"), so the grid is over the people the session can
 * describe, each as `session/context.ts` defines them, and not over a list of members. The list
 * the server serves is no argument of either question: that it is not is the type of the call, and
 * what the screens do when the list and the session disagree is asked of the screens
 * (`pages/profile/hisOwnProfile.test.tsx`, `pages/event/goingToEvent.test.tsx`,
 * `pages/event/commentsAreReadByActiveMembers.test.tsx`).
 */

const STANDING: SignedIn = { as: 'member', memberNumber: '000001', feeStands: true }

/* A member: he has a number, and the flag is what says his fee has run out. */
const LAPSED: SignedIn = { as: 'member', memberNumber: '000032', feeStands: false }

/* Registered and never paid: a record and no number. */
const NEVER_PAID: SignedIn = { as: 'neverPaid', account: 7 }

/* An account the league keeps no record of: what a moderator who races for nobody is. */
const ACCOUNT_ONLY: SignedIn = { as: 'account', account: 8 }

describe('an active member, or the administration', () => {
  it('reads a member as active only where the session says his fee stands', () => {
    expect(isActiveMember(STANDING)).toBe(true)
    expect(isActiveMember(LAPSED)).toBe(false)
  })

  it('reads nobody who is not a member as active: not somebody who never paid, not an account with no record, not nobody', () => {
    expect(isActiveMember(NEVER_PAID)).toBe(false)
    expect(isActiveMember(ACCOUNT_ONLY)).toBe(false)
    expect(isActiveMember(null)).toBe(false)
  })

  it('lets a member in only where his fee stands', () => {
    expect(isActiveMemberOrAdministration('competitor', STANDING)).toBe(true)
    expect(isActiveMemberOrAdministration('competitor', LAPSED)).toBe(false)
    expect(isActiveMemberOrAdministration('competitor', NEVER_PAID)).toBe(false)
    expect(isActiveMemberOrAdministration('competitor', ACCOUNT_ONLY)).toBe(false)
  })

  it('lets the administration in whatever its own fee, and with no number at all', () => {
    /* A moderator who races for nobody, one whose own fee has lapsed, one who has never paid, and
       the superadmin. PDL section 18's list, „administracija (moderatori i superadmin)". */
    expect(isActiveMemberOrAdministration('moderator', ACCOUNT_ONLY)).toBe(true)
    expect(isActiveMemberOrAdministration('moderator', LAPSED)).toBe(true)
    expect(isActiveMemberOrAdministration('moderator', NEVER_PAID)).toBe(true)
    expect(isActiveMemberOrAdministration('moderator', STANDING)).toBe(true)
    expect(isActiveMemberOrAdministration('superadmin', ACCOUNT_ONLY)).toBe(true)
    expect(isActiveMemberOrAdministration('superadmin', null)).toBe(true)
  })

  it('lets nobody signed in in', () => {
    expect(isActiveMemberOrAdministration('visitor', null)).toBe(false)
  })
})

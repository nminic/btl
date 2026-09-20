import { createContext } from 'react'
import type { Moderator } from '../data/types'

/* The roles are final and come from PDL P21 (see ADL A8). Two of them are not
 * here on purpose: a league organiser and a sponsor get their own screens
 * later, and "registered but unpaid" is a state of a competitor, not a role. */
export const ROLES = ['visitor', 'competitor', 'moderator', 'superadmin'] as const

export type Role = (typeof ROLES)[number]

/**
 * A role somebody signed in can be, which is every role but one.
 *
 * „Visitor" is the portal's own word for nobody being signed in: `isMember` below reads
 * it that way, and so does every screen that asks. So it is not an answer `GET /api/me`
 * can carry and mean anything by - the answer only exists for somebody the chain has
 * already let through - and a session that believed it would draw a visitor's header
 * above an account's menu. Measured on 20.09.2026: `{"role":"visitor","account":99}`
 * signed somebody in and named them „Nalog 99".
 *
 * <b>Its boundary, written down rather than left to be found.</b> Nothing stops the
 * SCHEMA from pointing an account's `role_id` at the visitor row - `V6` takes any row of
 * `role` and there is no check narrowing it - so this is the portal refusing an answer
 * the server is not known to be unable to give, rather than a shape the wire guarantees.
 * Refusing is the safe side of that: the portal then treats such an account as nobody,
 * which is what the word says, instead of half signing them in.
 */
export type SignedInRole = Exclude<Role, 'visitor'>

/**
 * The three of them, derived from the four rather than written out beside them.
 *
 * A fifth role added above joins this list on the same line it is added, so a league
 * organiser cannot arrive as a role the portal knows and a session quietly refuses.
 */
export const SIGNED_IN_ROLES: readonly SignedInRole[] = ROLES.flatMap((one) =>
  one === 'visitor' ? [] : [one],
)

export type RoleValue = {
  role: Role
  /**
   * Which moderator is at the keyboard, and null for every other role.
   *
   * The role alone is not enough and never was. What a moderator may do is
   * granular by entity and by action, and the superadmin gives each of them a
   * different set (PDL P21, ADL A8), so "a moderator" is not somebody whose
   * rights can be looked up: the rights belong to a row in the matrix, and
   * without a name there is no row. That gap is why sixteen ticked boxes changed
   * nothing on any screen.
   *
   * The record travels rather than the id, so asking what somebody may do costs
   * no request and cannot answer "still loading" on a screen that has to decide
   * whether to draw itself.
   *
   * <b>A REAL SESSION LEAVES THIS NULL, AND THAT IS A BOUNDARY RATHER THAN A STEP
   * TAKEN.</b> This said „when authentication arrives it is the session that fills this
   * in, and nothing that reads it has to change". Authentication arrived on 20.09.2026
   * and the second half of that is true; the first is not. `GET /api/me` answers a role
   * and an account and no moderator record ({@code MeApi}), so both places that sign
   * somebody in call `become(who.role)` with nothing beside it
   * (`session/useTheServersSession.ts`, `pages/member/SignIn.tsx`).
   *
   * <b>What that costs, measured rather than guessed:</b> a moderator who really signs
   * in holds no rights at all. The matrix is keyed by the record, so with none the
   * answer to every box is false (`pages/admin/rights.ts`), Administracija is not in
   * their navigation (`app/Shell.tsx`, `useNavSections`) and every administrative
   * address sends them to the front page (`pages/admin/Guard.tsx`). They are told
   * nothing, which is the same thing the portal tells a moderator who genuinely holds
   * no right, by the owner's decision of 30.07.2026.
   *
   * <b>A SUPERADMIN IS NOT TOUCHED BY THIS</b>, and that is why it is a boundary and
   * not a hole in the increment: `rights_mode = 'all'` is a fact about the ROLE (`V5`),
   * so `useMay` answers yes without ever looking for a record, and a superadmin signing
   * in against the server reaches the whole of administration.
   *
   * <b>What closes it is not a line here.</b> A moderator's rights belong to a row of
   * the matrix and the portal has no way to ask for that row: it would take a route
   * that answers with the rights of whoever is asking, which is its own increment and
   * its own authorisation. Until then this stays null for a real session, and the
   * development switch is the only thing that fills it (`roles/RoleSwitch.tsx`).
   */
  moderator: Moderator | null
  /** Become somebody: a role, and for a moderator which one of them. */
  become: (role: Role, moderator?: Moderator | null) => void
}

export const RoleContext = createContext<RoleValue | null>(null)

/** Everything a competitor sees, moderators and superadmin see too. */
export function isMember(role: Role): boolean {
  return role !== 'visitor'
}

/**
 * Whether this role belongs in administration at all.
 *
 * The outer door and nothing more. Which screens behind it open is a question
 * about rights, not about the role, and it is asked separately (useMay in
 * src/pages/admin/rights.ts).
 */
export function isStaff(role: Role): boolean {
  return role === 'moderator' || role === 'superadmin'
}

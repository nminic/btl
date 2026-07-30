import { createContext } from 'react'
import type { Moderator } from '../data/types'

/* The roles are final and come from PDL P21 (see ADL A8). Two of them are not
 * here on purpose: a league organiser and a sponsor get their own screens
 * later, and "registered but unpaid" is a state of a competitor, not a role. */
export const ROLES = ['visitor', 'competitor', 'moderator', 'superadmin'] as const

export type Role = (typeof ROLES)[number]

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
   * whether to draw itself. When authentication arrives it is the session that
   * fills this in, and nothing that reads it has to change.
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

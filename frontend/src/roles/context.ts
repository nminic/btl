import { createContext } from 'react'

/* The roles are final and come from PDL P21 (see ADL A8). Two of them are not
 * here on purpose: a league organiser and a sponsor get their own screens
 * later, and "registered but unpaid" is a state of a competitor, not a role. */
export const ROLES = ['visitor', 'competitor', 'moderator', 'superadmin'] as const

export type Role = (typeof ROLES)[number]

export type RoleValue = {
  role: Role
  setRole: (role: Role) => void
}

export const RoleContext = createContext<RoleValue | null>(null)

/** Everything a competitor sees, moderators and superadmin see too. */
export function isMember(role: Role): boolean {
  return role !== 'visitor'
}

export function isStaff(role: Role): boolean {
  return role === 'moderator' || role === 'superadmin'
}

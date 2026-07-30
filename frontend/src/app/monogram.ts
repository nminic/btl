import type { Competitor } from '../data/types'

/** Initials, or the last two digits of the member number until the name loads. */
export function monogramFor(member: Competitor | undefined, memberNumber: string): string {
  if (member === undefined) {
    return memberNumber.slice(-2)
  }

  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase()
}

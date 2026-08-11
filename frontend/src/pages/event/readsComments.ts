import { useRole } from '../../roles/useRole'

/**
 * Whether whoever is at the keyboard reads the comments on an event.
 *
 * Only members do (owner, 11.08.2026): „komentare vide samo prijavljeni članovi
 * BTL. Drugim (posetiocima) se ne prikazuju." What that turns into in code is
 * the role and not the member number, and the difference is not pedantry: a
 * moderator or the superadmin has no member number of their own, and a queue
 * that publishes a comment leads straight to the event to look at it.
 *
 * Written once and read by both screens that show a comment or what the
 * comments add up to, since one of them hiding and the other not is the sort of
 * pair that drifts.
 */
export function useReadsComments(): boolean {
  const { role } = useRole()

  return role !== 'visitor'
}

import type { ReactElement } from 'react'
import { Navigate } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { useRole } from '../../roles/useRole'
import { mayOpen, type Need } from './needs'
import { useMay } from './rights'

/**
 * The door on every administrative screen, and the only one there is.
 *
 * It is fitted by the route table (routeObjects.tsx) rather than by the screens,
 * so a screen cannot be written without one and cannot lose one by being
 * rewritten. In the prototype the role comes from the switch; the server will
 * decide later, and this check is never the boundary that matters.
 *
 * A closed door sends whoever knocked to the front page (owner, 30.07.2026). It
 * used to answer with one of three sentences, one of which named the right to go
 * and ask for. That was the right answer while the navigation named every screen
 * whether or not you could open it; now it names only the screens you can, so
 * anybody who lands here typed the address or followed an old link, and the only
 * thing left to tell them is that there is nothing at it. Naming the right would
 * undo the whole point: a moderator is not to be aware that there are actions
 * nobody gave him.
 *
 * Replaced rather than pushed, so the back button goes where the reader came
 * from instead of back onto the door.
 */
export function Guard({ need, children }: { need: Need; children: ReactElement }) {
  const { locale } = useI18n()
  const { role } = useRole()
  const may = useMay()

  return mayOpen(need, role, may) ? children : <Navigate to={`/${locale}`} replace />
}

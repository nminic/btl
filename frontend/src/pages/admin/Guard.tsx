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
 * rewritten.
 *
 * WHERE THE ROLE IT READS COMES FROM, AND IT IS NOT THE SWITCH ANY MORE. This said „in
 * the prototype the role comes from the switch; the server will decide later", and
 * since 20.09.2026 that is not what happens: a visit asks `GET /api/me` above every
 * screen (session/useTheServersSession.ts) and signing in asks it again
 * (pages/member/SignIn.tsx), and both write the answer through the same `become` the
 * switch calls. Measured by reaching an administrative address on a real superadmin
 * session without touching the control at all. The switch still sets it too, and is
 * never built into production (dev/tools.ts).
 *
 * THIS IS STILL NOT THE BOUNDARY THAT MATTERS, and the reason has changed with it. It
 * was „no authentication yet"; it is now that this hides a SCREEN and nothing else. The
 * server refuses on its own, route by route, whatever the browser drew
 * (`ApiSecurity`: everything not named in `READ_BY_ANYBODY` falls through to
 * `anyRequest().authenticated()`), and what these screens actually draw comes out of
 * `/mock` (data/client.ts), which no chain guards because it is a folder of files.
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

import type { ReactElement } from 'react'
import { Navigate } from 'react-router'
import { Loader } from '../../components/Loader'
import { useI18n } from '../../i18n/useI18n'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
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
 * THIS IS STILL NOT THE BOUNDARY THAT MATTERS, and the reason has changed twice. It was
 * „no authentication yet"; then it was that the screens drew out of a folder of files no
 * chain guards. **Since 21.09.2026 neither is true and the sentence is stronger rather
 * than weaker**: what these screens draw comes out of `/api` (`data/client.ts`), so the
 * chain is in front of every byte of it. The server refuses on its own, route by route,
 * whatever the browser drew - `ApiSecurity` sends everything not named in
 * `READ_BY_ANYBODY` through to `anyRequest().authenticated()`, and a right that is
 * missing is answered 404 rather than 403 (ADL A8), so the door does not even admit it
 * is there. This hides a SCREEN, and that is all it is for.
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
 *
 * AND IT DOES NOT REFUSE ANYBODY BEFORE THE SERVER HAS SAID WHO IS READING (owner,
 * 29.09.2026, chosen between three offered outcomes). Until that day this file read the
 * role at its first paint and acted on it, and at the first paint of a visit the role is
 * the visitor - `app/App.tsx` mounts `RoleProvider` with no prop at all. So loading any
 * administrative address from cold - a new tab, `F5`, a bookmark - threw out the
 * SUPERADMIN, against a server that answered, measured at 0,4 s, 1,2 s and 3 s. The
 * answer landed a moment later and the role was right again, by which time he was on the
 * front page. The price the owner accepted for the repair is the short moment below,
 * with a loading indicator where the screen will be; he refused „remember the last role
 * in the browser", because what the browser says and what the server says can come
 * apart.
 *
 * THE ORDER THESE THREE ARE ASKED IN IS THE SAFETY, AND IT IS A PROPERTY RATHER THAN A
 * PROMISE. Waiting is reachable only on the arm that would REFUSE. So waiting can delay
 * a refusal and can never turn one into an admission - there is no arrangement of the
 * answer that reaches `children` through the middle line. Anyone reading this as a
 * weakened door has it backwards: the door that shipped before this was the weak one, in
 * the other direction, and it was refusing the one man who may open everything.
 *
 * AND OPENING WITHOUT WAITING COSTS NOTHING IN PRODUCTION, which is why the first line
 * is first. The only ways to hold a role before the answer are the development switch,
 * which is never built into production (`dev/tools.ts`), and having just signed in
 * (`pages/member/SignIn.tsx` calls `become` and then navigates) - and that second one is
 * a reader who must not be made to wait for an answer to a question he has just been
 * given. Every other visit arrives here as the visitor and waits.
 */
export function Guard({ need, children }: { need: Need; children: ReactElement }) {
  const { locale } = useI18n()
  const { role } = useRole()
  const may = useMay()
  const { theServerHasAnswered } = useSession()

  if (mayOpen(need, role, may)) {
    return children
  }

  if (!theServerHasAnswered) {
    /* The portal's own indicator and never one written here, which is what keeps it
       announced to a screen reader and still under `prefers-reduced-motion`
       (`components/Loader.tsx`). The full sheet rather than the inline form, because
       what is waiting is the whole screen and there is nothing beside it yet that would
       be worth keeping readable (`components/Resource.tsx` draws the same distinction
       for data). No word of its own: „Učitavanje" is what the portal says everywhere
       else it waits, and a sentence here would be a second way of saying one thing. */
    return <Loader inline={false} />
  }

  return <Navigate to={`/${locale}`} replace />
}

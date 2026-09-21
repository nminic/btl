import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Moderator } from '../data/types'
import { RoleContext, type Role, type RoleValue } from './context'

type Props = {
  initialRole?: Role
  /** Which moderator the visit starts as, where it starts as one at all. */
  initialModerator?: Moderator | null
  children: ReactNode
}

/* WHO IS AT THE KEYBOARD, AND SINCE 20.09.2026 THERE ARE TWO THINGS THAT MAY SAY SO.
 *
 * This said „until real authentication exists, the role is just application state that
 * the developer switch changes", and the first half of that is no longer true: a real
 * session sets it through `become` as well, from `GET /api/me` and from nowhere else
 * (session/useTheServersSession.ts, pages/member/SignIn.tsx). The second half still
 * holds and is why nothing else had to change - screens ask useRole() and never look at
 * a token, so the server simply became one more caller of the function the switch was
 * already calling.
 *
 * The development switch is still here and still sets it. **This said it was because the
 * mock is still on (ADL A50), and that „the day that goes off, the switch goes with
 * it". That day was 21.09.2026 and the switch stayed**, so the reason is corrected here
 * rather than left reading as an instruction: what keeps it is that a real session
 * carries no MEMBER NUMBER, and every screen that draws a member is walked through one.
 * `roles/RoleSwitch.tsx` holds that reason in full.
 *
 * The two are set together and never apart. A role and a moderator that could
 * drift out of step would mean a superadmin carrying somebody else's rights, or
 * a moderator carrying the rights of whoever was chosen before him. */
export function RoleProvider({
  initialRole = 'visitor',
  initialModerator = null,
  children,
}: Props) {
  const [who, setWho] = useState<{ role: Role; moderator: Moderator | null }>({
    role: initialRole,
    moderator: initialModerator,
  })

  const become = useCallback((role: Role, moderator: Moderator | null = null) => {
    setWho({ role, moderator })
  }, [])

  const value = useMemo<RoleValue>(
    () => ({ role: who.role, moderator: who.moderator, become }),
    [who, become],
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

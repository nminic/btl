import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Moderator } from '../data/types'
import { RoleContext, type Role, type RoleValue } from './context'

type Props = {
  initialRole?: Role
  /** Which moderator the visit starts as, where it starts as one at all. */
  initialModerator?: Moderator | null
  children: ReactNode
}

/* Until real authentication exists, the role is just application state that the
 * developer switch changes. When sessions arrive, this provider reads the role
 * from the session and the switch disappears; nothing else has to change,
 * because screens ask useRole() and never look at a token.
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

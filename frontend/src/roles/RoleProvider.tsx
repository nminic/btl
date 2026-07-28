import { useMemo, useState, type ReactNode } from 'react'
import { RoleContext, type Role, type RoleValue } from './context'

type Props = {
  initialRole?: Role
  children: ReactNode
}

/* Until real authentication exists, the role is just application state that the
 * developer switch changes. When sessions arrive, this provider reads the role
 * from the session and the switch disappears; nothing else has to change,
 * because screens ask useRole() and never look at a token. */
export function RoleProvider({ initialRole = 'visitor', children }: Props) {
  const [role, setRole] = useState<Role>(initialRole)
  const value = useMemo<RoleValue>(() => ({ role, setRole }), [role])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

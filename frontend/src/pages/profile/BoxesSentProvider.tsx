import { useMemo, useState, type ReactNode } from 'react'
import { BoxesSentContext } from './finishTheProfile'

/**
 * ONE COUNT OF THE BOXES SENT FOR THE WHOLE VISIT, held around the shell because the shell draws both of
 * the two that must agree: the boxes on „Moji podaci", inside the outlet, and the name of the entry that
 * leads there, in the menu behind the account picture (`finishTheProfile.ts`, `app/AccountMenu.tsx`).
 */
export function BoxesSentProvider({ children }: { children: ReactNode }) {
  const [times, setTimes] = useState(0)
  const boxesSent = useMemo(() => ({ times, sent: () => setTimes((one) => one + 1) }), [times])

  return <BoxesSentContext.Provider value={boxesSent}>{children}</BoxesSentContext.Provider>
}

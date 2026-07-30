import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { devToolsEnabled } from '../dev/tools'
import { ClockContext, realToday, type ClockValue } from './context'

/* Where a moved clock is left so it survives a reload.
 *
 * The session store rather than the local one: it belongs to the tab and dies
 * with it. A date left behind in local storage would still be there in a
 * fortnight, and somebody would spend an afternoon looking at a portal that had
 * quietly moved to October.
 *
 * Only ever touched when the development controls are on (src/dev/tools.ts). In
 * production nothing is written and nothing is read, so a value planted in the
 * store by hand moves nothing.
 */
const KEY = 'btl.simulated-day'

/** A day, only in the shape a day is kept in, or null. Anything else in the
 *  store is somebody else's, or a leftover, and is ignored rather than shown. */
function storedDay(): string | null {
  if (!devToolsEnabled()) {
    return null
  }

  const kept = sessionStorage.getItem(KEY)

  return kept !== null && /^\d{4}-\d{2}-\d{2}$/.test(kept) ? kept : null
}

function keepDay(day: string | null): void {
  if (!devToolsEnabled()) {
    return
  }

  if (day === null) {
    sessionStorage.removeItem(KEY)
    return
  }

  sessionStorage.setItem(KEY, day)
}

/**
 * What day the portal is being read as.
 *
 * Until the switch is touched this is the machine's clock and the provider is
 * doing nothing but handing it on. When authentication and the backend arrive
 * the switch goes away and this stays, because a screen asks what day it is and
 * never asks who told it.
 *
 * The day is read on every draw rather than held, so a visit left open across
 * midnight moves with it; the value is remade only when the day itself changes,
 * so nothing below redraws for a clock that said the same thing twice.
 */
export function ClockProvider({
  /** The day a test starts on. Given, it wins over whatever the tab remembers,
   *  because a test asks for one day and must get that one. */
  simulatedDay = null,
  children,
}: {
  simulatedDay?: string | null
  children: ReactNode
}) {
  const [simulated, setSimulated] = useState<string | null>(simulatedDay ?? storedDay())

  const simulate = useCallback((day: string | null) => {
    /* Kept before the state changes rather than in an effect afterwards: an
       effect would also run on the first draw and write back what it had just
       read, which is how a cleared date comes back on the next reload. */
    keepDay(day)
    setSimulated(day)
  }, [])

  const today = simulated ?? realToday()

  const value = useMemo<ClockValue>(
    () => ({ today, simulated, simulate }),
    [today, simulated, simulate],
  )

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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

/* Reaching the store at all throws where the browser has been told not to keep
 * site data: settings that block it, a sandboxed frame, some private windows.
 * This provider stands above the router and above the only error boundary there
 * is (src/app/Shell.tsx), so a throw here is not a lost date but a blank page. */
function fromStore(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

/**
 * A day out of the store, or nothing.
 *
 * Checked for being a real day rather than for looking like one. The shape
 * alone lets `2026-13-45` through, and a day that is not a day becomes an
 * Invalid Date, which compares false against everything without ever throwing:
 * the parent's signature would stop appearing on the registration form for a
 * competitor under sixteen, and nothing anywhere would say why.
 */
function storedDay(): string | null {
  if (!devToolsEnabled()) {
    return null
  }

  const kept = fromStore()

  if (kept === null) {
    return null
  }

  const day = new Date(`${kept}T00:00:00Z`)

  // Asked before it is written out, because writing out a date that is not one
  // throws rather than answering.
  if (Number.isNaN(day.getTime())) {
    return null
  }

  return day.toISOString().slice(0, 10) === kept ? kept : null
}

function keepDay(day: string | null): void {
  if (!devToolsEnabled()) {
    return
  }

  try {
    if (day === null) {
      sessionStorage.removeItem(KEY)
      return
    }

    sessionStorage.setItem(KEY, day)
  } catch {
    /* The day still moves; it just will not survive a reload. Refusing to move
       it because it cannot be written down would be the worse of the two. */
  }
}

/** How often the real clock is asked whether the day has changed. A minute is
 *  far more often than needed and costs nothing: the day is the same string
 *  almost every time, and React does not redraw for a value that did not
 *  change. */
const TICK = 60_000

/**
 * What day the portal is being read as.
 *
 * Until the switch is touched this is the machine's clock and the provider is
 * doing nothing but handing it on. When authentication and the backend arrive
 * the switch goes away and this stays, because a screen asks what day it is and
 * never asks who told it.
 *
 * The real day is kept in state and looked at again on a timer and whenever the
 * tab comes back into view. It cannot be read during the draw: this provider is
 * mounted once, above everything, and never draws again on its own, so a day
 * read there would be the day the page was opened and would stay that for as
 * long as the tab was left open. Every screen used to read the clock inside its
 * own draw and so moved past midnight for free; that has to go on being true
 * now that they all ask one place. A member who leaves the portal open on the
 * evening of 30 September has to find renewal open when they come back to it.
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
  const [real, setReal] = useState(realToday)

  useEffect(() => {
    const look = () => setReal(realToday())
    /* The timer alone would leave a laptop that slept through the night showing
       yesterday until the next tick; coming back to the tab is when somebody is
       most likely to be looking. */
    const clock = setInterval(look, TICK)
    document.addEventListener('visibilitychange', look)

    return () => {
      clearInterval(clock)
      document.removeEventListener('visibilitychange', look)
    }
  }, [])

  const simulate = useCallback((day: string | null) => {
    /* Kept before the state changes rather than in an effect afterwards: an
       effect would also run on the first draw and write back what it had just
       read, which is how a cleared date comes back on the next reload. */
    keepDay(day)
    setSimulated(day)
  }, [])

  const today = simulated ?? real

  const value = useMemo<ClockValue>(
    () => ({ today, simulated, simulate }),
    [today, simulated, simulate],
  )

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>
}

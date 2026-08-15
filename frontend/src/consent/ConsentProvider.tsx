import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { consentGiven, forget, remember } from './consent'
import { ConsentContext } from './consentContext'

/**
 * Holds the answer for the whole visit, so the bar, the footer and the loader of
 * Google Analytics all read one thing.
 *
 * Read out of the store once, when the tree is built, and kept in state
 * afterwards. Read on every render instead, agreeing would not take the bar off
 * the screen until something else happened to redraw it.
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
  const [agreed, setAgreed] = useState(consentGiven)
  /* Closed for this visit and written down nowhere, which is the difference
     between closing the bar and agreeing to anything. */
  const [closed, setClosed] = useState(false)

  const accept = useCallback(() => {
    remember()
    setAgreed(true)
  }, [])

  const close = useCallback(() => {
    setClosed(true)
  }, [])

  /* Withdrawing puts the question back rather than answering it, because those
     are two different things to the person doing it. What it must never do is
     leave the old yes standing while the bar says the question is open, so the
     record goes at the same moment the state does, and the bar is reopened even
     if it had been closed earlier in this visit. */
  const askAgain = useCallback(() => {
    forget()
    setAgreed(false)
    setClosed(false)
  }, [])

  const value = useMemo(
    () => ({ agreed, asking: !agreed && !closed, accept, close, askAgain }),
    [agreed, closed, accept, close, askAgain],
  )

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}

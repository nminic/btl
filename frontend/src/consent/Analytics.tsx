import { useEffect } from 'react'
import { useToday } from '../clock/useClock'
import { useConsent } from './useConsent'

/**
 * Loads what measures the portal, each under its own rule (ADL A9).
 *
 * Two systems, and the difference between them is the whole of this file.
 *
 * **Umami** is hosted on the league's own server, sets no cookie and builds no
 * profile, so it is not a question anybody has to be asked and it loads for
 * everybody. It is also what keeps the numbers honest: Google Analytics cannot
 * measure without cookies at all, so without Umami everybody who does not agree
 * would be invisible rather than merely unprofiled.
 *
 * **Google Analytics 4** loads only after „Prihvati" has been pressed, and never
 * before. Not hidden, not queued, not loaded-but-idle: the script is not
 * requested, because requesting it is already a request to Google carrying this
 * reader's address.
 *
 * Nothing is loaded at all unless the build was given the ids to load it with.
 * Local development, tests and QA are given none (ADL A9: „lokalno i staging ne
 * šalju podatke"), so the whole of this is inert there, and nobody walking
 * through the portal while it is being built is counted as a visitor.
 */


/**
 * Puts a script in the head under a name, and does nothing if that name is
 * already there.
 *
 * The name is the point. React runs an effect again after any dependency
 * changes, and in development it mounts everything twice on purpose; a script
 * fetched twice is a visit counted twice, and a portal whose own numbers are
 * doubled is worse than one that measures nothing.
 */
function loadOnce(id: string, attributes: Record<string, string>): void {
  if (document.getElementById(id) !== null) {
    return
  }

  const tag = document.createElement('script')

  tag.id = id
  tag.async = true

  for (const [name, value] of Object.entries(attributes)) {
    tag.setAttribute(name, value)
  }

  document.head.append(tag)
}

/**
 * What `gtag` is: a queue Google's own script reads once it arrives.
 *
 * Pushed as a plain array, which is what the official snippet's `arguments`
 * object amounts to. The queue is reached through a typed view of the window
 * rather than by widening the global one: `dataLayer` belongs to a script this
 * portal loads on one condition and usually never loads at all, so it is not a
 * fact about every window in the application. No assertion is involved, which is
 * what ADL A14 asks for.
 */
function push(...args: unknown[]): void {
  const holder: Window & { dataLayer?: unknown[] } = window
  const queue = holder.dataLayer ?? []

  holder.dataLayer = queue
  queue.push(args)
}

export function Analytics() {
  const { agreed } = useConsent()
  /* Read where they are used and not once at the top of the file. Vite replaces
     them at build time, so they cannot change while a page is open, and reading
     them at module level said so; but read there they are also fixed for the
     whole of a test run, and what has to be measured here is exactly the
     difference between a build that was given ids and one that was not. A fact
     that cannot be varied is a fact nothing can check. */
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID
  const umamiSrc = import.meta.env.VITE_UMAMI_SRC
  const umamiSite = import.meta.env.VITE_UMAMI_WEBSITE_ID
  /* The day the portal is being read as, from the one clock it has (ADL A7,
     src/clock). Google's snippet stamps its own `js` command with a date, and
     reading the machine's clock here would make this the second place on the
     portal that knows what day it is; a standing test refuses that by name
     (clock/oneClock.test.ts). */
  const today = useToday()

  /* Umami, for everybody, and only where the build was given a site to report
     to. */
  useEffect(() => {
    if (umamiSrc === undefined || umamiSite === undefined) {
      return
    }

    loadOnce('umami', { src: umamiSrc, 'data-website-id': umamiSite })
  }, [umamiSrc, umamiSite])

  /* Google Analytics, only once somebody has agreed. */
  useEffect(() => {
    if (gaId === undefined) {
      return
    }

    if (!agreed) {
      /* Said out loud rather than left to the absence of the script. A reader
         who agreed, was measured, and then withdrew has Google's script on the
         page already, and silence would let it go on. What withdrawing cannot do
         is undo what was measured before it, and the privacy policy says exactly
         that rather than promising otherwise. */
      push('consent', 'update', { analytics_storage: 'denied' })

      return
    }

    loadOnce('ga4', { src: `https://www.googletagmanager.com/gtag/js?id=${gaId}` })

    push('consent', 'update', { analytics_storage: 'granted' })
    push('js', new Date(today))
    push('config', gaId)
  }, [agreed, today, gaId])

  return null
}

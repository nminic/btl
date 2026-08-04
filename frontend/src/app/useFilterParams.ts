import { useCallback } from 'react'
import { useSearchParams, type SetURLSearchParams } from 'react-router'

/**
 * The address bar as the screens use it: for filters, and never as a new screen.
 *
 * Every filter on the portal writes itself into the query, so it can be shared
 * and so the browser's own back button walks it. To the router each of those is
 * a navigation like any other, and a navigation puts the reader at the top of
 * the page. Without this, choosing a season threw the reader up the page, and the
 * row of six lengths on a profile did it on every press: the very fault the
 * scroll handling exists to fix, moved from one control to another.
 *
 * It was answered before by keying the saved scroll positions on the path alone,
 * so a filter change found its own screen's position waiting and put it back.
 * That worked for filters and cost something else: a screen opened again from
 * the navigation also found a position waiting, so pressing "Kalendar" landed
 * halfway down the calendar rather than at its top.
 *
 * `preventScrollReset` says the one thing that is actually true here: this
 * navigation is not an arrival. The saved positions can then be kept per history
 * entry, which is what makes going back land exactly where it left (owner,
 * 04.08.2026).
 *
 * Every screen that writes a filter goes through here, and a test reads the
 * source to say so (src/app/filterParams.test.ts): one call to `useSearchParams`
 * left outside is one control that still jumps, and it is not visible from
 * anywhere except the screen it is on.
 */
export function useFilterParams(): [URLSearchParams, SetURLSearchParams] {
  const [params, setParams] = useSearchParams()

  const write = useCallback<SetURLSearchParams>(
    (next, options) => {
      /* Spread first, so a caller that asks for `replace` still gets it: the
         list of events replaces its own entry rather than stacking one per
         edit. */
      setParams(next, { ...options, preventScrollReset: true })
    },
    [setParams],
  )

  return [params, write]
}

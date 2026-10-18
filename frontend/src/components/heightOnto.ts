import { useLayoutEffect, type RefObject } from 'react'

/**
 * WRITES ONE ELEMENT'S HEIGHT ONTO ANOTHER AS A CUSTOM PROPERTY, and keeps it written while the
 * first one changes size.
 *
 * <p>For a size the stylesheet cannot work out on its own: the payment slip's code may be no taller
 * than the column of details beside it (PDL P8, owner, 18.10.2026: „A QR kod ne treba da pređe
 * vertikalnu visinu stupca teksta sa leve strane u Uplatnici"), and a grid cannot size a track's
 * WIDTH off the height of the row it stands in. So the height is read where the browser has laid it
 * out and handed to the sheet, which decides what to do with it at which width (`Member.css`); the
 * component says nothing about breakpoints.
 *
 * <p><b>The shape is `components/growing.ts`'s `useColumns`</b>: read once by hand, then watched,
 * and nothing at all where there is no layout to read - jsdom has no `ResizeObserver` and lays out
 * nothing, and the property is then simply absent, which the sheet answers with its own fallback.
 *
 * <p><b>The name comes first</b>, so it is written at the call as `'--name',` - the shape
 * `styles/hooks.test.ts` reads as a property being set, which is how that guard knows the sheet's
 * `var(--name)` has somebody setting it.
 *
 * @param property the custom property's name, with its two dashes
 * @param of       the element whose height is read
 * @param onto     the element the property is written on
 */
export function useHeightOnto(
  property: string,
  of: RefObject<HTMLElement | null>,
  onto: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const source = of.current
    const target = onto.current

    if (source === null || target === null || typeof ResizeObserver === 'undefined') {
      return
    }

    /* Named here rather than read off the refs inside, so what is measured is the element the
       effect was set up for and TypeScript can see it is one (`useColumns`'s own reason). */
    const measured: HTMLElement = source
    const written: HTMLElement = target

    function write() {
      written.style.setProperty(property, `${measured.getBoundingClientRect().height}px`)
    }

    write()

    const watching = new ResizeObserver(write)
    watching.observe(measured)

    return () => {
      watching.disconnect()
    }
  }, [property, of, onto])
}

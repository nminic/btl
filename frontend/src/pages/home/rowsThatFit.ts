import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * HOW MANY RACES „Priprema, pozor, SAD!" SHOWS (PDL P24, variant A, owner 18.11.2026).
 *
 * „Kad nema aktivnog sponzora, „Priprema, pozor, SAD!” prikazuje onoliko trka koliko stane do dna, a
 * kad sponzor postoji prikazuje četiri; kolone su uvek poravnate." And on a telephone: „Broj trka u
 * „Priprema, pozor, SAD!” na telefonu je isti kao na desktopu: četiri kad postoji aktivan sponzor, a
 * bez sponzora isti broj koji izračuna desktop (oko devet)."
 */

/** With a sponsor, on every width. */
export const WITH_A_SPONSOR = 4

/**
 * Without a sponsor, wherever there is no bottom to fill to: one column (a telephone, a tablet), jsdom,
 * and the first drawing before anything has been measured.
 *
 * It is the number the two columns measure where the page has stopped growing, so that a telephone
 * shows what a desktop does („isti broj koji izračuna desktop"). The column of the page is at most
 * 1100px wide (`app/Shell.css`), which it reaches at a window of about 1115px with the scrollbar, and
 * from there on the left column, and so the bottom, no longer moves.
 *
 * Measured in Chrome on the built bundle, 20.11.2026, with the sample data and no sponsor: at 1115,
 * 1280 and 1440 the list is 454,88px tall under rows of 49,80px, which is nine whole rows and 6,70px
 * over. Narrower, the address of the president wraps longer and the desktop counts more or as many:
 * nine at 860, 900 and 1024, ten at 960 and 1000. Measure it again if the left column ever changes.
 */
export const FITS_WITHOUT_A_SPONSOR = 9

/**
 * Where the front page stands in two columns: „Podela važi od 860px" (PDL P24). It is the query
 * `Home.css` splits the page at, and a case holds the two to each other (`homeLayoutStyle.test.ts`).
 */
export const TWO_COLUMNS = '(min-width: 53.75em)'

/**
 * The number of races, given the list they stand in.
 *
 * With a sponsor it is four and nothing is measured. Without one, in two columns, the list is as tall
 * as the column beside it leaves it (`Home.css` takes its own height out of the reckoning with
 * `contain: size`, so the rows drawn in it never make it taller), and the answer is how many whole rows
 * stand in that height. A row cut in half is not shown: it would be a race whose name is half there.
 *
 * In one column there is no bottom to fill to, and the list is as tall as its own rows: counting them
 * would only count what was drawn. So there the answer is the number above, and the query is asked
 * every time, so that a window narrowed across 860px goes back to it.
 *
 * At least one, so that a column squeezed for a moment never empties the list: a list with no rows
 * would say „nothing ahead" over races there are, and would have no row left to measure when the
 * column is given its room back. The height of a row is read off the rows drawn. The shape of reading
 * is `components/growing.ts`'s `useColumns`: once by hand, then watched, and nothing at all where
 * there is no layout to read.
 *
 * @param list    the list of races, which is what is measured
 * @param filling whether there is no sponsor, so that the list fills the column
 */
export function useRowsThatFit(list: RefObject<HTMLElement | null>, filling: boolean): number {
  const [rows, setRows] = useState(FITS_WITHOUT_A_SPONSOR)

  useLayoutEffect(() => {
    const at = list.current

    if (!filling || at === null || typeof ResizeObserver === 'undefined') {
      return
    }

    /* Named here rather than read off the ref inside, so what is measured is the element the effect
       was set up for (`useColumns`'s own reason). */
    const room: HTMLElement = at

    function count() {
      if (!window.matchMedia(TWO_COLUMNS).matches) {
        setRows(FITS_WITHOUT_A_SPONSOR)
        return
      }

      /* The rows are of one height (a name never wraps, `.extract__name`), so the tallest of them is
         the height of any. */
      const row = Math.max(0, ...[...room.children].map((one) => one.getBoundingClientRect().height))

      /* Nothing laid out yet: the number stands where it was. */
      if (row === 0) {
        return
      }

      setRows(Math.max(1, Math.floor(room.getBoundingClientRect().height / row)))
    }

    count()

    const watching = new ResizeObserver(count)
    watching.observe(room)

    return () => {
      watching.disconnect()
    }
  }, [list, filling])

  return filling ? rows : WITH_A_SPONSOR
}

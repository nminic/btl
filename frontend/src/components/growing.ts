import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * A long list that grows as it is read (owner, 11.08.2026).
 *
 * The owner asked for scrolling rather than pages, and named the two lists it
 * is for: the comments under an event, ten before the first refill, and the
 * ducats on a profile, five rows. Pages were the decision that morning and were
 * withdrawn the same day.
 *
 * **Scrolling is not the only way in, and cannot be.** A keyboard has no scroll
 * position of its own, and a reader who tabs through a page never fires the
 * observer at all, so the button is the mechanism and the observer is a
 * convenience laid over it. What the observer does is press the button when the
 * foot of the list comes into view; everything else, including the whole of
 * what a test can see, goes through the button.
 *
 * Three things it has to say out loud, none of which a scrolling list says by
 * itself: that more arrived (a status message, WCAG 2.2 SC 4.1.3), how much is
 * left, and that there is nothing more. A list that simply stops has not told
 * anybody whether it ended or broke.
 */

export function useGrowing(total: number, step: number) {
  const [shown, setShown] = useState(step)
  /* Nothing is announced until somebody has asked for more: the first ten
     arrived with the page, and a status message on load is a message about
     nothing.
   *
   * Remembered as the length the asking was about, not as a yes. A list can
   * become whole two ways, and only one of them is the reader reaching the end:
   * the other is the list shrinking under them. On the results of a profile,
   * which is the first caller with a filter over it, narrowing to marathons
   * made the list whole and `LoadMore` moved the focus to the closing sentence,
   * so pressing a filter threw the reader from the row of filters to the foot of
   * the table (WCAG 2.2 SC 3.2.2 and 2.4.3). Asking is about the list as it was;
   * a different list has not been asked about. */
  const [askedAbout, setAskedAbout] = useState<number | null>(null)
  const asked = askedAbout === total

  /* Never more than there is, and never less than a step.
   *
   * Less than there is, because the list shrinks under the reader as well as
   * growing: a filter narrows it, a moderator takes a comment down. Grown to
   * thirty and then handed four, this has to be four and not four followed by
   * twenty six of nothing.
   *
   * Less than a step, because the step itself arrives late. The ducats are
   * counted in rows, and how many stand across is measured off the grid one
   * render after the first (`useColumns`): the state was seeded with the step
   * as it was then, which is one column, so five rows of six was permanently
   * five ducats. What is held here is the step as it is now. */
  const room = Math.min(Math.max(shown, step), total)

  return {
    shown: room,
    /** Whether everything there is is on screen. */
    whole: room >= total,
    asked,
    /* Made once, because the observer that watches the foot of the list is torn
       down and set up again whenever this changes, and an observer created over
       a foot already in view fires at once: a fresh one per render turned
       "a page at a time" into the whole list in a burst. */
    more: useCallback(() => {
      setShown((was) => was + step)
      setAskedAbout(total)
    }, [step, total]),
  }
}

/**
 * How many things stand across one row of a grid, so a list can be shown by
 * rows rather than by count.
 *
 * The owner asked for the ducats five rows at a time (11.08.2026), and a row is
 * not a number: the wall is `repeat(auto-fill, ...)`, so it is six across on a
 * desktop and two on a telephone. Counted off the grid the browser worked out,
 * which is the only place the answer exists.
 *
 * `fallback` is what it answers where there is no layout to read: jsdom
 * computes none, and neither does the first render before the element is in the
 * document. One column, so a list that cannot measure itself shows the fewest
 * rows rather than the most.
 */
export function useColumns(of: RefObject<HTMLElement | null>, fallback = 1): number {
  const [columns, setColumns] = useState(fallback)

  useEffect(() => {
    const at = of.current

    if (at === null || typeof ResizeObserver === 'undefined') {
      return
    }

    /* Named here rather than read off the ref inside, so what is measured is
       the element the effect was set up for and TypeScript can see it is one. */
    const wall: HTMLElement = at

    function count() {
      const drawn = getComputedStyle(wall).gridTemplateColumns

      /* "none" is what a grid that has not been laid out answers, and an empty
         string is what jsdom answers. Both mean the same thing here: nothing to
         count, so the number stands where it was. */
      const tracks = drawn.split(' ').filter((one) => one !== '' && one !== 'none')

      if (tracks.length > 0) {
        setColumns(tracks.length)
      }
    }

    count()

    /* And again when the window changes: a list showing five rows at six across
       is showing two and a half rows at twelve across, and turning a telephone
       sideways is exactly that. */
    const watching = new ResizeObserver(count)
    watching.observe(wall)

    return () => {
      watching.disconnect()
    }
  }, [of])

  return columns
}


import { render } from '@testing-library/react'
import { useLayoutEffect, type RefObject } from 'react'
import { describe, expect, it } from 'vitest'
import { EndsTheVisit } from './EndsTheVisit'

/**
 * THE END OF A VISIT is said once, in the commit that takes the form off the screen, and by nothing
 * else (review of PR 483, round 2, finding V1; `AdminEvents.tsx`, `visits`).
 *
 * <p>The cases of `racesWait.test.tsx` hold what a press does with the number. These hold the number:
 * that it does not move while the form is on the screen, that it moves when the form leaves, and that
 * it has moved by the time anything beside the form has seen the form go. The third is the one a
 * passive effect would lose, and no answer from a server can be placed in the task it loses by, so
 * it is asked of what stands beside the form instead.
 */
describe('the end of a visit', () => {
  /** A number handed down the way the screen hands it. */
  const aNumber = (): RefObject<number> => ({ current: 0 })

  it('does not move the number while the form is on the screen, however often it is drawn', () => {
    const visits = aNumber()
    const { rerender } = render(<EndsTheVisit visits={visits} />)

    rerender(<EndsTheVisit visits={visits} />)
    rerender(<EndsTheVisit visits={visits} />)

    expect(visits.current).toBe(0)
  })

  it('moves the number once, by one, when the form leaves the screen', () => {
    const visits = aNumber()
    const { unmount } = render(<EndsTheVisit visits={visits} />)

    unmount()

    expect(visits.current).toBe(1)
  })

  it('has moved the number by the time what stands beside the form is told the form is going', () => {
    const visits = aNumber()
    let seen: number | null = null

    /* Drawn after the form, so the order of the cleanups of a subtree that is taken off is the order
       it was drawn in: the form's own first, and this one with the number it left behind. */
    function Beside() {
      useLayoutEffect(
        () => () => {
          seen = visits.current
        },
        [],
      )

      return null
    }

    const { unmount } = render(
      <>
        <EndsTheVisit visits={visits} />
        <Beside />
      </>,
    )

    unmount()

    expect(seen).toBe(1)
  })
})

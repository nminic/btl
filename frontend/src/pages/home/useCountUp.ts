import { useEffect, useState } from 'react'

const DURATION_MS = 900

/**
 * Unrolls a number from zero to its value, which is the one flourish the owner
 * asked for by name on the front page counters.
 *
 * Anyone who has asked their system for less motion gets the number straight
 * away; an animation nobody wants is worse than none.
 *
 * How long it takes can be set, and only a test ever sets it. Six counters
 * unrolling over nine hundred milliseconds of real time made the one test in
 * the suite that waits on a clock, and under load it was the one that failed
 * while everything it was checking was correct. The turning chart on this same
 * page already takes its interval the same way.
 */
export function useCountUp(target: number, durationMs = DURATION_MS): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (durationMs === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }

    let frame = 0
    const started = performance.now()

    // A tab that is not being drawn gets no frames at all, so the number would
    // sit at zero until the visitor looked at it. This lands it regardless.
    const failsafe = setTimeout(() => setValue(target), durationMs)

    const step = (now: number) => {
      const passed = Math.min(1, (now - started) / durationMs)
      // Fast at first, slow at the end, so the last digits are readable.
      setValue(target * (1 - (1 - passed) ** 3))

      if (passed < 1) {
        frame = requestAnimationFrame(step)
      }
    }

    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(failsafe)
    }
  }, [target, durationMs])

  return value
}

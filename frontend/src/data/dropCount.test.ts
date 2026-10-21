import { describe, expect, it, vi } from 'vitest'
import { clearResourceCache, RESOURCE_NAMES, timesDropped, watchTheDrops } from './client'

/**
 * HOW MANY TIMES A NAME WAS DROPPED, AND WHO IS TOLD (PENDING 29561).
 *
 * <p>The count is what a mounted reader puts into its `revision` to read again once something dropped
 * its name (`data/useResource.ts`, `useHowManyTimesDropped`). What a reader does with it is held where
 * it is read (`app/headerCounterFollowsTheQueue.test.tsx`); what is held here is the count itself.
 */
describe('the count of drops', () => {
  it('is nought for a name nothing has dropped since this module was loaded', async () => {
    /* `test/setup.ts` drops everything before every case, so the module this file imported has no
       such name. A fresh copy of it has, and it is the one that answers the fallback. */
    vi.resetModules()

    const fresh = await import('./client')

    for (const name of RESOURCE_NAMES) {
      expect(fresh.timesDropped(name), `${name} was counted before anybody dropped it`).toBe(0)
    }
  })

  it('goes up by one for the name that was dropped and for no other', () => {
    const before = RESOURCE_NAMES.map((name) => timesDropped(name))

    clearResourceCache('places')

    expect(RESOURCE_NAMES.map((name) => timesDropped(name))).toEqual(
      RESOURCE_NAMES.map((name, index) => (before[index] ?? 0) + (name === 'places' ? 1 : 0)),
    )
  })

  it('goes up by one for every name on a full clear, and for the name alone on a narrowed one', () => {
    const before = RESOURCE_NAMES.map((name) => timesDropped(name))

    clearResourceCache()

    expect(RESOURCE_NAMES.map((name) => timesDropped(name))).toEqual(before.map((one) => one + 1))

    clearResourceCache('pages', 'en')

    expect(timesDropped('pages')).toBe((before[RESOURCE_NAMES.indexOf('pages')] ?? 0) + 2)
    expect(timesDropped('places')).toBe((before[RESOURCE_NAMES.indexOf('places')] ?? 0) + 1)
  })

  it('tells whoever watches after the drop, once per drop, and nobody after they stop', () => {
    const told = vi.fn()
    const stop = watchTheDrops(told)

    clearResourceCache('places')
    clearResourceCache()

    expect(told).toHaveBeenCalledTimes(2)

    stop()
    clearResourceCache('places')

    expect(told).toHaveBeenCalledTimes(2)
  })

  it('is already counted when the watcher is told', () => {
    const seen: number[] = []
    const stop = watchTheDrops(() => {
      seen.push(timesDropped('places'))
    })
    const before = timesDropped('places')

    clearResourceCache('places')
    stop()

    expect(seen).toEqual([before + 1])
  })
})

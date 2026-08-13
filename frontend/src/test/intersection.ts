/**
 * What an `IntersectionObserver` hands its callback, for the two tests that call
 * one by hand.
 *
 * jsdom has no observer at all, so the list that grows on a scroll and the
 * rulebook's contents both install a fake one and then call the callback
 * themselves. They did it with `[{ isIntersecting }] as unknown as
 * IntersectionObserverEntry[]` and `null as never`, and `as unknown as` is the
 * assertion that has stopped even pretending (ADL A14).
 *
 * The whole shape is written out here instead. Nothing is claimed: an entry is
 * an entry and an observer is an observer, and the compiler is what says so. It
 * also keeps the two tests honest about what a real entry carries, so code that
 * starts reading `intersectionRatio` finds a number rather than nothing.
 */
export function intersecting(of: {
  isIntersecting: boolean
  target?: Element
}): IntersectionObserverEntry {
  const target = of.target ?? document.createElement('div')
  const box = target.getBoundingClientRect()

  return {
    boundingClientRect: box,
    intersectionRatio: of.isIntersecting ? 1 : 0,
    intersectionRect: box,
    isIntersecting: of.isIntersecting,
    /* Null is what a browser sends where the root is the viewport and the
       document is not being laid out, which is every moment of a test. */
    rootBounds: null,
    target,
    time: 0,
  }
}

/** The observer handed to the callback beside the entries. Nothing on the portal
 *  reads it, and it has to be one all the same. */
export function watcher(): IntersectionObserver {
  return {
    root: null,
    rootMargin: '',
    scrollMargin: '',
    thresholds: [],
    disconnect: () => {},
    observe: () => {},
    takeRecords: () => [],
    unobserve: () => {},
  }
}

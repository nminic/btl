/**
 * `window.matchMedia`, answering whatever a test needs it to answer.
 *
 * jsdom has no media queries at all, so every screen that asks whether less
 * motion was requested has to be handed one. The three tests that do it wrote
 * `{ matches, media } as typeof matchMedia`, which is the assertion ADL A14
 * bans, and it was covering something real: a `MediaQueryList` is also what a
 * component subscribes to, so a stub with no `addEventListener` on it is a stub
 * that throws the day a component starts listening rather than only asking.
 *
 * Written out in full here instead, once. Nothing is asserted: the object is a
 * whole `MediaQueryList`, and the compiler is the one saying so.
 */
export function matchingMedia(matches: (query: string) => boolean): typeof window.matchMedia {
  return (query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    /* The two the standard has deprecated and jsdom still declares. */
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  })
}

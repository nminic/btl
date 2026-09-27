/**
 * That a confirmation actually stands where a sighted reader can see it, and not only
 * in the accessibility tree.
 *
 * `.toBeVisible()` cannot tell that apart from the fault it is used to catch: jsdom
 * applies no stylesheet at all (ADL A33), so `index.css`'s own `.visually-hidden` rule
 * - the one that clips a paragraph to a pixel - never reaches a component test, and
 * the assertion reads `true` regardless of which class sits on the element (measured
 * on PR 385: the class renamed to `member__note` in the markup with nothing else
 * touched, and three `toBeVisible()` calls stayed green). The class itself is
 * something jsdom tracks exactly, because it is an attribute and not a computed
 * style, so that is what is asked here instead.
 *
 * Lifted out of `pages/memberFlows.test.tsx` on 27.09.2026, the day a second reader
 * needed it (`components/CopyField.test.tsx`), so the question „is this visible" has
 * one answer rather than a copy that could drift from it.
 */
export function expectSeen(said: HTMLElement): void {
  expect(said).not.toHaveClass('visually-hidden')
  expect(said).toHaveClass('member__note')
}

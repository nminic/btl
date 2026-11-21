/**
 * WHERE THE FOCUS WAS IN THE FRONT PAGE, kept across the width where the widgets are written again
 * (`useTwoColumns`; owner, 21.11.2026, accepting that a chosen length and the turning chart go back to their
 * beginning, and nothing else).
 *
 * A widget that is mounted again is a new element, and the focus that was in the old one is gone to the
 * document. **What is kept is WHAT it was on, never WHERE in the list it stood** (review, 21.11.2026: with
 * „Ultra" chosen the third link of the calendar was a race of that length, and after the filter went back to
 * „Sve" the third link was another race, so Enter opened one the reader had not chosen, with no sign of it).
 * What a thing is: its kind, where it leads, what it is called and what it says. If the same thing is in the
 * new element the focus goes to it. If it is not, the focus goes to the heading of that widget (given
 * `tabindex="-1"` here, as `main` has it), which says where the reader is and opens nothing. It never goes to
 * a thing that has only the same number of place, and never to the first thing of the box.
 *
 * The calculator is not asked about: it is not mounted again at all (`Home.tsx`, `held`).
 */
export type Remembered = {
  /** Which box of the page: `home__<box>`. */
  box: string
  /** The id of the heading of the section it stood in, where the section has one: what to fall back on. */
  heading: string | null
  /** What the thing was, by `identity`. */
  identity: string
}

const BOXES = ['boards', 'figures', 'chart', 'next', 'address', 'sponsor']
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** The kind of the thing, where it leads, what it is called to a reader and what it says. */
function identityOf(element: Element): string {
  return [
    element.tagName,
    element.getAttribute('href') ?? '',
    element.getAttribute('aria-label') ?? '',
    (element.textContent ?? '').trim(),
  ].join('|')
}

/** Where an element that has just got the focus is, or nothing where it is in no box that is written again. */
export function whereIs(element: Element): Remembered | null {
  const box = element.closest(BOXES.map((name) => `.home__${name}`).join(', '))
  const name = BOXES.find((one) => box?.classList.contains(`home__${one}`))

  if (box === null || name === undefined) {
    return null
  }

  return {
    box: name,
    heading: element.closest('section[aria-labelledby]')?.getAttribute('aria-labelledby') ?? null,
    identity: identityOf(element),
  }
}

/**
 * Puts the focus back, if the document has lost it: on the same thing if it is in the new widget, and
 * otherwise on the heading of the widget, or on the box where the widget has none.
 */
export function putBack(root: Document, was: Remembered | null): void {
  if (was === null || (root.activeElement !== null && root.activeElement !== root.body)) {
    return
  }

  const box = root.querySelector(`.home__${was.box}`)
  const heading = was.heading === null ? null : root.getElementById(was.heading)
  const scope = heading?.closest('section') ?? box

  const same = [...(scope?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].find(
    (one) => identityOf(one) === was.identity,
  )

  if (same !== undefined) {
    same.focus()

    return
  }

  const fallback = heading ?? box

  if (fallback instanceof HTMLElement) {
    fallback.tabIndex = -1
    fallback.focus()
  }
}

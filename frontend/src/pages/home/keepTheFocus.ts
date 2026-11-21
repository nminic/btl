/**
 * WHERE THE FOCUS WAS IN THE FRONT PAGE, kept across the width where the widgets are written again
 * (`useTwoColumns`; owner, 21.11.2026, accepting that a chosen length and the turning chart go back to their
 * beginning, and nothing else).
 *
 * A widget that is mounted again is a new element, and the focus that was in the old one is gone to the
 * document. What is kept is where it was: which box of the page and which of the things that can be focused
 * inside it, and it is put on the same one in the new element. The calculator is not asked about: it is not
 * mounted again at all (`Home.tsx`, `held`).
 */
export type Remembered = { box: string; index: number }

const BOXES = ['boards', 'figures', 'chart', 'next', 'address', 'sponsor']
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

function boxOf(element: Element): Element | null {
  return element.closest(BOXES.map((name) => `.home__${name}`).join(', '))
}

/** Where an element that has just got the focus is, or nothing where it is in no box that is written again. */
export function whereIs(element: Element): Remembered | null {
  const box = boxOf(element)
  const name = BOXES.find((one) => box?.classList.contains(`home__${one}`))

  if (box === null || name === undefined) {
    return null
  }

  return { box: name, index: [...box.querySelectorAll(FOCUSABLE)].indexOf(element) }
}

/** Puts the focus back where it was, if the document has lost it, on the same place or else the first one. */
export function putBack(root: ParentNode, was: Remembered | null): void {
  if (was === null || (document.activeElement !== null && document.activeElement !== document.body)) {
    return
  }

  const things = [...(root.querySelector(`.home__${was.box}`)?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]

  const target = things[was.index] ?? things[0]

  target?.focus()
}

import { screen } from '@testing-library/react'

/** Named to somebody working by ear, however the naming is done. */
const NAMED = ['alt', 'aria-label', 'aria-labelledby', 'placeholder', 'title'] as const

/** Something a reader can put the keyboard on, whether or not it says anything. */
const REACHED = 'a[href], button, input, select, textarea, [tabindex]'

/**
 * The first thing a reader meets in the main region, whatever it is written in.
 *
 * **Not a list of element names, and not a list of two ways of naming either.**
 * Three drafts were narrower than the fact they measure. The first asked for
 * headings, prose and form controls, so a link over the heading passed. The second
 * added links, images, list items and tables, and a plain `span` passed. The third
 * asked the document but recognised only a text node and `aria-label`, so a picture
 * with an `alt`, a label held elsewhere through `aria-labelledby`, and an inline
 * `svg` all walked past; the last of those because `instanceof HTMLElement` is false
 * for `SVGElement` (review, 04.09.2026).
 *
 * So: the first text anybody can read, the first thing named by any of the ways a
 * thing is named, or the first thing the keyboard can reach. What is hidden from
 * assistive technology is skipped, which is how the monogram over a profile name
 * stays out of it (owner, 23.08.2026).
 */
export function firstMet(): Node | null {
  const main = screen.getByRole('main')
  const walk = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)

  for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
    const holder = node instanceof Element ? node : node.parentElement

    if (holder === null || holder.closest('[aria-hidden="true"], [hidden]') !== null) {
      continue
    }

    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '') {
      return node
    }

    if (
      node instanceof Element &&
      (NAMED.some((one) => node.hasAttribute(one)) || node.matches(REACHED))
    ) {
      return node
    }
  }

  return null
}

/**
 * Whether the page begins with the heading it was opened for.
 *
 * **Inside the heading, or holding it.** A wrapper that carries a name of its own is
 * met before the heading in document order but stands around it, not in front of it:
 * a form is named through `aria-labelledby`, and reading that as „something before
 * the heading" failed every screen at once (measured 04.09.2026). What is in front of
 * the heading is what the heading neither contains nor sits inside.
 */
export function beginsWith(heading: Element): boolean {
  const met = firstMet()

  return met !== null && (heading.contains(met) || met.contains(heading))
}

/** What was met, in a few words, for the message of a failing assertion. */
export function metSaid(): string {
  return firstMet()?.textContent?.trim().slice(0, 40) ?? '(ništa)'
}

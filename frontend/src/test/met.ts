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
export function firstMet(heading?: Element): Node | null {
  const main = screen.getByRole('main')
  const walk = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)

  for (let node = walk.nextNode(); node !== null; node = walk.nextNode()) {
    const holder = node instanceof Element ? node : node.parentElement

    if (holder === null || holder.closest('[aria-hidden="true"], [hidden]') !== null) {
      continue
    }

    /* A wrapper stands **around** the heading, not in front of it, so it is walked
       through rather than counted. Counted instead, it ended the walk at the first
       named box and never looked inside: a `section` given a name through
       `aria-labelledby` is a shape this portal uses on seven screens, and with it
       the whole question could be turned off by naming the box that holds the
       heading. Worse, it was already off: `FormRenderer` names the `form` that way,
       so on all three screens this was written for the walk stopped at the form and
       proved only that the form came first (review, 04.09.2026). */
    if (heading !== undefined && node instanceof Element && node.contains(heading)) {
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
 * Everything that holds the heading is walked through; the first thing that does not
 * hold it has to be the heading itself or something inside it.
 */
export function beginsWith(heading: Element): boolean {
  const met = firstMet(heading)

  return met !== null && heading.contains(met)
}

/** What was met, in a few words, for the message of a failing assertion. */
export function metSaid(heading?: Element): string {
  return firstMet(heading)?.textContent?.trim().slice(0, 40) ?? '(ništa)'
}

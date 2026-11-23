import { everyOneNamedExactly } from '../../forms/exactName'
import type { Suggestion } from '../../forms/types'

/*
 * WHAT THE BOX OF A MEMBER ON A ROW OF RESULTS OFFERS, AND WHERE ITS LIST STANDS (`MemberChoice.tsx`).
 *
 * Owner, 23.11.2026 (PDL „Tri brze izmene administracije”), after PR 800 gave the box the rule of a box typed
 * against a list (`forms/matching.ts`: nothing before the second letter, at most eight): „Ovde nema dropdown-a,
 * gde si ti zapravo uradio izmenu????”. What is recorded under it, the coordinator's derivation from his
 * „dropdown koji prima kucanje slova”: „klik ili strelica dole otvaraju spisak SVIH članova koji se mogu
 * izabrati, spisak se skroluje unutar sebe, a kucanje slova sužava spisak.” So this box no longer reads
 * `matching`, and the two rules there stay with the boxes they were decided for (23.08.2026, the races of the
 * calendar; 22.10.2026, the editions of an event), neither of which was a decision about members.
 */

/**
 * The members offered for what stands in the box: every one of them while it is empty, and every one of them
 * while it holds the name of one (somebody opening a box already answered is looking for another member, as at a
 * select); otherwise each whose label holds what was typed, from the first letter and with no upper bound.
 * Case is folded on both sides, and the order is the order handed in.
 */
export function membersOffered(value: string, all: readonly Suggestion[]): Suggestion[] {
  const asked = value.trim().toLocaleLowerCase()

  if (asked === '' || everyOneNamedExactly(all, asked).length > 0) {
    return [...all]
  }

  return all.filter((one) => one.value.toLocaleLowerCase().includes(asked))
}

/** The pixels kept between the list and the edge of the window, a little above the gap the list stands off the
 *  box by (`--space-6`), so a shadow is not cut by the edge either. */
const GAP = 12

/** The least the list is given, three members or so, where the box stands so near the bottom of the window that
 *  less is left under it: a list of one row is no list, and the page scrolls to the rest of it. */
const AT_LEAST = 144

/**
 * How tall the list may grow, from where the box stands in the window: no taller than the room under it, so it
 * does not run out of the window, and it scrolls inside itself (`MemberChoice.css`).
 *
 * <p><b>Always under the box, never turned over it</b>, even where there is more room above: the decision is that
 * it opens over what is BELOW (owner, 23.11.2026: „Spisak predloga se otvara preko sadržaja ispod, ne gura ga
 * nadole.”, and again under the precision: „Spisak i dalje ide preko polja ispod, ne gura ih.”). Measured in
 * Chrome on 23.11.2026: a list that turned upwards where it had less than 240px below covered the row above at a
 * desktop 600px tall, which is the decision read backwards.
 *
 * @param bottom where the box's bottom edge is in the window
 * @param viewport how tall the window is
 */
export function roomFor(bottom: number, viewport: number): number {
  return Math.max(AT_LEAST, viewport - bottom - GAP)
}

/**
 * How far a list that scrolls inside itself has to be scrolled for one of its rows to be seen whole, moving it
 * no further than that: the row walked to with the keys is the row a reader looks at.
 *
 * @param top where the row starts inside the list
 * @param height how tall the row is
 * @param scrolled how far the list is scrolled now
 * @param seen how much of the list is in sight
 */
export function keptInView(top: number, height: number, scrolled: number, seen: number): number {
  if (top < scrolled) {
    return top
  }

  if (top + height > scrolled + seen) {
    return top + height - seen
  }

  return scrolled
}

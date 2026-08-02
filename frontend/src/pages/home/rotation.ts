import type { RaceCategory } from '../../data/types'

/**
 * Which length the turning chart shows after this one, and which it opens on.
 *
 * It reads the same way round as `CATEGORIES` in `src/data/derive.ts`, which is
 * the order the five are always shown in.
 *
 * Written out rather than derived from that array, because deriving it means
 * indexing by a computed number, and that is either a cast or a fallback, both
 * of which are banned (ADL A14). A test walks this map from `FIRST` and expects
 * `CATEGORIES`, so the two cannot drift apart: the order was put right in the
 * array on 01.08.2026 and this map was left behind, and the front page went on
 * cycling short, long, half while everything else had been fixed. That is what
 * the test now catches.
 *
 * In a file of its own rather than beside the widget, so that the widget's file
 * exports a component and nothing else.
 */
export const NEXT: Record<RaceCategory, RaceCategory> = {
  short: 'half',
  half: 'long',
  long: 'marathon',
  marathon: 'ultra',
  ultra: 'short',
}

/** Where the round starts, which is the first of the five. */
export const FIRST: RaceCategory = 'short'

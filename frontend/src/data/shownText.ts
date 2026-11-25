import type { ShownText } from './types'

/**
 * WHAT A READER IS SHOWN OF A TEXT THE PORTAL TRANSLATES, or the words as written where the server said nothing:
 * an answer asked for in no language carries no `...Shown` field, and neither does the fixture of a screen that
 * has not been given one (owner, PDL P18, 25.11.2026, „Automatski prevod sadržaja koji posetilac vidi").
 *
 * <p>The words as written have no language here, which is the truth: nobody has said what they are in, and a screen
 * that marks them with one would be guessing. `language` is the one a screen puts in `lang`.
 */
export function shownOr(written: string, shown: ShownText | undefined): ShownText {
  return shown ?? { text: written, language: null, machine: false }
}

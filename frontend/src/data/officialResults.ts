/**
 * The address of the official results of a race, in one place.
 *
 * A member types it, the portal stores it, and a moderator's screen draws it as a
 * link. That last step is the one that matters: a link is the one thing on a page
 * that carries an instruction to the browser, and an address somebody else typed
 * is not the portal's to trust. `javascript:` in an `href` is a script running on
 * the portal, with the moderator's session around it.
 *
 * Two readers, one shape. The forms refuse anything else before it is stored
 * (`unos-rezultata.form.json`, `prijava-sa-trke.form.json` carry this very source
 * as their `pattern`, and a test holds them to it), and the screen refuses it
 * again before it is drawn. Neither alone is enough: a form rule is a courtesy to
 * the person filling it in and says so in `forms/validate.ts` („nothing here is a
 * security measure"), and a store is a place things arrive in by other roads.
 *
 * Anchored at both ends, and nothing invisible inside. Unanchored at the end, `.`
 * does not cross a line break, so `https://primer.rs\n@zlo.example/p` passed as an
 * address of `primer.rs` while a browser resolves it to `zlo.example`: whoever read
 * the stored value to the first break saw one host and the moderator went to
 * another.
 *
 * `\s` alone was measured short of what this comment promised: it does not cover
 * the control characters below U+0020 that are not blanks, nor the zero width space
 * and the word joiner, and every one of those splits a host the same way. Those are
 * refused beside this pattern rather than inside it (`INVISIBLE` below).
 * Measured 23.08.2026, both ways.
 */
export const OFFICIAL_RESULTS = /^https?:\/\/[^\s]+$/

/**
 * The characters that are neither a blank nor anything a reader can see, and that
 * split a host exactly the way a blank does.
 *
 * Beside the pattern rather than inside it, for two reasons. The pattern is copied
 * into the two form definitions as a string and a definition is data, so it has to
 * stay something a JSON file can carry and a browser's own `pattern` attribute
 * could read. And a control character typed into a source file is a character
 * nobody reading the file can see, which is the very fault this refuses, so the
 * range is built rather than written out.
 */
const INVISIBLE = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}\u200b\u2060]`,
)

/**
 * What was stored, where the portal is willing to hand it to a browser, and
 * nothing where it is not.
 *
 * Nothing rather than a repaired address: an address that has to be repaired to
 * be safe is an address nobody wrote on purpose, and quietly mending it is how a
 * reader ends up somewhere neither of them chose.
 */
export function officialResultsLink(said: string): string | undefined {
  return OFFICIAL_RESULTS.test(said) && !INVISIBLE.test(said) ? said : undefined
}

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
 * Anchored at both ends, and no blank of any kind inside. Unanchored at the end,
 * `.` does not cross a line break, so `https://primer.rs\n@zlo.example/p` passed
 * as an address of `primer.rs` while a browser resolves it to `zlo.example`:
 * whoever read the stored value to the first break saw one host and the moderator
 * went to another. Measured 23.08.2026.
 */
export const OFFICIAL_RESULTS = /^https?:\/\/[^\s]+$/

/**
 * What was stored, where the portal is willing to hand it to a browser, and
 * nothing where it is not.
 *
 * Nothing rather than a repaired address: an address that has to be repaired to
 * be safe is an address nobody wrote on purpose, and quietly mending it is how a
 * reader ends up somewhere neither of them chose.
 */
export function officialResultsLink(said: string): string | undefined {
  return OFFICIAL_RESULTS.test(said) ? said : undefined
}

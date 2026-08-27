/**
 * The address of somebody else's page, where the portal asks before it hands one
 * to a browser.
 *
 * Two fields ask through here: the official results of a race, typed by the member
 * who sent the result, and the organiser's page for an event, typed by whoever
 * entered the event. Somebody types it, the portal stores it, and a screen draws
 * it as a link. That last step is the one that matters: a link is the one thing on
 * a page that carries an instruction to the browser, and an address somebody else
 * typed is not the portal's to trust. `javascript:` in an `href` is a script
 * running on the portal, with the reader's session around it.
 *
 * **Not every outside link on the portal comes through here, and saying otherwise
 * would be the worse mistake.** A written page is markdown, and a link inside it
 * is drawn by `components/Markdown.tsx` (`addressOf`), which asks a weaker
 * question: a prefix rather than an anchored shape, and nothing about the
 * characters that split a host. Measured by a security round on 27.08.2026, a
 * page whose author writes `[tekst](https://balkanskatrkackaliga.net<U+200B>@zlo.example/p)`
 * gets an anchor to `zlo.example`, with no `rel` and no host shown beside it. That
 * gap is older than this file and is not closed here; it is named here because the
 * sentence this comment used to open with („in one place") would have read as
 * proof that it was.
 *
 * Named for what it is rather than for where it started. It was
 * `officialResultsLink` while a result was the only thing that carried an outside
 * address; the day the event's page drew one too, that name was wrong at half of
 * its call sites, and a name that is wrong half the time is worse than a long one.
 *
 * Three writers, one shape. The forms refuse anything else before it is stored
 * (`unos-rezultata.form.json`, `prijava-sa-trke.form.json` and
 * `admin-dogadjaj.form.json` carry this very source as their `pattern`, and a test
 * holds all three to it), and the screen refuses it again before it is drawn.
 * Neither alone is enough: a form rule is a courtesy to the person filling it in
 * and says so in `forms/validate.ts` („nothing here is a security measure"), and a
 * store is a place things arrive in by other roads.
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
export const OUTSIDE_ADDRESS = /^https?:\/\/[^\s]+$/

/**
 * The characters that are neither a blank nor anything a reader can see, and that
 * split a host exactly the way a blank does.
 *
 * Asked of Unicode rather than listed, and **not** a claim to hold every character
 * a reader cannot see. Measured on 23.08.2026 across the whole of Unicode: `Cc`,
 * `Cf` and `\s` together still let through 4037 code points that leave no mark,
 * `Default_Ignorable_Code_Point` and U+2800 among them. None of those 4037 splits a
 * host, 267 are dropped by IDNA and 3769 are refused by `new URL`, so what is
 * refused here is the set that actually costs something.
 *
 * Listed by hand for one day, six of them written out, and a round found seven more
 * that do the same thing and were not on it: U+0085, U+00AD, U+200C, U+200E,
 * U+202E, U+2066 and U+180E each let `https://primer.rs␥@zlo.example/p` through.
 * A list written from memory is a list that is short.
 *
 * **What these do is hide, not redirect.** `https://primer.rs@zlo.example/p` opens
 * `zlo.example` with or without them, because `@` is what ends the user part of an
 * address; this refuses the ones that make such an address **read** as `primer.rs`
 * to somebody checking it. The portal draws the name of the event as the words of
 * the link and never the address itself (`admin/ReviewQueue.tsx`), so nobody is
 * reading it there today; a member may also simply type the attacker's address, so
 * refusing `@` would buy nothing. Said plainly because the sentence here claimed
 * for a while that the invisible character was what split the host, and a round
 * measured that it is not.
 *
 * `Cc` is the control characters and `Cf` the formatting ones, which is exactly
 * the two kinds: something the terminal acts on, and something the text engine
 * acts on. Neither leaves a mark on the screen.
 *
 * Beside the pattern rather than inside it. The pattern is copied into the two form
 * definitions as a string and a definition is data, so it has to stay something a
 * JSON file can carry and a browser's own `pattern` attribute could read; this is
 * asked in TypeScript, where a Unicode property is available and a JSON string
 * cannot go.
 */
const INVISIBLE = /[\p{Cc}\p{Cf}]/u

/**
 * What was stored, where the portal is willing to hand it to a browser, and
 * nothing where it is not.
 *
 * Nothing rather than a repaired address: an address that has to be repaired to
 * be safe is an address nobody wrote on purpose, and quietly mending it is how a
 * reader ends up somewhere neither of them chose.
 */
export function outsideLink(said: string): string | undefined {
  return OUTSIDE_ADDRESS.test(said) && !INVISIBLE.test(said) ? said : undefined
}

/**
 * The host an address would actually open, or nothing where the value is not an
 * address at all.
 *
 * Drawn beside the link on the moderator's queue, because the words of that link
 * are the name of the event and the name is written by the member who sent the
 * result. A round on 23.08.2026 measured what that costs: a result named
 * „Zvanicni rezultati BTL 2026" pointing at `btl-rezultati.zlo.example` put the
 * host **nowhere** in the page, not in the text, not in `title`, not in an
 * `aria-label`, so a moderator reading with a screen reader heard only the name.
 * `rel="noreferrer noopener"` keeps the attacker's page from learning anything;
 * what it cannot do is tell the moderator where the press leads.
 *
 * Drawn on the event's page for a reason of the same size but a different shape:
 * there the words of the link are the portal's own („Strana organizatora"), so
 * they cannot lie, and precisely because they cannot, they say nothing at all
 * about where the press lands. A reader deciding whether to leave this site for
 * somebody else's is entitled to know whose it is before pressing, not after.
 *
 * The host and not the whole address, because the host is the part that decides
 * where a press lands and the rest is noise on a narrow screen. Read through the
 * browser's own parser rather than off the text, since `@` ends the user part of
 * an address and a host read by eye is exactly the trick this is drawn against.
 */
export function outsideHost(said: string): string | undefined {
  const link = outsideLink(said)

  if (link === undefined) {
    return undefined
  }

  /* `URL` throws on an address whose shape passes the pattern and whose authority
     a browser refuses, `https://` with nothing after it among them. Nothing to
     draw then, and nothing to say beyond that. */
  try {
    return new URL(link).host
  } catch {
    return undefined
  }
}

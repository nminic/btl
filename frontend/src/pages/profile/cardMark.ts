/**
 * THE SHORT MARK OF THE STATE OF A MEMBER'S CARD, which the address of his own profile carries.
 *
 * Owner, PDL P11, 16.11.2026, point 15 under „Profil ima deljivu sliku za društvene mreže (OG
 * sliku)”. He measured it on himself: „radi odlicno na WA i na Viberu. Problem je sto kad dodam neki
 * rezultat i probam ponovo, vuce istu sliku.” Viber and WhatsApp keep a preview by the address of the
 * link and never ask again for the same one, so on his plan he decided „pusti ispravku iz tačke 2
 * odmah”: when a member opens HIS OWN profile, the address in the browser carries a short mark of the
 * state of his card (`?k=268f`), which changes with every change of the card, and the link he copies
 * after a change is a new one. The canonical address and `og:url` stay clean (`app/head.ts` builds both
 * from the path alone), and the mark is not a referral code (P18).
 *
 * **The mark is the server's and never worked out here.** It is a piece of the digest the address of
 * his card already carries (`CompetitorCardMarkApi`, from `CompetitorCards.fingerprintOf`), so the
 * address of the profile moves exactly when the address of the card does. A copy computed in the
 * browser out of what the profile shows would be a second home of that fact, and it would drift from
 * the card the day the two count anything differently, which they already do: the card counts every
 * race and the figures on the profile only the scored ones (PDL, 14.11.2026 and 15.11.2026).
 */

/** The name of the mark in the address. One letter, as the owner was shown it. */
export const CARD_MARK = 'k'

/** What a mark looks like: hexadecimal, and never longer than the digest it is a piece of. */
const A_MARK = /^[0-9a-f]{1,16}$/

/** The mark out of the answer of `GET /api/cards/marks/{page}`, or null where it is not that shape. */
export function markIn(body: unknown): string | null {
  const mark: unknown = Reflect.get(Object(body), 'mark')

  return typeof mark === 'string' && A_MARK.test(mark) ? mark : null
}

/**
 * The mark of the card of one member in one language, or null when there is none to have.
 *
 * Null for every way the read can end without a mark - no server, a 404 (a hidden profile, a lapsed
 * member and a number nobody holds have no card and so no mark), a body that is not one - and the
 * caller then leaves the address as it was, which is the profile as it has always been.
 */
export async function markOf(memberNumber: string, locale: string): Promise<string | null> {
  let answer: Response

  try {
    answer = await fetch(
      `/api/cards/marks/${encodeURIComponent(memberNumber)}-${encodeURIComponent(locale)}`,
    )
  } catch {
    return null
  }

  if (!answer.ok) {
    return null
  }

  try {
    return markIn(await answer.json())
  } catch {
    return null
  }
}

/**
 * WHAT THE ENVELOPE ON A MEMBER'S ROW SENDS, AND WHAT THE SERVER'S ANSWERS TO IT ARE CALLED.
 *
 * <p>The owner, 25.10.2026 (PDL „Nova pozivnica od administracije i rečenica o trkama: odgovori od
 * 25.10.2026"): „Pošalji novu pozivnicu" stands on the member's row as an envelope and sends at once, with
 * no sheet to ask first, and afterwards the screen says „Nova pozivnica je poslata na {adresa}. Prethodni
 * link više ne važi." The route is `MemberInvitationApi`, the shape of `memberPayment.ts` beside it.
 */
export function invitationOnTheRow(memberNumber: string): string {
  return `/api/members/${memberNumber}/invitation`
}

/**
 * The refusals `POST /api/members/{memberNumber}/invitation` names, each to its sentence.
 *
 * <p>`thePasswordIsSet` is said in the words the envelope's box has where it is switched off (owner,
 * 25.10.2026): a row read before the member set his password still offers the envelope, and the answer is
 * the same fact the next reading of the list will draw. `thePostDidNotTakeIt` arrives with a 503, which
 * `askTheServer` reads as a bare number and not as a refusal by name, so the sentence for it is
 * {@link WHAT_THE_NUMBER_SAYS_WHEN_INVITING}'s too; it stands here as well because the route declares
 * it, and `account/refusals.test.ts` holds this map to every constant the route declares.
 */
export const WHEN_SENDING_AN_INVITATION: Record<string, string> = {
  thePasswordIsSet: 'admin.invitationNotNeeded',
  thereIsNoAccount: 'admin.invitationNoAccount',
  thePostDidNotTakeIt: 'admin.invitationNotSent',
}

/** The relay did not take the letter (owner, 25.10.2026: „Pošta trenutno ne prima poruke, pa pozivnica
 *  nije poslata. Pokušaj ponovo za koji minut."). */
export const WHAT_THE_NUMBER_SAYS_WHEN_INVITING: Record<number, string> = {
  503: 'admin.invitationNotSent',
}

/** The address the route says the letter went to, or nothing where its answer names none. */
export function addressIn(body: unknown): string | null {
  const email: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'email') : undefined

  return typeof email === 'string' ? email : null
}

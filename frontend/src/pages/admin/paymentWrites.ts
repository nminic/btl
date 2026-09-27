/**
 * WHAT THE SCREEN OF PAYMENTS SENDS, AND WHAT THE REFUSALS OF IT ARE CALLED.
 *
 * <p>Its own module rather than constants beside the screen, which is the arrangement
 * `admin/memberWrites.ts`, `admin/leagueWrites.ts`, `admin/teamWrites.ts`,
 * `admin/moderatorWrites.ts` and `admin/priceWrites.ts` already have, and the reason they
 * give: `react/only-export-components` asks for it, and a test reading a component file to
 * get at a table is a test that mounts React to ask a question about a table.
 *
 * <p><b>THIS SCREEN SENDS TWO ACTS AT TWO ADDRESSES, AND THAT IS THE SHAPE OF THE DOMAIN
 * RATHER THAN A STAGE OF THE WORK.</b> A membership is activated in two ways and the owner
 * named both in one breath (PDL:760, „evidentirana uplata ILI [oslobodjenje]"): a fee that
 * arrived, and a decision of the association freeing somebody of it. They are two routes,
 * two sets of refusals, and two buttons. A single button could not carry both, because the
 * two write a different `basis` and only one of them is about money.
 *
 * <p><b>NEITHER ACT ASKS THE MODERATOR FOR ANYTHING BUT THE ROW.</b> Owner, 27.09.2026,
 * chosen between three outcomes and against the recommendation he was given: „Dovoljno je
 * da klikne Aktiviraj." So the body carries the identity and nothing else - no amount, no
 * currency, no method, no day. The cost of that was put to him before he chose it and he
 * took it: a record of a payment carries no amount, so the balance cannot be worked out
 * from the book of payments and the book of payments is kept outside the portal.
 */

/**
 * WHERE A FEE THAT ARRIVED IS BOOKED.
 *
 * <p><b>This screen is written against the shape the owner's decision asks for, which is
 * NOT the shape the route had on the day it was written, and that is deliberate and has to
 * be read before the gate is believed.</b> `PaymentApi` still requires `currency` and
 * `method` and answers 400 `theFormIsNotComplete` without them, because an older draft of
 * it worked out and stored an amount. PDL section 14, 27.09.2026, strikes that: „valuta nema
 * cega da bude valuta... `currency` i `method` prestaju da budu obavezni na toj ruti, ili se
 * ruta deli tako da aktivacija ne trazi nista osim toga KOGA aktivira."
 *
 * <p><b>Why the screen does not send them anyway, which was weighed rather than assumed.</b>
 * The currency is what picks the price the route WRITES (`MembershipPrice.on`, and
 * `payment_only_euro_carries_a_fee` in V16), so a screen that sent a plausible one would put
 * an amount nobody ever saw into a row the schema will not let anybody correct - migrations
 * are irreversible from the day they merge (ADL A2). Sending a method would be the same
 * sentence about how the money arrived. Both were refused for that reason and the refusal is
 * written here so the next reader does not put them back to make a gate go green.
 *
 * <p><b>What that means for the three refusals about them.</b> `theCurrencyIsNotKnown`,
 * `theMethodIsNotKnown` and `theReferenceIsNotShaped` are answered below although this screen
 * cannot reach any of them, which is the shape `admin/priceWrites.ts` and
 * `admin/memberWrites.ts` both keep and state the reason for: the screen is the floor and the
 * route decides, so a request that goes round the screen meets the route with nothing in
 * between. The day the route drops them, `pages/account/refusals.test.ts` goes red on its own
 * count and on these keys, and that is the gate doing its job rather than a surprise.
 */
export const A_FEE_THAT_ARRIVED = '/api/payments'

/**
 * WHERE A MEMBER FREED OF THE FEE IS ENTERED.
 *
 * <p>`MembershipWriteApi` already takes the identity and nothing else, which is the shape the
 * decision above asks of both acts, and it is the precedent this screen copies rather than
 * invents. Its right is the same `queue:payments`, read off a decision the route's own note
 * quotes: a moderator working this list is the one who may free somebody of the fee.
 */
export const A_FEE_THAT_IS_WAIVED = '/api/memberships'

/**
 * THE WHOLE BODY OF BOTH ACTS.
 *
 * <p><b>`competitorId` and never the member number, which is a rule rather than a
 * preference.</b> Both routes read `competitor.id` and neither reads a number; the
 * population this screen exists for is exactly the one that may hold no number yet, so a
 * number as the identity would address nobody for most of the list. The word did not occur
 * anywhere in this portal before this screen, which is why it is worth saying out loud.
 *
 * <p>One function for both acts because the two bodies are one shape today. Written as two
 * it would be one fact in two homes; written as an object at each call site the identity
 * could be spelled differently at one of them, and this is the whole of what either route
 * reads.
 */
export function activating(competitorId: number): { competitorId: number } {
  return { competitorId }
}

/**
 * THE MEMBER NUMBER THE ANSWER CARRIED, or nothing at all where it carried none.
 *
 * <p><b>Read without an assertion (ADL A14)</b>, which is the rule `admin/leagueCounted.ts`
 * reads a served field by and `pages/account/askTheServer.ts` reads a refusal by: what comes
 * off the wire is `unknown` and is narrowed by LOOKING at it, so an answer of some other
 * shape says „no number" rather than being claimed to hold one.
 *
 * <p><b>Why a screen reads it at all, rather than working it out.</b> Both acts hand a number
 * out - either the one he already had, or the next from the sequence - and the sequence is the
 * only thing that knows which. The screen before this one counted the numbers it could SEE and
 * handed out the next, which is the exact fault V16 names in choosing a sequence: a query reads
 * what is there, and what is there is missing precisely the people who have left.
 *
 * <p><b>Empty is a real answer and not a failure.</b> `PaymentApi` names one reachable case
 * where a `Confirmed` carries none: a payment already `recorded` for somebody who somehow still
 * holds no number. The screen draws the name without a number in that case instead of inventing
 * one.
 */
export function numberIn(body: unknown): string {
  if (typeof body !== 'object' || body === null) {
    return ''
  }

  const written: unknown = Reflect.get(body, 'memberNumber')

  return typeof written === 'string' ? written : ''
}

/**
 * THE EIGHT REFUSALS `POST /api/payments` NAMES, and the sentence this screen turns each of
 * them into.
 *
 * <p><b>Two of the eight are about a row that is already settled, and they are the two a
 * moderator will really meet.</b> `theMembershipIsAlreadyHeld` is the season being held on
 * some ground already - the route deliberately does not say WHICH, because `queue:payments`
 * is not `entity:members` and the basis is read under that other right (PDL 28.07.2026) - and
 * `thePaymentWasReversed` is a reversal, which is turned back by a person and not by a second
 * click on a list. Both arrive under 409 and both land here by name, because the number is the
 * route's business and the name is what a sentence is looked up by (`askTheServer`).
 *
 * <p><b>`theCompetitorDoesNotExist` is reachable from this screen and the others are not,
 * which is worth the distinction.</b> This list is derived and read once per visit, so a
 * competitor deleted by another moderator between the read and the click is a row that still
 * stands on screen and no longer stands on the server. That is not a screen one release behind
 * its server; it is two people working at once, which is the ordinary case.
 */
export const WHEN_CONFIRMING_A_PAYMENT: Record<string, string> = {
  /* Unreachable from this screen while the body is built by `activating`, and answered for
     the reason the note on `A_FEE_THAT_ARRIVED` gives. It is the one refusal whose cause
     would be a fault of OURS rather than anything the reader did, so the sentence says that
     plainly instead of asking him to fix a form he never filled in. */
  theFormIsNotComplete: 'admin.paymentRefused.theFormIsNotComplete',
  theCurrencyIsNotKnown: 'admin.paymentRefused.theCurrencyIsNotKnown',
  theMethodIsNotKnown: 'admin.paymentRefused.theMethodIsNotKnown',
  theReferenceIsNotShaped: 'admin.paymentRefused.theReferenceIsNotShaped',
  theCompetitorDoesNotExist: 'admin.paymentRefused.theCompetitorDoesNotExist',
  theReferenceIsTaken: 'admin.paymentRefused.theReferenceIsTaken',
  thePaymentWasReversed: 'admin.paymentRefused.thePaymentWasReversed',
  theMembershipIsAlreadyHeld: 'admin.paymentRefused.theMembershipIsAlreadyHeld',
}

/**
 * THE FOUR `POST /api/memberships` NAMES, and the two it shares with the route above.
 *
 * <p><b>A second dictionary rather than four more lines in the first</b>, which is the shape
 * `WHEN_LEAVING_A_TEAM` and `WHEN_DELETING_A_TEAM` already keep for one class with two acts:
 * a reader of one dictionary should not have to work out which of its names can reach which
 * button.
 *
 * <p><b>Two of the four carry their own sentence although the name is shared, and one does
 * not.</b> `thePaymentWasReversed` means the same thing on both acts and the moderator has the
 * same nothing to do about it, so it draws the same sentence. `theFeeIsAlreadyRecorded` is this
 * route's own: it is the mirror of `theMembershipIsAlreadyHeld` and says the season is held by a
 * FEE, which is a fact this route may report because it is refusing to overwrite it - an
 * exemption written over a recorded payment would leave nothing behind saying the payment had
 * ever been there.
 */
export const WHEN_FREEING_OF_THE_FEE: Record<string, string> = {
  theFormIsNotComplete: 'admin.paymentRefused.theFormIsNotComplete',
  theCompetitorDoesNotExist: 'admin.paymentRefused.theCompetitorDoesNotExist',
  theFeeIsAlreadyRecorded: 'admin.paymentRefused.theFeeIsAlreadyRecorded',
  thePaymentWasReversed: 'admin.paymentRefused.thePaymentWasReversed',
}

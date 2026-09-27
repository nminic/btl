/**
 * WHAT THE MODERATOR'S DECISION LOOKS LIKE ON THE WIRE, AND THE ADDRESS IT GOES TO.
 *
 * <p>Its own module rather than a constant beside the screen, which is the arrangement
 * `admin/leagueWrites.ts` and `pages/member/myAccount.ts` already have and the reason they
 * give: `react/only-export-components` asks for it, and a test reading a component file to
 * get at a shape is a test that mounts React to ask a question about an object.
 *
 * <p><b>A `.ts` and never a `.tsx`</b>, for the same reason `leagueWrites.ts` states: what
 * is here is data rather than words on a screen, and the sentences a refusal draws are not
 * here at all (see below).
 *
 * <p><b>WHY THERE IS NO TABLE OF REFUSAL CODES HERE, unlike `leagueWrites.ts`.</b> That
 * file maps each name `LeagueWriteApi` answers with onto a key in the dictionary, because
 * that route refuses BY NAME - `theAddressIsTaken` is a code and no reader could be shown
 * it. `VerificationWriteApi` does the opposite and it is measured, not assumed: its
 * `no(HttpStatus, String)` puts the constant straight into the body
 * (`ResponseEntity.status(status).body(new Refused(reason))`), and every one of those
 * constants is ALREADY A SERBIAN SENTENCE - „Odluka o ovom redu još nije uvedena.", „O
 * stavci je već odlučeno.", „Stavku trenutno drži drugi moderator.", „Uz odbijanje je
 * razlog obavezan.", „Forma nije popunjena.", „Tim sa tim nazivom već postoji.", „Osnivač
 * je već u nekom timu."
 *
 * <p>So there is nothing to map: the screen draws what came back. A table here would be a
 * second home for seven sentences the server already owns, and the copy is the one that
 * gets it wrong the day the server rewords one of them.
 *
 * <p><b>Which is also why `pages/account/ServerSaid.tsx` is NOT reused for this route,
 * and why that file is not touched.</b> Handed a reason its map does not know, it draws
 * `server.refused`, „Server je odbio zahtev uz razlog {reason}, koji ovaj ekran ne
 * prepoznaje." That sentence is true of a route that answers codes and says the opposite
 * of the truth here: this screen recognises the reason perfectly, because the reason is
 * the answer. Widening that component was weighed and refused - twelve files read it,
 * `admin/EntityEditor.tsx` among them, so a prop added for this one route is a change
 * every admin screen carries. The four sentences are not copied either: they live in
 * `sr.json` under `server.*` and the line that draws them reads those same keys
 * (`PendingQueue.tsx`, `WhatTheServerSaid`).
 */

/**
 * WHAT `POST /api/verification/{id}/decision` TAKES, which is
 * `VerificationWriteApi.Answered` and nothing besides.
 *
 * <p><b>`approved` is the whole of the decision and the route refuses a body without it.</b>
 * `VerificationWriteApi.decide` answers 400 „Forma nije popunjena." to
 * `typed.approved() == null`, and it does so only AFTER it has decided the caller may
 * moderate the item at all - the comment there says why in as many words, and the
 * measurement behind it is 21.09.2026 over a real socket: asked the other way round, a
 * plain competitor learnt that an administrative action lives at that address, which is
 * what ADL A8 forbids.
 *
 * <p><b>`reason` travels on an approval too, as the empty string.</b> What the record does
 * with it is `DecidingOnASubmission.reasonAsItGoesIn`'s business and not this file's: the
 * route asks for a reason only when the answer is no, and only on the queues that owe the
 * member one (PDL P22, and the comments queue is the exception). Sent as the empty string
 * rather than left out, because that is what the screen is holding - `Decision.note` is
 * `''` on an approval for the same reason - and a field quietly dropped from the JSON is a
 * field whose absence somebody later has to read a meaning into.
 */
export type Answered = {
  approved: boolean
  reason: string
}

/**
 * The one address a decision is written at.
 *
 * <p>Built here rather than spelt out at each of the three doors on the screen that send
 * one (approving a card, handing one back, and the sweep), so the three cannot come apart.
 *
 * <p>The identity is the queue item's own, as the portal holds it: a string, because that
 * is what `session/context.ts` keys a `Decision` by and what `PendingItem.id` is. The
 * server's is a `bigserial`; nothing here converts between the two, since an address is
 * text by the time it is one.
 */
export function decisionPath(id: string): string {
  return `/api/verification/${id}/decision`
}

/**
 * Yes.
 *
 * <p><b>Two functions and never one with a flag</b>, because approving and handing work
 * back are two acts rather than one act with a switch on it. The screen presses two
 * different buttons, the route takes two different roads out of
 * `DecidingOnASubmission.decide` (`APPROVE_IT` and `REJECT_IT`), and only one of the two
 * can be refused for having nothing written in it. A single `answered(approved, reason)`
 * would let a caller approve with a reason or refuse without one, and both of those are
 * shapes this portal has no meaning for.
 */
export function anApproval(): Answered {
  return { approved: true, reason: '' }
}

/**
 * No, and here is why.
 *
 * <p>The reason is whatever the moderator typed, sent exactly as typed. Where the queue
 * allows an empty one - the comments, deleted rather than returned, where the note is „za
 * moderatore" and not a reason owed to anybody (PDL P22) - the empty string is what
 * travels, and `DecidingOnASubmission` is what decides whether that is allowed. The screen
 * does not ask the question twice: `SendBack` already marks the field optional on that one
 * queue (`queues.ts`, `outcomeFor`), and the route is what settles it.
 */
export function aRefusal(reason: string): Answered {
  return { approved: false, reason }
}

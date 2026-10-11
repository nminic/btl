import type { RaceKind } from '../../data/types'

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
  /**
   * The runner's figures as the moderator sets them, on an approved run and nowhere else
   * (`VerificationWriteApi.Amended`, R1 of the results flows). LEFT OUT means „do not
   * touch": the run is counted at the figures it was sent with (ADL A8, 19.09.2026,
   * „Izostavljeno polje nikad ne sme tiho da promeni vrednost", and the route says which of
   * the two readings its omission has). Beside a refusal, or on another tab, the route
   * answers 400, so it is never sent there: only {@link anApprovalWith} writes it.
   */
  amended?: Amended
  /**
   * The event and the race an approval writes into the calendar, on a run on a race the
   * calendar does not hold (`VerificationWriteApi.NewRace`, R3 of the results flows). Only
   * {@link anApprovalOnANewRace} writes it: the route answers 400 to it beside a refusal, on
   * another tab, or on a run from the calendar.
   */
  newRace?: NewRace
  /**
   * The race of the calendar such a run is counted on instead, by its key
   * (`VerificationWriteApi.Answered.raceId`). Only {@link anApprovalOnTheRace} writes it, and
   * never beside `newRace`: a run is counted on one race.
   */
  raceId?: number
}

/**
 * THE EVENT AND THE RACE A MODERATOR SETTLES FOR A RUN THE CALENDAR DOES NOT HOLD, under the
 * names `VerificationWriteApi.NewRace` reads.
 *
 * <p><b>All three are asked for, and the route refuses a blank one</b> as a form not filled in:
 * none of them falls back on what the member typed, so the panel that sends this seeds its
 * boxes with the member's words and sends what stands in them. The kind is the moderator's
 * decision and the member's was a hint (PDL P9, 30.08.2026, in the record's wording: „član
 * nagoveštava vrstu, administrator odlučuje").
 */
export type NewRace = {
  eventName: string
  raceName: string
  raceKind: RaceKind
}

/**
 * THE FOUR FIGURES OF A RUN AS THE MODERATOR SETS THEM, under the names
 * `VerificationWriteApi.Amended` reads.
 *
 * <p><b>Each may be left out, and a figure the race fixes always is.</b> The route reads
 * only what the race leaves to the runner (`WhatARaceCarries.figuresOf`), and this screen
 * asks for exactly that and no more (`admin/amendFields.ts`), so what travels is what the
 * moderator was shown. A figure the race leaves to the runner and the amendment leaves out
 * is refused by the route as a form not filled in, which the panel never sends.
 *
 * <p>The time is the SUM of the three boxes it is asked in, added up where every form on
 * this portal adds them (`forms/clock.ts`), because the route keeps seconds.
 */
export type Amended = {
  distanceKm?: number
  ascentM?: number
  descentM?: number
  seconds?: number
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
 * The one address a waiting picture is asked for, to the moderator who may decide
 * the row it is standing in.
 *
 * <p>Read rather than written, and kept beside `decisionPath` for the identical
 * reason: a queue card and its picture are two things this screen reads about ONE row,
 * and an address built twice - once here, once where the `<img>` is drawn - is two
 * places that could spell the row's identity differently.
 *
 * <p><b>The identity is the item's own `id`, never `photoId`.</b> `PhotoApi.waitingOn`
 * takes `verification.id` and looks the picture up FROM it
 * (`join photo p on p.id = v.photo_id where v.id = :id`), so the address never carries
 * the picture's own key at all; whether to ask this address is what `photoId`
 * answers, and asking it is what this function does. A row with no picture is answered
 * 404 by the same route a moderator with no right over it is, and this file has no
 * business telling the two apart - see `admin/PendingQueue.tsx`'s `WaitingPicture`.
 */
export function photoPath(id: string): string {
  return `/api/verification/${id}/photo`
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
 * Yes, at these figures in place of the runner's: one request, so there is no moment at
 * which another moderator could read a run half changed, and nothing to undo when the
 * approval is refused.
 *
 * <p>Its own function rather than an argument to {@link anApproval}, for the reason that
 * one and {@link aRefusal} are two: the screen presses two different buttons, and an
 * optional argument would let a caller send `amended` holding nothing, a shape that reads
 * „change" and says „change nothing".
 */
export function anApprovalWith(amended: Amended): Answered {
  return { approved: true, reason: '', amended }
}

/**
 * Yes, on a race this approval makes, with its event, at these figures: one request, so the
 * event, the race, the result and the run pointed at them are written together or not at all
 * (`VerificationWriteApi`, ADL O14).
 *
 * <p>The figures travel all four, because the race is made OF them: what its kind fixes is put
 * on the race, and on a race to a limit the time is its limit (PDL P9, 30.08.2026, in the
 * record's wording: „Na vremenskoj trci van kalendara polja za vreme znače ograničenje trke, ne
 * vreme koje je član istrčao.").
 */
export function anApprovalOnANewRace(newRace: NewRace, amended: Amended): Answered {
  return { approved: true, reason: '', amended, newRace }
}

/**
 * Yes, on this race of the calendar, at these figures: the race answers for what it fixes, so
 * only what it leaves to the runner travels, exactly as {@link anApprovalWith} sends it for a run
 * sent from the calendar.
 */
export function anApprovalOnTheRace(raceId: number, amended: Amended): Answered {
  return { approved: true, reason: '', amended, raceId }
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

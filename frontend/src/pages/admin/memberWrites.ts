/**
 * WHAT THE ADMINISTRATION'S SCREEN OF MEMBERS SENDS, AND WHAT THE THREE REFUSALS OF IT ARE
 * CALLED.
 *
 * <p>Its own module rather than a constant beside the screen, which is the arrangement
 * `admin/leagueWrites.ts`, `admin/teamWrites.ts` and `admin/moderatorWrites.ts` already have
 * and the reason they give: `react/only-export-components` asks for it, and a test reading a
 * component file to get at a table is a test that mounts React to ask a question about a
 * list.
 *
 * <p><b>THIS SCREEN SENDS ONE VERB AND ONE ONLY, AND THAT IS A BOUNDARY RATHER THAN A STAGE
 * OF THE WORK.</b> See the note on `admin/AdminMembers.tsx`, which states it in full.
 * Measured on 26.09.2026 over `backend/src/main/java`, which declares exactly three (verb,
 * address) pairs for a member: `GET /api/competitors` (`CompetitorApi:349`),
 * `POST /api/competitors` (`CompetitorWriteApi:785`) and
 * `DELETE /api/competitors/{memberNumber}` (`CompetitorWriteApi:301`). There is no `PUT` at
 * all, and the `POST` is a different act from the one this screen used to offer (PDL P8b).
 */

/**
 * WHAT HAPPENS TO HIS ACCOUNT, WHICH THE ROUTE REQUIRES AND THIS SCREEN CAN ONLY SAY ONE
 * WAY.
 *
 * <p>PDL P23, 14.09.2026, names two outcomes: „Prvo se odluci sta sa nalogom (anonimizuje se
 * ili se brise), pa tek onda clan moze da ode." `CompetitorWriteApi` accepts both words and
 * refuses the second by name (`ANONYMISING_IS_NOT_WRITTEN_YET`), so the screen sends the one
 * the server can carry out rather than offering a choice whose other half is a 409.
 *
 * <p><b>Sent explicitly and never left out.</b> The parameter is optional to the dispatcher
 * and required by the route; omitted, the answer is `THE_ACCOUNT_MUST_BE_DECIDED`, which is
 * a sentence about a screen that forgot something rather than about anything the reader did.
 */
export const DELETE_THE_ACCOUNT = 'delete'

/**
 * THE THREE REFUSALS `DELETE /api/competitors/{memberNumber}` NAMES, and the sentence this
 * screen turns each of them into.
 *
 * <p><b>THE KEYS ARE WHOLE SERBIAN SENTENCES, AND THAT IS A MEASUREMENT OF THE SERVER RATHER
 * THAN A CHOICE MADE HERE.</b> Every other route on the portal answers `Refused` with a
 * camel-case code (`theAddressIsTaken`, `theWindowIsShut`), which a screen looks a sentence
 * up by. `CompetitorWriteApi` answers with the PROSE itself:
 * `THE_ACCOUNT_MUST_BE_DECIDED`, `ANONYMISING_IS_NOT_WRITTEN_YET` and
 * `THE_ACCOUNT_ADMINISTERS` are declared as finished Serbian sentences
 * (`CompetitorWriteApi.java:165,183,196`). `pages/account/refusals.test.ts` reads the
 * constants' VALUES out of the Java source and requires each to be a key here, so these are
 * the keys that gate has to find.
 *
 * <p><b>Which is worth mapping rather than letting through, for one reason that is not
 * tidiness.</b> An unmapped reason falls to `ServerSaid`'s honest branch and is printed
 * code and all - and here the „code" is a Serbian sentence, so an English reader would be
 * handed Serbian prose inside an English frame. Mapped, he gets the same fact in his own
 * language, which is what `ADL.md:3711` asks of everything administration writes.
 *
 * <p><b>Two of the three cannot be reached from this screen today, and both are answered
 * anyway</b>, which is the shape `admin/priceWrites.ts` already keeps and states the reason
 * for: the screen is the floor and the route decides. `theAccountMustBeDecided` is
 * unreachable because {@link DELETE_THE_ACCOUNT} is always sent, and
 * `anonymisingIsNotWrittenYet` because this screen never sends the other word. A request
 * that goes round the screen meets the route with nothing in between, and a screen one
 * release behind a server that started demanding the parameter differently would otherwise
 * show its reader a sentence about the wrong thing.
 */
export const WHEN_DELETING_A_MEMBER: Record<string, string> = {
  'Odlučite šta biva sa nalogom pre nego što član ode.': 'admin.memberDeleteRefused.theAccountMustBeDecided',
  'Anonimizacija naloga još nije napisana; nalog se za sada može samo obrisati.':
    'admin.memberDeleteRefused.anonymisingIsNotWrittenYet',
  'Nalog ovog člana administrira portal, pa se član ne može obrisati odavde.':
    'admin.memberDeleteRefused.theAccountAdministers',
}

/**
 * WHY THERE IS NO `standsOnTheServer` HERE, WHICH IS A MEASUREMENT AND NOT AN OMISSION.
 *
 * <p>`admin/teamWrites.ts` carries one, and the note on it says what it is for: a row
 * entered during a visit is remembered as a session overlay under an identity
 * `admin/entityForms.ts#idFor` counts DOWN from nought for, so a delete pressed on it would
 * otherwise send `DELETE /api/teams/-1`. Every screen where both kinds of row stand in one
 * table needs that question answered.
 *
 * <p><b>This screen needs it neither of the two ways it might.</b>
 *
 * <ol>
 * <li><b>The shape of the key could not answer it anyway.</b> A member's `idField` is
 * `memberNumber` (`entityForms.ts:124`), so `numbersItsRecords` (`entityForms.ts:527`) is
 * false for it and `entityForms.ts:682` files the row under the identity AS TEXT - text
 * handed out by `nextMemberNumber`, whose whole job is to produce the next number in the
 * SAME shape the server uses. A member made during a visit would be `000012` where a served
 * one is `000011`, so copying `standsOnTheServer` would be worse than useless: it refuses
 * every text, and EVERY deletion on this screen would quietly stay local.
 * <li><b>And there is no such row to tell apart.</b> Measured on 26.09.2026 over
 * `frontend/src`: nothing writes `creations[MEMBERS.id]` any more. The one control that did
 * was this screen's own „Nov član", which is gone for the reason the screen's note gives,
 * and the six remaining writers of a member into the session all call `editRecord` on a row
 * that is already served (`AdminTeams.tsx:398`, `PendingQueue.tsx:419`,
 * `InvitationAnswer.tsx:140`, `Settings.tsx:140`, `TeamDetail.tsx:286,387`) - activating a
 * membership gives a number to somebody who is already there, it does not invent a person.
 * </ol>
 *
 * <p><b>So the floor under that second claim is not a function but a case</b>, and it is in
 * `adminMemberWrites.test.tsx`: the screen offers no control that makes a member. A
 * predicate written here instead would be a branch no input can reach, which the 100 per
 * cent threshold would report and which `CLAUDE.md` names as the one thing a list of
 * mutations cannot see.
 */


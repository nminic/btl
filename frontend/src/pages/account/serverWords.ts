/**
 * WHICH SENTENCE AN ANSWER THAT CARRIED A NUMBER AND NO REASON GETS, DECIDED IN ONE PLACE.
 *
 * <p>`askTheServer` reads every answer into one of five shapes, and the one called `wrong` is
 * what is left when the server named no reason: any number it does not read as success, as a
 * token refusal or as a refusal by name. Until 02.10.2026 every one of them was „Server je
 * odgovorio brojem {status} i ništa nije promenjeno. Pokušaj ponovo za koji minut.", which is
 * advice about a server that is busy. It is wrong for a 400.
 *
 * <p><b>A 400 WITHOUT A REASON IS A REQUEST THE PORTAL SHOULD NEVER HAVE SENT.</b> Measured over
 * `backend/src/main/java` on 02.10.2026, by reading every `BAD_REQUEST` and `badRequest()` in it:
 * each explicit 400 on a write route carries a reason in its body (`no(BAD_REQUEST, REASON)`,
 * `NotComplete`, `NotEntered`, `Refused`), so a 400 that names none comes from Spring before the
 * route runs - a body it cannot read, a value of the wrong type for a field, a path variable that
 * is not a number - or from the one explicit refusal that carries `null`
 * (`ModeratorWriteApi.change`, for an address nobody sends). The one other bare 400,
 * `PageApi.pages`, is a `GET` and never becomes an `Answer`. Sending the same request again
 * cannot go differently, so telling the reader to wait a few minutes was wrong for every one of
 * them.
 *
 * <p>Owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza"): such a 400 gets a
 * sentence of its own. <b>The words are the coordinator's proposal and the PDL says so</b>; what
 * the owner chose is that it says the fault is the portal's, that nothing changed, and that the
 * reader is asked to tell the league.
 *
 * <p><b>THE DECISION IS ONE FUNCTION BECAUSE TWO HOMES OF IT WOULD DRIFT.</b> `ServerSaid.tsx` is
 * where nearly every screen gets its sentence, and `admin/PendingQueue.tsx` (`WhatTheServerSaid`)
 * asks this same function for the one answer it words by itself: its route refuses in Serbian
 * sentences rather than in codes, so it cannot hand `ServerSaid` a table, but a number with no
 * reason in it is the portal's to word and not the route's. It kept a copy of the old sentence until
 * 02.10.2026, named as a boundary in `serverWords.test.ts`, which failed on the day the copy went; the
 * copy is gone and that test now says no module but this one writes either sentence.
 *
 * <p>Only the 400 is read differently. A 404, a 409 that names nothing and a 5xx are different
 * facts, and the owner's decision is about the one.
 *
 * @param status the number the answer carried, for an answer that named no reason
 * @returns the key of the sentence in `i18n/sr.json` and `i18n/en.json`
 */
export function whatABareNumberSays(status: number): 'server.malformed' | 'server.wrong' {
  return status === 400 ? 'server.malformed' : 'server.wrong'
}

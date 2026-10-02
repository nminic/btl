/* One text of one member waits for a moderator at a time.
 *
 * Owner, PDL, the entry „Nov tekst o sebi se ODBIJA dok prethodni ceka odluku moderatora" (19.09.2026),
 * chosen between three offered outcomes: „Odgovor je 409, i prvi tekst ostaje u redu netaknut."
 * MeWriteApi carried that out by asking whether a text of his was waiting and then writing one, which
 * is two statements under READ COMMITTED: two requests that both asked before either wrote were both
 * told yes, and the moderator was handed two texts of one person and no question he could answer. A
 * member pressing „Posalji" twice is enough. Measured on the branch that carries this file, with the
 * case written first: both presses were answered 200.
 *
 *
 * WHY THE DATABASE, AND THE PRECEDENT
 * -----------------------------------
 * „Asked once" is already the database's to say in four places: team_application_asked_once,
 * team_invitation_sent_once, pair_invite_asked_once, and on this very table
 * verification_team_proposal_unique. A question asked in Java and answered by a write is a race the
 * moment two requests overlap; a unique index is the one thing both of them meet.
 *
 * An INDEX and not a constraint, because a unique constraint takes no WHERE, and the rule is about a
 * part of the table rather than the whole of it. role_only_one_holds_every_right (V5) is the same shape
 * for the same reason.
 *
 *
 * THE CONDITION IS THE ROUTE'S OWN, AND EACH HALF OF IT IS A DECISION
 * ------------------------------------------------------------------
 *   queue = 'profiles'  the tab a member's text waits in (PDL P28a). A row waiting in another tab is
 *                       not his text and stops nothing.
 *   state = 'waiting'   a DECIDED text stays in the table for ever, approved and refused alike (V9,
 *                       ADL A42), and being refused and sending a new one is the whole errand the
 *                       owner asked for (PDL P22, 15.08.2026). Written as „not refused", an approval
 *                       would shut the panel for good.
 *   photo_id is null    a picture waits in the same tab (PDL P28a, „isti clan, isti profil, dve stavke")
 *                       and is not a text. photo_id is what the schema offers to tell the two apart, and
 *                       it is what MeWriteApi.theTextThatWaits asks.
 *
 * competitor_id is null for a row about somebody who is not a member yet (V9). An index compares no
 * null with another, so such rows stand side by side, as they always could.
 *
 * A picture row whose photograph is deleted while it waits would be a text to this index, because
 * verification_photo_fk empties the pointer (V9). MePhotoApi names that shape and moves the pointer
 * before it deletes, so the portal never makes one; if anything ever does beside a waiting text, the
 * delete is refused here instead of leaving a second text nobody wrote.
 *
 *
 * WHAT IT DOES TO THE ROWS THAT ARE ALREADY THERE
 * -----------------------------------------------
 * It refuses to be created over a member with two texts waiting, and that is a precondition rather
 * than something this file settles: which of two texts would survive is nobody's decision, so nothing
 * here chooses. Measured on QA on 02.10.2026, read only, against Flyway 52: no member held more than
 * one text waiting, and no text was waiting at all. OneTextWaitsCarriedOverTest runs this file over
 * every shape the queue can hold beside a waiting text, and over the two texts that stop it.
 *
 *
 * WHAT THE ROUTE DOES WHEN IT MEETS THIS
 * --------------------------------------
 * The one route that writes a text meets this index as an answer and not as a fault, so the request
 * that loses the race is told what the owner decided it is told. How, is that route's to say, and it
 * says it in MeWriteApi rather than here, where a sentence could not be corrected once this file has
 * been applied.
 */
create unique index verification_one_text_waits_per_member on verification (competitor_id)
    where queue = 'profiles' and state = 'waiting' and photo_id is null;

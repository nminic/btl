/**
 * WHAT EACH ROUTE'S REFUSALS ARE CALLED, AND THE SENTENCE EACH ONE GETS.
 *
 * <p>Both routes that take a link out of a message refuse by name rather than by
 * number, on purpose: `PasswordReset.decide` says at length that „no" without a
 * reason is a form somebody retries with the same password. These are the names, and
 * what the screen turns each of them into.
 *
 * <p><b>Written out by hand and held to the server in the same commit</b>, which is
 * the shape `CLAUDE.md` asks of any list a guard depends on: `refusals.test.ts` reads
 * the two Java sources, takes every reason constant they declare, and fails when one
 * is not here or when one here is not there. A reason added on the server is
 * therefore a red gate on the day it is written rather than a reader shown a code he
 * cannot read.
 *
 * <p><b>Their own module rather than a constant beside each screen</b>, which is what
 * `react/only-export-components` asks for and what the guard above wants anyway: a
 * test reading a component file to get at a constant is a test that mounts React to
 * ask a question about a table.
 */

/** `PasswordResetApi`, which names three. */
export const WHEN_SETTING_A_PASSWORD: Record<string, string> = {
  /* The link has run out, has been spent, or was never one of ours. How long it
     lasted is deliberately not repeated in the words: that number is the schema's
     (`WhatTheMessageSays.Message`, held to the column default by
     `HowLongALinkLastsMatchesTheSchemaTest`), the message that carried the link
     already said it, and a copy on a screen is a second home for a fact the server
     owns. */
  theLinkIsNotValid: 'newPassword.linkIsNotValid',
  /* One name for three causes, and that is the server's own choice, stated in its
     own comment: a blank field, the two not agreeing, and one too short all have the
     same fix, which is to type it again. The sentence therefore names all three
     rather than guessing which of them it was. */
  theFormIsNotComplete: 'newPassword.formIsNotComplete',
  thePasswordHasLeaked: 'newPassword.passwordHasLeaked',
}

/** `EmailConfirmationApi`, which names one, and says in its own comment why there is
 *  nothing a second reason could add: a token is not a field anybody edits. */
export const WHEN_CONFIRMING_AN_ADDRESS: Record<string, string> = {
  theLinkIsNotValid: 'confirmAddress.linkIsNotValid',
}

/**
 * `RegistrationApi`, which names three, and one of them arrives under 409 rather than
 * 400.
 *
 * <p><b>The number is the route's business and not this table's.</b> `askTheServer`
 * reads both numbers the same way because both carry a named reason, so all three land
 * here by name. A table keyed by number would have to be right about which refusal got
 * which, and it has no way to be.
 *
 * <p><b>„The address is taken" says so plainly, and that is a decision rather than a
 * choice of words.</b> `btl-produkt/ADL.md`, 08.09.2026: „Registracija na vec zauzetu
 * adresu kaze da je zauzeta." The owner weighed it against silently sending a fresh
 * link to whoever holds the box, was shown the price - anybody can then test whether an
 * address belongs to a member - and chose the explicit message. A vaguer sentence here
 * would quietly undo that, so the sentence names the thing.
 */
export const WHEN_REGISTERING: Record<string, string> = {
  /* One name for a great many causes, exactly as on the other route: a field left
     empty, a date that is not one, a town neither the codebook nor a country resolves,
     two passwords that disagree, and a password under the length. The route names none
     of them apart on purpose („Why a registration was refused, and never which field"),
     so the sentence cannot point at a field either and says what it honestly can. */
  theFormIsNotComplete: 'registration.formIsNotComplete',
  thePasswordHasLeaked: 'registration.passwordHasLeaked',
  theAddressIsTaken: 'registration.addressIsTaken',
}

/**
 * `TeamWriteApi`, which names five, and answers a member proposing a team.
 *
 * <p><b>Two of the five say what the form already checks at the door</b>
 * ({@code nameError} in {@code pages/admin/teamProposal.ts}, read by
 * {@code ProposeTeam.tsx}'s own {@code check}), so the sentences these two names draw
 * are the same ones a member normally never reaches the server to hear: a name already
 * taken, and a name that makes no address at all. They are answered here all the same,
 * because the door only checks the team list as it stood at the last render, and a name
 * taken a moment before this request lands is a race the form cannot see.
 */
export const WHEN_PROPOSING_A_TEAM: Record<string, string> = {
  theFormIsNotComplete: 'teams.proposeFormIncomplete',
  theCountryIsNotKnown: 'teams.proposeCountryUnknown',
  theNameMakesNoAddress: 'teams.proposeNoAddress',
  theLinkIsNotShaped: 'teams.proposeLinkNotShaped',
  theAddressIsTaken: 'teams.proposeTaken',
}

/**
 * `CommentWriteApi`, which names three, and answers a member rating an event.
 *
 * <p><b>Two of the three reuse a sentence the screen already draws for a client-side
 * reason</b>, because the two questions are the same question asked twice: the button
 * that sends a rating is already disabled while any of the three marks is missing
 * ({@code event.commentNeedsMarks}), and the event page already refuses to open the
 * form at all for a race still to come ({@code event.notRunYetWhy}). Both can still
 * reach the server - a typed address, or a race the calendar has since moved - and the
 * server answers with the identical words rather than a second sentence for the same
 * fact.
 */
export const WHEN_RATING_AN_EVENT: Record<string, string> = {
  theFormIsNotComplete: 'event.commentNeedsMarks',
  theEventIsNotKnown: 'event.commentEventUnknown',
  theEventHasNotBeenRun: 'event.notRunYetWhy',
}

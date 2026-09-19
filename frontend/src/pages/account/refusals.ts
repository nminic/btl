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

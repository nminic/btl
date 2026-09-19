/**
 * HOW LONG A PASSWORD HAS TO BE, FOR THE ONE SENTENCE ON THE PORTAL THAT SAYS SO.
 *
 * <p>Owner, 11.09.2026 (`ADL.md`): „lozinka najmanje 12 znakova, bez ostalih uslova,
 * uz proveru na listi procurelih". The rule itself lives in `PasswordPolicy.SHORTEST`
 * and is enforced there and nowhere else.
 *
 * <p><b>This is a copy of that number, which is why it has a floor.</b>
 * `passwordRule.test.ts` reads the Java source and fails the moment the two part
 * company, so a rule changed on the server cannot leave a screen quietly promising
 * the old one.
 *
 * <p><b>Where it is used, and where it deliberately is not.</b> It is used in the
 * sentence that explains `theFormIsNotComplete`, which is the server's own refusal
 * being told in words - and telling a reader WHY a password was refused is the whole
 * point of that refusal carrying a name (`PasswordReset.decide`). It is NOT written
 * beside the field as a rule to read before pressing: the owner read every one of the
 * portal's sixty one such rules on 31.08.2026, kept seven and had the rest deleted,
 * and the password field was not among the seven (`forms/fieldHint.test.tsx`).
 *
 * <p><b>Two places holding one number is the fault this file exists against, and the
 * portal already carries a standing example of it.</b>
 * `forms/definitions/registracija.form.json` says `minLength: 10` where the owner
 * decided twelve, and has said so since before there was a server to disagree with.
 * That is not this increment's to change - it is a registration screen, and one whose
 * form has been written against for weeks - but it is exactly what an unheld copy
 * becomes.
 */

/** Twelve, held to {@code PasswordPolicy.SHORTEST} by this file's own test. */
export const SHORTEST_PASSWORD = 12

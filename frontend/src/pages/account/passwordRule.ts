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
 * <p><b>Where it is used, and it is used at both moments.</b> It is in the sentence
 * that explains `theFormIsNotComplete`, which is the server's own refusal being told in
 * words - and telling a reader WHY a password was refused is the whole point of that
 * refusal carrying a name (`PasswordReset.decide`). Since 20.09.2026 it is also the
 * rule beside the field itself, read before anything is pressed: the owner asked for it
 * there as the eighth of the seven he kept on 31.08.2026, because the reader of THIS
 * screen came from a link in a message with no rule in front of him, and a password box
 * empties itself on every refusal. The field of the registration form is still one of
 * the fifty four he had deleted and still carries no rule; the two are counted together
 * by `forms/fieldHint.test.tsx`.
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

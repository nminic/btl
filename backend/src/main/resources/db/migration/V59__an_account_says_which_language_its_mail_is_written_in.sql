/* An account says which language its mail is written in.
 *
 * The owner's decision of 03.10.2026, chosen among the options put to him (PDL P18, „Jezik mejla
 * ide po jeziku profila, uz mogućnost naknadne izmene"; the answers of that evening, point 12): the
 * screen does not remember a language, because the address carries it, but the member chooses in
 * his profile the language his mail is written in, Serbian unless he chooses otherwise. The
 * privacy policy has said so since V57, in the owner's approved words: „Jezik pošte, srpski ili
 * engleski | Da vam mejlovi stižu na jeziku koji ste izabrali; početni izbor je jezik strane na
 * kojoj ste se učlanili | Izvršenje ugovora | Dok traje nalog".
 *
 *
 * WHY ON THE ACCOUNT AND NOT ON THE MEMBER
 * ----------------------------------------
 * A letter goes to an ADDRESS, and the address is account.email. Every route that posts one reads
 * the address off the account, so the language is read off the same row in the same statement and
 * cannot belong to somebody else. A member with no account has no address and is written to by
 * nobody, so a language on competitor would be a column nothing could ever read for him.
 *
 *
 * WHAT IT HOLDS
 * -------------
 * The two letters the page names its language by, `sr` and `en` (frontend/src/i18n/config.ts), and
 * nothing else. MailLanguage in the domain names the same two, and MailLanguageMatchesTheSchemaTest
 * holds the constraint to the enum in both directions, so a third language is a decision made in
 * both places at once rather than a string one of them has never heard of.
 *
 * `sr` by default, which is the owner's „podrazumevano srpski", and NOT NULL, because „no language"
 * would be a third state with nobody to say what it means.
 *
 *
 * THE ROWS THAT ARE ALREADY THERE
 * -------------------------------
 * Every account standing when this runs is given `sr` by the default, which is what the decision
 * says an account that never chose is: nobody has chosen anything yet, because until this file
 * there was nowhere to put a choice. So no row can break the constraint, and it is added VALID.
 * MailLanguageCarriedOverTest takes the column away, writes accounts the way a database already
 * holds them, runs THIS FILE over them, and requires every one of them to come out `sr`.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */
alter table account
    add column mail_language text not null default 'sr'
        constraint account_mail_language_known check (mail_language in ('sr', 'en'));

comment on column account.mail_language is 'The language the mail of this account is written in, sr or en. Serbian until the member chooses otherwise in his profile (owner, 03.10.2026, PDL P18); a registration typed on the English page starts in English (owner, 10.10.2026). Read off the same row as the address, so a letter is never written in the language of whoever set it off. The two invitations the administration sends are always Serbian whatever this says (owner, 10.10.2026).';

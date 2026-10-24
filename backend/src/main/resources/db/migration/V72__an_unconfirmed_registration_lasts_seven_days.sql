/* An unconfirmed registration lasts seven days, and then it is deleted.
 *
 * The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"), asked
 * „Moze li link da traje 7 dana, a da se nakon toga briše i cela prijava (nedovršena registracija, oslobađa se mail adresa i sl)?", and chose with my recommendation
 * that the confirmation link lasts seven days, where it was twenty four hours, and that a
 * registration not confirmed in that time is deleted by itself, with no message, leaving the address
 * free. The same for a member the administration entered who sets no password in seven days, unless
 * he already has a payment or a number. The deleting is the server's (`UnconfirmedAccountsAreSwept`);
 * this file holds the two things only the schema can.
 *
 *
 * THE LINK
 * --------
 * `email_verification_token.expires_at` defaults to seven days from the moment the row is written,
 * where V6 wrote twenty four hours. HowLongALinkLastsMatchesTheSchemaTest asks this default and
 * requires the message to promise what it gives.
 *
 * WRITTEN AS 168 HOURS AND NOT AS 7 DAYS, for the reason V6's twenty four hours were hours
 * (AccountAndVerificationTest): a day is a calendar day, twenty three or twenty five hours on the
 * night the clocks change, so a week of days is not one length. The portal promises a length.
 *
 * A DEFAULT AND NOT A CONSTRAINT, so the rows already standing are not touched by it: a link mailed
 * yesterday under the words „Link važi 24 sata" keeps the twenty four hours its letter promised.
 *
 * The invitation of a member lives in `password_reset_token` and that column's default is NOT
 * moved: it is the hour of a forgotten password, which is the owner's number of 11.09.2026. The
 * invitation's seven days are written onto its own row when it is minted (AnInvitationOfAMember).
 *
 *
 * THE ACCOUNTS ALREADY STANDING
 * -----------------------------
 * Derived on 24.10.2026 and not the owner's own words (PDL, marked IZVEDENO 24.10.2026): the
 * accounts already standing get seven days from the day of deployment. An account standing unconfirmed when
 * this runs was mailed a link of twenty four hours or one hour, and words that told him to ask for a
 * new one, never that he would be deleted. Every one of its links has long run out, so by the rule
 * alone the first sweep would delete it the hour the server came up. So each of them is kept for
 * seven days from the moment this file runs, and that moment is written onto the row:
 * `account.kept_unconfirmed_until`. An account written after this file never carries it, because
 * every such account was told about the seven days in its own letter.
 *
 * The column is empty for every confirmed account, and nothing in the portal writes it again; it is
 * a fact about the day of this deployment and nothing else. Nullable, with no default, so a new
 * account has nothing to wait for but its links.
 *
 * UnconfirmedAccountsCarriedOverTest takes the column away, writes accounts as a database already
 * holds them, runs THIS FILE over them, and requires the unconfirmed ones and only those to come out
 * kept for seven days.
 *
 *
 * WHEN THE ACCOUNT WAS WRITTEN
 * ----------------------------
 * The owner chose with my recommendation (PDL 24.10.2026, „Rok nepotvrđene prijave") that a new
 * confirmation gives seven new days and that the registration is deleted fourteen days after it at
 * the latest; for an invitation the same bound, fourteen days from the entry, is derived (PDL,
 * IZVEDENO 24.10.2026, „Granica od 14 dana važi i za pozivnicu"). Asking for a new link every
 * six days would otherwise hold somebody else's address taken for ever. So the account says when it
 * was written: `account.created_at`, which every account written from this file on is given by its
 * default, the registration and the administration's entry alike.
 *
 * EMPTY FOR THE ACCOUNTS ALREADY STANDING, and not filled with the moment this runs: that moment is
 * not when any of them was written, and a column that said so would be a fact nobody recorded. The
 * column is added with no default first, so PostgreSQL leaves those rows empty, and the default is
 * set after. An account with no moment is held only by its links and by the seven days above; it
 * has no fourteenth day, and on 24.10.2026 neither QA nor production held a single unconfirmed
 * account.
 *
 * This file does not change once it is applied (ADL A2); a correction is the next migration.
 */

alter table email_verification_token
    alter column expires_at set default now() + interval '168 hours';

alter table account
    add column kept_unconfirmed_until timestamptz;

comment on column account.kept_unconfirmed_until is 'Until when an account that stood unconfirmed on the day V72 ran is kept, whatever its links say: seven days from that day (derived 24.10.2026, PDL). Empty for every other account, and never written again.';

update account
   set kept_unconfirmed_until = now() + interval '168 hours'
 where email_confirmed_at is null;

alter table account
    add column created_at timestamptz;

alter table account
    alter column created_at set default now();

comment on column account.created_at is 'When the account was written, for every account written from V72 on; empty for the accounts that stood before it, whose moment nobody recorded. An unconfirmed registration is deleted fourteen days after it at the latest (owner, 24.10.2026, chosen with my recommendation; derived for an invitation).';
